// Music-video staging stills (Bring Me Some Change): poses him, sets the room / party stage, frames a camera, and saves
// build-cache/review/stills/<name>.png through the dev server's /__still hook.
//   CHROME=... node tools/mv/stage.mjs [name,name]       shots come from tools/mv/shots.mjs
import { start, openPage, run, sleep } from '../../site/tests/lib/harness.mjs';
import { SHOTS } from './shots.mjs';
import fs from 'node:fs';

run(async () => {
  const pick = process.argv.slice(2).find(a => !a.startsWith('--')) || '';
  const names = pick ? pick.split(',') : Object.keys(SHOTS);
  const ctx = await start();
  for (const name of names) {
    const { page, errors } = await openPage(ctx, { w: 1280, h: 720, dpr: 1, touch: false });   // fresh page per shot: the live cutaway never carries over
  await page.evaluate(() => {
      const d = window.dev, THREE = d.THREE, scene = d.scene;
      const toonM = (c, unlit = false) => new THREE.MeshBasicMaterial({ color: c });
      // party stage, far left of the room
      const X = -30, stage = new THREE.Group(); stage.position.set(X, 0, 0); scene.add(stage);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), toonM('#1B0F3A')); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; stage.add(floor);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.3, 48), toonM('#F6E7C1')); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.01; pool.visible = false; stage.add(pool);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(18, 7), toonM('#0E0826')); back.position.set(0, 3.5, -6); stage.add(back);
      const neon = [];
      const cols = ['#FF3EA5', '#3EE6FF', '#FFE14D', '#8A5BFF', '#FF6A3D'];
      for (let i = 0; i < 11; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.5, 0.05), toonM(cols[i % 5])); b.position.set(-7.5 + i * 1.5, 3.2, -5.9); b.rotation.z = (i % 2 ? 1 : -1) * 0.35; stage.add(b); neon.push(b); }
      const booth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.8), toonM('#2A1660')); booth.position.set(0, 0.55, -4.2); stage.add(booth);
      const crowd = [];
      const fig = (c) => {
        const g = new THREE.Group(), m = new THREE.MeshToonMaterial ? new THREE.MeshBasicMaterial({ color: c }) : null;
        const cap = (r, l) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m);
        const torso = cap(0.19, 0.5); torso.position.y = 1.2; g.add(torso);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), m); head.position.y = 1.72; g.add(head);
        for (const s of [-1, 1]) {
          const leg = cap(0.08, 0.75); leg.position.set(0.1 * s, 0.45, 0); g.add(leg);
          const arm = new THREE.Group(); arm.position.set(0.24 * s, 1.45, 0); const a = cap(0.06, 0.55); a.position.y = -0.32; arm.add(a); g.add(arm); g.userData['arm' + s] = arm;
        }
        g.userData.mat = m; return g;
      };
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 34; i++) {
        const f = fig('#3A2A8C'); const a = rnd() * Math.PI * 2, r = 1.6 + rnd() * 5;
        f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.8 - 0.5); f.rotation.y = rnd() * 6.28; f.scale.setScalar(0.92 + rnd() * 0.2);
        stage.add(f); crowd.push(f);
      }
      window.mv = { stage, pool, neon, crowd, back, floor, X, fig, booth,
        dance(k) { for (const [i, f] of crowd.entries()) { const up = (i + k) % 3; f.userData.arm1.rotation.z = up ? 2.6 - (i % 4) * 0.3 : 0.3; f.userData['arm-1'].rotation.z = up === 1 ? -2.6 + (i % 3) * 0.3 : -0.3; f.position.y = (i + k) % 2 ? 0.06 : 0; } },
        tint(c) { for (const f of crowd) f.userData.mat.color.set(c); },
        faceAway(px, pz) { for (const f of crowd) f.rotation.y = Math.atan2(f.position.x - px, f.position.z - pz); },
        faceTo(px, pz) { for (const f of crowd) f.rotation.y = Math.atan2(px - f.position.x, pz - f.position.z); },
      };
    });
    const s = SHOTS[name]; if (!s) { console.log('no shot', name); continue; }
    const anchors = await page.evaluate(async (s, name) => {
      const d = window.dev, P = d.player, THREE = d.THREE, mv = window.mv, V = THREE.Vector3;
      d.sky(s.sky || 'day');
      d.scene.background.set(s.bg || '#0A0618');
      // party stage dressing
      mv.stage.visible = !!s.party; if (!s.party) mv.stage.position.set(mv.X, 0, 0);
      if (s.party) {
        const p = s.party;
        mv.dance(p.k || 0); mv.tint(p.tint || '#5A48D8'); mv.pool.visible = !!p.pool;
        for (const b of mv.neon) b.visible = p.neon !== false;
        mv.back.material.color.set(p.dark ? '#05030C' : '#0E0826'); mv.floor.material.color.set(p.dark ? '#07041A' : '#1B0F3A');
        if (p.away) mv.faceAway(s.at[0] - mv.X, s.at[1]); else mv.faceTo(0, -4.2);
        for (const f of mv.crowd) f.visible = p.crowd !== false;
        mv.pool.position.set(s.at[0] - mv.X, 0.01, s.at[1]);
        const ring = !!p.ring; mv.stage.position.set(ring ? 0 : mv.X, 0, 0);
        for (const o of [mv.floor, mv.back, mv.booth, ...mv.neon]) if (ring) o.visible = false; else if (!mv.neon.includes(o)) o.visible = true;
        if (ring) mv.crowd.forEach((f, i) => { const n = 12; if (i >= n) { f.visible = false; return; } const a = i / n * Math.PI * 2; f.position.set(s.at[0] + Math.cos(a) * 1.5, (i % 2) * 0.06, s.at[1] + Math.sin(a) * 1.5); f.rotation.y = Math.atan2(s.at[0] - f.position.x, s.at[1] - f.position.z); f.userData.mat.color.set(['#FF3EA5', '#3EE6FF', '#FFE14D', '#8A5BFF'][i % 4]); });
      }
      if (s.fit != null) d.fits.apply(d.fits.weekday(s.fit));
      if (s.ward) { d.ward.open(true); d.ward.pick(d.fits.now); for (let i = 0; i < 90; i++) d.ward.update(1 / 30, i / 30); } else if (d.ward.open) d.ward.open(false);
      if (s.nap != null) { d.snake.nap(s.nap); for (let i = 0; i < 300; i++) d.snake.update(1 / 30, i / 30, null); }
      if (s.act) {
        if (P.st.seated) P.stand();
        await d.shoot(s.act, { t: s.t ?? 3, off: [0, 0, 1], look: 'chest', fov: 40, name: '_tmp', beat: s.beat });
      } else {
        if (P.st.seated) P.stand(); P.cancelAuto(); P.keys.clear();
        const a = s.at || [0.3, 1.2, 0]; const ax = s.party && !s.party.ring ? 0.3 : a[0], az = s.party && !s.party.ring ? 1.2 : a[1];
        P.pos.set(ax, 0, az); P.st.heading = a[2] || 0; P.st.speed = 0;
        for (let i = 0; i < 20; i++) P.update(1 / 30, i / 30);
        d.man.root.position.set(a[0], 0, a[1]); d.man.root.rotation.y = a[2] || 0;
      }
      const gates = new Set(); d.scene.traverse(o => { if (o.material?.uniforms?.uOpen) gates.add(o.parent); });
      for (const g of gates) g.visible = false;
      if (s.portal) { const g = [...gates][0]; g.visible = true; g.position.set(...s.portal.p); g.rotation.y = s.portal.ry || 0; g.scale.setScalar(s.portal.k || 1); g.traverse(o => { if (o.material?.uniforms?.uOpen) o.material.uniforms.uOpen.value = 1; }); }
      const easel = d.stations.find(x => x.label === 'paint')?.obj || [];
      for (const o of [].concat(easel)) if (o) o.visible = !s.noEasel;
      if (s.pose) d.man.pose(s.pose);
      if (s.lift) d.man.root.position.y += s.lift;
      if (s.lie) { d.man.root.rotation.x = -Math.PI / 2; } else if (!s.act) d.man.root.rotation.x = 0;
      if (s.face) d.man.face(s.face);
      d.shared && 0;
      d.man.root.updateMatrixWorld(true);
      const cam = d.camera;
      const B = n => d.man.bones[n].getWorldPosition(new V());
      if (s.party?.pool) { const h = B('hips' in d.man.bones ? 'hips' : 'spine'); mv.pool.position.set(h.x - mv.stage.position.x, 0.01, h.z); }
      if (s.woff) { const tgt = B(s.bone).add(new V(...(s.tadd || [0, 0, 0]))); cam.position.copy(tgt).add(new V(...s.woff)); cam.up.set(...(s.up || [0, 1, 0])); cam.lookAt(tgt); cam.up.set(0, 1, 0); }
      else if (s.bone) {
        const tgt = B(s.bone).add(new V(...(s.tadd || [0, 0, 0])));
        cam.position.copy(new V(...s.off).applyQuaternion(d.man.root.getWorldQuaternion(new THREE.Quaternion())).add(tgt)); cam.lookAt(tgt);
      } else { cam.position.set(...s.pos); cam.lookAt(new V(...s.look)); }
      if (s.roll) cam.rotateZ(s.roll);
      cam.fov = s.fov || 50; cam.clearViewOffset?.(); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      d.sky(s.sky || 'day');
      d.render();
      await fetch('/__still?name=mv-' + name, { method: 'POST', body: d.renderer.domElement.toDataURL('image/png') });
      const scr = n => { const v = B(n).project(cam); return [+((v.x + 1) / 2).toFixed(3), +((1 - v.y) / 2).toFixed(3), v.z < 1 ? 1 : 0]; };   // screen 0..1 (for the lighting grade)
      return { head: scr('head'), hips: scr('hips'), foot: scr('footL'), handR: scr('handR') };
    }, s, name);
    fs.writeFileSync(`${import.meta.dirname}/../../build-cache/review/stills/mv-${name}.json`, JSON.stringify(anchors));
    console.log('still', name);
    if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 5).join(' | '));
    await page.close();
  }
  await ctx.close();
  return 0;
});
