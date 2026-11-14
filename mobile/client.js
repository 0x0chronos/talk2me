'use strict';
const networkRequest = StudyAPI.request.bind(StudyAPI);
const MobileApp = {
  store:new MobileStorage(), downloads:new MobileDownloads(), user:null, course:null,
  items:new Map(), installPrompt:null, registration:null,
  async boot() {
    this.bindControls();
    await this.store.ready;
    const previous = await this.store.read('meta','identity');
    let user;
    try {
      const config = await this.network('/api/auth/config');
      $('#setup-note').hidden = config.configured;
      if (!config.authenticated) { this.showLogin(); return; }
      user = config.user;
    } catch (error) {
      if (!previous) throw new Error('Conecte-se à internet para entrar pela primeira vez neste celular.');
      user = previous;
    }
    await this.activate(user);
  },
  async network(path, data) {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),12000);
    try {
      const response = await fetch(path,{signal:controller.signal,cache:'no-store',credentials:'same-origin',
        ...(data === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
      const result = await response.json();
      if (!response.ok) { const error=new Error(result.error || 'Não foi possível concluir.'); error.status=response.status; throw error; }
      return result;
    } finally { clearTimeout(timer); }
  },
  async activate(user) {
    if (!user || typeof user.id !== 'string' || !/^[\w-]{1,120}$/.test(user.id)) throw new Error('Conta inválida.');
    this.user = {id:user.id,email:user.email,full_name:user.full_name};
    const previous = await this.store.read('meta','identity');
    if (previous && previous.id !== user.id) await this.downloads.clear(previous.id);
    await this.store.write('meta','identity',this.user);
    const key = 'course-' + user.id;
    try {
      this.course = await this.network('/api/course');
      await this.store.write('meta',key,this.course);
    } catch (error) {
      if ([401,403].includes(error.status)) { this.showLogin(); throw error; }
      this.course = await this.store.read('meta',key);
      if (!this.course) throw new Error('Conecte-se para preparar o catálogo deste celular.');
    }
    this.items = new Map(this.course.levels.flatMap(l=>l.modules.flatMap(m=>m.items.map(item=>[item.id,item]))));
    await this.refreshDownloads();
    await loadProfile();
    ThemeManager.apply(S.profile.theme_pref,false);
    await loadTree();
    $('#account-email').textContent = this.user.email;
    $('#admin-nav').hidden = true;
    document.body.classList.remove('locked');
    $('#login-screen').hidden = true;
    this.connection();
    await this.prepareShell();
  },
  showLogin() {
    this.user = null;
    document.body.classList.add('locked');
    $('#login-screen').hidden = false;
  },
  async request(path,data) {
    if (path.startsWith('/api/auth/')) return this.network(path,data);
    if (!this.user) throw new Error('Entre para continuar.');
    const ids = new Set(this.items.keys());
    if (path === '/api/profile' && data === undefined) {
      const profile = await this.store.change(this.user,state=>Talk2MeProgress.profile(state));
      if (profile.resume.es) profile.resume.es.title = this.items.get(profile.resume.es.lessonId)?.title || 'Aula em andamento';
      return profile;
    }
    if (path.startsWith('/api/tree')) {
      const state = await this.store.change(this.user,state=>state);
      const tree = structuredClone(this.course);
      for (const level of tree.levels) for (const module of level.modules) for (const item of module.items) {
        item.stars = state.progress[item.id]?.stars || 0;
        item.score = state.progress[item.id]?.score || 0;
      }
      return tree;
    }
    if (path.startsWith('/api/lesson/')) {
      const id = path.slice('/api/lesson/'.length);
      if (!ids.has(id)) throw new Error('Aula não encontrada nesta edição do curso.');
      if (!navigator.onLine && !S.downloaded.has(id)) throw new Error('Esta aula não foi baixada. Conecte-se para estudar online.');
      try { return await networkRequest(path); }
      catch (error) { throw new Error(error.status ? error.message : 'Conecte-se para abrir esta aula ou escolha uma aula já baixada.'); }
    }
    if (path === '/api/finish') return this.store.change(this.user,state=>Talk2MeProgress.finish(state,data,ids));
    if (path === '/api/resume') return this.store.change(this.user,state=>Talk2MeProgress.resume(state,data,ids));
    if (path === '/api/profile') return this.store.change(this.user,state=>Talk2MeProgress.preferences(state,data));
    throw new Error('Operação indisponível no app pessoal.');
  },
  async refreshDownloads() {
    const entries = 'caches' in window ? await this.downloads.list(this.user.id) : [];
    S.downloaded = new Set(entries.map(entry=>entry.id));
    return entries;
  },
  connection() {
    const label = document.querySelector('.connection-label');
    if (label) label.textContent = navigator.onLine ? 'Online · download opcional' : 'Offline · aulas baixadas';
  },
  async prepareShell() {
    if (!isSecureContext || !('serviceWorker' in navigator)) {
      this.status('Para instalar e baixar aulas, abra o app por HTTPS.'); return;
    }
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const updating = () => {
        if (this.registration.waiting) $('#mobile-update').hidden = false;
      };
      updating();
      this.registration.addEventListener('updatefound',()=>{
        const worker = this.registration.installing;
        worker?.addEventListener('statechange',updating);
      });
    } catch { this.status('A instalação offline não terminou. Mantenha a conexão e reabra o app para tentar novamente.'); }
  },
  status(text) { $('#mobile-status').textContent = text; },
  async exportBackup(state) {
    state ||= await this.store.change(this.user,state=>state);
    const data = Talk2MeProgress.backup(state);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link = h('a',{href:url,download:'talk2me-progresso-'+Talk2MeProgress.today()+'.json'});
    document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    this.status('Backup preparado. Guarde o arquivo em Arquivos, Drive ou outro lugar seguro.');
  },
  async importBackup(file) {
    if (!file) return;
    if (file.size > 5*1024*1024) throw new Error('O backup deve ter até 5 MB.');
    const owner = this.user;
    const restored = Talk2MeProgress.restore(await file.text(),owner,new Set(this.items.keys()));
    const before = await this.store.change(owner,state=>state);
    const dlg = h('dialog',{id:'restore-confirm'},h('h2',{},'Restaurar seu progresso'),
      h('p',{},`O backup tem ${Object.keys(restored.progress).length} atividades e ${restored.xp} XP.`),
      h('p',{},`Vai substituir o progresso desta conta neste celular: ${Object.keys(before.progress).length} atividades e ${before.xp} XP. Seus downloads e a outra conta não serão alterados.`),
      h('button',{class:'abtn',onclick:()=>this.exportBackup(before).catch(e=>this.status(e.message))},'Salvar backup atual primeiro'),
      h('button',{class:'btn',id:'restore-confirm-button',onclick:async event=>{
        event.currentTarget.disabled=true;
        try {
          if (this.user?.id !== owner.id) throw new Error('A conta mudou. Abra o backup novamente.');
          await this.store.write('profiles',owner.id,restored);
          await loadProfile(); ThemeManager.apply(S.profile.theme_pref,false); await loadTree();
          this.status('Progresso restaurado neste celular.'); dlg.close(); dlg.remove();
        } catch (error) { this.status(error.message); event.currentTarget.disabled=false; }
      }},'Substituir pelo backup'),
      h('button',{class:'abtn',onclick:()=>{dlg.close();dlg.remove();}},'Cancelar'));
    document.body.append(dlg); dlg.showModal();
  },
  async showDownloads() {
    const entries = await this.refreshDownloads();
    const list = h('div',{class:'mobile-download-list'});
    const total = entries.reduce((sum,entry)=>sum+entry.bytes,0);
    if (!entries.length) list.append(h('p',{},'Nenhuma aula baixada. Você pode estudar online normalmente.'));
    for (const entry of entries) {
      const row = h('article',{},h('strong',{},entry.title),h('span',{},StudyAPI.formatBytes(entry.bytes)));
      row.append(h('button',{class:'abtn',onclick:async event=>{
        event.currentTarget.disabled=true;
        try { await this.downloads.remove(this.user.id,entry.id); await this.refreshDownloads(); row.remove(); renderHome(); }
        catch (error) { this.status(error.message); event.currentTarget.disabled=false; }
      }},'Remover download'));
      list.append(row);
    }
    const dlg = h('dialog',{id:'downloads-dialog'},h('h2',{},'Aulas neste celular'),
      h('p',{},`${entries.length} aulas · ${StudyAPI.formatBytes(total)}. Remover downloads mantém seu progresso.`),list,
      h('button',{class:'abtn',onclick:()=>{dlg.close();dlg.remove();}},'Fechar'));
    document.body.append(dlg); dlg.showModal();
  },
  async logout() {
    const uid = this.user?.id;
    if (!confirm('Sair remove as aulas baixadas e o acesso offline deste celular. Seu progresso será mantido; faça um backup para guardá-lo fora do aparelho.')) return;
    try { await this.network('/api/auth/logout',{}); }
    catch { throw new Error('Conecte-se para sair da conta com segurança.'); }
    if (uid) await this.downloads.clear(uid);
    await this.store.write('meta','identity',undefined);
    this.channel?.postMessage('logout');
    location.reload();
  },
  bindControls() {
    const input = h('input',{type:'file',accept:'.json,application/json',id:'backup-file',hidden:true});
    input.onchange = async()=>{
      try { await this.importBackup(input.files[0]); }
      catch (error) { this.status(error.message); }
      finally { input.value=''; }
    };
    const tools = h('section',{class:'mobile-tools'},h('h3',{},'Seu estudo neste celular'),
      h('p',{},'O progresso fica neste aparelho. Exporte um backup antes de trocar de celular ou limpar os dados do app.'),
      h('div',{class:'mobile-tool-actions'},
        h('button',{class:'btn',id:'backup-export',onclick:()=>this.exportBackup().catch(e=>this.status(e.message))},'Exportar progresso'),
        h('button',{class:'abtn',id:'backup-import',onclick:()=>input.click()},'Restaurar backup'),
        h('button',{class:'abtn',id:'manage-downloads',onclick:()=>this.showDownloads().catch(e=>this.status(e.message))},'Gerenciar downloads'),
        h('button',{class:'abtn',id:'install-app',onclick:()=>this.install()},'Instalar no celular'),
        h('button',{class:'abtn',id:'mobile-update',hidden:true,onclick:()=>this.registration?.waiting?.postMessage('ACTIVATE_UPDATE')},'Atualizar aplicativo')),
      input,h('p',{id:'mobile-status',role:'status','aria-live':'polite'},'Estude online ou baixe apenas as aulas que quiser.'));
    document.querySelector('.account-settings').prepend(tools);
    document.querySelectorAll('[data-nav]').forEach(button=>button.onclick=()=>{
      const name=button.dataset.nav;
      document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('selected',b.dataset.nav===name));
      if(name === 'home') window.scrollTo({top:0,behavior:'smooth'});
      if(name === 'course') document.querySelector('.trail-main').scrollIntoView({behavior:'smooth'});
      if(name === 'profile' || name === 'account') {
        $('#profile-btn').click(); $(name === 'account' ? '#dtab-auth' : '#dtab-overview').click();
      }
    });
    $('#login-form').onsubmit=async event=>{
      event.preventDefault(); const form=event.currentTarget,button=form.querySelector('button'),status=form.querySelector('.form-status');
      button.disabled=true; status.textContent='Entrando…';
      try { const result=await this.network('/api/auth/login',Object.fromEntries(new FormData(form))); await this.activate(result.user); status.textContent=''; form.reset(); }
      catch(error) { status.textContent=error.message || 'Confira sua conexão.'; }
      finally { button.disabled=false; }
    };
    $('#password-form').onsubmit=async event=>{
      event.preventDefault(); const form=event.currentTarget,data=Object.fromEntries(new FormData(form)),status=form.querySelector('.form-status'),button=form.querySelector('button');
      if(data.new_password!==data.confirm){status.textContent='As novas senhas precisam ser iguais.';return;}
      button.disabled=true;
      try{await this.network('/api/auth/password',data);form.reset();status.textContent='Senha alterada. Outros acessos online desta conta foram encerrados.';}
      catch(error){status.textContent=error.message || 'Conecte-se para alterar sua senha.';}
      finally{button.disabled=false;}
    };
    $('#secure-logout').onclick=()=>this.logout().catch(e=>this.status(e.message));
    addEventListener('online',()=>this.connection()); addEventListener('offline',()=>this.connection());
    addEventListener('beforeinstallprompt',event=>{event.preventDefault();this.installPrompt=event;});
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('talk2me-personal-session');
      this.channel.onmessage = event=>{if(event.data === 'logout') location.reload();};
    }
    if ('serviceWorker' in navigator) {
      let controlled = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        if(controlled) location.reload(); else controlled=true;
      });
    }
  },
  async install() {
    if (this.installPrompt) {
      await this.installPrompt.prompt(); this.installPrompt=null; return;
    }
    const dlg=h('dialog',{},h('h2',{},'Instalar o talk2me'),
      h('p',{},'Android: no menu do Chrome, escolha Instalar aplicativo ou Adicionar à tela inicial.'),
      h('p',{},'iPhone: abra este endereço no Safari, toque em Compartilhar e em Adicionar à Tela de Início.'),
      h('p',{},'Depois, abra pelo ícone. Estude online ou baixe aulas para usar sem internet. O sistema pode remover downloads por falta de espaço; guarde backups do progresso.'),
      h('button',{class:'abtn',onclick:()=>{dlg.close();dlg.remove();}},'Entendi'));
    document.body.append(dlg);dlg.showModal();
  }
};
StudyAPI.mode='mobile';
StudyAPI.savedMessage='Progresso salvo neste celular';
StudyAPI.request=MobileApp.request.bind(MobileApp);
async function finishLesson(data) {
  data.event_id ||= StudyAPI.eventId();
  return StudyAPI.request('/api/finish',data);
}
async function downloadLesson(lesson,button) {
  const note=button.parentElement.querySelector('.offline-note');
  const name=MobileApp.downloads.name(MobileApp.user.id,lesson.id);
  if (MobileApp.downloads.active.has(name)) {
    MobileApp.downloads.active.get(name).controller.abort(); return;
  }
  if (!isSecureContext || !('caches' in window) || !navigator.serviceWorker?.controller) {
    note.textContent='Aguarde a preparação offline e reabra o app por HTTPS para baixar aulas.';return;
  }
  if (S.downloaded.has(lesson.id)) {
    button.disabled=true;
    try { await MobileApp.downloads.remove(MobileApp.user.id,lesson.id); await MobileApp.refreshDownloads(); button.textContent='Baixar aula para estudar sem conexão';note.textContent='Download removido. Seu progresso foi mantido. Você pode estudar online.';renderHome(); }
    catch(error){note.textContent=error.message;}
    finally{button.disabled=false;}
    return;
  }
  try {
    await navigator.storage?.persist?.();
    button.textContent='Cancelar download';
    await MobileApp.downloads.download(MobileApp.user,lesson,(received,total)=>{
      note.textContent=`Baixando ${StudyAPI.formatBytes(received)} de ${StudyAPI.formatBytes(total)}. Toque no botão para cancelar.`;
    });
    await MobileApp.refreshDownloads(); renderHome();
    button.textContent='Remover download desta aula';
    note.textContent='Aula disponível sem internet. Seu progresso fica neste celular.';
  } catch(error) {button.textContent='Tentar baixar novamente';note.textContent=error.message || 'Não foi possível baixar. Confira sua conexão.';}
}
MobileApp.boot().catch(error=>{
  $('#login-form .form-status').textContent=error.message;
});
