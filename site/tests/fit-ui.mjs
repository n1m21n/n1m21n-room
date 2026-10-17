// The wardrobe's outfit panel on desktop and phone: opens it, picks from each row, a weekday and shuffle, and checks
// the man's look follows, the panel keeps clear of him, every swatch is a fair tap target, and done puts it all away.
// Screenshots -> build-cache/review/stills/fit-ui-<device>.png
import path from 'node:path';
import { start, openPage, reporter, run, sleep } from './lib/harness.mjs';

const OUT = path.resolve(import.meta.dirname, '../../build-cache/review/stills');
const DEVICES = [
  { name: 'desktop', w: 1280, h: 800, dpr: 1, touch: false },
  { name: 'phone', w: 390, h: 844, dpr: 2, touch: true },
  { name: 'phone-landscape', w: 844, h: 390, dpr: 2, touch: true },
];
run(async () => {
  const R = reporter('fit-ui'), ctx = await start();
  for (const dv of DEVICES) {
    R.section(dv.name);
    const { page, errors } = await openPage(ctx, dv);
    await page.evaluate(() => { const d = window.dev; d.openWardrobe(); const s = d.stations.find(s => s.label === 'wardrobe').seat; s.t = 3; });
    await sleep(2500);
    const m = await page.evaluate(() => {
      const d = window.dev, c = document.getElementById('card'), r = c.getBoundingClientRect();
      const sw = [...c.querySelectorAll('.sw, .day, .fbar button')].map(b => { const q = b.getBoundingClientRect(); return { w: q.width, h: q.height, l: b.getAttribute('aria-label') || b.textContent }; });
      d.man.root.updateMatrixWorld(true); const h = d.man.bones.head.getWorldPosition(new d.THREE.Vector3()).project(d.camera);
      const hx = (h.x + 1) / 2 * innerWidth, hy = (1 - h.y) / 2 * innerHeight;
      return { open: !c.hidden && c.classList.contains('fitc'), rows: c.querySelectorAll('.frow').length, panel: [r.left, r.top, r.right, r.bottom], head: [hx, hy],
        headClear: !(hx > r.left && hx < r.right && hy > r.top && hy < r.bottom), small: sw.filter(s => Math.min(s.w, s.h) < (matchMedia('(pointer:coarse)').matches ? 40 : 30)), overflowX: c.scrollWidth > c.clientWidth + 1 };
    });
    R.expect(m.open && m.rows === 4, 'panel', 'opens with hat / top / bottoms / shoes rows', JSON.stringify(m));
    R.expect(m.headClear, 'panel', 'his head is not under the panel', `head ${m.head.map(Math.round)} panel ${m.panel.map(Math.round)}`);
    R.expect(!m.small.length, 'panel', 'tap targets big enough', m.small.map(s => `${s.l} ${Math.round(s.w)}x${Math.round(s.h)}`).join(', '));
    R.expect(!m.overflowX, 'panel', 'no sideways scroll on the panel');
    await page.screenshot({ path: path.join(OUT, `fit-ui-${dv.name}.png`) });
    // wear things: one per row, a weekday, shuffle
    const r = await page.evaluate(() => {
      const d = window.dev, c = document.getElementById('card'), out = {};
      for (const [slot, id] of [['hat', 'cap-teal'], ['upper', 'breton'], ['lower', 'olive'], ['shoes', 'red']]) {
        c.querySelector(`.frow[data-slot="${slot}"] .sw[data-id="${id}"]`).click();
        out[slot] = d.fits.now[slot] === id && c.querySelector(`.frow[data-slot="${slot}"] .sw[data-id="${id}"]`).getAttribute('aria-checked') === 'true';
      }
      out.hatOn = !!d.fits.hat;
      c.querySelector('.day[data-day="2"]').click(); out.day = JSON.stringify(d.fits.now) === JSON.stringify({ ...d.fits.weekday(2) }) || ['hat', 'upper', 'lower', 'shoes'].every(k => d.fits.now[k] === d.fits.weekday(2)[k]);
      const before = JSON.stringify(d.fits.now); c.querySelector('.shuf').click(); out.shuffle = JSON.stringify(d.fits.now) !== before;
      out.saved = JSON.parse(localStorage.getItem('n1m21n-fit') || '{}').fit?.upper === d.fits.now.upper;
      c.querySelector('.done').click();
      out.closed = c.hidden && !c.classList.contains('fitc') && d.player.st.seated == null;
      return out;
    });
    for (const k of ['hat', 'upper', 'lower', 'shoes']) R.expect(r[k], 'wear', `picking a ${k} dresses him and marks the swatch`);
    R.expect(r.hatOn, 'wear', 'a hat goes on his head');
    R.expect(r.day, 'wear', 'a weekday chip puts on that day\'s look');
    R.expect(r.shuffle, 'wear', 'shuffle changes the look');
    R.expect(r.saved, 'wear', 'the pick is kept for today');
    R.expect(r.closed, 'wear', 'done closes the panel and he steps back');
    R.expect(await page.evaluate(() => !window.dev.ward.opening), 'wear', 'the wardrobe doors swing shut after');
    R.expect(!errors.length, 'errors', 'no page errors', errors.join(' | '));
    await page.close();
  }
  await ctx.close();
  return R.finish();
});
