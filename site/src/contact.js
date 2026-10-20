// Contact between the snake and him (music video). Two round bodies may touch but never overlap: the snake's chain of
// links (P[i] centre, P[i].w radius) is pushed out of his skinned surface (every triangle of the current pose, inside
// test by ray parity from physics.js), out of itself and above the floor, while every link keeps its length, so the
// body neither passes through him nor stretches. report() measures what is left, both ways, in millimetres.
import * as THREE from 'three';
import { insideDepth } from './physics.js';

const SHELL = /^hair/;                                       // open shells: no inside, keep the distance only
const v = new THREE.Vector3(), cp = new THREE.Vector3(), tri = new THREE.Triangle(), d = new THREE.Vector3();

export function makeContact({ phys }) {
  let parts = [], solids = [];
  // his body for this pose (call after posing): per part triangles + box; plus fixed things it must not enter (stool)
  function bake() { parts = [...Object.entries(phys.bake()).map(([name, p]) => ({ name, ...p, shell: SHELL.test(name) })), ...solids]; return parts; }
  function addSolid(o, name = o.name || 'solid') {
    o.updateWorldMatrix(true, true);
    o.traverse(m => {
      if (!m.isMesh || m.layers.mask !== 1 || !m.geometry?.attributes.position) return;
      const g = m.geometry, p = g.attributes.position, idx = g.index, n = idx ? idx.count : p.count, T = new Float32Array(n * 3), V = new Float32Array(p.count * 3), box = new THREE.Box3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); V.set([v.x, v.y, v.z], i * 3); box.expandByPoint(v); }
      for (let i = 0; i < n; i++) { const k = idx ? idx.getX(i) : i; T.set([V[k * 3], V[k * 3 + 1], V[k * 3 + 2]], i * 3); }
      solids.push({ name, T, V, box, solid: true });
    });
  }

  // closest point on his surface to p within reach, and whether p is inside him
  function nearest(p, reach) {
    let best = reach * reach, hit = null, inside = false;
    for (const q of parts) {
      const b = q.box;
      if (p.x < b.min.x - reach || p.x > b.max.x + reach || p.y < b.min.y - reach || p.y > b.max.y + reach || p.z < b.min.z - reach || p.z > b.max.z + reach) continue;
      const T = q.T;
      for (let i = 0; i < T.length; i += 9) {
        tri.a.set(T[i], T[i + 1], T[i + 2]); tri.b.set(T[i + 3], T[i + 4], T[i + 5]); tri.c.set(T[i + 6], T[i + 7], T[i + 8]);
        tri.closestPointToPoint(p, d); const e = d.distanceToSquared(p);
        if (e < best) { best = e; cp.copy(d); hit = q; }
      }
      if (!q.shell && b.containsPoint(p) && insideDepth(T, p) > 0) inside = true;
    }
    return hit ? { point: cp.clone(), dist: Math.sqrt(best), inside } : inside ? { point: null, dist: 0, inside } : null;
  }

  // push one link out to (radius + pad) from his surface
  function pushOut(p, r, pad) {
    const n = nearest(p, r + pad);
    if (!n) return 0;
    if (!n.point) return 0;
    if (n.inside) { d.subVectors(n.point, p).normalize(); p.copy(n.point).addScaledVector(d, r + pad); return n.dist + r; }
    if (n.dist >= r + pad) return 0;
    d.subVectors(p, n.point).normalize(); p.copy(n.point).addScaledVector(d, r + pad); return r + pad - n.dist;
  }

  // solve(P, link): P[0] = head. Head leads; the rest follow at fixed link lengths, never inside him, itself or the floor
  function solve(P, link, { iters = 10, pad = 0.004, floor = true, self = true, pin = 0, headR = 0.085 } = {}) {
    const N = P.length;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < N; i++) {
        pushOut(P[i], P[i].w, pad);
        if (floor && P[i].y < P[i].w) P[i].y = P[i].w;
      }
      if (headR) {                                             // the skull sits ahead of the first link and is wider
        d.subVectors(P[0], P[2]).normalize(); const H = P[0].clone().addScaledVector(d, 0.06), H0 = H.clone();
        pushOut(H, headR, pad); if (floor && H.y < 0.065) H.y = 0.065; P[0].add(H.sub(H0));
      }
      if (self) for (let i = 0; i < N; i++) for (let j = i + 4; j < N; j++) {
        const need = P[i].w + P[j].w + 0.002; d.subVectors(P[j], P[i]); const L = d.length();
        if (L < need && L > 1e-6) { d.multiplyScalar((need - L) / L / 2); P[i].sub(d); P[j].add(d); }
      }
      // links: from the head (or the pinned links) toward the tail
      for (let i = Math.max(1, pin); i < N; i++) { d.subVectors(P[i], P[i - 1]); const L = d.length() || 1; P[i].copy(P[i - 1]).addScaledVector(d, link / L); }
    }
    for (let i = 0; i < N; i++) { pushOut(P[i], P[i].w, pad); if (floor && P[i].y < P[i].w) P[i].y = P[i].w; }
    return P;
  }

  // what is left, in mm: into = deepest snake surface point inside him, his = deepest of his vertices inside the snake,
  // self = deepest snake-on-snake overlap, stretch = worst link length error, gap = closest approach (touching = ~pad)
  function report(P, link) {
    const N = P.length, where = {}; let into = 0, his = 0, selfo = 0, stretch = 0, gap = 1e9;
    const ring = 10, side = new THREE.Vector3(), up = new THREE.Vector3(), T = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < N; i++) {
      T.subVectors(P[Math.max(0, i - 1)], P[Math.min(N - 1, i + 1)]).normalize();
      side.crossVectors(T, Y); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize(); up.crossVectors(side, T).normalize();
      for (let k = 0; k < ring; k++) {
        const a = k / ring * Math.PI * 2; v.copy(P[i]).addScaledVector(side, Math.cos(a) * P[i].w * 0.97).addScaledVector(up, Math.sin(a) * P[i].w * 0.97);
        for (const q of parts) if (!q.shell && q.box.containsPoint(v)) { const e = insideDepth(q.T, v); if (e > into) { into = e; where.into = q.name + '@' + i; } }
      }
      const n = nearest(P[i], 0.3); if (n?.point && !n.inside) gap = Math.min(gap, n.dist - P[i].w); else if (n?.inside) gap = Math.min(gap, -n.dist - P[i].w);
      if (i) { const e = Math.abs(P[i].distanceTo(P[i - 1]) - link); if (e > stretch) { stretch = e; where.stretch = i; } }
      for (let j = i + 4; j < N; j++) { const e = P[i].w + P[j].w - P[i].distanceTo(P[j]); if (e > selfo) { selfo = e; where.self = i + '-' + j; } }
    }
    const seg = new THREE.Line3();
    for (const q of parts) if (!q.solid) for (let k = 0; k < q.V.length; k += 3) {
      v.set(q.V[k], q.V[k + 1], q.V[k + 2]);
      for (let i = 1; i < N; i++) { seg.set(P[i - 1], P[i]); seg.closestPointToPoint(v, true, cp); const r = (P[i - 1].w + P[i].w) / 2, e = r - cp.distanceTo(v); if (e > his) { his = e; where.his = q.name + '@' + i; } }
    }
    const mm = x => +(x * 1000).toFixed(1);
    return { into: mm(into), his: mm(his), self: mm(Math.max(0, selfo)), stretch: mm(stretch), gap: mm(gap), where };
  }
  // outermost surface along a ray from o (any layer of him or a solid): the distance, or 0 if nothing is hit
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tv = new THREE.Vector3(), qv = new THREE.Vector3();
  function outer(o, dir, max = 0.6, only = null) {
    let far = 0;
    for (const q of parts) {
      if (only && !only.includes(q.name)) continue;
      const T = q.T;
      for (let i = 0; i < T.length; i += 9) {
        e1.set(T[i + 3] - T[i], T[i + 4] - T[i + 1], T[i + 5] - T[i + 2]); e2.set(T[i + 6] - T[i], T[i + 7] - T[i + 1], T[i + 8] - T[i + 2]);
        pv.crossVectors(dir, e2); const det = e1.dot(pv); if (Math.abs(det) < 1e-12) continue;
        tv.set(o.x - T[i], o.y - T[i + 1], o.z - T[i + 2]); const u = tv.dot(pv) / det; if (u < 0 || u > 1) continue;
        qv.crossVectors(tv, e1); const w = dir.dot(qv) / det; if (w < 0 || u + w > 1) continue;
        const t = e2.dot(qv) / det; if (t > 0 && t < max && t > far) far = t;
      }
    }
    return far;
  }
  // how far out along dir (from c) a tube of radius r must sit to clear him: samples across the tube's width along
  // `bin` (the direction perpendicular to both the ray and the tube) so a flaring jaw or shoulder is cleared too
  function clear(c, dir, bin, r, pad, only) {
    let need = 0; const q = new THREE.Vector3();
    for (let k = -3; k <= 3; k++) { const dy = k / 3 * r; q.copy(c).addScaledVector(bin, dy); const rho = outer(q, dir, 0.6, only); if (rho > 0) need = Math.max(need, rho + Math.sqrt(Math.max(0, r * r - dy * dy))); }
    return need + pad;
  }
  // a spiral that lies ON him: around the axis a -> b, `turns` turns from phase ph (0 = +ref, toward +ax x ref), each
  // sample at the tube-aware clearance, so the wrap is tight by construction. Starts at a.
  function wrap(a, b, turns, ph, r, { pad = 0.005, n = 0, only = null, ref = new THREE.Vector3(0, 0, 1), min = 0 } = {}) {
    const ax = new THREE.Vector3().subVectors(b, a), len = ax.length(); ax.normalize();
    const u = ref.clone().addScaledVector(ax, -ref.dot(ax)).normalize(), w = new THREE.Vector3().crossVectors(ax, u);
    const out = [], m = n || Math.max(8, Math.round(Math.abs(turns) * 28));
    for (let i = 0; i <= m; i++) {
      const k = i / m, an = ph + k * turns * Math.PI * 2, c = a.clone().addScaledVector(ax, len * k);
      const dir = u.clone().multiplyScalar(Math.cos(an)).addScaledVector(w, Math.sin(an));
      out.push(c.clone().addScaledVector(dir, Math.max(min, clear(c, dir, ax, r, pad, only))));
    }
    return out;
  }
  // a run that lies ON him: from a to b, every sample pushed out along dir to the clearance (riding up his back)
  function ride(a, b, dir, r, { pad = 0.005, n = 10, only = null } = {}) {
    const seg = new THREE.Vector3().subVectors(b, a), bin = new THREE.Vector3().crossVectors(seg, dir).normalize(), out = [];
    for (let i = 0; i <= n; i++) { const c = a.clone().addScaledVector(seg, i / n); out.push(c.clone().addScaledVector(dir, clear(c, dir, bin, r, pad, only))); }
    return out;
  }
  return { bake, solve, report, nearest, addSolid, outer, wrap, ride, clear, get parts() { return parts; } };
}
