// Her: the second character. Same toon puppet (man.glb: rig, acts and ink are shared), dressed as herself: dark wavy shoulder-length
// hair with a centre parting, big tortoiseshell glasses, a pale pink tee, a red beaded bracelet. Her face is HIS face textures
// recoloured to her skin, with her frames and lashes drawn on, so every expression he has she has too.
import * as THREE from 'three';
import { mesh } from './look.js';
import { loadMan, FACES } from './man.js';

export const HER = { skin: '#F9CDBA', skinShade: '#C98AA6', ink: '#1A1438', top: '#F0D3DA', topShade: '#A87FA2', pants: '#4D66CF', pantsShade: '#26358F', frame: '#4A2616', speck: '#C0722C', lip: '#CF6A77', lipDark: '#6E2436', hair: '#33205F', hairShade: '#120C2C', hi: '#5A3CD0', bead: '#E8263F' };
const HIS_SKIN = [247, 163, 159];
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// ---- face: his texture -> her skin, + glasses and lashes (texture px: the eyes sit at the same spots in every expression)
const EYE = [[352, 462], [683, 451]];
const MOUTH = { joyful: [1, 0.5], delighted: [1, 0.7], amusement: [0.9, 0.3], content: [0.5, 0], proud: [0.6, 0], triumph: [1, 0.4], relieved: [0.4, 0], calm: [0.15, 0], curious: [0.1, 0], absorbed: [-0.05, 0], aesthetic_appreciation: [0.4, 0],
  awe: [0.1, 0.6], nostalgia: [0.25, 0], sleep: [0.1, 0], drowsy: [0, 0], dazed: [0, 0.2], bored: [-0.2, 0], restless: [-0.1, 0], embarrassed: [0.3, 0], sad: [-0.7, 0], lonely: [-0.6, 0], anxious: [-0.4, 0.1], uneasy: [-0.35, 0], frustrated: [-0.6, 0], given_up: [-0.5, 0], alarm: [0, 0.8] };   // [smile (-1 frown .. 1 grin), open]
const faceCache = {};
export function herFaceTex(name = 'neutral') {
  if (faceCache[name]) return faceCache[name];
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false;
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, 1024, 1024), a = d.data, to = rgb(HER.skin);
    const n = g.getImageData(550, 584, 1, 1).data, nose = [n[0], n[1], n[2]];       // his nose tone, sampled
    const nk = nose.map((v, i) => v / HIS_SKIN[i]), dist = (r, g2, b, c) => Math.abs(r - c[0]) + Math.abs(g2 - c[1]) + Math.abs(b - c[2]);
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i], gg = a[i + 1], b = a[i + 2], py = (i >> 2) >> 10;
      if (py > 600 && py < 790 && r > 200 && gg > 170 && b < 175) { a[i] = to[0]; a[i + 1] = to[1]; a[i + 2] = to[2]; continue; }      // the top of his spiral mouth
      if (dist(r, gg, b, HIS_SKIN) < 24) { a[i] = to[0]; a[i + 1] = to[1]; a[i + 2] = to[2]; }
      else if (dist(r, gg, b, nose) < 30) { a[i] = to[0] * nk[0]; a[i + 1] = to[1] * nk[1]; a[i + 2] = to[2] * nk[2]; }
    }
    g.putImageData(d, 0, 0);
    // her mouth: the spiral is wiped and a normal mouth drawn in its place, shaped by the expression
    const m = MOUTH[name] || [0, 0], [cv_, op] = m, MX = 500, MY = 772;
    g.fillStyle = HER.skin; g.fillRect(330, 678, 165, 340); g.fillRect(600, 678, 130, 340); g.fillRect(495, 708, 105, 310);
    const w = 70 + 12 * Math.max(0, cv_) + 14 * op, cy = MY - 26 * cv_, my = MY + 44 * cv_ + 8, open = op * 62;
    g.lineJoin = g.lineCap = 'round';
    g.beginPath(); g.moveTo(MX - w, cy); g.quadraticCurveTo(MX, my, MX + w, cy);
    g.quadraticCurveTo(MX, my + 26 + open * 1.3 + 10 * Math.max(0, cv_), MX - w, cy); g.closePath();
    g.fillStyle = open > 8 ? HER.lipDark : HER.lip; g.fill(); g.strokeStyle = HER.lipDark; g.lineWidth = 12; g.stroke();
    if (open > 8) { g.fillStyle = '#FBF3E6'; g.beginPath(); g.moveTo(MX - w * 0.7, cy + 8); g.quadraticCurveTo(MX, my + 4, MX + w * 0.7, cy + 8); g.lineTo(MX + w * 0.6, cy + 24 + open * 0.3); g.quadraticCurveTo(MX, my + 18 + open * 0.3, MX - w * 0.6, cy + 24 + open * 0.3); g.closePath(); g.fill(); }
    // her glasses: big tortoiseshell rounded frames
    const frame = (x, y) => { g.beginPath(); for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), e = 2.6, px = x + Math.sign(c) * Math.abs(c) ** (2 / e) * 148, py = y + 6 + Math.sign(sn) * Math.abs(sn) ** (2 / e) * 116; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); };
    g.lineJoin = 'round'; g.fillStyle = 'rgba(255,255,255,0.10)';
    for (const [x, y] of EYE) { frame(x, y); g.fill(); g.strokeStyle = HER.frame; g.lineWidth = 24; g.stroke(); g.strokeStyle = HER.speck; g.lineWidth = 9; g.setLineDash([34, 30]); g.stroke(); g.setLineDash([]); }
    g.strokeStyle = HER.frame; g.lineWidth = 14; g.beginPath(); g.moveTo(EYE[0][0] + 146, EYE[0][1] - 20); g.quadraticCurveTo((EYE[0][0] + EYE[1][0]) / 2, EYE[0][1] - 52, EYE[1][0] - 146, EYE[1][1] - 20); g.stroke();
    g.strokeStyle = HER.ink; g.lineWidth = 11; for (const [x, y, sg] of [[EYE[0][0], EYE[0][1], -1], [EYE[1][0], EYE[1][1], 1]]) {     // lashes at the outer corner
      for (const k of [0, 1, 2]) { g.beginPath(); g.moveTo(x + sg * (84 + k * 6), y - 18 + k * 16); g.lineTo(x + sg * (122 + k * 4), y - 40 + k * 20); g.stroke(); }
    }
    t.needsUpdate = true; t.userData.ready = true;
  };
  img.src = `/media/man/face-${name}.webp`;
  return (faceCache[name] = t);
}

// ---- hair, in head-bone space (+y up, +z front, chin line at y = 0, skull centre ~(0, 0.2, 0))
const HAIR = { C: [0, 0.2, -0.012], RX: 0.19, RY: 0.2, RZ: 0.2 };
function hairGeo() {
  const { C, RX, RY, RZ } = HAIR, rad = d => d * Math.PI / 180;
  const pos = [], idx = [], grid = (rows, cols, at) => { const o = pos.length / 3; for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) pos.push(...at(r / rows, c / cols)); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = o + r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1; idx.push(a, d, b, b, d, e); } };
  // cap: over the top and down the back and sides, with the hairline high on the forehead (62 deg from the crown at the front, 100 at the sides)
  const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  grid(10, 56, (v, u) => {
    const az = u * Math.PI * 2, f = Math.abs(Math.atan2(Math.sin(az), Math.cos(az))), th = rad(62 - 9 * Math.exp(-((f / 0.14) ** 2)) + 40 * smooth((f - 0.35) / 0.9)) * v;
    return [C[0] + Math.sin(th) * Math.sin(az) * RX * 1.03, C[1] + Math.cos(th) * RY * 1.04, C[2] + Math.sin(th) * Math.cos(az) * RZ * 1.04];
  });
  // curtain: wavy locks from the cap's edge down to the shoulders, open at the front
  const A0 = 1.2, A1 = Math.PI * 2 - 1.2, Y = [0.165, 0.13, 0.09, 0.05, 0.01, -0.025, -0.06];
  grid(Y.length - 1, 44, (v, u) => {
    const k = Math.round(v * (Y.length - 1)), az = A0 + (A1 - A0) * u, a2 = az + (az < Math.PI ? -1 : 1) * k * 0.012;
    const w = 1 + (k < 1 ? 0 : 0.028 + k * 0.004) * Math.sin(az * 5.5 + k * 0.7), grow = 1.03 + k * 0.008 + (k >= 5 ? 0.05 * (k - 4) : 0);       // the ends flick out like hers
    const hem = k >= 5 ? -0.02 * Math.abs(Math.sin(az * 4.5 + k)) - 0.008 * Math.sin(az * 9) : 0;      // locks of different lengths
    return [C[0] + Math.sin(a2) * RX * grow * w, Y[k] + hem, C[2] + Math.cos(a2) * RZ * grow * w];
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function makeHerHair() {
  const grp = new THREE.Group(); grp.name = 'hair';
  const m = mesh(hairGeo(), HER.hair, { shade: 0.6, shadeCol: HER.hairShade, ink: 0.012 }); m.material.side = THREE.DoubleSide; grp.add(m);
  // a few violet highlight strokes lying on the shell, like his blue ones: from the crown down the locks
  const { C, RX, RY, RZ } = HAIR;
  for (const [az0, th0, len] of [[0.9, 0.5, 1.7], [2.2, 0.35, 1.9], [3.2, 0.2, 2.0], [4.1, 0.35, 1.9], [5.4, 0.5, 1.7], [3.7, 0.7, 1.4], [2.7, 0.7, 1.4]]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const v = i / 14, th = th0 + v * len * 0.62, az = az0 + Math.sin(v * 5 + az0) * 0.07 + (az0 < Math.PI ? 1 : -1) * v * 0.08, y = C[1] + Math.cos(th) * RY * 1.07 - Math.max(0, th - 1.55) * 0.14;
      const r = Math.sin(Math.min(th, 1.75)) * 1.065;
      pts.push(new THREE.Vector3(C[0] + Math.sin(az) * RX * r, y, C[2] + Math.cos(az) * RZ * r));
    }
    const hi = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.0038, 5), HER.hi, { ink: false, shade: 0.4, shadeCol: '#3B2BB0' });
    hi.material.polygonOffset = true; hi.material.polygonOffsetFactor = -4; hi.material.polygonOffsetUnits = -4; grp.add(hi);
  }
  return grp;
}

function bracelet(man) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, b = mesh(new THREE.SphereGeometry(0.0125, 8, 6), HER.bead, { ink: 0.004 }); b.position.set(Math.cos(a) * 0.042, 0, Math.sin(a) * 0.042); g.add(b); }
  return g;
}

export async function loadHer() {
  return loadMan({
    faceTex: herFaceTex,
    look: {
      skin: [HER.skin, { shadeCol: HER.skinShade, shade: 1, ink: 0.011 }],
      ear: [HER.skin, { shadeCol: HER.skinShade, shade: 1, ink: 0.008 }],
      face: [null, { shadeCol: HER.skinShade, shade: 0.35, ink: 0.013 }],
      tee: [HER.top, { shadeCol: HER.topShade, shade: 0.42, ink: 0.013 }],
      collar: [HER.top, { shadeCol: HER.topShade, shade: 0.5, ink: 0.006 }],
      pants: [HER.pants, { shadeCol: HER.pantsShade, shade: 1, ink: 0.012 }],
      boot: ['#F4F1E6', { shadeCol: '#9C98B8', shade: 0.5, ink: 0.012 }],
      sole: ['#E8263F', { shadeCol: '#A3122E', shade: 1, ink: 0.008 }],
    },
    prep(o) {
      const n = o.material.name;
      if (n === 'hair' || n === 'hair_hi') return false;                      // his hair stays out of her
    },
    dress(man) {
      man.bones.head.scale.set(0.92, 1.07, 0.95);                         // a longer, softer face than his round one; the hair rides on the head bone
      man.bones.head.add(makeHerHair());
      const b = bracelet(man); (man.bones.handL || man.bones.forearmL).add(b); man.bracelet = b;
    },
  });
}
