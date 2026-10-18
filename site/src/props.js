// Room props for the acts that had no thing to use: a phone on a side table by the bean bag, a watering can on a
// little stool by the monstera, and an easel with a white canvas, palette and brush, where his art is made (the canvas
// shows the hour's piece as he sketches, refines and renders it). Spots are in the room's frame; acts.js poses him.
import * as THREE from 'three';
import { mesh, toon } from './look.js';
import { PAL } from './textures.js';
import { PHONE, WATER, EASEL, WRITE, TOOLS, HELD, palmFrame } from './acts.js';

const box = (w, h, d, c, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), c, { ink: 0.006, ...o });
const cyl = (rt, rb, h, c, o = {}, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, { ink: 0.005, ...o });
const at = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; return o; };
const frame = s => { const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = s.heading; return g; };
const noPhys = o => { o.traverse(m => { if (m.isMesh) m.userData.phys = 'none'; }); return o; };

export const SPOTS = {
  PHONE: { x: 1.25, z: 0.72, heading: 0, act: 'phone', out: [1.25, 0.6] },
  ANSWER: { x: 1.25, z: 0.72, heading: 0, act: 'phone', ring: true, out: [1.25, 0.6] },
  PLANT: { x: -2.786, z: 1.876, heading: -0.871, act: 'water', out: [-2.55, 1.6] },
  EASEL: { x: 0.9, z: 1.78, heading: 0, act: 'paint', out: [0.9, 1.4] },
};
const TABLE = { x: 1.25, z: 1.2, r: 0.2 }, EZ = { x: 0.9, z: 2.42 };

export function buildProps({ solid, disc }) {
  const g = new THREE.Group(); g.name = 'props';
  disc(TABLE.x, TABLE.z, TABLE.r);
  solid(EZ.x - 0.3, EZ.z - 0.12, EZ.x + 0.3, EZ.z + 0.43);
  // ---- side table + phone (flat on it, screen up; it lights while it rings and while he talks)
  const table = new THREE.Group(); table.name = 'side table';
  table.add(at(cyl(TABLE.r, TABLE.r, 0.03, PAL.wood, { mat: 'wood', ink: 0.006 }, 22), 0, PHONE.table - 0.015, 0));
  table.add(at(cyl(0.025, 0.025, PHONE.table - 0.03, PAL.ink, { mat: 'metal', ink: false }), 0, (PHONE.table - 0.03) / 2, 0));
  table.add(at(cyl(0.15, 0.17, 0.02, PAL.ink, { mat: 'metal', ink: 0.004 }, 20), 0, 0.01, 0));
  at(table, TABLE.x, 0, TABLE.z); g.add(table);
  const phone = new THREE.Group(); phone.name = 'phone';
  phone.add(box(0.07, 0.15, 0.009, PAL.ink, { mat: 'plastic', ink: 0.002 }));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.13), toon('#1B1530', { unlit: true })); scr.position.z = 0.0047; phone.add(scr);                       // screen on +z: up on the table, to his cheek in his hand
  noPhys(phone); g.add(phone);
  // ---- watering can on a low stool at his right (plant frame); built in the hand's frame: grip at the origin, x = the
  // spout's way, y = down along the fingers, z = out of the palm
  const pf = frame(SPOTS.PLANT); g.add(pf);
  const st = new THREE.Group(); st.name = 'plant stool';
  st.add(at(cyl(0.15, 0.15, 0.03, PAL.teal, { mat: 'paint' }, 18), 0, 0.385, 0));
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; st.add(at(cyl(0.015, 0.015, 0.37, PAL.ink, { mat: 'metal', ink: false }), Math.cos(a) * 0.1, 0.185, Math.sin(a) * 0.1)); }
  at(st, WATER.stool[0], 0, WATER.stool[2]); pf.add(st);
  const can = new THREE.Group(); can.name = 'watering can';
  const body = cyl(0.07, 0.075, 0.15, PAL.spiral, { mat: 'metal', ink: 0.004 }, 18); body.position.set(0, 0.15, 0); can.add(body);   // hangs under the grip
  const handle = mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 14, Math.PI), PAL.spiral, { mat: 'metal', ink: 0.002 }); handle.rotation.z = Math.PI; handle.position.set(0, 0.07, 0); can.add(handle);
  const SPA = Math.atan2(-0.88, -0.48);                                   // spout: from the body's side up and out to the rose
  const spout = cyl(0.008, 0.016, 0.25, PAL.spiral, { mat: 'metal', ink: 0.002 }, 8); spout.position.set(0.17, 0.11, 0); spout.rotation.z = SPA; can.add(spout);
  const rose = cyl(0.022, 0.012, 0.025, PAL.spiral, { mat: 'metal', ink: 0.002 }, 10); rose.position.set(0.28, 0.05, 0); rose.rotation.z = SPA; can.add(rose);
  const tipL = new THREE.Vector3(0.29, 0.045, 0);
  noPhys(can); g.add(can);
  const canRest = new THREE.Group(); canRest.position.set(...WATER.stool); pf.add(canRest);   // on the stool, upright (y down), spout to his front
  canRest.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0)));
  // a water stream from the rose to the soil
  const run = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(10 * 6), 3)), new THREE.LineBasicMaterial({ color: '#9AD8FF', transparent: true, opacity: 0.8 }));
  run.frustumCulled = false; run.visible = false; run.userData.phys = 'none'; g.add(run);
  // ---- easel: three legs, a ledge, the canvas leaning back on it, a palette and a brush on the ledge
  const ef = frame(SPOTS.EASEL); g.add(ef);
  const C = EASEL.canvas, lean = Math.atan(C.tilt);
  const easel = new THREE.Group(); easel.name = 'easel';
  const bot = C.y - C.h / 2;
  for (const [x, z, rz, rx] of [[-0.24, C.z + 0.02, 0.12, lean], [0.24, C.z + 0.02, -0.12, lean], [0, C.z + 0.3, 0, -0.32]]) {
    const leg = box(0.03, 1.85, 0.03, PAL.wood, { mat: 'wood', matAxis: 'y', ink: 0.004 }); leg.position.set(x, 0.92, z); leg.rotation.set(rx, 0, rz); easel.add(leg);
  }
  easel.add(at(box(0.66, 0.025, 0.07, PAL.wood, { mat: 'wood', ink: 0.004 }), 0, bot - 0.012, C.z + 0.0));   // ledge
  const cnv = document.createElement('canvas'); cnv.width = 480; cnv.height = 592;
  const cx = cnv.getContext('2d'), tex = new THREE.CanvasTexture(cnv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const board = box(C.w, C.h, 0.025, '#F4F1EA', { mat: 'paint', ink: 0.006 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(C.w - 0.02, C.h - 0.02), toon(null, { map: tex, unlit: true })); face.rotation.y = Math.PI; face.position.z = -0.0131;
  const cg = new THREE.Group(); cg.add(board, face); cg.position.set(0, C.y, C.z + 0.0125); cg.rotation.x = lean; easel.add(cg);
  ef.add(easel);
  // palette: a kidney of wood with dabs of paint, made flat in the palm's plane (z = out of the palm)
  const palette = new THREE.Group(); palette.name = 'palette';
  const pshape = new THREE.Shape(); pshape.absellipse(0, 0, 0.13, 0.09, 0, Math.PI * 2);
  const hole = new THREE.Path(); hole.absellipse(-0.075, -0.02, 0.018, 0.018, 0, Math.PI * 2); pshape.holes.push(hole);
  palette.add(mesh(new THREE.ExtrudeGeometry(pshape, { depth: 0.008, bevelEnabled: false }), '#C9965A', { mat: 'wood', ink: 0.003 }));
  [[PAL.red, 0.02, 0.05], [PAL.orange, 0.06, 0.03], [PAL.spiral, 0.08, -0.01], [PAL.teal, 0.06, -0.05], [PAL.lav, 0.01, -0.06], ['#FFFFFF', -0.03, 0.05]].forEach(([c, x, y]) => {
    const d = mesh(new THREE.SphereGeometry(0.014, 8, 6).scale(1, 1, 0.4), c, { ink: 0.002, mat: 'glaze' }); d.position.set(x, y, 0.009); palette.add(d);
  });
  noPhys(palette); g.add(palette);
  const brush = new THREE.Group(); brush.name = 'paintbrush';
  { const L = TOOLS.paint.reach, B = TOOLS.paint.back; const h = cyl(0.005, 0.006, L + B - 0.03, PAL.red, { mat: 'paint', ink: 0.002 }, 8); h.position.y = (L - 0.03 - B) / 2; brush.add(h);
    const tip = cyl(0.003, 0.007, 0.03, '#2A2A35', { ink: 0.002 }, 8); tip.position.y = L - 0.015; brush.add(tip); brush.userData.tip = tip; }
  noPhys(brush); g.add(brush);
  // on the ledge while he is away from it
  const restPal = new THREE.Group(); restPal.position.set(0.17, bot + 0.004, C.z - 0.02); restPal.rotation.set(-lean - 0.15, Math.PI, 0.3); ef.add(restPal);
  const restBr = new THREE.Group(); restBr.position.set(-0.12, bot + 0.008, C.z - 0.025); restBr.rotation.set(0, 0, Math.PI / 2 - 0.05); ef.add(restBr);
  // ---- desk sheet + pen for letters (chair frame), on the desk only while he writes
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.1), toon('#FBF8F0', { shade: 0.2 })); sheet.rotation.x = -Math.PI / 2; sheet.userData.phys = 'none'; sheet.visible = false; g.add(sheet);
  const pen = new THREE.Group(); { const h = cyl(0.004, 0.004, TOOLS.pen.reach + TOOLS.pen.back, PAL.ink, { ink: 0.001 }, 6); h.position.y = (TOOLS.pen.reach - TOOLS.pen.back) / 2; pen.add(h); }
  noPhys(pen); pen.visible = false; g.add(pen);
  // ---- a mug for a sip where he stands (micro act)
  const mug = noPhys(at(cyl(0.04, 0.036, 0.09, PAL.spiral, { mat: 'glaze', ink: 0.004 }), 0, 0, 0)); mug.visible = false; g.add(mug);

  // ---- holding: an object on a hand's palm, its x = F×N, y = F (fingers), z = N (out of the palm), `off` past the palm
  const pv = new THREE.Vector3(), xv = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  function hold(o, man, h = 'handR', off = HELD, shift = null) {
    const { pos, F, N, PALM_T } = palmFrame(man, h);
    pv.copy(pos).addScaledVector(N, PALM_T + off);
    m4.makeBasis(xv.crossVectors(F, N), F, N);
    if (shift) pv.add(new THREE.Vector3(...shift).applyMatrix4(new THREE.Matrix4().extractRotation(m4)));
    o.position.copy(man.root.localToWorld(pv));
    o.quaternion.setFromRotationMatrix(m4).premultiply(man.root.getWorldQuaternion(q)); o.visible = true;
  }
  const rest = (o, r) => { r.updateMatrixWorld(true); r.matrixWorld.decompose(o.position, o.quaternion, new THREE.Vector3()); o.visible = true; };
  const tw = new THREE.Vector3(), CP = SPOTS.PHONE;
  const onTable = () => { phone.position.set(CP.x + PHONE.on[0], PHONE.table + 0.0045, CP.z + PHONE.on[2]); phone.rotation.set(-Math.PI / 2, 0, 0.3); phone.visible = true; };   // CP heading 0
  const glowCol = new THREE.Color();

  // ---- paint on his hands after a painting stage, until he washes (sim world fluent `paint`): a few flat smudges stuck
  // to each hand bone. Each one is snapped once to the hand's skin: among the hand's vertices in a band along the bone
  // (y, metres from the wrist), the one furthest out in direction (dx, dz) of the bone's frame.
  const DABS = { handR: [[0.05, 1, 0, '#D2483C'], [0.08, 0.6, 0.8, '#3E7FC9'], [0.035, -1, 0, '#E8B83A'], [0.095, 0, -1, '#D2483C'], [0.06, 0, 1, '#2E9C86']],
    handL: [[0.045, -1, 0, '#3E7FC9'], [0.075, -0.6, 0.8, '#E8B83A'], [0.06, 1, 0, '#2E9C86'], [0.09, 0, -1, '#D2483C']] };
  let smudges = null;
  function stick(man) {
    smudges = [];
    man.root.updateMatrixWorld(true);
    for (const [h, ds] of Object.entries(DABS)) {
      const bone = man.bones[h]; if (!bone) continue;
      const inv = new THREE.Matrix4().copy(bone.matrixWorld).invert(), pts = [];
      man.root.traverse(o => { if (o.isSkinnedMesh && (o.name === h + '_1' || o.parent?.name === h + '_1')) {
        const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const v = new THREE.Vector3(); o.getVertexPosition(i, v); pts.push(o.localToWorld(v).applyMatrix4(inv)); } } });
      if (!pts.length) continue;
      for (const [y, dx, dz, c] of ds) {
        const dir = new THREE.Vector3(dx, 0, dz).normalize(), band = pts.filter(p => Math.abs(p.y - y) < 0.012);
        const sp = (band.length ? band : pts).reduce((a, p) => (p.dot(dir) > a.dot(dir) ? p : a));
        const k = smudges.length, m = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 6), toon(c)); m.scale.set(1.5 - (k % 3) * 0.2, 0.6 + (k % 2) * 0.2, 0.1);   // a smear, not a dot
        m.position.copy(sp).addScaledVector(dir, 0.0008); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); m.rotateZ(0.5 + k * 1.3);
        m.visible = false; bone.add(m); smudges.push(m);
      }
    }
  }
  function showPaint(man, on) {
    if (!man) return;
    if (!smudges) { if (!on) return; stick(man); }
    for (const m of smudges) m.visible = on;
  }

  // ---- the canvas: white, or the hour's piece as far as he has got with it
  let pieces = null, img = null, imgFor = null, drawn = '';
  fetch('/art/sim/manifest.json').then(r => (r.ok ? r.json() : null)).then(m => { pieces = m; }).catch(() => {});
  // the piece he is making (or last finished), as the nearest banked still over the 9 axes; the hour's pick when there is no vector
  let vec = null;
  const hourPiece = () => {
    if (!pieces?.length) return null;
    if (vec) {
      let best = null, bd = Infinity;
      for (const p of pieces) { if (!p.axes) continue; let d = 0; for (const k in vec) d += (vec[k] - (p.axes[k] ?? 0.5)) ** 2; if (d < bd) { bd = d; best = p; } }
      if (best) return best.file;
    }
    return pieces[Math.floor(Date.now() / 36e5) % pieces.length].file;
  };
  let doneHour = null;                                          // the hour whose piece he finished: it stays up for the hour
  function paintCanvas(stage, reveal) {
    const want = hourPiece(), hour = Math.floor(Date.now() / 36e5);
    if (stage === 'render' || stage === 'review') doneHour = hour;
    const st = stage || (doneHour === hour ? 'done' : 'blank');
    const key = `${want}|${st}|${Math.round(reveal * 12)}`;
    if (key === drawn) return; drawn = key;
    cx.fillStyle = '#F7F4EC'; cx.fillRect(0, 0, cnv.width, cnv.height);
    if (st !== 'blank' && want) {
      if (imgFor !== want) { imgFor = want; img = new Image(); img.onload = () => { drawn = ''; }; img.src = '/art/sim/' + want; }
      if (img?.complete && img.naturalWidth) {
        const w = cnv.width, h = cnv.height, s = Math.max(w / img.naturalWidth, h / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        const draw = (alpha, gray, upto = 1) => {
          cx.save(); cx.beginPath(); cx.rect(0, 0, w, h * upto); cx.clip();
          cx.globalAlpha = alpha; cx.filter = gray ? 'grayscale(1) contrast(1.6)' : 'none';
          cx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh); cx.restore();
        };
        if (st === 'sketch') draw(0.35, true, 0.15 + 0.85 * reveal);
        else if (st === 'refine') { draw(0.35, true); draw(0.25 + 0.5 * reveal, false); }
        else draw(1, false);
      }
    }
    tex.needsUpdate = true;
  }
  paintCanvas(null, 0);

  // ---- per frame: what is in his hands and where the rest lies
  function update(dt, t, player, man, { stage = null, paint = false, v = null } = {}) {
    vec = v;
    const sp = player.st.seated, spec = player.st.spec || {}, u = sp?.t || 0;
    // phone
    const phoning = sp?.act === 'phone', ringing = phoning && spec.ringing;
    if (man && phoning && spec.phone) hold(phone, man, 'handR', 0.0045); else onTable();
    if (ringing) phone.position.y += Math.max(0, Math.sin(t * 70)) * 0.002;
    glowCol.set(ringing ? (Math.sin(t * 8) > 0 ? '#7FE0C8' : '#2B5C55') : phoning && spec.phone ? '#5A7FD0' : '#1B1530');
    scr.material.uniforms.uColor.value.copy(glowCol);
    // watering can
    const watering = sp?.act === 'water';
    if (man && watering && spec.can) hold(can, man); else rest(can, canRest);
    if (man && watering && spec.pour) {
      can.updateMatrixWorld(true); tw.copy(tipL).applyMatrix4(can.matrixWorld);
      const p = run.geometry.attributes.position;
      for (let i = 0; i < 10; i++) {
        const k = ((t * 1.6 + i / 10) % 1), y = tw.y - k * (tw.y - 0.5);
        const sx = tw.x + Math.sin(i * 2.3) * 0.012, sz = tw.z + Math.cos(i * 1.7) * 0.012;
        p.setXYZ(i * 2, sx, y, sz); p.setXYZ(i * 2 + 1, sx, Math.max(0.5, y - 0.05), sz);
      }
      p.needsUpdate = true; run.visible = true;
    } else run.visible = false;
    // easel: palette on his left palm, brush in his right
    const painting = sp?.act === 'paint';
    if (man && painting && spec.palette) hold(palette, man, 'handL', 0.002, [0.07, 0.03, 0]); else rest(palette, restPal);
    if (man && painting && spec.paint) hold(brush, man); else rest(brush, restBr);
    paintCanvas(painting ? (stage || sp.stage || 'refine') : null, painting ? Math.min(1, u / 90) : 0);
    showPaint(man, paint || (painting && u > 20));
    // letters at the desk
    const writing = sp?.act === 'write';
    sheet.visible = writing;
    if (writing) { sheet.position.set(sp.x + 0.0, WRITE.y - 0.001, sp.z + WRITE.z); sheet.rotation.z = 0.08; }
    if (man && writing && spec.pen) hold(pen, man); else pen.visible = false;
    // a mug for the sip (the micro act, or a sip beat at the desk)
    if (man && spec.mug) hold(mug, man, 'handR', 0.03, [0, 0, 0.0]); else mug.visible = false;
  }

  return {
    group: g, update, spots: SPOTS, paintCanvas, showPaint,
    objs: { phone: [phone, table], plant: [can, st], easel: [easel, cg] },
  };
}
