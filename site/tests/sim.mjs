// Sim tests (node, no browser): determinism, bounds, decay, chains, emotion hysteresis, persistence, catch-up,
// instability neutrality, legacy table equality. node tests/sim.mjs
import { makeSimCore } from '../src/sim/core.js';
import { makeRng } from '../src/sim/rng.js';
import { makeStorage, memoryBackend } from '../src/sim/persist.js';
import { STATION_AFFORDANCES, ACTIVITIES } from '../src/sim/data/activities.gen.js';
import { POSTURE_MATRIX_LEGACY, EMOTIONS } from '../src/sim/data/emotions.gen.js';
import { CHAINS, LEDGER } from '../src/sim/data/world.gen.js';
import { makeEmotionPicker } from '../src/sim/emotion.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const sig = c => JSON.stringify(c.days.map(d => [d.n, d.v, d.s, d.erratic]));

// determinism: same seed -> identical days; different seed -> different
{ const a = makeSimCore({ seed: 7 }), b = makeSimCore({ seed: 7 }), c = makeSimCore({ seed: 8 });
  a.advance(1440 * 3); b.advance(1440 * 3); c.advance(1440 * 3);
  ok(sig(a) === sig(b), 'same seed replays identically'); ok(sig(a) !== sig(c), 'different seed differs'); }

// bounds: motives and traces stay in range over 10 days
{ const c = makeSimCore({ seed: 2 }); c.advance(1440 * 10);
  ok(Object.values(c.motives).every(v => v >= 0 && v <= 1), 'motives in [0,1]');
  ok(Object.values(c.ledger.traces).every(v => Number.isFinite(v) && Math.abs(v) <= 3), 'traces finite and bounded');
  ok(Object.values(c.neuro.vars).every(Number.isFinite), 'neuro finite'); }

// ledger: event raises a trace, it decays, erratic outweighs normal
{ const c = makeSimCore({ seed: 1 }); const L = c.ledger;
  L.write('startle'); const t0 = L.trace('arousal'); ok(t0 > 0, 'startle raises arousal');
  L.step(200); ok(L.trace('arousal') < t0, 'arousal decays');
  ok(LEDGER.kindWeight.erratic > LEDGER.kindWeight.normal, 'erratic weighs more'); }

// chains: completing a normal chain pays; skipping a required step breaks it
{ const c = makeSimCore({ seed: 1 }); const before = c.ledger.entries.length;
  const ev = [...c.chains.observe('shower', 0), ...c.chains.observe('dress', 10)];
  ok(ev.some(e => e.type === 'chain-complete' && e.id === 'shower'), 'shower->dress completes'); ok(c.ledger.entries.length > before, 'chain paid the ledger');
  const c2 = makeSimCore({ seed: 1 }); c2.chains.observe('shower', 0); const e2 = c2.chains.interrupt(5);
  ok(e2.some(e => e.type === 'chain-broken'), 'interrupt breaks a live chain'); }

// emotion picker: hysteresis (no flicker for a tiny nudge) and alarm hold
{ const p = makeEmotionPicker({ rng: makeRng(1) }); const s = { valence: 0.85, arousal: 0.7, stress: 0.1, energy: 0.8, dominance: 0.6 };
  let first = p.pick(s, 10); const nudged = { ...s, valence: s.valence - 0.02 }; ok(p.pick(nudged, 10) === first, 'tiny nudge keeps the emotion');
  p.trigger('alarm'); ok(p.current === 'alarm', 'alarm triggers'); p.pick(s, 5); ok(p.current !== 'alarm', 'alarm releases'); }

// instability neutrality: disabled core equals a core with all lambdas 0
{ const a = makeSimCore({ seed: 9 }), b = makeSimCore({ seed: 9, instability: { enabled: true, lambda: { desire: 0 } } });
  a.advance(1440 * 2); b.advance(1440 * 2); ok(sig(a) === sig(b), 'lambda 0 is exactly neutral'); }
// ... and enabled instability actually changes outcomes
{ const a = makeSimCore({ seed: 9 }), b = makeSimCore({ seed: 9, instability: { enabled: true, lambda: { desire: 1, outcome: 1, action: 1 } } });
  a.advance(1440 * 2); b.advance(1440 * 2); ok(sig(a) !== sig(b), 'instability on changes the run'); }

// persistence + away: round trip restores, and catch-up produces a report and moves the world on
{ const st = makeStorage('t', memoryBackend()); const c = makeSimCore({ seed: 5, storage: st }); c.advance(600); c.save();
  const d = makeSimCore({ seed: 5, storage: st }); const rep = d.boot(Date.now() + 36 * 3600 * 1000);
  ok(rep && rep.awayMinutes === 2160, 'boot reports 36h away'); ok(rep.daysPassed >= 1, 'a day or more passed');
  ok(rep.topActs.length > 0, 'something happened while away'); ok(d.journal.length > 0, 'journal has entries');
  const r1 = makeSimCore({ seed: 5 }); ok(r1.restore(c.snapshot()) && r1.time.tMin === c.time.tMin, 'restore round trip'); }
// very long absence stays cheap and finite
{ const c = makeSimCore({ seed: 5 }); const t = Date.now(); const rep = c.catchUp(90 * 86400); ok(Date.now() - t < 5000, 'a 90-day absence is fast'); ok(Number.isFinite(rep.moodAfter), 'finite after 90 days'); }

// shared character: same moment -> same him, from scratch or from a checkpoint, in any order of visits
{ const { makeLife, LIFE_EPOCH_MS } = await import('../src/sim/life.js'); const { makeSimCore: mk } = await import('../src/sim/core.js');
  const t1 = LIFE_EPOCH_MS + 9 * 86400e3 + 11 * 3600e3, t2 = t1 + 5 * 3600e3;
  const a = makeLife(), b = makeLife(); a.at(t2); const sa = JSON.stringify(a.at(t2).debug().motives), sb = JSON.stringify((b.at(t1), b.at(t2)).debug().motives);
  ok(sa === sb, 'two visitors at different times agree on the same moment');
  const c = mk({ seed: 2026, withGrid: false }); c.advance(7 * 1440); const snap = c.snapshot(); const d = makeLife({ checkpoints: { snaps: [snap] } }); const e = makeLife();
  ok(JSON.stringify(d.at(LIFE_EPOCH_MS + 12 * 86400e3).debug().motives) === JSON.stringify(e.at(LIFE_EPOCH_MS + 12 * 86400e3).debug().motives), 'checkpoint resume equals full replay'); }

// data sanity: legacy tables intact, 22 emotions, every chain act exists
ok(Object.keys(EMOTIONS).length >= 22, '22 emotions'); ok(Object.keys(POSTURE_MATRIX_LEGACY).length >= 8, 'legacy matrix present');
ok(Object.keys(STATION_AFFORDANCES).length === 20, '20 station affordances (water_plant joined)');
for (const [id, ch] of Object.entries(CHAINS)) ok(ch.steps.every(s => ACTIVITIES[s.act]), 'chain acts exist: ' + id);

console.log(`sim: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
