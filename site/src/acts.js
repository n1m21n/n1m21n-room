// Activities: what the man does at a station (sit and type, sleep, think at the window, play keys / guitar, read,
// work the TV remote, sit on a bench). Each act is a function of the seconds since it started -> a pose spec:
//   y      root height offset (seated hips sink onto the seat)
//   lie    lie on his back (root tipped onto the mattress)
//   turn   heading offset from the spot's heading (radians)
//   fk     bone -> [x, y, z] euler delta on the rest pose (spine, head, thighs ...)
//   ik     hand / foot -> [x, y, z] contact point, man-local metres (he faces +z, his left is +x, floor y = 0)
//   pole   optional elbow / knee hint per limb, man-local offset from the limb root
//   hand   handL / handR -> [fingers, palm] directions (man-local). With it, the ik point is where the PALM touches
//          (keys, belly, book cover, cheek): the wrist is backed off by the hand's size and the hand is turned to match.
//   follow handL / handR -> bone: the ik point and hand directions are given relative to that bone (in his rest frame)
//          and move with it (palm on his own cheek follows the head as it turns)
//   grip   handL / handR -> a hand shape from GRIPS (fingers curl toward the palm; default 'relax')
// IK puts hands and feet ON things (keys, neck, book, chin, floor) so limbs don't sink into furniture.
import * as THREE from 'three';

const e = new THREE.Euler(), q = new THREE.Quaternion(), qa = new THREE.Quaternion(), qp = new THREE.Quaternion();
const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), T = new THREE.Vector3(), P = new THREE.Vector3();
const d1 = new THREE.Vector3(), d2 = new THREE.Vector3(), Y = new THREE.Vector3();
const LIMB = { handL: ['upperarmL', 'forearmL'], handR: ['upperarmR', 'forearmR'], footL: ['thighL', 'shinL'], footR: ['thighR', 'shinR'] };
const POLE = {                                                     // default elbows down + back + out, knees forward
  handL: [0.35, -0.6, -0.35], handR: [-0.35, -0.6, -0.35], footL: [0.05, 0.2, 1], footR: [-0.05, 0.2, 1],
};

// rotate a bone (in world space) so its world direction `from` turns into `to`
function aim(bone, from, to) {
  qa.setFromUnitVectors(from, to);
  bone.getWorldQuaternion(q).premultiply(qa);
  bone.parent.getWorldQuaternion(qp).invert();
  bone.quaternion.copy(qp.multiply(q));
  bone.updateMatrixWorld(true);
}

// analytic two-bone IK: root bone `up`, middle `mid`, effector `end` reaches world point `target`, bending toward `pole`
export function ik2(up, mid, end, target, pole) {
  up.getWorldPosition(A); mid.getWorldPosition(B); end.getWorldPosition(C);
  const a = A.distanceTo(B), b = B.distanceTo(C);
  T.subVectors(target, A); let d = T.length(); T.normalize();
  d = THREE.MathUtils.clamp(d, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  Y.subVectors(pole, A); Y.addScaledVector(T, -Y.dot(T));
  if (Y.lengthSq() < 1e-8) Y.set(0, -1, 0); Y.normalize();
  P.copy(A).addScaledVector(T, a * cosA).addScaledVector(Y, a * sinA);         // where the elbow / knee goes
  aim(up, d1.subVectors(B, A).normalize(), d2.subVectors(P, A).normalize());
  mid.getWorldPosition(B); end.getWorldPosition(C);
  aim(mid, d1.subVectors(C, B).normalize(), d2.subVectors(T.multiplyScalar(d).add(A), B).normalize());
}

// the hand mesh (measured from man.glb, root-local, rest pose): fingers hang -y, palm faces the thigh, thumb forward
const PALM_C = 0.126, PALM_T = 0.032;                 // wrist -> palm centre along the fingers; centre -> palm surface
const REST = { handL: { F: [0, -1, 0], N: [-1, 0, 0] }, handR: { F: [0, -1, 0], N: [1, 0, 0] } };
const Fv = new THREE.Vector3(), Nv = new THREE.Vector3(), Xv = new THREE.Vector3(), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), rq = new THREE.Quaternion();
let calib = null;                                      // per hand: fingers / palm axes in the hand bone's own frame
function calibrate(man) {
  const r = man.root, keep = r.rotation.clone(), y = r.position.y;      // Euler, not quaternion: a re-decomposed quaternion can come back with a stray z flip
  for (const b of Object.values(man.bones)) b.quaternion.copy(b.userData.rest);
  r.rotation.set(0, 0, 0); r.updateMatrixWorld(true);
  calib = { rest: {} };
  for (const [n, b] of Object.entries(man.bones)) calib.rest[n] = b.getWorldQuaternion(new THREE.Quaternion());   // root = identity
  for (const h of ['handL', 'handR']) {
    const inv = man.bones[h].getWorldQuaternion(new THREE.Quaternion()).invert();
    calib[h] = { F: new THREE.Vector3(...REST[h].F).applyQuaternion(inv), N: new THREE.Vector3(...REST[h].N).applyQuaternion(inv) };
  }
  r.rotation.copy(keep); r.position.y = y; r.updateMatrixWorld(true);
}
function basis(F, N, m) {                              // orthonormal frame [F, N', F x N']
  Nv.copy(N).addScaledVector(F, -N.dot(F)).normalize(); Xv.crossVectors(F, Nv);
  return m.makeBasis(F, Nv, Xv);
}
// turn a hand bone so its fingers point along F and its palm faces N (both world, unit)
function orientHand(bone, c, F, N) {
  basis(F.clone(), N, m1); basis(c.F.clone().normalize(), c.N, m2);
  rq.setFromRotationMatrix(m1.multiply(m2.transpose()));
  bone.parent.getWorldQuaternion(qp).invert();
  bone.quaternion.copy(qp.multiply(rq)); bone.updateMatrixWorld(true);
}

// a hand's palm in man-local space: centre, fingers direction F, palm normal N (props are placed against it)
export function palmFrame(man, h) {
  if (!calib) calibrate(man);
  const b = man.bones[h], wq = b.getWorldQuaternion(new THREE.Quaternion()), rq = man.root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const F = calib[h].F.clone().applyQuaternion(wq).applyQuaternion(rq).normalize();
  const N = calib[h].N.clone().applyQuaternion(wq).applyQuaternion(rq).normalize();
  const pos = man.root.worldToLocal(b.getWorldPosition(new THREE.Vector3())).addScaledVector(F, PALM_C);
  return { pos, F, N, PALM_T };
}

// hand shapes: [knuckle curl, middle curl] for the four fingers, then the thumb (radians toward the palm)
export const GRIPS = {
  flat:  { f: [0.05, 0.05], t: [0, 0] },
  relax: { f: [0.3, 0.35], t: [0.1, 0.15] },
  type:  { f: [0.55, 0.6], t: [0.2, 0.2] },               // curved fingers, tips down on the keys
  cup:   { f: [0.2, 0.25], t: [0.15, 0.1] },
  hold:  { f: [1.2, 1.1], t: [0.5, 0.4] },                // wrapped round a remote / book spine / guitar neck
  fist:  { f: [1.5, 1.6], t: [0.7, 0.6] },
};
const FING = ['idx', 'mid', 'rng', 'pky'];
export function shapeHand(Bn, side, g) {                          // curl is local z: +z curls the right hand in, -z the left
  const sg = side === 'L' ? -1 : 1, G = typeof g === 'string' ? GRIPS[g] : g;
  FING.forEach((f, i) => {
    const fan = (i - 1.5) * 0.04;                          // little spread so the fingers fan, not stack
    Bn[f + '1' + side].rotateZ(sg * G.f[0] * (1 + i * 0.06)).rotateX(fan); Bn[f + '2' + side].rotateZ(sg * G.f[1]);
  });
  Bn['thb1' + side].rotateZ(sg * G.t[0]); Bn['thb2' + side].rotateZ(sg * G.t[1]);
}
function resetFingers(Bn, side) { for (const f of [...FING, 'thb']) for (const i of '12') Bn[f + i + side].quaternion.copy(Bn[f + i + side].userData.rest); }
export function relaxHands(Bn, g = 'relax') { if (!Bn.idx1L) return; for (const sd of 'LR') { resetFingers(Bn, sd); shapeHand(Bn, sd, g); } }

// apply a spec to the man (root already placed at the spot); returns the spec
export function applyAct(man, spec) {
  if (!calib) calibrate(man);
  const Bn = man.bones;
  for (const [n, b] of Object.entries(Bn)) {
    b.quaternion.copy(b.userData.rest);
    const v = spec.fk?.[n]; if (v) b.quaternion.multiply(q.setFromEuler(e.set(v[0], v[1], v[2])));
  }
  for (const sd of ['L', 'R']) if (Bn.idx1L) shapeHand(Bn, sd, spec.grip?.['hand' + sd] || 'relax');
  man.root.position.y = spec.y || 0;
  man.root.updateMatrixWorld(true);
  const tw = new THREE.Vector3(), pw = new THREE.Vector3(), rootQ = man.root.getWorldQuaternion(new THREE.Quaternion());
  for (const [eff, xyz] of Object.entries(spec.ik || {})) {
    const [u, m] = LIMB[eff], hd = spec.hand?.[eff];
    const fb = spec.follow?.[eff], fq = new THREE.Quaternion();
    if (fb) {                                                     // delta of that bone since rest, in man-local terms
      fq.copy(rootQ).invert().multiply(Bn[fb].getWorldQuaternion(qp)).multiply(qa.copy(calib.rest[fb]).invert());
      Bn[fb].getWorldPosition(pw); man.root.worldToLocal(pw);
      tw.set(...xyz).applyQuaternion(fq).add(pw);
    } else if (typeof xyz === 'function') tw.set(...xyz(n => { Bn[n].getWorldPosition(pw); return man.root.worldToLocal(pw).toArray(); }));   // contact on his own body (knee, elbow, chin)
    else { tw.set(...xyz); if (!spec.lie) tw.y -= spec.y || 0; }  // standing / seated targets are heights off the floor
    let F, N;
    if (hd) {                                                     // palm contact -> wrist
      F = new THREE.Vector3(...hd[0]).normalize(); N = new THREE.Vector3(...hd[1]).normalize();
      if (fb) { F.applyQuaternion(fq); N.applyQuaternion(fq); }
      tw.addScaledVector(N, -PALM_T).addScaledVector(F, -PALM_C);
      F.applyQuaternion(rootQ); N.applyQuaternion(rootQ);
    }
    man.root.localToWorld(tw);
    Bn[u].getWorldPosition(pw); man.root.worldToLocal(pw);
    pw.add(new THREE.Vector3(...(spec.pole?.[eff] || POLE[eff]))); man.root.localToWorld(pw);
    ik2(Bn[u], Bn[m], Bn[eff], tw, pw);
    if (hd) orientHand(Bn[eff], calib[eff], F, N);
  }
  return spec;
}

const S = Math.sin, ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const add = (a, b) => a.map((v, i) => v + b[i]);

// seated legs: thighs forward, feet planted on the floor in front (foot bone sits 0.115 above the sole)
const sitLegs = (fz = 0.45, fy = 0.115, spread = 0.13) => ({ footL: [spread, fy, fz], footR: [-spread, fy, fz] });
const SIT_FK = { thighL: [1.45, 0, 0.05], thighR: [1.45, 0, -0.05] };
// palm on top of the thigh just behind the knee, fingers over the kneecap
const onKnee = (side, sx) => B => add(B('shin' + side), [sx, 0.108, -0.07]);
const KNEE_HAND = [[0, -0.3, 1], [0, -1, 0]];
// palm-down typing hand: fingers forward and a little down, so the fingertips (not the palm) meet the keys
const TYPE = s => [[-0.15 * s, -0.35, 1], [0, -1, 0]];
const KEYS = s => [[-0.1 * s, -0.1, 1], [0, -1, 0]];     // keyboard: palm near level, the wrist not perched above it

// palm contact = a point the palm surface touches (see applyAct); thighs are 0.075 thick, the torso front is z 0.11,
// the head is 0.24 wide at the chin (y 1.48) and 0.34 at the cheeks
export const ACTS = {
  // desk chair: seat top 0.485, keyboard top 0.745 spanning z 0.30-0.46 in front of him
  desk: (u, t) => {
    const tap = s => Math.max(0, S(t * 13 + s)) ** 3 * 0.012;
    return {
      y: -0.34, face: 'calm',
      fk: { ...SIT_FK, spine: [0.12, 0, 0], chest: [0.04, 0, 0], neck: [0.06, 0, 0], head: [0.1, S(t * 0.6) * 0.06, 0] },
      ik: {
        ...sitLegs(0.42),
        handL: [0.11 + S(t * 2.1) * 0.02, 0.778 + tap(0), 0.37 + S(t * 1.3) * 0.01],
        handR: [-0.11 + S(t * 1.7 + 1) * 0.025, 0.778 + tap(2.1), 0.37 + S(t * 1.1) * 0.01],
      },
      hand: { handL: TYPE(1), handR: TYPE(-1) },
      pole: { handL: [0.4, -0.5, -0.2], handR: [-0.4, -0.5, -0.2] },
    };
  },
  // bar stool (seat top 0.69): balls of the feet on the ring (top 0.292), hands on the knees
  stool: (u, t) => ({
    y: -0.12, face: 'calm',
    fk: { thighL: [1.3, 0, 0.08], thighR: [1.3, 0, -0.08], spine: [0.04 + S(t * 1.6) * 0.01, 0, 0], head: [0, S(t * 0.4) * 0.15, 0] },
    ik: { ...sitLegs(0.1, 0.445, 0.11), handL: onKnee('L', 0.005), handR: onKnee('R', -0.005) },
    hand: { handL: KNEE_HAND, handR: KNEE_HAND },
    pole: { handL: [0.5, -0.3, -0.3], handR: [-0.5, -0.3, -0.3] },
  }),
  // bed: on his back (man-local +z is up), head on the pillow, hands stacked on the belly, breathing
  bed: (u, t) => ({
    // back on the mattress (top 0.5), upper back propped a touch so the head rests ON the pillow (top 0.62), not in it
    y: 0.63, lie: true, face: 'sleep',
    fk: { spine: [0.12, 0, 0], chest: [0.07 + S(t * 1.1) * 0.02, 0, 0], neck: [0.5, 0, 0], head: [0.4, 0.25, 0], footL: [-0.6, 0.3, 0], footR: [-0.6, -0.3, 0], thighL: [0, 0, 0.04], thighR: [0, 0, -0.04] },
    ik: { handL: [0.05, 0.99, 0.124 + S(t * 1.1) * 0.004], handR: [-0.04, 1.1, 0.124 + S(t * 1.1) * 0.004] },
    hand: { handL: [[-1, 0.1, 0], [0, 0, -1]], handR: [[1, -0.1, 0], [0, 0, -1]] },
    pole: { handL: [0.6, 0, -0.4], handR: [-0.6, 0, -0.4] },
  }),
  // window: right palm on his cheek (fingers up to the temple, follows the head), left hand cupping under the right
  // forearm near the elbow, looking up at the sky
  think: (u, t) => ({
    face: 'curious',
    fk: { hips: [0, 0, 0.03], spine: [-0.02, 0, 0], neck: [-0.05, 0, 0], head: [-0.08, 0.15 + S(t * 0.3) * 0.06, 0.1] },
    ik: { handR: [-0.16, 0.05, 0.06], handL: B => add(lerp3(B('forearmR'), B('handR'), 0.1), [0, -0.05, 0.03]) },
    follow: { handR: 'head' },
    hand: { handR: [[0.05, 0.85, -0.5], [1, 0, 0.1]], handL: [[-1, 0, -0.5], [0, 1, 0]] },
    grip: { handR: 'cup', handL: 'cup' },
    pole: { handR: [0.05, -0.6, 0.8], handL: [0.5, -0.6, 0.2] },
  }),
  // standing at the keyboard: keys top 1.032 spanning z 0.35-0.53; chords move up and down
  keys: (u, t) => {
    const ch = Math.floor(t * 1.6), pos = [0, 0.06, -0.04, 0.1][ch % 4], hit = s => Math.max(0, S(t * 10 + s)) ** 4 * 0.01;
    return {
      face: 'delighted',
      fk: { spine: [0.1, 0, 0], chest: [0.04, 0, 0], neck: [0.1, 0, 0], head: [0.18, S(t * 0.8) * 0.1, S(t * 1.6) * 0.04] },
      ik: { handL: [0.15 + pos, 1.078 - hit(0), 0.43], handR: [-0.15 + pos * 0.5, 1.078 - hit(1.8), 0.43] },
      hand: { handL: KEYS(1), handR: KEYS(-1) },      // ref: pianist from above, palms level, fingers arched onto the keys
      pole: { handL: [0.45, -0.4, -0.3], handR: [-0.45, -0.4, -0.3] },
    };
  },
  // guitar on: strumming hand hangs over the top of the lower bout in front of the strings, fretting hand
  // behind the neck (fingers up past it, never through it)
  guitar: (u, t) => {
    const s = 0.64 + Math.floor(t * 0.8) % 3 * 0.06, strum = S(t * 9) * 0.03;
    return {
      face: 'delighted',
      fk: { neck: [0.12, 0, 0], head: [0.22, 0.35, 0.05], hips: [0, S(t * 2) * 0.03, 0] },
      ik: { handR: guitarAt(-0.05 + strum * 0.4, 0.12 + strum, 0.086), handL: guitarAt(0.02, s, -0.022) },
      hand: { handR: [[0.45, -0.85, 0.05], [0, 0, -1]], handL: [GUP, [0, 0, 1]] },
      grip: { handR: 'relax', handL: 'relax' },
      pole: { handR: [-0.9, 0.3, 0.2], handL: [0.15, -0.7, 0.1] },          // strumming forearm over the bout's edge
    };
  },
  // reading (ref: standing reader in a library aisle): book open at the waist, a forearm's length out, tipped so the
  // pages face up at his eyes; each hand cradles the lower outer corner from behind (palm on the back cover, fingers
  // toward the spine), elbows hanging by his sides, head bowed well down. Reach a spine first, turn round, flip pages.
  read: (u0, t) => {
    const u = u0 * 0.6;                                     // slower: reach ~1.2 s, turn round by ~2.5 s
    const k = ease((u - 0.15) / 0.6), back = ease((u - 0.9) / 0.5), turn = ease((u - 0.9) / 0.7);
    const reach = [-0.17, 1.52, 0.4], reachH = [[0, 1, 0.1], [0, 0, 1]];     // palm on a spine at the shelf front
    const rest = { handL: [0.22, 0.86, 0.02], handR: [-0.22, 0.86, 0.02] }, restH = { handL: [[0, -1, 0], [-1, 0, 0]], handR: [[0, -1, 0], [1, 0, 0]] };
    const hold = { handL: bookAt(1, 0.085, -0.05, 0.007), handR: bookAt(-1, 0.085, -0.05, 0.007) };   // behind the covers
    const page = Math.max(0, S((u - 2) * 1.2)) ** 6;                          // right hand flips a page now and then
    const flip = bookAt(-1, 0.07, 0.02, -0.009);
    const handR = u < 0.9 ? lerp3(rest.handR, reach, k) : lerp3(reach, lerp3(hold.handR, flip, page), back);
    const handL = lerp3(rest.handL, hold.handL, back);
    const hR = u < 0.9 ? mixH(restH.handR, reachH, k) : mixH(reachH, mixH(BOOK_H(-1), BOOK_P(-1), page), back);
    const hL = mixH(restH.handL, BOOK_H(1), back);
    return {
      face: 'calm', turn: Math.PI * turn,
      fk: { spine: [0.06 * back, 0, 0], neck: [0.28 * back, 0, 0], head: [0.42 * back, S(t * 0.5) * 0.03 * back, 0] },
      ik: { handR, handL }, hand: { handR: hR, handL: hL }, book: u < 0.9 ? (k > 0.95 ? 'hand' : 'shelf') : 'open',
      grip: { handL: back > 0.5 ? 'flat' : 'relax', handR: back > 0.5 && page < 0.5 ? 'flat' : 'relax' },
      pole: { handL: [0.25, -0.8, -0.25], handR: [-0.25, -0.8, -0.25] },
    };
  },
  // TV: remote gripped in the right hand (thumb up), pointed at the set; button presses bob the wrist
  tv: (u, t, spot) => {
    const press = Math.max(0, 1 - (performance.now() - (spot.pressed || 0)) / 180);
    const up = ease(u / 0.6);
    return {
      // lounging in the bean bag (seat dent 0.35): leant back, knees up, left hand on the knee, remote raised at the set
      y: -0.5, face: 'curious',
      fk: { thighL: [1.25, 0, 0.12], thighR: [1.25, 0, -0.12], spine: [-0.22, 0, 0], chest: [-0.06, 0, 0], neck: [0.14, 0, 0], head: [0.12, S(t * 0.3) * 0.05, 0] },
      ik: { ...sitLegs(0.5, 0.13, 0.16), handL: onKnee('L', 0.01), handR: lerp3([-0.2, 0.5, 0.12], [-0.08, 0.72 - press * 0.02, 0.42], up) },
      hand: { handL: KNEE_HAND, handR: mixH([[0, -1, 0], [1, 0, 0]], [[0, 0.1, 1], [1, 0, 0]], up) },
      pole: { handL: [0.5, -0.2, -0.4], handR: [-0.35, -0.7, -0.1] },
    };
  },
  // pinboard (face 0.44 in front): right palm flat on the board, tracing the timeline
  pin: (u, t) => ({
    face: 'curious',
    fk: { neck: [-0.05, 0, 0], head: [-0.06, S(t * 0.5) * 0.12, 0] },
    ik: { handR: [-0.04 + S(t * 0.4) * 0.06, 1.42 + S(t * 0.7) * 0.03, 0.418] },
    hand: { handR: [[0, 1, 0], [0, 0, 1]] },
    pole: { handR: [-0.45, -0.5, -0.1] },
  }),
  // gallery bench (top 0.42): hands on the knees, looking at the wall
  bench: (u, t) => ({
    y: -0.43, face: 'calm',
    fk: { ...SIT_FK, spine: [-0.04 + S(t * 1.6) * 0.01, 0, 0], neck: [-0.04, 0, 0], head: [-0.06, S(t * 0.25) * 0.25, 0] },
    ik: { ...sitLegs(0.46, 0.123), handL: onKnee('L', 0.005), handR: onKnee('R', -0.005) },
    hand: { handL: KNEE_HAND, handR: KNEE_HAND },
    pole: { handL: [0.5, -0.2, -0.4], handR: [-0.5, -0.2, -0.4] },
  }),
  // wardrobe (rail 0.68 ahead at 1.7, tees hanging to 1.0): runs a hand along the hangers, then turns round to show the
  // look (arms out, ta-da); every change of clothes (spot.twirlAt, performance.now ms) spins him once on the spot
  wardrobe: (u, t, spot) => {
    const browse = 1 - ease((u - 1.4) / 0.8), now = performance.now();
    const spin = spot.twirlAt ? ease((now - spot.twirlAt) / 850) : 1;
    const slide = S(t * 1.3) * 0.12;
    const bob = S(t * 2.2) * 0.015, hipsL = [0.235, 0.93 + bob, 0.0], hipsR = [-0.235, 0.93 - bob, 0.0];   // ta-da: hands on the hips (the tee's side is ~0.15 out), elbows wide
    const restL = [0.22, 0.86, 0.02];
    const reach = [-0.05 + slide, 1.36, 0.44];
    const hipH = s => [[s * 0.1, -1, 0.35], [-s, 0, 0]];                    // fingers down and forward round the hip, palm in
    const pose = 1 - browse;
    return {
      face: 'delighted', turn: Math.PI * pose + (spin < 1 ? Math.PI * 2 * spin : 0),
      fk: { spine: [0.02 * browse, 0, 0], neck: [-0.08 * browse, 0, 0], head: [-0.1 * browse + 0.04 * pose, (S(t * 0.7) * 0.15) * browse + S(t * 0.5) * 0.08 * pose, 0.06 * pose], hips: [0, 0, 0.04 * pose] },
      ik: { handR: lerp3(reach, hipsR, ease(pose * 1.4 - 0.2)), handL: lerp3(restL, hipsL, ease(pose * 1.4 - 0.2)) },
      hand: { handR: mixH([[0.1, 0.4, 1], [1, 0, 0]], hipH(-1), ease(pose * 1.4 - 0.2)), handL: mixH([[0, -1, 0], [-1, 0, 0]], hipH(1), ease(pose * 1.4 - 0.2)) },
      grip: { handR: 'relax', handL: 'relax' },
      pole: { handR: lerp3([-0.4, -0.6, -0.2], [-0.9, -0.05, -0.6], pose), handL: lerp3([0.35, -0.6, -0.35], [0.9, -0.05, -0.6], pose) },
    };
  },
  // pushing a gallery door: the door (doors.js) knows where its plate is as it swings, so it builds the pose
  door: (u, t, sp) => sp.pose(sp, u),

  // bathroom basin (rim 0.86, bowl centre 0.47 ahead): bends over, scoops water and splashes his face, eyes shut, three
  // times; then straightens up, hands on the rim, and has a look at himself in the mirror
  wash: (u, t) => {
    const end = WASH.start + WASH.n * WASH.P, washing = u < end;
    const c = washing ? Math.max(0, u - WASH.start) % WASH.P / WASH.P : 0;
    const k = c < 0.3 ? 0 : c < 0.5 ? ease((c - 0.3) / 0.2) : c < 0.78 ? 1 : 1 - ease((c - 0.78) / 0.22);   // 0 cupped in the bowl .. 1 at his face
    const bend = ease(u / 0.6) * (1 - ease((u - end) / 0.8)), up = 1 - bend, rub = S(t * 9) * 0.01 * k;
    const hand = s => B => lerp3(lerp3([s * 0.06, 0.87, 0.47], add(B('head'), [s * 0.05, WASH.y + rub, WASH.face]), k), [s * 0.24, 0.875, 0.36], up);
    const dir = s => mixH(mixH([[-s * 0.15, 0.1, 1], [0, 1, 0]], [[-s * 0.15, 1, 0.1], [-s * 0.25, 0, -1]], k), [[0, 0, 1], [0, -1, 0]], up);
    return {
      face: washing ? (k > 0.5 ? 'sleep' : 'calm') : u < end + 2.5 ? 'curious' : 'delighted', tap: washing,
      fk: { spine: [0.42 * bend, 0, 0], chest: [0.1 * bend, 0, 0], neck: [0.12 * bend - 0.06 * up, 0, 0], head: [(0.12 + 0.12 * k) * bend - 0.06 * up, S(t * 0.6) * 0.12 * up, S(t * 0.4) * 0.06 * up] },
      ik: { handL: hand(1), handR: hand(-1) }, hand: { handL: dir(1), handR: dir(-1) },
      grip: { handL: k > 0.3 && bend > 0.5 ? 'cup' : 'flat', handR: k > 0.3 && bend > 0.5 ? 'cup' : 'flat' },
      pole: { handL: [0.45, -0.5, -0.15], handR: [-0.45, -0.5, -0.15] },
    };
  },
  // the loo, standing (the camera keeps behind him): hands in front, head tipped back, looking about, whistling
  loo: (u, t) => ({
    face: 'calm',
    fk: { neck: [-0.08, 0, 0], head: [-0.2 + S(t * 0.6) * 0.04, S(t * 0.45) * 0.35, S(t * 0.3) * 0.05], hips: [0, S(t * 0.9) * 0.02, 0] },
    ik: { handL: [0.07, 0.97, 0.2], handR: [-0.07, 0.97, 0.2] },
    hand: { handL: [[-0.5, -0.6, 0.6], [-0.4, 0, -1]], handR: [[0.5, -0.6, 0.6], [0.4, 0, -1]] },
    pole: { handL: [0.4, -0.6, -0.3], handR: [-0.4, -0.6, -0.3] },
  }),
  // shower, behind the curtain (only his feet show under it): face up into the water, scrubbing his hair, swaying
  shower: (u, t) => {
    const k = ease((u - 0.8) / 0.8), sc = S(t * 7) * 0.02;
    const hand = s => B => lerp3([s * 0.25, 0.86, 0.03], add(B('head'), [s * (SHOWER.hx + Math.abs(sc)), SHOWER.hy + sc * s, SHOWER.hz]), k);
    const dir = s => mixH([[0, -1, 0], [-s, 0, 0]], [[0, 1, 0.15], [-s, -0.15, 0]], k);
    return {
      face: 'delighted',
      fk: { spine: [-0.04 * k, 0, 0], neck: [-0.12 * k, 0, 0], head: [-0.22 * k, S(t * 0.8) * 0.15, S(t * 1.6) * 0.05], hips: [0, S(t * 1.8) * 0.06, 0] },
      ik: { handL: hand(1), handR: hand(-1) }, hand: { handL: dir(1), handR: dir(-1) },
      grip: { handL: 'cup', handR: 'cup' },
      pole: { handL: [0.6, 0.1, -0.2], handR: [-0.6, 0.1, -0.2] },
    };
  },
  // kitchen: leans on the counter while the kettle boils, pours a mug, puts the kettle back, then stands there sipping
  tea: (u, t) => {
    const P = teaProps(u), rest = s => [s * 0.25, 0.905, 0.43], restH = [[0, 0, 1], [0, -1, 0]];
    const toK = ease((u - TEA.boil) / 0.8), toM = ease((u - 7.0) / 0.4);
    const handR = u < 7 ? lerp3(rest(-1), P.grip, toK) : lerp3(P.grip, P.palm, toM);
    const hR = u < 7 ? mixH(restH, [[0, 0, 1], [0, -1, 0]], toK) : mixH([[0, 0, 1], [0, -1, 0]], [[0, 0.15, 1], [1, 0, 0]], toM);
    const lean = 1 - ease((u - 7.2) / 0.8);
    return {
      face: u < TEA.boil ? 'curious' : u > 8 ? (P.sip > 0.5 ? 'sleep' : 'delighted') : 'calm', pour: P.pouring,
      fk: { spine: [0.08 * lean, 0, 0], neck: [0.1 * lean + 0.12 * P.sip, 0, 0], head: [0.15 * lean - 0.1 * P.sip, (u < TEA.boil ? 0.2 : S(t * 0.5) * 0.08) * lean, 0] },
      ik: { handL: lerp3(rest(1), [0.2, 0.95, 0.22], 1 - lean), handR },
      hand: { handL: mixH(restH, [[0, -1, 0.3], [-1, 0, 0]], 1 - lean), handR: hR },
      grip: { handL: lean > 0.5 ? 'flat' : 'relax', handR: u > TEA.boil + 0.6 ? 'hold' : 'flat' },
      pole: { handL: [0.45, -0.5, -0.2], handR: [-0.45, -0.5, -0.2] },
    };
  },
  // fridge (French doors): pulls both handles, the doors swing wide, he leans in for a juice and stands holding it
  fridge: (u, t) => {
    const a = fridgeDoor(u), hold = 1 - ease((u - 0.9) / 0.3);        // lets go before they swing on: they'd carry the handles into his chest
    const grab = ease((u - 1.9) / 0.7), out = ease((u - 2.9) / 0.7), reach = grab * (1 - out);   // reaches in once the doors are wide
    const H = s => fridgeHandle(s, Math.min(a, 0.55));
    const P = fridgeProps(u);
    const handR = lerp3(lerp3(lerp3([-0.22, 0.86, 0.02], H(-1), ease(u / 0.35)), [-0.22, 0.86, 0.02], 1 - hold), P.palm, grab);
    const handL = lerp3(lerp3([0.22, 0.86, 0.02], H(1), ease(u / 0.35)), [0.22, 0.86, 0.02], 1 - hold);
    const grabH = [[0, 0.2, 1], [1, 0, 0]], handleH = s => [[0, 1, 0], [-s, 0, 0]], restH = s => [[0, -1, 0], [-s, 0, 0]];
    return {
      face: u < 2.9 ? 'curious' : 'delighted',
      fk: { spine: [0.28 * reach, 0, 0], neck: [0.1 * reach, 0, 0], head: [0.15 * reach + 0.1 * out, S(t * 0.6) * 0.1 * out, 0] },
      ik: { handL, handR },
      hand: { handL: mixH(mixH(restH(1), handleH(1), ease(u / 0.35)), restH(1), 1 - hold), handR: mixH(mixH(mixH(restH(-1), handleH(-1), ease(u / 0.35)), restH(-1), 1 - hold), grabH, grab) },
      grip: { handL: hold > 0.5 && u > 0.2 ? 'hold' : 'relax', handR: (hold > 0.5 && u > 0.2) || u > 2.5 ? 'hold' : 'relax' },
      pole: { handL: [0.45, -0.5, -0.3], handR: [-0.45, -0.5, -0.3] },
    };
  },
};
function mixH(a, b, k) { return [lerp3(a[0], b[0], k), lerp3(a[1], b[1], k)]; }

// guitar held on the body: lower bout centre, neck toward his left and up 25 deg, face out (+z). Body: lower bout r 0.23,
// 0.074 deep each side; neck 0.07 wide x 0.04 deep from 0.37 to 1.07 along it
export const GUITAR_AT = { pos: [-0.08, 1.02, 0.27], rotZ: -1.13 };
export function guitarAt(x, along, out) {                  // a point on the guitar (body-local: neck = +y, front = +z) in man-local
  const c = Math.cos(GUITAR_AT.rotZ), s = Math.sin(GUITAR_AT.rotZ), [px, py, pz] = GUITAR_AT.pos;
  return [px + x * c - along * s, py + x * s + along * c, pz + out];
}
// fretting fingers: across the neck, pointing up (wrapping over it from behind)
const GUP = [-Math.cos(GUITAR_AT.rotZ), -Math.sin(GUITAR_AT.rotZ), 0];       // neck runs (-sin, cos); this is it turned +90 deg

// the open book (reading.js): waist high (elbows at 90 deg put his hands at ~1.17), top edge tipped away 0.75 rad so
// the pages face up at his eyes, halves opened 0.38 rad toward him.
// side +1 = his left half (front cover), -1 = right half. x/y on the half, out = along the half's outward normal
export const BOOK = { pos: [0, 1.17, 0.31], tilt: 0.75, open: 0.38 };
function bookV(side, v) {                                   // half-local vector -> man-local
  const th = BOOK.open * side, [x, y, z] = v;
  const x1 = x * Math.cos(th) + z * Math.sin(th), z1 = -x * Math.sin(th) + z * Math.cos(th);
  const c = Math.cos(BOOK.tilt), s = Math.sin(BOOK.tilt);
  return [x1, y * c - z1 * s, y * s + z1 * c];
}
function bookAt(side, x, y, out) { return add(BOOK.pos, bookV(side, [side * x, y, out])); }
const BOOK_H = side => [bookV(side, [-side * 0.75, 0.66, 0]), bookV(side, [0, 0, -1])];   // fingers in toward the spine, palm on the back cover
const BOOK_P = side => [bookV(side, [0, 1, 0]), bookV(side, [0, 0, 1])];     // palm onto the page from his side

// ---- annex props, in the spot's frame (man-local: he faces +z, his left is +x). annex.js places the meshes from the
// same numbers, so hands and things meet
export const WASH = { start: 0.5, n: 3, P: 2.4, face: 0.33, y: 0.1 };   // palms on his face: head bone + (y, face) with his head bowed over the basin       // splashes; palms this far in front of the head bone
export const SHOWER = { hx: 0.2, hy: 0.17, hz: -0.03 };   // palms on the sides of his head (r ~0.17 round its centre, ~0.17 over the head bone)                          // hands on the hair: out to the side, up from the head bone
// counter front edge z 0.35, top 0.9; kettle base on the hob (top 0.92), handle top G above it; mug (r 0.045, 0.1 tall)
export const TEA = { boil: 3, K: [-0.12, 0.92, 0.5], G: 0.21, M: [0.12, 0.9, 0.42], spout: [0.14, 0.12] };
export function teaProps(u) {
  const { K, G, M, spout } = TEA;
  const lift = ease((u - 3.8) / 0.6) * (1 - ease((u - 6.4) / 0.6)), tilt = 0.8 * ease((u - 4.5) / 0.5) * (1 - ease((u - 5.9) / 0.5));
  const over = [M[0] - 0.03, 1.21, M[2]];                            // tilted 0.8 rad, the spout tip is right over the mug
  const grip = lerp3([K[0], K[1] + G, K[2]], over, lift);
  const base = [grip[0] - G * Math.sin(tilt), grip[1] - G * Math.cos(tilt), grip[2]];
  const tip = [base[0] + spout[0] * Math.cos(tilt) + spout[1] * Math.sin(tilt), base[1] - spout[0] * Math.sin(tilt) + spout[1] * Math.cos(tilt), base[2]];
  const take = ease((u - 7.4) / 0.6), sip = u > 8.6 ? Math.max(0, S((u - 8.6) * 1.3)) ** 4 : 0;
  const onTable = [M[0], M[1] + 0.05, M[2]];
  const mug = lerp3(onTable, lerp3([0, 1.17, 0.3], [0, 1.36, 0.22], sip), take);
  return { grip, tilt, base, tip, mug, palm: add(mug, [-0.05, 0, 0]), sip, pouring: tilt > 0.5, full: u > 5.4 };
}
// fridge: front face 0.42 ahead, 0.7 wide, French doors hinged at x +-0.35 (leaf centre plane z 0.395)
export const FRIDGE = { front: 0.46, w: 0.7, h: 1.6, depth: 0.62, bottle: [-0.1, 1.02, 0.62] };
// he pulls the doors a little way (hands on the handles), lets go, and they swing on wide once his hands are clear
export const fridgeDoor = u => 0.55 * ease((u - 0.35) / 0.5) + 1.1 * ease((u - 1.25) / 0.7);
export function fridgeHandle(s, a) {                               // s +1 his left door, -1 his right; a = open angle
  const d = [-s * Math.cos(a), -Math.sin(a)], n = [-s * d[1], s * d[0]];
  const z0 = FRIDGE.front - 0.025;                                  // the doors' hinge line
  return [s * 0.35 + 0.3 * d[0] + 0.058 * n[0], 1.0, z0 + 0.3 * d[1] + 0.058 * n[1]];
}
export function fridgeProps(u) {
  const out = ease((u - 2.9) / 0.7), c = lerp3(FRIDGE.bottle, [-0.08, 1.15 + S(u * 1.1) * 0.01 * out, 0.3], out);
  return { a: fridgeDoor(u), bottle: c, palm: add(c, [-0.04, 0, 0]), held: u > 2.6 };
}
