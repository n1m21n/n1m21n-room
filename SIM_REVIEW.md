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

1. **Work.** Ordinary `work` lasts 9–27 min/day: the boredom_quit hazard (fun < 0.22) cuts it almost always;
   `work_through` is effectively his day job (~3 h, 10:00–15:00). Work drains fun too fast; needs tuning.
2. **Goals are mostly one step.** 274 multi-step sequences, but the top goals are single acts. Only hygiene,
   food and dressing have preconditions; art, music, social and errands have none yet.
3. **No day-scale intentions.** He plans one goal ahead, never "finish the piece today" or "call mum tonight".
4. **No other agents.** Visitors and calls are hazards, not people with their own schedules or memory of him.
5. **No episodic memory.** He learns order habits and soft-step keep rates, not "last time the tea burnt".
6. **No slow arcs.** No illness, fatigue that builds over a week, seasons, money, deadlines.
7. **Not validated against people.** Time use was ~57 points off the ATUS diary earlier; not re-run on this
   model. Eat 4.5/day and fridge 3.5/day are still high; phone 3.8 calls/day is high.
8. Mood fell 0.597 -> 0.561 and stress rose to 0.28 (in band, but watch it).

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
