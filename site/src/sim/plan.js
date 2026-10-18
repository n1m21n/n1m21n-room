// Day-plan adjustment: bad mood cancels or postpones non-essential parts of the plan. Decisions are seeded per
// (day, part index) so they're memoized: reloading doesn't change yesterday's decisions.
import { clamp, rngFor } from './rng.js';

const ESSENTIAL = new Set(['sleep', 'meal', 'eat', 'shower', 'wake']);

export function makePlanAdjust({ seed = 1, neuro, enabled = true } = {}) {
  const memo = new Map();
  // part: {kind|act, start (min), ...}; ctx: {valence, stress, energy, day, index}
  function adjust(part, ctx) {
    if (!enabled) return { action: 'keep' };
    const key = `${ctx.day}:${ctx.index}`;
    if (memo.has(key)) return memo.get(key);
    const act = part.act || part.kind || '';
    let res = { action: 'keep' };
    if (!ESSENTIAL.has(act)) {
      const bad = clamp(0.5 * ctx.stress + 0.5 * (1 - ctx.valence) + 0.3 * (1 - ctx.energy) - 0.35, 0, 1);
      const boost = neuro ? neuro.effect('cancelPlan') : 0;
      const p = clamp(bad * 0.9 + boost, 0, 0.9);
      const r = rngFor(seed, 'plan', ctx.day, ctx.index);
      const x = r.next();
      if (x < p * 0.45) res = { action: 'cancel', p };
      else if (x < p) res = { action: 'postpone', byMinutes: 30 + Math.floor(r.next() * 90), p };
    }
    memo.set(key, res);
    return res;
  }
  return { adjust, memo, snapshot: () => ({ memo: [...memo].slice(-60) }), restore: s => { memo.clear(); for (const [k, v] of s?.memo || []) memo.set(k, v); } };
}
