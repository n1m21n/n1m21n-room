// SimCore: one object that owns the seeded rng, neuromodulators, instability, ledger, emotion, chains, outcomes,
// hazards, plan adjustment, grid, a JOURNAL and persistence. Two ways to drive it:
//   live    : the site keeps choosing acts (utility.js); the core observes (onActStart/onActEnd/tick) and answers with
//             emotion/face/affect. Shadow mode = it only observes, nothing in the site reads it.
//   headless: advance(storyMinutes) lets the core choose and "live" acts itself with the same formulas. Used to
//             (a) catch up while the visitor is away and (b) run Monte Carlo days before going live.
import { ACTIVITIES, TIME_SCALE } from './data/activities.gen.js';
import { makeRng, hashSeed, clamp } from './rng.js';
import { makeNeuro } from './neuro.js';
import { makeInstability } from './instability.js';
import { makeLedger } from './ledger.js';
import { makeEmotionPicker, composeAffect } from './emotion.js';
import { makeChains } from './chains.js';
import { makeArt } from './art.js';
import { TASTE } from './data/art.gen.js';
import { makeOutcomes } from './outcome.js';
import { makeHazards } from './hazard.js';
import { makePlanAdjust } from './plan.js';
import { makeGrid } from './grid.js';
import { makeWorld } from './world.js';
import { duration } from './profile.js';
import { EMOTIONS } from './data/emotions.gen.js';
import { TUNE } from './tune.js';
import { CHAINS } from './data/world.gen.js';
import { MIDI_PIECES } from './data/midi.gen.js';
import { FEEL } from './data/feel.gen.js';
import { FOLLOW } from './data/follow.gen.js';

const MOTIVES = Object.keys(TUNE.decay);
const ESSENTIAL = new Set(['sleep', 'eat', 'cook', 'shower', 'brush', 'wash', 'loo', 'dress']);   // never cancelled by a bad mood
const AWAY_CAP_MIN = 14 * 1440;                                  // simulate at most two weeks act-by-act; beyond that decay only

export function makeSimCore({ seed = 1, storage = null, instability = {}, awayScale = 1, withGrid = true, gridBounds = null, solids = null } = {}) {
  const rng = makeRng(seed);
  const neuro = makeNeuro();
  const inst = makeInstability({ rng, neuro });
  if (instability.enabled != null) inst.enabled = instability.enabled;
  for (const [k, v] of Object.entries(instability.lambda || {})) inst.setLambda(k, v);
  const ledger = makeLedger({ rng, neuro, inst });
  const emotion = makeEmotionPicker({ rng, inst });
  const art = makeArt({ rng });
  let savouring = false, pendingSereneSavour = false;
  const motives = Object.fromEntries(MOTIVES.map(m => [m, 0.78]));
  const chains = makeChains({ rng, inst, ledger, ctx: () => ({ emotion: emotion.current, motives, enforceTriggers: true }) });
  const outcomes = makeOutcomes({ rng, inst, neuro, ledger });
  const hazards = makeHazards({ seed, inst });
  const planAdj = makePlanAdjust({ seed, neuro });
  const world = makeWorld({ rng });                              // fluents (teeth, food, dishes, caffeine...) + the goal planner
  const grid = withGrid ? makeGrid({ rng, ...(gridBounds ? { bounds: gridBounds } : {}) }) : null;
  if (grid && solids) for (const b of solids) grid.blockRect(b[0], b[1], b[2], b[3]);          // the real room's footprints, so clutter / openness / roaming see the furniture

  let cancelledKey = '';
  let lastAct = null, forced = null, lastDoneAt = {}, habit = {}; const nudgeQ = []; let stopAt = Infinity; const recent = [];
  let tMin = 7 * 60, day = 0, doing = 'idle', affect = { valence: 0.6, arousal: 0.5, stress: 0.2, energy: 0.78, dominance: 0.5 };
  const journal = [];                                            // recent acts (bounded)
  const days = [];                                               // per-day summaries (bounded)
  let cur = null;                                                // running summary of the current day
  const newDay = d => ({ day: d, acts: {}, n: 0, vSum: 0, sSum: 0, ticks: 0, events: [], chainsDone: 0, chainsBroken: 0, chainsBranched: 0, chainsDead: 0, social: 0, erratic: 0, outcomes: { ok: 0, partial: 0, fail: 0, side: 0, surprise: 0 }, cancelled: 0, sleepMin: 0, actMin: {}, sMax: 0 });
  cur = newDay(0);

  let seq = 0;
  const log = (kind, data) => { journal.push({ seq: ++seq, t: Math.round(tMin), day, kind, ...data }); if (journal.length > 600) journal.shift(); };
  function rollDay() {
    const d = Math.floor(tMin / 1440);
    while (day < d) { cur.v = cur.ticks ? +(cur.vSum / cur.ticks).toFixed(3) : 0; cur.s = cur.ticks ? +(cur.sSum / cur.ticks).toFixed(3) : 0; days.push(cur); if (days.length > 120) days.shift(); day++; cur = newDay(day); }
  }

  // how the act itself feels (ATUS Well-Being per activity), added on top of the body/memory mood
  function feel(a) {
    const f = FEEL[doing] || { v: 0, s: 0 };
    return { ...a, valence: Math.min(1, Math.max(0, a.valence + TUNE.moodShift + TUNE.feelPull * f.v)), stress: Math.min(1, Math.max(0, a.stress + TUNE.stressShift + TUNE.feelPull * f.s)) };
  }
  function recompute() {
    affect = feel(composeAffect({ motives, neuroAffect: neuro.affect(ledger.trace('valence')), traces: ledger.traces }));
    return emotion.pick(affect, 0, neuro.corner().label);
  }

  // advance subsystems by dt sim seconds (live: real dt; headless: act duration)
  let hits = 0;                                                                       // hazards fired so far (runAct reads it to cut an interrupted act short)
  function tick(dt, liveMotives) {
    if (liveMotives) { Object.assign(motives, liveMotives); tMin += dt; rollDay(); }          // live: 1 story minute = 1 sim second
    neuro.step(dt, { asleep: doing === 'sleep' });
    inst.step(dt);
    ledger.step(dt);
    emotion.pick(affect, dt, neuro.corner().label);
    affect = feel(composeAffect({ motives, neuroAffect: neuro.affect(ledger.trace('valence')), traces: ledger.traces }));
    const ev = hazards.poll({ seed, day, t: tMin, stress: affect.stress, fatigue: 1 - motives.energy, act: doing, sleeping: doing === 'sleep', awake: doing !== 'sleep', running: doing === 'run_indoors', frustration: ledger.trace('frustration'), ...motives });
    for (const h of ev) {
      ledger.write(h.ledger, { note: 'hazard:' + h.id });
      if (h.face) emotion.trigger(h.face === 'alarm' ? 'alarm' : h.face);
      if (h.interrupt === 'hard') for (const e of chains.interrupt(tMin)) chainEvent(e);
      else if (h.interrupt === 'soft') for (const e of chains.suspend(tMin)) chainEvent(e);
      if (h.interrupt !== 'none') hits++;
      if (h.social) { cur.social++; if (h.forces) forced = h.forces; } else cur.erratic++;
      cur.events.push(h.id); log('hazard', { id: h.id });
    }
    cur.vSum += affect.valence; cur.sSum += affect.stress; cur.ticks++; if (affect.stress > cur.sMax) cur.sMax = affect.stress;
    return { emotion: emotion.current, face: emotion.faceOf(emotion.current), affect, events: ev };
  }

  function chainEvent(e) {
    if (e.type === 'chain-dropped') { cur.chainsDropped = (cur.chainsDropped || 0) + 1; return; }
    if (e.type === 'chain-suspended') { cur.chainsSuspended = (cur.chainsSuspended || 0) + 1; log(e.type, { id: e.id, chainKind: e.kind }); return; }
    if (e.type === 'chain-complete') cur.chainsDone++; else { cur.chainsBroken++; if (e.to) cur.chainsBranched++; else cur.chainsDead++; }
    log(e.type, { id: e.id, chainKind: e.kind, why: e.why, to: e.to });
    if (savouring && e.id === 'serene_savour') {
      if (e.type === 'chain-complete') finishPiece(true);
      else finishPiece(false);
    }
  }
  function finishPiece(reached) {
    savouring = false; pendingSereneSavour = false;
    const p = art.conclude({ reached, day, affect, emotion: emotion.current }); if (!p) return;
    ledger.write({ satisfied: 'art_satisfied', proud: 'art_proud', disappointed: 'art_disappointed', unsettled: 'art_done' }[p.verdict], { note: 'art:' + p.n });
    { const t = { satisfied: 'aesthetic_appreciation', proud: 'triumph' }[p.verdict]; if (t) emotion.trigger(t); }
    cur.art = cur.art || { pieces: 0, satisfied: 0, proud: 0, disappointed: 0, unsettled: 0 }; cur.art.pieces++; cur.art[p.verdict]++;
    log('art', { n: p.n, verdict: p.verdict, match: p.match });
  }
  function artStage(act, o) {
    if (act === 'art_sketch') art.sketch(affect, emotion.current);
    else if (!art.active) return;
    else if (act === 'art_refine') art.refine(affect);
    else if (act === 'art_render') art.render(affect, o.kind);
    else if (act === 'art_review' && !savouring) {
      if (art.ending === 'serene') { savouring = true; chains.force('serene_savour', tMin); } else finishPiece(false);
    }
  }
  function onActStart(act, now = tMin) {
    doing = act; cur.acts[act] = (cur.acts[act] || 0) + 1; cur.n++;
    const evs = chains.observe(act, now);
    for (const e of evs) chainEvent(e);
    log('act', { act, actKind: ACTIVITIES[act]?.kind });
  }
  function onActEnd(act, ctx = {}) {
    const o = outcomes.sample(act, { fatigue: 1 - motives.energy, stress: affect.stress, ...ctx });
    cur.outcomes[o.kind]++;
    if (ACTIVITIES[act]?.kind === 'erratic') ledger.write('erratic_done', { note: act });
    if (act === 'gallery_view' && o.kind === 'ok' && rng.chance(0.25)) emotion.trigger('awe');
    if (o.kind === 'surprise' && affect.stress < 0.5) emotion.trigger('amusement');
    if (o.kind !== 'ok') log('outcome', { act, outcome: o.kind });
    return o;
  }

  // -------- headless choice: utility with a noise accumulator, sleep gating by clock, chain triggers --------
  // habit[act] = [level, at]: +1 per time done, decays with the act's habTau (minutes)
  function habitNow(name) {
    const h = habit[name]; if (!h) return 0;
    return h[0] * Math.exp(-(tMin - h[1]) / (ACTIVITIES[name]?.habTau ?? TUNE.habTau));
  }
  function habituate(name) {
    if (name === 'sleep' || name === 'loo') return;
    habit[name] = [habitNow(name) + 1, tMin];
  }
  function follow(prev, name) {
    if (!prev) return 1;
    const m = FOLLOW.pairs[prev + '>' + name] ?? FOLLOW.cats[(ACTIVITIES[prev]?.category || '') + '>' + (ACTIVITIES[name]?.category || '')] ?? 1;
    return TUNE.followPull === 1 ? m : m ** TUNE.followPull;
  }
  function actWeights() {
    const hour = (tMin % 1440) / 60;
    const night = hour >= 23 || hour < 6;
    const candidates = {};
    const nextSteps = TUNE.chainPull > 1 ? chains.nextActs() : null;
    const startable = TUNE.chainStartPull > 1 ? new Set(chains.available({ min: tMin % 1440, motives, emotion: emotion.current, hasGrid: !!grid }).map(id => CHAINS[id].steps.find(x => !x.optional).act)) : null;
    const stage = inst.active('desire');
    // a bad mood cancels or postpones the non-essential part of this hour (one seeded decision per hour, memoised)
    const hourKey = day + ':' + Math.floor(tMin / 60);
    const hourPlan = planAdj.adjust({ act: '*' }, { day, index: Math.floor(tMin / 60), valence: affect.valence, stress: affect.stress, energy: motives.energy });
    if (hourPlan.action === 'cancel' && cancelledKey !== hourKey) { cancelledKey = hourKey; cur.cancelled++; }
    for (const [name, a] of Object.entries(ACTIVITIES)) {
      if (a.requires?.includes('inventory') || (a.requires?.includes('grid') && !grid && name !== 'roam')) continue;
      if (a.forcedOnly) continue;
      if (a.artStage && name !== 'art_sketch' && (!art.active || savouring)) continue;
      if (['wall_bump', 'stumble', 'false_start'].includes(name)) continue;                           // hazard-driven, not chosen
      if (!world.guardOk(name, tMin)) continue;                                                       // makes no sense in this state (dress when dressed, brush clean teeth)
      if (['yawn', 'stretch', 'sigh', 'fidget', 'sip', 'glance'].includes(name) && !nextSteps?.has(name)) continue; // micro-acts only when part of an active chain
      let score = 0;
      for (const [m, r] of Object.entries(a.rewards || {})) if (motives[m] != null) score += (1 - motives[m]) ** 2 * r * (a.rate * TUNE.rateScale);
      for (const [m, d] of Object.entries(a.drain || {})) if (motives[m] != null) score -= (1 - motives[m]) * d * TUNE.drainScale;
      if (!Object.keys(a.rewards || {}).length) score += TUNE.microBase;                      // micro-acts exist at a low base
      score *= ACTIVITIES[name].emotionPull?.[emotion.current] ?? 1;
      if (name === 'sleep') score *= night ? TUNE.sleepNight : (motives.energy < TUNE.sleepEnergyAt ? TUNE.sleepLowEnergy : TUNE.sleepDay);
      if (a.artStage && art.active && !savouring) score *= TUNE.artFollow;
      if (nextSteps?.has(name)) score *= TUNE.chainPull; else if (startable?.has(name)) score *= TUNE.chainStartPull;
      if (savouring && chains.live.includes('serene_savour') && chains.nextActs().has(name)) score *= TUNE.savourPull;   // after a serene piece he stays with the savouring routine
      score *= follow(lastAct, name);
      if (name === lastAct) score *= TUNE.repeatPenalty; else if (recent.includes(name)) score *= TUNE.recentPenalty;
      if (a.cooldown && lastDoneAt[name] != null && (tMin - lastDoneAt[name]) * 60 < a.cooldown && !nextSteps?.has(name)) score *= 0.12;
      const cls = FOLLOW.actClass?.[name];
      const hShape = cls && FOLLOW.hourShape?.[cls]?.[Math.floor(hour) % 24];
      // circadian prior; in the dead of night (01-05 h) ordinary acts are pulled much harder towards their clock (no tea at 5 am)
      const deadNight = hour >= 1 && hour < 5 && a.kind === 'normal' && name !== 'loo';
      if (hShape != null && TUNE.circadianPull > 0 && name !== 'sleep') score *= Math.max(0.15, hShape) ** (deadNight ? TUNE.nightPull : TUNE.circadianPull);
      else if (deadNight && name !== 'sleep' && !a.artStage) score *= TUNE.nightQuiet;
      if (name === 'nap_bench' && motives.energy > 0.42) score *= 0.08;
      score *= world.needMul(name, tMin) * world.caffeineMul(name, tMin) * world.pay(name, tMin);
      if (goal && plan.length && world.clobbers(name, plan, tMin)) score *= TUNE.clobberMul;      // would undo what his plan relies on                      // the world asks (dishes in the sink, pyjamas at noon); caffeine already in him
      if (a.due) score *= Math.min(2.5, Math.max(0.05, (tMin - (lastDoneAt[name] ?? tMin - a.due)) / a.due)) ** 2;   // a thing in the world that needs doing again (the plant's thirst), not one of his motives
      // habituation: the same act again soon pays less (a decaying count of recent repeats; replaces the old per-day caps)
      const hv = habitNow(name);
      if (hv > 0) score /= 1 + (a.habK ?? TUNE.habK) * hv * (nextSteps?.has(name) ? TUNE.habChain : 1);
      if ((name === 'eat' || name === 'cook') && motives.hunger > 0.82 && !nextSteps?.has(name)) score *= 0.15;
      if (a.kind === 'erratic') score *= (TUNE.erraticBase + affect.stress * TUNE.erraticStress + (1 - affect.valence) * TUNE.erraticValence) * (name === 'night_shower' || name === 'night_work' ? (night ? 1.5 : 0.1) : 1);
      // duty: the working day pulls him to the desk, less as today's hours fill up (owed falls from 1 to 0 at workTarget minutes)
      const owed = /^work/.test(name) ? clamp(1 - ((cur.actMin.work || 0) + (cur.actMin.work_through || 0)) / TUNE.workTarget, 0, 1) : 1;
      if (name === 'work' && hour >= TUNE.workFrom && hour < TUNE.workTo) score = Math.max(score, TUNE.workDuty * owed) * TUNE.workDay;
      if (name === 'work' && night) score *= TUNE.workNight;
      if (name === 'work_through' && motives.energy > 0.45) score *= 0.2;
      if (name === 'work_through') score *= TUNE.workThroughDone + (1 - TUNE.workThroughDone) * owed;   // pushing on through exhaustion is for work still owed
      // planned cancellation of non-essentials in a bad mood
      if (!ESSENTIAL.has(name) && a.kind === 'normal') {
        if (hourPlan.action === 'cancel') score *= TUNE.cancelMul; else if (hourPlan.action === 'postpone') score *= TUNE.postponeMul;
      }
      if (stage) score *= 1 + inst.noise('desire');
      candidates[name] = Math.max(0.001, score) ** TUNE.pickExp;
    }
    return candidates;
  }
  // intent: sometimes he decides a whole sequence ahead (a walk over the act-to-act affinity graph, shaped by today's motives)
  // and follows it until something breaks it. Any permutation can occur; habits are just the high-affinity ones.
  let plan = [];
  function walkWeights(prev, w0) {
    const o = {}; for (const [a, v] of Object.entries(w0)) if (a !== prev) o[a] = (v / follow(lastAct, a)) ** TUNE.planFlat * follow(prev, a) ** TUNE.planFollow; return o;
  }
  function rollPlan(w0) {
    const first = rng.weighted(w0), seqn = [first], len = rng.int(TUNE.planMin, TUNE.planMax);
    while (seqn.length < len && seqn[seqn.length - 1] !== 'sleep') seqn.push(rng.weighted(walkWeights(seqn[seqn.length - 1], w0)));
    const night = ((tMin % 1440) / 60) >= 21 || ((tMin % 1440) / 60) < 5;
    if (night && seqn[seqn.length - 1] !== 'sleep' && rng.chance(0.6)) seqn.push('sleep');
    return seqn;
  }
  // probability that the policy would walk exactly this chain from the current state (planned route + unplanned route)
  function chainProb(seqIn) {
    const w0 = actWeights(), tot = o => Object.values(o).reduce((x, y) => x + y, 0);
    let free = 1, prev = lastAct;
    const lens = TUNE.planMax - TUNE.planMin + 1;
    let planned = TUNE.planChance * (w0[seqIn[0]] || 0) / tot(w0) * (seqIn.length >= TUNE.planMin && seqIn.length <= TUNE.planMax ? 1 / lens : 0);
    for (let i = 1; i < seqIn.length; i++) { const ww = walkWeights(seqIn[i - 1], w0); planned *= (ww[seqIn[i]] || 0) / tot(ww); }
    for (const a of seqIn) { free *= (w0[a] || 0) / tot(w0); prev = a; }
    return { planned, free, total: planned + (1 - TUNE.planChance) * free };
  }
  // what visitors' play leaves behind: a leaning toward what they did (fades over about a story day) and a little company and fun
  let lean = {}, leanAt = 0;
  const leanF = () => Math.exp(-Math.max(0, tMin - leanAt) / 1440);
  function cue({ act, n = 1, secs = 0 } = {}) {
    const f = leanF(); for (const k in lean) lean[k] *= f; leanAt = tMin;
    if (typeof act === 'string' && ACTIVITIES[act]) lean[act] = Math.min(2.5, (lean[act] || 0) + Math.min(1.5, 0.25 * Math.max(1, n)));
    const k = Math.min(1, Math.max(0, secs) / 900);
    motives.social = Math.min(1, motives.social + 0.12 * k); motives.fun = Math.min(1, motives.fun + 0.06 * k);
  }
  function pickAct() {
    const w = actWeights();
    { const f = leanF(), ks = Object.keys(lean); if (ks.length) { const vs = Object.values(w), avg = vs.reduce((x, y) => x + y, 0) / (vs.length || 1); for (const a of ks) if (a in w) w[a] = w[a] * (1 + lean[a] * f) + lean[a] * f * avg * 0.35; } }       // a visit adds weight of its own, since a rarely chosen act has almost none to multiply
    if (TUNE.goalPlan) return pickGoal(w);
    if (!plan.length && rng.chance(TUNE.planChance)) plan = rollPlan(w);
    if (plan.length && w[plan[0]]) w[plan[0]] *= TUNE.planPull;
    return rng.weighted(w);
  }

  // goal planning: what he wants (picked by appeal) becomes a goal; the planner puts in front whatever the world needs
  // first (cook needs something from the fridge, bed wants brushed teeth). A detour or interruption suspends the goal;
  // he comes back to it with odds exp(-away / resumeTau) and replans from the state the world is in then (resume),
  // and a failed step that leaves a precondition unmet is replanned the same way (a branch).
  let goal = null; const episodes = [];
  const planCtx = w => ({ t: tMin, w0: w, follow, last: lastAct, energy: motives.energy, stress: affect.stress });
  function endGoal(how) {
    if (!goal) return;
    episodes.push({ goal: goal.act, seq: goal.seq.join('>'), how, day, t: Math.round(goal.t0), branches: goal.branches, resumed: goal.resumed, skipped: goal.skipped.length });
    if (episodes.length > 3000) episodes.shift();
    const steps = goal.seq.filter(x => x[0] !== '~').length;
    if (how === 'done') {
      world.learn(goal.seq, goal.kept, goal.skipped, tMin); cur.goalsDone = (cur.goalsDone || 0) + 1;
      if (steps >= 2) ledger.write('goal_done', { scale: Math.min(1.5, 0.3 * steps), note: 'goal:' + goal.act });
    } else {
      cur.goalsDropped = (cur.goalsDropped || 0) + 1;
      if (steps >= 1) ledger.write('goal_dropped', { scale: Math.min(1, 0.4 * steps), note: 'goal:' + goal.act });
    }
    goal = null; plan = [];
  }
  function replan(w) {
    const p = world.plan(goal.act, planCtx(w));
    if (!p) { endGoal('blocked'); return false; }
    plan = p.steps; goal.skipped.push(...p.skipped); goal.kept.push(...p.kept);
    return true;
  }
  function pickGoal(w) {
    if (goal && !plan.length) {                                            // suspended by a detour or an interruption
      // goal memory fades with time away and with every restart; the goal act itself having just been cut halves it again
      const pRes = Math.exp(-(tMin - goal.away) / TUNE.resumeTau) * TUNE.resumeDecay ** goal.resumed * (goal.seq.at(-1) === '~' + goal.act ? 0.5 : 1);
      if (rng.chance(pRes) && replan(w)) { goal.resumed++; return plan[0]; }
      endGoal('dropped');
    }
    if (goal && plan.length && !world.ready(plan[0], tMin)) {             // a step failed and left something unmet: branch
      goal.branches++; if (!replan(w)) return rng.weighted(w);
    }
    if (goal && plan.length) {
      if (w[plan[0]]) w[plan[0]] *= TUNE.planPull;
      return rng.weighted(w);                                              // usually the next step; sometimes something pulls him away
    }
    for (let i = 0; i < 4; i++) {                                          // a new goal; one that cannot be planned now is set aside
      const g = rng.weighted(w);
      goal = { act: g, t0: tMin, seq: [], branches: 0, resumed: 0, skipped: [], kept: [], away: tMin };
      if (replan(w)) return plan[0];
      w = { ...w }; delete w[g]; if (!Object.keys(w).length) break;
    }
    return 'window';
  }
  // after an act: effects on the world, and where the goal stands
  function afterAct(act, ok, done) {
    if (done) world.apply(act, tMin, ok);
    if (!goal || !TUNE.goalPlan) return;
    if (act === goal.act && done) { goal.seq.push(act); endGoal('done'); return; }   // got there (maybe early, skipping steps)
    const i = plan.indexOf(act);
    if (i >= 0 && done) { plan.splice(i, 1); goal.seq.push(act); return; } // a planned step (in order or not)
    goal.seq.push('~' + act);                                              // a detour or an interrupted step: the goal waits,
    if (goal.seq.length > 14) { endGoal('dropped'); return; }
    goal.away = tMin; plan = [];                                           // he may come back to it (pickGoal)
  }

  // keys/guitar: he plays one real piece, chosen by how well it suits his mood now; the piece's own profile pays the rewards
  function pieceWeights(act) {
    const all = Object.keys(MIDI_PIECES), gtr = all.filter(id => /^aguado|aminor-study|g-major-allegro|spanish-romance|guitar/i.test(id));      // guitar-idiomatic pieces only for the guitar
    const keys = all.filter(id => !gtr.includes(id)); const ids = act === 'guitar' ? (gtr.length ? gtr : all) : (keys.length ? keys : all); if (!ids.length) return null;
    const w = {};
    for (const id of ids) {
      const p = MIDI_PIECES[id], t = p.target;
      const close = 1 - (Math.abs(t.valence - affect.valence) + Math.abs(t.arousal - affect.arousal)) / 2;      // mirror the mood...
      const soothe = affect.stress > 0.45 ? p.relief : 0;                                                         // ...or ease it when strained
      w[id] = Math.max(0.02, (p.suits[emotion.current] ?? congruence(t, emotion.current)) * (0.3 + close) + soothe) ** 1.5;
    }
    return w;
  }
  // how well a piece's feeling matches an emotion it has no hand-set score for (closeness to that emotion's prototype)
  function congruence(t, emo) {
    const q = EMOTIONS[emo]?.prototype; if (!q) return 0.4;
    return clamp(1 - Math.hypot(t.valence - q.valence, t.arousal - q.arousal, (t.energy ?? q.energy) - q.energy) / 0.9);
  }
  const pickPiece = act => { const w = pieceWeights(act); return w ? rng.weighted(w) : null; };
  let nowPiece = null;                                                // the piece he is playing in the act that is running (null: no music)
  function suggestPiece(act) {                                        // for a visitor's hands-on play: the same mood-weighted choice, off the shared random stream
    const w = pieceWeights(act); if (!w) return null;
    let r = Math.random() * Object.values(w).reduce((x, y) => x + y, 0);
    for (const [id, v] of Object.entries(w)) if ((r -= v) <= 0) return id;
    return Object.keys(w)[0];
  }
  // free chains: any run of acts is a chain. It closes at sleep (the day's natural closer) or after freeChainMax acts, and is
  // scored by how well its steps flowed (act-to-act affinity) and whether it ended in rest. Named chains are just recognised motifs.
  let seg = [], segFlow = 0, segM0 = null; const freeChains = [];
  const meanM = () => MOTIVES.reduce((t, m) => t + motives[m], 0) / MOTIVES.length;
  function trackFree(act) {
    if (!seg.length) segM0 = meanM(); else segFlow += Math.log(follow(seg[seg.length - 1], act) || 1);
    seg.push(act);
    if (act === 'sleep' || seg.length >= TUNE.freeChainMax) {
      if (seg.length >= 2) {
        const flow = segFlow / (seg.length - 1), gain = meanM() - segM0, closed = act === 'sleep';
        const fc = { seq: seg.join('>'), len: seg.length, flow: +flow.toFixed(3), gain: +gain.toFixed(3), closed, day };
        freeChains.push(fc); if (freeChains.length > 2000) freeChains.shift();
        cur.free = (cur.free || 0) + 1;
        ledger.write('free_chain', { scale: clamp(0.5 + flow * 0.6 + gain * 1.5 + (closed ? 0.3 : 0), 0.1, 1.5), note: fc.seq });
      }
      seg = []; segFlow = 0;
    }
  }
  function runAct(act) {
    const a = ACTIVITIES[act]; if (!a) return;
    lastDoneAt[act] = tMin; habituate(act);
    const mins = Math.max(1, duration(act, { ...affect, fatigue: 1 - motives.energy }, { rng, secPerMinute: 1, noise: inst.active('action') ? inst.sigma('action') : 0 }));
    onActStart(act); nowPiece = null;
    const o = outcomes.sample(act, { fatigue: 1 - motives.energy, stress: affect.stress });
    cur.outcomes[o.kind]++;
    if (o.kind !== 'ok') log('outcome', { act, outcome: o.kind });
    if (ACTIVITIES[act]?.artStage) artStage(act, o);
    let piece = null, pay = null;
    if ((act === 'keys' || act === 'guitar') && o.kind !== 'fail') { piece = pickPiece(act); pay = piece && MIDI_PIECES[piece]; nowPiece = piece; }
    const gain = { ok: 1, partial: TUNE.partialGain, fail: TUNE.failGain, side: 0.8, surprise: 1.3 }[o.kind] * TUNE.satiate * world.pay(act, tMin);   // a snack fills less than a cooked meal
    // motives: drain everything for the elapsed minutes, then the act's rewards (rate per sim second = per story minute)
    const m0 = { ...motives };
    for (const m of MOTIVES) {
      motives[m] = clamp(motives[m] - TUNE.decay[m] * mins * (doing === 'sleep' && m !== 'bladder' && m !== 'hunger' ? TUNE.sleepDecayMul : 1) * inst.gain('motives'));
    }
    const pre = { ...motives };
    for (const [m, r] of Object.entries(a.rewards || {})) if (m in motives) motives[m] = clamp(motives[m] + (1 - motives[m]) * clamp(r * a.rate * mins * gain, 0, 1));
    for (const [m, d] of Object.entries(a.drain || {})) if (m in motives) motives[m] = clamp(motives[m] - d * mins);
    if (pay) {
      for (const [m, r] of Object.entries(pay.pays)) if (m in motives) motives[m] = clamp(motives[m] + (r > 0 ? (1 - motives[m]) * clamp(r * a.rate * mins * gain * 0.5, 0, 1) : r * 0.1));
      ledger.write('music_made', { scale: gain, note: piece }); if (pay.relief > 0.15) ledger.write('music_relief', { scale: pay.relief * gain, note: piece }); if (pay.relief > 0.3) emotion.trigger('nostalgia');
      log('music', { piece, act });
    }
    if (act === 'sleep') ledger.write('slept', { scale: clamp(mins / 420, 0.3, 1.2), note: 'sleep' });
    if (act === 'loo') motives.bladder = 1;
    // step the world in chunks so traces decay and hazards can fire while the act runs. Mood and hazards see the motives
    // as lived so far (start -> end, linear), not the end of the act: 2 h of work must not read as bored from minute one.
    let left = mins; const chunk = Math.max(2, Math.min(10, mins / 3));
    const hits0 = hits, mEnd = { ...motives };
    while (left > 0) {
      const d = Math.min(chunk, left); tMin += d; left -= d; rollDay();
      const f = 1 - left / mins; for (const m of MOTIVES) motives[m] = m0[m] + (mEnd[m] - m0[m]) * f;
      tick(d); if ((hits > hits0 || tMin >= stopAt) && act !== 'sleep' && left > 0) break;   // a hazard cuts the act short
    }
    Object.assign(motives, mEnd);
    let lived = mins;
    if (left > 0 && mins > 0) {                                                  // interrupted: pay only the progress made, and only drain the minutes he lived
      const p = clamp(1 - left / mins, 0, 1); lived = mins - left;
      for (const m of Object.keys(a.rewards || {})) if (m in motives) motives[m] = pre[m] + (motives[m] - pre[m]) * p;
      for (const m of MOTIVES) motives[m] = clamp(motives[m] + TUNE.decay[m] * left * (act === 'sleep' && m !== 'bladder' && m !== 'hunger' ? TUNE.sleepDecayMul : 1) * inst.gain('motives') + (a.drain?.[m] || 0) * left);
      if (act === 'loo' && p < 0.5) motives.bladder = clamp(pre.bladder + (1 - pre.bladder) * p * 2);
      if (p < 0.9) ledger.write(/^work/.test(act) ? 'interrupted_work' : 'interrupted_act', { scale: 1 - p, note: act });   // being cut off costs a little: frustration, less pride
    } else {                                                     // finished acts with their own reward event
      if (act === 'eat') ledger.write('meal_done', { note: act });
      else if (act === 'shower' && mins >= 1.3 * (a.baseMinutes || 10)) ledger.write('long_shower', { note: act });
    }
    { const h0 = ((tMin - mins) % 1440 + 1440) % 1440 / 60;      // a night's sleep cut under 5 h leaves a debt (naps by day are fine)
      if (act === 'sleep' && (h0 >= 21 || h0 < 5) && lived < 300) ledger.write('short_sleep', { scale: (300 - lived) / 300, note: act }); }
    for (const e of chains.sweep(tMin)) chainEvent(e);
    lastAct = act; recent.push(act); if (recent.length > 3) recent.shift();
    afterAct(act, o.kind !== 'fail', lived >= 0.9 * mins); if (!TUNE.goalPlan) { if (plan[0] === act) plan.shift(); else plan = []; }
    trackFree(act);
    cur.actMin[act] = (cur.actMin[act] || 0) + lived; if (act === 'sleep') cur.sleepMin += lived;
    if (cur.ticks && affect.valence > 0.8) cur.events.push('high');
  }
  // live mode: the site performs the act, the core only learns that it began (what runAct does for the choosing state, without moving the clock)
  function noteLive(act) {
    lastDoneAt[act] = tMin; habituate(act); lastAct = act; recent.push(act); if (recent.length > 3) recent.shift();
    afterAct(act, true, true); if (!TUNE.goalPlan) { if (plan[0] === act) plan.shift(); else plan = []; }
    trackFree(act);
  }
  const liveDuration = act => Math.max(1, duration(act, { ...affect, fatigue: 1 - motives.energy }, { rng, secPerMinute: 1 }));   // story minutes = real seconds live
  function advance(storyMinutes, until = Infinity, cut = false) {   // `until`: a visitor's cue is due then; stop at the next act boundary after it (`cut`: end the running act there too, sleep excepted)
    const end = tMin + storyMinutes; let guard = 0; stopAt = cut ? until : Infinity;
    while (tMin < end && tMin < until && guard++ < 100000) { const f = forced || nudgeQ.shift(); forced = null; runAct(f || pickAct()); }
    stopAt = Infinity;
  }

  // -------- persistence + away --------
  function snapshot() {
    return { v: 1, seed, tMin, day, doing, motives: { ...motives }, rng: rng.state(), neuro: neuro.snapshot(), inst: inst.snapshot(), ledger: ledger.snapshot(), emotion: emotion.snapshot(), chains: chains.snapshot(), outcomes: outcomes.snapshot(), hazards: hazards.snapshot(), planAdj: planAdj.snapshot(), art: art.snapshot(), savouring, plan: [...plan], world: world.snapshot(), goal: goal && JSON.parse(JSON.stringify(goal)), seg: [...seg], segFlow, segM0, grid: grid?.snapshot(), lastAct, lastDoneAt: { ...lastDoneAt }, habit: JSON.parse(JSON.stringify(habit)), cancelledKey, forced, lean: { ...lean }, leanAt, recent: [...recent], affect: { ...affect }, journal: journal.slice(-200), days: days.slice(-60), cur, lastSeen: Date.now() };
  }
  function restore(s) {
    if (!s || s.v !== 1) return false;
    nudgeQ.length = 0; tMin = s.tMin; day = s.day; doing = s.doing || 'idle'; Object.assign(motives, s.motives); rng.setState(s.rng);
    neuro.restore(s.neuro); inst.restore(s.inst); ledger.restore(s.ledger); emotion.restore(s.emotion); chains.restore(s.chains); if (s.affect) affect = { ...s.affect }; lastAct = s.lastAct ?? null; lastDoneAt = { ...(s.lastDoneAt || {}) }; habit = JSON.parse(JSON.stringify(s.habit || {})); cancelledKey = s.cancelledKey || ''; lean = { ...(s.lean || {}) }; leanAt = s.leanAt ?? 0; forced = s.forced ?? null; recent.length = 0; recent.push(...(s.recent || []));
    outcomes.restore(s.outcomes); hazards.restore(s.hazards); planAdj.restore(s.planAdj); art.restore(s.art); savouring = !!s.savouring; plan = Array.isArray(s.plan) ? [...s.plan] : []; world.restore(s.world); goal = s.goal ? JSON.parse(JSON.stringify(s.goal)) : null; seg = s.seg || []; segFlow = s.segFlow || 0; segM0 = s.segM0 ?? null; grid?.restore(s.grid);
    journal.length = 0; journal.push(...(s.journal || [])); seq = journal.reduce((m, e) => Math.max(m, e.seq || 0), 0); days.length = 0; days.push(...(s.days || [])); cur = s.cur || newDay(day);
    return true;
  }
  const save = () => storage?.save(snapshot());
  // elapsed real seconds -> story minutes; act-by-act up to the cap, analytic decay for the remainder. Returns a report.
  function catchUp(elapsedRealSeconds) {
    const startDay = day, startSeq = seq, v0 = affect.valence, s0 = affect.stress;
    const storyMin = elapsedRealSeconds / 60 * awayScale;
    const simMin = Math.min(storyMin, AWAY_CAP_MIN);
    const skipped = storyMin - simMin;
    if (skipped > 0) {
      neuro.catchUp(skipped * 60); ledger.catchUp(skipped * 60);
      tMin += skipped; rollDay();
      for (const m of MOTIVES) motives[m] = clamp(0.5 + (motives[m] - 0.5) * 0.3);
    }
    advance(simMin);
    const fresh = journal.filter(e => e.seq > startSeq);
    const acts = {}; for (const e of fresh) if (e.kind === 'act') acts[e.act] = (acts[e.act] || 0) + 1;
    const top = Object.entries(acts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      awayMinutes: Math.round(storyMin), daysPassed: day - startDay, topActs: top,
      moodBefore: +v0.toFixed(2), moodAfter: +affect.valence.toFixed(2), stressBefore: +s0.toFixed(2), stressAfter: +affect.stress.toFixed(2),
      notable: fresh.filter(e => e.kind !== 'act').slice(-8), emotion: emotion.current,
    };
  }
  function boot(now = Date.now()) {                              // load + catch up in one call; null if first visit
    const s = storage?.load(); if (!s || !restore(s)) return null;
    return catchUp(Math.max(0, (now - (s.lastSeen || now)) / 1000));
  }

  return {
    rng, neuro, inst, ledger, emotion, chains, outcomes, hazards, planAdj, grid, motives, world, episodes, get goal() { return goal && { ...goal, plan: [...plan] }; },
    tick, onActStart, onActEnd, noteLive, liveDuration, advance, recompute, pickAct, actWeights, follow, chainProb, freeChains, runAct, snapshot, restore, save, catchUp, boot,
    cue,
    suggestPiece, get piece() { return nowPiece; },
    nudge: act => { if (typeof act === 'string' && nudgeQ.length < 6) nudgeQ.push(act); },                  // a visitor's push: his next act is this one (shared life applies these in a fixed order, so everyone agrees)
    visitor: () => { cur.social++; ledger.write('visitor_arrive', { note: 'visitor' }); for (const e of chains.suspend(tMin)) chainEvent(e); forced = 'greet_visitor'; },
    startle: () => { emotion.trigger('alarm'); ledger.write('startle', { note: 'external' }); for (const e of chains.interrupt(tMin)) chainEvent(e); },
    bump: () => ledger.write('wall_bump', { note: 'bump' }),
    get time() { return { tMin, day, hour: (tMin % 1440) / 60 }; },
    get affect() { return affect; },
    get doing() { return doing; },
    journal, days, get today() { return cur; },
    ledgerRecent: n => ledger.recent(n),
    art,
    debug: () => ({ emotion: emotion.current, affect, neuro: { ...neuro.vars }, traces: { ...ledger.traces }, motives: { ...motives }, live: chains.live, today: cur }),
  };
}
