// World state + a goal planner, so chains of acts are generated instead of listed.
// A fluent is a fact about him or the room (teeth clean, food cooked, dishes dirty, caffeine). Acts read fluents
// (guard / pre / pre_any / soft) and change them (eff / fail); see tools/emotions/world_model.json.
// plan(goal): means-ends search. Unmet preconditions are filled by acts whose effects make them true, recursively;
// the order of independent steps is drawn from act-to-act affinity times his own learned pair habits, so any
// permutation can happen and each seed grows its own routine. Soft steps (brush before bed) are kept with a
// probability that falls with tiredness and stress. Interruption, failure and detours all end in the same place:
// replan from the state the world is in now, which is what resuming and branching are.
import { WORLD_MODEL as M } from './data/world.gen.js';
import { clamp } from './rng.js';

const inHours = (h, w) => !w || (w[0] <= w[1] ? h >= w[0] && h < w[1] : h >= w[0] || h < w[1]);

export function makeWorld({ rng }) {
  const st = {}, at = {};                                   // value, minute it was set
  for (const [f, d] of Object.entries(M.fluents)) { st[f] = d.init ?? 0; at[f] = 0; }
  let pairs = {};                                           // learned order habits: 'a>b' -> [strength, minute]
  let keep = {};                                            // soft step kept-rate per 'act.fluent' (exponential average)

  function val(f, t, s = st, a = at) {
    const d = M.fluents[f], v = s[f];
    if (d?.halfLife) return v * 0.5 ** (Math.max(0, t - a[f]) / d.halfLife);
    if (d?.ttl && v && t - a[f] > d.ttl) return 0;
    return v;
  }
  const holds = (f, v, t, s, a) => (v >= 1 ? val(f, t, s, a) >= 0.5 : val(f, t, s, a) < 0.5);
  const all = (cond, t, s, a) => Object.entries(cond || {}).every(([f, v]) => holds(f, v, t, s, a));
  function set(f, v, t, s = st, a = at) {
    if (typeof v === 'string') v = Math.max(0, val(f, t, s, a) + parseFloat(v));   // '+2' / '-1'
    if (s[f] !== v || M.fluents[f]?.ttl || M.fluents[f]?.halfLife) a[f] = t;
    s[f] = v;
  }
  function guardOk(act, t, s = st, a = at) {
    const r = M.acts[act]; if (!r) return true;
    if (r.guard && !all(r.guard, t, s, a)) return false;
    if (r.guard_any && !r.guard_any.some(c => all(c, t, s, a))) return false;
    return true;
  }
  function apply(act, t, ok = true, s = st, a = at) {
    const r = M.acts[act]; if (!r) return;
    for (const [f, v] of Object.entries((ok ? r.eff : r.fail) || {})) set(f, v, t, s, a);
  }

  // a fact in the world that asks for an act by itself (dishes in the sink, still in pyjamas at noon)
  function needMul(act, t) {
    const h = (t % 1440) / 60; let m = 1;
    for (const n of M.needs) {
      if (n.act !== act || !inHours(h, n.hours) || !all(n.when, t)) continue;
      const since = Math.min(...Object.keys(n.when).map(f => t - at[f]));
      m *= 1 + Math.min(n.max, Math.max(0, (since - (n.afterMin || 0)) / (n.growMin || 60)));
    }
    return m;
  }
  function caffeineMul(act, t) {
    if (act !== 'tea') return 1;
    const c = M.caffeine, h = (t % 1440) / 60;
    return 1 / (1 + c.appealK * val('caffeine', t)) * (h >= c.lateFrom || h < 5 ? c.lateMul : 1);
  }

  const providers = {};                                     // 'fluent=value' -> acts whose effect makes it so
  for (const [act, r] of Object.entries(M.acts)) for (const [f, v] of Object.entries(r.eff || {})) if (typeof v === 'number') (providers[f + '=' + v] ||= []).push(act);
  const pairW = (a, b, t) => { const p = pairs[a + '>' + b]; return p ? p[0] * Math.exp(-(t - p[1]) / M.planner.habitTau) : 0; };
  function keepP(act, f, ctx) {
    const k = M.soft, h = keep[act + '.' + f] ?? 0.5;
    return clamp(k.base + k.energy * (ctx.energy ?? 0.6) + k.stress * (ctx.stress ?? 0.2) + k.habit * h, 0.1, 0.98);
  }

  // plan a goal from the current state. ctx: { t, w0 (act appeal now), follow(a,b), last, energy, stress }.
  // Returns { steps, skipped } or null when a hard precondition cannot be met.
  function plan(goal, ctx) {
    const s = { ...st }, a = { ...at }, steps = [], skipped = [], kept = [], t = ctx.t;
    function expand(act, depth, seen) {
      if (!guardOk(act, t, s, a)) return false;
      const r = M.acts[act] || {}, h = (t % 1440) / 60, conds = [];
      for (const [f, v] of Object.entries(r.pre || {})) if (!holds(f, v, t, s, a)) conds.push({ opts: [[f, v]], hard: true });
      if (r.pre_any && !r.pre_any.some(c => all(c, t, s, a))) conds.push({ opts: r.pre_any.map(c => Object.entries(c)[0]), pay: r.pay_any, hard: true });
      if (inHours(h, r.softAt)) for (const [f, v] of Object.entries(r.soft || {})) {
        if (holds(f, v, t, s, a)) continue;
        if (rng.chance(keepP(act, f, ctx))) { conds.push({ opts: [[f, v]], soft: f }); kept.push(act + '.' + f); } else skipped.push(act + '.' + f);
      }
      if (conds.length && depth >= M.planner.maxDepth) return !conds.some(c => c.hard);
      const left = [...conds];
      while (left.length) {
        const prev = steps.at(-1) ?? ctx.last;
        const choices = [];                                // every (condition, provider) pair, weighted by appeal, flow and habit
        left.forEach((c, i) => {
          if (c.opts.some(([f, v]) => holds(f, v, t, s, a))) { choices.push({ i, act: null, w: 1e9 }); return; }
          c.opts.forEach(([f, v], j) => { for (const p of providers[f + '=' + v] || []) {
            if (p === act || seen.has(p) || !guardOk(p, t, s, a)) continue;
            const w = Math.max(1e-4, ctx.w0[p] ?? 1e-3) * (ctx.follow(prev, p) || 1) * (1 + M.planner.habitW * pairW(prev, p, t)) * (c.pay?.[j] ?? 1) ** 2;
            choices.push({ i, act: p, w });
          } });
        });
        if (!choices.length) { if (left.some(c => c.hard)) return false; break; }
        const k = +rng.weighted(Object.fromEntries(choices.map((c, j) => [j, c.w]))), ch = choices[k];
        const c = left.splice(ch.i, 1)[0];
        if (ch.act && !expand(ch.act, depth + 1, new Set([...seen, act])) && c.hard) return false;
      }
      steps.push(act); apply(act, t, true, s, a);
      return true;
    }
    return expand(goal, 0, new Set()) ? { steps, skipped, kept } : null;
  }

  // after an episode: strengthen the order he used, and remember which soft steps he kept
  function learn(seq, kept, skipped, t) {
    seq = seq.filter(x => x[0] !== '~');
    for (let i = 1; i < seq.length; i++) { const k = seq[i - 1] + '>' + seq[i]; pairs[k] = [pairW(seq[i - 1], seq[i], t) + 1, t]; }
    for (const k of kept) keep[k] = 0.8 * (keep[k] ?? 0.5) + 0.2;
    for (const k of skipped) keep[k] = 0.8 * (keep[k] ?? 0.5);
    if (Object.keys(pairs).length > 600) for (const k of Object.keys(pairs)) if (pairW(...k.split('>'), t) < 0.05) delete pairs[k];
  }

  // how much the act pays given which of its pre_any options holds now (meal vs snack)
  function pay(act, t) {
    const r = M.acts[act]; if (!r?.pay_any) return 1;
    const i = r.pre_any.findIndex(c => all(c, t)); return i >= 0 ? r.pay_any[i] : r.pay_any.at(-1);
  }
  // would this act undo something a remaining planned step relies on (eating the ingredients he took out to cook)?
  function clobbers(act, steps, t) {
    const e = M.acts[act]?.eff; if (!e || !steps.length) return false;
    for (const st2 of steps) {
      const r = M.acts[st2]; if (!r || st2 === act) continue;
      const conds = [r.pre || {}, ...(r.pre_any || [])];
      for (const c of conds) for (const [f, v] of Object.entries(c)) if (f in e && typeof e[f] === 'number' && e[f] !== v && holds(f, v, t)) return true;
    }
    return false;
  }

  // can this act start now, its hard preconditions met (else the planner has to put steps in front)?
  const ready = (act, t) => { const r = M.acts[act]; if (!r) return true; return guardOk(act, t) && all(r.pre, t) && (!r.pre_any || r.pre_any.some(c => all(c, t))); };

  return {
    guardOk: (act, t) => guardOk(act, t), ready, apply: (act, t, ok) => apply(act, t, ok), needMul, caffeineMul, plan, learn, pay, clobbers,
    val: (f, t) => val(f, t), get state() { return { ...st }; },
    snapshot: () => ({ st: { ...st }, at: { ...at }, pairs: JSON.parse(JSON.stringify(pairs)), keep: { ...keep } }),
    restore(s) { if (!s) return; Object.assign(st, s.st); Object.assign(at, s.at); pairs = JSON.parse(JSON.stringify(s.pairs || {})); keep = { ...(s.keep || {}) }; },
  };
}
