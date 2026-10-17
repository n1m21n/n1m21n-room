// Layout suite: the world's own geometry, checked the same way for every room / hall / prop that gets added.
//   L1 props vs walls    - no prop vertex sits inside a wall slab (plant leaves through the wall, shelves sunk in)
//   L2 props vs floor    - no prop vertex below the floor
//   L3 floors stay drawn - orbit the camera at every spot: the camera cut-away never hides a floor (the black floor)
//   L4 doors             - walk through every door both ways, by tap and by keys: he gets through, and never
//                          passes the leaf while it is shut or stands inside it
//   L5 joints            - every act pose: each limb mesh still meets the next one (hand on the arm, head on the neck)
//   npm run test:layout [-- --only=L1,L4]
import { start, openPage, reporter, run, want } from './lib/harness.mjs';

const T = {
  wallFail: 0.01, wallWarn: 0.003,  // metres a prop may sit inside a wall slab
  floorFail: 0.01,                  // metres below the floor
  doorClear: 0.26 - 0.06,           // centre-to-leaf clearance (body radius 0.26; the push pose leans in)
  jointGap: 0.012,                  // metres between nearest vertices of a limb mesh and the next one (vertex spacing ~6 mm)
};
// limb meshes that must touch: [part, part] (names as baked: glb strips the dots)
const JOINTS = [['armL', 'handL'], ['armR', 'handR']];

run(async () => {
  const ctx = await start(), r = reporter('layout'), only = want('only');
  const on = k => !only.length || only.includes(k);
  const { page, errors } = await openPage(ctx);
  await page.evaluate(() => {
    const d = window.dev, TH = d.THREE;
    window.__shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    // the named thing a mesh belongs to (for reports): nearest named ancestor, else its geometry and spot
    window.__label = o => { for (let x = o; x; x = x.parent) if (x.name && x.name !== 'door') return x.name; const p = o.getWorldPosition(new TH.Vector3()); return `${o.geometry.type.replace('Geometry', '')} @${p.x.toFixed(2)},${p.z.toFixed(2)}`; };
    window.__isMan = o => { for (let x = o; x; x = x.parent) if (x === d.man.root) return true; return false; };
    window.__park = () => { const P = d.player; if (P.st.seated) P.stand(); P.st.frozen = false; P.cancelAuto(); P.keys.clear(); P.st.speed = 0; };
    // every prop mesh: drawn, not him, not a wall / floor / door / ink shell
    window.__props = () => { const out = []; d.scene.updateMatrixWorld(true);
      d.scene.traverse(o => { if (!o.isMesh || o.isSkinnedMesh || !(o.layers.mask & 1) || !window.__shown(o) || window.__isMan(o)) return;
        const u = o.userData; if (u.wall || u.floor || u.door) return; if (!o.material || o.material.side === TH.BackSide) return;
        let inDoor = false; for (const dd of d.doors.all) if (o.parent === dd.pivot) inDoor = true; if (inDoor) return;
        out.push(o); });
      return out; };
  });

  // ------------------------------------------------------------ L1 / L2
  if (on('L1') || on('L2')) {
    r.section('L1/L2 props vs walls and floor');
    const o = await page.evaluate(() => {
      const d = window.dev, TH = d.THREE, v = new TH.Vector3();
      // own geometry only (setFromObject would take in the ink shell child and fatten the slab)
      const own = o => { o.geometry.computeBoundingBox(); return o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); };
      const walls = []; d.scene.traverse(w => { if (w.isMesh && w.userData.wall && !w.userData.door) walls.push(own(w)); });
      const wall = {}, under = {};
      for (const m of window.__props()) {
        const mb = own(m), near = walls.filter(b => b.intersectsBox(mb)), p = m.geometry.attributes.position, k = window.__label(m);
        if (!p) continue;
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
          if (v.y < -0.002 && !m.material.transparent) under[k] = Math.max(under[k] || 0, -v.y);
          for (const b of near) {
            if (!b.containsPoint(v)) continue;
            const dep = Math.min(v.x - b.min.x, b.max.x - v.x, v.y - b.min.y, b.max.y - v.y, v.z - b.min.z, b.max.z - v.z);
            if (dep > (wall[k]?.dep || 0)) wall[k] = { dep, at: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)] };
          }
        }
      }
      return { n: window.__props().length, wall, under };
    });
    let bad = 0;
    for (const [k, h] of Object.entries(o.wall)) {
      const line = `${k}: ${(h.dep * 100).toFixed(1)} cm inside a wall at ${h.at}`;
      if (h.dep > T.wallFail) { r.fail('L1', line); bad++; } else if (h.dep > T.wallWarn) r.warn('L1', line);
    }
    if (on('L1') && !bad) r.ok('L1', `${o.n} prop meshes clear of every wall`);
    bad = 0;
    for (const [k, dep] of Object.entries(o.under)) if (dep > T.floorFail) { r.fail('L2', `${k}: ${(dep * 100).toFixed(1)} cm below the floor`); bad++; }
    if (on('L2') && !bad) r.ok('L2', `${o.n} prop meshes on or above the floor`);
  }

  // ------------------------------------------------------------ L3
  if (on('L3')) {
    r.section('L3 floors stay drawn whatever the camera does');
    const o = await page.evaluate(() => {
      const d = window.dev, P = d.player, floors = [], spots = [], bad = [];
      d.scene.traverse(f => { if (f.isMesh && f.userData.floor) floors.push(f); });
      for (const s of d.stations) if (!s.live) spots.push([s.p[0], s.p[1]]);
      for (const z of d.gallery.zones) if (z.entry) spots.push([z.entry.x, z.entry.z]);
      spots.push([0.3, 1.2], [-3.5, -2.5], [3.5, 2.5], [-3.5, 2.5], [3.5, -2.5], [3.7, 1.6]);
      let n = 0;
      for (const [x, z] of spots) for (let a = 0; a < 8; a++) for (const pitch of [0.05, 0.6]) {
        window.__park(); while (P.st.view !== 'third') P.cycleView();
        P.pos.set(x, 0, z); d.man.root.position.set(x, 0, z); P.st.yaw = (a / 8) * Math.PI * 2; P.st.pitch = pitch; P.st.dist = 3.8;
        for (let f = 0; f < 20; f++) P.update(1 / 30, f / 30); n++;
        const hid = floors.filter(f => !window.__shown(f));
        if (hid.length) bad.push({ spot: [x.toFixed(1), z.toFixed(1)], yaw: a * 45, pitch, n: hid.length });
      }
      window.__park();
      return { n, floors: floors.length, bad };
    });
    r.expect(o.floors > 0, 'L3', `${o.floors} floors tagged userData.floor`, 'no floor tagged: tag every floor mesh');
    r.expect(o.bad.length === 0, 'L3', `${o.n} camera poses, every floor drawn`, `${o.bad.length} poses hide a floor, e.g. ${JSON.stringify(o.bad.slice(0, 3))}`);
  }

  // ------------------------------------------------------------ L4
  if (on('L4')) {
    r.section('L4 every door: through and back, by tap and by keys');
    const out = await page.evaluate(async (CLR) => {
      const d = window.dev, P = d.player, res = [], dt = 1 / 30;
      const near = (dd) => { let m = 9; for (const b of dd.boxes) { const dx = P.pos.x - Math.max(b[0], Math.min(P.pos.x, b[2])), dz = P.pos.z - Math.max(b[1], Math.min(P.pos.z, b[3])); m = Math.min(m, Math.hypot(dx, dz)); } return m; };
      const side = (dd) => Math.sign((P.pos.x - dd.x) * dd.n.x + (P.pos.z - dd.z) * dd.n.z);
      for (const [i, dd] of d.doors.all.entries()) for (const how of ['tap', 'keys']) for (const s of [-1, 1]) {
        window.__park(); d.doors.setAngle(dd, 0); dd.to = 0; dd.busy = false;
        const A = [dd.x - dd.n.x * s * 1.3, dd.z - dd.n.z * s * 1.3], B = [dd.x + dd.n.x * s * 1.3, dd.z + dd.n.z * s * 1.3];
        P.pos.set(A[0], 0, A[1]); d.man.root.position.set(A[0], 0, A[1]); P.st.heading = Math.atan2(dd.n.x * s, dd.n.z * s);
        let minClr = 9, ghost = 0, t = 0, side0 = side(dd), crossed = false;
        if (how === 'tap') P.goTo(B[0], B[1]);
        else { P.st.yaw = Math.atan2(-dd.n.x * s, -dd.n.z * s); P.keys.add('KeyW'); }
        for (; t < 25 && !crossed; t += dt) {
          if (how === 'keys') P.st.yaw = Math.atan2(-dd.n.x * s, -dd.n.z * s);
          P.update(dt, t); d.doors.update(dt);
          const c = near(dd); if (c < minClr) minClr = c;
          if (side(dd) !== side0) { if (Math.abs(dd.angle) < 0.35) ghost++; if (Math.hypot(P.pos.x - dd.x, P.pos.z - dd.z) > 0.9) crossed = true; }
        }
        P.keys.clear();
        res.push({ door: i, how, dir: s, crossed, secs: +t.toFixed(1), minClr: +minClr.toFixed(3), ghost });
      }
      window.__park();
      return res;
    }, T.doorClear);
    for (const o of out) {
      const k = `door ${o.door} ${o.how} ${o.dir > 0 ? '->' : '<-'}`;
      r.expect(o.crossed, 'L4', `${k}: through in ${o.secs}s`, 'never got through');
      r.expect(o.ghost === 0, 'L4', `${k}: never passed the shut leaf`, `${o.ghost} frames past the leaf while shut`);
      r.expect(o.minClr >= T.doorClear, 'L4', `${k}: kept ${(o.minClr * 100).toFixed(0)} cm off the leaf`, `came within ${(o.minClr * 100).toFixed(0)} cm (inside it)`);
    }
  }

  // ------------------------------------------------------------ L5
  if (on('L5')) {
    r.section('L5 limbs stay joined in every pose');
    const out = await page.evaluate(async (JOINTS) => {
      const d = window.dev, P = d.player, res = {};
      const gap = (A, B) => {                                 // nearest vertex pair, A vs B (B's vertices near A's box only)
        let m = 9; const bb = A.box.clone().expandByScalar(0.05);
        for (let j = 0; j < B.V.length; j += 3) { const x = B.V[j], y = B.V[j + 1], z = B.V[j + 2]; if (x < bb.min.x || y < bb.min.y || z < bb.min.z || x > bb.max.x || y > bb.max.y || z > bb.max.z) continue;
          for (let i = 0; i < A.V.length; i += 3) { const q = (A.V[i] - x) ** 2 + (A.V[i + 1] - y) ** 2 + (A.V[i + 2] - z) ** 2; if (q < m) m = q; } }
        return Math.sqrt(m);
      };
      const test = (pose) => { d.man.root.updateMatrixWorld(true); const parts = d.phys.bake();
        for (const [a, b] of JOINTS) { if (!parts[a] || !parts[b]) { res.missing = [a, b]; continue; } const g = gap(parts[a], parts[b]), k = `${a}-${b}`; if (!res[k] || res[k].g < g) res[k] = { g, pose }; } };
      window.__park(); for (let i = 0; i < 10; i++) P.update(1 / 30, i / 30); test('idle');
      for (const s of d.stations) { const sp = s.seat; if (!sp?.act) continue;
        if (P.st.seated) P.stand(); if (sp === d.reading.READ) d.reading.READ.book ||= { title: 'test' }; P.sit(sp);
        for (let t = 0; t < 3; t += 1 / 30) { P.update(1 / 30, t); d.reading.update(); d.telly.update(false); if (Math.round(t * 30) % 30 === 0) test(sp.act); } }
      window.__park();
      return res;
    }, JOINTS);
    if (out.missing) r.fail('L5', `no part ${out.missing.join(' / ')}: JOINTS names are stale`);
    for (const [k, o] of Object.entries(out)) if (k !== 'missing')
      r.expect(o.g <= T.jointGap, 'L5', `${k}: joined in every pose (worst ${(o.g * 1000).toFixed(1)} mm, ${o.pose})`, `${(o.g * 1000).toFixed(0)} mm gap in ${o.pose}`);
  }

  r.expect(errors.length === 0, 'run', 'no console / page / network errors during the layout run', [...new Set(errors)].slice(0, 6).join(' | '));
  await page.close(); await ctx.close();
  return r.finish();
});
