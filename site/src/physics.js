// Physical world rules: every visible mesh in the scene is matter, and no part of his body may be inside it.
//   collider kinds (mesh.userData.phys): 'solid' (default, 4 mm tolerance), 'soft' (mattress, pillow, cushions: may sink
//   2 cm), 'cover' (an open shell he lies under: may be under it, never poke out through it), 'none' (light, glow, decal)
// check() bakes his skinned mesh (every vertex, current pose) and reports each body part that is inside something,
// including his own body (a hand inside his head, thigh or the other hand). The dev runner poses every act and prints it.
import * as THREE from 'three';

const TOL = { solid: 0.004, soft: 0.02, cover: 0.01 };
const SELF = {                                              // body part -> parts of himself it must stay out of
  handL: ['head', 'tee', 'jeansL', 'jeansR', 'handR'], handR: ['head', 'tee', 'jeansL', 'jeansR', 'handL'],
  armL: ['head', 'jeansL', 'jeansR'], armR: ['head', 'jeansL', 'jeansR'],
};
const v = new THREE.Vector3(), w = new THREE.Vector3(), m = new THREE.Matrix4(), cp = new THREE.Vector3();
const tri = new THREE.Triangle(), ab = new THREE.Box3();

const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
function triangles(geo, xf) {                               // flat Float32Array of triangle corners (x9 per tri)
  const p = geo.attributes.position, idx = geo.index, n = idx ? idx.count : p.count, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const k = idx ? idx.getX(i) : i; v.fromBufferAttribute(p, k); if (xf) xf(v, k); out.set([v.x, v.y, v.z], i * 3); }
  return out;
}
// closed-surface inside test: odd ray crossings (3 skewed rays, majority) -> depth = distance to the surface
const DIRS = [new THREE.Vector3(1, 0.13, 0.07).normalize(), new THREE.Vector3(-0.11, 1, 0.17).normalize(), new THREE.Vector3(0.19, -0.05, -1).normalize()];
const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tv = new THREE.Vector3(), qv = new THREE.Vector3();
function crossings(T, o, d) {
  let c = 0;
  for (let i = 0; i < T.length; i += 9) {
    e1.set(T[i + 3] - T[i], T[i + 4] - T[i + 1], T[i + 5] - T[i + 2]); e2.set(T[i + 6] - T[i], T[i + 7] - T[i + 1], T[i + 8] - T[i + 2]);
    pv.crossVectors(d, e2); const det = e1.dot(pv); if (Math.abs(det) < 1e-12) continue;
    tv.set(o.x - T[i], o.y - T[i + 1], o.z - T[i + 2]); const u = tv.dot(pv) / det; if (u < 0 || u > 1) continue;
    qv.crossVectors(tv, e1); const vv = d.dot(qv) / det; if (vv < 0 || u + vv > 1) continue;
    if (e2.dot(qv) / det > 0) c++;
  }
  return c;
}
function surfDist(T, p) {
  let best = 1e9;
  for (let i = 0; i < T.length; i += 9) {
    tri.a.set(T[i], T[i + 1], T[i + 2]); tri.b.set(T[i + 3], T[i + 4], T[i + 5]); tri.c.set(T[i + 6], T[i + 7], T[i + 8]);
    tri.closestPointToPoint(p, cp); best = Math.min(best, cp.distanceToSquared(p));
  }
  return Math.sqrt(best);
}
function insideDepth(T, p) {
  let odd = 0; for (const d of DIRS) odd += crossings(T, p, d) & 1;
  return odd >= 2 ? surfDist(T, p) : 0;
}

// a static/prop collider in its own local space
function collider(o) {
  const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
  const s = new THREE.Vector3(); g.boundingBox.getSize(s);
  const kind = o.userData.phys || 'solid';
  const P = g.parameters || {};
  const open = (g.type === 'CylinderGeometry' && (P.openEnded || P.thetaLength < Math.PI * 2 - 1e-3))
    || ['PlaneGeometry', 'CircleGeometry', 'RingGeometry', 'ShapeGeometry', 'LatheGeometry', 'TubeGeometry'].includes(g.type);
  if (kind === 'none' || Math.min(s.x, s.y, s.z) < 1e-3 || (open && kind !== 'cover')) return null;
  return { o, kind, box: g.type === 'BoxGeometry', bb: g.boundingBox, T: g.type === 'BoxGeometry' || kind === 'cover' ? null : triangles(g) };
}
function name(o) {
  const bits = []; for (let x = o; x && bits.length < 3; x = x.parent) if (x.name) bits.push(x.name);
  const p = o.getWorldPosition(new THREE.Vector3());
  return `${bits.join('<') || o.geometry.type.replace('Geometry', '')} @${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`;
}

export function makePhysics({ scene, man }) {
  const body = []; man.root.traverse(o => { if (o.isSkinnedMesh && o.layers.mask & 1 && o.name) body.push(o); });
  let cols = null;
  function gather() {                                        // everything visible that is not him, his ink, or glass / light
    cols = [];
    scene.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh || !(o.layers.mask & 1) || !shown(o)) return;
      for (let x = o; x; x = x.parent) if (x === man.root) return;   // what he wears / holds (hat, guitar) is his own
      const mt = o.material; if (!mt || mt.transparent || mt.side === THREE.BackSide) return;
      const c = collider(o); if (c) cols.push(c);
    });
  }
  // his body baked to world space for this pose: per part, vertex list + triangles (for self tests)
  function bake() {
    const parts = {};
    for (const sm of body) {
      const p = sm.geometry.attributes.position, V = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { sm.getVertexPosition(i, v); v.applyMatrix4(sm.matrixWorld); V.set([v.x, v.y, v.z], i * 3); }
      const T = triangles(sm.geometry, (x, k) => x.set(V[k * 3], V[k * 3 + 1], V[k * 3 + 2]));
      const box = new THREE.Box3(); for (let i = 0; i < V.length; i += 3) box.expandByPoint(v.set(V[i], V[i + 1], V[i + 2]));
      parts[sm.name.replace(/_\d+$/, '')] = { V, T, box };
    }
    return parts;
  }
  // -> [{part, what, depth (m), n (vertices inside)}], worst first
  function check({ floor = true } = {}) {
    scene.updateMatrixWorld(true);
    if (!cols) gather();
    const parts = bake(), hits = new Map();
    const hit = (part, what, d) => {                          // keeps the deepest point, in his own (man-local) frame
      const k = part + '|' + what, h = hits.get(k) || { part, what, depth: 0, n: 0 };
      if (d > h.depth) { h.depth = d; h.at = man.root.worldToLocal(w.clone()).toArray().map(x => +x.toFixed(3)); }
      h.n++; hits.set(k, h);
    };
    const live = cols.filter(c => shown(c.o));
    for (const c of live) {
      c.o.updateWorldMatrix(true, false);
      c.inv = m.copy(c.o.matrixWorld).invert().clone();
      c.wb = ab.copy(c.bb).applyMatrix4(c.o.matrixWorld).clone();
    }
    for (const [pn, P] of Object.entries(parts)) {
      const near = live.filter(c => c.wb.intersectsBox(P.box));
      for (let i = 0; i < P.V.length; i += 3) {
        w.set(P.V[i], P.V[i + 1], P.V[i + 2]);
        if (floor && w.y < -0.004) hit(pn, 'floor', -w.y);
        for (const c of near) {
          if (!c.wb.containsPoint(w)) continue;
          v.copy(w).applyMatrix4(c.inv);
          let d = 0;
          if (c.kind === 'cover') d = c.o.userData.cover(v);
          else if (c.box) { const b = c.bb; d = Math.min(v.x - b.min.x, b.max.x - v.x, v.y - b.min.y, b.max.y - v.y, v.z - b.min.z, b.max.z - v.z); }
          else d = insideDepth(c.T, v);
          // scale the local depth back to metres (non-uniform scale: take the smallest axis)
          if (d > 0) { c.o.getWorldScale(cp); d *= Math.min(cp.x, cp.y, cp.z); }
          if (d > TOL[c.kind]) hit(pn, name(c.o), d);
        }
      }
      for (const other of SELF[pn] || []) {                  // his own body
        const Q = parts[other]; if (!Q || !Q.box.intersectsBox(P.box)) continue;
        for (let i = 0; i < P.V.length; i += 3) {
          w.set(P.V[i], P.V[i + 1], P.V[i + 2]); if (!Q.box.containsPoint(w)) continue;
          const d = insideDepth(Q.T, w); if (d > TOL.solid) hit(pn, 'his ' + other, d);
        }
      }
    }
    return [...hits.values()].sort((a, b) => b.depth - a.depth).map(h => ({ ...h, depth: +(h.depth * 1000).toFixed(1) }));
  }
  return { check, gather, bake, parts: () => body.map(b => b.name) };
}
