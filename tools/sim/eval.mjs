// Evaluate one parameter set: apply factor values to the live data tables, run N seeded lives x D days headless,
// compute the objective metrics and a banded penalty (fitness; lower = better).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeSimCore } from '../../site/src/sim/core.js';
import { TUNE } from '../../site/src/sim/tune.js';
import { ACTIVITIES } from '../../site/src/sim/data/activities.gen.js';
import { TASTE } from '../../site/src/sim/data/art.gen.js';
import { NEURO, LEDGER, CHAINS, STABILITY, OUTCOMES, HAZARDS } from '../../site/src/sim/data/world.gen.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const OBJ = JSON.parse(readFileSync(join(HERE, 'objectives.json'), 'utf8')).metrics;
export const FACTORS = JSON.parse(readFileSync(join(HERE, 'factors.json'), 'utf8')).factors;
const ROOTS = { taste: TASTE, tune: TUNE, hazards: { events: HAZARDS }, activities: { activities: ACTIVITIES }, chains: { chains: CHAINS }, outcomes: OUTCOMES, ledger_events: LEDGER, neuro: NEURO, stability: STABILITY };

function walk(id) { const [file, path] = id.split(':'); const keys = path.split('.'); let o = ROOTS[file]; for (const k of keys.slice(0, -1)) o = o[k]; return [o, keys.at(-1)]; }
export const getVal = id => { const [o, k] = walk(id); return o[k]; };
export const setVal = (id, v) => { const [o, k] = walk(id); o[k] = v; };
const BASE = Object.fromEntries(FACTORS.map(f => [f.id, getVal(f.id)]));
export const baseline = () => ({ ...BASE });
export function apply(params = {}) { for (const f of FACTORS) setVal(f.id, f.id in params ? params[f.id] : BASE[f.id]); }

const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))] ?? 0; };
const ATUS = JSON.parse(readFileSync(join(HERE, '../data/atus_fit.json'), 'utf8')).minute_share;
const ACLS = JSON.parse(readFileSync(join(HERE, '../data/atus_classes.json'), 'utf8')).acts;
const SKIP = new Set(['travel', 'other', 'music', 'hobby', 'gallery', 'write', 'care', 'shopping', 'garden', 'religion', 'volunteer', 'services', 'pets', 'selfcare', 'study', 'cleanup']);   // persona-driven, or things a one-room character cannot do (no act exists for them)
const CULTURE = new Set(['creative', 'expressive', 'intellectual', 'leisure']);

export function runMetrics({ seedBase = 1, n = 48, days = 7, instab = 0 } = {}) {
  const all = [], lifeMeans = [], lifeDistinct = [], skills = [];
  const lambda = instab > 0 ? Object.fromEntries(['drives', 'motives', 'desire', 'chain', 'action', 'outcome', 'ledger', 'emotion'].map(k => [k, instab])) : {};
  for (let i = 0; i < n; i++) {
    const c = makeSimCore({ seed: seedBase + i, withGrid: false, instability: instab > 0 ? { enabled: true, lambda } : {} });
    c.advance(1440 * (days + 1));
    const ds = c.days.slice(1, days + 1);
    all.push(...ds); lifeMeans.push(mean(ds.map(d => d.v))); skills.push(c.art.state.skill);
    const set = new Set(); ds.slice(0, 7).forEach(d => Object.keys(d.acts).forEach(a => set.add(a))); lifeDistinct.push(set.size);
  }
  const acts = {}; let totalActs = 0, cult = 0, erraticActs = 0, started = 0, done = 0, broken = 0, branched = 0, dead = 0, fails = 0;
  const withinSd = []; let socialActs = 0; const art = { pieces: 0, satisfied: 0, disappointed: 0 };
  for (const d of all) {
    totalActs += d.n; done += d.chainsDone; broken += d.chainsBroken; branched += d.chainsBranched || 0; dead += d.chainsDead || 0; fails += d.outcomes.fail;
    for (const [a, k] of Object.entries(d.acts)) { acts[a] = (acts[a] || 0) + k; const A = ACTIVITIES[a]; if (A && CULTURE.has(A.category)) cult += k; if (A?.kind === 'erratic') erraticActs += k; if (A?.category === 'social') socialActs += k; }
    if (d.art) { art.pieces += d.art.pieces; art.satisfied += d.art.satisfied; art.disappointed += d.art.disappointed; }
  }
  for (let i = 0; i < n; i++) { const ds = all.slice(i * days, (i + 1) * days); withinSd.push(sd(ds.map(d => d.v))); }
  const N = all.length || 1;
  const cm = {}; let ct = 0;
  for (const d of all) for (const [a, k] of Object.entries(d.actMin || {})) { const c = ACLS[a] || 'other'; if (SKIP.has(c)) continue; cm[c] = (cm[c] || 0) + k; ct += k; }
  const rtot = Object.entries(ATUS).filter(([c]) => !SKIP.has(c)).reduce((x, [, v]) => x + v, 0);
  let atusGap = 0; for (const c of new Set([...Object.keys(cm), ...Object.keys(ATUS)])) if (!SKIP.has(c)) atusGap += Math.abs((cm[c] || 0) / (ct || 1) - (ATUS[c] || 0) / rtot) * 100;
  const m = {
    loo_share: (acts.loo || 0) / totalActs, eat_per_day: (acts.eat || 0) / N, shower_per_day: ((acts.shower || 0) + (acts.night_shower || 0)) / N,
    sleep_min_per_day: mean(all.map(d => d.sleepMin)), zero_sleep_days: all.filter(d => !d.sleepMin).length / N,
    acts_per_day: totalActs / N, max_single_act_share: Math.max(...Object.values(acts)) / totalActs, distinct_acts_week: mean(lifeDistinct),
    culture_share: cult / totalActs, chains_done_per_day: done / N, chain_broken_ratio: broken / ((done + broken) || 1), chain_branch_ratio: branched / (broken || 1), chain_deadend_per_day: dead / N,
    valence_mean: mean(all.map(d => d.v)), valence_day_sd: mean(withinSd), valence_p10: q(all.map(d => d.v), 0.1),
    stress_mean: mean(all.map(d => d.s)), stress_runaway_days: all.filter(d => d.s > 0.9).length / N,
    erratic_events_per_day: mean(all.map(d => d.erratic)), erratic_act_share: erraticActs / totalActs, fail_rate: fails / totalActs,
    between_life_sd: sd(lifeMeans),
    atus_gap: atusGap,
    social_acts_per_day: socialActs / N, art_pieces_per_day: art.pieces / N, art_satisfied_share: art.satisfied / (art.pieces || 1),
    art_disappointed_share: art.disappointed / (art.pieces || 1), art_skill: mean(skills),
  };
  return { metrics: m, mix: Object.entries(acts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, k]) => [a, +(k / totalActs).toFixed(3)]) };
}
export function score(m) {
  let fit = 0, hardFail = [], detail = {};
  for (const [k, o] of Object.entries(OBJ)) {
    const v = m[k], [lo, hi] = o.band, width = Math.max(hi - lo, Math.abs(hi) * 0.5, 1e-3);
    const d = v < lo ? lo - v : v > hi ? v - hi : 0;
    const pen = o.w * (d / width) ** 2; fit += pen; detail[k] = pen;
    if (o.hard && d > 0) hardFail.push(k);
  }
  return { fitness: fit + hardFail.length * 50, hardFail, detail };
}
export function evaluate(params, opts) { apply(params); const r = runMetrics(opts); return { ...r, ...score(r.metrics) }; }
