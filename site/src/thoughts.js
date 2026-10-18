// Thought and speech bubbles over his head (core, both sites): what he says on the phone, at the window and the little daily musings
// for what he is doing. `say(text, secs)` lets a caller (the stream's chat notes) put a line in the bubble for a moment, and
// `setPace` changes how often the musings come (the stream wants them quicker).
import * as THREE from 'three';
import * as HIS from './thought-lines.js';
import { DAY_THOUGHTS } from './thought-lines.js';

const PHONE_LINES = [
  "hey, yeah i'm listening.",
  "just in the room, looking over the arrangement on this new track.",
  "did you listen to the paranoia master? the kick drum hits so clean now.",
  "pushed a fresh update to infinite this morning.",
  "wait, let me send you the export link right after this call.",
  "traffic was wild outside today honestly.",
  "just brewed a fresh cup of tea, it's finally quiet.",
  "found a really wild synth patch earlier, let me play it for you later.",
  "thinking of ordering some food, what are you having?",
  "want to hit the studio tomorrow? let's link up in the evening.",
  "testing the mix on different speakers to check the low end.",
  "sun is so bright outside today.",
  "looking at the redhand vinyl sleeve right now, turned out great.",
  "no no i'm not asleep, just spinning a record.",
  "yeah definitely, let's lock that in.",
  "cool, let me call you right back in a bit."
];

export { DAY_THOUGHTS };

// what the sim says about him right now (read-only): emotion, his lowest need and the next act he means to do.
// Seeded by the clock, not Math.random, so everyone watching the shared life sees the same line at the same time.
function simThought(core, doing, seed, L) {
  const { NEED_LINES, NEED_FIX, EMOTION_LINES, NEXT_LINES, DAY_THOUGHTS, ACT_LINES, TIME_LINES, SELF_LINES, hourBucket } = L;
  if (doing === 'sleep' || doing === 'nap_bench') return null;
  const h = n => { let x = (seed * 2654435761 + n * 40503) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; return (x >>> 0) / 4294967296; };
  const pick = (arr, n) => arr[Math.floor(h(n) * arr.length)];
  const m = core.motives || {};
  let need = null; for (const k in NEED_LINES) if ((m[k] ?? 1) < 0.35 && (!need || m[k] < m[need])) need = k;
  const emo = core.emotion?.current, plan = core.goal?.plan || [];
  let next = plan.find(a => a !== doing && NEXT_LINES[a]);
  if (!next) next = [...(core.chains?.nextActs?.() || [])].find(a => a !== doing && NEXT_LINES[a]);
  if (need && NEED_FIX[need] && (h(1) < 0.7 || !next)) next = NEED_FIX[need];           // a pressing need is what he heads for next
  const kinds = [];
  if (need) kinds.push('need', 'need');
  if (EMOTION_LINES[emo] && emo !== 'neutral') kinds.push('emo', 'emo');
  if (DAY_THOUGHTS[doing] || ACT_LINES[doing]) kinds.push('act');
  const tl = TIME_LINES[hourBucket(core.time?.hour ?? 12)];
  if (tl) kinds.push('time');
  kinds.push('self');
  if (L.RANDOM_LINES) kinds.push('rand', 'rand', 'rand');                              // a thought that just turns up, whatever he is doing
  const kind = kinds.length ? pick(kinds, 2) : null;
  let base = kind === 'need' ? pick(NEED_LINES[need], 3) : kind === 'emo' ? pick(EMOTION_LINES[emo], 3) : kind === 'act' ? pick(DAY_THOUGHTS[doing] || ACT_LINES[doing], 3) : kind === 'time' ? pick(tl, 3) : kind === 'self' ? pick(SELF_LINES, 3) : kind === 'rand' ? pick(L.RANDOM_LINES, 3) : null;
  if (!base) return null;
  const hint = kind !== 'rand' && next && NEXT_LINES[next] && h(4) < 0.45 ? ' ' + NEXT_LINES[next] : '';
  return base + hint;
}

// lines: another character's voice (same exports as thought-lines.js); doingOf: what to call the act (her chooser names differ from her sim's); phone: false for a character with no phone talk
export function makeThoughts({ el, man, camera, player, routine, window: win, core = () => null, lines = HIS, doingOf = null, phone = true }) {
  const DAY = lines.DAY_THOUGHTS;
  const headW = new THREE.Vector3(), p = el.querySelector('p');
  let phoneLineIdx = 0, phoneLineT = 0, currentPhoneLine = '';
  let casualT = 0, currentCasual = '', casualHold = 0;
  let pace = { every: 20, hold: 6 }, forced = null;
  const recent = [];                                                    // the last few lines shown: a line is not said again until others have had a turn

  function update(dt = 0.016) {
    const isWindow = !!win && player.st.seated === win && win.t > 0.8;
    const isPhone = phone && (player.st.seated?.act === 'phone' && (player.st.spec?.phone || player.st.seated?.t > 0.6)) || routine.doing === 'phone' || routine.doing === 'answer';
    const doing = (doingOf && doingOf()) || routine.doing;

    let text = '';
    if (forced && (forced.left -= dt) > 0) {
      text = forced.text;
    } else if (isWindow) {
      forced = null;
      text = win.text;
    } else if (isPhone) {
      forced = null;
      phoneLineT += dt;
      if (phoneLineT > 4.5 || !currentPhoneLine) {
        phoneLineT = 0;
        currentPhoneLine = PHONE_LINES[phoneLineIdx % PHONE_LINES.length];
        phoneLineIdx = (phoneLineIdx + 1) % PHONE_LINES.length;
      }
      text = `“${currentPhoneLine}”`;
    } else if (DAY[doing] || core()) {
      forced = null;
      casualT += dt;
      if (casualHold > 0) {
        casualHold -= dt;
        text = currentCasual;
      } else if (casualT > pace.every) {
        casualT = 0;
        const pool = DAY[doing] || lines.ACT_LINES?.[doing];
        let c = null; try { const k = core(); if (k && doing) { const seed = Math.floor(Date.now() / (pace.every * 1000)); for (let i = 0; i < 6 && !c; i++) { const t = simThought(k, doing, seed + i * 7919, lines); if (t && !recent.includes(t)) c = t; } } } catch { /* sim still loading: fall back */ }
        if (!c && pool) { const fresh = pool.filter(t => !recent.includes(t)); c = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))]; }
        currentCasual = c || '';
        if (c) { recent.push(c); if (recent.length > 8) recent.shift(); }
        if (!currentCasual) return void (el.hidden = true);
        casualHold = pace.hold;
        text = currentCasual;
      }
    } else {
      forced = null;
      casualHold = 0;
      currentCasual = '';
      phoneLineT = 0;
    }

    if (!text) {
      if (!el.hidden) el.hidden = true;
      return;
    }

    if (p.textContent !== text) p.textContent = text;
    if (el.hidden) el.hidden = false;

    man.bones.head.getWorldPosition(headW);
    headW.y += 0.45;
    headW.project(camera);
    el.style.left = ((headW.x + 1) / 2 * innerWidth) + 'px';
    el.style.top = ((1 - headW.y) / 2 * innerHeight) + 'px';
  }

  return {
    update,
    say(text, secs = 5) { forced = { text, left: secs }; },        // wins over everything but ends the moment it runs out
    setPace(next) { pace = { ...pace, ...next }; },
    get saying() { return !!forced && forced.left > 0; },
  };
}
