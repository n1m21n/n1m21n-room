// Cross-check: what real people report per activity class (ATUS Well-Being) vs the affect the sim gives him while doing it.
import { makeSimCore } from '../../site/src/sim/core.js';
import { readFileSync } from 'node:fs';
const fit = JSON.parse(readFileSync(new URL('./atus_fit.json', import.meta.url))), map = JSON.parse(readFileSync(new URL('./atus_classes.json', import.meta.url))).acts;
const acc = {};
for (let s = 1; s <= 40; s++) {
  const c = makeSimCore({ seed: s, withGrid: false });
  for (let m = 0; m < 1440 * 6; m += 5) { c.advance(5); if (m < 1440) continue; const k = map[c.doing] || 'other', a = c.affect; (acc[k] ||= { n: 0, v: 0, s: 0, a: 0 }); const o = acc[k]; o.n++; o.v += a.valence; o.s += a.stress; o.a += a.arousal; }
}
const wb = fit.wellbeing, rows = [];
for (const [k, w] of Object.entries(wb)) { const o = acc[k]; if (!o || o.n < 30) continue; rows.push({ cls: k, realHappy: w.happy / 6, realStress: w.stress / 6, simV: o.v / o.n, simS: o.s / o.n, n: o.n }); }
const r = (x, y) => { const mx = x.reduce((a, b) => a + b) / x.length, my = y.reduce((a, b) => a + b) / y.length; let n = 0, dx = 0, dy = 0; x.forEach((v, i) => { n += (v - mx) * (y[i] - my); dx += (v - mx) ** 2; dy += (y[i] - my) ** 2; }); return n / Math.sqrt(dx * dy); };
console.log('class'.padEnd(10), 'real happy', 'sim valence', 'real stress', 'sim stress');
rows.sort((a, b) => b.realHappy - a.realHappy).forEach(x => console.log(x.cls.padEnd(10), x.realHappy.toFixed(2).padStart(10), x.simV.toFixed(2).padStart(11), x.realStress.toFixed(2).padStart(11), x.simS.toFixed(2).padStart(10)));
console.log('\ncorrelation happy~valence', r(rows.map(x => x.realHappy), rows.map(x => x.simV)).toFixed(2), '  stress~stress', r(rows.map(x => x.realStress), rows.map(x => x.simS)).toFixed(2), ' classes:', rows.length);
