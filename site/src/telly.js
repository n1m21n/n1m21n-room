// The CRT: he picks up the remote and points it at the set. A little remote on screen flips channels:
// CH 1 = film recommendations (poster carousel), then one channel per gallery hall (its artworks) with "go to hall".
import * as THREE from 'three';
import { mesh } from './look.js';
import { PAL } from './textures.js';
import { palmFrame } from './acts.js';

const SW = 256, SH = 192;

export async function makeTelly({ man, player, screen, noise, zones, goHall }) {
  const films = (await (await fetch('/data/films.json')).json()).films;
  const chans = [
    { name: 'films · recommended', imgs: films.map(f => '/' + f.poster), caps: films.map(f => `${f.title} · ${f.year}`) },
    ...zones.filter(z => z.frames?.length).map(z => ({ name: z.title, zone: z, imgs: z.frames.map(f => f.work.img).filter(Boolean).slice(0, 24) })),
  ];

  // screen canvas, swapped in for the static while the set is on
  const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const u = screen.material.uniforms, staticTex = u.uMap.value;

  // remote prop in his right hand
  const remote = new THREE.Group();
  remote.add(mesh(new THREE.BoxGeometry(0.045, 0.02, 0.17), PAL.ink, { ink: 0.004, mat: 'plastic' }));
  const led = mesh(new THREE.BoxGeometry(0.014, 0.008, 0.014), PAL.red, { ink: false, unlit: true }); led.position.set(0, 0.012, 0.06); remote.add(led);
  remote.visible = false; man.root.add(remote);

  const TV = { x: 2.05, z: 1.75, heading: 0, act: 'tv', out: [2.05, 1.4], pressed: 0,
    enter: () => { on = true; ch = 0; slide = 0; ui(true); }, leave: () => { on = false; remote.visible = false; u.uMap.value = staticTex; ui(false); } };

  let on = false, ch = 0, slide = 0, last = 0;
  const cache = new Map();
  const img = src => { if (!cache.has(src)) { const im = new Image(); im.src = src; cache.set(src, im); } return cache.get(src); };

  function draw(now) {
    const c = chans[ch];
    if (now - last > 2600) { last = now; slide = (slide + 1) % c.imgs.length; img(c.imgs[(slide + 1) % c.imgs.length]); }
    g.fillStyle = '#0B0B0B'; g.fillRect(0, 0, SW, SH);
    const im = img(c.imgs[slide]);
    if (im.complete && im.naturalWidth) {                                   // fit, letterboxed
      const k = Math.min(SW / im.naturalWidth, (SH - 22) / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
      g.drawImage(im, (SW - w) / 2, (SH - 22 - h) / 2 + 2, w, h);
    }
    g.fillStyle = 'rgba(11,6,24,.85)'; g.fillRect(0, SH - 22, SW, 22);
    g.fillStyle = PAL.spiral; g.font = "500 12px 'DM Mono', monospace";
    g.fillText(`CH ${ch + 1} · ${(c.caps?.[slide] || c.name).slice(0, 34)}`, 6, SH - 7);
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < SH; y += 3) g.fillRect(0, y, SW, 1);   // scanlines
    tex.needsUpdate = true; u.uMap.value = tex;
  }

  // on-screen remote
  const el = document.createElement('div'); el.id = 'remote'; el.hidden = true;
  el.innerHTML = `<button class="x" data-k="x" aria-label="put the remote down" title="put the remote down · esc"><svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13"/></svg></button><p class="rn"></p><div class="rb"><button data-k="pw" title="power">⏻</button><button data-k="dn" title="channel down">ch ▼</button><button data-k="up" title="channel up">ch ▲</button></div><button class="go" data-k="go" hidden></button>`;
  document.body.append(el);
  const label = () => {
    const c = chans[ch];
    el.querySelector('.rn').textContent = on ? `CH ${ch + 1} · ${c.name}` : 'off';
    const go = el.querySelector('.go'); go.hidden = !on || !c.zone; if (c.zone) go.textContent = `go to the ${c.name} hall →`;
  };
  function ui(show) {                                             // stacks just above the music deck, whatever its size
    const deck = document.getElementById('deck');
    if (show && deck && !deck.hidden) el.style.bottom = (innerHeight - deck.getBoundingClientRect().top + 18) + 'px';
    el.hidden = !show; label();
  }
  el.onclick = ev => {
    const k = ev.target.closest('button')?.dataset.k; if (!k) return;
    if (k === 'x') return player.stand();
    TV.pressed = performance.now();
    if (k === 'pw') { on = !on; if (!on) u.uMap.value = staticTex; }
    if (k === 'up' || k === 'dn') { on = true; ch = (ch + (k === 'up' ? 1 : chans.length - 1)) % chans.length; slide = 0; last = performance.now(); }
    if (k === 'go') { const z = chans[ch].zone; player.stand(); goHall(z); }
    label();
  };
  addEventListener('keydown', ev => {
    if (player.st.seated !== TV) return;
    if (ev.code === 'Escape') return player.stand();
    if (ev.code === 'BracketRight' || ev.code === 'PageUp') el.querySelector('[data-k=up]').click();
    if (ev.code === 'BracketLeft' || ev.code === 'PageDown') el.querySelector('[data-k=dn]').click();
  });

  const hw = new THREE.Vector3(), m4 = new THREE.Matrix4();
  function update(boil) {                                       // per frame after player.update; `boil` = a new 12 fps tick
    const watching = player.st.seated === TV;
    remote.visible = watching && TV.t > 0.25;
    if (remote.visible) {
      const { pos, F, N, PALM_T } = palmFrame(man, 'handR');        // lies along the fingers, its side against the palm
      remote.position.copy(pos).addScaledVector(N, PALM_T + 0.024);
      remote.quaternion.setFromRotationMatrix(m4.makeBasis(hw.crossVectors(N, F), N, F));
    }
    if (!boil) return;
    if (watching && on) draw(performance.now()); else { if (u.uMap.value !== staticTex) u.uMap.value = staticTex; noise(); }
  }
  return { TV, update, get on() { return on; } };
}
