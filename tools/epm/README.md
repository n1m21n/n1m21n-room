# Ek Pinjare Mai in the room (staging)
`CHROME=<chrome> node tools/epm/stage.mjs [I-1,III-2]` renders `build-cache/review/stills/epm-<scene>.png` (shots in `shots.mjs`), `python3 tools/epm/sheet.py <outdir>` builds the act sheets, contact sheet and colour script (`scenes.py`). Brief: `BRIEF.md`. Needs a stub `site/public/data/art.json`. Builds on `tools/mv/`.
