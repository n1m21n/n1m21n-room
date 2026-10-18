// Playable man: keyboard / touch input, circle-vs-box collisions, procedural walk / run / idle on the rig,
// and three camera views: third person (chase, spring arm), first person (head), top-down (overhead follow).
import * as THREE from 'three';
import { fading } from './look.js';
import { POSES } from './man.js';
import { ACTS, applyAct, relaxHands, curlFingers } from './acts.js';

const R = 0.26;                                       // body radius for collisions
const WALK = 1.7, RUN = 4.2;                          // m/s
export const VIEWS = ['third', 'first', 'top'];
export const VIEW_LABEL = { third: '3rd person', first: '1st person', top: 'top-down' };

const e = new THREE.Euler(), q = new THREE.Quaternion();
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function makePlayer({ man, scene, camera, canvas, solids, walls, nav, onTap, rooms = [], posture = null, beats = null, companion = false }) {   // companion: a second character (hers): no input, no camera, only walking and acting
  const pos = new THREE.Vector3(-0.6, 0, 1.2);
  const st = { turnTo: null, heading: Math.PI, speed: 0, phase: 0, yaw: 0.25, pitch: 0.38, dist: 3.8, view: 'third', seated: null, frozen: false, bumps: 0, blocked: false, faceNow: 'neutral' };
  const keys = new Set();
  const move = new THREE.Vector2();                 // touch joystick (x right, y forward)
  if (!companion) {
    addEventListener('keydown', ev => { if (!ev.metaKey && !ev.ctrlKey) keys.add(ev.code); });
    addEventListener('keyup', ev => keys.delete(ev.code));
    addEventListener('blur', () => keys.clear());
  }

  // --- pointer: drag to look, pinch to zoom, tap to walk / use. On touch the joystick (#joy) is fixed bottom-left
  // under the left thumb: a touch on or near it grabs it and keeps it (sticky) until that finger lifts, wherever the
  // finger wanders; the knob follows up to JOY px from the centre, past 90% = run. Any other finger looks around
  const ptrs = new Map(); let pinch0 = 0, dist0 = 0, stick = null;
  const joy = document.getElementById('joy'), knob = joy?.firstElementChild, JOY = 52;
  const joyAt = () => { const r = joy.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; };
  const stickZone = ev => {
    if (ev.pointerType === 'mouse' || !joy) return false;
    const [x, y, w] = joyAt(); return w > 0 && Math.hypot(ev.clientX - x, ev.clientY - y) < w * 0.85;   // w = 0: hidden
  };
  function joyShow(p) { joy.classList.add('on'); [p.x0, p.y0] = joyAt(); }       // offsets measure from the stick's centre
  function joyHide() { if (!joy) return; joy.classList.remove('on'); knob.style.transform = ''; }
  canvas.addEventListener('pointerdown', ev => {
    try { canvas.setPointerCapture(ev.pointerId); } catch {}
    const p = { x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, t0: performance.now(), stick: stickZone(ev) && !stick };
    if (p.stick) { stick = ev.pointerId; joyShow(p); }
    ptrs.set(ev.pointerId, p);
  });
  const up = ev => {
    const p = ptrs.get(ev.pointerId);
    const tap = p && ev.type === 'pointerup' && ptrs.size === 1 && Math.hypot(p.x - p.x0, p.y - p.y0) < 10 && performance.now() - p.t0 < 350;
    if (stick === ev.pointerId) { stick = null; move.set(0, 0); joyHide(); }
    ptrs.delete(ev.pointerId); pinch0 = 0;
    if (tap && onTap) onTap(ev.clientX, ev.clientY);
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointermove', ev => {
    const p = ptrs.get(ev.pointerId); if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
    if (p.stick) {
      let ox = p.x - p.x0, oy = p.y - p.y0; const L = Math.hypot(ox, oy);
      if (L > JOY) { ox *= JOY / L; oy *= JOY / L; }
      if (knob) knob.style.transform = `translate(${ox}px, ${oy}px)`;
      const k = Math.min(L, JOY) / JOY;
      if (k < 0.12) move.set(0, 0);                                    // dead zone: a resting thumb does not creep
      else move.set(ox / JOY, -oy / JOY);
      return;
    }
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
    if (st.seated) {
      const sp = st.seated, act = ACTS[sp.act];
      if (!act) { man.pose(sp.pose || 'seated'); relaxHands(B); return; }
      sp.t = (sp.t || 0) + dt;
      sp.tt = (sp.tt || 0) + dt * (sp.tempo || 1);     // act clock at his emotional tempo (acts.js hands, sfx.js strums share it)
      const rawSpec = beats ? beats.spec(sp, dt, t, act) : act(sp.t, t, sp);   // beats.js: now and then a small beat on top (a sip, a stretch)
      if (posture) posture.applyToSpec(rawSpec, { dt, t, pos, heading: st.heading, speed: 0, seated: sp });
      const spec = st.spec = applyAct(man, rawSpec);
      if (spec.face) { const sh = posture ? posture.shownFace(spec.face) : spec.face; if (sh !== sp.faceNow) { man.face(sh); sp.faceNow = sh; } }
      const k = Math.min(1, sp.t / 0.4), kk = k * k * (3 - 2 * k);           // ease in from the pose he walked up in
      if (kk < 1 && sp.from) {
        for (const [n, b] of Object.entries(B)) b.quaternion.slerpQuaternions(sp.from[n], b.quaternion.clone(), kk);
        man.root.position.y = sp.fromY + (man.root.position.y - sp.fromY) * kk;
      }
      return;
    }
    const walk = WALK * (posture?.state.gait || 1);
    const sp = st.speed, a = Math.min(sp / walk, 1), run = THREE.MathUtils.clamp((sp - walk) / (RUN - walk), 0, 1);
    st.phase += dt * (sp > 0.05 ? 2.4 + sp * 1.6 : 0);
    const s = Math.sin(st.phase), c = Math.cos(st.phase);
    const amp = a * (0.5 + 0.35 * run);
    for (const [side, sg] of [['L', 1], ['R', -1]]) {
      const ss = s * sg;
      set('thigh' + side, ss * amp * 0.9 + run * 0.15);
      set('shin' + side, -(0.08 + Math.max(0, Math.sin(st.phase * sg + 1.3)) * (0.5 + 0.7 * run)) * a);
      set('foot' + side, Math.max(0, -ss) * 0.25 * a);
      set('upperarm' + side, -ss * amp * 0.8, 0, (side === 'L' ? 1 : -1) * (0.04 + 0.16 * run) + (posture?.state.deltas['upperarm' + side]?.[2] || 0));   // +z on the left = out: hands clear the thighs
      set('forearm' + side, 0.15 + (0.25 + 0.9 * run) * a + Math.max(0, -ss) * 0.2 * a);
      set('hand' + side, -0.1);
    }
    const pState = posture ? posture.step(dt, t, { pos, heading: st.heading, speed: sp, seated: null }) : null;
    const breathe = pState ? 0 : Math.sin(t * 1.6) * 0.02 * (1 - a);
    const dHips  = pState ? pState.deltas.hips  : [0, 0, 0];
    const dSpine = pState ? pState.deltas.spine : [breathe, 0, 0];
    const dChest = pState ? pState.deltas.chest : [-breathe, 0, 0];
    const dNeck  = pState ? pState.deltas.neck  : [0, 0, 0];
    const dHead  = pState ? pState.deltas.head  : [0, 0, 0];
    set('hips', dHips[0] * (1 - a), s * 0.08 * a + dHips[1] * (1 - a), dHips[2] * (1 - a));
    set('spine', 0.04 + run * 0.12 + dSpine[0] * (1 - a * 0.5), -s * 0.06 * a + dSpine[1] * (1 - a), dSpine[2] * (1 - a));
    set('chest', 0.02 + run * 0.08 + dChest[0] * (1 - a * 0.5), -s * 0.08 * a + dChest[1] * (1 - a), dChest[2] * (1 - a));
    set('neck', -run * 0.1 + dNeck[0] * (1 - a * 0.5), dNeck[1] * (1 - a), dNeck[2] * (1 - a));
    set('head', -run * 0.08 + Math.sin(t * 0.7) * 0.02 * (1 - a) + dHead[0] * (1 - a), Math.sin(t * 0.37) * 0.08 * (1 - a) + dHead[1] * (1 - a), dHead[2] * (1 - a));
    if (pState?.face) { const sh = posture.shownFace(pState.face); if (sh !== st.faceNow) { man.face(sh); st.faceNow = sh; } }
    man.root.position.y = -Math.abs(c) * 0.025 * a * (1 + run);
    relaxHands(B, run > 0.5 ? 'fist' : 'relax');
    if (pState) curlFingers(B, pState.deltas.fingers + pState.deltas.fingersT);
    plant();
  }

  // --- camera
  const ray = new THREE.Raycaster(), tgt = new THREE.Vector3(), want = new THREE.Vector3(), headW = new THREE.Vector3();
  const hidden = new Set();
  // walls between the lens and him are cut away by FADING them out (look.js screen-door dither on the fill and the ink
  // hull alike): never by changing their height (sinking them read as the walls bobbing as the camera swung round) and
  // never by blinking them off. The state can't oscillate:
  //   enter  the moment a wall blocks (a ray to him, the lens inside its pad, or the lens hugging it)
  //   stay   while it blocks, or while a FATTER test (wider pad, the wall grown by FAT) still says it is close
  //   leave  only after HOLD s with nothing in the way; while it fades back in only a real block (enter) re-cuts it
  // No test reads the fade, so the camera and the cut state never feed back into each other.
  // Sims-style cutaway (rooms: main.js). Every wall on the edge of a room's floor rect belongs to that room, with its
  // normal pointing in (a wall between two rooms belongs to both). Of the room HE is in, the walls the camera looks in
  // through (their normal along its heading past FACE_IN) are cut away and the camera may pass them; the rest (behind
  // him, side-on) stand and stop the camera like the gallery's. It reads only the camera's heading, with hysteresis
  // (cut past FACE_IN, back below FACE_OUT) and which room he is in (switching once he is INSET into the next one), so
  // it can't flutter: no ray, no distance, no timer. The ray / box / lens cuts below now only cover walls of other rooms
  const FACE_IN = 0.35, FACE_OUT = 0.15, EDGE = 0.25, INSET = 0.25;
  const facing = new Set(); let sides = null, mine = new Map(), here = null;
  function classify() {
    sides = new Map(); mine = new Map(rooms.map(r => [r, []]));
    const b = new THREE.Box3(), c = new THREE.Vector3(), sz = new THREE.Vector3();
    const over = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0.05;
    for (const w of walls) {
      if (w.userData.door || w.userData.low || w.userData.hall) continue;   // doors, half walls, the gallery's halls: never cut
      b.setFromObject(w); b.getCenter(c); b.getSize(sz);
      for (const r of rooms) {
        const [x0, z0, x1, z1] = r.box, ns = [];
        if (sz.x < 0.4 && over(b.min.z, b.max.z, z0, z1)) { if (Math.abs(c.x - x0) < EDGE) ns.push([1, 0]); if (Math.abs(c.x - x1) < EDGE) ns.push([-1, 0]); }
        if (sz.z < 0.4 && over(b.min.x, b.max.x, x0, x1)) { if (Math.abs(c.z - z0) < EDGE) ns.push([0, 1]); if (Math.abs(c.z - z1) < EDGE) ns.push([0, -1]); }
        for (const n of ns) { if (!sides.has(w)) sides.set(w, []); sides.get(w).push({ room: r, n }); if (!mine.get(r).includes(w)) mine.get(r).push(w); }
      }
    }
  }
  const inRoom = (r, m) => pos.x > r.box[0] + m && pos.x < r.box[2] - m && pos.z > r.box[1] + m && pos.z < r.box[3] - m;
  function roomNow() {
    if (here && inRoom(here, -0.35)) here = rooms.find(r => r !== here && inRoom(r, INSET)) || here;   // a doorway: still the old one
    else here = rooms.find(r => inRoom(r, INSET)) || rooms.find(r => inRoom(r, -0.1)) || here;
    return here;
  }
  // vx, vz: the camera's heading on the floor plan (from the lens toward him)
  function face(vx, vz) {
    if (!sides) classify();
    const R = st.view === 'first' ? null : roomNow();
    for (const w of facing) if (!R || !mine.get(R).includes(w)) facing.delete(w);
    if (R) for (const w of mine.get(R)) {
      let s = -1; for (const x of sides.get(w)) if (x.room === R) s = Math.max(s, x.n[0] * vx + x.n[1] * vz);
      if (s > FACE_IN) facing.add(w); else if (s < FACE_OUT) facing.delete(w);
    }
    for (const w of facing) cutWall(w, 'face');
    return R;
  }
  const ofHere = w => !!here && st.view !== 'first' && mine.get(here)?.includes(w);
  const cuts = new Map(); let clock = 0;
  const STUB = 0.45, HOLD = 0.6, FAT = 0.2, PAD_OUT = 0.6, FADE_OUT = 0.2, FADE_IN = 0.35;
  const live = o => o.visible || hidden.has(o) || cuts.has(o);
  // a per-object copy of a toon / hull material whose uCut is its own (the other uniforms stay shared, never cloned)
  function own(o, c) {
    const m = o.material; if (!m?.uniforms?.uCut) return false;
    const n = new THREE.ShaderMaterial({ vertexShader: m.vertexShader, fragmentShader: m.fragmentShader, defines: m.defines, side: m.side,
      transparent: m.transparent, depthWrite: m.depthWrite, depthTest: m.depthTest, blending: m.blending, toneMapped: m.toneMapped,
      polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
      uniforms: { ...m.uniforms, uCut: { value: 0 }, uStub: { value: 0 } } });
    n.name = m.name; c.mats.push([o, m, n]); o.material = n; return true;
  }
  function cutWall(w, why) {
    if (w.userData.door || w.userData.low || w.userData.hall) return;
    let c = cuts.get(w);
    if (!c) {
      c = { k: 0, clear: 0, hit: true, why, mats: [], pop: [] }; cuts.set(w, c);
      own(w, c); for (const h of w.children) own(h, c);
      for (const q of attached(w)) { if (own(q, c)) { for (const h of q.children) own(h, c); fading.add(q); } else c.pop.push(q); }
      fading.add(w);
    }
    c.hit = true; c.clear = 0; c.why = why;
  }
  const exitBox = new Map(), hitV = new THREE.Vector3(), segV = new THREE.Vector3(), rr = new THREE.Ray();
  // the wider "still close" test: lens within PAD_OUT of the wall, or a line to him (3 rays) through the wall grown by FAT
  function near(w) {
    let b = exitBox.get(w);
    if (!b || w.userData.door) { b = [new THREE.Box3().setFromObject(w).expandByScalar(PAD_OUT), new THREE.Box3().setFromObject(w).expandByScalar(FAT)]; exitBox.set(w, b); }
    if (b[0].containsPoint(camera.position)) return true;
    const side = new THREE.Vector3(Math.cos(orb.yaw), 0, -Math.sin(orb.yaw));
    for (const off of [0, -0.35, 0.35]) {
      segV.set(pos.x + side.x * off, 1.0, pos.z + side.z * off).sub(camera.position); const L = segV.length();
      rr.set(camera.position, segV.normalize());
      if (rr.intersectBox(b[1], hitV) && hitV.distanceTo(camera.position) < L - 0.4) return true;   // (not the bit right by him)
    }
    return false;
  }
  function stepCuts(dt) {
    for (const [w, c] of cuts) {
      if (c.hit) c.clear = 0;
      else if (c.why === 'face') c.clear = HOLD;                 // no longer facing: back at once (the heading has hysteresis)
      else if (c.clear < HOLD && near(w)) c.clear = 0;           // still close: the hold restarts
      else c.clear += dt;
      c.hit = false;
      const on = c.clear < HOLD;
      c.k = on ? Math.min(1, c.k + dt / FADE_OUT) : Math.max(0, c.k - dt / FADE_IN);
      if (!on && c.k === 0) {
        for (const [o, m, n] of c.mats) { o.material = m; n.dispose(); }
        for (const q of c.pop) q.visible = true;
        for (const q of attached(w)) { q.visible = true; q.userData.fadeK = 0; fading.delete(q); }
        w.visible = true; w.userData.fadeK = 0; fading.delete(w); cuts.delete(w); continue;
      }
      const stub = c.why === 'face' ? STUB : 0;                    // the room's cutaway walls drop to a low stub (Sims "walls down"); others go whole
      for (const [, , n] of c.mats) { n.uniforms.uCut.value = c.k; n.uniforms.uStub.value = stub; }
      w.visible = stub > 0 || c.k < 1; w.userData.fadeK = stub > 0 ? 0 : c.k;
      for (const q of attached(w)) { q.userData.fadeK = c.k; if (!c.pop.includes(q)) q.visible = c.k < 1; }
      for (const q of c.pop) q.visible = c.k < 0.5;              // hung things that can't fade (sprites) go at half way
    }
  }
  // props in the way (a monitor, the easel's canvas) thin out with the same dither instead of popping off, and never
  // fully: they keep PMAX of the fade short of gone so they still read as the object. They come back after P_HOLD s
  const pf = new Map(), noFade = new Set(), hugs = [], PMAX = 0.7, P_HOLD = 0.5;
  function fadeProp(o) {
    if (noFade.has(o)) return false;
    let c = pf.get(o);
    if (!c) {
      c = { k: 0, clear: 0, mats: [] };
      if (!own(o, c)) { noFade.add(o); return false; }
      for (const h of o.children) own(h, c);
      pf.set(o, c); fading.add(o);
    }
    c.clear = 0; return true;
  }
  function stepProps(dt) {
    for (const [o, c] of pf) {
      c.clear += dt;
      const on = c.clear < P_HOLD;
      c.k = on ? Math.min(PMAX, c.k + dt * PMAX / 0.25) : Math.max(0, c.k - dt / 0.4);
      if (!on && c.k === 0) { for (const [q, m, n] of c.mats) { q.material = m; n.dispose(); } o.userData.fadeK = 0; fading.delete(o); pf.delete(o); continue; }
      for (const [, , n] of c.mats) n.uniforms.uCut.value = c.k;
      o.userData.fadeK = c.k;
    }
  }
  let boxes = null, arm = null, armOut = null, props = null, lens = null; const occl = [], OCCL = 1.2;
  const stuck = new Map();                                // things hung on a wall (window, frames, lamp) leave with it when it is cut away
  // a prop's whole object: the biggest group above it that is still small (a framed poster, the window, the mirror; the
  // record shelf with its spines; the wardrobe with its doors), short of the room / annex / gallery group itself
  const unitBox = new Map(), boxOf = o => { if (!unitBox.has(o)) unitBox.set(o, new THREE.Box3().setFromObject(o)); return unitBox.get(o); };
  const small = (b, sz) => { b.getSize(sz); return sz.x < 2.5 && sz.y < 2.5 && sz.z < 2.5; };
  function unitOf(o) {
    const sz = new THREE.Vector3(); let u = o;
    for (let p = o.parent; p && p !== scene && p.parent && p.parent !== scene && small(boxOf(p), sz); p = p.parent) u = p;
    return u;
  }
  function attached(w) {
    if (!stuck.has(w)) {
      const wb = new THREE.Box3().setFromObject(w).expandByScalar(0.3), out = [];
      // only things hung ON the wall: the whole object off the floor, small, centred inside the wall's slab (a shelf's
      // spines or the wardrobe's back stay with the furniture they belong to). Never floors. `skin`: a facing on the
      // wall (annex.js linings) goes with it though it stands on the floor
      const sz = new THREE.Vector3(), c = new THREE.Vector3();
      for (const o of getProps()) {
        if (o === w || o.userData.floor || o.userData.stays || o.userData.door || o.parent?.name === 'door') continue;
        const ub = o.userData.skin ? boxOf(o) : boxOf(unitOf(o)); ub.getCenter(c);
        if ((ub.min.y > 0.05 || o.userData.skin) && small(ub, sz) && wb.containsPoint(c)) out.push(o);
      }
      stuck.set(w, out);
    }
    return stuck.get(w);
  }
  function getProps() { if (!props) { props = []; scene.traverse(o => { if (o.isMesh && !o.userData.arm && !o.isSkinnedMesh && o.geometry && !walls.includes(o) && o.material?.side !== THREE.BackSide && !o.userData.door && !isMan(o)) props.push(o); }); } return props; }
  const inBox = b => pos.x > b[0] && pos.x < b[2] && pos.z > b[1] && pos.z < b[3];
  const isMan = o => { for (let p = o; p; p = p.parent) if (p === man.root) return true; return false; };                         // wall bounds, built on first use (walls are static)
  const ARM_PAD = 0.3, LENS_AX = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(a => new THREE.Vector3(...a));
  const orb = { init: false, yaw: 0, pitch: 0, d: 0 }, focus = new THREE.Vector3(), dir = new THREE.Vector3();
  let camFocus = null;
  // following someone else (her): the camera code reads `pos` for the room, the walls to cut and the arm length, so it runs with pos on her
  function cam(dt) {
    const cf = camFocus?.(); if (!cf) return camBody(dt);
    const sx = pos.x, sz = pos.z; pos.set(cf.x, 0, cf.z);
    try { camBody(dt); } finally { pos.set(sx, 0, sz); }
  }
  function camBody(dt) {
    const f = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
    for (const o of headParts) o.visible = st.view !== 'first' && !o.userData.underHat;   // outfits.js hides the hair shine under a hat
    for (const o of man.bones.head.children) if (o.name === 'hat') o.visible = st.view !== 'first';   // outfits.js hats
    if (st.view === 'first') {
      man.bones.head.getWorldPosition(headW);
      camera.position.set(headW.x, headW.y + 0.12, headW.z).addScaledVector(f, 0.12);
      camera.rotation.set(st.pitch, st.yaw, 0, "YXZ");
      camera.fov = 70;
      face(0, 0);
    } else if (st.view === 'top') {
      tgt.set(pos.x, 0.8, pos.z);
      want.copy(tgt).addScaledVector(f, -st.dist * 1.4).setY(tgt.y + 5.5 + st.dist);
      camera.position.lerp(want, 1 - Math.exp(-6 * dt));
      camera.lookAt(tgt); camera.fov = 45;
      face(f.x, f.z);
    } else {
      const cf = camFocus?.();                                             // the camera can follow someone else (her): { x, z, low }
      tgt.set(cf ? cf.x : pos.x, ((cf ? cf.low : st.seated && (st.spec ? (st.spec.y || 0) < -0.1 || st.spec.lie : true)) ? 1.05 : 1.45), cf ? cf.z : pos.z);
      const tall = innerHeight > innerWidth;
      st.intro = Math.min(1, (st.intro ?? 0) + (st.frozen ? 0 : dt / 5)); const ik = 0.55 + 0.45 * (1 - Math.pow(1 - st.intro, 3));   // first look: in close on him and what he is doing, then draws back
      const d = st.dist * (tall ? 1.3 : 1) * ik;                            // portrait phones: pull back so he is not the whole screen
      // orbit, not chase: the angles ease (so a drag turns the camera round him on the circle, never cutting in),
      // the focus trails him a touch, and the arm length snaps in at walls and eases back out
      if (focus.distanceToSquared(tgt) > 9) orb.init = false;   // he jumped (a portal, a hall link): cut to him, don't trail through the walls between
      if (!orb.init) { focus.copy(tgt); orb.yaw = st.yaw; orb.pitch = st.pitch; orb.d = d; orb.init = true; }
      focus.lerp(tgt, 1 - Math.exp(-14 * dt));
      orb.yaw += wrap(st.yaw - orb.yaw) * (1 - Math.exp(-22 * dt));
      orb.pitch = damp(orb.pitch, st.pitch, 22, dt);
      const cp = Math.cos(orb.pitch);
      dir.set(Math.sin(orb.yaw) * cp, Math.sin(orb.pitch), Math.cos(orb.yaw) * cp);
      const R = face(-Math.sin(orb.yaw), -Math.cos(orb.yaw));
      // spring arm: gallery walls, doors and the room's doorway wall (`arm`) stop the camera instead of being cut away (his own room: see face())
      arm ||= walls.filter(w => w.userData.arm); armOut ||= walls.filter(w => w.userData.armOut);
      let armNow = armOut.length ? arm.concat(armOut.filter(w => !inBox(w.userData.armOut))) : arm;   // a small room's walls stop the arm from outside it
      // his room's walls: the ones cut away (facing) let the camera through, the standing ones stop it
      const up = R ? mine.get(R).filter(w => !facing.has(w)) : [];
      if (R) armNow = armNow.filter(w => !facing.has(w)).concat(up.filter(w => !armNow.includes(w)));
      ray.set(focus, dir); ray.far = d + ARM_PAD;
      const h = ray.intersectObjects(armNow, false).find(h => live(h.object));   // (one we cut away last frame still stops it)
      getProps();
      // props right by him (the chair back behind him, the seat he is in) are cut away like walls; further ones stop the arm
      occl.length = 0; hugs.length = 0;
      const hp = ray.intersectObjects(props, false).find(h => { if (!h.object.visible && !hidden.has(h.object)) return false;   // (last frame's cut-aways still count)
 if (h.distance < OCCL) { occl.push(h.object); return false; } return true; });
      let free = hp && (!h || hp.distance < h.distance) ? Math.max(0.6, hp.distance - 0.35) : null;
      if (free === null) free = h ? Math.max(0.55, h.distance - ARM_PAD) : d;
      // sideways: nothing may sit within 14 cm of the lens either (the near plane is 10 cm). `lens` (below) adds what
      // only gets cut away once it hugs the lens: the wardrobe doors, the doorway's trim walls
      lens ||= props.concat(scene.children.flatMap(function f(o) { return [o, ...o.children.flatMap(f)]; }).filter(o => o.isMesh && o.userData.door && !walls.includes(o)), arm);
      for (let k = 0; k < 8 && free > 0.6; k++) {
        const c = focus.clone().addScaledVector(dir, free); let near = false;
        for (const a of LENS_AX) { ray.set(c, a); ray.far = 0.16; if (ray.intersectObjects(props, false).some(q => q.object.visible && !occl.includes(q.object)) || ray.intersectObjects(up, false).length) { near = true; break; } }
        if (!near) break; free -= 0.12;
      }
      ray.set(focus, dir); ray.far = d + ARM_PAD;
      // furniture: a low lens must not sit inside (or hug) a prop, or its faces fill the frame
      for (; free > 0.6; free -= 0.1) {
        const px = focus.x + dir.x * free, py = focus.y + dir.y * free, pz = focus.z + dir.z * free;
        if (py > 1.7 || !solids.some(b => px > b[0] - 0.22 && px < b[2] + 0.22 && pz > b[1] - 0.22 && pz < b[3] + 0.22)) break;
      }
      // the walls have no ceiling: a high lens can clear a wall's top and look down on him from the next corridor, the
      // wall between. Pull in until the line from the lens to his middle is clear of them
      for (let k = 0; k < 12 && free > 0.6; k++, free -= 0.15) {
        const c = focus.clone().addScaledVector(dir, free), v = headW.set(pos.x, 1.0, pos.z).sub(c), L = v.length();
        ray.set(c, v.normalize()); ray.far = L;
        if (!ray.intersectObjects(armNow, false).some(q => live(q.object))) break;
      }
      free = Math.max(free, 0.6);
      ray.set(focus, dir); ray.far = d + ARM_PAD;
      orb.d = free < orb.d ? free : damp(orb.d, free, 5, dt);
      camera.position.copy(focus).addScaledVector(dir, orb.d);
      // a short arm (a corridor, a corner) aims lower, at his middle, so head to boots still fit in the frame
      const drop = 0.45 * Math.min(1, Math.max(0, (1.6 - orb.d) / 1.0));
      camera.lookAt(focus.x, focus.y - drop, focus.z); camera.fov = tall ? 66 : 50;
      // the arm can't pull in any further (0.6 m) and a prop still hugs the lens (the tees inside the wardrobe, a corner
      // plant's leaves, an open wardrobe door): cut it away like the ones right by him
      for (const a of LENS_AX) { ray.set(camera.position, a); ray.far = 0.14; for (const q of ray.intersectObjects(lens, false)) if (walls.includes(q.object)) { if (!ofHere(q.object) && !q.object.userData.door && !q.object.userData.low && !q.object.userData.hall) cutWall(q.object, 'lens'); } else if ((q.object.visible || hidden.has(q.object)) && !occl.includes(q.object)) hugs.push(q.object); }
    }
    camera.updateProjectionMatrix();
    // cut away any wall still between camera and player (top-down, tight corners)
    for (const w of hidden) w.visible = true; hidden.clear();
    if (st.view === 'third') {
      for (const o of occl) if (!fadeProp(o)) { o.visible = false; hidden.add(o); }   // (no fade-able material: pops as before)
      for (const o of hugs) { o.visible = false; hidden.add(o); }                      // hugging the lens: gone at once
    }
    if (st.view !== 'first') {
      // camera parked inside a wall: its back-face ink hull would fill the screen black
      // (his room's walls: only when the lens is truly inside one; the cutaway decides the rest)
      if (!boxes) boxes = walls.filter(w => !w.userData.door).map(w => [w, new THREE.Box3().setFromObject(w).expandByScalar(w.userData.arm ? 0.02 : 0.3), new THREE.Box3().setFromObject(w).expandByScalar(0.02)]);
      for (const [w, b, tight] of boxes) if ((ofHere(w) ? tight : b).containsPoint(camera.position)) cutWall(w, 'box');
      // three rays (centre, and 0.35 m to either side of him) so a wall grazing the line of sight stays cut instead of flickering
      const side = new THREE.Vector3(Math.cos(orb.yaw), 0, -Math.sin(orb.yaw));
      for (const off of [0, -0.35, 0.35]) {
        tgt.set(pos.x + side.x * off, 1.0, pos.z + side.z * off);
        const v = tgt.clone().sub(camera.position), L = v.length();
        ray.set(camera.position, v.normalize()); ray.far = Math.max(0, L - 0.35);
        for (const h of ray.intersectObjects(walls, false)) {
          if (ofHere(h.object) || h.object.userData.low || h.object.userData.door || h.object.userData.hall) continue;   // his room: the cutaway's call. Half walls, doors, halls stay
          if (st.view === 'third' && (h.object.userData.door || orb.d > 0.62) && (h.object.userData.arm || (h.object.userData.armOut && !inBox(h.object.userData.armOut)))) continue;   // those stop the camera instead (a door must never blink out mid-push), unless the arm is fully in and one is still between
          cutWall(h.object, 'ray' + off);
        }
      }
    }
    clock += dt; stepCuts(dt); stepProps(dt);
  }

  // --- tap-to-walk: follow nav waypoints; any stick / key input takes back control
  const auto = { pts: null, done: null, face: null };
  function goTo(x, z, { done = null, face = null } = {}) {
    if (st.seated) stand();
    const pts = nav.path(pos.x, pos.z, x, z);
    auto.pts = pts && pts.length ? pts : null; auto.done = done; auto.face = face;
    if (!auto.pts && done) done();                                   // already there / nowhere to go
    return auto.pts ? auto.pts[auto.pts.length - 1] : null;
  }
  function cancelAuto() { auto.pts = null; auto.done = null; auto.face = null; }

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
    let running = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(move.x, move.y) > 0.95;
    let target = st.seated || st.frozen ? 0 : mag * (running ? RUN : WALK * (posture?.state.gait || 1));
    if (mag > 0.2) { cancelAuto(); st.turnTo = null; }
    if (st.turnTo != null && !auto.pts && !st.seated) {
      st.heading += wrap(st.turnTo - st.heading) * (1 - Math.exp(-10 * dt));
      if (Math.abs(wrap(st.turnTo - st.heading)) < 0.01) st.turnTo = null;
    }
    else if (auto.pts && !st.frozen) {
      const [wx, wz] = auto.pts[0], dx = wx - pos.x, dz = wz - pos.z, d = Math.hypot(dx, dz);
      let left = d; for (let i = 1; i < auto.pts.length; i++) left += Math.hypot(auto.pts[i][0] - auto.pts[i - 1][0], auto.pts[i][1] - auto.pts[i - 1][1]);
      if (d < (auto.pts.length > 1 ? 0.25 : 0.06)) {
        auto.pts.shift();
        if (!auto.pts.length) {
          const { done, face } = auto; cancelAuto();
          st.turnTo = face ? Math.atan2(face[0] - pos.x, face[1] - pos.z) : null;
          if (done) done();
        }
      } else {
        mv.set(dx / d, 0, dz / d);
        target = Math.min(left > 4 ? RUN : WALK * (posture?.state.gait || 1), 0.6 + left * 2.5);
      }
    }
    st.speed = damp(st.speed, target, 8, dt);
    if (mv.lengthSq() > 1e-4 && !st.seated) {
      mv.normalize();
      const h = Math.atan2(mv.x, mv.z);
      st.heading += wrap(h - st.heading) * (1 - Math.exp(-12 * dt));
      const step = st.speed * dt;
      pos.addScaledVector(mv, step);
      const wx = pos.x, wz = pos.z;
      collide(pos);
      // walked into something: how much of this frame's step the walls took back (1 = head on). Counted once per
      // contact (main.js plays a bump) and he loses his momentum
      const lost = step > 1e-4 ? Math.hypot(wx - pos.x, wz - pos.z) / step : 0;
      if (lost > 0.8 && !st.blocked && st.speed > 1.1) { st.bumps++; st.speed *= 0.25; }
      st.blocked = lost > 0.8 || (st.blocked && lost > 0.3);
    }
    man.root.position.x = pos.x; man.root.position.z = pos.z;
    man.root.rotation.y = st.heading + (st.seated && st.spec?.turn || 0);
    man.root.rotation.x = st.seated && (st.seated.pose === 'lying' || (ACTS[st.seated.act] && st.spec?.lie)) ? -Math.PI / 2 : 0;
    anim(dt, t);
    if (st.seated) man.root.position.y += 0;                         // pose() set the seated drop
    if (!companion) cam(dt);
  }

  // feet never sink into the floor: lift the root so the lowest sole point rests on it (checked on the soles'
  // lowest rest-pose vertices, skinned for this frame)
  const soles = []; man.root.traverse(o => { if (o.isSkinnedMesh && /^sole/.test(o.name) && o.layers.mask & 1) soles.push(o); });
  const low = soles.map(m => {
    const p = m.geometry.attributes.position, ids = [...Array(p.count).keys()].sort((i, j) => p.getY(i) - p.getY(j));
    return ids.filter((_, k) => k % 3 === 0).slice(0, 40);              // a spread over the tread
  });
  const sv = new THREE.Vector3();
  function plant() {
    man.root.updateMatrixWorld(true);
    let min = Infinity;
    soles.forEach((m, k) => { for (const i of low[k]) { m.getVertexPosition(i, sv); min = Math.min(min, sv.applyMatrix4(m.matrixWorld).y); } });
    if (min < 0) { man.root.position.y -= min; man.root.updateMatrixWorld(true); }
  }

  function sit(spot) {                                              // spot: { x, z, heading, pose?, out? }
    cancelAuto();
    spot.t = 0; spot.tt = 0; spot.faceNow = null; st.spec = null;
    spot.from = Object.fromEntries(Object.entries(man.bones).map(([n, b]) => [n, b.quaternion.clone()])); spot.fromY = man.root.position.y;
    st.seated = spot; pos.set(spot.x, 0, spot.z); st.heading = spot.heading; st.speed = 0;
    if (ACTS[spot.act]) st.spec = ACTS[spot.act](0, 0, spot);             // lie / turn known from the first frame
    spot.enter?.(spot);
  }
  function stand() {
    const s = st.seated; if (!s) return;   // already up (a door push ending after Esc / a tap stood him up)
    st.seated = null; st.spec = null; man.pose('stand'); man.root.rotation.x = 0; man.face('neutral');
    s.leave?.(s);
    if (s.out) pos.set(s.out[0], 0, s.out[1]);
    else { pos.x += Math.sin(s.heading) * 0.45; pos.z += Math.cos(s.heading) * 0.45; }
    collide(pos);
  }
  function cycleView() { st.view = VIEWS[(VIEWS.indexOf(st.view) + 1) % VIEWS.length]; if (st.view === 'first') st.pitch = 0; else st.pitch = 0.38; return st.view; }

  return { pos, st, keys, update, setCamFocus: fn => { camFocus = fn; }, sit, stand, goTo, cancelAuto, auto, cycleView, POSES, dbg: { cuts, orb, facing, room: () => here, sides: () => sides, attached, unitOf } };   // dbg: tests/walls.mjs
}
