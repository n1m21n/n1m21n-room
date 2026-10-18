// Who is where, and what each may do about it. Characters in the room (cast.js) are aware of each other in three ways:
//   bodies    nobody walks through anyone: each walker is pushed out of the others' circles (a seated or lying one counts as a bigger one)
//   manners   someone doing something private is left alone, someone absorbed is only acknowledged, someone free gets the full greeting
//   seats     the lead (him, the shared life everyone sees) has first call on a seat: whoever sits where the lead is heading gets up
// Pure functions + one small factory; no three.js, so tests can drive it.

export const BODY_R = 0.3;                    // a standing character
const SEAT_R = 0.45, LIE_R = 0.85;            // seated at a desk, lying on the bed
// how interruptible each spot is (routine spot names, as in main.js / companion.js)
const PRIVATE = new Set(['sleep', 'nap', 'nap_bench', 'shower', 'night_shower', 'brush', 'wash', 'loo', 'dress', 'bath', 'away']);
const ABSORBED = new Set(['work', 'keys', 'guitar', 'easel', 'write', 'phone', 'answer', 'cook', 'tea', 'eat', 'read', 'tv', 'records']);
export const manners = doing => PRIVATE.has(doing) ? 'private' : ABSORBED.has(doing) ? 'absorbed' : 'free';

export function makeAwareness() {
  const members = [];                           // { id, lead, player, routine, visible(), doing() }
  const seatR = m => { const s = m.player.st.seated; return !s ? BODY_R : (s.pose === 'lying' || m.player.st.spec?.lie || m.doing() === 'sleep') ? LIE_R : SEAT_R; };
  return {
    members,
    add(m) { members.push(m); return m; },
    remove(id) { const i = members.findIndex(m => m.id === id); if (i >= 0) members.splice(i, 1); },
    get(id) { return members.find(m => m.id === id); },
    // circles a walker must stay out of (everyone else who is in the room); the lead is pushed less so it is the other who steps aside
    circlesFor(self) {
      const out = [];
      for (const m of members) {
        if (m === self || !m.visible()) continue;
        out.push({ x: m.player.pos.x, z: m.player.pos.z, r: seatR(m) + BODY_R * 0.5, w: m.lead ? 1 : 0.4 });
      }
      return out;
    },
    // places of interest for the glance system (sim/posture.js getOthers): other people are worth a look
    othersFor(self) {
      return members.filter(m => m !== self && m.visible()).map(m => ({ name: 'person', who: m.id, x: m.player.pos.x, y: m.player.st.seated ? 1.1 : 1.5, z: m.player.pos.z }));
    },
    // can `from` do `kind` ('hi') to `to` right now? -> { ok, how }: how = 'wave' | 'nod' | null (+ why)
    canGreet(from, to) {
      if (!to || !to.visible()) return { ok: false, why: 'not here' };
      const k = manners(to.doing());
      if (k === 'private') return { ok: false, why: 'busy' };
      return { ok: true, how: k === 'free' ? 'wave' : 'nod' };
    },
    distance(a, b) { return Math.hypot(a.player.pos.x - b.player.pos.x, a.player.pos.z - b.player.pos.z); },
  };
}

// a point `d` m from `target`, on the side `from` is on (so she never has to cross him to reach him)
export function standOff(from, target, d) {
  const dx = from.x - target.x, dz = from.z - target.z, L = Math.hypot(dx, dz) || 1;
  return [target.x + dx / L * d, target.z + dz / L * d];
}
