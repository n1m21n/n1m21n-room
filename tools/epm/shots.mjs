// Ek Pinjare Mai in the room: one still per scene. 153 BPM, bar 1.5686 s, first downbeat 0.08 s, 103 bars (161.57 s).
// The man sits on the red stool at (0.3, 0, 0), facing +z. Seated: head y 1.48, neck 1.44, chest 1.30, hands 0.94, shin 0.52.
// Snake points are tagged (see stage.mjs); the head is the first point.
const PI = Math.PI;
const flash = (rel, k = 1.6, col = '#E8F0FF', cone = 0.16, to = 'head') => ({ type: 'flash', to, rel, col, k, cone });
const spot = (to, rel, col, k = 1, cone = 0.3) => ({ type: 'spot', to, rel, col, k, cone });
const area = (to, rel, col, k = 0.8, cone = 0.7) => ({ type: 'area', to, rel, col, k, cone });
const flick = (to, rel, col = '#FFD27A', k = 0.7) => ({ type: 'flicker', to, rel, col, k });
const rim = (rel, col, k = 1.2, to = 'chest') => ({ type: 'rim', to, rel, col, k, cone: 0.3 });
const L = (dark, lights, amb) => ({ dark, lights, amb });
const WIN = [-0.45, 1.9, -2.95], EYEP = [0.75, 2.25, -3.0], SPIRAL = [1.85, 2.3, -2.9], RUG = [0.3, 0, 1.2];
const MOON = spot(WIN, [0.4, 0.4, 2.2], '#7F9BFF', 0.9, 0.3);
const LAMP = flick('@lamp', [0, 0.3, 0.3], '#FFD27A', 0.8);
const POOL = (k = 0.9, col = '#FFB37A') => area([0.3, 0.6, 0], [0, 3.0, 0.4], col, k, 0.5);          // lamp pool on the stool
const w = (x, y, z) => ['w', x, y, z];
// spiral round his neck: head end up, turns, phase
const NECK = (turns, ph = 0, r = 0.1) => ['sp', w(0.3, 1.53, 0.03), w(0.3, 1.36, 0.03), r, turns, ph];
const BACKDOWN = [w(0.36, 1.2, -0.17), w(0.34, 0.9, -0.22), w(0.32, 0.5, -0.28), w(0.2, 0.07, -0.5), w(-0.2, 0.06, -0.9), w(-0.7, 0.06, -1.1)];
const OWAY = (X) => (...a) => a;
const DREAM = (k) => { const X = -60 - 30 * k; return { pos: [0, 3.2, 7], look: [0, 3.6, -8], fov: 55, world: { k, hot: k === 3 || k === 4 }, nohim: true,
  light: L(0.2, []), snake: { pts: [w(X + 3, 3.6, -1), w(X + 2, 3.2, -2.4), w(X + 0.5, 3.8, -3.2), w(X - 1.2, 3.0, -2.6), w(X - 2.6, 3.6, -1.5), w(X - 3.6, 3.0, 0), w(X - 3.2, 3.5, 1.6), w(X - 1.5, 3.2, 2.2)], r: 0.12, look: w(X + 0, 3.4, -6) } }; };

export const SHOTS = {
  // ---------------- ACT I  the room in the dark (b1-24)
  'I-1': { keepDark: true, nohim: true, pos: [0.6, 0.5, 1.7], look: [-0.9, 0.45, -1.8], fov: 50, face: 'calm', eyes: { at: [-0.9, 0.45, -1.8], gap: 0.24 }, light: L(0.99, [spot(WIN, [0.4, 0.4, 2.2], '#7F9BFF', 0.35, 0.3)]) },
  'I-2': { pos: [3.6, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62, face: 'calm', snake: { pts: [['coil', -1.5, 0.9, 0.3, 1.6, 0.34, 1.0, 0.45]], tongue: true, look: w(0.3, 1.2, 0) }, light: L(0.88, [MOON, POOL(0.55)]) },
  'I-3': { pos: [-0.2, 1.95, -0.9], look: [-0.45, 1.75, -2.95], fov: 40, face: 'calm', snake: { pts: [w(-0.15, 1.8, -2.85), w(-0.35, 1.74, -2.9), w(-0.6, 1.72, -2.92), w(-0.85, 1.74, -2.88), w(-1.1, 1.72, -2.9), w(-1.4, 1.74, -2.9)], tongue: true, look: w(0.2, 1.7, -0.5) }, light: L(0.88, [spot(WIN, [0, 0.2, 2.2], '#9CB8FF', 1.1, 0.3), rim([0.5, 0.3, 1.0], '#7F9BFF', 0.5, '@lamp')]) },
  'I-4': { pos: [0.1, 1.9, -1.3], look: [0.75, 2.2, -3.0], fov: 42, face: 'calm', snake: { pts: [w(0.45, 1.55, -2.7), w(0.62, 1.4, -2.75), w(0.8, 1.25, -2.8), w(1.0, 1.15, -2.9)], tongue: true, look: w(0.3, 2.0, -2.0) }, light: L(0.9, [spot(EYEP, [0, -0.2, 2.0], '#FF3EA5', 1.2, 0.22), spot(WIN, [0.4, 0.4, 2.2], '#7F9BFF', 0.5, 0.3)]) },
  'I-5': { bone: 'head', off: [0.55, 0.05, 1.5], fov: 34, face: 'anxious', pose: { fk: { head: [0.05, 0.5, 0.05] } }, light: L(0.9, [flash([-0.8, 0.5, 1.0], 1.0, '#FFD6B0', 0.2), rim([0.6, 0.3, -1.0], '#8A5BFF', 0.8)]) },
  'I-6': { bone: 'head', off: [0.0, 0.03, 0.75], fov: 20, face: 'alarm', light: L(0.92, [flash([0.2, 0.4, 0.9], 1.1, '#FFE8D0', 0.14)]) },
  'I-7': { pos: [1.3, 0.3, -0.2], look: [-0.5, 0.2, -1.3], fov: 56, face: 'anxious', snake: { pts: [w(0.15, 0.1, -0.9), w(-0.2, 0.06, -1.2), w(-0.6, 0.06, -1.1), w(-1.0, 0.06, -1.5), w(-1.4, 0.06, -1.3), w(-1.8, 0.06, -1.7), w(-2.2, 0.06, -1.5)], tongue: true }, light: L(0.88, [MOON, POOL(0.5), spot([-0.4, 0, -1.2], [0.2, 2.5, 0.4], '#7F9BFF', 0.5, 0.4)]) },
  'I-8': { pos: [-3.2, 3.0, 2.8], look: [0.8, 0.6, -0.6], fov: 62, face: 'anxious', pose: { fk: { head: [0, -0.5, 0] } }, snake: { pts: [w(1.5, 0.1, 0.3), w(1.1, 0.06, -0.3), w(1.3, 0.06, -0.9), w(0.9, 0.06, -1.3), w(0.3, 0.06, -1.2), w(-0.2, 0.06, -1.6), w(-0.9, 0.06, -1.3), w(-1.4, 0.06, -1.9), w(-1.9, 0.06, -1.5)], tongue: true }, light: L(0.86, [MOON, POOL(0.7), LAMP]) },
  'I-9': { pos: [-0.35, 0.26, 1.55], look: [-0.4, 0.22, 0.9], fov: 26, nohim: true, snake: { pts: [w(-0.4, 0.2, 0.85), w(-0.55, 0.12, 0.5), w(-0.8, 0.06, 0.2), w(-1.2, 0.06, 0.0)], tongue: true, look: w(-0.35, 0.26, 1.55) }, light: L(0.9, [spot([-0.4, 0.2, 0.9], [0.3, 1.2, 1.4], '#FFB37A', 1.4, 0.2)]) },
  'I-10': { bone: 'head', off: [0.0, 0.03, 0.75], fov: 20, face: 'uneasy', pose: { fk: { head: [0.0, -0.55, 0] } }, light: L(0.92, [flash([0.5, 0.4, 0.9], 1.1, '#FFE8D0', 0.14)]) },
  'I-11': { aim: 'play guitar', offw: [-1.6, -0.5, 1.4], fov: 56, face: 'anxious', snake: { pts: [w(2.1, 0.12, 0.35), w(1.7, 0.06, 0.7), w(1.4, 0.06, 0.4), w(1.1, 0.06, 0.9), w(0.7, 0.06, 0.7), w(0.4, 0.06, 1.2)], tongue: true }, light: L(0.88, [spot('@play guitar', [-0.5, 2.0, 1.0], '#FF9A5A', 1.0, 0.3), POOL(0.5)]) },
  'I-12': { aim: 'play guitar', offw: [-1.0, -0.4, 0.9], fov: 50, nohim: true, snake: { pts: [w(2.45, 0.1, 0.9), w(2.2, 0.06, 1.15), w(1.9, 0.06, 1.0), w(1.6, 0.06, 1.4)], tongue: true }, light: L(0.88, [spot('@play guitar', [-0.5, 2.0, 1.0], '#FF9A5A', 1.4, 0.3), MOON]) },
  'I-13': { pos: [0.0, 1.65, -0.85], look: [0.9, 0.3, 2.2], fov: 56, face: 'anxious', snake: { pts: [w(1.4, 0.15, 1.4), w(1.1, 0.06, 1.0), w(1.5, 0.06, 0.6), w(1.9, 0.06, 0.9), w(1.7, 0.06, 1.4)], tongue: true }, light: L(0.86, [MOON, POOL(0.6), area([1.3, 0, 1.2], [0, 3, 0], '#8A5BFF', 0.6, 0.5)]) },
  'I-14': { pos: [0.1, 1.9, -1.3], look: [0.75, 2.2, -3.0], fov: 42, snake: { pts: [w(0.9, 1.3, -2.7), w(1.1, 1.1, -2.8), w(1.3, 0.95, -2.9)], tongue: true, look: w(0.3, 2.0, -2.0) }, light: L(0.9, [spot(EYEP, [0, -0.2, 2.0], '#FF3EA5', 1.6, 0.22)]), face: 'uneasy' },
  'I-15': { pos: [2.0, 1.5, 2.6], look: [0.3, 0.5, 0.0], fov: 56, face: 'anxious', pose: { fk: { head: [0.1, 0.8, 0] } }, snake: { pts: [['coil', 0.3, 0.0, 0.62, 1.25, 0.12, 0.2, 1.0]], tongue: true }, light: L(0.84, [POOL(0.8), MOON, flash([1.2, 0.6, 1.0], 0.8, '#FFD6B0', 0.2)]) },
  'I-16': { pos: [0.85, 0.5, 2.1], look: [0.6, 0.55, 0.4], fov: 40, face: 'alarm', snake: { pts: [w(0.62, 0.8, 0.45), w(0.7, 0.6, 0.38), w(0.8, 0.3, 0.3), w(0.9, 0.08, 0.15), w(1.2, 0.06, -0.1), w(1.6, 0.06, 0.1), w(1.9, 0.06, -0.2)], gape: true, tongue: true, look: w(0.85, 0.5, 2.1), r: 0.055 }, light: L(0.92, [spot([0.62, 0.8, 0.45], [0.1, 0.3, 1.6], '#FFE8D0', 1.4, 0.18), flash([0.4, 0.5, 1.0], 0.9, '#FFD6B0', 0.15)]) },
  // ---------------- ACT II  the bite, the climb (b25-40)
  'II-1': { pos: [1.2, 1.2, 1.7], look: [0.1, 0.95, 0.1], fov: 46, face: 'alarm', pose: { fk: { head: [0.35, -0.5, 0] } }, snake: { pts: [['b', 'handR', -0.02, 0.07, 0.04], w(-0.05, 0.75, 0.2), w(-0.2, 0.4, 0.3), w(-0.4, 0.07, 0.5), w(-0.9, 0.06, 0.9), w(-1.3, 0.06, 0.5)], gape: false, tongue: false, look: w(0.0, 1.0, 0) }, light: L(0.88, [flash([0.8, 0.8, 1.0], 1.3, '#FFE0C0', 0.18), POOL(0.5)]) },
  'II-2a': { bone: 'head', off: [0.3, 0.0, 0.7], fov: 24, face: 'frustrated', pose: { fk: { head: [0.2, -0.2, 0.1] } }, light: L(0.9, [flash([0.4, 0.5, 0.9], 1.3, '#FFD6B0', 0.15), rim([-0.6, 0.3, -0.5], '#FF3EA5', 0.8)]) },
  'II-2b': { pos: [1.3, 1.5, 1.6], look: [-0.05, 1.15, 0.1], fov: 46, face: 'frustrated', pose: { ik: { handR: [-0.3, 1.32, 0.3] }, fk: { head: [0.1, -0.5, 0] }, hand: { handR: [[0, 0.3, 1], [0, -1, 0]] }, pole: { handR: [-0.3, 0.2, -0.3] } }, snake: { pts: [['b', 'handR', -0.02, 0.07, 0.04], w(-0.28, 1.0, 0.3), w(-0.32, 0.6, 0.32), w(-0.34, 0.3, 0.36), w(-0.5, 0.07, 0.5), w(-0.9, 0.06, 0.6)], look: w(0.1, 1.2, 0.2) }, light: L(0.88, [flash([0.6, 0.8, 1.0], 1.2, '#FFE0C0', 0.2), POOL(0.5)]) },
  'II-3': { pos: [1.4, 0.7, 1.8], look: [0.1, 0.3, 0.3], fov: 50, face: 'given_up', snake: { pts: [w(-0.15, 0.06, 0.5), w(-0.3, 0.2, 0.42), w(-0.25, 0.5, 0.35), w(-0.15, 0.8, 0.3), w(-0.05, 1.0, 0.25)], tongue: true, look: w(0.2, 0.2, 1.5) }, light: L(0.88, [POOL(0.7), spot([-0.3, 0.2, 0.5], [0.2, 2, 0.5], '#8A5BFF', 0.8, 0.3)]) },
  'II-4a': { bone: 'head', off: [0.0, 0.0, 0.7], fov: 20, face: 'anxious', pose: { fk: { head: [0.35, 0.25, 0] } }, light: L(0.9, [flash([0.3, 0.2, 0.8], 1.1, '#FFE8D0', 0.14)]) },
  'II-4b': { pos: [1.0, 0.25, 1.8], look: [0.35, 0.15, 0.2], fov: 50, face: 'anxious', pose: { fk: { head: [0.35, 0.0, 0] } }, snake: { pts: [w(0.5, 0.09, 0.15), w(0.7, 0.06, 0.4), w(0.9, 0.06, 0.2), w(1.2, 0.06, 0.6), w(1.5, 0.06, 0.4), w(1.7, 0.06, 0.9)], tongue: true, look: w(0.4, 0.1, 0) }, light: L(0.88, [POOL(0.8), spot([0.5, 0.1, 0.2], [0.3, 2, 0.8], '#8A5BFF', 0.8, 0.3)]) },
  'II-5': { pos: [1.3, 0.8, 1.7], look: [0.4, 0.5, 0.0], fov: 48, face: 'curious', pose: { fk: { head: [0.35, 0.1, 0] } }, snake: { pts: [['sp', w(0.45, 0.62, 0.0), w(0.45, 0.14, 0.0), 0.085, 2.2, 0.4], w(0.9, 0.06, 0.2), w(1.3, 0.06, 0.5)], tongue: true, look: w(0.7, 0.9, 1.5) }, light: L(0.86, [POOL(0.8), flash([0.6, 0.5, 0.8], 0.8, '#FFE0C0', 0.2)]) },
  'II-6': { pos: [1.1, 1.3, 1.7], look: [0.35, 0.8, 0.2], fov: 46, face: 'curious', pose: { fk: { head: [0.3, 0.1, 0] } }, snake: { pts: [w(0.42, 0.97, 0.38), w(0.45, 0.85, 0.5), ['sp', w(0.46, 0.7, 0.2), w(0.46, 0.2, 0.05), 0.09, 1.6, 0.6], w(0.9, 0.06, 0.3)], tongue: true, look: w(0.6, 1.3, 1.8) }, light: L(0.86, [POOL(0.9), flash([0.5, 0.6, 0.9], 0.8, '#FFE0C0', 0.2)]) },
  'II-7': { pos: [0.3, 1.55, -1.7], look: [0.3, 1.1, 0.0], fov: 46, face: 'curious', snake: { pts: [w(0.33, 1.4, -0.12), ...BACKDOWN], tongue: true, look: w(0.9, 1.9, -1.5) }, light: L(0.88, [rim([0.4, 0.5, -1.0], '#FF3EA5', 1.4), POOL(0.6), MOON]) },
  'II-8': { pos: [1.3, 1.5, 1.8], look: [0.3, 1.2, 0.1], fov: 44, face: 'delighted', snake: { pts: [w(0.5, 1.28, 0.28), w(0.52, 1.38, 0.1), w(0.45, 1.46, -0.08), w(0.38, 1.4, -0.2), w(0.34, 1.0, -0.22), w(0.3, 0.5, -0.28), w(0.2, 0.07, -0.5)], tongue: true, look: w(1.3, 1.4, 2.0) }, light: L(0.84, [POOL(1.0, '#FFC98A'), flash([0.6, 0.5, 0.9], 0.9, '#FFE0C0', 0.2)]) },
  // ---------------- ACT III  the choke (b41-56)
  'III-1': { pos: [0.3, 1.4, 2.4], look: [0.3, 1.3, 0.1], fov: 36, face: 'anxious', pose: { ik: { handL: [0.5, 1.15, 0.2], handR: [-0.5, 1.15, 0.2] } }, snake: { pts: [w(0.45, 1.5, 0.22), NECK(1.0, 1.2), w(0.34, 1.2, -0.18), ...BACKDOWN.slice(2)], tongue: true, look: w(0.3, 1.4, 2.4) }, light: L(0.86, [flash([0.4, 0.4, 1.0], 1.2, '#FF3EA5', 0.2), POOL(0.6)]) },
  'III-2': { pos: [1.1, 0.7, 1.5], look: [0.3, 1.3, 0.1], fov: 46, roll: 0.22, face: 'alarm', pose: { ik: { handL: [0.17, 1.3, 0.14], handR: [-0.17, 1.3, 0.14] }, hand: { handL: [[-0.3, 0.2, 1], [-1, 0.3, 0]], handR: [[0.3, 0.2, 1], [1, 0.3, 0]] }, grip: { handL: 'fist', handR: 'fist' } }, snake: { pts: [w(0.5, 1.5, 0.15), NECK(2.0, 0.6), w(0.34, 1.2, -0.18), ...BACKDOWN.slice(2)], tongue: false, look: w(1.1, 0.7, 1.5) }, light: L(0.9, [flash([0.4, 0.4, 1.0], 1.5, '#FF3EA5', 0.2), rim([-0.6, 0.3, -0.5], '#FF8AD0', 1.0)]) },
  'III-3': { bone: 'head', off: [0.35, 0.0, 0.75], fov: 38, face: 'alarm', pose: { ik: { handL: [0.17, 1.3, 0.14], handR: [-0.17, 1.3, 0.14] }, grip: { handL: 'fist', handR: 'fist' } }, snake: { pts: [w(0.43, 1.52, 0.06), NECK(2.0, 2.0), w(0.34, 1.2, -0.18), ...BACKDOWN.slice(2)], look: w(1.0, 1.7, 1.4) }, light: L(0.92, [flash([0.4, 0.4, 0.9], 1.6, '#FF3EA5', 0.18), rim([-0.6, 0.3, -0.5], '#FF8AD0', 1.0)]) },
  'III-4': { bone: 'head', off: [0.0, 0.0, 0.8], fov: 22, face: 'dazed', pose: { fk: { head: [0.1, 0.0, 0.15] } }, snake: { pts: [w(0.3, 1.45, 0.23), w(0.18, 1.5, 0.12), NECK(2.0, 1.2), w(0.34, 1.2, -0.18), ...BACKDOWN.slice(2)], look: w(0.3, 1.4, 1.5) }, light: L(0.93, [flash([0.0, 0.3, 0.9], 1.8, '#FF2E9F', 0.16)]) },
  // ---------------- ACT IV  into the mouth (b57-74)
  'IV-1': { bone: 'head', off: [0.0, -0.02, 1.1], fov: 22, face: 'dazed', snake: { pts: [w(0.3, 1.42, 0.3), w(0.45, 1.5, 0.12), NECK(1.2, 2.0), w(0.34, 1.2, -0.18)], gape: true, look: w(0.3, 1.43, 1.2) }, light: L(0.93, [flash([0.0, 0.3, 0.8], 1.6, '#F6E7C1', 0.15)]) },
  'IV-2': DREAM(0), 'IV-3': DREAM(1), 'IV-4': DREAM(2), 'IV-5': DREAM(3), 'IV-6': DREAM(4), 'IV-7': DREAM(5),
  'IV-8': { pos: [2.4, 1.6, 2.8], look: [0.3, 0.5, 0.0], fov: 56, face: 'dazed', snake: { pts: [['coil', 0.62, 0.35, 0.3, 1.9, 0.18, 1.0, 0.45]], look: w(0.3, 1.2, 0), tongue: true }, light: L(0.86, [POOL(0.8, '#F6E7C1'), MOON]) },
  // ---------------- ACT V  out (b75-82)
  'V-1': { ...DREAM(3), snake: undefined, pos: [0, 5.5, 24], look: [0, 4, -8], fov: 50 },
  'V-2': { bone: 'head', off: [0.0, 0.02, 0.5], fov: 18, face: 'dazed', light: L(0.93, [flash([0.0, 0.3, 0.8], 1.6, '#F6E7C1', 0.15)]) },
  // ---------------- ACT VI  the reveal (b83-98)
  'VI-1': { pos: [1.2, 0.35, 1.3], look: [0.7, 0.55, 0.5], fov: 50, face: 'dazed', snake: { pts: [w(0.75, 0.95, 0.55), w(0.82, 0.78, 0.5), w(0.9, 0.55, 0.5), ['coil', 0.8, 0.5, 0.26, 1.5, 0.0, 3.0, 0.6]], tongue: true, look: w(1.2, 0.8, 1.6) }, light: L(0.88, [POOL(0.8, '#F6E7C1'), spot([0.8, 0.5, 0.5], [0.3, 2, 0.5], '#FF3EA5', 0.8, 0.3)]) },
  'VI-2': { pos: [0.5, 1.45, 2.1], look: [0.4, 1.45, 0.1], fov: 32, face: 'given_up', snake: { pts: [w(0.52, 1.5, 0.18), w(0.5, 1.4, 0.0), w(0.46, 1.38, -0.1), w(0.36, 1.3, -0.2), w(0.3, 0.8, -0.25), w(0.2, 0.07, -0.4)], tongue: true, look: w(0.5, 1.5, 2.1) }, light: L(0.92, [flash([0.4, 0.3, 1.0], 1.3, '#FFE9B0', 0.16), rim([-0.6, 0.3, -0.5], '#FF3EA5', 1.0)]) },
  'VI-3': { bone: 'head', off: [0.0, 0.03, 0.55], fov: 20, face: 'dazed', droste: true, drosteCam: { pos: [3.6, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62 }, light: L(0.8, [MOON, POOL(0.8), flash([0, 0.3, 0.8], 0.8, '#F6E7C1', 0.15)]) },
  // ---------------- ACT VII  the loop (b99-103)
  'VII-1': { pos: [2.3, 2.6, 2.4], look: [0.3, 0.4, 0.0], fov: 52, face: 'calm', snake: { pts: [['coil', 0.3, 0.0, 0.66, 1.08, 0.06, 0.4, 1.0]], tongue: false }, light: L(0.9, [POOL(0.4), MOON]) },
};
SHOTS['VII-2'] = { ...SHOTS['I-1'] };
