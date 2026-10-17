// The man: Blender-built skinned toon puppet (tools/build_man.py -> media/man/man.glb), dressed in the riso look.
// Colours + shadow colours are man2d's (ek-pinjare-mai lib/man2d.py C / LIQUID); face = man2d features (tools/export_face.py).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toon, addInk } from './look.js';
import * as T from './textures.js';

const LOOK = {                                   // glTF material name -> toon options
  skin: ['#F7A39F', { shadeCol: '#C0568E', shade: 1, ink: 0.011 }],
  face: [null, { shadeCol: '#C0568E', shade: 0.35, ink: 0.013 }],
  ear: ['#F7A39F', { shadeCol: '#C0568E', shade: 1, ink: 0.008 }],
  tee: [null, { shadeCol: '#140B52', shade: 0.42, ink: 0.013, restUV: [1.5, 1.6] }],
  collar: ['#B8B5F0', { shadeCol: '#3B2BB0', shade: 0.5, ink: 0.006 }],
  pants: ['#3A49C9', { shadeCol: '#232A8F', shade: 1, ink: 0.012 }],
  boot: ['#141026', { shadeCol: '#0B0B0B', shade: 0.5, ink: 0.012 }],
  sole: ['#E8263F', { shadeCol: '#A3122E', shade: 1, ink: 0.008 }],
  hair: ['#1A1438', { shadeCol: '#0B0820', shade: 0.6, ink: 0.014, twoSided: true }],
  hair_hi: ['#7FA6FF', { shadeCol: '#3B2BB0', shade: 0.4, ink: false, unlit: true, onTop: true }],
};

const faces = {};
const texLoader = new THREE.TextureLoader();
export function faceTex(name = 'neutral') {
  if (!faces[name]) {
    faces[name] = texLoader.load(`/media/man/face-${name}.webp`, t => { t.userData.ready = true; });
    faces[name].colorSpace = THREE.SRGBColorSpace;
    faces[name].anisotropy = 4;
    faces[name].flipY = false;                   // glTF UV convention
  }
  return faces[name];
}

export const FACES = ['neutral', 'calm', 'curious', 'delighted', 'sleep', 'uneasy'];
export async function loadMan() {
  // every expression up front: a face loaded on first use draws black until it arrives
  const ready = Promise.all(FACES.map(n => new Promise(res => { const t = faceTex(n); if (t.userData.ready) res(); else { const k = setInterval(() => { if (t.userData.ready || t.image?.complete) { clearInterval(k); res(); } }, 30); setTimeout(() => { clearInterval(k); res(); }, 8000); } })));
  const gltf = await new GLTFLoader().loadAsync('/media/man/man.glb');
  const root = gltf.scene;
  const tee = T.teeTex(); tee.wrapS = tee.wrapT = THREE.RepeatWrapping;
  const meshes = [];
  root.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const [color, opts] = LOOK[o.material.name] || ['#ff00ff', {}];
    const map = o.material.name === 'face' ? faceTex() : o.material.name === 'tee' ? tee : null;
    o.userData.look = o.material.name;             // outfits.js finds the tee / pants / boots by this
    o.material = toon(color, { ...opts, map });
    if (opts.onTop) Object.assign(o.material, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    if (opts.twoSided) o.material.side = THREE.DoubleSide;
    o.frustumCulled = false;                       // skinned bounds don't follow the pose
    if (opts.ink !== false) addInk(o, opts.ink);
  }
  await ready;
  const bones = {};
  root.traverse(o => { if (o.isBone) { bones[o.name] = o; o.userData.rest = o.quaternion.clone(); } });
  const head = meshes.find(o => o.material.uniforms.uMap.value === faces.neutral);
  const man = { root, bones, head, pose: p => pose(man, p), face: n => { head.material.uniforms.uMap.value = faceTex(n); } };
  return man;
}

// poses: per-bone euler deltas (radians, bone-local; +x swings a limb forward) applied on top of the rest pose
const e = new THREE.Euler(), q = new THREE.Quaternion();
export const POSES = {
  stand: {},
  seated: {
    _y: -0.17,
    thighL: [1.5, 0, 0], thighR: [1.5, 0, 0], shinL: [-1.45, 0, 0], shinR: [-1.45, 0, 0],
    footL: [-0.1, 0, 0], footR: [-0.1, 0, 0],
    spine: [0.06, 0, 0], chest: [0.06, 0, 0], neck: [-0.05, 0, 0], head: [-0.04, 0, 0],
    upperarmL: [0.25, 0, -0.1], upperarmR: [0.25, 0, 0.1], forearmL: [0.7, 0, 0], forearmR: [0.7, 0, 0],
    handL: [-0.7, 0, 0], handR: [-0.7, 0, 0],
  },
  lying: {                                       // on his back; player.js tips the root onto the mattress
    _y: 0.72,
    thighL: [0.35, 0, 0], shinL: [-0.7, 0, 0], footR: [0.3, 0, 0], footL: [0.15, 0, 0],
    upperarmL: [0, 0, -0.25], upperarmR: [-0.2, 0, 1.9], forearmR: [1.4, 0, 0],
    head: [0, 0.35, 0], neck: [0.15, 0, 0],
  },
};

function pose(man, p) {
  const P = typeof p === 'string' ? POSES[p] : p;
  for (const [name, b] of Object.entries(man.bones)) {
    const d = P[name];
    b.quaternion.copy(b.userData.rest);
    if (d) b.quaternion.multiply(q.setFromEuler(e.set(d[0], d[1], d[2])));
  }
  man.root.position.y = P._y || 0;
}
