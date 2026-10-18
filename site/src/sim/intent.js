// Day-scale intentions: what he means to do today ("finish the piece", "call someone tonight"), held for hours.
// Formed in the morning (mood and energy shape the odds) or by an event (news to tell), each with a target window.
// While held they weigh up the matching acts, more as the window closes; done -> kept, window gone -> missed, and a
// missed one may carry over to tomorrow. Data: tools/emotions/intentions.json. Everything lives in the snapshot.
import { INTENTIONS as D } from './data/world.gen.js';
import { clamp } from './rng.js';

export function makeIntentions({ rng, def = D }) {
  const I = def.intentions || {};
  let held = [];                 // { id, from, to, carried, how: 'morning' | 'event' | 'carry' }
  let carry = [];                // ids missed yesterday that he still means to do
  let formedDay = -1;            // last day the morning intentions were formed
  const onDay = {};              // id -> day its event already had its one chance

  const urgency = (h, t) => t < h.from ? def.before : 0.6 + clamp((t - h.from) / Math.max(1, h.to - h.from)) * 1.0;
  // appeal multiplier for an act from what he means to do today
  function mul(act, t, pull = 1) {
    let m = 1;
    for (const h of held) { const r = I[h.id]; if (r.acts.includes(act)) m *= 1 + r.pull * pull * (h.carried ? def.carryPull : 1) * urgency(h, t); }
    return m;
  }
  const has = id => held.some(h => h.id === id);
  function hold(id, from, to, how, carried = false) { if (has(id) || to <= from) return null; const h = { id, from, to, carried, how }; held.push(h); return h; }

  // after every act: keep / miss / form. ctx: { act, done, t, day, valence, energy, artActive, fluent(f) -> level }
  function after(ctx) {
    const out = [], { t, day } = ctx, h0 = (t % 1440) / 60, d0 = day * 1440;
    if (ctx.done) for (const h of [...held]) {
      const r = I[h.id];
      // early: hours before the window that still count (lunch is not dinner)
      if ((r.done || r.acts).includes(ctx.act) && t >= h.from - (r.early ?? 24) * 60) { held.splice(held.indexOf(h), 1); out.push({ type: 'kept', id: h.id, late: t > h.to, carried: h.carried }); }
    }
    for (const h of [...held]) if (t > h.to) {
      held.splice(held.indexOf(h), 1);
      const again = rng.chance(I[h.id].carry || 0);
      if (again && !carry.includes(h.id)) carry.push(h.id);
      out.push({ type: 'missed', id: h.id, carried: again });
    }
    if (formedDay !== day && h0 >= def.formFrom && ctx.act !== 'sleep') {          // the first waking act of the day: what is today for?
      formedDay = day;
      for (const [id, r] of Object.entries(I)) {
        const from = d0 + r.window[0] * 60, to = d0 + r.window[1] * 60;
        if (t >= to) continue;
        if (carry.includes(id)) { if (hold(id, from, to, 'carry', true)) out.push({ type: 'formed', id, how: 'carry' }); continue; }
        let p = r.p || 0;
        for (const [k, v] of Object.entries(r.p_if || {})) if (ctx[k]) p = Math.max(p, v);
        p *= Math.max(0, 1 + (r.kValence || 0) * ((ctx.valence ?? 0.5) - 0.5)) * Math.max(0, 1 + (r.kEnergy || 0) * ((ctx.energy ?? 0.5) - 0.5));
        if (rng.chance(clamp(p, 0, 0.95)) && hold(id, from, to, 'morning')) out.push({ type: 'formed', id, how: 'morning' });
      }
      carry = [];
    }
    for (const [id, r] of Object.entries(I)) {                                    // an event: news to tell -> call someone about it
      if (!r.on || has(id) || onDay[id] === day || (ctx.fluent(r.on.fluent) ?? 0) < 0.5) continue;
      onDay[id] = day;
      if (rng.chance(r.on.p) && hold(id, t, t + r.on.within, 'event')) out.push({ type: 'formed', id, how: 'event' });
    }
    return out;
  }
  return {
    mul, after, get held() { return held.map(h => ({ ...h, label: I[h.id]?.label })); },
    snapshot: () => ({ held: held.map(h => ({ ...h })), carry: [...carry], formedDay, onDay: { ...onDay } }),
    restore(s) { if (!s) return; held = (s.held || []).filter(h => I[h.id]).map(h => ({ ...h })); carry = [...(s.carry || [])]; formedDay = s.formedDay ?? -1; for (const k of Object.keys(onDay)) delete onDay[k]; Object.assign(onDay, s.onDay || {}); },
  };
}
