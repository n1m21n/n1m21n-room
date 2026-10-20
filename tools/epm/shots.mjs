// Ek Pinjare Mai in the room, round 2: one still per scene. 153 BPM, bar 1.5686 s, first downbeat 0.08 s, 103 bars.
// Story r2: the room is a cell (pinjara). Bars on the door and the window, he wants out and cannot go; the room's own
// snake stays on the floor and herds him back to the red stool, ties his ankles to it, follows him through the room's
// portal into the dream worlds and out again into the same room, and only at the peak climbs him and chokes him.
// The man sits on the red stool at (0.3, 0, 0), facing +z; stand: { x, z, h } puts him on his feet (h 0 faces +z).
// Snake points are tagged (see stage.mjs), head first; y = the underside (0 = on the floor) unless center: true.
// contact.js keeps the snake out of him, the stool, the named solids and itself (qc in mm on every shot).
const PI = Math.PI;
const flash = (rel, k = 1.6, col = '#E8F0FF', cone = 0.16, to = 'head') => ({ type: 'flash', to, rel, col, k, cone });
const spot = (to, rel, col, k = 1, cone = 0.3) => ({ type: 'spot', to, rel, col, k, cone });
const area = (to, rel, col, k = 0.8, cone = 0.7) => ({ type: 'area', to, rel, col, k, cone });
const flick = (to, rel, col = '#FFD27A', k = 0.7) => ({ type: 'flicker', to, rel, col, k });
const rim = (rel, col, k = 1.2, to = 'chest') => ({ type: 'rim', to, rel, col, k, cone: 0.3 });
const L = (dark, lights, amb) => ({ dark, lights, amb });
const WIN = [-0.45, 1.9, -2.95], EYEP = [0.75, 2.25, -3.0], DOORC = [3.95, 1.2, 1.6];
const MOON = spot(WIN, [0.4, 0.4, 2.2], '#7F9BFF', 0.9, 0.3);
const LAMP = flick('@lamp', [0, 0.3, 0.3], '#FFD27A', 0.8);
const POOL = (k = 0.9, col = '#FFB37A') => area([0.3, 0.6, 0], [0, 3.0, 0.4], col, k, 0.5);          // lamp pool on the stool
const DOORSPOT = (k = 1.0) => spot(DOORC, [-2.0, 0.6, 0.0], '#FFD6B0', k, 0.3);
const w = (x, y, z) => ['w', x, y, z];
const FLOOR = { wave: 0.8 };                                       // floor slither
const HB = { handL: [[0, 1, 0.1], [0, 0, 1]], handR: [[0, 1, 0.1], [0, 0, 1]] };   // palms flat on bars ahead
const STRIDE = (y = -0.06) => ({ y, ik: { footL: [0.1, 0.115, 0.36], footR: [-0.1, 0.2, -0.32] } });
const BACK = (y0, y1) => ['ride', w(0.3, y0, -0.05), w(0.3, y1, -0.05), [0, 0, -1]];
const FLOORBACK = [w(0.4, 0.35, -0.42), w(0.5, 0, -0.75), w(0.2, 0, -1.2), w(-0.3, 0, -1.3)];
const MAG = (k = 1.4) => L(0.92, [flash([0.4, 0.3, 1.0], k, '#FF3EA5', 0.2), rim([-0.6, 0.3, -0.5], '#FF8AD0', 1.0), POOL(0.4)]);
const RING = (r = 0.5, rise = 0.3, ph = 0.6) => ['coil', 0.3, 0.0, r, 1.15, rise, ph, 0.92];        // round the stool on the floor
const TIE = [['wrap', ['b', 'footL', -0.11, 0.1, 0.02], ['b', 'footL', -0.11, -0.02, 0.02], 1.25, 0.5], w(0.55, 0.2, 0.0), w(0.7, 0, -0.25), w(1.1, 0, -0.45), w(1.5, 0, -0.3)];
// dream worlds: pocket sets at x = -60 - 30k; he comes out of the room's portal and the snake follows out of the same one
const DW = (k, o = {}) => { const X = -60 - 30 * k, gz = o.gz ?? 0;
  return { world: { k, hot: k === 3 || k === 4 }, gates: [[X, gz, 0]], stand: { x: X + (o.hx ?? 0.25), z: gz + (o.hz ?? 1.6), h: o.h ?? 0.2 }, face: o.face || 'alarm',
    pose: { ...STRIDE(), fk: { head: [0, o.look ?? -0.9, 0] } }, pos: [o.cx ?? 2.4, 1.5, gz + 5.2], look: [o.lx ?? -0.3, 1.5, gz - 0.6], fov: 60,
    snake: { pts: [w(X + 0.15, 0, gz + 0.75), w(X + 0.0, 0, gz + 0.1), w(X - 0.1, 0, gz - 0.5), w(X - 0.3, 0, gz - 1.2)], rear: 0.6, look: w(X + 0.3, 1.4, gz + 1.6), tongue: true, ...FLOOR },
    light: L(0.2, [flash([0.8, 0.5, 1.0], 1.0, '#FFE0C0', 0.2)]) }; };

export const SHOTS = {
  // ---- I The cell (1-24)
  'I-1': { keepDark: true, nohim: true, pos: [0.6, 0.5, 1.7], look: [-0.9, 0.45, -1.8], fov: 50, face: 'calm', eyes: { at: [-0.9, 0.45, -1.8], gap: 0.24 }, light: L(0.99, [spot(WIN, [0.4, 0.4, 2.2], '#7F9BFF', 0.35, 0.3)]) },
  'I-2': { bars: 'all', pos: [3.0, 3.1, 2.6], look: [-0.6, 0.5, -0.6], fov: 62, face: 'uneasy', snake: { pts: [['coil', -1.6, 0.8, 0.32, 1.6, 0.25, 1.0, 0.45]], tongue: true, look: w(0.3, 1.2, 0) }, light: L(0.88, [MOON, POOL(0.55)]) },
  'I-3': { bars: true, nohim: true, pos: [2.0, 1.35, 1.75], look: [4.0, 1.2, 1.6], fov: 50, light: L(0.88, [DOORSPOT(1.2), MOON]) },
  'I-4': { bars: 'all', nohim: true, pos: [-0.1, 1.85, -1.1], look: [-0.45, 1.85, -2.95], fov: 44, light: L(0.88, [spot(WIN, [0, 0.2, 2.2], '#9CB8FF', 1.2, 0.3)]) },
  'I-5': { bone: 'head', off: [0.55, 0.05, 1.5], fov: 34, face: 'anxious', pose: { fk: { head: [0.05, 0.75, 0] } }, light: L(0.9, [flash([-0.8, 0.5, 1.0], 1.0, '#FFD6B0', 0.2), rim([0.6, 0.3, -1.0], '#8A5BFF', 0.8)]) },
  'I-6': { bone: 'head', off: [0.0, 0.03, 0.75], fov: 20, face: 'alarm', light: L(0.92, [flash([0.2, 0.4, 0.9], 1.1, '#FFE8D0', 0.14)]) },
  'I-7': { pos: [1.3, 0.3, -0.2], look: [-0.5, 0.15, -1.3], fov: 56, face: 'anxious', snake: { pts: [w(0.15, 0, -0.9), w(-0.2, 0, -1.2), w(-0.6, 0, -1.1), w(-1.0, 0, -1.5), w(-1.4, 0, -1.3), w(-1.8, 0, -1.7)], tongue: true, ...FLOOR }, light: L(0.88, [MOON, POOL(0.5), spot([-0.4, 0, -1.2], [0.2, 2.5, 0.4], '#7F9BFF', 0.5, 0.4)]) },
  'I-8': { bars: true, pos: [-3.2, 3.0, 2.6], look: [0.8, 0.5, -0.4], fov: 62, face: 'anxious', pose: { fk: { head: [0, -0.5, 0] } }, snake: { pts: [w(1.5, 0, 0.5), w(1.1, 0, -0.1), w(1.3, 0, -0.7), w(0.9, 0, -1.1), w(0.4, 0, -1.0), w(-0.1, 0, -1.4)], tongue: true, ...FLOOR }, light: L(0.86, [MOON, POOL(0.7), LAMP]) },
  'I-9': { pos: [-0.3, 0.3, 2.0], look: [-0.45, 0.12, 0.8], fov: 30, nohim: true, snake: { pts: [w(-0.4, 0, 0.85), w(-0.55, 0, 0.5), w(-0.8, 0, 0.2), w(-1.2, 0, 0.0)], rear: 0.35, tongue: true, look: w(-0.35, 0.18, 1.5) }, light: L(0.9, [spot([-0.4, 0.2, 0.9], [0.3, 1.2, 1.4], '#FFB37A', 1.4, 0.2)]) },
  'I-10': { bone: 'head', off: [0.0, 0.03, 0.75], fov: 20, face: 'uneasy', pose: { fk: { head: [0.0, -0.55, 0] } }, light: L(0.92, [flash([0.5, 0.4, 0.9], 1.1, '#FFE8D0', 0.14)]) },
  'I-11': { aim: 'play guitar', offw: [-1.6, -0.5, 1.4], fov: 56, face: 'anxious', snake: { pts: [w(2.1, 0, -1.3), w(1.8, 0, -1.0), w(1.5, 0, -1.3), w(1.2, 0, -1.0), w(0.9, 0, -1.25)], tongue: true, ...FLOOR }, light: L(0.88, [spot('@play guitar', [-0.5, 2.0, 1.0], '#FF9A5A', 1.0, 0.3), POOL(0.5)]) },
  'I-12': { pos: [-0.4, 1.6, -0.75], look: [1.0, 0.2, 1.2], fov: 56, face: 'anxious', snake: { pts: [w(1.0, 0, 1.1), w(1.4, 0, 0.8), w(1.8, 0, 1.1), w(2.1, 0, 0.7)], tongue: true, ...FLOOR }, light: L(0.86, [MOON, POOL(0.6), area([1.3, 0, 1.0], [0, 3, 0], '#8A5BFF', 0.6, 0.5)]) },
  'I-13': { pos: [2.0, 1.6, 2.4], look: [0.3, 0.4, 0.0], fov: 54, face: 'anxious', pose: { fk: { head: [0.15, 0.7, 0] } }, snake: { pts: [RING(0.6, 0.25)], tongue: true, look: w(0.3, 1.4, 0.1) }, light: L(0.84, [POOL(0.8), MOON, flash([1.2, 0.6, 1.0], 0.8, '#FFD6B0', 0.2)]) },
  'I-14': { pos: [0.9, 0.45, 1.9], look: [0.6, 0.45, 0.4], fov: 40, face: 'alarm', snake: { pts: [w(0.62, 0, 0.55), w(0.8, 0, 0.35), w(1.0, 0, 0.1), w(1.3, 0, -0.1), w(1.6, 0, 0.1)], rear: 1.0, tongue: true, look: w(0.9, 0.45, 1.9) }, light: L(0.92, [spot([0.62, 0.5, 0.5], [0.1, 0.3, 1.6], '#FFE8D0', 1.4, 0.18), flash([0.4, 0.5, 1.0], 0.9, '#FFD6B0', 0.15)]) },

  // ---- II He wants out (25-40)
  'II-1': { stand: { x: 0.75, z: 0.45, h: 1.1 }, face: 'alarm', pose: { fk: { spine: [-0.08, 0, 0], head: [-0.05, -1.0, 0] }, ik: { handL: [0.32, 1.05, 0.15], handR: [-0.32, 1.0, 0.15] }, grip: { handL: 'flat', handR: 'flat' } }, pos: [2.3, 1.2, 2.2], look: [0.6, 0.85, 0.2], fov: 50,
    snake: { pts: [w(0.2, 0, 0.95), w(-0.1, 0, 1.2), w(-0.5, 0, 1.0), w(-0.9, 0, 1.3), w(-1.3, 0, 1.0)], rear: 0.8, tongue: true, look: w(0.75, 1.5, 0.45) }, light: L(0.86, [flash([0.8, 0.6, 1.0], 1.3, '#FFE0C0', 0.2), POOL(0.6)]) },
  'II-2': { stand: { x: 2.3, z: 1.1, h: 1.35 }, face: 'anxious', pose: { ...STRIDE(), fk: { head: [0, -1.1, 0] } }, pos: [3.6, 1.3, 2.6], look: [1.8, 0.8, 0.8], fov: 58,
    snake: { pts: [w(1.4, 0, 0.9), w(1.0, 0, 0.6), w(0.7, 0, 0.95), w(0.3, 0, 0.7), w(-0.1, 0, 1.0)], tongue: true, look: w(2.3, 1.4, 1.1), ...FLOOR }, light: L(0.86, [MOON, LAMP, POOL(0.5), DOORSPOT(0.8)]) },
  'II-3': { bars: true, stand: { x: 3.42, z: 1.6, h: PI / 2 }, face: 'frustrated', pose: { ik: { handL: [0.16, 1.32, 0.46], handR: [-0.16, 1.22, 0.46] }, hand: HB, grip: { handL: 'hold', handR: 'hold' }, fk: { head: [0.1, 0, 0] } },
    pos: [2.35, 1.6, 2.5], look: [3.6, 1.1, 1.5], fov: 50, light: L(0.86, [DOORSPOT(1.3), flash([-1, 0.4, 0.6], 1.1, '#FFE0C0', 0.2)]) },
  'II-4': { bars: true, stand: { x: 3.42, z: 1.6, h: PI / 2 }, face: 'anxious', pose: { ik: { handL: [0.16, 1.32, 0.46], handR: [-0.16, 1.22, 0.46] }, hand: HB, grip: { handL: 'hold', handR: 'hold' }, fk: { head: [0.05, -0.75, 0] } },
    bone: 'head', off: [-0.55, 0.05, 0.3], tadd: [0, 0.1, 0], fov: 36, light: L(0.9, [DOORSPOT(1.0), flash([-0.3, 0.4, 1.0], 1.2, '#FFE8D0', 0.16)]) },
  'II-5': { bars: true, stand: { x: 3.3, z: 1.55, h: -1.9 }, face: 'alarm', pose: { fk: { spine: [-0.06, 0, 0] }, ik: { handL: [0.3, 1.05, 0.12], handR: [-0.3, 1.0, 0.12] }, grip: { handL: 'flat', handR: 'flat' } }, pos: [2.9, 2.5, 2.7], look: [2.3, 0.2, 0.9], fov: 60,
    snake: { pts: [w(2.75, 0, 1.55), w(2.4, 0, 1.85), w(2.0, 0, 1.6), w(1.7, 0, 1.9), w(1.3, 0, 1.7)], rear: 0.9, tongue: true, look: w(3.3, 1.5, 1.55) }, light: L(0.86, [DOORSPOT(0.9), spot([2.4, 0.3, 1.2], [0.4, 2.0, 0.6], '#8A5BFF', 1.0, 0.35), MOON]) },
  'II-6': { bars: 'all', stand: { x: -1.7, z: -2.45, h: PI }, face: 'frustrated', pose: { ik: { handL: [0.2, 1.55, 0.42], handR: [-0.2, 1.5, 0.42] }, hand: HB, grip: { handL: 'hold', handR: 'hold' }, fk: { head: [-0.15, 0.4, 0] } },
    pos: [-0.4, 1.7, -1.1], look: [-1.7, 1.5, -2.7], fov: 50, light: L(0.88, [spot(WIN, [0, 0.2, 2.2], '#9CB8FF', 1.2, 0.3), flash([0.8, 0.4, 1.0], 0.8, '#FFE0C0', 0.2)]) },
  'II-7': { bars: 'all', stand: { x: -1.7, z: -2.45, h: PI }, face: 'alarm', pose: { ik: { handL: [0.2, 1.55, 0.42], handR: [-0.2, 1.5, 0.42] }, hand: HB, grip: { handL: 'hold', handR: 'hold' }, fk: { neck: [0, 0.4, 0], head: [0, 0.8, 0] } },
    pos: [-2.3, 1.8, -2.7], look: [-0.9, 0.3, -0.9], fov: 58, snake: { pts: [w(-1.3, 0, -1.65), w(-1.0, 0, -1.3), w(-1.15, 0, -0.9), w(-0.8, 0, -0.55), w(-0.4, 0, -0.65)], rear: 0.7, tongue: true, look: w(-1.7, 1.5, -2.45) }, light: L(0.88, [MOON, POOL(0.5), spot([0.1, 0, -1.2], [0.3, 2.2, 0.4], '#8A5BFF', 0.8, 0.35)]) },
  'II-8': { stand: { x: 0.0, z: -1.1, h: 0.35 }, face: 'anxious', pose: { ...STRIDE(), fk: { head: [0, 0.9, 0] } }, pos: [0.4, 5.0, 0.8], look: [0.2, 0, -0.6], fov: 52,
    snake: { pts: [w(-0.5, 0, -1.65), w(-0.9, 0, -1.3), w(-1.0, 0, -0.8), w(-0.8, 0, -0.3), w(-0.4, 0, 0.0)], tongue: true, look: w(0.0, 1.0, -1.1), ...FLOOR }, light: L(0.86, [MOON, POOL(0.9), LAMP]) },

  // ---- III Tied to the stool (41-56)
  'III-1': { pos: [2.1, 1.7, 2.2], look: [0.3, 0.35, 0.0], fov: 50, face: 'alarm', pose: { fk: { head: [0.35, 0.5, 0] } }, snake: { pts: [RING(0.42, 0.2, 2.2)], tongue: true, look: w(0.3, 1.4, 0.1) }, light: L(0.86, [POOL(0.9), MOON]) },
  'III-2': { face: 'alarm', pose: { fk: { head: [0.35, 0.2, 0], spine: [0.15, 0, 0] } }, pos: [1.7, 0.85, 1.7], look: [0.3, 0.5, 0.2], fov: 46,
    snake: { pts: [w(0.75, 0.55, 0.5), w(0.62, 0.42, 0.38), ...TIE], center: true, wave: 0, look: w(0.3, 1.5, 0.15), tongue: true }, light: L(0.88, [POOL(0.9), flash([0.8, 0.5, 0.8], 1.0, '#FFE0C0', 0.2)]) },
  'III-3': { bone: 'head', off: [0.35, -0.05, 1.05], fov: 30, face: 'frustrated', pose: { fk: { spine: [0.25, 0, 0], head: [0.4, -0.2, 0.1] } }, light: L(0.9, [flash([0.4, 0.5, 0.9], 1.3, '#FFD6B0', 0.15), rim([-0.6, 0.3, -0.5], '#FF3EA5', 0.8)]) },
  'III-4': { face: 'frustrated', pose: { fk: { spine: [0.35, 0, 0], neck: [0.2, 0, 0], head: [0.3, 0, 0] } }, pos: [-1.2, 0.95, 1.4], look: [0.3, 0.5, 0.15], fov: 46,
    snake: { iters: 24, pts: [w(-0.05, 0.5, 0.45), w(0.05, 0.42, 0.35), ...TIE], center: true, wave: 0, look: w(0.3, 1.4, 0.3), tongue: true }, light: L(0.88, [POOL(0.9), spot([0.3, 0.4, 0.1], [0.2, 2, 0.6], '#8A5BFF', 0.8, 0.3)]) },
  'III-5': { face: 'frustrated', pos: [0.85, 0.8, 1.35], look: [0.6, 0.55, 0.4], fov: 40, pose: { fk: { spine: [0.2, 0, 0], head: [0.35, 0, 0] } },
    snake: { pts: [w(0.72, 0.52, 0.5), w(0.62, 0.42, 0.38), ...TIE], center: true, wave: 0, look: w(0.3, 1.5, 0.3), tongue: true }, light: L(0.9, [spot([0.7, 0.55, 0.5], [0.2, 0.6, 1.2], '#FFE8D0', 1.4, 0.2), POOL(0.4)]) },
  'III-6': { bars: true, pos: [0.3, 6.2, 0.6], look: [0.3, 0, 0], fov: 70, face: 'given_up', snake: { pts: [w(0.75, 0.3, 0.45), w(0.62, 0.3, 0.38), ...TIE], center: true, wave: 0, look: w(0.3, 1.4, 0.3) }, light: L(0.86, [POOL(1.0), MOON, DOORSPOT(0.7)]) },

  // ---- IV Through the portal (57-74)
  'IV-1': { gates: [[0.3, 1.45, 0]], face: 'curious', pose: { fk: { head: [0.2, 0, 0] } }, pos: [2.2, 1.4, 2.4], look: [0.3, 0.9, 0.7], fov: 54, snake: { pts: [w(0.85, 0, 0.45), w(1.1, 0, 0.1), w(0.9, 0, -0.35), w(0.4, 0, -0.55), w(-0.1, 0, -0.4)], tongue: true, look: w(0.3, 1.0, 1.45), ...FLOOR }, light: L(0.8, [POOL(0.5), MOON, flash([0.0, 0.3, 1.0], 1.0, '#FFB0E0', 0.2)]) },
  'IV-2': { gates: [[0.3, 1.6, 0]], stand: { x: 0.35, z: 1.05, h: 0.05 }, face: 'dazed', pose: STRIDE(), pos: [0.0, 1.4, -0.9], look: [0.35, 1.1, 1.6], fov: 52, snake: { pts: [w(0.45, 0, 0.45), w(0.75, 0, 0.1), w(0.5, 0, -0.3), w(0.9, 0, -0.6)], tongue: true, look: w(0.35, 1.0, 1.05), ...FLOOR }, light: L(0.8, [POOL(0.4), MOON]) },
  'IV-3': DW(0), 'IV-4': DW(1, { h: -0.3, hx: -0.3, cx: -2.2, face: 'anxious', look: 0.9 }), 'IV-5': DW(2, { face: 'dazed' }), 'IV-6': DW(3, { h: -0.3, hx: -0.3, cx: -2.2, look: 0.9 }),
  'IV-7': DW(4, { hz: 2.4, face: 'alarm' }), 'IV-8': { ...DW(5, { face: 'dazed' }), stand: { x: -210 + 0.1, z: 0.6, h: PI }, pose: STRIDE(), pos: [1.5, 1.6, 4.2], look: [0, 1.2, -0.2], snake: undefined },

  // ---- V The same room (75-82)
  'V-1': { gates: [[0.3, 2.2, PI]], stand: { x: 0.3, z: 1.55, h: PI }, face: 'dazed', pose: STRIDE(), pos: [1.5, 1.7, -0.3], look: [0.3, 0.9, 1.5], fov: 58, light: L(0.84, [POOL(0.9), MOON, flash([0.4, 0.4, 1.0], 1.0, '#FFE0C0', 0.2)]) },
  'V-2': { gates: [[0.3, 2.2, PI]], stand: { x: 0.3, z: 1.55, h: PI }, bone: 'head', off: [0.1, 0.05, 1.0], fov: 26, face: 'dazed', light: L(0.92, [flash([0.0, 0.3, 0.8], 1.5, '#F6E7C1', 0.15)]) },
  'V-3': { gates: [[0.3, 2.2, PI]], stand: { x: 0.45, z: 1.25, h: PI }, face: 'alarm', pose: { fk: { neck: [0, 0.5, 0], head: [0.2, 0.9, 0] } }, pos: [1.6, 0.55, 1.0], look: [0.3, 0.25, 2.0], fov: 52,
    snake: { pts: [w(0.2, 0, 1.75), w(0.3, 0, 2.1), w(0.3, 0, 2.5), w(0.3, 0, 2.9)], rear: 0.7, tongue: true, look: w(0.45, 1.5, 1.25) }, light: L(0.86, [POOL(0.6), flash([0.6, 0.3, 0.8], 1.0, '#FFB0E0', 0.2)]) },

  // ---- VI The choke on the stool (83-98): the only time it leaves the floor
  'VI-1': { face: 'alarm', pose: { fk: { head: [0, -0.7, 0] } }, pos: [1.35, 1.35, -1.0], look: [0.3, 1.0, 0.0], fov: 50,
    snake: { pts: [w(0.5, 1.48, 0.02), w(0.46, 1.4, -0.06), BACK(1.2, 0.8), ...FLOORBACK], center: true, wave: 0, look: w(0.3, 1.55, 0.2), tongue: true }, light: L(0.88, [flash([0.6, 0.4, 1.0], 1.2, '#FFE0C0', 0.2), rim([0.8, 0.3, -0.8], '#FF3EA5', 1.2), POOL(0.5)]) },
  'VI-2': { face: 'alarm', pose: { fk: { head: [-0.1, -0.4, 0] }, ik: { handL: [0.2, 1.05, 0.3], handR: [-0.2, 1.05, 0.3] }, grip: { handL: 'fist', handR: 'fist' } }, pos: [-0.3, 1.5, 1.35], look: [0.3, 1.3, 0.05], fov: 42,
    snake: { pts: [w(0.62, 1.48, 0.2), w(0.52, 1.4, 0.16), ['wrap', w(0.3, 1.345, 0.02), w(0.3, 1.32, 0.02), 0.45, 1.6], BACK(1.2, 0.75), ...FLOORBACK], center: true, wave: 0, look: w(0.3, 1.55, 0.2), tongue: true }, light: MAG(1.1) },
  'VI-3': { face: 'alarm', pos: [0.75, 1.55, 1.1], look: [0.3, 1.35, 0.03], fov: 40, snake: { grip: {}, pts: [w(0.16, 1.5, 0.33), w(0.24, 1.42, 0.28), ['wrap', w(0.3, 1.345, 0.02), w(0.3, 1.31, 0.02), 0.8, 0], BACK(1.2, 0.8), ...FLOORBACK], center: true, wave: 0, look: w(0.3, 1.55, 0.15), tongue: true }, light: MAG(1.4) },
  'VI-4': { face: 'alarm', pos: [-0.95, 1.45, 0.35], look: [0.3, 1.25, 0.0], fov: 42, snake: { grip: {}, pts: [w(0.16, 1.5, 0.33), w(0.24, 1.42, 0.28), ['wrap', w(0.3, 1.345, 0.02), w(0.3, 1.31, 0.02), 0.8, 0], BACK(1.2, 0.8), ...FLOORBACK], center: true, wave: 0, look: w(0.3, 1.55, 0.15), tongue: true }, light: L(0.92, [flash([1.0, 0.3, 0.3], 1.4, '#FF3EA5', 0.2), rim([-0.8, 0.3, -0.4], '#FF8AD0', 1.0)]) },
  'VI-5': { face: 'dazed', pose: { fk: { neck: [-0.15, 0, 0.1], head: [-0.2, 0.25, 0.1] } }, pos: [-0.35, 1.5, 1.0], look: [0.3, 1.4, 0.03], fov: 38, snake: { grip: { fist: true }, pts: [w(0.42, 1.62, 0.25), w(0.4, 1.5, 0.27), ['wrap', w(0.3, 1.345, 0.02), w(0.3, 1.31, 0.02), 0.85, 0.3], BACK(1.2, 0.8), ...FLOORBACK], center: true, wave: 0, look: w(0.3, 1.6, 0.2), tongue: true }, light: MAG(1.8) },
  'VI-6': { face: 'dazed', pose: { fk: { neck: [-0.15, 0, 0.1], head: [-0.2, 0.25, 0.1] } }, bone: 'head', off: [-0.2, 0.0, 0.75], fov: 34, snake: { grip: { fist: true }, pts: [w(0.62, 1.72, 0.1), w(0.58, 1.58, 0.16), w(0.5, 1.46, 0.2), ['wrap', w(0.3, 1.345, 0.02), w(0.3, 1.31, 0.02), 0.85, 0.3], BACK(1.2, 0.8), ...FLOORBACK], center: true, wave: 0, look: w(0.25, 1.62, 0.9), tongue: true }, light: L(0.94, [flash([0.0, 0.3, 0.8], 1.9, '#FF2E9F', 0.16)]) },
  'VI-7': { face: 'given_up', pose: { fk: { spine: [0.2, 0, 0], neck: [0.25, 0, 0], head: [0.2, 0.2, 0.15] } }, pos: [1.0, 1.25, 1.3], look: [0.3, 1.2, 0.1], fov: 42, snake: { pts: [w(0.5, 1.4, 0.12), w(0.45, 1.36, -0.02), ['ride', w(0.3, 1.33, -0.08), w(0.3, 0.8, -0.1), [0, 0, -1]], ...FLOORBACK], center: true, wave: 0, look: w(1.0, 1.25, 1.3) }, light: L(0.9, [flash([0.4, 0.3, 1.0], 1.0, '#FFE9B0', 0.2), rim([-0.6, 0.3, -0.5], '#FF3EA5', 0.8)]) },
  'VI-8': { bone: 'head', off: [0.0, 0.03, 0.55], fov: 20, face: 'dazed', droste: true, drosteCam: { pos: [3.0, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62 }, light: L(0.8, [MOON, POOL(0.8), flash([0, 0.3, 0.8], 0.8, '#F6E7C1', 0.15)]) },

  // ---- VII The loop (99-103)
  'VII-1': { bars: 'all', pos: [2.3, 2.6, 2.4], look: [0.3, 0.4, 0.0], fov: 52, face: 'given_up', pose: { fk: { spine: [0.2, 0, 0], head: [0.3, 0, 0] } }, snake: { pts: [RING(0.5, 0.06, 0.4)] }, light: L(0.9, [POOL(0.45), MOON]) },
};
SHOTS['VII-2'] = { ...SHOTS['I-1'] };

// choke check views (the same pose as VI-3 from four sides)
for (const [k, pos] of Object.entries({ front: [0.3, 1.45, 1.4], side: [1.5, 1.45, 0.05], back: [0.3, 1.5, -1.3], low: [0.9, 1.0, 0.9] }))
  SHOTS['C-' + k] = { ...SHOTS['VI-3'], pos, look: [0.3, 1.3, 0.03], fov: 40 };
