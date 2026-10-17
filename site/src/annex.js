// The annex: two small rooms off the corridor to the gallery, either side of it. North: the bathroom (shower behind a
// curtain, basin under a mirror, the loo). South: the kitchen (fridge, an L of counters with a sink and a hob + kettle,
// a table for two under a pendant, a window on the sky). Their doorways are cut into the corridor walls (gallery.js
// `cuts`) and hung with a cloth door curtain that parts as he walks through: a swinging leaf in a 1.4 m corridor
// would shut him in. Stations (main.js) and acts (acts.js): wash, loo, shower, tea, fridge. Props that he handles
// (kettle, mug, juice, fridge doors) are built in their spot's frame from the same numbers the acts reach for.
import * as THREE from 'three';
import { mesh, toon } from './look.js';
import { PAL, checkerTex, skyTex } from './textures.js';
import { W as RW, DOOR, monstera } from './room.js';
import { TEA, teaProps, FRIDGE, fridgeProps, BRUSH, COOK, cookProps, EAT, TOOLS, HELD, palmFrame } from './acts.js';

const WT = 0.12, H = 2.6, DH = 2.35;
// The foyer (the corridor to the gallery) is a 5 x 2.2 m hall that the two rooms open off. Sized like a small flat:
// the kitchen is the big room (4.3 x 4.0 = 17 m2), the bathroom the small one (3.3 x 2.6 = 8.6 m2), the foyer wide
// enough to turn in. Each room has its own doorway along the foyer; nothing is hardcoded outside this block.
const FOYER = { len: 5.0, w: 2.2 }, CZ = (DOOR.z0 + DOOR.z1) / 2;
const FZ0 = CZ - FOYER.w / 2, FZ1 = CZ + FOYER.w / 2;                // the foyer's floor, north / south edge
const X0 = RW / 2 + 0.05 + WT;                                        // inside face of the rooms' west wall
export const ANNEX = {
  x0: X0, foyer: FOYER, dw: 1.1,
  bath: { x1: X0 + 3.3, z0: FZ0 - WT - 2.6, z1: FZ0 - WT, door: X0 + 1.45 },        // its south wall is the foyer's north wall
  kitchen: { x1: X0 + 4.3, z0: FZ1 + WT, z1: FZ1 + WT + 4.0, door: X0 + 2.75 },
};
// floor rects [x0, z0, x1, z1] of the rooms whose walls are cut away Sims-style (player.js): the foyer and both rooms
ANNEX.rooms = {
  foyer: [RW / 2 + 0.05, FZ0, RW / 2 + 0.05 + FOYER.len, FZ1],
  bath: [X0, ANNEX.bath.z0, ANNEX.bath.x1, ANNEX.bath.z1],
  kitchen: [X0, ANNEX.kitchen.z0, ANNEX.kitchen.x1, ANNEX.kitchen.z1],
};
const box = (w, h, d, c, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), c, { ink: 0.008, ...o });
const cyl = (rt, rb, h, c, o = {}, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, { ink: 0.006, ...o });
const at = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; return o; };
const lathe = (pts, c, o = {}) => { const m = mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24), c, { ink: 0.005, ...o }); m.material.side = THREE.DoubleSide; return m; };
const flat = (w, d, c, o = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), toon(c, { shade: 0.3, ...o })); m.rotation.x = -Math.PI / 2; m.userData.phys = 'none'; return m; };
const glow = (geo, c) => { const m = new THREE.Mesh(geo, toon(c, { unlit: true })); m.userData.phys = 'none'; return m; };

// spots: where he stands for each thing (heading: the way he faces, world)
const BA = ANNEX.bath, KI = ANNEX.kitchen;
export const SPOTS = {
  WASH: { x: X0 + 1.5, z: BA.z0 + 0.72, heading: Math.PI, act: 'wash' },
  LOO: { x: X0 + 0.98, z: BA.z0 + 1.6, heading: -Math.PI / 2, act: 'loo' },
  SHOWER: { x: BA.x1 - 0.65, z: BA.z0 + 0.58, heading: Math.PI, act: 'shower' },
  TEA: { x: X0 + 1.8, z: KI.z1 - 0.95, heading: 0, act: 'tea' },
  FRIDGE: { x: X0 + FRIDGE.depth + FRIDGE.front + 0.01, z: KI.z0 + 0.75, heading: -Math.PI / 2, act: 'fridge' },
};
// where he steps to on leaving each spot (kept relative to it: the acts' reach is in his own frame)
SPOTS.WASH.out = [SPOTS.WASH.x + 0.05, SPOTS.WASH.z + 0.53];
SPOTS.LOO.out = [SPOTS.LOO.x + 0.25, SPOTS.LOO.z];
SPOTS.SHOWER.out = [SPOTS.SHOWER.x - 0.23, SPOTS.SHOWER.z + 0.97];
SPOTS.TEA.out = [SPOTS.TEA.x, SPOTS.TEA.z - 0.5];
SPOTS.FRIDGE.out = [X0 + 1.45, SPOTS.FRIDGE.z];
// his day (routine.js) adds: brushing at the basin, cooking at the hob (same places as wash / tea), eating at the table
// from the chair on its east side
export const TABLE = { x: X0 + 1.05, z: KI.z0 + 1.75 };
Object.assign(SPOTS, {
  BRUSH: { ...SPOTS.WASH, act: 'brush' },
  COOK: { ...SPOTS.TEA, act: 'cook' },
  EAT: { x: TABLE.x + 0.72, z: TABLE.z, heading: -Math.PI / 2, act: 'eat', out: [TABLE.x + 1.22, TABLE.z] },
});
// a group in a spot's frame: children placed in his man-local coordinates
const frame = s => { const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = s.heading; return g; };

// a pleated cloth hung from a rod: anchored at x = 0, hanging toward +x for `w` (scale.x bunches it toward the anchor)
function cloth(w, h, col, folds = 8, depth = 0.035) {
  const geo = new THREE.PlaneGeometry(w, h, folds * 4, 1); geo.translate(w / 2, -h / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / w * folds * Math.PI * 2) * depth);
  const m = new THREE.Mesh(geo, toon(col, { mat: 'fabric', shade: 0.45 })); m.material.side = THREE.DoubleSide;
  return m;
}

export function buildAnnex({ walls, solid }) {
  const g = new THREE.Group(); g.name = 'annex';
  const B = ANNEX.bath, K = ANNEX.kitchen, hw = ANNEX.dw / 2;
  let dx = B.door, X1 = B.x1;                                         // this room's doorway x and east wall (reassigned for the kitchen)
  // walls: a tiled dado (glazed, to 1.2) under plaster. With him inside they are cut away like the room's (rooms this
  // small leave the camera no room to stop short of them); from outside they stop the arm like the gallery's
  // (`armOut`: the room's floor box, player.js)
  let room = null;
  function wall(x0, z0, x1, z1, lo, hi) {                             // a slab on the plan from (x0, z0) to (x1, z1)
    for (const [y0, y1, c, mat] of [[0, 1.2, lo, 'glaze'], [1.2, H, hi, 'plaster']]) {
      const m = at(box(x1 - x0, y1 - y0, z1 - z0, c, { mat, shade: 0.35 }), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.userData.wall = true; m.userData.armOut = room; walls.push(m); g.add(m);
    }
    solid(x0, z0, x1, z1);
  }
  // the corridor wall's face on the room side, in this room's colours (around the doorway). `skin`: it leaves with the
  // wall it lines when that is cut away, though it stands on the floor (player.js attached())
  const skin = o => { o.userData.skin = true; return o; };
  function lining(z, lo, hi) {
    for (const [a, b] of [[X0, dx - hw], [dx + hw, X1]]) for (const [y0, y1, c, mat] of [[0, 1.2, lo, 'glaze'], [1.2, H, hi, 'plaster']])
      g.add(skin(at(box(b - a, y1 - y0, 0.012, c, { mat, shade: 0.35, ink: false }), (a + b) / 2, (y0 + y1) / 2, z)));
    g.add(skin(at(box(2 * hw, H - DH, 0.012, hi, { mat: 'plaster', shade: 0.35, ink: false }), dx, (H + DH) / 2, z)));
  }
  // door curtain: two halves on a rod, parted when he's near the doorway
  const curtains = [];
  function parda(z, col, band) {
    // (rod and cloth leave with the doorway's wall when it is cut away, like a door frame in the Sims)
    const rod = cyl(0.012, 0.012, 2 * hw - 0.2, PAL.spiral, { mat: 'metal' }); rod.rotation.z = Math.PI / 2; rod.position.set(dx, DH - 0.06, z); g.add(rod);
    const halves = [-1, 1].map(s => {
      const piv = new THREE.Group(); piv.position.set(dx + s * (hw - 0.1), DH - 0.06, z);   // inside the white jambs piv.rotation.y = s > 0 ? Math.PI : 0; g.add(piv);
      const c = cloth(hw - 0.08, DH - 0.2, col, 5, 0.025); piv.add(c);
      const b = cloth(hw - 0.08, 0.16, band, 5, 0.026); b.position.y = -(DH - 0.2) + 0.3; piv.add(b);
      return piv;
    });
    curtains.push({ z, x: dx, halves, open: 0 });
  }

  // ---------------------------------------------------------------- bathroom
  const TILE = PAL.teal, BWALL = '#1E6B63';
  room = [X0, B.z0, X1, B.z1];
  wall(X0 - WT, B.z0 - WT, X1 + WT, B.z0, TILE, BWALL);              // north
  wall(X0 - WT, B.z0, X0, B.z1, TILE, BWALL);                         // west (back to back with the room's right wall)
  wall(X1, B.z0, X1 + WT, B.z1, TILE, BWALL);                         // east
  lining(B.z1 - 0.006, TILE, BWALL);
  const bf = flat(X1 - X0, B.z1 - B.z0, '#140B52', { mat: 'lino', matAmt: 0.6 }); bf.position.set((X0 + X1) / 2, 0.002, (B.z0 + B.z1) / 2); bf.userData.floor = true; g.add(bf);
  parda(B.z1 + 0.03, PAL.mag, PAL.spiral);

  // basin on a pedestal under the mirror; a little glass shelf with his face wash and a toothbrush mug
  const W = SPOTS.WASH, bx = W.x, bz = B.z0 + 0.25;
  const sink = new THREE.Group(); sink.name = 'basin';
  sink.add(at(lathe([[0.04, 0.72], [0.15, 0.74], [0.21, 0.79], [0.245, 0.855], [0.235, 0.87], [0.2, 0.86]], PAL.white, { mat: 'glaze' }), bx, 0, bz));
  sink.add(at(glow(new THREE.CircleGeometry(0.15, 20).rotateX(-Math.PI / 2), '#9FDCEB'), bx, 0.76, bz));
  sink.add(at(cyl(0.065, 0.1, 0.72, PAL.white, { mat: 'glaze' }), bx, 0.36, bz - 0.04));
  const tap = new THREE.Group(); tap.add(at(cyl(0.018, 0.018, 0.12, PAL.lav, { mat: 'metal' }), 0, 0.06, 0));
  const spoutM = cyl(0.012, 0.012, 0.1, PAL.lav, { mat: 'metal' }); spoutM.rotation.x = Math.PI / 2; spoutM.position.set(0, 0.11, 0.05); tap.add(spoutM);
  for (const s of [-1, 1]) tap.add(at(cyl(0.02, 0.02, 0.025, s < 0 ? PAL.red : PAL.blue, { mat: 'glaze' }), s * 0.07, 0.03, 0));
  sink.add(at(tap, bx, 0.86, B.z0 + 0.04));
  g.add(sink); solid(bx - 0.25, B.z0, bx + 0.25, B.z0 + 0.5);
  const mirror = new THREE.Group(); mirror.name = 'mirror';
  mirror.add(box(0.62, 0.82, 0.03, '#E8B53A', { mat: 'wood', shadeCol: '#8A5A12' }));
  const glass = glow(new THREE.PlaneGeometry(0.52, 0.72), '#BFE6F2'); glass.position.z = 0.017; mirror.add(glass);
  const glint = glow(new THREE.PlaneGeometry(0.05, 0.5), '#FFFFFF'); glint.position.set(-0.12, 0.05, 0.018); glint.rotation.z = 0.4; mirror.add(glint);
  g.add(at(mirror, bx, 1.6, B.z0 + 0.016));
  const shelfG = new THREE.Group();
  shelfG.add(box(0.5, 0.018, 0.11, '#CFEFF2', { mat: 'glaze', ink: 0.004 }));
  const tube = cyl(0.022, 0.022, 0.14, PAL.mag, { mat: 'plastic' }); tube.rotation.z = 0.18; tube.position.set(-0.15, 0.08, 0); shelfG.add(tube);
  shelfG.add(at(cyl(0.012, 0.016, 0.02, PAL.white, { mat: 'plastic', ink: 0.003 }), -0.163, 0.165, 0));
  shelfG.add(at(cyl(0.03, 0.026, 0.09, PAL.teal, { mat: 'glaze' }), 0.14, 0.054, 0));
  let mine = null;                                                   // the spiral one is his: it goes in his hand (BRUSH)
  for (const [c, r] of [[PAL.spiral, 0.15], [PAL.red, -0.12]]) { const br = cyl(0.006, 0.006, 0.18, c, { ink: 0.002, mat: 'plastic' }); br.position.set(0.14 + r * 0.1, 0.13, 0); br.rotation.z = r; shelfG.add(br); mine ||= br; }
  g.add(at(shelfG, bx, 1.12, B.z0 + 0.06));
  // the loo, against the west wall
  const L = SPOTS.LOO, lz = L.z, loo = new THREE.Group(); loo.name = 'loo';
  loo.add(at(box(0.18, 0.4, 0.42, PAL.white, { mat: 'glaze' }), X0 + 0.09, 0.62, lz));
  loo.add(at(cyl(0.03, 0.03, 0.015, PAL.lav, { mat: 'metal', ink: 0.003 }), X0 + 0.09, 0.83, lz));
  const bowl = lathe([[0.11, 0], [0.14, 0.05], [0.15, 0.25], [0.19, 0.37], [0.19, 0.4]], PAL.white, { mat: 'glaze' }); bowl.scale.set(1.25, 1, 1);
  loo.add(at(bowl, X0 + 0.43, 0, lz));
  const water = glow(new THREE.CircleGeometry(0.13, 20).rotateX(-Math.PI / 2), '#9FDCEB'); water.scale.set(1.2, 1, 1); loo.add(at(water, X0 + 0.43, 0.3, lz));
  const seat = mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24).rotateX(Math.PI / 2), PAL.spiral, { ink: 0.004, mat: 'plastic' }); seat.scale.set(1.25, 1, 1); loo.add(at(seat, X0 + 0.43, 0.42, lz));
  const lid = at(box(0.025, 0.4, 0.36, PAL.spiral, { mat: 'plastic', ink: 0.005 }), X0 + 0.2, 0.62, lz); lid.rotation.z = -0.12; loo.add(lid);
  g.add(loo); solid(X0, lz - 0.22, X0 + 0.68, lz + 0.22);
  // towel on a rail, a bath mat by the shower, a plant in the corner by the door
  const towel = new THREE.Group();
  const rail = cyl(0.012, 0.012, 0.5, PAL.lav, { mat: 'metal' }); rail.rotation.x = Math.PI / 2; towel.add(rail);
  towel.add(at(box(0.03, 0.55, 0.38, PAL.spiral, { mat: 'fabric', ink: 0.005 }), 0.02, -0.26, 0));
  towel.add(at(box(0.034, 0.06, 0.38, PAL.mag, { mat: 'fabric', ink: 0.003 }), 0.02, -0.42, 0));
  g.add(at(towel, X0 + 0.05, 1.32, B.z0 + 0.6));
  const mat = flat(0.6, 0.45, PAL.spiral, { mat: 'fabric' }); mat.position.set(SPOTS.SHOWER.x - 0.05, 0.006, SPOTS.SHOWER.z + 0.82); g.add(mat);
  const pl = monstera(PAL.orange, 6); pl.scale.setScalar(0.62); g.add(at(pl, X0 + 0.38, 0, B.z1 - 0.38, 1.2)); solid(X0, B.z1 - 0.62, X0 + 0.62, B.z1);
  // shower: tray, a tiled knee wall on its west side, a curtain across the front (it closes once he's in: only his
  // feet show under it), head on the north wall
  const S = SPOTS.SHOWER, sx0 = X1 - 1.3, sz1 = B.z0 + 1.4;
  const tray = flat(X1 - sx0, sz1 - B.z0, '#E9F3EC', { mat: 'glaze' }); tray.position.set((sx0 + X1) / 2, 0.004, (B.z0 + sz1) / 2); g.add(tray);
  const drain = glow(new THREE.CircleGeometry(0.04, 12).rotateX(-Math.PI / 2), PAL.lav); drain.position.set(S.x, 0.006, S.z - 0.1); g.add(drain);
  const knee = at(box(0.08, 1.1, sz1 - B.z0, TILE, { mat: 'glaze' }), sx0 + 0.04, 0.55, (B.z0 + sz1) / 2); knee.userData.wall = true; knee.userData.low = true; walls.push(knee); g.add(knee);   // low: never cut (a half wall, as in the Sims)
  solid(sx0, B.z0, sx0 + 0.08, sz1);
  const pipe = cyl(0.014, 0.014, 0.95, PAL.lav, { mat: 'metal' }); pipe.position.set(S.x, 1.58, B.z0 + 0.03); g.add(pipe);
  const armP = cyl(0.014, 0.014, 0.2, PAL.lav, { mat: 'metal' }); armP.rotation.x = Math.PI / 2; armP.position.set(S.x, 2.05, B.z0 + 0.12); g.add(armP);
  const head = cyl(0.075, 0.05, 0.04, PAL.lav, { mat: 'metal' }); head.position.set(S.x, 2.03, B.z0 + 0.22); head.rotation.x = 0.3; g.add(head);
  g.add(at(cyl(0.035, 0.035, 0.04, PAL.white, { mat: 'glaze' }).rotateX(Math.PI / 2), S.x, 1.1, B.z0 + 0.03));
  const rod = cyl(0.012, 0.012, X1 - sx0, PAL.lav, { mat: 'metal' }); rod.rotation.z = Math.PI / 2; rod.position.set((sx0 + X1) / 2, 2.02, sz1); rod.userData.stays = true; g.add(rod);   // (spans the shower: stays with the knee wall)
  const curtain = new THREE.Group(); curtain.position.set(X1, 2.0, sz1); curtain.rotation.y = Math.PI; g.add(curtain);
  const cMain = cloth(X1 - sx0, 1.68, PAL.lav, 9, 0.03); cMain.userData.stays = true; curtain.add(cMain);
  const cDots = cloth(X1 - sx0, 0.12, PAL.mag, 9, 0.031); cDots.userData.stays = true; cDots.position.y = -1.3; curtain.add(cDots);
  // water: falling streaks under the head (and from the basin tap), steam puffs over the curtain
  const streaks = (n, r) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 6), 3));
    const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#DDF6FF' })); l.visible = false; l.frustumCulled = false;
    l.userData.seed = Array.from({ length: n }, () => [Math.random() * Math.PI * 2, Math.sqrt(Math.random()) * r, Math.random()]);
    g.add(l); return l;
  };
  const rain = streaks(36, 0.16), tapRun = streaks(6, 0.008), pourRun = streaks(5, 0.006);
  const steam = Array.from({ length: 7 }, (_, i) => { const p = glow(new THREE.SphereGeometry(0.12, 10, 8), '#EEF4FF'); p.visible = false; p.userData.k = i / 7; g.add(p); return p; });

  // ---------------------------------------------------------------- kitchen
  const KWALL = '#2B5C2E', KTILE = PAL.white;
  dx = K.door; X1 = K.x1;
  room = [X0, K.z0, X1, K.z1];
  wall(X0 - WT, K.z1, X1 + WT, K.z1 + WT, KTILE, KWALL);              // south
  wall(X0 - WT, K.z0, X0, K.z1, KTILE, KWALL);                         // west
  wall(X1, K.z0, X1 + WT, K.z1, KTILE, KWALL);                         // east
  lining(K.z0 + 0.006, KTILE, KWALL);
  {
    const fg = new THREE.PlaneGeometry(X1 - X0, K.z1 - K.z0), uv = fg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (X1 - X0) / 1.2, uv.getY(i) * (K.z1 - K.z0) / 1.2);
    const f = new THREE.Mesh(fg, toon(null, { map: checkerTex(), shade: 0.35, mat: 'lino' })); f.rotation.x = -Math.PI / 2;
    f.position.set((X0 + X1) / 2, 0.002, (K.z0 + K.z1) / 2); f.userData.floor = true; f.userData.phys = 'none'; g.add(f);
  }
  parda(K.z0 - 0.03, PAL.orange, PAL.teal);
  // counters: an L along the east and south walls (worktop 0.9), yellow doors with red knobs, a sink, a hob with an oven
  const CAB = PAL.spiral, TOP = PAL.wood, cz0 = K.z1 - 2.8, cx0 = X0 + 0.7, cd = 0.6;
  const run = (x0, z0, x1, z1, fronts) => {
    g.add(at(box(x1 - x0, 0.84, z1 - z0, CAB, { mat: 'wood', shadeCol: '#8A5A12' }), (x0 + x1) / 2, 0.42, (z0 + z1) / 2));
    g.add(at(box(x1 - x0, 0.06, z1 - z0, TOP, { mat: 'wood', ink: 0.007 }), (x0 + x1) / 2, 0.87, (z0 + z1) / 2));
    for (const [x, z, ry] of fronts) g.add(at(cyl(0.018, 0.018, 0.02, PAL.red, { mat: 'glaze', ink: 0.003 }).rotateX(Math.PI / 2), x, 0.7, z, ry));
    solid(x0, z0, x1, z1);
  };
  run(X1 - cd, cz0, X1, K.z1, [0.4, 1.2, 2.0].map(o => [X1 - cd - 0.01, cz0 + o, -Math.PI / 2]));
  run(cx0, K.z1 - cd, X1 - cd, K.z1, [X0 + 1.1, X0 + 2.6, X0 + 3.1].map(x => [x, K.z1 - cd - 0.01, 0]));
  // sink in the east run, a dish of plates beside it
  const sk = new THREE.Group(); sk.name = 'kitchen sink';
  sk.add(at(box(0.42, 0.012, 0.36, '#9A98C8', { mat: 'metal', ink: 0.004 }), 0, 0.905, 0));
  sk.add(at(glow(new THREE.PlaneGeometry(0.34, 0.28).rotateX(-Math.PI / 2), '#3A3870'), 0, 0.913, 0));
  const kt = mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12, Math.PI), PAL.lav, { ink: 0.003, mat: 'metal' }); kt.position.set(0.21, 0.98, 0); kt.rotation.y = Math.PI / 2; sk.add(kt);
  for (let i = 0; i < 3; i++) { const p = cyl(0.11, 0.11, 0.012, [PAL.white, PAL.teal, PAL.mag][i], { mat: 'glaze', ink: 0.003 }, 20); p.rotation.x = Math.PI / 2 - 0.2; p.position.set(-0.06 + i * 0.035, 1.0, 0.36); sk.add(p); }
  g.add(at(sk, X1 - cd / 2 + 0.03, 0, cz0 + 1.0, -Math.PI / 2));
  // hob (two rings) and the oven door below it, where he makes tea
  const T = SPOTS.TEA;
  g.add(at(box(0.56, 0.02, 0.46, PAL.ink, { mat: 'metal', ink: 0.004 }), T.x, 0.91, K.z1 - 0.3));
  for (const s of [-1, 1]) g.add(at(mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 20).rotateX(Math.PI / 2), '#5A5880', { ink: false, mat: 'metal' }), T.x + s * 0.13, 0.922, K.z1 - 0.32));
  const flame = glow(new THREE.TorusGeometry(0.06, 0.012, 6, 16).rotateX(Math.PI / 2), '#5FA8FF'); flame.position.set(T.x - 0.12, 0.928, K.z1 - 0.32); flame.visible = false; g.add(flame);
  g.add(at(box(0.5, 0.42, 0.012, PAL.ink, { mat: 'metal', ink: 0.004 }), T.x, 0.45, K.z1 - cd - 0.006));
  g.add(at(glow(new THREE.PlaneGeometry(0.36, 0.18), '#3A1580'), T.x, 0.48, K.z1 - cd - 0.014, Math.PI));
  // wall cupboards over the east run, a shelf of jars over the hob
  g.add(at(box(0.34, 0.62, 2.4, CAB, { mat: 'wood', shadeCol: '#8A5A12' }), X1 - 0.17, 1.82, cz0 + 1.4));
  for (const z of [cz0 + 0.6, cz0 + 1.4, cz0 + 2.2]) g.add(at(cyl(0.016, 0.016, 0.02, PAL.red, { mat: 'glaze', ink: 0.003 }).rotateZ(Math.PI / 2), X1 - 0.35, 1.62, z));
  const jars = new THREE.Group();
  jars.add(box(0.9, 0.025, 0.18, TOP, { mat: 'wood', ink: 0.005 }));
  [[PAL.orange, -0.3], [PAL.green, -0.1], [PAL.red, 0.1], [PAL.spiral, 0.3]].forEach(([c, x], i) => {
    jars.add(at(cyl(0.05, 0.05, 0.13 + i % 2 * 0.04, '#DDE8E8', { mat: 'glaze', ink: 0.004 }), x, 0.08 + i % 2 * 0.02, 0));
    jars.add(at(cyl(0.045, 0.045, 0.06, c, { ink: false, mat: 'clay' }), x, 0.05, 0));
    jars.add(at(cyl(0.052, 0.052, 0.02, c, { mat: 'plastic', ink: 0.003 }), x, 0.16 + i % 2 * 0.04, 0));
  });
  g.add(at(jars, T.x - 0.1, 1.58, K.z1 - 0.1));
  // fridge (spot frame: front face FRIDGE.front ahead of him), French doors on pivots; light inside, a juice on a shelf
  const FS = SPOTS.FRIDGE, fr = frame(FS); fr.name = 'fridge'; g.add(fr);
  const { front, w: fw, h: fh, depth } = FRIDGE, fb = front + depth, FC = '#A8E6CF';
  fr.add(at(box(fw, fh, 0.03, FC, { mat: 'plastic' }), 0, fh / 2, fb - 0.015));
  for (const s of [-1, 1]) fr.add(at(box(0.03, fh, depth, FC, { mat: 'plastic' }), s * (fw / 2 - 0.015), fh / 2, front + depth / 2));
  for (const y of [0.02, fh - 0.02]) fr.add(at(box(fw, 0.04, depth, FC, { mat: 'plastic' }), 0, y, front + depth / 2));
  fr.add(at(glow(new THREE.PlaneGeometry(fw - 0.06, fh - 0.08), '#FFF6D0'), 0, fh / 2, fb - 0.031, Math.PI));
  for (const y of [0.5, 0.93, 1.28]) fr.add(at(box(fw - 0.06, 0.015, depth - 0.06, '#E8F6FF', { mat: 'glaze', ink: 0.003 }), 0, y, front + depth / 2 + 0.02));
  [[PAL.red, 0.18, 0.55, 0.75, 0.05], [PAL.white, 0.12, 0.98, 0.8, 0.06], [PAL.orange, 0.2, 1.33, 0.72, 0.045], [PAL.green, -0.2, 0.55, 0.8, 0.06]].forEach(([c, x, y, z, r]) => fr.add(at(mesh(new THREE.SphereGeometry(r, 10, 8), c, { ink: 0.003, mat: 'glaze' }), x, y + r, z)));
  fr.add(at(box(0.12, 0.14, 0.12, PAL.white, { mat: 'plastic', ink: 0.004 }), 0.15, 1.005, 0.8));
  const doors = [-1, 1].map(s => {                                  // s +1 his left (hinge at +0.35)
    const piv = new THREE.Group(); piv.position.set(s * fw / 2, 0, front - 0.025); fr.add(piv);
    piv.add(at(box(fw / 2 - 0.005, fh - 0.02, 0.05, FC, { mat: 'plastic' }), -s * fw / 4, fh / 2, 0));
    piv.add(at(box(0.025, 0.36, 0.025, PAL.red, { mat: 'glaze', ink: 0.004 }), -s * 0.3, 1.0, -0.045));
    for (const y of [0.4, 0.8, 1.2]) piv.add(at(box(fw / 2 - 0.08, 0.06, 0.06, '#E8F6FF', { mat: 'glaze', ink: 0.003 }), -s * fw / 4, y, 0.055));
    return { piv, s };
  });
  const juice = new THREE.Group();
  juice.add(at(box(0.07, 0.18, 0.07, PAL.spiral, { mat: 'plastic', ink: 0.004 }), 0, 0, 0));
  juice.add(at(box(0.072, 0.07, 0.072, PAL.orange, { ink: false, mat: 'plastic' }), 0, -0.01, 0));
  juice.add(at(box(0.07, 0.03, 0.04, PAL.spiral, { mat: 'plastic', ink: 0.003 }), 0, 0.105, 0));
  juice.traverse(o => { if (o.isMesh) o.userData.phys = 'none'; });   // in his hand: his fingers wrap it
  fr.add(juice);
  solid(X0, FS.z - fw / 2 - 0.02, X0 + depth + 0.02, FS.z + fw / 2 + 0.02);
  // kettle + mug (tea spot frame)
  const tf = frame(T); g.add(tf);
  const kettle = new THREE.Group(); kettle.name = 'kettle';
  kettle.add(at(mesh(new THREE.SphereGeometry(0.1, 16, 12).scale(1, 0.85, 1), PAL.red, { ink: 0.006, mat: 'glaze' }), 0, 0.085, 0));
  kettle.add(at(cyl(0.085, 0.085, 0.02, PAL.ink, { mat: 'metal', ink: 0.004 }), 0, 0.01, 0));
  const spout = cyl(0.012, 0.025, 0.12, PAL.red, { mat: 'glaze', ink: 0.004 }); spout.position.set(0.1, 0.1, 0); spout.rotation.z = -0.9; kettle.add(spout);
  const handle = mesh(new THREE.TorusGeometry(0.07, 0.011, 6, 14, Math.PI), PAL.ink, { ink: 0.003, mat: 'plastic' }); handle.position.y = 0.14; kettle.add(handle);
  kettle.add(at(cyl(0.012, 0.012, 0.015, PAL.ink, { mat: 'plastic', ink: 0.003 }), 0, 0.165, 0));
  tf.add(kettle);
  const mug = new THREE.Group(); mug.name = 'mug';
  mug.add(at(lathe([[0.038, -0.05], [0.045, -0.045], [0.045, 0.05], [0.04, 0.05], [0.04, -0.04]], PAL.teal, { mat: 'glaze' }), 0, 0, 0));
  mug.add(at(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 14), PAL.teal, { ink: false, mat: 'glaze' }), 0, -0.045, 0));
  const tea = glow(new THREE.CircleGeometry(0.04, 14).rotateX(-Math.PI / 2), '#8A4A1F'); tea.position.y = 0.035; tea.visible = false; mug.add(tea);
  const mh = mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12), PAL.teal, { ink: 0.003, mat: 'glaze' }); mh.position.set(0.05, 0, 0); mug.add(mh);
  mug.traverse(o => { if (o.isMesh) o.userData.phys = 'none'; });
  kettle.traverse(o => { if (o.isMesh) o.userData.phys = 'none'; });
  tf.add(mug);
  // cooking: a pan on his left ring with something in it, a wooden spatula, a second flame
  const pan = new THREE.Group(); pan.name = 'pan';
  pan.add(at(lathe([[0, 0], [COOK.r - 0.01, 0], [COOK.r, 0.01], [COOK.r + 0.006, 0.05], [COOK.r - 0.002, 0.05], [COOK.r - 0.008, 0.012], [0, 0.008]], PAL.ink, { mat: 'metal' }), 0, 0, 0));
  const ph = cyl(0.012, 0.014, COOK.handle, '#5A3A1A', { mat: 'wood', ink: 0.003 }); ph.rotation.z = Math.PI / 2; ph.position.set(COOK.r + COOK.handle / 2, 0.035, 0); pan.add(ph);
  const food = [[PAL.orange, 0.04, 0.02], [PAL.green, -0.03, 0.04], [PAL.red, 0.02, -0.05], [PAL.spiral, -0.05, -0.02], [PAL.orange, -0.01, 0.0], [PAL.green, 0.06, -0.03]].map(([c, x, z]) => {
    const b = mesh(new THREE.SphereGeometry(0.022, 8, 6).scale(1, 0.55, 1), c, { ink: 0.002, mat: 'glaze' }); b.position.set(x, 0.022, z); pan.add(b); return b; });
  pan.position.set(...COOK.pan); pan.rotation.y = COOK.ry; tf.add(pan);
  const flame2 = flame.clone(); flame2.position.x = T.x + COOK.pan[0]; flame2.visible = false; g.add(flame2);
  const stick = (len, back, col, head) => {                          // along +y, tip at y = len (spot), handle back to -back
    const s = new THREE.Group(), h = cyl(0.007, 0.007, len + back - head.l, col, { mat: 'wood', ink: 0.002 });
    h.position.y = (len - head.l - back) / 2; s.add(h); head.m.position.y = len - head.l / 2; s.add(head.m);
    s.traverse(o => { if (o.isMesh) o.userData.phys = 'none'; }); s.visible = false; g.add(s); return s;
  };
  const spatula = stick(TOOLS.spatula.reach, TOOLS.spatula.back, '#B07A3A', { l: 0.07, m: box(0.05, 0.07, 0.008, '#B07A3A', { mat: 'wood', ink: 0.002 }) });
  const brush = stick(TOOLS.brush.reach, TOOLS.brush.back, PAL.spiral, { l: 0.03, m: box(0.012, 0.03, 0.016, PAL.white, { mat: 'plastic', ink: 0.002 }) });
  const spoon = stick(TOOLS.spoon.reach, TOOLS.spoon.back, PAL.lav, { l: 0.045, m: mesh(new THREE.SphereGeometry(0.02, 10, 6).scale(1, 1.4, 0.4), PAL.lav, { mat: 'metal', ink: 0.002 }) });
  // his bowl at the table (eat frame), out only while he's eating
  const ef = frame(SPOTS.EAT); g.add(ef);
  const dish = new THREE.Group(); dish.name = 'bowl';
  dish.add(lathe([[0, 0], [0.04, 0], [0.075, 0.03], [0.085, 0.055], [0.08, 0.055], [0.07, 0.032], [0, 0.012]], PAL.teal, { mat: 'glaze' }));
  const dal = glow(new THREE.CircleGeometry(0.068, 18).rotateX(-Math.PI / 2), '#E8A93A'); dal.position.y = 0.04; dish.add(dal);
  dish.traverse(o => { if (o.isMesh) o.userData.phys = 'none'; });
  dish.position.set(EAT.bowl[0], EAT.bowl[1] - 0.015, EAT.bowl[2]); dish.visible = false; ef.add(dish);
  // table for two under a pendant, fruit in a bowl; a window on the sky over it; a plant in the corner
  const tx = TABLE.x, tz = TABLE.z, table = new THREE.Group(); table.name = 'table';
  table.add(at(cyl(0.38, 0.38, 0.04, PAL.white, { mat: 'paint' }, 28), 0, 0.74, 0));
  table.add(at(cyl(0.03, 0.03, 0.72, PAL.ink, { mat: 'metal' }), 0, 0.36, 0));
  table.add(at(cyl(0.2, 0.22, 0.03, PAL.ink, { mat: 'metal' }), 0, 0.015, 0));
  table.add(at(lathe([[0.03, 0], [0.11, 0.02], [0.14, 0.07]], PAL.orange, { mat: 'glaze' }), 0.05, 0.76, 0.05));
  [[PAL.red, 0.02, 0.07], [PAL.spiral, 0.1, 0.03], [PAL.green, 0.05, 0.12]].forEach(([c, x, z]) => table.add(at(mesh(new THREE.SphereGeometry(0.045, 10, 8), c, { ink: 0.003, mat: 'glaze' }), x, 0.83, z)));
  table.scale.setScalar(1.15); g.add(at(table, tx, 0, tz)); solid(tx - 0.44, tz - 0.44, tx + 0.44, tz + 0.44);
  const rug = flat(2.5, 2.1, PAL.mag, { mat: 'fabric' }); rug.position.set(tx, 0.005, tz); g.add(rug);
  for (const [cx, cz] of [[0, 1], [1, 0]]) {
    const ch = new THREE.Group();
    ch.add(at(box(0.4, 0.04, 0.4, PAL.red, { mat: 'paint' }), 0, 0.45, 0));
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ch.add(at(cyl(0.015, 0.015, 0.45, PAL.ink, { mat: 'metal', ink: 0.003 }), a * 0.17, 0.225, b * 0.17));
    ch.add(at(box(0.4, 0.3, 0.03, PAL.red, { mat: 'paint' }), 0, 0.78, -0.185));
    for (const a of [-1, 1]) ch.add(at(cyl(0.015, 0.015, 0.36, PAL.ink, { mat: 'metal', ink: 0.003 }), a * 0.17, 0.63, -0.185));
    const px = tx + cx * 0.72, pz = tz + cz * 0.72;
    g.add(at(ch, px, 0, pz, cz > 0 ? Math.PI : cz < 0 ? 0 : -Math.PI / 2)); solid(px - 0.2, pz - 0.2, px + 0.2, pz + 0.2);
  }
  const pend = new THREE.Group();
  pend.add(at(cyl(0.004, 0.004, 0.6, PAL.ink, { ink: false }), 0, 0.3, 0));
  pend.add(at(mesh(new THREE.ConeGeometry(0.2, 0.18, 20, 1, true), PAL.spiral, { ink: 0.006, mat: 'metal' }), 0, -0.06, 0));
  pend.children[1].material.side = THREE.DoubleSide;
  pend.add(at(glow(new THREE.SphereGeometry(0.05, 10, 8), '#FFF3B0'), 0, -0.13, 0));
  g.add(at(pend, tx, 1.95, tz));
  const win = new THREE.Group(); win.name = 'kitchen window';
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), toon(null, { unlit: true, map: skyTex('night') })); sky.userData.phys = 'none'; win.add(sky);   // main.js swaps the map with the hour win.userData.sky = sky;
  for (const [w, h, x, y] of [[1.02, 0.06, 0, 0.43], [1.02, 0.06, 0, -0.43], [0.06, 0.92, -0.48, 0], [0.06, 0.92, 0.48, 0], [0.9, 0.04, 0, 0], [0.04, 0.8, 0, 0]])
    win.add(at(box(w, h, 0.06, PAL.white, { mat: 'paint', ink: 0.006 }), x, y, 0.03));
  win.add(at(box(1.1, 0.05, 0.16, PAL.white, { mat: 'paint', ink: 0.006 }), 0, -0.47, 0.07));
  const pot = new THREE.Group(); pot.add(at(cyl(0.06, 0.045, 0.1, PAL.orange, { mat: 'clay', ink: 0.004 }), 0, 0.05, 0));
  for (let i = 0; i < 5; i++) { const lf = mesh(new THREE.SphereGeometry(0.04, 8, 6).scale(0.6, 1.6, 0.25), PAL.green, { ink: 0.003, mat: 'leaf' }); lf.position.set(Math.cos(i * 1.3) * 0.025, 0.15, Math.sin(i * 1.3) * 0.025); lf.rotation.set(Math.sin(i) * 0.4, i * 1.3, Math.cos(i) * 0.4); pot.add(lf); }
  win.add(at(pot, 0.3, -0.445, 0.08));
  g.add(at(win, X0 + 0.005, 1.65, K.z0 + 2.9, Math.PI / 2));
  const kp = monstera(PAL.teal, 7); kp.scale.setScalar(0.72); g.add(at(kp, X0 + 0.4, 0, K.z1 - 0.42, 0.4)); solid(X0, K.z1 - 0.62, X0 + 0.62, K.z1);

  // foyer dressing: a runner down the middle, a plant in each far corner (the room door end stays clear)
  const fx0 = RW / 2 + 0.05, fx1 = fx0 + FOYER.len;
  const runner = flat(FOYER.len - 0.9, 0.9, PAL.spiral, { mat: 'fabric' }); runner.position.set((fx0 + fx1) / 2 - 0.1, 0.006, CZ); g.add(runner);
  for (const [z, ry] of [[FZ0 + 0.36, 0.5], [FZ1 - 0.36, 2.2]]) {
    const fp = monstera(z < CZ ? PAL.orange : PAL.teal, 6); fp.scale.setScalar(0.66); g.add(at(fp, fx1 - 0.42, 0, z, ry));
    solid(fx1 - 0.58, z - 0.36, fx1, z + 0.36);
  }

  // rooms for the HUD (where am I / the places menu)
  const zones = [
    { name: 'the bathroom', x0: X0, x1: B.x1, z0: B.z0, z1: B.z1, at: [B.door, B.z1 - 0.7] },
    { name: 'the kitchen', x0: X0, x1: K.x1, z0: K.z0, z1: K.z1, at: [K.door, K.z0 + 0.8] },
  ];
  const zoneAt = p => zones.find(z => p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1);

  // ---------------------------------------------------------------- per frame
  const v = new THREE.Vector3(), easeTo = (a, b, k) => a + (b - a) * k;
  const st = { curtain: 0, fridge: 0, boil: 0 };
  const fall = (l, x, y0, z, len, t, speed = 3) => {                   // streaks dropping from (x, y0, z), each `len` long
    const p = l.geometry.attributes.position;
    l.userData.seed.forEach(([a, r, ph], i) => {
      const k = (t * speed / Math.max(0.3, y0) + ph) % 1, y = y0 - k * y0, sx = x + Math.cos(a) * r * (0.4 + k), sz = z + Math.sin(a) * r * (0.4 + k);
      p.setXYZ(i * 2, sx, y, sz); p.setXYZ(i * 2 + 1, sx, Math.max(0, y - len), sz);
    });
    p.needsUpdate = true; l.visible = true;
  };
  // a held stick on his palm (acts.js heldAt): axis along the fingers, HELD off the palm
  const pv = new THREE.Vector3(), m4 = new THREE.Matrix4(), xv = new THREE.Vector3();
  function hold(o, man) {
    const { pos, F, N, PALM_T } = palmFrame(man, 'handR');
    o.position.copy(man.root.localToWorld(pv.copy(pos).addScaledVector(N, PALM_T + HELD)));
    const q = man.root.getWorldQuaternion(new THREE.Quaternion());
    m4.makeBasis(xv.crossVectors(F, N), F, N); o.quaternion.setFromRotationMatrix(m4).premultiply(q); o.visible = true;
  }
  function update(dt, t, player, man) {
    const sp = player.st.seated, u = sp?.t || 0, k = 1 - Math.exp(-6 * dt), pos = player.pos;
    // door curtains part round him
    for (const c of curtains) {
      const near = Math.abs(pos.x - c.x) < hw + 0.35 && Math.abs(pos.z - c.z) < 0.85;
      c.open = easeTo(c.open, near ? 1 : 0, 1 - Math.exp(-9 * dt));
      c.halves.forEach((h, i) => { h.scale.x = 1 - 0.72 * c.open; h.rotation.z = (i ? -1 : 1) * 0.0; h.children.forEach(m => { m.rotation.y = (i ? 1 : -1) * 0.25 * c.open; }); });
    }
    // shower: curtain draws once he's in, water runs, steam rises over the rail
    const showering = sp === SPOTS.SHOWER;
    st.curtain = easeTo(st.curtain, showering && u > 0.5 ? 1 : 0, 1 - Math.exp(-4 * dt));
    curtain.scale.x = 0.16 + 0.84 * st.curtain;
    if (showering && u > 0.3) fall(rain, S.x, 1.98, B.z0 + 0.26, 0.22, t, 2.4); else rain.visible = false;
    steam.forEach((p, i) => {
      const on = showering && u > 1.5, kk = (t * 0.12 + p.userData.k) % 1;
      p.visible = on; if (!on) return;
      p.position.set(S.x - 0.3 + (i % 3) * 0.3 + Math.sin(t + i) * 0.05, 1.9 + kk * 0.9, S.z + Math.cos(i * 2.1) * 0.25);
      p.scale.setScalar(0.4 + kk * 1.4 * (1 - kk));
    });
    // basin tap while he splashes
    if (sp === SPOTS.WASH && player.st.spec?.tap) fall(tapRun, bx, 0.96, B.z0 + 0.14, 0.05, t, 3); else tapRun.visible = false;
    // fridge doors follow the act's clock; swing shut when he walks off
    const fridging = sp === SPOTS.FRIDGE, P = fridgeProps(fridging ? u : 0);
    st.fridge = fridging ? P.a : easeTo(st.fridge, 0, 1 - Math.exp(-5 * dt));
    for (const d of doors) d.piv.rotation.y = -d.s * st.fridge;
    juice.position.set(...(fridging ? P.bottle : FRIDGE.bottle));
    // tea: the kettle boils on the ring, he pours (a stream from the spout), the mug fills and goes with his hand
    const brewing = sp === SPOTS.TEA, Q = teaProps(brewing ? u : 0);
    flame.visible = brewing && u < 6.4;
    kettle.position.set(...Q.base); kettle.rotation.set(0, 0, -Q.tilt);
    if (brewing && u < TEA.boil) kettle.position.y += Math.max(0, Math.sin(t * 40)) * 0.002 * (u / TEA.boil);
    mug.position.set(...Q.mug); tea.visible = brewing && Q.full;
    if (brewing && Q.pouring) { tf.localToWorld(v.set(...Q.tip)); fall(pourRun, v.x, v.y, v.z, 0.06, t, 2); } else pourRun.visible = false;
    if (!brewing && st.boil) mug.position.set(...teaProps(0).mug);
    st.boil = brewing;
    // brushing, cooking, eating: the thing in his hand rides his palm (main.js passes the man; tests may not)
    const spec = player.st.spec || {}, brushing = sp === SPOTS.BRUSH, cooking = sp === SPOTS.COOK, eating = sp === SPOTS.EAT;
    if (brushing && spec.tap) fall(tapRun, bx, 0.96, B.z0 + 0.14, 0.05, t, 3);
    mine.visible = !(brushing && spec.brush && man);
    if (man && brushing && spec.brush) hold(brush, man); else brush.visible = false;
    flame2.visible = cooking;
    const C = cookProps(cooking ? u : 0, t);
    pan.position.set(COOK.pan[0], COOK.pan[1] + (cooking ? C.dy : 0), COOK.pan[2]);
    food.forEach((b, i) => { if (cooking) b.position.y = 0.022 + Math.max(0, Math.sin(t * 18 + i)) * C.shake * 0.03; });
    if (man && cooking && u > 0.5) hold(spatula, man); else spatula.visible = false;
    dish.visible = eating;
    if (man && eating && u > 0.3) hold(spoon, man); else spoon.visible = false;
  }

  return {
    group: g, update, zones, zoneAt, spots: SPOTS, curtains, sky,
    objs: { sink, mirror, loo, shower: [tray, head, curtain, knee], fridge: fr, hob: [kettle, mug], table, pan, toothbrush: mine },
  };
}
