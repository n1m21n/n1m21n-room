// Music-video staging stills (Bring Me Some Change): poses him, sets the room / party stage, frames a camera, and saves
// build-cache/review/stills/<name>.png through the dev server's /__still hook.
//   CHROME=... node tools/mv/stage.mjs [name,name]       shots come from tools/mv/shots.mjs
import { start, openPage, run, sleep } from '../../site/tests/lib/harness.mjs';
import { SHOTS as BASE } from './shots.mjs';
import { MV, mvSpec } from './poses.mjs';
import fs from 'node:fs';

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
  await page.evaluate(async () => {
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
      // typical rave: truss over the floor, LED wall behind the booth, a DJ on the riser, a light ring overhead
      const truss = [];
      for (const z of [-3, 0, 3]) { const t = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 0.12), toonM('#2B2B3A')); t.position.set(0, 5.2, z); stage.add(t); truss.push(t); }
      for (let i = 0; i < 12; i++) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.25, 10), toonM(cols[i % 5])); h.position.set(-6 + i * 1.1, 5.0, i % 2 ? -3 : 0); stage.add(h); truss.push(h); }
      const led = new THREE.Group(); led.position.set(0, 2.6, -5.8); stage.add(led);
      for (let x = 0; x < 16; x++) for (let y = 0; y < 6; y++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), toonM(((x + y) % 4) ? '#140B52' : cols[(x * 3 + y) % 5])); c.position.set(-2.6 + x * 0.35, -1 + y * 0.35, 0); led.add(c); }
      const ringL = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.06, 8, 64), toonM('#FFE14D')); ringL.rotation.x = Math.PI / 2; ringL.position.set(0, 4.6, 0); stage.add(ringL); truss.push(ringL);
      const crowd = [];
      // ghost dancers: ordered (Bayer) dither instead of alpha, rim brighter than the body, and a few horizontal
      // slices of the figure jump sideways (glitch). uA = how much of him is there, uTick re-rolls the glitch.
      const ghost = c => {
        const m = new THREE.ShaderMaterial({
          uniforms: { uCol: { value: new THREE.Color(c) }, uA: { value: 0.38 }, uTick: { value: 0 }, uSeed: { value: Math.random() * 100 } },
          vertexShader: `uniform float uTick, uSeed; varying vec3 vN, vV;
            float h(float x) { return fract(sin(x * 91.17 + uSeed) * 43758.5); }
            void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
              vec4 p = projectionMatrix * mv; float band = floor(p.y / p.w * 24.0), r = h(band + uTick * 7.0);
              if (r > 0.82) p.x += (h(band * 3.1 + uTick) - 0.5) * 0.12 * p.w;
              gl_Position = p; }`,
          fragmentShader: `uniform vec3 uCol; uniform float uA, uTick, uSeed; varying vec3 vN, vV;
            float bayer(vec2 f) { ivec2 q = ivec2(mod(f, 4.0)); int i = q.x + q.y * 4;
              int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(b[i]) + 0.5) / 16.0; }
            void main() { float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
              float a = uA * (0.55 + 0.9 * rim);
              if (fract(sin(floor(gl_FragCoord.y / 3.0) * 12.9 + uTick * 3.7 + uSeed) * 4375.5) > 0.93) a *= 0.2;   // dropped scanlines
              if (bayer(gl_FragCoord.xy) > a) discard;
              gl_FragColor = vec4(uCol * (0.7 + 1.1 * rim), 1.0); }`,
        });
        m.color = m.uniforms.uCol.value; return m;
      };
      const fig = (c) => {
        const g = new THREE.Group(), m = ghost(c);
        const cap = (r, l) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m);
        const torso = cap(0.19, 0.5); torso.position.y = 1.2; g.add(torso);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), m); head.position.y = 1.72; g.add(head);
        for (const s of [-1, 1]) {
          const leg = cap(0.08, 0.75); leg.position.set(0.1 * s, 0.45, 0); g.add(leg);
          const arm = new THREE.Group(); arm.position.set(0.24 * s, 1.45, 0); const a = cap(0.06, 0.55); a.position.y = -0.32; arm.add(a); g.add(arm); g.userData['arm' + s] = arm;
        }
        g.userData.mat = m; return g;
      };
      // the crowd is him: copies of his own rig in the ghost shader (skinned), posed with the MV poses each shot
      const M = await import('/src/man.js');
      const gVert = `uniform float uTick, uSeed; varying vec3 vN, vV; varying vec2 vUv;
        #include <common>
        #include <skinning_pars_vertex>
        float gh(float x) { return fract(sin(x * 91.17 + uSeed) * 43758.5); }
        void main() { vUv = uv;
          #include <skinbase_vertex>
          #include <beginnormal_vertex>
          #include <skinnormal_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          vec4 mv = modelViewMatrix * vec4(transformed, 1.0); vN = normalize(normalMatrix * objectNormal); vV = normalize(-mv.xyz);
          vec4 p = projectionMatrix * mv; float band = floor(p.y / p.w * 28.0), r = gh(band + uTick * 7.0);
          if (r > 0.8) p.x += (gh(band * 3.1 + uTick) - 0.5) * 0.1 * p.w;
          gl_Position = p; }`;
      const gFrag = `uniform vec3 uColor, uTint; uniform sampler2D uMap; uniform float uHasMap, uA, uTick, uSeed; varying vec3 vN, vV; varying vec2 vUv;
        float bayer(vec2 f) { ivec2 q = ivec2(mod(f, 4.0)); int i = q.x + q.y * 4;
          int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(b[i]) + 0.5) / 16.0; }
        void main() { float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
          vec3 base = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : uColor;
          float a = uA * (0.6 + 0.9 * rim);
          if (fract(sin(floor(gl_FragCoord.y / 3.0) * 12.9 + uTick * 3.7 + uSeed) * 4375.5) > 0.92) a *= 0.15;   // dropped scanlines
          if (bayer(gl_FragCoord.xy) > a) discard;
          gl_FragColor = vec4(mix(base, uTint, 0.45) * (0.75 + 0.8 * rim) + uTint * rim * 0.7, 1.0); }`;
      const ghostOf = async tint => {
        const man = await M.loadMan();
        const U = { uTint: { value: new THREE.Color(tint) }, uA: { value: 0.5 }, uTick: { value: 0 }, uSeed: { value: Math.random() * 100 } };
        const meshes = []; man.root.traverse(o => { if (o.isMesh) meshes.push(o); });
        for (const o of meshes) {
          if (o.layers.mask !== 1) { o.visible = false; continue; }         // ink hulls: a ghost has no outline
          const src = o.material.uniforms || {};
          o.material = new THREE.ShaderMaterial({ uniforms: { ...U, uColor: { value: (src.uColor?.value || new THREE.Color('#fff')).clone() }, uMap: { value: src.uMap?.value || null }, uHasMap: { value: src.uHasMap?.value || 0 } },
            vertexShader: gVert, fragmentShader: gFrag, side: o.material.side });   // his own sides: a ghost shows no inside
        }
        man.root.userData = { mat: { color: U.uTint.value, uniforms: U }, man };
        return man.root;
      };
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 18; i++) {
        const f = await ghostOf('#8A7BFF'); const a = rnd() * Math.PI * 2, r = 1.6 + rnd() * 4.5;
        f.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.8 - 0.5); f.rotation.y = rnd() * 6.28; f.scale.setScalar(0.95 + rnd() * 0.12);
        f.userData.man.face(['joyful', 'absorbed', 'delighted', 'calm'][i % 4]);
        stage.add(f); crowd.push(f);
      }
      const dj = await ghostOf('#3EE6FF'); dj.position.set(0, 1.1, -4.6); dj.userData.mat.uniforms.uA.value = 0.75; dj.userData.man.face('absorbed'); stage.add(dj);
      window.mv = { stage, pool, neon, crowd, back, floor, X, fig, booth, truss, led, dj,
        dance(specs, apply) { crowd.forEach((f, i) => apply(f.userData.man, specs[i % specs.length])); apply(dj.userData.man, specs[specs.length - 1]); dj.position.y = 1.1; },
        tint(c) { for (const f of crowd) f.userData.mat.color.set(c); },
        faceAway(px, pz) { for (const f of crowd) f.rotation.y = Math.atan2(f.position.x - px, f.position.z - pz); },
        faceTo(px, pz) { for (const f of crowd) f.rotation.y = Math.atan2(px - f.position.x, pz - f.position.z); },
      };
    });
    let s = SHOTS[name]; if (!s) { console.log('no shot', name); continue; }
    if (s.mv) s = { ...s, spec: mvSpec(s.mv, s.t ?? 1) };
    if (s.party) {                                                  // each ghost of him dances its own pose and phase
      const k = s.party.k || 0, P = s.party.dark ? ['slump', 'sway', 'bob'] : ['up', 'sway', 'point', 'bob', 'up', 'sway'];
      s = { ...s, ghostSpecs: Array.from({ length: 19 }, (_, i) => mvSpec(P[(i + k) % P.length], 0.31 * i + 0.17 * k)) };
    }
    const anchors = await page.evaluate(async (s, name) => {
      const d = window.dev, P = d.player, THREE = d.THREE, mv = window.mv, V = THREE.Vector3;
      const LK = await import('/src/look.js'), AC = await import('/src/acts.js');   // first: an await later would let the live loop move the camera
      d.sky(s.sky || 'day');
      d.scene.background.set(s.bg || '#0A0618');
      // party stage dressing
      mv.stage.visible = !!s.party; if (!s.party) mv.stage.position.set(mv.X, 0, 0);
      if (s.party) {
        const p = s.party;
        mv.dance(s.ghostSpecs, AC.applyAct); mv.tint(p.tint || '#8A7BFF');
        for (const f of mv.crowd) { f.userData.mat.uniforms.uA.value = p.ghost ?? 0.5; f.userData.mat.uniforms.uTick.value = (p.k || 0) + (s.t || 0); } mv.pool.visible = !!p.pool;
        for (const b of mv.neon) b.visible = p.neon !== false;
        mv.back.material.color.set(p.dark ? '#05030C' : '#0E0826'); mv.floor.material.color.set(p.dark ? '#07041A' : '#1B0F3A');
        if (p.away) mv.faceAway(s.at[0] - mv.X, s.at[1]); else mv.faceTo(0, -4.2);
        for (const f of mv.crowd) f.visible = p.crowd !== false;
        mv.pool.position.set(s.at[0] - mv.X, 0.01, s.at[1]);
        const ring = !!p.ring; mv.stage.position.set(ring ? 0 : mv.X, 0, 0);
        for (const o of [mv.floor, mv.back, mv.booth, mv.led, mv.dj, ...mv.truss, ...mv.neon]) if (ring) o.visible = false; else if (!mv.neon.includes(o)) o.visible = !(p.dark && (o === mv.led || mv.truss.includes(o)));
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
      // surreal: room objects float, spin, stretch and twist about their own vertical axis (pages with ?nobatch keep
      // furniture as separate meshes). Fill and ink hull get the same warp, so the outline stays on the object.
      d.scene.updateMatrixWorld(true);
      for (const z of s.surreal || []) {
        const st = d.stations.find(x => x.label === z.o), objs = st ? [].concat(st.obj) : [d.scene.getObjectByName(z.o)];
        for (const g of objs.filter(Boolean)) {
          if (z.twist || z.bulge) {
            const bb = new THREE.Box3().setFromObject(g), cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, y0 = bb.min.y, hh = Math.max(0.05, bb.max.y - y0);
            const v = new V(), inv = new THREE.Matrix4();
            g.traverse(m => {
              if (!m.isMesh || m.isSkinnedMesh) return;
              m.geometry = m.geometry.clone(); inv.copy(m.matrixWorld).invert();
              const pa = m.geometry.attributes.position;
              for (let i = 0; i < pa.count; i++) {
                v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
                const h = (v.y - y0) / hh, a = (z.twist || 0) * h, r = 1 + (z.bulge || 0) * Math.sin(Math.PI * Math.min(1, Math.max(0, h)));
                const x = (v.x - cx) * r, w = (v.z - cz) * r;
                v.set(cx + x * Math.cos(a) - w * Math.sin(a), v.y, cz + x * Math.sin(a) + w * Math.cos(a)).applyMatrix4(inv);
                pa.setXYZ(i, v.x, v.y, v.z);
              }
              pa.needsUpdate = true; if (m.geometry.attributes.normal) m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
            });
          }
          if (z.lift) g.position.y += z.lift; if (z.spin) g.rotation.y += z.spin; if (z.tilt) g.rotation.z += z.tilt; if (z.stretch) g.scale.y *= z.stretch;
        }
      }
      const easel = d.stations.find(x => x.label === 'paint')?.obj || [];
      for (const o of [].concat(easel)) if (o) o.visible = !s.noEasel;
      if (s.pose) d.man.pose(s.pose);
      if (s.spec) {                                                // MV pose: applyAct places hands and feet, IK solves the joints
        const sp = s.spec, at = (b, n) => { const p = d.man.bones[n].getWorldPosition(new V()); return d.man.root.worldToLocal(p).toArray(); };
        for (const [k, v] of Object.entries(sp.ik || {})) if (v && !Array.isArray(v)) sp.ik[k] = () => {
          const [a, b, f] = Array.isArray(v.at) ? v.at : [v.at, v.at, 0], A = at(0, a), Bp = at(0, b);
          return A.map((x, i) => x + (Bp[i] - x) * f + (v.add?.[i] || 0));
        };
        d.man.root.rotation.x = sp.lie ? -Math.PI / 2 : 0; d.man.root.updateMatrixWorld(true);
        AC.applyAct(d.man, sp);
        if (!s.face && sp.face) d.man.face(sp.face);
      }
      if (s.lift) d.man.root.position.y += s.lift;
      if (s.lie) { d.man.root.rotation.x = -Math.PI / 2; } else if (!s.act && !s.spec?.lie) d.man.root.rotation.x = 0;
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
      // stage lighting (look.js uStage): darkness + typed lights. flash = character only, hard; spot = set only;
      // area = both, wide and soft; flicker = a practical lamp at a dip/peak level (k * f)
      const sh = LK.shared, Lt = s.light;
      d.man.root.traverse(o => { if (o.material?.uniforms?.uChar) o.material.uniforms.uChar.value = 1; });
      const skyMap = d.annex.sky.material.uniforms.uMap.value;          // the window sky glows; printed things don't
      d.scene.traverse(o => { const u = o.material?.uniforms; if (u?.uGlow) u.uGlow.value = u.uMap?.value === skyMap ? 1 : 0; });
      sh.uStage.value = Lt ? 1 : 0;
      for (let i = 0; i < LK.NSPOT; i++) sh.uSpotC.value[i].set(0, 0, 0);
      if (Lt) {
        sh.uDark.value = Lt.dark ?? 0.85; sh.uAmb.value.set(Lt.amb || '#1A1440');
        const P = x => {                                           // bone name, '@station' (its object's centre) or [x, y, z]
          if (typeof x !== 'string') return new V(...x);
          if (x[0] !== '@') return B(x);
          const st = d.stations.find(q => q.label === x.slice(1)), o = st ? [].concat(st.obj)[0] : d.scene.getObjectByName(x.slice(1));
          return new THREE.Box3().setFromObject(o).getCenter(new V());
        };
        const TYPES = { flash: [0.985, 0.99, 9, 1], spot: [0.93, 0.965, 9, 0], area: [0.55, 0.85, 7, 2], flicker: [0.3, 0.7, 4.5, 2], rim: [0.97, 0.985, 9, 1] };
        (Lt.lights || []).forEach((l, i) => {
          const to = P(l.to), from = l.from === 'cam' ? cam.position.clone().add(new V(0, 0.3, 0)) : (l.rel ? to.clone().add(typeof l.to === 'string' && l.to[0] !== '@' ? new V(...l.rel).applyAxisAngle(new V(0, 1, 0), d.man.root.rotation.y) : new V(...l.rel)) : P(l.from));
          const T = [...TYPES[l.type]]; if (l.cone) { T[0] = Math.cos(l.cone); T[1] = Math.cos(l.cone * (l.type === 'flash' || l.type === 'rim' ? 0.92 : 0.6)); }
          sh.uSpotP.value[i].copy(from); sh.uSpotD.value[i].copy(to.clone().sub(from).normalize());
          const c = new THREE.Color(l.col || '#ffffff'); sh.uSpotC.value[i].set(c.r, c.g, c.b).multiplyScalar(l.k ?? 1);
          sh.uSpotA.value[i].set(T[0], T[1], l.range || T[2], T[3]);
        });
        d.scene.background.set(Lt.bg || '#05030C');
      }
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
