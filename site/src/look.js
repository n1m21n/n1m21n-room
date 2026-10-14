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
  varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vRest;
  void main(){
    vUv = uv; vRest = position;                        // rest-pose position: cloth patterns stick to the body
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    vec4 w = modelMatrix * vec4(transformed,1.0);
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * objectNormal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const toonFrag = /* glsl */`
  uniform vec3 uColor; uniform sampler2D uMap; uniform float uHasMap; uniform float uUnlit;
  uniform vec3 uKeyDir; uniform vec3 uLampPos; uniform float uLamp; uniform vec3 uShadeCol; uniform vec3 uWarm;
  uniform float uShadeAmt; uniform float uRestUV; uniform vec2 uRestScale;
  varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vRest;
  void main(){
    vec3 base = uColor;
    vec2 uv = vUv;
    if (uRestUV > 0.5) uv = vec2(atan(vRest.x, vRest.z) / 6.2832 + 0.5, vRest.y) * uRestScale;   // cylindrical, rest pose
    if (uHasMap > 0.5) base = texture2D(uMap, uv).rgb;
    if (uUnlit > 0.5) { gl_FragColor = vec4(base,1.0); return; }
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
export function toon(color, { map = null, unlit = false, shade = 0.5, shadeCol = null, restUV = null } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uColor: { value: new THREE.Color(color || '#ffffff') },
      uMap: { value: map }, uHasMap: { value: map ? 1 : 0 }, uUnlit: { value: unlit ? 1 : 0 }, uShadeAmt: { value: shade },
      uRestUV: { value: restUV ? 1 : 0 }, uRestScale: { value: new THREE.Vector2(...(restUV || [1, 1])) },
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

export function addInk(mesh, width = 0.012) {
  let g = mesh.geometry.clone();
  for (const k of Object.keys(g.attributes)) if (!['position', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();                               // smooth normals so hulls don't crack at box corners
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
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)) + uSeed) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
  void main(){
    vec2 px = 1.0 / uRes;
    vec4 F = texture2D(tFill, vUv - uOff * px);              // misregistered colour plate
    float K = texture2D(tInk, vUv).r;
    float mott = vnoise(gl_FragCoord.xy / 26.0);
    float speck = step(0.93, hash(gl_FragCoord.xy));
    float cover = clamp(1.0 - uCoverage * mott - 0.7 * speck * uCoverage, 0.0, 1.0);
    vec3 c = mix(uPaper, F.rgb, cover * F.a);
    c = mix(c, uInk, K * (1.0 - 0.2 * speck));
    float gr = hash(floor(gl_FragCoord.xy)) - 0.5;
    c += gr * 0.06 * uGrain;
    gl_FragColor = vec4(c, 1.0);
  }`;

export function makeCompositor(renderer) {
  const size = new THREE.Vector2();
  const mk = () => new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  const rtF = mk(), rtK = mk();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tFill: { value: rtF.texture }, tInk: { value: rtK.texture }, uRes: { value: new THREE.Vector2() },
      uSeed: { value: 0 }, uOff: { value: new THREE.Vector2(3, -2) },
      uPaper: { value: new THREE.Color('#F1E9D2') }, uInk: { value: new THREE.Color('#0B0B0B') },
      uCoverage: { value: 0.12 }, uGrain: { value: 1 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }',
    fragmentShader: compFrag, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  const black = new THREE.Color(0, 0, 0);

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
      const swaps = [];
      scene.traverse(o => { if (o.userData.inkMat) { swaps.push([o, o.material]); o.material = o.userData.inkMat; } });
      renderer.render(scene, camera);
      for (const [o, m] of swaps) o.material = m;
      camera.layers.set(INK_LAYER);
      renderer.render(scene, camera);
      scene.background = bg; renderer.autoClear = ac;
      camera.layers.set(0);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
    },
  };
}
