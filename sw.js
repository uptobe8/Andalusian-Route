const CACHE='andalusian-roude-v9';
const SHELL=['./','./index.html','./assets/css/premium.css','./assets/js/app.js','./assets/js/core.js','./assets/js/state.js','./assets/js/sources.js','./assets/js/planner.js','./assets/js/route-ui.js','./assets/js/explore-ui.js','./assets/js/camper-ui.js','./manifest.webmanifest','./data/park4night-live.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;e.respondWith(caches.match(e.request).then(hit=>{const fresh=fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return r}).catch(()=>hit);return hit||fresh}))});
