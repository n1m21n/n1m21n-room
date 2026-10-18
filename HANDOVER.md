# Handover: n1m21n room + character sim (written 2026-10-18)

Paste the prompt below into the first message of the new Claude account. Open the session with
`/Users/namansoni/music videos/n1m21n-room` as the working folder, and add `/Users/namansoni/music videos`
as a second folder if the app allows it, because `.claude/launch.json` lives there.

---

## PROMPT TO PASTE

You are taking over an existing project from another Claude account. Nothing from that account carries over
(no memory, no skills, no chat history), so everything you need is in files. Read these files in this order
before you do anything:

1. `/Users/namansoni/music videos/n1m21n-room/HANDOVER.md`: this file, with the map of folders, tools and rules.
2. `/Users/namansoni/music videos/n1m21n-room/NEXT_SESSION.md`: the status log (newest entry on top).
3. `/Users/namansoni/music videos/n1m21n-room/SIM_REVIEW.md`: the three review rounds, with measured numbers and the open gaps.
4. `/Users/namansoni/music videos/n1m21n-room/handover/memory/*.md`: the old account's memory, holding the owner's decisions and preferences.
5. `/Users/namansoni/music videos/n1m21n-room/BRIEF.md` (the website) and `SIM_DESIGN.md` (the sim spec), when you need them.

After that, save the important facts into your own memory, and install the skill copied in
`handover/skills/character-sim` into `~/.claude/skills/character-sim`, unless it is already there.

**The project.** An interactive 3D room portfolio for the artist Naman (n1m21n). It is built with Three.js and Vite and hosted on Cloudflare Pages
(`naman.infinitedevices.org`). A toon man lives in the room. A character simulation drives his day:
- 7 motives, 45 acts, 27 emotions, a neurochemistry layer, a reward ledger and hazards
- a goal planner over a world model, which generates his chains of acts
- art he makes with the owner's "Infinite" engine, and music from MIDI

The sim runs in shadow mode. It goes live only with the flag `?sim=1` or `?sim=life`.

**Where we stopped.** Round 3 is done: the goal planner works, and every gate passes. It is **not deployed**. The
open question to the owner was what to do next:
- (a) tune work against boredom: ordinary `work` lasts only 9–27 min/day, because the boredom_quit hazard cuts it, or
- (b) give art, music and social acts preconditions, so more goals take several steps.

Other gaps:
- no day-scale intentions
- no other agents
- no episodic memory
- no slow arcs such as illness, money or deadlines
- not re-validated against ATUS time use
- eat, fridge and phone counts are a bit high

Ask the owner which to do. Follow the rules section of HANDOVER.md exactly.

---

## Map of folders and files

Root: `/Users/namansoni/music videos/` (the owner's main folder; it also holds the music-video projects)

| Path | What it is |
|---|---|
| `n1m21n-room/` | This project. Git repo, remote `https://github.com/n1m21n/n1m21n-room.git`, branch `main`. **About 311 files are uncommitted**: commit them (authored as n1m21n) before or right after the switch. |
| `n1m21n-room/site/` | The website (Vite). `npm run dev` serves on port 5181; `npm run build` builds into `dist/`. |
| `site/src/` | Room code: `main.js` (entry; SPOT_OF maps acts to places), `room.js`, `props.js` (phone, plant, easel), `player.js`, `nav.js`, `gallery.js`, `music.js`, `telly.js`, `routine.js` (the old IST routine), and more. |
| `site/src/sim/` | Sim runtime: `core.js` (chooser, goals, runAct), `world.js` (world model and goal planner), `life.js` (the one shared life), `tune.js`, `chains.js`, `ledger.js`, `neuro.js`, `emotion.js`, `hazard.js`, `posture.js`, `art.js`, `persist.js`. `data/*.gen.js` files are GENERATED: do not edit them. |
| `site/public/sim/life.json` | Life checkpoints. Rebuild them after ANY change to core or tuning. |
| `site/functions/api/nudge.js` | Cloudflare function holding the visitor nudges whitelist (D1 database `naman-room-nudges`). It has changed, so it needs a deploy. |
| `site/tests/` | `sim.mjs` (48 checks), `physics.mjs`, `ui-hygiene.mjs`, `layout.mjs`, `design.mjs`, and others. |
| `tools/emotions/` | Sim DATA (the source of truth): `activities.json`, `emotions.json`, `chains.json`, `hazards.json`, `ledger_events.json`, `world_model.json`, `tune.json`, `neuro.json`, `master_matrix.json/.csv`. Also `gen.py` (turns JSON into `.gen.js`) and `simkit.py` (CLI: matrix, explain, near, reward audit, add-emotion/act/object/chain). |
| `tools/sim/` | `montecarlo.mjs` (verdict PASS/FAIL), `make_life.mjs` (builds life.json), `sweep.mjs` (parameter sweeps), `chainlab.mjs`, `eval.mjs`. |
| `tools/data/` | Fits to real data (ATUS, EMA, smarthome, gait) and `validate.mjs`. |
| `tools/art/` | Infinite engine bridge: `executor.py` (taste to `.inf` patch to render), `make_pieces.py`, `node_catalog.json`, `param_semantics.json`. |
| `tools/music/` | `midi_profile.mjs` (scores MIDI emotions), Mutopia index. |
| `tools/about/` | `build_about.py` + `about.tpl.html`, which build the about/explainer page. |
| `tools/build_man.py`, `export_face.py` and others | Run headless in Blender to build the man (`site/public/media/man/man.glb`) and export face textures. |
| `n1m21n-room/.venv/` | Python venv for the tools. |
| `../.claude/launch.json` | Dev server configs: `room-vite` (5181), `room-dist` (5182), `room-static` (5180). |
| `handover/memory/` | A copy of the old account's memory (owner decisions, workflows, the music-video project). |
| `handover/skills/character-sim/` | A copy of the general character-sim skill (model maths, review checklist, case studies). |
| Other skills (old account, `~/.claude/skills/`) | A film skill library (hub `film-studio`, plus anim-*, camera-language, music-sound, etc.) belongs to the music-video work, not this site. Copy `~/.claude/skills/*` if the new account needs them and does not see them. |
| `~/Infinite/repo` | The owner's Infinite engine. You may READ it and run its CLI. NEVER start agents or Claude sessions inside it. |

Docs in `n1m21n-room/`: `BRIEF.md`, `SIM_DESIGN.md`, `SIM_RESEARCH.md`, `SIM_REVIEW.md`, `SIM_TO_VISUALS.md`,
`DATA_SOURCES.md`, `BLUEPRINT_REVIEW.md`, `NEXT_SESSION.md`, `MASTER_MAP.html`.

## Commands (run from `n1m21n-room/` unless noted)

```
PYTHONPATH=tools/emotions .venv/bin/python -s tools/emotions/gen.py      # after editing any tools/emotions/*.json (do NOT use -I here)
node tools/sim/montecarlo.mjs                                           # must print verdict PASS
node tools/sim/make_life.mjs                                            # after any core/tune change
.venv/bin/python -s tools/about/build_about.py                          # rebuild the about page
.venv/bin/python -s tools/emotions/simkit.py matrix                     # sim CLI (also: explain, near, reward, interrupt, art-map, add-*)
cd site && npm run build && node tests/sim.mjs && node tests/physics.mjs --only=P1,P4,P6
cd site && npm run build && npx wrangler@4 pages deploy dist --project-name naman-room --branch main   # DEPLOY: only with the owner's OK
```

Deploy by direct upload, not by Git: art media is gitignored. The new account needs `npx wrangler login`, done
by the owner. Live sim check: open `http://localhost:5181/?sim=life`. In the console:
- `window.dev.sim.life.now` is a getter, not a function. It returns the core, which has `.goal`, `.world.state`, `.episodes` and `.journal`.
- `dev.sim.core` is a separate shadow core.

## Rules (owner's standing instructions)

- **Do not deploy without the owner's explicit OK.** Round 2 and round 3 are both waiting for that OK.
- Commits are authored as **n1m21n**, with no Claude attribution or co-author lines. The GitHub user is `n1m21n`.
- Gates that must pass before calling any sim work done: build OK, `tests/sim.mjs` all pass, physics P1/P4/P6 with 0 fail, Monte Carlo PASS, then regenerate `life.json`.
- Keep the instability layers OFF by default.
- One shared character for all visitors (`life.json`). Visitor nudges stay local.
- Downloads need the owner's explicit OK for each source. Never evade bot detection.
- Never start agents or sessions in `~/Infinite/repo`.
- Change tuning through `tools/emotions/tune.json` + gen.py, not by hand in generated files.
- Keep the behaviour data-driven (JSON in `tools/emotions`), and keep skills general and adaptable.
- The owner reviews visuals with stills and A/B comparisons (see `handover/memory/owner-film-review-workflow.md`).
- The owner works from a phone (Remote Control) a lot. Send files and screenshots, and keep the text plain and short.

## Round 3 numbers, for reference

| | round 2 | round 3 |
|---|---|---|
| verdict | PASS | PASS |
| mood / stress | 0.597 / 0.232 | 0.561 / 0.282 |
| tea per day | 4.33 | 2.69 |
| cook / eat / fridge per day | 3.71 / 3.87 / 2.52 | 1.67 / 4.54 / 3.50 |
| distinct planned sequences (60 seeds) | 0 | 632 (274 multi-step) |
| resume = replay | 40/40 | 40/40 |
