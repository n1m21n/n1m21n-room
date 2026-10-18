// Chat errands, played on BOTH sites (core). An event (see functions/api/chatq.js) says: at time t0, he reads a note from `name` and
// does `cmd`. A note drops on the desk as soon as the event is known; at t0 he walks to the desk, picks it up, answers in a thought
// bubble, then does the act for its `secs`, and hands back to the shared life. The life itself is never changed here: everyone who
// has the page open sees the same errand at the same time because the server picks t0.
import { makeNotes } from './notes.js';
import { COMMANDS, replyFor, askText, SELF_LINES } from './commands.js';

const MISSED = 30000;                                              // ms late: the moment has passed, the note is just tucked away

export function makeErrands({ scene, desk, chair, man, player, routine, bubble, sfx, busy = () => false, music = null, onPlay = null }) {
  const notes = makeNotes({ scene, desk, man });
  const pending = [];                                              // { ev, at } at: local performance.now() when it starts
  let state = 'idle', t = 0, gt = 0, lastNow = performance.now(), cur = null;
  const mine = () => routine.mine;                                 // false while a visitor drives him: events wait or lapse
  const sleeping = () => routine.doing === 'sleep';
  const ready = () => !routine.walking && routine.since > 6000 && !busy() && !sleeping() && mine();

  function push(ev, at) {                                          // `at`: local clock time to start
    if (pending.some(p => p.ev.seq === ev.seq && ev.seq != null)) return;
    const p = { ev, at, note: { id: ev.seq, cmd: ev.cmd, name: ev.name, arg: ev.arg, self: ev.self, votes: ev.votes } };
    pending.push(p); notes.add(p.note); sfx.fx('tick');
  }
  const line = ev => {
    if (ev.self) return SELF_LINES[ev.cmd] || 'note to self.';
    if (ev.cmd === 'ask') return askText(ev.arg).replaceAll('{name}', ev.name);
    if (ev.cmd === 'play') { const hit = music?.find(ev.arg); return hit ? `${ev.name} asked for “${hit.title}”. good taste.` : `can't find that one, ${ev.name}.`; }
    return replyFor({ cmd: ev.cmd, name: ev.name });
  };

  function start(p) {
    cur = p; state = 'walk'; t = 0; gt = 0;
    routine.hold(40);
    player.goTo(chair.out[0], chair.out[1], { face: [chair.out[0], chair.z + 0.6], done: () => { if (state === 'walk') { state = 'read'; t = 0; read(); } } });
  }
  function read() {
    notes.pickUp(cur.note); sfx.fx('click'); man.face('curious'); onRead?.();
    bubble.say(line(cur.ev), 5.5); routine.hold(8);
  }
  function act() {
    notes.tuck(cur.note); const c = COMMANDS[cur.ev.cmd];
    state = 'do'; t = 0;
    if (!c?.spot || !routine.override(c.spot, c.secs)) { end(); return; }
    if (cur.ev.cmd === 'play') { const hit = music?.find(cur.ev.arg); if (hit && onPlay) onPlay(hit); }
    onAct?.(cur.ev);
  }
  let onAct = null, onRead = null;
  function end() { cur = null; state = 'idle'; t = 0; }

  return {
    push,
    set onAct(f) { onAct = f; },
    set onRead(f) { onRead = f; },
    update(frameDt) {
      const now = performance.now(), dt = Math.min(1, (now - lastNow) / 1000); lastNow = now;          // errand clock = wall time, so a slow frame rate does not stretch it
      t += dt; gt += frameDt; notes.update(frameDt);
      if (state === 'idle') {
        pending.sort((a, b) => a.at - b.at);
        const p = pending[0]; if (!p || now < p.at) return;
        if (now - p.at > MISSED || (!mine() && now - p.at > 2000)) { pending.shift(); notes.tuck(p.note); return; }
        if (ready()) { pending.shift(); start(p); }
      } else if (state === 'walk') {
        if (gt > 25 || t > 90) { player.cancelAuto(); notes.tuck(cur.note); end(); }
      } else if (state === 'read') {
        routine.hold(8); if (t > 5.5) act();
      } else if (state === 'do') {
        if (t > 1.5 && routine.since > (COMMANDS[cur.ev.cmd].secs + 2) * 1000) end();
      }
    },
    get busy() { return state !== 'idle'; },
    get state() { return state; },
    get waiting() { return pending.length; },
    cmd: () => cur?.ev.cmd,
    dbg: () => ({ walking: routine.walking, since: Math.round(routine.since), busy: busy(), sleeping: sleeping(), mine: mine(), lag: pending[0] ? Math.round(performance.now() - pending[0].at) : null }),
  };
}
