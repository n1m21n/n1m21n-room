// n1m21n room: play as the man. The room is home; its doorway leads to the gallery halls.
import * as THREE from 'three';
import { makeCompositor, shared } from './look.js';
import { buildRoom, stool, snake } from './room.js';
import { buildGallery } from './gallery.js';
import { loadMan } from './man.js';
import { makePlayer, VIEW_LABEL } from './player.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const comp = makeCompositor(renderer);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0A0618');
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120);

// ---------- world
const solids = [];                                             // [x0, z0, x1, z1] boxes on the floor plan
const solid = (x0, z0, x1, z1) => solids.push([x0, z0, x1, z1]);
const disc = (x, z, r) => solid(x - r, z - r, x + r, z + r);
const { room, shelf, lamp, walls } = buildRoom();
scene.add(room);
room.updateMatrixWorld(true);
for (const w of walls) { const b = new THREE.Box3().setFromObject(w); if (b.min.y < 1) solid(b.min.x, b.min.z, b.max.x, b.max.z); }
const STOOL = { x: -0.2, z: 0.1, heading: 0 };
const st0 = stool(); st0.position.set(STOOL.x, 0, STOOL.z); scene.add(st0);
const snk = snake(); snk.position.set(1.6, 0, 1.7); scene.add(snk);
solid(0.4, -3, 2.2, -2.45);                                     // record shelf
solid(-3.05, -0.85, -1.75, -0.35);                              // keyboard
disc(2.55, -1.9, 0.28); disc(3.35, -2.5, 0.28); disc(3.2, -1.0, 0.24); disc(-3.3, 0.8, 0.4); disc(STOOL.x, STOOL.z, 0.22); disc(1.6, 1.7, 0.45);

const gallery = await buildGallery({ walls, solid });
scene.add(gallery.group);

const man = await loadMan();
man.pose('stand');
scene.add(man.root);
window.man = man;

const player = makePlayer({ man, camera, canvas, solids, walls });
window.player = player;                                         // dev

// ---------- stations (things to do)
const $ = id => document.getElementById(id);
const music = await (await fetch('/data/music.json')).json();
const thoughts = (await (await fetch('/data/thoughts.json')).json()).thoughts;
const tracks = music.albums.flatMap(a => a.tracks.map(t => ({ ...t, album: a.title, cover: a.cover['400'] })));
const audio = new Audio(); audio.preload = 'none';
let trackI = Math.floor(Math.random() * tracks.length);
const night = () => { const h = new Date().getHours(); return h >= 19 || h < 6; };

function card(html) { $('card').innerHTML = html + '<button class="x" id="cardx">close · esc</button>'; $('card').hidden = false; $('cardx').onclick = closeCard; player.st.frozen = true; }
function closeCard() { $('card').hidden = true; player.st.frozen = false; }

const stations = [
  { label: 'sit', p: [STOOL.x, STOOL.z], r: 0.9, act: () => (player.st.seated ? player.stand() : (player.sit(STOOL), man.face('calm'))) },
  {
    label: 'play a record', p: [1.3, -2.3], r: 1.1, act: () => {
      const t = tracks[trackI++ % tracks.length];
      audio.src = '/' + t.src; audio.play();
      toast(`♪ ${t.title} · ${t.album}`);
      man.face('delighted');
    },
  },
  { label: 'lamp', p: [3.2, -1.0], r: 1.0, act: () => { const on = shared.uLamp.value < 0.5; shared.uLamp.value = on ? 1 : 0; lamp.userData.pool.visible = on; } },
  {
    label: 'look outside', p: [-1.7, -2.4], r: 1.2, act: () => {
      const pool = thoughts.filter(t => t.when === 'any' || t.when === (night() ? 'night' : 'day'));
      toast(`“${pool[Math.floor(Math.random() * pool.length)].text}”`, 6000);
      man.face('curious');
    },
  },
  { label: 'pet the snake', p: [1.6, 1.7], r: 1.1, act: () => { toast('sss…'); man.face('delighted'); } },
  { label: 'guitar', p: [2.55, -1.9], r: 1.0, act: () => toast('guitar station — coming next') },
  { label: 'keyboard', p: [-2.4, -0.6], r: 1.1, act: () => toast('keyboard station — coming next') },
];
for (const f of gallery.frames) stations.push({
  label: 'look', p: [f.pos.x, f.pos.z], r: 1.2, frame: f, act: () => {
    const w = f.work;
    card(`${w.video ? `<video src="${w.video}" autoplay loop muted playsinline></video>` : `<img src="${w.img}" alt="">`}
      <p class="cap">${w.caption || 'untitled'}</p><p class="meta">${w.date}${w.url ? ` · <a href="${w.url}" target="_blank" rel="noopener">open post ↗</a>` : ''}</p>`);
  },
});

let near = null;
function pickStation() {
  const p = player.pos, h = player.st.heading;
  let best = null, bd = 1e9;
  for (const s of stations) {
    const dx = s.p[0] - p.x, dz = s.p[1] - p.z, d = Math.hypot(dx, dz);
    if (d > s.r) continue;
    const facing = (dx * Math.sin(h) + dz * Math.cos(h)) / (d || 1);   // prefer what he's facing
    const score = d - facing * 0.6;
    if (score < bd) { bd = score; best = s; }
  }
  if (player.st.seated) best = stations[0];
  if (best !== near) { near = best; $('prompt').hidden = !best; }
  if (best) $('plabel').textContent = best === stations[0] && player.st.seated ? 'stand up' : best.label;
}
function interact() { if (!$('card').hidden) return closeCard(); if (near) near.act(); }
addEventListener('keydown', ev => {
  if (ev.code === 'KeyE' || ev.code === 'Enter') interact();
  if (ev.code === 'Escape') closeCard();
  if (ev.code === 'KeyV' || ev.code === 'KeyC') setView(player.cycleView());
});
$('prompt').onclick = interact;
$('view').onclick = () => setView(player.cycleView());
function setView(v) { $('view').textContent = 'view · ' + VIEW_LABEL[v]; }
setView('third');

let toastT = 0;
function toast(s, ms = 3500) { $('toast').textContent = s; $('toast').hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { $('toast').hidden = true; }, ms); }

// where am I
function whereAmI(p) {
  if (p.x < 4) return 'the room';
  const z = gallery.zones.find(z => p.x >= z.x0 && p.x < z.x1);
  return z ? (z.name === 'corridor' ? 'gallery →' : 'gallery · ' + z.title) : 'gallery';
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const clock = new THREE.Clock();
let tick = -1, lastWhere = '';
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  shared.uTime.value = t;
  const k = Math.floor(t * 12);                                 // boil on twos
  if (k !== tick) { tick = k; shared.uBoil.value = (k % 3) + 1; comp.mat.uniforms.uSeed.value = (k % 3) * 7.31; }
  shelf.userData.spin.rotation.y = audio.paused ? 0 : t * 3.5;
  snk.children.at(-1).rotation.z = Math.sin(t * 2) * 0.15;
  player.update(dt, t);
  gallery.update(player.pos);
  pickStation();
  const w = whereAmI(player.pos);
  if (w !== lastWhere) { lastWhere = w; $('lbl').textContent = w; }
  comp.render(scene, camera);
});
