// Pure Utility AI (The Sims style): autonomous motive decay, decentralized smart-object station affordances,
// quadratic urgency scoring, distance + cooldown penalties, inertia-gated action switching, and continuous motive restoration.

export const MOTIVE_KEYS = ['energy', 'hunger', 'fun', 'focus', 'hygiene', 'bladder', 'social'];

const clamp01 = v => Math.max(0, Math.min(1, v));

// Quadratic urgency: Urgency(m) = (1.0 - m)^2
export function urgency(m) {
  const d = 1.0 - clamp01(m);
  return d * d;
}

// Default decentralized station affordances across the room, gallery, and annex.
// Each station defines motive `rewards` (used for both utility evaluation and continuous restoration while active),
// optional `drain` (motives consumed while performing the act, e.g. work consuming focus/fun),
// `minDur` (seconds to commit before switching), and `cooldown` (seconds of post-act cooldown).
import { STATION_AFFORDANCES } from './data/activities.gen.js';   // generated from tools/emotions/activities.json
export const DEFAULT_AFFORDANCES = STATION_AFFORDANCES;

// Neutral manual-only interactive stations (no autonomous pull)
export const NEUTRAL_STATIONS = ['sit', 'lamp', 'timeline', 'look', 'door'];

// Base passive decay rates (per second)
export const BASE_DECAY = {
  energy:  0.0022,
  hunger:  0.0030,
  fun:     0.0025,
  focus:   0.0018,
  hygiene: 0.0016,
  bladder: 0.0026,
  social:  0.0022,
};

export function makeUtilityAI({
  initialMotives = {},
  lambda = 0.018,
  inertia = 0.12,
  evalInterval = 3.5,
} = {}) {
  const motives = {
    energy:  0.78,
    hunger:  0.74,
    fun:     0.72,
    focus:   0.76,
    hygiene: 0.84,
    bladder: 0.80,
    social:  0.75,
    ...initialMotives,
  };

  const registry = new Map();
  const cooldowns = {};
  const counts = {};
  let activeAct = null;
  let activeTime = 0;
  let evalTimer = 0;
  let lastScores = {};

  function registerStation(name, spec = {}) {
    const base = DEFAULT_AFFORDANCES[name] || { rewards: {}, drain: {}, rate: 0.04, minDur: 10, cooldown: 35, category: 'Custom' };
    const entry = {
      name,
      at: spec.at || [0, 0],
      rewards: { ...base.rewards, ...(spec.rewards || {}) },
      drain: { ...base.drain, ...(spec.drain || {}) },
      rate: spec.rate ?? base.rate,
      minDur: spec.minDur ?? base.minDur,
      cooldown: spec.cooldown ?? base.cooldown,
      category: spec.category ?? base.category,
      spot: spec.spot || null,
    };
    registry.set(name, entry);
    if (!(name in cooldowns)) cooldowns[name] = 0;
    if (!(name in counts)) counts[name] = 0;
    return entry;
  }

  // Register all default station types up front; spots can attach coordinates via registerSpots()
  for (const [name, spec] of Object.entries(DEFAULT_AFFORDANCES)) {
    registerStation(name, spec);
  }

  function registerSpots(spots = {}) {
    for (const [name, spot] of Object.entries(spots)) {
      if (!spot) continue;
      registerStation(name, {
        ...(DEFAULT_AFFORDANCES[name] || {}),
        at: spot.at || (spot.seat ? [spot.seat.x, spot.seat.z] : [0, 0]),
        spot,
      });
    }
  }

  function getAt(entry) {
    if (typeof entry.at === 'function') return entry.at();
    if (entry.spot?.live) {
      const p = entry.spot.live();
      return [p.x, p.z];
    }
    return entry.at || [0, 0];
  }

  function cooldownPenalty(name) {
    if (name === activeAct) return 0;             // never penalise what he is doing right now: cooldown only discourages going back to it
    const cd = cooldowns[name] || 0;
    if (cd <= 0) return 0;
    const entry = registry.get(name);
    const maxCd = entry?.cooldown || 40;
    return Math.min(1, cd / maxCd) * 0.35;
  }

  // Detailed breakdown of an action's score components
  function scoreBreakdown(name, pos = { x: 0, z: 0 }) {
    const entry = registry.get(name);
    if (!entry) return null;
    let urgencyReward = 0;
    for (const [m, r] of Object.entries(entry.rewards)) {
      if (!(m in motives)) continue;
      urgencyReward += urgency(motives[m]) * r;
    }
    let readinessBonus = 0;
    if (name === 'work' && motives.focus > 0.38 && motives.energy > 0.35) {
      readinessBonus = motives.focus * motives.energy * 0.24;
    }
    const at = getAt(entry);
    const distanceMeters = Math.hypot((pos.x || 0) - at[0], (pos.z || 0) - at[1]);
    const distancePenalty = lambda * distanceMeters;
    const cdPenalty = cooldownPenalty(name);
    const score = urgencyReward + readinessBonus - distancePenalty - cdPenalty;
    const rKeys = Object.keys(entry.rewards);
    const saturated = rKeys.length > 0 && name !== 'work' && rKeys.every(m => (motives[m] ?? 1) >= 0.96);
    const hasDrain = Object.keys(entry.drain || {}).length > 0;
    const valenceType = saturated
      ? 'neutral (saturated)'
      : score > 0.05
        ? (hasDrain ? 'rewarding + drain' : 'rewarding')
        : score < -0.05
          ? 'penalized (distance/cooldown)'
          : 'neutral';

    return {
      station: name,
      score: +score.toFixed(4),
      urgencyReward: +urgencyReward.toFixed(4),
      readinessBonus: +readinessBonus.toFixed(4),
      distancePenalty: +distancePenalty.toFixed(4),
      cooldownPenalty: +cdPenalty.toFixed(4),
      distanceMeters: +distanceMeters.toFixed(2),
      targetXZ: [+at[0].toFixed(2), +at[1].toFixed(2)],
      rewards: entry.rewards,
      drain: entry.drain,
      category: entry.category,
      valenceType,
      saturated,
    };
  }

  // Score(a) = sum(Urgency(m) * Reward(m)) - lambda * Distance(pos, a.at) - CooldownPenalty(a)
  function scoreAction(name, pos = { x: 0, z: 0 }) {
    const b = scoreBreakdown(name, pos);
    return b ? b.score : -Infinity;
  }

  // Rank all registered stations from highest utility score to lowest
  function rankActions(pos = { x: 0, z: 0 }, { available = null } = {}) {
    const list = [];
    for (const [name, entry] of registry.entries()) {
      if (available && !available[name]) continue;
      if (!entry.spot && available) continue;
      const b = scoreBreakdown(name, pos);
      if (b) list.push(b);
    }
    list.sort((a, b) => b.score - a.score);
    return list.map((item, idx) => ({ rank: idx + 1, ...item }));
  }

  // Homeostasis check: detects under-actions (urgent neglected motives) and excessive actions (saturated/cooldown/burnout)
  function homeostasis() {
    const urgentMotives = MOTIVE_KEYS
      .filter(m => motives[m] < 0.35)
      .map(m => ({ motive: m, value: +motives[m].toFixed(3), urgency: +urgency(motives[m]).toFixed(3) }))
      .sort((a, b) => b.urgency - a.urgency);
    const saturatedMotives = MOTIVE_KEYS.filter(m => motives[m] >= 0.95);
    const onCooldown = Object.entries(cooldowns)
      .filter(([, s]) => s > 0)
      .map(([station, remainingSec]) => ({ station, remainingSec: +remainingSec.toFixed(1) }));
    const workBurnout = activeAct === 'work' && (motives.focus < 0.25 || motives.fun < 0.22);
    return {
      activeAct,
      activeTime: +activeTime.toFixed(1),
      workBurnout,
      underAddressedMotives: urgentMotives,
      saturatedMotives,
      onCooldown,
      actionCounts: { ...counts },
    };
  }

  function evaluate(pos = { x: 0, z: 0 }, { current = activeAct, available = null } = {}) {
    const ranked = rankActions(pos, { available });
    const scores = {};
    for (const r of ranked) scores[r.station] = r.score;
    lastScores = scores;

    const bestName = ranked[0]?.station || null;
    const bestScore = ranked[0]?.score ?? -Infinity;
    const currentScore = current && (current in scores) ? scores[current] : -Infinity;
    const currentEntry = current ? registry.get(current) : null;

    // Check if the current action has already topped out all of its rewarded motives
    let currentSatisfied = false;
    if (currentEntry) {
      const rKeys = Object.keys(currentEntry.rewards);
      if (rKeys.length > 0 && current !== 'work') {
        currentSatisfied = rKeys.every(m => (motives[m] ?? 1) >= 0.96);
      } else if (current === 'work' && (motives.focus < 0.25 || motives.fun < 0.22)) {
        currentSatisfied = true;
      }
    }

    const minDurMet = !currentEntry || activeTime >= currentEntry.minDur || currentSatisfied;
    const effInertia = currentSatisfied ? 0 : inertia;
    const shouldSwitch = !current || (bestName && bestName !== current && minDurMet && bestScore > currentScore + effInertia);

    return {
      best: bestName,
      bestScore,
      current,
      currentScore,
      shouldSwitch,
      scores,
      ranked,
    };
  }

  function setDoing(name) {
    if (activeAct && activeAct !== name && activeTime > 0 && registry.has(activeAct)) {   // only an act he actually performed cools down
      const prev = registry.get(activeAct);
      cooldowns[activeAct] = prev.cooldown || 35;
    }
    if (activeAct !== name) {
      activeAct = name;
      activeTime = 0;
      if (name) counts[name] = (counts[name] || 0) + 1;
    }
  }

  function stepMotives(dt, { doing = activeAct, idle = false } = {}) {
    if (dt <= 0) return motives;
    if (doing !== activeAct) setDoing(doing);
    if (activeAct) activeTime += dt;

    // Tick down station cooldowns
    for (const k of Object.keys(cooldowns)) {
      if (cooldowns[k] > 0) cooldowns[k] = Math.max(0, cooldowns[k] - dt);
    }

    const entry = doing ? registry.get(doing) : null;
    const rewarded = entry ? entry.rewards : {};
    const drained = entry ? entry.drain : {};
    const rate = entry ? entry.rate : 0.04;

    for (const m of MOTIVE_KEYS) {
      let delta = 0;
      if (rewarded[m] > 0 && !(doing === 'work' && m === 'focus')) {
        // Continuously restore motives served by the active station
        delta += rewarded[m] * rate;
      } else {
        // Continuous passive decay
        let dec = BASE_DECAY[m] || 0.002;
        if (m === 'fun' && (doing === 'work' || idle || !doing)) dec *= 1.65;
        if (m === 'focus' && doing !== 'work') dec *= 0.5;
        delta -= dec;
      }
      if (drained[m]) {
        delta -= drained[m];
      }
      motives[m] = clamp01(motives[m] + delta * dt);
    }
    return motives;
  }

  function tick(dt, { pos, doing, mine = true, going = false, busy = false, available = null } = {}) {
    stepMotives(dt, { doing, idle: !doing && !going });
    if (busy || going || !mine) return null;
    evalTimer += dt;
    if (evalTimer < evalInterval) return null;
    evalTimer = 0;
    return evaluate(pos, { current: doing, available });
  }

  return {
    motives,
    cooldowns,
    counts,
    registry,
    registerStation,
    registerSpots,
    urgency,
    scoreBreakdown,
    scoreAction,
    rankActions,
    homeostasis,
    evaluate,
    stepMotives,
    tick,
    setDoing,
    get activeAct() { return activeAct; },
    get activeTime() { return activeTime; },
    get lastScores() { return lastScores; },
  };
}
