// Bring Me Some Change: one still per scene (contact sheet). Bars: 138 BPM, bar 1.739 s, downbeat 0.00 s.
const PX = -30, PI = Math.PI;
const FIT0 = 1, FITX = 5;
export const SHOTS = {
  'T-flash': { fit: FIT0, act: 'desk', t: 3, face: 'alarm', sky: 'night', bone: 'chest', off: [-1.4, 0.4, 0.45], fov: 50,
    light: { dark: 0.9, lights: [{ type: 'flash', to: 'head', rel: [-1.2, 1.2, 1.6], col: '#E8F0FF', k: 1.6, cone: 0.16 }, { type: 'spot', to: [-3.4, 0.75, 2.4], rel: [0.3, 2.6, 0.2], col: '#7FA6FF', k: 0.9, cone: 0.35 }, { type: 'flicker', to: [-3.2, 1.2, 2.5], from: [-3.0, 1.9, 2.0], col: '#FFD27A', k: 0.7 }] } },
  'T-room': { fit: FIT0, act: 'bed', t: 2, face: 'sleep', sky: 'night', pos: [3.6, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62,
    light: { dark: 0.92, lights: [{ type: 'area', to: 'hips', rel: [0, 2.6, 0.3], col: '#7FA6FF', k: 0.8, cone: 0.7 }, { type: 'spot', to: [0.75, 2.25, -3], rel: [0, -0.8, 1.6], col: '#FF3EA5', k: 1.0, cone: 0.25 }, { type: 'spot', to: [1.6, 0.9, -2.6], rel: [0, 2, 0.6], col: '#FFD27A', k: 1.0, cone: 0.3 }] } },
  'T-ghost': { fit: FITX, party: { k: 1 }, at: [PX + 4, 4, PI], face: 'lonely', pos: [PX, 1.7, -3.6], look: [PX, 1.2, 2], fov: 45, light: { dark: 0.94, lights: [] } },
  'T-brushL': { fit: FIT0, act: 'brush', mv: 'brush', prop: 'toothbrush', t: 5, face: 'drowsy', bone: 'head', off: [-0.75, 0.15, 0.3], fov: 45 },
  'T-brushT': { fit: FIT0, act: 'brush', mv: 'brush', prop: 'toothbrush', t: 5.1, face: 'drowsy', bone: 'head', off: [0.35, 0.6, 0.25], fov: 50 },
  // ACT I  same day (b1-14)
  'I-1': { fit: FIT0, act: 'bed', t: 2, face: 'sleep', sky: 'night', pos: [3.6, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62 },
  'I-2': { fit: FIT0, act: 'bed', t: 2, face: 'drowsy', sky: 'dawn', bone: 'head', woff: [0.0, 0.85, 0.6], fov: 50 },
  'I-3': { fit: FIT0, act: 'brush', mv: 'brush', prop: 'toothbrush', t: 5, face: 'drowsy', bone: 'head', off: [0.75, 0.15, 0.3], fov: 45 },
  'I-4': { fit: FIT0, act: 'desk', t: 3, face: 'bored', sky: 'day', bone: 'chest', off: [-1.4, 0.4, 0.45], fov: 50 },
  'I-5': { fit: FIT0, act: 'tv', t: 3, face: 'bored', sky: 'dusk', bone: 'chest', off: [1.6, 0.5, 1.4], fov: 50 },
  'I-6': { fit: FIT0, act: 'think', t: 3, face: 'lonely', sky: 'day', bone: 'chest', off: [0.6, 0.35, -1.6], fov: 50 },
  'I-7': { fit: FIT0, act: 'desk', t: 3, face: 'bored', sky: 'day', pos: [3.6, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62 },
  // ACT II  trying (b15-36)
  'II-1': { fit: FIT0, at: [0.3, 0.6, PI], idle: 'fidget', face: 'restless', sky: 'day', bone: 'head', off: [0, 0.0, 1.0], fov: 40 },
  'II-2': { fit: FIT0, act: 'guitar', beat: 'retry', t: 4.8, face: 'frustrated', sky: 'day', bone: 'chest', off: [1.0, 0.3, 1.4], fov: 50 },
  'II-3': { fit: FIT0, act: 'keys', beat: 'retry', t: 4.8, face: 'given_up', sky: 'day', bone: 'chest', woff: [1.0, 0.45, 1.3], fov: 50 },
  'II-4': { fit: FIT0, act: 'paint', t: 30, face: 'sad', sky: 'dusk', bone: 'chest', off: [0.9, 0.3, 1.3], fov: 50 },
  'II-5': { fit: FITX, act: 'wardrobe', t: 3.5, ward: true, face: 'proud', sky: 'dusk', bone: 'chest', off: [0, 0.1, 2.6], fov: 40 },
  'II-6': { fit: FITX, act: 'think', t: 3, face: 'lonely', sky: 'night', bone: 'head', tadd: [0, 0.1, 0], woff: [1.0, 0.0, 0.9], fov: 45 },
  'II-7': { fit: FITX, act: 'phone', t: 3, face: 'curious', sky: 'night', bone: 'head', off: [0.8, 0.15, 0.8], fov: 45 },
  // ACT III  out (b37-50)
  'III-1': { fit: FITX, portal: { p: [0.3, 0, 0.0], ry: 0 }, at: [0.3, 1.3, PI], idle: 'glance', sky: 'night', face: 'curious', noEasel: true, pos: [2.2, 1.1, 2.4], look: [0.3, 1.0, 0.5], fov: 55 },
  'III-2': { fit: FITX, portal: { p: [0.3, 0, 0.4], ry: 0, k: 1.25 }, at: [0.3, 1.5, PI], walk: [0.3, 0.45], sky: 'night', face: 'curious', noEasel: true, pos: [0.55, 1.5, 2.3], look: [0.3, 1.1, 0.4], fov: 50 },
  'III-3': { fit: FITX, party: { k: 0 }, at: [PX - 3, 3.2, PI * 0.9], idle: 'glance', face: 'uneasy', pos: [PX - 4.5, 2.6, 7.5], look: [PX - 0.5, 1.0, -1], fov: 55 },
  'III-4': { fit: FITX, party: { k: 1, away: true }, at: [PX - 1, 1.5, PI], face: 'embarrassed', mv: 'shy', pos: [PX + 0.6, 1.4, -1.8], look: [PX - 1, 1.1, 1.5], fov: 50 },
  'III-5': { fit: FITX, party: { k: 2, away: true }, at: [PX - 1, 1.5, PI], idle: 'sigh', face: 'lonely', bone: 'head', off: [0.35, 0.0, 1.5], fov: 32 },
  'III-6': { fit: FITX, party: { k: 2, pool: true, dark: true, neon: false, tint: '#140C33' }, at: [PX - 1, 1.5, PI], face: 'lonely', mv: 'slump', pos: [PX - 1, 9, 1.51], look: [PX - 1, 0, 1.5], fov: 40, bg: '#05030C' },
  // ACT IV  the change (b51-70)
  'IV-1': { fit: FITX, party: { k: 2, pool: true, dark: true, neon: false, tint: '#140C33' }, at: [PX - 1, 1.5, PI], idle: 'sigh', face: 'dazed', bone: 'head', tadd: [0, 0.14, 0], off: [0, 0.0, 0.5], fov: 26, bg: '#05030C' },
  'IV-2': { noEasel: true, fit: FITX, at: [0.3, 1.2, PI], face: 'dazed', mv: 'slump', sky: 'night', pos: [0.3, 9.5, 1.21], look: [0.3, 0, 1.2], fov: 40 },
  'IV-3': { noEasel: true, fit: FITX, at: [0.3, 1.2, PI], face: 'absorbed', mv: 'bob', t: 0.9, sky: 'night', pos: [-0.4, 0.7, -0.5], look: [0.5, 1.3, 1.6], fov: 50 },
  'IV-4': { fit: FITX, sky: 'night', pos: [0.75, 2.2, -1.6], look: [0.75, 2.25, -3], fov: 45 },
  'IV-5': { noEasel: true, fit: FITX, at: [0.3, 1.2, 0], face: 'joyful', mv: 'up', t: 1.1, sky: 'dusk', pos: [1.1, 0.3, 2.7], look: [0.1, 1.6, -1.0], fov: 62 },
  'IV-6': { noEasel: true, fit: FITX, party: { k: 0, ring: true }, at: [0.3, 1.2, PI], face: 'delighted', mv: 'point', t: 1.3, sky: 'dusk', pos: [0.3, 8.5, 1.21], look: [0.3, 0, 1.2], fov: 45 },
  'IV-7': { fit: FITX, at: [0.3, 1.2, PI], face: 'triumph', mv: 'up', t: 1.1, sky: 'dusk', bone: 'head', tadd: [0, 0.1, 0], off: [0.3, -0.25, 1.1], fov: 34, roll: 0.3, noEasel: true },
  // ACT V  morning (b71-86)
  'V-1': { noEasel: true, fit: FITX, at: [0.3, 1.2, PI], mv: 'lie', face: 'relieved', sky: 'dawn', pos: [0.3, 6, 1.21], look: [0.3, 0, 1.2], fov: 40 },
  'V-2': { fit: FITX, act: 'think', t: 3, face: 'calm', sky: 'dawn', bone: 'chest', off: [0.6, 0.35, -1.6], fov: 50 },
  'V-3': { fit: FITX, act: 'guitar', t: 3, face: 'content', sky: 'day', nap: true, pos: [3.6, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62 },
  'V-4': { fit: FITX, act: 'bed', t: 2, face: 'sleep', sky: 'dawn', pos: [3.6, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62 },
};

// r3 lighting. Four kinds (stage.mjs / look.js uStage): flash = hard white on HIM only (it disturbs him; turns warm
// and his own at the change), spot = a tight beam on a thing or an area of the set (never on him), area = soft wide
// light on an activity (both), flicker = a practical lamp caught at one level of its flicker (both).
// The room sits in the dark (dark 0.7 in the dull loop, 0.9+ at night and in the rave).
const flash = (rel, k = 1.6, col = '#E8F0FF', cone = 0.16, to = 'head') => ({ type: 'flash', to, rel, col, k, cone });
const spot = (to, rel, col, k = 1, cone = 0.3) => ({ type: 'spot', to, rel, col, k, cone });
const area = (to, rel, col, k = 0.8, cone = 0.7) => ({ type: 'area', to, rel, col, k, cone });
const flick = (to, rel, col = '#FFD27A', k = 0.7) => ({ type: 'flicker', to, rel, col, k });
const rim = (rel, col, k = 1.2, to = 'chest') => ({ type: 'rim', to, rel, col, k, cone: 0.3 });
const L = (dark, lights, amb) => ({ dark, lights, amb });
const SPIRAL = [1.85, 2.3, -2.9], RUG = [0.3, 0, 1.2];
const LIGHT = {
  'I-1': L(0.85, [area('hips', [0, 2.6, 0.3], '#7F9BFF', 1.3, 0.8), spot(SPIRAL, [0, -0.6, 1.8], '#FF3EA5', 0.6, 0.22)]),
  'I-2': L(0.85, [area('head', [0.4, 1.4, 1.0], '#FFB37A', 0.9, 0.5)]),
  'I-3': L(0.8, [area('head', [0, 1.6, 0.6], '#CFE3FF', 0.8, 0.5), flick('head', [-0.3, 0.6, 0.5], '#BFFFF0', 0.5)]),
  'I-4': L(0.85, [area('head', [0, 0.1, 0.9], '#7FE6FF', 0.9, 0.5), spot(SPIRAL, [0, -0.6, 1.8], '#FF3EA5', 0.5, 0.22)]),
  'I-5': L(0.85, [area('head', [0, 0.2, 1.4], '#6FD6FF', 0.9, 0.55), spot(RUG, [0, 2.8, 0], '#8A5BFF', 0.5, 0.35)]),
  'I-6': L(0.75, [rim([0.4, 0.3, 1.4], '#CFE3FF', 2.0), area('chest', [0.3, 0.6, 1.6], '#9CC3FF', 0.9, 0.7), spot(SPIRAL, [0, -0.6, 1.8], '#FF3EA5', 0.8, 0.22)]),
  'I-7': L(0.85, [area('hips', [0, 2.2, 0.2], '#7FA6FF', 0.6), flick('@lamp', [0, 0.3, 0.3], '#FFD27A', 0.6), spot(RUG, [0, 2.8, 0], '#FF3EA5', 0.5, 0.35)]),
  'II-1': L(0.9, [flash([-1.4, 0.4, 0.8], 1.8)]),
  'II-2': L(0.85, [area('chest', [0.6, 1.8, 0.8], '#FFB37A', 0.8, 0.6), rim([-0.8, 0.5, -1.0], '#8A5BFF', 1.0)]),
  'II-3': L(0.88, [spot('@play keys', [0, 2.0, 0.4], '#FFE14D', 1.1, 0.25), area('head', [0.5, 1.4, 0.9], '#9CB8FF', 1.0, 0.6), flick('@lamp', [0, 0.3, 0.3], '#FFD27A', 0.9)]),
  'II-4': L(0.85, [area('chest', [0.3, 1.8, 1.0], '#FFC98A', 0.8, 0.6), flash([1.4, 0.6, -0.4], 1.5)]),
  'II-5': L(0.82, [area('chest', [0, 1.8, 1.2], '#FFD27A', 0.9, 0.6), spot('@wardrobe', [0, 2.0, 0.6], '#FF3EA5', 0.6, 0.35)]),
  'II-6': L(0.78, [rim([0.5, 0.3, 1.4], '#CFE3FF', 2.2), area('head', [0.6, 0.8, 1.2], '#9CB8FF', 1.0, 0.6), flick('@lamp', [0, 0.3, 0.3], '#FFD27A', 1.1), flash([-1.0, 1.0, 1.2], 1.2)]),
  'II-7': L(0.9, [area('head', [0.1, -0.5, 0.5], '#DDF4FF', 1.1, 0.5)]),
  'III-1': L(0.9, [rim([0, 0.4, 1.5], '#FF3EA5', 1.4), spot(RUG, [0, 2.8, 0.5], '#3EE6FF', 0.6, 0.35)]),
  'III-2': L(0.92, [flash([0, 0.3, 1.6], 1.8, '#F4E8FF'), rim([0.8, 0.2, -1.2], '#FF8AD0', 1.0)]),
  'III-3': L(0.94, [spot([-31, 0, 0], [0, 5, 0], '#FF3EA5', 1.2, 0.3), spot([-28, 0, -1], [0, 5, 0.5], '#3EE6FF', 1.2, 0.3), area([-30, 1, -2], [0, 4, 2], '#8A5BFF', 0.7, 0.8), rim([1, 0.5, -1.5], '#FF8AD0', 0.7)]),
  'III-4': L(0.94, [flash([0.6, 1.4, 1.4], 2.8), spot([-30, 0, -1.5], [0, 5, 0], '#FF3EA5', 1.2, 0.35), spot([-32.5, 0, -0.5], [0, 5, 0], '#3EE6FF', 1.0, 0.3)]),
  'III-5': L(0.95, [flash([0.2, 1.6, 1.2], 2.0, '#F0F4FF', 0.14), rim([-0.8, 0.3, -1.4], '#FF3EA5', 0.8)]),
  'III-6': L(0.97, [area('hips', [0, 5, 0.01], '#F6E7C1', 1.2, 0.22)]),
  'IV-1': L(0.97, [flash([0.5, 0.8, 1.2], 1.3, '#FFFFFF', 0.12)]),
  'IV-2': L(0.9, [area('hips', [0, 5, 0.01], '#F6E7C1', 1.0, 0.22), spot('@lamp', [0, 2, 0.4], '#FF3EA5', 0.8, 0.3)]),
  'IV-3': L(0.82, [area('chest', [0, -0.9, 1.2], '#FF3EA5', 1.0, 0.6), rim([0.8, 0.6, -1.2], '#BFF6FF', 0.7), spot('@books', [0, 2, -0.6], '#FFE14D', 0.9, 0.35), spot('@watch tv', [0, 2, -0.6], '#8A5BFF', 1.0, 0.35)]),
  'IV-4': L(0.9, [spot(SPIRAL, [0, -0.4, 1.4], '#FFE14D', 1.4, 0.25), spot([0.75, 2.25, -2.9], [0, -0.4, 1.4], '#FF3EA5', 1.0, 0.2)]),
  'IV-5': L(0.8, [area('chest', [0.5, 2.0, 0.8], '#FF3EA5', 1.0, 0.6), rim([-0.8, 0.8, -1.2], '#BFF6FF', 0.8), flash([0.6, 1.2, 1.4], 1.3, '#FFE9B0')]),
  'IV-6': L(0.82, [area('hips', [0, 4, 0.01], '#FF3EA5', 1.0, 0.5), spot(RUG, [1.2, 4, 0], '#3EE6FF', 0.8, 0.45), flash([0, 3, 0.6], 1.2, '#FFE9B0')]),
  'IV-7': L(0.9, [flash([0.4, 0.8, 1.2], 1.9, '#FFD27A', 0.16), rim([-0.8, 0.6, -1.0], '#FF3EA5', 1.2)]),
  'V-1': L(0.6, [area('hips', [0, 4, 0.3], '#FFC98A', 1.0, 0.5)], '#3A2A5A'),
  'V-2': L(0.55, [rim([0.4, 0.3, 1.4], '#FFC98A', 1.4), area('chest', [0, 1.5, 1.2], '#FFB37A', 0.5)], '#3A2A5A'),
  'V-3': L(0.5, [area('chest', [0, 2.2, 0.6], '#FFD9A0', 0.8)], '#3A2A5A'),
  'V-4': L(0.6, [area('hips', [0, 2.6, 0.3], '#FFC98A', 0.9), spot(SPIRAL, [0, -0.6, 1.8], '#FFE14D', 0.7, 0.22)], '#3A2A5A'),
};
// surreal, teased: one thing slightly wrong in I, more in II, a float in III, the whole room in IV, one left in V
const SURREAL = {
  'I-7': [{ o: 'lamp', twist: 0.5 }],
  'II-4': [{ o: 'play guitar', lift: 0.18, tilt: 0.15 }],
  'II-6': [{ o: 'lamp', twist: 1.6, bulge: 0.3 }],
  'III-1': [{ o: 'records', lift: 0.35, spin: 0.25 }, { o: 'play guitar', lift: 0.3, tilt: 0.4 }],
  'IV-2': [{ o: 'lamp', twist: 2.2, bulge: 0.4 }, { o: 'records', lift: 0.6, spin: 0.4 }, { o: 'play keys', lift: 0.4, tilt: -0.2 }],
  'IV-3': [{ o: 'lamp', twist: 2.6, bulge: 0.4, lift: 0.3 }, { o: 'books', twist: 0.8, lift: 0.5, spin: 0.3 }, { o: 'watch tv', lift: 0.5, spin: 0.6 }, { o: 'timeline', tilt: 0.6 }],
  'IV-5': [{ o: 'lamp', twist: 3, bulge: 0.5, lift: 0.5 }, { o: 'records', twist: 1.5, lift: 1.0, spin: 0.8 }, { o: 'play keys', lift: 0.9, tilt: 0.5 }, { o: 'play guitar', lift: 1.2, tilt: 1.4 }, { o: 'monstera', twist: 2, stretch: 1.4 }],
  'IV-6': [{ o: 'lamp', twist: 3, bulge: 0.5, lift: 0.5 }, { o: 'records', lift: 1.0, spin: 0.8 }, { o: 'play keys', lift: 0.9, tilt: 0.5 }, { o: 'play guitar', lift: 1.2, tilt: 1.4 }, { o: 'watch tv', lift: 0.6, spin: 0.5 }],
  'V-1': [{ o: 'play guitar', lift: 0.25, tilt: 0.3 }],
  'V-4': [{ o: 'lamp', twist: 0.8 }],
};
for (const [k, v] of Object.entries(LIGHT)) SHOTS[k].light = v;
for (const [k, v] of Object.entries(SURREAL)) SHOTS[k].surreal = v;
