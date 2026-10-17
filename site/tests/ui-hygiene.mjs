// UI + camera hygiene for the room. Drives the real page in headless Chrome across phone / tablet / desktop
// viewports, camera views and game states (seated at the desk, watching tv, deck open, a card open, a toast, a hall),
// and checks that nothing overlaps, runs off screen, hides the man, or glitches. Writes screenshots + report.json +
// index.html (a contact sheet) to build-cache/review/ui-hygiene/.
//
//   npm run test:ui                      all viewports x views x states
//   npm run test:ui -- --vp=phone        only viewports whose name contains "phone"
//   npm run test:ui -- --state=desk,tv   only these states
//   npm run test:ui -- --view=top        only this view
//   npm run test:ui -- --dpr=2 --frames=45   sharper shots, longer settling (headless Chrome is software-rendered: ~12 fps at dpr 1, 3 fps at dpr 2)
//   npm run test:ui -- --url=http://localhost:5181   test a server that is already running (default: starts its own)
//
// Exit code 1 when any check FAILs (warnings do not fail the run).
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(ROOT, '../build-cache/review/ui-hygiene');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const arg = (k, d = '') => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=');
const want = k => arg(k).split(',').filter(Boolean);

const VIEWPORTS = [
  { name: 'phone-portrait', w: 390, h: 844, dpr: 2, touch: true },
  { name: 'phone-small', w: 360, h: 640, dpr: 2, touch: true },
  { name: 'phone-landscape', w: 844, h: 390, dpr: 2, touch: true },
  { name: 'tablet', w: 768, h: 1024, dpr: 1.5, touch: true },
  { name: 'desktop', w: 1280, h: 800, dpr: 1, touch: false },
];
const VIEWS = ['third', 'first', 'top'];

// every state is a function run inside the page; `t` is the helper kit below
const STATES = {
  room: t => { t.reset(); t.stand(0.3, 1.2, Math.PI); },
  records: t => { t.reset(); t.stand(1.3, -2.05, 0); },
  snake: t => { t.reset(); t.nearSnake(); },
  desk: t => { t.reset(); t.act('computer'); },
  window: t => { t.reset(); t.act('look outside'); },
  keys: t => { t.reset(); t.act('play keys'); },
  tv: t => { t.reset(); t.act('watch tv'); },
  deck: t => { t.reset(); t.stand(-0.6, 1.2, Math.PI); t.deck(true); },
  'deck+desk+toast': t => { t.reset(); t.act('computer'); t.deck(true); t.act('pet the snake'); },
  crate: t => { t.reset(); t.stand(1.3, -2.05, 0); t.act('records'); },
  help: t => { t.reset(); t.stand(-0.6, 1.2, Math.PI); document.getElementById('help').click(); },
  timeline: t => { t.reset(); t.act('timeline'); },
  books: t => { t.reset(); t.act('books'); },
  hall: t => { t.reset(); t.hall(0); },
  'hall+deck': t => { t.reset(); t.hall(1); t.deck(true); },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- in-page kit (serialised into the page)
function installKit() {
  const $ = id => document.getElementById(id);
  const d = window.dev;
  const frames = n => new Promise(res => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const T = {
    frames,
    reset() {
      if (!$('card').hidden) $('cardx')?.click();
      if (d.player.st.seated) d.player.stand();
      $('deck').classList.add('mini'); $('toast').hidden = true;
      d.player.st.yaw = 0.25; d.player.st.pitch = 0.38; d.player.st.dist = 3.8; d.player.st.intro = 1;   // past the opening close-up
      while (d.player.st.view !== 'third') $('view').click();
    },
    view(v) { let n = 0; while (d.player.st.view !== v && n++ < 4) $('view').click(); if (v === 'first') d.player.st.pitch = 0; else d.player.st.pitch = 0.38; },
    stand(x, z, h) { d.player.pos.set(x, 0, z); d.player.st.heading = h; d.man.root.position.set(x, 0, z); },
    act(label) { const s = d.stations.find(s => s.label === label && !s.frame); if (!s) throw new Error('no station ' + label); s.act(); },
    nearSnake() { const q = d.stations.find(s => s.live).live(); d.player.pos.set(q.x + 0.5, 0, q.z + 0.5); d.man.root.position.set(q.x + 0.5, 0, q.z + 0.5); },
    deck(open) { $('deck').classList.toggle('mini', !open); },
    hall(i) { const z = d.gallery.zones.filter(z => z.entry)[i]; d.player.pos.set(z.entry.x, 0, z.entry.z); d.player.st.heading = z.entry.heading; d.man.root.position.set(z.entry.x, 0, z.entry.z); },
  };
  window.__t = T;
}

// ---------------------------------------------------------------- in-page measurements
function measure() {
  const vw = innerWidth, vh = innerHeight, d = window.dev;
  const vis = e => { if (!e || e.hidden) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return null; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 ? r : null; };
  const UI = { mark: '.chrome .mark', help: '#help', snd: '#snd', music: '#musicsw', view: '#view', where: '#where', clock: '#clock', places: '#places', deck: '#deck', tvp: '#tvp', prompt: '#prompt', inf: '#inf', toast: '#toast', thought: '#thought p', card: '#card', joy: '#joy', warp: '#warp' };
  const ui = {};
  for (const [k, s] of Object.entries(UI)) { const r = vis(document.querySelector(s)); if (r) ui[k] = { x: r.left, y: r.top, w: r.width, h: r.height, mini: k === 'deck' && document.querySelector(s).classList.contains('mini') }; }
  // buttons that are too small to hit on a touch screen (HIG: 44, we accept 32 as the floor) and text that spills out of its box
  const small = [], spill = [];
  for (const b of document.querySelectorAll('button, a')) {
    const r = vis(b); if (!r || b.closest('#boot')) continue;
    const tiny = Math.min(r.width, r.height) < 32;
    if (tiny) {
      small.push({ el: (b.id ? '#' + b.id : b.className || b.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height), w: r.width, h: r.height });
    }
  }
  for (const e of document.querySelectorAll('#deck *, #tvp *, #card *, .chrome *, #prompt, #toast, #inf')) {
    const r = vis(e); if (!r || e.children.length) continue;
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && cs.overflowX === 'visible' && e.clientWidth > 0 && !e.closest('.sleeves,.tchips,.tline')) spill.push((e.id ? '#' + e.id : e.className || e.tagName) + ' "' + (e.textContent || '').slice(0, 24) + '"');
  }
  // 3D: where the man is on screen, and whether he is seen
  const out = { vw, vh, ui, small, spill, canvas: null };
  const THREE_V = d.camera.position.constructor;
  const cam = d.camera, man = d.man;
  man.root.updateMatrixWorld(true); cam.updateMatrixWorld(true);
  const pts = []; for (const n of ['head', 'hips', 'footL', 'footR', 'handL', 'handR']) { const b = man.bones[n]; if (b) pts.push(b.getWorldPosition(new THREE_V())); }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = 0;
  for (const p of pts) { const q = p.clone().project(cam); if (q.z > 1) behind++; x0 = Math.min(x0, (q.x + 1) / 2 * vw); x1 = Math.max(x1, (q.x + 1) / 2 * vw); y0 = Math.min(y0, (1 - q.y) / 2 * vh); y1 = Math.max(y1, (1 - q.y) / 2 * vh); }
  out.man = { x0, y0, x1, y1, behind, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  out.cam = { x: cam.position.x, y: cam.position.y, z: cam.position.z, nan: [cam.position.x, cam.position.y, cam.position.z].some(v => !Number.isFinite(v)) };
  // pixel test: render with and without him; he is "seen" when the picture differs inside his box (grain is seeded per tick, so both renders match)
  const cv = d.renderer.domElement, W = cv.width, H = cv.height, sx = W / vw, sy = H / vh;
  const grab = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(cv, 0, 0); return g.getImageData(0, 0, W, H).data; };
  d.render(); const A = grab();
  man.root.visible = false; d.render(); const B = grab(); man.root.visible = true; d.render();
  const bx0 = Math.max(0, Math.floor((x0 - 6) * sx)), bx1 = Math.min(W, Math.ceil((x1 + 6) * sx)), by0 = Math.max(0, Math.floor((y0 - 6) * sy)), by1 = Math.min(H, Math.ceil((y1 + 6) * sy));
  let diff = 0, tot = 0;
  for (let y = by0; y < by1; y += 2) for (let x = bx0; x < bx1; x += 2) { const i = (y * W + x) * 4; tot++; if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 24) diff++; }
  out.man.seen = tot ? diff / tot : 0; out.man.boxPx = tot;
  if (out.man.seen < 0.04) {   // say what is in the way: visible meshes on the line lens -> his hips
    const hip = man.bones.hips.getWorldPosition(new THREE_V()), dir = hip.clone().sub(cam.position), L = dir.length(), rc = new d.THREE.Raycaster(cam.position.clone(), dir.normalize(), 0, L - 0.3);
    const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    out.man.block = rc.intersectObjects(d.scene.children, true).filter(h => shown(h.object) && h.object.isMesh).slice(0, 3).map(h => `${h.object.name || h.object.parent?.name || h.object.geometry.type}@${h.distance.toFixed(2)}${JSON.stringify(Object.keys(h.object.userData))}${JSON.stringify(new d.THREE.Box3().setFromObject(h.object).min.toArray().concat(new d.THREE.Box3().setFromObject(h.object).max.toArray()).map(v => +v.toFixed(2)))}`).join(',');
    out.man.vis = man.root.visible;
  }
  // whole frame: one colour swallowing it (camera inside a wall), or nothing but the clear colour
  const hist = new Map(); let lum = 0, n = 0;
  for (let i = 0; i < A.length; i += 4 * 97) { const k = (A[i] >> 4) + ',' + (A[i + 1] >> 4) + ',' + (A[i + 2] >> 4); hist.set(k, (hist.get(k) || 0) + 1); lum += A[i] + A[i + 1] + A[i + 2]; n++; }
  out.canvas = { dominant: Math.max(...hist.values()) / n, colours: hist.size, lum: lum / n / 3 };
  out.yaw = +d.player.st.yaw.toFixed(2); out.pos = [d.player.pos.x, d.player.pos.z].map(v => +v.toFixed(2));
  out.view = d.player.st.view; out.seated = d.player.st.seated?.act || null;
  return out;
}

// ---------------------------------------------------------------- checks (node side)
const inter = (a, b) => { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? { w, h, a: w * h } : null; };
const PANELS = ['deck', 'tvp', 'card'];
// pairs that may touch: the bubble sits over the scene by design, the joystick ring is only a hint, warp is a transition
const SKIP_PAIR = new Set(['thought', 'warp']);

function check(m, vp, view, state) {
  const F = [], W = [];
  const fail = s => F.push(s), warn = s => W.push(s);
  const { ui } = m;
  const keys = Object.keys(ui).filter(k => !SKIP_PAIR.has(k));
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = ui[keys[i]], b = ui[keys[j]], o = inter(a, b); if (!o) continue;
    if (o.w < 3 || o.h < 3) continue;
    if (keys[i] === 'joy' || keys[j] === 'joy') { if (o.a > 200) fail(`overlap: ${keys[i]} x ${keys[j]} (${Math.round(o.w)}x${Math.round(o.h)}px)`); continue; }
    fail(`overlap: ${keys[i]} x ${keys[j]} (${Math.round(o.w)}x${Math.round(o.h)}px)`);
  }
  for (const [k, r] of Object.entries(ui)) {
    if (k === 'warp') continue;
    if (r.x < -0.5 || r.y < -0.5 || r.x + r.w > m.vw + 0.5 || r.y + r.h > m.vh + 0.5) (k === 'thought' ? warn : fail)(`off screen: ${k} (${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}x${Math.round(r.h)} in ${m.vw}x${m.vh})`);
  }
  // symmetry: a panel that spans the screen should have the same margin left and right; the bar too
  for (const k of ['deck', 'tvp', 'card']) { const r = ui[k]; if (!r || (k === 'deck' && r.mini)) continue; const l = r.x, rr = m.vw - r.x - r.w; if (Math.abs(l - rr) > 2 && r.w > m.vw * 0.6 && Math.max(l, rr) < 200) fail(`asymmetric: ${k} margins ${Math.round(l)} / ${Math.round(rr)}`); }
  if (ui.mark && ui.view) { const l = ui.mark.x, rr = m.vw - ui.view.x - ui.view.w; if (Math.abs(l - rr) > 2) fail(`asymmetric: top bar margins ${Math.round(l)} / ${Math.round(rr)}`); }
  const bar = ['mark', 'help', 'snd', 'music', 'view'].map(k => ui[k]).filter(Boolean);
  if (bar.length) { const cy = bar.map(r => r.y + r.h / 2); if (Math.max(...cy) - Math.min(...cy) > 2) fail(`top bar not on one line (centres differ by ${(Math.max(...cy) - Math.min(...cy)).toFixed(1)}px)`); }
  // the man
  const g = m.man;
  if (m.cam.nan) fail('camera position is NaN');
  if (view !== 'first') {
    const covers = PANELS.map(k => ui[k]).filter(r => r && !r.mini);
    const centre = { x: g.cx, y: g.cy };
    if (g.behind) fail(`man is behind the camera (${g.behind} bones)`);
    else if (g.cx < 0 || g.cx > m.vw || g.cy < 0 || g.cy > m.vh) fail(`man off screen (centre ${Math.round(g.cx)},${Math.round(g.cy)})`);
    else if (m.man.seen < 0.04 && g.boxPx > 40) fail(`man not visible in the picture (only ${(m.man.seen * 100).toFixed(1)}% of his box differs without him): hidden by a wall or prop · box ${[m.man.x0, m.man.y0, m.man.x1, m.man.y1].map(Math.round)} · ${m.man.boxPx} px · cam ${[m.cam.x, m.cam.y, m.cam.z].map(v => v.toFixed(2))} · yaw ${m.yaw} · at ${m.pos} · in the way ${m.man.block || "-"} · root ${m.man.vis}`);
    for (const r of covers) if (centre.x > r.x && centre.x < r.x + r.w && centre.y > r.y && centre.y < r.y + r.h) fail(`man is under a panel (his centre ${Math.round(g.cx)},${Math.round(g.cy)})`);
    if (g.h < 40 && state !== 'hall' && g.h > 0) warn(`man is tiny on screen (${Math.round(g.h)}px tall)`);
    if (g.h > m.vh * 0.9) warn(`man fills the screen (${Math.round(g.h)}px of ${m.vh})`);
    if (ui.where && g.cy < ui.where.y + ui.where.h && g.cx > ui.where.x && g.cx < ui.where.x + ui.where.w) fail('man is under the location pill');
  }
  const c = m.canvas;
  if (c.dominant > 0.85) fail(`one colour fills ${(c.dominant * 100) | 0}% of the frame (camera inside geometry?)`);
  if (c.colours < 6) fail(`frame is nearly empty (${c.colours} colours)`);
  // touch targets
  if (vp.touch) for (const s of m.small) warn(`small tap target: ${s.el}`);
  for (const s of m.spill) warn(`text spills out: ${s}`);
  return { fails: F, warns: W };
}

// ---------------------------------------------------------------- runner
async function main() {
  let server = null, url = arg('url');
  if (!url) {
    server = await createServer({ root: ROOT, server: { port: 5190, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
    await server.listen(); url = server.resolvedUrls.local[0].replace(/\/$/, '');
  }
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const vps = VIEWPORTS.filter(v => !want('vp').length || want('vp').some(k => v.name.includes(k)));
  const views = VIEWS.filter(v => !want('view').length || want('view').includes(v));
  const states = Object.keys(STATES).filter(s => !want('state').length || want('state').includes(s));
  const rows = []; let nFail = 0, nWarn = 0;

  for (const vp of vps) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e)));
    page.on('console', msg => { if (msg.type() === 'error' && !/favicon|Failed to load resource/.test(msg.text())) errors.push(msg.text()); });
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: +arg('dpr') || 1, hasTouch: vp.touch, isMobile: vp.touch });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.dev && !document.getElementById('enter').disabled, { timeout: 120000 });
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    if (coarse !== vp.touch) console.warn(`  ! ${vp.name}: pointer:coarse is ${coarse}, expected ${vp.touch}`);
    await page.click('#enter'); await sleep(1200);
    await page.evaluate(`(${installKit})()`);
    console.log(`\n== ${vp.name} ${vp.w}x${vp.h}`);
    for (const state of states) for (const view of views) {
      const id = `${vp.name}__${state.replace(/\+/g, '-')}__${view}`;
      let res;
      try {
        await page.evaluate(`(${STATES[state]})(window.__t)`);
        await page.evaluate(v => window.__t.view(v), view);
        await page.evaluate(n => window.__t.frames(n), +arg('frames') || 24);
        const m = await page.evaluate(`(${measure})()`);
        res = { m, ...check(m, vp, view, state) };
      } catch (e) { res = { m: null, fails: [`script error: ${e.message}`], warns: [] }; }
      await page.screenshot({ path: path.join(OUT, id + '.jpg'), type: 'jpeg', quality: 70 });
      const e = errors.splice(0); for (const x of e) res.fails.push('console error: ' + x.slice(0, 160));
      rows.push({ id, vp: vp.name, state, view, fails: res.fails, warns: res.warns });
      nFail += res.fails.length; nWarn += res.warns.length;
      console.log(`${res.fails.length ? 'FAIL' : res.warns.length ? 'warn' : 'ok  '} ${state} / ${view}${res.fails.length ? '\n      ' + res.fails.join('\n      ') : ''}${res.warns.length && !arg('quiet') ? '\n      (warn) ' + res.warns.join('\n      (warn) ') : ''}`);
    }
    await page.close();
  }
  await browser.close(); if (server) await server.close();

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ when: new Date().toISOString(), rows }, null, 1));
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const html = `<!doctype html><meta charset=utf-8><title>room ui hygiene</title><style>body{font:13px system-ui;background:#111;color:#eee;margin:16px}h2{margin:28px 0 8px}.g{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;width:230px}figure img{width:100%;border:3px solid #2a2;border-radius:6px;display:block}figure.f img{border-color:#e33}figure.w img{border-color:#ea3}figcaption{font:11px ui-monospace,monospace;margin-top:4px}li{margin:0}ul{padding-left:14px;margin:2px 0}</style><h1>room ui hygiene: ${nFail} fail, ${nWarn} warn</h1>` +
    vps.map(v => `<h2>${v.name}</h2><div class=g>` + rows.filter(r => r.vp === v.name).map(r => `<figure class="${r.fails.length ? 'f' : r.warns.length ? 'w' : ''}"><a href="${r.id}.jpg"><img src="${r.id}.jpg" loading=lazy></a><figcaption>${r.state} · ${r.view}<ul>${r.fails.map(x => `<li>✗ ${esc(x)}`).join('')}${r.warns.map(x => `<li>~ ${esc(x)}`).join('')}</ul></figcaption></figure>`).join('') + '</div>').join('');
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`\n${rows.length} shots · ${nFail} fail · ${nWarn} warn\nsheet: ${path.join(OUT, 'index.html')}`);
  process.exit(nFail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(2); });
