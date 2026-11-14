'use strict';
importScripts('/mobile/range.js');
const SHELL = 'talk2me-mobile-shell-__BUILD_ID__';
const FILES = "__SHELL_FILES__";
const DOWNLOADS = 'talk2me-mobile-download-';
const MARKER = '/__talk2me_complete__';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES.map(path=>new Request(path,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for (const name of await caches.keys()) {
      if (name.startsWith('talk2me-mobile-shell-') && name !== SHELL) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting();
});
async function identity() {
  return new Promise(resolve=>{
    const request = indexedDB.open('talk2me-personal',1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('profiles')) request.result.createObjectStore('profiles');
      if (!request.result.objectStoreNames.contains('meta')) request.result.createObjectStore('meta');
    };
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('meta','readonly');
      const read = tx.objectStore('meta').get('identity');
      tx.oncomplete = () => { db.close(); resolve(read.result || null); };
      tx.onabort = tx.onerror = () => { db.close(); resolve(null); };
    };
  });
}
async function downloaded(request) {
  const user = await identity();
  if (!user) return null;
  for (const name of await caches.keys()) {
    if (!name.startsWith(DOWNLOADS + user.id + ':')) continue;
    const cache = await caches.open(name);
    if (!await cache.match(MARKER)) continue;
    const response = await cache.match(request.url, {ignoreVary:true});
    if (!response) continue;
    const range = request.headers.get('Range');
    if (!range) return response;
    const blob = await response.blob(), bounds = rangeBounds(range,blob.size);
    if (!bounds) return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+blob.size}});
    const [start,end] = bounds;
    return new Response(blob.slice(start,end+1), {status:206,headers:{
      'Content-Type':response.headers.get('Content-Type') || 'application/octet-stream',
      'Accept-Ranges':'bytes', 'Content-Range':`bytes ${start}-${end}/${blob.size}`,
      'Content-Length':String(end-start+1)
    }});
  }
  return null;
}
self.addEventListener('fetch',event=>{
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/m/') || url.pathname.startsWith('/api/lesson/')) {
    event.respondWith((async()=>{
      // Only an explicit, completed download can serve private content offline.
      const saved = await downloaded(req);
      if (saved) return saved;
      try { return await fetch(req); }
      catch { return new Response(JSON.stringify({error:'Esta aula não foi baixada. Conecte-se para estudar online.'}),
        {status:503,headers:{'Content-Type':'application/json'}}); }
    })());
    return;
  }
  if (url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate' || FILES.includes(url.pathname)) {
    event.respondWith((async()=>{
      const cache = await caches.open(SHELL);
      const response = await cache.match(req.mode === 'navigate' ? '/' : url.pathname, {ignoreSearch:true});
      return response || fetch(req);
    })());
  }
});
