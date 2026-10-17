// Health suite: does the whole thing behave, stay stable and degrade gracefully?
//   H1 cold boot        no errors, time to ready, three.js warnings
//   H2 every station    act, state is sane, cleanup returns to a clean idle (no stuck card / seat / freeze)
//   H3 mash             300 random keys / clicks / wheels / resizes, then every invariant still holds
//   H4 leaks            open / close every card, sit / stand, 15x: GPU resources, DOM nodes and JS heap stay flat
//   H5 render budget    draw calls + triangles in each camera view
//   H6 accessibility    names on controls, tab order, aria-live, reduced motion
//   H7 time of day      boot at 3 am / 9 am / 3 pm / 9 pm IST: lit, coloured, no errors
//   H8 resilience       media blocked (offline CDN), WebGL context lost + restored
//   H9 station music    the keys play the midi piece (Clair de Lune), notes keep coming, stop when he gets up
//   npm run test:health [-- --only=H3,H4] [-- --quick]
import { start, openPage, reporter, run, want, arg, sleep } from './lib/harness.mjs';

const until = async (page, fn, a, ms = 10000) => { const t0 = Date.now(); for (;;) { const v = await page.evaluate(fn, a); if (v || Date.now() - t0 > ms) return v; await sleep(120); } };
const invariants = () => {                       // returns a list of broken invariants (runs in the page)
  const d = window.dev, P = d.player, bad = [], $ = id => document.getElementById(id);
  if (![P.pos.x, P.pos.z, d.camera.position.x, d.camera.position.y, d.camera.position.z].every(isFinite)) bad.push('NaN position / camera');
  const dbox = new Set(d.doors.all.flatMap(x => x.boxes));
  for (const b of d.solids) if (!dbox.has(b)) { const dx = P.pos.x - Math.max(b[0], Math.min(P.pos.x, b[2])), dz = P.pos.z - Math.max(b[1], Math.min(P.pos.z, b[3])); if (!P.st.seated && Math.hypot(dx, dz) < 0.12) { bad.push('standing inside a solid'); break; } }
  if (document.querySelectorAll('#card:not([hidden])').length > 1) bad.push('two cards open');
  if (Math.abs(d.man.root.position.y) > 0.5 && !P.st.seated) bad.push('man floating / sunk (y=' + d.man.root.position.y.toFixed(2) + ')');
  if (!P.st.seated && Math.abs(d.man.root.rotation.x) > 0.01) bad.push('man lying down while standing');
  if (document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight) bad.push('page scrolls');
  if (P.st.frozen) bad.push('controls frozen');
  if (!$('boot').hidden && getComputedStyle($('boot')).display !== 'none') bad.push('boot screen is back');
  return bad;
};
const clean = () => {                            // cleanup + wait target: everything back to idle
  const P = window.dev.player; if (!document.getElementById('card').hidden) document.getElementById('cardx')?.click(); if (P.st.seated) P.stand(); P.cancelAuto(); P.keys.clear();
};

run(async () => {
  const ctx = await start(), r = reporter('health'), only = want('only'), quick = !!arg('quick');
  const on = k => !only.length || only.includes(k);
  const D = { w: 1280, h: 800, dpr: 1, touch: false };

  // ---------------------------------------------------------------- H1
  let t0 = Date.now(), warnings = [];
  const { page, errors } = await openPage(ctx, D, { before: p => { p.on('console', m => { if (m.type() === 'warning') warnings.push(m.text().slice(0, 140)); }); } });
  if (on('H1')) {
    r.section('H1 cold boot');
    r.expect(true, 'H1', `ready in ${((Date.now() - t0) / 1000).toFixed(1)} s (software rendering; a real GPU is several times faster)`);
    r.expect(errors.length === 0, 'H1', 'no errors during boot', [...new Set(errors)].slice(0, 4).join(' | '));
    const w = [...new Set(warnings.filter(x => !/GPU stall|ReadPixels|swiftshader|deprecated/i.test(x)))];
    r.expect(w.length === 0, 'H1', 'no console warnings (three.js shader / texture / deprecation)', w.slice(0, 3).join(' | '));
    const b = await page.evaluate(invariants); r.expect(!b.length, 'H1', 'invariants hold on arrival', b.join('; '));
  }
  await page.evaluate(() => { window.__log = []; const P = window.dev.player; P.st.frozen = false; });

  // ---------------------------------------------------------------- H2
  if (on('H2')) {
    r.section('H2 every station');
    const labels = await page.evaluate(() => window.dev.stations.map((s, i) => ({ i, label: typeof s.label === 'string' ? s.label : '(door)', frame: !!s.frame, live: !!s.live, direct: !!s.direct })));
    const uniq = new Map(); for (const s of labels) { const k = s.label + (s.frame ? '#frame' : ''); if (!uniq.has(k)) uniq.set(k, s); }
    for (const s of uniq.values()) {
      const e0 = errors.length;
      const res = await page.evaluate(async i => {
        const d = window.dev, P = d.player, st = d.stations[i], $ = id => document.getElementById(id), out = {};
        clean_(); P.pos.set(st.p[0], 0, st.p[1]); d.man.root.position.set(st.p[0], 0, st.p[1]);
        function clean_() { if (!$('card').hidden) $('cardx')?.click(); if (P.st.seated) P.stand(); P.cancelAuto(); P.keys.clear(); }
        try { if (st.seat === d.reading.READ) d.reading.READ.book ||= { title: 'test' }; st.act(); } catch (e) { return { threw: e.message }; }
        await new Promise(r => setTimeout(r, 900));
        out.card = !$('card').hidden; out.seated = !!P.st.seated; out.toast = !$('toast').hidden; out.deck = !$('deck').classList.contains('mini'); out.walking = !!P.auto.pts; out.tv = !$('tvp').hidden;
        clean_(); await new Promise(r => setTimeout(r, 400));
        out.after = { card: !$('card').hidden, seated: !!P.st.seated };
        return out;
      }, s.i);
      if (res.threw) { r.fail('H2', `${s.label}: act() threw ${res.threw}`); continue; }
      const did = res.card || res.seated || res.toast || res.deck || res.walking || res.tv;
      r.expect(did, 'H2', `${s.label}: acting does something (${Object.entries(res).filter(([k, v]) => v === true).map(([k]) => k).join(', ')})`, 'no card, seat, toast, deck, walk or tv reaction');
      r.expect(!res.after.card && !res.after.seated, 'H2', `${s.label}: cleans up to idle`, JSON.stringify(res.after));
      if (errors.length > e0) r.fail('H2', `${s.label}: errors while acting: ${errors.slice(e0).join(' | ').slice(0, 200)}`);
    }
    const b = await page.evaluate(() => { const P = window.dev.player; if (P.st.seated) P.stand(); P.st.frozen = false; return 0; });
  }

  // ---------------------------------------------------------------- H9
  if (on('H9')) {
    r.section('H9 station music');
    const o = await page.evaluate(async () => {
      const d = window.dev, P = d.player, st = d.stations.find(s => s.seat?.act === 'keys'), S = d.sfx, piano = () => S.heard.filter(h => h === 'piano').length;
      if (!st) return { none: true };
      if (P.st.seated) P.stand(); P.pos.set(st.p[0], 0, st.p[1]); st.act();
      const t0 = performance.now(); while (!P.st.seated && performance.now() - t0 < 15000) await new Promise(r => setTimeout(r, 200));
      const a = piano(); await new Promise(r => setTimeout(r, 6000)); const b = piano();
      const out = { state: S.state, seated: !!P.st.seated, notes: S.song?.notes?.length || 0, played: b - a };
      P.stand(); await new Promise(r => setTimeout(r, 800)); const c = piano(); await new Promise(r => setTimeout(r, 1500));
      out.after = piano() - c; return out;
    });
    if (o.none) r.fail('H9', 'no keys station');
    else if (o.state !== 'running') r.warn('H9', `audio context ${o.state}: cannot hear the keys here`);
    else {
      r.expect(o.notes > 500, 'H9', `midi loaded: ${o.notes} notes`, JSON.stringify(o));
      r.expect(o.played >= 8, 'H9', `keys play the piece: ${o.played} notes in 6 s`, JSON.stringify(o));
      r.expect(o.after === 0, 'H9', 'music stops when he gets up', JSON.stringify(o));
    }
  }

  // ---------------------------------------------------------------- H3
  if (on('H3')) {
    r.section('H3 mash: random keys / clicks / wheel / resize');
    await page.evaluate(() => { const d = window.dev, P = d.player; if (!document.getElementById('card').hidden) document.getElementById('cardx').click(); if (P.st.seated) P.stand(); P.pos.set(0.3, 0, 1.2); d.man.root.position.set(0.3, 0, 1.2); });
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'KeyE', 'Enter', 'KeyV', 'KeyC', 'KeyM', 'Escape', 'Space', 'ShiftLeft', 'Tab', 'KeyQ'];
    await page.evaluate(() => { window.open = () => null; document.addEventListener('click', e => { const a = e.target.closest?.('a[href]'); if (a && !a.href.startsWith(location.origin)) e.preventDefault(); }, true); });
    const e0 = errors.length, N = quick ? 120 : 300;
    for (let i = 0; i < N; i++) {
      const o = rnd();
      if (process.env.H3LOG) { const ok = await Promise.race([page.evaluate(() => 1), sleep(8000).then(() => 0)]); console.log(i, o.toFixed(2), ok ? 'ok' : 'PAGE HUNG', await page.evaluate(() => 0).catch(() => '')); if (!ok) break; }
      try {
        if (o < 0.4) { const k = KEYS[Math.floor(rnd() * KEYS.length)]; await page.keyboard.down(k); await sleep(rnd() * 120); await page.keyboard.up(k); }
        else if (o < 0.7) { await page.mouse.click(rnd() * 1280, rnd() * 800); }
        else if (o < 0.8) { await page.mouse.move(rnd() * 1280, rnd() * 800); await page.mouse.wheel({ deltaY: (rnd() - 0.5) * 1200 }); }
        else if (o < 0.9) { await page.mouse.move(rnd() * 1280, rnd() * 800); await page.mouse.down(); await page.mouse.move(rnd() * 1280, rnd() * 800, { steps: 3 }); await page.mouse.up(); }
        else if (o < 0.95) { await page.evaluate(() => document.querySelectorAll('button')[Math.floor(Math.random() * document.querySelectorAll('button').length)]?.click()); }
        else { await page.setViewport({ width: 600 + Math.floor(rnd() * 900), height: 400 + Math.floor(rnd() * 500), deviceScaleFactor: 1 }); }
      } catch (e) { if (/timed out/.test(e.message)) { await sleep(2000); continue; } r.fail('H3', `input ${i} threw: ${e.message.slice(0, 80)}`); break; }
    }
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 }); await sleep(800);
    await page.evaluate(clean); await sleep(600);
    // everything must still answer after the abuse
    const b = await page.evaluate(invariants); r.expect(!b.length, 'H3', `${N} random inputs later: invariants hold`, b.join('; '));
    await page.evaluate(() => { const d = window.dev, P = d.player; P.pos.set(0.3, 0, 1.2); d.man.root.position.set(0.3, 0, 1.2); P.st.speed = 0; });
    const a = await page.evaluate(() => ({ x: window.dev.player.pos.x, z: window.dev.player.pos.z }));
    await page.keyboard.down('KeyS'); const mv = await until(page, a => Math.hypot(window.dev.player.pos.x - a.x, window.dev.player.pos.z - a.z) > 0.1, a, 15000); await page.keyboard.up('KeyS');
    r.expect(mv, 'H3', 'he still walks afterwards', 'controls are dead after the mash');
    const fresh = errors.slice(e0).filter(x => x.startsWith('exception'));
    r.expect(!fresh.length, 'H3', 'no uncaught exceptions', fresh.slice(0, 3).join(' | '));
  }

  // ---------------------------------------------------------------- H4
  if (on('H4')) {
    r.section('H4 leaks');
    const snap = () => page.evaluate(() => { window.gc?.(); const i = window.dev.renderer.info; return { geo: i.memory.geometries, tex: i.memory.textures, nodes: document.getElementsByTagName('*').length, heap: performance.memory.usedJSHeapSize / 1e6, progs: i.programs?.length || 0 }; });
    const cycle = () => page.evaluate(async () => {
      const d = window.dev, P = d.player, $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
      for (const l of ['records', 'timeline', 'books', 'watch tv', 'computer', 'play keys', 'look outside']) {
        const s = d.stations.find(s => s.label === l && !s.frame); if (!s) continue;
        P.pos.set(s.p[0], 0, s.p[1]); s.act(); await wait(120);
        if (!$('card').hidden) $('cardx')?.click(); if (P.st.seated) P.stand(); await wait(60);
      }
      $('help').click(); await wait(80); if (!$('card').hidden) $('cardx')?.click();
    });
    await page.evaluate(clean); await cycle(); await cycle(); await sleep(500);          // warm-up: lazy loads, first-use textures
    const a = await snap(); const N = quick ? 6 : 15; for (let i = 0; i < N; i++) await cycle(); await page.evaluate(clean); await sleep(800); const b = await snap();
    r.expect(b.geo - a.geo <= 3, 'H4', `GPU geometries ${a.geo} -> ${b.geo} after ${N} cycles`, 'geometries are created and never disposed');
    r.expect(b.tex - a.tex <= 3, 'H4', `GPU textures ${a.tex} -> ${b.tex}`, 'textures are created and never disposed');
    r.expect(b.nodes - a.nodes <= 60, 'H4', `DOM nodes ${a.nodes} -> ${b.nodes}`, 'cards leave nodes behind');
    r.expect(b.heap - a.heap <= 25, 'H4', `JS heap ${a.heap.toFixed(0)} -> ${b.heap.toFixed(0)} MB`, 'heap keeps growing');
  }

  // ---------------------------------------------------------------- H5
  if (on('H5')) {
    r.section('H5 render budget');
    for (const view of ['third', 'first', 'top']) {
      const o = await page.evaluate(async view => { const d = window.dev, P = d.player; if (P.st.seated) P.stand(); P.pos.set(0.3, 0, 1.2); while (P.st.view !== view) P.cycleView(); await new Promise(r => setTimeout(r, 600));
        d.renderer.info.autoReset = false; d.renderer.info.reset(); d.render(); const i = d.renderer.info; const out = { calls: i.render.calls, tris: i.render.triangles, geo: i.memory.geometries, tex: i.memory.textures }; d.renderer.info.autoReset = true; return out; }, view);
      r.ok('H5', `${view}: ${o.calls} draw calls, ${(o.tris / 1000).toFixed(0)}k triangles, ${o.geo} geometries, ${o.tex} textures`);
      if (o.calls > 1200) r.warn('H5', `${view}: ${o.calls} draw calls (4-pass toon compositor included): budget 1200 for mid phones`);
      if (o.tris > 1.5e6) r.warn('H5', `${view}: ${(o.tris / 1e6).toFixed(1)}M triangles: budget 1.5M`);
    }
    await page.evaluate(() => { const P = window.dev.player; while (P.st.view !== 'third') P.cycleView(); });
  }

  // ---------------------------------------------------------------- H6
  if (on('H6')) {
    r.section('H6 accessibility');
    const a = await page.evaluate(() => {
      const name = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
      const btns = [...document.querySelectorAll('button, [role=button], a[href]')].filter(b => b.offsetParent || b.closest('#card'));
      return { unnamed: btns.filter(b => !name(b) && !b.querySelector('img[alt]')).map(b => b.id || b.className || b.tagName).slice(0, 8), nBtns: btns.length,
        noAlt: [...document.images].filter(i => i.alt === null || (!i.hasAttribute('alt'))).length, live: !!document.querySelector('[aria-live]'), canvasLabel: !!document.querySelector('canvas')?.getAttribute('aria-label'),
        css: [...document.querySelectorAll('style')].some(s => /prefers-reduced-motion/.test(s.textContent)), lang: document.documentElement.lang, h1: !!document.querySelector('h1') };
    });
    r.expect(!a.unnamed.length, 'H6', `${a.nBtns} controls all have an accessible name`, 'unnamed: ' + a.unnamed.join(', '));
    r.expect(a.noAlt === 0, 'H6', 'every <img> has alt', `${a.noAlt} images without alt`);
    if (!a.live) r.warn('H6', 'toast / prompt have no aria-live region: screen readers never hear "he is asleep" etc.');
    if (!a.canvasLabel) r.warn('H6', 'the 3D canvas has no aria-label / role="img" description');
    if (!a.css) r.warn('H6', 'no prefers-reduced-motion rule anywhere in the CSS (spinning vinyl, drops, pulses)');
    // tab order reaches the chrome controls, in reading order
    // start from the top of the page, as a keyboard user does on load (blur alone keeps the start point inside an open card)
    await page.evaluate(() => { document.activeElement?.blur(); const b = document.body; b.tabIndex = -1; b.focus(); b.removeAttribute('tabindex'); }); const order = [];
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement?.id || (document.activeElement?.tagName === "A" && "A@" + (document.activeElement.closest("[id]")?.id || "") + ":" + document.activeElement.textContent.slice(0, 12)) || document.activeElement?.className?.toString().slice(0, 14) || document.activeElement?.tagName)); }
    r.expect(['help', 'snd', 'view'].every(k => order.includes(k)), 'H6', `Tab reaches help / sound / view (${order.join(' > ')})`, 'a chrome control is unreachable by keyboard');
    await page.evaluate(() => document.activeElement?.blur());
  }
  const finalErr = errors.filter(x => x.startsWith('exception'));
  r.expect(!finalErr.length, 'run', 'no uncaught exceptions across H1-H6', [...new Set(finalErr)].slice(0, 3).join(' | '));
  await page.close();

  // ---------------------------------------------------------------- H7
  if (on('H7') && !quick) {
    r.section('H7 time of day (IST)');
    for (const hour of [3, 9, 15, 21]) {
      const before = async p => p.evaluateOnNewDocument(h => { const real = Date.now.bind(Date), base = new Date(); const target = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, 0) - 5.5 * 3600e3; const off = target - real(); Date.now = () => real() + off; const R = Date; globalThis.Date = class extends R { constructor(...a) { a.length ? super(...a) : super(R.now() + off); } static now() { return R.now() + off; } }; }, hour);
      const { page: p, errors: er } = await openPage(ctx, D, { before });
      const px = await p.evaluate(async () => { const d = window.dev; await new Promise(r => setTimeout(r, 800)); d.render(); const c = d.renderer.domElement, s = document.createElement('canvas'); s.width = 64; s.height = 40; const x = s.getContext('2d'); x.drawImage(c, 0, 0, 64, 40); const D = x.getImageData(0, 0, 64, 40).data; let L = 0, n = 0, set = new Set(); for (let i = 0; i < D.length; i += 4) { L += (0.2126 * D[i] + 0.7152 * D[i + 1] + 0.0722 * D[i + 2]) / 255; n++; set.add((D[i] >> 5) + ',' + (D[i + 1] >> 5) + ',' + (D[i + 2] >> 5)); } return { lum: L / n, colours: set.size, said: document.getElementById('toast').textContent, seated: !!d.player.st.seated, lamp: d.scene.getObjectByName('lamp')?.visible, hour: new Date().getUTCHours() + 5.5 }; });
      r.expect(px.lum > 0.04 && px.lum < 0.85, 'H7', `${String(hour).padStart(2, '0')}:00 IST: picture is lit (mean luminance ${px.lum.toFixed(2)}, ${px.colours} colours)`, 'black or blown out');
      r.expect(px.colours >= 8, 'H7', `${String(hour).padStart(2, '0')}:00: not a flat frame`, `${px.colours} colours`);
      r.expect(er.filter(x => x.startsWith('exception')).length === 0, 'H7', `${String(hour).padStart(2, '0')}:00: no exceptions`, er.slice(0, 2).join(' | '));
      await p.close();
    }
  }

  // ---------------------------------------------------------------- H8
  if (on('H8')) {
    r.section('H8 resilience');
    { // media blocked: the CDN is down
      const { page: p, errors: er } = await openPage(ctx, D, { enter: false, before: async p => { await p.setRequestInterception(true); p.on('request', q => (/\/media\/(audio|art|covers|books|films)\//.test(q.url()) ? q.abort('failed') : q.continue())); } });
      await p.click('#enter').catch(() => {}); await sleep(1500);
      const res = await p.evaluate(async () => { const d = window.dev, $ = id => document.getElementById(id), out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
        try { document.getElementById('dplay')?.click(); await wait(500); d.stations.find(s => s.label === 'records')?.act(); await wait(500); out.cardOpen = !$('card').hidden; $('cardx')?.click();
          d.stations.find(s => s.label === 'books')?.act(); await wait(400); $('cardx')?.click(); d.stations.find(s => s.label === 'watch tv')?.act(); await wait(400); } catch (e) { out.threw = e.message; }
        d.render(); out.alive = true; return out; });
      r.expect(!res.threw, 'H8', 'media blocked: records / books / tv / play do not throw', res.threw);
      r.expect(er.filter(x => x.startsWith('exception')).length === 0, 'H8', 'media blocked: no uncaught exceptions', er.filter(x => x.startsWith('exception')).slice(0, 2).join(' | '));
      await p.close();
    }
    { // context loss and restore
      const { page: p, errors: er } = await openPage(ctx, D);
      const lost = await p.evaluate(async () => { const gl = window.dev.renderer.getContext(), ext = gl.getExtension('WEBGL_lose_context'); if (!ext) return { skip: true };
        ext.loseContext(); await new Promise(r => setTimeout(r, 600)); const during = gl.isContextLost(); ext.restoreContext(); await new Promise(r => setTimeout(r, 2500));
        let n = 0; await new Promise(res => { const f = () => (++n >= 5 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }); window.dev.render();
        const c = document.createElement('canvas'); c.width = 32; c.height = 20; const x = c.getContext('2d'); x.drawImage(window.dev.renderer.domElement, 0, 0, 32, 20); const D = x.getImageData(0, 0, 32, 20).data; let s = 0; for (let i = 0; i < D.length; i += 4) s += D[i] + D[i + 1] + D[i + 2];
        return { during, after: gl.isContextLost(), painted: s > 200 }; });
      if (lost.skip) r.warn('H8', 'WEBGL_lose_context unavailable here');
      else { r.expect(!lost.after, 'H8', 'WebGL context restores after a loss (phones do this when the tab sleeps)', 'still lost'); r.expect(lost.painted, 'H8', 'picture is back after the context restores', 'the canvas stays black / blank: add a webglcontextrestored handler to rebuild render targets'); }
      r.expect(er.filter(x => x.startsWith('exception')).length === 0, 'H8', 'no uncaught exceptions around context loss', er.filter(x => x.startsWith('exception')).slice(0, 2).join(' | '));
      await p.close();
    }
  }
  await ctx.close();
  return r.finish();
});
