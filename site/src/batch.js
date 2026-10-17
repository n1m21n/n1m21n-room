// Batching: bake a static group's toon meshes (and their ink hulls) into a few big meshes.
//
// Every `mesh()` is three draw calls (fill, depth-only for the ink plate, hull), so a scene of 2000 small props is ~6000
// submissions before culling. `batch(root)` takes everything under `root` that is plain toon geometry and merges it by
// material kind + 4 m cell, so a hall of frames, plants, lamps and benches becomes a handful of calls.
//
// It is one look, not a second one: the batch material runs the same toon / hull shaders (look.js) but reads colour,
// shade colour and material-mark parameters from per-vertex attributes instead of per-mesh uniforms, plus the object-
// space rest position and normal (`aRest`, `aON`) so wood grain, leaf veins and ink boil sit exactly where they did.
//
// Contract: call it on a group whose contents never move, show/hide, swap material or get looked up again (stations,
// doors, animated props stay out of it). Anything it will not touch is left where it is: meshes with `userData`,
// textured meshes (frame art, the sky), skinned meshes, transparent or hidden ones. Call it after the group is built;
// the group's own transform (placed / scaled later by the caller) is untouched, children are baked relative to it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shared, toonVert, toonFrag, hullVert, hullFrag, INK_LAYER } from './look.js';

const batchVert = toonVert
  .replace('varying vec3 vN;', `attribute vec3 aRest; attribute vec3 aON; attribute vec3 aCol; attribute vec3 aShadeCol; attribute vec4 aMatP; attribute float aShadeAmt;
  varying vec3 vCol; varying vec3 vShadeCol; varying vec4 vMatP; varying float vShadeAmt;
  varying vec3 vN;`)
  .replace('vUv = uv; vRest = position; vON = normal;', 'vUv = uv; vRest = aRest; vON = aON; vCol = aCol; vShadeCol = aShadeCol; vMatP = aMatP; vShadeAmt = aShadeAmt;');
const batchFrag = toonFrag
  .replace('uniform vec3 uShadeCol;', '').replace('uniform float uShadeAmt;', '')
  .replace('uniform float uMat; uniform float uMatAxis; uniform float uMatScale; uniform float uMatAmt;', '')
  .replace('uniform vec3 uColor;', `varying vec3 vCol; varying vec3 vShadeCol; varying vec4 vMatP; varying float vShadeAmt;
  #define uColor vCol
  #define uShadeCol vShadeCol
  #define uShadeAmt vShadeAmt
  #define uMat vMatP.x
  #define uMatAxis vMatP.y
  #define uMatScale vMatP.z
  #define uMatAmt vMatP.w
  `);
const batchHullVert = hullVert
  .replace('uniform float uW;', 'attribute float aW; attribute vec3 aRest;')
  .replace('h(floor(position * 9.0))', 'h(floor(aRest * 9.0))')
  .replace('n * uW * j', 'n * aW * j');
if (!batchVert.includes('aRest') || !batchFrag.includes('#define uMat ') || !batchHullVert.includes('aW * j')) throw new Error('batch: look.js shaders changed; update the replacements in batch.js');

const FILL = 1, INK = 1 << INK_LAYER;
const keep = ['position', 'normal', 'uv'];
const I4 = new THREE.Matrix4();

// a clean copy of a geometry in the attribute layout the batch shaders want, baked by M; `rest` keeps the originals
function bake(src, M, { uv }) {
  const g = src.clone();
  for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
  g.clearGroups();
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (uv && !g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!uv) g.deleteAttribute('uv');
  g.setAttribute('aRest', g.attributes.position.clone());
  if (uv) g.setAttribute('aON', g.attributes.normal.clone());
  g.applyMatrix4(M);
  return g;
}
const fill = (g, name, size, vals) => {
  const n = g.attributes.position.count, a = new Float32Array(n * size);
  for (let i = 0; i < n; i++) a.set(vals, i * size);
  g.setAttribute(name, new THREE.BufferAttribute(a, size));
};
const merge = gs => {
  if (gs.length === 1) return gs[0];
  const idx = gs.filter(g => g.index).length;
  if (idx && idx < gs.length) gs = gs.map(g => g.index ? g.toNonIndexed() : g);
  return mergeGeometries(gs, false);
};

export function batch(root, { cell = 4 } = {}) {
  if (typeof location !== 'undefined' && /[?&]nobatch/.test(location.search)) return { meshes: 0, batches: 0 };   // ?nobatch: A/B against the unbatched look
  const items = new Map();                                      // material kind -> [{ fg, hg, cx, cz, src, hull }]
  let taken = 0;
  const isHull = h => h.isMesh && h.layers.mask === INK && !h.children.length && h.matrix.equals(I4) && h.material?.isShaderMaterial && h.material.uniforms.uW;
  function take(c, M) {
    const mt = c.material;
    if (c.isSkinnedMesh || c.layers.mask !== FILL || Object.keys(c.userData).length || c.renderOrder || c.frustumCulled === false) return false;
    if (!mt?.isShaderMaterial || !mt.uniforms.uColor || mt.transparent || mt.uniforms.uMap?.value || !c.geometry?.attributes.position) return false;
    const hulls = c.children.filter(isHull);
    if (hulls.length !== c.children.length || hulls.length > 1) return false;
    const u = mt.uniforms, key = [mt.side, u.uUnlit.value, u.uRestUV.value, u.uRestScale.value.x, u.uRestScale.value.y].join('|');
    const fg = bake(c.geometry, M, { uv: true });
    fill(fg, 'aCol', 3, u.uColor.value.toArray());
    fill(fg, 'aShadeCol', 3, u.uShadeCol.value.toArray());
    fill(fg, 'aMatP', 4, [u.uMat.value, u.uMatAxis.value, u.uMatScale.value, u.uMatAmt.value]);
    fill(fg, 'aShadeAmt', 1, [u.uShadeAmt.value]);
    let hg = null;
    if (hulls[0]) { hg = bake(hulls[0].geometry, M, { uv: false }); fill(hg, 'aW', 1, [hulls[0].material.uniforms.uW.value]); }
    fg.computeBoundingBox();
    const ctr = fg.boundingBox.getCenter(new THREE.Vector3());
    if (!items.has(key)) items.set(key, { side: mt.side, unlit: u.uUnlit.value, restUV: u.uRestUV.value, restScale: u.uRestScale.value.clone(), list: [] });
    items.get(key).list.push({ fg, hg, cx: Math.floor(ctr.x / cell), cz: Math.floor(ctr.z / cell), c });
    return true;
  }
  const gone = [];
  (function walk(o, M) {
    for (const c of o.children) {
      if (!c.visible) continue;
      c.updateMatrix();
      const Mc = new THREE.Matrix4().multiplyMatrices(M, c.matrix);
      if (c.isMesh && take(c, Mc)) { gone.push(c); taken++; continue; }
      walk(c, Mc);
    }
  })(root, new THREE.Matrix4());

  let batches = 0;
  for (const kind of items.values()) {
    const cells = new Map();
    for (const it of kind.list) { const k = it.cx + ',' + it.cz; (cells.get(k) || cells.set(k, []).get(k)).push(it); }
    for (const list of cells.values()) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...shared, uMap: { value: null }, uHasMap: { value: 0 }, uUnlit: { value: kind.unlit }, uRestUV: { value: kind.restUV }, uRestScale: { value: kind.restScale }, uCut: { value: 0 } },
        vertexShader: batchVert, fragmentShader: batchFrag, side: kind.side,
      });
      const m = new THREE.Mesh(merge(list.map(i => i.fg)), mat); m.name = 'batch';
      const hs = list.filter(i => i.hg);
      if (hs.length) {
        const hm = new THREE.ShaderMaterial({ uniforms: { uBoil: shared.uBoil, uCut: { value: 0 } }, vertexShader: batchHullVert, fragmentShader: hullFrag, side: THREE.BackSide });
        const h = new THREE.Mesh(merge(hs.map(i => i.hg)), hm); h.layers.set(INK_LAYER); h.renderOrder = 1; m.add(h);
      }
      root.add(m); batches++;
    }
  }
  for (const c of gone) {
    c.parent.remove(c);
    c.geometry.dispose(); c.material.dispose();
    for (const h of c.children) { h.geometry.dispose(); h.material.dispose(); }
  }
  return { meshes: taken, batches };
}
