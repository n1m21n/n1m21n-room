// Look test: one corner of the room in the riso look; man A (2D puppet) vs B (3D toon).
import * as THREE from 'three';
import { makeCompositor, shared } from './look.js';
import { buildRoom, stool, snake, puppet } from './room.js';
import { man3d } from './man.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const comp = makeCompositor(renderer);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
const { room, shelf } = buildRoom();
scene.add(room);

const snk = snake(); snk.position.set(0.05, 0, 1.25); scene.add(snk);

// two stations so "both" can sit A and B side by side
const spotA = new THREE.Group(), spotB = new THREE.Group();
spotB.add(stool());                      // the 2D drawing already includes its stool
const card = puppet('/media/sprites/man-seated.webp', 1.62);
spotA.add(card);
const m3 = man3d(); m3.position.y = 0; spotB.add(m3);
scene.add(spotA, spotB);

function setMode(m) {
  spotA.visible = m !== 'B'; spotB.visible = m !== 'A';
  spotA.position.set(m === 'AB' ? -0.85 : -0.2, 0, 0.1);
  spotB.position.set(m === 'AB' ? 0.75 : -0.2, 0, 0.1);
  for (const b of document.querySelectorAll('#seg button')) b.classList.toggle('on', b.dataset.m === m);
  document.getElementById('lbl').textContent = { A: 'a · signed-off 2d drawing on a card', B: 'b · 3d toon puppet', AB: 'a (left) · b (right)' }[m];
  history.replaceState(null, '', '?man=' + m);
}
document.getElementById('seg').addEventListener('click', e => e.target.dataset.m && setMode(e.target.dataset.m));
setMode(new URLSearchParams(location.search).get('man') || 'AB');

// diorama orbit: limited yaw/pitch, pinch / wheel zoom
const target = new THREE.Vector3(0, 1.05, -0.4);
const orbit = { yaw: 0, pitch: 0.2, dist: 7.6 };
const lim = { yaw: [-0.75, 0.75], pitch: [0.05, 0.6], dist: [3.2, 9.5] };
const clamp = (x, [a, b]) => Math.min(b, Math.max(a, x));
const ptrs = new Map(); let pinch0 = 0, dist0 = 0;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); });
canvas.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); pinch0 = 0; });
canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch0 = 0; });
canvas.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const [px, py] = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 1) {
    orbit.yaw = clamp(orbit.yaw - (e.clientX - px) * 0.005, lim.yaw);
    orbit.pitch = clamp(orbit.pitch + (e.clientY - py) * 0.004, lim.pitch);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (!pinch0) { pinch0 = d; dist0 = orbit.dist; }
    orbit.dist = clamp(dist0 * pinch0 / d, lim.dist);
  }
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey) orbit.dist = clamp(orbit.dist * (1 + e.deltaY * 0.01), lim.dist);        // trackpad pinch
  else { orbit.yaw = clamp(orbit.yaw + e.deltaX * 0.003, lim.yaw); orbit.dist = clamp(orbit.dist * (1 + e.deltaY * 0.0015), lim.dist); }
}, { passive: false });

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 50 : 35;                              // phones: wider lens so the corner fits
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const clock = new THREE.Clock();
let tick = -1;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  shared.uTime.value = t;
  const k = Math.floor(t * 12);                               // boil on twos
  if (k !== tick) { tick = k; shared.uBoil.value = (k % 3) + 1; comp.mat.uniforms.uSeed.value = (k % 3) * 7.31; }
  shelf.userData.spin.rotation.y = t * 3.5;
  snk.children.at(-1).rotation.z = Math.sin(t * 2) * 0.15;  // head sway
  m3.userData.head.rotation.z = Math.sin(t * 1.3) * 0.05;

  const cp = Math.cos(orbit.pitch);
  camera.position.set(target.x + Math.sin(orbit.yaw) * cp * orbit.dist, target.y + Math.sin(orbit.pitch) * orbit.dist, target.z + Math.cos(orbit.yaw) * cp * orbit.dist);
  camera.lookAt(target);
  card.rotation.y = Math.atan2(camera.position.x - card.getWorldPosition(new THREE.Vector3()).x, camera.position.z - card.getWorldPosition(new THREE.Vector3()).z);
  comp.render(scene, camera);
});
