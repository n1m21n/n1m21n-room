# SIM_DESIGN: drives, mood, memory, ledger, chains, space

Status: SPEC (nothing here is built yet unless marked BUILT). Written 2026-10-17 from the owner's design talk.
Today's code: `site/src/sim/utility.js` (7 motives + station scoring), `site/src/sim/posture.js` (affect -> face, posture),
`site/src/routine.js` (loop), `site/src/acts.js` (station animation), `site/src/sfx.js` (music by face).

## 0. The loop (owner's pipeline)

```
foundational drive  ->  motive  ->  desire to act  ->  chain of actions  ->  emotion (reward)  ->  repeat
 (what he is built       (need level      (score of each      (ordered steps,       (felt DURING and AFTER;        (memory of it
  to want)                right now)       action, + mood)      normal or broken)     written to the ledger)         biases the next pass)
```

- Drives and motives decide WHAT he wants. Emotion is NOT an input to the first step; it is the result, and it feeds the NEXT desire.
- Mood and memory are the only way emotion reaches back into choices (no instant feedback loops).
- BUILT today: motives -> score -> station -> restore. NOT built: emotion memory, ledger, chains, erratic events, space sense.

## 1. Foundational drives (slow, nearly fixed per character)

| Drive | Meaning | Feeds motives |
|---|---|---|
| vitality | body upkeep | energy, hunger, hygiene, bladder |
| stimulation | wants novelty / things to do | fun, curiosity, boredom |
| mastery | wants to make / finish things | focus, pride (work, music, building) |
| connection | wants company | social (snake, calls) |
| security | wants a predictable safe place | comfort, stress |
| autonomy | wants to roam and choose | restlessness, build urge |

Each drive has a `weight` (character trait, 0.5 to 1.5) that multiplies the urgency of its motives. Changing a weight changes personality without new code.

## 2. Motives (needs)

Existing 7: energy, hunger, fun, focus, hygiene, bladder, social. Add: stress, comfort, curiosity, restlessness, pride (built up by finishing things).

Formulas (all clamped 0..1):
- decay:    `m -= base_m * (1 + a_m * stress) * dt`
- restore:  `m += reward * rate * (1 - m) * dt`   (diminishing returns: the last 20% takes longer)
- urgency:  `u(m) = (1 - m)^2 * driveWeight`
- stress rises with unmet urgent motives (any m < 0.25), erratic events, long work; falls with sleep, calm acts, comfort.

## 3. Emotional inputs and memory

Inputs (instant values, 0..1 unless noted): valence, arousal, fatigue, stress, comfort, frustration, boredom, loneliness, curiosity, pride, security(space).
Valence is no longer only an average of four motives; it is `mean(energy, fun, hunger, hygiene, comfort) - 0.4*stress - 0.3*frustration + 0.3*pride`.

Memory = exponentially fading traces, decay in REAL time (Date.now), so a returning visitor finds him still carrying the day:

```
trace_k(t) = sum_i  delta_i * exp(-(t - t_i) / tau_k)
mood_k     = clamp(base_k + trace_k)
```

| Input | tau (real time) | Why |
|---|---|---|
| arousal | 20 s | spikes and fades quickly |
| frustration, startle | 45 s | a bump lingers briefly |
| stress | 6 min | a bad stretch colours the next few acts |
| valence (mood) | 15 min | slow average; one event does not flip his face |
| pride / satisfaction | 30 min | finished work glows for a while |
| fatigue debt | 3 h | a hard day = longer sleep |
| loneliness | 1 h | social need builds slowly |

Mood = slow trace. Emotion (the face) = fast reaction + mood baseline, with hysteresis (needs +0.05 past a boundary to leave, so no flicker).

## 4. Emotions (grow from 9 to about 20)

An emotion is a prototype point in (valence, arousal, stress, energy) with a margin; the face is the nearest prototype with hysteresis. Each has a face, posture, tempo, music, breath range, gait modifier.

| Emotion | Status | Face (see section 11) |
|---|---|---|
| neutral, calm, curious, delighted, uneasy, dazed, given_up, sleep, alarm | EXISTS | 9 textures |
| content (fed, tidy, relaxed) | new | reuse calm + softer mouth |
| joyful (very high arousal and valence) | new | new expression |
| absorbed / flow (deep in an act) | new | reuse curious, eyes half-lowered |
| bored | new | reuse neutral + gaze drift |
| restless | new | reuse uneasy, gaze darting |
| anxious | new | reuse uneasy, wider eyes |
| frustrated | new | new expression (brow tension) |
| sad / low | new | reuse given_up, lighter |
| lonely | new | reuse calm + gaze toward snake/door |
| proud | new | reuse delighted, calmer |
| relieved | new | reuse calm, eyes closing |
| embarrassed | new | reuse uneasy + head down |
| drowsy | new | reuse dazed, lids lower |

`alarm` stays a transient (startle) with a fixed 1.2 s hold, then decays into anxious or frustrated if the cause was a bump.

## 5. The ledger (points)

One list of events. Each event adds or subtracts points on motives and emotional inputs, then fades with its tau.

```
{ t, source: 'wall-bump', kind: 'erratic' | 'normal', weight, deltas: { stress:+0.12, frustration:+0.10, valence:-0.06 }, tau }
```

Rules:
- `normal` events are small and mostly positive when a chain completes.
- `erratic` events weigh 2 to 5 times more per unit than normal ones (owner: erratic affects the point system more).
- The ledger is the explanation: `dev.sim.ledger()` returns the last N entries with remaining strength, so every mood can be traced back.

Starting values (tune later):

| Event | Kind | Deltas |
|---|---|---|
| finish a meal | normal | hunger restored, valence +0.03, pride +0.01 |
| finish a full chain (see 7) | normal | valence +0.05, stress -0.05 |
| long shower | normal | comfort +, valence +0.02 |
| skip a meal while hunger > 0.5 | normal | none now; hunger rises |
| skip a meal while hunger < 0.2 | erratic | stress +0.05, valence -0.04 |
| short sleep (< 50% target) | erratic | fatigue debt +0.3, stress +0.08 |
| wall bump | erratic | stress +0.12, frustration +0.10, valence -0.06 |
| interrupted act | erratic | frustration +0.08 (+ pride -0.04 if work) |
| act done at wrong time (shower at 3am) | erratic | stress +0.03 |
| petting the snake | normal | loneliness -0.2, valence +0.06 |

## 6. Action taxonomy

Every action carries three tags.

1. Normal vs erratic (owner's split). Erratic is not "bad"; it is "outside his pattern".
   - Normal: proper meal routine, normal sleep length, sleep chain, short breaks, a long shower, skipping a meal when not hungry.
   - Erratic: hitting a wall, running indoors, skipping meals while starving, working through burnout, sleeping 20 minutes, quitting mid-act, 3 am shower.
2. Trivial vs non-trivial.
   - Trivial: no planning, short, cheap (stretch, yawn, sigh, fidget, glance, scratch, adjust, sip tea).
   - Non-trivial: needs a plan, tools or space (roam, gallery viewing, cook, build, work block, guitar session).
3. Sub-category (examples): maintenance (wash, brush, loo, shower), nutrition (cook, eat, fridge, tea), rest (sleep, nap, bench), creative (keys, guitar, build), intellectual (work, read), leisure (tv, records, window), social (snake), movement (roam, pace, walk, run), expressive (dress), micro (yawn, stretch, sigh).

For each action: `{ kind, trivial, category, motives, duration model, intensity model, requires, chains }`. This table is the single source for station behaviour; `DEFAULT_AFFORDANCES` is generated from it.

## 7. Chains

A chain is an ordered list of steps with allowed gaps. Completing a chain pays a bonus into the ledger; breaking it costs.

| Chain | Steps | Normal window |
|---|---|---|
| wake-up | loo, wash/brush, dress | on waking |
| shower | shower, dress | any time except night |
| meal | fridge or cook, eat, (wash) | when hunger < 0.5 |
| sleep routine | wash, brush, loo, (read), sleep | evening |
| work block | tea or window, work x N, break | day |
| creative evening | keys or guitar, (tea) | evening |

- A step may be skipped if it is trivial (skip wash = small erratic).
- Breaking a chain mid-way (interruption) = erratic with the weight of how many steps remain.
- Chains are what make walking speed and similar details dynamic, because each step knows its place in the day and its urgency.

## 8. Activity profile: do, duration, intensity

Everything about an action is a formula of (motives, mood, ledger, chain context).

```
doChance      = sigmoid( k * (score - threshold) )          // seeded random draw; he may refuse for hours
duration      = baseDuration * moodFactor
moodFactor    = clamp( 1 + 0.4*(valence-0.6) - 0.3*fatigue - 0.2*stress + 0.2*absorbed , 0.4, 2.0 )
intensity     = baseIntensity * (0.6 + 0.6*arousal) * (1 - 0.3*fatigue) * (1 - 0.2*stress)
```

| Behaviour | Formula |
|---|---|
| walk speed (m/s) | `1.7 * (0.6 + 0.6*arousal) * (1 - 0.3*fatigue)`, `*0.8` if clutter high |
| run | when stress > 0.6, or urgent bladder, or open hall and valence > 0.8 (and never indoors rooms with clutter) |
| typing speed | `tempo(emotion) * (0.7 + 0.5*focus)` |
| guitar strum speed | `tempo(emotion) * (0.7 + 0.5*arousal)` |
| song choice (keys) | by emotion, with mood tilt (low mood: slower, minor pieces) |
| shower speed / length | `intensity` and `duration` above |
| sleep length | `targetSleep * (1 + fatigueDebt)` |
| skip meal | doChance drops with stress, rises with hunger; skipping when hungry is erratic |

`baseDuration` is stored in story minutes and turned into real seconds by ONE global time scale (`SIM.timeScale`), so the schedule and the utility engine share a clock. The current time-lapse (about 12 s to sleep) is just `timeScale` set very high.

## 9. Erratic events and interruptions

Seeded random (seed = day + minute bucket) so everyone watching sees the same event, like the existing `dayPlan`.

```
hazard h(t) = h0 + k_stress * stress + k_fatigue * fatigue + trigger(t)      // events per second
```

| Event | Trigger | Result |
|---|---|---|
| startle | snake close, door slam, wall bump | alarm face, stops act, posture flinch |
| bladder override | bladder < 0.1 | aborts any act, goes to loo (erratic if mid-chain) |
| boredom quit | fun < 0.22 during work | stops, goes to leisure act |
| frustration slam | frustration > 0.7 | rushes the act, then pause and sigh |
| stumble | running with clutter | short stagger, stress +, can bump |
| nap | fatigue > 0.85 away from bed | falls asleep on bench |
| false start | seeded 3% | begins an act, changes mind (trivial erratic) |

Failure of an act: the act ends early, its reward is scaled by `progress` (0..1), a ledger entry is written, and the interrupted chain is marked broken.

## 10. Spatial awareness

He keeps a small model of the floor from his own movement and from the existing `solids` / `nav` data:

- Position trace: ring buffer of the last N coordinates with timestamps (also gives a dwell map of where he spends time).
- Occupancy grid (0.25 m cells) from `solids`: free, blocked, visited, unvisited.
- Metrics sampled each second around him (radius 2 m):

| Metric | Meaning | Effect |
|---|---|---|
| openness | free area / total area | high: faster walk, looser posture, may run, wander |
| clutter | blocked cells near | high: slower, careful steps, glances at obstacles |
| wallDistance | nearest solid | bump avoidance, flinch near walls |
| novelty | share of cells not visited recently | feeds curiosity; roam target |
| security | known/small/enclosed | feeds comfort and stress |

- `roam` (non-trivial): choose an unvisited reachable cell, walk there, look around; raises curiosity, lowers restlessness and boredom.
- Building (later, Minecraft-style): needs a build site check on the grid (free, level, inside map), inventory of materials (wood, stone, earth), and an action chain (gather, carry, place). It depends on this section being solid, which is why spatial awareness comes before building.

## 11. The emotion tool (script)

Goal: adding an emotion is one entry in a data file; a script generates and checks everything else.

```
tools/emotions/emotions.json   (single source of truth)
tools/emotions/gen.py          (generator + validator)
```

Entry:
```json
{ "name": "frustrated", "prototype": {"valence":0.3,"arousal":0.7,"stress":0.7,"energy":0.6}, "margin": 0.12,
  "face": {"expression":"frustrated","eyes_open":0.9,"gaze":[0,0]}, "posture": {"slump":0.02,"chest":0.01},
  "tempo": 1.1, "music": "uneasy-nocturne.mid", "breathHz":[1.6,2.0], "gait": 0.95, "hold": 1.5 }
```

`gen.py` writes or updates:
1. `tools/export_face.py` FACES dict (expression, eyes_open, gaze) and runs it to render the face texture. Faces use `lib/man2d.py` expression shapes; reuse an existing expression with different eyes/gaze when possible, add a new one only for joyful and frustrated.
2. `site/src/man.js` FACES list.
3. `site/src/sim/posture.js` matrix (generated, so `condition` strings stop being dead comments; the picker reads the same data).
4. `site/src/sfx.js` EMOTION_MUSIC entries (tempo, velocity, chords, midi).
5. A report `tools/emotions/report.md`.

Validation (fails the build if broken): every emotion has face, posture, tempo, music, a unique prototype, no two prototypes closer than their margins, every referenced `.mid` and face texture exists.

## 12. Build order

| Slice | Contents | Done when |
|---|---|---|
| 1. Data | `emotions.json`, `activities.json` (taxonomy, chains), `gen.py`; matrix and affordances generated from them | build passes, behaviour unchanged |
| 2. Mood and ledger | new motives, traces with real-time decay, ledger, `dev.sim.ledger()` | unit sim shows faces follow mood and fade |
| 3. Formulas | do / duration / intensity, `timeScale`, walk speed from arousal and fatigue | durations match table, motives stay in [0,1] |
| 4. Chains and erratic | chains, seeded hazard, interruptions, bump -> emotion | same minute = same events; physics tests still pass |
| 5. Space | trace, grid, openness/clutter, `roam` | spatial.* telemetry; roams unvisited cells |
| 6. Building | inventory, build site check, build chain | only after 5 |

Tests to add: determinism (same seed, same day), clamp (all inputs in range), ledger decay (strength falls with tau), chain bonus and break, emotion hysteresis (no flicker at a threshold), tool validator.

## 13. Decisions (owner, 2026-10-17)

1. Time scale: keep the fast simulated time-lapse.
2. New faces: yes, generative. `emotions.json` defines each emotion numerically by coordinates of eyes, brows, ears, mouth, fingers, hands, legs, spine; `gen.py` derives faces, posture deltas and validates ranges from one structural formula.
3. Persistence: mood, ledger, memory traces and neuromodulator levels persist between visits. While he is away the world fast-forwards offline from the saved timestamp (catch-up sim, capped); a visitor interacts with the same state.
4. Emotion may override the clock: a bad mood can cancel or postpone part of the day plan.
5. Space: occupancy grid (section 10).
6. Tools: category tool (normal/erratic, trivial/non-trivial) and chain tool (normal chains and abnormal chains, each rewarded by its own ledger rule).
7. Emotions must map to the real character design (section 11).
8. Neurochemical layer added (section 14), grounded in SIM_RESEARCH.md.

## 14. Neuromodulator layer (the "chemistry" under valence/arousal)

Six slow variables in [0,1], each with a baseline, a decay tau and a source list. They sit between motives/ledger and emotion, and they also scale behaviour directly.

| Variable | Plays the role of | Raised by | Lowered by | Behavioural effect |
|---|---|---|---|---|
| dopamine (DA) | wanting, seeking, anticipation | prediction error > 0, novelty, chain start | repeated unrewarded effort, failure | doChance, walk speed, exploration, tempo |
| serotonin (5HT) | mood stability, contentment | meals, sunlight/window, completed normal chains | erratic events, sleep debt | mood decay slower, patience, interruption tolerance |
| noradrenaline (NE) | alertness, arousal | alarm, wall hit, deadline, caffeine-like events | sleep, calm acts | arousal, glance rate, breath Hz, run chance |
| cortisol (CORT) | stress load | erratic events, hunger, sleep debt, clutter | restful chains, shower, music | cancels plan parts, shortens work, tense posture |
| oxytocin (OXY) | bonding, social safety | visitor interaction, shared acts | long isolation | warmth, social motive reward |
| melatonin/adenosine (SLP) | sleep pressure | time awake, work | sleep | energy decay, droop, yawn |

Emotion = f(DA, 5HT, NE) as an 8-corner region (Lovheim cube) blended with appraisal (OCC-style event tags from the ledger). Valence and arousal remain as derived read-outs for the existing face and posture matrix. Caveat: this is a game-grade abstraction; real neurochemistry is not one-molecule-one-emotion.

Update rule per variable x: dx/dt = (base - x)/tau + sum(event_i * weight_i) with events from the ledger.

## 15. Instability in every pillar (owner, 2026-10-17)

Principle: no stage is a pure function of the previous one. Each stage is a noisy, drifting, partly self-coupled process. The chain direction stays (drives > motives > desire > chain > action > outcome > ledger > emotion > repeat), but every arrow is a probability, not an equation. Behaviour stays reproducible only because the RNG is seeded and its state is persisted.

### 15.1 One instability block per stage
Every stage i carries: `gain g_i` (how strongly it passes signal on), `noise sigma_i`, `wobble w_i` (slow random walk of its own parameters, Ornstein-Uhlenbeck, mean-reverting), and `coupling leak c_i` (cross-talk into neighbours).

- sigma_i = sigma0_i * (1 + a*NE + b*CORT - c*5HT)  (stress and arousal make him noisier, contentment steadies him)
- g_i(t) = g0_i + w_i(t); w_i reverts to 0 with its own tau so the mapping drifts day to day
- stability dial `lambda_i` per stage in `stability.json` (0 = rigid, 1 = chaotic), bounded by mean reversion so he never diverges

### 15.2 Per stage
1. Drives: nearly fixed, but a slow drift (weeks) and rare "phase" shifts (a restless week).
2. Motives: decay rate wobbles; hunger or fun can be mis-felt (misattribution: stress read as hunger, loneliness read as boredom) via a leaky coupling matrix W whose entries also random-walk.
3. Desire: utility plus accumulator noise (Schurger-style threshold crossing) so near-ties resolve differently each time; hysteresis, so a decision tips and then sticks (bistable), with occasional impulsive flips.
4. Chain: planned order is a template, not a script; steps can be skipped, reordered, repeated or abandoned; abnormal chains emerge from noise plus bad mood instead of being rolled from a table.
5. Action: duration and intensity are sampled from a distribution centred on the mood-adjusted mean, not computed exactly.
6. Outcome: an action yields a distribution over outcomes {as intended, partial, failure, side effect, surprise/serendipity}, conditioned on skill, fatigue, space (grid) and noise. The same act can go well or badly. Surprise (outcome differs from expectation) is itself an event.
7. Ledger: an event writes to a pressure field across several motives and emotions with random weights, not to one named motive. Entries can be mis-booked, delayed or amplified (rumination: a bad event re-counts when remembered).
8. Emotion and memory: the same ledger state does not give one emotion; it gives a distribution over the emotion region (Lovheim-style corners plus appraisal), sampled and then smoothed so faces do not flicker.

### 15.3 The meta layer (what makes it interesting)
- Self-model: he keeps a running estimate of his own expected outcomes and variance. Prediction error (actual minus expected) feeds DA (positive surprise) and NE/CORT (negative or large surprise). Instability is therefore a driver of emotion, not just noise on top.
- Regime switching: a few hidden regimes (steady, restless, low, inspired) with slow Markov switching; each regime shifts the sigmas and gains. Emotion labels describe the regime he is in, he does not choose it.
- Stochastic resonance: a little noise makes him act on weak needs and explore (new corner of the room, new song); too much makes him erratic. The dial in 15.1 tunes this.
- Visitor coupling: the visitor's actions are perturbations to the same system (OXY, DA, surprise), so no two visits play out alike.

### 15.4 Guardrails
- Mean reversion on every wobble; hard clamps on gains.
- Seeded RNG per (world seed, day, stage); state persisted so catch-up simulation after a long absence is deterministic and replayable.
- `stability.json` plus a headless Monte Carlo script that runs N simulated days and reports variance of: activity mix, sleep length, mood, plan cancellations. Acceptance: day-to-day variation visible, but no collapse (never stuck sleeping, never starving) over 1000 days.
- Debug overlay in `dev.sim` shows per-stage sigma, regime and last surprise.

Build note: slice 1 stays behaviour-neutral (all lambda = 0). Instability switches on per stage in later slices, one stage at a time, each checked by the Monte Carlo script.

## 16. BUILT status (2026-10-17)

Built and tested (`node site/tests/sim.mjs`: 41 pass; physics P1/P4/P6 94 checks 0 fail; `npm run build` OK):
- Data + generator: `tools/emotions/*.json`, `gen.py` (validate + write `site/src/sim/data/*.gen.js`), `categorize.py`, `chains.py`.
- Runtime (`site/src/sim/`): rng, neuro, instability, ledger, emotion, chains, profile, outcome, hazard, grid, plan, persist, core.
- Shadow mode in `main.js`: the core boots from localStorage, catches up while he was away (`dev.sim.away`), journals acts, saves every 20 s. Nothing in the site reads it yet.
- Away + log: `core.catchUp(elapsedSeconds)` lives his life act-by-act for up to 14 days (analytic decay beyond that) and returns a report; `core.journal` (last 600 events) and `core.days` (120 per-day summaries) persist.
- Pre-launch evidence: `node tools/sim/montecarlo.mjs --n=200 --days=7 [--instab=0.5]` (PASS/FAIL verdict on flatness, collapse, sleep, stress runaway).

NOT done / known: faces for 13 new emotions not rendered (fallback faces); instability off by default; `build.js`/blueprints (slice 6) only the grid + inventory data; core does not yet drive the face/tempo/motive pressure (opt-in `?sim=core` is next); headless tuning findings: `loo` ~11% of acts and 0 broken chains (tracker too forgiving), stress mean ~0.5.

## 17. Tuning, shared life, art catalog (2026-10-17)

- **Shared character**: one canonical life = f(seed 2026, real clock) via `site/src/sim/life.js`; 4-week checkpoints in `site/public/sim/life.json` (regenerate with `node tools/sim/make_life.mjs --blocks=26` after ANY tuning change). Visitor nudges (bump/startle) stay a local layer and never alter the canonical life.
- **Sweep harness** `tools/sim/`: `objectives.json` (20 banded metrics, hard ones +50), `factors.json` (50 factors by category), `eval.mjs`, `sweep.mjs` (modes sens/search/validate/apply; LHS start, cross-entropy refinement, elites, held-out validation, worker pool; `--seedFrom=` warm-starts). Apply: `node tools/sim/sweep.mjs apply results/<file>.json && python3 tools/emotions/gen.py` (gen.py bakes `tools/emotions/tune.json` into `data/tune.gen.js`).
- **Results**: hand-tuned baseline fitness 102.4 (hard fail: sleep) -> round 1 5.3 -> round 2 1.57 (validation, 480 lives x 14 days, unseen seeds; no hard failures). Still outside band: chain_broken_ratio 0.45 (target <=0.30), chains_done 7.0 (<=6), shower 2.2 (<=2), fail_rate 0.105 (<=0.10), top act share 0.139 marginal (snake).
- New tune knobs `chainPull`/`chainStartPull` make the headless chooser chain-aware.
- Fixed: core snapshot now includes lastAct/recent/affect and emotion transient so checkpoint resume == replay.
- **Art catalog** `tools/art/`: node catalog, graph rules, param semantics, art activities (see catalog_report.md). Executor + gallery not built yet.

## 18. Chain branching, social, MIDI, art judgement (owner decisions 2026-10-17)

**Chains are sequences of acts; a break never ends the story.** On break (cause `interrupt | skipped | timeout`) the next sequence is drawn from the chain's `branches` (filtered by cause and current emotion), else from the kind's `defaults`. `@resume` re-enters the same chain once. A branch he never started is dropped silently (not a new break). Depth cap 3, then he "settles". Completion may follow with `next` (p=0.6). No eligible branch = dead end (counted; target 0, measured 0). Code: `site/src/sim/chains.js`; data: `tools/emotions/chains.json`.
Final target (sweep bands): broken/done ratio .25-.45, dead 0/day. Measured after round 4: done 10.4/day, broken ~15/day (ratio ~.6, above band: skipped-step breaks dominate), dead 0. Open item.

**Social motive.** A visitor is a social reward (`core.visitor()`, local layer only: the shared life never changes). Objects: phone, door, desk, easel (3D models still to build). Acts: greet_visitor, answer_phone, phone_call, write_letter.

**MIDI rewards.** Each file in `site/public/media/midi` is profiled (`tools/music/midi_profile.mjs`) into target affect, pay, relief and emotion suits; overrides in `midi_rewards.json`. New files are picked up on regeneration. Guitar/keys act chooses a piece by mood closeness (+ soothing when stress > .45).

**Art judgement is learned.** Piece = 9-axis vector. Taste target = guideline .5 / emotion .3 / learned .2. Stages sketch > refine > render > review; match decides ending (serene / proud / flat). "Good" = satisfaction = the rare serene chain `serene_savour` completing with calm/content/proud and stress < .3; only then taste learns. Guidelines = brand book (ink/deep/volt/lav/cream, 70/20/10, riso sketchbook). Feed of last 300 pieces for owner curation into the gallery. Code: `site/src/sim/art.js`, `tools/art/`.

**Status after round-4 tuning (480 lives x 20 days, no hard failures):** fitness 1.90; sim tests 47/47; physics 94/0; build ok; Monte Carlo PASS (200x7 days). Known misses: art_satisfied_share .015 (target .03-.10), valence mean ~.71-.78 (band .5-.7), erratic .4, shower 2.2, chain break ratio above band. Next: art executor (axis vector > Infinite patch), feed/gallery UI, sim-to-visuals per SIM_TO_VISUALS.md.

## 19. Status 2026-10-17 (end of build)
- Live mode is a flag (`?sim=1` local core, `?sim=life` shared canonical life); default is still the old planner. Owner decides when to flip it.
- Art: `tools/art/executor.py` turns the 9 taste axes into an Infinite patch (Shape > kaleidoscope > blur > noise > bloom > gradient map > colour adjust). `make_pieces.py` renders them to `site/public/art/sim/`; the desk monitor shows one during art acts.
- Music: each MIDI piece carries suitability for awe, nostalgia and triumph as well as the older emotions.
- Open: closed-loop self-judging of frames, owner curation feed, MIDI-to-patch tie, 3D building, remaining tuning gaps (atus_gap, chain_broken_ratio, art pieces/day). Regenerate `life.json` after any tuning.

## 20. Review 2026-10-18

See `SIM_REVIEW.md`. Model changes: hazards declare `interrupt: hard|soft|none`; soft ones suspend chains and he
resumes with P = exp(-away / resumeTau) (45 min); a chain with no required step done is dropped, not broken; a
jump ahead mid-repetition is a micro-break; interrupted acts write `interrupted_act` / `interrupted_work`;
`meal_done`, `long_shower`, `short_sleep` are written; the Lövheim cube follows the source (HT, DA, NE) with a
dead zone. The master matrix (`tools/emotions/simkit.py matrix`) puts every entity in V A ST E D + motives +
chemistry.
