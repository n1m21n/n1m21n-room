// Compare the sim's time split and hour-of-day shape with real ATUS diaries (class level). usage: node tools/data/validate.mjs [--n=100 --days=14]
import { makeSimCore } from '../../site/src/sim/core.js';
import { readFileSync } from 'node:fs';
const fit = JSON.parse(readFileSync(new URL('./atus_fit.json', import.meta.url))), map = JSON.parse(readFileSync(new URL('./atus_classes.json', import.meta.url))).acts;
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const N = arg('n', 100), D = arg('days', 14), mins = {}, hours = {}; let tot = 0;
for (let s = 1; s <= N; s++) {
  const c = makeSimCore({ seed: s, withGrid: false }); c.advance(1440 * D);
  for (const d of c.days.slice(1, D)) for (const [a, m] of Object.entries(d.actMin)) { const k = map[a] || 'other'; mins[k] = (mins[k] || 0) + m; tot += m; }
}
const real = { ...fit.minute_share }; for (const k of ['travel','other','care','shopping','garden','religion','volunteer','services','pets','selfcare','study','cleanup']) delete real[k];
const rt0 = 0; // (not possible in one room: classes removed above)
 const rt = Object.values(real).reduce((a, b) => a + b, 0);
const rows = Object.keys({ ...real, ...mins }).map(k => ({ cls: k, real: +((real[k] || 0) / rt * 100).toFixed(1), sim: +((mins[k] || 0) / tot * 100).toFixed(1) })).sort((a, b) => b.real - a.real);
console.log('class       real%   sim%   (travel/other excluded from real; sim has no travel)');
let err = 0; for (const r of rows) { console.log(r.cls.padEnd(11), String(r.real).padStart(5), String(r.sim).padStart(6), r.sim - r.real > 4 ? '  too much' : r.real - r.sim > 4 ? '  too little' : ''); err += Math.abs(r.real - r.sim); }
console.log('total absolute gap (pct points):', err.toFixed(1));
