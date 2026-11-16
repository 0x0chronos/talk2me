async function api(path, data) {
  return StudyAPI.request(path,data);
}
function updateConnectionStatus() {
  const el = document.querySelector('#connection-status');
  if (!el) return;
  if (!navigator.onLine) {
    el.textContent = 'Modo offline';
    el.dataset.state = 'offline';
    return;
  }
  const host = location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]' ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  el.textContent = isLocal ? 'Estudo local' : 'Estudo sincronizado';
  el.dataset.state = 'online';
}
updateConnectionStatus();
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
async function enterStudy() {
  updateConnectionStatus();
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
  const userField = document.querySelector('#account-username');
  if (userField) userField.value = config.user.email || '';
  document.querySelector('#admin-nav').hidden = config.user.role !== 'admin';
  if(config.user.role === 'admin') {
    const b = h('button',{class:'abtn',onclick:openAdmin},'Gerenciar alunos e senhas');
    document.querySelector('.account-settings').prepend(b);
  }
}
document.querySelector('#login-form').onsubmit = async e => {
  e.preventDefault();
  const f=e.currentTarget, b=f.querySelector('button'), status=f.querySelector('.form-status');
  const origLabel = b.dataset.label || b.textContent;
  b.dataset.label = origLabel;
  b.disabled = true;
  b.classList.add('is-loading');
  b.textContent = 'Entrando…';
  status.textContent = 'Verificando seu acesso…';
  const slowTimer = setTimeout(() => {
    if (b.disabled) status.textContent = 'Conectando ao servidor e preparando suas aulas…';
  }, 1200);
  try {await api('/api/auth/login',Object.fromEntries(new FormData(f))); location.reload();}
  catch(err){status.textContent=err.message;}
  finally{clearTimeout(slowTimer); b.disabled=false; b.classList.remove('is-loading'); b.textContent=origLabel;}
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
function studentRow(user) {
  const row = h('article', {class:'student-row'}, h('strong',{},user.full_name),
    h('span',{},user.email), h('small',{},user.role === 'admin' ? 'Administrador' : 'Aluno'));
  if (user.role !== 'student') return row;
  const edit = h('button', {type:'button',class:'abtn','aria-expanded':'false'}, 'Trocar senha');
  const input = () => h('input',{type:'password',autocomplete:'new-password',required:true,minlength:10,maxlength:128});
  const password = input(), confirm = input();
  const status = h('p',{role:'status',class:'form-status'});
  const save = h('button',{type:'submit',class:'btn'},'Salvar nova senha');
  const form = h('form',{hidden:true},
    h('input',{type:'email',name:'username',autocomplete:'username',value:user.email,hidden:true}),
    h('label',{},'Nova senha para ' + user.full_name + ' (mínimo de 10 caracteres)',password),
    h('label',{},'Repita a nova senha',confirm),
    h('p',{},'O aluno precisará entrar novamente com a nova senha.'), save);
  edit.onclick = () => {
    form.hidden = !form.hidden;
    edit.setAttribute('aria-expanded', String(!form.hidden));
    edit.textContent = form.hidden ? 'Trocar senha' : 'Cancelar troca';
    form.reset();
    status.textContent = '';
    if (!form.hidden) password.focus();
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (password.value !== confirm.value) {
      status.textContent = 'As senhas precisam ser iguais.';
      confirm.focus();
      return;
    }
    save.disabled = edit.disabled = true;
    try {
      await api('/api/admin/student-password',{user_id:user.id,new_password:password.value});
      form.reset();
      form.hidden = true;
      edit.textContent = 'Trocar senha';
      edit.setAttribute('aria-expanded','false');
      status.textContent = 'Senha alterada. Informe a nova senha ao aluno.';
    } catch(error) { status.textContent = error.message; }
    finally { save.disabled = edit.disabled = false; if (form.hidden) edit.focus(); }
  };
  row.append(edit,form,status);
  return row;
}
async function openAdmin(){
  const dlg=document.querySelector('#admin-dialog');
  if(!dlg.open)dlg.showModal();
  const list=document.querySelector('#student-list');list.replaceChildren();
  try{const users=await api('/api/admin/users');for(const u of users)list.append(studentRow(u));}
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
