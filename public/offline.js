const offlineCache='talk2me-offline-v1';
async function prepareOffline(){
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const cache=await caches.open(offlineCache);
  const resources=['/video-presentation.js','/','/styles.css?v=20261109_06','/talk2me.css','/data.js','/app.js?v=accounts1','/platform.js?v=1','/offline.js','/api/auth/config','/api/profile','/api/tree?lang=es'];
  for(const path of resources){const r=await fetch(path);if(r.ok)await cache.put(path,r);}
  // Fonts are fully local; include the font files referenced by the stylesheet.
  const css=await (await fetch('/styles.css?v=20261109_06')).text();
  for(const match of css.matchAll(/url\(['"]?(\/fonts\/[^)'"\s]+)/g)){const r=await fetch(match[1]);if(r.ok)await cache.put(match[1],r);}
}
async function downloadLesson(d,button){
  if(!window.isSecureContext||!('caches' in window)){button.textContent='Downloads precisam de HTTPS ou localhost.';return;}
  button.disabled=true;
  try{
    await prepareOffline();
    const cache=await caches.open(offlineCache),paths=new Set(JSON.stringify(d).match(/\/m\/[^"\s<>\\]+/g)||[]);
    let n=0;
    for(const path of paths){button.textContent=`Baixando ${++n}/${paths.size}…`;const response=await fetch(path);if(!response.ok)throw Error('Há uma mídia indisponível. Tente novamente.');await cache.put(path,response);}
    const path='/api/lesson/'+d.id,response=await fetch(path);if(!response.ok)throw Error('Entre novamente para baixar.');await cache.put(path,response);
    button.textContent='Aula disponível sem conexão ✓';
    if(!S.downloaded)S.downloaded=new Set();S.downloaded.add(d.id);
  }catch(err){button.textContent=err.message||'Sem espaço ou sem conexão. Tente novamente.';}finally{button.disabled=false;}
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
