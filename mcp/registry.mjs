import fs from 'node:fs/promises';
import path from 'node:path';
import { McpStdioClient } from './stdio-client.mjs';
const CACHE = path.join(process.cwd(),'mcp','.registry-cache.json');

function findServerObject(node){
  if(!node||typeof node!=='object') return null;
  if(Array.isArray(node)){ for(const v of node){const x=findServerObject(v);if(x)return x;} return null; }
  if(node.name==='com.pulsemcp.mirror/beba-ai-ml-park4night' && (node.packages||node.remotes)) return node;
  for(const v of Object.values(node)){const x=findServerObject(v);if(x)return x;}
  return null;
}
async function fetchJson(url){
  const r=await fetch(url,{headers:{'user-agent':'Andalusian-Roude/1.0'}});
  if(!r.ok) throw new Error(`Registry HTTP ${r.status}`);
  const text=await r.text();
  try{return JSON.parse(text);}catch{}
  const m=text.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if(m){try{const x=findServerObject(JSON.parse(m[1]));if(x)return x;}catch{}}
  const namePos=text.indexOf('com.pulsemcp.mirror/beba-ai-ml-park4night');
  if(namePos>=0){
    const slice=text.slice(Math.max(0,namePos-12000),namePos+30000);
    const pm=slice.match(/\{[^{}]{0,1000}"name"\s*:\s*"com\.pulsemcp\.mirror\/beba-ai-ml-park4night"[\s\S]{0,20000}?"packages"\s*:\s*\[[\s\S]{0,12000}?\]\s*\}/);
    if(pm){try{return JSON.parse(pm[0]);}catch{}}
  }
  throw new Error('PulseMCP server.json page could not be resolved into an installable server config');
}
function packageToCommand(p){
  const ver=p.version?`@${p.version}`:'';
  if(p.runtimeHint){
    const vals=(p.runtimeArguments||[]).map(a=>a.value).filter(Boolean);
    return {command:p.runtimeHint,args:[...vals,p.identifier,...(p.packageArguments||[]).map(a=>a.value).filter(Boolean)]};
  }
  if(p.registryType==='npm') return {command:'npx',args:['-y',`${p.identifier}${ver}`]};
  if(p.registryType==='pypi') return {command:'uvx',args:[p.identifier]};
  if(p.registryType==='cargo') return {command:'cargo',args:['install',p.identifier]};
  throw new Error(`Unsupported Park4Night package registry type: ${p.registryType}`);
}
export async function resolvePulseServer(url){
  try{const data=await fetchJson(url);await fs.writeFile(CACHE,JSON.stringify({url,data,ts:Date.now()},null,2));return data;}
  catch(err){
    try{const cached=JSON.parse(await fs.readFile(CACHE,'utf8'));if(cached.url===url)return cached.data;}catch{}
    throw err;
  }
}
export async function park4nightClient(url){
  const override=process.env.PARK4NIGHT_MCP_COMMAND;
  if(override){return new McpStdioClient(override,JSON.parse(process.env.PARK4NIGHT_MCP_ARGS||'[]'));}
  const server=await resolvePulseServer(url);
  const p=server.packages?.[0];
  if(!p) throw new Error('Park4Night server.json has no installable package. Set PARK4NIGHT_MCP_COMMAND/PARK4NIGHT_MCP_ARGS or use a server.json version with packages.');
  const cfg=packageToCommand(p); return new McpStdioClient(cfg.command,cfg.args);
}
