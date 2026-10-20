// Ek Pinjare Mai in the room: one still per scene from the real room engine (same harness as tools/mv/stage.mjs).
//   CHROME=... node tools/epm/stage.mjs [name,name]       shots live in tools/epm/shots.mjs
// Snake points are tagged: ['w',x,y,z] world, ['m',x,y,z] man-local, ['b',bone,x,y,z] bone + man-local offset,
// ['sp',from,to,r,turns,phase] spiral round the axis from -> to (tags), ['coil',cx,cz,r,turns,rise] floor coil.
import { start, openPage, run } from '../../site/tests/lib/harness.mjs';
import { SHOTS } from './shots.mjs';
import fs from 'node:fs';

run(async () => {
  const pick = process.argv.slice(2).find(a => !a.startsWith('--')) || '';
  const names = pick ? pick.split(',') : Object.keys(SHOTS);
  const ctx = await start();
  const out = `${import.meta.dirname}/../../build-cache/review/stills/`;
  for (const name of names) {
    const s = SHOTS[name]; if (!s) { console.log('no shot', name); continue; }
    const { page, errors } = await openPage(ctx, { w: 1280, h: 720, dpr: 1, touch: false }, { query: '?nobatch' });
    await page.evaluate(async (s, name) => {
      const d = window.dev, THREE = d.THREE, scene = d.scene, P = d.player, V = THREE.Vector3;
      const LK = await import('/src/look.js'), AC = await import('/src/acts.js'), TX = await import('/src/textures.js');
      d.sky(s.sky || 'night');
      scene.background.set('#05030C');
      if (s.fit != null) d.fits.apply(d.fits.weekday(s.fit));
      if (d.ward.open) d.ward.open(false);
      // him on the stool (hands on knees), then this scene's changes to the pose
      if (!s.nohim) {
        if (P.st.seated) P.stand(); P.cancelAuto(); P.keys.clear();
        P.pos.set(0.3, 0, 0); P.st.heading = 0; P.st.speed = 0; for (let i = 0; i < 20; i++) P.update(1 / 30, i / 30);
        d.man.root.position.set(0.3, 0, 0); d.man.root.rotation.set(0, 0, 0); d.man.root.updateMatrixWorld(true);
        const spec = AC.ACTS.stool(3, s.t ?? 3), mod = s.pose || {};
        if (mod.ik) Object.assign(spec.ik, mod.ik);
        for (const k of ['fk', 'hand', 'grip', 'pole']) if (mod[k]) spec[k] = { ...spec[k], ...mod[k] };
        const fn = n => n;
        for (const [k, v] of Object.entries(spec.ik)) if (v && !Array.isArray(v) && typeof v === 'object') { const [a, b, f] = Array.isArray(v.at) ? v.at : [v.at, v.at, 0]; spec.ik[k] = () => { const A = d.man.root.worldToLocal(d.man.bones[a].getWorldPosition(new V())).toArray(), Bp = d.man.root.worldToLocal(d.man.bones[b].getWorldPosition(new V())).toArray(); return A.map((x, i) => x + (Bp[i] - x) * f + (v.add?.[i] || 0)); }; }
        AC.applyAct(d.man, spec);
        d.man.root.updateMatrixWorld(true);
      }
      d.sky(s.sky || 'night');
      if (s.face) d.man.face(s.face);
      d.man.root.updateMatrixWorld(true);
      const root = d.man.root, B = n => d.man.bones[n].getWorldPosition(new V());
      const easel = d.stations.find(x => x.label === 'paint')?.obj || [];
      for (const o of [].concat(easel)) if (o) o.visible = false;
      for (const g of (() => { const a = new Set(); scene.traverse(o => { if (o.material?.uniforms?.uOpen) a.add(o.parent); }); return a; })()) g.visible = false;
      // the room's own snake is hidden; ours is built from the shot's points
      d.snake.group.visible = false;
      if (s.nohim) root.visible = false;
      for (const n of ['palette', 'paintbrush']) { const o = scene.getObjectByName(n); if (o) o.visible = false; }

      // ---- point tags -> world points
      const pt = t => {
        if (t[0] === 'w') return new V(t[1], t[2], t[3]);
        if (t[0] === 'm') return root.localToWorld(new V(t[1], t[2], t[3]));
        if (t[0] === 'b') return B(t[1]).add(new V(t[2] || 0, t[3] || 0, t[4] || 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())));
        throw new Error('tag ' + t);
      };
      const expand = list => {
        const out = [];
        for (const t of list) {
          if (t[0] === 'sp') {
            const a = pt(t[1]), b = pt(t[2]), r = t[3], turns = t[4], ph = t[5] || 0, n = Math.max(8, Math.round(Math.abs(turns) * 14));
            const ax = b.clone().sub(a), len = ax.length(); ax.normalize();
            const u = new V(0, 0, 1).cross(ax); if (u.lengthSq() < 1e-4) u.set(1, 0, 0); u.normalize(); const w = ax.clone().cross(u);
            for (let i = 0; i <= n; i++) { const k = i / n, an = ph + k * turns * Math.PI * 2; out.push(a.clone().addScaledVector(ax, len * k).addScaledVector(u, Math.cos(an) * r).addScaledVector(w, Math.sin(an) * r)); }
          } else if (t[0] === 'coil') {
            const [, cx, cz, r, turns, rise, ph = 0, r1 = 0.4] = t, n = Math.round(turns * 16);
            for (let i = 0; i <= n; i++) { const k = i / n, an = ph + k * turns * Math.PI * 2, rr = r * (1 - (1 - r1) * k); out.push(new V(cx + Math.cos(an) * rr, 0.06 + rise * (1 - k) * (1 - k), cz + Math.sin(an) * rr)); }
          } else out.push(pt(t));
        }
        return out;
      };

      // ---- snake: cream tube along a Catmull-Rom through the points (head first), head with red arrow + eyes
      const buildSnake = sn => {
        const pts = expand(sn.pts), R0 = sn.r || 0.05;
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), L = curve.getLength();
        const N = Math.max(30, Math.round(L * 40)), S = 10, P = [], Y = new V(0, 1, 0);
        for (let i = 0; i < N; i++) {
          const u = i / (N - 1), p = curve.getPointAt(u);
          const r = R0 * (u < 0.06 ? 0.75 + u * 4 : 1 - Math.pow(Math.max(0, (u - 0.1) / 0.9), 1.6) * 0.9);
          P.push({ p, r, u });
        }
        const pos = [], idx = [];
        for (let i = 0; i < N; i++) {
          const T = P[Math.min(N - 1, i + 1)].p.clone().sub(P[Math.max(0, i - 1)].p).normalize();
          const ref = Math.abs(T.y) > 0.95 ? new V(1, 0, 0) : Y;
          const side = new V().crossVectors(T, ref).normalize(), up = new V().crossVectors(side, T).normalize();
          for (let k = 0; k < S; k++) { const a = k / S * Math.PI * 2; pos.push(...P[i].p.clone().addScaledVector(side, Math.cos(a) * P[i].r).addScaledVector(up, Math.sin(a) * P[i].r).toArray()); }
        }
        for (let i = 0; i < N - 1; i++) for (let k = 0; k < S; k++) { const a = i * S + k, b = i * S + (k + 1) % S, c = a + S, dd = b + S; idx.push(a, b, c, b, dd, c); }
        for (let k = 1; k < S - 1; k++) idx.push((N - 1) * S, (N - 1) * S + k, (N - 1) * S + k + 1);
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
        const bm = LK.toon(TX.PAL.cream, { shade: 0.4 }); bm.side = THREE.DoubleSide; const body = new THREE.Mesh(geo, bm); body.frustumCulled = false; LK.addInk(body, 0.012);
        const g = new THREE.Group(); g.add(body);
        const hk = sn.head || 1, head = new THREE.Group();
        head.add(LK.mesh(new THREE.SphereGeometry(0.1, 16, 12).scale(1, 0.62, 1.35), TX.PAL.cream, { ink: 0.012 }));
        const arrow = LK.mesh(new THREE.ConeGeometry(0.04, 0.09, 3).rotateX(Math.PI / 2).scale(1, 0.3, 1), TX.PAL.red, { ink: false }); arrow.position.set(0, 0.06, 0.02); head.add(arrow);
        for (const sd of [-1, 1]) { const e = LK.mesh(new THREE.SphereGeometry(0.02, 8, 6).scale(1, 1.3, 0.6), TX.PAL.red, { ink: 0.004 }); e.position.set(sd * 0.07, 0.03, 0.06); head.add(e); }
        if (sn.tongue) { const tg = LK.mesh(new THREE.BoxGeometry(0.012, 0.004, 0.1), TX.PAL.red, { ink: false }); tg.position.set(0, -0.01, 0.17); head.add(tg); }
        if (sn.gape) { const m = LK.mesh(new THREE.SphereGeometry(0.075, 12, 8).scale(1, 0.5, 1.1), '#7A0E2C', { ink: 0.006 }); m.position.set(0, -0.025, 0.1); head.add(m); }
        const T0 = P[0].p.clone().sub(P[3].p).normalize();
        head.position.copy(P[0].p).addScaledVector(T0, 0.05); head.scale.setScalar(hk);
        const tgt = sn.look ? pt(sn.look) : head.position.clone().add(T0);
        head.lookAt(tgt); g.add(head);
        g.userData.snake = true;
        scene.add(g); return { g, head };
      };
      const snakes = (s.snake ? (Array.isArray(s.snake) ? s.snake : [s.snake]) : []).map(buildSnake);
      // glowing slits for the opening (frame 0 = two red eyes in the dark)
      if (s.eyes) { const [x, y, z] = s.eyes.at, sp = s.eyes.gap || 0.16;
        for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24).scale(1, 1.6, 1), new THREE.MeshBasicMaterial({ color: '#FF2E4A' })); e.position.set(x + sd * sp / 2, y, z); e.lookAt(new V(...s.pos)); scene.add(e);
          const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.07), new THREE.MeshBasicMaterial({ color: '#0A0618' })); slit.position.copy(e.position); slit.position.addScaledVector(new V(...s.pos).sub(e.position).normalize(), 0.002); slit.lookAt(new V(...s.pos)); scene.add(slit); } }

      // ---- dream worlds: one pocket set per world, far from the room (x = -60 - 30 k)
      if (s.world != null) {
        const X = -60 - 30 * s.world.k, G = new THREE.Group(); G.position.set(X, 0, 0); scene.add(G);
        const m = c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
        const ring = (cols, from) => new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uC: { value: cols.map(c => new THREE.Color(c)) }, uP: { value: new V(...from).normalize() } },
          vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform vec3 uC[6]; uniform vec3 uP; varying vec3 vP; void main(){ float a = acos(clamp(dot(normalize(vP), uP), -1.0, 1.0)); int i = int(mod(floor(a * 9.0), 6.0)); vec3 c = uC[0]; for (int k = 0; k < 6; k++) if (k == i) c = uC[k]; gl_FragColor = vec4(c, 1.0); }' });
        const dark = ['#140B52', '#2A1A9E', '#3A1580', '#5A22B8', '#2A1A9E', '#3A1580'], hot = ['#140B52', '#2A1A9E', '#3A1580', '#5A22B8', '#2A1A9E', '#FF2E4A'];
        const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 20), ring(s.world.hot ? hot : dark, s.world.from || [0, 0.2, -1])); G.add(sky);
        const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), m('#2E3BDB')); floor.position.y = 0; G.add(floor);
        for (let i = 0; i < 14; i++) { const st = new THREE.Mesh(new THREE.RingGeometry(1 + i * 2, 2 + i * 2, 64).rotateX(-Math.PI / 2), m(i % 2 ? '#5A22B8' : '#2E3BDB')); st.position.y = 0.01; G.add(st); }
        const portal = (x, y, z, r, col = '#B8B5F0') => { const p = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.07, 10, 64), m(col)); p.position.set(x, y, z); G.add(p); const f = new THREE.Mesh(new THREE.CircleGeometry(r, 48), m('#0A0618')); f.position.set(x, y, z - 0.01); G.add(f); return p; };
        const k = s.world.k;
        if (k === 0) { // R6: the man whose body is sky
          const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.6, 3.5, 8, 24), ring(dark, [0, 1, 0])); body.position.set(0, 3.2, -6); G.add(body);
          const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), m('#F7A39F')); head.position.set(0, 6.6, -6); G.add(head); portal(0, 3.6, -4.3, 1.1);
        } else if (k === 1) { // R1: the door in the sky
          const fr = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5.4, 0.3), m('#B8B5F0')); fr.position.set(0, 3.2, -8); G.add(fr); portal(0, 3.1, -7.8, 1.3);
          const moon = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), m('#FBF8E8')); moon.position.set(7, 9, -20); G.add(moon);
        } else if (k === 2) { // R2: the boat full of night
          const hull = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 1.4, 1.8, 24, 1, true, 0, Math.PI), m('#5A22B8')); hull.rotation.set(Math.PI / 2, 0, Math.PI / 2); hull.scale.set(1, 1.6, 1); hull.position.set(0, 1.6, -7); G.add(hull);
          const night = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40).scale(1.9, 0.7, 1), m('#0A0618')); night.rotation.x = -Math.PI / 2; night.position.set(0, 2.4, -7); G.add(night); portal(0, 4.4, -7, 1.0);
        } else if (k === 3) { // R3: giant eye over poppies
          const eye = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 20), m('#FBF8E8')); eye.scale.set(1.6, 1, 0.4); eye.position.set(0, 5.4, -9); G.add(eye);
          const iris = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), m('#5A22B8')); iris.position.set(0, 5.4, -8.6); G.add(iris); portal(0, 5.4, -8.55, 0.8, '#FF2E4A');
          for (let i = 0; i < 40; i++) { const pp = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 6), m('#FF2E4A')); pp.position.set((Math.random() - 0.5) * 16, 0.25, -3 - Math.random() * 6); G.add(pp); }
        } else if (k === 4) { // R4: melting eyes, mint sea, volcano
          const sea = new THREE.Mesh(new THREE.CircleGeometry(24, 48).rotateX(-Math.PI / 2), m('#0F5F6B')); sea.position.y = 0.05; G.add(sea);
          const vol = new THREE.Mesh(new THREE.ConeGeometry(4, 5, 24), m('#3A1580')); vol.position.set(5, 2.5, -14); G.add(vol);
          for (let i = 0; i < 5; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14).scale(1.5, 1.1 + (i % 2) * 0.8, 0.4), m('#FBF8E8')); e.position.set(-6 + i * 3, 4 - (i % 3), -8); G.add(e);
            const ir = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), m('#FF2E4A')); ir.position.set(-6 + i * 3, 4 - (i % 3), -7.55); G.add(ir); }
          portal(0, 2.4, -6, 1.1);
        } else if (k === 5) { // R7: a giant head with a curled man inside
          const hd = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 22).scale(1, 1.25, 0.9), m('#F7A39F')); hd.position.set(0, 7, -12); G.add(hd);
          const cavity = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), m('#0A0618')); cavity.position.set(0, 6.4, -7.4); G.add(cavity);
          const cm = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.5, 10, 24, 4.6), m('#B8B5F0')); cm.position.set(0, 6.3, -7.3); G.add(cm); portal(0, 3, -6, 0.9);
        }
        s._worldAt = X;
      }

      // ---- camera: world pos/look, or a bone + man-local offset
      const cam = d.camera;
      const placeCam = () => {
        if (s.aim) { const st = d.stations.find(q => q.label === s.aim), o = [].concat(st.obj)[0], c = new THREE.Box3().setFromObject(o).getCenter(new V()); cam.position.copy(c).add(new V(...s.offw)); cam.lookAt(c.add(new V(...(s.tadd || [0, 0, 0])))); }
        else if (s.bone) { const tgt = B(s.bone).add(new V(...(s.tadd || (s.bone === 'head' ? [0, 0.1, 0] : [0, 0, 0])))); cam.position.copy(new V(...s.off).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())).add(tgt)); cam.lookAt(tgt); }
        else { const o = s._worldAt || 0; cam.position.set(s.pos[0] + o, s.pos[1], s.pos[2]); cam.lookAt(new V(s.look[0] + o, s.look[1], s.look[2])); }
        if (s.roll) cam.rotateZ(s.roll);
        cam.fov = s.fov || 50; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      };
      placeCam();

      // ---- stage lights (same four kinds as the Bring Me Some Change tool)
      const sh = LK.shared, Lt = s.light || { dark: 0.9, lights: [] };
      root.traverse(o => { if (o.material?.uniforms?.uChar) o.material.uniforms.uChar.value = 1; });
      for (const sn of snakes) sn.g.traverse(o => { if (o.material?.uniforms?.uChar) o.material.uniforms.uChar.value = 1; });
      const skyMap = d.annex.sky.material.uniforms.uMap.value;
      scene.traverse(o => { const u = o.material?.uniforms; if (u?.uGlow) u.uGlow.value = u.uMap?.value === skyMap ? 1 : 0; });
      sh.uStage.value = 1;
      for (let i = 0; i < LK.NSPOT; i++) sh.uSpotC.value[i].set(0, 0, 0);
      sh.uDark.value = (Lt.dark ?? 0.9) * (s.keepDark ? 1 : 0.86); sh.uAmb.value.set(Lt.amb || '#1A1440');
      const PT = x => {
        if (typeof x !== 'string') return new V(...x);
        if (x[0] !== '@') return B(x);
        const st = d.stations.find(q => q.label === x.slice(1)), o = st ? [].concat(st.obj)[0] : scene.getObjectByName(x.slice(1));
        return new THREE.Box3().setFromObject(o).getCenter(new V());
      };
      const TYPES = { flash: [0.985, 0.99, 9, 1], spot: [0.93, 0.965, 9, 0], area: [0.55, 0.85, 7, 2], flicker: [0.3, 0.7, 4.5, 2], rim: [0.97, 0.985, 9, 1] };
      (Lt.lights || []).forEach((l, i) => {
        const to = PT(l.to), from = l.rel ? to.clone().add(typeof l.to === 'string' && l.to[0] !== '@' ? new V(...l.rel).applyAxisAngle(new V(0, 1, 0), root.rotation.y) : new V(...l.rel)) : PT(l.from);
        const T = [...TYPES[l.type]]; if (l.cone) { T[0] = Math.cos(l.cone); T[1] = Math.cos(l.cone * (l.type === 'flash' || l.type === 'rim' ? 0.92 : 0.6)); }
        sh.uSpotP.value[i].copy(from); sh.uSpotD.value[i].copy(to.clone().sub(from).normalize());
        const c = new THREE.Color(l.col || '#ffffff'); sh.uSpotC.value[i].set(c.r, c.g, c.b).multiplyScalar(l.k ?? 1);
        sh.uSpotA.value[i].set(T[0], T[1], l.range || T[2], T[3]);
      });
      // ---- him: spiral mouth stays as drawn on his face; Droste = the room rendered once, pasted on his mouth
      if (s.droste) {
        if (s.drosteCam) { cam.position.set(...s.drosteCam.pos); cam.lookAt(new V(...s.drosteCam.look)); cam.fov = s.drosteCam.fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); }
        d.render(); const url = d.renderer.domElement.toDataURL('image/png');
        const tex = await new THREE.TextureLoader().loadAsync(url); tex.colorSpace = THREE.SRGBColorSpace;
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.085, 40), new THREE.MeshBasicMaterial({ map: tex })); disc.position.copy(B('head')).add(new V(0, 0.0, 0.19).applyQuaternion(d.man.bones.head.getWorldQuaternion(new THREE.Quaternion()))); disc.quaternion.copy(d.man.bones.head.getWorldQuaternion(new THREE.Quaternion())); scene.add(disc); placeCam();
      }

      d.render();
      await fetch('/__still?name=epm-' + name, { method: 'POST', body: d.renderer.domElement.toDataURL('image/png') });
      const f = n => B(n).toArray().map(x => +x.toFixed(2));
      return { root: root.position.toArray().map(x => +x.toFixed(2)), rotY: +root.rotation.y.toFixed(2), head: f('head'), neck: f('neck'), shinL: f('shinL'), footL: f('footL'), handR: f('handR'), handL: f('handL'), chest: f('chest') };
    }, s, name).then(r => { if (process.env.POS) console.log(JSON.stringify(r)); });
    console.log('still', name);
    if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 5).join(' | '));
    await page.close();
  }
  await ctx.close();
  return 0;
});
