const $ = (s, r = document) => r.querySelector(s);

function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
}

const shuffle = a => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.random() * (i + 1) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ------------------------------------------------ Identidade por Curso */
const COURSE_WORLDS = {
  es: {
    code: 'ES',
    edition: 'Vamos falar espanhol.',
    speechHint: 'Ouça o modelo, toque no microfone e fale em espanhol.',
    crest: `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="60" cy="60" r="54"/><circle cx="60" cy="60" r="46"/><rect x="26" y="26" width="68" height="68"/><rect x="26" y="26" width="68" height="68" transform="rotate(45 60 60)"/><circle cx="60" cy="60" r="16"/></svg>`
  },
  en: {
    code: 'EN',
    edition: 'Inglês — Caderno Atlântico',
    speechHint: 'Ouça o modelo, toque no microfone e fale em inglês.',
    crest: `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="60" cy="60" r="54"/><circle cx="60" cy="60" r="38"/><line x1="60" y1="6" x2="60" y2="114"/><line x1="6" y1="60" x2="114" y2="60"/><line x1="22" y1="22" x2="98" y2="98"/><line x1="98" y1="22" x2="22" y2="98"/><polygon points="60,18 68,52 102,60 68,68 60,102 52,68 18,60 52,52"/></svg>`
  },
  ko: {
    code: 'KO',
    edition: 'Coreano — Caderno Seul',
    speechHint: 'Ouça o modelo, toque no microfone e fale em coreano.',
    crest: `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="60" cy="60" r="54"/><rect x="24" y="24" width="72" height="72"/><line x1="48" y1="24" x2="48" y2="96"/><line x1="72" y1="24" x2="72" y2="96"/><line x1="24" y1="48" x2="96" y2="48"/><line x1="24" y1="72" x2="96" y2="72"/><rect x="38" y="38" width="44" height="44"/></svg>`
  }
};

const SR_LANG = { es: 'es-ES', en: 'en-US', ko: 'ko-KR' };

const FLAGS = {
  es: `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/><rect x="6.5" y="7.2" width="2.6" height="5.6" rx="1" fill="#AA151B"/></svg>`,
  en: `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="#012169"/><path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" stroke-width="3.6"/><path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" stroke-width="1.8"/><path d="M15,0 V20 M0,10 H30" stroke="#fff" stroke-width="6"/><path d="M15,0 V20 M0,10 H30" stroke="#C8102E" stroke-width="3.4"/></svg>`,
  ko: `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="4.6" fill="#CD2E3A"/><path d="M10.4,10 A4.6,4.6 0 0,0 19.6,10 A2.3,2.3 0 0,1 15,10 A2.3,2.3 0 0,0 10.4,10Z" fill="#0047A0"/><g stroke="#111" stroke-width="1.1"><path d="M6.5,4.2 L8.8,6.8 M7.7,3.2 L10,5.8"/><path d="M21.2,13.2 L23.5,15.8 M20,14.2 L22.3,16.8"/><path d="M21.2,6.8 L23.5,4.2 M20,5.8 L22.3,3.2"/><path d="M6.5,15.8 L8.8,13.2 M7.7,16.8 L10,14.2"/></g></svg>`
};

function flagEl(code) {
  return h('span', { class: 'flag', html: FLAGS[code] || '' });
}

/* ------------------------------------------------ Sistema de Ícones SVG (1.75px) */
const ICONS = {
  flame: `<path d="M12 2.5c2.2 3.1 5 5.6 5 9.6a5 5 0 0 1-10 0c0-1.9.8-3.6 2-5 .2 1.5 1.1 2.4 2 2.7-.3-2.5.3-5 1-7.3Z"/>`,
  spark: `<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2L12 3Z"/>`,
  stamp: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12l3 3 7-6"/>`,
  arrowRight: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  arrowLeft: `<path d="M19 12H5M11 18l-6-6 6-6"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  search: `<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>`,
  volume: `<path d="M11 5L6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/>`,
  slow: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  play: `<polygon points="7,5 19,12 7,19" fill="currentColor" stroke="none"/>`,
  mic: `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  checkpoint: `<path d="M5 4v17M5 5h12l-2.5 4L17 13H5"/>`,
  doc: `<path d="M7 3h7l5 5v13H7V3Z"/><path d="M14 3v5h5M10 13h6M10 17h4"/>`,
  refresh: `<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>`,
  chevronDown: `<path d="M6 9l6 6 6-6"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>`,
  moon: `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>`,
  map: `<circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="12" r="3"/><path d="M8.5 16.5l2-3M13.5 10.5l3-3"/>`,
  ledger: `<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="8" y1="4" x2="8" y2="20"/><line x1="12" y1="9" x2="18" y2="9"/><line x1="12" y1="14" x2="18" y2="14"/>`
};

function icon(name, cls = '') {
  return h('span', {
    class: 'ico' + (cls ? ' ' + cls : ''),
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`
  });
}

function starSvg(filled, lg = false) {
  const sz = lg ? 22 : 13;
  return h('span', {
    class: filled ? 'on' : 'off',
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="12,3 14.8,8.7 21,9.6 16.5,14 17.6,20.2 12,17.2 6.4,20.2 7.5,14 3,9.6 9.2,8.7"/></svg>`
  });
}

function starsRow(count, lg = false) {
  return h('span', { class: lg ? 'stars-lg' : 'stars', 'aria-label': `${count} de 3 estrelas` },
    [1, 2, 3].map(n => starSvg(n <= count, lg)));
}

function eqBars() {
  return h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'));
}

/* ------------------------------------------------ Modo Claro / Escuro (Theme) */
const ThemeManager = {
  getPreference() {
    return localStorage.talk2me_theme || (S.profile && S.profile.theme_pref) || 'light';
  },

  getResolvedTheme(pref) {
    if (pref === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return pref === 'dark' ? 'dark' : 'light';
  },

  apply(themePref, save = true) {
    const resolved = this.getResolvedTheme(themePref);
    document.documentElement.setAttribute('data-theme', resolved);
    if (save) {
      localStorage.talk2me_theme = themePref;
      if (S.profile) S.profile.theme_pref = themePref;
      StudyAPI.request('/api/profile', {theme_pref:themePref}).catch(error => {
        if (StudyAPI.mode === 'mobile') alert(error.message);
      });
    }

    // Atualiza ícone do botão no topo
    const toggleBtn = $('#theme-toggle');
    if (toggleBtn) {
      toggleBtn.innerHTML = '';
      toggleBtn.append(icon(resolved === 'dark' ? 'sun' : 'moon', 'lg'));
      toggleBtn.title = resolved === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro';
    }

    // Atualiza botões no drawer de perfil
    document.querySelectorAll('.theme-choice-btn').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.themeVal === themePref);
    });
  },

  init() {
    const pref = this.getPreference();
    this.apply(pref, false);
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.getPreference() === 'system') this.apply('system', false);
      });
    }

    const toggleBtn = $('#theme-toggle');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        const curResolved = document.documentElement.getAttribute('data-theme') || 'light';
        const next = curResolved === 'dark' ? 'light' : 'dark';
        this.apply(next, true);
      };
    }
  }
};

/* ------------------------------------------------ Pré-carga de mídia (celular) */
function lightMedia() {
  const c = navigator.connection;
  return !!(c && (c.saveData || /(^|-)2g$|3g/.test(c.effectiveType || '')));
}
const warmed = new Set();
function warmAudio(src) {
  if (!src || typeof src !== 'string' || !src.startsWith('/m/') || warmed.has(src) || lightMedia()) return;
  warmed.add(src);
  if (warmed.size > 60) warmed.delete(warmed.values().next().value);
  // Preenche o cache HTTP (max-age do servidor) antes do toque, sem reter conexões.
  fetch(src, { priority: 'low' }).then(r => r.blob()).catch(() => warmed.delete(src));
}
function exerciseAudios(ex) {
  if (!ex) return [];
  return [
    ex.audio,
    ...(ex.options || []).map(o => o.audio),
    ...(ex.pairs || []).flatMap(p => [p.left, p.right])
  ].filter(s => typeof s === 'string' && /\.(mp3|wav|ogg)(\?|$)/i.test(s));
}
function warmAhead(queue, from, count = 2) {
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 200));
  idle(() => {
    for (const st of queue.slice(from, from + 1 + count)) {
      if (st.t === 'e') exerciseAudios(st.e).forEach(warmAudio);
    }
  });
}

/* ------------------------------------------------ Áudio & Motor de Reprodução */
let activeAudio = null;
let dlgSeqToken = 0;

function stopAudio() {
  dlgSeqToken++;
  document.querySelectorAll('.playing').forEach(b => b.classList.remove('playing'));
  document.querySelectorAll('.bub.active').forEach(b => b.classList.remove('active'));

  if (activeAudio) {
    const a = activeAudio;
    activeAudio = null;
    a.onended = a.onerror = null;
    a.pause();
    a.removeAttribute('src');
    a.load();
  }
}

function playAudio(src, btn, rate = 1.0) {
  stopAudio();
  if (!src) return Promise.resolve();

  const a = new Audio(src);
  activeAudio = a;
  a.playbackRate = rate;

  if (btn) btn.classList.add('playing');

  const cleanup = () => {
    if (btn) btn.classList.remove('playing');
    if (activeAudio === a) activeAudio = null;
  };

  a.onended = cleanup;
  a.onerror = (e) => {
    if (activeAudio !== a) return;
    console.warn('Falha no áudio:', src, e);
    mediaFailure(btn, () => playAudio(src, btn, rate));
    cleanup();
  };

  return a.play().catch(err => {
    if (activeAudio !== a) return;
    if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
      mediaFailure(btn, () => playAudio(src, btn, rate));
    }
    // Captura bloqueio de autoplay sem quebrar o fluxo da aula
    cleanup();
  });
}

window.playAudio = playAudio;
window.stopAudio = stopAudio;
window.getActiveAudio = () => activeAudio;

function audioBtn(src, label, cls, rate = 1.0) {
  const isBig = (cls || '').includes('big');
  const b = h('button', {
    class: 'abtn ' + (cls || ''),
    type: 'button',
    title: rate < 1 ? 'Ouvir em velocidade reduzida (0.75x)' : 'Ouvir pronúncia'
  },
    icon(rate < 1 ? 'slow' : 'volume', isBig ? 'xl' : ''),
    eqBars(),
    label ? h('span', {}, label) : null
  );
  b.onclick = e => {
    e.stopPropagation();
    playAudio(src, b, rate);
  };
  return b;
}

function audioPair(src, mainLabel = 'Ouvir', big = false) {
  const row = h('div', { class: 'audio-row' });
  const mainBtn = audioBtn(src, big ? '' : mainLabel, big ? 'big' : '');
  mainBtn.dataset.primaryAudio = '1';
  row.append(mainBtn, audioBtn(src, '0.75x devagar', 'slow', 0.75));
  return row;
}

/* ------------------------------------------------ Estado & Trilha Principal */
const S = {
  lang: 'es',
  level: localStorage.talk2me_level || localStorage.talk2me_level || null,
  view: 'ledger', // Caderno Consular com todos os módulos e lições sempre como padrão primário
  allModsExpanded: null,
  q: '',
  openMods: new Map(),
  data: null,
  profile: { xp: 0, streak: 1, daily_goal_xp: 50, full_name: 'Rony Novais', resume: {}, activity: [] }
};

function applyCourseTheme(lang) {
  document.documentElement.setAttribute('data-course', lang);
  const world = COURSE_WORLDS[lang] || COURSE_WORLDS.es;
  const crest = $('#banner-crest');
  if (crest) crest.innerHTML = world.crest;
}

async function loadProfile() {
  try {
    const p = await StudyAPI.request('/api/profile');
    S.profile = p;
    renderStats();
    updateProfileUI();
  } catch (e) { if (StudyAPI.mode === 'mobile') throw e; }
}

function renderStats() {
  const xpEl = $('#xp');
  const stEl = $('#streak');
  if (stEl) {
    stEl.innerHTML = '';
    stEl.append(icon('flame', 'sm'), h('span', {}, `${S.profile.streak || 0}d`));
  }
  if (xpEl) {
    xpEl.innerHTML = '';
    xpEl.append(icon('spark', 'sm'), h('span', {}, `${S.profile.xp || 0} XP`));
  }
}

async function loadTree() {
  S.data = await StudyAPI.request('/api/tree?lang=' + S.lang);
  S.lang = S.data.lang;
  applyCourseTheme(S.lang);
  const lv = S.data.levels;
  if (!lv.find(l => l.level === S.level)) S.level = lv.length ? lv[0].level : null;
  renderHome();
}

function renderHome() {
  const d = S.data;
  const world = COURSE_WORLDS[S.lang] || COURSE_WORLDS.es;
  applyCourseTheme(S.lang);

  const langs = $('#langs');
  langs.innerHTML = '';
  for (const [k, v] of Object.entries(d.langs)) {
    const w = COURSE_WORLDS[k] || { code: k.toUpperCase() };
    langs.append(h('button', {
      type: 'button',
      class: k === S.lang ? 'on' : '',
      onclick: () => {
        S.lang = k;
        localStorage.talk2me_lang = k;
        localStorage.talk2me_lang = k;
        S.level = null;
        S.allModsExpanded = true;
        S.openMods.clear();
        S.q = '';
        $('#search').value = '';
        loadTree();
      }
    }, flagEl(k), h('span', {}, v.name), h('span', { class: 'lang-code' }, w.code)));
  }

  const all = d.levels.flatMap(l => l.modules.flatMap(m => m.items));
  const done = all.filter(i => i.stars > 0).length;

  const visEl = $('#visas-stat');
  if (visEl) {
    visEl.innerHTML = '';
    visEl.append(icon('stamp', 'sm'), h('span', {}, `${done}/${all.length}`));
  }

  $('#hero-t').textContent = world.edition;
  const lvlSummary = d.levels.length > 1
    ? `${d.levels.length} níveis CEFR (${d.levels[0].level} ao ${d.levels[d.levels.length - 1].level})`
    : (d.levels.length === 1 ? `Nível ${d.levels[0].level} completo` : 'Currículo local');
  $('#hero-p').textContent = `${done} de ${all.length} atividades validadas • ${lvlSummary} com vídeo-aulas e áudio.`;

  // ---------------- Lógica de Continuidade (Resume / Onde parou para continuar depois)
  const resumeInfo = S.profile && S.profile.resume && S.profile.resume[S.lang];
  const resumeBadge = $('#resume-badge');
  const resumeBtn = $('#resume');
  const resumeLabel = $('#resume-label');
  const restartBtn = $('#restart-lesson-btn');

  const curLv = d.levels.find(l => l.level === S.level) || d.levels[0];
  let nextInfo = null;
  if (curLv) {
    for (let mi = 0; mi < curLv.modules.length; mi++) {
      const m = curLv.modules[mi];
      const idx = m.items.findIndex(it => !it.stars);
      if (idx >= 0) {
        nextInfo = { item: m.items[idx], seq: idx + 1, level: curLv.level, modNum: mi + 1 };
        break;
      }
    }
  }
  if (!nextInfo) {
    outer: for (const lv of d.levels) {
      for (let mi = 0; mi < lv.modules.length; mi++) {
        const idx = lv.modules[mi].items.findIndex(it => !it.stars);
        if (idx >= 0) {
          nextInfo = { item: lv.modules[mi].items[idx], seq: idx + 1, level: lv.level, modNum: mi + 1 };
          break outer;
        }
      }
    }
  }

  if (resumeInfo && !S.data.levels.some(l => l.modules.some(m => m.items.some(it => it.id === resumeInfo.lessonId && it.stars > 0))) && resumeInfo.stepIndex > 0) {
    // Aula em andamento salva
    if (resumeBadge) resumeBadge.hidden = false;
    $('#next-title').textContent = resumeInfo.title || 'Aula em andamento';
    const stepLabel = String(resumeInfo.stepIndex + 1).padStart(2, '0');
    $('#next-sub').textContent = `Nível ${resumeInfo.level || S.level} · Retomar no passo ${stepLabel}`;
    if (resumeLabel) resumeLabel.textContent = `Continuar do passo ${stepLabel}`;
    if (restartBtn) {
      restartBtn.hidden = false;
      restartBtn.onclick = () => openItem(resumeInfo.lessonId, 0);
    }
    resumeBtn.onclick = () => openItem(resumeInfo.lessonId, resumeInfo.stepIndex);
  } else {
    // Sequência natural
    if (resumeBadge) resumeBadge.hidden = true;
    if (restartBtn) restartBtn.hidden = true;
    if (resumeLabel) resumeLabel.textContent = 'Retomar aula';

    if (nextInfo) {
      $('#next-title').textContent = `${String(nextInfo.seq).padStart(2, '0')} · ${nextInfo.item.title}`;
      $('#next-sub').textContent = `Nível ${nextInfo.level} · Módulo ${nextInfo.modNum} em aberto`;
      resumeBtn.onclick = () => openItem(nextInfo.item.id, 0);
    } else if (curLv && curLv.modules[0] && curLv.modules[0].items[0]) {
      $('#next-title').textContent = curLv.modules[0].items[0].title;
      $('#next-sub').textContent = 'Todos os vistos deste curso foram concluídos';
      resumeBtn.onclick = () => openItem(curLv.modules[0].items[0].id, 0);
    }
  }

  // Abas de Níveis CEFR
  const tabs = $('#tabs');
  tabs.innerHTML = '';
  for (const l of d.levels) {
    const items = l.modules.flatMap(m => m.items);
    const lDone = items.filter(i => i.stars > 0).length;
    tabs.append(h('button', {
      type: 'button',
      class: 'lvl-btn' + (l.level === S.level ? ' on' : ''),
      title: `Nível ${l.level} · ${l.modules.length} módulos, ${items.length} lições`,
      onclick: () => {
        S.level = l.level;
        localStorage.talk2me_level = l.level;
        localStorage.talk2me_level = l.level;
        S.allModsExpanded = true;
        S.openMods.clear();
        renderHome();
      }
    }, h('strong', {}, l.level), h('small', {}, `${lDone}/${items.length}`)));
  }

  // Renderiza a visão ativa (Caderno ou Mapa de Progressão)
  updateViewSwitcher();
  updateToggleModsBtn();
  if (S.view === 'map') {
    $('#mods').hidden = true;
    $('#map-view').hidden = false;
    renderMapView();
  } else {
    $('#mods').hidden = false;
    $('#map-view').hidden = true;
    renderLedgerView();
  }
}

/* ------------------------------------------------ Visualização 1: Caderno Consular */
function renderLedgerView() {
  const d = S.data;
  const box = $('#mods');
  box.innerHTML = '';
  const lv = d.levels.find(l => l.level === S.level);
  if (!lv) {
    box.append(h('div', { class: 'empty' }, 'Nenhum módulo cadastrado para este nível.'));
    return;
  }

  const resumeInfo = S.profile && S.profile.resume && S.profile.resume[S.lang];
  const firstTodoId = (lv.modules.flatMap(m => m.items).find(i => !i.stars) || {}).id;
  let activeModIdx = lv.modules.findIndex(m => m.items.some(it => it.id === firstTodoId));
  if (activeModIdx < 0) activeModIdx = 0;
  const q = S.q.trim().toLowerCase();
  let shown = 0;

  lv.modules.forEach((m, i) => {
    if (q) {
      const hay = [m.title, m.subtitle, ...m.items.map(x => x.title)].join(' ').toLowerCase();
      if (!hay.includes(q)) return;
    }
    shown++;
    const dn = m.items.filter(x => x.stars > 0).length;
    const isAllDone = m.items.length > 0 && dn === m.items.length;
    const modPrefix = String(i + 1).padStart(2, '0');
    const modKey = `${S.lang}:${lv.level}:${i}`;
    const defaultOpen = S.allModsExpanded === null ? i === activeModIdx : S.allModsExpanded;
    const isOpen = q ? true : (S.openMods.has(modKey) ? S.openMods.get(modKey) : defaultOpen);
    const panelId = `mod-panel-${i}`;

    const stampsEl = h('div', { class: 'stamps', id: panelId, hidden: !isOpen }, m.items.map((it, n) => {
      const isCp = it.kind === 'checkpoint';
      const isDone = it.stars > 0;
      const isResume = !it.stars && resumeInfo && resumeInfo.lessonId === it.id && resumeInfo.stepIndex > 0;
      const isNext = !isDone && it.id === firstTodoId;
      const num = String(n + 1).padStart(2, '0');

      let badgeLabel = 'Disponível';
      let badgeIcon = null;
      if (isResume) {
        badgeLabel = `Em andamento · Passo ${resumeInfo.stepIndex + 1}`;
        badgeIcon = icon('arrowRight', 'sm');
      } else if (isCp && isDone) {
        badgeLabel = 'Aprovado';
        badgeIcon = icon('checkpoint', 'sm');
      } else if (isCp && isNext) {
        badgeLabel = 'Checkpoint · Agora';
        badgeIcon = icon('arrowRight', 'sm');
      } else if (isCp) {
        badgeLabel = 'Checkpoint';
        badgeIcon = icon('checkpoint', 'sm');
      } else if (isDone) {
        badgeLabel = 'Visto';
        badgeIcon = icon('check', 'sm');
      } else if (isNext) {
        badgeLabel = 'Em aberto';
        badgeIcon = icon('arrowRight', 'sm');
      }

      return h('button', {
        type: 'button',
        class: 'cell' + (isCp ? ' cp' : '') + (isDone ? ' done' : (isResume || isNext ? ' active' : ' todo')),
        onclick: (e) => {
          const btn = e.currentTarget;
          if (btn) btn.classList.add('loading-cell');
          openItem(it.id, isResume ? resumeInfo.stepIndex : 0).finally(() => {
            if (btn) btn.classList.remove('loading-cell');
          });
        }
      },
        h('h3', {}, `${num} · ${it.title}`),
        S.downloaded?.has(it.id) ? h('small', {class:'downloaded-label'}, '↓ Disponível sem conexão') : null,
        h('div', { class: 'cell-foot' },
          h('span', { class: 'stamp' }, badgeIcon, h('span', {}, badgeLabel), isDone ? starsRow(it.stars) : null)
        )
      );
    }));

    const headBtn = h('button', {
      type: 'button',
      class: 'mod-head',
      'aria-expanded': String(isOpen),
      'aria-controls': panelId
    },
      h('div', { class: 'mod-title-group' },
        h('h2', {}, `${modPrefix} · ${m.title}`),
        m.subtitle ? h('p', {}, m.subtitle) : null
      ),
      h('span', { class: 'mod-meta' },
        h('span', { class: 'mod-stat' }, `${dn} / ${m.items.length} · ${lv.level}`),
        h('span', { class: 'mod-chev', 'aria-hidden': 'true' }, icon('chevronDown', 'sm'))
      )
    );

    const sec = h('section', {
      class: 'mod' + (!isOpen ? ' collapsed' : '') + (isAllDone ? ' done-all' : '')
    },
      headBtn,
      h('div', { class: 'mod-rule' + (dn === 0 ? ' zero' : '') },
        h('i', { style: `width:${(dn / Math.max(m.items.length, 1)) * 100}%` })
      ),
      stampsEl
    );

    headBtn.onclick = () => {
      const curOpen = headBtn.getAttribute('aria-expanded') === 'true';
      const nextOpen = !curOpen;
      S.openMods.set(modKey, nextOpen);
      headBtn.setAttribute('aria-expanded', String(nextOpen));
      sec.classList.toggle('collapsed', !nextOpen);
      stampsEl.hidden = !nextOpen;
    };

    box.append(sec);
  });

  if (!shown) {
    const otherHits = d.levels
      .filter(l => l.level !== S.level)
      .map(l => ({
        level: l.level,
        count: l.modules.filter(m => [m.title, m.subtitle, ...m.items.map(x => x.title)].join(' ').toLowerCase().includes(q)).length
      }))
      .filter(x => x.count > 0);

    const actions = h('div', { class: 'empty-actions' },
      h('button', {
        type: 'button',
        class: 'btn outline',
        onclick: () => { S.q = ''; $('#search').value = ''; renderHome(); $('#search').focus(); }
      }, 'Limpar filtro'),
      otherHits.map(hit => h('button', {
        type: 'button',
        class: 'btn',
        onclick: () => { S.level = hit.level; localStorage.talk2me_level = hit.level; renderHome(); }
      }, `Ver ${hit.count} no nível ${hit.level}`))
    );

    box.append(h('div', { class: 'empty' },
      h('strong', {}, `Nenhum módulo encontrado em ${lv.level} para “${S.q}”`),
      h('div', {}, otherHits.length
        ? 'Há módulos correspondentes em outros níveis deste curso:'
        : 'Tente buscar por outro tema gramatical, saudação ou limpe o filtro atual.'),
      actions
    ));
  }
}

/* ------------------------------------------------ Visualização 2: Mapa de Progressão (Serpentino) */
function renderMapView() {
  const d = S.data;
  const track = $('#map-track');
  track.innerHTML = '';
  const lv = d.levels.find(l => l.level === S.level);
  if (!lv) return;

  const allItems = lv.modules.flatMap(m => m.items);
  const totalDone = allItems.filter(i => i.stars > 0).length;
  const resumeInfo = S.profile && S.profile.resume && S.profile.resume[S.lang];
  const firstTodoId = (allItems.find(i => !i.stars) || {}).id;

  $('#map-heading').textContent = `Trilha Cartográfica · Nível ${lv.level}`;
  $('#map-subheading').textContent = `Passaporte de navegação contínua — ${totalDone} de ${allItems.length} atividades carimbadas.`;

  const summary = $('#map-stats-summary');
  if (summary) {
    summary.innerHTML = '';
    summary.append(icon('stamp', 'sm'), h('span', {}, `${totalDone} / ${allItems.length} Vistos`));
  }

  lv.modules.forEach((m, mIdx) => {
    const modDone = m.items.filter(i => i.stars > 0).length;
    const pct = Math.round((modDone / Math.max(m.items.length, 1)) * 100);

    const island = h('div', { class: 'map-island-card' },
      h('div', { class: 'map-island-banner' },
        h('div', { class: 'map-island-title-group' },
          h('span', { class: 'map-island-tag' }, String(mIdx + 1)),
          h('div', {},
            h('h3', { class: 'map-island-title' }, `${String(mIdx + 1).padStart(2, '0')} · ${m.title}`),
            m.subtitle ? h('p', { class: 'map-island-desc' }, m.subtitle) : null
          )
        ),
        h('span', { class: 'map-island-progress-pill' }, `${modDone}/${m.items.length} concluídas (${pct}%)`)
      ),
      h('div', { class: 'map-serpentine-trail' }, m.items.map((it, n) => {
        const isCp = it.kind === 'checkpoint';
        const isDone = it.stars > 0;
        const isResume = !it.stars && resumeInfo && resumeInfo.lessonId === it.id && resumeInfo.stepIndex > 0;
        const isNext = !isDone && it.id === firstTodoId;
        const lane = n % 4; // 0: esquerda, 1: centro, 2: direita, 3: centro
        const num = String(n + 1).padStart(2, '0');

        let statusText = 'Disponível';
        if (isResume) statusText = `Retomar (${resumeInfo.stepIndex + 1})`;
        else if (isCp && isDone) statusText = 'Checkpoint Aprovado';
        else if (isCp && isNext) statusText = 'Checkpoint Agora';
        else if (isCp) statusText = 'Checkpoint';
        else if (isDone) statusText = 'Visto';
        else if (isNext) statusText = 'Você está aqui';

        const stoneBtn = h('button', {
          type: 'button',
          class: 'map-stone-btn' + (isCp ? ' cp' : '') + (isDone ? ' done' : (isResume || isNext ? ' active' : '')),
          title: `${num} · ${it.title} (${statusText})`,
          onclick: () => openItem(it.id, isResume ? resumeInfo.stepIndex : 0)
        },
          (isResume || isNext) ? h('span', { class: 'map-stone-callout' }, isResume ? `RETOMAR (${resumeInfo.stepIndex + 1})` : 'VOCÊ ESTÁ AQUI') : null,
          isDone ? icon('check', 'sm') : (isCp ? icon('checkpoint', 'sm') : num)
        );

        const caption = h('div', { class: 'map-stone-caption' },
          h('span', { class: 'map-stone-title' }, `${num} · ${it.title}`),
          isDone ? h('div', { class: 'map-stone-stars' }, starsRow(it.stars)) : null
        );

        return h('div', { class: 'map-stone-step', 'data-lane': String(lane) }, stoneBtn, caption);
      }))
    );
    track.append(island);
  });
}

function updateViewSwitcher() {
  const ledgerBtn = $('#view-ledger-btn');
  const mapBtn = $('#view-map-btn');
  if (ledgerBtn && mapBtn) {
    const isMap = S.view === 'map';
    ledgerBtn.classList.toggle('on', !isMap);
    ledgerBtn.setAttribute('aria-checked', String(!isMap));
    mapBtn.classList.toggle('on', isMap);
    mapBtn.setAttribute('aria-checked', String(isMap));
  }
}

function updateToggleModsBtn() {
  const btn = $('#toggle-all-mods-btn');
  const sp = $('#toggle-all-mods-label');
  if (!btn || !sp) return;
  const isMap = S.view === 'map';
  btn.hidden = isMap;
  sp.textContent = S.allModsExpanded ? 'Recolher todos' : 'Expandir todos';
}

$('#view-ledger-btn').onclick = () => {
  S.view = 'ledger';
  localStorage.talk2me_view = 'ledger';
  renderHome();
};

$('#view-map-btn').onclick = () => {
  S.view = 'map';
  localStorage.talk2me_view = 'map';
  renderHome();
};

const toggleModsBtn = $('#toggle-all-mods-btn');
if (toggleModsBtn) {
  toggleModsBtn.onclick = () => {
    S.allModsExpanded = !S.allModsExpanded;
    S.openMods.clear();
    renderLedgerView();
    updateToggleModsBtn();
  };
}

$('#search').oninput = e => { S.q = e.target.value; renderHome(); };

/* ------------------------------------------------ Efeitos Sonoros Consulares (Web Audio API) */
const AudioFX = {
  ctx: null,
  get enabled() {
    return localStorage.talk2me_sound !== 'false';
  },
  set enabled(v) {
    localStorage.talk2me_sound = v ? 'true' : 'false';
  },
  init() {
    if (!this.ctx && typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {}
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  playSuccess() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.12); // B5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch (e) {}
  },
  playError() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.exponentialRampToValueAtTime(164.81, now + 0.14); // E3
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {}
  },
  playFinish() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      chord.forEach((freq, idx) => {
        const now = this.ctx.currentTime + idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      });
    } catch (e) {}
  }
};

/* ------------------------------------------------ Player de Aula e Exercícios */
let P = null;
let keyHandler = null;

async function openItem(id, startStep = 0) {
  try {
    const d = await StudyAPI.request('/api/lesson/' + id);
    if (!d || d.error) {
      alert('Esta aula não foi encontrada no banco de dados local.');
      return;
    }
    d.contents = d.contents || [];
    d.exercises = d.exercises || [];
    const prior = document.querySelector('#lesson-preview');
    if (prior) prior.remove();
    const dlg = h('dialog', {id:'lesson-preview'}, h('h2', {}, d.title),
      h('p', {}, `Cerca de ${d.estimatedMinutes || Math.max(1, Math.round(d.exercises.length / 2))} min · ${d.exercises.length} exercícios`),
      h('p', {}, StudyAPI.mode === 'mobile' ? (S.downloaded?.has(id) ? 'Aula baixada. Você pode estudar sem internet.' : 'Estude pela internet normalmente. Baixar é opcional.') : (d.availability ? (d.availability.missing ? `${d.availability.missing} mídias indisponíveis neste dispositivo.` : 'Mídias disponíveis neste dispositivo.') : 'Conteúdo local')),
      h('button', {class:'btn', onclick:()=>{dlg.close();dlg.remove();P=new Player(d,startStep);}}, startStep ? 'Continuar aula' : 'Começar aula'),
      h('button', {class:'abtn', onclick:()=>{dlg.close();dlg.remove();}}, 'Voltar'),
      h('button', {class:'abtn', id:'lesson-download', onclick:e=>downloadLesson(d,e.currentTarget)}, StudyAPI.mode === 'mobile' && S.downloaded?.has(id) ? 'Remover download desta aula' : 'Baixar aula para estudar sem conexão'),
      h('p', {class:'offline-note', role:'status'}, StudyAPI.mode === 'mobile' ? `Download opcional: ${StudyAPI.formatBytes(d.downloadBytes || 0)}. Seu progresso fica salvo neste celular.` : 'Use downloads apenas no seu dispositivo. O progresso será enviado quando você se reconectar.'));
    document.body.append(dlg); dlg.showModal();
  } catch (err) {
    console.error('Erro ao abrir aula:', err);
    alert(err.message || 'Não foi possível abrir a aula. Confira sua conexão.');
  }
}

const PHASE_NAMES = {
  aprender: 'Aprender',
  praticar: 'Praticar',
  desafio: 'Desafio',
  checkpoint: 'Checkpoint'
};

const CONTENT_KINDS = {
  0: 'Aula',
  1: 'Explicação & contexto',
  2: 'Vídeo-aula',
  3: 'Escute e observe',
  4: 'Resumo visual',
  6: 'Escute e acompanhe',
  7: 'Diálogo na prática'
};

class Player {
  constructor(d, startStep = 0) {
    this.d = d;
    this.finishEventId = StudyAPI.eventId();
    this.isReview = S.data.levels.some(l => l.modules.some(m => m.items.some(it => it.id === d.id && it.stars > 0)));
    this.queue = [
      ...(d.contents || []).map(c => ({ t: 'c', c })),
      ...(d.exercises || []).map(e => ({ t: 'e', e, first: true, done: false }))
    ];
    this.nEx = (d.exercises || []).length;
    this.wrong = 0;
    this.i = (startStep > 0 && startStep < this.queue.length) ? startStep : 0;
    
    // Assegura visibilidade explícita do player modal
    const pEl = $('#player');
    if (pEl) {
      pEl.hidden = false;
      pEl.style.display = 'flex';
      pEl.style.zIndex = '100';
    }
    document.body.style.overflow = 'hidden';
    
    const prefix = [d.level, d.modNum ? 'Mód. ' + String(d.modNum).padStart(2, '0') : ''].filter(Boolean).join(' · ');
    $('#ptitle').textContent = (prefix ? prefix + ' — ' : '') + (d.title || '');
    this.show(true);
  }

  saveResume() {
    if (this.isReview) return;
    if (this.d && this.d.id && this.i < this.queue.length) {
      StudyAPI.request('/api/resume', {
          lang: S.lang,
          lesson_id: this.d.id,
          step_index: this.i,
          level: this.d.level
      }).then(() => {
        if (!S.profile.resume) S.profile.resume = {};
        S.profile.resume[S.lang] = {
          lessonId: this.d.id,
          stepIndex: this.i,
          level: this.d.level,
          title: this.d.title
        };
      }).catch(error => {
        if (StudyAPI.mode === 'mobile') this.setFoot('bad', h('p', {}, error.message));
      });
    }
  }

  close() {
    this.disposeExercise?.();
    this.disposeExercise = null;
    stopAudio();
    keyHandler = null;
    const pEl = $('#player');
    if (pEl) {
      pEl.hidden = true;
      pEl.style.display = 'none';
    }
    document.body.style.overflow = '';
    P = null;
    loadTree().catch(()=>{});
  }

  progress() {
    $('#pfill').style.width = (this.i / Math.max(this.queue.length, 1) * 100) + '%';
    $('#pcount').textContent = this.i < this.queue.length
      ? `${String(this.i + 1).padStart(2, '0')}/${String(this.queue.length).padStart(2, '0')}`
      : '';
    $('#pprev').disabled = this.i <= 0 || this.i >= this.queue.length;
  }

  setFoot(state, node) {
    const f = $('#pfoot');
    f.className = 'pfoot' + (state ? ' ' + state : '');
    $('#pfb').innerHTML = '';
    if (node) $('#pfb').append(node);
  }

  btn(label, fn, cls, disabled, trailingArrow = false) {
    const b = $('#pbtn');
    b.innerHTML = '';
    b.append(h('span', {}, label));
    if (trailingArrow) b.append(icon('arrowRight', 'sm'));
    b.className = 'btn ' + (cls || '');
    b.disabled = !!disabled;
    b.onclick = fn;
  }

  prev() {
    if (this.i > 0) {
      this.i--;
      this.show(false);
    }
  }

  show(autoAudio = true) {
    this.disposeExercise?.();
    this.disposeExercise = null;
    stopAudio();
    keyHandler = null;
    this.progress();
    this.saveResume();
    const body = $('#pbody');
    body.innerHTML = '';
    body.scrollTop = 0;
    if (this.i >= this.queue.length) return this.finish();
    warmAhead(this.queue, this.i);
    const st = this.queue[this.i];
    this.setFoot('', null);
    try {
      if (st.t === 'c') {
        $('#pstep-kind').textContent = CONTENT_KINDS[st.c.type] || 'Explicação';
        const built = renderContent(st.c);
        body.append(h('div', { class: 'pin' }, built.el));
        this.btn('Continuar', () => { this.i++; this.show(true); }, '', false, true);
        if (autoAudio && built.start) {
          try { built.start(); } catch (e) {}
        }
      } else {
        const pName = PHASE_NAMES[st.e.phase] || 'Exercício';
        const kindMap = {
          multipleChoice: 'Escolha',
          audioIdentification: 'Escuta ativa',
          matching: 'Associação',
          matchingAudio: 'Escuta e combinação',
          buildWord: 'Construa a palavra',
          speakAndPractice: 'Pronúncia',
          guidedTrace: 'Escrita guiada'
        };
        const subKind = kindMap[st.e.type] || '';
        $('#pstep-kind').textContent = subKind ? `${pName} · ${subKind}` : pName;
        this.showExercise(st, autoAudio);
      }
    } catch (renderErr) {
      console.error('Aviso ao renderizar passo:', renderErr);
      body.append(h('div', { class: 'pin content-card' },
        h('h3', {}, 'Esta etapa apresentou um aviso de formatação.'),
        h('p', {}, 'Você pode continuar normalmente para a próxima etapa sem perder seu progresso.'),
        h('button', { class: 'btn', type: 'button', onclick: () => { this.i++; this.show(true); } }, 'Continuar para próxima etapa')
      ));
      this.btn('Continuar', () => { this.i++; this.show(true); }, '', false, true);
    }
  }

  showExercise(st, autoAudio) {
    const ex = st.e;
    const body = $('#pbody');
    if (st.done) {
      const ctrl = (EX[ex.type] || exUnknown)(ex, { ready() {}, submit() {} });
      this.disposeExercise = ctrl.dispose;
      if (ctrl.lock) ctrl.lock();
      body.append(h('div', { class: 'pin' }, ctrl.el));
      if (ctrl.mount) ctrl.mount();
      this.setFoot('ok', h('div', {},
        h('b', {}, icon('check', 'sm'), st.practiced ? 'Fala praticada sem avaliação automática' : 'Exercício já validado'),
        h('div', {}, st.practiced ? '' : ex.ok || '')
      ));
      this.btn('Continuar', () => { this.i++; this.show(true); }, 'ok', false, true);
      return;
    }

    const ctx = {
      ready: ok => { $('#pbtn').disabled = !ok; },
      submit: () => { if (!$('#pbtn').disabled) $('#pbtn').click(); },
      practiceReady: (evaluated = false) => {
        this.btn('Continuar', () => {
          st.practiced = !evaluated;
          st.done = true;
          this.i++;
          this.show(true);
        }, '', false, true);
      },
      onKey: fn => { keyHandler = fn; }
    };
    const ctrl = (EX[ex.type] || exUnknown)(ex, ctx);
    this.disposeExercise = ctrl.dispose;
    body.append(h('div', { class: 'pin' }, ctrl.el));
    if (ctrl.mount) ctrl.mount();
    this.btn('Verificar resposta', () => {
      const r = ctrl.check();
      const ok = r.correct;
      keyHandler = null;
      if (ctrl.lock) ctrl.lock();
      if (ok) {
        st.done = true;
        AudioFX.playSuccess();
      } else {
        this.wrong++;
        if (st.first) this.queue.push({ t: 'e', e: ex, first: false, done: false });
        st.done = true;
        AudioFX.playError();
      }
      const praise = S.lang === 'es'
        ? ['Correto!', '¡Muy bien!', 'Perfeito!', 'Resposta validada'][Math.random() * 4 | 0]
        : ['Correto!', 'Perfeito!', ' Excelente!', 'Resposta validada'][Math.random() * 4 | 0];
      const msg = h('div', {},
        h('b', {}, icon(ok ? 'check' : 'close', 'sm'), ok ? (r.skipped ? 'Etapa pulada por agora' : praise) : 'Revise este detalhe'),
        !ok && r.answer ? h('div', { style: 'font-weight:700;margin-bottom:2px' }, 'Resposta esperada: ' + r.answer) : null,
        h('div', {}, (ok ? ex.ok : ex.err) || ''),
        r.why ? h('div', {}, r.why) : null
      );
      this.setFoot(ok ? 'ok' : 'bad', msg);
      this.btn('Continuar', () => { this.i++; this.show(true); }, ok ? 'ok' : 'bad', false, true);
    }, '', true, false);

    if (autoAudio && ctrl.start) ctrl.start();
  }

  async finish() {
    if (this.finishing) return;
    this.finishing = true;
    AudioFX.playFinish();
    $('#pfill').style.width = '100%';
    $('#pcount').textContent = '';
    $('#pprev').disabled = true;
    $('#pstep-kind').textContent = 'Visto registrado';
    const total = Math.max(this.nEx - this.queue.filter(step => step.first && step.practiced).length, 1);
    const score = this.nEx ? Math.max(0, Math.round(100 * (total - this.wrong) / total)) : 100;
    const stars = score >= 90 ? 3 : score >= 70 ? 2 : 1;
    const xp = this.d.kind === 'checkpoint' ? 50 : 25;
    let gained = xp;
    try {
      const r = await finishLesson({id:this.d.id,stars,score,xp,event_id:this.finishEventId});
      this.pendingSync = !!r.pending;
      gained = r.gained;
      if (r.profile) {
        S.profile = r.profile;
        renderStats();
      }
    } catch (error) {
      this.finishing = false;
      this.setFoot('bad', h('p', {}, 'Não foi possível salvar: ' + error.message));
      this.btn('Tentar salvar novamente', () => this.finish(), 'bad', false);
      return;
    }

    const body = $('#pbody');
    body.innerHTML = '';
    body.append(h('div', { class: 'pin finish' },
      h('div', { class: 'visa-seal-lg' },
        h('strong', {}, this.d.kind === 'checkpoint' ? 'Controle Aprovado' : 'Visto Concedido'),
        starsRow(stars, true)
      ),
      h('h1', {}, this.d.kind === 'checkpoint' ? 'Checkpoint concluído' : (S.lang === 'es' ? '¡Lección completada!' : 'Lição concluída')),
      h('p', {}, this.d.title || ''),
      h('div', { class: 'fstats' },
        h('div', { class: 'fs' }, '+' + gained, h('small', {}, 'XP ganhos')),
        h('div', { class: 'fs' }, score + '%', h('small', {}, 'Precisão')),
        h('div', { class: 'fs' }, String(this.wrong), h('small', {}, 'Ajustes'))
      )
    ));
    this.setFoot('ok', h('div', {}, h('b', {}, icon('check', 'sm'), this.pendingSync ? 'Salvo neste dispositivo. Conecte-se para sincronizar o progresso.' : StudyAPI.savedMessage)));
    this.btn('Voltar ao Caderno', () => this.close(), 'ok', false, false);
    loadProfile();
  }
}

$('#pclose').onclick = () => {
  if (!P) return;
  P.close();
};
$('#pprev').onclick = () => { if (P) P.prev(); };

document.addEventListener('keydown', e => {
  if (!P || $('#player').hidden) return;
  if (['INPUT', 'TEXTAREA', 'VIDEO'].includes(document.activeElement.tagName)) return;
  if (e.key === 'Enter') {
    const b = $('#pbtn');
    if (!b.disabled) {
      e.preventDefault();
      b.click();
    }
    return;
  }
  if (keyHandler) keyHandler(e);
});

/* ------------------------------------------------ Conteúdo da Aula */
function parseVTT(txt) {
  return txt.split(/\r?\n/).filter(l => l.trim() && !/^WEBVTT/.test(l) && !/-->/.test(l) && !/^\d+$/.test(l.trim()));
}

function playDialogueAll(bubbles, nodes, playAllBtn) {
  stopAudio();
  const tok = dlgSeqToken;
  const audio = new Audio();
  activeAudio = audio;
  playAllBtn.classList.add('playing');
  let idx = 0;
  const next = () => {
    if (tok !== dlgSeqToken) return;
    nodes.forEach(n => n.classList.remove('active'));
    while (idx < bubbles.length && !bubbles[idx].audioUrl) idx++;
    if (idx >= bubbles.length) {
      activeAudio = null;
      playAllBtn.classList.remove('playing');
      return;
    }
    const b = bubbles[idx], node = nodes[idx];
    idx++;
    node.classList.add('active');
    audio.src = b.audioUrl;
    audio.onended = () => setTimeout(next, 280);
    audio.play().catch(error => {
      if (activeAudio !== audio) return;
      activeAudio = null;
      if (error.name !== 'NotAllowedError') mediaFailure(playAllBtn, () => playDialogueAll(bubbles, nodes, playAllBtn));
      playAllBtn.classList.remove('playing');
      node.classList.remove('active');
    });
  };
  next();
}

function renderContent(c) {
  const el = h('div', {}, c.title ? h('h2', { class: 'q' }, c.title) : null);
  if (c.description) el.append(h('div', { class: 'rich', html: c.description }));

  const items = c.items || [];
  const vtt = items.find(i => i.textContent && /^\s*WEBVTT/.test(i.textContent));
  let firstAudio = null;

  for (const it of items) {
    if (it === vtt) continue;
    const vsrc = it.videoUrl || (it.fileUrl && /\.mp4$/i.test(it.fileUrl) ? it.fileUrl : null);
    if (vsrc) {
      const v = h('video', { controls: true, playsinline: true, preload: lightMedia() ? 'metadata' : 'auto', src: vsrc });
      v.addEventListener('play', () => stopAudio());
      v.addEventListener('error', () => mediaFailure(v.parentElement, () => v.load()));
      if (vtt) {
        const url = URL.createObjectURL(new Blob([vtt.textContent], { type: 'text/vtt' }));
        v.append(h('track', { kind: 'subtitles', srclang: 'pt', label: 'Português', src: url, default: true }));
      }
      const videoWrapper = h('div', { class: 'video-wrap' }, v);
      el.append(videoWrapper);
      decorateLessonVideo(v, videoWrapper);
      if (vtt) {
        el.append(h('details', { class: 'transcript' },
          h('summary', {}, icon('doc', 'sm'), 'Transcrição da vídeo-aula'),
          parseVTT(vtt.textContent).map(l => h('p', {}, l))
        ));
      }
    }
    const hasCard = it.imageUrl || it.audioUrl || (it.textContent && it !== vtt);
    if (hasCard) {
      const card = h('div', { class: 'content-card' });
      if (it.imageUrl) card.append(h('img', { class: 'media-img', loading: 'lazy', decoding: 'async', src: it.imageUrl, alt: c.title || '', onerror: e => e.target.remove() }));
      if (it.audioUrl) {
        if (!firstAudio) firstAudio = it.audioUrl;
        card.append(audioPair(it.audioUrl, 'Ouvir pronúncia', false));
      }
      if (it.textContent && it !== vtt) card.append(h('div', { class: 'rich', html: it.textContent }));
      el.append(card);
    }
  }

  if (c.bubbles && c.bubbles.length) {
    const hasAnyAudio = c.bubbles.some(b => b.audioUrl);
    const nodes = [];
    const playAllBtn = hasAnyAudio
      ? h('button', { class: 'abtn sm', type: 'button' }, icon('play', 'sm'), eqBars(), h('span', {}, 'Ouvir diálogo completo'))
      : null;
    const sheet = h('div', { class: 'dlg-sheet' });
    if (playAllBtn) {
      sheet.append(h('div', { class: 'dlg-head' },
        h('span', { class: 'hint', style: 'margin:0' }, 'Toque em qualquer fala para escutar isoladamente ou reproduza a cena completa:'),
        playAllBtn
      ));
    }
    const list = h('div', { class: 'bubbles' });
    c.bubbles.forEach((b, n) => {
      const btn = b.audioUrl ? audioBtn(b.audioUrl, '', 'sm') : null;
      const row = h('div', {
        class: 'bub' + (n % 2 ? ' r' : ''),
        onclick: () => {
          if (!b.audioUrl) return;
          playAudio(b.audioUrl, btn);
          row.classList.add('active');
          const clearRow = () => row.classList.remove('active');
          activeAudio?.addEventListener('ended', clearRow, {once:true});
          activeAudio?.addEventListener('error', clearRow, {once:true});
        }
      }, btn, h('div', { class: 'b', html: b.text || '' }));
      nodes.push(row);
      list.append(row);
    });
    if (playAllBtn) playAllBtn.onclick = () => playDialogueAll(c.bubbles, nodes, playAllBtn);
    sheet.append(list);
    el.append(sheet);
  }

  if (c.glossary) {
    const g = Array.isArray(c.glossary) ? c.glossary : [c.glossary];
    el.append(h('div', { class: 'content-card rich' },
      g.map(x => h('p', {}, typeof x === 'string' ? x : Object.values(x).filter(v => typeof v === 'string' && !v.startsWith('/m/')).join(' — ')))
    ));
  }

  return {
    el,
    start: firstAudio ? () => setTimeout(() => {
      const b = $('#pbody [data-primary-audio]');
      if (b) playAudio(firstAudio, b, 1.0);
    }, 240) : null
  };
}

/* ------------------------------------------------ Exercícios */
function prompt(ex, fallback) {
  const p = h('div', { class: 'ex-head' });
  const t = ex.title || fallback || '';
  if (t) p.append(h('h2', { class: 'q' }, t));
  if (ex.html) p.append(h('div', { class: 'rich', html: ex.html }));
  else if (ex.text && ex.text !== t) p.append(h('p', { class: 'lead' }, ex.text));
  return p;
}

function exMC(ex, ctx) {
  let sel = null, locked = false;
  const list = h('div', { class: 'opts' });
  const isAudioOnly = !ex.title && !ex.text && !ex.html && !!ex.audio;
  const cards = (ex.options || []).map((o, idx) => {
    const badge = h('span', { class: 'opt-idx' }, String(idx + 1));
    const card = h('button', {
      type: 'button',
      class: 'opt',
      onclick: () => {
        if (locked) return;
        cards.forEach(c => c.classList.remove('on'));
        card.classList.add('on');
        sel = o;
        ctx.ready(true);
      }
    }, badge);
    if (o.image) card.append(h('img', { class: 'opt-img', loading: 'lazy', decoding: 'async', src: o.image, alt: o.text || '', onerror: e => e.target.remove() }));
    if (o.audio) card.append(audioBtn(o.audio, '', 'sm'));
    card.append(h('span', { class: 'opt-txt' }, o.text || ''));
    list.append(card);
    return card;
  });

  ctx.onKey(e => {
    if (locked) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= cards.length) cards[n - 1].click();
  });

  return {
    el: h('div', {},
      prompt(ex, isAudioOnly ? 'Escute e selecione a opção correta' : 'Escolha a alternativa correta'),
      ex.audio ? audioPair(ex.audio, 'Ouvir', true) : null,
      list
    ),
    start: ex.audio ? () => setTimeout(() => {
      const b = $('#pbody [data-primary-audio]');
      if (b) playAudio(ex.audio, b, 1.0);
    }, 260) : null,
    lock: () => {
      locked = true;
      cards.forEach(c => c.disabled = true);
    },
    check() {
      const ok = !!(sel && sel.correct);
      const rightOpt = (ex.options || []).find(o => o.correct);
      cards.forEach((c, idx) => {
        const o = ex.options[idx];
        if (o.correct) c.classList.add('right');
        else if (c.classList.contains('on')) c.classList.add('wrong');
      });
      return { correct: ok, why: sel && sel.why, answer: rightOpt ? rightOpt.text : null };
    }
  };
}

function exMatch(ex, ctx) {
  const pairs = ex.pairs || [];
  let leftSel = null, rightSel = null;
  const matched = new Set();
  const isAudioText = t => /\.(mp3|wav|ogg)(\?|$)/i.test(t || '');
  const leftIsAudio = pairs.some(p => isAudioText(p.left));
  const rightIsAudio = pairs.some(p => isAudioText(p.right));
  const colName = (aud, side) => aud ? 'Áudios' : (leftIsAudio !== rightIsAudio ? 'Frases' : (side === 'l' ? 'Coluna A' : 'Coluna B'));
  const leftCol = h('div', { class: 'mcol', role: 'group', 'aria-label': colName(leftIsAudio, 'l') },
    h('div', { class: 'mcol-label' }, colName(leftIsAudio, 'l')));
  const rightCol = h('div', { class: 'mcol', role: 'group', 'aria-label': colName(rightIsAudio, 'r') },
    h('div', { class: 'mcol-label' }, colName(rightIsAudio, 'r')));
  const hint = h('p', { class: 'match-hint' }, leftIsAudio && !rightIsAudio
    ? 'Toque em um áudio para ouvir. Depois, escolha a frase correspondente na coluna ao lado.'
    : 'Escolha um item de cada coluna para formar um par. Toque nos áudios para ouvir.');
  let checking = false;
  const progressEl = h('p', { class: 'match-progress', 'aria-live': 'polite' }, `0 de ${pairs.length} pares`);

  const L = pairs.map(p => ({ text: p.left, id: p.seq }));
  const R = shuffle(pairs.map(p => ({ text: p.right, id: p.seq })));

  function makeButtons(items, column, select) {
    return items.map((item, index) => {
      const audio = isAudioText(item.text);
      const button = h('button', {
        type: 'button', class: 'opt m-opt', 'aria-pressed': 'false',
        onclick: () => {
          if (checking || matched.has(item.id)) return;
          if (audio) playAudio(item.text, button);
          for (const prior of column.querySelectorAll('.on')) {
            prior.classList.remove('on');
            prior.setAttribute('aria-pressed', 'false');
          }
          button.classList.add('on');
          button.setAttribute('aria-pressed', 'true');
          select(item);
          checkPair();
        }
      }, audio ? icon('volume', 'sm') : null,
      h('span', {}, audio ? 'Áudio ' + (index + 1) : item.text));
      column.append(button);
      return button;
    });
  }
  const lBtns = makeButtons(L, leftCol, item => { leftSel = item; });
  const rBtns = makeButtons(R, rightCol, item => { rightSel = item; });
  function checkPair() {
    if (!leftSel || !rightSel) return;
    const ok = leftSel.id === rightSel.id;
    const lEl = lBtns[L.findIndex(x => x === leftSel)];
    const rEl = rBtns[R.findIndex(x => x === rightSel)];
    if (ok) {
      matched.add(leftSel.id);
      const num = String(matched.size);
      [lEl, rEl].forEach(el => {
        el.classList.remove('on'); el.classList.add('right'); el.disabled = true;
        el.setAttribute('aria-pressed', 'false');
        el.prepend(h('span', { class: 'pair-num', 'aria-label': 'par ' + num }, num));
      });
      progressEl.textContent = `${matched.size} de ${pairs.length} pares`;
      leftSel = rightSel = null;
      if (matched.size === pairs.length) {
        ctx.ready(true);
        ctx.submit();
      }
    } else {
      checking = true;
      progressEl.textContent = 'Esses itens não formam um par. Tente novamente.';
      lEl.classList.add('wrong');
      rEl.classList.add('wrong');
      setTimeout(() => {
        lEl.classList.remove('wrong', 'on');
        rEl.classList.remove('wrong', 'on');
        [lEl, rEl].forEach(el => el.setAttribute('aria-pressed', 'false'));
        checking = false;
        leftSel = rightSel = null;
      }, 550);
    }
  }

  return {
    el: h('div', {},
      prompt(ex, 'Combine os pares correspondentes'),
      hint,
      progressEl,
      h('div', { class: 'cols match-cols' + (leftIsAudio && !rightIsAudio ? ' audio-first' : '') }, leftCol, rightCol)
    ),
    check: () => ({ correct: matched.size === pairs.length })
  };
}

function baseChar(ch) {
  return ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function exBuild(ex, ctx) {
  const t = ex.tsd || {};
  const expected = (t.word || ex.expected || '').trim();
  const rawLetters = t.letters && t.letters.length ? t.letters.slice() : expected.split('');
  const tiles = shuffle(rawLetters).map((l, idx) => ({ id: idx, v: l, used: false }));
  const fill = Array(expected.length).fill(null);
  let locked = false;

  const slotsEl = h('div', { class: 'slots' });
  const tilesEl = h('div', { class: 'tiles' });

  function render() {
    slotsEl.innerHTML = '';
    fill.forEach((t, i) => {
      const s = h('button', {
        type: 'button',
        class: 'slot' + (t ? ' filled' : ''),
        onclick: () => {
          if (locked || !t) return;
          t.used = false;
          fill[i] = null;
          render();
        }
      }, t ? t.v : '');
      slotsEl.append(s);
    });

    tilesEl.innerHTML = '';
    tiles.forEach(t => {
      const b = h('button', {
        type: 'button',
        class: 'tile' + (t.used ? ' used' : ''),
        onclick: () => {
          if (locked || t.used) return;
          const next = fill.indexOf(null);
          if (next >= 0) {
            t.used = true;
            fill[next] = t;
            render();
          }
        }
      }, t.v);
      tilesEl.append(b);
    });

    ctx.ready(!fill.includes(null));
  }

  const head = prompt(ex, 'Construa a palavra na ordem correta');
  if (t.translation) {
    head.append(h('p', { class: 'translation-tip' }, h('span', { class: 'hint' }, 'Tradução: '), h('strong', {}, t.translation)));
  }

  if (ctx.onKey) {
    ctx.onKey(e => {
      if (locked) return;
      if (e.key === 'Backspace') {
        e.preventDefault();
        for (let i = fill.length - 1; i >= 0; i--) {
          if (fill[i]) {
            fill[i].used = false;
            fill[i] = null;
            render();
            break;
          }
        }
        return;
      }
      if (e.key.length === 1) {
        const n = fill.indexOf(null);
        if (n < 0) return;
        const kLow = e.key.toLowerCase();
        const cand = tiles.find(t => !t.used && t.v.toLowerCase() === kLow)
          || tiles.find(t => !t.used && baseChar(t.v) === baseChar(kLow));
        if (cand) {
          e.preventDefault();
          cand.used = true;
          fill[n] = cand;
          render();
        }
      }
    });
  }

  render();
  return {
    el: h('div', {},
      head,
      ex.audio ? audioPair(ex.audio, 'Ouvir', true) : null,
      slotsEl,
      tilesEl,
      h('div', { class: 'kbd-tip' }, 'Toque nas letras ou digite diretamente no teclado (Backspace apaga).')
    ),
    lock: () => { locked = true; },
    check() {
      const got = fill.map(t => t ? t.v : '').join('');
      const ok = got.toLowerCase() === expected.toLowerCase();
      slotsEl.querySelectorAll('.slot').forEach(s => s.classList.add(ok ? 'right' : 'wrong'));
      return { correct: ok, answer: expected };
    }
  };
}

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\uAC00-\uD7A3]/g, '');
}

function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

function exSpeak(ex, ctx) {
  const t = ex.tsd || {}, target = t.expectedText || ex.expected || ex.text, src = t.audioModelUrl || ex.audio;
  const min = Math.min(t.minSimilarity || 0.7, 0.75);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const world = COURSE_WORLDS[S.lang] || COURSE_WORLDS.es;
  const said = h('div', { class: 'said', role: 'status' }, SR
    ? world.speechHint
    : 'Reconhecimento de voz indisponível neste navegador — repita em voz alta e avance.');
  let passed = false, skipped = false, rec = null;
  const counter = h('span', {class:'mic-seconds', 'aria-hidden':'true'}, '0 s');
  const stopLabel = h('span', {class:'mic-stop', hidden:true}, counter, 'Toque para parar');
  const mic = h('button', {class:'mic', type:'button', title:'Gravar voz no microfone',
    'aria-label':'Gravar voz no microfone'}, icon('mic', 'xl'), stopLabel);
  let clock;

  function showRecording() {
    clearInterval(clock);
    const start = performance.now();
    counter.textContent = '0 s';
    stopLabel.hidden = false;
    mic.classList.add('rec');
    mic.setAttribute('aria-label', 'Toque para parar');
    clock = setInterval(() => {
      counter.textContent = Math.floor((performance.now() - start) / 1000) + ' s';
    }, 250);
  }

  function hideRecording() {
    clearInterval(clock);
    mic.classList.remove('rec');
    stopLabel.hidden = true;
    mic.setAttribute('aria-label', mic.title);
  }

  const playback = h('audio', { controls: true, hidden: true, 'aria-label': 'Sua gravação' });
  const advance = h('button', {type: 'button', class: 'btn', hidden: true,
    onclick: () => ctx.submit()}, 'Continuar');
  let recording, stream, timer, recordingUrl, disposed = false;

  function releaseMic() {
    clearTimeout(timer);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
  }

  function dispose() {
    disposed = true;
    hideRecording();
    mic.disabled = true;
    advance.hidden = true;
    if (rec) {
      rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
      rec.abort();
      rec = null;
    }
    if (recording?.state === 'recording') recording.stop();
    releaseMic();
    playback.pause();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  }

  const canCorrect = S.lang === 'es' && typeof SpanishSpeech !== 'undefined' &&
    window.Worker && window.WebAssembly && window.OfflineAudioContext && window.caches;
  let localEnabled = canCorrect && localStorage.getItem('talk2me-spanish-speech') === 'on';
  let usingLocal = false, lastTake, attempt = 0;
  const enable = h('button', {type:'button', class:'abtn', hidden:true}, 'Ativar correção no aparelho (45 MB)');
  async function reviewTake(blob, version) {
    advance.hidden = true;
    ctx.ready(false);
    skip.hidden = false;
    said.textContent = 'Reconhecendo sua frase neste aparelho…';
    try {
      const heard = await SpanishSpeech.transcribe(blob);
      if (disposed || version !== attempt) return;
      passed = Boolean(heard) && norm(heard) === norm(target);
      said.textContent = passed ? 'Você acertou! Ouvi: “' + heard + '”.'
        : heard ? 'Ouvi: “' + heard + '”. Ouça o modelo e tente de novo.'
                : 'Não consegui identificar palavras. Toque no microfone e tente de novo.';
      said.style.color = passed ? 'var(--ok-ink)' : 'var(--ink)';
      if (!passed) skip.textContent = 'Continuar sem avaliação';
      if (passed) ctx.practiceReady?.(true);
      else ctx.ready(false);
      advance.hidden = !passed;
      skip.hidden = passed;
    } catch {
      if (disposed || version !== attempt) return;
      said.textContent = 'A correção está indisponível. Você pode ouvir sua gravação e continuar sem nota.';
      advance.hidden = false;
      ctx.practiceReady?.();
    }
  }
  enable.onclick = async () => {
    enable.disabled = true;
    said.textContent = 'Preparando o espanhol. Na primeira vez, o download pode levar alguns segundos.';
    try {
      await SpanishSpeech.prepare();
      localStorage.setItem('talk2me-spanish-speech','on');
      if (disposed) return;
      localEnabled = true;
      enable.hidden = true;
      if (lastTake && recording?.state !== 'recording') reviewTake(lastTake,attempt);
      else if (recording?.state !== 'recording') said.textContent = 'Correção pronta. Toque no microfone e diga a frase.';
    } catch {
      if (!disposed) said.textContent = 'Não foi possível preparar a correção. Tente de novo ou pratique sem nota.';
    } finally { enable.disabled = false; }
  };
  function localPractice() {
    usingLocal = true;
    if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      mic.hidden = true;
      said.textContent = 'A avaliação de voz está indisponível. Ouça o modelo, repita em voz alta e continue.';
      return;
    }
    enable.hidden = !canCorrect || localEnabled;
    mic.title = 'Gravar para ouvir minha voz';
    hideRecording();
    said.textContent = canCorrect ? 'Ative a correção de espanhol para receber o resultado da sua fala, ou toque no microfone para praticar sem nota.' : 'Toque no microfone para gravar sua voz e comparar com o modelo.';
    if (localEnabled) said.textContent = 'Toque no microfone. A correção de espanhol é feita neste aparelho.';
    mic.onclick = async () => {
      if (recording?.state === 'recording') { recording.stop(); return; }
      stopAudio();
      playback.pause();
      mic.disabled = true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) { releaseMic(); return; }
        const version = ++attempt;
        passed = false;
        lastTake = null;
        advance.hidden = true;
        skip.hidden = false;
        ctx.ready(false);
        if (localEnabled) SpanishSpeech.prepare().catch(() => {});
        recording = new MediaRecorder(stream);
        const chunks = [];
        recording.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        recording.onstop = () => {
          releaseMic();
          if (disposed) return;
          mic.title = 'Gravar novamente';
          hideRecording();
          if (!chunks.length) { said.textContent = 'A gravação ficou vazia. Toque para gravar novamente.'; return; }
          if (recordingUrl) URL.revokeObjectURL(recordingUrl);
          lastTake = new Blob(chunks, {type: recording.mimeType});
          recordingUrl = URL.createObjectURL(lastTake);
          playback.src = recordingUrl;
          playback.hidden = false;
          if (localEnabled) { reviewTake(lastTake, version); return; }
          said.textContent = 'Gravação pronta, sem nota automática. Você pode ouvir sua voz, gravar de novo ou continuar.';
          advance.hidden = false;
          skip.hidden = true;
          ctx.practiceReady?.();
        };
        recording.start();
        showRecording();
        said.textContent = 'Gravando. Toque para parar ou aguarde 20 segundos.';
        timer = setTimeout(() => { if (recording.state === 'recording') recording.stop(); }, 20000);
      } catch (error) {
        releaseMic();
        said.textContent = error.name === 'NotAllowedError'
          ? 'Permita o microfone nas configurações deste site para gravar, ou continue sem avaliação.'
          : 'O microfone está indisponível. Confira o dispositivo ou continue sem avaliação.';
      } finally {
        mic.disabled = false;
      }
    };
  }

  if (SR && !localEnabled) {
    mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      stopAudio();
      rec = new SR();
      rec.lang = SR_LANG[S.lang] || 'es-ES';
      rec.interimResults = false;
      rec.maxAlternatives = 4;
      rec.onstart = showRecording;
      said.style.color = 'var(--accent)';
      said.textContent = 'Escutando sua pronúncia…';
      rec.onresult = e => {
        let best = 0, txt = '';
        for (const r of Array.from(e.results[0])) {
          const a = norm(r.transcript), b = norm(target);
          const s = 1 - lev(a, b) / Math.max(a.length, b.length, 1);
          if (s >= best) { best = s; txt = r.transcript; }
        }
        said.textContent = `Você disse: “${txt}” (${Math.round(best * 100)}%)`;
        passed = best >= min;
        ctx.ready(passed);
        if (passed) {

          said.style.color = 'var(--ok-ink)';
        } else {
          said.style.color = 'var(--err-ink)';
          said.textContent += ' — tente novamente ou pule abaixo.';
        }
      };
      rec.onerror = e => {
        said.style.color = 'var(--err-ink)';
        if (['service-not-allowed', 'not-allowed', 'network', 'language-not-supported'].includes(e.error)) {
          rec.onstart = rec.onend = null;
          rec = null;
          localPractice();
          if (e.error === 'not-allowed') said.textContent = 'Para gravar, permita o microfone nas configurações deste site. Depois, toque para tentar novamente.';
          return;
        }
        said.textContent = 'Áudio não captado (' + e.error + '). Tente novamente ou pule abaixo.';
      };
      rec.onend = () => { hideRecording(); rec = null; };
      try { rec.start(); } catch (err) { rec = null; mic.classList.remove('rec'); localPractice(); }
    };
  } else {
    localPractice();
  }

  const skip = h('button', {
    class: 'skip',
    type: 'button',
    onclick: () => { skipped = true; if (usingLocal) ctx.practiceReady?.(); ctx.ready(true); ctx.submit(); }
  }, 'Não posso usar o microfone agora (pular fala)');

  return {
    el: h('div', { class: 'speak' },
      prompt(ex, 'Pronúncia'),
      h('div', { class: 'say-card' },
        h('div', { class: 'say' }, target),
        t.romanization ? h('div', { class: 'rom' }, t.romanization) : null,
        src ? audioPair(src, 'Ouvir modelo', false) : null
      ),
      mic,
      said,
      playback,
      enable,
      advance,
      h('div', { class: 'skip-zone' }, skip)
    ),
    start: src ? () => setTimeout(() => {
      const b = $('#pbody [data-primary-audio]');
      if (b) playAudio(src, b, 1.0);
    }, 260) : null,
    dispose,
    lock: dispose,
    check: () => ({ correct: passed || skipped, skipped: skipped && !passed })
  };
}

function exTrace(ex, ctx) {
  const t = ex.tsd || {};
  const strokes = ((t.trace && t.trace.strokes) || []).slice().sort((a, b) => a.order - b.order);
  const wrap = h('div', { class: 'trace' });
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 1 1');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const paths = strokes.map(s => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', s.path);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', isDark ? 'rgba(255, 255, 255, 0.28)' : '#C8C2B6');
    p.setAttribute('stroke-width', '0.07');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
    return p;
  });
  strokes.forEach(s => {
    if (s.marker) {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', s.marker[0]);
      c.setAttribute('cy', s.marker[1]);
      c.setAttribute('r', '.035');
      c.setAttribute('fill', '#1D6342');
      svg.append(c);
    }
  });
  const cv = h('canvas', {});
  wrap.append(svg, cv);
  let drawing = false, covered = 0;
  const samples = [];
  const prep = () => {
    samples.length = 0;
    covered = 0;
    paths.forEach(p => {
      const L = p.getTotalLength();
      const n = 28;
      for (let i = 0; i <= n; i++) {
        const q = p.getPointAtLength(L * i / n);
        samples.push({ x: q.x, y: q.y, hit: false });
      }
    });
  };
  const g = () => cv.getContext('2d');
  const pos = e => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const fit = () => {
    const r = cv.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      cv.width = r.width * 2;
      cv.height = r.height * 2;
    }
  };
  const initTrace = () => {
    if (!samples.length) prep();
    fit();
  };
  const inkColor = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (dark) {
      return getComputedStyle(document.documentElement).getPropertyValue('--top-accent').trim() || '#F28B79';
    }
    return getComputedStyle(document.documentElement).getPropertyValue('--cover').trim() || '#6E1D2A';
  };
  cv.addEventListener('pointerdown', e => {
    if (!samples.length || !cv.width) initTrace();
    drawing = true;
    cv.setPointerCapture(e.pointerId);
    const p = pos(e);
    const c = g();
    c.beginPath();
    c.moveTo(p.x * cv.width, p.y * cv.height);
  });
  cv.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = pos(e);
    const c = g();
    c.lineWidth = cv.width * 0.045;
    c.lineCap = c.lineJoin = 'round';
    c.strokeStyle = inkColor();
    c.lineTo(p.x * cv.width, p.y * cv.height);
    c.stroke();
    samples.forEach(s => {
      if (!s.hit && Math.hypot(s.x - p.x, s.y - p.y) < 0.1) {
        s.hit = true;
        covered++;
      }
    });
    if (samples.length && covered / samples.length >= 0.75) ctx.ready(true);
  });
  const end = () => { drawing = false; };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  const clear = () => {
    g().clearRect(0, 0, cv.width, cv.height);
    samples.forEach(s => { s.hit = false; });
    covered = 0;
    ctx.ready(false);
  };
  let skipped = false;
  return {
    el: h('div', { class: 'trace-stage' },
      prompt(ex, 'Escrita guiada'),
      h('div', { class: 'say' }, t.text || ex.expected || ''),
      h('p', { class: 'hint' }, 'Siga o traço guia a partir do ponto verde.'),
      wrap,
      h('div', { class: 'trace-actions' },
        h('button', { class: 'abtn sm', type: 'button', onclick: clear }, icon('refresh', 'sm'), h('span', {}, 'Limpar traço')),
        h('button', { class: 'skip', type: 'button', onclick: () => { skipped = true; ctx.ready(true); ctx.submit(); } }, 'Pular escrita')
      )
    ),
    mount() { initTrace(); },
    check: () => ({ correct: true, skipped })
  };
}

function exUnknown(ex, ctx) {
  ctx.ready(true);
  return {
    el: h('div', {}, prompt(ex, 'Exercício'), h('p', {}, 'Formato não mapeado: ' + ex.type)),
    check: () => ({ correct: true, skipped: true })
  };
}

const EX = {
  multipleChoice: exMC,
  audioIdentification: exMC,
  matching: exMatch,
  matchingAudio: exMatch,
  buildWord: exBuild,
  speakAndPractice: exSpeak,
  guidedTrace: exTrace
};

/* ------------------------------------------------ Modal do Passaporte e Perfil */
function getInitials(name) {
  const parts = (name || 'Rony Novais').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] ? parts[0].slice(0, 2) : 'RN').toUpperCase();
}

/* ------------------------------------------------ Selos Consulares & Conquistas (App Original) */
const CONSULAR_BADGES = [
  {
    id: 'first_step',
    title: 'Primeiro Passo',
    desc: 'Completou a primeira lição com carimbo no passaporte.',
    icon: 'check',
    check: p => {
      const stats = p.stats || {};
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      return total >= 1;
    }
  },
  {
    id: 'trail_init',
    title: 'Trilha Consular',
    desc: 'Validou 5 lições concluídas no caderno de estudos.',
    icon: 'stamp',
    check: p => {
      const stats = p.stats || {};
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      return total >= 5;
    }
  },
  {
    id: 'dedication',
    title: 'Dedicação Acadêmica',
    desc: 'Alcançou a marca de 15 lições validadas.',
    icon: 'layers',
    check: p => {
      const stats = p.stats || {};
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      return total >= 15;
    }
  },
  {
    id: 'streak_3',
    title: 'Foco Contínuo',
    desc: 'Manteve 3 dias consecutivos de estudo sem falhar.',
    icon: 'flame',
    check: p => (p.streak || 0) >= 3 || (p.longest_streak || 0) >= 3
  },
  {
    id: 'streak_7',
    title: 'Semana Dourada',
    desc: 'Manteve 7 dias consecutivos de ofensiva consular.',
    icon: 'flame',
    check: p => (p.streak || 0) >= 7 || (p.longest_streak || 0) >= 7
  },
  {
    id: 'streak_14',
    title: 'Quinzena Inabalável',
    desc: 'Completou 14 dias ininterruptos de estudo.',
    icon: 'flame',
    check: p => (p.streak || 0) >= 14 || (p.longest_streak || 0) >= 14
  },
  {
    id: 'perfect_score',
    title: 'Precisão Absoluta',
    desc: 'Concluiu uma atividade com nota máxima (3 estrelas).',
    icon: 'star',
    check: p => {
      const stats = p.stats || {};
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      return total > 0;
    }
  },
  {
    id: 'checkpoint_clear',
    title: 'Fronteira Vencida',
    desc: 'Aprovado em um Checkpoint oficial de unidade curricular.',
    icon: 'checkpoint',
    check: p => {
      const stats = p.stats || {};
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      return total >= 5;
    }
  },
  {
    id: 'xp_100',
    title: 'Acúmulo de Saber',
    desc: 'Alcançou 100 pontos de experiência acumulada no estúdio.',
    icon: 'shield',
    check: p => (p.xp || 0) >= 100
  },
  {
    id: 'iberian_focus',
    title: 'Passaporte Ibérico',
    desc: 'Iniciou a preparação em Espanhol com destino à Espanha.',
    icon: 'compass',
    check: p => {
      const stats = p.stats || {};
      return (stats.es || 0) > 0;
    }
  }
];

function renderBadgesUI() {
  const grid = $('#badges-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const p = S.profile || {};
  let unlockedCount = 0;

  CONSULAR_BADGES.forEach(b => {
    const isUnlocked = b.check(p);
    if (isUnlocked) unlockedCount++;

    const card = h('div', { class: 'badge-card' + (isUnlocked ? ' unlocked' : '') },
      h('div', { class: 'badge-icon-box' }, icon(b.icon, 'md')),
      h('div', { class: 'badge-info' },
        h('div', { class: 'badge-header-row' },
          h('h4', { class: 'badge-title' }, b.title),
          h('span', { class: 'badge-status-tag ' + (isUnlocked ? 'visto' : 'bloqueado') }, isUnlocked ? 'Visto' : 'Pendente')
        ),
        h('p', { class: 'badge-desc' }, b.desc),
        !isUnlocked ? h('div', { class: 'badge-progress-bar' },
          h('div', { class: 'badge-progress-fill', style: 'width: 45%' })
        ) : null
      )
    );
    grid.append(card);
  });

  const summary = $('#badges-unlocked-summary');
  if (summary) {
    summary.textContent = `${unlockedCount} de ${CONSULAR_BADGES.length} selos desbloqueados`;
  }
}

function updateSoundBtn() {
  const soundBtn = $('#sound-toggle-btn');
  const soundLabel = $('#sound-toggle-label');
  if (!soundBtn) return;
  const on = AudioFX.enabled;
  soundBtn.classList.toggle('on', on);
  soundBtn.setAttribute('aria-pressed', String(on));
  if (soundLabel) soundLabel.textContent = on ? 'Ativado' : 'Silencioso';
}

function updateProfileUI() {
  const p = S.profile || {};
  renderBadgesUI();
  updateSoundBtn();
  const name = p.full_name || 'Rony Novais';
  const initials = getInitials(name);

  // Top header elements
  const topMono = $('#top-avatar-mono');
  if (topMono) topMono.textContent = initials;
  const topName = $('#top-user-name');
  if (topName) topName.textContent = name.split(' ')[0];

  // Drawer elements
  const idMono = $('#id-avatar-box');
  if (idMono) idMono.textContent = initials;
  const idInput = $('#id-name-input');
  if (idInput && document.activeElement !== idInput) idInput.value = name;
  const badgeCode = $('#id-badge-code');
  if (badgeCode) {
    badgeCode.textContent = p.email ? p.email : `ALUNO · ${p.auth_mode === 'google' ? 'GOOGLE' : 'MODO LOCAL'}`;
  }

  // Streak & Daily XP
  const streakCount = $('#streak-days-count');
  if (streakCount) streakCount.textContent = `${p.streak || 0} dias seguidos`;

  const today = StudyAPI.day();
  const todayAct = (p.activity || []).find(a => a.date === today);
  const todayXp = todayAct ? todayAct.xp : 0;
  const goalXp = p.daily_goal_xp || 50;
  const dailyRatio = $('#daily-xp-ratio');
  if (dailyRatio) dailyRatio.textContent = `${todayXp} / ${goalXp} XP`;
  const dailyFill = $('#daily-xp-fill');
  if (dailyFill) dailyFill.style.width = Math.min(100, Math.round((todayXp / Math.max(goalXp, 1)) * 100)) + '%';

  // Calendário de ofensiva (últimos 7 dias)
  const calStrip = $('#streak-calendar-strip');
  if (calStrip) {
    calStrip.innerHTML = '';
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = StudyAPI.day(d);
      const hasAct = (p.activity || []).some(a => a.date === iso && a.xp > 0);
      const isToday = i === 0;
      const cell = h('div', { class: 'streak-cal-day' + (hasAct ? ' active' : '') },
        h('span', {}, dayNames[d.getDay()]),
        hasAct ? icon('flame', 'sm') : h('span', { style: 'opacity:0.4' }, '·')
      );
      calStrip.append(cell);
    }
  }

  // Resumo dos Cursos no Perfil
  const cGrid = $('#course-progress-grid');
  if (cGrid && S.data && S.data.langs) {
    cGrid.innerHTML = '';
    for (const [code, info] of Object.entries(S.data.langs)) {
      const isCurrent = code === S.lang;
      const doneCount = (p.stats && p.stats[code]) || 0;
      const card = h('div', { class: 'course-prog-card' + (isCurrent ? ' current' : '') },
        h('strong', {}, flagEl(code), info.name),
        h('span', {}, `${info.count} atividades mapeadas`),
        h('span', { style: 'font-weight:700;color:var(--ink)' }, isCurrent ? 'Caderno ativo agora' : 'Disponível localmente')
      );
      cGrid.append(card);
    }
  }
}

function initProfileDrawer() {
  const backdrop = $('#profile-backdrop');
  const openBtn = $('#profile-btn');
  const closeBtn = $('#drawer-close');

  function openDrawer() {
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    updateProfileUI();
  }

  function closeDrawer() {
    backdrop.hidden = true;
    if (!P) document.body.style.overflow = '';
  }

  if (openBtn) openBtn.onclick = openDrawer;
  if (closeBtn) closeBtn.onclick = closeDrawer;
  if (backdrop) {
    backdrop.onclick = e => {
      if (e.target === backdrop) closeDrawer();
    };
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !backdrop.hidden) closeDrawer();
  });

  // Alternância de abas dentro do drawer (Visão Geral, Conquistas, Acesso)
  const tabOver = $('#dtab-overview');
  const tabBadges = $('#dtab-badges');
  const tabAuth = $('#dtab-auth');
  const paneOver = $('#pane-overview');
  const paneBadges = $('#pane-badges');
  const paneAuth = $('#pane-auth');

  function selectDrawerTab(which) {
    if (tabOver) {
      tabOver.classList.toggle('on', which === 'overview');
      tabOver.setAttribute('aria-selected', String(which === 'overview'));
    }
    if (tabBadges) {
      tabBadges.classList.toggle('on', which === 'badges');
      tabBadges.setAttribute('aria-selected', String(which === 'badges'));
    }
    if (tabAuth) {
      tabAuth.classList.toggle('on', which === 'auth');
      tabAuth.setAttribute('aria-selected', String(which === 'auth'));
    }

    if (paneOver) paneOver.classList.toggle('on', which === 'overview');
    if (paneBadges) paneBadges.classList.toggle('on', which === 'badges');
    if (paneAuth) paneAuth.classList.toggle('on', which === 'auth');

    if (which === 'badges') renderBadgesUI();
  }

  if (tabOver) tabOver.onclick = () => selectDrawerTab('overview');
  if (tabBadges) tabBadges.onclick = () => selectDrawerTab('badges');
  if (tabAuth) tabAuth.onclick = () => selectDrawerTab('auth');

  // Alternador de Som do Estúdio
  const soundBtn = $('#sound-toggle-btn');
  if (soundBtn) {
    soundBtn.onclick = () => {
      AudioFX.enabled = !AudioFX.enabled;
      updateSoundBtn();
      if (AudioFX.enabled) AudioFX.playSuccess();
    };
  }

  // Salvar nome
  const saveBtn = $('#id-save-btn');
  const nameInput = $('#id-name-input');
  if (saveBtn && nameInput) {
    saveBtn.onclick = async () => {
      const newName = nameInput.value.trim();
      if (!newName) return;
      saveBtn.disabled = true;
      try {
        const res = await StudyAPI.request('/api/profile', {full_name:newName});
        if (res.profile) {
          S.profile = res.profile;
          updateProfileUI();
        }
      } catch (e) {}
      saveBtn.disabled = false;
    };
  }

  // Seletor de Tema no Drawer
  document.querySelectorAll('.theme-choice-btn').forEach(btn => {
    btn.onclick = () => {
      const themeVal = btn.dataset.themeVal;
      ThemeManager.apply(themeVal, true);
    };
  });


}

/* ------------------------------------------------ Inicialização */
ThemeManager.init();
initProfileDrawer();
applyCourseTheme(S.lang);
// Initialized after verified login by platform.js.

function mediaFailure(anchor, retry) {
  if (!anchor || !anchor.parentElement) return;
  const parent = anchor.parentElement;
  parent.querySelector('.media-error')?.remove();
  const notice = h('div', {class: 'media-error', role: 'alert'},
    h('span', {}, 'Não foi possível reproduzir esta mídia. Você pode tentar novamente ou continuar a aula.'),
    h('button', {type: 'button', class: 'abtn', onclick: () => {notice.remove(); retry();}}, 'Tentar novamente'));
  parent.append(notice);
}
