// The wardrobe (right wall, between the lamp and the doorway): a mustard two-door cupboard. Inside, the outfits.js
// catalogue: tees on a rail, trousers folded on a shelf, shoes on the floor of it, hats up top. The doors swing out
// when he comes to dress (main.js 'wardrobe' station + #card .fitc panel).
// Local frame: width along x (1.2), front at +z, floor y = 0.
import * as THREE from 'three';
import { mesh, toon } from './look.js';
import { PAL } from './textures.js';
import { SLOTS, printTex } from './outfits.js';

export const WARD = { w: 1.2, d: 0.55, h: 2.1 };
const BODY = '#E8B53A', BODY_SH = '#8A5A12', INSIDE = '#2A1A5E';
const box = (w, h, d, c, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), c, { ink: 0.009, mat: 'wood', ...o });
const at = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; return o; };

// a tee's outline (front view, collar at the top), extruded thin
function teeGeo() {
  const s = new THREE.Shape(), w = 0.2, sl = 0.29, h = 0.56;
  s.moveTo(-0.05, 0); s.quadraticCurveTo(0, -0.035, 0.05, 0);              // neckline
  s.lineTo(0.13, -0.01); s.lineTo(sl, -0.11); s.lineTo(0.25, -0.2); s.lineTo(w, -0.16);
  s.lineTo(w, -h); s.lineTo(-w, -h); s.lineTo(-w, -0.16);
  s.lineTo(-0.25, -0.2); s.lineTo(-sl, -0.11); s.lineTo(-0.13, -0.01); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: false });
  g.translate(0, 0, -0.008);
  // uv: 0..1 over the shirt so prints sit like on him
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + sl) / (2 * sl), 1 + p.getY(i) / h);
  return g;
}
function hanger() {
  const g = new THREE.Group(), c = '#C99A5B';
  const bar = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6).rotateZ(Math.PI / 2), c, { ink: 0.004, mat: 'wood' });
  g.add(bar);
  for (const s of [-1, 1]) { const arm = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.2, 6), c, { ink: 0.004, mat: 'wood' }); arm.rotation.z = s * 1.25; arm.position.set(s * 0.09, 0.035, 0); g.add(arm); }
  const hook = mesh(new THREE.TorusGeometry(0.025, 0.004, 6, 12, Math.PI * 1.3), PAL.lav, { ink: false, mat: 'metal' });
  hook.position.y = 0.09; hook.rotation.z = -0.3; g.add(hook);
  return g;
}

export function wardrobe() {
  const { w, d, h } = WARD, t = 0.035, g = new THREE.Group(); g.name = 'wardrobe';
  const shell = { shade: 0.4, shadeCol: BODY_SH };
  // carcass on little feet, a crown moulding on top
  const y0 = 0.08;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(box(0.06, y0, 0.06, PAL.ink, { mat: 'plastic', ink: 0.005 }), x * (w / 2 - 0.06), y0 / 2, z * (d / 2 - 0.06)));
  for (const s of [-1, 1]) g.add(at(box(t, h - y0, d, BODY, shell), s * (w / 2 - t / 2), y0 + (h - y0) / 2, 0));
  g.add(at(box(w, t, d, BODY, shell), 0, y0 + t / 2, 0));
  g.add(at(box(w + 0.06, 0.07, d + 0.04, BODY, shell), 0, h - 0.035, 0.01));
  g.add(at(box(w - 2 * t, h - y0, 0.02, INSIDE, { mat: 'wood', shade: 0.5 }), 0, y0 + (h - y0) / 2, -d / 2 + 0.01));
  const inner = w - 2 * t;
  // hat shelf + rail
  g.add(at(box(inner, 0.025, d - 0.04, BODY, shell), 0, 1.8, -0.01));
  const rail = mesh(new THREE.CylinderGeometry(0.012, 0.012, inner, 10).rotateZ(Math.PI / 2), '#CFC8F0', { ink: 0.004, mat: 'metal' });
  rail.position.set(0, 1.7, 0); g.add(rail);
  // trouser shelf
  g.add(at(box(inner, 0.025, d - 0.04, BODY, shell), 0, 0.56, -0.01));

  // tees on hangers, slanted so their fronts show between the doors
  const tees = [], step = (inner - 0.2) / (SLOTS.upper.length - 1);
  SLOTS.upper.forEach((it, i) => {
    const tg = new THREE.Group(); tg.name = 'tee ' + it.id;
    const hg = hanger(); tg.add(hg);
    const mat = it.print ? { map: printTex(it.print), shadeCol: '#140B52' } : { shadeCol: it.shadeCol };
    const tee = mesh(teeGeo(), it.print ? '#ffffff' : it.color, { ink: 0.006, mat: 'fabric', ...mat });
    tee.position.y = 0.02; tg.add(tee);
    tg.position.set(-inner / 2 + 0.1 + i * step, 1.6, 0);
    tg.rotation.y = 1.0 + Math.sin(i * 2.3) * 0.08;
    tg.userData.rest = tg.rotation.y;
    g.add(tg); tees.push({ id: it.id, g: tg });
  });
  // trousers folded in two stacks
  const pants = [];
  SLOTS.lower.forEach((it, i) => {
    const stack = i % 2, k = Math.floor(i / 2);
    const p = box(0.4, 0.05, 0.3, it.color, { mat: 'fabric', ink: 0.006, shadeCol: it.shadeCol });
    at(p, (stack ? 0.24 : -0.24) + Math.sin(i * 1.7) * 0.015, 0.6 + k * 0.052, 0.0, Math.sin(i * 3.1) * 0.06);
    p.name = 'pants ' + it.id; g.add(p); pants.push({ id: it.id, m: p });
  });
  // shoes: a pair each on the cupboard floor
  const shoes = [], sw = inner / SLOTS.shoes.length;
  SLOTS.shoes.forEach((it, i) => {
    const pair = new THREE.Group(); pair.name = 'shoes ' + it.id;
    for (const s of [-1, 1]) {
      const up = box(0.065, 0.07, 0.2, it.boot, { mat: 'vinyl', ink: 0.005, shadeCol: it.bootSh });
      const so = box(0.07, 0.022, 0.21, it.sole, { mat: 'plastic', ink: 0.004 });
      up.position.set(s * 0.042, 0.046, 0); so.position.set(s * 0.042, 0.011, 0.005);
      pair.add(up, so);
    }
    at(pair, -inner / 2 + sw * (i + 0.5), y0 + t, 0.05, Math.sin(i * 2.1) * 0.15);
    g.add(pair); shoes.push({ id: it.id, g: pair });
  });
  // hats on the top shelf
  const hats = [];
  SLOTS.hat.filter(it => it.hat).forEach((it, i, all) => {
    const hg = new THREE.Group(); hg.name = 'hat ' + it.id;
    const dome = mesh(new THREE.SphereGeometry(0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, it.hat === 'bucket' ? 0.8 : 0.9, 1), it.color, { ink: 0.005, mat: 'fabric' });
    hg.add(dome);
    if (it.hat === 'cap') { const b = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.008, 16, 1, false, -Math.PI / 2, Math.PI), it.color, { ink: 0.004, mat: 'fabric' }); b.position.set(0, 0.004, 0.04); hg.add(b); }
    if (it.hat === 'bucket') { const b = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.02, 18, 1, true), it.color, { ink: 0.004, mat: 'fabric' }); b.material.side = THREE.DoubleSide; b.position.y = 0.005; hg.add(b); }
    if (it.hat === 'beanie') { const pom = mesh(new THREE.SphereGeometry(0.02, 8, 6), it.color, { ink: 0.003 }); pom.position.y = 0.07; hg.add(pom); }
    at(hg, -inner / 2 + 0.11 + i * (inner - 0.22) / (all.length - 1), 1.8125, 0.0, 0.35 * Math.sin(i * 1.9));
    g.add(hg); hats.push({ id: it.id, g: hg });
  });

  // doors: hinged at the outer edges, swing out; a long mirror on the inside of the right one
  const doors = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * w / 2, y0 + 0.01, d / 2 + 0.012); g.add(piv);
    const leaf = box(w / 2 - 0.005, h - y0 - 0.09, 0.024, BODY, shell); leaf.position.set(-s * (w / 4), (h - y0 - 0.09) / 2, 0); piv.add(leaf);
    const panel = box(w / 2 - 0.14, h - y0 - 0.5, 0.008, '#F2C65A', { mat: 'wood', ink: 0.004, shadeCol: BODY_SH }); panel.position.set(-s * (w / 4), (h - y0) / 2, 0.015); piv.add(panel);
    const knob = mesh(new THREE.SphereGeometry(0.022, 10, 8), PAL.red, { ink: 0.004, mat: 'glaze' }); knob.position.set(-s * (w / 2 - 0.07), 1.0, 0.03); piv.add(knob);
    if (s > 0) {
      const mirror = new THREE.Mesh(new THREE.PlaneGeometry(w / 2 - 0.16, 1.3), toon('#BFE6F2', { unlit: true }));
      mirror.position.set(-s * (w / 4), 1.0, -0.0135); mirror.rotation.y = Math.PI; piv.add(mirror);
      const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.9), toon('#FFFFFF', { unlit: true }));
      glint.position.set(-s * (w / 4) - 0.06, 1.05, -0.014); glint.rotation.set(0, Math.PI, 0.35); piv.add(glint);
    }
    for (const o of piv.children) o.userData.door = true;
    doors.push({ piv, s });
  }

  // doors: 0 shut .. 1 open (ease toward the target each frame); the picked items lift a little off the rail
  const st = { open: 0, want: 0, pick: {} };
  function update(dt, t) {
    st.open += (st.want - st.open) * (1 - Math.exp(-5 * dt));
    for (const { piv, s } of doors) piv.rotation.y = s * 1.75 * st.open;
    for (const it of tees) {
      const on = st.pick.upper === it.id;
      it.g.rotation.y += ((on ? 0.6 : it.g.userData.rest) - it.g.rotation.y) * (1 - Math.exp(-6 * dt));
      it.g.position.z += ((on ? 0.09 : 0) - it.g.position.z) * (1 - Math.exp(-6 * dt));
    }
    for (const it of pants) it.m.position.z += ((st.pick.lower === it.id ? 0.06 : 0) - it.m.position.z) * (1 - Math.exp(-6 * dt));
    for (const it of shoes) it.g.position.z += ((st.pick.shoes === it.id ? 0.12 : 0.05) - it.g.position.z) * (1 - Math.exp(-6 * dt));
    for (const it of hats) it.g.position.y = 1.8125 + (st.pick.hat === it.id ? 0.03 + Math.sin(t * 4) * 0.01 : 0);
  }
  g.userData.wardrobe = true;
  return {
    group: g, update,
    open: on => { st.want = on ? 1 : 0; if (!on) st.pick = {}; },
    pick: fit => { st.pick = { ...fit }; },
    get isOpen() { return st.open > 0.5; }, get opening() { return st.want > 0; },
  };
}
