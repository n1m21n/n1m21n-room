// The ledger: one list of events, each adding to fading emotional traces, nudging neuromodulators, and leaking
// pressure onto motives. Erratic events weigh kindWeight (3x) more than normal ones. Every mood can be traced back:
// ledger.recent(n) returns entries with their remaining strength.
import { LEDGER, STABILITY } from './data/world.gen.js';
import { clamp } from './rng.js';

export function makeLedger({ rng, neuro, inst, def = LEDGER, coupling: couplingDef = STABILITY.coupling, maxEntries = 300 } = {}) {
  const traces = {};
  for (const k in def.traces) traces[k] = 0;
  const entries = [];                                           // newest last
  const delayed = [];                                           // misbooked-late events
  let clock = 0;

  const tau = k => def.traces[k].tau;
  const bounds = k => (k === 'valence' ? [-1, 1] : [-0.5, 1]);

  function apply(entry) {
    const gainL = inst ? inst.gain('ledger') : 1;
    const noise = inst ? 1 + inst.noise('ledger') : 1;           // 1 exactly when rigid
    const w = entry.weight * gainL * noise;
    for (const [k, d] of Object.entries(entry.deltas)) {
      const [lo, hi] = bounds(k);
      traces[k] = clamp(traces[k] + d * w, lo, hi);
    }
    if (neuro) neuro.impulse(entry.neuro, w);
    entry.applied = w;
  }

  // write(id, {scale, note}) -> entry. scale multiplies strength (e.g. stepsRemaining/total for chain_broken).
  function write(id, { scale = 1, note = '', weight = null } = {}) {
    const ev = def.events[id];
    if (!ev) return null;
    const kw = weight ?? def.kindWeight[ev.kind] ?? 1;
    const entry = { t: clock, id, kind: ev.kind, weight: kw * scale, deltas: ev.deltas || {}, neuro: ev.neuro || {}, note, applied: 0 };
    // ledger instability: an entry may be booked late
    let delay = 0;
    if (inst?.active('ledger') && rng.chance(0.15 * inst.lambda.ledger)) delay = rng.range(5, inst.param('ledger', 'delayMax'));
    entries.push(entry);
    if (entries.length > maxEntries) entries.shift();
    if (delay > 0) { entry.delayed = delay; delayed.push({ at: clock + delay, entry }); }
    else apply(entry);
    return entry;
  }

  function remaining(e) {                                       // strength left of an entry's slowest trace (0..1)
    const ks = Object.keys(e.deltas); if (!ks.length) return 0;
    const age = clock - e.t; let r = 0;
    for (const k of ks) r = Math.max(r, Math.exp(-age / tau(k)));
    return r;
  }

  function step(dt) {
    clock += dt;
    for (const k in traces) {
      traces[k] *= Math.exp(-dt / tau(k));
      if (Math.abs(traces[k]) < 1e-5) traces[k] = 0;
    }
    for (let i = delayed.length - 1; i >= 0; i--) if (delayed[i].at <= clock) { apply(delayed[i].entry); delayed.splice(i, 1); }
    // rumination: a strong negative memory sometimes re-counts itself
    if (inst?.active('ledger') && rng.chance(inst.param('ledger', 'ruminate') * inst.lambda.ledger * dt / 60)) {
      const bad = entries.filter(e => e.kind === 'erratic' && remaining(e) > 0.3);
      if (bad.length) write('rumination', { scale: remaining(rng.pick(bad)), note: 'replay' });
    }
  }

  // what is each trace pushing onto each motive per second (misattributed pressure: stress felt as hunger, etc.)
  function motivePressure(coef = 0.002) {
    const out = {};
    const coupling = couplingDef;
    for (const [tr, val] of Object.entries(traces)) {
      if (val <= 0) continue;
      for (const m of Object.keys(coupling?.[tr] || {})) {
        if (tr === 'doc') continue;
        const c = inst ? inst.coupling(tr, m) : coupling[tr][m];
        out[m] = (out[m] || 0) + val * c * coef;
      }
    }
    return out;
  }

  return {
    traces, entries, write, step, motivePressure,
    get time() { return clock; },
    trace: k => traces[k] || 0,
    remaining,
    recent(n = 10) {
      return entries.slice(-n).reverse().map(e => ({ t: +e.t.toFixed(1), id: e.id, kind: e.kind, weight: +e.weight.toFixed(2), remaining: +remaining(e).toFixed(3), note: e.note, delayed: e.delayed || 0 }));
    },
    snapshot: () => ({ clock, traces: { ...traces }, entries: entries.slice(-80).map(e => ({ ...e })), delayed: delayed.map(d => ({ at: d.at, entry: d.entry })) }),
    restore(s) {
      if (!s) return; clock = s.clock; Object.assign(traces, s.traces);
      entries.length = 0; entries.push(...(s.entries || [])); delayed.length = 0; delayed.push(...(s.delayed || []));
    },
    catchUp(seconds) {
      for (const k in traces) traces[k] *= Math.exp(-seconds / tau(k));
      clock += seconds;
      for (const d of delayed.splice(0)) apply(d.entry);
    },
  };
}
