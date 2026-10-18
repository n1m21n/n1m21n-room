// His day, on India time (IST, UTC+5:30), lived minute by minute: he wakes, uses the loo, brushes his teeth, showers,
// dresses, cooks and eats breakfast; works at the desk in stretches with breaks for tea, the loo, the fridge, the
// window; cooks lunch and dinner; makes music in the evening, reads, watches TV, sits in the gallery; brushes and goes
// to bed. Weekends he sleeps in and there's no work. Each day's plan comes from a seed of the date, so everyone
// visiting at the same moment finds him doing the same thing, and no two days are quite alike. You arrive to find him
// mid-way through whatever the minute says. Take the controls and he's yours; leave him alone for a while and he
// drifts back to what he'd be doing.
const IST = 5.5 * 3600e3;
// clock.skew (ms) shifts his day for previews and tests: ?at=07:30 (IST) or dev.routine.clock.at('07:30')
export const clock = { skew: 0, at(hm) { const [h, m] = hm.split(':').map(Number), n = Date.now() + IST, d = Math.floor(n / 864e5) * 864e5; this.skew = d + (h * 60 + m) * 6e4 - n; } };
{ const q = typeof location !== 'undefined' && new URLSearchParams(location.search).get('at'); if (q && /^\d{1,2}:\d\d$/.test(q)) clock.at(q); }
export const istNow = () => { const n = Date.now() + clock.skew + IST, d = new Date(n); return { h: d.getUTCHours(), m: d.getUTCMinutes(), day: Math.floor(n / 864e5), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
export const istClock = () => { const { h, m } = istNow(); return `${(h % 12) || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

import { makeUtilityAI } from './sim/utility.js';

const SAY = {
  sleep: 'he’s asleep', window: 'he’s looking out of the window', read: 'he’s reading', guitar: 'he’s playing guitar', keys: 'he’s making music',
  work: 'he’s at work', bench: 'he’s in the gallery', tv: 'he’s watching tv', dress: 'he’s getting dressed', loo: 'he’s in the loo',
  wash: 'he’s washing his face', brush: 'he’s brushing his teeth', shower: 'he’s in the shower', tea: 'he’s making tea', fridge: 'he’s at the fridge',
  cook: 'he’s cooking', eat: 'he’s eating', snake: 'he’s petting the snake', records: 'he’s browsing records',
  phone: 'he’s on the phone', answer: 'he’s on the phone', plant: 'he’s watering the plant', easel: 'he’s painting', write: 'he’s writing a letter',
  nap: 'he’s dozing on a bench', greet: 'he’s at the door', pace: 'he’s pacing', roam: 'he’s wandering about',
  yawn: 'he’s yawning', stretch: 'he’s stretching', sigh: 'he’s sighing', fidget: 'he’s fidgeting', sip: 'he’s having a sip', glance: 'he’s looking round', stumble: 'he tripped',
};
const GO = {
  sleep: 'off to bed', window: 'over to the window', read: 'picking up a book', guitar: 'picking up the guitar', keys: 'back to the keys',
  work: 'back to work', bench: 'off to the gallery', tv: 'putting the tv on', dress: 'getting dressed', loo: 'off to the loo',
  wash: 'washing his face', brush: 'brushing his teeth', shower: 'into the shower', tea: 'making tea', fridge: 'something from the fridge',
  cook: 'off to cook', eat: 'sitting down to eat', snake: 'over to the snake', records: 'flipping through the records',
  phone: 'making a call', answer: 'the phone’s ringing', plant: 'watering the plant', easel: 'to the easel', write: 'writing a letter',
  nap: 'a nap on the bench', greet: 'someone at the door', pace: 'pacing', roam: 'wandering about',
  yawn: 'a yawn', stretch: 'a stretch', sigh: 'a sigh', fidget: 'fidgeting', sip: 'a sip', glance: 'a look round', stumble: 'a trip',
};
// a small fast PRNG, seeded per day
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// the day's plan: [[minute of the day, what], ...] in order, from 00:00. `day` = days since 1970 (IST)
export function dayPlan(day) {
  const r = rng(day * 7919 + 17), j = n => Math.round((r() * 2 - 1) * n), pick = a => a[Math.floor(r() * a.length)];
  const weekend = [0, 6].includes((day + 4) % 7);                    // 1970-01-01 was a Thursday
  const plan = [[0, 'sleep']];
  let t = 0;
  const go = (what, mins) => { plan.push([t, what]); t += Math.max(1, Math.round(mins)); };
  const seq = list => { for (const [w, m] of list) go(w, m); };
  const breakFrom = () => pick(['loo', 'tea', 'fridge', 'window', 'loo', 'tea']);
  // fill up to `end` with `opts` in stretches of a..b minutes, a short break between them now and then
  const fill = (end, opts, a, b, breaks = 0.5) => {
    while (t < end - 5) {
      go(pick(opts), Math.min(end - t, a + r() * (b - a)));
      if (t < end - 12 && r() < breaks) { const w = breakFrom(); go(w, w === 'tea' ? 8 : w === 'window' ? 6 : 3); }
    }
    t = Math.max(t, end);
  };
  const meal = (at, eatFor) => { t = Math.max(t, at); seq([['cook', 12 + j(3)], ['eat', eatFor + j(4)]]); };

  // morning: up, loo, teeth, shower, dressed, breakfast
  t = 7 * 60 + (weekend ? 80 : 0) + j(20);
  seq([['loo', 4], ['brush', 3], ['shower', 9 + j(2)], ['dress', 4], ['cook', 10 + j(2)], ['eat', 14 + j(3)], ['window', 6 + j(2)]]);
  if (weekend) {
    fill(13 * 60 + j(15), ['keys', 'guitar', 'read', 'bench', 'tv', 'keys'], 30, 70);
    meal(t, 20); seq([['window', 8]]);
    fill(19 * 60 + j(20), ['keys', 'guitar', 'bench', 'read', 'tv', 'keys', 'guitar'], 30, 75);
  } else {
    fill(9 * 60 + 30 + j(10), ['read', 'guitar', 'keys'], 15, 30, 0);
    fill(13 * 60 + j(10), ['work'], 45, 80, 0.9);                    // the morning's work, in stretches with breaks
    meal(t, 18); seq([[pick(['window', 'read']), 12 + j(4)]]);
    fill(16 * 60 + 30 + j(10), ['work'], 45, 80, 0.7);
    seq([['tea', 8], [r() < 0.35 ? 'bench' : 'window', 12 + j(4)]]);
    fill(18 * 60 + 30 + j(15), ['work'], 30, 60, 0.6);
    fill(20 * 60 + 30 + j(15), ['keys', 'guitar', 'keys'], 30, 60, 0.4);
  }
  meal(t, 20);
  fill(23 * 60 + j(20), ['tv', 'read', 'keys', 'tv', 'bench', 'guitar'], 25, 50, 0.3);
  seq([['wash', 2], ['brush', 3], ['loo', 3], ['read', 15 + j(8)]]);
  go('sleep', 1);
  return plan;
}

// how he feels this minute: groggy for his first 40 minutes up, tired from 22:30 till bed, otherwise fresh
const wakes = {};
export function mood() {
  const { day, min } = istNow(), w = wakes[day] ??= dayPlan(day).find(e => e[1] !== 'sleep')[0];
  return min >= w && min < w + 40 ? 'groggy' : min >= 22 * 60 + 30 ? 'tired' : 'fresh';
}

// chooser (optional, ?sim=1): { next(current) -> spot name | null, hold(name) -> seconds } hands the choosing to the sim core
export function makeRoutine({ player, spots, toast, idleAfter = 120, utility = null, chooser = null }) {
  // spots: name -> { seat, at: [x, z] (where he walks to), face, start() (sit down and begin) }
  const ai = utility || makeUtilityAI();
  ai.registerSpots(spots);

  let plans = {};
  const planFor = day => { if (!plans[day]) plans = { [day]: dayPlan(day) }; return plans[day]; };
  function now() {
    const { day, min } = istNow(), plan = planFor(day);
    let i = plan.length - 1; while (plan[i][0] > min) i--;
    return { what: plan[i][1], since: min - plan[i][0] };
  }
  const planned = () => now().what;
  let mine = true, lastInput = performance.now(), doing = null, going = false, startedAt = performance.now(), holdFor = 0;
  const touched = () => { lastInput = performance.now(); mine = false; going = false; };
  for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, touched, { capture: true, passive: true });

  function begin(what, { walk }) {
    const s = spots[what]; if (!s) return;
    doing = what; startedAt = performance.now(); holdFor = chooser ? chooser.hold(what) * 1000 : 0;
    if (!walk) ai.setDoing(what);       // walking there: the utility AI starts the act (count, cooldown) when he arrives and sits
    const target = typeof s.at === 'function' ? s.at() : s.at;
    const face = typeof s.face === 'function' ? s.face() : s.face;
    if (!walk) { if (player.st.seated) player.stand(); s.start(); return; }
    going = true;
    player.goTo(target[0], target[1], { face, done: () => { if (going) { going = false; s.start(); } } });
  }
  // arriving: he's already at it, no walk
  function arrive() { const w = planned(); begin(w, { walk: false }); return `${istClock()} in india · ${SAY[w]}`; }

  // Pure Utility AI loop: continuously decay/restore motives; when idle, evaluate affordances every 3-4 seconds
  let acc = 0;
  function update(dt, { busy }) {
    const activeDoing = going ? null : (player.st.seated ? doing : (doing === 'snake' || doing === 'records' ? doing : null));
    ai.stepMotives(dt, { doing: activeDoing, idle: !activeDoing && !going });
    if ((acc += dt) < 3.5) return; acc = 0;
    if (busy || going || player.auto?.pts) return;
    if (!mine && performance.now() - lastInput < idleAfter * 1000) return;
    mine = true;
    if (chooser) {                                                     // the sim chooses; he stays with an act for its own length
      if (doing && performance.now() - startedAt < holdFor) return;
      const w = chooser.next(doing, spots);
      if (!w || !spots[w]) return;
      const s = spots[w];
      if (doing === w && (!s.seat || player.st.seated === s.seat)) { startedAt = performance.now(); return; }
      toast(`${istClock()} in india · ${GO[w] || w}`);
      begin(w, { walk: true });
      return;
    }
    const decision = ai.evaluate(player.pos, { current: activeDoing, available: spots });
    const w = decision.shouldSwitch && decision.best ? decision.best : null;
    if (!w) return;
    const s = spots[w];
    if (!s || (doing === w && s.seat && player.st.seated === s.seat)) return;
    toast(`${istClock()} in india · ${GO[w] || w}`);
    begin(w, { walk: true });
  }
  return {
    arrive, update, planned, now, dayPlan, clock, ai,
    get motives() { return ai.motives; },
    handBack() { lastInput = -1e9; mine = true; going = false; acc = 9; },      // the visitor lets go: he rejoins the live feed at once
    get mine() { return mine; },
    get doing() { return doing; },
  };
}
