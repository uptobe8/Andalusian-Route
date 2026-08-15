(() => {
  'use strict';
  const D = window.CADIZ_DATA;
  const state = {
    screen:'home',
    route:D.places.slice(0,5),
    selectedPlace:D.places[1],
    selectedSleep:D.sleep[1],
    filters:new Set(['Con playa','Frente al mar']),
    prefs:new Set(['drive-low']),
    favorites:new Set(JSON.parse(localStorage.getItem('cadizFavorites') || '[]')),
    mapZoom:1
  };
  const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
  const icons={home:'⌂',route:'⌁',explore:'◇',favorites:'♡',profile:'♙'};
  const screens=[['home','Inicio'],['route','Rutas'],['create','+'],['favorites','Favoritos'],['profile','Perfil']];
  function persist(){localStorage.setItem('cadizFavorites',JSON.stringify([...state.favorites]));}
  function go(screen){
    if(!qs(`[data-screen="${screen}"]`)) return;
    state.screen=screen;
    qsa('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===screen));
    renderNav();
    window.scrollTo({top:0,behavior:'instant'});
    if(screen==='route') renderRoute();
    if(screen==='timeline') renderTimeline();
    if(screen==='destination') renderDestination();
    if(screen==='sleep') renderSleep();
    if(screen==='sleep-detail') renderSleepDetail();
    if(screen==='favorites') renderFavorites();
  }
  window.go=go;
  function renderNav(){
    const html=screens.map(([id,label])=>id==='create'?`<button class="main-add" data-go="create" aria-label="Crear ruta">+</button>`:`<button data-go="${id}" class="${state.screen===id?'active':''}"><span>${icons[id]||'•'}</span><span>${label}</span></button>`).join('');
    qs('#bottomNav').innerHTML=html;
    qs('#desktopNav').innerHTML=[['home','⌂ Inicio'],['route','⌁ Rutas'],['explore','♡ Explorar'],['favorites','♡ Favoritos'],['sleep','▣ Park4Night'],['profile','♙ Perfil']].map(([id,label])=>`<button data-go="${id}" class="${state.screen===id?'active':''}">${label}</button>`).join('');
  }
  function renderHome(){
    qs('#heroImg').src=D.hero;
    qs('#featuredRoutes').innerHTML=D.routes.map(r=>`<button class="route-card" data-go="route"><img src="${r.photo}" alt="${r.name}"><span class="heart-badge">♡</span><span class="route-card-copy"><b>${r.name}</b><span>${r.days} días · ${r.nights} noches</span><span>+${r.km} km</span></span></button>`).join('');
    const items=[['☀','Playas'],['⌂','Pueblos'],['⌖','Miradores'],['🏄','Surf'],['⌁','Rutas Off'],['◒','Atardeceres'],['🍴','Gastronomía'],['⚓','Naturaleza']];
    qs('#exploreShortcuts').innerHTML=items.map(([i,l])=>`<button data-go="explore"><b>${i}</b>${l}</button>`).join('');
  }
  function renderCreate(){
    qs('#mustVisitChips').innerHTML=state.route.map(p=>`<button type="button" class="dest-chip" data-remove-place="${p.id}">${p.short} ×</button>`).join('')+`<button type="button" class="dest-chip" id="addDestinationChip">＋ Añadir</button>`;
    const labels=['Con playa','Frente al mar','Pueblo costero','Surf','Naturaleza','Miradores','Gastronomía','Pueblos blancos','Tranquilidad','Ambiente nocturno','Acceso fácil camper'];
    qs('#filterChips').innerHTML=labels.map(l=>`<button type="button" data-filter="${l}" class="${state.filters.has(l)?'active':''}">${l}</button>`).join('');
  }
  function hav(a,b){const R=6371,toR=d=>d*Math.PI/180;const dLat=toR(b.lat-a.lat),dLng=toR(b.lng-a.lng);const x=Math.sin(dLat/2)**2+Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
  function routeKm(){let t=0;for(let i=1;i<state.route.length;i++)t+=hav(state.route[i-1],state.route[i]);return Math.max(1,Math.round(t));}
  function driveMinutes(){return state.route.slice(1).reduce((a,p)=>a+p.minFromPrev,0);}
  function renderRoute(){
    const km=routeKm(), mins=driveMinutes(), days=Number(qs('#daysSelect')?.value||6), stops=state.route.length;
    qs('#summaryDays').textContent=`${days} días / ${Math.max(1,days-1)} noches`;
    qs('#summaryStops').textContent=`${stops} paradas`;
    qs('#summaryKm').textContent=`${km} km totales`;
    qs('#summaryDrive').textContent=`${Math.floor(mins/60)}h ${mins%60}m conducción`;
    qs('#mobileSummaryKm').textContent=`+ ${km} km`;qs('#mobileSummaryStops').textContent=stops;qs('#mapBadge').textContent=`${days} DÍAS · ${Math.max(1,days-1)} NOCHES`;
    const svg=qs('#routeSvg'); const w=700,h=900,pad=90;
    const lats=state.route.map(p=>p.lat), lngs=state.route.map(p=>p.lng), minLat=Math.min(...lats),maxLat=Math.max(...lats),minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
    const pts=state.route.map((p,i)=>{const x=pad+(p.lng-minLng)/(maxLng-minLng||1)*(w-pad*2);const y=h-pad-(p.lat-minLat)/(maxLat-minLat||1)*(h-pad*2);return {...p,x,y,i};});
    const path=pts.map((p,i)=>(i?'L':'M')+`${p.x},${p.y}`).join(' ');
    svg.innerHTML=`<defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#aee8f6"/><stop offset="1" stop-color="#e6f8fb"/></linearGradient></defs><rect width="700" height="900" fill="url(#sea)"/><path d="M410 0 C460 160 430 260 480 390 C520 500 430 630 500 900 L700 900 L700 0Z" fill="#f4f1e8"/><path d="${path}" fill="none" stroke="#dfff00" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" transform="scale(${state.mapZoom})" transform-origin="center"/>${pts.map(p=>`<g transform="translate(${p.x},${p.y}) scale(${state.mapZoom})"><circle r="22" fill="#ff1678" stroke="#fff" stroke-width="6"/><text y="7" text-anchor="middle" font-family="Arial" font-weight="900" font-size="19" fill="#fff">${p.i+1}</text><rect x="28" y="-17" rx="10" width="${Math.max(92,p.short.length*10+28)}" height="34" fill="#fff"/><text x="42" y="5" font-family="Arial" font-weight="900" font-size="14">${p.short.toUpperCase()}</text></g>`).join('')}`;
  }
  function renderTimeline(){
    qs('#timelineList').innerHTML=state.route.map((p,i)=>`<article class="timeline-card"><span class="timeline-number">${i+1}</span><img src="${p.photo}" alt="${p.name}"><div class="timeline-body"><span class="day-chip">DÍA ${i+1}</span><h3>${p.name}</h3><div class="timeline-meta">◷ ${p.kmFromPrev||0} km &nbsp; ${p.minFromPrev||0} min &nbsp; ☀ 🏄 🍴</div><div class="timeline-actions"><button data-open-place="${p.id}">VER DESTINO →</button><button data-move-up="${p.id}">↑</button><button data-move-down="${p.id}">↓</button><button data-delete-stop="${p.id}">×</button></div></div></article>`).join('');
  }
  function renderDestination(){const p=state.selectedPlace;qs('#destinationHeader').textContent=p.name;qs('#destinationHero').src=p.photo;qs('#destinationOverlayText').innerHTML=`<b>${p.name}</b><br>${p.desc}`;qs('#destDistance').textContent=`${p.kmFromPrev} km · ${p.minFromPrev} min`;qs('#destinationFeatures').innerHTML=[['🏖','Playas'],['🏄','Surf'],['🍴','Gastronomía'],['⌂','Pueblo']].map(([i,l])=>`<div class="feature-icon"><b>${i}</b>${l}</div>`).join('');const pois=[['Playa de Los Bateles',D.sunset,'1,2 km'],['Torre de Guzmán',D.camperAlt,'900 m'],['Casco Antiguo',D.hero,'300 m'],['Cala del Aceite',D.sleep[1].photo,'4,8 km']];qs('#poiGrid').innerHTML=pois.map(([n,img,d])=>`<button class="poi-card" data-go="explore"><img src="${img}"><b>${n} →</b><span>${d}</span></button>`).join('');qs('#destinationFav').textContent=(state.favorites.has('place:'+p.id)?'♥':'♡')+' Favorito';}
  function renderSleep(){const q=(qs('#sleepSearch')?.value||'').toLowerCase();const rows=D.sleep.filter(s=>!q||s.name.toLowerCase().includes(q)||s.town.toLowerCase().includes(q));qs('#sleepResults').innerHTML=rows.map(s=>`<button class="sleep-card" data-open-sleep="${s.id}"><img src="${s.photo}" alt="${s.name}"><div><h3>${s.name}</h3><p>${s.town} · ${s.distance}</p><p>${s.tags.join(' · ')}</p></div><div class="rating">${s.rating} <span>★</span></div></button>`).join('');}
  function renderSleepDetail(){const s=state.selectedSleep;qs('#sleepDetailTitle').textContent=s.name;qs('#sleepDetailHero').src=s.photo;qs('#sleepGallery').innerHTML=[s.photo,D.hero,D.sunset,D.camperAlt].map(u=>`<img src="${u}" alt="Vista del lugar">`).join('');const facts=[['⌁','Distancia a la playa','100 m'],['⌂','Distancia a población','4,8 km'],['◫','Tipo de suelo','Tierra / arena'],['🚐','Acceso','Camper / AC / furgoneta'],['◉','Servicios cercanos','Agua, restaurantes'],['☾','Tranquilidad','Muy tranquilo'],['⌁','Señal 4G/5G','Buena']];qs('#sleepFacts').innerHTML=facts.map(([i,l,v])=>`<div class="sleep-fact"><span>${i}</span><span>${l}</span><b>${v}</b></div>`).join('');qs('#sleepFav').textContent=(state.favorites.has('sleep:'+s.id)?'♥':'♡')+' Favorito';}
  function renderExplore(){const cats=[['Playas espectaculares',D.sunset],['Mejores atardeceres',D.hero],['Pueblos blancos',D.places[5].photo],['Lugares para surf',D.places[4].photo],['Miradores',D.places[3].photo],['Rincones tranquilos',D.sleep[2].photo],['Gastronomía',D.places[1].photo],['Naturaleza',D.places[0].photo]];qs('#exploreGrid').innerHTML=cats.map(([n,img])=>`<button class="inspiration-card" data-go="destination"><img src="${img}" alt="${n}"><b>${n}</b></button>`).join('');}
  function renderFavorites(){const all=[];state.favorites.forEach(k=>{const [type,id]=k.split(':');if(type==='place'){const p=D.places.find(x=>x.id===id);if(p)all.push({name:p.name,img:p.photo,go:'destination',id:p.id,type});}if(type==='sleep'){const s=D.sleep.find(x=>x.id===id);if(s)all.push({name:s.name,img:s.photo,go:'sleep-detail',id:s.id,type});}if(type==='route')all.push({name:'Ruta Cádiz',img:D.hero,go:'route',id:'route',type});});qs('#favoritesGrid').innerHTML=all.length?all.map(x=>`<button class="inspiration-card" data-fav-open="${x.type}:${x.id}" data-go="${x.go}"><img src="${x.img}"><b>${x.name}</b></button>`).join(''):`<div style="grid-column:1/-1;padding:40px;text-align:center;color:#777">Todavía no has guardado favoritos.</div>`;}
  function renderProfile(){const items=[['Tipo de camper','Mediana'],['Máximo km diarios','250 km'],['Playa','Sí'],['Surf','Sí'],['Lugares tranquilos','Alta prioridad'],['Tipo de viaje','Costa + naturaleza']];qs('#profileSettings').innerHTML=items.map(([a,b])=>`<div class="setting-row"><span>${a}</span><b>${b}</b></div>`).join('');}
  document.addEventListener('click',e=>{
    const goEl=e.target.closest('[data-go]');if(goEl){e.preventDefault();go(goEl.dataset.go);return;}
    const rem=e.target.closest('[data-remove-place]');if(rem){state.route=state.route.filter(p=>p.id!==rem.dataset.removePlace);renderCreate();return;}
    if(e.target.closest('#addDestinationChip')){const candidate=D.places.find(p=>!state.route.some(x=>x.id===p.id));if(candidate)state.route.push(candidate);renderCreate();return;}
    const f=e.target.closest('[data-filter]');if(f){state.filters.has(f.dataset.filter)?state.filters.delete(f.dataset.filter):state.filters.add(f.dataset.filter);renderCreate();return;}
    const pref=e.target.closest('[data-pref]');if(pref){qsa('[data-pref]').forEach(b=>b.classList.remove('selected'));pref.classList.add('selected');state.prefs=new Set([pref.dataset.pref]);return;}
    const open=e.target.closest('[data-open-place]');if(open){state.selectedPlace=D.places.find(p=>p.id===open.dataset.openPlace)||state.selectedPlace;go('destination');return;}
    const sl=e.target.closest('[data-open-sleep]');if(sl){state.selectedSleep=D.sleep.find(s=>s.id===sl.dataset.openSleep)||state.selectedSleep;go('sleep-detail');return;}
    const del=e.target.closest('[data-delete-stop]');if(del){if(state.route.length>2){state.route=state.route.filter(p=>p.id!==del.dataset.deleteStop);renderTimeline();}return;}
    const up=e.target.closest('[data-move-up]');if(up){const i=state.route.findIndex(p=>p.id===up.dataset.moveUp);if(i>0)[state.route[i-1],state.route[i]]=[state.route[i],state.route[i-1]];renderTimeline();return;}
    const down=e.target.closest('[data-move-down]');if(down){const i=state.route.findIndex(p=>p.id===down.dataset.moveDown);if(i>=0&&i<state.route.length-1)[state.route[i+1],state.route[i]]=[state.route[i],state.route[i+1]];renderTimeline();return;}
    if(e.target.closest('#saveRoute')){state.favorites.add('route:route');persist();e.target.closest('#saveRoute').textContent='♥ Guardada';return;}
    if(e.target.closest('#destinationFav')){const k='place:'+state.selectedPlace.id;state.favorites.has(k)?state.favorites.delete(k):state.favorites.add(k);persist();renderDestination();return;}
    if(e.target.closest('#sleepFav')){const k='sleep:'+state.selectedSleep.id;state.favorites.has(k)?state.favorites.delete(k):state.favorites.add(k);persist();renderSleepDetail();return;}
    if(e.target.closest('#addDestinationRoute')){if(!state.route.some(p=>p.id===state.selectedPlace.id))state.route.push(state.selectedPlace);go('route');return;}
    if(e.target.closest('#addSleepToRoute')){alert(`${state.selectedSleep.name} añadido como referencia de pernocta.`);return;}
    if(e.target.closest('#addStop')){const p=D.places.find(p=>!state.route.some(x=>x.id===p.id));if(p){state.route.push(p);renderTimeline();}return;}
    if(e.target.closest('#zoomIn')){state.mapZoom=Math.min(1.35,state.mapZoom+.08);renderRoute();return;}
    if(e.target.closest('#zoomOut')){state.mapZoom=Math.max(.78,state.mapZoom-.08);renderRoute();return;}
    if(e.target.closest('#centerMap')){state.mapZoom=1;renderRoute();return;}
    if(e.target.closest('#openMaps')){window.open(`https://www.google.com/maps/search/?api=1&query=${state.selectedPlace.lat},${state.selectedPlace.lng}`,'_blank');return;}
  });
  qs('#routeForm').addEventListener('submit',e=>{e.preventDefault();if(state.route.length<2)state.route=D.places.slice(0,5);go('route');});
  qs('#resetFilters').addEventListener('click',()=>{state.filters=new Set(['Con playa','Frente al mar']);renderCreate();});
  qs('#sleepSearch').addEventListener('input',renderSleep);
  qs('#shareRoute').addEventListener('click',async()=>{const text=`Ruta Cádiz: ${state.route.map(p=>p.short).join(' → ')} · ${routeKm()} km`;try{if(navigator.share)await navigator.share({title:'Tu Ruta Cádiz',text});else await navigator.clipboard.writeText(text);}catch(_){} });
  renderNav();renderHome();renderCreate();renderExplore();renderProfile();renderSleep();
})();
