// Chain lab. A chain is any sequence of acts, so there is no fixed list to test: we sample, mine and probe.
//   node tools/sim/chainlab.mjs mine  [--n=300] [--days=14]     sample many lives, count every free chain that happens
//   node tools/sim/chainlab.mjs probe read guitar loo sleep [--hour=21] [--n=300]   how likely is THIS chain, from many starting states
import { makeSimCore } from '../../site/src/sim/core.js';
import { CHAINS } from '../../site/src/sim/data/world.gen.js';
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2), mode = args[0], rest = args.slice(1).filter(a => !a.startsWith('--'));
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? +a.split('=')[1] : d; };
const N = opt('n', 300);

if (mode === 'mine') {
  const D = opt('days', 14), count = new Map(), flow = new Map(), seen = new Set(), curve = [];
  let total = 0;
  for (let s = 1; s <= N; s++) {
    const c = makeSimCore({ seed: s, withGrid: false }); c.advance(1440 * D);
    for (const f of c.freeChains) { total++; count.set(f.seq, (count.get(f.seq) || 0) + 1); flow.set(f.seq, (flow.get(f.seq) || 0) + f.flow); seen.add(f.seq); }
    if ([0.1, 0.25, 0.5, 1].some(q => s === Math.round(N * q))) curve.push({ lives: s, chains: total, distinct: seen.size });
  }
  const gram = n => { const g = new Map(); for (const [q, k] of count) { const a = q.split('>'); for (let i = 0; i + n <= a.length; i++) { const key = a.slice(i, i + n).join('>'); g.set(key, (g.get(key) || 0) + k); } } return [...g].sort((x, y) => y[1] - x[1]); };
  const g2 = gram(2), g3 = gram(3), top = [...count].sort((a, b) => b[1] - a[1]);
  const mass = k => top.slice(0, k).reduce((t, x) => t + x[1], 0) / total;
  const named = Object.entries(CHAINS).map(([id, c]) => ({ id, steps: c.steps.filter(x => !x.optional).map(x => x.act) }));
  const contains = (seq, steps) => { let i = 0; for (const a of seq.split('>')) if (a === steps[i]) i++; return i === steps.length; };
  const isNamed = q => named.filter(n => contains(q, n.steps)).map(n => n.id);
  const once = top.filter(x => x[1] === 1).length;
  const rep = {
    lives: N, days: D, freeChains: total, distinct: seen.size, seenOnce: once, growth: curve,
    massTop10: +mass(10).toFixed(3), massTop100: +mass(100).toFixed(3), massTop1000: +mass(1000).toFixed(3),
    namedCoverage: +(top.filter(x => isNamed(x[0]).length).reduce((t, x) => t + x[1], 0) / total).toFixed(3),
    distinct2gram: g2.length, distinct3gram: g3.length, top2: g2.slice(0, 25).map(([q, n]) => ({ seq: q, n })), top3: g3.slice(0, 25).map(([q, n]) => ({ seq: q, n })),
    top: top.slice(0, 40).map(([q, n]) => ({ seq: q, n, share: +(n / total * 100).toFixed(2), flow: +(flow.get(q) / n).toFixed(2), named: isNamed(q) })),
    unnamedFrequent: top.filter(x => !isNamed(x[0]).length && x[0].split('>').length >= 3).slice(0, 15).map(([q, n]) => ({ seq: q, n })),
  };
  writeFileSync(new URL('./results/chains-mined.json', import.meta.url), JSON.stringify(rep, null, 1));
  console.log(JSON.stringify({ ...rep, top: rep.top.slice(0, 12) }, null, 1));
} else if (mode === 'probe') {
  const seq = rest, hour = opt('hour', 20); if (!seq.length) { console.log('usage: probe act act act ... [--hour=21]'); process.exit(1); }
  const logs = [], step = seq.map(() => []), nexts = {};
  for (let s = 1; s <= N; s++) {
    const c = makeSimCore({ seed: s, withGrid: false });
    c.advance(1440 * (2 + (s % 5)) + hour * 60 - (c.time.tMin % 1440) + 1440 * 0);       // wander a few days, then to the asked hour
    while (c.time.hour < hour - 0.2 || c.time.hour > hour + 1) c.advance(30);
    const cp = c.chainProb(seq); logs.push(cp); seq.forEach((a, i) => { const w = c.actWeights(), sum = Object.values(w).reduce((x, y) => x + y, 0); step[i].push((w[a] || 0) / sum); c.runAct(a); });
    const w = c.actWeights(), sum = Object.values(w).reduce((x, y) => x + y, 0);
    for (const [a, v] of Object.entries(w)) nexts[a] = (nexts[a] || 0) + v / sum / N;
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`chain ${seq.join(' > ')}  from ~${hour}:00, ${N} starting states`);
  console.log('per-step probability (mean):', seq.map((a, i) => `${a} ${(mean(step[i]) * 100).toFixed(1)}%`).join('  '));
  const pm = f => mean(logs.map(x => x[f]));
  console.log(`whole chain probability from a random start state: ${(pm('total') * 100).toFixed(3)}%  (1 in ${Math.round(1 / pm('total'))})   via a planned route ${(pm('planned') * 100).toFixed(3)}%, unplanned ${(pm('free') * 100).toFixed(5)}%`);
  console.log('most likely next:', Object.entries(nexts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([a, p]) => `${a} ${(p * 100).toFixed(0)}%`).join(', '));
} else console.log('modes: mine | probe');
