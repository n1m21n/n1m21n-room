// Tap-to-walk navigation: an occupancy grid baked from the floor-plan solids (inflated by the body radius),
// A* on 8 neighbours (no corner cutting), then string-pulled to straight runs.
const CELL = 0.12;

export function makeNav(solids, radius) {
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const b of solids) { x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[1]); x1 = Math.max(x1, b[2]); z1 = Math.max(z1, b[3]); }
  const nx = Math.ceil((x1 - x0) / CELL), nz = Math.ceil((z1 - z0) / CELL);
  const block = new Uint8Array(nx * nz);
  const r = radius + 0.03;
  for (const b of solids) {
    const i0 = Math.max(0, Math.floor((b[0] - r - x0) / CELL)), i1 = Math.min(nx - 1, Math.floor((b[2] + r - x0) / CELL));
    const j0 = Math.max(0, Math.floor((b[1] - r - z0) / CELL)), j1 = Math.min(nz - 1, Math.floor((b[3] + r - z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = x0 + (i + 0.5) * CELL, cz = z0 + (j + 0.5) * CELL;
      const dx = cx - Math.max(b[0], Math.min(cx, b[2])), dz = cz - Math.max(b[1], Math.min(cz, b[3]));
      if (dx * dx + dz * dz < r * r) block[j * nx + i] = 1;
    }
  }
  const ci = x => Math.floor((x - x0) / CELL), cj = z => Math.floor((z - z0) / CELL);
  const inside = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz;
  const free = (i, j) => inside(i, j) && !block[j * nx + i];
  const centre = k => [x0 + ((k % nx) + 0.5) * CELL, z0 + (Math.floor(k / nx) + 0.5) * CELL];

  // nearest free cell (ring search); reach limits it to the room you clicked in
  function nearestFree(i, j, reach = 40) {
    if (free(i, j)) return j * nx + i;
    for (let s = 1; s < reach; s++) {
      let best = -1, bd = 1e9;
      for (let dj = -s; dj <= s; dj++) for (let di = -s; di <= s; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== s || !free(i + di, j + dj)) continue;
        const d = di * di + dj * dj; if (d < bd) { bd = d; best = (j + dj) * nx + i + di; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  function lineFree(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / (CELL * 0.5));
    for (let k = 0; k <= n; k++) { const t = k / (n || 1); if (!free(ci(ax + (bx - ax) * t), cj(az + (bz - az) * t))) return false; }
    return true;
  }

  // A* with a binary heap
  const g = new Float32Array(nx * nz), from = new Int32Array(nx * nz), seen = new Uint8Array(nx * nz);
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  function astar(s, t) {
    g.fill(Infinity); seen.fill(0); from.fill(-1);
    const tx = t % nx, tz = Math.floor(t / nx);
    const h = k => { const dx = Math.abs(k % nx - tx), dz = Math.abs(Math.floor(k / nx) - tz); return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz); };
    const heap = [[h(s), s]]; g[s] = 0;
    const push = it => { heap.push(it); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [, k] = pop();
      if (seen[k]) continue; seen[k] = 1;
      if (k === t) break;
      const i = k % nx, j = Math.floor(k / nx);
      for (const [di, dj, c] of NB) {
        const a = i + di, b = j + dj;
        if (!free(a, b) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;
        const n = b * nx + a, ng = g[k] + c;
        if (ng < g[n]) { g[n] = ng; from[n] = k; push([ng + h(n), n]); }
      }
    }
    if (!seen[t]) return null;
    const cells = []; for (let k = t; k !== -1; k = from[k]) cells.push(k);
    return cells.reverse();
  }

  // returns [[x, z], ...] waypoints after the start, or null when unreachable
  function path(sx, sz, tx, tz) {
    const s = nearestFree(ci(sx), cj(sz), 6), t = nearestFree(ci(tx), cj(tz));
    if (s < 0 || t < 0) return null;
    const cells = astar(s, t); if (!cells) return null;
    const pts = cells.map(centre);
    if (free(ci(tx), cj(tz))) pts[pts.length - 1] = [tx, tz];        // exact spot when it is walkable
    const out = []; let ax = sx, az = sz, k = 0;
    while (k < pts.length) {                                          // string pull: farthest visible point
      let far = k;
      for (let m = pts.length - 1; m > k; m--) if (lineFree(ax, az, pts[m][0], pts[m][1])) { far = m; break; }
      out.push(pts[far]); [ax, az] = pts[far]; k = far + 1;
    }
    return out;
  }

  return { path, free: (x, z) => free(ci(x), cj(z)) };
}
