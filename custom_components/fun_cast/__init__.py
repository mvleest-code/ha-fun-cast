"""Local MP4 upload API for the Fun Cast dashboard."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
import os

from aiohttp import web
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.util import slugify

DOMAIN = "fun_cast"
MAX_UPLOAD_BYTES = 75 * 1024 * 1024
STORE = Path("/media/fun_cast")


def _source(name: str) -> str:
    return f"media-source://media_source/local/fun_cast/{name}"


REPEAT_LISTENERS = f"{DOMAIN}_repeat_listeners"


def _stop_repeat(hass: HomeAssistant, entity_id: str) -> None:
    listeners = hass.data.setdefault(REPEAT_LISTENERS, {})
    remove = listeners.pop(entity_id, None)
    if remove:
        remove()


def _start_repeat(hass: HomeAssistant, entity_id: str, source: str) -> None:
    _stop_repeat(hass, entity_id)

    async def _on_state_change(event) -> None:
        old_state = event.data.get("old_state")
        new_state = event.data.get("new_state")
        if not old_state or not new_state:
            return
        if old_state.state not in ("playing", "paused", "buffering"):
            return
        if new_state.state not in ("idle", "off"):
            return
        await hass.services.async_call(
            "media_player",
            "play_media",
            {"media_content_id": source, "media_content_type": "video/mp4"},
            target={"entity_id": entity_id},
            blocking=False,
        )

    hass.data.setdefault(REPEAT_LISTENERS, {})[entity_id] = async_track_state_change_event(
        hass, entity_id, _on_state_change
    )


class FunCastRepeatView(HomeAssistantView):
    url = "/api/fun_cast/repeat"
    name = "api:fun_cast:repeat"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        try:
            data = await request.json()
            entity_id = str(data.get("entity_id", ""))
            enabled = bool(data.get("enabled", False))
            source = str(data.get("source", ""))
        except Exception:
            return self.json({"error": "Ongeldige herhaalopdracht."}, status_code=400)
        if not entity_id.startswith("media_player."):
            return self.json({"error": "Ongeldige mediaspeler."}, status_code=400)
        if enabled:
            if not source.startswith("media-source://media_source/local/fun_cast/"):
                return self.json({"error": "Ongeldige clip."}, status_code=400)
            _start_repeat(request.app["hass"], entity_id, source)
        else:
            _stop_repeat(request.app["hass"], entity_id)
        return self.json({"enabled": enabled, "entity_id": entity_id})


class FunCastView(HomeAssistantView):
    url = "/api/fun_cast/files"
    name = "api:fun_cast:files"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        STORE.mkdir(parents=True, exist_ok=True)
        requested = str(request.query.get("file", ""))
        if requested:
            if Path(requested).name != requested or not requested.lower().endswith(".mp4"):
                return self.json({"error": "Ongeldige clipnaam."}, status_code=400)
            target = STORE / requested
            if not target.is_file():
                return self.json({"error": "Deze clip bestaat niet meer."}, status_code=404)
            return web.FileResponse(target, headers={"Content-Type": "video/mp4"})
        files = [
            {"name": path.name, "source": _source(path.name), "size": path.stat().st_size}
            for path in sorted(STORE.glob("*.mp4"), key=lambda item: item.stat().st_mtime, reverse=True)
        ]
        return self.json({"files": files})

    async def post(self, request: web.Request) -> web.Response:
        STORE.mkdir(parents=True, exist_ok=True)
        try:
            reader = await request.multipart()
            field = await reader.next()
        except Exception as err:
            return self.json({"error": f"Ongeldige upload: {err}"}, status_code=400)
        if field is None or not field.filename or not field.filename.lower().endswith(".mp4"):
            return self.json({"error": "Kies een MP4-bestand."}, status_code=400)

        stem = slugify(Path(field.filename).stem) or "fun-clip"
        filename = f"{stem}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.mp4"
        temporary = STORE / f".{filename}.upload"
        target = STORE / filename
        size = 0
        try:
            with temporary.open("wb") as handle:
                while chunk := await field.read_chunk(64 * 1024):
                    size += len(chunk)
                    if size > MAX_UPLOAD_BYTES:
                        raise ValueError("Bestand is groter dan 75 MB.")
                    handle.write(chunk)
            header = temporary.read_bytes()[:32]
            if len(header) < 12 or header[4:8] != b"ftyp":
                raise ValueError("Dit lijkt geen geldig MP4-bestand.")
            os.replace(temporary, target)
        except ValueError as err:
            temporary.unlink(missing_ok=True)
            return self.json({"error": str(err)}, status_code=400)
        except Exception as err:
            temporary.unlink(missing_ok=True)
            return self.json({"error": f"Opslaan mislukt: {err}"}, status_code=500)
        return self.json({"name": filename, "source": _source(filename), "size": size})

    async def patch(self, request: web.Request) -> web.Response:
        try:
            payload = await request.json()
            original = str(payload.get("name", ""))
            requested = str(payload.get("new_name", "")).strip()
        except Exception:
            return self.json({"error": "Ongeldige hernoemopdracht."}, status_code=400)
        if Path(original).name != original or not original.lower().endswith(".mp4"):
            return self.json({"error": "Ongeldige clipnaam."}, status_code=400)
        source = STORE / original
        if not source.is_file():
            return self.json({"error": "Deze clip bestaat niet meer."}, status_code=404)
        stem = slugify(Path(requested).stem) or "fun-clip"
        target_name = f"{stem}.mp4"
        target = STORE / target_name
        if target != source and target.exists():
            return self.json({"error": "Er bestaat al een clip met die naam."}, status_code=409)
        try:
            source.rename(target)
        except OSError as err:
            return self.json({"error": f"Hernoemen mislukt: {err}"}, status_code=500)
        return self.json({"name": target_name, "source": _source(target_name), "size": target.stat().st_size})

    async def delete(self, request: web.Request) -> web.Response:
        name = str(request.query.get("name", ""))
        if Path(name).name != name or not name.lower().endswith(".mp4"):
            return self.json({"error": "Ongeldige clipnaam."}, status_code=400)
        target = STORE / name
        if not target.is_file():
            return self.json({"error": "Deze clip bestaat niet meer."}, status_code=404)
        try:
            target.unlink()
        except OSError as err:
            return self.json({"error": f"Verwijderen mislukt: {err}"}, status_code=500)
        return self.json({"name": name})


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            "/fun-cast",
            str(Path(__file__).parent / "frontend"),
            cache_headers=False,
        )
    ])
    hass.http.register_view(FunCastView())
    hass.http.register_view(FunCastRepeatView())
    return True
