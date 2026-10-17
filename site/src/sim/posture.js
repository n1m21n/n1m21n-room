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
export const POSTURE_EMOTION_MATRIX = {
  delighted: {
    face: 'delighted',
    condition: 'valence >= 0.80 && arousal >= 0.56',
    midi: '/media/midi/happy-prelude.mid',
    keysProgression: 'Cmaj9 -> Gmaj7 -> Fmaj7 -> G6',
    guitarProgression: 'G -> Dadd9 -> Cadd9 -> G',
    tempo: 1.22,
    velocity: 1.15,
    breathHzRange: [1.75, 2.20],
    spineSlumpRad: 0.0,
    chestExpandRad: -0.025,
  },
  curious: {
    face: 'curious',
    condition: '(valence >= 0.64 && arousal >= 0.66) || (glancing && arousal >= 0.48)',
    midi: '/media/midi/curious-etude.mid',
    keysProgression: 'Dm9 -> G13 -> Cmaj9 -> A7sus4',
    guitarProgression: 'Em9 -> Cmaj7 -> Am -> Dsus2',
    tempo: 1.08,
    velocity: 1.00,
    breathHzRange: [1.65, 2.05],
    spineSlumpRad: 0.01,
    chestExpandRad: -0.012,
  },
  calm: {
    face: 'calm',
    condition: 'valence >= 0.54 && arousal < 0.66',
    midi: '/media/midi/clair-de-lune.mid',
    keysProgression: 'Am -> Fmaj7 -> C -> G',
    guitarProgression: 'Em -> C -> G -> D',
    tempo: 1.00,
    velocity: 0.92,
    breathHzRange: [1.45, 1.85],
    spineSlumpRad: 0.015,
    chestExpandRad: -0.008,
  },
  neutral: {
    face: 'neutral',
    condition: '0.44 <= valence < 0.54 && energy >= 0.38',
    midi: '/media/midi/clair-de-lune.mid',
    keysProgression: 'Am -> Fmaj7 -> C -> G',
    guitarProgression: 'Em -> C -> G -> D',
    tempo: 1.00,
    velocity: 0.90,
    breathHzRange: [1.45, 1.80],
    spineSlumpRad: 0.02,
    chestExpandRad: 0.0,
  },
  uneasy: {
    face: 'uneasy',
    condition: '0.30 <= valence < 0.44 || (valence < 0.30 && energy >= 0.50)',
    midi: '/media/midi/uneasy-nocturne.mid',
    keysProgression: 'Fm(maj7) -> E7b9 -> Am(maj7) -> D7b5',
    guitarProgression: 'Em -> Fmaj7 -> Am -> B7',
    tempo: 0.92,
    velocity: 0.85,
    breathHzRange: [1.40, 1.75],
    spineSlumpRad: 0.035,
    chestExpandRad: 0.015,
  },
  dazed: {
    face: 'dazed',
    condition: '0.28 <= energy < 0.38 && valence >= 0.36',
    midi: '/media/midi/dazed-drift.mid',
    keysProgression: 'Em9 -> Cmaj7 -> Am9 -> B7sus4',
    guitarProgression: 'Am7 -> Dm7 -> Em7 -> Am',
    tempo: 0.76,
    velocity: 0.72,
    breathHzRange: [1.28, 1.50],
    spineSlumpRad: 0.045,
    chestExpandRad: 0.018,
  },
  given_up: {
    face: 'given_up',
    condition: 'energy < 0.28 || (energy < 0.50 && valence < 0.30)',
    midi: '/media/midi/tired-lullaby.mid',
    keysProgression: 'Am -> F -> Dm7 -> E',
    guitarProgression: 'Am -> Dm -> Em -> Am',
    tempo: 0.68,
    velocity: 0.65,
    breathHzRange: [1.20, 1.38],
    spineSlumpRad: 0.060,
    chestExpandRad: 0.025,
  },
  sleep: {
    face: 'sleep',
    condition: 'sleeping || energy < 0.14',
    midi: '/media/midi/tired-lullaby.mid',
    keysProgression: 'Am -> F -> Dm7 -> E',
    guitarProgression: 'Am -> Dm -> Em -> Am',
    tempo: 0.60,
    velocity: 0.50,
    breathHzRange: [1.10, 1.25],
    spineSlumpRad: 0.0,
    chestExpandRad: 0.0,
  },
};

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

export function makePosture({ getMotives, getSnakePos } = {}) {
  const state = {
    arousal: 0.76,
    valence: 0.77,
    fatigue: 0.22,
    breathHz: 1.96,
    breathPhase: 0,
    face: 'calm',
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
    },
  };

  function getPOIs() {
    const sp = getSnakePos?.();
    return [
      DEFAULT_POI.window,
      DEFAULT_POI.desk,
      sp ? { name: 'snake', x: sp.x, y: 0.25, z: sp.z } : DEFAULT_POI.snake,
    ];
  }

  function updateGlance(dt, t, pos, heading, canGlance) {
    const g = state.glance;
    if (!canGlance || dt <= 0) {
      g.yaw *= Math.exp(-8 * Math.max(0, dt));
      g.pitch *= Math.exp(-8 * Math.max(0, dt));
      g.active = Math.abs(g.yaw) > 0.01;
      return;
    }

    if (g.active) {
      g.timer += dt;
      if (g.timer >= g.dur) {
        g.active = false;
        g.cooldown = 3.2 + ((Math.sin(t * 7.13) + 1) * 0.5) * 3.5;
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
            candidates.push({ name: p.name, yaw: clamp(relYaw * 0.55, -0.32, 0.32), pitch: relPitch, dist });
          }
        }
        if (candidates.length) {
          // Prefer glancing at the snake when it slithers close (< 2.2 m)
          const nearSnake = candidates.find(c => c.name === 'snake' && c.dist < 2.2);
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
    if (dt > 0 && dt < 0.5) {
      state.breathPhase = (state.breathPhase + dt * state.breathHz * TWO_PI) % TWO_PI;
    } else {
      state.breathPhase = (t * state.breathHz * TWO_PI) % TWO_PI;
    }
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
    const slumpSpine = aff.fatigue * 0.065 * actScale;
    const slumpNeck  = aff.fatigue * 0.055 * actScale;
    const chestExpand = -(aff.valence - 0.5) * 0.06 * actScale;

    // 2. Dynamic breathing oscillation on spine and chest
    const breathAmp = (0.016 + aff.arousal * 0.01) * stillFactor * Math.max(0.3, actScale);
    const breathSpine = breathWave * breathAmp;
    const breathChest = -breathWave * breathAmp * 1.15;

    // 3. Weight shifting / micro-fidgets: 0.2 Hz procedural sine sway on hips and spine when standing or seated
    const swayWave = Math.sin(t * 0.2 * TWO_PI);
    const swayWave2 = Math.cos(t * 0.2 * TWO_PI * 0.7 + 0.8);
    const swayScale = (seated ? 0.45 : stillFactor) * actScale;
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
      valence: aff.valence,
      arousal: aff.arousal,
      sleeping: actName === 'bed',
      glancing: state.glance.active,
    });
    state.tempo = POSTURE_EMOTION_MATRIX[state.face]?.tempo || 1.0;
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
      for (const bone of ['hips', 'spine', 'chest', 'neck', 'head']) {
        const d = state.deltas[bone];
        if (!d) continue;
        const base = fk[bone] || [0, 0, 0];
        fk[bone] = [base[0] + d[0], base[1] + d[1], base[2] + d[2]];
      }
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
  };
}
