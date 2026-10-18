# Case studies

## n1m21n room (2026, three.js toon man, one shared life for every visitor)

- Project: `~/music videos/n1m21n-room`. Read `BRIEF.md`, `SIM_DESIGN.md`, `SIM_REVIEW.md`, `NEXT_SESSION.md`.
- Data: `tools/emotions/*.json` → `gen.py` → `site/src/sim/data/*.gen.js`
  (`PYTHONPATH=tools/emotions .venv/bin/python -s tools/emotions/gen.py`).
- Tool: `tools/emotions/simkit.py` (matrix, explain, near, act-emotion, music-emotion, reward, interrupt,
  art-map, add-emotion, add-object, add-act, add-chain). Older single-purpose tools: categorize.py, chains.py,
  master_map.py (HTML map).
- Gates: `node tests/sim.mjs` (from site/), `node tests/physics.mjs --only=P1,P4,P6`,
  `node tools/sim/montecarlo.mjs` PASS, then `node tools/sim/make_life.mjs` and `npm run build`.
  Instability layer stays off by default. Deploy only with the owner's OK.
- Art: `tools/art` maps 338 Infinite nodes / 2253 params to 13 axes; `param_semantics.json` weights axes over
  V A ST E D; `executor.py` writes an .inf patch run headless by Infinite's CLI (read-only use of
  `~/Infinite/repo`, never start agents there).
- 2026-10-18 review found and fixed: snapshot key collision (planner memo lost), cooldowns and current act
  not restored (3/40 seeds diverged), cancel counter ×60 inflated, interrupted acts over-drained, Lövheim
  cube mis-mapped with rest reading as joy, every hazard breaking every chain, tea / fridge opening phantom
  chains (≈60 % of all "breaks"), 15 ledger events never written, music suits hand-set for only 8 emotions.
- Round 2 (same day): per-act hard caps replaced by habituation (utility falls with repeats in the last few
  hours) plus a night clock prior and a "due" multiplier for hygiene; zero-sleep days 1 → 0. Props added as
  stations (phone, plant, easel): every sim act needs a spot + pose + prop, or it stays "planned" and is
  silently mapped to another act — audit SPOT_OF for acts with no real spot.
