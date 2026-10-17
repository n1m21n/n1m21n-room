// Stills for review: named camera shots of the live scene, written to build-cache/review/stills/<name>.png
//   node tests/stills.mjs                 every shot below
//   node tests/stills.mjs hands-idle,room-wide
// A shot is either an act close-up (dev.shoot: sits at that station, runs it t seconds, frames a bone) or a free
// camera { pos, look } with him parked somewhere ({ at: [x, z, heading] }). Add shots here as the world grows.
import { start, openPage, run, arg, sleep } from './lib/harness.mjs';

export const SHOTS = {
  // the man
  'hands-idle': { at: [0.3, 1.2, 0], bone: 'handR', off: [-0.25, 0.05, 0.35], fov: 35 },
  'hands-idle-back': { at: [0.3, 1.2, 0], bone: 'handR', off: [-0.3, 0.05, -0.3], fov: 35 },
  'hands-keys': { act: 'keys', look: 'hands', off: [0.2, 0.5, 0.7], fov: 35 },
  'hands-read': { act: 'read', look: 'hands', off: [0.6, 0.3, 0.6], fov: 35 },
  'tv-bag': { act: 'tv', look: 'chest', off: [1.6, 0.5, 1.4], fov: 45 },
  'tv-bag-back': { act: 'tv', look: 'chest', off: [0.5, 0.6, -2.0], fov: 50 },
  'desk-top': { pos: [-0.2, 1.35, 1.6], look: [-0.4, 0.8, 2.8], fov: 55 },
  // the outfits: the weekday looks, front and back (fit: weekday index)
  'fit-sun': { fit: 0, at: [0.3, 0.8, Math.PI], pos: [0.3, 1.35, -1.4], look: [0.3, 0.98, 0.8], fov: 54 },
  'fit-mon': { fit: 1, at: [0.3, 0.8, Math.PI], pos: [0.3, 1.35, -1.4], look: [0.3, 0.98, 0.8], fov: 54 },
  'fit-tue': { fit: 2, at: [0.3, 0.8, Math.PI], pos: [0.3, 1.35, -1.4], look: [0.3, 0.98, 0.8], fov: 54 },
  'fit-wed': { fit: 3, at: [0.3, 0.8, Math.PI], pos: [0.3, 1.35, -1.4], look: [0.3, 0.98, 0.8], fov: 54 },
  'fit-thu': { fit: 4, at: [0.3, 0.8, Math.PI], pos: [0.3, 1.35, -1.4], look: [0.3, 0.98, 0.8], fov: 54 },
  'fit-fri': { fit: 5, at: [0.3, 0.8, Math.PI], pos: [0.3, 1.35, -1.4], look: [0.3, 0.98, 0.8], fov: 54 },
  'fit-sat': { fit: 6, at: [0.3, 0.8, Math.PI], pos: [0.3, 1.35, -1.4], look: [0.3, 0.98, 0.8], fov: 54 },
  // the wardrobe: shut, open (doors stepped), and him at it (act: browsing, then posing)
  'wardrobe-shut': { pos: [1.0, 1.6, 0.4], look: [3.7, 1.05, 0.0], fov: 50 },
  'wardrobe-open': { ward: true, at: [1.2, -1.6, 0], pos: [1.6, 1.5, 0.3], look: [3.7, 1.15, 0.0], fov: 45 },
  'wardrobe-browse': { act: 'wardrobe', t: 1.0, ward: true, off: [1.1, 0.35, -1.1], fov: 50 },
  'wardrobe-pose': { act: 'wardrobe', t: 3.5, ward: true, off: [0, 0.1, 2.6], fov: 40 },
  'wardrobe-face': { act: 'wardrobe', t: 0.5, ward: true, look: 'head', off: [0, 0.05, 0.9], fov: 40 },
  'wardrobe-face-sun': { fit: 0, act: 'wardrobe', t: 3.5, ward: true, look: 'head', off: [0, 0.05, 0.9], fov: 40 },
  'wardrobe-face-nohair': { fit: 0, hide: 'hair', act: 'wardrobe', t: 3.5, ward: true, look: 'head', off: [0, 0.05, 0.9], fov: 40 },
  'wardrobe-pose-34': { act: 'wardrobe', t: 0.5, ward: true, off: [1.3, 0.25, 2.0], fov: 40 },
  'fit-cap-side': { fit: 3, at: [0.3, 0.8, Math.PI], pos: [-0.6, 1.75, 0.6], look: [0.3, 1.7, 0.8], fov: 35 },
  'fit-bucket-side': { fit: 5, at: [0.3, 0.8, Math.PI], pos: [-0.6, 1.75, 0.6], look: [0.3, 1.7, 0.8], fov: 35 },
  'fit-hat-side': { fit: 4, at: [0.3, 0.8, Math.PI], pos: [-0.6, 1.75, 0.6], look: [0.3, 1.7, 0.8], fov: 35 },
  // the room
  'room-wide': { pos: [3.6, 3.1, 2.6], look: [-0.6, 0.6, -0.4], fov: 62 },
  'room-left-corner': { pos: [-1.2, 1.6, 0.6], look: [-3.6, 0.9, 2.4], fov: 55 },
  'room-front-wall': { pos: [0.6, 1.7, -1.6], look: [0.6, 1.4, 3], fov: 70 },
  'room-back-wall': { pos: [0.4, 1.7, 1.8], look: [0.4, 1.3, -3], fov: 70 },
  'window-day': { pos: [-1.7, 1.6, 0.4], look: [-1.7, 1.9, -3], fov: 55, sky: 'day' },
  'window-dusk': { pos: [-1.7, 1.6, 0.4], look: [-1.7, 1.9, -3], fov: 55, sky: 'dusk' },
  'window-dawn': { pos: [-1.7, 1.6, 0.4], look: [-1.7, 1.9, -3], fov: 55, sky: 'dawn' },
  'snake-nap': { pos: [-1.2, 1.1, 0.6], look: [-2.05, 0.05, -0.3], fov: 45, nap: true },
  'keys-corner': { pos: [0.6, 1.5, -0.6], look: [-0.3, 0.7, -2.6], fov: 55 },
  'gallery-corner': { gal: [0, 0], fov: 60 },
  'gallery-corner-2': { gal: [1, 2], fov: 60 },
  'turntable': { pos: [1.85, 1.25, -1.75], look: [1.62, 0.85, -2.68], fov: 45 },
  'turntable-side': { pos: [2.6, 1.15, -2.2], look: [1.65, 0.85, -2.68], fov: 40 },
  // the annex: bathroom + kitchen off the corridor, and him using them
  'annex-corridor': { at: [6.7, 1.6, -Math.PI / 2], pos: [4.3, 1.7, 1.6], look: [6.6, 1.1, 1.6], fov: 70 },
  'bath-wide': { at: [6.4, -0.1, Math.PI], pos: [5.3, 2.1, 0.65], look: [5.6, 0.9, -1.4], fov: 72 },
  'kitchen-wide': { at: [5.6, 3.6, 0], pos: [6.1, 2.0, 2.6], look: [5.1, 0.8, 5.0], fov: 72 },
  'kitchen-back': { at: [5.6, 3.6, 0], pos: [4.6, 1.9, 5.2], look: [6.0, 0.9, 3.0], fov: 72 },
  'act-wash': { act: 'wash', t: 1.9, look: 'head', off: [-0.9, 0.2, 0.5], fov: 45 },
  'act-wash-mirror': { act: 'wash', t: 9, look: 'head', off: [-0.9, 0.2, 0.5], fov: 45 },
  'act-loo': { act: 'loo', t: 3, off: [-1.0, 0.5, 0.8], fov: 55 },
  'act-shower': { act: 'shower', t: 0.4, off: [0.9, 0.5, -1.2], fov: 60 },
  'act-shower-in': { act: 'shower', t: 4, off: [0.9, 0.5, -1.2], fov: 60 },
  'act-tea-boil': { act: 'tea', t: 2, look: 'hands', off: [-0.8, 0.5, -0.6], fov: 50 },
  'act-tea-pour': { act: 'tea', t: 5, look: 'hands', off: [-0.8, 0.4, -0.6], fov: 50 },
  'act-tea-sip': { act: 'tea', t: 9.6, look: 'head', off: [-0.8, 0.1, 0.45], fov: 50 },
  'act-fridge-open': { act: 'fridge', t: 1.4, off: [1.0, 0.4, -0.6], fov: 60 },
  'act-fridge-take': { act: 'fridge', t: 3.2, off: [1.0, 0.4, -0.6], fov: 60 },
  'act-brush-pick': { act: 'brush', t: 0.9, look: 'head', off: [-0.9, 0.1, 0.6], fov: 50 },
  'act-brush': { act: 'brush', t: 5, look: 'head', off: [-0.7, 0.05, 0.5], fov: 45 },
  'act-brush-side': { act: 'brush', t: 5, look: 'head', off: [0.8, 0.05, 0.2], fov: 45 },
  'act-brush-spit': { act: 'brush', t: 13.8, look: 'head', off: [-1.0, 0.3, 0.7], fov: 55 },
  'act-brush-done': { act: 'brush', t: 17.5, look: 'head', off: [-0.9, 0.1, 0.6], fov: 50 },
  'act-cook': { act: 'cook', t: 3, look: 'hands', off: [-0.9, 0.6, -0.5], fov: 50 },
  'act-cook-front': { act: 'cook', t: 4, off: [0.4, 0.5, 1.6], fov: 55 },
  'act-eat-bowl': { act: 'eat', t: 1.2, off: [0.9, 0.4, 1.1], fov: 50 },
  'act-eat-mouth': { act: 'eat', t: 2.9, look: 'head', off: [0.8, 0.1, 0.7], fov: 45 },
  'act-eat-side': { act: 'eat', t: 2.9, look: 'head', off: [-0.9, 0.1, 0.3], fov: 45 },
  'face-brush-groggy': { act: 'brush', t: 0.5, look: 'head', off: [-0.5, 0.1, 0.7], fov: 40, mood: 'groggy' },
  'face-brush-tired': { act: 'brush', t: 0.5, look: 'head', off: [-0.5, 0.1, 0.7], fov: 40, mood: 'tired' },
  'face-shower-cold': { act: 'shower', t: 0.6, look: 'head', off: [0.3, 0.1, 0.7], fov: 45 },
  'face-cook-spit': { act: 'cook', t: 1.75, look: 'head', off: [-0.5, 0.1, 0.7], fov: 40 },
  'face-desk': { act: 'desk', t: 3, look: 'head', off: [0.3, 0.05, 0.6], fov: 40 },
  'face-keys-peak': { act: 'keys', t: 4.76, look: 'head', off: [0.3, 0.1, 0.7], fov: 40 },
  'face-tv-alarm': { act: 'tv', t: 12.08, look: 'head', off: [0.3, 0.1, 0.8], fov: 40 },
  'door-room': { pos: [2.2, 1.7, 1.6], look: [4.2, 1.1, 1.6], fov: 60 },
};

run(async () => {
  const pick = arg('only') || process.argv.slice(2).find(a => !a.startsWith('--')) || '';
  const names = pick ? pick.split(',') : Object.keys(SHOTS);
  const ctx = await start(), { page, errors } = await openPage(ctx, { w: 1200, h: 800, dpr: 1, touch: false });
  for (const name of names) {
    const s = SHOTS[name]; if (!s) { console.log('no shot', name); continue; }
    await page.evaluate(async (s, name) => {
      const d = window.dev, P = d.player, THREE = d.THREE;
      if (s.sky) d.sky(s.sky);
      if (s.fit != null) d.fits.apply(d.fits.weekday(s.fit));
      d.man.root.traverse(o => { if (o.isSkinnedMesh && (o.userData.look ?? o.parent?.userData.look) === 'hair') o.visible = s.hide !== 'hair'; });
      if (s.ward) { d.ward.open(true); d.ward.pick(d.fits.now); for (let i = 0; i < 90; i++) d.ward.update(1 / 30, i / 30); }
      if (s.nap != null) { d.snake.nap(s.nap); for (let i = 0; i < 300; i++) d.snake.update(1 / 30, i / 30, null); }
      if (s.gal) { const z = d.gallery.zones.filter(z => z.frames)[s.gal[0]]; const c = s.gal[1]; const qx = c % 3 ? z.x1 : z.x0, qz = c > 1 ? z.z1 : z.z0, ix = qx === z.x0 ? 1 : -1, iz = qz === z.z0 ? 1 : -1;
        s = { ...s, pos: [qx + ix * 3.2, 1.9, qz + iz * 2.6], look: [qx + ix * 0.4, 0.9, qz + iz * 0.4], at: [qx + ix * 3, qz + iz * 3, 0] }; }
      const R = d.routine; R.clock.skew = 0;                           // mood: set his clock to a groggy or tired minute
      if (s.mood) { const day = Math.floor((Date.now() + 5.5 * 3600e3) / 864e5), m = s.mood === 'tired' ? 23 * 60 : R.dayPlan(day).find(e => e[1] !== 'sleep')[0] + 5;
        R.clock.at(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`); }
      if (s.act && P.st.seated?.act === s.act) P.stand();            // each act shot starts its clock afresh
      if (s.act) return d.shoot(s.act, { t: s.t, off: s.off, look: s.look || 'chest', fov: s.fov || 40, name });
      if (P.st.seated) P.stand(); P.cancelAuto(); P.keys.clear();
      const a = s.at || [0.3, 1.2, 0]; P.pos.set(a[0], 0, a[1]); d.man.root.position.set(a[0], 0, a[1]); P.st.heading = a[2] || 0; P.st.speed = 0;
      for (let i = 0; i < 20; i++) P.update(1 / 30, i / 30);
      const cam = d.camera; d.man.root.updateMatrixWorld(true);
      if (s.bone) {
        const tgt = d.man.bones[s.bone].getWorldPosition(new THREE.Vector3());
        cam.position.copy(new THREE.Vector3(...s.off).applyQuaternion(d.man.root.getWorldQuaternion(new THREE.Quaternion())).add(tgt)); cam.lookAt(tgt);
      } else { cam.position.set(...s.pos); cam.lookAt(new THREE.Vector3(...s.look)); }
      cam.fov = s.fov || 50; cam.clearViewOffset?.(); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      for (const w of d.room.parent.children) w.visible = w.visible;   // nothing cut away: the shot sees what is there
      d.render();
      await fetch('/__still?name=' + name, { method: 'POST', body: d.renderer.domElement.toDataURL('image/png') });
    }, s, name);
    console.log('still', name);
  }
  if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 5).join(' | '));
  await ctx.close();
  return 0;
});
