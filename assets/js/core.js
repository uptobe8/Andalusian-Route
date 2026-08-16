(()=>{
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hav=(a,b,c,d)=>{const R=6371,r=x=>x*Math.PI/180,A=r(c-a),B=r(d-b),q=Math.sin(A/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(B/2)**2;return 2*R*Math.asin(Math.sqrt(q));};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const uid=(p='id')=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const isFree=p=>/gratuit|gratis|free|0\s*€|0 eur/i.test(String(p?.price||''));
const loadJSON=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
const saveJSON=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const DB='AndalusianRoudeDB',VER=4;
function openDb(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,VER);r.onupgradeneeded=()=>{const d=r.result;for(const n of ['routes','spots','visits','notes','prefs'])if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
async function dbAll(store){const d=await openDb();return new Promise((ok,no)=>{const r=d.transaction(store).objectStore(store).getAll();r.onsuccess=()=>ok(r.result||[]);r.onerror=()=>no(r.error);});}
async function dbGet(store,id){const d=await openDb();return new Promise((ok,no)=>{const r=d.transaction(store).objectStore(store).get(id);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>no(r.error);});}
async function dbPut(store,v){const d=await openDb();return new Promise((ok,no)=>{const t=d.transaction(store,'readwrite');t.objectStore(store).put(v);t.oncomplete=()=>ok(v);t.onerror=()=>no(t.error);});}
async function dbDel(store,id){const d=await openDb();return new Promise((ok,no)=>{const t=d.transaction(store,'readwrite');t.objectStore(store).delete(id);t.oncomplete=()=>ok();t.onerror=()=>no(t.error);});}
const favKey='andalusianRoudeFavsV2';
function favorites(){return loadJSON(favKey,[])}
function isFavorite(id){return favorites().some(x=>x.id===id)}
function toggleFavorite(item){const a=favorites(),i=a.findIndex(x=>x.id===item.id);let on=true;if(i>=0){a.splice(i,1);on=false}else a.unshift({...item,savedAt:Date.now()});saveJSON(favKey,a);return on;}
async function toggleVisit(id,label='',meta={}){const old=await dbGet('visits',id);if(old){await dbDel('visits',id);return false}await dbPut('visits',{id,label,...meta,visitedAt:Date.now()});return true;}
async function isVisited(id){return !!(await dbGet('visits',id));}
function setStatus(msg){const el=$('#routeStatus');if(el)el.textContent=msg;}
window.ARCore={$,$$,norm,esc,hav,clamp,uid,isFree,loadJSON,saveJSON,openDb,dbAll,dbGet,dbPut,dbDel,favorites,isFavorite,toggleFavorite,toggleVisit,isVisited,setStatus};
})();
