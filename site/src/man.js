// Option B: the man as a 3D toon puppet built from primitives (r11 colours), seated on the stool.
import * as THREE from 'three';
import { mesh, toon, addInk } from './look.js';
import * as T from './textures.js';

const { PAL } = T;

function cap(r, len, color, opts) { return mesh(new THREE.CapsuleGeometry(r, len, 6, 14), color, opts); }
function limb(a, b, r, color, opts) {                       // capsule from point a to point b
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = cap(r, Math.max(len - 2 * r, 0.001) + r * 0.6, color, opts);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
const v = (x, y, z) => new THREE.Vector3(x, y, z);

export function man3d() {
  const g = new THREE.Group();
  const hipY = 0.74;

  // legs: thighs forward, shins down, chunky boots with red soles
  for (const s of [-1, 1]) {
    const hip = v(s * 0.1, hipY, 0.02), knee = v(s * 0.13, hipY + 0.02, 0.42), ankle = v(s * 0.14, 0.12, 0.46);
    g.add(limb(hip, knee, 0.085, PAL.pants, { ink: 0.012 }));
    g.add(limb(knee, ankle, 0.072, PAL.pants, { ink: 0.012 }));
    const boot = mesh(new THREE.BoxGeometry(0.13, 0.12, 0.26), PAL.boot, { ink: 0.01 });
    boot.position.set(s * 0.14, 0.09, 0.52); g.add(boot);
    const sole = mesh(new THREE.BoxGeometry(0.14, 0.035, 0.27), PAL.red, { ink: 0.008 });
    sole.position.set(s * 0.14, 0.018, 0.52); g.add(sole);
  }

  // torso in the liquid tee, slight forward lean
  const torso = mesh(new THREE.CapsuleGeometry(0.17, 0.3, 6, 18).scale(1, 1, 0.72), null, { map: T.teeTex(), ink: 0.013 });
  torso.position.set(0, hipY + 0.26, 0.02); torso.rotation.x = 0.1;
  g.add(torso);

  // arms: lav sleeves, skin forearms, hands resting on the knees
  for (const s of [-1, 1]) {
    const sh = v(s * 0.2, hipY + 0.44, 0.02), el = v(s * 0.24, hipY + 0.2, 0.18), hand = v(s * 0.15, hipY + 0.1, 0.4);
    g.add(limb(sh, el, 0.06, PAL.lav, { ink: 0.011 }));
    g.add(limb(el, hand, 0.045, PAL.skin, { ink: 0.01 }));
    const h = mesh(new THREE.SphereGeometry(0.055, 12, 10).scale(1, 0.7, 1.2), PAL.skin, { ink: 0.009 });
    h.position.copy(hand); g.add(h);
  }

  // neck + head (face texture front at +z) + hair cap and strands
  g.add(at(cap(0.05, 0.06, PAL.skin, { ink: 0.009 }), 0, hipY + 0.52, 0.04));
  const head = mesh(new THREE.SphereGeometry(0.17, 32, 24).scale(0.95, 1.05, 0.95), null, { map: T.faceTex(), ink: 0.013, shade: 0.25 });
  head.position.set(0, hipY + 0.72, 0.05);
  g.add(head);
  const hair = mesh(new THREE.SphereGeometry(0.182, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), PAL.hair, { ink: 0.012 });
  hair.position.copy(head.position).add(v(0, 0.015, -0.01)); hair.rotation.x = -0.25;
  g.add(hair);
  for (let i = 0; i < 6; i++) {                              // swept strands over the brow
    const a = -0.9 + i * 0.36;
    const st = mesh(new THREE.ConeGeometry(0.035, 0.16, 5), i % 3 ? PAL.hair : PAL.hairHi, { ink: 0.006 });
    st.position.copy(head.position).add(v(Math.sin(a) * 0.15, 0.1, Math.cos(a) * 0.12));
    st.rotation.set(1.9, a, 0.3);
    g.add(st);
  }
  for (const s of [-1, 1]) {                                 // ears
    const e = mesh(new THREE.SphereGeometry(0.04, 10, 8).scale(0.5, 1, 0.8), s < 0 ? PAL.skin : PAL.skinSh, { ink: 0.007 });
    e.position.copy(head.position).add(v(s * 0.165, -0.01, 0)); g.add(e);
  }
  g.userData.head = head;
  return g;
}

function at(o, x, y, z) { o.position.set(x, y, z); return o; }
export { addInk, toon };
