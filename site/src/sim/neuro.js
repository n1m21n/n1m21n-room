// Neuromodulator layer: six slow variables (dopamine, serotonin, noradrenaline, cortisol, oxytocin, sleep pressure).
// Game-grade abstraction of Doya 2002 / Lovheim 2012 / Panksepp: they colour valence, arousal, stress, dominance and
// scale behaviour (doChance, walk speed, patience, noise, plan cancelling). Each relaxes to its baseline with its own tau.
import { NEURO } from './data/world.gen.js';
import { clamp } from './rng.js';

export function makeNeuro(def = NEURO) {
  const v = {};
  for (const [k, d] of Object.entries(def.vars)) v[k] = d.base;

  function step(dt, { sleeping = false, asleep = false } = {}) {
    const isAsleep = sleeping || asleep;
    for (const [k, d] of Object.entries(def.vars)) {
      if (k === 'SLP') {
        v.SLP = clamp(v.SLP + (isAsleep ? -d.fallAsleep : d.riseAwake) * dt, d.min, d.max);
      } else if (d.tau > 0) {
        v[k] = clamp(d.base + (v[k] - d.base) * Math.exp(-dt / d.tau), d.min, d.max);
      }
    }
  }
  function impulse(map = {}, scale = 1) {
    for (const [k, x] of Object.entries(map)) if (k in v) v[k] = clamp(v[k] + x * scale, def.vars[k].min, def.vars[k].max);
  }
  const lin = (row, extra = {}) => { let o = row.bias || 0; for (const k in row) if (k !== 'bias') o += row[k] * ((k in v ? v[k] : extra[k]) - (k in v ? def.vars[k].base : 0)); return o; };

  // moodTrace: slow valence trace from the ledger (-1..1 ish); returns the neuro-derived affect point
  function affect(moodTrace = 0) {
    const a = def.affect;
    return {
      valence: clamp(lin(a.valence, { mood: moodTrace }) + 0.0),
      arousal: clamp(lin(a.arousal)),
      stress: clamp(lin(a.stress)),
      dominance: clamp(lin(a.dominance)),
    };
  }
  // multiplicative/additive effect scalar for a behaviour: 1 + sum(coef * (var - base))
  function effect(name) {
    const row = def.effects[name]; if (!row) return 1;
    let o = 1; for (const k in row) o += row[k] * (v[k] - def.vars[k].base);
    return o;
  }
  // Lovheim (2012) corner prior: which of 8 corners (HT, DA, NE high/low) is he in. At baseline chemistry says nothing,
  // so inside the dead zone there is no corner (before, resting chemistry always read as the all-high corner).
  function corner() {
    const dz = def.lovheimCube.deadZone ?? 0;
    if (['HT', 'DA', 'NE'].every(k => Math.abs(v[k] - def.vars[k].base) < dz)) return { key: null, label: null };
    const hi = k => (v[k] >= def.vars[k].base ? '1' : '0');
    const key = hi('HT') + hi('DA') + hi('NE');
    return { key, label: def.lovheimCube.corners[key] };
  }
  return {
    vars: v, step, impulse, affect, effect, corner,
    snapshot: () => ({ ...v }),
    restore: s => { for (const k in v) if (s && k in s) v[k] = s[k]; },
    catchUp(seconds, { asleepFraction = 0.3 } = {}) {              // analytic fast-forward, no per-frame stepping
      for (const [k, d] of Object.entries(def.vars)) {
        if (k === 'SLP') v.SLP = clamp(d.base + (v.SLP - d.base) * Math.exp(-seconds / 7200), d.min, d.max);
        else if (d.tau > 0) v[k] = d.base + (v[k] - d.base) * Math.exp(-seconds / d.tau);
      }
    },
  };
}
