# Sim review — 2026-10-18

Goal: vet the sim, fix what is wrong, make him more human, and add tools for growing the model.
Backup of every sim file before this review: `$SCRATCH/bk/pre-review.tgz` (session scratchpad; copy it
out if you want it kept).

## Fixed (bugs)

| # | Problem | Effect | Fix |
|---|---|---|---|
| 1 | Snapshot had two `plan:` keys; the planner memo was overwritten by the intent list | planner cache lost on every reload | saved as `planAdj` (old saves still load) |
| 2 | `lastDoneAt` (cooldowns), `cancelledKey` and `doing` not restored | resumed life differed from replay | all saved and restored; resume = replay in 40/40 seeds |
| 3 | `cancelled` counted once per candidate act scored | 357 "cancelled" a day instead of ~6 | one decision per hour |
| 4 | Interrupted acts drained motives for the full planned length and booked full minutes | cut-short acts cost too much | drain refunded for unlived minutes, minutes booked as lived, partial loo pays partial |
| 5 | Lövheim cube read with wrong axis order and wrong affects; resting chemistry always read as 111 "joyful" | wrong chemistry label, joy at rest | real Lövheim (HT, DA, NE; 000 shame … 111 interest), dead zone 0.04 around baseline |
| 6 | About page: DA/HT columns swapped; hazard rates labelled /h but per minute | misleading explainer | template fixed (rates shown /day), page rebuilt |

## Fixed (human-likeness)

| # | Before | After |
|---|---|---|
| 7 | Every hazard (phone, knock, stumble) broke every running routine | `interrupt: hard / soft / none` per hazard in `hazards.json`; soft ones suspend, and he resumes with odds exp(−away / 45 min) (`resumeTau` in tune) — goal memory decays with time away |
| 8 | Tea opened `work_block`, a look in the fridge opened `meal`; drifting off afterwards was booked as a broken goal (≈60 % of all breaks) | a routine with no required step done is *dropped*, not broken (no penalty, no branch cascade) |
| 9 | One window glance mid-work ended the work block | a jump ahead in the middle of a repeated step is a micro-break, tolerated once |
| 10 | 15 of 46 reward events were never written by any code | wired: `interrupted_act` / `interrupted_work` (being cut off costs frustration, pride), `meal_done`, `long_shower`, `short_sleep` (night sleep < 5 h). Still unwired, need features: pet_snake, build_*, roam_new_cell, sunlight, visitor_interact / leave, skip_meal_*, work_through_burnout |
| 11 | Music `suits` hand-set for 8 emotions; others got a flat 0.4; guitar / keys fallback was dead code | missing suits fall back to congruence with the emotion prototype; fallback fixed |

## Measured (Monte Carlo, `node tools/sim/montecarlo.mjs`)

| metric | before | after |
|---|---|---|
| verdict | PASS | PASS |
| mood valence mean | 0.588 | 0.616 |
| stress mean | 0.205 | 0.208 |
| acts / day | ~48 | 46.8 |
| routines done / day | 5.07 | 4.41 |
| routines broken / day | 4.34 | 1.91 |
| routines dropped (never started) / day | — | 2.24 |
| suspended by soft interruption / day | — | 0.29 |
| fail rate | 0.092 | 0.091 |

Done : broken went from 1.2 : 1 to 2.3 : 1. Tests 47/47, physics 94 checks / 0 fail, build OK, `life.json`
regenerated (26 checkpoints). **Not deployed** — needs the owner's OK; the live timeline will jump.

## Round 2 (same day): habituation, night prior, props, every planned act live

| metric | after round 1 | after round 2 |
|---|---|---|
| verdict | PASS | PASS |
| mood valence mean | 0.616 | 0.597 |
| stress mean | 0.208 | 0.232 |
| acts / day | 46.8 | 47.2 |
| tea share | ~10 % | 8.7 % (4.3 / day) |
| phone_call share | ~8 % | 7.3 % (3.6 / day) |
| water_plant / day | not live | 0.27 |
| same act again within 3 h | — | 0.20 |
| night acts / day | — | 1.11 |
| zero-sleep days | 1 seed | 0 |
| routines done / broken / day | 4.41 / 1.91 | 5.13 / 2.52 |
| fail rate | 0.091 | 0.099 |

- **Habituation replaces the hard caps** (brush, dress, shower): repeating an act within a few hours lowers
  its utility (`core.js`, values in `tune.js`); a **night clock prior** damps waking acts between midnight
  and dawn; a `due` multiplier keeps hygiene from vanishing.
- **New props** (`site/src/props.js`): side table with a phone (rings, glows, held to the ear), plant stool
  and watering can (pour stream), easel with a white canvas, palette and brush. The canvas paints the hour's
  piece in stages: sketch (grey, top down) → refine (colour comes in) → render / review (done piece stays up).
  The desk monitor no longer shows art.
- **Every planned act is live** (`main.js` SPOT_OF): phone_call, answer_phone, water_plant, art_* (easel),
  write_letter, nap, greet_visitor, gallery_view, roam / run_indoors (waypoints), pace, and the micro acts
  yawn, stretch, sigh, fidget, sip, glance, stumble. Exception: build and gather need the open-world grid;
  they map to work / records for now.
- Nudge buttons: make a call, water the plant, paint. `site/functions/api/nudge.js` whitelist updated, so
  the server needs a deploy (owner's OK).
- Gates: tests 48/48, physics 100 checks / 0 fail, Monte Carlo PASS, `life.json` regenerated, build OK.

## Round 3 (same day): chains are planned, not listed

Owner's question: tea looked like 8 % of his life, and only 8 named chains (the "08" on the about page is the
section number; there are 20). Tea was 8.7 % of *acts* but 2.9 % of *time*; it was still too many cups.

**What changed.** A small world model (`tools/emotions/world_model.json` -> `site/src/sim/world.js`): fluents
are facts (teeth clean, dressed, food portions, ingredients out, dirty dishes, just been to the loo, caffeine
with a 5 h half-life). Each act has guards (no brushing clean teeth), hard preconditions (cook needs
ingredients -> fridge), "one of" preconditions with different pay (cooked meal 1.0, fridge snack 0.6), soft
steps (brush before bed, dressed for work) kept with a chance that falls with tiredness and stress, effects and
failure effects. When an act is chosen it becomes a **goal**; the planner fills unmet preconditions
recursively (means-ends / GOAP style), and the order of independent steps is drawn from act-to-act affinity ×
(1 + his learned pair habit), so any order can happen and each seed grows its own routine.
**Interruptions** (hazards, detours) suspend the goal; he comes back with odds exp(−away/45 min) ×
0.5^(times already resumed), and on return he **replans from the world as it is now** (food may have gone
cold, the ingredients may be out already). A failed step that leaves a precondition unmet is a branch: replan.
Acts that would undo a remaining step's precondition are damped (eating the ingredients he took out to cook).
World facts also pull acts directly (dishes in the sink -> wash; pyjamas at noon -> dress), and caffeine
lowers tea appeal, more after 16:00. Named chains stay as recognised motifs (labels, ledger bonuses).

| metric | round 2 | round 3 |
|---|---|---|
| verdict | PASS | PASS |
| mood valence / stress | 0.597 / 0.232 | 0.561 / 0.282 |
| tea / day (share of acts) | 4.33 (8.7 %) | 2.69 (5.3 %) |
| cook / eat / fridge per day | 3.71 / 3.87 / 2.52 | 1.67 / 4.54 / 3.50 |
| brush / dress per day | 2.21 / 1.41 | 2.41 / 1.85 |
| distinct planned sequences (60 seeds) | 0 (planner absent) | 632 (274 multi-step) |
| distinct free act sequences | 7,174 | 7,301 |
| resume = replay | 40/40 | 40/40 |

Emergent examples (none written anywhere): `fridge>~tea>cook`, `loo>brush>sleep`, `fridge>eat` (snack when
lazy), `~tv>~greet_visitor>tv` (knock mid-show, back to the show), `dress>~shower>dress>~work [dropped]`.

### Where it still falls short (honest)

1. **Work.** (fixed in round 4) Ordinary `work` lasted 9–27 min/day: the boredom_quit hazard (fun < 0.22) cuts it almost always;
   `work_through` is effectively his day job (~3 h, 10:00–15:00). Work drains fun too fast; needs tuning.
2. **Goals are mostly one step.** (partly addressed in round 5) 274 multi-step sequences, but the top goals are single acts. Only hygiene,
   food and dressing have preconditions; art, music, social and errands have none yet.
3. **No day-scale intentions.** He plans one goal ahead, never "finish the piece today" or "call mum tonight".
4. **No other agents.** Visitors and calls are hazards, not people with their own schedules or memory of him.
5. **No episodic memory.** He learns order habits and soft-step keep rates, not "last time the tea burnt".
6. **No slow arcs.** No illness, fatigue that builds over a week, seasons, money, deadlines.
7. **Not validated against people.** Time use was ~57 points off the ATUS diary earlier; not re-run on this
   model. Eat 4.5/day and fridge 3.5/day are still high; phone 3.8 calls/day is high.
8. Mood fell 0.597 -> 0.561 and stress rose to 0.28 (in band, but watch it).

## Round 4 (same day): work vs boredom

Plain `work` lasted 9–27 min/day and the burnout act `work_through` had become his day job. Three causes, three fixes:

1. **Bug: hazards and mood saw the end of the act from minute one.** `runAct` applies a whole act's decay, drain and
   rewards up front, then steps the world in chunks. Every hazard trigger (and the affect / emotion read) saw the
   motives as they would be at the END of the act, so a 2 h work stint read `fun < 0.22` at its first tick and
   `boredom_quit` fired at once. Now each chunk sees the motives interpolated start -> end (linear) and the end state
   is restored after the loop (`core.js runAct`). This touches every act's hazards, not only work.
2. **Work drained fun too fast.** `motive_matrix.json` work/fun was -64 (ATUS-WB blend) = 0.46 fun/h on top of the
   base decay; from a normal mood fun crossed 0.22 inside an hour. Hand-set to -30 (source note updated).
   `boredom_quit` is now a `soft` interruption: he steps away from the desk and may come back (resume odds as for any
   soft break) instead of the work goal breaking.
3. **Nothing pulled him to the desk.** Work pays almost nothing to his motives, so its appeal was the duty floor
   `workDuty` 0.051 -> after `pickExp` it lost to tv and read every time. `workDuty` 0.25, and duty now fades with the
   hours already done today: owed = 1 - (work + work_through minutes) / `workTarget` (300). `work_through` keeps
   `workThroughDone` (0.25) of its appeal once the hours are done, so he only pushes through exhaustion for work still
   owed. All three are in `tools/emotions/tune.json`.

Monte Carlo (200 seeds × 7 days; `work` block added to `montecarlo.mjs`):

| metric | round 3 | round 4 |
|---|---|---|
| verdict | PASS | PASS |
| plain work min/day (p10 / p90) | 26.7 (0 / 80) | 153 (81 / 242) |
| work_through min/day | 163 | 71 |
| work stints/day, min per stint | 0.93, 29 | 1.47, 105 |
| boredom_quit per day | 0.87 | 0.28 |
| mood valence (sd) / stress | 0.561 (0.102) / 0.282 | 0.612 (0.094) / 0.254 |
| chains done / broken / dropped | 2.84 / 2.97 / 1.56 | 3.10 / 2.80 / 1.16 |
| fail rate / erratic events per day | 0.099 / 1.75 | 0.102 / 1.04 |
| acts per day / repeat within 3 h | 47.3 / 0.204 | 43.6 / 0.185 |
| eat / fridge / phone per day | 4.54 / 3.50 / 3.77 | 4.17 / 3.25 / 2.95 |
| top time shares | sleep 35.5, tv 11.5, work_through 11.3, read 8.4 | sleep 37.3, work 10.6, tv 10.0, read 8.1, work_through 4.9 |

(The round 3 column is measured with round 3 code; `work` numbers came from the new `work` block run on it.)

Still open after round 4: total desk time is ~3.7 h/day with no weekday/weekend difference (no calendar yet); work
has no deadlines or output (nothing gets finished); `work_through` still fires on ~half the days; eat 4.2/day and
fridge 3.3/day are still high.

## Round 5 (same day): art, music and social acts get steps of their own

Only hygiene, food and dressing had preconditions, so art, music and social goals were one step. Three new fluents in
`tools/emotions/world_model.json` (no new acts; every provider already has a spot in `main.js` SPOT_OF):

| fluent | made true by | wanted by |
|---|---|---|
| `inspired` (ttl 150 min) | records, read, gallery_view | guitar, keys, art_sketch (soft); art_sketch uses it up |
| `news` (ttl 1 day) | read, guitar, keys, art_review | phone_call (soft), write_letter (hard: a letter needs something to say); both use it up |
| `paint` (on his hands) | art_refine, art_render | guitar, keys, eat, cook want it off (soft); wash removes it; a `needs` entry pulls wash while it dries |

Engine (small, general): `softKeep` per act scales how often he keeps that act's soft steps (guitar/keys 0.9, phone_call
0.8; validated in gen.py), and the planner only inserts a step he could choose right now (no art stage when no piece
is on the easel). Emergent examples: `read>phone_call` (read something, rings someone about it), `gallery_view>art_sketch`,
`records>keys>phone_call` cut short to `records>phone_call`, `read>~phone_call>art_sketch`, `fridge>~tea>wash>cook`.

Monte Carlo (200 seeds × 7 days; `goals`, `art_pieces_per_day`, `music_min`, `social_min` added to `montecarlo.mjs`):

| metric | round 4 | round 5 |
|---|---|---|
| verdict | PASS | PASS |
| done goals with 2+ steps | 8.7 % | 12.2 % |
| art / music / social goals with 2+ steps | 4.4 % / 0 % / 0 % | 27.3 % / 36.6 % / 21.1 % |
| distinct multi-step sequences / all goal sequences | 249 / 612 | 524 / 965 |
| art pieces per day | 0.232 | 0.231 |
| music / social minutes per day | 17.4 / 68.1 | 19.1 / 67.4 |
| mood / stress | 0.612 / 0.254 | 0.619 / 0.246 |
| chains done / broken / dropped | 3.10 / 2.80 / 1.16 | 2.87 / 2.68 / 1.09 |
| plain work min/day | 153 | 157 |
| eat / fridge / phone per day | 4.17 / 3.25 / 2.95 | 4.13 / 3.20 / 2.88 |

Still open after round 5: most goals are still single acts (window, eat, tv, read have no preconditions and make up
most of the day); time spent on music (19 min) and art (0.23 pieces/day) did not grow, since steps were added in front
of those acts, not reasons to do them more; paint on his hands has no visual yet; phone 2.9 calls/day is still high.

## Round 6 (same day): day plans

He now holds day-scale intentions: "finish the piece today", "play something tonight", "call someone tonight", "cook a
proper dinner", "write that letter". Data in `tools/emotions/intentions.json` (validated and baked by gen.py into
`world.gen.js` as `INTENTIONS`), engine in `site/src/sim/intent.js`, wired in `core.js` (one multiplier in
`actWeights`, one call in `afterAct`, snapshot/restore).

- Formed on the first waking act after 05:00, with odds shaped by mood and energy (a piece on the easel makes
  "finish it" likely, 0.65; a low mood makes "play something" more likely), or by an event: `news` can turn into
  "call someone" within 5 h, or rarely a letter within a day.
- Each has a window (dinner 17:30-21:30, call 17-22, finish 10-22). While held it raises the matching acts by
  1 + pull × `TUNE.intentPull` × urgency (0.35 before the window, 0.6 rising to 1.6 across it). It is a reason to do
  art and music, not one more step in front of them.
- Kept: ledger `intention_kept` (valence, pride, DA up; 0.6 if late, 1.3 for a carried-over one). Missed when the
  window closes: `intention_broken` (small frustration, pride down, a little CORT; half for one already carried), and
  carried to tomorrow with chance `carry` (finish 0.5, letter 0.6, cook 0), held again with pull × 1.3.
- Visual: paint smudges on both hands while the world fluent `paint` is set (after refine/render, until a wash), and
  late in a painting sitting (`props.js` `showPaint`, `main.js` `paintOnHands`). Stills: `hands-paint`,
  `hands-paint-back`, `hands-paint-wide`, `act-paint-hands` in `tests/stills.mjs`.
- New `tools/sim/resume_probe.mjs`: snapshot at an odd time, restore into a fresh core from the snapshot's seed,
  advance 3 days, and compare every event after the snapshot with a straight-through run. 40/40 seeds equal (15-21
  snapshots were holding intentions). Restoring into a core built with another seed diverges, because hazards and
  plan draws are keyed on the construction seed; `life.js` always rebuilds from the same seed, so that is fine.

Monte Carlo (200 seeds × 7 days; `intentions` block added to `montecarlo.mjs`):

| metric | round 5 | round 6 |
|---|---|---|
| verdict | PASS | PASS |
| intentions formed / kept / missed / carried per day | - | 1.89 / 1.25 / 0.63 / 0.19 |
| kept share of formed | - | 66 % |
| art pieces per day | 0.231 | 0.352 |
| music / social minutes per day | 19.1 / 67.4 | 26.4 / 68.7 |
| done goals with 2+ steps | 12.2 % | 13.5 % |
| art / music / social goals with 2+ steps | 27.3 % / 36.6 % / 21.1 % | 30.2 % / 49.2 % / 19.8 % |
| distinct multi-step sequences | 524 | 570 |
| mood / stress | 0.619 / 0.246 | 0.629 / 0.266 |
| plain work / work_through min/day | 157 / 67 | 147 / 71 |
| chains done / broken | 2.87 / 2.68 | 2.80 / 2.92 |
| cook / phone per day | 1.54 / 2.88 | 1.70 / 2.90 |
| top acts | eat 9.0, window 7.8, wash 7.5, read 7.4 % | eat 9.0, wash 7.6, window 7.6, read 7.0 % |

By intention (per day): finish_piece formed 0.45 / kept 0.29 / missed 0.16; play_music 0.34 / 0.26 / 0.08;
call_someone 0.46 / 0.39 / 0.07; cook_dinner 0.51 / 0.28 / 0.23; write_letter 0.13 / 0.03 / 0.10.

Pull checked at 0 / 0.6 / 1. At 0 they form but change nothing (kept 0.82, missed 1.22, art 0.205). At 1, kept 66 %
of formed. Stress +0.02 follows the extra art (+50 % pieces) and is not from the broken-intention events, since at
pull 0 (twice the misses) stress was 0.248. Kept `intentPull` at 1.

Still open after round 6: cook_dinner is missed 45 % of the time (dinner is often eaten from the fridge before 17:30;
`early` 1 h may be too strict); write_letter is mostly carried and dropped; chains broken rose 2.68 to 2.92
(intentions pull him off routines); no weekday/weekend difference in what he intends. Physics P1 `paint` clips the
right hand 16-22 mm into the tee at about 1 in 5 clock phases (`verifyActs` reads `performance.now()`, so a run
passes or fails by chance). Same on round 5 code; fix the paint pose, and seed the clock in `verifyActs`.

## Still open

- Music suits values like "allegro suits sad 0.89" are a mood-repair rule; state it or replace with
  congruence.
- build / gather wait for the grid world. 11 ledger events still unwired (see #10).
- Stress mean rose to 0.23 and fail rate to 0.099; still in band, watch it.

## New tools

- `tools/emotions/simkit.py` (run with `.venv/bin/python -s`):
  `matrix [--csv]`, `explain kind:name`, `near EMOTION [--kind]`, `act-emotion`, `music-emotion`,
  `reward [EVENT]` (with a dead-event audit), `interrupt [EVENT hard|soft|none]`, `art-map [NODE]`,
  `add-emotion`, `add-object`, `add-act`, `add-chain`.
- Skill `~/.claude/skills/character-sim` (general; this project is its case study).

## What the master matrix is

One table, `tools/emotions/master_matrix.json` / `.csv` (1,857 rows), where every thing in his world is a row in
the same columns: affect **V A ST E D**, the seven **motives**, and the six **chemicals** (DA HT NE CORT OXY
SLP). Rows: 27 emotions, 45 acts, 46 reward events, 19 chains, 6 objects, 9 hazards, 238 MIDI pieces,
251 Infinite nodes and their 1,216 emotion-weighted params. Emotions and music targets are *positions*;
everything else is an *offset* (which way it pushes him from neutral). Each row carries its three nearest
emotions — so "which emotion does this act / piece / node evoke" and "what leads to lonely" are lookups.

## How art maps to the matrix

`tools/art/node_catalog.json` lists Infinite's 338 nodes and 2,253 params, each param tagged with an
axis (size, amount, speed, softness, noise, contrast, brightness, hue, pitch, symmetry, position, shape,
other). `param_semantics.json` gives each axis weights over V A ST E D (e.g. noise = ST +0.8, A +0.4). His
taste vector blends the house guideline, his current emotion (through those weights) and what he learned;
`executor.py` turns it into an `.inf` patch that Infinite's headless CLI renders. 906 params are "other"
and 131 "shape" with no emotion weight — the next place to enrich the mapping.
