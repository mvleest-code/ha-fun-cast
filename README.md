# Fun Cast

Fun Cast is a Home Assistant custom integration and Lovelace card for uploading personal MP4 clips, casting them to a selected media player, repeating playback, and stopping it.

## Installation with HACS

1. In HACS, open **Integrations** and choose the three-dot menu.
2. Choose **Custom repositories** and add this repository as category **Integration**.
3. Install **Fun Cast** and restart Home Assistant.
4. Add the resource `/fun-cast/fun-cast-card.js` as a JavaScript module if Home Assistant has not already added it.

## Card configuration

```yaml
type: custom:fun-cast-card
targets:
  - entity: media_player.google_tv_woonkamer
    name: Google TV Woonkamer
```

The integration stores uploaded clips locally in `/media/fun_cast`.
