// A second (third, fourth) character in the room, from a spec (cast/characters/<id>.js). A puppet on the same rig with its own player (walking and
// acting, no camera), its own posture and body rhythm, its own routine and its own sim: a second shared life (life.<id>.json, seed + tuning from
// tools/emotions/characters/<id>.json) on the same India clock, so every visitor who brings the character in sees the same one. Off by default;
// cast.js owns the toggle and the awareness between characters.
// They are polite flatmates: the room's props are his (kettle, book, guitar), so their acts are the ones that need none of them plus their own props; whoever
// holds a seat keeps it, and the lead (him) has first call: a character in the seat he is heading for gets up.
import { makePlayer } from './player.js';
import { makeRoutine } from './routine.js';
import { makeUtilityAI } from './sim/utility.js';
import { makePosture } from './sim/posture.js';
import { makeBeats, moodClass, withBreaks } from './beats.js';
import { makeLife } from './sim/life.js';
import { makeThoughts } from './thoughts.js';
import { SPOT_OF, MICRO } from './spot-of.js';
import { standOff } from './cast/awareness.js';

const SEATED = new Set(['sleep', 'work', 'keys', 'tv', 'read', 'window']);   // one at a time: whoever is there keeps it

// ctx: { scene, camera, solids, walls, nav, rooms, seats: { BED, CHAIR, KEYS, WINDOW, TV, READ }, snake, ROAM, PACE, aware, lead: { player, routine } }
export async function makeCompanion(ctx, spec) {
  const { scene, solids, walls, nav, rooms, seats, aware, lead } = ctx;
  const OFFSET = spec.life.offsetMs, profile = spec.profile, id = spec.id;
  const man = await spec.look();
  man.pose('stand'); man.root.visible = false; scene.add(man.root);
  const self = { id, lead: false, player: null, doing: () => routine.doing, visible: () => on && man.root.visible };
  const posture = makePosture({ getMotives: () => ai.motives, getSnakePos: () => ctx.snake.head.position, getOthers: () => aware.othersFor(self), style: profile.motion });
  const mood = () => { try { const c = life.at(Date.now() + OFFSET); return moodClass({ emotion: c.emotion.current, affect: c.affect, motives: c.motives, clock: 'fresh' }); } catch { return 'calm'; } };
  const beats = makeBeats({ mood, now: () => Date.now() + OFFSET });
  const player = makePlayer({ man, scene, camera: ctx.camera, canvas: document.createElement('canvas'), solids, walls, nav, rooms, posture, beats, companion: true, motion: profile.motion });
  self.player = player; player.setAvoid(() => aware.circlesFor(self));
  const ai = makeUtilityAI();

  let life = makeLife({ profile, seed: profile.seed });
  fetch(spec.life.file).then(r => r.ok ? r.json() : null).then(cp => { if (cp) life = makeLife({ profile, seed: profile.seed, checkpoints: cp }); }).catch(() => {});

  // spots: this character's own copies of the seats (a seat is mutated while it is sat on), a little off his where they share a bed
  const cp = s => ({ ...s, enter: null, leave: null });
  const BED = { ...cp(seats.BED), x: seats.BED.x + (spec.bedOffset || 0) };
  const at = (seat, face) => ({ seat, at: seat.out || [seat.x, seat.z], face, start: () => player.sit(seat) });
  const here = act => ({ at: () => [player.pos.x, player.pos.z], start: () => { const s = { x: player.pos.x, z: player.pos.z, heading: player.st.heading, act, out: [player.pos.x, player.pos.z] }; player.sit(s); } });
  const READ = { ...cp(seats.READ), book: null };
  let propUpdate = () => {};
  if (spec.props) { const mk = await spec.props(); propUpdate = mk(man, player, READ) || propUpdate; }
  const PACE = ctx.PACE, ROAM = ctx.ROAM, walker = { at: 0, i: 0 }, DOOR = spec.spawn.at;
  let away = false, meeting = null, controlled = false, avoid = new Map();    // meeting: walking over to someone { to, how, at, arrived }; avoid: acts to skip until a time
  const spots = {
    sleep: at(BED), work: at(cp(seats.CHAIR)), keys: at(cp(seats.KEYS)), window: at(cp(seats.WINDOW)), tv: at(cp(seats.TV)), read: at(READ),
    records: { at: [1.3, -2.05], face: [1.3, -2.8], start: () => man.face('delighted') },
    snake: { at: () => [ctx.snake.head.position.x, ctx.snake.head.position.z], face: () => [ctx.snake.head.position.x, ctx.snake.head.position.z], start: () => man.face('delighted') },
    yawn: here('yawn'), stretch: here('stretch'), sigh: here('sigh'), fidget: here('fidget'), sip: here('sip'), glance: here('glance'), stumble: here('stumble'), dance: here('dance'),
    away: { at: DOOR, start: () => { away = true; if (player.st.seated) player.stand(); man.root.visible = false; } },
    meet: {
      at: () => { const t = aware.get(meeting.to).player.pos; return standOff(player.pos, t, meeting.how === 'wave' ? 1.15 : 1.7); },    // an absorbed person is greeted from further off
      face: () => { const t = aware.get(meeting.to).player.pos; return [t.x, t.z]; },
      start: () => {
        meeting.arrived = true; meeting.arrivedAt = Date.now();
        const to = aware.get(meeting.to), tp = to.player;
        (meeting.how === 'wave' ? here('greet') : here('glance')).start();
        if (meeting.how === 'wave' && !tp.st.seated && !to.routine?.walking) tp.st.turnTo = Math.atan2(player.pos.x - tp.pos.x, player.pos.z - tp.pos.z);   // they turn round to answer, if they are free
      },
    },
    pace: { at: PACE[0], start: () => { walker.at = 0; } }, roam: { at: ROAM[0], start: () => { walker.at = 0; } },
  };

  // the chooser: what this character's own life is doing now; anything it has no spot for, or a seat someone else holds, becomes something it can do
  const AWAY = new Set(spec.away || []), STAND_IN = spec.standIn || ['roam', 'pace'], LIKE = spec.likes || {};
  const others = () => aware.members.filter(m => m !== self && m.visible());
  const heldByOther = w => SEATED.has(w) && others().some(m => m.doing() === w && (m.player.st.seated || m.routine?.walking));
  const skip = w => (avoid.get(w) || 0) > Date.now();
  const pick = w0 => {
    const w = LIKE[w0] || w0;
    if (!spots[w] || heldByOther(w) || skip(w)) { const alt = STAND_IN.filter(a => !heldByOther(a) && !skip(a)); return alt[Math.floor(Date.now() / 600e3) % alt.length]; }
    return w;
  };
  const chooser = withBreaks({
    next(current) {
      const a = life.at(Date.now()).doing, w0 = SPOT_OF[a] || a;
      if (MICRO.has(w0) && (player.st.seated || current === w0)) return null;
      const w = AWAY.has(w0) ? 'away' : pick(w0);
      if (away && w !== 'away') { away = false; man.root.visible = on; }                              // back from the kitchen: walks in from the door
      return w;
    },
    hold: () => 0,
  }, { now: () => Date.now() + OFFSET, mood });
  const routine = makeRoutine({ chooser, player, utility: ai, toast: () => {}, spots, solo: true });

  // greeting someone: walk over, then wave (they are free) or only nod (they are absorbed); someone doing something private is left alone
  function greet(toId = lead.id) {
    const to = aware.get(toId); if (!on || away || meeting || controlled || !to) return { ok: false, why: 'not now' };
    const g = aware.canGreet(self, to); if (!g.ok) return g;
    if (to.routine?.walking) return { ok: false, why: 'on the move' };
    meeting = { to: toId, how: g.how, at: Date.now(), arrived: false }; if (player.st.seated) player.stand(); routine.override('meet', 60);
    return g;
  }
  function endMeeting() { if (!meeting) return; meeting = null; routine.hold(0); routine.handBack(); }
  let hiAt = 0;
  function maybeHi(dt) { if ((hiAt += dt) < 30) return; hiAt = 0; if (Math.floor(Date.now() / 600e3) % 2 === 0 && Math.random() < 0.08 && !player.st.seated && routine.doing !== 'away') greet(); }

  // a seat the lead is heading for (or sitting in) is his: whoever is in it gets up and does something else for a while
  function yieldSeat() {
    const s = player.st.seated; if (!s || !s.seat && !s.x) return;
    const lr = lead.routine, lp = lead.player; if (!lr.walking && !lp.st.seated) return;
    const ls = lr.spots[lr.doing]; if (!ls?.seat) return;
    const t = typeof ls.at === 'function' ? ls.at() : ls.at; if (!t) return;
    if (Math.hypot((s.out?.[0] ?? s.x) - t[0], (s.out?.[1] ?? s.z) - t[1]) < 0.9 && routine.doing !== 'meet') { avoid.set(routine.doing, Date.now() + 300e3); player.stand(); routine.hold(0); routine.handBack(); }
  }

  // thought bubble: this character's own voice and sim, at their own rhythm
  const core = () => { try { return life.at(Date.now()); } catch { return null; } };
  const bubbleEl = ctx.bubbleEl(spec);
  let bubble = null;
  spec.lines().then(L => { bubble = makeThoughts({ el: bubbleEl, man, camera: ctx.camera, player, routine: { get doing() { return routine.doing; } }, window: null, core, lines: L, doingOf: () => core()?.doing, phone: false }); bubble.setPace(spec.bubble || { every: 28, hold: 6.5 }); });

  function stepWalker(dt) {
    const w = routine.doing; if ((w !== 'pace' && w !== 'roam') || player.st.seated || player.auto.pts) { walker.at = 0; return; }
    if ((walker.at += dt) < (w === 'pace' ? 2 : 3.5)) return;
    walker.at = 0; walker.i++;
    const p = w === 'pace' ? PACE[walker.i % 2] : ROAM[(walker.i * 3 + Math.floor(Date.now() / 60e3)) % ROAM.length];
    player.goTo(p[0], p[1]);
  }

  let on = false;
  function show() {
    if (on) return; on = true;
    player.pos.set(DOOR[0], 0, DOOR[1]); player.st.heading = spec.spawn.heading; player.st.speed = 0; player.st.seated = null;
    man.root.position.set(DOOR[0], 0, DOOR[1]); man.root.visible = true; away = false; routine.handBack();
  }
  function hide() {
    if (!on) return; on = false; away = false; meeting = null; controlled = false; bubbleEl.hidden = true;
    if (player.st.seated) player.stand(); player.cancelAuto(); man.root.visible = false;
  }
  // the visitor takes the controls (keys, stick, taps follow the camera of the lead's player) or lets go: the character's own day resumes
  function setControlled(on_, source) {
    controlled = on_; meeting = null;
    player.setInputFrom(on_ ? source : null); player.setInput(on_);
    if (on_) { player.cancelAuto(); if (player.st.seated) player.stand(); } else routine.handBack();
  }
  // under the visitor's hands: what E does here. Standing near one of the spots (a seat, the records, the snake) she walks the last bit and does it; seated, E gets up;
  // with nothing near she does a small thing of her own (stretch, sip, a yawn, a dance). Any move input ends it.
  const NEAR_R = 1.9, LABEL = { sleep: 'lie down', work: 'work', keys: 'keys', window: 'look out', tv: 'tv', read: 'read', records: 'records', snake: 'pet the snake' }, FREE = ['stretch', 'sip', 'sigh', 'yawn', 'dance'];
  let freeI = 0;
  function nearSpot() {
    if (player.st.seated) return { label: 'get up', act: () => player.stand() };
    let best = null, bd = NEAR_R;
    for (const k in LABEL) {
      const sp = spots[k]; if (!sp || heldByOther(k)) continue;
      const at = typeof sp.at === 'function' ? sp.at() : sp.at, d = Math.hypot(at[0] - player.pos.x, at[1] - player.pos.z);
      if (d < bd) { bd = d; best = { label: LABEL[k], act: () => { const f = typeof sp.face === 'function' ? sp.face() : sp.face; player.goTo(at[0], at[1], { done: () => sp.start(), face: f }); } }; }
    }
    if (best) return best;
    const a = FREE[freeI % FREE.length];
    return { label: a, act: () => { here(a).start(); freeI++; } };
  }
  function update(dt, t) {
    if (!on) return;
    const c = core();
    posture.setSimEmotion(c?.emotion.current);
    player.update(dt, t);
    if (!controlled) {
      routine.update(dt, { busy: false });
      stepWalker(dt); maybeHi(dt); yieldSeat();
      if (meeting?.arrived && player.st.seated && Date.now() - meeting.arrivedAt > 6e3) player.stand();      // the wave has had its moment
      if (meeting && ((meeting.arrived && !player.st.seated) || Date.now() - meeting.at > 45e3)) endMeeting();
    }
    propUpdate();
    if (bubble && man.root.visible && !meeting && !controlled) bubble.update(dt); else bubbleEl.hidden = true;
  }
  return {
    id, spec, man, player, routine, self, show, hide, update, greet, setControlled, nearSpot,
    get bubble() { return bubble; }, get on() { return on; }, get meeting() { return !!meeting; }, get controlled() { return controlled; },
    get core() { return life.at(Date.now()); }, life: () => life,
    get doing() { return routine.doing; },
  };
}
