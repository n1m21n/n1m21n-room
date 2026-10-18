// Cast tests (node, no browser): every character spec is complete and consistent with its tuning file, its life file and its voice, the characters' sim lives
// are deterministic and different from his, and the awareness rules (bodies, manners, seats) hold. node tests/cast.mjs
import { readdirSync, existsSync } from 'node:fs';
import { makeAwareness, manners, standOff, BODY_R } from '../src/cast/awareness.js';
import { CHARACTERS } from '../src/sim/data/characters.gen.js';
import { makeSimCore } from '../src/sim/core.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const MOTION = ['walk', 'cadence', 'swing', 'sway', 'bounce', 'lean', 'shoulders', 'headTilt', 'breath', 'expressive', 'glance', 'blink', 'tempo', 'face'];
const VOICE = ['NEED_LINES', 'NEED_FIX', 'EMOTION_LINES', 'NEXT_LINES', 'DAY_THOUGHTS', 'ACT_LINES', 'TIME_LINES', 'hourBucket', 'SCROLL_LINES', 'SELF_LINES'];

// specs
const dir = new URL('../src/cast/characters/', import.meta.url), files = readdirSync(dir).filter(f => f.endsWith('.js'));
ok(files.length >= 1, 'at least one character spec');
const sims = {};
for (const f of files) {
  const spec = (await import(new URL(f, dir))).default, id = f.slice(0, -3);
  ok(spec?.id === id, `${f}: spec.id is the file name`);
  for (const k of ['name', 'label', 'profile', 'look', 'lines', 'life', 'spawn', 'intro']) ok(spec?.[k] != null, `${id}: spec.${k}`);
  ok(typeof spec.look === 'function' && typeof spec.lines === 'function', `${id}: look() and lines() are loaders`);
  ok(CHARACTERS[id] && spec.profile === CHARACTERS[id], `${id}: profile is tools/emotions/characters/${id}.json as baked`);
  ok(existsSync(new URL('../public' + spec.life.file, import.meta.url)), `${id}: life file ${spec.life.file} exists (node tools/sim/make_life.mjs --char=${id})`);
  ok(Number.isFinite(spec.life.offsetMs), `${id}: life offset`);
  ok(spec.spawn.at?.length === 2 && Number.isFinite(spec.spawn.heading), `${id}: spawn point and heading`);
  for (const k of Object.keys(spec.profile.motion || {})) ok(MOTION.includes(k), `${id}: unknown motion key ${k}`);
  const L = await spec.lines();
  for (const k of VOICE) ok(L[k] != null, `${id}: voice file exports ${k}`);
  for (const [act, arr] of Object.entries(L.DAY_THOUGHTS || {})) ok(arr.length > 0 && arr.every(s => typeof s === 'string' && s.length < 90), `${id}: DAY_THOUGHTS.${act} are short strings`);
  sims[id] = spec.profile;
}

// their sims: deterministic, in bounds, and their own (not his)
const day = (profile, seed) => { const c = makeSimCore({ profile, seed, withGrid: false }); c.advance(3 * 1440); return JSON.stringify(c.days.map(d => [d.n, d.v, d.s])); };
const his = day(null, 1234);
for (const [id, p] of Object.entries(sims)) {
  ok(day(p, p.seed) === day(p, p.seed), `${id}: same seed, same days`);
  ok(day(p, p.seed) !== his, `${id}: their days are not his`);
  const c = makeSimCore({ profile: p, seed: p.seed, withGrid: false }); c.advance(2 * 1440);
  ok(Object.values(c.motives).every(v => v >= 0 && v <= 1), `${id}: motives stay in 0..1`);
}

// awareness: bodies
const mk = (id, x, z, o = {}) => ({ id, lead: !!o.lead, player: { pos: { x, z }, st: { seated: o.seated || null, spec: null } }, doing: () => o.doing || 'roam', visible: () => o.visible !== false });
const A = makeAwareness(), him = A.add(mk('him', 0, 0, { lead: true })), her = A.add(mk('her', 1, 0)), gone = A.add(mk('away', 0.2, 0, { visible: false }));
const cs = A.circlesFor(her);
ok(cs.length === 1 && cs[0].x === 0 && cs[0].w === 1, 'bodies: the lead is the circle she stays out of, hidden characters are not');
ok(A.circlesFor(him).length === 1 && A.circlesFor(him)[0].w < 1, 'bodies: the lead gives way less than a companion');
her.player.st.seated = { pose: 'lying' }; ok(A.circlesFor(him)[0].r > BODY_R * 2, 'bodies: someone lying down takes more room');
ok(A.othersFor(him).length === 1 && A.othersFor(him)[0].who === 'her', 'gaze: others are places of interest, hidden ones are not');
// manners
for (const d of ['sleep', 'shower', 'loo', 'brush', 'dress']) ok(manners(d) === 'private', `manners: ${d} is private`);
for (const d of ['work', 'keys', 'easel', 'cook']) ok(manners(d) === 'absorbed', `manners: ${d} is absorbed`);
for (const d of ['roam', 'pace', 'window', 'sigh']) ok(manners(d) === 'free', `manners: ${d} is free`);
const gm = d => { him.doing = () => d; return A.canGreet(her, him); };
ok(!gm('sleep').ok && gm('sleep').why === 'busy', 'manners: nobody greets someone asleep');
ok(gm('work').ok && gm('work').how === 'nod', 'manners: someone absorbed is only nodded at');
ok(gm('roam').ok && gm('roam').how === 'wave', 'manners: someone free gets a wave');
ok(!A.canGreet(her, gone).ok, 'manners: nobody is greeted who is not in the room');
// walking up to someone: you stop on your own side
const [sx, sz] = standOff({ x: 3, z: 0 }, { x: 0, z: 0 }, 1.15);
ok(Math.abs(sx - 1.15) < 1e-9 && Math.abs(sz) < 1e-9, 'standOff: stops on the side she comes from');
A.remove('her'); ok(A.members.length === 2 && !A.get('her'), 'members can leave');

console.log(`cast: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
