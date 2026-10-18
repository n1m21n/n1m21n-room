// Parameter sweep: find tunings that make the simulated person believable, varied and stable.
//   node sweep.mjs sens     [--n=32 --days=7]                 one-at-a-time sensitivity: which factors move which metrics
//   node sweep.mjs search   [--pop=240 --gens=10 --n=48 --days=7 --cats=body,choice,... --seed=1 --workers=N]
//                           Latin-hypercube start, then cross-entropy refinement (fresh seeds every generation), then
//                           held-out validation of the top candidates on 10x more lives.
//   node sweep.mjs validate FILE [--n=400 --days=14]          re-score a result's best on brand-new seeds
//   node sweep.mjs apply    FILE                              write the best values into tools/emotions/*.json (then run gen.py)
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };

if (!isMainThread) {                                             // ---------- worker ----------
  const { evaluate } = await import('./eval.mjs');
  parentPort.on('message', job => {
    if (job === 'exit') process.exit(0);
    const r = evaluate(job.params, job.opts);
    parentPort.postMessage({ id: job.id, fitness: r.fitness, hardFail: r.hardFail, metrics: r.metrics, detail: r.detail, mix: r.mix });
  });
} else {                                                         // ---------- main ----------
  const { FACTORS, baseline, OBJ } = await import('./eval.mjs');
  const cmd = process.argv[2] || 'search';
  const W = +arg('workers', Math.max(1, cpus().length - 1));
  const workers = Array.from({ length: W }, () => new Worker(fileURLToPath(import.meta.url)));
  const pending = new Map(); let nextId = 1;
  for (const w of workers) w.on('message', r => { const p = pending.get(r.id); pending.delete(r.id); p(r); });
  let rr = 0;
  const run = (params, opts) => new Promise(res => { const id = nextId++; pending.set(id, res); workers[rr++ % W].postMessage({ id, params, opts }); });
  const runAll = (list, opts) => Promise.all(list.map(p => run(p, opts)));
  const done = () => workers.forEach(w => w.postMessage('exit'));
  mkdirSync(join(HERE, 'results'), { recursive: true });

  // rng for the search itself (not the sim)
  let ss = +arg('seed', 1) >>> 0; const rnd = () => { ss = (ss + 0x6d2b79f5) | 0; let t = Math.imul(ss ^ (ss >>> 15), 1 | ss); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const cats = (arg('cats', '') || '').split(',').filter(Boolean);
  const active = FACTORS.filter(f => !cats.length || cats.includes(f.cat));
  const toU = (f, v) => f.log ? (Math.log(v) - Math.log(f.lo)) / (Math.log(f.hi) - Math.log(f.lo)) : (v - f.lo) / (f.hi - f.lo);
  const fromU = (f, u) => { u = Math.max(0, Math.min(1, u)); return f.log ? Math.exp(Math.log(f.lo) + u * (Math.log(f.hi) - Math.log(f.lo))) : f.lo + u * (f.hi - f.lo); };
  const fmt = v => +(+v).toPrecision(4);

  if (cmd === 'sens') {
    const n = +arg('n', 32), days = +arg('days', 7), base = baseline(), opts = { n, days, seedBase: 500 };
    const b = await run({}, opts); const rows = [];
    const jobs = [];
    for (const f of FACTORS) for (const u of [0.15, 0.85]) jobs.push({ f, u, p: { ...base, [f.id]: fromU(f, u) } });
    const res = await runAll(jobs.map(j => j.p), opts);
    const byF = {};
    res.forEach((r, i) => { const { f, u } = jobs[i]; (byF[f.id] ||= { f, lo: null, hi: null })[u < 0.5 ? 'lo' : 'hi'] = r; });
    for (const { f, lo, hi } of Object.values(byF)) {
      const moves = Object.keys(OBJ).map(k => [k, Math.max(Math.abs(lo.metrics[k] - b.metrics[k]), Math.abs(hi.metrics[k] - b.metrics[k])) / (Math.max(OBJ[k].band[1] - OBJ[k].band[0], 1e-3))]).sort((a, c) => c[1] - a[1]).slice(0, 3);
      rows.push({ id: f.id, cat: f.cat, dFit: Math.min(lo.fitness, hi.fitness) - b.fitness, moves: moves.map(([k, v]) => `${k}:${v.toFixed(2)}`).join(' ') });
    }
    rows.sort((a, c) => a.dFit - c.dFit);
    const md = ['# Sensitivity (baseline fitness ' + b.fitness.toFixed(1) + ')', '', '| factor | cat | best dFitness | moves most |', '|---|---|---|---|', ...rows.map(r => `| ${r.id} | ${r.cat} | ${r.dFit.toFixed(1)} | ${r.moves} |`)].join('\n');
    writeFileSync(join(HERE, 'results', 'sensitivity.md'), md); console.log(md); done();
  }

  if (cmd === 'search') {
    const pop = +arg('pop', 240), gens = +arg('gens', 10), n = +arg('n', 48), days = +arg('days', 7), t0 = Date.now();
    const base = baseline();
    const mk = u => Object.fromEntries(active.map((f, i) => [f.id, fromU(f, u[i])]));
    // generation 0: Latin hypercube
    let U = Array.from({ length: pop }, () => []);
    active.forEach((f, j) => { const perm = Array.from({ length: pop }, (_, i) => i).sort(() => rnd() - 0.5); perm.forEach((p, i) => { U[i][j] = (p + rnd()) / pop; }); });
    const history = []; let elites = [], best = null;
    for (let g = 0; g <= gens; g++) {
      const seedBase = 1000 + g * 10000, opts = { n, days, seedBase };
      const carry = elites.slice(0, 6).map(e => e.u);                    // re-test last gen's best on fresh seeds (noise control)
      const cand = [...carry, ...U]; const params = cand.map(mk);
      if (g === 0) { params.push({}); cand.push(active.map(f => toU(f, base[f.id])));
        const sf = arg('seedFrom', ''); if (sf) { const prev = JSON.parse(readFileSync(sf, 'utf8')).best.params; const p2 = { ...base, ...prev }; params.push(p2); cand.push(active.map(f => Math.max(0, Math.min(1, toU(f, p2[f.id]))))); } }  // include the current defaults
      const res = await runAll(params, opts);
      const scored = res.map((r, i) => ({ ...r, u: cand[i], params: params[i] })).sort((a, b) => a.fitness - b.fitness);
      elites = scored.slice(0, Math.max(8, Math.floor(scored.length * 0.15)));
      best = scored[0];
      const bl = g === 0 ? scored.find(s => Object.keys(s.params).length === 0) : null;
      history.push({ gen: g, best: +best.fitness.toFixed(2), median: +scored[Math.floor(scored.length / 2)].fitness.toFixed(2), baseline: bl ? +bl.fitness.toFixed(2) : undefined, hard: best.hardFail });
      console.log(`gen ${g}: best ${best.fitness.toFixed(2)} median ${scored[Math.floor(scored.length / 2)].fitness.toFixed(1)}${bl ? ' baseline ' + bl.fitness.toFixed(1) : ''} hard=[${best.hardFail}] ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      // cross-entropy refit with a std floor that shrinks slowly
      const floor = Math.max(0.02, 0.12 * (1 - g / gens));
      const mu = active.map((_, j) => elites.reduce((s, e) => s + e.u[j], 0) / elites.length);
      const sg = active.map((_, j) => Math.max(floor, Math.sqrt(elites.reduce((s, e) => s + (e.u[j] - mu[j]) ** 2, 0) / elites.length)));
      U = Array.from({ length: pop }, () => mu.map((m, j) => m + sg[j] * gauss()));
    }
    // held-out validation of top distinct candidates on 10x more lives and 2x days, brand-new seeds
    const top = elites.slice(0, 8);
    const vopts = { n: n * 10, days: days * 2, seedBase: 900000 };
    const val = await runAll(top.map(t => t.params), vopts);
    const ranked = top.map((t, i) => ({ params: t.params, searchFitness: t.fitness, validation: val[i] })).sort((a, b) => a.validation.fitness - b.validation.fitness);
    const baseVal = await run({}, vopts);
    const out = { when: new Date().toISOString(), pop, gens, n, days, cats, history, baselineValidation: { fitness: baseVal.fitness, hardFail: baseVal.hardFail, metrics: baseVal.metrics }, best: { params: ranked[0].params, validation: { fitness: ranked[0].validation.fitness, hardFail: ranked[0].validation.hardFail, metrics: ranked[0].validation.metrics, mix: ranked[0].validation.mix } }, runnersUp: ranked.slice(1).map(r => ({ validation: r.validation.fitness, searchFitness: r.searchFitness })) };
    const file = join(HERE, 'results', `sweep-${Date.now()}.json`); writeFileSync(file, JSON.stringify(out, null, 1)); writeFileSync(join(HERE, 'results', 'latest.json'), JSON.stringify(out, null, 1));
    const lines = ['', `validation (${vopts.n} lives x ${vopts.days} days, unseen seeds): baseline ${baseVal.fitness.toFixed(2)} [hard: ${baseVal.hardFail}]  ->  best ${ranked[0].validation.fitness.toFixed(2)} [hard: ${ranked[0].validation.hardFail}]`,
      'metric'.padEnd(24) + 'target'.padEnd(14) + 'baseline'.padEnd(10) + 'best'];
    for (const [k, o] of Object.entries(OBJ)) lines.push(k.padEnd(24) + `${o.band[0]}..${o.band[1]}`.padEnd(14) + String(fmt(baseVal.metrics[k])).padEnd(10) + fmt(ranked[0].validation.metrics[k]));
    console.log(lines.join('\n')); console.log('saved', file); done();
  }

  if (cmd === 'validate') {
    const r = JSON.parse(readFileSync(process.argv[3] || join(HERE, 'results', 'latest.json'), 'utf8'));
    const v = await run(r.best.params, { n: +arg('n', 400), days: +arg('days', 14), seedBase: +arg('seedBase', 7000000) });
    console.log('fitness', v.fitness.toFixed(2), 'hard', v.hardFail); for (const [k, x] of Object.entries(v.metrics)) console.log(k.padEnd(24), fmt(x), 'pen', v.detail[k].toFixed(2)); done();
  }

  if (cmd === 'apply') {
    const r = JSON.parse(readFileSync(process.argv[3] || join(HERE, 'results', 'latest.json'), 'utf8'));
    const E = join(HERE, '..', 'emotions'); const cache = {}; const tune = {}; const dirOf = f => (f === 'taste' ? join(HERE, '..', 'art') : E);
    const TOP = { hazards: ['events'], activities: ['activities'], chains: ['chains'] };
    for (const [id, v] of Object.entries(r.best.params)) {
      const [file, path] = id.split(':');
      if (file === 'tune') { const keys = path.split('.'); let o = tune; for (const k of keys.slice(0, -1)) o = o[k] ||= {}; o[keys.at(-1)] = fmt(v); continue; }
      const p = join(dirOf(file), file + '.json'); const j = cache[file] ||= JSON.parse(readFileSync(p, 'utf8'));
      const keys = path.split('.'); let o = j; for (const k of keys.slice(0, -1)) o = o[k]; o[keys.at(-1)] = fmt(v);
    }
    for (const [file, j] of Object.entries(cache)) writeFileSync(join(dirOf(file), file + '.json'), JSON.stringify(j, null, 1) + '\n');
    writeFileSync(join(E, 'tune.json'), JSON.stringify({ doc: 'Tuned chooser constants written by tools/sim/sweep.mjs apply. gen.py bakes this into site/src/sim/data/tune.gen.js.', ...tune }, null, 1) + '\n');
    console.log('applied', Object.keys(r.best.params).length, 'values; now run: python3 tools/emotions/gen.py && python3 tools/art/gen_art.py'); done();
  }
}
