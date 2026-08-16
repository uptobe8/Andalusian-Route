(()=>{
'use strict';
const D=window.ANDALUSIA;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={
  screen:'home', routeNames:[], route:null, selected:null, sleep:null,
  filters:new Set(['Playa','Naturaleza','Frente al mar']),
  favorites:new Set(JSON.parse(localStorage.getItem('andalusianRoudeFavs')||'[]')),
  map:null,line:null,marks:[],gen:[],sleepItems:[],saved:[],timer:null,
  exploreCategory:'playas', exploreContext:null, exploreItems:[], exploreSearchItems:[]
};
const nav=[['home','⌂','Inicio'],['savedRoutes','⌁','Rutas'],['create','+',''],['favorites','♡','Favoritos'],['profile','♙','Perfil']];
const exploreCategories=[
  ['playas','☀','Playas'],['monumentos','▥','Monumentos'],['miradores','⌖','Miradores'],['surf','⌁','Surf'],
  ['atardecer','◒','Atardecer'],['actividades','◇','Actividades'],['gastro','🍴','Gastro'],['naturaleza','♨','Naturaleza'],['pueblos','⌂','Pueblos'],['dormir','▣','Dormir']
];
function hav(a,b,c,d){const R=6371,r=x=>x*Math.PI/180,A=r(c-a),B=r(d-b),q=Math.sin(A/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(B/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
function go(screen){state.screen=screen;$$('.screen').forEach(x=>x.classList.toggle('active',x.dataset.screen===screen));renderNav();scrollTo(0,0);if(screen==='route')setTimeout(initMap,70);if(screen==='timeline')renderTimeline();if(screen==='savedRoutes')renderSaved();if(screen==='favorites')renderFavorites();if(screen==='explore')renderExplore();}
function renderNav(){
  $('#bottomNav').innerHTML=nav.map(([id,ic,label])=>id==='create'?'<button class="plus" data-go="create">+</button>':`<button data-go="${id}" class="${state.screen===id?'active':''}"><b style="font-size:21px">${ic}</b>${label}</button>`).join('');
  $('#sideNav').innerHTML=[['home','Inicio'],['create','Crear ruta'],['savedRoutes','Mis rutas'],['route','Ruta actual'],['timeline','Día a día'],['explore','Explorar'],['sleep','Park4Night'],['favorites','Favoritos'],['profile','Perfil']].map(([id,label])=>`<button data-go="${id}" class="${state.screen===id?'active':''}">${label}</button>`).join('');
}
function renderHome(){
  $('#featured').innerHTML=D.suggested.slice(0,6).map(p=>`<button class="featured-card" data-place="${esc(p.name)}"><img src="${p.photo}" alt="${esc(p.name)}"><span class="copy"><b>${esc(p.name)}</b><span>${p.tags.join(' · ')}</span></span></button>`).join('');
  $('#exploreShortcuts').innerHTML=exploreCategories.map(([key,ic,label])=>`<button data-explore-cat="${key}"><b>${ic}</b>${label}</button>`).join('');
}
function renderCreate(){
  $('#routeFields').innerHTML=state.routeNames.length?state.routeNames.map((n,i)=>`<div class="field added-stop"><span>${i?'↝':'⌖'}</span><div><small>${i?'PARADA '+i:'ORIGEN'}</small><b>${esc(n)}</b></div><button class="add remove-stop" data-index="${i}">×</button></div>`).join(''):'<div class="empty compact">Todavía no has añadido ningún destino. Busca una ciudad, pueblo o lugar y añádelo.</div>';
  const fs=['Playa','Frente al mar','Surf','Naturaleza','Miradores','Gastronomía','Pueblos blancos','Tranquilidad','Vida nocturna','Acceso camper'];
  $('#filters').innerHTML=fs.map(f=>`<button class="chip ${state.filters.has(f)?'active':''}" data-filter="${f}">${f}</button>`).join('');
  $('#calculate').disabled=state.routeNames.length<2;$('#calculate').classList.toggle('disabled',state.routeNames.length<2);
}
async function fetchJson(url,opts={}){const r=await fetch(url,opts),t=await r.text();let d;try{d=JSON.parse(t)}catch{throw Error('Respuesta no JSON')}if(!r.ok)throw Error(d?.error||'HTTP '+r.status);return d;}
async function geocode(q,limit=1){const u=new URL('https://nominatim.openstreetmap.org/search');u.searchParams.set('q',q);u.searchParams.set('format','jsonv2');u.searchParams.set('limit',String(limit));u.searchParams.set('countrycodes','es');u.searchParams.set('addressdetails','1');return fetchJson(u);}
async function routeSearch(q){if(q.trim().length<2){$('#routeSuggestions').innerHTML='';return}try{const a=await geocode(q+', España',7);$('#routeSuggestions')._items=a;$('#routeSuggestions').innerHTML=a.map((x,i)=>`<button class="suggestion" data-suggest="${i}"><b>${esc(x.name||x.display_name.split(',')[0])}</b><span>${esc(x.display_name)}</span></button>`).join('')}catch(e){$('#routeSuggestions').innerHTML=`<div class="empty compact">${esc(e.message)}</div>`}}
async function calculateRoad(names){const pts=[];for(const n of names){const k=D.destinations.find(x=>norm(x.name)===norm(n));if(k)pts.push({name:k.name,lat:k.lat,lng:k.lng});else{const a=await geocode(n+', Andalucía, España');if(!a[0])throw Error('No se encontró '+n);pts.push({name:n,lat:+a[0].lat,lng:+a[0].lon})}}const c=pts.map(p=>`${p.lng},${p.lat}`).join(';'),d=await fetchJson(`https://router.project-osrm.org/route/v1/driving/${c}?overview=full&geometries=geojson`);if(!d.routes?.[0])throw Error('No se pudo calcular la carretera');const r=d.routes[0];return{stops:pts,distanceKm:Math.round(r.distance/1000),durationMin:Math.round(r.duration/60),geometry:r.geometry};}
function initMap(){if(typeof L==='undefined')return;if(!state.map){state.map=L.map('map',{zoomControl:false}).setView([37.2,-4.4],7);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(state.map)}setTimeout(()=>state.map.invalidateSize(),100);drawRoute();}
function drawRoute(){if(!state.map||!state.route)return;if(state.line)state.map.removeLayer(state.line);state.marks.forEach(m=>state.map.removeLayer(m));state.marks=[];const c=state.route.geometry.coordinates.map(([x,y])=>[y,x]);state.line=L.polyline(c,{color:'#dfff00',weight:8}).addTo(state.map);state.route.stops.forEach((p,i)=>{const ic=L.divIcon({className:'route-marker-wrap',html:`<div class="route-marker">${i+1}</div>`,iconSize:[30,30],iconAnchor:[15,15]});state.marks.push(L.marker([p.lat,p.lng],{icon:ic}).addTo(state.map).bindTooltip(`${i+1}. ${esc(state.routeNames[i])}`,{permanent:true,direction:'right'}))});state.map.fitBounds(state.line.getBounds().pad(.08));}
async function calculate(){if(state.routeNames.length<2)return;$('#calculate').textContent='CALCULANDO…';try{state.route=await calculateRoad(state.routeNames);setSummary('Ruta calculada con carreteras reales.');go('route')}catch(e){$('#routeStatus').textContent=e.message;go('route')}finally{$('#calculate').textContent='CALCULAR MI RUTA →'}}
function setSummary(msg){$('#sumKm').textContent=state.route.distanceKm+' km';$('#sumTime').textContent=Math.floor(state.route.durationMin/60)+'h '+state.route.durationMin%60+'m';$('#sumStops').textContent=state.routeNames.length;$('#routeStatus').textContent=msg;}
function renderTimeline(){
  $('#timeline').innerHTML=!state.route?'<div class="empty">Abre o calcula una ruta.</div>':state.route.stops.map((p,i)=>{const k=D.destinations.find(x=>norm(x.name)===norm(state.routeNames[i]))||D.suggested[0];return`<article class="day-card"><span class="day-num">${i+1}</span><img src="${k.photo}" alt="${esc(state.routeNames[i])}"><div class="day-body"><span class="day-chip">DÍA ${i+1}</span><h3>${esc(state.routeNames[i])}</h3><div class="day-meta">Parada ${i+1} de ${state.routeNames.length}</div><div class="day-actions"><button data-open="${i}">VER DESTINO</button><button data-up="${i}">↑</button><button data-down="${i}">↓</button><button data-del="${i}">×</button></div></div></article>`}).join('');
}
function ensureExploreUi(){
  const host=$('#provinceChips');if(!host)return;
  host.className='explore-live-controls';
  host.innerHTML=`<div class="explore-city-search"><input id="exploreCitySearch" class="route-search" autocomplete="off" placeholder="Busca una ciudad: Granada, Málaga, Tarifa…"><span>⌕</span></div><div id="exploreCitySuggestions" class="suggestions"></div><div class="explore-category-grid">${exploreCategories.map(([key,ic,label])=>`<button class="explore-cat-tile ${state.exploreCategory===key?'active':''}" data-explore-cat="${key}"><b>${ic}</b><span>${label}</span></button>`).join('')}</div><div id="exploreContextLabel" class="explore-context-label"></div>`;
  const first=host.previousElementSibling;if(first?.classList.contains('form-label'))first.textContent='Ciudad y categoría';const second=host.nextElementSibling;if(second?.classList.contains('form-label'))second.textContent='Resultados reales';
}
function renderExplore(){
  ensureExploreUi();
  const input=$('#exploreCitySearch');if(input&&state.exploreContext)input.value=state.exploreContext.name;
  updateExploreContextLabel();
  if(state.exploreContext)loadExploreCategory(state.exploreCategory);else $('#exploreList').innerHTML='<div class="empty">Elige primero la ciudad. Los cuadrados de Explora consultarán resultados reales alrededor de esa ciudad y cada categoría tendrá su propia búsqueda.</div>';
}
function updateExploreContextLabel(){const el=$('#exploreContextLabel');if(!el)return;const label=exploreCategories.find(x=>x[0]===state.exploreCategory)?.[2]||'Explora';el.textContent=state.exploreContext?`${label} en ${state.exploreContext.name}`:`${label} · elige una ciudad`;}
async function exploreCitySearch(q){const box=$('#exploreCitySuggestions');if(!box)return;if(q.trim().length<2){box.innerHTML='';return}try{const a=await geocode(q+', Andalucía, España',7);state.exploreSearchItems=a;box.innerHTML=a.map((x,i)=>`<button class="suggestion" data-explore-city="${i}"><b>${esc(x.name||x.display_name.split(',')[0])}</b><span>${esc(x.display_name)}</span></button>`).join('')}catch(e){box.innerHTML=`<div class="empty compact">${esc(e.message)}</div>`}}
function overpassQuery(category,lat,lng){
  const R={playas:20000,monumentos:10000,miradores:18000,surf:25000,atardecer:22000,actividades:12000,gastro:6000,naturaleza:25000,pueblos:45000}[category]||12000;
  const a=`around:${R},${lat},${lng}`;
  const parts={
    playas:[`nwr(${a})[\"natural\"=\"beach\"]`,`nwr(${a})[\"leisure\"=\"beach_resort\"]`],
    monumentos:[`nwr(${a})[\"historic\"]`,`nwr(${a})[\"tourism\"=\"attraction\"]`,`nwr(${a})[\"tourism\"=\"museum\"]`],
    miradores:[`nwr(${a})[\"tourism\"=\"viewpoint\"]`],
    surf:[`nwr(${a})[\"sport\"=\"surfing\"]`,`nwr(${a})[\"name\"~\"surf\",i]`,`nwr(${a})[\"shop\"=\"sports\"][\"sport\"=\"surfing\"]`],
    atardecer:[`nwr(${a})[\"tourism\"=\"viewpoint\"]`,`nwr(${a})[\"natural\"=\"beach\"]`,`nwr(${a})[\"man_made\"=\"lighthouse\"]`],
    actividades:[`nwr(${a})[\"tourism\"=\"attraction\"]`,`nwr(${a})[\"leisure\"=\"park\"]`,`nwr(${a})[\"leisure\"=\"nature_reserve\"]`,`nwr(${a})[\"sport\"]`],
    gastro:[`nwr(${a})[\"amenity\"=\"restaurant\"]`,`nwr(${a})[\"amenity\"=\"cafe\"]`,`nwr(${a})[\"amenity\"=\"bar\"]`],
    naturaleza:[`nwr(${a})[\"leisure\"=\"nature_reserve\"]`,`nwr(${a})[\"boundary\"=\"protected_area\"]`,`nwr(${a})[\"natural\"]`],
    pueblos:[`nwr(${a})[\"place\"=\"village\"]`,`nwr(${a})[\"place\"=\"town\"]`]
  };
  return `[out:json][timeout:22];(${(parts[category]||parts.actividades).join(';')};);out center tags 80;`;
}
function classifyExplore(tags,category){
  if(category==='playas')return'Playa';if(category==='monumentos')return tags.historic?'Histórico':'Monumento / cultura';if(category==='miradores')return'Mirador';if(category==='surf')return'Surf';if(category==='atardecer')return tags.man_made==='lighthouse'?'Faro':tags.tourism==='viewpoint'?'Mirador':'Costa';if(category==='gastro')return tags.cuisine||tags.amenity||'Gastronomía';if(category==='naturaleza')return tags.natural||tags.leisure||'Naturaleza';if(category==='pueblos')return tags.place==='town'?'Pueblo / ciudad':'Pueblo';return tags.tourism||tags.leisure||tags.sport||'Actividad';
}
async function loadExploreCategory(category){
  state.exploreCategory=category;ensureExploreUi();const input=$('#exploreCitySearch');if(input&&state.exploreContext)input.value=state.exploreContext.name;updateExploreContextLabel();const box=$('#exploreList');if(!state.exploreContext){box.innerHTML='<div class="empty">Elige primero una ciudad.</div>';return}
  if(category==='dormir'){state.selected={...(D.destinations.find(x=>norm(x.name)===norm(state.exploreContext.name))||state.exploreContext)};go('sleep');return}
  box.innerHTML=`<div class="loading">Buscando ${esc(exploreCategories.find(x=>x[0]===category)?.[2]||category)} reales en ${esc(state.exploreContext.name)}…</div>`;
  try{
    const {lat,lng}=state.exploreContext,q=overpassQuery(category,lat,lng),d=await fetchJson('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q));
    const seen=new Set(),items=(d.elements||[]).map(x=>{const la=x.lat??x.center?.lat,lo=x.lon??x.center?.lon,t=x.tags||{},name=t['name:es']||t.name||t['alt_name']||'';return{lat:la,lng:lo,tags:t,name,kind:classifyExplore(t,category),distance:Number.isFinite(la)&&Number.isFinite(lo)?hav(lat,lng,la,lo):999};}).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)&&x.name&&x.distance<100).sort((a,b)=>a.distance-b.distance).filter(x=>{const k=norm(x.name)+'|'+x.lat.toFixed(4)+'|'+x.lng.toFixed(4);if(seen.has(k))return false;seen.add(k);return true}).slice(0,60);
    state.exploreItems=items;
    box.innerHTML=items.length?items.map((x,i)=>`<button class="explore-result-card" data-explore-result="${i}"><span class="poi-icon">⌖</span><span><b>${esc(x.name)}</b><small>${esc(x.kind)} · ${x.distance.toFixed(1)} km de ${esc(state.exploreContext.name)}</small></span><span>→</span></button>`).join(''):`<div class="empty">No se han encontrado resultados reales de esta categoría alrededor de ${esc(state.exploreContext.name)}. Prueba otra categoría o ciudad.</div>`;
  }catch(e){box.innerHTML=`<div class="empty">No se han inventado resultados. La consulta real falló: ${esc(e.message)}</div>`}
}
async function openPlace(name){
  state.selected={...(D.destinations.find(x=>norm(x.name)===norm(name))||{name,photo:D.suggested[0].photo,tags:[]})};
  $('#destinationTitle').textContent=state.selected.name;$('#destinationPhoto').src=state.selected.photo;$('#weatherValue').textContent='Cargando…';$('#poiValue').textContent='Cargando…';$('#poiList').innerHTML='<div class="loading">Buscando lugares de interés reales…</div>';
  state.exploreContext=state.selected.lat?{name:state.selected.name,lat:state.selected.lat,lng:state.selected.lng}:null;
  injectDestinationExploreTiles();go('destination');await loadDestination();
}
function injectDestinationExploreTiles(){
  const list=$('#poiList');if(!list)return;let grid=$('#destinationExploreGrid');if(!grid){grid=document.createElement('div');grid.id='destinationExploreGrid';grid.className='destination-explore-grid';list.parentNode.insertBefore(grid,list.previousElementSibling)}
  grid.innerHTML=exploreCategories.filter(x=>x[0]!=='dormir').map(([key,ic,label])=>`<button data-destination-explore="${key}"><b>${ic}</b><span>${label}</span></button>`).join('');
}
async function loadDestination(){
  try{
    if(!state.selected.lat){const a=await geocode(state.selected.name+', Andalucía, España');if(!a[0])throw Error('Destino no encontrado');state.selected.lat=+a[0].lat;state.selected.lng=+a[0].lon}
    state.exploreContext={name:state.selected.name,lat:state.selected.lat,lng:state.selected.lng};
    const {lat,lng}=state.selected,w=await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m&timezone=auto`);
    $('#weatherValue').textContent=`${w.current?.temperature_2m??'—'}°C · viento ${w.current?.wind_speed_10m??'—'} km/h`;
    const q=`[out:json][timeout:18];(nwr(around:7000,${lat},${lng})[tourism];nwr(around:7000,${lat},${lng})[historic];nwr(around:7000,${lat},${lng})[natural];);out center tags 40;`,d=await fetchJson('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q)),items=(d.elements||[]).map(x=>({lat:x.lat??x.center?.lat,lng:x.lon??x.center?.lon,name:x.tags?.name||x.tags?.['name:es']||x.tags?.tourism||x.tags?.historic||x.tags?.natural||'Punto de interés',tags:x.tags||{}})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng));
    $('#poiValue').textContent=items.length+' encontrados';$('#destinationLead').textContent='Datos cargados automáticamente.';$('#poiList').innerHTML=items.slice(0,30).map(x=>`<button class="poi-card" data-poi="${x.lat},${x.lng}"><span class="poi-icon">⌖</span><span><b>${esc(x.name)}</b><small>${x.tags.historic?'Historia':x.tags.natural?'Naturaleza':x.tags.tourism==='viewpoint'?'Mirador':'Turismo'} · ${hav(lat,lng,x.lat,x.lng).toFixed(1)} km</small></span><span>→</span></button>`).join('')||'<div class="empty compact">Sin resultados.</div>';
  }catch(e){$('#destinationLead').textContent='No se han inventado datos: '+e.message;$('#weatherValue').textContent='Sin dato';$('#poiValue').textContent='Sin dato';$('#poiList').innerHTML=`<div class="empty compact">${esc(e.message)}</div>`}
}
async function loadPark4Night(){
  if(!state.selected){if(state.exploreContext)state.selected={...state.exploreContext};else{const first=state.routeNames[0]||D.destinations[0].name;state.selected={...(D.destinations.find(x=>x.name===first)||D.destinations[0])}}}
  if(!state.selected.lat){const a=await geocode(state.selected.name+', Andalucía, España');state.selected.lat=+a[0].lat;state.selected.lng=+a[0].lon}
  const d=await fetchJson(`data/park4night-live.json?v=${Date.now()}`),r=+$('#sleepRadius').value,all=(d.anchors||[]).flatMap(a=>(a.places||[]));const seen=new Set();state.sleepItems=all.filter(x=>{if(seen.has(x.id)||['C','CC'].includes(x.code))return false;seen.add(x.id);const di=hav(state.selected.lat,state.selected.lng,+x.latitude,+x.longitude);x.distance_km=Math.round(di*10)/10;return di<=r});$('#sleepCount').textContent=state.sleepItems.length+' zonas reales encontradas';filterSleep();
}
function filterSleep(){const q=norm($('#sleepTextFilter').value),v=$('#sleepViewFilter').value,min=+$('#sleepRating').value,max=+$('#sleepMaxDistance').value,svc=norm($('#sleepService').value);let a=state.sleepItems.filter(x=>(!q||norm([x.name,x.description,x.location,x.amenities].join(' ')).includes(q))&&(!min||(+x.rating||0)>=min)&&(max===999||x.distance_km<=max)&&(!svc||norm(x.amenities).includes(svc)));if(v==='sea')a=a.filter(x=>/(mar|playa|costa|beach|sea|oceano)/i.test([x.name,x.description,x.location].join(' ')));if(v==='monument')a=a.filter(x=>/(alhambra|castillo|catedral|torre|faro|monumento|historic|muralla|alcazaba|mezquita|puente)/i.test([x.name,x.description,x.location].join(' ')));if(v==='nature')a=a.filter(x=>/(natur|parque|bosque|rural|monta|campo|duna|acantilado)/i.test([x.name,x.description,x.location].join(' ')));if(v==='quiet')a=a.filter(x=>/(tranquil|quiet|sin ruido|poco tráfico|poco trafico)/i.test(x.description||''));$('#sleepResults').innerHTML=a.length?a.slice(0,40).map(x=>`<button class="place-card sleep-card" data-sleep="${x.id}">${x.photo?`<img src="${x.photo}" alt="${esc(x.name)}">`:'<div class="p4-placeholder">P4N</div>'}<span><h3>${esc(x.name)}</h3><p>${x.distance_km} km · ${esc(x.category||'Park4Night')}${x.rating?' · ★ '+x.rating:''}</p><p class="sleep-desc">${esc((x.description||'').slice(0,140))}</p><span class="pink">VER DETALLE →</span></span></button>`).join(''):'<div class="empty">No hay resultados con esos filtros.</div>'}
function openSleep(id){const x=state.sleepItems.find(y=>String(y.id)===String(id));if(!x)return;state.sleep=x;$('#sleepTitle').textContent=x.name;$('#sleepText').textContent=[x.category,x.location,x.distance_km+' km',x.amenities,x.description].filter(Boolean).join(' · ');$('#sleepHero').innerHTML=x.photo?`<img src="${x.photo}" alt="${esc(x.name)}">`:'';$('#sleepReviews').innerHTML='';go('sleepDetail')}
function prefs(){return{days:+$('#days').value,maxDaily:+$('#maxDaily').value,maxTotal:+$('#maxTotal').value,priority:$('#priority').value,province:$('#routeProvince').value,pace:$('#pace').value,detour:+$('#detour').value,filters:[...state.filters]}}
async function generate(){const out=$('#generatedRoutes');if(!state.routeNames.length){out.innerHTML='<div class="empty">Añade al menos el punto de salida.</div>';return}const p=prefs(),o=D.destinations.find(x=>norm(x.name)===norm(state.routeNames[0]));if(!o){out.innerHTML='<div class="empty">El origen debe ser uno de los destinos añadidos desde el buscador.</div>';return}const target=Math.max(2,Math.min(7,p.pace==='muchas'?Math.ceil(p.days/1.4):p.pace==='pocas'?Math.ceil(p.days/3):Math.ceil(p.days/2))),score=(x,t)=>{let s=Math.random()*12-hav(o.lat,o.lng,x.lat,x.lng)/60;if(p.province&&x.province===p.province)s+=20;if(t==='Costa'&&x.coast)s+=25;if(t==='Pueblos'&&x.tags.some(z=>norm(z).includes('pueblo')))s+=25;if(t==='Naturaleza'&&x.tags.some(z=>norm(z).includes('natur')))s+=25;p.filters.forEach(f=>{if(x.tags.some(z=>norm(z).includes(norm(f).split(' ')[0])))s+=8});return s},themes=p.priority==='Mixto'?['Costa','Pueblos','Naturaleza']:[p.priority,p.priority==='Costa'?'Naturaleza':'Costa','Mixto'];state.gen=themes.map((t,k)=>{const a=D.destinations.filter(x=>x.name!==o.name&&(!p.province||x.province===p.province||t==='Mixto')).map(x=>({...x,_s:score(x,t)})).sort((a,b)=>b._s-a._s),pick=[];for(const x of a){if(pick.length>=target)break;if(pick.every(y=>hav(y.lat,y.lng,x.lat,x.lng)>15))pick.push(x)}return{name:`Opción ${k+1} · ${t}`,stops:[o.name,...pick.map(x=>x.name)],why:`${p.days} días · ${p.pace} · ${t.toLowerCase()} · ${p.filters.slice(0,3).join(', ')}`}});out.innerHTML=state.gen.map((r,i)=>`<article class="generated-card"><span class="gen-number">${i+1}</span><h3>${r.name}</h3><p>${esc(r.why)}</p><div class="gen-stops">${r.stops.map((x,j)=>`<span>${j+1}. ${esc(x)}</span>`).join('')}</div><div class="gen-actions"><button class="btn btn-black" data-usegen="${i}">VER / CALCULAR</button><button class="btn btn-outline" data-editgen="${i}">EDITAR</button><button class="btn btn-lime" data-savegen="${i}">GUARDAR</button></div></article>`).join('')}
function db(){return new Promise((ok,no)=>{const r=indexedDB.open('AndalusianRouteDB',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('routes'))r.result.createObjectStore('routes',{keyPath:'id'})};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function put(v){const d=await db();return new Promise((ok,no)=>{const t=d.transaction('routes','readwrite');t.objectStore('routes').put(v);t.oncomplete=()=>ok();t.onerror=()=>no(t.error)})}
async function all(){const d=await db();return new Promise((ok,no)=>{const r=d.transaction('routes').objectStore('routes').getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function delDb(id){const d=await db();return new Promise((ok,no)=>{const t=d.transaction('routes','readwrite');t.objectStore('routes').delete(id);t.oncomplete=ok;t.onerror=()=>no(t.error)})}
async function saveRoute(name){if(!state.route)return;await put({id:'r'+Date.now(),name:name||`${state.routeNames[0]} → ${state.routeNames.at(-1)}`,stopNames:[...state.routeNames],route:state.route,distanceKm:state.route.distanceKm,durationMin:state.route.durationMin,updatedAt:Date.now(),prefs:prefs()});$('#routeStatus').textContent='Ruta guardada en la base de datos del dispositivo.'}
async function renderSaved(){state.saved=(await all()).sort((a,b)=>b.updatedAt-a.updatedAt);$('#savedRoutesList').innerHTML=state.saved.length?state.saved.map(r=>`<article class="saved-route-card"><div><small>${new Date(r.updatedAt).toLocaleDateString('es-ES')}</small><h3>${esc(r.name)}</h3><p>${r.stopNames.length} paradas · ${r.distanceKm} km</p><div class="saved-stops">${r.stopNames.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div><div class="saved-actions"><button class="btn btn-black" data-opensaved="${r.id}">ABRIR</button><button class="btn btn-outline" data-delsaved="${r.id}">ELIMINAR</button></div></article>`).join(''):'<div class="empty">Todavía no hay rutas guardadas.</div>'}
function renderFavorites(){const a=[...state.favorites];$('#favoritesList').innerHTML=a.length?a.map(n=>{const p=D.destinations.find(x=>x.name===n)||D.suggested[0];return`<button class="place-card" data-place="${esc(n)}"><img src="${p.photo}" alt="${esc(n)}"><span><h3>${esc(n)}</h3><p>Destino guardado</p></span></button>`}).join(''):'<div class="empty">Todavía no has guardado favoritos.</div>'}
function activateExploreCategory(category){state.exploreCategory=category;if(!state.exploreContext){if(state.selected?.lat)state.exploreContext={name:state.selected.name,lat:state.selected.lat,lng:state.selected.lng};else if(state.route?.stops?.[0])state.exploreContext={name:state.routeNames[0],lat:state.route.stops[0].lat,lng:state.route.stops[0].lng};}go('explore');}
document.addEventListener('input',e=>{
  if(e.target.id==='routeSearch'){clearTimeout(state.timer);state.timer=setTimeout(()=>routeSearch(e.target.value),280)}
  if(e.target.id==='exploreCitySearch'){clearTimeout(state.timer);state.timer=setTimeout(()=>exploreCitySearch(e.target.value),280)}
  if(e.target.closest('#sleepFilters'))filterSleep();
});
document.addEventListener('change',e=>{if(e.target.closest('#sleepFilters'))e.target.id==='sleepRadius'?loadPark4Night():filterSleep()});
document.addEventListener('click',async e=>{
  let x;
  if(x=e.target.closest('[data-go]'))return go(x.dataset.go);
  if(x=e.target.closest('[data-place]'))return openPlace(x.dataset.place);
  if(x=e.target.closest('[data-explore-cat]'))return activateExploreCategory(x.dataset.exploreCat);
  if(x=e.target.closest('[data-destination-explore]')){state.exploreContext={name:state.selected.name,lat:state.selected.lat,lng:state.selected.lng};state.exploreCategory=x.dataset.destinationExplore;return go('explore')}
  if(x=e.target.closest('[data-explore-city]')){const a=state.exploreSearchItems[+x.dataset.exploreCity];if(a){state.exploreContext={name:a.name||a.display_name.split(',')[0],lat:+a.lat,lng:+a.lon};$('#exploreCitySuggestions').innerHTML='';return loadExploreCategory(state.exploreCategory)}return}
  if(x=e.target.closest('[data-explore-result]')){const a=state.exploreItems[+x.dataset.exploreResult];if(a)return open(`https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`,'_blank')}
  if(x=e.target.closest('[data-filter]')){state.filters.has(x.dataset.filter)?state.filters.delete(x.dataset.filter):state.filters.add(x.dataset.filter);return renderCreate()}
  if(x=e.target.closest('[data-suggest]')){const a=$('#routeSuggestions')._items?.[+x.dataset.suggest];if(a){const n=a.name||a.display_name.split(',')[0];if(!state.routeNames.includes(n))state.routeNames.push(n);$('#routeSearch').value='';$('#routeSuggestions').innerHTML='';renderCreate()}return}
  if(x=e.target.closest('.remove-stop')){state.routeNames.splice(+x.dataset.index,1);state.route=null;return renderCreate()}
  if(x=e.target.closest('[data-open]'))return openPlace(state.routeNames[+x.dataset.open]);
  if(x=e.target.closest('[data-up]')){const i=+x.dataset.up;if(i>0)[state.routeNames[i-1],state.routeNames[i]]=[state.routeNames[i],state.routeNames[i-1]];state.route=null;return renderTimeline()}
  if(x=e.target.closest('[data-down]')){const i=+x.dataset.down;if(i<state.routeNames.length-1)[state.routeNames[i+1],state.routeNames[i]]=[state.routeNames[i],state.routeNames[i+1]];state.route=null;return renderTimeline()}
  if(x=e.target.closest('[data-del]')){state.routeNames.splice(+x.dataset.del,1);state.route=null;return renderTimeline()}
  if(x=e.target.closest('[data-poi]'))return open('https://www.google.com/maps/search/?api=1&query='+x.dataset.poi,'_blank');
  if(x=e.target.closest('[data-sleep]'))return openSleep(x.dataset.sleep);
  if(x=e.target.closest('[data-editgen]')){state.routeNames=[...state.gen[+x.dataset.editgen].stops];renderCreate();return}
  if(x=e.target.closest('[data-usegen],[data-savegen]')){const i=+(x.dataset.usegen??x.dataset.savegen),r=state.gen[i];state.routeNames=[...r.stops];state.route=await calculateRoad(state.routeNames);setSummary('Propuesta calculada con carreteras reales.');if(x.dataset.savegen!=null)await saveRoute(r.name);return go('route')}
  if(x=e.target.closest('[data-opensaved]')){const r=state.saved.find(y=>y.id===x.dataset.opensaved);state.routeNames=[...r.stopNames];state.route=r.route||await calculateRoad(state.routeNames);setSummary('Ruta cargada desde la base de datos.');return go('route')}
  if(x=e.target.closest('[data-delsaved]')){await delDb(x.dataset.delsaved);return renderSaved()}
});
$('#calculate').onclick=calculate;
$('#generateRoutes').onclick=generate;
$('#loadDestinationLive').onclick=loadDestination;
$('#loadSleep').onclick=loadPark4Night;
$('#saveRoute').onclick=()=>saveRoute();
$('#favDestination').onclick=()=>{if(!state.selected)return;const n=state.selected.name;state.favorites.has(n)?state.favorites.delete(n):state.favorites.add(n);localStorage.setItem('andalusianRoudeFavs',JSON.stringify([...state.favorites]));$('#favDestination').textContent=state.favorites.has(n)?'♥':'♡'};
$('#share').onclick=async()=>{if(!state.route)return;const t=state.routeNames.join(' → ')+' · '+state.route.distanceKm+' km';navigator.share?await navigator.share({title:'Andalusian Roude',text:t}):navigator.clipboard?.writeText(t)};
$('#openPark4Night').onclick=()=>open(state.sleep?.id?'https://park4night.com/es/place/'+state.sleep.id:'https://park4night.com/es','_blank');
renderNav();renderHome();renderCreate();renderExplore();renderSaved();
})();