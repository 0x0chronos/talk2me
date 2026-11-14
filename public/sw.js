const CACHE='talk2me-offline-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  if(event.data==='clear') event.waitUntil(caches.delete(CACHE));
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(url.origin!==location.origin||req.method!=='GET')return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(req);
      if(response.status===401){await caches.delete(CACHE);return response;}
      // Only explicit downloads store lessons/media. Shell and current student state update online.
      const state=['/api/auth/config','/api/profile','/api/tree'].includes(url.pathname);
      const shell=!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/m/')&&!url.pathname.startsWith('/media/');
      if(response.ok&&(state||shell))await cache.put(req,response.clone());
      return response;
    }catch(error){
      const response=await cache.match(req,{ignoreVary:true});
      if(!response)return new Response(JSON.stringify({error:'Esta aula ainda não foi baixada. Conecte-se para abrir.'}),{status:503,headers:{'Content-Type':'application/json'}});
      const range=req.headers.get('range');
      if(range&&url.pathname.startsWith('/m/')){
        const data=await response.arrayBuffer(),m=/bytes=(\d+)-(\d*)/.exec(range);
        if(m){const start=+m[1],end=m[2]?Math.min(+m[2],data.byteLength-1):data.byteLength-1;
          if(start>=data.byteLength)return new Response(null,{status:416});
          return new Response(data.slice(start,end+1),{status:206,headers:{'Content-Type':response.headers.get('Content-Type'),'Content-Range':`bytes ${start}-${end}/${data.byteLength}`,'Content-Length':end-start+1,'Accept-Ranges':'bytes'}});
        }
      }
      return response;
    }
  })());
});
