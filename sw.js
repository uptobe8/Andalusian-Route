const CACHE='andalusian-roude-cache-reset-20260817';

self.addEventListener('install',event=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.map(key=>caches.delete(key)));
    await self.clients.claim();
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.all(clients.map(client=>{
      const url=new URL(client.url);
      url.searchParams.set('cachefix','20260817');
      return client.navigate(url.href);
    }));
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const request=event.request.mode==='navigate'
        ? new Request(event.request,{cache:'reload'})
        : event.request;
      const response=await fetch(request,{cache:'no-store'});
      return response;
    }catch(error){
      const cached=await caches.match(event.request);
      if(cached)return cached;
      throw error;
    }
  })());
});
