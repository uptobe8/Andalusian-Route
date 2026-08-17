import fs from 'node:fs/promises';
import vm from 'node:vm';

const nativeFetch = globalThis.fetch;
globalThis.window = globalThis;
globalThis.document = {querySelector(){return null;},querySelectorAll(){return [];}};
globalThis.localStorage = {getItem(){return null;},setItem(){},removeItem(){}};
globalThis.scrollTo = ()=>{};

globalThis.fetch = async (input, init={}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url;
  if (url?.startsWith('data/park4night-live.json')) {
    const text = await fs.readFile('data/park4night-live.json','utf8');
    return new Response(text,{status:200,headers:{'content-type':'application/json'}});
  }
  const headers = new Headers(init.headers||{});
  headers.set('User-Agent','Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1');
  headers.set('Accept','application/json,text/plain,*/*');
  return nativeFetch(input,{...init,headers});
};

for (const file of ['assets/js/core.js','assets/js/data.js','assets/js/sources.js','assets/js/planner.js']) {
  const code = await fs.readFile(file,'utf8');
  vm.runInThisContext(code,{filename:file});
}

const input = {
  originName:'Madrid',
  mandatory:[],
  days:14,
  maxDaily:350,
  maxTotal:2800,
  priority:'Costa',
  pace:'equilibrado',
  detour:60,
  filters:['Playa','Naturaleza','Frente al mar'],
  province:''
};

console.log('QA_INPUT '+JSON.stringify(input));
const statuses=[];
try {
  const options = await window.ARPlanner.planThree(input,m=>{statuses.push(m);console.log('STATUS '+m);});
  const result = options.map((o,index)=>({
    option:index+1,
    name:o.name,
    distanceKm:o.route.distanceKm,
    durationMin:o.route.durationMin,
    maxLegKm:Math.max(0,...(o.route.legs||[]).map(x=>x.distanceKm)),
    legsKm:(o.route.legs||[]).map(x=>x.distanceKm),
    stops:o.stops.map(p=>p.name),
    parkEvidence:o.parkEvidence,
    why:o.why
  }));
  console.log('QA_RESULT '+JSON.stringify({count:result.length,statuses,result}));
} catch (error) {
  console.error('QA_ERROR '+JSON.stringify({message:error.message,stack:error.stack,statuses}));
  process.exitCode=1;
}
