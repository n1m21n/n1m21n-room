// Do / duration / intensity: every behaviour number is a formula of (motives, mood, neuromodulators, ledger, chain
// context). Pure functions, so tests and the Monte Carlo script can call them directly.
import { ACTIVITIES, TIME_SCALE } from './data/activities.gen.js';
import { clamp, sigmoid } from './rng.js';

export const WALK = 1.7, RUN = 4.2;                              // m/s, same as player.js

// moodFactor stretches or shrinks durations: good mood = longer enjoyable acts, fatigue/stress = shorter
export function moodFactor(a) {
  return clamp(1 + 0.4 * (a.valence - 0.6) - 0.3 * (a.fatigue ?? 1 - a.energy) - 0.2 * a.stress + 0.2 * (a.absorbed || 0), 0.4, 2.0);
}
export function intensity(a, base = 1) {
  const fatigue = a.fatigue ?? 1 - a.energy;
  return base * (0.6 + 0.6 * a.arousal) * (1 - 0.3 * fatigue) * (1 - 0.2 * a.stress);
}
export function walkSpeed(a, { clutter = 0, neuro = 1 } = {}) {
  const fatigue = a.fatigue ?? 1 - a.energy;
  return WALK * (0.6 + 0.6 * a.arousal) * (1 - 0.3 * fatigue) * (clutter > 0.5 ? 0.8 : 1) * clamp(neuro, 0.7, 1.3);
}
// run when stressed, desperate for the loo, or in an open hall and very happy (never in clutter)
export function shouldRun(a, { openness = 0.5, clutter = 0, bladder = 1 } = {}) {
  if (clutter > 0.45) return false;
  return a.stress > 0.6 || bladder < 0.12 || (openness > 0.7 && a.valence > 0.8);
}
export function runSpeed(a) { return RUN * (0.8 + 0.3 * a.arousal) * (1 - 0.2 * (a.fatigue ?? 1 - a.energy)); }
export const typeSpeed = (a, focus = 0.7) => (0.6 + 0.7 * a.arousal) * (0.7 + 0.5 * focus);          // multiplies tempo
export const strumSpeed = a => (0.6 + 0.7 * a.arousal) * (0.7 + 0.5 * a.arousal);
export const showerSpeed = a => clamp(intensity(a), 0.5, 1.4);
// sleep length grows with fatigue debt and sleep pressure (story minutes)
export function sleepMinutes(debt = 0, pressure = 0.2, target = 420) { return target * (1 + 0.6 * debt + 0.4 * Math.max(0, pressure - 0.2)); }

// does he do it now? seeded draw against a sigmoid of (score - threshold); neuro scales appetite, patience scales threshold
export function doChance(score, { threshold = 0.5, k = 6, appetite = 1, patience = 1 } = {}) {
  return sigmoid(k * (score * appetite - threshold * patience));
}

// duration in SIM SECONDS: story minutes * secPerMinute * moodFactor, with lognormal-ish spread (spread from activities.json)
export function duration(actName, a, { rng = null, secPerMinute = TIME_SCALE, noise = 0 } = {}) {
  const act = ACTIVITIES[actName]; if (!act) return 10;
  let m = act.baseMinutes * moodFactor(a);
  if (rng) m *= Math.exp(act.spread * (rng.gauss() * (0.4 + noise)));
  return Math.max(act.minDur || 1, m * 60 * secPerMinute / 60);   // minutes -> seconds at secPerMinute sim-seconds per story minute
}
// the act's intensity multiplier by its named model
export function actIntensity(actName, a, ctx = {}) {
  const k = ACTIVITIES[actName]?.intensity;
  switch (k) {
    case 'walkSpeed': return walkSpeed(a, ctx);
    case 'runSpeed': return runSpeed(a);
    case 'typeSpeed': return typeSpeed(a, ctx.focus);
    case 'strumSpeed': return strumSpeed(a);
    case 'showerSpeed': return showerSpeed(a);
    case 'tempo': return strumSpeed(a);
    case 'sleepSpeed': return 1;
    case 'buildSpeed': return intensity(a);
    default: return 1;
  }
}
// wanting score from emotion: activities pull from the current emotion (activities.json emotionPull)
export function emotionPull(actName, emotion) { return ACTIVITIES[actName]?.emotionPull?.[emotion] ?? 1; }
