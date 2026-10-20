// Music-video staging stills (Bring Me Some Change): poses him, sets the room / party stage, frames a camera, and saves
// build-cache/review/stills/<name>.png through the dev server's /__still hook.
//   CHROME=... node tools/mv/stage.mjs [name,name]       shots come from tools/mv/shots.mjs
import { start, openPage, run, sleep } from '../../site/tests/lib/harness.mjs';
import { SHOTS as BASE } from './shots.mjs';
import { MV, mvSpec } from './poses.mjs';
import fs from 'node:fs';
import { mvInit, mvShot } from './page.js';

run(async () => {
  const pick = process.argv.slice(2).find(a => !a.startsWith('--')) || '';
  // --qc: every MV pose from four sides in plain room light (pose QC sheet)
  const SHOTS = { ...BASE };
  if (process.argv.includes('--qc')) {
    for (const k of pick ? pick.split(',') : Object.keys(MV)) {
      const lie = mvSpec(k, 1).lie, c = [0.3, lie ? 0.25 : 1.0, 1.2];
      const V = lie ? { front: [0.3, 2.6, 3.6], side: [2.6, 1.4, 0.4], back: [-1.6, 1.6, 2.2], top: [0.31, 4.2, 1.21] }
        : { front: [0.3, 1.3, 3.3], side: [3.0, 1.2, 1.2], back: [-1.6, 1.5, -1.2], low: [1.7, 0.4, 2.4] };
      for (const [v, pos] of Object.entries(V)) SHOTS[`Q-${k}-${v}`] = { fit: 5, noEasel: true, at: [0.3, 1.2, 0], mv: k, t: 1, sky: 'day', pos, look: lie ? [0.3, 0.2, 0.4] : c, fov: lie ? 50 : 42 };
    }
  }
  const names = process.argv.includes('--qc') ? Object.keys(SHOTS).filter(n => n.startsWith('Q-')) : pick ? pick.split(',') : Object.keys(SHOTS);
  const ctx = await start();
  for (const name of names) {
    const { page, errors } = await openPage(ctx, { w: 1280, h: 720, dpr: 1, touch: false }, { query: SHOTS[name]?.surreal ? '?nobatch' : '' });   // fresh page per shot: the live cutaway never carries over
    await page.evaluate(mvInit);
    let s = SHOTS[name]; if (!s) { console.log('no shot', name); continue; }
    if (s.mv) s = { ...s, spec: mvSpec(s.mv, s.t ?? 1) };
    if (s.party) {                                                  // each ghost of him dances its own pose and phase
      const k = s.party.k || 0, P = s.party.dark ? ['slump', 'sway', 'bob'] : ['up', 'sway', 'point', 'bob', 'up', 'sway'];
      s = { ...s, ghostSpecs: Array.from({ length: 19 }, (_, i) => mvSpec(P[(i + k) % P.length], 0.31 * i + 0.17 * k)) };
    }
    const anchors = await page.evaluate(`(${mvShot})(${JSON.stringify(s)}, ${JSON.stringify(name)})`);
    fs.writeFileSync(`${import.meta.dirname}/../../build-cache/review/stills/mv-${name}.json`, JSON.stringify(anchors));
    console.log('still', name);
    if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 5).join(' | '));
    await page.close();
  }
  await ctx.close();
  return 0;
});
