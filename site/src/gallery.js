// The gallery: a short corridor from the room's door, then one hall per era (data/art.json from tools/export_art.py)
// strung together like a maze: each hall's way out is on a different side (east, then north, east, south ...) and
// off-centre, through a short passage with a door in it, so the route winds instead of running in a line.
// Frames hang round every wall (two-row salon hang for big eras), reading clockwise from the door you came in by.
// A bench sits in the middle of every hall. Textures load per hall when the player gets close; videos play only near
// the player (small pool). Door leaves are made by doors.js from `doorways` (after the nav grid is baked).
import { batch } from './batch.js';
import * as THREE from 'three';
import { mesh, toon } from './look.js';
import { PAL } from './textures.js';
import { W as RW, D as RD, DOOR, floorLamp, monstera } from './room.js';
import { ANNEX } from './annex.js';

const HALL_H = 4.2, PASS_H = 2.6, WT = 0.12;                    // hall walls, passage walls, wall thickness
const DW = DOOR.z1 - DOOR.z0, DH = 2.35;                       // every doorway matches the room door: 1.4 wide
const PL = 3.2;                                                 // passage length (the door hangs in the middle)
const CZ = (DOOR.z0 + DOOR.z1) / 2;
const COLS = [PAL.plum, '#1E6B63', PAL.indigo, '#8A1F3D', '#2B5C2E', PAL.violet];
const FLOORS = ['#2A1A9E', '#103F3A', '#140B52', '#4A0F22', '#173A1A', '#2A0F5C'];
const LEAVES = [PAL.red, PAL.spiral, PAL.mag, PAL.teal, PAL.orange, PAL.lav];
// way out of each hall: side and where along that wall (0..1). The way in is wherever the last passage arrives.
const ROUTE = [['N', 0.7], ['E', 0.3], ['S', 0.75], ['E', 0.65], ['N', 0.35], ['E', 0.5]];
const DIR = { E: [1, 0], N: [0, -1], S: [0, 1], W: [-1, 0] };
const OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };

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

// a gallery bench: slab top at 0.42 (acts.js `bench` sits on it) on two solid end legs
function bench() {
  const b = new THREE.Group();
  b.add(at(box(2.0, 0.06, 0.46, PAL.wood, { ink: 0.01, mat: 'wood', matAxis: 'x' }), 0, 0.39, 0));
  for (const s of [-1, 1]) b.add(at(box(0.07, 0.36, 0.4, PAL.ink, { ink: 0.006, mat: 'metal', matAxis: 'y' }), s * 0.82, 0.18, 0));
  return b;
}

// a hall's four walls as [side, start, end, fixed coordinate, axis] with the doorway gaps cut out
const SIDES = ['N', 'E', 'S', 'W'];                              // clockwise seen from above (-z is north)
function wallLine(h, side) {                                     // inner face runs from a to b (clockwise), normal into the hall
  const { x0, x1, z0, z1 } = h;
  return {
    N: { a: [x0, z0], b: [x1, z0], n: [0, 1] }, E: { a: [x1, z0], b: [x1, z1], n: [-1, 0] },
    S: { a: [x1, z1], b: [x0, z1], n: [0, -1] }, W: { a: [x0, z1], b: [x0, z0], n: [1, 0] },
  }[side];
}
// frame slots along a hall's walls, clockwise from the way in (gaps kept clear round doorways and corners)
function slots(h, rows, size) {
  const pitch = size + 0.45, out = [];
  const start = SIDES.indexOf(h.inSide);
  for (let k = 0; k < 4; k++) {
    const side = SIDES[(start + k) % 4], L = wallLine(h, side), len = Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]);
    const gaps = h.doors.filter(d => d.side === side).map(d => d.t * len).sort((a, b) => a - b);
    let segs = [[0.9, len - 0.9]];                               // keep corners clear
    for (const g of gaps) segs = segs.flatMap(([a, b]) => [[a, Math.min(b, g - DW / 2 - 0.45)], [Math.max(a, g + DW / 2 + 0.45), b]]);
    for (const [a, b] of segs) {
      const n = Math.floor((b - a + 0.45) / pitch); if (n < 1) continue;
      const pad = (b - a - n * pitch + 0.45) / 2;
      for (let i = 0; i < n; i++) for (let r = 0; r < rows; r++) {
        const s = a + pad + i * pitch + size / 2, t = s / len;
        out.push({ x: L.a[0] + (L.b[0] - L.a[0]) * t, z: L.a[1] + (L.b[1] - L.a[1]) * t, n: L.n, row: r });
      }
    }
  }
  return out;
}

export async function buildGallery(ctx) {
  const { halls } = await (await fetch('/data/art.json')).json();
  await document.fonts.ready;
  const g = new THREE.Group();
  const loader = new THREE.TextureLoader();
  const zones = [], frames = [], doorways = [], benches = [];
  // walls: low ones block walking; the chase camera stops at gallery walls (`arm`) instead of cutting them away
  const wall = (w, h, d, c, x, y, z) => {
    const m = at(box(w, h, d, c, { ink: 0.008, shade: 0.35, mat: 'plaster' }), x, y, z);
    m.userData.wall = true; m.userData.arm = true; ctx.walls.push(m); g.add(m);
    if (y - h / 2 < 1) ctx.solid(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    return m;
  };
  const floor = (x0, x1, z0, z1, c) => { const f = mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), c, { ink: false, shade: 0.3, mat: 'wood', matAxis: 'x', matAmt: 0.55 }); f.rotation.x = -Math.PI / 2; f.userData.floor = true; f.position.set((x0 + x1) / 2, 0.002, (z0 + z1) / 2); g.add(f); };
  // a straight passage from point p heading dir for len, inner width DW, with walls both sides (+ door in the middle)
  const taken = [[-RW / 2 - 0.2, -RD / 2 - 0.2, RW / 2 + 0.2, RD / 2 + 0.2]];   // floor-plan rects already used
  // `cuts` ({s, x, w}: side -1/+1, centre x, width): doorways in an E/W passage's side walls (the annex rooms)
  function passage(p, dir, len, col, withDoor, k, cuts = [], wid = DW) {
    const [dx, dz] = DIR[dir], ex = p[0] + dx * len, ez = p[1] + dz * len, hw = wid / 2 + WT / 2;
    const x0 = Math.min(p[0], ex), x1 = Math.max(p[0], ex), z0 = Math.min(p[1], ez), z1 = Math.max(p[1], ez);
    if (dx) {
      floor(x0, x1, p[1] - wid / 2, p[1] + wid / 2, '#2A1A9E');
      for (const s of [-1, 1]) {
        const z = p[1] + s * hw; let a = x0;
        for (const c of cuts.filter(c => c.s === s).sort((m, n) => m.x - n.x)) {
          const l = c.x - c.w / 2, r = c.x + c.w / 2;
          if (l > a) wall(l - a, PASS_H, WT, col, (a + l) / 2, PASS_H / 2, z);
          wall(c.w, PASS_H - DH, WT, col, c.x, (PASS_H + DH) / 2, z);              // lintel
          const jamb = (o) => { o.userData.wall = true; o.userData.arm = true; ctx.walls.push(o); g.add(o); return o; };
          for (const e of [-1, 1]) { const jx = c.x + e * (c.w / 2 - 0.05); jamb(at(box(0.1, DH + 0.06, 0.14, PAL.white, { ink: 0.008, mat: 'paint', matAxis: 'y' }), jx, (DH + 0.06) / 2, z)); ctx.solid(jx - 0.05, z - 0.07, jx + 0.05, z + 0.07); }
          jamb(at(box(c.w, 0.08, 0.14, PAL.white, { ink: 0.008, mat: 'paint' }), c.x, DH + 0.04, z));
          a = r;
        }
        if (x1 > a) wall(x1 - a, PASS_H, WT, col, (a + x1) / 2, PASS_H / 2, z);
      }
    }
    else { floor(p[0] - DW / 2, p[0] + DW / 2, z0, z1, '#2A1A9E'); for (const s of [-1, 1]) wall(WT, PASS_H, len, col, p[0] + s * hw, PASS_H / 2, (z0 + z1) / 2); }
    taken.push(dx ? [x0, p[1] - hw - 0.1, x1, p[1] + hw + 0.1] : [p[0] - hw - 0.1, z0, p[0] + hw + 0.1, z1]);
    if (withDoor) {
      const mx = (p[0] + ex) / 2, mz = (p[1] + ez) / 2, phi = Math.atan2(dx, dz);
      // white frame round the leaf: jambs + header; wall above the header up to the passage top
      const jamb = (o) => { o.userData.wall = true; o.userData.arm = true; ctx.walls.push(o); g.add(o); return o; };
      for (const s of [-1, 1]) jamb(at(box(0.1, DH + 0.06, 0.14, PAL.white, { ink: 0.008, mat: 'paint', matAxis: 'y' }), mx + (dx ? 0 : s * (DW / 2 - 0.05)), (DH + 0.06) / 2, mz + (dx ? s * (DW / 2 - 0.05) : 0), dx ? Math.PI / 2 : 0));
      jamb(at(box(DW, 0.08, 0.14, PAL.white, { ink: 0.008, mat: 'paint' }), mx, DH + 0.04, mz, dx ? Math.PI / 2 : 0));
      wall(dx ? 0.12 : DW, PASS_H - DH - 0.08, dx ? DW : 0.12, col, mx, (PASS_H + DH + 0.08) / 2, mz);
      doorways.push({ x: mx, z: mz, phi, w: DW - 0.22, h: DH, color: LEAVES[k % LEAVES.length], hinge: k % 2 ? 1 : -1 });
    }
    return [ex, ez];
  }

  // corridor: room door -> first hall (the room door itself gets a leaf too)
  const cStart = [RW / 2 + 0.05, CZ];
  let p = passage(cStart, 'E', ANNEX.foyer.len, PAL.plum, false, 0, [{ s: -1, x: ANNEX.bath.door, w: ANNEX.dw }, { s: 1, x: ANNEX.kitchen.door, w: ANNEX.dw }], ANNEX.foyer.w);
  taken.push([ANNEX.x0 - WT, ANNEX.bath.z0 - WT, ANNEX.bath.x1 + WT, CZ - ANNEX.foyer.w / 2], [ANNEX.x0 - WT, CZ + ANNEX.foyer.w / 2, ANNEX.kitchen.x1 + WT, ANNEX.kitchen.z1 + WT]);   // the annex rooms
  doorways.push({ x: RW / 2, z: CZ, phi: Math.PI / 2, w: DW - 0.1, h: DOOR.h - 0.02, color: PAL.red, hinge: 1, room: true });   // hinged on the TV side: swings clear of the snake painting
  zones.push({ name: 'corridor', title: 'to the gallery', x0: cStart[0], x1: p[0], z0: CZ - ANNEX.foyer.w / 2, z1: CZ + ANNEX.foyer.w / 2 });

  let inDir = 'E';
  halls.forEach((h, i) => {
    const n = h.works.length, rows = n > 26 ? 2 : 1, size = rows === 2 ? 1.05 : 1.45;
    const [outSide, outT] = i < halls.length - 1 ? ROUTE[i % ROUTE.length] : [null, 0];
    const inSide = OPP[inDir], inT = 0.5;
    // grow the hall until its walls hold every work, then place it so its way in meets the passage end `p`
    let W = 8, D = 8, hall; const P = p;
    for (let tries = 0; ; tries++) {
      const place = () => {
        const r = {}, p = [P[0] + DIR[inDir][0] * WT, P[1] + DIR[inDir][1] * WT];   // walls sit outside the floor rect
        if (inSide === 'W') { r.x0 = p[0]; r.z0 = p[1] - inT * D; }
        if (inSide === 'S') { r.x0 = p[0] - inT * W; r.z0 = p[1] - D; }
        if (inSide === 'N') { r.x0 = p[0] - inT * W; r.z0 = p[1]; }
        r.x1 = r.x0 + W; r.z1 = r.z0 + D;
        return r;
      };
      hall = place();
      hall.inSide = inSide;
      hall.doors = [{ side: inSide, t: inSide === 'S' || inSide === 'W' ? 1 - inT : inT }];
      if (outSide) hall.doors.push({ side: outSide, t: outT });
      if (slots(hall, rows, size).length >= n || tries > 30) break;
      if (tries % 2) W += 1; else D += 1;
    }
    const { x0, x1, z0, z1 } = hall, col = COLS[i % COLS.length], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (taken.some(r => r[0] < x1 && r[2] > x0 && r[1] < z1 && r[3] > z0)) console.warn('gallery: hall overlaps', h.id);
    taken.push([x0, z0, x1, z1]);
    floor(x0, x1, z0, z1, FLOORS[i % FLOORS.length]);
    // walls with doorway gaps (full height beside the gap, a lintel above it)
    for (const side of SIDES) {
      const L = wallLine(hall, side), horiz = side === 'N' || side === 'S';
      const len = horiz ? W + WT : D - WT;                                         // N / S run past the corners
      const off = horiz ? -WT / 2 : WT / 2;                                        // where the run starts along the line
      const dirv = [Math.sign(L.b[0] - L.a[0]), Math.sign(L.b[1] - L.a[1])];
      const fixed = horiz ? L.a[1] - L.n[1] * WT / 2 : L.a[0] - L.n[0] * WT / 2;    // wall centre line, just outside
      const gaps = hall.doors.filter(d => d.side === side).map(d => d.t * (horiz ? W : D) - off).sort((a, b) => a - b);
      let s0 = 0;
      const piece = (a, b, y0, y1) => {
        if (b - a < 0.01) return;
        const m = (a + b) / 2 + off, px = L.a[0] + dirv[0] * m, pz = L.a[1] + dirv[1] * m;
        if (horiz) wall(b - a, y1 - y0, WT, col, px, (y0 + y1) / 2, fixed); else wall(WT, y1 - y0, b - a, col, fixed, (y0 + y1) / 2, pz);
      };
      for (const gp of gaps) { piece(s0, gp - DW / 2, 0, HALL_H); piece(gp - DW / 2, gp + DW / 2, PASS_H, HALL_H); s0 = gp + DW / 2; }   // passage walls butt onto the gap's edges
      piece(s0, len, 0, HALL_H);
    }
    // sign above the way in, on the inside face
    const Lin = wallLine(hall, inSide), tin = hall.doors[0].t;
    const sx = Lin.a[0] + (Lin.b[0] - Lin.a[0]) * tin, sz = Lin.a[1] + (Lin.b[1] - Lin.a[1]) * tin;
    const sg = sign(h.title, `${n} works · hall ${i + 1}/${halls.length}`, col);
    sg.position.set(sx + Lin.n[0] * 0.02, 3.35, sz + Lin.n[1] * 0.02); sg.rotation.y = Math.atan2(Lin.n[0], Lin.n[1]); sg.scale.setScalar(0.62); g.add(sg);

    // bench in the middle, facing a wall with no doorway
    const faceN = !hall.doors.some(d => d.side === 'N');
    const b = bench(); at(b, cx, 0, cz); g.add(b);
    ctx.solid(cx - 1.0, cz - 0.24, cx + 1.0, cz + 0.24);
    const heading = faceN ? Math.PI : 0, fz = faceN ? -1 : 1;
    benches.push({ obj: b, seat: { x: cx, z: cz, heading, act: 'bench', out: [cx, cz + fz * 0.62] }, face: [cx, cz + fz * 2] });

    // corners: a standing lamp tucked into each one (its pool spills into the hall), a monstera beside every other one.
    // Frames keep 0.9 m clear of corners, so neither touches the hang; the solids overlap so no body-width pocket opens.
    [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([qx, qz], k) => {
      const ix = qx === x0 ? 1 : -1, iz = qz === z0 ? 1 : -1;               // into the hall
      const lx = qx + ix * 0.42, lz = qz + iz * 0.42;               // shade (r 0.3 x 1.3) clears both walls
      const lp = at(floorLamp(LEAVES[(i + k) % LEAVES.length], [ix * 0.45, iz * 0.45], [0.6, 0.6]), lx, 0, lz);
      lp.scale.setScalar(1.3); g.add(lp);                             // halls are 4.2 m tall: a room-sized lamp looks like a toy
      ctx.solid(lx - 0.27, lz - 0.27, lx + 0.27, lz + 0.27);
      if ((k + i) % 2) return;
      const px = qx + ix * 0.85, pz = qz + iz * 0.85;
      const pt = at(monstera(PAL.orange, 6 + (k % 2)), px, 0, pz, k + i);
      pt.scale.setScalar(1.15); g.add(pt);
      // solid right back to both walls: the strips between the pot and the walls are just under a body wide, a dead end
      // he could still wedge into
      const ex = px + ix * 0.36, ez = pz + iz * 0.36;
      ctx.solid(Math.min(qx, ex), Math.min(qz, ez), Math.max(qx, ex), Math.max(qz, ez));
    });

    // entry spot for portals: just inside the way in, facing into the hall
    const ex = sx + Lin.n[0] * 1.1, ez = sz + Lin.n[1] * 1.1;
    const zone = { name: h.id, title: h.title, x0, x1, z0, z1, frames: [], loaded: false, entry: { x: ex, z: ez, heading: Math.atan2(Lin.n[0], Lin.n[1]) } };
    zones.push(zone);
    const S = slots(hall, rows, size);
    h.works.forEach((w, k) => {
      const s = S[k]; if (!s) return;
      const fy = rows === 2 ? (s.row === 0 ? 1.45 : 2.75) : 1.65;
      const ar = w.w / w.h, fw = ar >= 1 ? size : size * ar, fh = ar >= 1 ? size / ar : size;
      const fr = new THREE.Group();
      fr.add(box(fw + 0.1, fh + 0.1, 0.05, PAL.ink, { ink: 0.006, mat: 'wood', matAmt: 0.5 }));
      const art = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), toon(PAL.paper, { unlit: true }));
      art.position.z = 0.03; fr.add(art);
      const fx = s.x + s.n[0] * 0.03, fz2 = s.z + s.n[1] * 0.03;
      at(fr, fx, fy, fz2, Math.atan2(s.n[0], s.n[1]));
      g.add(fr);
      const f = { work: w, art, group: fr, pos: new THREE.Vector3(s.x + s.n[0] * 1.0, 0, s.z + s.n[1] * 1.0), look: new THREE.Vector3(fx, fy, fz2) };
      zone.frames.push(f); frames.push(f);
    });

    // way out: a passage with a door, to where the next hall starts
    if (outSide) {
      const L = wallLine(hall, outSide), t = outT;
      const ox = L.a[0] + (L.b[0] - L.a[0]) * t - L.n[0] * WT, oz = L.a[1] + (L.b[1] - L.a[1]) * t - L.n[1] * WT;
      p = passage([ox, oz], outSide, PL, col, true, i);
      inDir = outSide;
    }
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

  // halls he has walked away from give their textures back to the GPU (a 1024 px poster is ~5 MB decoded); they reload on return
  function unloadZone(z) {
    z.loaded = false;
    for (const f of z.frames) if (f.poster && !playing.has(f)) {
      f.poster.dispose(); f.poster = null;
      const u = f.art.material.uniforms; u.uMap.value = null; u.uHasMap.value = 0; f.art.material.needsUpdate = true;
    }
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

  const near = (z, p, m) => p.x > z.x0 - m && p.x < z.x1 + m && p.z > z.z0 - m && p.z < z.z1 + m;
  function update(p) {
    for (const z of zones) {
      if (!z.frames) continue;
      if (near(z, p, 8)) loadZone(z); else if (z.loaded && !near(z, p, 16)) unloadZone(z);
      // a hall's art is only drawn while he is in or next to it (halls are walled; saves ~half the draw calls on phones)
      const on = near(z, p, 7);
      if (on !== z.drawn) { z.drawn = on; for (const f of z.frames) f.group.visible = on; }
    }
    updateVideos(p);
  }
  const zoneAt = p => zones.find(z => near(z, p, 0));

  batch(g);   // frame boards and benches: a few hundred draws -> a handful (art, signs, walls and doors keep their own meshes)
  return { group: g, zones, frames, doorways, benches, update, zoneAt };
}
