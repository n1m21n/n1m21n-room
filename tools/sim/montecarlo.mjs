// Monte Carlo: run N seeds x D days headless and report the spread. Acceptance: visible day-to-day variation,
// no collapse (every day has sleep, mood not pinned at 0/1, chains complete, erratic share small but non-zero).
// usage: node tools/sim/montecarlo.mjs [--n=200] [--days=7] [--instab=0.5] [--json=out.json]
import { makeSimCore } from '../../site/src/sim/core.js';
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const N = +arg('n', 200), D = +arg('days', 7), L = +arg('instab', 0), out = arg('json', '');
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const lambda = L > 0 ? Object.fromEntries(['drives', 'motives', 'desire', 'chain', 'action', 'outcome', 'ledger', 'emotion'].map(k => [k, L])) : {};
const days = [], perSeed = [], mixes = {}, acts = [], mins = {}, seqs = new Map(), goals = {}; let t0 = Date.now();
for (let s = 1; s <= N; s++) {
  const c = makeSimCore({ seed: s, withGrid: false, instability: L > 0 ? { enabled: true, lambda } : {} });
  let lastSeq = 0;
  for (let d = 0; d < D; d++) { c.advance(1440); for (const e of c.journal) if (e.seq > lastSeq && e.kind === 'act') { if (e.day >= 1) acts.push(e); } lastSeq = c.journal.at(-1)?.seq ?? lastSeq; }
  const ds = c.days.slice(1, D); days.push(...ds);   // day 0 starts awake, so it has no night
  perSeed.push({ seed: s, v: mean(ds.map(d => d.v)), s: mean(ds.map(d => d.s)) });
  for (const d of ds) for (const [a, n] of Object.entries(d.acts)) mixes[a] = (mixes[a] || 0) + n;
  for (const d of ds) for (const [a, m] of Object.entries(d.actMin || {})) mins[a] = (mins[a] || 0) + m;
  // sequences he actually lived: free chains (any run closed by sleep or a length cap) and goal episodes from the planner
  for (const f of c.freeChains) if (f.day >= 1) seqs.set(f.seq, (seqs.get(f.seq) || 0) + 1);
  for (const g of c.episodes || []) if (g.day >= 1) { const k = g.goal + ':' + g.seq; goals[k] = (goals[k] || 0) + 1; }
}
const col = f => days.map(f);
const total = Object.values(mixes).reduce((a, b) => a + b, 0);
const rep = {
  runs: N, daysEach: D, instability: L, seconds: +((Date.now() - t0) / 1000).toFixed(1),
  acts_per_day: { mean: +mean(col(d => d.n)).toFixed(1), sd: +sd(col(d => d.n)).toFixed(1) },
  mood_valence: { mean: +mean(col(d => d.v)).toFixed(3), sd: +sd(col(d => d.v)).toFixed(3), p10: +q(col(d => d.v), 0.1).toFixed(2), p90: +q(col(d => d.v), 0.9).toFixed(2) },
  stress: { mean: +mean(col(d => d.s)).toFixed(3), p10: +q(col(d => d.s), 0.1).toFixed(2), p90: +q(col(d => d.s), 0.9).toFixed(2) },
  sleep_acts_per_day: { mean: +mean(col(d => d.acts.sleep || 0)).toFixed(2), zeroDays: col(d => d.sleepMin || 0).filter(x => x < 180).length },
  erratic_events_per_day: +mean(col(d => d.erratic)).toFixed(2),
  chains: { done: +mean(col(d => d.chainsDone)).toFixed(2), broken: +mean(col(d => d.chainsBroken)).toFixed(2), branched: +mean(col(d => d.chainsBranched || 0)).toFixed(2), dead: +mean(col(d => d.chainsDead || 0)).toFixed(2), dropped: +mean(col(d => d.chainsDropped || 0)).toFixed(2), suspended: +mean(col(d => d.chainsSuspended || 0)).toFixed(2) },
  fail_rate: +(mean(col(d => d.outcomes.fail)) / mean(col(d => d.n))).toFixed(3),
  between_seed_sd_of_mood: +sd(perSeed.map(p => p.v)).toFixed(3),
  top_acts: Object.entries(mixes).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([a, n]) => `${a} ${(100 * n / total).toFixed(1)}%`),
  time_share: (() => { const t = Object.values(mins).reduce((a, b) => a + b, 0); return Object.entries(mins).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, m]) => `${a} ${(100 * m / t).toFixed(1)}%`); })(),
  sequences: { free_distinct: seqs.size, free_total: [...seqs.values()].reduce((a, b) => a + b, 0), goal_distinct: Object.keys(goals).length, goal_total: Object.values(goals).reduce((a, b) => a + b, 0),
    top_goal: Object.entries(goals).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ×${n}`) },
  per_day: Object.fromEntries(['brush', 'dress', 'shower', 'tea', 'eat', 'cook', 'fridge', 'wash', 'phone_call', 'water_plant'].map(a => [a, +(acts.filter(e => e.act === a).length / days.length).toFixed(2)])),
  // same act again within 3 h (habituation should keep this low) and awake-at-night acts (01-05 h, not sleep / loo / erratic)
  repeat_3h: +(acts.filter((e, i) => acts.slice(Math.max(0, i - 12), i).some(p => p.act === e.act && p.day === e.day && e.t - p.t < 180 && e.t > p.t)).length / acts.length).toFixed(3),
  night_acts_per_day: +(acts.filter(e => { const h = (e.t % 1440) / 60; return h >= 1 && h < 5 && e.actKind === 'normal' && !['sleep', 'loo'].includes(e.act); }).length / days.length).toFixed(2),
  pinned_days: col(d => d.v).filter(v => v < 0.05 || v > 0.95).length,
  verdict: [],
};
if (rep.sleep_acts_per_day.zeroDays > 0.02 * days.length) rep.verdict.push('FAIL: too many days without sleep');
if (rep.mood_valence.sd < 0.03) rep.verdict.push('FAIL: no day-to-day variation (flat)');
if (rep.mood_valence.p10 < 0.08 || rep.mood_valence.p90 > 0.95) rep.verdict.push('FAIL: mood collapses to an extreme');
if (rep.stress.mean > 0.75) rep.verdict.push('WARN: stress runaway (mean > 0.75)');
if (rep.erratic_events_per_day < 0.05) rep.verdict.push('WARN: erratic events almost never fire');
if (!rep.verdict.length) rep.verdict.push('PASS');
console.log(JSON.stringify(rep, null, 1));
if (out) (await import('node:fs')).writeFileSync(out, JSON.stringify({ rep, days }, null, 0));
process.exit(rep.verdict.some(v => v.startsWith('FAIL')) ? 1 : 0);
