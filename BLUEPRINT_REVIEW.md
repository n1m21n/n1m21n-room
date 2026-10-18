# Review of the Antigravity blueprints (2026-10-17)

Checked against the code. Build, sim tests (47) and physics (94, 0 fail) pass after the changes below.

## Claims that were wrong
- **RPE missing**: it exists. `sim/outcome.js` keeps expected outcome per category and sends surprise to DA/NE/CORT using `stability.selfModel`.
- **`@resume` restarts at step 0**: it spreads the live state (`...st`), so position and counts are kept.
- **22 emotions / 22 faces**: there are 27 emotions and 27 face textures (all rendered).
- **7 MIDI files**: `site/public/media/midi/` holds 6.
- **Dataset cites**: CoreGRID/GEW, CIRCORT, Rutledge, BEAT, DadaGP, Hooktheory were not checked or downloaded. GoEmotions has no transition matrix, only co-occurrence of labels.

## Claims that hold
- Live character used a legacy 8-face ladder and ignored the sim core (shadow mode). **Fixed (partly)**: `posture.setSimEmotion` now drives the face texture from the core's emotion (all 27) and tilts head, spine and neck from the emotion's rig coords.
- `pickBranch` ignored the target chain's clock window. **Fixed**: branches are filtered by `inWindow`.
- `grid.js` is never given the room solids; `nav.js` is baked once. Open.
- Rig channels (shoulder_lift, hand_curl, finger_tremor, foot_tap, knee_bend, stance_width, stride_len) are computed but only head/spine/neck use them now. Open.
- Hazard mid-act does not truncate the act or scale reward by progress. Open (needs care: affects tuning).
- Same `pickPiece` pool for keys and guitar. **Fixed**: guitar picks only Aguado pieces; keys exclude them. 14 Mutopia pieces (free licence, from `data/raw/midi/mutopia`) added to `site/public/media/midi/` (now 20), re-profiled. Not EMOPIA/POP909: those are transcribed pop songs, so I kept them out of the public site.

## New data in data/raw (not yet used)
| Set | Size | Use |
|---|---|---|
| emotion/case | 7.2G | CASE continuous valence/arousal + physiology: recovery half-lives |
| emotion/emotion_timeseries, emobank, isear | ~14M | EMA mood dynamics, contextual VAD |
| midi/pop909, vgmidi | 107M | more labelled MIDI; promote best per emotion |
| motion/bandai_namco | 1.0G | **used**: Motiondataset-2 walks fitted per style (`tools/data/fit_gait.py` -> `gait_fit.json`); drives walk speed and head pitch by emotion. CC BY-NC. |
| neuro/mmash | 7M | **not usable**: `mmash-1.0.0.zip` is a truncated download (5.4 MB, no central directory) and the repo holds only code. Needs a fresh download (your OK). |
| spatial/humanise_prox, eth_ucy | 30M | approach and clearance behaviour |
| smarthome/casas, kasteren | 44M | home activity sequences (could improve chain transitions) |

Licences differ (CASE, Bandai-Namco, PROX are research-use); check before shipping any derived numbers in the public site.

## Suggested order
1. Rig channels to bones (shoulders, fingers, feet, gait) using Bandai-Namco angles for calibration.
2. (done) Mutopia promotion and guitar pool. Still thin for awe, nostalgia, triumph: no labelled piece per emotion.
3. MMASH + CASE: circadian cortisol and recovery time constants in `neuro.json`.
4. Truncate interrupted acts, scale reward by progress (then re-run Monte Carlo and the sweep).
5. Feed room solids to `grid.js`; emotion-weighted path cost.
6. Infinite executor (`tools/art/executor.py`) via its CLI only.
