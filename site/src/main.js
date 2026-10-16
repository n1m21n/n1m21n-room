// n1m21n room: play as the man. The room is home; its doorway leads to the gallery halls.
import * as THREE from 'three';
import { makeCompositor, shared } from './look.js';
import { makeMusic } from './music.js';
import { makePhysics } from './physics.js';
import { buildRoom, stool, W as RW, D as RD } from './room.js';
import { furnish } from './furniture.js';
import { makeSnake } from './snake.js';
import { makeNav } from './nav.js';
import { buildGallery } from './gallery.js';
import { loadMan } from './man.js';
import { makePlayer, VIEW_LABEL } from './player.js';
import { GUITAR_AT, ACTS } from './acts.js';
import { makeReading } from './reading.js';
import { makeTelly } from './telly.js';
import { makePortals } from './portal.js';
import { makeDoors } from './doors.js';
import { makeSfx } from './sfx.js';

const sfx = makeSfx();
const boot = window.boot || { step() {}, ready() {} };            // loading screen (index.html)
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
// phones: the four-pass toon render is fill-rate bound, so start at a lower pixel ratio and let it adapt to the frame time
const TOUCH = matchMedia('(pointer: coarse)').matches;
const DPR_MAX = Math.min(devicePixelRatio, TOUCH ? 1.6 : 2), DPR_MIN = TOUCH ? 0.8 : 1;
let dpr = Math.min(DPR_MAX, TOUCH ? 1.25 : 2);
renderer.setPixelRatio(dpr);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const comp = makeCompositor(renderer, { samples: TOUCH ? 2 : 4 });
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0A0618');
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120);

// ---------- world
const solids = [];                                             // [x0, z0, x1, z1] boxes on the floor plan
const solid = (x0, z0, x1, z1) => solids.push([x0, z0, x1, z1]);
const disc = (x, z, r) => solid(x - r, z - r, x + r, z + r);
boot.step(0.15, 'laying the floor');
const { room, shelf, lamp, walls, win, kb, gt } = buildRoom();
scene.add(room);
room.updateMatrixWorld(true);
for (const w of walls) { const b = new THREE.Box3().setFromObject(w); if (b.min.y < 1) solid(b.min.x, b.min.z, b.max.x, b.max.z); }
const STOOL = { x: -0.2, z: 0.1, heading: 0, act: 'stool' };
const st0 = stool(); st0.position.set(STOOL.x, 0, STOOL.z); scene.add(st0);
const snk = makeSnake(); scene.add(snk.group);
solid(0.4, -3, 2.2, -2.45);                                     // record shelf
solid(-2.85, -0.05, -1.55, 0.35);                               // keyboard
disc(2.55, -1.9, 0.28); disc(3.35, -2.5, 0.28); disc(3.2, -1.0, 0.24); disc(-3.45, 2.45, 0.4); disc(STOOL.x, STOOL.z, 0.22);
const F = furnish({ room, walls, solid, W: RW, D: RD });
disc(F.CHAIR.x, F.CHAIR.z, 0.26);

boot.step(0.3, 'hanging the gallery');
const gallery = await buildGallery({ walls, solid });
scene.add(gallery.group);

boot.step(0.5, 'waking him up');
const man = await loadMan();
man.pose('stand');
scene.add(man.root);
window.man = man;

const nav = makeNav(solids, 0.26);
const player = makePlayer({ man, camera, canvas, solids, walls, nav, onTap });
window.player = player;                                         // dev
// doors go in after the nav grid is baked: routes run through them, he stops and pushes them open on the way
const doors = makeDoors({ scene, walls, solids, player, man });
for (const d of gallery.doorways) doors.door(d);

// ---------- stations (things to do)
const $ = id => document.getElementById(id);
boot.step(0.7, 'dusting the records');
const music = await (await fetch('/data/music.json')).json();
const thoughts = (await (await fetch('/data/thoughts.json')).json()).thoughts;
const night = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };

const CLOSE = '<button class="x" id="cardx" aria-label="close (esc)" title="close · esc"><svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13"/></svg></button>';
function card(html) { sfx.fx('card'); $('card').innerHTML = CLOSE + html; $('card').hidden = false; $('cardx').onclick = closeCard; player.st.frozen = true; }
let afterClose = null;
function closeCard() { if (!$('card').hidden) sfx.fx('card'); $('card').hidden = true; $('card').innerHTML = ''; player.st.frozen = false; const f = afterClose; afterClose = null; f?.(); }

// record player: the turntable's label wears the cover of whatever is on
const label = shelf.userData.label;
const covers = new THREE.TextureLoader();
const deck = makeMusic({
  data: music, cardEl: $('card'), card, closeCard, onTrack: a => covers.load('/' + a.cover['400'], tx => {
    tx.colorSpace = THREE.SRGBColorSpace;
    const u = label.material.uniforms; u.uMap.value?.dispose(); u.uMap.value = tx; u.uHasMap.value = 1; u.uColor.value.set('#ffffff');
  }),
});
const audio = deck.audio;

const soon = what => () => toast(`${what} — coming next`);
// halls are reached by portal: it opens in front of him, he steps through and out just inside the hall's way in
const portals = makePortals({ scene, player, man, camera });
const goHall = z => portals.go(z.entry.x, z.entry.z, z.entry.heading);
// pinboard timeline: eras are the gallery halls (pick one -> he walks into it); milestones link out
const links = await (await fetch('/data/links.json')).json();
const PIN = { x: -3.47, z: -0.38, heading: -Math.PI / 2, act: 'pin', out: [-3.1, -0.38] };
const halls = gallery.zones.filter(z => z.frames);
const span = z => { const y = (z.title.match(/\d{4}/g) || []).map(Number); return [y[0], (z.title.match(/[–-]\s*(\d{2,4})\b/) ? y.at(-1) : y[0])]; };
function openTimeline() {
  if (player.st.seated === PIN) return player.stand();
  player.sit(PIN);
  const pins = links.timeline.slice().sort((a, b) => a.from - b.from);
  const y0 = 2017, y1 = 2026, pc = y => ((y - y0) / (y1 - y0 + 1) * 100).toFixed(2) + '%';
  card(`<div class="tline"><div class="chead"><p class="cap">timeline</p><p class="meta">pick an era · a portal takes you to its hall</p></div>
    <div class="eras">${halls.map((z, i) => { const [a, b] = span(z); return `<button class="era e${i % 6}" data-h="${i}" style="left:${pc(a)};width:calc(${pc(b + 1)} - ${pc(a)})"><b>${z.title.replace(/ · .*/, '')}</b><i>${z.frames.length} works</i></button>`; }).join('')}</div>
    <div class="years">${Array.from({ length: y1 - y0 + 1 }, (_, i) => `<span style="left:${pc(y0 + i)}">’${String(y0 + i).slice(2)}</span>`).join('')}</div>
    <ol class="pins">${pins.map(p => `<li><span class="yr">${p.from}${p.to ? '–' + String(p.to).slice(2) : ''}</span><span class="k k-${p.kind}">${p.kind}</span>
      ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${p.label} ↗</a>` : p.kind === 'music' ? `<button class="lk" data-music>${p.label} ♪</button>` : `<span>${p.label}</span>`}</li>`).join('')}</ol></div>`);
  afterClose = () => { if (player.st.seated === PIN) player.stand(); };
  $('card').querySelectorAll('.era').forEach(el => { el.onclick = () => { const z = halls[+el.dataset.h]; afterClose = null; closeCard(); goHall(z); toast(`→ ${z.title}`); }; });
  $('card').querySelector('[data-music]')?.addEventListener('click', () => { afterClose = null; closeCard(); deck.openCrate(); });
}

// desk: the monitor shows infinitedevices.org; a link chip shows while he sits there
const infLink = Object.assign(document.createElement('a'), { id: 'inf', href: 'https://infinitedevices.org', target: '_blank', rel: 'noopener', hidden: true, textContent: 'open infinitedevices.org ↗' });
document.body.append(infLink);
Object.assign(F.CHAIR, { enter: () => { infLink.hidden = false; }, leave: () => { infLink.hidden = true; } });

boot.step(0.85, 'warming up the tv');
const reading = await makeReading({ man, player, card, closeCard, toast: (...a) => toast(...a) });
const telly = await makeTelly({ man, player, screen: F.tvScreen, noise: F.tvNoise, zones: gallery.zones, goHall });

// standing activities: he stays where he is and does the thing (acts.js); `out` = step back from it
const WINDOW = { x: -1.7, z: -2.4, heading: Math.PI, act: 'think', out: [-1.7, -2.0] };
const KEYS = { x: -2.16, z: 0.65, heading: Math.PI + 0.08, act: 'keys', out: [-2.14, 0.95] };
const body = gt.userData.body, rack = { p: body.position.clone(), r: body.rotation.clone() };
const GUITAR = {
  x: 2.2, z: -1.35, heading: -0.75, act: 'guitar', out: [2.0, -1.1],
  enter: () => { man.root.add(body); body.position.set(...GUITAR_AT.pos); body.rotation.set(0, 0, GUITAR_AT.rotZ); },
  leave: () => { gt.add(body); body.position.copy(rack.p); body.rotation.copy(rack.r); },
};
const stations = [
  { label: 'sit', seat: STOOL, obj: st0, p: [STOOL.x, STOOL.z + 0.5], r: 0.9, act: () => (player.st.seated ? player.stand() : player.sit(STOOL)) },
  {
    label: 'records', obj: shelf, p: [1.3, -2.05], face: [1.3, -2.8], r: 1.1, act: () => { sfx.fx('crate'); deck.openCrate(); man.face('delighted'); },
  },
  { label: 'lamp', obj: lamp, p: [2.7, -0.75], face: [3.2, -1.0], r: 1.0, act: () => { sfx.fx('lamp'); const on = shared.uLamp.value < 0.5; shared.uLamp.value = on ? 1 : 0; lamp.userData.pool.visible = on; } },
  {
    label: 'look outside', seat: WINDOW, obj: win, p: [WINDOW.x, WINDOW.z], face: [-1.7, -3], r: 1.2, act: () => {
      if (player.st.seated) return player.stand();
      const pool = thoughts.filter(t => t.when === 'any' || t.when === (night() ? 'night' : 'day'));
      WINDOW.text = pool[Math.floor(Math.random() * pool.length)].text;
      player.sit(WINDOW);
    },
  },
  { label: 'pet the snake', obj: snk.group, p: [0, 0], live: () => snk.head.position, r: 1.1, act: () => { snk.pet(); sfx.fx('hiss'); toast('sss…'); man.face('delighted'); } },
  { label: 'play guitar', seat: GUITAR, obj: gt, p: [GUITAR.x, GUITAR.z], face: [2.55, -1.9], r: 1.0, act: () => (player.st.seated ? player.stand() : player.sit(GUITAR)) },
  { label: 'play keys', seat: KEYS, obj: kb, p: [KEYS.x, KEYS.z], face: [-2.2, 0.15], r: 1.1, act: () => (player.st.seated ? player.stand() : player.sit(KEYS)) },
  { label: 'computer', seat: F.CHAIR, obj: [F.desk, F.chair], p: [F.CHAIR.x, F.CHAIR.z - 0.5], r: 1.0, act: () => (player.st.seated ? player.stand() : player.sit(F.CHAIR)) },
  { label: 'lie down', seat: F.BED, obj: F.bed, p: F.BED.out, face: [F.BED.x, -1.9], r: 1.2, act: () => (player.st.seated ? player.stand() : player.sit(F.BED)) },
  { label: 'books', seat: reading.READ, obj: F.bookshelf, p: [reading.READ.x, reading.READ.z], face: [-3.9, 1.25], r: 1.1, act: reading.open },
  { label: 'watch tv', seat: telly.TV, obj: F.tv, p: [telly.TV.x, telly.TV.z], face: [2.05, 2.8], r: 1.1, act: () => (player.st.seated ? player.stand() : player.sit(telly.TV)) },
  { label: 'timeline', seat: PIN, obj: F.pinboard, p: [PIN.x, PIN.z], face: [-4, -0.35], r: 1.1, act: openTimeline },
];
for (const f of gallery.frames) stations.push({
  label: 'look', obj: f.group, p: [f.pos.x, f.pos.z], face: [f.look.x, f.look.z], r: 1.2, frame: f, act: () => {
    const w = f.work;
    card(`${w.video ? `<video src="${w.video}" autoplay loop muted playsinline></video>` : `<img src="${w.img}" alt="">`}
      <p class="cap">${w.caption || 'untitled'}</p><p class="meta">${w.date}${w.url ? ` · <a href="${w.url}" target="_blank" rel="noopener">open post ↗</a>` : ''}</p>`);
  },
});
for (const b of gallery.benches) stations.push({ label: 'sit on the bench', seat: b.seat, obj: b.obj, p: b.seat.out, face: b.face, r: 1.1, act: () => (player.st.seated ? player.stand() : player.sit(b.seat)) });
stations.push(...doors.stations());
const byObj = new Map();
for (const s of stations) for (const o of [s.obj].flat()) if (o) byObj.set(o, s);

// ---------- tap / click: on a thing -> walk to it and use it; on the floor -> walk there
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const marker = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.2, 32), new THREE.MeshBasicMaterial({ color: '#E0368F', transparent: true, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
function walkTo(s) {
  if ((player.st.seated && s.seat === player.st.seated) || s.direct) return s.act();   // doors walk him there themselves
  const p = s.live ? [s.live().x, s.live().z] : s.p;
  const end = player.goTo(p[0], p[1], { face: s.live ? [s.live().x, s.live().z] : s.face, done: () => { marker.visible = false; s.act(); } });
  showMarker(end);
}
function showMarker(end) {
  if (!end) return;
  marker.position.set(end[0], 0.01, end[1]); marker.visible = true; marker.material.opacity = 1; marker.scale.setScalar(1);
}
function onTap(cx, cy) {
  if (!$('card').hidden) return;
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(scene.children, true).find(h => h.object !== marker && shown(h.object) && !man.root.getObjectById(h.object.id));
  if (!hit) return;
  for (let o = hit.object; o; o = o.parent) if (byObj.has(o)) return walkTo(byObj.get(o));
  const end = player.goTo(hit.point.x, hit.point.z, { done: () => { marker.visible = false; } });
  showMarker(end);
}

for (const [k, o] of Object.entries({ ...F, shelf, lamp, win, kb, gt, stool: st0 })) if (o?.isObject3D && !o.name) o.name = k;   // physics report labels
const phys = makePhysics({ scene, man });
// dev: pose every act, step it through time, and list every body part inside anything (mm deep, vertices)
async function verifyActs({ only, times = [0.8, 2, 3.5, 6] } = {}) {
  const report = {};
  for (const s of stations) {
    const spot = s.seat; if (!spot?.act || (only && !only.includes(spot.act))) continue;
    if (player.st.seated) player.stand();
    if (spot === reading.READ) { reading.READ.book = reading.READ.book || { title: 'test' }; }
    player.sit(spot);
    let t = 0; const rows = [];
    for (const at of times) {
      while (t < at) { player.update(1 / 30, performance.now() / 1000 + t); reading.update(); telly.update(false); t += 1 / 30; }
      for (const h of phys.check()) rows.push({ t: at, ...h });
    }
    player.stand();
    const worst = {};
    for (const r of rows) { const k = r.part + ' x ' + r.what; if (!worst[k] || worst[k].depth < r.depth) worst[k] = r; }
    report[spot.act] = Object.values(worst).sort((a, b) => b.depth - a.depth);
  }
  // standing idle and mid-stride (arms swing past the thighs)
  for (const [k, sp] of [['idle', 0], ['walk', 1.4], ['run', 3.2]]) {
    const rows = [];
    for (let i = 0; i < 24; i++) { player.st.speed = sp; player.update(1 / 30, i / 30); player.st.speed = sp; rows.push(...phys.check()); }
    const worst = {}; for (const r of rows) { const kk = r.part + ' x ' + r.what; if (!worst[kk] || worst[kk].depth < r.depth) worst[kk] = r; }
    report[k] = Object.values(worst).sort((a, b) => b.depth - a.depth);
  }
  player.st.speed = 0;
  return report;
}
// dev: pose stills for review sheets. Sits at an act's station, runs it `t` seconds, frames a bone from a man-local
// offset and POSTs the frame to vite (vite.config.js -> build-cache/review/stills/<name>.png)
async function shoot(act, { t = 2.5, off = [1.2, 0.4, 2.4], look = 'chest', fov = 40, name = act } = {}) {
  const s = stations.find(s => s.seat?.act === act);
  if (s && player.st.seated !== s.seat) { if (player.st.seated) player.stand(); if (s.seat === reading.READ) reading.READ.book ||= { title: 'test' }; player.sit(s.seat); }
  for (let k = 0; k < t; k += 1 / 30) { player.update(1 / 30, k); reading.update(); telly.update(false); }
  man.root.updateMatrixWorld(true);
  const V = THREE.Vector3, B = n => man.bones[n].getWorldPosition(new V());
  const tgt = look === 'hands' ? B('handL').add(B('handR')).multiplyScalar(0.5) : B(look);
  camera.fov = fov; camera.updateProjectionMatrix();
  camera.position.copy(new V(...off).applyQuaternion(man.root.getWorldQuaternion(new THREE.Quaternion())).add(tgt));
  camera.lookAt(tgt); camera.updateMatrixWorld();
  comp.render(scene, camera);
  await fetch('/__still?name=' + name, { method: 'POST', body: renderer.domElement.toDataURL('image/png') });
  return name;
}
window.dev = { sfx, get dpr() { return dpr; }, doors, gallery, portals, stations, walkTo, nav, solids, man, player, scene, camera, room, phys, verifyActs, ACTS, GUITAR_AT, render: () => comp.render(scene, camera), renderer, reading, telly, shoot };                              // dev
let near = null;
function pickStation() {
  const p = player.pos, h = player.st.heading;
  let best = null, bd = 1e9;
  for (const s of stations) {
    if (s.live) { const q = s.live(); s.p[0] = q.x; s.p[1] = q.z; }
    const dx = s.p[0] - p.x, dz = s.p[1] - p.z, d = Math.hypot(dx, dz);
    if (d > s.r) continue;
    const facing = (dx * Math.sin(h) + dz * Math.cos(h)) / (d || 1);   // prefer what he's facing
    const score = d - facing * 0.6;
    if (score < bd) { bd = score; best = s; }
  }
  if (player.st.seated) best = stations.find(s => s.seat === player.st.seated) || best;
  if (best !== near) { near = best; $('prompt').hidden = !best; }
  if (best) $('plabel').textContent = player.st.seated && best.seat === player.st.seated ? (best.seat.lying ? 'get up' : ['think', 'keys', 'guitar', 'read', 'tv', 'pin'].includes(best.seat.act) ? 'stop' : 'stand up') : best.label;
}
function interact() { if (!$('card').hidden) return closeCard(); if (near) near.act(); }
addEventListener('keydown', ev => {
  if (ev.code === 'KeyE' || ev.code === 'Enter') interact();
  if (ev.code === 'Escape') closeCard();
  if (ev.code === 'KeyM') deck.toggle();
  if (ev.code === 'KeyV' || ev.code === 'KeyC') setView(player.cycleView());
});
$('prompt').onclick = interact;
$('view').onclick = () => setView(player.cycleView());
function setView(v) { $('view').textContent = (TOUCH ? '' : 'view · ') + VIEW_LABEL[v]; }
// "?" reopens the loading screen's controls guide (the one for this device: keys or thumbs)
const guide = [...document.querySelectorAll('#boot .guide')].map(g => g.outerHTML).join('');
$('help').onclick = () => card(`<p class="cap">how to get around</p>${guide}`);
// touch: the action button sits on top of the music deck; when the open deck spans a phone's width the joystick lifts too
const deckEl = $('deck');
const deckTop = () => {
  const r = deckEl.getBoundingClientRect(), top = deckEl.hidden ? 0 : innerHeight - r.top, rs = document.documentElement.style;
  rs.setProperty('--deck-top', top + 'px');                                         // the action button stacks on it
  rs.setProperty('--deck-clear', (top && r.right > innerWidth * 0.6 ? top - 16 + 8 : 0) + 'px');   // open full width: joystick lifts too
};
if (deckEl) { new ResizeObserver(deckTop).observe(deckEl); addEventListener('resize', deckTop); }
setView('third');
// sound on / off (remembered), and a soft tick on every HUD button
const snd = $('snd');
const paintSnd = () => { snd.classList.toggle('off', sfx.muted); snd.setAttribute('aria-label', sfx.muted ? 'sound off' : 'sound on'); snd.title = sfx.muted ? 'sound off' : 'sound on'; };
snd.onclick = () => { sfx.setMuted(!sfx.muted); paintSnd(); }; paintSnd();
document.addEventListener('click', ev => { if (ev.target.closest('.chrome button, #deck button, #prompt, .crate button, .x')) sfx.fx('tick'); }, true);

// thought bubble over his head while he looks out of the window
const headW = new THREE.Vector3();
function thought() {
  const on = player.st.seated === WINDOW && WINDOW.t > 0.8, el = $('thought');
  if (!on) { if (!el.hidden) el.hidden = true; return; }
  if (el.hidden) { el.querySelector('p').textContent = WINDOW.text; el.hidden = false; }
  man.bones.head.getWorldPosition(headW); headW.y += 0.45; headW.project(camera);
  el.style.left = (headW.x + 1) / 2 * innerWidth + 'px'; el.style.top = (1 - headW.y) / 2 * innerHeight + 'px';
}

let toastT = 0;
function toast(s, ms = 3500) { $('toast').textContent = s; $('toast').hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { $('toast').hidden = true; }, ms); }

// where am I
function whereAmI(p) {
  if (Math.abs(p.x) < RW / 2 && Math.abs(p.z) < RD / 2) return 'the room';
  const z = gallery.zoneAt(p);
  return z ? (z.name === 'corridor' ? 'gallery →' : 'gallery · ' + z.title) : 'gallery';
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// adaptive resolution: average frame time over ~1.5 s, step the pixel ratio down when slow, back up when there is room
const perf = { sum: 0, n: 0, calm: 0 };
function adapt(raw) {
  if (raw > 0.25) return;                                       // tab was hidden / stalled: not a real frame
  perf.sum += raw; perf.n++;
  if (perf.sum < 1.5) return;
  const avg = perf.sum / perf.n; perf.sum = perf.n = 0;
  let next = dpr;
  if (avg > 1 / 42) { next = Math.max(DPR_MIN, dpr - 0.15); perf.calm = 0; }
  else if (avg < 1 / 57 && ++perf.calm >= 2) { next = Math.min(DPR_MAX, dpr + 0.1); perf.calm = 0; }
  if (Math.abs(next - dpr) > 0.01) { dpr = next; renderer.setPixelRatio(dpr); }
}

// first frame: compile every shader up front so walking into a new hall does not hitch, then open the door
comp.render(scene, camera);
player.st.frozen = !!window.boot;                              // no walking about behind the loading screen
boot.ready(() => { player.st.frozen = false; });

const clock = new THREE.Clock();
let tick = -1, lastWhere = '', boilNow = false;
renderer.setAnimationLoop(() => {
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05), t = clock.elapsedTime;
  adapt(raw);
  shared.uTime.value = t;
  const k = Math.floor(t * 12);                                 // boil on twos
  if (k !== tick) { tick = k; boilNow = true; shared.uBoil.value = (k % 3) + 1; comp.mat.uniforms.uSeed.value = (k % 3) * 7.31; }
  shelf.userData.spin.rotation.y = audio.paused ? 0 : t * 3.5;
  player.update(dt, t);
  doors.update(dt);
  reading.update(); telly.update(boilNow); boilNow = false;
  snk.update(dt, t, player.pos);
  if (marker.visible) { marker.scale.setScalar(1 + Math.sin(t * 6) * 0.12); if (!player.auto.pts) marker.visible = false; }
  gallery.update(player.pos);
  pickStation();
  thought();
  const w = whereAmI(player.pos);
  if (w !== lastWhere) { lastWhere = w; $('lbl').textContent = w; }
  sfx.tick(dt, { player, musicPlaying: !audio.paused, hard: w !== 'the room', night: night(), pressed: telly.TV.pressed, tvOn: telly.on, portal: portals.busy, doors: doors.all });
  comp.render(scene, camera);
});
