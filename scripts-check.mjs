import fs from 'node:fs/promises';
const html=await fs.readFile('index.html','utf8');const js=await fs.readFile('assets/js/app.js','utf8');
const required=['home','create','route','timeline','explore','destination','sleep','sleepDetail','favorites','profile'];
for(const id of required)if(!html.includes(`data-screen="${id}"`))throw new Error(`Missing screen ${id}`);
for(const id of ['calculate','loadDestinationLive','loadSleep','share','openPark4Night'])if(!html.includes(`id="${id}"`))throw new Error(`Missing action ${id}`);
if(!js.includes('/api/park4night/search'))throw new Error('Missing Park4Night API wiring');
if(!js.includes('/api/weather'))throw new Error('Missing Weather API wiring');
console.log('Structure OK');
