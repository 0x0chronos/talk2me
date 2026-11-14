/* Shared by the browser and Node tests. No credentials live in this module. */
(function (root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const validId = value => typeof value === 'string' && /^[\w-]{1,120}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
  function requireValue(ok, message = 'Backup inválido ou incompatível.') {
    if (!ok) throw new Error(message);
  }
  function integer(value, min, max) { return Number.isSafeInteger(value) && value >= min && value <= max; }
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0,10) === value;
  }
  function today() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
  }
  function create(user) {
    requireValue(object(user) && validId(user.id), 'Conta inválida.');
    return {
      user: {id:user.id, email:String(user.email || ''), full_name:String(user.full_name || 'Estudante')},
      xp:0, streak:0, longest_streak:0, last_activity_date:null,
      theme_pref:'light', daily_goal_xp:50, progress:{}, resume:{}, activity:{}, events:[]
    };
  }
  function profile(state) {
    return {
      ...state.user, xp:state.xp, streak:state.streak, longest_streak:state.longest_streak,
      last_activity_date:state.last_activity_date, theme_pref:state.theme_pref,
      daily_goal_xp:state.daily_goal_xp, target_language:'es', role:'student',
      resume:copy(state.resume), stats:{es:Object.keys(state.progress).length},
      activity:Object.entries(state.activity).sort(([a],[b])=>b.localeCompare(a)).slice(0,14)
        .map(([day, entry])=>({date:day, ...entry}))
    };
  }
  function finish(state, input, ids, day = today()) {
    requireValue(object(input) && ids.has(input.id) && date(day), 'Aula ou data inválida.');
    requireValue(integer(input.stars,1,3) && integer(input.score,0,100) && integer(input.xp,0,100), 'Resultado inválido.');
    requireValue(validId(input.event_id), 'Identificador de resultado inválido.');
    if (state.events.includes(input.event_id)) return {ok:true, gained:0, duplicate:true, profile:profile(state)};
    const previous = state.progress[input.id];
    const gained = previous ? Math.max(Math.floor(input.xp/4),5) : input.xp;
    state.progress[input.id] = {
      stars:Math.max(previous?.stars || 0,input.stars), score:Math.max(previous?.score || 0,input.score),
      completed_at:day
    };
    if (state.last_activity_date !== day) {
      const delta = state.last_activity_date ? (Date.parse(day)-Date.parse(state.last_activity_date))/86400000 : 0;
      state.streak = delta === 1 ? state.streak + 1 : 1;
      state.last_activity_date = day;
    }
    state.longest_streak = Math.max(state.longest_streak,state.streak);
    state.xp += gained;
    const activity = state.activity[day] || {xp:0, lessons:0};
    state.activity[day] = {xp:activity.xp+gained, lessons:activity.lessons+1};
    if (state.resume.es?.lessonId === input.id) delete state.resume.es;
    state.events.push(input.event_id);
    return {ok:true, gained, profile:profile(state)};
  }
  function resume(state, input, ids) {
    requireValue(object(input) && input.lang === 'es' && ids.has(input.lesson_id) && integer(input.step_index,0,10000), 'Posição inválida.');
    requireValue(typeof input.level === 'string' && input.level.length <= 30, 'Nível inválido.');
    state.resume.es = {lessonId:input.lesson_id, stepIndex:input.step_index, level:input.level};
    return {ok:true};
  }
  function preferences(state, input) {
    if ('full_name' in input) {
      requireValue(typeof input.full_name === 'string' && input.full_name.trim().length > 0 && input.full_name.length <= 100, 'Informe um nome de até 100 caracteres.');
      state.user.full_name = input.full_name.trim();
    }
    if ('theme_pref' in input) {
      requireValue(['light','dark','system'].includes(input.theme_pref), 'Tema inválido.');
      state.theme_pref = input.theme_pref;
    }
    if ('daily_goal_xp' in input) {
      requireValue(integer(input.daily_goal_xp,10,1000), 'Meta inválida.');
      state.daily_goal_xp = input.daily_goal_xp;
    }
    return {ok:true, profile:profile(state)};
  }
  function backup(state) {
    return {format:'talk2me-mobile-progress', version:1, exportedAt:new Date().toISOString(), state:copy(state)};
  }
  function restore(text, user, ids) {
    requireValue(typeof text === 'string' && text.length <= 5 * 1024 * 1024, 'O backup deve ter até 5 MB.');
    let file;
    try { file = JSON.parse(text); } catch { throw new Error('O arquivo não é um backup JSON válido.'); }
    requireValue(object(file) && file.format === 'talk2me-mobile-progress' && file.version === 1);
    const source = file.state;
    requireValue(object(source) && object(source.user));
    requireValue(source.user.id === user.id, 'Este backup pertence a outra conta. Entre na conta correta.');
    const state = create(user);
    requireValue(integer(source.xp,0,100000000) && integer(source.streak,0,100000) && integer(source.longest_streak,source.streak,100000));
    requireValue(source.last_activity_date === null || date(source.last_activity_date));
    preferences(state, {full_name:source.user.full_name, theme_pref:source.theme_pref, daily_goal_xp:source.daily_goal_xp});
    for (const key of ['xp','streak','longest_streak','last_activity_date']) state[key] = source[key];
    requireValue(object(source.progress) && Object.keys(source.progress).length <= 10000);
    for (const [id, entry] of Object.entries(source.progress)) {
      requireValue(validId(id) && ids.has(id) && object(entry), 'O backup contém aulas que não estão nesta edição do curso.');
      requireValue(integer(entry.stars,1,3) && integer(entry.score,0,100) && date(entry.completed_at));
      state.progress[id] = {stars:entry.stars, score:entry.score, completed_at:entry.completed_at};
    }
    requireValue(object(source.resume) && Object.keys(source.resume).every(k=>k === 'es'));
    if (source.resume.es) {
      const r = source.resume.es;
      resume(state, {lang:'es', lesson_id:r.lessonId, step_index:r.stepIndex, level:r.level}, ids);
    }
    requireValue(object(source.activity) && Object.keys(source.activity).length <= 100000);
    for (const [day, entry] of Object.entries(source.activity)) {
      requireValue(date(day) && object(entry) && integer(entry.xp,0,100000000) && integer(entry.lessons,0,100000));
      state.activity[day] = {xp:entry.xp, lessons:entry.lessons};
    }
    requireValue(Array.isArray(source.events) && source.events.length <= 100000 && source.events.every(validId));
    requireValue(new Set(source.events).size === source.events.length);
    state.events = source.events.slice();
    return state;
  }
  const api = {create, profile, finish, resume, preferences, backup, restore, today};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Talk2MeProgress = api;
})(globalThis);
