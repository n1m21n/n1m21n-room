// Chains of acts. Two jobs:
//  1. tracker: watches the acts he actually performs (the routine drives them today) and recognises normal and
//     abnormal chains as they complete or break, paying the chain's own ledger reward (an abnormal chain pays its
//     own, often mixed, event).
//  2. planner: builds a concrete step list for a chain (count ranges, optional steps skipped, rare reorder/abandon
//     when the chain stage is unstable) so the host can drive him through it.
import { CHAINS, CHAIN_DEFAULTS } from './data/world.gen.js';
import { TUNE } from './tune.js';

const inWindow = (win, min) => !win?.length || win.some(([a, b]) => (min >= a && min < b) || (min + 1440 >= a && min + 1440 < b));
const cmp = (op, a, b) => (op === '<' ? a < b : a > b);

export function makeChains({ rng, inst, ledger, def = CHAINS, gapSeconds = TUNE.chainGap, ctx = () => ({}) } = {}) {
  const live = new Map();                                       // id -> {idx, last, started, total, done:[]}
  const history = [];                                           // completed/broken for reports

  // which chains could start now (window + trigger); `emotion` and `motives` from the core
  function available({ min = 0, motives = {}, emotion = '', hasGrid = true, hasInventory = false } = {}) {
    const out = [];
    for (const [id, c] of Object.entries(def)) {
      if (!inWindow(c.window, min)) continue;
      if (c.requires?.includes('grid') && !hasGrid) continue;
      if (c.requires?.includes('inventory') && !hasInventory) continue;
      const t = c.trigger || {};
      let ok = true;
      if (t.motive) for (const [m, cond] of Object.entries(t.motive)) { const op = cond[0], x = parseFloat(cond.slice(1)); if (!cmp(op, motives[m] ?? 0.7, x)) ok = false; }
      if (t.emotion && !t.emotion.includes(emotion)) ok = false;
      if (ok) out.push(id);
    }
    return out;
  }

  // concrete plan for a chain: expand counts, drop optional steps (more often when unstable), rarely reorder/abandon
  function plan(id) {
    const c = def[id]; if (!c) return null;
    const pskip = 0.1 + (inst?.active('chain') ? inst.param('chain', 'skipOptional') * inst.lambda.chain * 3 : 0);
    const steps = [];
    for (const s of c.steps) {
      if (s.optional && rng.chance(pskip + 0.3)) continue;
      const n = Array.isArray(s.count) ? rng.int(s.count[0], s.count[1]) : (s.count || 1);
      for (let i = 0; i < n; i++) steps.push(s.act);
    }
    if (inst?.active('chain') && steps.length > 2 && rng.chance(inst.param('chain', 'reorder') * inst.lambda.chain)) {
      const i = rng.int(1, steps.length - 2); [steps[i], steps[i + 1]] = [steps[i + 1], steps[i]];
    }
    let abandonAt = -1;
    if (inst?.active('chain') && rng.chance(inst.param('chain', 'abandon') * inst.lambda.chain * steps.length)) abandonAt = rng.int(1, steps.length - 1);
    return { id, kind: c.kind, steps, abandonAt, reward: c.reward };
  }

  // tracker: call whenever he starts a new act. Chains advance when the observed act equals the next required step.
  function observe(act, now) {
    const events = [];
    const context = ctx() || {};
    for (const [id, c] of Object.entries(def)) {
      const req = c.steps.filter(s => !s.optional);
      const st = live.get(id);
      const flat = c.steps;
      if (st) {
        // timeout -> broken
        if (st.suspended != null) { const ev = settle(id, st, now); if (ev) { events.push(...ev); continue; } }
        if (now - st.last > gapSeconds) { events.push(...breakChain(id, st, 'timeout', now)); continue; }
        const next = nextIndex(flat, st);
        if (next >= 0 && flat[next].act === act) {
          st.counts[next] = (st.counts[next] || 0) + 1;
          const need = Array.isArray(flat[next].count) ? flat[next].count[0] : (flat[next].count || 1);
          if (st.counts[next] >= need) st.pos = next + 1;
          st.last = now;
          if (isComplete(flat, st)) events.push(...completeChain(id, st));
        } else if (flat.some((s, k) => k >= (st.pos ?? 0) && s.act === act)) {
          // skipped ahead over optional steps is fine; over required ones breaks it
          const k = flat.findIndex((s, i) => i >= (st.pos ?? 0) && s.act === act);
          const skippedRequired = flat.slice(st.pos ?? 0, k).some(s => !s.optional);
          // mid-repetition (one work stint of two), a jump ahead is a micro-break, not an abandoned goal: he comes back to it
          const cur = flat[st.pos ?? 0], partial = cur && Array.isArray(cur.count) && (st.counts[st.pos ?? 0] || 0) > 0;
          if (skippedRequired && partial && !st.paused) { st.paused = (st.paused || 0) + 1; st.last = now; }
          else if (skippedRequired) { events.push(...breakChain(id, st, 'skipped', now)); } else { st.pos = k + 1; st.last = now; if (isComplete(flat, st)) events.push(...completeChain(id, st)); }
        } else if (!(c.steps.some(s => s.act === act))) {
          // an unrelated act: tolerated until the gap timeout
        }
      } else if (flat[0].act === act || (flat[0].optional && flat.find(s => !s.optional)?.act === act)) {
        if (now >= 60 && context.enforceTriggers) {
          if (live.size >= 2) continue;
          if (!inWindow(c.window, now % 1440)) continue;
          const t = c.trigger || {};
          if (t.emotion && context.emotion && !t.emotion.includes(context.emotion)) continue;
          if (t.motive && context.motives) {
            let ok = true;
            for (const [m, cond] of Object.entries(t.motive)) { const op = cond[0], x = parseFloat(cond.slice(1)); if (!cmp(op, context.motives[m] ?? 0.7, x)) ok = false; }
            if (!ok) continue;
          }
        }
        const idx = flat[0].act === act ? 0 : flat.findIndex(s => !s.optional);
        const s = { pos: idx + 1, last: now, started: now, counts: { [idx]: 1 }, total: req.length };
        const need = Array.isArray(flat[idx].count) ? flat[idx].count[0] : (flat[idx].count || 1);
        if (need > 1) { s.pos = idx; }
        live.set(id, s);
        if (isComplete(flat, s)) events.push(...completeChain(id, s));
      }
    }
    return events;
  }

  function nextIndex(flat, st) { for (let i = st.pos ?? 0; i < flat.length; i++) return i; return -1; }
  function isComplete(flat, st) {
    for (let i = 0; i < flat.length; i++) {
      if (flat[i].optional) continue;
      const need = Array.isArray(flat[i].count) ? flat[i].count[0] : (flat[i].count || 1);
      if ((st.counts[i] || 0) < need) return false;
    }
    return true;
  }
  function completeChain(id, st) {
    live.delete(id);
    const c = def[id];
    ledger?.write(c.reward, { note: 'chain:' + id });
    history.push({ id, kind: c.kind, result: 'complete' });
    if (history.length > 100) history.shift();
    let to = null; const nx = (c.next || []).filter(b => def[b.to] && inWindow(def[b.to].window, (st.last || 0) % 1440));
    if (nx.length && (st.depth || 0) < 3 && rng.chance(0.6)) { const b = nx[+rng.weighted(Object.fromEntries(nx.map((x, i) => [i, x.w || 1])))]; to = b.to; if (!live.has(to)) live.set(to, { pos: 0, last: st.last, started: st.last, counts: {}, total: def[to].steps.filter(x => !x.optional).length, depth: (st.depth || 0) + 1, from: id }); }
    return [{ type: 'chain-complete', id, kind: c.kind, reward: c.reward, to }];
  }
  // a broken chain is not an ending: the next sequence is drawn from the chain's branches (cause/emotion filtered), else the
  // kind's defaults. "@resume" re-enters the same chain once. No eligible branch = a dead end (counted, should be rare).
  function pickBranch(id, why) {
    const c = def[id], emo = ctx().emotion || '';
    const ok = b => (!b.cause || b.cause.includes(why)) && (!b.emotion || b.emotion.includes(emo)) && (b.to !== '@resume' || !live.get(id)?.resumed) && (b.to === '@resume' || (def[b.to] && inWindow(def[b.to].window, (live.get(id)?.last ?? 0) % 1440)));
    let pool = (c.branches || []).filter(ok);
    if (!pool.length) pool = (CHAIN_DEFAULTS?.[c.kind] || []).filter(ok);
    if (!pool.length) return null;
    return pool[+rng.weighted(Object.fromEntries(pool.map((b, i) => [i, b.w || 1])))];
  }
  function breakChain(id, st, why, now = st.last) {
    const c = def[id], total = c.steps.filter(s => !s.optional).length || 1;
    const done = Object.keys(st.counts).length, remaining = Math.max(0, total - done);
    live.delete(id);
    if (!done && st.from) return [];                              // a branch he never started is just dropped, not a new break
    // only the optional opener happened (tea before work, a look in the fridge before a meal): the goal never formed, so drifting off is not a failure
    const reqDone = Object.keys(st.counts).filter(k => !c.steps[k]?.optional).length;
    if (!reqDone && why !== 'interrupt') { history.push({ id, kind: c.kind, result: 'dropped', why }); if (history.length > 100) history.shift(); return [{ type: 'chain-dropped', id, kind: c.kind, why }]; }
    if (done >= 2 || why === 'interrupt') ledger?.write('chain_broken', { scale: remaining / total, note: `chain:${id}:${why}` });
    history.push({ id, kind: c.kind, result: 'broken', why });
    if (history.length > 100) history.shift();
    const ev = { type: 'chain-broken', id, kind: c.kind, why, remaining, at: done, to: null };
    const depth = st.depth || 0;
    if (depth < 3) {
      st.resumed = st.resumed || false;
      live.set(id, st);                                           // so the resumed flag is visible to pickBranch
      const b = pickBranch(id, why);
      live.delete(id);
      if (b) {
        ev.to = b.to;
        if (b.to === '@resume') live.set(id, { ...st, last: now, resumed: true, depth: depth + 1 });
        else if (!live.has(b.to)) live.set(b.to, { pos: 0, last: now, started: now, counts: {}, total: def[b.to].steps.filter(s => !s.optional).length, depth: depth + 1, from: id });
      }
    }
    if (!ev.to && depth >= 3) ev.to = 'settle';                   // cascade limit: he settles instead of branching again
    if (!ev.to) ev.deadEnd = true;
    return [ev];
  }
  // a hard interruption (startle, bladder override, collapse) breaks everything in flight
  function interrupt(now) {
    const out = [];
    for (const [id, st] of [...live]) out.push(...breakChain(id, st, 'interrupt', now));
    return out;
  }
  // a soft interruption (phone, knock, stumble) suspends what is in flight instead of breaking it
  function suspend(now) {
    const out = [];
    for (const [id, st] of live) if (st.suspended == null) { st.suspended = now; out.push({ type: 'chain-suspended', id, kind: def[id].kind }); }
    return out;
  }
  // after the break: does he remember where he was? Longer breaks are forgotten more often (goal activation decays).
  // Returns events if the chain is lost, null if he picks it up again (its gap clock restarts now).
  function settle(id, st, now) {
    const away = Math.max(0, now - st.suspended);
    st.suspended = null;
    if (rng.chance(Math.exp(-away / (TUNE.resumeTau || 45)))) { st.last = now; st.resumes = (st.resumes || 0) + 1; return null; }
    return breakChain(id, st, 'interrupt', now);
  }
  function sweep(now) {
    const out = [];
    for (const [id, st] of [...live]) {
      if (st.suspended != null) { if (now > st.suspended) { const ev = settle(id, st, now); if (ev) out.push(...ev); } continue; }
      if (now - st.last > gapSeconds) out.push(...breakChain(id, st, 'timeout', now));
    }
    return out;
  }
  // acts that would advance a live chain (next two steps); and first steps of chains that could start now
  function nextActs() {
    const out = new Set();
    for (const [id, st] of live) { const flat = def[id].steps; for (let i = st.pos ?? 0, n = 0; i < flat.length && n < 2; i++, n++) out.add(flat[i].act); }
    return out;
  }
  // start a chain directly (a verdict chain after a render, or any scripted follow-up)
  function force(id, now) { if (!def[id] || live.has(id)) return false; live.set(id, { pos: 0, last: now, started: now, counts: {}, total: def[id].steps.filter(x => !x.optional).length, depth: 0, forced: true }); return true; }
  return {
    force, nextActs, available, plan, observe, interrupt, suspend, sweep, history,
    get live() { return [...live.keys()]; },
    snapshot: () => ({ live: [...live].map(([k, v]) => [k, v]), history: history.slice(-40) }),
    restore(s) { live.clear(); if (s) { for (const [k, v] of s.live || []) live.set(k, v); history.length = 0; history.push(...(s.history || [])); } },
  };
}
