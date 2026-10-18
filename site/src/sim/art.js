// His art, abstracted. A piece is a vector of 0..1 knob positions on the engine's param axes (speed, noise, softness,
// brightness, hue, contrast, symmetry, amount, size). The real executor will turn the vector into an Infinite patch; here we
// model the part that is HIS: what he feels shapes the sketch, taste (guideline + emotion + learned) steers the refining,
// craft (the outcome of the render act) limits it, and the verdict is not a score but how he FEELS afterwards.
// Satisfaction = the rare serene end of the chain (calm/content/proud, low stress after the savour chain). Only then does
// taste learn. Skill grows with practice. Every finished piece lands in the feed; the owner curates the gallery from it.
import { TASTE, AXIS_EMOTION } from './data/art.gen.js';

const AX = Object.keys(TASTE.guideline.axes);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const COORD = { V: 'valence', A: 'arousal', ST: 'stress', E: 'energy', D: 'dominance' };

export function makeArt({ rng }) {
  const P = TASTE.process;
  const st = { skill: P.skillStart, learned: { ...TASTE.guideline.axes }, pieces: 0, good: 0, disappointed: 0, cur: null, feed: [] };

  // what this feeling asks of each knob: 0.5 + sum(weight * (coordinate - 0.5)), bounded
  function emotionTarget(affect) {
    const t = {};
    for (const a of AX) { let v = 0.5; for (const [c, w] of Object.entries(AXIS_EMOTION[a] || {})) v += w * ((affect[COORD[c]] ?? 0.5) - 0.5); t[a] = clamp(v); }
    return t;
  }
  function target(affect) {
    const W = TASTE.weights, e = emotionTarget(affect), t = {};
    for (const a of AX) t[a] = (W.guideline * TASTE.guideline.axes[a] + W.emotion * e[a] + W.learned * st.learned[a]) / (W.guideline + W.emotion + W.learned);
    return t;
  }
  // how well a vector fits his own current taste, 0..1 (tolerance per axis comes from the guideline)
  function match(v, t) { let s = 0; for (const a of AX) s += Math.max(0, 1 - Math.abs(v[a] - t[a]) / (TASTE.guideline.tolerance[a] * 2.2)); return s / AX.length; }

  function sketch(affect, emotion) {
    const e = emotionTarget(affect), v = {};
    for (const a of AX) v[a] = clamp(P.sketchEmotionBlend * e[a] + (1 - P.sketchEmotionBlend) * rng.next(), 0.02, 0.98);
    st.cur = { v, emotion, rounds: 0, startedAffect: { ...affect } };
    return st.cur;
  }
  // one refine pass: move toward what he perceives his taste to be (perception is noisy until skill grows)
  function refine(affect) {
    const c = st.cur; if (!c) return null;
    const t = target(affect), noise = P.perceptionNoise * (1 - 0.7 * st.skill);
    for (const a of AX) c.v[a] = clamp(c.v[a] + (t[a] + (rng.next() - 0.5) * 2 * noise - c.v[a]) * P.refineStep * (0.4 + 0.6 * st.skill), 0.02, 0.98);
    c.rounds++;
    return c;
  }
  // render: craft from the act's outcome, then the match that decides which ending he is heading for
  function render(affect, outcomeKind) {
    const c = st.cur; if (!c) return null;
    c.craft = TASTE.craft[outcomeKind] ?? 1;
    c.match = +(match(c.v, target(affect)) * c.craft).toFixed(3);
    c.ending = c.match >= TASTE.verdict.satisfiedAt ? 'serene' : c.match >= TASTE.verdict.proudAt ? 'proud' : 'flat';
    return c;
  }
  // verdict arrives when the ending chain finishes; `serene` means he actually reached the calm state
  function conclude({ reached, day, affect, emotion }) {
    const c = st.cur; if (!c) return null; st.cur = null;
    const verdict = c.ending === 'serene' && reached ? 'satisfied' : c.ending === 'flat' ? 'disappointed' : c.ending === 'serene' ? 'unsettled' : 'proud';
    st.pieces++;
    st.skill = clamp(st.skill + (verdict === 'satisfied' ? P.skillGainSatisfied : P.skillGain) * (1 - st.skill));
    if (verdict === 'satisfied') { st.good++; for (const a of AX) st.learned[a] += P.learnRate * (c.v[a] - st.learned[a]); }
    if (verdict === 'disappointed') st.disappointed++;
    const piece = { n: st.pieces, day, emotion: c.emotion, v: Object.fromEntries(AX.map(a => [a, +c.v[a].toFixed(3)])), match: c.match, craft: c.craft, verdict, endEmotion: emotion };
    st.feed.push(piece); if (st.feed.length > 300) st.feed.shift();
    return piece;
  }
  return {
    sketch, refine, render, conclude, target, emotionTarget, match,
    get active() { return !!st.cur; }, get ending() { return st.cur?.ending; }, get state() { return st; },
    snapshot: () => JSON.parse(JSON.stringify(st)),
    restore(s) { if (s) { Object.assign(st, JSON.parse(JSON.stringify(s))); } },
  };
}
