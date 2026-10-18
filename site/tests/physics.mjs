// Collision + physics suite: the man against the world.
//   P1 body vs props   - every act and gait: no body part inside any mesh (physics.js bakes his skin and tests every vertex)
//   P2 reachability    - every station / hall entrance is reachable by tap-to-walk, and he never clips a solid on the way
//   P3 wall fuzz       - 300 random starts x random headings x walk / run x frame-time spikes: never inside a solid, never outside the map
//   P4 sit / stand     - every seat: sit, run its act, stand: legal position, upright, free, camera sane
//   P5 camera arm      - orbit all round him at every spot: camera finite, not inside a solid, not on top of him
//   P6 his day         - his routine at every half hour: legal pose, not inside a wall, no body clipping
//   P7 snake           - roams inside the map, never inside a solid
//   P8 short beats     - every beat at every station that plays it: no body part inside a prop
//   npm run test:physics [-- --only=P3,P4] [-- --seed=7]
import { start, openPage, reporter, run, want, arg } from './lib/harness.mjs';

const T = {  // thresholds
  clipFail: 15, clipWarn: 5,        // mm a body part may be inside a prop
  clear: 0.26 - 0.02,               // metres: centre-to-solid clearance (body radius 0.26, 2 cm slack)
};

run(async () => {
  const ctx = await start(), r = reporter('physics'), only = want('only');
  const on = k => !only.length || only.includes(k);
  const { page, errors } = await openPage(ctx);
  await page.evaluate(seed => {
    window.__rng = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(seed);
    const d = window.dev, S = d.solids;
    const B = { x0: Math.min(...S.map(b => b[0])), z0: Math.min(...S.map(b => b[1])), x1: Math.max(...S.map(b => b[2])), z1: Math.max(...S.map(b => b[3])) };
    // distance from a point to the nearest solid (0 inside); and which one
    window.__clear = (x, z) => { let best = 1e9, who = null; for (const b of S) { const dx = x - Math.max(b[0], Math.min(x, b[2])), dz = z - Math.max(b[1], Math.min(z, b[3])), q = Math.hypot(dx, dz); if (q < best) { best = q; who = b; } } return { d: best, who }; };
    // the connected floor he can actually stand on: flood fill from the spawn over cells >= body radius from every solid
    // (shut doors count as open: he pushes them). If the fill reaches the edge of the world the map has a hole in it.
    const dbox = new Set(d.doors.all.flatMap(x => x.boxes)), SS = S.filter(b => !dbox.has(b)), C = 0.075, X0 = B.x0 - 4, Z0 = B.z0 - 4, NX = Math.ceil((B.x1 - B.x0 + 8) / C), NZ = Math.ceil((B.z1 - B.z0 + 8) / C);
    const blocked = new Uint8Array(NX * NZ);                 // each solid stamps the cells within 0.25 of it (fast at fine C)
    for (const b of SS) for (let j = Math.max(0, Math.floor((b[1] - 0.25 - Z0) / C)); j <= Math.min(NZ - 1, Math.ceil((b[3] + 0.25 - Z0) / C)); j++) for (let i = Math.max(0, Math.floor((b[0] - 0.25 - X0) / C)); i <= Math.min(NX - 1, Math.ceil((b[2] + 0.25 - X0) / C)); i++) {
      const x = X0 + (i + .5) * C, z = Z0 + (j + .5) * C, dx = x - Math.max(b[0], Math.min(x, b[2])), dz = z - Math.max(b[1], Math.min(z, b[3])); if (dx * dx + dz * dz < 0.25 * 0.25) blocked[j * NX + i] = 1; }
    const free = (x, z) => !blocked[Math.floor((z - Z0) / C) * NX + Math.floor((x - X0) / C)];
    const seen = new Uint8Array(NX * NZ), q = [Math.floor((0.3 - X0) / C) + NX * Math.floor((1.2 - Z0) / C)], list = []; seen[q[0]] = 1; let leak = 0;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], i = k % NX, j = (k - i) / NX; list.push(k);
      if (i < 3 || j < 3 || i > NX - 4 || j > NZ - 4) leak++;   // fine cells: diagonal gaps just over a body wide still connect
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) { leak++; continue; } const n = nj * NX + ni; if (seen[n]) continue; if (!free(X0 + (ni + .5) * C, Z0 + (nj + .5) * C)) continue; seen[n] = 1; q.push(n); }
    }
    window.__reach = { seen, list, NX, NZ, X0, Z0, C, leak };
    window.__inMap = (x, z) => { const R = window.__reach, i = Math.floor((x - R.X0) / R.C), j = Math.floor((z - R.Z0) / R.C); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (i + a >= 0 && j + b >= 0 && i + a < R.NX && j + b < R.NZ && R.seen[(j + b) * R.NX + i + a]) return true; return false; };
    window.__randomSpot = () => { const R = window.__reach, k = R.list[Math.floor(window.__rng() * R.list.length)], i = k % R.NX; return [R.X0 + (i + .5) * R.C, R.Z0 + ((k - i) / R.NX + .5) * R.C]; };
    window.__bounds = B;
    window.__park = () => { if (d.player.st.seated) d.player.stand(); d.player.st.frozen = false; d.player.cancelAuto(); d.player.keys.clear(); d.player.st.speed = 0; };
  }, +arg('seed', 11));

  // ------------------------------------------------------------ P1
  if (on('P1')) {
    r.section('P1 body vs props (every act, idle / walk / run)');
    const rep = await page.evaluate(() => window.dev.verifyActs());
    for (const [act, rows] of Object.entries(rep)) {
      const worst = rows[0];
      if (!worst) { r.ok('P1', `${act}: clean`); continue; }
      const line = `${act}: ${worst.part} inside ${worst.what} by ${worst.depth} mm (t=${worst.t ?? '-'})`;
      if (worst.depth > T.clipFail) r.fail('P1', line); else if (worst.depth > T.clipWarn) r.warn('P1', line); else r.ok('P1', line);
    }
  }

  // ------------------------------------------------------------ P8
  if (on('P8')) {
    r.section('P8 short beats (beats.js) at every station that plays them: start, peak, end');
    const rep = await page.evaluate(() => window.dev.verifyBeats());
    for (const [key, rows] of Object.entries(rep)) {
      const worst = rows[0];
      if (!worst) { r.ok('P8', `${key}: clean`); continue; }
      const line = `${key}: ${worst.part} inside ${worst.what} by ${worst.depth} mm (t=${worst.t})`;
      if (worst.depth > T.clipFail) r.fail('P8', line); else if (worst.depth > T.clipWarn) r.warn('P8', line); else r.ok('P8', line);
    }
  }

  // ------------------------------------------------------------ P2
  if (on('P2')) {
    r.section('P2 every station and hall is reachable on foot');
    const out = await page.evaluate(async () => {
      const d = window.dev, P = d.player, res = [];
      const targets = d.stations.filter(s => !s.frame && !s.direct && !s.live).map(s => ({ label: s.label, x: s.p[0], z: s.p[1], r: s.r }));
      for (const z of d.gallery.zones.filter(z => z.entry)) targets.push({ label: 'hall ' + (z.title || z.name), x: z.entry.x, z: z.entry.z, r: 0.6 });
      for (const t of targets) {
        window.__park(); P.pos.set(0.3, 0, 1.2); d.man.root.position.set(0.3, 0, 1.2);
        const path = d.nav.path(P.pos.x, P.pos.z, t.x, t.z);
        if (!path) { res.push({ label: t.label, err: 'no path' }); continue; }
        let reached = false, minClear = 9, t0 = 0, dt = 1 / 30;
        P.goTo(t.x, t.z, { done: () => { reached = true; } });
        for (; t0 < 90 && !reached; t0 += dt) { P.update(dt, t0); d.doors.update(dt); const c = window.__clear(P.pos.x, P.pos.z).d; if (c < minClear) minClear = c; }
        res.push({ label: t.label, reached, secs: +t0.toFixed(1), minClear: +minClear.toFixed(3), dist: Math.hypot(P.pos.x - t.x, P.pos.z - t.z) });
        P.cancelAuto();
      }
      return res;
    });
    for (const o of out) {
      if (o.err) { r.fail('P2', `${o.label}: ${o.err}`); continue; }
      r.expect(o.reached, 'P2', `${o.label}: walked there in ${o.secs}s`, `stuck ${o.dist.toFixed(2)} m short`);
      r.expect(o.minClear >= T.clear, 'P2', `${o.label}: kept ${(o.minClear * 100).toFixed(0)} cm off solids`, `clipped to ${(o.minClear * 100).toFixed(0)} cm`);
    }
  }

  // ------------------------------------------------------------ P3
  if (on('P3')) {
    r.section('P3 wall fuzz (walk + run, frame spikes)');
    const rc = await page.evaluate(() => ({ cells: window.__reach.list.length, leak: window.__reach.leak }));
    r.expect(rc.leak === 0, 'P3', `map is watertight (${rc.cells} floor cells reachable from the spawn)`, `the floor plan leaks to the edge of the world at ${rc.leak} cells: there is a gap in the walls`);
    const o = await page.evaluate(() => {
      const d = window.dev, P = d.player, B = window.__bounds, rnd = window.__rng, bad = [];
      let n = 0, bumps = 0, minClear = 9, soft = 0;
      const keysFor = a => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].filter((_, i) => i === a % 4 || (a >= 4 && i === (a + 1) % 4));
      for (let k = 0; k < 300; k++) {
        window.__park();
        const sp = window.__randomSpot(); if (!sp) continue; const [x, z] = sp;
        P.pos.set(x, 0, z); d.man.root.position.set(x, 0, z);
        P.st.yaw = rnd() * Math.PI * 2; const a = Math.floor(rnd() * 8), run = rnd() < 0.5, spike = rnd() < 0.4;
        for (const kk of keysFor(a)) P.keys.add(kk); if (run) P.keys.add('ShiftLeft');
        const b0 = P.st.bumps;
        for (let f = 0; f < 240; f++) {
          const dt = spike && f % 17 === 0 ? 0.05 : 1 / 60;                    // the loop clamps dt at 0.05
          P.update(dt, f * dt); d.doors.update(dt); n++;
          const c = window.__clear(P.pos.x, P.pos.z);
          if (c.d < minClear) minClear = c.d;
          if (c.d < 0.23) soft++;
          if (c.d < 0.05 || !isFinite(P.pos.x) || !window.__inMap(P.pos.x, P.pos.z)) {
            bad.push({ start: [+x.toFixed(2), +z.toFixed(2)], key: a, run, spike, frame: f, at: [+P.pos.x.toFixed(2), +P.pos.z.toFixed(2)], clear: +c.d.toFixed(3) }); break;
          }
        }
        bumps += P.st.bumps - b0; P.keys.clear();
      }
      window.__park();
      return { n, bad, bumps, minClear, soft };
    });
    r.expect(o.bad.length === 0, 'P3', `${o.n} frames, ${o.bumps} wall bumps, closest approach ${(o.minClear * 100).toFixed(1)} cm`, `${o.bad.length} escapes, first: ${JSON.stringify(o.bad[0])}`);
    if (o.soft) r.warn('P3', `${o.soft} frames pressed up to 21 cm into the body radius at a corner (closest ${(o.minClear * 100).toFixed(1)} cm of 26)`);
    for (const b of o.bad.slice(0, 5)) r.fail('P3', 'escape ' + JSON.stringify(b));
  }

  // ------------------------------------------------------------ P4
  if (on('P4')) {
    r.section('P4 sit / stand at every seat');
    const out = await page.evaluate(() => {
      const d = window.dev, P = d.player, res = [];
      for (const s of d.stations.filter(s => s.seat)) {
        window.__park(); P.pos.set(s.p[0], 0, s.p[1]); d.man.root.position.set(s.p[0], 0, s.p[1]);
        const row = { label: s.label, issues: [] };
        try {
          if (s.seat === d.reading.READ) d.reading.READ.book ||= { title: 'test' };
          P.sit(s.seat);
          for (let f = 0; f < 90; f++) { P.update(1 / 30, f / 30); d.reading.update?.(); }
          if (!isFinite(d.man.root.position.y) || Math.abs(d.man.root.position.x - s.seat.x) > 0.6) row.issues.push('seated away from the seat');
          if (!isFinite(d.camera.position.x)) row.issues.push('camera NaN while seated');
          P.stand();
          for (let f = 0; f < 15; f++) P.update(1 / 30, f / 30);
          const c = window.__clear(P.pos.x, P.pos.z);
          if (P.st.seated) row.issues.push('still seated after stand()');
          if (c.d < 0.26 - 0.03) row.issues.push(`stands inside a solid (${(c.d * 100).toFixed(0)} cm clearance)`);
          if (Math.abs(d.man.root.rotation.x) > 0.01) row.issues.push('not upright after standing (lying pose stuck)');
          if (Math.abs(d.man.root.position.y) > 0.08) row.issues.push(`floating / sunk after standing (y=${d.man.root.position.y.toFixed(2)})`);
          if (!P.st.frozen === false) row.issues.push('controls frozen after standing');
        } catch (e) { row.issues.push('threw: ' + e.message); }
        res.push(row);
      }
      window.__park(); return res;
    });
    for (const o of out) r.expect(!o.issues.length, 'P4', `${o.label}: sit, act, stand`, o.issues.join('; '));
  }

  // ------------------------------------------------------------ P5
  if (on('P5')) {
    r.section('P5 camera arm: orbit all round him at every spot');
    const o = await page.evaluate(() => {
      const d = window.dev, P = d.player, cam = d.camera, TH = d.THREE, bad = [], tight = [], spots = [];
      for (const s of d.stations) if (!s.live) spots.push([s.p[0], s.p[1]]);
      for (const z of d.gallery.zones) if (z.entry) spots.push([z.entry.x, z.entry.z]);
      spots.push([0.3, 1.2], [-3.5, -2.5], [3.5, 2.5], [-3.5, 2.5], [3.5, -2.5]);
      const meshes = []; d.scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && (o.layers.mask & 1) && o.material && !o.material.transparent && o.material.side !== TH.BackSide) meshes.push(o); });
      const rc = new TH.Raycaster(), AX = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(a => new TH.Vector3(...a));
      const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
      let n = 0;
      for (const [x, z] of spots) for (let a = 0; a < 12; a++) for (const pitch of [0.05, 0.38, 0.9]) {
        window.__park(); while (P.st.view !== 'third') P.cycleView();
        P.pos.set(x, 0, z); d.man.root.position.set(x, 0, z); P.st.yaw = (a / 12) * Math.PI * 2; P.st.pitch = pitch; P.st.dist = 3.8;
        for (let f = 0; f < 40; f++) P.update(1 / 30, f / 30); n++;
        d.scene.updateMatrixWorld(true);
        const p = cam.position, dist = Math.hypot(p.x - x, p.z - z);
        const at = { spot: [+x.toFixed(1), +z.toFixed(1)], yaw: a * 30, pitch };
        if (!isFinite(p.x + p.y + p.z)) { bad.push({ ...at, why: 'camera position is NaN' }); continue; }
        if (p.y < 0.15) { bad.push({ ...at, why: `camera under the floor (y=${p.y.toFixed(2)})` }); continue; }
        if (dist < 0.3 && p.y < 1.9) { bad.push({ ...at, why: `camera on top of him (${dist.toFixed(2)} m)` }); continue; }
        // the near plane is 0.05: any surface closer than that to the lens fills the picture
        let m = 9, what = '';
        for (const ax of AX) { rc.set(p, ax); rc.far = 0.3; for (const h of rc.intersectObjects(meshes, false)) if (shown(h.object) && h.distance < m) { m = h.distance; what = h.object.name || h.object.parent?.name || h.object.geometry.type; } }
        if (m < 0.07) bad.push({ ...at, why: `lens ${(m * 100).toFixed(0)} cm from "${what}" (near-clipped)` });
        else if (m < 0.14) tight.push({ ...at, m, what });
      }
      window.__park(); P.st.pitch = 0.38; P.st.yaw = 0.25; return { n, bad, tight: tight.length };
    });
    if (o.tight) r.warn('P5', `${o.tight} poses have a surface within 14 cm of the lens`);
    r.expect(o.bad.length === 0, 'P5', `${o.n} camera poses sane (finite, above floor, off him, lens clear of geometry)`, `${o.bad.length} bad, first: ${JSON.stringify(o.bad[0])}`);
    for (const b of o.bad.slice(0, 6)) r.fail('P5', JSON.stringify(b));
  }

  // ------------------------------------------------------------ P6
  if (on('P6')) {
    r.section('P6 his day: routine at every half hour');
    const out = await page.evaluate(() => {
      const d = window.dev, P = d.player, res = [], realNow = Date.now.bind(Date), base = Date.UTC(2026, 9, 14, 0, 0) - 5.5 * 3600e3;
      try {
        for (let h = 0; h < 48; h++) {
          Date.now = () => base + h * 1800e3 + 60e3;
          window.__park(); const what = d.routine.planned(), said = d.routine.arrive();
          for (let f = 0; f < 60; f++) P.update(1 / 30, f / 30);
          const hits = d.phys.check().filter(x => x.depth > 15), c = window.__clear(P.pos.x, P.pos.z);
          res.push({ at: `${String(Math.floor(h / 2)).padStart(2, '0')}:${h % 2 ? '30' : '00'}`, what, said, clip: hits.slice(0, 2).map(x => `${x.part} in ${x.what} ${x.depth}mm`), inSolid: c.d < 0.2 && !P.st.seated, seated: !!P.st.seated });
        }
      } finally { Date.now = realNow; }
      window.__park(); return res;
    });
    for (const o of out) {
      const bad = [...(o.clip.length ? ['clipping: ' + o.clip.join(', ')] : []), ...(o.inSolid ? ['standing inside a solid'] : []), ...(!o.said ? ['no arrival message'] : [])];
      r.expect(!bad.length, 'P6', `${o.at} ${o.what}`, bad.join('; '));
    }
  }

  // ------------------------------------------------------------ P7
  if (on('P7')) {
    r.section('P7 snake stays in bounds, out of the furniture');
    const o = await page.evaluate(async () => {
      const d = window.dev, B = window.__bounds, s = d.stations.find(s => s.live), bad = []; let n = 0;
      const bed = d.snake.bed.position, inBed = q => Math.hypot(q.x - bed.x, q.z - bed.z) < 0.4;   // its own cushion is allowed
      const t0 = performance.now(); for (let f = 0; f < 600 && performance.now() - t0 < 40000; f++) { await new Promise(r => requestAnimationFrame(r));   // capped: software GL on a busy box
        if (f % 5) continue; const q = s.live(); n++;
        if (!isFinite(q.x + q.z) || !window.__inMap(q.x, q.z)) bad.push(['out of map', q.x, q.z]);
        else if (window.__clear(q.x, q.z).d === 0 && !inBed(q)) bad.push(['inside a solid', +q.x.toFixed(2), +q.z.toFixed(2)]); }
      // a nap: forced, stepped headless so it settles; the whole coil must sit inside the cushion
      d.snake.nap(true); for (let i = 0; i < 300; i++) d.snake.update(1 / 30, i / 30, null);
      const h = d.snake.head.position, asleep = d.snake.asleep, inside = inBed(h);
      d.snake.nap(false); for (let i = 0; i < 200; i++) d.snake.update(1 / 30, i / 30, null);
      return { n, bad, asleep, inside, head: [+h.x.toFixed(2), +h.z.toFixed(2)], woke: !d.snake.asleep };
    });
    r.expect(o.bad.length === 0, 'P7', `${o.n} snake samples legal`, JSON.stringify(o.bad.slice(0, 3)));
    r.expect(o.asleep && o.inside, 'P7', 'nap: curls up on its cushion', JSON.stringify(o));
    r.expect(o.woke, 'P7', 'nap: wakes and leaves the cushion', JSON.stringify(o));
  }

  r.expect(errors.length === 0, 'run', 'no console / page / network errors during the physics run', [...new Set(errors)].slice(0, 6).join(' | '));
  await page.close(); await ctx.close();
  return r.finish();
});
