// Seeded, serialisable randomness. Everything stochastic in the sim goes through one of these so a (seed, state)
// pair replays exactly, survives a page reload, and can be fast-forwarded while the visitor is away.

export function hashSeed(...parts) {                           // FNV-1a over the string form -> 32-bit
  let h = 0x811c9dc5;
  for (const c of parts.join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: p => next() < p,
    pick: arr => arr[Math.floor(next() * arr.length)],
    gauss() { let u = 0; while (u === 0) u = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next()); },
    weighted(weights) {                                         // {key: weight} -> key
      let sum = 0; for (const k in weights) sum += Math.max(0, weights[k]);
      if (sum <= 0) return Object.keys(weights)[0];
      let x = next() * sum;
      for (const k in weights) { x -= Math.max(0, weights[k]); if (x <= 0) return k; }
      return Object.keys(weights).pop();
    },
    state: () => s,
    setState: v => { s = v >>> 0; },
    fork: (...label) => makeRng(hashSeed(s, ...label)),
  };
  return r;
}

// A fresh rng for a labelled moment: same (seed, parts) always gives the same stream (used for hazards and the day plan).
export const rngFor = (seed, ...parts) => makeRng(hashSeed(seed, ...parts));

// Ornstein-Uhlenbeck step: x drifts back to 0 with time constant tau and is kicked by noise sigma. Mean-reverting, so it never runs away.
export function ouStep(x, dt, tau, sigma, rng) {
  if (!(tau > 0)) return x;
  const a = Math.exp(-dt / tau);
  return x * a + sigma * Math.sqrt(1 - a * a) * rng.gauss();
}

export const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const sigmoid = x => 1 / (1 + Math.exp(-x));
