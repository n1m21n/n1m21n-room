// Bring Me Some Change: one still per scene (contact sheet). Bars: 138 BPM, bar 1.739 s, downbeat 0.00 s.
const PX = -30, PI = Math.PI;
const DANCE = { spine: [0.1, 0, 0.12], chest: [0.05, 0.15, 0], upperarmL: [2.7, 0, -0.35], upperarmR: [2.3, 0, 0.5], forearmL: [0.7, 0, 0], forearmR: [0.5, 0, 0], head: [-0.3, 0.25, 0.1], thighL: [0.35, 0, 0], shinL: [-0.6, 0, 0] };
const SHY = { spine: [0.15, 0, 0], upperarmL: [0.6, 0, -0.1], upperarmR: [0.2, 0, 0.1], forearmL: [1.4, 0, 0], forearmR: [0.3, 0, 0], head: [0.3, -0.2, 0] };
const SLUMP = { spine: [0.3, 0, 0], chest: [0.15, 0, 0], neck: [0.2, 0, 0], head: [0.35, 0, 0], upperarmL: [0.05, 0, 0.05], upperarmR: [0.05, 0, -0.05] };
const BOB = { spine: [0.18, 0, 0], neck: [0.25, 0, 0], head: [0.3, 0.1, 0], upperarmL: [0.5, 0, -0.2], upperarmR: [0.6, 0, 0.3], forearmL: [1.2, 0, 0], forearmR: [1.3, 0, 0] };
const LIE = { _y: 0.2, upperarmL: [0, 0, -1.2], upperarmR: [0, 0, 1.2], head: [0, 0.3, 0] };
const FIT0 = 1, FITX = 5;
export const SHOTS = {
  // ACT I  same day (b1-14)
  'I-1': { fit: FIT0, act: 'bed', t: 2, face: 'drowsy', sky: 'dawn', bone: 'head', woff: [0.0, 0.85, 0.6], fov: 50 },
  'I-2': { fit: FIT0, act: 'brush', t: 5, face: 'drowsy', bone: 'head', off: [-0.7, 0.05, 0.5], fov: 45 },
  'I-3': { fit: FIT0, act: 'desk', t: 3, face: 'bored', sky: 'day', bone: 'chest', off: [-1.4, 0.4, 0.45], fov: 50 },
  'I-4': { fit: FIT0, act: 'tv', t: 3, face: 'bored', sky: 'dusk', bone: 'chest', off: [1.6, 0.5, 1.4], fov: 50 },
  'I-5': { fit: FIT0, act: 'think', t: 3, face: 'lonely', sky: 'day', bone: 'chest', off: [0.6, 0.35, -1.6], fov: 50 },
  'I-6': { fit: FIT0, act: 'bed', t: 2, face: 'sleep', sky: 'night', pos: [3.6, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62 },
  // ACT II  trying (b15-36)
  'II-1': { fit: FIT0, at: [0.3, 0.6, PI], face: 'restless', sky: 'day', bone: 'head', off: [0, 0.0, 1.0], fov: 40 },
  'II-2': { fit: FIT0, act: 'guitar', beat: 'retry', t: 4.8, face: 'frustrated', sky: 'day', bone: 'chest', off: [1.0, 0.3, 1.4], fov: 50 },
  'II-3': { fit: FIT0, act: 'keys', beat: 'retry', t: 4.8, face: 'given_up', sky: 'day', bone: 'chest', woff: [1.0, 0.45, 1.3], fov: 50 },
  'II-4': { fit: FIT0, act: 'paint', t: 30, face: 'sad', sky: 'dusk', bone: 'chest', off: [0.9, 0.3, 1.3], fov: 50 },
  'II-5': { fit: FITX, act: 'wardrobe', t: 3.5, ward: true, face: 'proud', sky: 'dusk', bone: 'chest', off: [0, 0.1, 2.6], fov: 40 },
  'II-6': { fit: FITX, act: 'think', t: 3, face: 'lonely', sky: 'night', bone: 'head', tadd: [0, 0.1, 0], woff: [1.0, 0.0, 0.9], fov: 45 },
  'II-7': { fit: FITX, act: 'phone', t: 3, face: 'curious', sky: 'night', bone: 'head', off: [0.8, 0.15, 0.8], fov: 45 },
  // ACT III  out (b37-50)
  'III-1': { fit: FITX, portal: { p: [0.3, 0, 0.0], ry: 0 }, at: [0.3, 1.3, PI], sky: 'night', face: 'curious', noEasel: true, pos: [2.2, 1.1, 2.4], look: [0.3, 1.0, 0.5], fov: 55 },
  'III-2': { fit: FITX, portal: { p: [0.3, 0, 0.4], ry: 0, k: 1.25 }, at: [0.3, 0.95, PI], sky: 'night', face: 'curious', noEasel: true, pos: [0.55, 1.5, 2.3], look: [0.3, 1.1, 0.4], fov: 50 },
  'III-3': { fit: FITX, party: { k: 0 }, at: [PX - 3, 3.2, PI * 0.9], face: 'uneasy', pos: [PX - 4.5, 2.6, 7.5], look: [PX - 0.5, 1.0, -1], fov: 55 },
  'III-4': { fit: FITX, party: { k: 1, away: true }, at: [PX - 1, 1.5, PI], face: 'embarrassed', pose: SHY, pos: [PX + 0.6, 1.4, -1.8], look: [PX - 1, 1.1, 1.5], fov: 50 },
  'III-5': { fit: FITX, party: { k: 2, away: true }, at: [PX - 1, 1.5, PI], face: 'lonely', bone: 'head', off: [0.35, 0.0, 1.5], fov: 32 },
  'III-6': { fit: FITX, party: { k: 2, pool: true, dark: true, neon: false, tint: '#140C33' }, at: [PX - 1, 1.5, PI], face: 'lonely', pose: SLUMP, pos: [PX - 1, 9, 1.51], look: [PX - 1, 0, 1.5], fov: 40, bg: '#05030C' },
  // ACT IV  the change (b51-70)
  'IV-1': { fit: FITX, party: { k: 2, pool: true, dark: true, neon: false, tint: '#140C33' }, at: [PX - 1, 1.5, PI], face: 'dazed', bone: 'head', tadd: [0, 0.14, 0], off: [0, 0.0, 0.5], fov: 26, bg: '#05030C' },
  'IV-2': { noEasel: true, fit: FITX, at: [0.3, 1.2, PI], face: 'dazed', pose: SLUMP, sky: 'night', pos: [0.3, 9.5, 1.21], look: [0.3, 0, 1.2], fov: 40 },
  'IV-3': { noEasel: true, fit: FITX, at: [0.3, 1.2, PI], face: 'absorbed', pose: BOB, sky: 'night', bone: 'chest', off: [-0.9, 0.3, 1.9], fov: 45 },
  'IV-4': { fit: FITX, sky: 'night', pos: [0.75, 2.2, -1.6], look: [0.75, 2.25, -3], fov: 45 },
  'IV-5': { noEasel: true, fit: FITX, at: [0.3, 1.2, 0], face: 'joyful', pose: DANCE, sky: 'dusk', pos: [1.1, 0.3, 2.7], look: [0.1, 1.6, -1.0], fov: 62 },
  'IV-6': { noEasel: true, fit: FITX, party: { k: 0, ring: true }, at: [0.3, 1.2, PI], face: 'delighted', pose: DANCE, sky: 'dusk', pos: [0.3, 8.5, 1.21], look: [0.3, 0, 1.2], fov: 45 },
  'IV-7': { fit: FITX, at: [0.3, 1.2, PI], face: 'triumph', pose: DANCE, sky: 'dusk', bone: 'head', tadd: [0, 0.1, 0], off: [0.3, -0.25, 1.1], fov: 34, roll: 0.3, noEasel: true },
  // ACT V  morning (b71-86)
  'V-1': { noEasel: true, fit: FITX, at: [0.3, 1.2, PI], lie: true, pose: LIE, face: 'relieved', sky: 'dawn', pos: [0.3, 6, 1.21], look: [0.3, 0, 1.2], fov: 40 },
  'V-2': { fit: FITX, act: 'think', t: 3, face: 'calm', sky: 'dawn', bone: 'chest', off: [0.6, 0.35, -1.6], fov: 50 },
  'V-3': { fit: FITX, act: 'guitar', t: 3, face: 'content', sky: 'day', nap: true, pos: [3.6, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62 },
  'V-4': { fit: FITX, sky: 'dawn', pos: [-1.7, 1.6, 0.4], look: [-1.7, 1.9, -3], fov: 55 },
};
