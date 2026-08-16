export const $=s=>document.querySelector(s);
export const $$=s=>[...document.querySelectorAll(s)];
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim();
export const hav=(a,b,c,d)=>{const R=6371,r=x=>x*Math.PI/180,A=r(c-a),B=r(d-b),q=Math.sin(A/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(B/2)**2;return 2*R*Math.asin(Math.sqrt(q))};
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const uid=(p='id')=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
export const fmtDate=t=>new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short'}).format(new Date(t));
export const isFree=p=>/gratuit|gratis|free|0\s*€|0 eur/i.test(String(p?.price||''));

const DB='AndalusianRoudeDB';
const VERSION=3;
export function openDb(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,VERSION);r.onupgradeneeded=()=>{const d=r.result;for(const name of ['routes','spots','notes'])if(!d.objectStoreNames.contains(name))d.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
export async function dbPut(store,value){const d=await openDb();return new Promise((ok,no)=>{const t=d.transaction(store,'readwrite');t.objectStore(store).put(value);t.oncomplete=()=>ok(value);t.onerror=()=>no(t.error);});}
export async function dbAll(store){const d=await openDb();return new Promise((ok,no)=>{const r=d.transaction(store).objectStore(store).getAll();r.onsuccess=()=>ok(r.result||[]);r.onerror=()=>no(r.error);});}
export async function dbGet(store,id){const d=await openDb();return new Promise((ok,no)=>{const r=d.transaction(store).objectStore(store).get(id);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>no(r.error);});}
export async function dbDel(store,id){const d=await openDb();return new Promise((ok,no)=>{const t=d.transaction(store,'readwrite');t.objectStore(store).delete(id);t.oncomplete=()=>ok();t.onerror=()=>no(t.error);});}

export function loadJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
export function saveJSON(key,value){localStorage.setItem(key,JSON.stringify(value));}
export const favorites=()=>loadJSON('ar:favorites',[]);
export function toggleFavorite(item){const a=favorites(),i=a.findIndex(x=>x.id===item.id);if(i>=0)a.splice(i,1);else a.unshift({...item,savedAt:Date.now()});saveJSON('ar:favorites',a);return i<0;}
export const isFavorite=id=>favorites().some(x=>x.id===id);
export const visited=()=>loadJSON('ar:visited',[]);
export function toggleVisited(id,label=''){const a=visited(),i=a.findIndex(x=>x.id===id);if(i>=0)a.splice(i,1);else a.unshift({id,label,at:Date.now()});saveJSON('ar:visited',a);return i<0;}
export const isVisited=id=>visited().some(x=>x.id===id);
export function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),2200);}
export function modal(html){$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden');$('#modal').setAttribute('aria-hidden','false');}
export function closeModal(){$('#modal').classList.add('hidden');$('#modal').setAttribute('aria-hidden','true');}
