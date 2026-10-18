// Instability in every pillar. Each stage has: sigma (noise), wobble (slow mean-reverting drift of its gain), leak.
// With `enabled=false` or lambda=0 every function returns the neutral value (noise 0, gain 1), so the sim is exactly
// deterministic. Stress/arousal raise sigma and contentment steadies it: sigma = sigma0*lambda*(1 + a*NE + b*CORT - c*HT) * regime.
import { STABILITY } from './data/world.gen.js';
import { clamp, ouStep } from './rng.js';

export const STAGES = ['drives', 'motives', 'desire', 'chain', 'action', 'outcome', 'ledger', 'emotion'];

export function makeInstability({ rng, neuro = null, def = STABILITY } = {}) {
  const lambda = {}, wob = {};
  let enabled = !!def.enabled;
  let regime = 'steady', regimeLeft = 3600 * 6;
  const L = {};                                                  // per-stage working copy so dials can change at runtime
  for (const s of STAGES) { L[s] = { ...def.stages[s] }; lambda[s] = L[s].lambda; wob[s] = 0; }
  const couple = JSON.parse(JSON.stringify(def.coupling));
  const coupleWob = {};

  const regimeDef = () => def.regimes[regime];
  function sigmaMod() {
    if (!neuro) return 1;
    const m = def.sigmaMods, n = neuro.vars, B = { NE: 0.4, CORT: 0.2, HT: 0.55 };
    return Math.max(0.2, 1 + m.NE * (n.NE - B.NE) + m.CORT * (n.CORT - B.CORT) + m.HT * (n.HT - B.HT));
  }
  const active = s => enabled && lambda[s] > 0;
  const sigma = s => active(s) ? L[s].sigma0 * lambda[s] * sigmaMod() * regimeDef().sigmaMul : 0;
  // gaussian noise for a stage (0 when rigid)
  const noise = s => active(s) ? rng.gauss() * sigma(s) : 0;
  // gain for a stage: base * wobble * regime multiplier, clamped
  function gain(s) {
    if (!active(s)) return 1;
    const g = L[s].gain * (1 + wob[s]) * (regimeDef().gainMul[s] ?? 1);
    return clamp(g, L[s].gainClamp[0], L[s].gainClamp[1]);
  }
  function nextRegime() {
    const row = def.regimeTransitions[regime];
    const w = {}; for (const k in row) w[k] = row[k];
    regime = rng.weighted(w);
    const [a, b] = def.regimes[regime].hours;
    regimeLeft = rng.range(a, b) * 3600;
    if (neuro && def.regimes[regime].neuro) neuro.impulse(def.regimes[regime].neuro);
    return regime;
  }
  function step(dt) {
    if (!enabled) return;
    for (const s of STAGES) if (lambda[s] > 0) wob[s] = ouStep(wob[s], dt, L[s].wobbleTau, L[s].wobbleSigma * lambda[s], rng);
    regimeLeft -= dt;
    if (regimeLeft <= 0) nextRegime();
  }
  // misattribution matrix, entries wobble (slowly) when the ledger stage is unstable
  function coupling(trace, motive) {
    const base = couple[trace]?.[motive] ?? 0;
    if (!base) return 0;
    const k = trace + ':' + motive;
    if (active('ledger')) coupleWob[k] = ouStep(coupleWob[k] || 0, 1, L.ledger.wobbleTau / 60, L.ledger.wobbleSigma * lambda.ledger, rng);
    return Math.max(0, base * (1 + (coupleWob[k] || 0)) * (active('ledger') ? 1 : 1));
  }
  return {
    STAGES, step, sigma, noise, gain, coupling, active,
    get enabled() { return enabled; }, set enabled(v) { enabled = !!v; },
    get regime() { return regime; }, setRegime(r) { if (def.regimes[r]) { regime = r; regimeLeft = 3600 * 4; } },
    nextRegime,
    setLambda(stage, x) { if (stage === 'all') STAGES.forEach(s => lambda[s] = x); else lambda[stage] = x; },
    get lambda() { return { ...lambda }; },
    param: (s, k) => L[s][k],
    describe: () => STAGES.map(s => ({ stage: s, lambda: lambda[s], sigma: +sigma(s).toFixed(4), gain: +gain(s).toFixed(3) })),
    snapshot: () => ({ enabled, regime, regimeLeft, lambda: { ...lambda }, wob: { ...wob }, coupleWob: { ...coupleWob } }),
    restore(s) { if (!s) return; enabled = !!s.enabled; regime = s.regime; regimeLeft = s.regimeLeft; Object.assign(lambda, s.lambda); Object.assign(wob, s.wob); Object.assign(coupleWob, s.coupleWob || {}); },
  };
}
