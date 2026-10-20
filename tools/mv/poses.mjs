// Music-video poses as applyAct specs (FK + two-bone IK), so arms and legs never break: hands and feet are placed,
// the rig solves the joints. (u, t) like ACTS; t is song time, so the bounce sits on the 138 BPM grid.
// Man-local metres: he faces +z, his left is +x, floor y 0. An ik value can be a body contact:
//   { at: bone | [boneA, boneB, k], add: [x, y, z] }  -> resolved against his own bones in the page.
const S = Math.sin, BEAT = 60 / 138;
const bounce = t => Math.abs(S(Math.PI * t / BEAT));          // 1 on every beat
const plant = (y, w = 0.13, z = 0.03) => ({ footL: [w, 0.115, z], footR: [-w, 0.115, z - 0.03] });   // feet stay put, knees take the drop
const KNEES = { footL: [0.1, 0.3, 1], footR: [-0.1, 0.3, 1] };

const nrm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
function heldAt(tip, F, N, reach, held = 0.012) {              // acts.js heldAt: the palm point that puts a held tool's tip at `tip`
  F = nrm(F); const d = F[0] * N[0] + F[1] * N[1] + F[2] * N[2]; N = nrm(N.map((n, i) => n - d * F[i]));
  return { at: tip.map((v, i) => v - F[i] * reach - N[i] * held), hand: [F, N] };
}

export const MV = {
  // euphoric: both hands up, head back, knees on the beat (IV-5, IV-7)
  up: (u, t) => {
    const b = bounce(t), y = -0.03 - 0.05 * b, w = S(t * 1.3) * 0.06;
    return {
      y, face: 'joyful',
      fk: { hips: [0, 0, w * 0.5], spine: [-0.06, 0, -w], chest: [-0.08, 0.05, 0], neck: [-0.1, 0, 0], head: [-0.22, 0.12, 0.05] },
      ik: { ...plant(y), handL: [0.34 + w, 1.98 - 0.04 * b, 0.16], handR: [-0.3 + w, 2.02 - 0.04 * b, 0.2] },
      hand: { handL: [[0.25, 1, 0.1], [0, 0, 1]], handR: [[-0.25, 1, 0.1], [0, 0, 1]] },
      grip: { handL: 'flat', handR: 'flat' },
      pole: { handL: [0.6, 0.1, 0.1], handR: [-0.6, 0.1, 0.1], ...KNEES },
    };
  },
  // one hand pointing up, the other fist pumping at the chest (IV-6 ring)
  point: (u, t) => {
    const b = bounce(t), y = -0.04 - 0.05 * b;
    return {
      y, face: 'delighted',
      fk: { spine: [0.02, 0, 0.06], chest: [-0.05, -0.12, 0], head: [-0.15, -0.1, 0] },
      ik: { ...plant(y), handR: [-0.24, 2.0, 0.3], handL: [0.16, 1.24 + 0.06 * b, 0.32] },
      hand: { handR: [[-0.1, 1, 0.25], [0, 0, 1]], handL: [[-0.2, 0.3, 1], [-1, 0, 0]] },
      grip: { handR: 'fist', handL: 'fist' },
      pole: { handR: [-0.6, 0, 0.1], handL: [0.6, -0.5, -0.2], ...KNEES },
    };
  },
  // loose sway, arms out low, eyes shut (IV-4 / IV-5 alt)
  sway: (u, t) => {
    const b = bounce(t), y = -0.04 - 0.04 * b, s = S(t * Math.PI / (BEAT * 2));
    return {
      y, face: 'absorbed',
      fk: { hips: [0, s * 0.1, s * 0.06], spine: [0.04, 0, -s * 0.1], chest: [0, s * 0.08, -s * 0.05], head: [-0.05, 0, s * 0.15] },
      ik: { ...plant(y, 0.16), handL: [0.48, 1.18 + s * 0.08, 0.22], handR: [-0.48, 1.18 - s * 0.08, 0.22] },
      hand: { handL: [[1, 0.2, 0.3], [0, -1, 0]], handR: [[-1, 0.2, 0.3], [0, -1, 0]] },
      grip: { handL: 'relax', handR: 'relax' },
      pole: { handL: [0.4, -0.6, -0.3], handR: [-0.4, -0.6, -0.3], ...KNEES },
    };
  },
  // first, hesitant groove: fists low at the chest, head nodding, small knee (IV-3)
  bob: (u, t) => {
    const b = bounce(t), y = -0.02 - 0.03 * b;
    return {
      y, face: 'absorbed',
      fk: { spine: [0.1, 0, 0], neck: [0.12 + 0.12 * b, 0, 0], head: [0.15 + 0.1 * b, 0.08, 0] },
      ik: { ...plant(y, 0.11), handL: [0.15, 1.2, 0.3], handR: [-0.15, 1.18, 0.3] },
      hand: { handL: [[-0.2, 0.3, 1], [-1, 0, 0]], handR: [[0.2, 0.3, 1], [1, 0, 0]] },
      grip: { handL: 'fist', handR: 'fist' },
      pole: { handL: [0.5, -0.6, -0.2], handR: [-0.5, -0.6, -0.2], ...KNEES },
    };
  },
  // left out at the rave: right hand holding his left arm, shoulders in, head down (III-4)
  shy: (u, t) => ({
    face: 'embarrassed',
    fk: { spine: [0.1, 0, 0], chest: [0.06, 0, 0], neck: [0.15, 0, 0], head: [0.22, -0.25, 0.05] },
    ik: { ...plant(0, 0.1), handL: [0.12, 0.86, 0.12], handR: { at: ['upperarmL', 'forearmL', 0.65], add: [0.0, 0, 0.07] } },
    hand: { handL: [[-0.3, -1, 0.2], [-0.6, 0, 0.6]], handR: [[0.3, -0.2, -0.3], [0.2, 0, -1]] },
    grip: { handL: 'relax', handR: 'cup' },
    pole: { handL: [0.4, -0.6, -0.3], handR: [-0.3, -0.7, 0.1] },
  }),
  // the break: alone in the pool, arms hanging, head right down (III-6, IV-2)
  slump: (u, t) => ({
    face: 'lonely', y: -0.02,
    fk: { spine: [0.2, 0, 0], chest: [0.12, 0, 0], neck: [0.25, 0, 0], head: [0.32, 0.05, 0] },
    ik: { ...plant(-0.02, 0.11), handL: [0.19, 0.76, 0.1], handR: [-0.19, 0.76, 0.1] },
    hand: { handL: [[0, -1, 0.15], [-1, 0, 0]], handR: [[0, -1, 0.15], [1, 0, 0]] },
    grip: { handL: 'relax', handR: 'relax' },
    pole: { handL: [0.3, -0.4, -0.6], handR: [-0.3, -0.4, -0.6] },
  }),
  // at the basin (I-3): an overhand fist in front of his right cheek, palm down, knuckles forward-left; the brush
  // leaves the thumb side of the fist and runs back into the corner of his mouth (no wrist bent back at him).
  // The page draws the brush along the fist's thumb axis (stage prop 'toothbrush'). Scrub on the beat.
  brush: (u, t) => {
    const sc = S(t * Math.PI * 2 * 2.3), sc2 = S(t * Math.PI * 2 * 1.15 + 1), p = 0.18;
    const mouth = [-0.03 + sc * 0.01, 0.06 * Math.cos(p) - 0.17 * S(p) + sc2 * 0.005, 0.06 * S(p) + 0.17 * Math.cos(p) - 0.01];
    const A = nrm([0.6, 0.1, -0.8]), N = [0, -1, 0], F = nrm([0.8, 0, 0.6]);
    const at = mouth.map((v, i) => v - A[i] * 0.115 - N[i] * 0.044);
    return {
      face: 'drowsy',
      fk: { spine: [0.06, 0, 0], neck: [0.08, 0, 0], head: [0.1, 0.05 + sc2 * 0.03, 0] },
      ik: { handL: [0.2, 0.84, 0.12], handR: { at: 'head', add: at } },
      hand: { handL: [[0, -1, 0.15], [-1, 0, 0]], handR: [F, N] },
      grip: { handL: 'relax', handR: 'hold' },
      pole: { handL: [0.3, -0.4, -0.6], handR: [-0.6, -0.7, 0.1] },
    };
  },
  // after: flat on the rug, arms out wide, palms up, breathing (V-1). Lying: z is height above the floor plane.
  lie: (u, t) => ({
    y: 0.12, lie: true, face: 'relieved',
    fk: { chest: [S(t * 1.1) * 0.02, 0, 0], neck: [0.05, 0, 0], head: [0.05, 0.25, 0], footL: [-0.6, 0.3, 0], footR: [-0.6, -0.3, 0], thighL: [0, 0, 0.1], thighR: [0, 0, -0.1] },
    ik: { handL: [0.72, 1.42, -0.07], handR: [-0.72, 1.38, -0.07] },
    hand: { handL: [[1, 0.35, 0], [0, 0, 1]], handR: [[-1, 0.35, 0], [0, 0, 1]] },
    grip: { handL: 'relax', handR: 'relax' },
    pole: { handL: [0.3, 0, -0.6], handR: [-0.3, 0, -0.6] },
  }),
};

// a shot's { mv, t } -> a plain spec the page can take
export function mvSpec(name, t) { const f = MV[name]; if (!f) throw new Error('no mv pose ' + name); return f(t, t); }
