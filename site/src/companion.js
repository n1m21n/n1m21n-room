// Her, in the room. A second puppet on the same rig with her own player (walking + acting, no camera, no input), her own posture, her
// own routine and her own sim: a second shared life (life.her.json, seed + tuning from tools/emotions/her.json) on the same India clock,
// so every visitor who spawns her sees the same her. Off by default; the toggle is per visitor (localStorage n1m21n.her, or ?her=1).
// She is a polite flatmate: the room's props are his (kettle, book, guitar), so her acts are the ones that need none of them plus a book of
// her own; when he is using the seat she wants she finds something else to do.
import * as THREE from 'three';
import { mesh } from './look.js';
import { PAL } from './textures.js';
import { loadHer } from './her.js';
import { makePlayer } from './player.js';
import { makeRoutine } from './routine.js';
import { makeUtilityAI } from './sim/utility.js';
import { makePosture } from './sim/posture.js';
import { makeBeats, moodClass, withBreaks } from './beats.js';
import { makeLife } from './sim/life.js';
import { HER } from './sim/data/her.gen.js';
import { SPOT_OF, MICRO } from './spot-of.js';
import { palmFrame, BOOK } from './acts.js';
import { makeThoughts } from './thoughts.js';
import * as LINES from './her-thought-lines.js';

const OFFSET = 211e3;                                        // her beats and breaks run on a clock a few minutes off his, so they never move in step
const SEATED = new Set(['sleep', 'work', 'keys', 'tv', 'read', 'window']);   // one at a time: he has first call
const STAND_IN = ['window', 'roam', 'pace', 'dance', 'records'];
const AWAY = new Set(['eat', 'cook', 'tea', 'fridge', 'shower', 'brush', 'wash', 'loo', 'dress', 'night_shower']);   // kitchen, bathroom and wardrobe: she steps out of the room for these
const LIKE = { write: 'work', phone: 'window', nap: 'read', bench: 'window', plant: 'roam', easel: 'roam', greet: 'roam', answer: 'window' };   // closest thing she can do here

// a closed book in her right hand, open between both hands: reading.js's prop, with a plain cover
function herBook(man, player, READ) {
  const HW = 0.15, HH = 0.22, book = new THREE.Group(); book.visible = false;
  const halves = [1, -1].map(s => {
    const h = new THREE.Group();
    const board = mesh(new THREE.BoxGeometry(HW, HH, 0.012), '#7A1F3D', { ink: 0.004 }); board.position.x = s * HW / 2; h.add(board);
    const page = mesh(new THREE.PlaneGeometry(HW - 0.012, HH - 0.012), PAL.cream, { ink: false }); page.position.set(s * HW / 2, 0, -0.0065); page.rotation.y = Math.PI; h.add(page);
    book.add(h); return h;
  });
  man.root.add(book);
  const hw = new THREE.Vector3(), m4 = new THREE.Matrix4();
  READ.leave = () => { book.visible = false; };
  return () => {
    const sp = player.st.seated === READ ? player.st.spec : null;
    if (!sp || sp.book === 'shelf') { book.visible = false; return; }
    book.visible = true;
    if (sp.book === 'hand') {
      const { pos, F, N, PALM_T } = palmFrame(man, 'handR');
      book.position.copy(pos).addScaledVector(N, PALM_T + 0.013);
      book.quaternion.setFromRotationMatrix(m4.makeBasis(hw.crossVectors(F, N), F, N));
      book.position.addScaledVector(hw.normalize(), -HW / 2);
      halves[0].rotation.y = 0; halves[1].rotation.y = Math.PI;
    } else { book.position.set(...BOOK.pos); book.rotation.set(BOOK.tilt, 0, 0); halves[0].rotation.y = BOOK.open; halves[1].rotation.y = -BOOK.open; }
  };
}

// ctx: { scene, camera, solids, walls, nav, rooms, seats: { BED, CHAIR, KEYS, WINDOW, TV, READ }, snake, him: { player, routine }, ROAM, PACE }
export async function makeCompanion(ctx) {
  const { scene, solids, walls, nav, rooms, seats, him } = ctx;
  const man = await loadHer();
  man.pose('stand'); man.root.visible = false; scene.add(man.root);
  const herPosture = makePosture({ getMotives: () => ai.motives, getSnakePos: () => ctx.snake.head.position });
  const herMood = () => { try { const c = life.at(Date.now() + OFFSET); return moodClass({ emotion: c.emotion.current, affect: c.affect, motives: c.motives, clock: 'fresh' }); } catch { return 'calm'; } };
  const beats = makeBeats({ mood: herMood, now: () => Date.now() + OFFSET });
  const player = makePlayer({ man, scene, camera: ctx.camera, canvas: document.createElement('canvas'), solids, walls, nav, rooms, posture: herPosture, beats, companion: true });
  const ai = makeUtilityAI();

  let life = makeLife({ profile: HER, seed: HER.seed });
  fetch('/sim/life.her.json').then(r => r.ok ? r.json() : null).then(cp => { if (cp) life = makeLife({ profile: HER, seed: HER.seed, checkpoints: cp }); }).catch(() => {});

  // spots: her own copies of the seats (a seat is mutated while it is sat on), a little off his where they share a bed
  const cp = s => ({ ...s, enter: null, leave: null });
  const BED = { ...cp(seats.BED), x: seats.BED.x + 0.3 };
  const at = (seat, face) => ({ seat, at: seat.out || [seat.x, seat.z], face, start: () => player.sit(seat) });
  const here = act => ({ at: () => [player.pos.x, player.pos.z], start: () => { const s = { x: player.pos.x, z: player.pos.z, heading: player.st.heading, act, out: [player.pos.x, player.pos.z] }; player.sit(s); } });
  const READ = { ...cp(seats.READ), book: null };
  const bookUpdate = herBook(man, player, READ);
  const PACE = ctx.PACE, ROAM = ctx.ROAM, walker = { at: 0, i: 0 }, DOOR = [3.0, 1.6];
  let away = false, meeting = null;                          // meeting: she has gone over to say hi to him { at, arrived }
  const spots = {
    sleep: at(BED), work: at(cp(seats.CHAIR)), keys: at(cp(seats.KEYS)), window: at(cp(seats.WINDOW)), tv: at(cp(seats.TV)), read: at(READ),
    records: { at: [1.3, -2.05], face: [1.3, -2.8], start: () => man.face('delighted') },
    snake: { at: () => [ctx.snake.head.position.x, ctx.snake.head.position.z], face: () => [ctx.snake.head.position.x, ctx.snake.head.position.z], start: () => man.face('delighted') },
    yawn: here('yawn'), stretch: here('stretch'), sigh: here('sigh'), fidget: here('fidget'), sip: here('sip'), glance: here('glance'), stumble: here('stumble'), dance: here('dance'),
    away: { at: DOOR, start: () => { away = true; if (player.st.seated) player.stand(); man.root.visible = false; } },
    meet: { at: () => { const hp = him.player.pos, dx = player.pos.x - hp.x, dz = player.pos.z - hp.z, d = Math.hypot(dx, dz) || 1; return [hp.x + dx / d * 1.15, hp.z + dz / d * 1.15]; }, face: () => [him.player.pos.x, him.player.pos.z],
      start: () => { meeting.arrived = true; meeting.arrivedAt = Date.now(); here('greet').start(); const hp = him.player; if (!hp.st.seated && !him.routine.walking) hp.st.turnTo = Math.atan2(player.pos.x - hp.pos.x, player.pos.z - hp.pos.z); } },
    pace: { at: PACE[0], start: () => { walker.at = 0; } }, roam: { at: ROAM[0], start: () => { walker.at = 0; } },
  };

  // her chooser: what her own life is doing now; anything she has no spot for, or a seat he is on, becomes something she can do
  const takenByHim = w => SEATED.has(w) && him.routine.doing === w && (him.player.st.seated || him.routine.walking);
  const pick = (w0, current) => {
    const w = LIKE[w0] || w0;
    if (!spots[w] || takenByHim(w)) { const alt = STAND_IN.filter(a => !takenByHim(a)); return alt[Math.floor(Date.now() / 600e3) % alt.length]; }
    return w;
  };
  const chooser = withBreaks({
    next(current) {
      const a = life.at(Date.now()).doing, w0 = SPOT_OF[a] || a;
      if (MICRO.has(w0) && (player.st.seated || current === w0)) return null;
      const w = AWAY.has(w0) ? 'away' : pick(w0, current);
      if (away && w !== 'away') { away = false; man.root.visible = on; }                              // back from the kitchen: she walks in from the door
      return w;
    },
    hold: () => 0,
  }, { now: () => Date.now() + OFFSET, mood: herMood });
  const routine = makeRoutine({ chooser, player, utility: ai, toast: () => {}, spots, solo: true });

  // she walks over to him and waves (the card's "say hi", and now and then on her own when both are about)
  function sayHi() { if (!on || away || meeting || him.routine.walking) return false; meeting = { at: Date.now(), arrived: false }; if (player.st.seated) player.stand(); routine.override('meet', 60); return true; }
  function endMeeting() { if (!meeting) return; const m = meeting; meeting = null; routine.hold(0); routine.handBack(); }
  let hiAt = 0;
  function maybeHi(dt) { if ((hiAt += dt) < 30) return; hiAt = 0; if (Math.floor(Date.now() / 600e3) % 2 === 0 && Math.random() < 0.08 && !player.st.seated && routine.doing !== 'away') sayHi(); }

  // her thought bubble: her own voice (her-thought-lines.js), her own sim, and her own rhythm (a line every ~28 s, not his 20)
  const herCore = () => { try { return life.at(Date.now()); } catch { return null; } };
  const bubbleEl = document.getElementById('thought-her');
  const bubble = makeThoughts({ el: bubbleEl, man, camera: ctx.camera, player, routine: { get doing() { return routine.doing; } }, window: null, core: herCore, lines: LINES, doingOf: () => herCore()?.doing, phone: false });
  bubble.setPace({ every: 28, hold: 6.5 });

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
    player.pos.set(DOOR[0], 0, DOOR[1]); player.st.heading = -Math.PI / 2; player.st.speed = 0; player.st.seated = null;
    man.root.position.set(DOOR[0], 0, DOOR[1]); man.root.visible = true; away = false; routine.handBack();
  }
  function hide() {
    if (!on) return; on = false; away = false; bubbleEl.hidden = true;
    if (player.st.seated) player.stand(); player.cancelAuto(); man.root.visible = false;
  }
  function update(dt, t) {
    if (!on) return;
    let core = null; try { core = life.at(Date.now()); } catch { /* the life is still loading */ }
    herPosture.setSimEmotion(core?.emotion.current);
    player.update(dt, t);
    routine.update(dt, { busy: false });
    stepWalker(dt); bookUpdate(); maybeHi(dt);
    if (man.root.visible && !meeting && !player.st.seated?.act?.startsWith?.('greet')) bubble.update(dt); else bubbleEl.hidden = true;
    if (meeting?.arrived && player.st.seated && Date.now() - meeting.arrivedAt > 6e3) player.stand();      // the wave has had its moment
    if (meeting && ((meeting.arrived && !player.st.seated) || Date.now() - meeting.at > 45e3)) endMeeting();
    // never through him: if they meet on the floor she steps aside
    const dx = player.pos.x - him.player.pos.x, dz = player.pos.z - him.player.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.55 && !player.st.seated && d > 1e-3) { const k = (0.55 - d) / d * 0.5; player.pos.x += dx * k; player.pos.z += dz * k; }
  }
  return { man, player, routine, bubble, show, hide, update, sayHi, get meeting() { return !!meeting; }, get on() { return on; }, get core() { return life.at(Date.now()); }, life: () => life };
}
