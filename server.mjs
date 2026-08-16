import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpStdioClient } from './mcp/stdio-client.mjs';
import { park4nightClient } from './mcp/registry.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||8080);
const sources=JSON.parse(await fs.readFile(path.join(__dirname,'mcp','sources.json'),'utf8'));
const clients={};

function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));}
function mime(p){return p.endsWith('.css')?'text/css':p.endsWith('.js')||p.endsWith('.mjs')?'text/javascript':p.endsWith('.svg')?'image/svg+xml':p.endsWith('.json')?'application/json':'text/html';}
async function body(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{};}
async function client(kind){
  if(clients[kind]) return clients[kind];
  if(kind==='osm') clients[kind]=new McpStdioClient(sources.openstreetmap.command,sources.openstreetmap.args);
  if(kind==='weather') clients[kind]=new McpStdioClient(sources.weather.command,sources.weather.args);
  if(kind==='park4night') clients[kind]=await park4nightClient(sources.park4night.registryUrl);
  return clients[kind];
}
function parseTool(result){
  if(!result) return null;
  if(result.structuredContent) return result.structuredContent;
  const texts=(result.content||[]).filter(x=>x.type==='text').map(x=>x.text);
  if(!texts.length)return result;
  if(texts.length===1){try{return JSON.parse(texts[0]);}catch{return {text:texts[0]};}}
  return {texts};
}
async function geocodeDirect(q){const u=new URL('https://nominatim.openstreetmap.org/search');u.searchParams.set('q',q);u.searchParams.set('format','jsonv2');u.searchParams.set('limit','1');const r=await fetch(u,{headers:{'user-agent':'Andalusian-Roude/1.0'}});if(!r.ok)throw new Error(`Nominatim ${r.status}`);const a=await r.json();if(!a[0])throw new Error(`No se encontró ${q}`);return {name:a[0].display_name,lat:Number(a[0].lat),lng:Number(a[0].lon)};}
async function geocode(q){
  try{const c=await client('osm');const r=parseTool(await c.callTool('geocode_address',{address:q}));const candidate=Array.isArray(r)?r[0]:r?.results?.[0]||r?.locations?.[0]||r;if(candidate?.lat||candidate?.latitude)return {name:candidate.display_name||candidate.name||q,lat:Number(candidate.lat??candidate.latitude),lng:Number(candidate.lon??candidate.lng??candidate.longitude)};}catch(e){console.warn('OSM MCP geocode fallback:',e.message)}
  return geocodeDirect(q);
}
async function liveRoute(stops){
  const pts=[];for(const s of stops)pts.push(typeof s==='string'?await geocode(s):s);
  const coords=pts.map(p=>`${p.lng},${p.lat}`).join(';');
  const u=`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const r=await fetch(u,{headers:{'user-agent':'Andalusian-Roude/1.0'}});if(!r.ok)throw new Error(`OSRM ${r.status}`);const data=await r.json();if(data.code!=='Ok'||!data.routes?.[0])throw new Error(data.message||'No route');
  const route=data.routes[0];return {stops:pts,distanceKm:Math.round(route.distance/1000),durationMin:Math.round(route.duration/60),geometry:route.geometry};
}
async function handleApi(req,res,url){
  try{
    if(url.pathname==='/api/status'){
      return json(res,200,{app:'Andalusian Roude',providers:{park4night:'PulseMCP dynamic server.json',osm:'OpenStreetMap MCP',weather:'Weather MCP',routing:'OSRM live',googleMaps:'optional with API key'}});
    }
    if(url.pathname==='/api/geocode') return json(res,200,await geocode(url.searchParams.get('q')||''));
    if(url.pathname==='/api/route'&&req.method==='POST'){const b=await body(req);if(!Array.isArray(b.stops)||b.stops.length<2)return json(res,400,{error:'Se necesitan al menos dos paradas.'});return json(res,200,await liveRoute(b.stops));}
    if(url.pathname==='/api/weather'){const c=await client('weather');const city=url.searchParams.get('city');const lat=url.searchParams.get('lat');const lng=url.searchParams.get('lng');const args=city?{city_name:city,units:'metric'}:{latitude:Number(lat),longitude:Number(lng),units:'metric'};return json(res,200,parseTool(await c.callTool('get_weather_summary',args)));}
    if(url.pathname==='/api/poi'){const c=await client('osm');const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));const category=url.searchParams.get('category')||'tourism';return json(res,200,parseTool(await c.callTool('find_nearby_places',{latitude:lat,longitude:lng,category,radius:5000})));}
    if(url.pathname==='/api/park4night/search'){const c=await client('park4night');const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng')),radius=Number(url.searchParams.get('radius')||20);return json(res,200,parseTool(await c.callTool('search_places',{latitude:lat,longitude:lng,radius_km:radius})));}
    if(url.pathname==='/api/park4night/along-route'&&req.method==='POST'){const c=await client('park4night');const b=await body(req);return json(res,200,parseTool(await c.callTool('search_along_route',b)));}
    if(url.pathname==='/api/park4night/reviews'){const c=await client('park4night');return json(res,200,parseTool(await c.callTool('get_reviews',{place_id:url.searchParams.get('placeId')})));}
    return json(res,404,{error:'Not found'});
  }catch(err){console.error(err);return json(res,502,{error:err.message,realData:true});}
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname.startsWith('/api/'))return handleApi(req,res,url);
  let rel=url.pathname==='/'?'index.html':url.pathname.replace(/^\//,'');
  if(rel.includes('..')){res.writeHead(400);return res.end('Bad path');}
  const p=path.join(__dirname,rel);
  try{const data=await fs.readFile(p);res.writeHead(200,{'content-type':mime(p)});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(PORT,()=>console.log(`Andalusian Roude → http://localhost:${PORT}`));
