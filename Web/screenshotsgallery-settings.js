(function(){
  'use strict';
  const API_ROOT = '/ScreenShotsGallery/api';

  function apiUrl(path){
    const normalized = String(path || '').replace(/^\/+/, '');
    return `${window.location.origin}/${normalized}`;
  }

  async function getConfig(){
    const resp = await fetch(apiUrl(`${API_ROOT}/config`), { credentials: 'same-origin' });
    if(!resp.ok) throw new Error('Failed to load config: '+resp.status);
    return await resp.json();
  }

  async function saveConfig(cfg){
    const resp = await fetch(apiUrl(`${API_ROOT}/config`), { method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'}, body: JSON.stringify(cfg) });
    if(!resp.ok) throw new Error('Failed to save config: '+resp.status);
    return await resp.json();
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    const input = document.getElementById('folders');
    const btn = document.getElementById('save');
    const status = document.getElementById('status');
    try{
      const cfg = await getConfig();
      const names = cfg.ImagesSubfolderNames || cfg.ImagesSubfolderName ? (cfg.ImagesSubfolderNames || [cfg.ImagesSubfolderName]) : ['images'];
      input.value = names.join(',');
    }catch(e){ console.error(e); status.textContent='Load failed'; }

    btn.addEventListener('click', async ()=>{
      status.textContent='Saving...';
      try{
        const raw = input.value.split(',').map(s=>s.trim()).filter(Boolean);
        const payload = { ImagesSubfolderNames: raw, ImagesSubfolderName: raw.length? raw[0] : 'images' };
        await saveConfig(payload);
        status.textContent='Saved';
      }catch(e){ console.error(e); status.textContent='Save failed'; }
    });
  });
})();
