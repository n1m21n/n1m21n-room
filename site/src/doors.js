// Doors: double-acting gallery doors (they swing away from whoever pushes, like museum / cafe doors) with a brass push
// plate on each face. Walking into one (by tap or keys) stops him in front of it: he reaches out, puts his right palm
// flat on the plate and pushes (acts.js `door`), the leaf swings away and he walks on through. Open doors fold back
// against the passage wall and swing shut once he is well clear. Tap a door (or E) to open / close it by hand.
//   door(spec) -> builds one; update() each frame after player.update; stations() -> E-prompt entries for main.js
import * as THREE from 'three';
import { mesh } from './look.js';
import { PAL } from './textures.js';

const T = 0.05;                     // leaf thickness
const SEG = 4;                      // collision boxes along a leaf
const PLATE = { r: 0.62, y: 1.28 }; // push plate: metres out from the hinge along the leaf, height
const STAND = 0.31;                 // his root, back from the leaf's face, while he pushes
const OPEN = 1.5;                   // radians when fully open (folded back along the passage wall)
const HAND_OFF = 0.08;              // his palm lands this far to his right of his root
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const out3 = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function makeDoors({ scene, walls, solids, player, man }) {
  const all = [];

  // { x, z, phi: heading of the passage through it, w, h, color, hinge: +1 / -1 (which jamb, seen along phi) }
  function door({ x, z, phi, w = 1.4, h = 2.35, color = PAL.red, hinge = 1 }) {
    const n = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));                 // through the doorway
    const u = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi)).multiplyScalar(hinge);   // across it, hinge -> free edge
    const hingeAt = new THREE.Vector3(x, 0, z).addScaledVector(u, -w / 2);
    const pivot = new THREE.Group(); pivot.position.copy(hingeAt);
    const base = Math.atan2(n.x, n.z) + (hinge < 0 ? Math.PI : 0);                // pivot's local +x runs hinge -> free edge
    pivot.rotation.y = base;
    const leaf = mesh(new THREE.BoxGeometry(w - 0.03, h - 0.02, T), color, { ink: 0.008, mat: 'paint', matAxis: 'y' });
    leaf.position.set(w / 2, h / 2, 0); leaf.name = 'door'; pivot.add(leaf);
    const plates = [1, -1].map(s => {                                             // brass push plate on each face
      const p = mesh(new THREE.BoxGeometry(0.15, 0.34, 0.01), PAL.spiral, { ink: 0.004, mat: 'metal', matAxis: 'y' });
      p.position.set(PLATE.r, PLATE.y, s * (T / 2 + 0.005)); pivot.add(p); return p;
    });
    const kick = [1, -1].map(s => { const k = mesh(new THREE.BoxGeometry(w - 0.2, 0.2, 0.006), PAL.ink, { ink: false, mat: 'metal' }); k.position.set(w / 2, 0.14, s * (T / 2 + 0.003)); pivot.add(k); return k; });
    scene.add(pivot);
    leaf.userData.arm = true; leaf.userData.door = true; walls.push(leaf);         // the chase camera stops at it
    // live collision: the leaf as SEG short boxes from hinge to free edge, at whatever angle it stands (shut, mid-swing
    // or folded back), so he can never walk through it
    const boxes = Array.from({ length: SEG }, () => [0, 0, 0, 0]);
    solids.push(...boxes);
    const d = { x, z, phi, w, h, n, u, hinge, pivot, leaf, plates, kick, base, angle: 0, to: 0, side: 1, box: boxes[0], boxes, busy: false };
    setAngle(d, 0);
    all.push(d);
    return d;
  }

  function setAngle(d, a) {
    d.angle = a;
    d.pivot.rotation.y = d.base + a * (d.hinge < 0 ? -1 : 1);
    const r = d.pivot.rotation.y, ex = Math.cos(r), ez = -Math.sin(r), hp = d.pivot.position, ht = T / 2 + 0.02;
    d.boxes.forEach((b, i) => {
      const t0 = (i / SEG) * (d.w - 0.03), t1 = ((i + 1) / SEG) * (d.w - 0.03);
      const x0 = hp.x + ex * t0, z0 = hp.z + ez * t0, x1 = hp.x + ex * t1, z1 = hp.z + ez * t1;
      b[0] = Math.min(x0, x1) - ht; b[1] = Math.min(z0, z1) - ht; b[2] = Math.max(x0, x1) + ht; b[3] = Math.max(z0, z1) + ht;
    });
  }
  // which side of the leaf a point is on (+1 = the side n points to)
  const sideOf = (d, p) => Math.sign((p.x - d.x) * d.n.x + (p.z - d.z) * d.n.z) || 1;

  // the push: he stands STAND back from the leaf, square to it, palm on the plate. Swinging away from him means the
  // leaf turns toward -side*n: the pivot angle sign that does that depends on the hinge side.
  function spot(d, side) {
    const back = d.n.clone().multiplyScalar(side), face = Math.atan2(-back.x, -back.z);
    const plate = new THREE.Vector3(d.x, 0, d.z).addScaledVector(d.u, PLATE.r - d.w / 2);
    // his right is -x in man-local: world right = (-cos h, 0, sin h)
    const right = new THREE.Vector3(-Math.cos(face), 0, Math.sin(face));
    const root = plate.addScaledVector(back, STAND + T / 2).addScaledVector(right, -HAND_OFF);
    return { x: root.x, z: root.z, heading: face };
  }
  const swingSign = (d, side) => {                    // pivot-angle sign that moves the free edge toward -side*n
    const a = 0.1, rotY = d.base + a * (d.hinge < 0 ? -1 : 1);
    const free = new THREE.Vector3(Math.cos(rotY), 0, -Math.sin(rotY));                   // pivot local +x in world
    return (free.x * d.n.x + free.z * d.n.z) * side < 0 ? 1 : -1;
  };

  // the act's pose (acts.js `door` calls sp.pose): right palm on the plate facing him, following the leaf as it goes
  const pw = new THREE.Vector3(), nw = new THREE.Vector3(), q = new THREE.Quaternion();
  function pose(sp, u) {
    const d = sp.door, reach = ease(u / 0.45), off = ease((u - 0.85) / 0.35), k = reach * (1 - off);
    const plate = d.plates[sp.plate], s = sp.plate === 0 ? 1 : -1;                 // the plate on his face of the leaf
    plate.updateWorldMatrix(true, false);
    nw.set(0, 0, s).applyQuaternion(plate.getWorldQuaternion(q));                 // out of that face, toward him
    pw.setFromMatrixPosition(plate.matrixWorld).addScaledVector(nw, 0.019);        // just off the plate's face (the palm is not quite flat)
    man.root.updateWorldMatrix(true, false);
    const P = man.root.worldToLocal(pw.clone()).toArray();
    const N = nw.negate().applyQuaternion(man.root.getWorldQuaternion(q).invert()).toArray();   // palm into the leaf
    const rest = [-0.2, 0.9, 0.08], tgt = rest.map((v, i) => v + (P[i] - v) * k);
    // fingers up and in, laid flat along the leaf as it turns (so neither the tips nor the heel dig in)
    const F0 = [0.55 * k, -1 + 1.8 * k, 0.5 * Math.sin(Math.PI * k)], dn = F0[0] * N[0] + F0[1] * N[1] + F0[2] * N[2];
    const F = F0.map((v, i) => v - dn * N[i] * k), Nb = [1 - k + N[0] * k, N[1] * k, N[2] * k];
    return {
      face: 'neutral',
      fk: { spine: [0.1 * k, 0, 0], chest: [0.04 * k, 0, 0], neck: [-0.06 * k, 0, 0], head: [-0.08 * k, -0.1 * k, 0] },
      ik: { handR: tgt }, hand: { handR: [F, Nb] }, grip: { handR: k > 0.6 ? 'flat' : 'relax' },
      pole: { handR: [-0.5, -0.6, -0.2] },
    };
  }

  // the push sequence: walk to the plate, push, then carry on to wherever he was going
  let job = null;
  function push(d, resume = null) {
    if (job || d.busy) return;
    const side = sideOf(d, player.pos), s = spot(d, side);
    d.busy = true;
    const w = new THREE.Vector3(), dist = i => { d.plates[i].getWorldPosition(w); return Math.hypot(w.x - s.x, w.z - s.z); };
    const SP = { ...s, act: 'door', door: d, side, plate: dist(0) < dist(1) ? 0 : 1, out: [s.x, s.z], pose };
    job = { d, SP, resume, sign: swingSign(d, side) };
    if (Math.hypot(player.pos.x - s.x, player.pos.z - s.z) < 0.12) return player.sit(SP);
    player.goTo(s.x, s.z, { face: [d.x, d.z], done: () => { if (job?.SP === SP) player.sit(SP); } });   // done runs at once if no path
  }
  function close(d) {
    if (d.busy || Math.abs(d.angle) < 0.01) return false;
    const hp = d.pivot.position;
    if (Math.hypot(player.pos.x - hp.x, player.pos.z - hp.z) < d.w + 0.45) return false;   // he's in its sweep
    d.to = 0; return true;
  }
  const isOpen = d => Math.abs(d.to) > 0.01 || Math.abs(d.angle) > 0.01;
  function toggle(d) {
    if (d.busy) return;
    if (!isOpen(d)) return push(d);
    if (close(d)) return;
    const s = sideOf(d, player.pos);                                              // in its way: step back first
    player.goTo(d.x + d.n.x * s * 2.4, d.z + d.n.z * s * 2.4, { face: [d.x, d.z], done: () => close(d) });
  }

  function update(dt) {
    const p = player.pos, st = player.st;
    // a job in progress: the leaf follows the act's clock
    if (job) {
      const { d, SP, sign } = job;
      if (st.seated === SP) {
        const u = SP.t || 0;
        // pushed slowly while the palm is on it, then it swings free
        const a = u < 0.45 ? 0 : u < 0.85 ? 0.22 * ease((u - 0.45) / 0.4) : 0.22 + (OPEN - 0.22) * out3((u - 0.85) / 0.8);
        setAngle(d, sign * a); d.to = sign * OPEN;
        if (u >= 1.25) {
          const r = job.resume; job = null; d.busy = false;
          player.stand();
          if (r) player.goTo(r.x, r.z, { done: r.done, face: r.face });
        }
      } else if (!player.auto.pts) { job = null; d.busy = false; }       // he walked off (keys) before reaching it
    }
    for (const d of all) {
      if (d.busy) continue;
      // swing toward the target (manual open / close)
      if (Math.abs(d.to - d.angle) > 1e-3) setAngle(d, d.angle + Math.sign(d.to - d.angle) * Math.min(Math.abs(d.to - d.angle), dt * 2.6));
      const dx = p.x - d.x, dz = p.z - d.z, along = dx * d.n.x + dz * d.n.z, across = dx * d.u.x + dz * d.u.z;
      const shut = Math.abs(d.angle) < 0.5;
      // swing shut once he's well clear of it
      if (!shut && Math.abs(d.to) > 0 && Math.hypot(dx, dz) > 3.2) d.to = 0;
      if (!shut || job || st.seated) continue;
      const near = Math.abs(along) < 1.1 && Math.abs(across) < d.w / 2 + 0.2;
      if (!near) continue;
      const side = Math.sign(along) || 1;
      // tap-to-walk route through it: stop, push, carry on
      const pts = player.auto.pts;
      if (pts && pts.some(([x, z]) => Math.sign((x - d.x) * d.n.x + (z - d.z) * d.n.z) === -side)) {
        const end = pts[pts.length - 1], { done, face } = player.auto;
        player.cancelAuto();
        push(d, { x: end[0], z: end[1], done, face });
        continue;
      }
      // walking into it or standing in front of it: swing open ahead of him so he never gets stuck
      const hd = st.heading, toward = -(Math.sin(hd) * d.n.x + Math.cos(hd) * d.n.z) * side;
      if ((st.speed > 0.15 || Math.abs(along) < 0.85) && toward > 0.25) { d.to = swingSign(d, side) * OPEN; setAngle(d, d.angle + d.to * 0.02); }
    }
  }

  const stations = () => all.map(d => ({
    get label() { return isOpen(d) ? 'close door' : 'open door'; },
    obj: d.pivot, p: [d.x, d.z], r: 1.3, direct: true, act: () => toggle(d), door: d,
  }));

  return { door, update, stations, all, push, spot, setAngle };
}
