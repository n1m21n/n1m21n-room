// Short beats: a long act (110 min at the desk, an hour of TV) is played as a loop of small things he does now and
// then, picked for the act and his mood, so a viewer who drops in for a minute sees him live it. Visual only: the sim
// still decides what he does and for how long (life.json and the core are untouched).
//
// The schedule runs on the wall clock, not on when this tab sat him down, so every viewer (and the stream) sees the
// same beat at the same moment: each hour is cut into slots of 25-55 s (the last up to 80 s); a slot opens with a beat of 5-8 s (a sleeping
// turn-over 10 s) when its dice and his mood say so. A beat is a partial pose laid over the act's own pose with an
// ease in / out: fk targets, fkAdd offsets, ik points (an array is a height off the floor, a function is on his own
// body), hand directions, grip, face, props (mug), and pause (the act's tempo clock stops: hands rest, then go again).
import { actKit } from './acts.js';
const { S, ease, lerp3, add, mixH, mouth, onKnee, KNEE_HAND } = actKit;

// ---- deterministic dice: one hash of (hour, slot, salt) -> [0, 1)
function hash(...xs) {
  let h = 2166136261;
  for (const x of xs) for (const c of String(x)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); h ^= h >>> 13; }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const GAP = [25, 55], LEN = [5, 8];
const HOUR = 3600e3, slotCache = new Map();
function slotsOf(h) {                                       // [start ms, end ms] of every slot in hour h
  let s = slotCache.get(h); if (s) return s;
  s = []; const end = (h + 1) * HOUR;                       // a tail too short for a slot joins the last one
  for (let at = h * HOUR, i = 0; at < end; i++) { const d = (GAP[0] + (GAP[1] - GAP[0]) * hash(h, i, 'gap')) * 1000, e = end - (at + d) < GAP[0] * 1000 ? end : at + d; s.push([at, e]); at = e; }
  if (slotCache.size > 6) slotCache.delete(slotCache.keys().next().value);
  slotCache.set(h, s); return s;
}
export function slotAt(ms) {
  const h = Math.floor(ms / HOUR), s = slotsOf(h);
  let lo = 0, hi = s.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m][0] <= ms) lo = m; else hi = m - 1; }
  return { h, i: lo, start: s[lo][0], end: s[lo][1] };
}

// ---- his mood, as the beats see it: tired / stressed / bored / focused / calm, from the shared life's state
const TIRED = new Set(['drowsy', 'dazed', 'given_up', 'sleep']), STRESSED = new Set(['anxious', 'frustrated', 'uneasy', 'alarm', 'embarrassed']);
const BORED = new Set(['bored', 'restless', 'lonely', 'sad']), FOCUSED = new Set(['absorbed', 'curious', 'content', 'proud', 'triumph', 'awe', 'aesthetic_appreciation', 'delighted', 'joyful']);
export function moodClass({ emotion, affect, motives, clock } = {}) {
  if (TIRED.has(emotion) || (motives?.energy ?? 1) < 0.3 || clock === 'tired' || clock === 'groggy') return 'tired';
  if (STRESSED.has(emotion) || (affect?.stress ?? 0) > 0.5) return 'stressed';
  if (BORED.has(emotion)) return 'bored';
  if (FOCUSED.has(emotion)) return 'focused';
  return 'calm';
}
const PLAY = { tired: 0.9, stressed: 0.9, bored: 1, focused: 0.45, calm: 0.75 };   // odds a slot gets a beat: focused, he keeps at it

// ---- the beats. pose(u, t, base, k) -> overlay; u = seconds into the beat, k = how far in it is blended. Seated ones are new; the standing micro acts
// (yawn, stretch, sip ...) stay as they were in acts.js.
const HEAD = (x, y, z) => B => add(B('head'), [x, y, z]);
const BEATS = {
  // desk / seated: leans back in the chair, hands laced up over his head, a long stretch
  lean_back: { pose: (u, t, base, k) => { const f = 0.34 * (1 - k) ** 0.5; return { face: u > 1.5 && u < 5 ? 'sleep' : 'calm', fkAdd: { spine: [-0.2, 0, S(u * 1.2) * 0.05], chest: [-0.12, 0, 0], neck: [-0.1, 0, 0], head: [-0.2, 0, 0] },
    ik: { handL: HEAD(0.09 + f * 0.3, 0.5, 0.06 + f), handR: HEAD(-0.09 - f * 0.3, 0.5, 0.06 + f) }, hand: { handL: [[-0.3, 1, 0], [-1, 0, 0]], handR: [[0.3, 1, 0], [1, 0, 0]] }, grip: { handL: 'flat', handR: 'flat' },
    pole: { handL: [0.5, 0.1, -0.2], handR: [-0.5, 0.1, -0.2] } }; } },          // hands rise in front of his face, then over
  // a sip from the mug (the one he keeps by the keyboard), then back to it
  sip: { pose: u => { const s = Math.max(0, S((u - 1.4) * 0.9)) ** 2, p = 0.05 - 0.15 * s; return { face: s > 0.5 ? 'sleep' : 'calm', mug: true, fkAdd: { neck: [-0.06 * s, 0, 0], head: [-0.1 * s, 0, 0] },
    ik: { handR: B => lerp3(add(B('head'), [-0.1, -0.32, 0.3]), add(mouth(B, p), [-0.06, -0.05, 0.11]), s) }, hand: { handR: [[0, 0.15, 1], [1, 0, 0]] }, grip: { handR: 'hold' }, pole: { handR: [-0.55, -0.25, -0.3] } }; } },
  // rubs his eyes with both hands, head dipping into them
  rub_eyes: { pose: u => { const r = S(u * 7) * 0.012; return { face: 'dazed', fkAdd: { spine: [0.06, 0, 0], neck: [0.1, 0, 0], head: [0.12, 0, 0] },
    ik: { handL: HEAD(0.045 + r, 0.12, 0.27), handR: HEAD(-0.045 - r, 0.12, 0.27) }, hand: { handL: [[-0.2, 1, 0.1], [0, 0, -1]], handR: [[0.2, 1, 0.1], [0, 0, -1]] },
    grip: { handL: 'cup', handR: 'cup' }, pole: { handL: [0.5, -0.3, -0.2], handR: [-0.5, -0.3, -0.2] } }; } },
  // a yawn sitting down: hand to the mouth, head back
  yawn: { pose: () => ({ face: 'dazed', fkAdd: { spine: [-0.05, 0, 0], neck: [-0.12, 0, 0], head: [-0.22, 0, 0] },
    ik: { handR: HEAD(0, -0.01, 0.19) }, hand: { handR: [[0.4, 1, 0], [0, 0, -1]] }, grip: { handR: 'cup' }, pole: { handR: [-0.5, -0.5, 0] } }) },
  // looks over his right shoulder out of the window and back
  look_out: { pose: u => ({ face: 'curious', fkAdd: { spine: [0, -0.18, 0], chest: [0, -0.12, 0], neck: [0, -0.3, 0], head: [-0.06, -0.45 + S(u * 0.8) * 0.06, 0] } }) },
  // restless: jiggles, drums the fingers, looks round
  fidget: { pose: (u, t) => ({ face: 'uneasy', fkAdd: { hips: [0, S(t * 0.9) * 0.05, 0], spine: [0, S(t * 1.1) * 0.06, 0], head: [0, S(t * 1.3) * 0.25, 0] }, fingers: Math.max(0, S(t * 14)) * 0.6 }) },
  sigh: { pose: u => { const k = ease(u / 1.2) * (1 - ease((u - 2.5) / 1.5)); return { face: 'given_up', fkAdd: { spine: [0.08 * k, 0, 0], chest: [0.06 * k, 0, 0], neck: [0.12 * k, 0, 0], head: [0.15 * k, 0, 0] } }; } },
  // TV: something funny, he leans in and laughs, shoulders shaking
  laugh: { pose: (u, t) => ({ face: 'delighted', fkAdd: { spine: [0.18, 0, 0], chest: [0.06 + S(t * 16) * 0.025, 0, 0], head: [-0.08 + S(t * 16) * 0.03, 0, 0] } }) },
  // TV: reaches for a snack from the bowl at his left and eats it
  snack: { pose: u => { const m = ease((u - 2) / 1), b = 1 - ease((u - 4.2) / 0.8), c = m * b; return { face: c > 0.5 ? 'delighted' : 'curious', fkAdd: { spine: [0.06 * (1 - c), 0.1 * (1 - c), 0] },
    ik: { handL: B => lerp3([0.42, 0.62, 0.28], add(mouth(B, 0.1), [0.04, -0.03, 0.04]), c) }, hand: { handL: mixH([[0, -0.6, 0.8], [0, -1, 0]], [[-0.4, 0.3, -1], [0, 1, 0]], c) }, grip: { handL: c > 0.2 ? 'hold' : 'relax' },
    pole: { handL: [0.55, -0.4, -0.2] } }; } },
  // shifts his weight in the bean bag
  shift: { pose: u => { const k = S(u / 6 * Math.PI); return { fkAdd: { hips: [0, 0.12 * k, 0.05 * k], spine: [0.05 * k, -0.1 * k, -0.06 * k], head: [0, 0.08 * k, 0] } }; } },
  // reading: looks up from the page and thinks
  look_up: { pose: u => ({ face: 'curious', fkAdd: { neck: [-0.26, 0, 0], head: [-0.36, 0.25 + S(u * 0.6) * 0.1, 0.06] } }) },
  // standing: shifts his weight onto the other leg (stance changes how he stands)
  weight: { pose: u => { const k = S(u / 7 * Math.PI); return { fkAdd: { hips: [0, 0.08 * k, 0.035 * k], spine: [0, 0, -0.05 * k], head: [0, 0, 0.05 * k] } }; } },
  // keys / guitar: stops, listens back to the bit, then has another go (the tempo clock halts, so the sound stops too)
  retry: { pause: 1, pose: u => ({ face: u < 3 ? 'curious' : 'calm', fkAdd: { neck: [-0.08, 0, 0.06], head: [-0.12, S(u * 0.7) * 0.1, 0.12] } }) },
  // keys / guitar: nods along to it
  nod: { pose: (u, t) => ({ face: 'delighted', fkAdd: { neck: [Math.max(0, S(t * 7.5)) * 0.1, 0, 0], head: [Math.max(0, S(t * 7.5)) * 0.1, 0, 0] } }) },
  glance: { pose: u => ({ face: 'curious', fkAdd: { neck: [0, S(u * 0.9) * 0.25, 0], head: [-0.04, S(u * 0.9) * 0.4, 0] } }) },
  // asleep: turns over onto his side and back, a slow roll with the knees drawn up
  turn_over: { len: 10, pose: u => { const k = S(u / 10 * Math.PI) ** 2; return { fkAdd: { hips: [0, 0, 0.4 * k], spine: [0, 0, 0.12 * k], thighL: [0.5 * k, 0, 0], thighR: [0.35 * k, 0, 0], shinL: [-0.7 * k, 0, 0], shinR: [-0.5 * k, 0, 0], head: [0, 0.35 * k, 0] } }; } },
};

export const BEAT_IDS = Object.keys(BEATS), beatLen = id => BEATS[id].len || null;

// ---- which beats each act plays, weighted by mood [tired, stressed, bored, focused, calm]
const W = (tired, stressed, bored, focused, calm) => ({ tired, stressed, bored, focused, calm });
const SEATED_HANDS = { lean_back: W(2, 1, 1, 1, 2), sip: W(2, 1, 1, 1, 2), rub_eyes: W(3, 2, 0, 0, 1), yawn: W(3, 0, 1, 0, 0), look_out: W(1, 1, 3, 1, 2), fidget: W(0, 3, 3, 0, 0), sigh: W(1, 2, 1, 0, 0) };
export const TABLE = {
  desk: SEATED_HANDS,
  write: { look_out: W(1, 1, 2, 1, 2), sigh: W(1, 2, 1, 0, 0), rub_eyes: W(2, 1, 0, 0, 1) },
  tv: { laugh: W(1, 1, 1, 3, 3), snack: W(1, 2, 2, 1, 2), shift: W(2, 2, 3, 1, 1), yawn: W(3, 0, 1, 0, 0), sigh: W(1, 1, 1, 0, 0) },
  read: { look_up: W(1, 1, 1, 3, 2), weight: W(1, 2, 2, 1, 2), sigh: W(2, 1, 1, 0, 0) },
  keys: { retry: W(1, 2, 1, 3, 2), nod: W(0, 0, 1, 3, 3), sigh: W(2, 1, 1, 0, 0) },
  guitar: { retry: W(1, 2, 1, 3, 2), nod: W(0, 0, 1, 3, 3), sigh: W(2, 1, 1, 0, 0) },
  bed: { turn_over: W(1, 1, 1, 1, 1) },
  nap: { glance: W(1, 1, 1, 1, 1) },
  bench: { glance: W(1, 1, 2, 2, 2), sigh: W(1, 1, 1, 0, 0) },
  stool: { glance: W(1, 1, 2, 2, 2), sigh: W(1, 1, 1, 0, 0) },
  eat: { glance: W(1, 1, 2, 1, 2) },
  think: { weight: W(1, 1, 1, 1, 1) },
  pin: { weight: W(1, 1, 1, 1, 1), glance: W(1, 1, 1, 1, 1) },
  tea: { glance: W(1, 1, 1, 1, 1), weight: W(1, 1, 1, 1, 1) },
  cook: { glance: W(1, 1, 1, 1, 1) },
  phone: { weight: W(1, 1, 1, 1, 1) },
  paint: { glance: W(1, 1, 1, 1, 1) },                     // brush on the canvas: only his eyes wander
};
const ODDS = { bed: 0.12 };                                  // asleep he mostly lies still: a turn over every few minutes

// the beat (if any) playing at wall-clock ms for this act: { id, u, len, k } or null. mood() is asked once per slot.
const picked = new Map();
export function beatAt(act, ms, mood) {
  const tab = TABLE[act]; if (!tab) return null;
  const sl = slotAt(ms), key = act + ':' + sl.h + ':' + sl.i;
  let p = picked.get(key);
  if (p === undefined) {
    const m = mood ? mood() : 'calm';
    p = null;
    if (hash(sl.h, sl.i, act, 'play') < (ODDS[act] ?? PLAY[m])) {
      const opts = Object.entries(tab).map(([id, w]) => [id, w[m] ?? 0]).filter(([, w]) => w > 0), sum = opts.reduce((s, [, w]) => s + w, 0);
      let r = hash(sl.h, sl.i, act, 'pick') * sum; for (const [id, w] of opts) if ((r -= w) < 0) { p = id; break; }
    }
    if (picked.size > 64) picked.delete(picked.keys().next().value);
    picked.set(key, p);
  }
  if (!p) return null;
  const len = BEATS[p].len || LEN[0] + (LEN[1] - LEN[0]) * hash(sl.h, sl.i, 'len'), u = (ms - sl.start) / 1000;
  if (u > len) return null;
  return { id: p, u, len, k: ease(u / 0.8) * (1 - ease((u - len + 0.9) / 0.9)) };
}

// lay a beat over an act's spec (k = 0 base pose, 1 full beat)
const res = (v, spec) => typeof v === 'function' ? v : (spec.lie ? () => v : () => [v[0], v[1] - (spec.y || 0), v[2]]);
export function overlay(base, o, k) {
  if (k <= 0) return base;
  const out = { ...base, fk: { ...base.fk } };
  for (const [n, v] of Object.entries(o.fk || {})) out.fk[n] = lerp3(base.fk?.[n] || [0, 0, 0], v, k);
  for (const [n, v] of Object.entries(o.fkAdd || {})) out.fk[n] = add(out.fk[n] || [0, 0, 0], v.map(x => x * k));
  if (o.ik) {
    out.ik = { ...base.ik }; out.hand = { ...base.hand }; out.pole = { ...base.pole }; out.grip = { ...base.grip }; out.follow = { ...base.follow };
    for (const [eff, v] of Object.entries(o.ik)) {
      const from = base.ik?.[eff], to = res(v, base);
      if (from && !base.follow?.[eff]) { const f = res(from, base); out.ik[eff] = B => lerp3(f(B), to(B), k); }
      else { out.ik[eff] = to; delete out.follow[eff]; }
      if (o.hand?.[eff]) out.hand[eff] = base.hand?.[eff] ? mixH(base.hand[eff], o.hand[eff], k) : o.hand[eff];
      if (o.pole?.[eff]) out.pole[eff] = base.pole?.[eff] ? lerp3(base.pole[eff], o.pole[eff], k) : o.pole[eff];
      if (o.grip?.[eff] && k > 0.5) out.grip[eff] = o.grip[eff];
    }
  }
  if (o.fingers != null) out.fingers = (base.fingers || 0) + o.fingers * k;
  if (o.face && k > 0.4) out.face = o.face;
  if (o.mug && k > 0.3) out.mug = true;
  return out;
}

// the act's spec this frame with its beat on top; also halts the act clock while a pause beat holds
// (sp.t / sp.tt: seconds since he sat / his tempo clock, advanced by player.js before this)
export function makeBeats({ mood = () => 'calm', now = () => Date.now() } = {}) {
  const st = { beat: null };
  let forced = null;                                         // dev / stills / tests: { id ('' = none), at: sp.t it starts }
  function spec(sp, dt, t, act) {
    let b, settle;
    if (forced) {
      const u = sp.t - forced.at, len = BEATS[forced.id]?.len || 6.5;
      b = forced.id && u >= 0 && u <= len ? { id: forced.id, u, len, k: ease(u / 0.8) * (1 - ease((u - len + 0.9) / 0.9)) } : null; settle = 1;
    } else { b = beatAt(sp.act, now(), mood); settle = ease((sp.t - 2.5) / 1.5); }      // none while he is still sitting down
    st.beat = b && settle > 0 ? b : null;
    if (st.beat && BEATS[b.id].pause) sp.tt -= dt * (sp.tempo || 1) * b.k * settle;
    const base = act(sp.t, t, sp);
    if (!st.beat) return base;
    return overlay(base, BEATS[b.id].pose(b.u, t, base, b.k * settle), b.k * settle);
  }
  return { spec, force: (id, at = 1.5) => { forced = id == null ? null : { id, at }; }, get beat() { return st.beat; } };
}

// ---- real breaks: so the feed changes every 5-10 min, each hour is cut into 8 blocks of 5-10 min (wall clock, the same
// for every viewer) and each block ends with a short trip somewhere else in the flat, then back to the act. Where he
// goes depends on the act and his mood, never the same place twice running. Wraps the spot picker; the sim's act (what
// the shared life says he is doing) is unchanged, so this is visual only.
export const BREAK = { per: 8, jit: 75 };                  // 8 blocks an hour of 450 s, each boundary +-75 s: blocks 300-600 s
const TRIP = { window: 40, plant: 45, records: 40, snake: 45, pace: 40, read: 50, tea: 75, fridge: 75 };   // seconds away, walking included
const GOES = {                                             // destination weights by mood [tired, stressed, bored, focused, calm]
  window: W(2, 2, 1, 2, 2), tea: W(3, 1, 1, 2, 1), fridge: W(1, 1, 2, 0, 1), plant: W(1, 1, 1, 1, 2), records: W(0, 1, 2, 0, 1),
  snake: W(1, 2, 2, 0, 1), pace: W(0, 3, 1, 1, 0), read: W(1, 0, 1, 1, 1),
};
export const BREAKS_FROM = {                               // the acts (spots) that take breaks, and where they may go
  work: ['window', 'tea', 'fridge', 'plant', 'records', 'snake', 'pace'],
  tv: ['window', 'tea', 'fridge', 'snake', 'records', 'plant'],
  read: ['window', 'tea', 'snake', 'plant', 'pace'],
  keys: ['window', 'tea', 'records', 'snake', 'pace'],
  guitar: ['window', 'tea', 'records', 'snake', 'pace'],
  easel: ['window', 'tea', 'records', 'pace', 'plant'],
  write: ['window', 'tea', 'plant', 'pace'],
  bench: ['window', 'plant', 'records'],
  phone: ['window', 'pace'],
  eat: ['fridge', 'window'],
  snake: ['window', 'records', 'plant'],
  records: ['window', 'snake', 'plant'],
  window: ['plant', 'records', 'snake'],
};
function blocksOf(h) {                                     // [start, end] ms of each block of hour h
  const b = [h * HOUR]; for (let j = 1; j < BREAK.per; j++) b.push(h * HOUR + (j + (2 * hash(h, j, 'blk') - 1) * BREAK.jit / (HOUR / BREAK.per / 1000)) * HOUR / BREAK.per);
  b.push((h + 1) * HOUR); return b.slice(0, -1).map((s, j) => [s, b[j + 1]]);
}
const chainCache = new Map();
function chainOf(day, act, m) {                            // the day's destinations for this act, block by block, no repeats
  const key = day + ':' + act + ':' + m; let c = chainCache.get(key); if (c) return c;
  const opts = (BREAKS_FROM[act] || []).map(d => [d, (GOES[d][m] || 0) + 0.25]);   // a floor: every place stays possible, so there is always one that isn't the last
  let prev = day > 0 && chainCache.has((day - 1) + ':' + act + ':' + m) ? chainCache.get((day - 1) + ':' + act + ':' + m).at(-1) : null;
  c = [];
  for (let n = 0; n < 24 * BREAK.per; n++) {
    const o = opts.filter(([d]) => d !== prev), sum = o.reduce((s, [, w]) => s + w, 0);
    let r = hash(day, n, act, 'goes') * sum, pick = o[0]?.[0] ?? null; for (const [d, w] of o) if ((r -= w) < 0) { pick = d; break; }
    c.push(pick); prev = pick;
  }
  if (chainCache.size > 32) chainCache.delete(chainCache.keys().next().value);
  chainCache.set(key, c); return c;
}
// the break (if any) at wall-clock ms for an act: { to, start, end, block } or null
export function breakAt(ms, act, mood = 'calm') {
  if (!BREAKS_FROM[act]) return null;
  const h = Math.floor(ms / HOUR), bl = blocksOf(h), j = bl.findIndex(([s, e]) => ms >= s && ms < e), [s, e] = bl[j];
  const day = Math.floor(h / 24), to = chainOf(day, act, mood)[(h % 24) * BREAK.per + j]; if (!to) return null;
  const len = (TRIP[to] || 45) * 1000;
  return ms >= e - len ? { to, start: e - len, end: e, block: [s, e] } : null;
}
export function withBreaks(chooser, { now = () => Date.now(), mood = () => 'calm' } = {}) {
  if (!chooser) return chooser;
  let held = null;                                         // the break under way: { act, to, end } (so the mood can't switch it mid-trip)
  return { ...chooser, next(current, spots) {
    const w = chooser.next(current, spots), t = now();
    if (held && t < held.end && held.act === w) return held.to;
    held = null;
    const b = w && BREAKS_FROM[w] ? breakAt(t, w, mood()) : null;
    if (b && spots[b.to] && b.to !== w) { held = { act: w, to: b.to, end: b.end }; return b.to; }
    return w;
  } };
}
