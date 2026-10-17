// n1m21n room: play as the man. The room is home; its doorway leads to the gallery halls.
import * as THREE from 'three';
import { makeCompositor, shared } from './look.js';
import { makeMusic } from './music.js';
import { makePhysics } from './physics.js';
import { ARM_PLAY, buildRoom, stool, W as RW, D as RD } from './room.js';
import { furnish } from './furniture.js';
import { makeOutfits, SLOTS, WEEK, DAYS } from './outfits.js';
import { makeSnake, BED as SNAKE_BED } from './snake.js';
import { wardrobe as makeWardrobe, WARD as WD } from './wardrobe.js';
import { makeNav } from './nav.js';
import { buildGallery } from './gallery.js';
import { buildAnnex, ANNEX } from './annex.js';
import { loadMan } from './man.js';
import { makePlayer, VIEW_LABEL } from './player.js';
import { GUITAR_AT, ACTS } from './acts.js';
import { makeReading } from './reading.js';
import { makeTelly } from './telly.js';
import { makePortals } from './portal.js';
import { makeDoors } from './doors.js';
import { makeSfx } from './sfx.js';
import { makeRoutine, istNow, istClock } from './routine.js';
import { makeUtilityAI } from './sim/utility.js';
import { makePosture } from './sim/posture.js';
import { PAL, skyTex } from './textures.js';

const sfx = makeSfx();
const boot = window.boot || { step() {}, ready() {} };            // loading screen (index.html)
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
// phones: the four-pass toon render is fill-rate bound; start sharp and only trade resolution when it buys frames
const TOUCH = matchMedia('(pointer: coarse)').matches;
const DPR_MAX = Math.min(devicePixelRatio, 2);
let DPR_MIN = Math.min(DPR_MAX, TOUCH ? 1.5 : 1);
let dpr = DPR_MAX;
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
disc(SNAKE_BED.x, SNAKE_BED.z, SNAKE_BED.r);                    // its cushion
solid(0.4, -3, 2.2, -2.45);                                     // record shelf
solid(-0.95, -2.8, 0.35, -2.4);                                 // keyboard
disc(2.55, -1.9, 0.28); disc(3.35, -2.5, 0.28); disc(3.5, -1.0, 0.24); disc(-3.36, 2.36, 0.4); disc(STOOL.x, STOOL.z, 0.22);
const F = furnish({ room, walls, solid, W: RW, D: RD });
// wardrobe: back to the right wall between the lamp and the doorway, opening into the room (-x)
const ward = makeWardrobe(); ward.group.position.set(RW / 2 - 0.05 - WD.d / 2, 0, 0); ward.group.rotation.y = -Math.PI / 2; room.add(ward.group);
solid(RW / 2 - 0.05 - WD.d, -WD.w / 2 - 0.02, RW / 2, WD.w / 2 + 0.02);
disc(F.CHAIR.x, F.CHAIR.z, 0.26);

boot.step(0.3, 'hanging the gallery');
const gallery = await buildGallery({ walls, solid });
scene.add(gallery.group);
const annex = buildAnnex({ walls, solid });                   // bathroom + kitchen off the corridor
scene.add(annex.group);

boot.step(0.5, 'waking him up');
const man = await loadMan();
man.pose('stand');
scene.add(man.root);
const fits = makeOutfits(man);                                   // today's look (weekday, or what he picked today)
window.man = man;

const utility = makeUtilityAI();
const posture = makePosture({ getMotives: () => utility.motives, getSnakePos: () => snk.head.position });
const nav = makeNav(solids, 0.26);
// rooms whose walls are cut away Sims-style (the ones facing the camera); the gallery's halls keep the spring arm
const rooms = [{ name: 'room', box: [-RW / 2, -RD / 2, RW / 2, RD / 2] }, ...Object.entries(ANNEX.rooms).map(([name, box]) => ({ name, box }))];
const player = makePlayer({ man, scene, camera, canvas, solids, walls, nav, onTap, rooms, posture });
window.player = player;                                         // dev
// doors go in after the nav grid is baked: routes run through them, he stops and pushes them open on the way
const doors = makeDoors({ scene, walls, solids, player, man });
for (const d of gallery.doorways) doors.door(d);

// ---------- stations (things to do)
const $ = id => document.getElementById(id);
boot.step(0.7, 'dusting the records');
const music = await (await fetch('/data/music.json')).json();
const thoughts = (await (await fetch('/data/thoughts.json')).json()).thoughts;
const night = () => { const { h } = istNow(); return h >= 19 || h < 6; };     // his night: India time

const CLOSE = '<div class="cbar"><button class="x" id="cardx" aria-label="close (esc)" title="close · esc"><svg viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13"/></svg></button></div>';
function card(html) { sfx.fx('card'); $('card').classList.remove('fitc'); $('card').innerHTML = CLOSE + html; $('card').hidden = false; $('cardx').onclick = closeCard; player.st.frozen = true; }
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
$('stack').append(infLink);
Object.assign(F.CHAIR, { enter: () => { infLink.hidden = false; }, leave: () => { infLink.hidden = true; } });

boot.step(0.85, 'warming up the tv');
const reading = await makeReading({ man, player, card, closeCard, toast: (...a) => toast(...a) });
const telly = await makeTelly({ man, player, screen: F.tvScreen, noise: F.tvNoise, zones: gallery.zones, goHall });
{ const on = telly.TV.enter; telly.TV.enter = s => { on(s); player.st.yaw = telly.TV.heading + Math.PI; player.st.pitch = 0.3; }; }   // over his shoulder at the screen

// standing activities: he stays where he is and does the thing (acts.js); `out` = step back from it
const WINDOW = { x: -1.7, z: -2.4, heading: Math.PI, act: 'think', out: [-1.7, -2.0] };
const KEYS = { x: -0.3, z: -2.1, heading: Math.PI, act: 'keys', out: [-0.3, -1.7] };
const body = gt.userData.body, rack = { p: body.position.clone(), r: body.rotation.clone() };
const GUITAR = {
  x: 2.2, z: -1.35, heading: -0.75, act: 'guitar', out: [2.0, -1.1],
  enter: () => { man.root.add(body); body.position.set(...GUITAR_AT.pos); body.rotation.set(0, 0, GUITAR_AT.rotZ); },
  leave: () => { gt.add(body); body.position.copy(rack.p); body.rotation.copy(rack.r); },
};
// wardrobe: he opens it, runs a hand along the rail, turns round to show the look; the outfit panel (#card.fitc) picks
// hat / upper / lower / shoes, a weekday's look or a shuffle. Every change spins him once; picks hold for today (IST)
const WARD = { x: RW / 2 - 0.05 - WD.d - 0.42, z: 0, heading: Math.PI / 2, act: 'wardrobe', out: [RW / 2 - 1.4, 0],
  enter: () => { ward.open(true); ward.pick(fits.now); sfx.fx('creak'); }, leave: () => { ward.open(false); sfx.fx('creak'); } };
const SLOT_LABEL = { hat: 'hat', upper: 'top', lower: 'bottoms', shoes: 'shoes' };
const sameFit = (a, b) => Object.keys(SLOTS).every(k => a[k] === b[k]);
function openWardrobe() {
  if (player.st.seated === WARD) return closeCard();
  if (player.st.seated) player.stand();
  WARD.twirlAt = 0; player.sit(WARD);
  player.st.yaw = WARD.heading + Math.PI; player.st.pitch = 0.22;   // the camera comes round to his front (he turns to face it)
  const today = fits.today().day;
  const row = slot => `<div class="frow" data-slot="${slot}"><div class="fh"><b>${SLOT_LABEL[slot]}</b><span class="fname"></span></div>
    <div class="sws" role="radiogroup" aria-label="${SLOT_LABEL[slot]}">${SLOTS[slot].map(it => `<button class="sw${it.id === 'none' ? ' none' : ''}" role="radio" data-id="${it.id}" aria-label="${it.name}" title="${it.name}" style="--sw:${it.sw}"></button>`).join('')}</div></div>`;
  card(`<div class="fit"><div class="chead"><p class="cap">wardrobe</p><p class="meta fday"></p></div>
    <div class="days" role="group" aria-label="a look for each day">${DAYS.map((d, i) => `<button class="day${i === today ? ' today' : ''}" data-day="${i}" aria-label="${d}'s look" title="${d}'s look">${d.slice(0, 3)}</button>`).join('')}</div>
    ${Object.keys(SLOTS).map(row).join('')}
    <div class="fbar"><button class="shuf">shuffle</button><button class="done">done</button></div></div>`);
  const el = $('card'); el.classList.add('fitc');
  const paint = () => {
    const now = fits.now, d = WEEK.findIndex(w => sameFit(w, now));
    for (const r of el.querySelectorAll('.frow')) {
      const slot = r.dataset.slot, it = SLOTS[slot].find(o => o.id === now[slot]);
      r.querySelector('.fname').textContent = it?.name || '';
      for (const b of r.querySelectorAll('.sw')) b.setAttribute('aria-checked', b.dataset.id === now[slot]);
    }
    for (const b of el.querySelectorAll('.day')) b.setAttribute('aria-pressed', +b.dataset.day === d);
    el.querySelector('.fday').textContent = d < 0 ? 'your pick · holds for today' : d === today ? `${DAYS[d]}'s look · today` : `${DAYS[d]}'s look`;
    ward.pick(now);
  };
  const wear = f => { fits.apply(f); fits.save(); WARD.twirlAt = performance.now(); sfx.fx('rustle', 0.1); man.face('delighted'); paint(); };
  el.querySelectorAll('.sw').forEach(b => { b.onclick = () => wear({ [b.closest('.frow').dataset.slot]: b.dataset.id }); });
  el.querySelectorAll('.day').forEach(b => { b.onclick = () => wear(fits.weekday(+b.dataset.day)); });
  el.querySelector('.shuf').onclick = () => { let f; do f = fits.random(); while (sameFit(f, fits.now)); wear(f); };
  el.querySelector('.done').onclick = closeCard;
  afterClose = () => { el.classList.remove('fitc'); if (player.st.seated === WARD) player.stand(); };
  paint();
}
function lookOut() {
  const pool = thoughts.filter(t => t.when === 'any' || t.when === (night() ? 'night' : 'day'));
  WINDOW.text = pool[Math.floor(Math.random() * pool.length)].text;
  player.sit(WINDOW);
}
const stations = [
  { label: 'sit', seat: STOOL, obj: st0, p: [STOOL.x, STOOL.z + 0.5], r: 0.9, act: () => (player.st.seated ? player.stand() : player.sit(STOOL)) },
  {
    label: 'records', obj: shelf, p: [1.3, -2.05], face: [1.3, -2.8], r: 1.1, act: () => { sfx.fx('crate'); deck.openCrate(); man.face('delighted'); },
  },
  { label: 'lamp', obj: lamp, p: [2.7, -0.75], face: [3.5, -1.0], r: 1.0, act: () => { sfx.fx('lamp'); const on = shared.uLamp.value < 0.5; shared.uLamp.value = on ? 1 : 0; lamp.userData.pool.visible = on; F.desk.userData.lamp.userData.pool.visible = on; } },
  {
    label: 'look outside', seat: WINDOW, obj: win, p: [WINDOW.x, WINDOW.z], face: [-1.7, -3], r: 1.2, act: () => {
      if (player.st.seated) return player.stand();
      lookOut();
    },
  },
  { label: 'pet the snake', obj: snk.group, p: [0, 0], live: () => snk.head.position, r: 1.1, act: () => { snk.pet(); sfx.fx('hiss'); toast('sss…'); man.face('delighted'); } },
  { label: 'play guitar', seat: GUITAR, obj: gt, p: [GUITAR.x, GUITAR.z], face: [2.55, -1.9], r: 1.0, act: () => (player.st.seated ? player.stand() : player.sit(GUITAR)) },
  { label: 'play keys', seat: KEYS, obj: kb, p: [KEYS.x, KEYS.z], face: [-0.3, -2.6], r: 1.1, act: () => (player.st.seated ? player.stand() : player.sit(KEYS)) },
  { label: 'computer', seat: F.CHAIR, obj: [F.desk, F.chair], p: [F.CHAIR.x, F.CHAIR.z - 0.5], r: 1.0, act: () => (player.st.seated ? player.stand() : player.sit(F.CHAIR)) },
  { label: 'lie down', seat: F.BED, obj: F.bed, p: F.BED.out, face: [F.BED.x, -1.9], r: 1.2, act: () => (player.st.seated ? player.stand() : player.sit(F.BED)) },
  { label: 'books', seat: reading.READ, obj: F.bookshelf, p: [reading.READ.x, reading.READ.z], face: [-3.9, 1.25], r: 1.1, act: reading.open },
  { label: 'watch tv', seat: telly.TV, obj: [F.tv, F.beanBag], p: [telly.TV.x, telly.TV.z - 0.6], face: [2.05, 2.8], r: 1.1, act: () => (player.st.seated ? player.stand() : player.sit(telly.TV)) },
  { label: 'wardrobe', seat: WARD, obj: ward.group, p: [WARD.x, WARD.z], face: [RW / 2, 0], r: 1.1, act: openWardrobe },
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
// annex: bathroom (wash, brush, loo, shower) and kitchen (tea, cook, fridge, eat at the table). The camera swings behind him for the private ones
{
  const A = annex.spots, O = annex.objs, behind = s => () => { player.st.yaw = s.heading + Math.PI; };
  Object.assign(A.LOO, { enter: behind(A.LOO), leave: () => sfx.fx('flush') });
  Object.assign(A.BRUSH, { enter: behind(A.BRUSH) });
  Object.assign(A.SHOWER, { enter: behind(A.SHOWER) });
  Object.assign(A.FRIDGE, { enter: () => sfx.fx('fridge') });
  const use = (label, s, obj) => stations.push({ label, seat: s, obj, p: [s.x, s.z], face: [s.x + Math.sin(s.heading), s.z + Math.cos(s.heading)], r: 1.1, act: () => (player.st.seated ? player.stand() : player.sit(s)) });
  use('wash face', A.WASH, [O.sink, O.mirror]); use('use the loo', A.LOO, O.loo); use('shower', A.SHOWER, O.shower);
  use('make tea', A.TEA, O.hob); use('open the fridge', A.FRIDGE, O.fridge);
  use('cook', A.COOK, O.pan); use('brush teeth', A.BRUSH, O.toothbrush);
  stations.push({ label: 'eat', seat: A.EAT, obj: O.table, p: A.EAT.out, face: [A.EAT.x - 1, A.EAT.z], r: 1.2, act: () => (player.st.seated ? player.stand() : player.sit(A.EAT)) });
}
// his day on India time (routine.js): where he walks to and how he starts each thing
const at = (seat, face) => ({ seat, at: seat.out || [seat.x, seat.z], face, start: () => player.sit(seat) });
const atA = s => ({ ...at(s, [s.x + Math.sin(s.heading), s.z + Math.cos(s.heading)]), at: s.act === 'eat' ? s.out : [s.x, s.z] });   // annex: walks right up to it (the chair: beside it)
const bench = gallery.benches[istNow().day % gallery.benches.length];
const AS = annex.spots;
const routine = makeRoutine({
  player, utility, toast: (...a) => toast(...a), spots: {
    sleep: at(F.BED), work: at(F.CHAIR), keys: at(KEYS), guitar: at(GUITAR),
    window: { ...at(WINDOW), start: lookOut },
    read: { ...at(reading.READ), start: () => reading.read() },
    ...(bench && { bench: at(bench.seat) }),
    tv: { ...at(telly.TV), start: () => { telly.TV.quiet = true; player.sit(telly.TV); telly.TV.quiet = false; } },   // the set on, no remote panel
    dress: { ...at(WARD), start: () => { WARD.twirlAt = performance.now(); player.sit(WARD); } },
    snake: { at: () => [snk.head.position.x, snk.head.position.z], face: () => [snk.head.position.x, snk.head.position.z], start: () => { snk.pet(); sfx.fx('hiss'); toast('sss…'); man.face('delighted'); } },
    records: { at: [1.3, -2.05], face: [1.3, -2.8], start: () => { sfx.fx('crate'); man.face('delighted'); } },
    loo: atA(AS.LOO), wash: atA(AS.WASH), brush: atA(AS.BRUSH), shower: atA(AS.SHOWER),
    tea: atA(AS.TEA), fridge: atA(AS.FRIDGE), cook: atA(AS.COOK), eat: atA(AS.EAT),
  },
});
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
      while (t < at) { player.update(1 / 30, performance.now() / 1000 + t); reading.update(); telly.update(false); annex.update(1 / 30, t, player, man); t += 1 / 30; }
      for (const h of phys.check()) rows.push({ t: at, ...h });
    }
    player.stand();
    const worst = {};
    for (const r of rows) { const k = r.part + ' x ' + r.what; if (!worst[k] || worst[k].depth < r.depth) worst[k] = r; }
    report[spot.act] = Object.values(worst).sort((a, b) => b.depth - a.depth);
  }
  // standing idle and mid-stride (arms swing past the thighs) on open floor
  player.pos.set(0.3, 0, 1.2); man.root.position.set(0.3, 0, 1.2);
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
  for (let k = 0; k < t; k += 1 / 30) { player.update(1 / 30, k); reading.update(); telly.update(false); annex.update(1 / 30, k, player, man); }
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
const sim = {
  utility,
  posture,
  get motives() { return utility.motives; },
  get emotion() { return posture.state; },
  get matrix() { return posture.matrix; },
  evaluate: () => utility.evaluate(player.pos, { current: routine.doing }),
  rank: () => utility.rankActions(player.pos),
  homeostasis: () => utility.homeostasis(),
  spatial: {
    get agentXYZ() { return [+man.root.position.x.toFixed(3), +man.root.position.y.toFixed(3), +man.root.position.z.toFixed(3)]; },
    clearance(p = player.pos) {
      let best = Infinity, box = null;
      for (const b of solids) {
        const dx = p.x - Math.max(b[0], Math.min(p.x, b[2])), dz = p.z - Math.max(b[1], Math.min(p.z, b[3]));
        const d = Math.hypot(dx, dz);
        if (d < best) { best = d; box = b; }
      }
      return { distanceMeters: +best.toFixed(3), bodyClearanceMeters: +(best - 0.26).toFixed(3), nearestSolidAABB: box, bumps: player.st.bumps };
    },
    nearestStations(k = 5, p = player.pos) {
      return stations.map(s => {
        const q = s.live ? [s.live().x, s.live().z] : s.p;
        const d = Math.hypot(q[0] - p.x, q[1] - p.z);
        return { label: s.label, act: s.seat?.act || null, xz: [+q[0].toFixed(2), +q[1].toFixed(2)], distanceMeters: +d.toFixed(2) };
      }).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, k);
    },
    pathTo(stationName) {
      const entry = utility.registry.get(stationName);
      if (!entry) return null;
      const at = typeof entry.at === 'function' ? entry.at() : entry.at;
      const pts = nav.path(player.pos.x, player.pos.z, at[0], at[1]);
      if (!pts) return null;
      let dist = pts.length ? Math.hypot(pts[0][0] - player.pos.x, pts[0][1] - player.pos.z) : 0;
      for (let i = 1; i < pts.length; i++) dist += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      return { station: stationName, waypointsXZ: pts.map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)]), totalWalkMeters: +dist.toFixed(2) };
    },
  },
};
window.dev = { THREE, rooms, fits, ward, openWardrobe, snake: snk, routine, motives: utility.motives, sim, sfx, get dpr() { return dpr; }, doors, gallery, annex, portals, stations, walkTo, nav, solids, man, player, scene, camera, room, phys, verifyActs, ACTS, GUITAR_AT, render: () => comp.render(scene, camera), renderer, reading, telly, shoot, sky: ph => { lastSky = ph; win.userData.sky.material.uniforms.uMap.value = skies[ph] ||= skyTex(ph); } };                              // dev
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
  if (best) $('plabel').textContent = player.st.seated && best.seat === player.st.seated ? (best.seat.lying ? 'get up' : ['think', 'keys', 'guitar', 'read', 'tv', 'pin', 'wardrobe', 'wash', 'loo', 'shower', 'tea', 'fridge'].includes(best.seat.act) ? 'stop' : 'stand up') : best.label;
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
// phones: the deck / tv player dock at the top; the toast + desk link stack under whichever is there, however tall
// (on a phone on its side the open deck is a left column instead, and the stack keeps to the right half)
const deckEl = $('deck'), tvEl = $('tvp'), SIDE = matchMedia('(pointer: coarse) and (orientation: landscape) and (max-height: 540px)');
const deckTop = () => {
  const b = el => (el && !el.hidden && el.offsetWidth ? el.getBoundingClientRect().bottom : 0);
  const bottom = TOUCH ? Math.max(b(tvEl), SIDE.matches && !deckEl.classList.contains('mini') ? 0 : b(deckEl)) : 0;
  document.documentElement.style.setProperty('--deck-bot', bottom + 'px');
};
{
  const ro = new ResizeObserver(deckTop), mo = new MutationObserver(deckTop);
  for (const e of [deckEl, tvEl]) if (e) { ro.observe(e); mo.observe(e, { attributes: true, attributeFilter: ['hidden', 'class'] }); }
  addEventListener('resize', deckTop); deckTop();
}
// panels never sit on the man: while a panel covers the middle of the screen, the camera's view is shifted so he stands
// in the middle of what is left (the free area), eased in and out
const vo = { x: 0, y: 0 };
function framePanels(dt) {
  const vw = innerWidth, vh = innerHeight; let L = 0, R = vw, T = TOUCH ? 62 : 0, B = vh;
  if (player.st.view !== 'first') for (const el of [deckEl, tvEl, $('card')]) {
    if (!el || el.hidden || !el.offsetWidth || el.classList.contains('mini')) continue;
    const r = el.getBoundingClientRect();
    const wide = r.width > vw * 0.6;   // a sheet across the screen counts even when it only takes the bottom quarter
    if (r.right < vw * 0.3 || r.left > vw * 0.7 || (!wide && (r.bottom < vh * 0.3 || r.top > vh * 0.7))) continue;   // not over the middle
    if (wide) { if (r.top + r.height / 2 < vh / 2) T = Math.max(T, r.bottom + 8); else B = Math.min(B, r.top - 8); }
    else if (r.left + r.width / 2 < vw / 2) L = Math.max(L, r.right + 8); else R = Math.min(R, r.left - 8);
  }
  // (a sheet from below: the focus is his neck, so it sits a third of the way down what is left and his body fits above it)
  const tx = (L + R) / 2 - vw / 2, ty = T + (B - T) * (B < vh ? 0.36 : 0.5) - vh / 2, k = 1 - Math.exp(-8 * dt);
  vo.x += (tx - vo.x) * k; vo.y += (ty - vo.y) * k;
  if (Math.abs(vo.x) < 0.5 && Math.abs(vo.y) < 0.5 && !tx && !ty) { if (camera.view?.enabled) camera.clearViewOffset(); }
  else camera.setViewOffset(vw, vh, -vo.x, -vo.y, vw, vh);
}
// desktop: the deck / tv player hold the bottom-left corner, so the action prompt and the desk link centre in the
// floor space to their right, or stack above the panel when the window is too narrow for that. Never on top of it
function floats() {
  if (TOUCH) return;
  const panels = [deckEl, $('tvp')].filter(e => e && !e.hidden && e.offsetWidth).map(e => e.getBoundingClientRect());
  const right = Math.max(0, ...panels.map(b => b.right)), top = Math.min(innerHeight, ...panels.map(b => b.top));
  const items = [$('prompt'), infLink].filter(e => !e.hidden);
  const w = Math.max(0, ...items.map(e => e.offsetWidth)), edge = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--edge')) || 16;
  const side = w + 2 * edge <= innerWidth - right - edge;
  let y = side ? edge : innerHeight - top + 12;
  for (const e of items) { e.style.left = (side ? right + (innerWidth - right) / 2 : innerWidth / 2) + 'px'; e.style.bottom = y + 'px'; y += e.offsetHeight + 10; }
}
{ const ro = new ResizeObserver(floats); for (const e of [deckEl, $('tvp'), $('prompt'), infLink]) if (e) ro.observe(e); addEventListener('resize', floats); }
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
  const a = annex.zoneAt(p); if (a) return a.name;
  const z = gallery.zoneAt(p);
  return z ? (z.name === 'corridor' ? 'gallery →' : 'gallery · ' + z.title) : 'gallery';
}

// HUD: the clock chip (IST, little face, night colours after dark) and the room sign, which opens every place he can go
const PLACES = () => [
  { name: 'the room', dot: PAL.mag, at: [0.3, 1.2] },
  ...annex.zones.map((z, i) => ({ name: z.name, dot: [PAL.teal, '#2B5C2E'][i], at: z.at })),
  ...gallery.zones.filter(z => z.entry).map((z, i) => ({ name: 'gallery · ' + z.title, short: z.title, dot: [PAL.spiral, '#2FB59A', PAL.orange, '#7B6CF6', PAL.red][i % 5], at: [z.entry.x, z.entry.z] })),
];
let lastClock = '';
function hudClock() {
  const { h, m } = istNow(), k = `${h}:${m}`; if (k === lastClock) return; lastClock = k;
  const el = $('clock'); $('clk').textContent = istClock();
  el.querySelector('.hh').style.transform = `rotate(${((h % 12) + m / 60) * 30}deg)`;
  el.querySelector('.mh').style.transform = `rotate(${m * 6}deg)`;
  el.classList.toggle('night', night()); el.setAttribute('aria-label', `${istClock()} in India`);
}
// the window follows India time: dawn 5-7, day 7-17, dusk 17-19, night after
const skyPhase = h => h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'dusk' : 'night';
const skies = {}; let lastSky = '';
function hudSky() {
  const ph = skyPhase(istNow().h); if (ph === lastSky) return; lastSky = ph;
  annex.sky.material.uniforms.uMap.value = win.userData.sky.material.uniforms.uMap.value = skies[ph] ||= skyTex(ph);
}
function hudPlace(w) {
  $('lbl').textContent = w;
  const p = PLACES().find(p => p.name === w); $('where').style.setProperty('--dot', p ? p.dot : PAL.spiral);
}
function placesMenu(open = $('places').hidden) {
  const m = $('places'), b = $('where'); m.hidden = !open; b.setAttribute('aria-expanded', open);
  if (!open) return;
  const here = whereAmI(player.pos);
  m.replaceChildren(...PLACES().map(p => {
    const e = document.createElement('button'); e.setAttribute('role', 'menuitem'); if (p.name === here) e.className = 'here';
    e.innerHTML = `<i class="dot" style="background:${p.dot}"></i><span></span>${p.name === here ? '<small>you are here</small>' : ''}`;
    e.querySelector('span').textContent = p.short || p.name;
    e.onclick = () => { placesMenu(false); if (p.name === here) return; if (player.st.seated) player.stand(); showMarker(player.goTo(p.at[0], p.at[1])); };
    return e;
  }));
  m.querySelector('button')?.focus({ preventScroll: true });
}
$('where').addEventListener('click', e => { e.stopPropagation(); placesMenu(); });
addEventListener('pointerdown', e => { if (!$('places').hidden && !e.target.closest('#places, #where')) placesMenu(false); }, true);
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('places').hidden) placesMenu(false); });

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
// turning the phone: iOS reports the new size late, so settle once more, and start the new layout with the deck folded
addEventListener('orientationchange', () => setTimeout(() => { resize(); deckTop(); if (TOUCH) deckEl.classList.add('mini'); }, 350));

// adaptive resolution. The frame budget is the display's own cadence (the fastest frames we see), not 60 fps: in
// iOS Low Power Mode Safari runs at 30 fps whatever the load, and chasing 60 there only blurred the picture. Every
// ~1.5 s: dropping frames against that cadence -> step the pixel ratio down; if a step down bought nothing, put it
// back and stop trying lower; comfortably inside it for a while -> step back up.
const perf = { sum: 0, n: 0, calm: 0, best: 1, tried: null };
function adapt(raw) {
  if (raw > 0.25) return;                                       // tab was hidden / stalled: not a real frame
  perf.best = Math.min(perf.best * 1.0005, raw);                // display cadence, drifts up if the cap changes
  perf.sum += raw; perf.n++;
  if (perf.sum < 1.5) return;
  const avg = perf.sum / perf.n, beat = Math.max(perf.best, 1 / 120); perf.sum = perf.n = 0;
  let next = dpr;
  if (perf.tried && avg > perf.tried.avg * 0.92) { next = perf.tried.dpr; DPR_MIN = next; perf.tried = null; }   // no gain
  else if (avg > beat * 1.3 && dpr > DPR_MIN) { perf.tried = { dpr, avg }; next = Math.max(DPR_MIN, dpr - 0.2); perf.calm = 0; }
  else { perf.tried = null; if (avg < beat * 1.08 && ++perf.calm >= 3) { next = Math.min(DPR_MAX, dpr + 0.1); perf.calm = 0; } }
  if (Math.abs(next - dpr) > 0.01) { dpr = next; renderer.setPixelRatio(dpr); }
}

// first frame: compile every shader up front so walking into a new hall does not hitch, then open the door
comp.render(scene, camera);
player.st.frozen = !!window.boot;                              // no walking about behind the loading screen
const arrived = routine.arrive();                              // he's already at whatever the hour says
if (night()) { shared.uLamp.value = 1; lamp.userData.pool.visible = true; F.desk.userData.lamp.userData.pool.visible = true; }
boot.ready(() => { player.st.frozen = false; toast(arrived, 5000); });

const clock = new THREE.Clock();
let tick = -1, lastWhere = '', boilNow = false;
renderer.setAnimationLoop(() => {
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05), t = clock.elapsedTime;
  adapt(raw);
  shared.uTime.value = t;
  const k = Math.floor(t * 12);                                 // boil on twos
  if (k !== tick) { tick = k; boilNow = true; shared.uBoil.value = (k % 3) + 1; comp.mat.uniforms.uSeed.value = (k % 3) * 7.31; }
  if (!audio.paused) shelf.userData.spin.rotation.y = t * 3.5;     // 33⅓-ish; stops where it was when paused
  const arm = shelf.userData.arm; arm.rotation.y += ((audio.paused ? 0 : ARM_PLAY) - arm.rotation.y) * (1 - Math.exp(-2.5 * dt));   // tonearm swings onto the record
  player.update(dt, t);
  framePanels(dt);
  doors.update(dt);
  ward.update(dt, t);
  annex.update(dt, t, player, man);
  reading.update(); telly.update(boilNow); boilNow = false;
  snk.update(dt, t, player.pos);
  if (marker.visible) { marker.scale.setScalar(1 + Math.sin(t * 6) * 0.12); if (!player.auto.pts) marker.visible = false; }
  gallery.update(player.pos);
  routine.update(dt, { busy: !$('card').hidden || (player.st.seated === telly.TV && !routine.mine) || portals.busy });
  pickStation();
  thought();
  const w = whereAmI(player.pos);
  if (w !== lastWhere) { lastWhere = w; hudPlace(w); }
  hudClock(); hudSky();
  sfx.tick(dt, { player, emotion: posture.state, musicPlaying: !audio.paused, hard: w !== 'the room', night: night(), pressed: telly.TV.pressed, tvOn: telly.on, portal: portals.busy, doors: doors.all });
  comp.render(scene, camera);
});
