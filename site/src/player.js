// Playable man: keyboard / touch input, circle-vs-box collisions, procedural walk / run / idle on the rig,
// and three camera views: third person (chase, spring arm), first person (head), top-down (overhead follow).
import * as THREE from 'three';
import { POSES } from './man.js';

const R = 0.26;                                       // body radius for collisions
const WALK = 1.7, RUN = 4.2;                          // m/s
export const VIEWS = ['third', 'first', 'top'];
export const VIEW_LABEL = { third: '3rd person', first: '1st person', top: 'top-down' };

const e = new THREE.Euler(), q = new THREE.Quaternion();
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function makePlayer({ man, camera, canvas, solids, walls }) {
  const pos = new THREE.Vector3(-0.6, 0, 1.2);
  const st = { heading: Math.PI, speed: 0, phase: 0, yaw: 0.25, pitch: 0.38, dist: 3.8, view: 'third', seated: null, frozen: false };
  const keys = new Set();
  const move = new THREE.Vector2();                 // touch joystick (x right, y forward)
  addEventListener('keydown', ev => { if (!ev.metaKey && !ev.ctrlKey) keys.add(ev.code); });
  addEventListener('keyup', ev => keys.delete(ev.code));
  addEventListener('blur', () => keys.clear());

  // --- pointer: drag to look; on touch the left half is a joystick
  const ptrs = new Map(); let pinch0 = 0, dist0 = 0, stick = null;
  canvas.addEventListener('pointerdown', ev => {
    canvas.setPointerCapture(ev.pointerId);
    const p = { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, stick: ev.pointerType === 'touch' && ev.clientX < innerWidth * 0.45 && !stick };
    if (p.stick) stick = ev.pointerId;
    ptrs.set(ev.pointerId, p);
  });
  const up = ev => { if (stick === ev.pointerId) { stick = null; move.set(0, 0); } ptrs.delete(ev.pointerId); pinch0 = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointermove', ev => {
    const p = ptrs.get(ev.pointerId); if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
    if (p.stick) { move.set(THREE.MathUtils.clamp((p.x - p.x0) / 60, -1, 1), THREE.MathUtils.clamp(-(p.y - p.y0) / 60, -1, 1)); return; }
    const looks = [...ptrs.values()].filter(o => !o.stick);
    if (looks.length === 1) {
      const k = st.view === 'first' ? 0.0035 : 0.005;
      st.yaw -= dx * k;
      st.pitch = THREE.MathUtils.clamp(st.pitch + dy * 0.004 * (st.view === 'first' ? -1 : 1), st.view === 'first' ? -1.2 : -0.2, 1.25);
    } else if (looks.length === 2) {
      const d = Math.hypot(looks[0].x - looks[1].x, looks[0].y - looks[1].y);
      if (!pinch0) { pinch0 = d; dist0 = st.dist; }
      st.dist = THREE.MathUtils.clamp(dist0 * pinch0 / d, 1.6, 7);
    }
  });
  canvas.addEventListener('wheel', ev => { ev.preventDefault(); st.dist = THREE.MathUtils.clamp(st.dist * (1 + ev.deltaY * 0.0015), 1.6, 7); }, { passive: false });

  // --- head meshes hide in first person
  const headParts = [];
  man.root.traverse(o => { if (o.isMesh && /^(head|hair|ear)/.test(o.name)) headParts.push(o); });

  function collide(p) {
    for (let it = 0; it < 2; it++) for (const b of solids) {
      const cx = THREE.MathUtils.clamp(p.x, b[0], b[2]), cz = THREE.MathUtils.clamp(p.z, b[1], b[3]);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < R * R) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (R - d) / d; p.x += dx * k; p.z += dz * k; }
        else p.x += R;                                                  // centre inside a box: push out
      }
    }
  }

  // --- animation: pose = rest * euler delta, blended walk / run cycle over idle
  function anim(dt, t) {
    const B = man.bones;
    const set = (n, x, y = 0, z = 0) => { const b = B[n]; if (b) b.quaternion.copy(b.userData.rest).multiply(q.setFromEuler(e.set(x, y, z))); };
    if (st.seated) { man.pose('seated'); return; }
    const sp = st.speed, a = Math.min(sp / WALK, 1), run = THREE.MathUtils.clamp((sp - WALK) / (RUN - WALK), 0, 1);
    st.phase += dt * (sp > 0.05 ? 2.4 + sp * 1.6 : 0);
    const s = Math.sin(st.phase), c = Math.cos(st.phase);
    const amp = a * (0.5 + 0.35 * run);
    for (const [side, sg] of [['L', 1], ['R', -1]]) {
      const ss = s * sg;
      set('thigh' + side, ss * amp * 0.9 + run * 0.15);
      set('shin' + side, -(0.08 + Math.max(0, Math.sin(st.phase * sg + 1.3)) * (0.5 + 0.7 * run)) * a);
      set('foot' + side, Math.max(0, -ss) * 0.25 * a);
      set('upperarm' + side, -ss * amp * 0.8, 0, (side === 'L' ? -1 : 1) * (0.05 + 0.1 * run));
      set('forearm' + side, 0.15 + (0.25 + 0.9 * run) * a + Math.max(0, -ss) * 0.2 * a);
      set('hand' + side, -0.1);
    }
    const breathe = Math.sin(t * 1.6) * 0.02 * (1 - a);
    set('hips', 0, s * 0.08 * a);
    set('spine', 0.04 + run * 0.12 + breathe, -s * 0.06 * a);
    set('chest', 0.02 + run * 0.08 - breathe, -s * 0.08 * a);
    set('neck', -run * 0.1);
    set('head', -run * 0.08 + Math.sin(t * 0.7) * 0.02 * (1 - a), Math.sin(t * 0.37) * 0.08 * (1 - a));
    man.root.position.y = -Math.abs(c) * 0.025 * a * (1 + run);
  }

  // --- camera
  const ray = new THREE.Raycaster(), tgt = new THREE.Vector3(), want = new THREE.Vector3(), headW = new THREE.Vector3();
  const hidden = new Set();
  let boxes = null;                                     // wall bounds, built on first use (walls are static)
  function cam(dt) {
    const f = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
    for (const o of headParts) o.visible = st.view !== 'first';
    if (st.view === 'first') {
      man.bones.head.getWorldPosition(headW);
      camera.position.set(headW.x, headW.y + 0.12, headW.z).addScaledVector(f, 0.12);
      camera.rotation.set(st.pitch, st.yaw, 0, "YXZ");
      camera.fov = 70;
    } else if (st.view === 'top') {
      tgt.set(pos.x, 0.8, pos.z);
      want.copy(tgt).addScaledVector(f, -st.dist * 1.4).setY(tgt.y + 5.5 + st.dist);
      camera.position.lerp(want, 1 - Math.exp(-6 * dt));
      camera.lookAt(tgt); camera.fov = 45;
    } else {
      tgt.set(pos.x, (st.seated ? 1.05 : 1.45), pos.z);
      const cp = Math.cos(st.pitch);
      const dir = new THREE.Vector3(Math.sin(st.yaw) * cp, Math.sin(st.pitch), Math.cos(st.yaw) * cp);
      const d = st.dist;                                               // no spring arm: walls between camera and player are cut away (dollhouse)
      want.copy(tgt).addScaledVector(dir, d);
      camera.position.lerp(want, 1 - Math.exp(-12 * dt));
      camera.lookAt(tgt); camera.fov = innerWidth < innerHeight ? 62 : 50;
    }
    camera.updateProjectionMatrix();
    // cut away any wall still between camera and player (top-down, tight corners)
    for (const w of hidden) w.visible = true; hidden.clear();
    if (st.view !== 'first') {
      // camera parked inside a wall: its back-face ink hull would fill the screen black
      if (!boxes) boxes = walls.map(w => [w, new THREE.Box3().setFromObject(w).expandByScalar(0.3)]);
      for (const [w, b] of boxes) if (b.containsPoint(camera.position)) { w.visible = false; hidden.add(w); }
      tgt.set(pos.x, 1.0, pos.z);
      const v = tgt.clone().sub(camera.position), L = v.length();
      ray.set(camera.position, v.normalize()); ray.far = L;
      for (const h of ray.intersectObjects(walls, false)) { h.object.visible = false; hidden.add(h.object); }
    }
  }

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), mv = new THREE.Vector3();
  function update(dt, t) {
    let ix = move.x, iy = move.y;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iy += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iy -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    const mag = Math.min(1, Math.hypot(ix, iy));
    if (st.frozen) { ix = iy = 0; }
    if (st.seated && mag > 0.2) stand();
    fwd.set(-Math.sin(st.yaw), 0, -Math.cos(st.yaw)); right.set(Math.cos(st.yaw), 0, -Math.sin(st.yaw));
    mv.set(0, 0, 0).addScaledVector(fwd, iy).addScaledVector(right, ix);
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(move.x, move.y) > 0.95;
    const target = st.seated || st.frozen ? 0 : mag * (running ? RUN : WALK);
    st.speed = damp(st.speed, target, 8, dt);
    if (mv.lengthSq() > 1e-4 && !st.seated) {
      mv.normalize();
      const h = Math.atan2(mv.x, mv.z);
      st.heading += wrap(h - st.heading) * (1 - Math.exp(-12 * dt));
      pos.addScaledVector(mv, st.speed * dt);
      collide(pos);
    }
    man.root.position.x = pos.x; man.root.position.z = pos.z;
    man.root.rotation.y = st.heading;
    anim(dt, t);
    if (st.seated) man.root.position.y += 0;                         // pose() set the seated drop
    cam(dt);
  }

  function sit(spot) {                                              // spot: { x, z, heading }
    st.seated = spot; pos.set(spot.x, 0, spot.z); st.heading = spot.heading; st.speed = 0;
  }
  function stand() {
    const s = st.seated; st.seated = null; man.pose('stand');
    pos.x += Math.sin(s.heading) * 0.45; pos.z += Math.cos(s.heading) * 0.45; collide(pos);
  }
  function cycleView() { st.view = VIEWS[(VIEWS.indexOf(st.view) + 1) % VIEWS.length]; if (st.view === 'first') st.pitch = 0; else st.pitch = 0.38; return st.view; }

  return { pos, st, keys, update, sit, stand, cycleView, POSES };
}
