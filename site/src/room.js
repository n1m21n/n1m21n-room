// The Ek Pinjare Mai room (r11 layout) built from simple shapes. Units: metres; floor y = 0.
// A closed 8 x 6 room; the right wall has the doorway to the gallery. Walls between camera and player are cut away.
import * as THREE from 'three';
import { mesh, toon, addInk, CUT_LAYER } from './look.js';
import * as T from './textures.js';

const { PAL } = T;
export const W = 8, D = 6, H = 3.4;                 // x -4..4, z -3..3
export const DOOR = { z0: 0.9, z1: 2.3, h: 2.4 };   // doorway in the right wall (x = +4) -> gallery

function box(w, h, d, color, opts) { return mesh(new THREE.BoxGeometry(w, h, d), color, opts); }
function cyl(rt, rb, h, color, opts, seg = 20) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color, opts); }
function at(o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; return o; }

function framed(tex, w, h, x, y, z, ry = 0) {
  const g = new THREE.Group();
  g.add(box(w + 0.12, h + 0.12, 0.06, PAL.red, { ink: 0.01 }));
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
  const floor = new THREE.Mesh(fg, toon(null, { map: floorTex, shade: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);
  const wall = (w, h, d, c, x, y, z) => { const m = at(box(w, h, d, c, { ink: 0.008, shade: 0.35 }), x, y, z); m.userData.wall = true; walls.push(m); return m; };
  const walls = [];
  room.add(wall(W, H, 0.1, PAL.indigo, 0, H / 2, -D / 2));                       // back
  room.add(wall(W, H, 0.1, PAL.indigo, 0, H / 2, D / 2));                        // front (cut away when the camera is outside)
  room.add(wall(0.1, H, D, PAL.plum, -W / 2, H / 2, 0));                         // left
  const r0 = DOOR.z0 + D / 2, r1 = D / 2 - DOOR.z1;                              // right wall: two pieces + lintel around the doorway
  room.add(wall(0.1, H, r0, PAL.plum, W / 2, H / 2, -D / 2 + r0 / 2));
  room.add(wall(0.1, H, r1, PAL.plum, W / 2, H / 2, D / 2 - r1 / 2));
  room.add(wall(0.1, H - DOOR.h, DOOR.z1 - DOOR.z0, PAL.plum, W / 2, (H + DOOR.h) / 2, (DOOR.z0 + DOOR.z1) / 2));
  const trim = (o) => { o.userData.wall = true; walls.push(o); room.add(o); };          // door trim cuts away with the wall
  for (const z of [DOOR.z0, DOOR.z1]) trim(at(box(0.16, DOOR.h, 0.08, PAL.white, { ink: 0.009 }), W / 2 - 0.04, DOOR.h / 2, z));
  trim(at(box(0.16, 0.08, DOOR.z1 - DOOR.z0 + 0.08, PAL.white, { ink: 0.009 }), W / 2 - 0.04, DOOR.h, (DOOR.z0 + DOOR.z1) / 2));

  // window with the night swirl sky
  const win = new THREE.Group();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.35), toon(null, { map: T.skyTex(), unlit: true }));
  sky.position.z = 0.01; win.add(sky);
  for (const [w, h, x, y] of [[1.86, 0.09, 0, 0.72], [1.86, 0.09, 0, -0.72], [0.09, 1.5, -0.89, 0], [0.09, 1.5, 0.89, 0], [1.7, 0.06, 0, 0.05], [0.06, 1.35, 0, 0]])
    win.add(at(box(w, h, 0.08, PAL.white, { ink: 0.009 }), x, y, 0.05));
  win.add(at(box(2.0, 0.08, 0.22, PAL.white, { ink: 0.009 }), 0, -0.79, 0.12));   // sill
  room.add(at(win, -1.7, 2.0, -D / 2 + 0.06));

  room.add(framed(T.eyePaintingTex(), 0.9, 0.7, 0.75, 2.25, -D / 2 + 0.08));
  room.add(framed(T.spiralPaintingTex(), 0.62, 0.62, 1.85, 2.3, -D / 2 + 0.08));
  room.add(framed(T.snakePaintingTex(), 0.5, 0.7, W / 2 - 0.08, 2.0, 0.6, -Math.PI / 2));

  // record shelf + turntable (back right)
  const shelf = new THREE.Group();
  shelf.add(at(box(1.8, 0.7, 0.42, PAL.wood, { ink: 0.012 }), 0, 0.35, 0));
  const spines = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 0.56), toon(null, { map: T.spinesTex(), unlit: true }));
  spines.position.set(0, 0.35, 0.215); shelf.add(spines);
  shelf.add(at(box(0.7, 0.14, 0.42, PAL.white, { ink: 0.01 }), 0.35, 0.77, 0));
  const disc = at(cyl(0.18, 0.18, 0.02, PAL.ink, { ink: 0.006 }), 0.32, 0.85, 0);
  disc.add(at(cyl(0.06, 0.06, 0.025, PAL.red, { ink: false }), 0, 0, 0));
  shelf.add(disc);
  shelf.userData.spin = disc;
  room.add(at(shelf, 1.3, 0, -D / 2 + 0.32));

  // keyboard on an X stand (front left)
  const kb = new THREE.Group();
  kb.add(at(box(1.25, 0.1, 0.36, '#241c4f', { ink: 0.012 }), 0, 0.82, 0));
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.18), toon(null, { map: T.keysTex(), unlit: true }));
  keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.872, 0.06); kb.add(keys);
  for (const [c, x] of [[PAL.white, -0.5], [PAL.white, -0.42], [PAL.spiral, -0.34], [PAL.white, -0.26]]) kb.add(at(cyl(0.022, 0.022, 0.03, c, { ink: 0.005 }), x, 0.885, -0.11));
  kb.add(at(box(0.26, 0.012, 0.06, PAL.teal, { ink: 0.005 }), 0.38, 0.875, -0.11));
  for (const s of [-1, 1]) {
    const leg = box(0.04, 1.05, 0.04, PAL.ink, { ink: false });
    leg.position.set(0, 0.42, 0); leg.rotation.z = s * 0.72; kb.add(leg);
  }
  room.add(at(kb, -2.4, 0, -0.6, 0.12));

  // guitar leaning by the shelf
  const gt = new THREE.Group();
  const body = new THREE.Group();
  body.add(at(mesh(new THREE.SphereGeometry(0.23, 24, 16).scale(1, 1, 0.32), PAL.wood, { ink: 0.012 }), 0, 0, 0));
  body.add(at(mesh(new THREE.SphereGeometry(0.17, 24, 16).scale(1, 1, 0.32), PAL.wood, { ink: 0.012 }), 0, 0.3, 0));
  const hole = at(cyl(0.07, 0.07, 0.01, PAL.ink, { ink: false }), 0, 0.2, 0.075); hole.rotation.x = Math.PI / 2; body.add(hole);
  body.add(at(box(0.07, 0.7, 0.04, '#5A2A1A', { ink: 0.008 }), 0, 0.72, 0));
  body.add(at(box(0.1, 0.16, 0.05, '#5A2A1A', { ink: 0.008 }), 0, 1.12, 0));
  body.position.y = 0.25; body.rotation.z = 0.12; gt.add(body);
  room.add(at(gt, 2.55, 0, -1.9, -0.3));

  // snake plant in an orange pot
  const sp = new THREE.Group();
  sp.add(at(cyl(0.22, 0.17, 0.42, PAL.orange, { ink: 0.012 }), 0, 0.21, 0));
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, h = 0.7 + (i * 37 % 10) / 22;
    const blade = mesh(new THREE.ConeGeometry(0.06, h, 4).scale(1, 1, 0.3), i % 2 ? PAL.green : PAL.greenD, { ink: 0.007 });
    blade.position.set(Math.cos(a) * 0.08, 0.42 + h / 2, Math.sin(a) * 0.08);
    blade.rotation.set(Math.sin(a) * 0.25, a, -Math.cos(a) * 0.25);
    sp.add(blade);
  }
  room.add(at(sp, 3.35, 0, -2.5));

  // floor lamp (front right) + light pool decal
  const lamp = new THREE.Group();
  lamp.add(at(cyl(0.2, 0.22, 0.04, PAL.ink, { ink: false }), 0, 0.02, 0));
  lamp.add(at(cyl(0.018, 0.018, 1.75, PAL.ink, { ink: false }), 0, 0.9, 0));
  lamp.add(at(cyl(0.15, 0.3, 0.34, PAL.spiral, { ink: 0.012 }), 0, 1.86, 0));
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: PAL.spiral, transparent: true, opacity: 0.18, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; pool.scale.set(1.3, 0.8, 1); pool.position.set(-0.3, 0.005, 0.2);
  lamp.add(pool);
  lamp.userData.pool = pool;
  room.add(at(lamp, 3.2, 0, -1.0));

  // monstera, front left
  const mo = new THREE.Group();
  mo.add(at(cyl(0.3, 0.22, 0.5, PAL.orange, { ink: 0.012 }), 0, 0.25, 0));
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.3;
    const leaf = mesh(new THREE.SphereGeometry(0.28, 14, 8).scale(1, 0.12, 0.62), i % 2 ? PAL.green : PAL.greenD, { ink: 0.009 });
    leaf.position.set(Math.cos(a) * 0.32, 0.85 + (i % 3) * 0.16, Math.sin(a) * 0.32);
    leaf.rotation.set(0, -a, 0.5);
    mo.add(leaf);
  }
  room.add(at(mo, -3.3, 0, 0.8));

  return { room, shelf, lamp, walls, win, kb, gt };
}

export function stool() {
  const s = new THREE.Group();
  s.add(at(cyl(0.2, 0.2, 0.06, PAL.red, { ink: 0.012 }), 0, 0.66, 0));
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + Math.PI / 4;
    const l = cyl(0.02, 0.025, 0.66, PAL.red, { ink: 0.008 }, 8);
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
