import fs from 'node:fs/promises';
const html=await fs.readFile('index.html','utf8');
const js=await fs.readFile('assets/js/app.js','utf8');
const requiredScreens=['home','create','route','savedRoutes','timeline','explore','communityDetail','destination','sleep','sleepDetail','favorites','profile'];
for(const id of requiredScreens)if(!html.includes(`data-screen="${id}"`))throw new Error(`Missing screen ${id}`);
for(const id of ['scopeSearch','routeSearch','generateRoutes','calculate','loadSleep','saveRoute','communityMaps','communitySleep','openPark4Night'])if(!html.includes(`id="${id}"`))throw new Error(`Missing action ${id}`);
for(const marker of ['data/community-index.json','data/park4night-live.json','source_kind===\'travel-community\'','mentions_2026','community_score','indexedDB.open','router.project-osrm.org','api.open-meteo.com'])if(!js.includes(marker))throw new Error(`Missing real wiring: ${marker}`);
if(js.includes('wikipedia.org')||js.includes('fetchOverpass(')||js.includes('overpass-api.de'))throw new Error('Old generic discovery source still wired into app.js');
console.log('Production structure and real-data wiring OK');
