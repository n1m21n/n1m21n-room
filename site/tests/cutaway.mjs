// Sims-style cutaway audit (player.js face()): every wall is sorted into a category, then each cut-away room is
// checked from every side.
//   C0 categories  every wall in or around a cut-away room is on one of its sides, a door or a half wall (table printed)
//   C1 hung things what leaves with a wall is hung ON it (the whole object off the floor); nothing hung is left floating
//   C2 facing      his room's walls that face the camera are cut, the rest stand (8 headings x 3 spots a room, + top view)
//   C3 sight line  no standing wall between the lens and him; the lens never inside a standing wall
//   C4 doors, floors and half walls are never cut
//   C5 steady      swinging the heading back and forth inside the hysteresis band never flips a wall
//   stills         4 diagonal views + top-down a room -> build-cache/review/cutaway/<tag>/ (+ index.html)
//   npm run test:cutaway [-- --only=bath,kitchen] [-- --stills=only --tag=before --url=https://…]  (stills of any build)
import { start, openPage, reporter, run, want, arg, sleep, OUT } from './lib/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';

const PI = Math.PI, VW = 960, VH = 600;
// spots per room (x, z): one central, two near opposite corners. Where he ends up (collisions) is read back
const ROOMS = {
  room: [[-1.0, 1.0], [2.8, 1.8], [-2.6, -1.4]],
  foyer: [[5.0, 1.6], [8.3, 1.6], [6.6, 1.2]],
  bath: [[5.8, -1.0], [6.4, -0.3], [4.9, -1.9]],
  kitchen: [[6.3, 4.8], [7.6, 3.6], [5.2, 6.0]],
};
const STILLS = arg('stills'), TAG = arg('tag', 'after'), SHOTS = path.resolve(OUT, '../cutaway', TAG);

run(async () => {
  const r = reporter('cutaway'), only = want('only');
  const ctx = await start(), { page, errors } = await openPage(ctx, { w: VW, h: VH, dpr: 1, touch: false });
  const pose = (x, z, yaw, view = 'third') => page.evaluate(([x, z, yaw, view]) => {
    const d = window.dev, P = d.player; d.director.off = true; if (P.st.seated) P.stand(); P.st.frozen = false; P.cancelAuto(); P.keys.clear(); P.st.speed = 0;
    while (P.st.view !== view) P.cycleView();
    P.st.frozen = true;   // (the idle routine would walk him off)
    P.pos.set(x, 0, z); d.man.root.position.set(x, 0, z); P.st.yaw = yaw; P.st.heading = yaw; P.st.pitch = 0.38; P.st.dist = 3.8; P.st.intro = 1;
  }, [x, z, yaw, view]);

  // settled: the orbit has caught up with the heading and no cut is mid-fade (headless frames are slow and the game's
  // dt is capped, so wall-clock waits undershoot)
  const settle = async (min = 400) => {
    await sleep(min);
    await page.waitForFunction(() => {
      const P = window.dev.player, o = P.dbg.orb, w = Math.atan2(Math.sin(P.st.yaw - o.yaw), Math.cos(P.st.yaw - o.yaw));
      if (Math.abs(w) > 0.005) return (window.__still = 0), false;
      for (const c of P.dbg.cuts.values()) if (c.k > 0 && c.k < 1) return (window.__still = 0), false;
      return ++window.__still > 6;
    }, { timeout: 20000, polling: 'raf' }).catch(() => {});
  };
  if (STILLS !== 'only') {
    // ---------------------------------------------------------------- C0 / C1: categories and hung things
    const cat = await page.evaluate(() => {
      const d = window.dev, T = d.THREE, P = d.player, rooms = d.rooms || [];
      P.update(0.016, 0);                                       // first frame: the sides get worked out
      const sides = P.dbg.sides(), walls = []; d.scene.traverse(o => { if (o.userData.wall) walls.push(o); });
      const name = w => { const b = new T.Box3().setFromObject(w); return `${w.parent?.name || ''} [${b.min.x.toFixed(2)},${b.min.z.toFixed(2)}..${b.max.x.toFixed(2)},${b.max.z.toFixed(2)}] h${b.min.y.toFixed(1)}-${b.max.y.toFixed(1)}`; };
      const SIDE = n => n[0] > 0 ? 'W' : n[0] < 0 ? 'E' : n[1] > 0 ? 'N' : 'S';
      const rows = [], orphans = [], hung = [], floorHung = [], floating = [];
      const roomSide = new Set();
      for (const w of walls) {
        const s = sides?.get(w), u = w.userData;
        const kind = u.door ? 'door' : u.low ? 'half wall (never cut)' : u.hall ? 'gallery hall (spring arm, never cut)' : s ? 'room side: ' + s.map(x => x.room.name + '/' + SIDE(x.n)).join(' + ') : u.arm ? 'gallery passage (spring arm)' : u.armOut ? 'annex outside (arm)' : 'other (ray cut)';
        rows.push([kind, name(w)]);
        if (s) roomSide.add(w);
        const b = new T.Box3().setFromObject(w);
        if (!s && !u.door && !u.low && !u.hall) for (const rm of rooms) {
          const [x0, z0, x1, z1] = rm.box;
          if (b.max.x > x0 - 0.15 && b.min.x < x1 + 0.15 && b.max.z > z0 - 0.15 && b.min.z < z1 + 0.15) orphans.push(`${name(w)} touches ${rm.name}`);
        }
      }
      // hung things per wall; a unit stands on the floor if its whole object reaches the floor
      const units = new Map(), uName = o => { let p = o; while (p && !p.name && p.parent && p.parent !== d.scene) p = p.parent; return p?.name || o.geometry?.type || 'mesh'; };
      for (const w of roomSide) for (const o of P.dbg.attached(w)) {
        const u = o.userData.skin ? o : P.dbg.unitOf(o), b = new T.Box3().setFromObject(u);
        const key = u.uuid; if (units.has(key)) continue; units.set(key, 1);
        const label = `${uName(u)} (${b.min.y.toFixed(2)}-${b.max.y.toFixed(2)} m) on ${name(w)}`;
        if (b.min.y <= 0.05 && !o.userData.skin) floorHung.push(label); else hung.push(label);
      }
      // floating: an off-floor object pressed to a room-side wall that the wall would leave behind (too big a unit,
      // or its centre outside the wall's slab)
      const wb = [...roomSide].map(w => [w, new T.Box3().setFromObject(w)]);
      const tops = []; d.scene.traverse(o => { if (o.isMesh && !o.userData.wall && o.material?.side !== T.BackSide) tops.push([o, new T.Box3().setFromObject(o)]); });
      const all = new Set(); for (const w of roomSide) for (const o of P.dbg.attached(w)) all.add(o);
      d.scene.traverse(o => {
        if (!o.isMesh || o.userData.wall || o.userData.door || o.userData.stays || o.parent?.userData.stays || o.userData.floor || o.isSkinnedMesh || all.has(o) || all.has(o.parent) || o.parent?.userData.wall) return;   // (an ink hull goes with its mesh)
        for (let p = o; p; p = p.parent) if (p === d.man.root) return;
        const u = P.dbg.unitOf(o), b = new T.Box3().setFromObject(u); if (b.min.y <= 0.05 || b.isEmpty()) return;
        const ob = new T.Box3().setFromObject(o);
        if (tops.some(([m, t]) => m !== o && m !== o.parent && Math.abs(t.max.y - ob.min.y) < 0.05 && t.max.x > ob.min.x && t.min.x < ob.max.x && t.max.z > ob.min.z && t.min.z < ob.max.z)) return;   // it sits on something (a worktop on its cabinets)
        for (const [w, x] of wb) if (x.clone().expandByScalar(0.03).intersectsBox(ob) && Math.min(x.max.y, ob.max.y) - Math.max(x.min.y, ob.min.y) > 0.02) {
          floating.push(`${uName(o)} ${o.geometry?.type} [${ob.min.x.toFixed(2)},${ob.min.z.toFixed(2)}..${ob.max.x.toFixed(2)},${ob.max.z.toFixed(2)}] h${ob.min.y.toFixed(2)}-${ob.max.y.toFixed(2)}${o.userData.skin ? ' skin' : ''} against ${name(w)}`); break;
        }
      });
      return { rows, orphans, hung, floorHung, floating: [...new Set(floating)] };
    });
    r.section('categories');
    const counts = {}; for (const [k] of cat.rows) { const c = k.replace(/: .*/, ''); counts[c] = (counts[c] || 0) + 1; }
    for (const [k, n] of Object.entries(counts)) r.ok('C0', `${n} × ${k}`);
    if (arg('verbose')) for (const [k, n] of cat.rows) console.log(`      ${k.padEnd(40)} ${n}`);
    r.expect(!cat.orphans.length, 'C0', 'every wall touching a cut-away room is one of its sides, a door or a half wall', cat.orphans.slice(0, 6).join('\n      '));
    r.section('hung things');
    r.ok('C1', `${cat.hung.length} things leave with their wall`);
    if (arg('verbose')) for (const h of cat.hung) console.log('      ' + h);
    r.expect(!cat.floorHung.length, 'C1', 'nothing standing on the floor leaves with a wall', cat.floorHung.slice(0, 6).join('\n      '));
    r.expect(!cat.floating.length, 'C1', 'nothing hung on a wall stays floating when it goes', cat.floating.slice(0, 8).join('\n      '));
    fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'cutaway-categories.json'), JSON.stringify(cat, null, 1));

    // ---------------------------------------------------------------- C2 / C3 / C4: each room from every side
    const look = () => page.evaluate(() => {
      const d = window.dev, T = d.THREE, P = d.player, cam = d.camera.position;
      const walls = []; d.scene.traverse(o => { if (o.userData.wall) walls.push(o); });
      const pres = w => (w.visible ? 1 - (w.material.uniforms?.uCut?.value || 0) : 0);
      const here = P.dbg.room(), sides = P.dbg.sides(), vx = P.st.view === 'top' ? -Math.sin(P.st.yaw) : P.pos.x - cam.x, vz = P.st.view === 'top' ? -Math.cos(P.st.yaw) : P.pos.z - cam.z, L = Math.hypot(vx, vz) || 1;
      const name = w => { const b = new T.Box3().setFromObject(w); return `[${b.min.x.toFixed(2)},${b.min.z.toFixed(2)}..${b.max.x.toFixed(2)},${b.max.z.toFixed(2)}]`; };
      const out = { here: here?.name || null, pos: [P.pos.x, P.pos.z], cam: [cam.x, cam.y, cam.z], wrongCut: [], wrongUp: [], block: [], inside: [], hungLeft: [], doors: [], half: [] };
      for (const w of walls) {
        const p = pres(w), s = sides?.get(w)?.filter(x => x.room === here) || [];
        if (w.userData.door && p < 1) out.doors.push(name(w));
        if (w.userData.low && p < 1 && !new T.Box3().setFromObject(w).expandByScalar(0.03).containsPoint(cam)) out.half.push(name(w));
        if (!s.length) continue;
        const f = Math.max(...s.map(x => (x.n[0] * vx + x.n[1] * vz) / L));
        const why = P.dbg.cuts.get(w)?.why;
        if (f > 0.4 && p > 0.05) out.wrongCut.push(`${name(w)} faces ${f.toFixed(2)} but ${p.toFixed(2)} there`);
        if (f < 0.1 && p < 0.95 && why !== 'box') out.wrongUp.push(`${name(w)} faces ${f.toFixed(2)} but cut (${why})`);
        if (p < 0.05) for (const o of P.dbg.attached(w)) if (o.visible && (o.userData.fadeK ?? 0) < 0.95) out.hungLeft.push(`${o.name || o.parent?.name || 'mesh'} on ${name(w)}`);
      }
      const ray = new T.Raycaster(), v = new T.Vector3();
      for (const y of [1.0, 1.5]) {
        v.set(P.pos.x, y, P.pos.z).sub(cam); const D = v.length(); ray.set(cam, v.normalize()); ray.far = D - 0.3;
        for (const h of ray.intersectObjects(walls, false)) if (pres(h.object) > 0.5 && !h.object.userData.low) out.block.push(`${name(h.object)} at ${h.distance.toFixed(2)} of ${D.toFixed(2)} m`);
      }
      for (const w of walls) if (pres(w) > 0.5 && new T.Box3().setFromObject(w).containsPoint(cam)) out.inside.push(name(w));
      out.block = [...new Set(out.block)];
      return out;
    });
    const tally = { poses: 0, wrongCut: 0, wrongUp: 0, block: 0, inside: 0, hungLeft: 0, doors: 0, half: 0, room: 0 };
    for (const [room, spots] of Object.entries(ROOMS)) {
      if (only.length && !only.includes(room)) continue;
      r.section(room);
      const bad = { wrongCut: [], wrongUp: [], block: [], inside: [], hungLeft: [], doors: [], half: [], room: [] };
      const views = [];
      spots.forEach(([x, z], i) => { for (let k = 0; k < 8; k++) views.push([x, z, k * PI / 4 + 0.2, 'third']); if (!i) for (let k = 0; k < 4; k++) views.push([x, z, k * PI / 2 + PI / 4, 'top']); });
      for (const [x, z, yaw, view] of views) {
        await pose(x, z, yaw, view); await settle();
        const o = await look(); tally.poses++;
        const at = `him ${o.pos.map(v => v.toFixed(1))} yaw ${yaw.toFixed(2)} ${view}`;
        if (o.here !== room) bad.room.push(`${at}: in ${o.here}`);
        for (const k of ['wrongCut', 'wrongUp', 'block', 'inside', 'hungLeft', 'doors', 'half']) for (const m of o[k]) bad[k].push(`${at}: ${m}`);
      }
      for (const k in bad) tally[k] += bad[k].length;
      r.ok('C2', `${views.length} views`);
      r.expect(!bad.room.length, 'C2', `${room}: he counts as in the ${room}`, bad.room.slice(0, 3).join('\n      '));
      r.expect(!bad.wrongCut.length, 'C2', `${room}: every wall facing the camera is cut away`, bad.wrongCut.slice(0, 4).join('\n      '));
      r.expect(!bad.wrongUp.length, 'C2', `${room}: walls behind him / side-on stand`, bad.wrongUp.slice(0, 4).join('\n      '));
      r.expect(!bad.hungLeft.length, 'C1', `${room}: hung things leave with their wall`, bad.hungLeft.slice(0, 4).join('\n      '));
      r.expect(!bad.block.length, 'C3', `${room}: no standing wall between the lens and him`, bad.block.slice(0, 4).join('\n      '));
      r.expect(!bad.inside.length, 'C3', `${room}: the lens is never inside a standing wall`, bad.inside.slice(0, 4).join('\n      '));
      r.expect(!bad.doors.length && !bad.half.length, 'C4', `${room}: doors and half walls never cut`, [...bad.doors, ...bad.half].slice(0, 4).join('\n      '));

      // C5: swing the heading ±0.3 rad (well inside the 0.15..0.35 band either side of side-on) round each axis
      const [x, z] = spots[0];
      const flips = [];
      for (const base of [0, PI / 2, PI, -PI / 2]) {
        await pose(x, z, base); await settle();
        const n = await page.evaluate(base => new Promise(done => {
          const P = window.dev.player, t0 = performance.now(), last = new Map(), flips = {};
          const tick = () => {
            const t = (performance.now() - t0) / 1000;
            P.st.yaw = base + 0.3 * Math.sin(t * 2 * Math.PI / 1.1) + (Math.random() - 0.5) * 0.04;
            const sides = P.dbg.sides(), here = P.dbg.room();
            if (t > 0.6) for (const [w, s] of sides) if (s.some(x => x.room === here)) { const f = P.dbg.facing.has(w); if (last.has(w) && last.get(w) !== f) flips[w.uuid] = (flips[w.uuid] || 0) + 1; last.set(w, f); }
            if (t < 4.0) requestAnimationFrame(tick); else done(Object.values(flips).reduce((a, b) => a + b, 0));
          };
          requestAnimationFrame(tick);
        }), base);
        if (n) flips.push(`round heading ${base.toFixed(2)}: ${n} flips`);
      }
      r.expect(!flips.length, 'C5', `${room}: a swaying camera never flips a wall`, flips.join(' | '));
    }
    console.log(`\ntotals: ${tally.poses} views · ${tally.wrongCut} facing-but-standing · ${tally.wrongUp} cut-but-behind · ${tally.block} sight-line blocks · ${tally.inside} lens-in-wall · ${tally.hungLeft} hung left · ${tally.doors + tally.half} doors/half walls cut`);
  }

  // ---------------------------------------------------------------- stills
  if (STILLS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    const shots = [];
    for (const [room, spots] of Object.entries(ROOMS)) {
      if (only.length && !only.includes(room)) continue;
      const [x, z] = spots[0];
      for (const [label, yaw, view] of [['ne', PI / 4, 'third'], ['nw', -PI / 4, 'third'], ['sw', -3 * PI / 4, 'third'], ['se', 3 * PI / 4, 'third'], ['top', PI / 4, 'top']]) {
        await pose(x, z, yaw, view); await settle(800);
        const f = `${room}-${label}.png`; await page.screenshot({ path: path.join(SHOTS, f) }); shots.push([room, label, f]);
      }
    }
    await pose(-0.6, 1.2, 0.25);
    const rows = Object.keys(ROOMS).filter(k => shots.some(s => s[0] === k)).map(k => `<h2>${k}</h2><div class=row>${shots.filter(s => s[0] === k).map(([, l, f]) => `<figure><img src="${f}"><figcaption>${l}</figcaption></figure>`).join('')}</div>`).join('');
    fs.writeFileSync(path.join(SHOTS, 'index.html'), `<!doctype html><meta charset=utf-8><title>cutaway ${TAG}</title><style>body{background:#111;color:#eee;font:14px system-ui;margin:16px}.row{display:flex;gap:8px;flex-wrap:wrap}figure{margin:0}img{width:300px;display:block}figcaption{opacity:.7}</style><h1>cutaway · ${TAG}</h1>${rows}`);
    r.ok('stills', `${shots.length} stills -> ${SHOTS}`);
  }
  const ex = errors.filter(e => e.startsWith('exception'));
  r.expect(!ex.length, 'run', 'no uncaught exceptions', ex.slice(0, 3).join(' | '));
  await ctx.close();
  return r.finish();
});
