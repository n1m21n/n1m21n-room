// The Ek Pinjare Mai room (r11 layout) built from simple shapes. Units: metres; floor y = 0.
// A closed 8 x 6 room; the right wall has the doorway to the gallery. Walls facing the camera are cut away (player.js).
import * as THREE from 'three';
import { mesh, toon, addInk, CUT_LAYER } from './look.js';
import * as T from './textures.js';
import { batch } from './batch.js';

const { PAL } = T;
export const W = 8, D = 6, H = 3.4;                 // x -4..4, z -3..3
export const DOOR = { z0: 0.9, z1: 2.3, h: 2.4 };   // doorway in the right wall (x = +4) -> gallery

function box(w, h, d, color, opts) { return mesh(new THREE.BoxGeometry(w, h, d), color, opts); }
function cyl(rt, rb, h, color, opts, seg = 20) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color, opts); }
function at(o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; return o; }

function framed(tex, w, h, x, y, z, ry = 0, rim = PAL.red, pad = 0.12) {
  const g = new THREE.Group();
  g.add(box(w + pad, h + pad, 0.06, rim, { ink: 0.01, mat: 'paint' }));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), toon(null, { map: tex, unlit: true }));
  art.position.z = 0.032;
  g.add(art);
  return at(g, x, y, z, ry);
}

export function buildRoom() {
  const room = new THREE.Group();

  // shell: checker floor, two indigo walls, plum skirting
  const floorTex = T.checkerTex();
  const fg = new THREE.PlaneGeometry(W, D), fuv = fg.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * W / 1.5, fuv.getY(i) * D / 1.5);   // 0.75 m tiles (shader ignores .repeat)
  const floor = new THREE.Mesh(fg, toon(null, { map: floorTex, shade: 0.35, mat: 'lino' }));
  floor.rotation.x = -Math.PI / 2; floor.userData.floor = true;
  room.add(floor);
  const wall = (w, h, d, c, x, y, z) => { const m = at(box(w, h, d, c, { ink: 0.008, shade: 0.35, mat: 'plaster' }), x, y, z); m.userData.wall = true; walls.push(m); return m; };
  const walls = [];
  room.add(wall(W, H, 0.1, PAL.indigo, 0, H / 2, -D / 2));                       // back
  room.add(wall(W, H, 0.1, PAL.indigo, 0, H / 2, D / 2));                        // front (cut away when the camera is outside)
  room.add(wall(0.1, H, D, PAL.plum, -W / 2, H / 2, 0));                         // left
  // right wall: two pieces + lintel around the doorway. Seen from the foyer they stop the chase camera (`arm`); with him
  // in the room they are cut away like the other three when they face the camera (player.js)
  const r0 = DOOR.z0 + D / 2, r1 = D / 2 - DOOR.z1, arm = m => { m.userData.arm = true; return m; };
  room.add(arm(wall(0.1, H, r0, PAL.plum, W / 2, H / 2, -D / 2 + r0 / 2)));
  room.add(arm(wall(0.1, H, r1, PAL.plum, W / 2, H / 2, D / 2 - r1 / 2)));
  room.add(arm(wall(0.1, H - DOOR.h, DOOR.z1 - DOOR.z0, PAL.plum, W / 2, (H + DOOR.h) / 2, (DOOR.z0 + DOOR.z1) / 2)));
  const trim = (o) => { o.userData.wall = true; o.userData.arm = true; walls.push(o); room.add(o); };
  for (const z of [DOOR.z0, DOOR.z1]) trim(at(box(0.16, DOOR.h, 0.08, PAL.white, { ink: 0.009, mat: 'paint', matAxis: 'y' }), W / 2 - 0.04, DOOR.h / 2, z));
  trim(at(box(0.16, 0.08, DOOR.z1 - DOOR.z0 + 0.08, PAL.white, { ink: 0.009, mat: 'paint', matAxis: 'z' }), W / 2 - 0.04, DOOR.h, (DOOR.z0 + DOOR.z1) / 2));

  // window with the night swirl sky
  const win = new THREE.Group();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.35), toon(null, { map: T.skyTex(), unlit: true }));
  sky.position.z = 0.01; win.add(sky); win.userData.sky = sky;   // main.js swaps its map with the time of day
  for (const [w, h, x, y] of [[1.86, 0.09, 0, 0.72], [1.86, 0.09, 0, -0.72], [0.09, 1.5, -0.89, 0], [0.09, 1.5, 0.89, 0], [1.7, 0.06, 0, 0.05], [0.06, 1.35, 0, 0]])
    win.add(at(box(w, h, 0.08, PAL.white, { ink: 0.009, mat: 'paint', matAxis: w > h ? 'x' : 'y' }), x, y, 0.05));
  win.add(at(box(2.0, 0.08, 0.22, PAL.white, { ink: 0.009, mat: 'paint' }), 0, -0.79, 0.12));   // sill
  room.add(at(win, -1.7, 2.0, -D / 2 + 0.06));

  room.add(framed(T.eyePaintingTex(), 0.9, 0.7, 0.75, 2.25, -D / 2 + 0.08));
  room.add(framed(T.spiralPaintingTex(), 0.62, 0.62, 1.85, 2.3, -D / 2 + 0.08));
  room.add(framed(T.snakePaintingTex(), 0.5, 0.7, W / 2 - 0.08, 2.0, -1.8, -Math.PI / 2));   // over the gap between the guitar and the lamp (the wardrobe has the stretch by the door)

  // front wall (desk + TV): a salon hang of his films (2:3 posters, ink frames) and artists (square prints, paper mats).
  // Bottoms stay above the monitor / CRT (1.4 m); x runs left to right as seen from inside the room (it faces -z)
  const tl = new THREE.TextureLoader(), img = url => { const t = tl.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const film = s => img(`/media/films/${s}.webp`), band = s => img(`/media/artists/${s}.webp`);
  const hang = new THREE.Group(); hang.name = 'poster wall';
  for (const [kind, s, x, y] of [
    ['f', 'hamnet-2025', 3.65, 2.2], ['f', 'her-2013', 3.05, 2.2], ['a', 'radiohead', 2.45, 2.5], ['a', 'jeff-buckley', 2.45, 1.95], ['f', 'eternal-sunshine-of-the-spotless-mind-2004', 1.85, 2.25],
    ['a', 'pink-floyd', 1.25, 2.55], ['f', 'spirited-away-2001', 0.75, 2.15], ['a', 'beach-house', 0.2, 2.5], ['a', 'mac-demarco', 0.2, 1.95],
    ['f', 'before-sunset-2004', -0.35, 2.25], ['a', 'tame-impala', -0.95, 2.5], ['a', 'lifafa', -0.95, 1.95], ['f', 'the-truman-show-1998', -1.55, 2.2],
    ['a', 'the-smiths', -2.15, 2.5], ['f', 'good-will-hunting-1997', -2.7, 2.15], ['a', 'peter-cat-recording-co', -3.3, 2.45],
  ]) {
    const f = kind === 'f', w = f ? 0.4 : 0.36, h = f ? 0.6 : 0.36;
    const p = framed(f ? film(s) : band(s), w, h, x, y, D / 2 - 0.08, Math.PI, f ? PAL.ink : PAL.white, f ? 0.06 : 0.1);
    p.rotation.z = ((x * 7.3) % 1 - 0.5) * 0.035; p.name = s; hang.add(p);   // hung by hand: a hair off level
  }
  room.add(hang);

  // record shelf + turntable (back right)
  const shelf = new THREE.Group();
  shelf.add(at(box(1.8, 0.7, 0.42, PAL.wood, { ink: 0.012, mat: 'wood' }), 0, 0.35, 0));
  const spines = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 0.56), toon(null, { map: T.spinesTex(), unlit: true }));
  spines.position.set(0, 0.35, 0.215); shelf.add(spines);
  const tt = turntable(); tt.position.set(0.35, 0.7, 0.01); shelf.add(tt);
  Object.assign(shelf.userData, tt.userData);                    // spin / label / arm for main.js
  room.add(at(shelf, 1.3, 0, -D / 2 + 0.32));

  // keyboard on an X stand: back wall, just left of the record shelf (the music corner: keys, records, guitar)
  const kb = new THREE.Group();
  kb.add(at(box(1.25, 0.1, 0.36, '#241c4f', { ink: 0.012, mat: 'plastic' }), 0, 0.98, 0));       // keys at 1.03: standing height
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.18), toon(null, { map: T.keysTex(), unlit: true }));
  keys.rotation.x = -Math.PI / 2; keys.position.set(0, 1.032, 0.06); kb.add(keys);
  for (const [c, x] of [[PAL.white, -0.5], [PAL.white, -0.42], [PAL.spiral, -0.34], [PAL.white, -0.26]]) kb.add(at(cyl(0.022, 0.022, 0.03, c, { ink: 0.005 }), x, 1.045, -0.11));
  kb.add(at(box(0.26, 0.012, 0.06, PAL.teal, { ink: 0.005 }), 0.38, 1.035, -0.11));
  for (const s of [-1, 1]) {
    const leg = box(0.04, 1.24, 0.04, PAL.ink, { ink: false, mat: 'metal', matAxis: 'y' });
    leg.position.set(0, 0.47, 0); leg.rotation.z = s * 0.72; kb.add(leg);
  }
  room.add(at(kb, -0.3, 0, -2.6, 0));

  // guitar leaning by the shelf
  const gt = new THREE.Group();
  const body = new THREE.Group();
  body.add(at(mesh(new THREE.SphereGeometry(0.23, 24, 16).scale(1, 1, 0.32), PAL.wood, { ink: 0.012, mat: 'wood', matAxis: 'y' }), 0, 0, 0));
  body.add(at(mesh(new THREE.SphereGeometry(0.17, 24, 16).scale(1, 1, 0.32), PAL.wood, { ink: 0.012, mat: 'wood', matAxis: 'y' }), 0, 0.3, 0));
  const hole = at(cyl(0.07, 0.07, 0.01, PAL.ink, { ink: false }), 0, 0.2, 0.075); hole.rotation.x = Math.PI / 2; body.add(hole);
  body.add(at(box(0.07, 0.7, 0.04, '#5A2A1A', { ink: 0.008, mat: 'wood', matAxis: 'y' }), 0, 0.72, 0));
  body.add(at(box(0.1, 0.16, 0.05, '#5A2A1A', { ink: 0.008, mat: 'wood', matAxis: 'y' }), 0, 1.12, 0));
  body.position.y = 0.25; body.rotation.z = 0.12; gt.add(body);
  room.add(at(gt, 2.55, 0, -1.9, -0.3)); gt.userData.body = body; body.name = 'guitar';

  // snake plant in an orange pot
  const sp = new THREE.Group();
  sp.add(at(cyl(0.22, 0.17, 0.42, PAL.orange, { ink: 0.012, mat: 'clay' }), 0, 0.21, 0));
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, h = 0.7 + (i * 37 % 10) / 22;
    const blade = mesh(new THREE.ConeGeometry(0.06, h, 4).scale(1, 1, 0.3), i % 2 ? PAL.green : PAL.greenD, { ink: 0.007, mat: 'blade' });
    blade.position.set(Math.cos(a) * 0.08, 0.42 + h / 2, Math.sin(a) * 0.08);
    blade.rotation.set(Math.sin(a) * 0.25, a, -Math.cos(a) * 0.25);
    sp.add(blade);
  }
  room.add(at(sp, 3.35, 0, -2.5));

  // floor lamp (front right) + light pool decal; spills into the room, not the wall
  const lamp = floorLamp(PAL.spiral, [-0.85, 0.2], [1.3, 0.8]);
  room.add(at(lamp, 3.5, 0, -1.0));   // against the wall: no body-width squeeze behind it

  room.add(at(monstera(), -3.36, 0, 2.36));   // front left

  return { room, shelf, lamp, walls, win, kb, gt };
}

// a suitcase-style turntable (owner ref: assets/refs/turntable-ref.webp): dark walnut plinth on little feet, woven speaker
// grille + volume knob + blue LED on the front, black deck, platter + record (label shows the playing cover), tonearm on
// a pivot at the back right that swings in while a record plays (userData.arm.rotation.y: 0 = rest, ARM_PLAY = on the
// record), and a clear dust lid hinged at the back, propped open. Sits with its base at y 0, about 0.62 x 0.38.
export const ARM_PLAY = -0.75;
export function turntable() {
  const g = new THREE.Group(); g.name = 'turntable';
  const WAL = '#7A3322', PW = 0.62, PH = 0.13, PD = 0.38, top = 0.015 + PH;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(at(cyl(0.02, 0.022, 0.015, PAL.ink, { ink: false, mat: 'plastic' }, 10), x * (PW / 2 - 0.05), 0.0075, z * (PD / 2 - 0.05)));
  g.add(at(box(PW, PH, PD, WAL, { ink: 0.01, mat: 'wood', matAxis: 'x' }), 0, 0.015 + PH / 2, 0));
  g.add(at(box(PW - 0.03, 0.006, PD - 0.03, '#1A1424', { ink: false, mat: 'plastic' }), 0, top + 0.003, 0));   // deck plate
  // front: grille on the left two thirds, knob + LED on the right
  g.add(at(box(0.38, 0.08, 0.008, '#C99A5B', { ink: 0.005, mat: 'cork', matScale: 2.5 }), -0.09, 0.015 + PH / 2, PD / 2 + 0.002));
  const knob = cyl(0.026, 0.028, 0.03, '#C9CCD6', { ink: 0.005, mat: 'metal' }, 18); knob.rotation.x = Math.PI / 2;
  g.add(at(knob, 0.2, 0.015 + PH / 2, PD / 2 + 0.014));
  g.add(at(mesh(new THREE.SphereGeometry(0.005, 8, 6), '#4FA3FF', { ink: false, unlit: true }), 0.15, 0.015 + PH / 2, PD / 2 + 0.003));
  // platter + record, left of centre
  const cx = -0.07, cz = 0.01;
  g.add(at(cyl(0.165, 0.165, 0.014, '#2A2A30', { ink: 0.005, mat: 'metal' }, 40), cx, top + 0.013, cz));
  const disc = at(cyl(0.155, 0.155, 0.006, PAL.ink, { ink: 0.005, mat: 'vinyl' }, 48), cx, top + 0.023, cz);
  const label = cyl(0.052, 0.052, 0.008, PAL.orange, { ink: false }, 32);   // main.js puts the playing cover on it
  disc.add(label);
  disc.add(at(cyl(0.004, 0.004, 0.03, '#C9CCD6', { ink: false, mat: 'metal' }, 8), 0, 0.012, 0));   // spindle
  g.add(disc);
  // tonearm: pivot post + counterweight behind, a straight arm forward, headshell at the tip
  const arm = new THREE.Group(); arm.position.set(0.22, top + 0.006, -0.1);
  arm.add(at(cyl(0.022, 0.026, 0.03, '#C9CCD6', { ink: 0.004, mat: 'metal' }, 16), 0, 0.015, 0));
  const beam = new THREE.Group(); beam.position.y = 0.04; arm.add(beam);
  const rod = cyl(0.005, 0.005, 0.27, '#D8DAE2', { ink: 0.003, mat: 'metal' }, 8); rod.rotation.x = Math.PI / 2; beam.add(at(rod, 0, 0, 0.1));
  const cw = cyl(0.018, 0.018, 0.04, PAL.ink, { ink: 0.004, mat: 'metal' }, 12); cw.rotation.x = Math.PI / 2; beam.add(at(cw, 0, 0, -0.05));
  beam.add(at(box(0.026, 0.014, 0.04, PAL.ink, { ink: 0.004, mat: 'plastic' }), 0, -0.006, 0.245));   // headshell
  g.add(arm);
  g.add(at(box(0.012, 0.03, 0.012, PAL.ink, { ink: false, mat: 'plastic' }), 0.22, top + 0.02, 0.1));   // arm rest
  // dust lid: clear acrylic box with ink edges, hinged along the back top edge, propped open
  const lid = new THREE.Group(); lid.name = 'turntable lid'; lid.position.set(0, top + 0.005, -PD / 2 + 0.005);
  const lg = new THREE.BoxGeometry(PW - 0.01, 0.05, PD - 0.01).translate(0, 0.025, (PD - 0.01) / 2);
  const pane = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: '#DDE6FF', transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }));
  pane.userData.noPhys = true;
  lid.add(pane, new THREE.LineSegments(new THREE.EdgesGeometry(lg), new THREE.LineBasicMaterial({ color: '#E8EEFF', transparent: true, opacity: 0.7 })));
  lid.rotation.x = -1.68;                                           // leans just past upright, like the ref
  g.add(lid);
  g.userData = { spin: disc, label, arm, lid };
  return g;
}

// a standing lamp: ink base + pole + fabric shade, with a soft light pool on the floor at `pool` (local x, z) scaled `ps`
export function floorLamp(shade = PAL.spiral, pool = [0, 0], ps = [1, 1]) {
  const lamp = new THREE.Group(); lamp.name = 'floor lamp';
  lamp.add(at(cyl(0.2, 0.22, 0.04, PAL.ink, { ink: false, mat: 'metal' }), 0, 0.02, 0));
  lamp.add(at(cyl(0.018, 0.018, 1.75, PAL.ink, { ink: false, mat: 'metal', matAxis: 'y' }), 0, 0.9, 0));
  lamp.add(at(cyl(0.15, 0.3, 0.34, shade, { ink: 0.012, mat: 'fabric' }), 0, 1.86, 0));
  const pl = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: shade, transparent: true, opacity: 0.18, depthWrite: false }));
  pl.rotation.x = -Math.PI / 2; pl.scale.set(ps[0], ps[1], 1); pl.position.set(pool[0], 0.005, pool[1]);
  lamp.add(pl);
  lamp.userData.pool = pl;
  batch(lamp);
  return lamp;
}

// a potted monstera: clay pot, leaves fanned round it (footprint ~0.5 m radius)
export function monstera(pot = PAL.orange, leaves = 7) {
  const mo = new THREE.Group(); mo.name = 'monstera';
  mo.add(at(cyl(0.3, 0.22, 0.5, pot, { ink: 0.012, mat: 'clay' }), 0, 0.25, 0));
  for (let i = 0; i < leaves; i++) {
    const a = i / leaves * Math.PI * 2 + 0.3;
    const leaf = mesh(new THREE.SphereGeometry(0.25, 14, 8).scale(1, 0.12, 0.62), i % 2 ? PAL.green : PAL.greenD, { ink: 0.009, mat: 'leaf' });
    leaf.position.set(Math.cos(a) * 0.26, 0.85 + (i % 3) * 0.16, Math.sin(a) * 0.32);
    leaf.rotation.set(0, -a, 0.5);
    mo.add(leaf);
  }
  batch(mo);                                                     // pot + leaves: one fill + one hull instead of ~16 meshes
  return mo;
}

export function stool() {
  const s = new THREE.Group();
  s.add(at(cyl(0.2, 0.2, 0.06, PAL.red, { ink: 0.012, mat: 'paint' }), 0, 0.66, 0));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;                               // a leg dead ahead: his feet rest on the ring either side of it
    const l = cyl(0.02, 0.025, 0.66, PAL.red, { ink: 0.008, mat: 'paint', matAxis: 'y' }, 8);
    l.position.set(Math.cos(a) * 0.14, 0.33, Math.sin(a) * 0.14); l.rotation.set(Math.sin(a) * 0.08, 0, -Math.cos(a) * 0.08);
    s.add(l);
  }
  s.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 24), toon(PAL.red)), 0, 0.28, 0)).children.at(-1).rotation.x = Math.PI / 2;
  return s;
}

// snake: a cream tube coiled on the floor, head raised (owner sheet: cream body, red arrow, red eyes)
export function snake() {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, a = t * Math.PI * 4.2, r = 0.42 - t * 0.2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.07 + (t > 0.8 ? (t - 0.8) * 2.2 : 0), Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.Group();
  const body = mesh(new THREE.TubeGeometry(curve, 160, 0.065, 12, false), PAL.cream, { ink: 0.012, shade: 0.4 });
  g.add(body);
  const end = curve.getPoint(1), dir = curve.getTangent(1);
  const head = mesh(new THREE.SphereGeometry(0.1, 16, 12).scale(1, 0.62, 1.35), PAL.cream, { ink: 0.012 });
  head.position.copy(end).addScaledVector(dir, 0.06);
  head.lookAt(head.position.clone().add(dir));
  const arrow = mesh(new THREE.ConeGeometry(0.04, 0.09, 3).rotateX(Math.PI / 2).scale(1, 0.3, 1), PAL.red, { ink: false });
  arrow.position.set(0, 0.06, 0.02); head.add(arrow);
  for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.018, 8, 6), PAL.red, { ink: 0.004 }); e.position.set(s * 0.07, 0.03, 0.06); head.add(e); }
  g.add(head);
  return g;
}

// 2D puppet: the signed-off man2d drawing on a camera-facing card (Y-axis billboard)
export function puppet(url, height = 1.42) {
  const tex = new THREE.TextureLoader().load(url, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    card.scale.set(height * t.image.width / t.image.height, height, 1);
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
  card.userData.inkMat = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, alphaTest: 0.5 });
  card.userData.billboard = true;
  card.layers.set(CUT_LAYER);
  return card;
}

export { addInk };
