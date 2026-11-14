async function api(path, data) {
  return StudyAPI.request(path,data);
}
async function enterStudy() {
  const config = await api('/api/auth/config');
  document.querySelector('#setup-note').hidden = config.configured;
  if (!config.authenticated) return;
  document.body.classList.remove('locked');
  document.querySelector('#login-screen').hidden = true;
  await loadProfile();
  S.downloaded = new Set();
  if ('caches' in window) { const cache = await caches.open(offlineCache); for (const req of await cache.keys()) {const path=new URL(req.url).pathname;if(path.startsWith('/api/lesson/'))S.downloaded.add(path.slice('/api/lesson/'.length));} }
  await loadTree();
  await syncProgress();
  prepareOffline().catch(()=>{});
  document.querySelector('#account-email').textContent = config.user.email;
  document.querySelector('#admin-nav').hidden = config.user.role !== 'admin';
  if(config.user.role === 'admin') {
    const b = h('button',{class:'abtn',onclick:openAdmin},'Gerenciar alunos');
    document.querySelector('.account-settings').prepend(b);
  }
}
document.querySelector('#login-form').onsubmit = async e => {
  e.preventDefault();
  const f=e.currentTarget, b=f.querySelector('button'), status=f.querySelector('.form-status');
  b.disabled=true; status.textContent='Entrando…';
  try {await api('/api/auth/login',Object.fromEntries(new FormData(f))); location.reload();}
  catch(err){status.textContent=err.message;} finally{b.disabled=false;}
};
document.querySelector('#password-form').onsubmit = async e => {
  e.preventDefault();const f=e.currentTarget, d=Object.fromEntries(new FormData(f)), status=f.querySelector('.form-status'),b=f.querySelector('button');
  if(d.new_password!==d.confirm){status.textContent='As novas senhas precisam ser iguais.';return;}
  b.disabled=true;
  try{await api('/api/auth/password',d);f.reset();status.textContent='Senha alterada. As outras sessões foram encerradas.';}
  catch(err){status.textContent=err.message;}finally{b.disabled=false;}
};
document.querySelector('#secure-logout').onclick=async()=>{
  try{await syncProgress(); if(JSON.parse(localStorage.getItem(pendingKey())||'[]').length)throw new Error('Conecte-se para sincronizar as aulas antes de sair.'); await api('/api/auth/logout',{}); await caches.delete(offlineCache);navigator.serviceWorker?.controller?.postMessage('clear');location.reload();}catch(err){alert(err.message);}
};
async function openAdmin(){
  const dlg=document.querySelector('#admin-dialog');
  if(!dlg.open)dlg.showModal();
  const list=document.querySelector('#student-list');list.replaceChildren();
  try{const users=await api('/api/admin/users');for(const u of users)list.append(h('article',{class:'student-row'},h('strong',{},u.full_name),h('span',{},u.email),h('small',{},u.role==='admin'?'Administrador':'Aluno')));}
  catch(err){list.textContent=err.message;}
}
document.querySelector('#close-admin').onclick=()=>document.querySelector('#admin-dialog').close();
document.querySelector('#student-form').onsubmit=async e=>{
  e.preventDefault();const f=e.currentTarget,status=f.querySelector('.form-status'),b=f.querySelector('button');b.disabled=true;
  try{await api('/api/admin/users',Object.fromEntries(new FormData(f)));f.reset();status.textContent='Conta criada. Envie ao aluno o e-mail e a senha que você definiu.';await openAdmin();}
  catch(err){status.textContent=err.message;}finally{b.disabled=false;}
};
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{
  const name=b.dataset.nav;
  document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('selected',x.dataset.nav===name));
  if(name==='home')window.scrollTo({top:0,behavior:'smooth'});
  if(name==='course')document.querySelector('.trail-main').scrollIntoView({behavior:'smooth'});
  if(name==='profile'||name==='account'){
    document.querySelector('#profile-btn').click();
    document.querySelector(name==='account'?'#dtab-auth':'#dtab-overview').click();
  }
  if(name==='admin')openAdmin();
});
enterStudy().catch(()=>{document.querySelector('#login-form .form-status').textContent='Não foi possível conectar. Verifique se o servidor está ligado e se você está na mesma rede.';});
