const CACHE='talk2me-offline-v1';
// Mobile players often probe the same short MP3 with several byte ranges.
const playingClips = new Map();
async function onlineClip(req, clientId) {
  const key = clientId + ':' + req.url;
  let clip = playingClips.get(key);
  if (!clip || Date.now() >= clip.expires) {
    const headers = new Headers(req.headers);
    headers.delete('Range');
    headers.delete('If-Range');
    const load = fetch(new Request(req, {headers})).then(async response => {
      if (response.status !== 200) return response;
      const body = await response.blob();
      return new Response(body, {headers: response.headers});
    });
    clip = {load, expires: Date.now() + 60000};
    playingClips.set(key, clip);
    if (playingClips.size > 12) playingClips.delete(playingClips.keys().next().value);
  }
  try {
    const response = await clip.load;
    if (response.status === 200) return cachedMedia(req, response.clone());
    if (playingClips.get(key) === clip) playingClips.delete(key);
    return response.clone();
  } catch (error) {
    if (playingClips.get(key) === clip) playingClips.delete(key);
    throw error;
  }
}

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  if(event.data==='clear') { playingClips.clear(); event.waitUntil(caches.delete(CACHE)); }
});
async function cachedMedia(request, saved) {
  const range = request.headers.get('Range');
  if (!range) return saved;
  const blob = await saved.blob();
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return saved;
  const start = match[1] ? Number(match[1]) : Math.max(0, blob.size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), blob.size - 1) : blob.size - 1;
  if (start > end) return new Response(null, {status: 416, headers: {'Content-Range': 'bytes */' + blob.size}});
  return new Response(blob.slice(start, end + 1), {status: 206, headers: {
    'Content-Type': blob.type, 'Content-Length': String(end - start + 1),
    'Content-Range': `bytes ${start}-${end}/${blob.size}`, 'Accept-Ranges': 'bytes'
  }});
}

self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(url.origin!==location.origin||req.method!=='GET')return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // The speech worker caches its model separately; avoid a second large copy.
    if (url.pathname === '/speech-es/spanish-042.tar.gz') return fetch(req);
    if (url.pathname === '/speech-es/worker-008.js') {
      const saved = await cache.match(req);
      if (saved) return saved;
    }
    if (url.pathname.startsWith('/m/')) {
      const saved = await cache.match(req.url, {ignoreVary: true});
      if (saved?.status === 200) return cachedMedia(req, saved);
    }
    try{
      const audioRange = event.clientId && url.pathname.startsWith('/m/') && url.pathname.endsWith('.mp3') && req.headers.has('range');
      const response = audioRange ? await onlineClip(req, event.clientId) : await fetch(req);
      if(response.status===401){playingClips.clear();await caches.delete(CACHE);return response;}
      // Only explicit downloads store lessons/media. Shell and current student state update online.
      const state=['/api/auth/config','/api/profile','/api/tree'].includes(url.pathname);
      const shell=!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/m/')&&!url.pathname.startsWith('/media/');
      if(response.ok&&(state||shell))await cache.put(req,response.clone());
      return response;
    }catch(error){
      const response=await cache.match(req,{ignoreVary:true});
      if(!response)return new Response(JSON.stringify({error:'Esta aula ainda não foi baixada. Conecte-se para abrir.'}),{status:503,headers:{'Content-Type':'application/json'}});
      return response;
    }
  })());
});
