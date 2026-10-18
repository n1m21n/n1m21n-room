---
name: add-room-character
description: Add another character to the n1m21n room (a person who lives in the room beside him): look, emotional tuning, body rhythm, voice, and the toggle. Use when asked to introduce, tune or change a character.
---

# Add a character to the room

Everything a character needs lives in four small files. Nothing in `cast.js`, `main.js` or the UI changes: the cast picks up a new spec file by itself and a button for them appears in the top bar.

## Do this

1. **Scaffold**: `node tools/cast/new_character.mjs <id> --name=<name> --skin=#.. --top=#.. --pants=#.. --hair=#..` (id: lowercase letters, digits, `_`). Writes, and never overwrites:
   - `tools/emotions/characters/<id>.json`: seed, emotional baselines (`neuro`), decay and mood shifts (`tune`), act set (`actOff` / `actMul` / `emotionPull`), and `motion`.
   - `site/src/cast/characters/<id>.js`: the spec (see `her.js`, a fully worked one).
   - `site/src/cast/looks/<id>.js`: a starter look (his puppet in their colours).
   - `site/src/cast/lines/<id>.js`: starter thought lines (a copy of the shape, to be rewritten).
2. **Make them themselves** (this is the work; the scaffold only gives a body):
   - **Emotional tuning** (`characters/<id>.json`): move `neuro.*.base` (DA, HT, NE, CORT, OXY...), `tune.moodShift / stressShift / arousalShift`, `decay.*` (how fast each need drains), `actOff` (acts they never do), `actMul` (how much they like each act), `emotionPull` (which feelings an act brings). Keep names real: `gen.py` rejects unknown acts, neuromodulators and emotions. His own life must stay bit-identical (`tests/sim.mjs` and the md5 of `site/public/sim/life.json`).
   - **Body rhythm** (`motion`, 1 = as he moves): `walk` (speed), `cadence` (step rate), `swing` (arm swing), `sway` (hip and shoulder sway, also idle sway), `bounce`, `lean` / `shoulders` / `headTilt` (radian offsets), `breath`, `expressive` (how far feelings show in the body: slump, chest, posture), `glance` (1 = as often as him, 2 = half as often), `blink`, `tempo` (act clock), `face.valence / face.arousal` (a nudge to which expression shows). Her values are in `her.json`.
   - **Expressions**: the same 27 emotions and face textures exist for everyone; a look module may redraw them (her.js `herFaceTex` recolours his webp and draws her mouth, nose and glasses). Per-character feel comes from `motion.face` plus their sim baselines.
   - **Voice**: rewrite `lines/<id>.js` with the same exports as `src/thought-lines.js` (NEED_LINES, NEED_FIX, EMOTION_LINES, NEXT_LINES, DAY_THOUGHTS, ACT_LINES, TIME_LINES, hourBucket, SCROLL_LINES, SELF_LINES). Write original lines in their manner. Only use a real person's messages with their agreement, build an aggregate style profile rather than quoting them, and never put names or private details in the repo.
   - **Look** (`looks/<id>.js`): `loadMan({ look, faceTex, prep, dress })` (`man.js`). `her.js` is the reference for hair on the head bone, glasses, bracelet, clothes (tank top; the jacket shell cloned from the tee).
   - **Spec fields** (`characters/<id>.js`): `likes` (acts they have no spot for -> nearest thing), `away` (acts they step out of the room for, because the props are his), `standIn` (what they do when someone holds their seat), `spawn`, `bubble` (pace and tint), `props` (an own prop, see `cast/props/her.js`), `intro` (shown on their card), `life.offsetMs` (their beats run a little off everyone else's).
3. **Bake and build**:
   ```
   PYTHONPATH=tools/emotions python3 -s tools/emotions/gen.py     # not -I
   node tools/sim/make_life.mjs --char=<id> --blocks=13           # site/public/sim/life.<id>.json
   cd site && npm run build && node tests/cast.mjs && node tests/sim.mjs && node tests/beats.mjs
   ```
4. **Look at them** before saying done: stills of the look (front, three-quarter, back, head), a walk, an act, and the card. The page hooks: `window.dev.cast` (spawn / focus / control), `window.dev.<id>` (their companion: `.player`, `.routine`, `.greet('him')`, `.core`). `?cast=<id>` brings them in on load. Stills tooling is in `tests/lib/harness.mjs`.

## How the cast behaves (so a new character gets it for free)

- **Bodies**: nobody walks through anyone (`awareness.js` circles; someone lying down takes more room; the lead gives way less so the companion steps aside).
- **Manners by activity** (`manners()`): `private` (sleep, shower, loo, brush, wash, dress) is left alone ("busy"); `absorbed` (work, keys, easel, cooking, reading, tv) is only nodded at from further off; `free` gets a walk-over and a wave and turns round to answer. Edit the sets in `awareness.js` when a new act needs a class.
- **Seats**: the lead (him, the shared life everyone sees) has first call; a character in the seat he is heading for stands up and does something else for five minutes. A seat someone else holds is never taken.
- **Gaze**: other people are places of interest for the glance system, so characters look at each other when close.
- **Control**: a visitor can follow anyone with the camera and take control of anyone (keys, stick, tap the floor). Everyone else carries on with their own day. His routine ignores the visitor's input while someone else is controlled.
- **Their life**: their own sim (same algorithm, their own tuning) on the same India clock, one shared life per character for every visitor.

## Rules

- Off by default and visitor-local (`localStorage n1m21n.cast`, `?cast=a,b`).
- Never deploy without the owner's explicit OK; commits are authored as `n1m21n` with no attribution lines.
- His `life.json` is never changed by adding a character; check its md5 before and after.
- `*.gen.js` are generated: edit the json and run `gen.py`.
