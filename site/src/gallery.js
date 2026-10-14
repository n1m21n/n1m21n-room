// The gallery: a corridor from the room's doorway, then one hall per era (data/art.json from tools/export_art.py),
// laid end to end along +x like the Infinite museum hall. Frames hang on both long walls; big eras get a two-row salon hang.
// Textures load per hall when the player gets close; videos play only near the player (small pool).
import * as THREE from 'three';
import { mesh, toon } from './look.js';
import { PAL } from './textures.js';
import { W as RW, DOOR } from './room.js';

const HALL_W = 7, HALL_H = 4.2, DOOR_W = 2.2, GAP = 1.65;
const CZ = (DOOR.z0 + DOOR.z1) / 2;                                 // every doorway lines up with the room door
const COLS = [PAL.plum, '#1E6B63', PAL.indigo, '#8A1F3D', '#2B5C2E', PAL.violet];
const FLOORS = ['#2A1A9E', '#103F3A', '#140B52', '#4A0F22', '#173A1A', '#2A0F5C'];

const box = (w, h, d, c, o) => mesh(new THREE.BoxGeometry(w, h, d), c, o);
function at(o, x, y, z, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; return o; }

function sign(text, sub, col) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = PAL.paper; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = col; g.font = "800 120px 'Bricolage Grotesque', sans-serif"; g.textBaseline = 'middle';
  g.fillText(text, 40, 110);
  g.fillStyle = PAL.ink; g.font = "500 40px 'DM Mono', monospace"; g.fillText(sub, 44, 205);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), toon(null, { map: t, unlit: true }));
}

export async function buildGallery(ctx) {
  const { halls } = await (await fetch('/data/art.json')).json();
  await document.fonts.ready;
  const g = new THREE.Group();
  const loader = new THREE.TextureLoader();
  const zones = [], frames = [];
  const wall = (w, h, d, c, x, y, z) => { const m = at(box(w, h, d, c, { ink: 0.008, shade: 0.35 }), x, y, z); m.userData.wall = true; ctx.walls.push(m); g.add(m); ctx.solid(x - w / 2, z - d / 2, x + w / 2, z + d / 2); return m; };
  const floor = (x0, x1, z0, z1, c) => { const f = mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), c, { ink: false, shade: 0.3 }); f.rotation.x = -Math.PI / 2; f.position.set((x0 + x1) / 2, 0.002, (z0 + z1) / 2); g.add(f); };

  // corridor: room door -> first hall
  const cx0 = RW / 2, cx1 = cx0 + 3, cw = DOOR.z1 - DOOR.z0 + 0.4;
  floor(cx0, cx1, CZ - cw / 2, CZ + cw / 2, '#2A1A9E');
  wall(cx1 - cx0, 3, 0.1, PAL.plum, (cx0 + cx1) / 2, 1.5, CZ - cw / 2);
  wall(cx1 - cx0, 3, 0.1, PAL.plum, (cx0 + cx1) / 2, 1.5, CZ + cw / 2);
  zones.push({ name: 'corridor', title: 'to the gallery', x0: cx0, x1: cx1, z0: CZ - cw / 2, z1: CZ + cw / 2 });

  let x = cx1;
  halls.forEach((h, i) => {
    const n = h.works.length, rows = n > 26 ? 2 : 1, size = rows === 2 ? 1.05 : 1.45;
    const perWall = Math.ceil(n / (2 * rows));
    const L = Math.max(12, perWall * (size + 0.5) + 4);
    const x0 = x, x1 = x + L, z0 = CZ - HALL_W / 2, z1 = CZ + HALL_W / 2, col = COLS[i % COLS.length];
    floor(x0, x1, z0, z1, FLOORS[i % FLOORS.length]);
    wall(L, HALL_H, 0.12, col, (x0 + x1) / 2, HALL_H / 2, z0);                     // long walls
    wall(L, HALL_H, 0.12, col, (x0 + x1) / 2, HALL_H / 2, z1);
    const side = (HALL_W - DOOR_W) / 2;                                              // entry wall with doorway
    wall(0.12, HALL_H, side, col, x0, HALL_H / 2, z0 + side / 2);
    wall(0.12, HALL_H, side, col, x0, HALL_H / 2, z1 - side / 2);
    wall(0.12, HALL_H - 2.6, DOOR_W, col, x0, (HALL_H + 2.6) / 2, CZ);
    if (i === halls.length - 1) wall(0.12, HALL_H, HALL_W, col, x1, HALL_H / 2, CZ);  // end wall
    const s = sign(h.title, `${n} works · hall ${i + 1}/${halls.length}`, col);
    s.position.set(x0 + 0.08, 3.2, CZ - DOOR_W / 2 - 1.3); s.rotation.y = Math.PI / 2; s.scale.setScalar(0.7); g.add(s);
    // a bench in the middle of every hall
    g.add(at(box(2.2, 0.42, 0.55, PAL.paper, { ink: 0.01 }), (x0 + x1) / 2, 0.21, CZ));
    ctx.solid((x0 + x1) / 2 - 1.1, CZ - 0.28, (x0 + x1) / 2 + 1.1, CZ + 0.28);

    const zone = { name: h.id, title: h.title, x0, x1, z0, z1, frames: [], loaded: false };
    zones.push(zone);
    h.works.forEach((w, k) => {                                                       // alternate walls, then rows, along x
      const onNorth = k % 2 === 0, slot = Math.floor(k / 2), col_ = Math.floor(slot / rows), row = slot % rows;
      const fx = x0 + 2 + col_ * (size + 0.5) + size / 2;
      const fy = rows === 2 ? (row === 0 ? 1.45 : 2.75) : 1.65;
      const ar = w.w / w.h, fw = ar >= 1 ? size : size * ar, fh = ar >= 1 ? size / ar : size;
      const fr = new THREE.Group();
      fr.add(box(fw + 0.1, fh + 0.1, 0.05, PAL.ink, { ink: 0.006 }));
      const art = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), toon(PAL.paper, { unlit: true }));
      art.position.z = 0.03; fr.add(art);
      const fz = onNorth ? z0 + 0.09 : z1 - 0.09;
      at(fr, fx, fy, fz, onNorth ? 0 : Math.PI);
      g.add(fr);
      const f = { work: w, art, group: fr, pos: new THREE.Vector3(fx, 0, onNorth ? z0 + 1.0 : z1 - 1.0), look: new THREE.Vector3(fx, fy, fz) };
      zone.frames.push(f); frames.push(f);
    });
    x = x1;
  });

  function loadZone(z) {
    if (z.loaded || !z.frames) return;
    z.loaded = true;
    for (const f of z.frames) loader.load(f.work.img, t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const u = f.art.material.uniforms; u.uMap.value = t; u.uHasMap.value = 1; f.art.material.needsUpdate = true;
      f.poster = t;
    });
  }

  // video pool: the nearest few video works play muted while the player is close
  const POOL = matchMedia('(pointer: coarse)').matches ? 2 : 4;
  const playing = new Map();
  function updateVideos(p) {
    const near = frames.filter(f => f.work.video && f.poster && Math.abs(f.pos.x - p.x) < 5 && Math.abs(f.pos.z - p.z) < 5)
      .sort((a, b) => a.pos.distanceToSquared(p) - b.pos.distanceToSquared(p)).slice(0, POOL);
    for (const [f, v] of playing) if (!near.includes(f)) {
      v.pause(); v.removeAttribute('src'); v.load();
      f.art.material.uniforms.uMap.value = f.poster; playing.delete(f);
    }
    for (const f of near) if (!playing.has(f)) {
      const v = Object.assign(document.createElement('video'), { src: f.work.video, muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous' });
      v.play().catch(() => {});
      const t = new THREE.VideoTexture(v); t.colorSpace = THREE.SRGBColorSpace;
      v.addEventListener('playing', () => { if (playing.get(f) === v) f.art.material.uniforms.uMap.value = t; }, { once: true });
      playing.set(f, v);
    }
  }

  function update(p) {
    for (const z of zones) if (z.frames && p.x > z.x0 - 8 && p.x < z.x1 + 8) loadZone(z);
    updateVideos(p);
  }

  return { group: g, zones, frames, update, end: x };
}
