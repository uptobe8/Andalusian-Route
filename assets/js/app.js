(()=>{
  "use strict";
  const D=window.CADIZ_DATA;
  const state={
    screen:"home",
    route:D.places.slice(0,5),
    routeGeo:null,
    routeKm:210,
    routeMinutes:250,
    selectedPlace:D.places[1],
    selectedSleep:D.sleep[0],
    filters:new Set(["Con playa","Frente al mar"]),
    preference:"drive-low",
    days:6,
    map:null,
    mapLine:null,
    mapMarkers:[],
    sleepMap:null
  };
  const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
  function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove("show"),1500)}
  function nav(screen){state.screen=screen;location.hash="#/"+screen;renderScreen();}
  function renderScreen(){
    $$(".screen").forEach(s=>s.classList.toggle("active",s.dataset.screen===state.screen));
    $$('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===state.screen));
    window.scrollTo(0,0);
    if(state.screen==='route')setTimeout(renderRoute,30);
    if(state.screen==='timeline')renderTimeline();
    if(state.screen==='destination')renderDestination();
    if(state.screen==='sleep')renderSleep();
    if(state.screen==='sleep-detail')setTimeout(renderSleepDetail,30);
    if(state.screen==='favorites')renderFavorites();
  }
  function bootHash(){const s=(location.hash.match(/^#\/(.+)$/)||[])[1];if(s&&$("[data-screen='"+s+"']"))state.screen=s;renderScreen();}
  function renderHome(){
    $('#featuredGrid').innerHTML=D.featured.map(r=>`<button class="route-card" data-featured="${r.id}"><img src="${r.photo}" alt="${r.name}"><span class="heart-badge">♡</span><span class="route-card-copy"><b>${r.name}</b><span>${r.days} días · ${r.nights} noches</span><span>+${r.km} km</span></span></button>`).join('');
    const shortcuts=[['i-sun','Playas'],['i-town','Pueblos'],['i-pin','Miradores'],['i-wave','Surf'],['i-route','Rutas Off'],['i-sun','Atardeceres'],['i-food','Gastronomía'],['i-eye','Naturaleza']];
    $('#shortcutGrid').innerHTML=shortcuts.map(([i,l])=>`<button data-nav="explore"><svg><use href="#${i}"/></svg>${l}</button>`).join('');
  }
  function renderCreate(){
    $('#destinationChips').innerHTML=state.route.map(p=>`<button class="dest-chip" data-remove-place="${p.id}">${p.name} ×</button>`).join('');
    const labels=['Con playa','Frente al mar','Pueblo costero','Surf','Naturaleza','Miradores','Gastronomía','Pueblos blancos','Tranquilidad','Ambiente nocturno','Acceso fácil camper'];
    $('#filterChips').innerHTML=labels.map(l=>`<button data-filter="${l}" class="${state.filters.has(l)?'active':''}">${l}</button>`).join('');
  }
  function getSuggestions(q){q=q.trim().toLowerCase();return D.places.filter(p=>!state.route.some(x=>x.id===p.id)&&(!q||p.name.toLowerCase().includes(q)||p.short.toLowerCase().includes(q))).slice(0,5)}
  function showSuggestions(){const q=$('#destinationSearch').value;const list=getSuggestions(q);const box=$('#destinationSuggestions');box.innerHTML=list.map(p=>`<button data-suggest="${p.id}">${p.name}</button>`).join('');box.classList.toggle('show',list.length>0&&document.activeElement===$('#destinationSearch'));}
  function hav(a,b){const R=6371,toR=d=>d*Math.PI/180;const dLat=toR(b.lat-a.lat),dLon=toR(b.lng-a.lng);const x=Math.sin(dLat/2)**2+Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
  function fallbackRoute(){let km=0;for(let i=1;i<state.route.length;i++)km+=hav(state.route[i-1],state.route[i]);state.routeKm=Math.round(km*1.22);state.routeMinutes=Math.round(state.routeKm/48*60);state.routeGeo={type:'LineString',coordinates:state.route.map(p=>[p.lng,p.lat])};}
  async function calculateRoute(){
    if(state.route.length<2){toast('Añade al menos dos destinos');return;}
    state.days=Number($('#daysSelect').value||6);
    $('#calculateRoute').disabled=true;$('#calculateRoute').textContent='CALCULANDO...';
    try{
      const coords=state.route.map(p=>`${p.lng},${p.lat}`).join(';');
      const url=`${window.APP_CONFIG.osrmUrl}/${coords}?overview=full&geometries=geojson&steps=false`;
      const r=await fetch(url);if(!r.ok)throw new Error('routing');const j=await r.json();if(!j.routes?.length)throw new Error('no route');
      state.routeKm=Math.round(j.routes[0].distance/1000);state.routeMinutes=Math.round(j.routes[0].duration/60);state.routeGeo=j.routes[0].geometry;
    }catch(e){fallbackRoute();toast('Ruta calculada con modo de respaldo');}
    await window.ConvexStore.saveRoute({name:'Ruta Cádiz',days:state.days,placeIds:state.route.map(p=>p.id),distanceKm:state.routeKm,durationMinutes:state.routeMinutes,createdAt:Date.now()});
    $('#calculateRoute').disabled=false;$('#calculateRoute').innerHTML='CALCULAR RUTA <b>→</b>';nav('route');
  }
  function renderRoute(){
    if(!state.routeGeo)fallbackRoute();
    const nights=Math.max(1,state.days-1),mins=state.routeMinutes;
    $('#summaryDays').textContent=`${state.days} días / ${nights} noches`;$('#summaryStops').textContent=`${state.route.length} paradas`;$('#summaryKm').textContent=`${state.routeKm} km totales`;$('#summaryDrive').textContent=`${Math.floor(mins/60)}h ${mins%60}m conducción`;$('#mobileKm').textContent=`+ ${state.routeKm} km`;$('#mobileStops').textContent=state.route.length;$('#routeBadge').textContent=`${state.days} DÍAS · ${nights} NOCHES`;$('#elevationEnd').textContent=`${state.routeKm} km`;
    drawFallback();
    if(typeof L!=='undefined'){
      $('#mapFallback').style.display='none';$('#routeMap').style.display='block';
      if(!state.map){state.map=L.map('routeMap',{zoomControl:false,attributionControl:true});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.map)}
      state.mapMarkers.forEach(m=>m.remove());state.mapMarkers=[];if(state.mapLine)state.mapLine.remove();
      const latlngs=state.routeGeo.coordinates.map(c=>[c[1],c[0]]);state.mapLine=L.polyline(latlngs,{color:'#dfff00',weight:8,opacity:1,lineCap:'round'}).addTo(state.map);
      state.route.forEach((p,i)=>{const icon=L.divIcon({className:'',html:`<div style="width:30px;height:30px;border-radius:50%;background:#ff1678;color:white;border:3px solid white;display:grid;place-items:center;font:900 11px Inter;box-shadow:0 3px 10px #0003">${i+1}</div><div style="position:absolute;left:25px;top:-2px;background:white;border-radius:7px;padding:5px 7px;font:800 9px Inter;white-space:nowrap">${p.short.toUpperCase()}</div>`,iconSize:[30,30],iconAnchor:[15,15]});state.mapMarkers.push(L.marker([p.lat,p.lng],{icon}).addTo(state.map))});state.map.fitBounds(state.mapLine.getBounds().pad(.12));setTimeout(()=>state.map.invalidateSize(),50);
    }else{$('#routeMap').style.display='none';$('#mapFallback').style.display='block';}
  }
  function drawFallback(){const svg=$('#routeFallbackSvg'),pts=state.route;const w=700,h=900,p=85,lats=pts.map(x=>x.lat),lngs=pts.map(x=>x.lng),miLa=Math.min(...lats),maLa=Math.max(...lats),miLn=Math.min(...lngs),maLn=Math.max(...lngs);const xy=pts.map((x,i)=>({x:p+(x.lng-miLn)/(maLn-miLn||1)*(w-p*2),y:h-p-(x.lat-miLa)/(maLa-miLa||1)*(h-p*2),p:x,i}));const path=xy.map((v,i)=>(i?'L':'M')+v.x+','+v.y).join(' ');svg.innerHTML=`<rect class="sea" width="700" height="900"/><path class="land" d="M410 0C470 160 445 250 500 390S460 690 540 900H700V0Z"/><path class="route-line" d="${path}"/>${xy.map(v=>`<g><circle class="marker" cx="${v.x}" cy="${v.y}" r="22"/><text x="${v.x}" y="${v.y+5}" text-anchor="middle" fill="#fff">${v.i+1}</text><rect x="${v.x+27}" y="${v.y-17}" rx="8" width="${Math.max(82,v.p.short.length*10+22)}" height="30" fill="#fff"/><text x="${v.x+37}" y="${v.y+3}" font-size="12">${v.p.short.toUpperCase()}</text></g>`).join('')}`;}
  function renderTimeline(){
    $('#timelineList').innerHTML=state.route.map((p,i)=>`<article class="timeline-card"><span class="timeline-number">${i+1}</span><img src="${p.photo}" alt="${p.name}"><div class="timeline-body"><span class="day-chip">DÍA ${i+1}</span><h3>${p.name}</h3><div class="timeline-meta">◷ ${i?Math.round(hav(state.route[i-1],p)*1.22):0} km &nbsp; · &nbsp; ${p.tags.slice(0,3).join(' · ')}</div><div class="timeline-actions"><button data-open-place="${p.id}">VER DESTINO →</button><button class="square" data-up="${p.id}" title="Subir">↑</button><button class="square" data-down="${p.id}" title="Bajar">↓</button><button class="square" data-delete="${p.id}" title="Eliminar"><svg><use href="#i-trash"/></svg></button></div></div></article>`).join('');
  }
  function renderDestination(){const p=state.selectedPlace;$('#destinationTitle').textContent=p.name.toUpperCase();$('#destinationHero').src=p.photo;$('#destinationDescription').textContent=p.desc;$('#destinationCaption').innerHTML=`<b>${p.name}</b><br>${p.desc}`;$('#destinationDistance').textContent=`${p.kmFromPrev} km · ${p.minFromPrev} min`;const icons={'Con playa':'i-sun','Surf':'i-wave','Gastronomía':'i-food','Pueblo costero':'i-town','Naturaleza':'i-eye','Pueblos blancos':'i-town'};$('#destinationFeatures').innerHTML=p.tags.slice(0,5).map(t=>`<div class="feature-icon"><svg><use href="#${icons[t]||'i-pin'}"/></svg>${t.replace('Con ','')}</div>`).join('');const pois=[['Playa de Los Bateles','https://www.celebritycruises.com/blog/content/uploads/2025/10/cadiz-beaches-playa-los-bateles-conil-de-la-frontera-1024x682.jpg','1,2 km'],['Duna de Bolonia',D.places[3].photo,'60 km'],['El Palmar',D.places[2].photo,'30 km'],['La Fontanilla','https://www.celebritycruises.com/blog/content/uploads/2025/10/cadiz-beaches-playa-de-la-fontanilla-conil-de-la-frontera.jpg','2 km']];$('#poiGrid').innerHTML=pois.map(([n,img,d])=>`<button class="poi-card" data-nav="explore"><img src="${img}" alt="${n}"><b>${n} →</b><span>${d}</span></button>`).join('');}
  function renderSleep(){const q=($('#sleepSearch').value||'').toLowerCase();const rows=D.sleep.filter(s=>!q||s.name.toLowerCase().includes(q)||s.town.toLowerCase().includes(q));$('#sleepResults').innerHTML=rows.map(s=>`<button class="sleep-card" data-open-sleep="${s.id}"><img src="${s.photo}" alt="${s.name}"><div><h3>${s.name}</h3><p>${s.town} · ${s.distance}</p><div class="sleep-tags">${s.tags.map(t=>`<span>${t}</span>`).join('')}</div></div><div class="rating">${s.rating} <span>★</span></div></button>`).join('');}
  function renderSleepDetail(){const s=state.selectedSleep;$('#sleepDetailTitle').textContent=s.name.toUpperCase();$('#sleepDetailHero').src=s.photo;$('#park4nightLink').href=s.park4night;$('#sleepGallery').innerHTML=[s.photo,D.hero,D.places[3].photo,D.places[2].photo].map(u=>`<img src="${u}" alt="Vista">`).join('');const facts=[['Distancia a la playa','100 m'],['Distancia a población','4,8 km'],['Tipo de suelo','Tierra / arena'],['Acceso','Camper / AC / furgoneta'],['Servicios cercanos','Restaurantes y comercio'],['Nivel de tranquilidad','Muy tranquilo'],['Señal 4G/5G','Buena']];$('#sleepFacts').innerHTML=facts.map(([l,v],i)=>`<div class="sleep-fact"><span>${i+1}</span><span>${l}</span><b>${v}</b></div>`).join('');if(typeof L!=='undefined'){if(state.sleepMap){state.sleepMap.remove();state.sleepMap=null;}state.sleepMap=L.map('sleepDetailMap',{zoomControl:false,attributionControl:false}).setView([s.lat,s.lng],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(state.sleepMap);L.marker([s.lat,s.lng]).addTo(state.sleepMap);setTimeout(()=>state.sleepMap.invalidateSize(),50)}else{$('#sleepDetailMap').innerHTML='<div style="height:100%;display:grid;place-items:center;font-size:10px">Mapa no disponible</div>'}}
  function renderExplore(){const cats=[['Playas espectaculares',D.places[3].photo,'bolonia'],['Mejores atardeceres',D.places[2].photo,'el-palmar'],['Pueblos blancos',D.places[1].photo,'conil'],['Lugares para surf',D.places[4].photo,'tarifa'],['Miradores',D.places[5].photo,'vejer'],['Rincones tranquilos',D.sleep[0].photo,'bolonia'],['Gastronomía',D.places[0].photo,'zahara'],['Naturaleza',D.places[6].photo,'canos']];$('#exploreGrid').innerHTML=cats.map(([n,img,id])=>`<button class="inspiration-card" data-explore-place="${id}"><img src="${img}" alt="${n}"><b>${n}</b></button>`).join('');}
  async function renderFavorites(){const rows=await window.ConvexStore.listFavorites();$('#favoritesGrid').innerHTML=rows.length?rows.map(x=>`<button class="inspiration-card" data-fav="${x.type}:${x.id}"><img src="${x.photo||D.hero}" alt="${x.name}"><b>${x.name}</b></button>`).join(''):'<div style="grid-column:1/-1;padding:45px;text-align:center;color:#777;font-size:11px">Aún no has guardado favoritos.</div>';}
  function renderProfile(){const items=[['Tipo de camper','Mediana'],['Máximo km diarios','250 km'],['Playa','Sí'],['Surf','Sí'],['Lugares tranquilos','Alta prioridad'],['Tipo de viaje','Costa + naturaleza']];$('#profileSettings').innerHTML=items.map(([a,b])=>`<div class="setting-row"><span>${a}</span><b>${b}</b></div>`).join('');}
  async function toggleFavorite(item){const r=await window.ConvexStore.toggleFavorite(item);toast(r.active?'Guardado en favoritos':'Eliminado de favoritos');}
  document.addEventListener('click',async e=>{
    const n=e.target.closest('[data-nav]');if(n){e.preventDefault();nav(n.dataset.nav);return;}
    const feat=e.target.closest('[data-featured]');if(feat){state.route=D.places.slice(0,5);fallbackRoute();nav('route');return;}
    const rem=e.target.closest('[data-remove-place]');if(rem){state.route=state.route.filter(p=>p.id!==rem.dataset.removePlace);renderCreate();return;}
    const sug=e.target.closest('[data-suggest]');if(sug){const p=D.places.find(x=>x.id===sug.dataset.suggest);if(p&&!state.route.some(x=>x.id===p.id))state.route.push(p);$('#destinationSearch').value='';renderCreate();$('#destinationSuggestions').classList.remove('show');return;}
    const f=e.target.closest('[data-filter]');if(f){state.filters.has(f.dataset.filter)?state.filters.delete(f.dataset.filter):state.filters.add(f.dataset.filter);renderCreate();return;}
    const pr=e.target.closest('[data-pref]');if(pr){state.preference=pr.dataset.pref;$$('[data-pref]').forEach(b=>b.classList.toggle('selected',b===pr));return;}
    const op=e.target.closest('[data-open-place]');if(op){state.selectedPlace=D.places.find(p=>p.id===op.dataset.openPlace)||state.selectedPlace;nav('destination');return;}
    const ex=e.target.closest('[data-explore-place]');if(ex){state.selectedPlace=D.places.find(p=>p.id===ex.dataset.explorePlace)||state.selectedPlace;nav('destination');return;}
    const sl=e.target.closest('[data-open-sleep]');if(sl){state.selectedSleep=D.sleep.find(s=>s.id===sl.dataset.openSleep)||state.selectedSleep;nav('sleep-detail');return;}
    const del=e.target.closest('[data-delete]');if(del&&state.route.length>2){state.route=state.route.filter(p=>p.id!==del.dataset.delete);fallbackRoute();renderTimeline();return;}
    const up=e.target.closest('[data-up]');if(up){const i=state.route.findIndex(p=>p.id===up.dataset.up);if(i>0)[state.route[i-1],state.route[i]]=[state.route[i],state.route[i-1]];fallbackRoute();renderTimeline();return;}
    const down=e.target.closest('[data-down]');if(down){const i=state.route.findIndex(p=>p.id===down.dataset.down);if(i>=0&&i<state.route.length-1)[state.route[i+1],state.route[i]]=[state.route[i],state.route[i+1]];fallbackRoute();renderTimeline();return;}
    if(e.target.closest('#addDestination')){showSuggestions();$('#destinationSearch').focus();return;}
    if(e.target.closest('#calculateRoute')){await calculateRoute();return;}
    if(e.target.closest('#resetFilters')){state.filters=new Set(['Con playa','Frente al mar']);renderCreate();return;}
    if(e.target.closest('#addStop')){const p=D.places.find(p=>!state.route.some(x=>x.id===p.id));if(p){state.route.push(p);fallbackRoute();renderTimeline();toast(p.name+' añadido')}return;}
    if(e.target.closest('#saveRoute')){await window.ConvexStore.toggleFavorite({type:'route',id:'current',name:'Ruta Cádiz',photo:D.hero,data:{places:state.route.map(p=>p.id),km:state.routeKm}});toast('Ruta guardada');return;}
    if(e.target.closest('#destinationFav')){const p=state.selectedPlace;await toggleFavorite({type:'place',id:p.id,name:p.name,photo:p.photo});return;}
    if(e.target.closest('#sleepFav')){const s=state.selectedSleep;await toggleFavorite({type:'sleep',id:s.id,name:s.name,photo:s.photo});return;}
    if(e.target.closest('#addDestinationRoute')){if(!state.route.some(p=>p.id===state.selectedPlace.id)){state.route.push(state.selectedPlace);fallbackRoute()}toast('Destino añadido a la ruta');return;}
    if(e.target.closest('#addSleepToRoute')){toast('Pernocta añadida como referencia');return;}
    if(e.target.closest('#openMaps')){const p=state.selectedPlace;window.open(`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`,'_blank');return;}
    if(e.target.closest('#sleepMaps')){const s=state.selectedSleep;window.open(`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`,'_blank');return;}
    if(e.target.closest('#shareRoute')){const text=`Ruta Cádiz: ${state.route.map(p=>p.short).join(' → ')} · ${state.routeKm} km`;try{if(navigator.share)await navigator.share({title:'Tu Ruta Cádiz',text});else{await navigator.clipboard.writeText(text);toast('Ruta copiada')}}catch(_){}return;}
    if(e.target.closest('#zoomIn')&&state.map){state.map.zoomIn();return;}if(e.target.closest('#zoomOut')&&state.map){state.map.zoomOut();return;}if(e.target.closest('#centerMap')&&state.mapLine){state.map.fitBounds(state.mapLine.getBounds().pad(.12));return;}
  });
  $('#destinationSearch').addEventListener('input',showSuggestions);$('#destinationSearch').addEventListener('focus',showSuggestions);document.addEventListener('click',e=>{if(!e.target.closest('.destination-block'))$('#destinationSuggestions').classList.remove('show')});$('#sleepSearch').addEventListener('input',renderSleep);window.addEventListener('hashchange',bootHash);
  renderHome();renderCreate();renderExplore();renderProfile();renderSleep();fallbackRoute();bootHash();
})();