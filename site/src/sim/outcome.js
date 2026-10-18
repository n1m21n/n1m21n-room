// Outcomes are distributions, not events: the same act can go as intended, partly, badly, with a side effect, or
// better than hoped. Fatigue, stress, clutter, skill and flow shift the mass; the outcome stage's noise jitters it.
// A self-model keeps the EXPECTED outcome per category; the gap (surprise) feeds DA/NE/CORT.
import { OUTCOMES, STABILITY } from './data/world.gen.js';
import { ACTIVITIES } from './data/activities.gen.js';
import { clamp } from './rng.js';

const KEYS = ['ok', 'partial', 'fail', 'side', 'surprise'];

export function outcomeDistribution(category, ctx = {}, def = OUTCOMES) {
  const base = def.categories[category]?.p || def.categories.micro.p;
  const p = { ...base };
  for (const [mod, w] of Object.entries(def.mods)) {
    const x = ctx[mod] || 0;
    if (!x) continue;
    for (const k in w) p[k] = (p[k] || 0) + w[k] * x * (k === 'ok' ? 1 : 1);
  }
  let z = 0; for (const k of KEYS) { p[k] = Math.max(0, p[k] ?? 0); z += p[k]; }
  for (const k of KEYS) p[k] /= z || 1;
  return p;
}

export function makeOutcomes({ rng, inst, neuro, ledger, def = OUTCOMES, selfDef = STABILITY.selfModel } = {}) {
  const expected = {};                                          // category -> expected reward scale (EMA)
  const stats = {};
  // sample an outcome for finishing/doing an act. ctx: fatigue, stress, skill, clutter, flow (0..1)
  function sample(actName, ctx = {}) {
    const cat = ACTIVITIES[actName]?.category || 'micro';
    let p = outcomeDistribution(cat, ctx, def);
    if (inst?.active('outcome')) {                              // jitter the distribution itself
      for (const k of KEYS) p[k] = Math.max(0, p[k] * (1 + inst.noise('outcome')));
      const z = KEYS.reduce((a, k) => a + p[k], 0); for (const k of KEYS) p[k] /= z;
    }
    const kind = rng.weighted(p);
    const scale = def.scale[kind];
    // self-model: prediction error against what he expected from this category
    const exp = expected[cat] ?? 0.9;
    const surprise = scale - exp;
    expected[cat] = exp + selfDef.expectGain * (scale - exp);
    const evId = def.events[kind];
    if (neuro) {
      if (surprise > 0.25) neuro.impulse({ DA: selfDef.surpriseToDA * surprise * 0.2, NE: selfDef.surpriseToNE * surprise * 0.1 });
      if (surprise < -0.25) neuro.impulse({ CORT: selfDef.negSurpriseToCORT * -surprise * 0.1, NE: selfDef.surpriseToNE * -surprise * 0.1, DA: -0.03 });
    }
    if (evId && ledger) ledger.write(evId, { scale: kind === 'surprise' ? 1 : Math.min(1.5, 0.6 + Math.abs(surprise)), note: `${actName}:${kind}` });
    (stats[cat] ||= { ok: 0, partial: 0, fail: 0, side: 0, surprise: 0 })[kind]++;
    return { kind, scale, surprise, category: cat };
  }
  return {
    sample, expected, stats, distribution: outcomeDistribution,
    snapshot: () => ({ expected: { ...expected } }),
    restore: s => { if (s) Object.assign(expected, s.expected); },
  };
}
