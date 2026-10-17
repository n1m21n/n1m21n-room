// Shared plumbing for the test suites: a dev server (or --url), headless Chrome, a page with the game booted and
// console / network errors collected, and a small reporter (ok / warn / FAIL, report.json, exit code).
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const OUT = path.resolve(ROOT, '../build-cache/review/tests');
export const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const arg = (k, d = '') => (process.argv.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=').slice(1).join('=');
export const want = k => arg(k).split(',').filter(Boolean);
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// profiles: real device sizes and input kinds (touch => isMobile, pointer: coarse)
export const DEVICES = [
  { name: 'iphone-se', w: 375, h: 667, dpr: 2, touch: true },
  { name: 'iphone-15', w: 393, h: 852, dpr: 3, touch: true },
  { name: 'pixel-small', w: 360, h: 640, dpr: 2, touch: true },
  { name: 'phone-landscape', w: 844, h: 390, dpr: 2, touch: true },
  { name: 'ipad-portrait', w: 768, h: 1024, dpr: 2, touch: true },
  { name: 'ipad-landscape', w: 1024, h: 768, dpr: 2, touch: true },
  { name: 'laptop-small', w: 1024, h: 600, dpr: 1, touch: false },
  { name: 'laptop', w: 1440, h: 900, dpr: 2, touch: false },
  { name: 'desktop-fhd', w: 1920, h: 1080, dpr: 1, touch: false },
  { name: 'ultrawide', w: 2560, h: 1080, dpr: 1, touch: false },
];

export async function start() {
  let server = null, url = arg('url');
  if (!url) {
    server = await createServer({ root: ROOT, server: { port: 5190, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
    await server.listen(); url = server.resolvedUrls.local[0].replace(/\/$/, '');
  }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 400000, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  return { url, browser, close: async () => { await browser.close(); if (server) await server.close(); } };
}

// a booted page: { page, errors[] }. errors = uncaught exceptions, console.error, failed / 4xx / 5xx requests
export async function openPage(ctx, dev = { w: 1280, h: 800, dpr: 1, touch: false }, { enter = true, query = '', before = null } = {}) {
  const page = await ctx.browser.newPage(), errors = [];
  if (before) await before(page);
  page.on('pageerror', e => errors.push('exception: ' + String(e.message || e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
  page.on('requestfailed', r => { if (!/fonts\.g|favicon/.test(r.url()) && !/ABORTED/.test(r.failure()?.errorText || '')) errors.push('request failed: ' + r.url().slice(0, 120)); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url().slice(0, 120)}`); });
  await page.setViewport({ width: dev.w, height: dev.h, deviceScaleFactor: dev.dpr || 1, hasTouch: !!dev.touch, isMobile: !!dev.touch });
  await page.goto(ctx.url + query, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.dev && !document.getElementById('enter')?.disabled, { timeout: 120000 })
    .catch(e => { throw new Error('page never booted: ' + ([...new Set(errors)].slice(0, 4).join(' | ') || e.message)); });   // say why
  if (enter) { await page.click('#enter'); await sleep(1200); }
  return { page, errors };
}

export function reporter(suite) {
  const rows = []; let nf = 0, nw = 0;
  const log = (kind, group, msg) => {
    rows.push({ kind, group, msg });
    if (kind === 'FAIL') nf++; else if (kind === 'warn') nw++;
    if (kind !== 'ok' || arg('verbose')) console.log(`${kind === 'ok' ? 'ok  ' : kind} [${group}] ${msg}`);
  };
  return {
    ok: (g, m) => log('ok', g, m), warn: (g, m) => log('warn', g, m), fail: (g, m) => log('FAIL', g, m),
    expect(cond, g, m, detail = '') { log(cond ? 'ok' : 'FAIL', g, m + (cond || !detail ? '' : ' - ' + detail)); return cond; },
    section: t => console.log(`\n== ${t}`),
    finish() {
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, suite + '.json'), JSON.stringify({ suite, when: new Date().toISOString(), fail: nf, warn: nw, rows }, null, 1));
      console.log(`\n${suite}: ${rows.length} checks · ${nf} fail · ${nw} warn`);
      return nf;
    },
  };
}
export const run = main => main().then(code => process.exit(code ? 1 : 0)).catch(e => { console.error(e); process.exit(2); });
