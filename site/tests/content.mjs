// Content + build suite (no browser; seconds). The data is the product, so it is tested like code.
//   C1 references   every media path in public/data/*.json exists on disk
//   C2 schema       required fields, https links, ISO dates, unique ids, sane lengths
//   C3 copy         no placeholder / double-space / untrimmed text; thoughts fit the bubble
//   C4 budgets      per-file 25 MB (Cloudflare Pages), first-load payload from a real vite build (brief: < 4 MB)
//   C5 meta         title, description, icons, social card in index.html
//   C6 links        (--net) every external URL answers (404 / DNS failures fail; 403 / 429 / 999 only warn)
//   npm run test:content [-- --build] [-- --net]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { reporter, run, arg, ROOT } from './lib/harness.mjs';

const PUB = path.join(ROOT, 'public'), DATA = path.join(PUB, 'data');
const J = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const exists = rel => rel && fs.existsSync(path.join(PUB, rel.replace(/^\//, '')));
const BAD = /\b(undefined|null|NaN|lorem|todo|tbd|untitled|xxx)\b|\{\{|\[object/i;

run(async () => {
  const r = reporter('content');
  const music = J('music.json'), art = J('art.json'), books = J('books.json'), films = J('films.json'), links = J('links.json'), thoughts = J('thoughts.json');
  const urls = new Map();   // url -> where
  const url = (u, where) => { if (!u) return; urls.set(u, where); };

  // ------------------------------------------------------------ C1 + C2
  r.section('C1/C2 music');
  const ids = new Set();
  for (const a of music.albums) {
    const g = `music/${a.id}`;
    r.expect(a.id && !ids.has(a.id), g, `unique id`, 'duplicate or missing id'); ids.add(a.id);
    r.expect(a.title?.trim(), g, 'has a title');
    r.expect(/^\d{4}-\d{2}-\d{2}$/.test(a.released) && !isNaN(Date.parse(a.released)), g, `release date ${a.released} is a real date`);
    for (const [k, p] of Object.entries(a.cover || {})) r.expect(exists(p), g, `cover ${k}px exists`, p);
    r.expect(Object.keys(a.cover || {}).length > 0, g, 'has a cover');
    for (const [k, u] of Object.entries(a.links || {})) { r.expect(/^https:\/\//.test(u), g, `${k} link is https`, u); url(u, g + ' ' + k); }
    r.expect(a.tracks?.length > 0, g, `${a.tracks?.length} tracks`);
    (a.tracks || []).forEach((t, i) => {
      const w = `${g}/${t.n}`;
      if (t.n !== i + 1) r.fail(g, `track numbering gap at ${i + 1} (n=${t.n})`);
      if (!t.title?.trim()) r.fail(w, 'track has no title');
      if (!exists(t.src)) r.fail(w, `audio missing: ${t.src}`);
      if (!(t.dur > 5 && t.dur < 3600)) r.fail(w, `duration ${t.dur}s is implausible`);
      for (const u of Object.values(t.links || {})) { if (!/^https:\/\//.test(u)) r.fail(w, 'track link not https: ' + u); url(u, w); }
    });
  }
  r.section('C1/C2 art halls');
  for (const h of art.halls) {
    const seen = new Set();
    for (const w of h.works) {
      const g = `art/${h.id}/${w.id}`;
      if (seen.has(w.id)) r.fail(g, 'duplicate work id'); seen.add(w.id);
      if (!exists(w.img)) r.fail(g, `image missing: ${w.img}`);
      if (w.video && !exists(w.video)) r.fail(g, `video missing: ${w.video}`);
      if (!(w.w > 0 && w.h > 0)) r.fail(g, `bad size ${w.w}x${w.h}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date)) r.fail(g, `bad date ${w.date}`);
      if (w.url && !/^https:\/\/(www\.)?instagram\.com\//.test(w.url)) r.warn(g, `link is not instagram: ${w.url}`); url(w.url, g);
    }
    r.ok(`art/${h.id}`, `${h.works.length} works checked`);
  }
  r.section('C1/C2 books, films, links');
  for (const b of books.books) { const g = `books/${b.id}`; if (!b.title || !b.author) r.fail(g, 'missing title / author'); if (b.id !== 'unreleased' && !exists(b.cover)) r.fail(g, `cover missing: ${b.cover}`); }   // unreleased: teaser only, no file
  for (const f of films.films) { const g = `films/${f.id}`; if (!f.title || !(f.year > 1900 && f.year <= 2027)) r.fail(g, `bad title / year (${f.title} ${f.year})`); if (!exists(f.poster)) r.fail(g, `poster missing: ${f.poster}`); }
  r.ok('books', `${books.books.length} books, ${films.films.length} films checked`);
  for (const s of links.socials) { r.expect(/^https:\/\//.test(s.url) && s.label, `social/${s.id}`, `${s.label}`, 'needs a label and an https url'); url(s.url, 'social ' + s.id); }
  for (const t of links.timeline) { r.expect(t.label && t.from <= (t.to ?? t.from), `timeline/${t.label}`, `${t.from}${t.to ? '-' + t.to : ''} ${t.label}`, 'bad span'); url(t.url, 'timeline ' + t.label); }
  for (const s of links.software) url(s.url, 'software ' + s.id);
  const tl = links.timeline.map(t => t.from); r.expect(tl.every((v, i) => !i || v >= tl[i - 1]), 'timeline', 'is in chronological order', tl.join(','));

  // ------------------------------------------------------------ C3 copy
  r.section('C3 copy');
  const texts = [];
  thoughts.thoughts.forEach((t, i) => texts.push([`thought#${i}`, t.text]));
  for (const a of music.albums) { texts.push([`album ${a.id}`, a.title]); a.tracks.forEach(t => texts.push([`track ${a.id}/${t.n}`, t.title])); }
  for (const h of art.halls) { texts.push([`hall ${h.id}`, h.title]); h.works.forEach(w => w.caption && texts.push([`caption ${w.id}`, w.caption, true])); }
  books.books.filter(b => b.id !== 'unreleased').forEach(b => texts.push([`book ${b.id}`, b.title + ' ' + b.author]));   // the owner's own book is deliberately 'untitled' films.films.forEach(f => texts.push([`film ${f.id}`, f.title]));
  links.timeline.forEach(t => texts.push(['timeline ' + t.label, t.label]));
  let nbad = 0;
  for (const [where, t, raw] of texts) {     // raw = Instagram captions, shown as written: only the machine-fault checks apply
    const why = BAD.test(t) ? 'placeholder text' : raw ? '' : /  /.test(t) ? 'double space' : t !== t.trim() ? 'untrimmed' : /\s[,.;:!?]/.test(t) ? 'space before punctuation' : /[\u0000-\u0008\u000b-\u001f]/.test(t) ? 'control character' : /[�]/.test(t) ? 'broken encoding' : '';
    if (why) { r.fail('C3', `${where}: ${why}: "${t.slice(0, 50)}"`); nbad++; }
  }
  if (!nbad) r.ok('C3', `${texts.length} strings clean`);
  const seenT = new Map();
  thoughts.thoughts.forEach((t, i) => {
    const k = t.text.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seenT.has(k)) r.fail('thoughts', `#${i} duplicates #${seenT.get(k)}: "${t.text.slice(0, 40)}"`); seenT.set(k, i);
    if (t.text.length > 220) r.warn('thoughts', `#${i} is ${t.text.length} characters: the bubble grows tall on a phone`);
    if (!['any', 'day', 'night', 'late'].includes(t.when)) r.fail('thoughts', `#${i} has when="${t.when}"`);
  });
  for (const w of ['any', 'day', 'night', 'late']) r.expect(thoughts.thoughts.filter(t => t.when === w).length >= 5, 'thoughts', `at least 5 thoughts for "${w}"`, 'the window repeats too quickly');

  // ------------------------------------------------------------ C4 budgets
  r.section('C4 budgets');
  const big = [], walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), s = fs.statSync(p); if (s.isDirectory()) walk(p); else if (s.size > 25 * 1024 * 1024) big.push([path.relative(PUB, p), s.size]); } };
  walk(PUB); r.expect(!big.length, 'C4', 'no file over 25 MB (Cloudflare Pages limit)', big.map(b => `${b[0]} ${(b[1] / 1e6).toFixed(1)}MB`).join(', '));
  if (arg('build') || process.env.CI) {
    const out = path.resolve(ROOT, '../build-cache/test-dist');
    execSync(`npx vite build --outDir "${out}" --emptyOutDir --logLevel error`, { cwd: ROOT, stdio: 'pipe' });
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
    let raw = 0, gz = 0; for (const f of ['/index.html', ...refs]) { const b = fs.readFileSync(path.join(out, f)); raw += b.length; gz += zlib.gzipSync(b).length; }
    r.expect(gz < 4 * 1024 * 1024, 'C4', `first load ${(gz / 1e6).toFixed(2)} MB gzip (${(raw / 1e6).toFixed(2)} MB raw) of 4 MB`, 'over the brief budget');
    if (gz > 1.5e6) r.warn('C4', 'JS+CSS+HTML over 1.5 MB gzip: lazy-load the gallery / music code');
  } else r.warn('C4', 'build budget skipped (pass --build to run vite build and weigh the first load)');

  // ------------------------------------------------------------ C5 meta
  r.section('C5 page meta');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), has = re => re.test(html);
  r.expect(has(/<html[^>]*\slang="[a-z-]+"/), 'C5', '<html lang> set', 'screen readers guess the language');
  r.expect(has(/<title>[^<]{3,}<\/title>/), 'C5', 'has a <title>');
  r.expect(has(/<meta name="description" content="[^"]{20,}/), 'C5', 'has a meta description');
  r.expect(has(/<link rel="icon"/), 'C5', 'has a favicon link', 'browsers request /favicon.ico and get a 404');
  r.expect(has(/property="og:title"/) && has(/property="og:image"/), 'C5', 'has an og:title + og:image (link previews)', 'sharing the link on WhatsApp / Instagram shows no card');
  if (!has(/rel="manifest"/)) r.warn('C5', 'no web app manifest (add-to-home-screen)');
  if (!has(/<noscript/)) r.warn('C5', 'no <noscript> message');

  // ------------------------------------------------------------ C6 links
  if (arg('net')) {
    r.section(`C6 external links (${urls.size})`);
    for (const [u, where] of urls) {
      try { const res = await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (link check)' } });
        if (res.status === 404 || res.status === 410) r.fail('C6', `${res.status} ${u} (${where})`); else if (res.status >= 400) r.warn('C6', `${res.status} ${u} (${where}) - may block bots`); }
      catch (e) { r.fail('C6', `${u} (${where}): ${e.cause?.code || e.message}`); }
    }
  } else r.warn('C6', `${urls.size} external links not checked (pass --net)`);
  return r.finish();
});
