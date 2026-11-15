const offlineCache = 'talk2me-offline-v1';
const pendingFiles = new Map();
let preparingOffline;

async function saveMissing(cache, path) {
  if (pendingFiles.has(path)) return pendingFiles.get(path);
  const saving = (async () => {
    const saved = await cache.match(path, {ignoreVary: true});
    if (saved?.status === 200) return;
    const media = path.startsWith('/m/');
    const attempts = media ? 5 : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let response;
      try {
        response = await fetch(path);
        if (response.status === 200) {
          await cache.put(path, response);
          return;
        }
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
      }
      const transient = !response || [408, 429, 500, 502, 503, 504].includes(response.status);
      if (!transient || attempt === attempts) throw Error('Um arquivo ficou indisponível. Os arquivos já salvos serão reaproveitados.');
      const seconds = Number(response?.headers.get('Retry-After')) || 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, Math.min(60, seconds) * 1000));
    }
  })();
  pendingFiles.set(path, saving);
  try { await saving; } finally { pendingFiles.delete(path); }
}

async function saveFiles(cache, paths, onSaved) {
  const queue = Array.from(new Set(paths));
  let next = 0;
  let firstError;
  async function worker() {
    while (next < queue.length) {
      try {
        await saveMissing(cache, queue[next++]);
        if (onSaved) onSaved();
      } catch (error) {
        firstError ??= error;
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(3, queue.length)}, worker));
  if (firstError) throw firstError;
}

async function cacheStudyResources() {
  await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const cache = await caches.open(offlineCache);
  const assets = [...document.querySelectorAll('script[src],link[rel="stylesheet"]')]
    .map(el => new URL(el.src || el.href))
    .filter(url => url.origin === location.origin)
    .map(url => url.pathname + url.search);
  await saveFiles(cache, ['/', ...assets, '/api/auth/config', '/api/profile', '/api/tree?lang=es']);
  const css = await (await cache.match(assets.find(path => path.startsWith('/styles.css')), {ignoreVary: true})).text();
  const fonts = Array.from(css.matchAll(/url\(['"]?(\/fonts\/[^)'"]+)/g), match => match[1]);
  await saveFiles(cache, fonts);
}

function prepareOffline() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return Promise.resolve();
  if (!preparingOffline) {
    preparingOffline = cacheStudyResources().catch(error => {
      preparingOffline = undefined;
      throw error;
    });
  }
  return preparingOffline;
}

async function downloadLesson(d, button) {
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('caches' in window)) {
    button.textContent = 'Downloads precisam de HTTPS ou localhost.';
    return;
  }
  button.disabled = true;
  button.textContent = 'Verificando arquivos salvos…';
  try {
    const cache = await caches.open(offlineCache);
    const paths = new Set(JSON.stringify(d).match(/\/m\/[^"\s<>\\]+/g) || []);
    let done = 0;
    const files = [...paths];
    const visual = files.filter(path => !path.endsWith('.mp3'));
    // Start large videos first; audio comes from Render independently of Drive.
    visual.sort((a, b) => Number(b.endsWith('.mp4')) - Number(a.endsWith('.mp4')));
    const onSaved = () => {
      button.textContent = `Preparando aula: ${++done}/${paths.size}…`;
    };
    const results = await Promise.allSettled([
      prepareOffline(),
      saveFiles(cache, visual, onSaved),
      saveFiles(cache, files.filter(path => path.endsWith('.mp3')), onSaved)
    ]);
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
    }
    // The preview already fetched this lesson. Publish it only after every file is ready.
    await cache.put('/api/lesson/' + d.id, new Response(JSON.stringify(d), {
      headers: {'Content-Type': 'application/json; charset=utf-8'}
    }));
    button.textContent = 'Aula disponível sem conexão ✓';
    if (!S.downloaded) S.downloaded = new Set();
    S.downloaded.add(d.id);
  } catch (err) {
    button.textContent = err.message || 'Sem espaço ou sem conexão. Tente novamente.';
  } finally {
    button.disabled = false;
  }
}
function pendingKey(){return 'talk2me-pending-'+S.profile.id;}
async function finishLesson(data){
  data.event_id ||= StudyAPI.eventId();
  try{return await api('/api/finish',data);}catch(err){
    const pending=JSON.parse(localStorage.getItem(pendingKey())||'[]');pending.push(data);
    localStorage.setItem(pendingKey(),JSON.stringify(pending));return {gained:0,pending:true};
  }
}
async function syncProgress(){
  const key=pendingKey(),pending=JSON.parse(localStorage.getItem(key)||'[]');
  while(pending.length){try{await api('/api/finish',pending[0]);pending.shift();localStorage.setItem(key,JSON.stringify(pending));}catch(err){break;}}
}
window.addEventListener('online',()=>{if(S.profile.id)syncProgress().then(loadProfile);});
