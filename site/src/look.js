// "riso room" look: flat 2-band toon fills (fill plate) + boiling ink hulls (ink plate),
// composited like lib/riso.py Plates.compose: fill plate misregistered, uneven coverage, paper, grain.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const INK_LAYER = 1;
export const CUT_LAYER = 2;                              // alpha cut-outs (2D sprites): colour in the fill pass, black mask in the ink pass
export const shared = {
  uTime: { value: 0 },
  uBoil: { value: 0 },                                   // re-seeded on twos (12 fps)
  uKeyDir: { value: new THREE.Vector3(-0.55, 0.75, 0.45).normalize() },
  uLampPos: { value: new THREE.Vector3(3.2, 1.8, -1.0) },  // lamp shade
  uLamp: { value: 0 },                                   // shader pool off until the lamp station; floor decal carries it
  uShadeCol: { value: new THREE.Color('#140B52') },
  uWarm: { value: new THREE.Color('#FFD27A') },
};

// skinning chunks are no-ops on plain meshes (USE_SKINNING is defined only for SkinnedMesh)
const toonVert = /* glsl */`
  #include <common>
  #include <skinning_pars_vertex>
  varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vRest; varying vec3 vON;
  void main(){
    vUv = uv; vRest = position; vON = normal;          // rest-pose position: cloth patterns stick to the body
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    vec4 w = modelMatrix * vec4(transformed,1.0);
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * objectNormal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

// ---------- material marks: how each thing is made, drawn as flat riso marks in its own colour (object space, so they
// stay put on the object; anti-aliased with fwidth and faded out where they would get denser than the pixels)
export const MATS = { wood: 1, fabric: 2, plaster: 3, metal: 4, clay: 5, cork: 6, leaf: 7, vinyl: 8, lino: 9, paint: 10, plastic: 11, blade: 12, glaze: 13 };
const matGLSL = /* glsl */`
  float th(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(th(i), th(i + vec3(1,0,0)), f.x), mix(th(i + vec3(0,1,0)), th(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(th(i + vec3(0,0,1)), th(i + vec3(1,0,1)), f.x), mix(th(i + vec3(0,1,1)), th(i + vec3(1,1,1)), f.x), f.y), f.z); }
  // 1 on a line of half-width w (in periods), crisp edge, fades to 0 when the period gets near pixel size
  float ln(float x, float w){ float a = fwidth(x); float d = abs(fract(x + 0.5) - 0.5);
    return (1.0 - smoothstep(w - a * 0.6, w + a * 0.6, d)) * (1.0 - smoothstep(0.18, 0.4, a)); }
  float dots(vec3 p, float k){ vec3 q = floor(p); return step(k, th(q)) * (1.0 - smoothstep(0.3, 0.7, length(fwidth(p)))); }
  vec2 plane(vec3 p, vec3 n){ vec3 a = abs(n); return a.x > a.y && a.x > a.z ? p.yz : a.y > a.z ? p.xz : p.xy; }
  vec3 material(vec3 b, vec3 p, vec3 n){
    int m = int(uMat + 0.5); float k = uMatAmt;
    float along = uMatAxis < 0.5 ? p.x : uMatAxis < 1.5 ? p.y : p.z;
    vec2 o = uMatAxis < 0.5 ? p.yz : uMatAxis < 1.5 ? p.xz : p.xy;
    vec3 dark = b * 0.74, lite = min(b * 1.18 + 0.03, vec3(1.0));
    if (m == 1) {                                   // wood: growth rings around an off-centre log axis -> streaks on long faces, arcs on end grain
      float r = length(o + vec2(0.31, -0.47)) * 26.0 + n3(vec3(o * 9.0, along * 1.4)) * 1.6 + n3(vec3(o * 40.0, along * 0.6)) * 0.25;
      b = mix(b, dark, ln(r, 0.13) * 0.85 * k);
      b = mix(b, dark, dots(vec3(o * 260.0, along * 18.0), 0.93) * 0.6 * k);          // pores
    } else if (m == 2) {                            // fabric: plain weave, over-under threads + slubs
      vec2 q = plane(p, n) * 70.0;
      float ch = mod(floor(q.x) + floor(q.y), 2.0);
      float t = mix(fract(q.y), fract(q.x), ch);
      float fade = 1.0 - smoothstep(0.15, 0.35, length(fwidth(q)));
      b = mix(b, dark, (1.0 - sin(t * 3.1416)) * 0.55 * fade * k);
      b = mix(b, lite, step(0.72, n3(vec3(q.x * 0.08, q.y * 1.0, 0.0))) * 0.35 * fade * k);
    } else if (m == 3) {                            // plaster: trowel mottle + pinholes
      float mo = n3(p * 2.2) * 0.6 + n3(p * 9.0) * 0.4;
      b = mix(b, mo > 0.5 ? lite : dark, smoothstep(0.56, 0.62, abs(mo - 0.5) + 0.5) * 0.35 * k);
      b = mix(b, dark, dots(p * 90.0, 0.975) * 0.7 * k);
    } else if (m == 4) {                            // metal: brushed streaks along the part
      float s = n3(vec3(o * 420.0, along * 3.0));
      b = mix(b, s > 0.5 ? lite : dark, smoothstep(0.62, 0.7, abs(s - 0.5) + 0.5) * 0.5 * k);
    } else if (m == 5 || m == 13) {                 // clay: wheel-thrown rings + grog flecks (glaze: fewer, softer)
      float g = m == 13 ? 0.4 : 1.0;
      b = mix(b, dark, ln(p.y * 38.0 + n3(p * 4.0) * 0.8, 0.07) * 0.5 * g * k);
      b = mix(b, dark, dots(p * 110.0, 0.95) * 0.65 * g * k);
      b = mix(b, lite, dots(p * 70.0 + 9.0, 0.97) * 0.6 * k);
    } else if (m == 6) {                            // cork: packed granules
      float g = n3(p * 140.0);
      b = mix(b, g > 0.5 ? lite : dark, step(0.62, abs(g - 0.5) + 0.5) * 0.6 * k);
    } else if (m == 7) {                            // leaf (long axis x): midrib + paired side veins, drawn lighter
      float mid = 1.0 - smoothstep(0.005, 0.011, abs(p.z));
      float side = ln(p.x * 9.0 - abs(p.z) * 7.0, 0.06) * step(0.01, abs(p.z));
      b = mix(b, lite * 1.08, max(mid, side * 0.8) * k);
    } else if (m == 8) {                            // vinyl: concentric grooves, sheen ring
      float r = length(p.xz);
      b = mix(b, vec3(0.22, 0.2, 0.32), ln(r * 160.0, 0.18) * 0.6 * step(0.065, r) * k);
    } else if (m == 9) {                            // lino tile: scuffs + flecks
      b = mix(b, dark, smoothstep(0.66, 0.72, n3(p * vec3(1.5, 9.0, 1.5))) * 0.25 * k);
      b = mix(b, lite, dots(p * 70.0, 0.96) * 0.45 * k);
    } else if (m == 10) {                           // painted wood: brush strokes along the part, grain ghosting through
      float s = n3(vec3(o * 120.0, along * 2.0));
      b = mix(b, s > 0.5 ? lite : dark, smoothstep(0.64, 0.7, abs(s - 0.5) + 0.5) * 0.3 * k);
    } else if (m == 11) {                           // moulded plastic: fine sand-blast stipple
      b = mix(b, dark, dots(p * 160.0, 0.9) * 0.3 * k);
    } else if (m == 12) {                           // snake-plant blade: wavy cross bands
      b = mix(b, lite * 1.05, ln(p.y * 7.0 + sin(atan(p.x, p.z) * 3.0) * 0.2 + n3(p * 6.0) * 0.5, 0.16) * 0.7 * k);
    }
    return b;
  }`;

const toonFrag = /* glsl */`
  uniform vec3 uColor; uniform sampler2D uMap; uniform float uHasMap; uniform float uUnlit;
  uniform vec3 uKeyDir; uniform vec3 uLampPos; uniform float uLamp; uniform vec3 uShadeCol; uniform vec3 uWarm;
  uniform float uShadeAmt; uniform float uRestUV; uniform vec2 uRestScale;
  uniform float uMat; uniform float uMatAxis; uniform float uMatScale; uniform float uMatAmt;
  varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vRest; varying vec3 vON;
  ${matGLSL}
  void main(){
    vec3 base = uColor;
    vec2 uv = vUv;
    if (uRestUV > 0.5) uv = vec2(atan(vRest.x, vRest.z) / 6.2832 + 0.5, vRest.y) * uRestScale;   // cylindrical, rest pose
    if (uHasMap > 0.5) base = texture2D(uMap, uv).rgb;
    if (uUnlit > 0.5) { gl_FragColor = vec4(base,1.0); return; }
    if (uMat > 0.5) base = material(base, vRest * uMatScale, normalize(vON));
    vec3 n = normalize(vN);
    float key = dot(n, uKeyDir);
    float lit = smoothstep(0.02, 0.08, key);                       // one hard terminator: light plane / shadow plane
    vec3 shade = mix(base, uShadeCol, uShadeAmt) * vec3(0.92, 0.9, 1.08);   // hue-shifted toward indigo
    vec3 c = mix(shade, base, lit);
    vec3 L = uLampPos - vW; float d = length(L);
    float lampL = max(dot(n, L / d), 0.0) * clamp(1.0 - d / 2.6, 0.0, 1.0);
    c = mix(c, c * 0.55 + uWarm * 0.6, step(0.32, lampL) * 0.45 * uLamp);    // banded warm pool
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

// shadeCol: the part's own shadow colour (2D man: skin_sh, pants_sh ...); default the room's indigo
// mat: a MATS name; matAxis: 'x' | 'y' | 'z' the grain / brush direction in object space; matScale: pattern zoom
export function toon(color, { map = null, unlit = false, shade = 0.5, shadeCol = null, restUV = null, mat = null, matAxis = 'x', matScale = 1, matAmt = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uColor: { value: new THREE.Color(color || '#ffffff') },
      uMap: { value: map }, uHasMap: { value: map ? 1 : 0 }, uUnlit: { value: unlit ? 1 : 0 }, uShadeAmt: { value: shade },
      uRestUV: { value: restUV ? 1 : 0 }, uRestScale: { value: new THREE.Vector2(...(restUV || [1, 1])) },
      uMat: { value: MATS[mat] || 0 }, uMatAxis: { value: 'xyz'.indexOf(matAxis) }, uMatScale: { value: matScale }, uMatAmt: { value: matAmt },
      ...(shadeCol ? { uShadeCol: { value: new THREE.Color(shadeCol) } } : {}),
    },
    vertexShader: toonVert, fragmentShader: toonFrag,
  });
}

// inverted hull; width wobbles with a boil seed so lines "re-draw" on twos like the 2D film
const hullVert = /* glsl */`
  #include <common>
  #include <skinning_pars_vertex>
  uniform float uW; uniform float uBoil;
  float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)) + uBoil*17.13) * 43758.5453); }
  void main(){
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    vec4 w = modelMatrix * vec4(transformed,1.0);
    vec3 n = normalize(mat3(modelMatrix) * objectNormal);
    float j = 0.65 + 0.7 * h(floor(position * 9.0));               // seeded in rest space so the boil doesn't crawl as he moves
    vec4 v = viewMatrix * w;
    float persp = clamp(-v.z / 6.0, 0.6, 1.6);                     // keep line weight even across depth
    w.xyz += n * uW * j * persp;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const hullFrag = /* glsl */`void main(){ gl_FragColor = vec4(1.0); }`;

// live: share the mesh's own geometry (it must already be seamless with smooth normals), for meshes deformed on the CPU
export function addInk(mesh, width = 0.012, { live = false } = {}) {
  let g = mesh.geometry;
  if (!live) {
    g = g.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
    g = mergeVertices(g, 1e-4);
    g.computeVertexNormals();                             // smooth normals so hulls don't crack at box corners
  }
  const m = new THREE.ShaderMaterial({
    uniforms: { uW: { value: width }, uBoil: shared.uBoil },
    vertexShader: hullVert, fragmentShader: hullFrag, side: THREE.BackSide,
  });
  let hull;
  if (mesh.isSkinnedMesh) { hull = new THREE.SkinnedMesh(g, m); hull.bind(mesh.skeleton, mesh.bindMatrix); }
  else hull = new THREE.Mesh(g, m);
  hull.layers.set(INK_LAYER);
  hull.renderOrder = 1;
  mesh.add(hull);
  return mesh;
}

export function mesh(geo, color, opts = {}) {
  const m = new THREE.Mesh(geo, toon(color, opts));
  if (opts.ink !== false) addInk(m, opts.ink || 0.012);
  return m;
}

// ---------- compositor (Plates.compose in GLSL) ----------
const compFrag = /* glsl */`
  uniform sampler2D tFill; uniform sampler2D tInk; uniform vec2 uRes; uniform float uSeed; uniform vec2 uOff;
  uniform vec3 uPaper; uniform vec3 uInk; uniform float uCoverage; uniform float uGrain;
  varying vec2 vUv;
  // sine-free hash (Hoskins): sin() of large screen coords loses precision on GPUs and shows as blocky noise
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031 + uSeed * 0.0137); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
  void main(){
    vec2 px = 1.0 / uRes;
    vec4 F = texture2D(tFill, vUv - uOff * px);              // misregistered colour plate
    float K = texture2D(tInk, vUv).r;
    float mott = vnoise(gl_FragCoord.xy / 7.0) * 0.6 + vnoise(gl_FragCoord.xy / 31.0) * 0.4;   // fine tooth + soft ink coverage
    float speck = step(0.985, hash(gl_FragCoord.xy));
    float cover = clamp(1.0 - uCoverage * mott - 0.7 * speck * uCoverage, 0.0, 1.0);
    vec3 c = mix(uPaper, F.rgb, cover * F.a);
    c = mix(c, uInk, K * (1.0 - 0.2 * speck));
    float gr = hash(floor(gl_FragCoord.xy)) - 0.5;
    c += gr * 0.03 * uGrain;
    gl_FragColor = vec4(c, 1.0);
  }`;

export function makeCompositor(renderer, { samples = 4 } = {}) {   // phones: 2 samples (the ink hulls still read clean)
  const size = new THREE.Vector2();
  const mk = () => new THREE.WebGLRenderTarget(1, 1, { samples, type: THREE.HalfFloatType });
  const rtF = mk(), rtK = mk();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tFill: { value: rtF.texture }, tInk: { value: rtK.texture }, uRes: { value: new THREE.Vector2() },
      uSeed: { value: 0 }, uOff: { value: new THREE.Vector2(3, -2) },
      uPaper: { value: new THREE.Color('#F1E9D2') }, uInk: { value: new THREE.Color('#0B0B0B') },
      uCoverage: { value: 0.07 }, uGrain: { value: 1 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }',
    fragmentShader: compFrag, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  const black = new THREE.Color(0, 0, 0);
  let inked = null, age = 0;

  return {
    mat,
    render(scene, camera) {
      renderer.getDrawingBufferSize(size);
      if (rtF.width !== size.x || rtF.height !== size.y) { rtF.setSize(size.x, size.y); rtK.setSize(size.x, size.y); }
      mat.uniforms.uRes.value.copy(size);
      const dpr = renderer.getPixelRatio();
      mat.uniforms.uOff.value.set(3 * dpr / 2, -2 * dpr / 2);
      // fill plate
      camera.layers.set(0); camera.layers.enable(CUT_LAYER);
      renderer.setRenderTarget(rtF); renderer.setClearColor(black, 0); renderer.clear(); renderer.render(scene, camera);
      // ink plate: fills write depth only, then hulls in white
      renderer.setRenderTarget(rtK); renderer.setClearColor(black, 1); renderer.clear();
      camera.layers.set(0);
      scene.overrideMaterial = depthOnly; renderer.render(scene, camera); scene.overrideMaterial = null;
      const ac = renderer.autoClear; renderer.autoClear = false;
      const bg = scene.background; scene.background = null;
      camera.layers.set(CUT_LAYER);                     // sprites hide the ink behind them, keep their own ink
      if (!inked || ++age > 60) { inked = []; age = 0; scene.traverse(o => { if (o.userData.inkMat) inked.push(o); }); }   // rescan once a second
      const swaps = inked.map(o => { const m = o.material; o.material = o.userData.inkMat; return m; });
      renderer.render(scene, camera);
      inked.forEach((o, i) => { o.material = swaps[i]; });
      camera.layers.set(INK_LAYER);
      renderer.render(scene, camera);
      scene.background = bg; renderer.autoClear = ac;
      camera.layers.set(0);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
    },
  };
}
