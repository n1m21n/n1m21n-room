// Resume probe: snapshot at an odd time, restore into a fresh core, advance; the events after the snapshot must equal a
// straight-through run of the same seed (journals get trimmed, so only post-snapshot events are compared).
// usage: node tools/sim/resume_probe.mjs [--n=40] [--at=2.37] [--more=3]   (at, more in days)
import { makeSimCore } from '../../site/src/sim/core.js';
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1] ?? d;
const N = +arg('n', 40), AT = +arg('at', 2.37), MORE = +arg('more', 3);
const key = e => JSON.stringify(e);
let bad = 0, withIntent = 0;
for (let s = 1; s <= N; s++) {
  const at = Math.round((AT + (s % 7) * 0.13) * 1440), end = at + MORE * 1440;
  const a = makeSimCore({ seed: s, withGrid: false });
  a.advance(at); const snap = JSON.parse(JSON.stringify(a.snapshot())); const seq0 = a.journal.at(-1)?.seq ?? 0;
  if (snap.intents?.held?.length) withIntent++;
  const tail = [];
  const grab = (c, from) => { for (const e of c.journal) if (e.seq > from) tail.push(e); return c.journal.at(-1)?.seq ?? from; };
  let last = seq0; for (let t = at; t < end; t += 720) { a.advance(720); last = grab(a, last); }
  const ref = tail.splice(0);
  const b = makeSimCore({ seed: snap.seed, withGrid: false }); b.restore(snap);   // a core is always rebuilt from its own seed (hazards and plan draws are keyed on it)
  last = seq0; for (let t = at; t < end; t += 720) { b.advance(720); last = grab(b, last); }
  const i = ref.findIndex((e, k) => key(e) !== key(tail[k]));
  const same = i < 0 && ref.length === tail.length && JSON.stringify(a.intents.snapshot()) === JSON.stringify(b.intents.snapshot());
  if (!same) { bad++; console.log(`seed ${s}: diverges at event ${i}`, ref[i], tail[i]); }
}
console.log(`resume probe: ${N - bad}/${N} seeds equal (${withIntent} snapshots held intentions)${bad ? ' FAIL' : ' PASS'}`);
process.exit(bad ? 1 : 0);
