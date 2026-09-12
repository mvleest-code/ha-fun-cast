class FunCastCard extends HTMLElement {
  setConfig(config) { this._config = config || {}; this._render(); this._loaded=false; if (this._hass) this._load(); }
  set hass(hass) { this._hass = hass; if (!this._loaded) this._load(); }
  getCardSize() { return 7; }

  _targets() { return this._config.targets || [
    { entity: "media_player.google_tv_woonkamer", name: "Google TV Woonkamer" },
    { entity: "media_player.4k_tv_box", name: "4K TV Box" },
    { entity: "media_player.googletv_slaapkamer", name: "Google TV Slaapkamer" },
  ]; }

  _render() {
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        ha-card { overflow:hidden; border-radius:24px; background:linear-gradient(145deg,#18253a,#0e1624); border:1px solid rgba(88,200,255,.2); }
        .hero { padding:25px 22px 20px; background:radial-gradient(circle at 88% 15%,rgba(0,204,229,.25),transparent 36%); }
        .eyebrow { color:#77e8f5; font-size:.72rem; font-weight:800; letter-spacing:.14em; }
        h1 { margin:8px 0 6px; font-size:1.65rem; } p { margin:0;color:var(--secondary-text-color); }
        .body { padding:0 16px 18px; display:grid; gap:13px; }
        .upload { border:1px dashed rgba(104,219,235,.5); border-radius:16px; padding:17px; text-align:center; background:rgba(8,21,36,.45); }
        input { display:none; } label { display:inline-flex; gap:8px; align-items:center; padding:11px 15px; border-radius:11px; background:#10bdd4; color:#fff; font-weight:700; cursor:pointer; }
        select, button { min-height:46px; border:0; border-radius:12px; padding:0 13px; font:inherit; }
        .actions { display:grid; grid-template-columns:1fr; gap:9px; } button.stop { background:rgba(255,102,112,.16); color:#ffb6bb; font-weight:700; cursor:pointer; } button.stop[hidden] { display:none; }
        .picker { position:fixed; z-index:1000; inset:0; display:flex; align-items:end; background:rgba(0,0,0,.62); padding:16px; } .picker[hidden] { display:none; }
        .picker-panel { width:100%; max-width:520px; margin:auto; border-radius:23px; padding:18px; background:#17243a; border:1px solid rgba(93,222,237,.28); box-shadow:0 18px 50px #0009; }
        .picker-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; } .picker h2 { margin:0; font-size:1.25rem; } .picker-close { min-height:36px; min-width:36px; padding:0; background:rgba(255,255,255,.09); color:#d8f7fb; }
        .device-list { display:grid; gap:9px; margin:13px 0; } .device { text-align:left; color:var(--primary-text-color); background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.09); cursor:pointer; } .device:hover { background:rgba(20,197,218,.18); }
        .repeat { display:flex; gap:8px; align-items:center; color:var(--secondary-text-color); min-height:42px; padding:0 12px; border-radius:12px; background:rgba(255,255,255,.055); } .repeat input { display:block; width:18px; height:18px; accent-color:#10c6dc; }
        @media (max-width:480px) { .hero { padding:21px 18px 16px; } h1 { font-size:1.45rem; } .body { padding:0 12px 14px; } }
        select { background:rgba(255,255,255,.09); color:var(--primary-text-color); border:1px solid rgba(255,255,255,.12); }
        button.cast { background:linear-gradient(135deg,#10c6dc,#1979ed); color:#fff; font-weight:800; cursor:pointer; }
        button.cast:disabled { opacity:.45; cursor:default; }
        .clips { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; }
        .clip { display:grid; grid-template-columns:minmax(0,1fr) 32px 32px; gap:8px; align-items:center; padding:8px; border-radius:14px; background:rgba(255,255,255,.055); cursor:pointer; }
        .clip.selected { outline:1px solid #32d6eb; background:rgba(18,196,216,.14); }
        .thumb { grid-column:1 / -1; width:100%; aspect-ratio:16/9; border-radius:10px; background:#090f19; object-fit:cover; }
        .clip ha-icon { color:#6ee5f2; } .clip span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; font-size:.76rem; } .clip button { min-height:32px; min-width:32px; padding:0 6px; background:rgba(255,255,255,.08); color:#bcebf1; cursor:pointer; } .clip button ha-icon { --mdc-icon-size:17px; }
        .status { min-height:1.2em; text-align:center; color:#aebdcc; font-size:.9rem; } .status.error { color:#ff9ba3; }
      </style>
      <ha-card>
        <div class="hero"><div class="eyebrow">LOCAL VIDEO CAST</div><h1>Fun Cast</h1><p>Upload je eigen mp4’s en stuur ze naar een scherm.</p></div>
        <div class="body">
          <div class="upload"><label><ha-icon icon="mdi:upload"></ha-icon> MP4 uploaden<input type="file" accept="video/mp4,.mp4"></label></div>
          <div class="actions"><button class="cast" disabled><ha-icon icon="mdi:cast"></ha-icon> Cast geselecteerde clip</button><button class="stop" hidden><ha-icon icon="mdi:stop"></ha-icon> Stop cast</button></div>
          <div class="clips"></div><div class="status">Clips laden…</div>
          <div class="picker" hidden><div class="picker-panel"><div class="picker-head"><h2>Cast naar…</h2><button class="picker-close"><ha-icon icon="mdi:close"></ha-icon></button></div><label class="repeat"><input class="repeat" type="checkbox"> Clip blijven herhalen</label><div class="device-list">${this._targets().map(t => `<button class="device" data-target="${t.entity}"><ha-icon icon="mdi:cast"></ha-icon> ${t.name}</button>`).join("")}</div></div></div>
        </div>
      </ha-card>`;
    root.querySelector("input").addEventListener("change", e => this._upload(e.target.files?.[0]));
    root.querySelector("button.cast").addEventListener("click", () => this._openPicker());
    root.querySelector("button.stop").addEventListener("click", () => this._stop());
    root.querySelector(".picker-close").addEventListener("click", () => this._closePicker());
    root.querySelector(".picker").addEventListener("click", event => { if(event.target===event.currentTarget) this._closePicker(); });
    root.querySelectorAll("button.device").forEach(button=>button.addEventListener("click",()=>this._cast(button.dataset.target)));
  }

  _status(text, error=false) { const n=this.shadowRoot.querySelector(".status"); if(n){n.textContent=text;n.classList.toggle("error",error);} }
  async _fetch(path, options={}) {
    const response = await this._hass.fetchWithAuth(path, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Verzoek mislukt");
    return data;
  }
  async _load() {
    if (!this._hass || !this.shadowRoot) return;
    try {
      const data=await this._fetch("/api/fun_cast/files"); this._files=data.files; await this._resolvePreviews(); this._drawFiles(); this._status(data.files.length ? "Kies een clip om te casten" : "Nog geen clips geüpload");
    } catch(err) { this._status(err.message || "Clips laden mislukt",true); }
    this._loaded=true;
  }
  async _resolvePreviews() {
    await Promise.all((this._files||[]).map(async file=>{
      try {
        if(file.preview) return;
        const response=await this._hass.fetchWithAuth("/api/fun_cast/files?file="+encodeURIComponent(file.name));
        if(!response.ok) throw new Error("Video niet beschikbaar");
        file.preview=URL.createObjectURL(await response.blob());
      } catch(err) { console.warn("Miniatuur niet beschikbaar",err); }
    }));
  }
  _drawFiles() {
    const box=this.shadowRoot.querySelector(".clips"); const cast=this.shadowRoot.querySelector("button.cast"); if(!box) return;
    box.innerHTML=(this._files||[]).map((f,i)=>`<div class="clip ${this._selected?.name===f.name?"selected":""}" data-index="${i}"><video class="thumb" muted playsinline preload="metadata" src="${f.preview||""}"></video><span>${f.name}</span><button class="rename" data-index="${i}" title="Naam aanpassen"><ha-icon icon="mdi:pencil"></ha-icon></button><button class="delete" data-index="${i}" title="Clip verwijderen"><ha-icon icon="mdi:delete-outline"></ha-icon></button></div>`).join("");
    box.querySelectorAll(".clip").forEach(n=>n.addEventListener("click",()=>{this._selected=this._files[Number(n.dataset.index)];this._drawFiles();this._status("Klaar om te casten");}));
    box.querySelectorAll(".thumb").forEach(video=>video.addEventListener("loadedmetadata",()=>{ if(video.duration>1) video.currentTime=Math.min(0.8,video.duration/3); },{once:true}));
    box.querySelectorAll("button.rename").forEach(n=>n.addEventListener("click",event=>{ event.stopPropagation(); this._rename(this._files[Number(n.dataset.index)]); }));
    box.querySelectorAll("button.delete").forEach(n=>n.addEventListener("click",event=>{ event.stopPropagation(); this._delete(this._files[Number(n.dataset.index)]); }));
    cast.disabled=!this._selected;
  }
  async _rename(file) {
    const base=file.name.replace(/\.mp4$/i,"");
    const newName=window.prompt("Nieuwe naam voor deze clip:",base);
    if(newName===null || !newName.trim()) return;
    this._status("Naam aanpassen…");
    try { const changed=await this._fetch("/api/fun_cast/files",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:file.name,new_name:newName})}); this._files=this._files.map(item=>item.name===file.name?changed:item); if(this._selected?.name===file.name)this._selected=changed; this._drawFiles(); this._status("Clip hernoemd"); }
    catch(err){this._status(err.message||"Hernoemen mislukt",true);}
  }
  async _delete(file) {
    if(!window.confirm(`Clip “${file.name}” verwijderen?`)) return;
    this._status("Clip verwijderen…");
    try { await this._fetch("/api/fun_cast/files?name="+encodeURIComponent(file.name),{method:"DELETE"}); this._files=this._files.filter(item=>item.name!==file.name); if(this._selected?.name===file.name)this._selected=null; this._drawFiles(); this._status("Clip verwijderd"); }
    catch(err){this._status(err.message||"Verwijderen mislukt",true);}
  }
  async _upload(file) {
    if(!file) return; if(!file.name.toLowerCase().endsWith(".mp4")){this._status("Alleen MP4-bestanden zijn toegestaan.",true);return;}
    this._status("Uploaden: "+file.name); const form=new FormData(); form.append("file",file,file.name);
    try { const item=await this._fetch("/api/fun_cast/files",{method:"POST",body:form}); this._files=[item,...(this._files||[])]; await this._resolvePreviews(); this._selected=item;this._drawFiles();this._status("Upload klaar — kies Cast"); }
    catch(err){this._status(err.message||"Upload mislukt",true);}
    finally { const input=this.shadowRoot.querySelector("input"); if(input) input.value=""; }
  }
  _openPicker() { if(!this._selected) return; this.shadowRoot.querySelector(".picker").hidden=false; }
  _closePicker() { this.shadowRoot.querySelector(".picker").hidden=true; }
  async _cast(target) {
    if(!this._selected || !target) return; const repeat=this.shadowRoot.querySelector("input.repeat").checked; const targetName=this._targets().find(item=>item.entity===target)?.name||target; this._closePicker(); this._status("Cast starten…");
    try { await this._hass.callService("media_player","play_media",{media_content_id:this._selected.source,media_content_type:"video/mp4"},{entity_id:target}); await this._fetch("/api/fun_cast/repeat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:repeat,entity_id:target,source:this._selected.source})}); this._castingTarget=target; this.shadowRoot.querySelector("button.stop").hidden=false; this._status((repeat?"Herhalend gecast naar ":"Wordt gecast naar ")+targetName); }
    catch(err){this._status(err.message||"Cast mislukt",true);}
  }
  async _stop() {
    if(!this._castingTarget) return; this._status("Cast stoppen…");
    try { await this._fetch("/api/fun_cast/repeat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:false,entity_id:this._castingTarget})}); await this._hass.callService("media_player","media_stop",{}, {entity_id:this._castingTarget}); this._castingTarget=null; this.shadowRoot.querySelector("button.stop").hidden=true; this._status("Cast gestopt"); }
    catch(err){this._status(err.message||"Stoppen mislukt",true);}
  }
}
customElements.define("fun-cast-card",FunCastCard);
window.customCards=window.customCards||[];window.customCards.push({type:"fun-cast-card",name:"Fun Cast",description:"Upload and cast local MP4 clips."});
