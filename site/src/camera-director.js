// The automatic camera (core: the website and the stream). It drives the same orbit camera the visitor drags (player.st yaw / pitch /
// dist) but runs it like a small film crew: a slow drift through a shot, then a cut to a new one (close on his hands at an instrument or the easel, medium at
// the kitchen, wide while he walks, in on his face when he reads a chat note). Cuts are instant (the orbit is reset, not whipped).
import * as THREE from 'three';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// yaw is measured from the way he faces: 0 = camera in front of him, PI = behind his shoulder
const SHOTS = {
  detail: { dist: [1.9, 2.5], pitch: [0.16, 0.28], yaw: [0.45, 0.85], drift: 0.035, dur: [8, 13] },     // hands and faces
  medium: { dist: [2.8, 3.5], pitch: [0.25, 0.4], yaw: [0.7, 1.5], drift: 0.03, dur: [10, 16] },
  wide:   { dist: [4.2, 5.0], pitch: [0.42, 0.55], yaw: [1.8, 3.1], drift: 0.045, dur: [14, 22] },        // the room
  face:   { dist: [1.5, 1.9], pitch: [0.1, 0.2], yaw: [0.2, 0.5], drift: 0.02, dur: [4, 6] },
};
const KIND = { keys: 'detail', guitar: 'detail', easel: 'detail', read: 'medium', tea: 'medium', cook: 'medium', eat: 'medium', work: 'medium', records: 'medium', snake: 'detail', plant: 'medium', phone: 'medium', window: 'medium', tv: 'wide', sleep: 'wide', bench: 'wide' };

// `pace` < 1 cuts sooner (the stream); main.js only calls update while nobody is touching the controls
export function makeDirector({ player, solids = [], pace = 1, rnd = Math.random }) {
  const st = player.st;
  let shot = null, t = 0, dur = 0, side = 1, last = '', force = null, intro = 12;
  const pick = ([a, b]) => a + (b - a) * rnd();

  // how much furniture sits on the line from him out to the lens (floor-plan boxes; his own seat, within 0.7 m, does not count)
  function blocked(yaw, dist) {
    const dx = Math.sin(yaw), dz = Math.cos(yaw); let n = 0;
    for (let d = 0.7; d <= dist; d += 0.2) { const x = player.pos.x + dx * d, z = player.pos.z + dz * d; if (solids.some(b => x > b[0] - 0.12 && x < b[2] + 0.12 && z > b[1] - 0.12 && z < b[3] + 0.12)) n++; }
    return n;
  }
  function cut(kind) {
    const S = SHOTS[kind]; let best = null;
    for (let k = 0; k < 8; k++) {                                     // try a few framings, keep the one with the clearest view of him
      side = k % 2 ? -1 : 1;
      const c = { dist: pick(S.dist), pitch: pick(S.pitch), yaw: pick(S.yaw) * side };
      c.score = blocked(st.heading + c.yaw, c.dist) + rnd() * 0.5;
      if (!best || c.score < best.score) best = c;
    }
    side = Math.sign(best.yaw) || 1;
    shot = { kind, dist: best.dist, pitch: best.pitch, yaw: best.yaw, drift: S.drift * -side, push: kind === 'wide' ? 0.03 : -0.04 };
    t = 0; dur = pick(S.dur) * pace; last = kind;
    const orb = player.dbg?.orb; if (orb) orb.init = false;           // cut, do not glide there
  }
  function choose(doing, walking) {
    if (force) return force;
    if (walking) return rnd() < 0.5 ? 'wide' : 'medium';
    const k = KIND[doing] || 'medium';
    return k === last && rnd() < 0.5 ? (k === 'wide' ? 'medium' : 'wide') : k;     // the same framing twice in a row looks stuck
  }
  return {
    // call every frame with what he is doing and whether he is walking
    update(dt, { doing, walking }) {
      if (st.view !== 'third') return;
      if (!shot || (t += dt) > dur || (walking && shot.kind === 'detail')) { force = null; cut(choose(doing, walking)); }
      shot.dist += shot.push * dt; shot.yaw += shot.drift * dt;
      st.yaw = wrap(st.heading + shot.yaw); st.pitch = shot.pitch; st.dist = shot.dist;
    },
    // an event wants a particular framing now: 'face' for a note being read
    cutTo(kind) { force = kind; shot = null; },
    get shot() { return shot?.kind; },
  };
}
