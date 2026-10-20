// Music-video renderer (Bring Me Some Change): renders scenes frame by frame on the song's grid and muxes the song.
//   CHROME=... node tools/mv/film.mjs I            act I (or II..V, or scene ids I-1,I-2) -> build-cache/film/act-I.mp4
//   flags: --fps 30  --w 1920 --h 1080  --frames N (test: first N frames of each scene)
//   parallel: workers render scene lists with --nomux --into act-I, then `film.mjs I --mux` encodes the act
// Shots come from shots.mjs (the stills), timing from scenes.py, camera moves and light rhythm from the tables below.
import { start, openPage, run } from '../../site/tests/lib/harness.mjs';
import { SHOTS } from './shots.mjs';
import { mvSpec } from './poses.mjs';
import { mvInit, mvShot } from './page.js';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const ROOT = `${import.meta.dirname}/../..`, WAV = '/mnt/user-data/uploads/music/Andhera (Master WAVs)/bring me some change.wav';
const BEAT = 60 / 138, BAR = 4 * BEAT;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const FPS = arg('fps', 30), W = arg('w', 1920), H = arg('h', 1080), TEST = arg('frames', 0);
const SCENES = JSON.parse(execSync(`python3 -c "import sys,json; sys.path.insert(0,'${import.meta.dirname}'); from scenes import S; print(json.dumps([[s[0],s[1],s[2]] for s in S]))"`).toString());

// one camera idea per shot (camera-language): push / pull toward the subject, rise, orbit (radians), drift (metres
// sideways), shake on hits. Fractions are of the distance to the subject over the whole shot, eased.
const MOVES = {
  'I-1': {}, 'I-2': { push: 0.15 }, 'I-3': { drift: 0.15 }, 'I-4': { push: 0.12 }, 'I-5': { drift: 0.2 }, 'I-6': { push: 0.2 }, 'I-7': {},
  'II-1': { push: 0.35, shake: 0.02 }, 'II-2': { orbit: 0.35 }, 'II-3': { push: 0.2 }, 'II-4': { drift: 0.3, shake: 0.015 }, 'II-5': { pull: 0.25 }, 'II-6': { push: 0.25, shake: 0.02 }, 'II-7': { push: 0.2 },
  'III-1': { push: 0.25 }, 'III-2': { push: 0.55 }, 'III-3': { push: 0.2 }, 'III-4': { drift: 0.4, shake: 0.03 }, 'III-5': { drift: 0.35, shake: 0.02 }, 'III-6': { rise: 2.5 },
  'IV-1': { push: 0.3, shake: 0.03 }, 'IV-2': { rise: 1.5 }, 'IV-3': { orbit: 0.4 }, 'IV-4': { push: 0.3 }, 'IV-5': { orbit: 0.7, shake: 0.02 }, 'IV-6': { orbit: 1.4 }, 'IV-7': { orbit: 0.35 },
  'V-1': { rise: 1.0 }, 'V-2': { push: 0.12 }, 'V-3': {}, 'V-4': {},
};
// the music under each bar: how hard the kick pumps the lights, and which beats fire his flash
const kickAmp = bar => bar >= 47 && bar <= 50 ? 0 : bar >= 71 ? 0 : bar <= 14 ? 0.12 : bar <= 36 ? 0.2 : bar <= 50 ? 0.32 : bar === 58 ? 0.1 : 0.4;
const flashOn = (bar, beat) => bar >= 59 && bar <= 70 ? true : bar >= 41 && bar <= 46 ? beat % 2 === 0 : beat === 0;   // peak every beat (2.3/s, under 3/s)
const hash = x => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function gains(s, t) {
  const bar = Math.floor(t / BAR) + 1, beat = Math.floor((t % BAR) / BEAT), ph = t % BEAT, env = Math.exp(-ph * 9), amp = kickAmp(bar);
  return (s.light?.lights || []).map((l, i) => {
    if (l.type === 'flicker') { const r = hash(Math.floor(t * 9) + i * 17); return r < 0.08 ? 0.05 : r < 0.25 ? 0.45 : 1; }   // a bad bulb
    if (l.type === 'flash') return flashOn(bar, beat) ? 0.3 + 1.0 * Math.exp(-ph * 11) : 0.3;
    return 1 - amp * 0.5 + amp * env;                                                   // spot, area, rim pump with the kick
  });
}
const TAGQ = tag => { const i = process.argv.indexOf('--into'); return i > 0 ? process.argv[i + 1] : tag; };
const ease = x => x * x * (3 - 2 * x);

run(async () => {
  const pick = process.argv.slice(2).find(a => !a.startsWith('--') && isNaN(+a)) || 'I';
  const list = /^(I|II|III|IV|V)$/.test(pick) ? SCENES.filter(r => r[0].split('-')[0] === pick) : SCENES.filter(r => pick.split(',').includes(r[0]));
  const tag = /^(I|II|III|IV|V)$/.test(pick) ? `act-${pick}` : pick.replace(/,/g, '_');
  const OUT = `${ROOT}/build-cache/film/${TAGQ(tag)}`; fs.mkdirSync(OUT, { recursive: true });
  const MUX = process.argv.includes('--mux');
  const ctx = MUX ? null : await start();
  const f0 = Math.round((list[0][1] - 1) * BAR * FPS);
  let last = f0;
  for (const [id, b0, b1] of MUX ? [] : list) {
    const base = SHOTS[id], a = Math.round((b0 - 1) * BAR * FPS), z = Math.round(b1 * BAR * FPS);   // [a, z): hard cut on the bar
    const n = TEST ? Math.min(TEST, z - a) : z - a, t0 = Date.now();
    const { page, errors } = await openPage(ctx, { w: W, h: H, dpr: 1, touch: false }, { query: base.surreal ? '?nobatch' : '' });
    await page.evaluate(mvInit);
    await page.evaluate(() => window.dev.renderer.setAnimationLoop(null));   // the film owns time now
    const tl = Date.now();
    for (let i = 0; i < n; i++) {
      const t = (a + i) / FPS, p = ease(i / Math.max(1, z - a - 1));
      let s = { ...base, move: MOVES[id] || {} };
      if (s.mv) s.spec = mvSpec(s.mv, t);
      if (s.party) { const k = s.party.k || 0, P = s.party.dark ? ['slump', 'sway', 'bob'] : ['up', 'sway', 'point', 'bob', 'up', 'sway']; s.ghostSpecs = Array.from({ length: 19 }, (_, j) => mvSpec(P[(j + k) % P.length], t + 0.31 * j)); }
      const ph = t % BEAT, f = { first: i === 0, film: true, dt: 1 / FPS, t, p, u: 1 + i / FPS, gain: gains(s, t), tick: Math.floor(t / BEAT), hit: Math.exp(-ph * 12), ghostA: 0.85 + 0.3 * Math.exp(-ph * 8) };
      const url = await page.evaluate(`(${mvShot})(${JSON.stringify(s)}, ${JSON.stringify(id)}, ${JSON.stringify(f)})`);
      fs.writeFileSync(`${OUT}/f${String(a + i).padStart(5, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
      last = a + i;
    }
    console.log(`${id} b${b0}-${b1}: ${n} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s (${((Date.now() - tl) / n).toFixed(0)} ms/frame)`);
    if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 5).join(' | '));
    await page.close();
  }
  if (ctx) await ctx.close();
  if (TEST || process.argv.includes('--nomux')) return 0;
  last = Math.round(list.at(-1)[2] * BAR * FPS) - 1;
  // mux: frames from f0, the song from the same second; H.264 for phones
  const ss = (f0 / FPS).toFixed(4), dur = ((last - f0 + 1) / FPS).toFixed(4), mp4 = `${ROOT}/build-cache/film/${TAGQ(tag)}.mp4`;
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -start_number ${f0} -i "${OUT}/f%05d.jpg" -ss ${ss} -t ${dur} -i "${WAV}" -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -c:a aac -b:a 320k -shortest -movflags +faststart "${mp4}"`);
  console.log('film', mp4);
  return 0;
});
