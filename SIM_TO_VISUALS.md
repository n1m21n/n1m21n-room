# Sim to visuals: how the character's inner life reaches the screen

Status 2026-10-17: the sim core runs in shadow (observes `routine.doing`). This file is the plan to let it drive what you see. Nothing here is built yet except the shared life (`life.js`).

## Today
`routine.js` picks what he does from the IST clock. `utility.motives` + `posture.state` drive tempo and face. `simCore` only watches (`onActStart(routine.doing)`, `tick(dt, utility.motives)`).

## Target
One canonical life = f(seed 2026, real clock). The page *plays* that life in the time-lapse (1 story minute = 1 second), and a small local layer reacts to the visitor.

| Layer | Source | Drives | Notes |
|---|---|---|---|
| Act | `life.at(now)` current act + chain | `routine.doing`, station walk-to, `acts.js` start | new acts need routine entries (below) |
| Emotion | core `emotion.current` | `posture.state`, face texture (`man.face`) | 13 new faces still to render (`tools/export_face.py`) |
| Affect | core `affect` (V/A/ST/E/D) | tempo, breath, spine, music volume/choice | already exposed by `composeAffect` |
| Motives | core `motives` | `utility.motives` (so existing HUD/utility stay valid) | one-way copy |
| Music | `music` log entries (piece, act) | keys/guitar play the chosen real .mid | `pickPiece` result is in the journal |
| Art | `art` log entries + feed | easel, gallery hall, feed page | executor turns the vector into an Infinite patch |
| Visitor | local only | `core.visitor()` forces `greet_visitor` on the local shadow | never written to the canonical life |

## Steps (each independently shippable, flag `?sim=core` until step 5)
1. **Mirror**: copy core emotion + motives into posture/utility each frame; routine still decides acts. Compare in dev (`window.sim`).
2. **Act drive**: `routine.doing` follows `life.at(now).doing`; unknown acts fall back to nearest station. Add routine entries for `phone_call answer_phone greet_visitor write_letter art_*` (positions come from `tools/emotions/objects.json`).
3. **Faces**: render the 13 missing emotion faces; `FACE_MAP` already falls back to the nearest rendered one, so this is cosmetic.
4. **Objects**: phone, door-knock, desk, easel as 3D props (objects.json status todo). Visitor arrival = knock + door.
5. **Default on**: remove the flag, keep `?sim=off` as the escape hatch.
6. **Art hall**: gallery room + feed page (owner curates which pieces enter the hall).

## Risks
- Time-lapse speed means acts last seconds; short acts (yawn, glance) must not thrash animations: enforce a minimum visible duration in routine.
- Shared life and local layer must never mix: the local shadow core is a different instance, seeded from the canonical state, and discarded on reload.
- Every new act without a station entry must be skipped, not crash (guard in `routine.start`).
