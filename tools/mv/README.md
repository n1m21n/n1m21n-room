# Music video staging (Bring Me Some Change)
Stills from the real room for the video plan. Brief and sheets live in the project folder `bring-me-some-change/`.
1. `CHROME=<chrome> node tools/mv/stage.mjs [I-1,IV-5]`  renders `build-cache/review/stills/mv-<scene>.png` + screen anchors `.json` (shots in `shots.mjs`)
2. `python3 tools/mv/grade.py`  lighting grade (cues in `lights.py`) -> `mvL-*.png`, beat-flash frames `mvF-*.png`
3. `python3 tools/mv/sheet.py <outdir>`  contact sheets (scene table in `scenes.py`)
The cloud sandbox needs a stub `site/public/data/art.json` (`{"halls":[]}`) and Chromium at /opt/pw-browsers.
