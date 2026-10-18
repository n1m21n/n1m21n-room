// Erratic events. Rate per sim-second = h0 + kStress*stress + kFatigue*fatigue; trigger-expression events fire when
// their condition holds. Draws are seeded by (seed, day, 10-second bucket) so the same moment replays the same way
// (and a page reload doesn't re-roll an event).
import { HAZARDS } from './data/world.gen.js';
import { rngFor } from './rng.js';

const OPS = { '<': (a, b) => a < b, '>': (a, b) => a > b };
function evalTrigger(expr, s) {                                  // "fun<0.22&&act==work" | "!sleeping"
  return expr.split('&&').every(part => {
    part = part.trim();
    if (part.startsWith('!')) return !s[part.slice(1)];
    let m = part.match(/^(\w+)(<|>)([\d.]+)$/); if (m) return OPS[m[2]](s[m[1]] ?? 0.7, parseFloat(m[3]));
    m = part.match(/^(\w+)==(\w+)$/); if (m) return String(s[m[1]]) === m[2];
    return !!s[part];
  });
}

export function makeHazards({ seed = 1, inst, def = HAZARDS.events || HAZARDS, bucket = 10, cooldown = 60 } = {}) {
  const lastFired = {};
  let lastBucket = -1;
  // s: {day, t (sim seconds), stress, fatigue, running, sleeping, act, <motives>, frustration}
  function poll(s) {
    const b = Math.floor(s.t / bucket);
    if (b === lastBucket) return [];
    lastBucket = b;
    const out = [];
    for (const [id, h] of Object.entries(def)) {
      if (lastFired[id] != null && s.t - lastFired[id] < cooldown) continue;
      if (h.requires && !s[h.requires]) continue;
      let fire = false;
      if (h.trigger) fire = evalTrigger(h.trigger, s);
      else {
        let rate = (h.h0 || 0) + (h.kStress || 0) * (s.stress || 0) + (h.kFatigue || 0) * (s.fatigue || 0);
        if (inst?.active('action')) rate *= Math.max(0, 1 + inst.noise('action'));
        const r = rngFor(s.seed ?? seed, 'hz', s.day ?? 0, b, id);
        fire = r.next() < 1 - Math.exp(-rate * bucket);          // Poisson thinning over the bucket
      }
      if (fire) { lastFired[id] = s.t; out.push({ id, ledger: h.ledger, face: h.face, hold: h.hold, social: !!h.social, forces: h.forces, interrupt: h.interrupt || 'hard' }); }
    }
    return out;
  }
  return { poll, evalTrigger, snapshot: () => ({ lastFired: { ...lastFired }, lastBucket }), restore: s => { if (s) { Object.assign(lastFired, s.lastFired); lastBucket = s.lastBucket ?? -1; } } };
}
