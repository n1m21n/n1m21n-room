// Short-beat tests (node, no browser): the wall-clock schedule (slots 25-55 s, beats 5-8 s, breaks every 5-10 min), every
// viewer sees the same beat, mood shapes the picks, every act's table is playable. Physics of the poses: physics P8.
// node tests/beats.mjs
import { slotAt, beatAt, breakAt, withBreaks, moodClass, TABLE, BEAT_IDS, GAP, LEN, BREAKS_FROM } from '../src/beats.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const T0 = Date.UTC(2026, 9, 18, 0, 0, 0), DAY = 864e5;

// slots tile the day, each 25-55 s
{ let prev = null, bad = 0, n = 0, long = 0;
  for (let ms = T0; ms < T0 + DAY; ms += 500) { const s = slotAt(ms); if (prev && s.start !== prev.start) { n++; if (s.start !== prev.end) bad++; const d = (s.end - s.start) / 1000; if (d < GAP[0] || d > GAP[1] + GAP[0]) bad++; if (d > GAP[1]) long++; } prev = s; }
  ok(!bad, `slots tile the day, 25-55 s (the last of an hour up to 80 s): ${bad} bad`); ok(n > 1440 && n < 3500, `slots per day ${n}`); ok(long <= 24, `long slots ${long} (one an hour at most)`); }

// a beat lasts 5-8 s (a turn over 10 s), starts at its slot, and is the same however it is asked (a viewer who drops in late)
{ const seen = {}, lens = [];
  for (const act of Object.keys(TABLE)) for (let ms = T0; ms < T0 + DAY; ms += 5000) {
    const b = beatAt(act, ms, () => 'calm'); if (!b) continue;
    seen[act + '/' + b.id] = 1; if (b.u < 0.1) lens.push([b.id, b.len]);
    ok(b.u >= 0 && b.u <= b.len && b.k >= 0 && b.k <= 1, `beat window ${act} ${b.id}`);
  }
  ok(lens.every(([id, l]) => id === 'turn_over' ? l === 10 : l >= LEN[0] && l <= LEN[1]), 'beat lengths 5-8 s (turn over 10 s)');
  const a = beatAt('desk', T0 + 1234567, () => 'calm'), b = beatAt('desk', T0 + 1234567, () => 'tired');   // the pick is kept for the slot
  ok(JSON.stringify(a) === JSON.stringify(b), 'one pick per slot: every viewer sees the same beat');
  for (const id of new Set(Object.values(TABLE).flatMap(t => Object.keys(t)))) ok(BEAT_IDS.includes(id), `beat ${id} exists`);
  console.log('beats seen over a day:', Object.keys(seen).length); }

// mood: focused plays fewer beats than bored; tired leans on yawns / eye rubs, stressed on fidgets
{ const count = (m, f) => { let n = 0, hits = {}; for (let ms = T0 + 7 * DAY; ms < T0 + 9 * DAY; ms += 60e3) { const b = beatAt('desk', ms, () => m); if (b && b.u < 60) { n++; hits[b.id] = (hits[b.id] || 0) + 1; } } return f ? hits : n; };
  // beatAt caches a pick per slot, so use separate days per mood
  const day = (m, d) => { const hits = {}; let n = 0; const seenSlot = new Set(); for (let ms = T0 + d * DAY; ms < T0 + (d + 1) * DAY; ms += 5000) { const s = slotAt(ms), k = s.h + ':' + s.i; if (seenSlot.has(k)) continue; seenSlot.add(k); const b = beatAt('desk', s.start + 10, () => m); if (b) { n++; hits[b.id] = (hits[b.id] || 0) + 1; } } return { n, hits, slots: seenSlot.size }; };
  const f = day('focused', 20), bo = day('bored', 21), ti = day('tired', 22), st = day('stressed', 23);
  ok(f.n < bo.n * 0.7, `focused plays fewer beats (${f.n} vs bored ${bo.n})`);
  ok((ti.hits.yawn || 0) + (ti.hits.rub_eyes || 0) > ti.n * 0.4, `tired: yawns / eye rubs ${(ti.hits.yawn || 0) + (ti.hits.rub_eyes || 0)} of ${ti.n}`);
  ok((st.hits.fidget || 0) > st.n * 0.2, `stressed: fidgets ${st.hits.fidget} of ${st.n}`);
  ok(!f.hits.fidget && !f.hits.yawn, 'focused: no fidget, no yawn');
  const gap = bo.slots ? 86400 / bo.n : 0; console.log(`desk, bored: a beat every ${gap.toFixed(0)} s; focused every ${(86400 / f.n).toFixed(0)} s`); }

// asleep: a turn over every few minutes, not every slot
{ let n = 0; for (let ms = T0 + 30 * DAY; ms < T0 + 31 * DAY; ms += 5000) { const b = beatAt('bed', ms, () => 'calm'); if (b && b.u < 5) n++; }
  const per = 86400 / n; ok(per > 180 && per < 900, `sleep: a turn over every ${per.toFixed(0)} s`); }

// mood classes
ok(moodClass({ emotion: 'drowsy' }) === 'tired' && moodClass({ emotion: 'calm', motives: { energy: 0.2 } }) === 'tired', 'tired');
ok(moodClass({ emotion: 'anxious' }) === 'stressed' && moodClass({ emotion: 'calm', affect: { stress: 0.7 } }) === 'stressed', 'stressed');
ok(moodClass({ emotion: 'bored' }) === 'bored' && moodClass({ emotion: 'absorbed' }) === 'focused' && moodClass({ emotion: 'neutral' }) === 'calm', 'bored / focused / calm');
ok(moodClass({ emotion: 'absorbed', clock: 'tired' }) === 'tired', 'late at night he is tired');

// breaks: 8 blocks an hour of 5-10 min, each ending in a trip somewhere, never the same place twice running; the gap
// between visible changes (leaving, coming back) stays under 10 min for every act that takes breaks, in every mood
{ const gaps = {};
  for (const act of Object.keys(BREAKS_FROM)) for (const m of ['tired', 'stressed', 'bored', 'focused', 'calm']) {
    const ch = []; let prev = null, last = null, rep = 0, trips = 0;
    for (let ms = T0 + 40 * DAY; ms < T0 + 41 * DAY; ms += 1000) { const b = breakAt(ms, act, m), k = b ? b.to + b.start : null; if (k !== prev) { ch.push(ms); if (b) { trips++; if (last === b.to) rep++; last = b.to; } } prev = k; }
    const d = ch.slice(1).map((x, i) => (x - ch[i]) / 1000), mx = Math.max(...d);
    ok(mx <= 600, `${act}/${m}: longest stretch without a change ${mx} s`); ok(!rep, `${act}/${m}: no destination twice running (${rep})`);
    ok(trips >= 24 * 7, `${act}/${m}: ${trips} trips a day`);
    (gaps[act] ||= []).push(...d.filter(x => x > 90));
  }
  for (const [act, d] of Object.entries(gaps)) { d.sort((a, b) => a - b); console.log(`${act.padEnd(8)} gap between changes: median ${(d[d.length >> 1] / 60).toFixed(1)} min, max ${(d.at(-1) / 60).toFixed(1)} min`); }
  const where = {}; for (let ms = T0 + 50 * DAY; ms < T0 + 51 * DAY; ms += 30e3) { const b = breakAt(ms, 'work', 'calm'); if (b) where[b.to] = (where[b.to] || 0) + 1; }
  ok(Object.keys(where).length >= 5, `work trips go to ${Object.keys(where).length} places: ${Object.keys(where).join(', ')}`);
  const spots = { work: {}, tv: {}, window: {}, read: {}, tea: {}, fridge: {}, plant: {}, records: {}, snake: {}, pace: {} };
  let t = 0; const ch = w => withBreaks({ next: () => w, hold: () => 0 }, { now: () => t, mood: () => 'calm' });
  for (let ms = T0 + 60 * DAY; ; ms += 1000) { if (breakAt(ms, 'work', 'calm')) { t = ms + 2000; break; } }
  const to = ch('work').next(null, spots); ok(to !== 'work' && spots[to], `work -> ${to} during a break`);
  const c = ch('work'); c.next(null, spots); ok(c.next(to, spots) === to, 'the trip holds till it ends');
  ok(ch('sleep').next(null, spots) === 'sleep', 'sleep is left alone');
  t += 120e3; ok(ch('work').next(to, spots) === 'work', 'back to work after the break');
  t -= 120e3; ok(ch('loo').next(null, spots) === 'loo', 'short acts are left alone'); }

console.log(`beats: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
