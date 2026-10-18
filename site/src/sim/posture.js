// Procedural Posture & Emotion Synthesis Engine:
// Maps real-time motives -> Affective state (Arousal, Valence, Fatigue) ->
//   1. Spine & neck forward slump (Fatigue) + chest expansion (Valence)
//   2. Dynamic breathing rate (1.2 Hz when tired up to 2.2 Hz when active, scaled by Arousal)
//   3. Low-frequency weight shifting / micro-fidgets (0.2 Hz sine sway on hips and spine)
//   4. Saccadic head glances toward room points of interest (window, desk, snake)
//   5. Dynamic facial expressions & musical tempo/voicing matrix mapped from Valence, Energy, and Arousal

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const TWO_PI = Math.PI * 2;

// Points of interest in world coordinates (x, y, z)
export const DEFAULT_POI = {
  window: { name: 'window', x: -1.7, y: 1.45, z: -2.8 },
  desk:   { name: 'desk',   x: -0.65, y: 1.15, z: 2.64 },
  snake:  { name: 'snake',  x: -2.05, y: 0.25, z: -0.3 },
};

// Master Matrix: Emotion -> Affective Thresholds, Facial Expression, Musical MIDI/Chords, Tempo, and Skeleton Posture
// generated from tools/emotions/emotions.json (legacy subset keeps today's behaviour; POSTURE_MATRIX_FULL has all emotions)
import { POSTURE_MATRIX_LEGACY, EMOTIONS, FACE_TEXTURES } from './data/emotions.gen.js';
export const POSTURE_EMOTION_MATRIX = POSTURE_MATRIX_LEGACY;

// Compute affective state from motives vector
export function computeAffect(motives = {}) {
  const energy  = clamp(motives.energy ?? 0.78, 0, 1);
  const fun     = clamp(motives.fun ?? 0.72, 0, 1);
  const hunger  = clamp(motives.hunger ?? 0.74, 0, 1);
  const hygiene = clamp(motives.hygiene ?? 0.84, 0, 1);

  const arousal = clamp(0.7 * energy + 0.3 * fun, 0, 1);
  const valence = clamp((energy + fun + hunger + hygiene) / 4, 0, 1);
  const fatigue = clamp(1.0 - energy, 0, 1);

  return { arousal, valence, fatigue, energy, fun, hunger, hygiene };
}

// Map Valence and Energy (plus Arousal) to one of the 8 core expressions:
// ('sleep', 'dazed', 'given_up', 'uneasy', 'neutral', 'calm', 'curious', 'delighted')
export function mapEmotionToFace({ energy = 0.78, valence = 0.75, arousal = 0.75, sleeping = false, glancing = false } = {}) {
  if (sleeping || energy < 0.14) return 'sleep';
  if (energy < 0.28) return valence < 0.42 ? 'given_up' : 'dazed';
  if (energy < 0.38) return valence < 0.36 ? 'given_up' : 'dazed';
  if (valence < 0.30) return energy < 0.50 ? 'given_up' : 'uneasy';
  if (valence < 0.44) return 'uneasy';
  if (valence >= 0.80) return arousal >= 0.56 ? 'delighted' : 'calm';
  if (valence >= 0.64) return (glancing || arousal >= 0.66) ? 'curious' : 'calm';
  if (glancing && arousal >= 0.48) return 'curious';
  return valence >= 0.54 ? 'calm' : 'neutral';
}

// Per-act scale factors so tight prop/self-contact acts never clip geometry while still breathing/emoting
export const ACT_POSTURE_SCALE = {
  bed:      0.0,   // lying under cover with head on pillow
  wash:     0.15,  // splashing face over basin
  brush:    0.15,  // toothbrush at mouth
  eat:      0.15,  // spoon at mouth
  shower:   0.25,  // hands scrubbing hair
  tea:      0.35,  // pouring kettle / sipping mug
  fridge:   0.3,   // reaching into fridge
  cook:     0.35,  // stirring pan
  wardrobe: 0.35,
  door:     0.0,
  desk:     0.6,
  keys:     0.65,
  guitar:   0.5,
  read:     0.55,
  tv:       0.75,
  think:    0.45,  // cheek rests on handR (handR follows head)
  pin:      0.65,
  bench:    0.85,
  stool:    0.85,
};

// Gait by emotion, from Bandai-Namco Motiondataset-2 walks (tools/data/fit_gait.py -> tools/data/gait_fit.json; CC BY-NC).
// speed = measured style ratio pulled halfway to 1 (a room is small); headDown = measured head pitch delta in radians (~0.5 weight).
const GAIT = {
  active:    { speed: 1.14, headDown: 0.056 },   // 1.28x, head -6.4 deg
  exhausted: { speed: 0.98, headDown: 0.117 },   // 0.95x, head -13.4 deg
  elderly:   { speed: 0.84, headDown: 0.067 },   // 0.69x, head -7.6 deg
};
const GAIT_OF = { joyful: 'active', delighted: 'active', proud: 'active', triumph: 'active', amusement: 'active', excited: 'active', restless: 'active',
  drowsy: 'exhausted', dazed: 'exhausted', bored: 'exhausted', anxious: 'exhausted', frustrated: 'exhausted', sad: 'elderly', given_up: 'elderly', lonely: 'elderly' };

// style: this character's own manner (data/characters.gen.js `motion`): breath, sway, expressive (how far feelings show in the body), glance (1 = as often as him, 2 = half as often), blink, tempo, face { valence, arousal } bias
export function makePosture({ getMotives, getSnakePos, getOthers, style = null } = {}) {
  const X = { breath: 1, sway: 1, expressive: 1, glance: 1, blink: 1, tempo: 1, face: null, ...(style || {}) };
  let simEmotion = null;
  const state = {
    gait: 1,
    arousal: 0.76,
    valence: 0.77,
    fatigue: 0.22,
    breathHz: 1.96,
    breathPhase: 0,
    face: 'calm',
    blink: false,
    blinkIn: 3,
    blinkFor: 0,
    tempo: 1.0,
    glance: {
      active: false,
      target: null,
      yaw: 0,
      pitch: 0,
      timer: 0,
      dur: 1.1,
      cooldown: 3.2,
    },
    deltas: {
      hips: [0, 0, 0],
      spine: [0, 0, 0],
      chest: [0, 0, 0],
      neck: [0, 0, 0],
      head: [0, 0, 0],
      upperarmL: [0, 0, 0], upperarmR: [0, 0, 0],
      handL: [0, 0, 0], handR: [0, 0, 0],
      thighL: [0, 0, 0], thighR: [0, 0, 0], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0],
      fingers: 0, fingersT: 0,
    },
  };

  function getPOIs() {
    const sp = getSnakePos?.();
    return [
      DEFAULT_POI.window,
      DEFAULT_POI.desk,
      sp ? { name: 'snake', x: sp.x, y: 0.25, z: sp.z } : DEFAULT_POI.snake,
      ...(getOthers?.() || []),                                         // the other characters in the room (cast.js): a glance at someone is a glance at a place of interest
    ];
  }

  function updateGlance(dt, t, pos, heading, canGlance) {
    const g = state.glance;
    if (dt <= 0) return;                                  // a zero-length frame must not reset glance state
    if (!canGlance) {
      g.yaw *= Math.exp(-8 * dt);
      g.pitch *= Math.exp(-8 * dt);
      g.active = Math.abs(g.yaw) > 0.01;
      return;
    }

    if (g.active) {
      g.timer += dt;
      if (g.timer >= g.dur) {
        g.active = false;
        g.cooldown = (3.2 + ((Math.sin(t * 7.13) + 1) * 0.5) * 3.5) * X.glance;
      }
    } else {
      g.cooldown -= dt;
      if (g.cooldown <= 0) {
        const pois = getPOIs();
        const px = pos?.x ?? 0, pz = pos?.z ?? 0;
        const candidates = [];
        for (const p of pois) {
          const dx = p.x - px, dz = p.z - pz, dist = Math.hypot(dx, dz);
          if (dist < 0.35 || dist > 9.0) continue;
          const worldYaw = Math.atan2(dx, dz);
          const relYaw = wrap(worldYaw - (heading || 0));
          if (Math.abs(relYaw) < 1.35) {
            const relPitch = clamp(Math.atan2(1.4 - p.y, Math.max(0.6, dist)) * 0.45, -0.16, 0.22);
            candidates.push({ name: p.name, who: p.who, yaw: clamp(relYaw * 0.55, -0.32, 0.32), pitch: relPitch, dist });
          }
        }
        if (candidates.length) {
          // Prefer glancing at the snake when it slithers close (< 2.2 m)
          const nearSnake = candidates.find(c => (c.name === 'snake' || c.who) && c.dist < 2.2);
          const idx = Math.floor(((Math.sin(t * 13.37) + 1) * 0.5) * candidates.length) % candidates.length;
          const pick = nearSnake || candidates[idx];
          g.active = true;
          g.target = pick.name;
          g.targetYaw = pick.yaw;
          g.targetPitch = pick.pitch;
          g.timer = 0;
          g.dur = 0.85 + ((Math.cos(t * 5.7) + 1) * 0.5) * 0.65;
        } else {
          g.cooldown = 2.0;
        }
      }
    }

    // Saccadic envelope: fast onset, brief fixation hold, smooth return
    let env = 0;
    if (g.active) {
      const u = g.timer / g.dur;
      env = u < 0.18 ? (u / 0.18) : u > 0.75 ? Math.max(0, (1 - u) / 0.25) : 1;
      env = env * env * (3 - 2 * env);
    }
    const wantYaw = g.active ? (g.targetYaw || 0) * env : 0;
    const wantPitch = g.active ? (g.targetPitch || 0) * env : 0;
    const k = 1 - Math.exp(-14 * dt);
    g.yaw += (wantYaw - g.yaw) * k;
    g.pitch += (wantPitch - g.pitch) * k;
  }

  // Advance affective state and compute bone Euler deltas for this frame
  function step(dt, t, { pos = null, heading = 0, speed = 0, seated = null } = {}) {
    const motives = getMotives?.() || {};
    const aff = computeAffect(motives);
    state.arousal = aff.arousal;
    state.valence = aff.valence;
    state.fatigue = aff.fatigue;

    // Breathing frequency: 1.2 Hz when tired (arousal = 0) up to 2.2 Hz when active (arousal = 1)
    state.breathHz = 1.2 + aff.arousal * 1.0;
    // integrate the phase (never t * hz, which jumps whenever hz changes); dt = 0 holds it, a long stall is clamped
    if (dt > 0) state.breathPhase = (state.breathPhase + Math.min(dt, 0.1) * state.breathHz * TWO_PI) % TWO_PI;
    const breathWave = Math.sin(state.breathPhase);

    const actName = seated?.act || null;
    const moveFactor = clamp(speed / 1.7, 0, 1);
    const stillFactor = 1 - moveFactor * 0.75;
    const actScale = actName ? (ACT_POSTURE_SCALE[actName] ?? 0.5) : 1.0;

    // Glance only when standing idle or in relaxed seated/standing stations
    const canGlance = !actName
      ? moveFactor < 0.25
      : ['stool', 'bench', 'desk', 'tv', 'keys'].includes(actName);
    updateGlance(dt, t, pos, heading, canGlance);

    // 1. Spine & Neck: forward slump (+x) scaled by Fatigue; chest expansion (-x) scaled by Valence
    const slumpSpine = aff.fatigue * 0.065 * actScale * X.expressive;
    const slumpNeck  = aff.fatigue * 0.055 * actScale * X.expressive;
    const chestExpand = -(aff.valence - 0.5) * 0.06 * actScale * X.expressive;

    // 2. Dynamic breathing oscillation on spine and chest
    const breathAmp = (0.016 + aff.arousal * 0.01) * X.breath * stillFactor * Math.max(0.3, actScale);
    const breathSpine = breathWave * breathAmp;
    const breathChest = -breathWave * breathAmp * 1.15;

    // 3. Weight shifting / micro-fidgets: 0.2 Hz procedural sine sway on hips and spine when standing or seated
    const swayWave = Math.sin(t * 0.2 * TWO_PI);
    const swayWave2 = Math.cos(t * 0.2 * TWO_PI * 0.7 + 0.8);
    const swayScale = (seated ? 0.45 : stillFactor) * actScale * X.sway;
    const hipRoll = swayWave * 0.022 * swayScale;
    const hipYaw  = swayWave2 * 0.016 * swayScale;
    const spineRoll = -swayWave * 0.018 * swayScale;
    const spineYaw  = -swayWave2 * 0.012 * swayScale;

    // 4. Saccadic head glance distributed across neck (30%) and head (70%)
    const gYaw = state.glance.yaw * actScale;
    const gPitch = state.glance.pitch * actScale;

    state.deltas.hips  = [0, hipYaw, hipRoll];
    state.deltas.spine = [slumpSpine + breathSpine, spineYaw, spineRoll];
    state.deltas.chest = [chestExpand + breathChest, 0, 0];
    state.deltas.neck  = [slumpNeck + gPitch * 0.3, gYaw * 0.3, 0];
    state.deltas.head  = [aff.fatigue * 0.03 * actScale + gPitch * 0.7, gYaw * 0.7, 0];

    // 5. Dynamic facial expression & musical tempo multiplier from Valence & Energy
    state.face = mapEmotionToFace({
      energy: aff.energy,
      valence: clamp(aff.valence + (X.face?.valence || 0), 0, 1),
      arousal: clamp(aff.arousal + (X.face?.arousal || 0), 0, 1),
      sleeping: actName === 'bed',
      glancing: state.glance.active,
    });
    // the sim core's emotion (all 27) overrides the legacy 8-face ladder when present; its rig coords tilt head/spine
    const g = GAIT[GAIT_OF[simEmotion]];
    state.gait = g ? g.speed : 1;
    if (g && actName !== 'bed') state.deltas.head[0] += g.headDown * actScale * 0.5;
    const sc = simEmotion && EMOTIONS[simEmotion]?.coords;
    if (sc && actName !== 'bed') {
      if (FACE_TEXTURES.includes(simEmotion)) state.face = simEmotion;
      const k = actScale * 0.35;
      state.deltas.head[0] += (sc.head_pitch || 0) * 0.25 * k;
      state.deltas.spine[0] += (sc.spine_slump || 0) * 0.12 * k;
      state.deltas.neck[0] += (sc.shoulder_lift || 0) * -0.06 * k;
    }
    // 6. Shoulders, fingers, feet and knees from the emotion's rig coords (shoulder_lift, hand_curl, finger_tremor, foot_tap, knee_bend)
    {
      const c = (simEmotion && EMOTIONS[simEmotion]?.coords) || {};
      const ph = t * TWO_PI;
      const calmAct = !actName || ['stool', 'bench', 'desk', 'tv', 'keys', 'think', 'read'].includes(actName);
      const lift = (c.shoulder_lift || 0) * 0.12 * actScale;                           // shoulders rise with tension, drop with sadness
      state.deltas.upperarmL = [0, 0, -lift]; state.deltas.upperarmR = [0, 0, lift];
      state.deltas.fingers = clamp((c.hand_curl ?? 0.3) - 0.3, -0.3, 0.7) * 0.5 * (actName ? 0.4 : 1);   // extra finger curl, radians
      state.deltas.fingersT = (c.finger_tremor || 0) * 0.04 * (0.6 + 0.4 * Math.sin(ph * 7.3)) * (actName ? 0.4 : 1);
      const tap = calmAct && actName && actName !== 'bed' ? Math.max(0, c.foot_tap || 0) : 0;
      const tapW = tap * Math.max(0, Math.sin(ph * (1.6 + 1.2 * aff.arousal))) * 0.22;
      state.deltas.footR = [-tapW, 0, 0];
      const knee = !actName ? clamp(c.knee_bend || 0, -0.5, 0.8) * 0.1 * stillFactor : 0;
      state.deltas.thighL = [knee, 0, 0]; state.deltas.thighR = [knee, 0, 0];
      state.deltas.shinL = [-knee * 1.4, 0, 0]; state.deltas.shinR = [-knee * 1.4, 0, 0];
    }

    // 7. Blink: a 0.12 s eyes-shut flash. Anxious blinks fast, absorbed/calm slowly, asleep never (the sleep face is already shut).
    if (dt > 0) {
      if (state.blinkFor > 0) { state.blinkFor -= dt; if (state.blinkFor <= 0) state.blink = false; }
      else {
        state.blinkIn -= dt;
        if (state.blinkIn <= 0) {
          const nerv = clamp((1 - (aff.valence)) + aff.fatigue * 0.5, 0, 1);
          state.blink = true; state.blinkFor = 0.12;
          state.blinkIn = (2.2 + (1 - nerv) * 3.4 + ((Math.sin(t * 91.7) + 1) * 0.5) * 2.2) / X.blink;
        }
      }
    }
    state.tempo = (POSTURE_EMOTION_MATRIX[state.face]?.tempo || 1.0) * X.tempo;
    if (seated) seated.tempo = state.tempo;

    return state;
  }

  // Apply procedural posture adjustments to an act spec's FK before applyAct solves 2-bone IK
  function applyToSpec(spec, ctx = {}) {
    if (!spec) return spec;
    const actName = ctx.seated?.act || null;
    const scale = actName ? (ACT_POSTURE_SCALE[actName] ?? 0.5) : 1.0;
    step(ctx.dt || 0, ctx.t || 0, ctx);

    if (scale > 0) {
      const fk = { ...(spec.fk || {}) };
      for (const bone of ['hips', 'spine', 'chest', 'neck', 'head', 'upperarmL', 'upperarmR', 'thighL', 'thighR', 'shinL', 'shinR', 'footR']) {
        const d = state.deltas[bone];
        if (!d) continue;
        const base = fk[bone] || [0, 0, 0];
        fk[bone] = [base[0] + d[0], base[1] + d[1], base[2] + d[2]];
      }
      spec.fingers = state.deltas.fingers + state.deltas.fingersT;                 // acts.js adds it on top of the grip
      spec.fk = fk;
    }

    // Dynamic facial expression: preserve reactive transient faces ('alarm', 'sleep'),
    // and override neutral/default faces when affective state is strongly positive or fatigued/low-valence
    const motivesShifted = Math.abs(state.fatigue - 0.22) > 0.14 || Math.abs(state.valence - 0.77) > 0.14;
    if (spec.face !== 'alarm' && spec.face !== 'sleep' && actName !== 'bed') {
      if (motivesShifted || !spec.face || spec.face === 'neutral') {
        spec.face = state.face;
      }
    }
    return spec;
  }

  return {
    state,
    step,
    applyToSpec,
    matrix: POSTURE_EMOTION_MATRIX,
    actScales: ACT_POSTURE_SCALE,
    computeAffect: () => computeAffect(getMotives?.()),
    mapEmotionToFace,
    shownFace: face => (state.blink && face !== 'sleep' && face !== 'alarm' && face !== 'drowsy' ? 'sleep' : face),
    setSimEmotion: n => { simEmotion = n || null; },
  };
}
