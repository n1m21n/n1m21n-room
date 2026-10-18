// Occupancy grid over the room: where he can stand, how open/cluttered a spot is, where he has been (visit/dwell
// trace) and what is new. Foundation for roaming, speed (clutter slows, openness lets him run) and building later.
export function makeGrid({ bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }, cell = 0.25, rng } = {}) {
  const nx = Math.ceil((bounds.maxX - bounds.minX) / cell), nz = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
  const blocked = new Uint8Array(nx * nz), visits = new Float32Array(nx * nz), dwell = new Float32Array(nx * nz);
  const built = new Map();                                       // idx -> block name
  const ix = x => Math.floor((x - bounds.minX) / cell), iz = z => Math.floor((z - bounds.minZ) / cell);
  const inb = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz;
  const idx = (i, j) => j * nx + i;
  const center = (i, j) => ({ x: bounds.minX + (i + 0.5) * cell, z: bounds.minZ + (j + 0.5) * cell });

  function blockRect(minX, minZ, maxX, maxZ) {                   // furniture footprint
    for (let j = iz(minZ); j <= iz(maxZ); j++) for (let i = ix(minX); i <= ix(maxX); i++) if (inb(i, j)) blocked[idx(i, j)] = 1;
  }
  const isBlocked = (x, z) => { const i = ix(x), j = iz(z); return !inb(i, j) || !!blocked[idx(i, j)]; };
  // clutter = share of blocked cells within radius r; openness is its complement; wallDistance in metres
  function clutter(x, z, r = 1) {
    const R = Math.ceil(r / cell), i0 = ix(x), j0 = iz(z); let n = 0, b = 0;
    for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) { n++; if (!inb(i, j) || blocked[idx(i, j)]) b++; }
    return b / n;
  }
  const openness = (x, z, r = 1) => 1 - clutter(x, z, r);
  function wallDistance(x, z, max = 3) {
    const i0 = ix(x), j0 = iz(z), R = Math.ceil(max / cell);
    for (let r = 1; r <= R; r++) for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++)
      if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) === r && (!inb(i, j) || blocked[idx(i, j)])) return r * cell;
    return max;
  }
  function visit(x, z, dt = 1) { const i = ix(x), j = iz(z); if (!inb(i, j)) return; const k = idx(i, j); if (!visits[k]) visits[k] = 1; dwell[k] += dt; }
  const novelty = (x, z) => { const i = ix(x), j = iz(z); return inb(i, j) && !visits[idx(i, j)] ? 1 : 0; };
  // comfortable = against a wall/corner in a not-too-open spot; used by "security"
  const security = (x, z) => Math.max(0, 1 - wallDistance(x, z, 2) / 2) * (1 - 0.5 * openness(x, z, 1.5));
  function decay(f) { for (let k = 0; k < dwell.length; k++) dwell[k] *= f; }
  // a reachable, unvisited, free cell (random sampling then BFS reachability from `from`)
  function reachable(from) {
    const seen = new Uint8Array(nx * nz), q = [[ix(from.x), iz(from.z)]]; if (!inb(...q[0])) return seen;
    seen[idx(...q[0])] = 1;
    while (q.length) { const [i, j] = q.pop(); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = i + a, v = j + b; if (inb(u, v) && !seen[idx(u, v)] && !blocked[idx(u, v)]) { seen[idx(u, v)] = 1; q.push([u, v]); } } }
    return seen;
  }
  function roamTarget(from, { tries = 80, minDist = 1.2, preferNew = true } = {}) {
    const seen = reachable(from); let best = null, bs = -1;
    for (let t = 0; t < tries; t++) {
      const i = Math.floor((rng ? rng.next() : Math.random()) * nx), j = Math.floor((rng ? rng.next() : Math.random()) * nz);
      if (!seen[idx(i, j)]) continue;
      const c = center(i, j); if (Math.hypot(c.x - from.x, c.z - from.z) < minDist) continue;
      const s = (preferNew && !visits[idx(i, j)] ? 1 : 0) + (rng ? rng.next() : Math.random()) * 0.5;
      if (s > bs) { bs = s; best = c; }
    }
    return best;
  }
  // build site check: free, level (flat assumed), enough free radius
  function canBuild(x, z, { minFreeRadius = 1 } = {}) {
    return !isBlocked(x, z) && clutter(x, z, minFreeRadius) < 0.15;
  }
  function place(x, z, block) { const i = ix(x), j = iz(z); if (!inb(i, j)) return false; blocked[idx(i, j)] = 1; built.set(idx(i, j), block); return true; }
  const visitedFraction = () => { let n = 0, v = 0; for (let k = 0; k < blocked.length; k++) if (!blocked[k]) { n++; if (visits[k]) v++; } return v / (n || 1); };
  return {
    nx, nz, cell, blockRect, isBlocked, clutter, openness, wallDistance, visit, novelty, security, decay, roamTarget, canBuild, place, visitedFraction, reachable,
    built: () => [...built],
    snapshot: () => ({ nx, nz, visits: Array.from(visits).map((v, k) => v ? k : -1).filter(k => k >= 0), built: [...built] }),
    restore(s) { if (!s || (s.nx != null && (s.nx !== nx || s.nz !== nz))) return;      // a snapshot from another room size would land on the wrong cells
      visits.fill(0); for (const k of s.visits || []) visits[k] = 1; built.clear(); for (const [k, v] of s.built || []) { built.set(k, v); blocked[k] = 1; } },
  };
}
