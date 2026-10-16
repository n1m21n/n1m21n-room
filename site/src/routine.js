// His day, on India time (IST, UTC+5:30): asleep at night, at the desk through the working day, making music in the
// evening, reading, looking out of the window, now and then sitting in the gallery. You arrive to find him mid-way
// through whatever the hour says. Take the controls and he's yours; leave him alone for a while and he drifts back
// to what he'd be doing. Each half hour picks one of its options from a seed of the date, so everyone visiting at
// the same moment finds him doing the same thing.
const IST = 5.5 * 3600e3;
export const istNow = () => { const d = new Date(Date.now() + IST); return { h: d.getUTCHours(), m: d.getUTCMinutes(), day: Math.floor((Date.now() + IST) / 864e5) }; };
export const istClock = () => { const { h, m } = istNow(); return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

// [from hour, options]: weighted by repetition
const DAY = [
  [0, ['sleep']],
  [6, ['window', 'window', 'read']],
  [7, ['read', 'guitar']],
  [8, ['keys', 'guitar', 'window']],
  [9, ['work']],
  [13, ['read', 'window', 'guitar']],
  [14, ['work', 'work', 'work', 'bench']],
  [18, ['keys', 'guitar', 'keys']],
  [20, ['read', 'bench', 'keys', 'guitar']],
  [22, ['read', 'read', 'window']],
  [23, ['read', 'sleep']],
];
const SAY = { sleep: 'he’s asleep', window: 'he’s looking out of the window', read: 'he’s reading', guitar: 'he’s playing guitar', keys: 'he’s making music', work: 'he’s at work', bench: 'he’s in the gallery' };
const GO = { sleep: 'off to bed', window: 'over to the window', read: 'picking up a book', guitar: 'picking up the guitar', keys: 'back to the keys', work: 'back to work', bench: 'off to the gallery' };
const hash = n => { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; };

export function makeRoutine({ player, spots, toast, idleAfter = 120 }) {
  // spots: name -> { seat, at: [x, z] (where he walks to), face, start() (sit down and begin) }
  function planned() {
    const { h, m, day } = istNow();
    const opts = DAY.findLast(([from]) => h >= from)[1];
    return opts[hash(day * 48 + h * 2 + (m >= 30)) % opts.length];
  }
  let mine = true, lastInput = performance.now(), doing = null, going = false;
  const touched = () => { lastInput = performance.now(); mine = false; going = false; };
  for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, touched, { capture: true, passive: true });

  function begin(what, { walk }) {
    const s = spots[what]; if (!s) return;
    doing = what;
    if (!walk) { if (player.st.seated) player.stand(); s.start(); return; }
    going = true;
    player.goTo(s.at[0], s.at[1], { face: s.face, done: () => { if (going) { going = false; s.start(); } } });
  }
  // arriving: he's already at it, no walk
  function arrive() { const w = planned(); begin(w, { walk: false }); return `${istClock()} in india · ${SAY[w]}`; }

  // every few seconds: idle long enough (or never touched) and he isn't doing what the hour says -> go do it
  let acc = 0;
  function update(dt, { busy }) {
    if ((acc += dt) < 3) return; acc = 0;
    if (busy || going) return;
    if (!mine && performance.now() - lastInput < idleAfter * 1000) return;
    const w = planned(), s = spots[w];
    if (!s || (doing === w && player.st.seated === s.seat)) return;
    mine = true;
    toast(`${istClock()} in india · ${GO[w]}`);
    begin(w, { walk: true });
  }
  return { arrive, update, planned, get mine() { return mine; } };
}
