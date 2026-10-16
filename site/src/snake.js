// The snake: a side character that roams a loop on the open floor (brief §2). The body is a tube rebuilt on the CPU
// every frame along the loop with a travelling serpentine wave; it stops and rears up to look at the man when he is close.
// Owner sheet: cream body, red arrow on the head, red eyes.
import * as THREE from 'three';
import { mesh, toon, addInk } from './look.js';
import { PAL } from './textures.js';

const N = 44, S = 10, LEN = 1.55, R0 = 0.062;
const LOOP = [[-1.2, -1.4], [0.6, -1.75], [1.9, -0.6], [2.6, 0.6], [2.2, 1.75], [0.9, 1.55], [-0.35, 1.25], [-1.3, 0.9], [-1.4, -0.4]];

export function makeSnake() {
  const path = new THREE.CatmullRomCurve3(LOOP.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const total = path.getLength();

  // seamless tube: S vertices per ring, indices wrap, so smooth normals and the shared ink hull have no crack
  const pos = new Float32Array(N * S * 3), idx = [];
  for (let i = 0; i < N - 1; i++) for (let k = 0; k < S; k++) {
    const a = i * S + k, b = i * S + (k + 1) % S, c = a + S, d = b + S;
    idx.push(a, b, c, b, d, c);
  }
  for (let k = 1; k < S - 1; k++) idx.push((N - 1) * S, (N - 1) * S + k, (N - 1) * S + k + 1);   // tail cap
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  const body = new THREE.Mesh(geo, toon(PAL.cream, { shade: 0.4 }));
  body.frustumCulled = false;
  geo.computeVertexNormals();
  addInk(body, 0.012, { live: true });
  body.children[0].frustumCulled = false;

  const head = new THREE.Group();
  const skull = mesh(new THREE.SphereGeometry(0.1, 16, 12).scale(1, 0.62, 1.35), PAL.cream, { ink: 0.012 });
  head.add(skull);
  const arrow = mesh(new THREE.ConeGeometry(0.04, 0.09, 3).rotateX(Math.PI / 2).scale(1, 0.3, 1), PAL.red, { ink: false });
  arrow.position.set(0, 0.06, 0.02); head.add(arrow);
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.018, 8, 6), PAL.red, { ink: 0.004 }); e.position.set(s * 0.07, 0.03, 0.06); head.add(e); }
  const tongue = mesh(new THREE.BoxGeometry(0.012, 0.004, 0.09), PAL.red, { ink: false });
  tongue.position.set(0, -0.01, 0.17); head.add(tongue);

  const group = new THREE.Group();
  group.add(body, head);

  const st = { s: 0, speed: 0, rear: 0, wiggle: 0 };
  const P = Array.from({ length: N }, () => new THREE.Vector3());
  const T = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3(), tan = new THREE.Vector3(), look = new THREE.Vector3();

  function update(dt, t, manPos) {
    const hp = P[0];
    const near = manPos && hp.lengthSq() ? Math.hypot(manPos.x - hp.x, manPos.z - hp.z) : 9;
    const want = near < 1.1 ? 0 : 0.32;
    st.speed += (want - st.speed) * (1 - Math.exp(-3 * dt));
    st.rear += ((near < 1.1 ? 1 : 0) - st.rear) * (1 - Math.exp(-4 * dt));
    st.wiggle = Math.max(0, st.wiggle - dt);
    st.s = (st.s + st.speed * dt) % total;
    const phase = t * (1.2 + st.speed * 9) + st.wiggle * 18;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);                                   // 0 = head, 1 = tail
      const s = (((st.s - u * LEN) % total) + total) % total;
      path.getPointAt(s / total, P[i]);
      path.getTangentAt(s / total, tan);
      side.crossVectors(tan, Y).normalize();
      const amp = 0.09 * Math.min(1, u * 4) * (0.35 + Math.min(1, st.speed * 4) * 0.65 + Math.min(1, st.wiggle) * 0.6);
      P[i].addScaledVector(side, Math.sin(u * 12.5 - phase) * amp);
      const r = R0 * (u < 0.1 ? 0.8 + u * 2 : 1 - Math.pow((u - 0.1) / 0.9, 1.6) * 0.92);
      P[i].y = r + (u < 0.25 ? Math.pow(1 - u / 0.25, 2) * 0.32 * st.rear : 0) + (u < 0.06 ? 0.03 : 0);
      P[i].w = r;
    }
    for (let i = 0; i < N; i++) {
      T.subVectors(P[Math.max(0, i - 1)], P[Math.min(N - 1, i + 1)]).normalize();    // points toward the head
      side.crossVectors(T, Y).normalize(); up.crossVectors(side, T).normalize();
      for (let k = 0; k < S; k++) {
        const a = k / S * Math.PI * 2, r = P[i].w;
        tmp.copy(P[i]).addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r);
        pos.set([tmp.x, tmp.y, tmp.z], (i * S + k) * 3);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    T.subVectors(P[0], P[2]).normalize();
    head.position.copy(P[0]).addScaledVector(T, 0.06);
    if (st.rear > 0.05 && manPos) {                            // look at his face while reared up
      look.set(manPos.x, 1.2, manPos.z).sub(head.position).normalize();
      T.lerp(look, st.rear * 0.8).normalize();
    }
    head.lookAt(tmp.copy(head.position).add(T));
    tongue.visible = Math.sin(t * 5) > 0.55 || st.wiggle > 0;
    tongue.scale.z = 0.6 + Math.abs(Math.sin(t * 20)) * 0.6;
  }
  update(0, 0, null);

  return { group, head, update, pet: () => { st.wiggle = 1.2; } };
}
