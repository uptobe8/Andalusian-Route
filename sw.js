const CACHE='andalusian-roude-triple-verified-20260817b';

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
      url.searchParams.set('cachefix','triple20260817b');
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
      const request=event.request.mode==='navigate'?new Request(event.request,{cache:'reload'}):event.request;
      return await fetch(request,{cache:'no-store'});
    }catch(error){
      const cached=await caches.match(event.request);
      if(cached)return cached;
      throw error;
    }
  })());
});
