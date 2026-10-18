// The stream engine: only on ?stream=1 (OBS / YouTube), loaded on demand by main.js so the regular site never carries it.
// The stream is the one page that reads chat. It keeps the queue (votes, cooldowns), decides what he does next, and announces it to
// the server; the errand itself is played by src/errands/playback.js on every page, this one included. On top it owns the camera
// overlay, the test feed, the song cue for !play and the stream's quicker musings. It never changes the sim or the life. (The automatic camera is core: src/camera-director.js; the stream only cuts faster.)
import { makeHud } from './hud.js';
import { COMMANDS, HINTS, makeQueue, selfNote } from '../errands/commands.js';
import { testFeed, youtubeFeed } from './bridge.js';

const SELF_AFTER = 60, MAX_AHEAD = 2;      // seconds of quiet chat before a note to himself; events announced ahead of the one playing

export function startStream({ routine, bubble, errands, director, feed, nudges, params }) {
  const q = makeQueue(), hud = makeHud({ hints: HINTS });
  const chips = new Map();
  let quiet = 0, lastNow = performance.now(), busyUntil = 0, sending = false;
  errands.onAct = ev => { const c = COMMANDS[ev.cmd]; if (c?.nudge && !ev.self) nudges.play(c.nudge); };      // what chat asked for leans the shared days a little (the existing nudge log)
  errands.onRead = () => director.cutTo('face');                  // in on his face as he reads a note
  let sinceNudge = 0;
  bubble.setPace({ every: 9, hold: 5 });                           // musings twice as often as on the regular site

  function receive(m) {
    const r = q.offer(m); if (!r.ok) return r;
    const n = r.note, what = n.cmd ? '!' + n.cmd : 'a question';
    chips.get(n)?.remove(); chips.set(n, hud.chip(n.name, what, n.votes)); quiet = 0; return r;
  }
  if (params.get('feed') === 'test') { const f = testFeed(receive); window.chat = (text, name = 'you') => f.say(text, name); }
  else window.chat = (text, name = 'you') => receive({ user: 'dev:' + name, name, text });
  const yt = params.get('yt'); if (/^[\w-]{11}$/.test(yt || '')) youtubeFeed(yt, receive);

  async function announce(n) {                                     // a question is an errand too: he reads the note and answers it
    const cmd = n.ask ? 'ask' : n.cmd, ev = { cmd, name: n.name, arg: n.ask ? String(n.askId) : n.arg || '', votes: n.votes, self: !!n.self, secs: COMMANDS[cmd].secs };
    sending = true;
    const e = await feed.announce(ev).catch(() => null); sending = false;
    if (e) busyUntil = performance.now() + (e.t0 - Date.now()) + e.secs * 1000 - 6000;
    chips.get(n)?.remove(); chips.delete(n);
  }

  return {
    update(frameDt) {
      const now = performance.now(), dt = Math.min(1, (now - lastNow) / 1000); lastNow = now;
      if (nudges.playing && (sinceNudge += dt) > 120) { sinceNudge = 0; nudges.end(); }          // one summary every two minutes
      if (sending || now < busyUntil || errands.waiting >= MAX_AHEAD) { quiet = q.size ? 0 : quiet + dt; return; }
      const n = q.next();
      if (n) announce(n);
      else if ((quiet += dt) > SELF_AFTER) { quiet = 0; announce(selfNote()); }
    },
    receive,
    cueSong: () => {},                                             // !play is played by playback's onPlay (main.js hands it the music deck)
    dbg: () => ({ q: q.size, waiting: errands.waiting, errand: errands.state, quiet: Math.round(quiet) }),
  };
}
