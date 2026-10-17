// Wall cut-away stability: walls between the camera and him sink into the floor (player.js cam()). They must never
// bob (sink, rise, sink again) while the camera is still in the cut region, and never vanish in one frame.
// Drives the real input path (mouse drag, wheel, WASD) in the annex (bathroom, foyer, kitchen), the main room and
// the gallery corridor, recording every wall's scale.y, the camera and him on every frame.
//   W0 no height     a wall's scale.y / position.y never changes (cut-aways fade, they don't sink)
//   W1 no bobbing        a wall's presence (fade, or height) reverses down > up > down within 3 s, without a 1 s clear spell before the rise
//   W2 no blinking       a wall never drops from full height to under half (or invisible) in one frame
//   W3 cut works         a wall that blocks the line to him for 0.5 s is sunk by then
//   npm run test:walls [-- --only=foyer-orbit,bath-door]
import { start, openPage, reporter, run, want, arg, sleep, OUT } from './lib/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BOB_WINDOW = 3.0, CLEAR = 1.0, STEP = 0.01;
// spots: [x, z, yaw]. yaw: 0 faces -z, PI faces +z, -PI/2 faces +x
const PI = Math.PI;
const SCENES = [
  { name: 'room-orbit', at: [0.2, 0.4, 0.3], acts: ['orbit'] },
  { name: 'room-corner-orbit', at: [3.2, -2.2, -0.8], acts: ['orbit', 'zoomout', 'orbit'] },
  { name: 'room-to-foyer', at: [2.2, 1.6, -PI / 2], acts: ['walk:3.2', 'orbit', 'walk:1.5'] },
  { name: 'foyer-orbit', at: [5.6, 1.6, 0.4], acts: ['orbit', 'zoomout', 'orbit', 'pitch'] },
  { name: 'foyer-east-orbit', at: [8.4, 1.7, -1.2], acts: ['orbit', 'zoomout', 'orbit'] },
  { name: 'bath-orbit', at: [5.8, -1.0, 0.2], acts: ['orbit', 'zoomout', 'orbit', 'pitch'] },
  { name: 'bath-door', at: [5.62, -1.2, PI], acts: ['walk:2.4', 'orbit', 'turn', 'walk:2.4', 'orbit'] },
  { name: 'kitchen-orbit', at: [6.3, 4.8, 2.4], acts: ['orbit', 'zoomout', 'orbit', 'pitch'] },
  { name: 'kitchen-door', at: [6.92, 1.4, PI], acts: ['walk:2.6', 'orbit', 'turn', 'walk:2.6', 'orbit'] },
  { name: 'corridor-orbit', at: [10.3, 1.6, -PI / 2], acts: ['orbit', 'walk:2', 'orbit', 'zoomout', 'orbit'] },
];

run(async () => {
  const r = reporter('walls'), only = want('only');
  const ctx = await start(), { page, errors } = await openPage(ctx, { w: 720, h: 450, dpr: 1, touch: false });
  await page.evaluate(() => {
    const d = window.dev, T = d.THREE, P = d.player, walls = [];
    d.scene.traverse(o => { if (o.userData.wall) walls.push(o); });
    const full = walls.map(w => ({ w, sy: w.scale.y, py: w.position.y, box: new T.Box3().setFromObject(w), pad: new T.Box3().setFromObject(w).expandByScalar(w.userData.arm ? 0.02 : 0.3), name: [w.name || 'wall', ...new T.Box3().setFromObject(w).min.toArray().concat(new T.Box3().setFromObject(w).max.toArray()).map(v => v.toFixed(2))].join(' ') }));
    const ray = new T.Ray(), v = new T.Vector3(), hit = new T.Vector3();
    const rec = window.__rec = { on: false, t: 0, frames: [] };
    let last = performance.now();
    const tick = () => {
      const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (rec.on) {
        rec.t += dt;
        const c = d.camera.position, side = new T.Vector3(Math.cos(P.st.yaw), 0, -Math.sin(P.st.yaw));
        const f = { t: rec.t, cam: [c.x, c.y, c.z], pos: [P.pos.x, P.pos.z], d: P.dbg.orb.d, s: {}, h: {}, blk: {}, why: {} };
        full.forEach((o, i) => {
          // presence: 1 = solid, 0 = gone. A cut fades the wall (its uCut); a height change (scale.y) also counts against it
          const pres = Math.min(o.w.scale.y / o.sy, 1 - (o.w.material.uniforms?.uCut?.value || 0));
          if (pres < 1 || !o.w.visible) f.s[i] = [pres, o.w.visible ? 1 : 0];
          if (Math.abs(o.w.scale.y - o.sy) > 1e-6 || Math.abs(o.w.position.y - o.py) > 1e-6) f.h[i] = 1;
          // geometric blocking against the wall at FULL height: lens inside its pad, or a line lens -> his middle through it
          let b = o.pad.containsPoint(c);
          for (const off of [0, -0.35, 0.35]) { if (b) break; v.set(P.pos.x + side.x * off, 1.0, P.pos.z + side.z * off).sub(c); const L = v.length(); ray.set(c, v.normalize()); b = !!ray.intersectBox(o.box, hit) && hit.distanceTo(c) < L; }
          if (b) f.blk[i] = 1;
          const cut = P.dbg.cuts.get(o.w); if (cut) f.why[i] = cut.why;
        });
        rec.frames.push(f);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__names = full.map(o => o.name); window.__flags = full.map(o => (o.w.userData.arm ? 'arm' : '') + (o.w.userData.armOut ? ' armOut' : '') + (o.w.userData.door ? ' door' : ''));
  });
  const names = await page.evaluate(() => window.__names), flags = await page.evaluate(() => window.__flags);
  const W = 720, H = 450;
  const drag = async (dx, dy, steps, ms = 45) => {
    await page.mouse.move(W / 2, H / 2); await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(W / 2 + dx * i / steps, H / 2 + dy * i / steps); await sleep(ms); }
    await page.mouse.up(); await page.mouse.move(W / 2 + 200, H / 2 + 200);   // release off-centre: no tap (moved > 10 px)
  };
  const ACT = {
    orbit: async () => { for (let k = 0; k < 2; k++) await drag(640, 0, 40); await drag(-1280, 30, 70); },   // ~1 turn each way (0.005 rad/px)
    zoomout: async () => { for (let i = 0; i < 6; i++) { await page.mouse.move(W / 2, H / 2); await page.mouse.wheel({ deltaY: 120 }); await sleep(80); } },
    pitch: async () => { await drag(200, 160, 20); await drag(-200, -260, 25); },
    turn: async () => { await drag(628, 0, 30); },                                                             // ~half a turn
    walk: async s => { await page.keyboard.down('KeyW'); await sleep(+s * 1000); await page.keyboard.up('KeyW'); await sleep(400); },
  };

  const totals = { bobs: 0, blinks: 0, misses: 0, revs: 0 };
  for (const sc of SCENES) {
    if (only.length && !only.includes(sc.name)) continue;
    r.section(sc.name);
    await page.evaluate(([x, z, yaw]) => {
      const d = window.dev, P = d.player; if (P.st.seated) P.stand(); P.st.frozen = false; P.cancelAuto(); P.keys.clear(); P.st.speed = 0;
      while (P.st.view !== 'third') P.cycleView();
      P.pos.set(x, 0, z); d.man.root.position.set(x, 0, z); P.st.yaw = yaw; P.st.heading = yaw; P.st.pitch = 0.38; P.st.dist = 3.8; P.st.intro = 1;
      window.__rec.on = false; window.__rec.frames = []; window.__rec.t = 0;
    }, sc.at);
    await sleep(2500);                                                     // settle: camera eases in, any cut from the jump rises
    await page.evaluate(() => { window.__rec.on = true; });
    for (const a of sc.acts) { const [k, v] = a.split(':'); await ACT[k](v); }
    await sleep(2500);
    const frames = await page.evaluate(() => { window.__rec.on = false; return window.__rec.frames; });
    const fps = frames.length / Math.max(1e-6, frames.at(-1)?.t || 1);

    // per wall series
    const ids = new Set(); for (const f of frames) { Object.keys(f.s).forEach(i => ids.add(+i)); Object.keys(f.blk).forEach(i => ids.add(+i)); }
    let bobs = [], blinks = [], misses = [], revs = 0;
    const tall = [...new Set(frames.flatMap(f => Object.keys(f.h)))].map(i => names[i]);
    for (const i of ids) {
      const s = frames.map(f => f.s[i]?.[0] ?? 1), vis = frames.map(f => f.s[i]?.[1] ?? 1), blk = frames.map(f => !!f.blk[i]);
      // turning points: direction changes once the value has moved STEP from the last extreme
      const turns = []; let dir = 0, ext = s[0], extAt = 0;
      for (let k = 1; k < s.length; k++) {
        if (dir < 0 && s[k] <= ext) { ext = s[k]; extAt = k; } if (dir > 0 && s[k] >= ext) { ext = s[k]; extAt = k; }   // a turn is the LAST frame of a plateau
        const nd = s[k] < ext - STEP ? -1 : s[k] > ext + STEP ? 1 : 0;
        if (dir === 0 && Math.abs(s[k] - s[0]) > STEP) { dir = s[k] < s[0] ? -1 : 1; turns.push({ dir, k: 0 }); ext = s[k]; extAt = k; }
        else if (dir !== 0 && nd && nd !== dir) { dir = nd; turns.push({ dir, k: extAt }); ext = s[k]; extAt = k; }
      }
      revs += Math.max(0, turns.length - 1);
      for (let j = 0; j + 2 < turns.length; j++) {
        const [a, b, c] = turns.slice(j, j + 3);
        if (a.dir !== -1 || b.dir !== 1 || c.dir !== -1) continue;
        if (frames[c.k].t - frames[a.k].t > BOB_WINDOW) continue;
        let run = 0, best = 0; for (let k = a.k; k <= b.k; k++) { if (blk[k]) run = 0; else { run += k ? frames[k].t - frames[k - 1].t : 0; best = Math.max(best, run); } }
        if (best >= CLEAR) continue;                                         // the camera really left, then came back
        const why = [...new Set(frames.slice(a.k, c.k + 1).map(f => f.why[i]).filter(Boolean))].join('/');
        bobs.push(`${names[i]} [${flags[i]}] down@${frames[a.k].t.toFixed(2)} up@${frames[b.k].t.toFixed(2)} down@${frames[c.k].t.toFixed(2)} clear ${best.toFixed(2)}s cut by ${why || '-'} · cam ${frames[b.k].cam.map(v => v.toFixed(2))} d ${frames[b.k].d.toFixed(2)} him ${frames[b.k].pos.map(v => v.toFixed(2))}`);
      }
      for (let k = 1; k < s.length; k++) if (s[k - 1] > 0.95 && vis[k - 1] && (s[k] < 0.5 || !vis[k])) blinks.push(`${names[i]} [${flags[i]}] at ${frames[k].t.toFixed(2)}s (${frames[k].why[i] || 'not a cut: hidden elsewhere'})`);
      // a wall that blocks for 0.5 s of sim time must be well down by the end of it (arm walls stop the camera instead)
      if (!flags[i].includes('arm')) { let since = null; for (let k = 0; k < s.length; k++) { if (!blk[k]) { since = null; continue; } since ??= frames[k].t; if (frames[k].t - since > 0.5 && s[k] > 0.5) { misses.push(`${names[i]} at ${frames[k].t.toFixed(2)}s`); break; } } }
    }
    if (arg('dump')) fs.writeFileSync(path.join(OUT, `walls-${sc.name}.json`), JSON.stringify({ names, flags, frames }));
    totals.bobs += bobs.length; totals.blinks += blinks.length; totals.misses += misses.length; totals.revs += revs;
    r.ok(sc.name, `${frames.length} frames · ${fps.toFixed(0)} fps · ${ids.size} walls touched · ${revs} reversals`);
    r.expect(!tall.length, 'W0', `${sc.name}: no wall changes height`, tall.slice(0, 3).join(' | '));
    r.expect(!bobs.length, 'W1', `${sc.name}: no wall bobs (${bobs.length})`, bobs.slice(0, 4).join('\n      '));
    r.expect(!blinks.length, 'W2', `${sc.name}: no wall blinks off in one frame`, blinks.slice(0, 3).join(' | '));
    if (misses.length) r.warn('W3', `${sc.name}: blocking wall not sunk within 0.5 s: ${misses.slice(0, 3).join(' | ')}`);
  }
  console.log(`\ntotals: ${totals.bobs} bobs · ${totals.revs} direction reversals · ${totals.blinks} blinks · ${totals.misses} slow cuts`);
  const ex = errors.filter(e => e.startsWith('exception'));
  r.expect(!ex.length, 'run', 'no uncaught exceptions', ex.slice(0, 3).join(' | '));
  await ctx.close();
  return r.finish();
});
