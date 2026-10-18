// Every hand-set number in the headless/away chooser lives here so the sweep harness can vary it. Defaults come from
// tools/emotions/tune.json (written by the sweep's `apply`), baked in by gen.py into data/tune.gen.js when present.
import { TUNE_DEFAULTS } from './data/tune.gen.js';
const BASE_DECAY = { energy: 0.00045, hunger: 0.0006, fun: 0.0007, focus: 0.0005, hygiene: 0.0003, bladder: 0.0008, social: 0.0003 };
export const TUNE = {
  decay: BASE_DECAY,  // per story minute
  sleepDecayMul: 0.3,       // non-bladder/hunger motives drain slower asleep
  pickExp: 1.6,             // sharpness of choice: score^pickExp
  rateScale: 18,            // reward appeal = (1-m)^2 * reward * rate * rateScale
  drainScale: 8,
  microBase: 0.05,          // appeal of acts with no reward
  erraticBase: 0.15, erraticStress: 1, erraticValence: 0.5,
  sleepNight: 3, sleepLowEnergy: 2, sleepDay: 0.1, sleepEnergyAt: 0.2,
  workNight: 0.4, workDay: 1.5, workDuty: 0.06, workFrom: 9, workTo: 19,
  intentPull: 1,            // global strength of day intentions on the acts they ask for (0 = off; per-intention pull in intentions.json)
  workTarget: 300, workThroughDone: 0.25,   // minutes of work a day after which duty stops pulling; work_through keeps this share of its appeal once the hours are done
  cancelMul: 0.3, postponeMul: 0.6,
  chainGap: 60,             // minutes between chain steps before it counts as broken
  resumeTau: 45,            // soft interruption: chance he comes back to a suspended chain = exp(-break minutes / resumeTau) (goal memory, Altmann & Trafton 2002)
  repeatPenalty: 0.5,       // appeal multiplier for the act just done (stops loo, loo, loo)
  recentPenalty: 0.8,       // ... and mild penalty for any act in the last 3
  chainPull: 1, chainStartPull: 1,   // appeal multiplier for the next step of a chain in progress / the first step of one that could start
  moodShift: -0.07,   // calibration: ATUS Well-Being mean happy is 0.72 of scale; the body+neuro mood alone runs ~0.8+
  savourPull: 8,     // pull on the next step of the serene_savour chain while he is savouring a finished piece
  stressShift: 0,     // calibration hook for stress (0.08 was tried; not tuned)
  feelPull: 1,       // weight of the per-activity mood offset fitted from ATUS Well-Being (0 = off)
  circadianPull: 0.45, // exponent on 24h ATUS circadian activity shape
  followPull: 1,     // exponent on the act-to-act affinity (0 = chains are only incidental)
  planChance: 0.55, planMin: 2, planMax: 5, planPull: 6, planFlat: 0.45, planFollow: 2.2,   // intent: how often he plans a sequence, its length, how hard he sticks to it
  goalPlan: 1, clobberMul: 0.12, resumeDecay: 0.5,       // 1: chains are planned from goals over world state (world.js); 0: the old intent walk over act affinity
  freeChainMax: 8,   // a free chain closes at sleep or after this many acts
  artFollow: 4,      // pull on the next art stage once a piece is in progress
  habK: 1.5, habTau: 150, habChain: 0.3,   // habituation: appeal / (1 + habK * recent repeats), repeats fade over habTau minutes; a routine's next step feels it at habChain strength
  nightPull: 2.5, nightQuiet: 0.35,   // 01-05 h: exponent on the circadian shape for ordinary acts / multiplier when an act has no shape
  satiate: 1,               // reward strength multiplier
  failGain: 0.15, partialGain: 0.55,
  ...TUNE_DEFAULTS,
  decay: { ...BASE_DECAY, ...(TUNE_DEFAULTS.decay || {}) },
};
