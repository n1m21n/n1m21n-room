# n1m21n character: handoff for the next session (written 2026-10-17)

Start here. Then read `BLUEPRINT_REVIEW.md` (review of the two Antigravity blueprints), `SIM_DESIGN.md`, `DATA_SOURCES.md`.

## STATUS UPDATE (2026-10-18, round 4): work vs boredom: read `SIM_REVIEW.md` "Round 4"

- Bug fixed: during an act, hazards and mood saw the end-of-act motives from minute one (boredom quit every work stint at once). Motives are now interpolated per chunk.
- Work/fun drain -64 -> -30 (`motive_matrix.json`), boredom_quit soft, duty 0.25 fading with today's hours (`workTarget` 300, `workThroughDone` 0.25 in `tune.json`). Plain work 27 -> 153 min/day, work_through 163 -> 71, mood 0.561 -> 0.612.
- Gates pass (build, tests 48/0, physics 100/0 fail, Monte Carlo PASS); `life.json` regenerated. NOT deployed.
- Next: option (b) preconditions for art/music/social acts; weekday/weekend calendar; work output/deadlines; ATUS re-validation.

## STATUS UPDATE (2026-10-18, round 3): planned chains: read `SIM_REVIEW.md` "Round 3"

- Goal planner over a world model (`tools/emotions/world_model.json`, `site/src/sim/world.js`, `TUNE.goalPlan`): chains are generated (preconditions, any order, learned habits, interruption + resume + replan). Tea 2.7/day.
- Gates pass (tests 48, Monte Carlo PASS, resume = replay 40/40, build OK); `life.json` regenerated. NOT deployed.
- Next: work/boredom tuning; preconditions for art/music/social acts; day-scale intentions; ATUS re-validation.

## STATUS UPDATE (2026-10-18, round 2): props + live acts: read `SIM_REVIEW.md` "Round 2"

- Habituation replaced the brush/dress/shower caps; night clock prior added. Tea 8.7 %, phone 7.3 %, zero-sleep days 0.
- New `site/src/props.js`: phone, plant + watering can, easel with canvas/palette/brush (art is painted on the canvas in stages). Every planned act is live in `main.js` except build/gather (need the grid).
- Gates all pass (tests 48, physics 100/0 fail, Monte Carlo PASS); `life.json` regenerated. NOT deployed; `functions/api/nudge.js` changed, so deploy needs the owner's OK.

## STATUS UPDATE (2026-10-18): sim review: read `SIM_REVIEW.md` first

- Eleven fixes landed (determinism, counters, interrupted acts, Lövheim cube, soft vs hard interruptions with resume, phantom chains dropped, 4 dead rewards wired, music congruence fallback). Monte Carlo PASS; done:broken routines 1.2 -> 2.3. `life.json` regenerated; build OK. NOT deployed (owner's OK needed).
- New CLI `tools/emotions/simkit.py` (master matrix, act/music -> emotion maps, reward audit, interruption policy, art map, add-emotion/object/act/chain). New skill `~/.claude/skills/character-sim`.
- Next: habituation instead of hard caps (tea 10 %), night-time clock prior, wire or delete the 11 still-dead ledger events, emotion weights for the 906 "other" art params.

## STATUS UPDATE (2026-10-17, later session): read this first

Done since the plan above was written:
- Phase 1 tuning: brush cap (2/day) and dress cap (1/day) in `core.js`; art-satisfaction bug fixed (`chainEvent` now calls `finishPiece(true)` on chain-complete); `satisfiedAt` 0.80; interrupted acts are cut short with scaled rewards; two sweeps applied (backups in /private/tmp/claude-501/bk/). A third big sweep (pop240 gens10) never beat the baseline, so the current tuning stays. Still off-band: atus_gap ~42 (target <=35), chain_broken_ratio ~0.47 (band .25-.45), art pieces/day ~0.13 (target >=.3).
- Regenerate generated files with `PYTHONPATH=tools/emotions .venv/bin/python -s tools/emotions/gen.py` (same for `tools/art/gen_art.py`); do NOT use `-I`.
- Phase 2 body: blink, shoulder lift, finger curl/tremor, foot tap, knee bend (`posture.js`, `acts.js curlFingers`, `player.js`); route bias by emotion (`nav.js`). Gaze skipped (face is a flat texture).
- Phase 3 go-live is behind a flag, default OFF: `?sim=1` (local core) or `?sim=life` (shared canonical life) or localStorage `n1m21n.sim`. `life.js START_MIN = 0` so the story clock matches IST. `life.json` regenerated with `node tools/sim/make_life.mjs` after tuning; redo it after ANY further tuning.
- Phase 4 art: `tools/art/executor.py` (9-axis taste vector -> `.inf` patch -> `--validate` / `--frame` / `--render` through the Infinite CLI). `tools/art/make_pieces.py N` renders pieces into `site/public/art/sim/` with a manifest; the desk monitor shows one while the sim has him in an art act (flag on). Pieces are a first-pass look (dark ground, one glowing form); the closed loop (he judges his own frames) and an owner curation feed are NOT built.
- Labelled MIDI done: `midi_profile.mjs` now scores every piece for awe/nostalgia/triumph (closeness to the emotion prototype). Phase 5: SIM_DESIGN.md section 19 added, MASTER_MAP regenerated, licence notes written. Not started: MIDI-to-patch tie, 3D building, Phase 5 release steps (SIM_DESIGN.md update, MASTER_MAP regen, licence check, mobile pass, deploy needs the owner's OK).

## Standing rules
- Must keep passing (from `site/`): `npm run build`; `node tests/sim.mjs` (47 checks); `node tests/physics.mjs --only=P1,P4,P6` (94 checks, 0 fail); `node tools/sim/montecarlo.mjs` verdict PASS (from project root).
- Instability layers stay off by default.
- Never start agents or Claude sessions in `~/Infinite/repo`. Reading it and running its CLI is fine.
- One shared character for all visitors (`site/public/sim/life.json`); visitor nudges are local only.
- Downloads need the owner's explicit OK per source. Never evade bot detection.
- Sweep-applied values live in `tools/emotions/tune.json` and override `site/src/sim/tune.js`. Change tunings via `tune.json` + `python3 tools/emotions/gen.py`.
- Python tools: use `.venv/bin/python -I`.

## Current state
- Sim core (7 motives, 45 acts, chains, ledger, neurochemistry, 27 emotions, art, music) is stable and runs in **shadow mode** beside the old live system (`site/src/main.js`, `routine.js`, `utility.js`).
- Live character now takes from the sim: face texture (all 27), head/spine/neck tilt (rig coords), walk speed and head-down by emotion (`site/src/sim/posture.js` GAIT table, from `tools/data/gait_fit.json`).
- Chain branches respect time-of-day windows. Per-act cooldowns now work (`lastDoneAt` was never written; fixed in `runAct`).
- MIDI: 20 pieces in `site/public/media/midi/` (14 Mutopia added); guitar picks only `aguado*`, keys the rest.
- Data fitted: ATUS time use and Well-Being (per-act mood in `act_feel.json`), emotion lexicons, EMA dynamics (`ema_fit.json`), smart-home sequences (`smarthome_fit.json`), Bandai-Namco gait.
- Other assistant (Antigravity) also edited `neuro.js` (sleep pressure fix), `emotion.js` (Lövheim prior), `chains.js`, `core.js`, `tune.js` (`circadianPull`), `follow.gen.js` (`hourShape`). All verified present and consistent.

## Known problems (fix first, in this order)
1. **Brush and dressing take 7.7% and 5% of all acts** (Monte Carlo top acts). Suspect the grooming split or cooldowns. Check `tools/emotions/follow.json` and activity rates.
2. **Time split is ~57 points off real diaries** (`node tools/data/validate.mjs`): sleep 33% vs 44%, TV 8% vs 15%; grooming 7.9% vs 3.3%, read 8% vs 1.8%, hobby, music, phone too high. Some classes cannot be matched (one-room character).
3. **Chain break ratio ~0.55**, target 0.25-0.45. Driven by interrupts breaking all chains in flight, `work_block`, `wake_up`, `serene_savour`.
4. **Stress runs low** (mean ~0.16 vs 0.25 real). Per-class correlation with Well-Being: happy 0.55, stress 0.48. Needs a mood-fit objective in `tools/sim/objectives.json` and a careful `stressShift` (it is in `tune.js` as 0; setting it needs the key in both `tune.js` and `core.js`).
5. **Valence mean ~0.78** (target 0.58-0.75). `moodShift` is -0.07.
6. **Art satisfied share** swings 1-4% (needs `serene_savour` to complete more).

## Plan to release

### Phase 1: Believable sim (1-2 sessions)
1. Brush and dress overuse (see problem 1 above).
2. Time split vs real diaries (problem 2).
3. Chain break ratio (problem 3).
4. Stress level and a mood-by-activity objective in the sweep (problem 4).
5. Valence mean and art satisfied share (problems 5-6).
6. Cut interrupted acts short and scale reward by progress (`runAct` loop in `core.js`).
7. Re-run Monte Carlo and the sweep (`node tools/sim/sweep.mjs search`), apply, run `gen.py`, lock the numbers.

### Phase 2: The body (2 sessions)
1. Shoulders, fingers (`hand_curl`, `finger_tremor`), feet (`foot_tap`), knees, stance and stride from emotion coords in `emotions.gen.js` (`POSTURE_MATRIX_FULL`).
2. Procedural blink; eye gaze that follows head turns.
3. Feed room solids into `sim/grid.js`.
4. Emotion-weighted path cost in `nav.js`.
5. Optionally calibrate more joints from Bandai-Namco angles.

### Phase 3: Go live (1 session)
1. Replace the old system with the sim behind a flag.
2. Keep the shared life checkpoint (one character for all visitors; visitor nudges local only).
3. Check performance, save/restore and offline catch-up.
4. Connect sim state to visuals (`SIM_TO_VISUALS.md`).

### Phase 4: Art and music (3 sessions)
1. `tools/art/executor.py`: axis vector -> Infinite patch, CLI only (`--validate`, `--frame`, `--render`).
2. Closed loop: he looks at his own real frames and judges them.
3. Gallery and desk monitor show real pieces.
4. Owner feed to curate pieces into the gallery.
5. Labelled MIDI for awe, nostalgia and triumph; tie his MIDI to the patch.
6. 3D objects and building from materials (owner's earlier idea, after the above).

### Phase 5: Release (1 session)
1. Update `SIM_DESIGN.md`, regenerate `MASTER_MAP.html`, update memory notes.
2. Licence check (next section).
3. Final test pass including mobile: build, sim, physics, Monte Carlo.
4. Deploy.

### Later / optional
- Literature cortisol curve (no MMASH needed).
- Emotion recovery times from CASE and the EMA data.
- Appraisal-based emotions so awe and nostalgia arise without fixed triggers.

## Licences to settle before release
- Bandai-Namco Motiondataset-2: CC BY-NC 4.0 (gait numbers are derived from it).
- CASE, PROX/HUMANISE: research-use. EMOPIA, POP909: transcribed pop songs, kept out of the public site.
- Mutopia pieces used on the site: Mutopia editions are PD / CC0 / CC-BY / CC-BY-SA (a Bach listing showed all four). `site/public/media/midi/CREDITS.txt` credits them generally. STILL TO DO: confirm each of the 14 editions' licence on its Mutopia page and add typesetter credit where CC-BY(-SA). The only data-derived thing in the shipped code is the gait fit (Bandai-Namco, CC BY-NC: needs a credit line, and fine only while the site is non-commercial). No EMOPIA/POP909/VGMIDI content ships.

## Data on disk (`data/raw`) and status
| Set | Status |
|---|---|
| atus | used (time use, Well-Being) |
| emotion: nrc_vad, warriner, goemotions, ck_map | used (audit, candidates) |
| emotion: emotion_timeseries, emobank | used (`ema_fit.json`) |
| emotion: case (7.2 GB), isear | not used; CASE could give emotion recovery times |
| midi: emopia, vgmidi | used to calibrate music profiles only |
| midi: mutopia | 14 pieces on the site |
| midi: pop909, maestro | not used |
| motion: bandai_namco | gait used; joint angles per style could calibrate more of the rig |
| neuro: mmash | **broken** (truncated zip, code only). Not needed: add a literature cortisol curve instead |
| smarthome: casas, kasteren | used (`smarthome_fit.json`) |
| spatial: humanise_prox, eth_ucy | not used; later for path and proxemics |

## Claims in the blueprints that were wrong (do not redo)
RPE already in `outcome.js`; `@resume` already keeps its step; there are 27 emotions and faces (not 22); 6 original MIDI files (not 7).

## First commands next session
```
cd "/Users/namansoni/music videos/n1m21n-room"
node tools/sim/montecarlo.mjs | tail -30
node tools/data/validate.mjs | tail -25
```

## STATUS UPDATE (mood panel + shared life)
- Mood chip/card (site/src/moodpanel.js): plain-language, floating +N/-N pills, visitor counts. `?stats=1` shows numbers.
- Shared life: life.js = pure fn of (seed 2026, real clock, nudge log). Nudges via site/functions/api/nudge.js (Pages Functions + D1). Acts only are stored (no raw paths). Limits: 20s/visitor, 4s global, 9-act whitelist. Nudges interrupt the current act (sleep excluded).
- Local test: `wrangler pages dev dist --d1 DB=LOCAL-ONLY` (port 8788).
- NOT DEPLOYED. To go live: `npx wrangler@4 d1 create naman-room-nudges`, paste database_id in site/wrangler.toml, `npx wrangler@4 d1 migrations apply naman-room-nudges --remote`, then build + pages deploy (needs owner OK; default is now shared life ON).
- MIDI: 20 mapped (17 piano, 3 guitar). Mutopia index in tools/music/mutopia_index.json (check licences). Do not ship pop MIDI (Downloads/EMOPIA/POP909); MAESTRO is CC BY-NC-SA.

## STATUS UPDATE 2 (live)
- LIVE at https://naman-room.pages.dev with shared life ON. D1 `naman-room-nudges` (id in site/wrangler.toml), migrations 0001 + 0002 (ip hash) applied.
- Nudges: per-visitor 12s cooldown (also per hashed IP), room leaky bucket 5s/slot, queue up to 30s ahead; GET returns the whole log (paged 1000). life.js replays when a late nudge lands in his simulated past and drains due nudges after the loop (fixes nudges that arrived a few seconds late being ignored).
- MIDI: 238 pieces. 96 piano + 48 guitar are generated by tools/music/compose.mjs (designed valence/arousal -> mode, chords, tempo, velocity; targets in tools/music/generated_targets.json are the truth for the sim). Plus Mutopia (incl. 20 guitar), EMOPIA 39 clips, Downloads 3 pop, BitMidi 12 pop (hand-set moods in midi_rewards.json manual blocks). Credits in site/public/media/midi/CREDITS.txt.
- After ANY change to core/tuning/MIDI targets: node tools/sim/make_life.mjs, node tests/sim.mjs, vite build, deploy (the timeline jumps for visitors).
- Remaining: Mutopia edition licence check, MIDI-to-Infinite patch tie, art closed loop, owner curation feed, 3D building, bake old nudges into checkpoints as the log grows.

## STATUS UPDATE 3 (live badge + visits; replaces the per-click nudge model)
- UI: "live" badge (pink pulsing dot) beside the mood chip; tap = explainer. Any control (routine.touched) flips it to "your room": the autopilot lets go and he is the visitor's. After 120 s idle, or "go live", he rejoins the shared feed.
- Visits: sim/nudges.js records which things the visitor used (play(act)) and posts ONE summary {vid, secs, acts} when the visit ends (idle hand-back, go live, tab hidden/closed). Server (functions/api/nudge.js, migration 0003): rows per act with n + secs share; >=20 s of play; 60 s gap per visitor/hashed address; whitelisted acts; clamps.
- Effect: core.cue() = a lean toward what they did (+0.25 per play, cap 2.5, fades over ~1 story day) plus company/fun. Applied at the act boundary after the visit's time, in order, so every browser agrees (verified across call patterns and late arrival). Roughly doubles the chance of that act in the following day.
- Removed: per-click nudges, queue slots, "asleep" block. Old nudge rows (n=1, secs=0) now count as tiny cues.
- Rerun after core/tuning/MIDI changes: node tools/sim/make_life.mjs; node tests/sim.mjs.

## STATUS UPDATE 4 (polish after owner review; NOT yet deployed at time of writing)
- Badge renamed "your room" -> "hands on" (live = hands off). Enter click no longer counts as play (routine.handBack() in boot.ready), so a visit starts "live"; reload always starts live.
- Summary now covers EVERY thing he can use (NUDGE_OF in main.js: tea, fridge, cook, shower, brush, wash, loo, wardrobe->dress, bench, art frames->gallery_view, lie down->sleep, lamp, stool, timeline + the original ten). Server whitelist + MAX_ACTS 32 in functions/api/nudge.js; sim cue only leans for names in ACTIVITIES (lamp/sit/timeline just count).
- Local +/- numbers: visitBonus overlay (reward x0.2, fades, cleared on go live) fed into moodpanel `bonus`; only on the visitor's screen.
- Top bar: all chips 34px, row 2 spreads full width <=640px, mini vinyl sits under the bar on touch, panels hang from the real bar bottom (--ptop) and anchor under their own badge. "his week" graph now has a baseline, today dot and a caption.
