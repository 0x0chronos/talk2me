const {test} = require('node:test');
const assert = require('node:assert/strict');
const p = require('../mobile/progress.js');
const user = {id:'alice', email:'alice@example.test', full_name:'Alice'};
const ids = new Set(['lesson-1', 'lesson-2']);
const event = {id:'lesson-1', stars:3, score:100, xp:25, event_id:'event-1'};

test('conclusion is idempotent, isolates people, and preserves the best result', () => {
  const a = p.create(user), b = p.create({...user, id:'bob'});
  assert.equal(p.finish(a, event, ids, '2026-11-14').gained, 25);
  assert.equal(p.finish(a, event, ids, '2026-11-14').gained, 0);
  assert.equal(p.profile(a).xp, 25);
  assert.equal(p.profile(b).xp, 0);
  p.finish(a, {...event, stars:1, score:50, event_id:'event-2'}, ids, '2026-11-15');
  assert.equal(a.progress['lesson-1'].stars, 3);
  assert.equal(p.profile(a).streak, 2);
  assert.equal(p.profile(a).stats.es, 1);
});

test('resume is removed only for the concluded lesson', () => {
  const a = p.create(user);
  p.resume(a, {lang:'es', lesson_id:'lesson-2', step_index:4, level:'A1'}, ids);
  p.finish(a, event, ids, '2026-11-14');
  assert.equal(p.profile(a).resume.es.lessonId, 'lesson-2');
  p.finish(a, {...event, id:'lesson-2', event_id:'event-2'}, ids, '2026-11-14');
  assert.deepEqual(p.profile(a).resume, {});
});

test('backup roundtrip retains history, resume, preferences, and deduplication', () => {
  const a = p.create(user);
  p.finish(a, event, ids, '2026-11-14');
  p.resume(a, {lang:'es', lesson_id:'lesson-2', step_index:7, level:'A1'}, ids);
  p.preferences(a, {full_name:'Alice N.', theme_pref:'dark', daily_goal_xp:80});
  const file = p.backup(a);
  const restored = p.restore(JSON.stringify(file), user, ids);
  assert.deepEqual(p.profile(restored), p.profile(a));
  assert.equal(p.finish(restored, event, ids, '2026-11-14').gained, 0);
  assert.ok(!JSON.stringify(file).includes('password'));
});

test('invalid or foreign backup cannot alter the existing state', () => {
  const a = p.create(user);
  p.finish(a, event, ids, '2026-11-14');
  const snapshot = JSON.stringify(a);
  const file = p.backup(a);
  assert.throws(() => p.restore(JSON.stringify(file), {...user, id:'bob'}, ids));
  file.state.progress['lesson-1'].stars = 9;
  assert.throws(() => p.restore(JSON.stringify(file), user, ids));
  assert.equal(JSON.stringify(a), snapshot);
  assert.throws(() => p.restore('{broken', user, ids));
  assert.throws(() => p.restore(JSON.stringify({...file, version:90}), user, ids));
});

test('unknown lessons and impossible dates are rejected', () => {
  const a = p.create(user);
  assert.throws(() => p.finish(a, {...event, id:'missing'}, ids, '2026-11-14'));
  assert.throws(() => p.finish(a, event, ids, '2026-02-30'));
  assert.equal(p.profile(a).xp, 0);
});
