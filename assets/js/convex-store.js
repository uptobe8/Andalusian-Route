window.ConvexStore=(()=>{
  const cfg=()=>window.APP_CONFIG?.convexSiteUrl?.replace(/\/$/,"")||"";
  const local={
    async saveRoute(route){localStorage.setItem("cadiz:lastRoute",JSON.stringify(route));return {ok:true,storage:"local"}},
    async toggleFavorite(item){const list=JSON.parse(localStorage.getItem("cadiz:favorites")||"[]");const key=item.type+":"+item.id;const i=list.findIndex(x=>x.key===key);if(i>=0)list.splice(i,1);else list.push({...item,key});localStorage.setItem("cadiz:favorites",JSON.stringify(list));return {active:i<0,storage:"local"}},
    async listFavorites(){return JSON.parse(localStorage.getItem("cadiz:favorites")||"[]")},
    async savePreferences(prefs){localStorage.setItem("cadiz:prefs",JSON.stringify(prefs));return {ok:true,storage:"local"}}
  };
  async function request(path,opts={}){const base=cfg();if(!base)throw new Error("Convex not configured");const r=await fetch(base+path,{headers:{"content-type":"application/json",...(opts.headers||{})},...opts});if(!r.ok)throw new Error(await r.text());return r.json();}
  return {
    async saveRoute(route){try{return await request("/api/routes",{method:"POST",body:JSON.stringify(route)})}catch(e){return local.saveRoute(route)}},
    async toggleFavorite(item){try{return await request("/api/favorites",{method:"POST",body:JSON.stringify(item)})}catch(e){return local.toggleFavorite(item)}},
    async listFavorites(){try{return await request("/api/favorites")}catch(e){return local.listFavorites()}},
    async savePreferences(prefs){try{return await request("/api/preferences",{method:"POST",body:JSON.stringify(prefs)})}catch(e){return local.savePreferences(prefs)}}
  };
})();