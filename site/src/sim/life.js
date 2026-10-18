// The shared character. His canonical life is a pure function of (seed, real clock, nudge log): every visitor, on any device,
// computes the same him at the same moment. Visitors write to it only through the nudge log (see nudges.js): "at this real time,
// someone made him do X". Everyone replays the same log in the same order, so they still agree. Bumps and startles stay local.
// To keep it cheap, four-weekly checkpoints (public/sim/life.json, made by tools/sim/make_life.mjs) are loaded when
// available; without them the life is replayed from the epoch (fine for the first months: ~2.5 ms per simulated day).
import { makeSimCore } from './core.js';

export const LIFE_SEED = 2026;
export const LIFE_EPOCH_MS = Date.UTC(2026, 9, 17, 0, 0, 0) - 5.5 * 3600e3;   // 17 Oct 2026 00:00 IST
const START_MIN = 0;                                                           // story clock = IST clock: midnight at the epoch (the site shows IST, so his day must match it)

export const storyMinutesAt = (ms, epoch = LIFE_EPOCH_MS) => START_MIN + Math.max(0, (ms - epoch) / 60000);

export function makeLife({ seed = LIFE_SEED, epochMs = LIFE_EPOCH_MS, checkpoints = null, tune = null } = {}) {
  let core = makeSimCore({ seed, withGrid: false });
  let events = [], applied = 0, startAt = 0;                       // nudge log, sorted by (t, seq); `applied` = how many the core has already seen
  const fresh = () => { core = makeSimCore({ seed, withGrid: false }); applied = 0; startAt = 0; };
  const evMin = e => storyMinutesAt(e.t, epochMs);
  function best(target) {                                          // latest checkpoint at or before target (and before the first nudge, which a checkpoint would not contain)
    const cap = events.length ? Math.min(target, evMin(events[0])) : target;
    let b = null; for (const s of checkpoints?.snaps || []) if (s.tMin <= cap && (!b || s.tMin > b.tMin)) b = s; return b;
  }
  // replace the log (from the server). If it changed anywhere before what we already simulated, replay from a checkpoint.
  function setEvents(list) {
    const next = [...list].sort((a, b) => a.t - b.t || a.seq - b.seq);
    let same = next.length >= applied; for (let i = 0; same && i < applied; i++) if (events[i]?.seq !== next[i].seq) same = false;
    events = next;
    for (let i = applied; same && i < next.length; i++) if (evMin(next[i]) <= core.time.tMin) same = false;      // a nudge that is already in his simulated past (it reaches us a few seconds late): replay so it lands at its own moment
    if (!same) fresh();
  }
  const give = ev => core.cue({ act: ev.act, n: ev.n, secs: ev.secs });      // someone's visit: it leans him toward what they did and lifts his company and fun
  function at(ms = Date.now()) {
    const target = storyMinutesAt(ms, epochMs);
    if (core.time.tMin > target + 1e-6 && core.time.tMin - target > 60 * 24) fresh();    // time went backwards a lot: rebuild
    const cp = best(target);
    if (cp && cp.tMin > core.time.tMin && (applied === 0 || cp.tMin <= evMin(events[0]))) { core.restore(cp); applied = 0; }
    while (core.time.tMin < target) {
      const ev = events[applied], t = ev ? evMin(ev) : Infinity;
      if (ev && t <= core.time.tMin) { give(ev); applied++; continue; }       // due: his next act is the visitor's
      core.advance(target - core.time.tMin, t);                    // runs toward now, but stops at the first act boundary after the next visit's time so it lands in the same place for everyone
    }
    for (let ev; (ev = events[applied]) && evMin(ev) <= core.time.tMin; applied++) give(ev);      // an act can run a little past `now`; hand over nudges it passed so they are queued for his next act
    return core;
  }
  // what happened between two real moments, for "while you were away"
  function since(prevMs, nowMs = Date.now()) {
    const c = at(nowMs), t0 = storyMinutesAt(prevMs, epochMs);
    const ev = c.journal.filter(e => e.t >= t0);
    const acts = {}; for (const e of ev) if (e.kind === 'act') acts[e.act] = (acts[e.act] || 0) + 1;
    return { fromMin: Math.round(t0), toMin: Math.round(c.time.tMin), topActs: Object.entries(acts).sort((a, b) => b[1] - a[1]).slice(0, 5), notable: ev.filter(e => e.kind !== 'act' && e.kind !== 'outcome').slice(-8), emotion: c.emotion.current, days: c.days.slice(-3) };
  }
  return { at, since, setEvents, get core() { return core; }, fresh };
}
