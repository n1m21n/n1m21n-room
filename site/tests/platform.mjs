// Platform suite: the same game on phones, tablets and desktops, with each device's own input (thumb joystick, tap, pinch,
// keyboard, mouse, wheel), rotation / resize, and device-pixel-ratio sanity.
//   X1 fits the screen   no scrollbars, canvas fills the viewport, input media queries match the device, safe-area meta
//   X2 input works       touch: joystick, tap-to-walk, drag-look, pinch-zoom   |   desktop: WASD, E, V, M, Esc, wheel, drag, click
//   X3 rotate / resize   swap width and height mid-game: canvas + camera follow, nothing overflows
//   X4 pixels            backing store is bounded (memory) and sharp enough
//   npm run test:platform [-- --dev=iphone-se,ipad-landscape] [-- --quick]
import { start, openPage, reporter, run, want, arg, sleep, DEVICES } from './lib/harness.mjs';

const QUICK = ['iphone-se', 'phone-landscape', 'ipad-portrait', 'laptop-small', 'desktop-fhd'];
const pos = page => page.evaluate(() => { const p = window.dev.player; return { x: p.pos.x, z: p.pos.z, yaw: p.st.yaw, dist: p.st.dist, view: p.st.view, speed: p.st.speed, seated: !!p.st.seated, auto: !!p.auto.pts }; });
// software-rendered Chrome runs the game at a few fps (dt is clamped, so game time crawls): wait for the effect, do not time it
const until = async (page, fn, arg, ms = 12000) => { const t0 = Date.now(); for (;;) { const v = await page.evaluate(fn, arg); if (v || Date.now() - t0 > ms) return v; await sleep(150); } };
// a screen point on open floor ~1.3 m from him in front of the camera (what a thumb would tap)
const floorPoint = page => page.evaluate(() => { const d = window.dev, TH = d.THREE, c = d.camera, P = d.player; c.updateMatrixWorld(true);
  for (const [sx, sy] of [[0.5, 0.7], [0.35, 0.7], [0.65, 0.7], [0.5, 0.8], [0.3, 0.6], [0.7, 0.6]]) {
    const rc = new TH.Raycaster(); rc.setFromCamera({ x: sx * 2 - 1, y: -(sy * 2 - 1) }, c); const o = rc.ray.origin, dir = rc.ray.direction; if (dir.y >= -0.01) continue; const t = -o.y / dir.y, x = o.x + dir.x * t, z = o.z + dir.z * t;
    if (d.nav.free(x, z) && Math.hypot(x - P.pos.x, z - P.pos.z) > 0.8) return { x: sx * innerWidth, y: sy * innerHeight, wx: x, wz: z };
  } return { x: innerWidth / 2, y: innerHeight * 0.7 }; });
const moved = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

run(async () => {
  const ctx = await start(), r = reporter('platform');
  const devs = DEVICES.filter(d => want('dev').length ? want('dev').includes(d.name) : arg('quick') ? QUICK.includes(d.name) : true);
  for (const dev of devs) {
    r.section(`${dev.name} ${dev.w}x${dev.h} @${dev.dpr}x ${dev.touch ? 'touch' : 'mouse+keys'}`);
    const g = dev.name, { page, errors } = await openPage(ctx, dev);
    const cdp = await page.createCDPSession();
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i, radiusX: 6, radiusY: 6, force: 1 })) });
    await page.evaluate(() => { window.__t = null; const P = window.dev.player; if (P.st.seated) P.stand(); P.st.frozen = false; P.pos.set(0.3, 0, 1.2); window.dev.man.root.position.set(0.3, 0, 1.2); P.st.yaw = 0.25; P.st.dist = 3.8; while (P.st.view !== 'third') P.cycleView(); });

    // ---- X1
    const fit = await page.evaluate(() => { const c = document.querySelector('canvas'), b = c.getBoundingClientRect(), de = document.documentElement;
      return { vw: innerWidth, vh: innerHeight, cw: b.width, ch: b.height, cx: b.x, cy: b.y, sw: de.scrollWidth, sh: de.scrollHeight, bsw: document.body.scrollWidth, coarse: matchMedia('(pointer: coarse)').matches, hover: matchMedia('(hover: hover)').matches,
        vmeta: document.querySelector('meta[name=viewport]')?.content || '', zoomable: !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(document.querySelector('meta[name=viewport]')?.content || '') }; });
    r.expect(fit.sw <= fit.vw && fit.sh <= fit.vh && fit.bsw <= fit.vw, g, 'X1 no scrollbars', `doc ${fit.sw}x${fit.sh} in ${fit.vw}x${fit.vh}`);
    r.expect(Math.abs(fit.cw - fit.vw) <= 1 && Math.abs(fit.ch - fit.vh) <= 1 && fit.cx === 0 && fit.cy === 0, g, 'X1 canvas fills the viewport', `canvas ${fit.cw}x${fit.ch} at ${fit.cx},${fit.cy}`);
    r.expect(fit.coarse === dev.touch, g, `X1 pointer:${dev.touch ? 'coarse' : 'fine'} matches the device`, `coarse=${fit.coarse}`);
    r.expect(/viewport-fit=cover/.test(fit.vmeta), g, 'X1 viewport-fit=cover (notch safe)', fit.vmeta);
    if (!fit.zoomable) r.warn(g, 'X1 pinch-zoom of the page is disabled by the viewport meta (accessibility)');

    // ---- X2
    if (dev.touch) {
      const j = await page.evaluate(() => { const b = document.getElementById('joy').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width }; });
      r.expect(j.w > 40, g, 'X2 joystick is on screen', `joy width ${j.w}`);
      const a = await pos(page);
      await touch('touchStart', [[j.x, j.y]]); await touch('touchMove', [[j.x, j.y - 40]]); await until(page, a => Math.hypot(window.dev.player.pos.x - a.x, window.dev.player.pos.z - a.z) > 0.15, a);
      const mid = await pos(page); await touch('touchEnd', []); await sleep(300);
      r.expect(moved(a, mid) > 0.15, g, `X2 joystick walks him (${moved(a, mid).toFixed(2)} m)`, 'he did not move');
      const on = await page.evaluate(() => document.getElementById('joy').classList.contains('on')); r.expect(!on, g, 'X2 joystick releases when the finger lifts');
      // tap-to-walk: tap the floor in front of him
      await page.evaluate(() => { const P = window.dev.player; P.pos.set(0.3, 0, 1.2); window.dev.man.root.position.set(0.3, 0, 1.2); P.st.yaw = 0.25; P.st.speed = 0; P.cancelAuto(); });
      await sleep(400);
      const hit = await floorPoint(page);
      await Promise.all([touch('touchStart', [[hit.x, hit.y]]), touch('touchEnd', [])]); await until(page, () => Math.hypot(window.dev.player.pos.x - 0.3, window.dev.player.pos.z - 1.2) > 0.3);
      const t1 = await pos(page); r.expect(moved({ x: 0.3, z: 1.2 }, t1) > 0.3, g, `X2 tap-to-walk (${moved({ x: 0.3, z: 1.2 }, t1).toFixed(2)} m)`, 'tapping the floor did nothing');
      // drag-look: one finger on the right side
      const y0 = (await pos(page)).yaw, sx = fit.vw * 0.7, sy = fit.vh * 0.45;
      await touch('touchStart', [[sx, sy]]); for (let i = 1; i <= 6; i++) await touch('touchMove', [[sx + i * 20, sy]]); await touch('touchEnd', []); await sleep(200);
      r.expect(Math.abs((await pos(page)).yaw - y0) > 0.2, g, 'X2 one-finger drag looks around', 'yaw unchanged');
      // pinch
      const d0 = (await pos(page)).dist, cx = fit.vw * 0.6, cy = fit.vh * 0.4;
      await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]); for (let i = 1; i <= 6; i++) await touch('touchMove', [[cx - 30 - i * 12, cy], [cx + 30 + i * 12, cy]]); await touch('touchEnd', []); await sleep(200);
      const d1 = (await pos(page)).dist; r.expect(d1 < d0 - 0.2, g, `X2 pinch-out zooms in (${d0.toFixed(1)} -> ${d1.toFixed(1)})`, 'distance unchanged');
    } else {
      const k = async (key, ms) => { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); };
      const a = await pos(page); await page.keyboard.down('KeyW'); await until(page, a => Math.hypot(window.dev.player.pos.x - a.x, window.dev.player.pos.z - a.z) > 0.15, a); await page.keyboard.up('KeyW'); const b = await pos(page);
      r.expect(moved(a, b) > 0.15, g, `X2 W walks (${moved(a, b).toFixed(2)} m)`, 'no movement'); 
      const v0 = (await pos(page)).view; await k('KeyV', 60); await sleep(150); r.expect((await pos(page)).view !== v0, g, 'X2 V cycles the camera view');
      await k('KeyV', 60); await k('KeyV', 60); await sleep(150);
      const m0 = await page.evaluate(() => window.__n1audio.paused); await k('KeyM', 60); await until(page, m => window.__n1audio.paused !== m, m0);
      r.expect(await page.evaluate(() => window.__n1audio.paused) !== m0, g, 'X2 M plays / pauses the music');
      await k('KeyM', 60); await sleep(400);
      // E at a station, Esc closes
      await page.evaluate(() => { const d = window.dev, s = d.stations.find(s => s.label === 'timeline'); const P = d.player; P.pos.set(s.p[0], 0, s.p[1]); d.man.root.position.set(s.p[0], 0, s.p[1]); });
      await until(page, () => document.getElementById('plabel').textContent === 'timeline' && !document.getElementById('prompt').hidden); await k('KeyE', 60); await until(page, () => !document.getElementById('card').hidden);
      const open = await page.evaluate(() => !document.getElementById('card').hidden); r.expect(open, g, 'X2 E at a station opens its card', 'card stayed hidden');
      await k('Escape', 60); await until(page, () => document.getElementById('card').hidden); r.expect(await page.evaluate(() => document.getElementById('card').hidden), g, 'X2 Esc closes the card');
      await page.evaluate(() => { const P = window.dev.player; while (P.st.view !== 'third') P.cycleView(); P.st.dist = 3.8; });
      const d0 = (await pos(page)).dist; await page.mouse.move(fit.vw / 2, fit.vh / 2); await page.mouse.wheel({ deltaY: -400 }); await sleep(200);
      r.expect((await pos(page)).dist < d0 - 0.3, g, 'X2 wheel zooms');
      const y0 = (await pos(page)).yaw; await page.mouse.move(fit.vw * 0.5, fit.vh * 0.4); await page.mouse.down(); await page.mouse.move(fit.vw * 0.5 + 120, fit.vh * 0.4, { steps: 8 }); await page.mouse.up(); await sleep(200);
      r.expect(Math.abs((await pos(page)).yaw - y0) > 0.2, g, 'X2 mouse drag looks around');
      await page.evaluate(() => { const P = window.dev.player; P.pos.set(0.3, 0, 1.2); window.dev.man.root.position.set(0.3, 0, 1.2); P.st.speed = 0; });
      await sleep(400);
      const hit = await floorPoint(page);
      await page.mouse.click(hit.x, hit.y); await until(page, () => Math.hypot(window.dev.player.pos.x - 0.3, window.dev.player.pos.z - 1.2) > 0.3);
      const t1 = await pos(page); r.expect(moved({ x: 0.3, z: 1.2 }, t1) > 0.3, g, `X2 click-to-walk (${moved({ x: 0.3, z: 1.2 }, t1).toFixed(2)} m)`, 'clicking the floor did nothing');
    }

    // ---- X3 rotate
    await page.setViewport({ width: dev.h, height: dev.w, deviceScaleFactor: dev.dpr, hasTouch: dev.touch, isMobile: dev.touch }); await until(page, w => document.querySelector('canvas').getBoundingClientRect().width === w && Math.abs(window.dev.camera.aspect - innerWidth / innerHeight) < 0.02, dev.h, 20000);
    const rot = await page.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(), de = document.documentElement; return { vw: innerWidth, vh: innerHeight, cw: c.width, ch: c.height, sw: de.scrollWidth, sh: de.scrollHeight, aspect: window.dev.camera.aspect }; });
    r.expect(Math.abs(rot.cw - rot.vw) <= 1 && Math.abs(rot.ch - rot.vh) <= 1, g, `X3 rotated to ${rot.vw}x${rot.vh}: canvas follows`, `canvas ${rot.cw}x${rot.ch}`);
    r.expect(Math.abs(rot.aspect - rot.vw / rot.vh) < 0.02, g, 'X3 camera aspect follows', `aspect ${rot.aspect.toFixed(2)} vs ${(rot.vw / rot.vh).toFixed(2)}`);
    r.expect(rot.sw <= rot.vw && rot.sh <= rot.vh, g, 'X3 no scrollbars after rotating', `doc ${rot.sw}x${rot.sh}`);
    await page.setViewport({ width: dev.w, height: dev.h, deviceScaleFactor: dev.dpr, hasTouch: dev.touch, isMobile: dev.touch }); await sleep(600);

    // ---- X4
    const px = await page.evaluate(() => { const c = document.querySelector('canvas'); return { w: c.width, h: c.height, mp: c.width * c.height / 1e6, ratio: c.width / innerWidth, dpr: devicePixelRatio, ren: window.dev.renderer.getPixelRatio() }; });
    r.expect(px.mp <= 9, g, `X4 backing store ${px.w}x${px.h} = ${px.mp.toFixed(1)} MP`, 'over 9 MP: memory / fill-rate risk on phones');
    r.expect(px.ren <= px.dpr + 0.01, g, `X4 render ratio ${px.ren.toFixed(2)} <= device ${px.dpr}`);
    if (px.ratio < 0.9) r.warn(g, `X4 canvas renders at ${(px.ratio * 100) | 0}% of CSS pixels (blurry); the adaptive dpr has dropped it`);

    r.expect(errors.length === 0, g, 'no console / network errors', [...new Set(errors)].slice(0, 3).join(' | '));
    await page.close();
  }
  await ctx.close();
  return r.finish();
});
