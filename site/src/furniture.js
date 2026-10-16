// The rest of the room (brief §2 stations): computer desk, bed, bookshelf, CRT on a cabinet, pinboard, spiral rug.
// Same kit as room.js: toon boxes / cylinders with ink hulls, canvas-drawn faces. Wall-hung pieces are children of
// their wall so they cut away with it.
import * as THREE from 'three';
import { mesh, toon } from './look.js';
import { PAL } from './textures.js';

const box = (w, h, d, c, o = { ink: 0.01 }) => mesh(new THREE.BoxGeometry(w, h, d), c, o);
const cyl = (rt, rb, h, c, o = { ink: 0.008 }, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, o);
function at(o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; return o; }

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData = { g, w, h };
  return t;
}
const flat = (w, h, tex) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon(null, { map: tex, unlit: true }));

// ---------- desk + monitor + chair (front wall; he sits facing +z)
function desk() {
  const g = new THREE.Group();
  g.add(at(box(1.6, 0.05, 0.6, PAL.wood, { ink: 0.012, mat: 'wood' }), 0, 0.695, 0));        // top at 0.72
  for (const [x, z] of [[-0.75, -0.25], [0.75, -0.25], [-0.75, 0.25], [0.75, 0.25]]) g.add(at(box(0.05, 0.67, 0.05, PAL.ink, { ink: false, mat: 'metal', matAxis: 'y' }), x, 0.335, z));
  g.add(at(box(0.42, 0.45, 0.5, '#8A1F3D', { ink: 0.01, mat: 'paint', matAxis: 'y' }), 0.55, 0.225, 0.02));         // drawer block
  for (const y of [0.13, 0.31]) g.add(at(box(0.12, 0.025, 0.02, PAL.spiral, { ink: 0.004, mat: 'metal' }), 0.55, y, -0.235));
  // monitor: screen faces -z (into the room, toward the chair)
  const mon = new THREE.Group();
  mon.add(at(box(0.78, 0.48, 0.05, PAL.ink, { ink: 0.01, mat: 'plastic' }), 0, 0.3, 0));
  const site = new THREE.TextureLoader().load('/media/infinite/site.webp'); site.colorSpace = THREE.SRGBColorSpace; site.anisotropy = 4;
  const scr = flat(0.7, 0.4, site);                                // infinitedevices.org (sit at the desk -> link)
  scr.rotation.y = Math.PI; scr.position.set(0, 0.3, -0.03); mon.add(scr);
  mon.add(at(box(0.06, 0.12, 0.06, PAL.ink, { ink: false }), 0, 0.03, 0.02));
  mon.add(at(box(0.26, 0.02, 0.18, PAL.ink, { ink: false }), 0, 0.0, 0.02));
  g.add(at(mon, -0.15, 0.73, 0.12));
  g.add(at(box(0.5, 0.025, 0.16, PAL.lav, { ink: 0.006, mat: 'plastic' }), -0.15, 0.7325, -0.13));   // keyboard
  g.add(at(box(0.07, 0.025, 0.1, PAL.lav, { ink: 0.005, mat: 'plastic' }), -0.5, 0.7325, -0.12));    // mouse (his right)
  const mug = at(cyl(0.045, 0.04, 0.1, PAL.spiral, { ink: 0.006, mat: 'glaze' }), 0.3, 0.77, -0.02); g.add(mug);
  g.userData.screen = scr;
  return g;
}

function chair() {
  const g = new THREE.Group();
  g.add(at(cyl(0.24, 0.24, 0.07, PAL.blue, { ink: 0.011, mat: 'fabric' }, 24), 0, 0.45, 0));         // seat top 0.485
  g.add(at(box(0.44, 0.48, 0.07, PAL.blue, { ink: 0.011, mat: 'fabric' }), 0, 0.8, -0.24));
  g.add(at(box(0.04, 0.3, 0.04, PAL.ink, { ink: false, mat: 'metal', matAxis: 'y' }), 0, 0.55, -0.24));
  g.add(at(cyl(0.025, 0.025, 0.37, PAL.ink, { ink: false, mat: 'metal', matAxis: 'y' }), 0, 0.24, 0));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, leg = box(0.3, 0.03, 0.04, PAL.ink, { ink: false, mat: 'plastic' });
    leg.position.set(Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15); leg.rotation.y = -a; g.add(leg);
  }
  return g;
}

const soft = (o, n) => { o.userData.phys = 'soft'; if (n) o.name = n; return o; };     // physics.js: may sink 2 cm

// ---------- bed (back-left corner, head on the back wall)
function bed() {
  const g = new THREE.Group();                                   // local: x across (1.3), z along (2.0), head at -z
  g.add(at(box(1.34, 0.3, 2.04, PAL.wood, { ink: 0.012, mat: 'wood', matAxis: 'z' }), 0, 0.15, 0));
  g.add(at(Object.assign(box(1.34, 0.9, 0.08, PAL.wood, { ink: 0.012, mat: 'wood' }), { name: 'headboard' }), 0, 0.45, -1.0));        // headboard
  g.add(at(soft(box(1.24, 0.2, 1.9, PAL.white, { ink: 0.01, mat: 'fabric', matAmt: 0.6 }), 'mattress'), 0, 0.4, 0.02));          // mattress
  const quilt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = PAL.mag; g.fillRect(0, 0, w, h);
    g.strokeStyle = PAL.spiral; g.lineWidth = 10;
    for (let i = -h; i < w + h; i += 36) { g.beginPath(); g.moveTo(i, 0); g.quadraticCurveTo(i + 30, h / 2, i - 10, h); g.stroke(); }
  });
  const blanket = mesh(new THREE.BoxGeometry(1.3, 0.08, 1.25), null, { ink: 0.01, map: quilt, mat: 'fabric' });
  g.add(at(blanket, 0, 0.53, 0.38));
  const tucked = mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 20, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).scale(1.3, 0.52, 1), null, { ink: 0.01, map: quilt, mat: 'fabric' });
  tucked.userData.phys = 'cover';                                   // he lies under it: nothing may poke out through the dome
  tucked.userData.cover = p => (Math.abs(p.z) < 0.55 && Math.abs(p.x) < 0.65 && p.y > 0 ? Math.max(0, (Math.hypot(p.x / 0.65, p.y / 0.26) - 1) * 0.26) : 0);
  tucked.visible = false; g.add(at(tucked, 0, 0.5, 0.51));            // waist down: his hands rest on top            // a half-tube draped over his legs, edges on the mattress
  g.userData.sleep = on => { blanket.visible = !on; tucked.visible = on; };
  g.add(at(soft(mesh(new THREE.SphereGeometry(0.3, 18, 10).scale(1.25, 0.24, 0.62), PAL.lav, { ink: 0.01, mat: 'fabric', matAmt: 0.7 }), 'pillow'), 0, 0.562, -0.8));   // pillow
  return g;
}

// ---------- bookshelf (left wall, faces +x)
function bookshelf() {
  const g = new THREE.Group();                                   // local: faces +z; width 1.2, height 2.0, depth 0.34
  const W = 1.2, H = 2.0, D = 0.34, wood = '#8C3A2B';
  const side = () => box(0.05, H, D, wood, { ink: 0.01, mat: 'wood', matAxis: 'y' });
  g.add(at(side(), -W / 2, H / 2, 0)); g.add(at(side(), W / 2, H / 2, 0));
  g.add(at(box(W, H, 0.03, '#5A2418', { ink: 0.006, mat: 'wood', matAxis: 'y', matAmt: 0.6 }), 0, H / 2, -D / 2 + 0.015));
  const cols = [PAL.red, PAL.teal, PAL.lav, PAL.cream, PAL.mag, PAL.green, PAL.spiral, PAL.white, PAL.violet, PAL.orange, PAL.blue];
  let k = 0;
  for (let s = 0; s < 5; s++) {
    const y = 0.04 + s * 0.48;
    g.add(at(box(W, 0.04, D, wood, { ink: 0.008, mat: 'wood' }), 0, y, 0));
    if (s === 4) break;
    let x = -W / 2 + 0.06;
    while (x < W / 2 - 0.12) {
      const bw = 0.04 + ((k * 7) % 5) * 0.012, bh = 0.26 + ((k * 13) % 7) * 0.022;
      const b = box(bw, bh, 0.24, cols[k % cols.length], { ink: 0.005, mat: 'fabric', matAmt: 0.45 });
      at(b, x + bw / 2, y + 0.02 + bh / 2, 0.02);
      if (k % 11 === 5) { b.rotation.z = -0.28; b.position.x += 0.04; x += 0.07; }    // the odd leaning one
      g.add(b); x += bw + 0.008; k++;
    }
  }
  return g;
}

// ---------- CRT on a low cabinet (front wall, screen faces -z); screen is live static on twos
function tv() {
  const g = new THREE.Group();
  g.add(at(box(1.1, 0.55, 0.45, '#2B5C2E', { ink: 0.012, mat: 'wood', matAmt: 0.7 }), 0, 0.275, 0));
  for (const x of [-0.27, 0.27]) g.add(at(cyl(0.025, 0.025, 0.02, PAL.spiral, { ink: 0.004 }), x, 0.38, -0.23)).children.at(-1).rotation.x = Math.PI / 2;
  const set = new THREE.Group();
  set.add(at(box(0.68, 0.54, 0.5, PAL.cream, { ink: 0.012, mat: 'plastic' }), 0, 0.27, 0));
  set.add(at(box(0.5, 0.36, 0.04, PAL.ink, { ink: false }), -0.05, 0.29, -0.24));
  const tex = canvasTex(64, 48, () => {});
  const scr = flat(0.46, 0.32, tex); scr.rotation.y = Math.PI; scr.position.set(-0.05, 0.29, -0.262); set.add(scr);
  for (const y of [0.38, 0.24]) set.add(at(cyl(0.03, 0.03, 0.03, PAL.red, { ink: 0.004 }), 0.26, y, -0.25)).children.at(-1).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) { const ant = cyl(0.008, 0.008, 0.55, PAL.ink, { ink: false }, 6); ant.position.set(s * 0.12, 0.78, 0.05); ant.rotation.z = s * -0.45; set.add(ant); }
  g.add(at(set, 0, 0.55, 0.02));
  const pal = ['#140B52', '#2E3BDB', '#E0368F', '#F1E9D2', '#0B0B0B', '#5A22B8'];
  function noise() {
    const { g: c, w, h } = tex.userData;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { c.fillStyle = pal[(Math.random() * pal.length) | 0]; c.fillRect(x, y, 2, 2); }
    c.fillStyle = 'rgba(246,226,122,.8)'; c.fillRect(0, (Math.random() * h) | 0, w, 2);
    tex.needsUpdate = true;
  }
  noise();
  return { g, noise, scr };
}

// ---------- pinboard (timeline lives here later)
function pinboard() {
  const tex = canvasTex(400, 280, (g, w, h) => {
    g.fillStyle = '#C98A4B'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(90,40,10,.25)'; for (let i = 0; i < 600; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    const notes = [[30, 26, PAL.paper, '2019'], [150, 40, PAL.spiral, '2020'], [270, 22, PAL.lav, '2023'], [52, 150, PAL.mag, '2023'], [180, 160, PAL.teal, '2026'], [290, 140, PAL.paper, '→']];
    notes.forEach(([x, y, c, t], i) => {
      g.save(); g.translate(x + 45, y + 45); g.rotate((i % 3 - 1) * 0.08);
      g.fillStyle = c; g.fillRect(-45, -45, 90, 90); g.strokeStyle = PAL.ink; g.lineWidth = 3; g.strokeRect(-45, -45, 90, 90);
      g.fillStyle = PAL.ink; g.font = "800 30px 'Bricolage Grotesque', sans-serif"; g.textAlign = 'center'; g.fillText(t, 0, 12);
      g.fillStyle = PAL.red; g.beginPath(); g.arc(0, -36, 6, 0, 7); g.fill();
      g.restore();
    });
    g.strokeStyle = PAL.red; g.lineWidth = 3; g.beginPath(); g.moveTo(75, 70); g.lineTo(195, 85); g.lineTo(315, 67); g.lineTo(225, 205); g.stroke();
  });
  const g = new THREE.Group();
  g.add(box(1.14, 0.84, 0.04, PAL.wood, { ink: 0.008, mat: 'wood' }));
  const face = flat(1.04, 0.74, tex); face.position.z = 0.022; g.add(face);
  return g;
}

// ---------- spiral rug (floor decal, no ink)
function rug() {
  const tex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = PAL.blue; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, 7); g.fill();
    g.strokeStyle = PAL.mag; g.lineWidth = 26; g.beginPath();
    for (let i = 0; i <= 400; i++) { const t = i / 400, a = t * 5.5 * Math.PI * 2, r = t * (w / 2 - 30); const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.strokeStyle = PAL.ink; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, 7); g.stroke();
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.material.map.premultiplyAlpha = false;
  m.rotation.x = -Math.PI / 2;
  return m;
}

// Lay it all out. Room: x -4..4, z -3..3 (front wall z = +3 is the camera side). Returns station anchors.
export function furnish({ room, walls, solid, W, D }) {
  const left = walls.find(w => Math.abs(w.position.x + W / 2) < 0.01);
  const hang = (wallMesh, o, x, y, z, ry) => { at(o, x - wallMesh.position.x, y - wallMesh.position.y, z - wallMesh.position.z, ry); wallMesh.add(o); return o; };

  const dk = at(desk(), -0.5, 0, D / 2 - 0.36, 0); room.add(dk);
  solid(-1.3, D / 2 - 0.66, 0.3, D / 2);
  const ch = at(chair(), -0.65, 0, D / 2 - 0.87, 0); room.add(ch);
  const CHAIR = { x: -0.65, z: D / 2 - 0.87, heading: 0, act: 'desk', out: [-0.65, D / 2 - 1.45] };

  const bd = at(bed(), -W / 2 + 0.72, 0, -D / 2 + 1.06, 0); room.add(bd);
  solid(-W / 2, -D / 2, -W / 2 + 1.4, -D / 2 + 2.1);
  const BED = { x: -W / 2 + 0.72, z: -D / 2 + 1.95, heading: 0, act: 'bed', lying: true, out: [-W / 2 + 1.75, -D / 2 + 1.3], enter: () => bd.userData.sleep(true), leave: () => bd.userData.sleep(false) };

  const bs = at(bookshelf(), -W / 2 + 0.22, 0, 1.25, Math.PI / 2); room.add(bs);
  solid(-W / 2, 0.62, -W / 2 + 0.4, 1.88);

  const t = tv(); at(t.g, 2.05, 0, D / 2 - 0.3, 0); room.add(t.g);
  solid(1.48, D / 2 - 0.55, 2.62, D / 2);

  const pb = hang(left, pinboard(), -W / 2 + 0.07, 1.65, -0.35, Math.PI / 2);

  const rg = rug(); rg.position.set(0.3, 0.004, 0.45); room.add(rg);

  return { desk: dk, chair: ch, CHAIR, bed: bd, BED, bookshelf: bs, tv: t.g, tvNoise: t.noise, tvScreen: t.scr, pinboard: pb };
}
