// The CRT: he picks up the remote and points it at the set. An on-screen tv player (like the music deck) mirrors the set:
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
    ...zones.filter(z => z.frames?.length).map(z => {
      const ws = z.frames.map(f => f.work).filter(w => w.img).slice(0, 24);
      const cap = w => (w.caption || '').split('\n')[0].replace(/#\S+/g, '').trim().slice(0, 60) || `from ${z.title}`;
      return { name: z.title, zone: z, imgs: ws.map(w => w.img), caps: ws.map(w => [cap(w), w.date?.slice(0, 4)].filter(Boolean).join(' · ')) };
    }),
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
    enter: () => { on = true; ch = 0; slide = 0; last = performance.now(); ui(true); }, leave: () => { on = false; remote.visible = false; u.uMap.value = staticTex; ui(false); } };

  let on = false, ch = 0, slide = 0, last = 0, paused = false;
  const cache = new Map();
  const img = src => { if (!cache.has(src)) { const im = new Image(); im.src = src; cache.set(src, im); } return cache.get(src); };

  function draw(now) {
    const c = chans[ch];
    if (!paused && now - last > 2600) { last = now; slide = (slide + 1) % c.imgs.length; img(c.imgs[(slide + 1) % c.imgs.length]); paint(); }
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

  // on-screen tv player: the screen (sharp, full-res image), what's on, slide / channel controls and a channel strip
  const I = {
    prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-8 7 8 7z"/></svg>', next: '<svg viewBox="0 0 24 24"><path d="M9 5l8 7-8 7z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5l13 7.5-13 7.5z"/></svg>', pause: '<svg viewBox="0 0 24 24"><path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z"/></svg>',
    pw: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v8M6.5 6.5a8 8 0 1 0 11 0"/></svg>',
  };
  const el = document.createElement('div'); el.id = 'tvp'; el.hidden = true;
  el.innerHTML = `<div class="tscr"><img alt=""><i class="snow"></i><span class="tch"></span><span class="tn"></span></div>
    <div class="thead"><div class="ttitles"><div class="tt"></div><div class="ta"></div></div>
      <button data-k="pw" class="tpw" aria-label="power" title="power">${I.pw}</button><button class="tx" data-k="x" aria-label="put the remote down" title="put the remote down · esc"><svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13"/></svg></button></div>
    <div class="tctl"><button data-k="dn" class="tsm" title="channel down · [">ch −</button><button data-k="prev" aria-label="previous" title="previous · ,">${I.prev}</button>
      <button data-k="play" class="tbig" aria-label="pause"></button><button data-k="next" aria-label="next" title="next · .">${I.next}</button><button data-k="up" class="tsm" title="channel up · ]">ch +</button></div>
    <div class="tchips">${chans.map((c, i) => `<button data-c="${i}">${i + 1} · ${c.name}</button>`).join('')}</div>
    <button class="go" data-k="go" hidden></button>`;
  document.body.append(el);
  const $q = s => el.querySelector(s);
  function paint() {
    const c = chans[ch];
    el.classList.toggle('off', !on);
    $q('.tscr img').src = on ? c.imgs[slide] : '';
    $q('.tch').textContent = on ? `CH ${ch + 1}` : 'off';
    $q('.tn').textContent = on ? `${slide + 1} / ${c.imgs.length}` : '';
    $q('.tt').textContent = on ? (c.caps?.[slide] || c.name) : 'the tv is off';
    $q('.ta').textContent = on ? `CH ${ch + 1} · ${c.name}` : 'press power, or flip a channel';
    $q('[data-k=play]').innerHTML = paused ? I.play : I.pause; $q('[data-k=play]').setAttribute('aria-label', paused ? 'play' : 'pause');
    el.querySelectorAll('.tchips button').forEach((b, i) => b.classList.toggle('on', on && i === ch));
    const go = $q('.go'); go.hidden = !on || !c.zone; if (c.zone) go.textContent = `go to the ${c.name} hall →`;
  }
  function ui(show) {                                             // takes the music deck's place (hidden while watching)
    el.hidden = !show; document.body.classList.toggle('watching', show); paint();
    if (show) el.querySelector('.tchips .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  const tune = c => { on = true; ch = c; slide = 0; last = performance.now(); paint(); el.querySelector('.tchips .on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); };
  el.onclick = ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const k = b.dataset.k, n = chans.length, len = chans[ch].imgs.length;
    if (k === 'x') return player.stand();
    TV.pressed = performance.now();
    if (b.dataset.c) tune(+b.dataset.c);
    if (k === 'pw') { on = !on; if (!on) u.uMap.value = staticTex; }
    if (k === 'up' || k === 'dn') tune((ch + (k === 'up' ? 1 : n - 1)) % n);
    if (k === 'prev' || k === 'next') { on = true; slide = (slide + (k === 'next' ? 1 : len - 1)) % len; last = performance.now(); }
    if (k === 'play') { on = true; paused = !paused; last = performance.now(); }
    if (k === 'go') { const z = chans[ch].zone; player.stand(); goHall(z); }
    paint();
  };
  addEventListener('keydown', ev => {
    if (player.st.seated !== TV) return;
    if (ev.code === 'Escape') return player.stand();
    if (ev.code === 'BracketRight' || ev.code === 'PageUp') $q('[data-k=up]').click();
    if (ev.code === 'BracketLeft' || ev.code === 'PageDown') $q('[data-k=dn]').click();
    if (ev.code === 'Period') $q('[data-k=next]').click();
    if (ev.code === 'Comma') $q('[data-k=prev]').click();
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
