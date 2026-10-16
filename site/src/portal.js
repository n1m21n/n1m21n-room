// Portals: the timeline sends him to a hall through one. A tall oval of swirling riso spiral (the window's night sky,
// in the room's pink / blue / yellow on ink) opens in front of him with a torn-paper rim; he steps in, the screen
// spirals shut, and he steps out of a twin portal at the hall's door, which then folds away.
//   go(x, z, heading)  ->  promise that resolves once he is out on the other side
import * as THREE from 'three';
import { shared } from './look.js';

const R = 0.62, TALL = 1.55;                                           // oval half-width, height scale (2 m tall)
const vert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = /* glsl */`
  uniform float uTime; uniform float uOpen; uniform float uSeed; uniform float uFloor;
  varying vec2 vUv;
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p), a = atan(p.y, p.x);
    // torn-paper rim: the edge wobbles with angle and boils on twos like the rest of the print
    float tear = 0.93 + 0.05 * vnoise(vec2(a * 5.0 + uSeed, uSeed * 0.7)) + 0.02 * vnoise(vec2(a * 23.0, uSeed));
    float edge = tear * uOpen;
    if (r > edge) discard;
    float k = r / max(edge, 1e-3);
    vec3 ink = vec3(0.039, 0.024, 0.094), paper = vec3(0.945, 0.914, 0.824);
    if (k > 0.9) { gl_FragColor = vec4(ink, 1.0); return; }                                  // ink rim
    if (k > 0.82) { gl_FragColor = vec4(0.965, 0.886, 0.478, 1.0); return; }                  // yellow keyline
    // log spiral, three arms, winding inward over time
    float s = fract(log(k + 0.02) * 1.6 - a / 6.2832 * 3.0 + uTime * 0.45);
    vec3 c = s < 0.25 ? vec3(0.878, 0.212, 0.561) : s < 0.5 ? vec3(0.180, 0.231, 0.859) : s < 0.75 ? vec3(0.965, 0.886, 0.478) : vec3(0.353, 0.133, 0.722);
    c = mix(ink, c, smoothstep(0.05, 0.32, k));                                                // a dark eye in the middle
    float star = step(0.993, hash(floor(p * 40.0 + vec2(uTime * 2.0, 0.0))));               // specks of paper, like the window's stars
    c = mix(c, paper, star * step(0.2, k));
    gl_FragColor = vec4(c, 1.0);
  }`;

export function makePortals({ scene, player, man, camera }) {
  function portal() {
    const g = new THREE.Group();
    const u = { uTime: shared.uTime, uOpen: { value: 0 }, uSeed: shared.uBoil, uFloor: { value: 0 } };
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), mat);
    disc.scale.y = TALL; disc.position.y = R * TALL + 0.02; disc.userData.phys = 'none'; g.add(disc);
    // the spiral spills onto the floor in front and behind (squashed puddle)
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), mat);
    pool.rotation.x = -Math.PI / 2; pool.scale.set(1.25, 0.55, 1); pool.position.y = 0.012; pool.userData.phys = 'none'; g.add(pool);
    g.visible = false; scene.add(g);
    return { g, u };
  }
  const src = portal(), dst = portal();

  // full-screen spiral wipe (DOM) that closes onto / opens from a point on screen
  const wipe = document.createElement('div'); wipe.id = 'warp'; wipe.hidden = true; wipe.innerHTML = '<i></i>'; document.body.append(wipe);
  const onScreen = v => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * 100, (1 - p.y) / 2 * 100]; };
  const tween = (ms, f) => new Promise(res => { const t0 = performance.now(); (function step() { const k = Math.min(1, (performance.now() - t0) / ms); f(k); k < 1 ? requestAnimationFrame(step) : res(); })(); });
  const ease = k => 1 - Math.pow(1 - k, 3), back = k => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
  const walk = (x, z) => new Promise(res => { if (!player.goTo(x, z, { done: res })) res(); });
  const wipeTo = (pt, from, to, ms) => { wipe.hidden = false; return tween(ms, k => { const r = from + (to - from) * ease(k); wipe.style.clipPath = `circle(${r}vmax at ${pt[0]}% ${pt[1]}%)`; }); };

  let busy = false;
  async function go(x, z, heading) {
    if (busy) return; busy = true;
    if (player.st.seated) player.stand();
    // open in front of him, toward open floor (the room's middle), 1.1 m out
    const p = player.pos, dx = 0.2 - p.x, dz = 0.4 - p.z, L = Math.hypot(dx, dz) || 1;
    const px = p.x + dx / L * 1.1, pz = p.z + dz / L * 1.1, face = Math.atan2(dx, dz);
    src.g.position.set(px, 0, pz); src.g.rotation.y = face; src.g.visible = true;
    player.st.turnTo = face;
    await tween(520, k => { src.u.uOpen.value = back(k); });
    await walk(px, pz);                                                  // straight into it
    await wipeTo(onScreen(new THREE.Vector3(px, 1, pz)), 0, 150, 420);
    // other side: twin portal at the hall door, he is standing in it, camera snapped in front-quarter
    src.g.visible = false; src.u.uOpen.value = 0;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    dst.g.position.set(x, 0, z); dst.g.rotation.y = heading; dst.g.visible = true; dst.u.uOpen.value = 1;
    player.cancelAuto(); player.pos.set(x, 0, z); player.st.heading = heading; player.st.turnTo = null;
    player.st.yaw = heading - 0.55; player.st.pitch = 0.3;
    for (let i = 0; i < 40; i++) player.update(1 / 30, performance.now() / 1000);   // settle the chase camera
    await wipeTo(onScreen(new THREE.Vector3(x, 1, z)), 150, 0, 480);
    wipe.hidden = true;
    await walk(x + fx * 1.3, z + fz * 1.3);
    await tween(420, k => { dst.u.uOpen.value = 1 - ease(k); });
    dst.g.visible = false; busy = false;
  }
  return { go, get busy() { return busy; } };
}
