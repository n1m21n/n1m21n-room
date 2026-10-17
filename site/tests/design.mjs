// Design / brand suite: every HUD element in every UI state is checked against brand-rules.json
// (brand/brand_book.html direction B): fonts, palette, contrast, control chrome (2px ink border, hard shadow, pill),
// lowercase voice, glyphs, banned strings, truncated text, focus ring. Plus a static lint of the CSS in the source.
//   D1 static lint     D2 computed-style audit per state (phone + desktop)     D3 fonts load     D4 keyboard focus
//   npm run test:design [-- --state=card,deck]
import { start, openPage, reporter, run, want } from './lib/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';

const RULES = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'brand-rules.json'), 'utf8'));
const SRC = path.resolve(import.meta.dirname, '..');

// ---- in-page audit (serialised): returns violations for one state
function audit(R) {
  const out = [], seen = new Set();
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const pal = Object.entries(R.palette).map(([k, v]) => [k, hex(v)]);
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 4.42;     // 0..100
  const nearest = rgb => pal.map(([k, v]) => [k, dist(rgb, v)]).sort((a, b) => a[1] - b[1])[0];
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const desc = el => { const id = el.id ? '#' + el.id : ''; const c = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : ''; return (el.tagName.toLowerCase() + id + c).slice(0, 60); };
  const add = (level, el, rule, detail) => { const k = level + rule + desc(el) + detail; if (seen.has(k)) return; seen.add(k); out.push({ level, el: desc(el), rule, detail }); };
  const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && !el.closest('[hidden]'); };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.9) return c.rgb; } return null; };

  const roots = R.roots.flatMap(s => [...document.querySelectorAll(s)]).filter(visible);
  const els = new Set(); for (const r of roots) { els.add(r); r.querySelectorAll('*').forEach(e => els.add(e)); }
  for (const el of els) {
    if (!visible(el) || el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const s = getComputedStyle(el), own = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
    // ---- colour on the palette (borders, backgrounds, text, only when there is something painted)
    const paint = (prop, val, what) => {
      const c = parse(val); if (!c || c.a < 0.5) return;
      const [name, d] = nearest(c.rgb);
      if (d > R.colourTolerance.fail) add('FAIL', el, 'palette', `${what} ${val} is nowhere near the palette (nearest ${name}, ${d.toFixed(0)} off)`);
      else if (d > R.colourTolerance.warn) add('warn', el, 'palette', `${what} ${val} is off-palette (nearest ${name}, ${d.toFixed(0)} off)`);
    };
    if (own) paint('color', s.color, 'text');
    if (+s.borderTopWidth > 0 && s.borderTopStyle !== 'none') paint('border', s.borderTopColor, 'border');
    if (!(el.tagName === 'CANVAS')) paint('bg', s.backgroundColor, 'background');
    // ---- type
    if (own) {
      const fam = s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      if (!R.allowedFamilies.includes(fam)) add('FAIL', el, 'font', `uses "${fam}" (allowed: ${R.allowedFamilies.slice(0, 3).join(', ')})`);
      const px = parseFloat(s.fontSize); if (px > 0 && px < R.minFontPx) add('warn', el, 'size', `${px}px text is below ${R.minFontPx}px`);
      const bg = bgOf(el), fg = parse(s.color);
      if (bg && fg && fg.a > 0.5) { const k = ratio(fg.rgb, bg), big = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700); const need = big ? 3 : R.minContrast.warn;
        if (k < R.minContrast.fail) add('FAIL', el, 'contrast', `${k.toFixed(1)}:1 for "${own.slice(0, 24)}"`); else if (k < need) add('warn', el, 'contrast', `${k.toFixed(1)}:1 for "${own.slice(0, 24)}" (want ${need})`); }
      // ---- voice: lowercase UI, no banned strings, no stray glyphs
      for (const b of R.bannedText) if (own.toLowerCase().includes(b.toLowerCase())) add('FAIL', el, 'copy', `shows "${b}" in "${own.slice(0, 40)}"`);
      const words = own.split(/[\s/]+/).filter(w => /[A-Z]/.test(w));
      const ui = el.closest('button, .pill, #prompt, #toast, #stack, .chrome, #joy, #boot .guide') && !el.closest('#card, #thought, #tvp');   // owner copy / titles from the data keep their own case
      if (R.lowercaseUI && ui) for (const w of words) { if (!R.uppercaseOk.includes(w.replace(/[^\w.]/g, '')) && !el.matches('kbd')) add('warn', el, 'voice', `capital letters in UI text: "${w}" ("${own.slice(0, 40)}")`); }
      for (const ch of own) if (/\p{Extended_Pictographic}/u.test(ch) && !R.allowedGlyphs.includes(ch)) add('FAIL', el, 'glyph', `emoji / stray glyph "${ch}" in "${own.slice(0, 30)}"`);
      // ---- text that does not fit
      if (el.scrollWidth > el.clientWidth + 1 && s.overflowX !== 'visible' && s.overflowX !== 'auto' && s.overflowX !== 'scroll' && s.textOverflow !== 'ellipsis' && s.display !== 'inline') add('FAIL', el, 'clipped', `text "${own.slice(0, 30)}" is cut off (${el.scrollWidth} > ${el.clientWidth})`);
      if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) add('warn', el, 'truncated', `"${own.slice(0, 30)}" is ellipsised`);
    }
    // ---- control chrome: buttons and pills are paper, 2px ink border, hard offset shadow, round
    if (el.matches('button, .pill') && !el.closest('#tvp, #deck .dbody, .mini') && !el.matches('.vbtn, #cardx, .sleeve, .bk, .era') && visible(el)) {
      const bw = parseFloat(s.borderTopWidth), bc = parse(s.borderTopColor), r = el.getBoundingClientRect();
      if (bw !== R.control.borderPx) add('warn', el, 'chrome', `border ${bw}px (brand: ${R.control.borderPx}px ink)`);
      else if (bc && dist(bc.rgb, pal.find(p => p[0] === R.control.borderColour)[1]) > R.colourTolerance.warn) add('warn', el, 'chrome', `border colour ${s.borderTopColor} is not ink`);
      if (R.control.pillRadius && parseFloat(s.borderTopLeftRadius) < Math.min(r.width, r.height) / 2 - 1) add('warn', el, 'chrome', `corner radius ${s.borderTopLeftRadius} (brand: pill)`);
      const sh = s.boxShadow; if (R.control.hardShadowOnly && sh !== 'none' && /\d+px \d+px (\d+)px/.test(sh.replace(/rgba?\([^)]*\)/g, '')) && +(sh.replace(/rgba?\([^)]*\)/g, '').match(/-?\d+px -?\d+px (\d+)px/)?.[1] || 0) > 0) add('warn', el, 'chrome', `soft shadow "${sh.slice(0, 50)}" (brand: hard offset)`);
    }
  }
  return out;
}

run(async () => {
  const ctx = await start(), r = reporter('design'), only = want('state');
  const on = k => !only.length || only.includes(k);

  // ---------------------------------------------------------------- D1 static lint of the source
  r.section('D1 static lint (CSS in source)');
  const pal = Object.values(RULES.palette).map(h => h.toLowerCase());
  const files = ['index.html', ...fs.readdirSync(path.join(SRC, 'src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f)];
  const offHex = new Map(), fonts = new Set();
  for (const f of files) {
    const txt = fs.readFileSync(path.join(SRC, f), 'utf8');
    txt.split('\n').forEach((line, i) => {
      const css = /(background|color|border|shadow|outline|fill|stroke)\s*:/.test(line) && !/^\s*(\/\/|\*)/.test(line) && (f === 'index.html' || /['"`][^'"`]*:[^'"`]*;/.test(line));
      if (css) for (const h of line.match(/#[0-9a-fA-F]{6}\b/g) || []) if (!pal.includes(h.toLowerCase())) { const k = h.toLowerCase(); (offHex.get(k) || offHex.set(k, []).get(k)).push(`${f}:${i + 1}`); }
      for (const m of line.matchAll(/font(?:-family)?\s*:\s*[^;"'`]*?['"]([A-Za-z ]+)['"]/g)) fonts.add(m[1]);
    });
  }
  for (const f of fonts) r.expect(RULES.allowedFamilies.includes(f), 'D1', `font "${f}" is a brand font`, 'not in brand-rules.json allowedFamilies');
  for (const [h, at] of offHex) r.warn('D1', `off-palette colour ${h} used in ${at.slice(0, 3).join(', ')}${at.length > 3 ? ` (+${at.length - 3})` : ''}`);
  if (!offHex.size) r.ok('D1', 'every hex colour in UI CSS is on the palette');

  // ---------------------------------------------------------------- D2 computed-style audit per state
  const STATES = {
    boot: async () => {},                                                       // the loading screen (page opened with enter:false)
    room: async p => { await p.evaluate(() => window.__t?.reset()); },
    prompt: async p => { await p.evaluate(() => { const d = window.dev, P = d.player; window.__t.reset(); const s = d.stations.find(s => s.label === 'computer'); P.pos.set(s.p[0], 0, s.p[1]); d.man.root.position.set(s.p[0], 0, s.p[1]); P.st.heading = 0; }); },
    toast: async p => { await p.evaluate(() => { window.__t.reset(); window.dev.stations.find(s => s.label === 'pet the snake')?.act(); }); },
    deck: async p => { await p.evaluate(() => { window.__t.reset(); window.__t.deck(true); }); },
    crate: async p => { await p.evaluate(() => { window.__t.reset(); window.__t.act('records'); }); },
    timeline: async p => { await p.evaluate(() => { window.__t.reset(); window.__t.act('timeline'); }); },
    books: async p => { await p.evaluate(() => { window.__t.reset(); window.__t.act('books'); }); },
    help: async p => { await p.evaluate(() => { window.__t.reset(); document.getElementById('help').click(); }); },
    tv: async p => { await p.evaluate(() => { window.__t.reset(); window.__t.act('watch tv'); }); },
    thought: async p => { await p.evaluate(() => { window.__t.reset(); window.__t.act('look outside'); }); },
  };
  const PROFILES = [{ name: 'phone', w: 390, h: 844, dpr: 2, touch: true }, { name: 'desktop', w: 1280, h: 800, dpr: 1, touch: false }];
  for (const prof of PROFILES) {
    r.section(`D2 computed-style audit · ${prof.name}`);
    const { page, errors } = await openPage(ctx, prof, { enter: false });
    const kit = await import('./lib/kit.mjs'); await page.evaluate(`(${kit.installKit})()`);
    for (const [name, setup] of Object.entries(STATES)) {
      if (!on(name)) continue;
      if (name !== 'boot' && await page.evaluate(() => !document.getElementById('boot').hidden && getComputedStyle(document.getElementById('boot')).display !== 'none')) { await page.click('#enter'); await new Promise(res => setTimeout(res, 1300)); }
      await setup(page); await page.evaluate(n => window.__t.frames(n), 16);
      const v = await page.evaluate(`(${audit})(${JSON.stringify(RULES)})`);
      const fails = v.filter(x => x.level === 'FAIL'), warns = v.filter(x => x.level === 'warn');
      r.expect(!fails.length, `D2/${prof.name}`, `${name}: ${v.length ? `${fails.length} fail, ${warns.length} warn` : 'clean'}`, fails.slice(0, 4).map(x => `${x.el} [${x.rule}] ${x.detail}`).join(' | '));
      for (const f of fails.slice(4)) r.fail(`D2/${prof.name}`, `${name}: ${f.el} [${f.rule}] ${f.detail}`);
      const g = {}; for (const w of warns) (g[w.rule] ||= []).push(w);                  // one line per rule, with examples
      for (const [rule, ws] of Object.entries(g)) r.warn(`D2/${prof.name}`, `${name} [${rule}] x${ws.length}: ${ws.slice(0, 3).map(w => `${w.el} ${w.detail}`).join(' | ')}`);
    }
    // ---------------------------------------------------------------- D3 fonts / D4 focus
    if (prof.name === 'desktop') {
      r.section('D3 brand fonts are loaded');
      const loaded = await page.evaluate(async () => { await document.fonts.ready; return { display: document.fonts.check("800 20px 'Bricolage Grotesque'"), mono: document.fonts.check("400 12px 'DM Mono'"), n: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family) }; });
      r.expect(loaded.display, 'D3', 'Bricolage Grotesque 800 loaded', 'falls back to the system face (offline, or the font URL changed)');
      r.expect(loaded.mono, 'D3', 'DM Mono 400 loaded', 'falls back to monospace');
      r.section('D4 keyboard focus is visible');
      const foc = await page.evaluate(async () => {
        const rows = []; document.getElementById('boot')?.hidden || 0;
        const btns = [...document.querySelectorAll('.chrome button, #prompt, #deck button')].filter(b => b.offsetParent);
        for (const b of btns) { b.focus({ focusVisible: true }); const s = getComputedStyle(b); rows.push({ el: b.id || b.className || b.tagName, ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== 'none' }); }
        return rows;
      });
      for (const f of foc) r.expect(f.ring, 'D4', `${f.el}: has a focus ring`, 'outline is none on :focus-visible (keyboard users cannot see where they are)');
    }
    r.expect(errors.length === 0, 'run', `${prof.name}: no console errors`, [...new Set(errors)].slice(0, 4).join(' | '));
    await page.close();
  }
  await ctx.close();
  return r.finish();
});
