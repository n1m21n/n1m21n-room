// Emotion picker: the felt state is a point in (valence, arousal, stress, energy, dominance). Each emotion is a
// prototype point with a margin. Nearest prototype wins, with hysteresis (no flicker) and, when the emotion stage is
// unstable, a softmax sample over the nearby prototypes (the same state does not always give the same label).
import { EMOTIONS, FACE_MAP } from './data/emotions.gen.js';
import { clamp } from './rng.js';

const W = { valence: 1.0, arousal: 1.0, stress: 0.8, energy: 0.8, dominance: 0.5 };
export const dist2 = (a, p) => { let s = 0; for (const k in W) s += W[k] * ((a[k] ?? p[k]) - p[k]) ** 2; return s; };

export function makeEmotionPicker({ rng, inst, def = EMOTIONS, minHold = 4 } = {}) {
  const names = Object.keys(def).filter(n => !def[n].transient);
  let current = 'neutral', heldFor = 0, transient = null, transientLeft = 0;

  // probability over emotions: softmax(-d2/T). T small = near-deterministic.
  function distribution(state, T = 0.02) {
    const d = names.map(n => dist2(state, def[n].prototype));
    const m = Math.min(...d);
    const w = d.map(x => Math.exp(-(x - m) / T));
    const z = w.reduce((a, b) => a + b, 0);
    return Object.fromEntries(names.map((n, i) => [n, w[i] / z]));
  }

  function pick(state, dt = 0, prior = null) {
    heldFor += dt;
    if (transient) { transientLeft -= dt; if (transientLeft <= 0) transient = null; else return transient; }
    // nearest prototype (with gentle Lovheim neurochemical corner prior when present)
    let best = current, bd = Infinity;
    for (const n of names) {
      const d = Math.max(0, dist2(state, def[n].prototype) - (prior === n ? 0.012 : 0));
      if (d < bd) { bd = d; best = n; }
    }
    let candidate = best;
    // unstable emotion stage: sample near-ties instead of taking the argmax
    if (inst?.active('emotion')) {
      const T = 0.02 + inst.sigma('emotion') * 0.5;
      const dist = distribution(state, T);
      candidate = rng.weighted(dist);
    }
    if (candidate !== current) {
      const dc = dist2(state, def[current].prototype), dn = dist2(state, def[candidate].prototype);
      const margin = (def[current].margin + def[candidate].margin) * 0.5;
      const smooth = inst?.active('emotion') ? (inst.param('emotion', 'smoothing') || 0) : 0;
      // hysteresis: must beat the current one by the margin (squared-distance gap), and the minimum hold must have passed
      if (heldFor >= minHold && dn + margin * margin * (0.25 + smooth) < dc) { current = candidate; heldFor = 0; }
    }
    return current;
  }

  // transient reactions (alarm on startle) hold for def.hold seconds then decay back to the nearest prototype
  function trigger(name) {
    const e = def[name]; if (!e) return;
    transient = name; transientLeft = e.hold || 1.2; heldFor = 0;
  }
  const faceOf = n => FACE_MAP[n] || 'neutral';
  return {
    pick, trigger, distribution, faceOf,
    get current() { return transient || current; },
    set current(v) { if (def[v]) { current = v; heldFor = 0; } },
    names,
    snapshot: () => ({ current, heldFor, transient, transientLeft }),
    restore: s => { if (s && def[s.current]) { current = s.current; heldFor = s.heldFor || 0; transient = s.transient || null; transientLeft = s.transientLeft || 0; } },
  };
}

// instantaneous 5-d affect from every source: motives (the body), neuromodulators (chemistry), ledger traces (memory)
export function composeAffect({ motives, neuroAffect, traces }) {
  const e = motives.energy ?? 0.78;
  const body = { valence: ((e + (motives.fun ?? 0.7) + (motives.hunger ?? 0.7) + (motives.hygiene ?? 0.8) + (motives.comfort ?? 0.7)) / 5), arousal: 0.7 * e + 0.3 * (motives.fun ?? 0.7) };
  const mem = { valence: 0.65 * (traces.valence || 0) + 0.22 * (traces.pride || 0) + 0.22 * (traces.comfort || 0) - 0.45 * (traces.stress || 0) - 0.35 * (traces.frustration || 0) - 0.18 * (traces.loneliness || 0) - 0.12 * (traces.boredom || 0),
                arousal: (traces.arousal || 0) + 0.15 * (traces.curiosity || 0) - 0.2 * (traces.fatigueDebt || 0) };
  const valence = clamp(0.46 * body.valence + 0.48 * neuroAffect.valence + mem.valence);
  const arousal = clamp(0.5 * body.arousal + 0.5 * neuroAffect.arousal + mem.arousal);
  const stress = clamp(neuroAffect.stress + (traces.stress || 0) * 0.5 + (traces.frustration || 0) * 0.3);
  const dominance = clamp(neuroAffect.dominance - (traces.loneliness || 0) * 0.1 - (traces.frustration || 0) * 0.1);
  return { valence, arousal, stress, energy: clamp(e - 0.3 * (traces.fatigueDebt || 0)), dominance };
}
