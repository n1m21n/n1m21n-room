---
name: ek-pinjare-mai-video
description: "Owner's animated music video for \"ek pinjare mai\" (album अंधेरा): design signed off, production starts from START_HERE.md"
metadata:
  node_type: memory
  type: project
  originSessionId: dc4ac3c9-cac1-4a05-8804-0efacb1bfaad
  modified: 2026-10-04T06:03:26.531Z
---

Animated music video for the owner's track "ek pinjare mai" (album अंधेरा, house techno, airy vocals).
Folder: `~/music videos/ek-pinjare-mai`. **Start every session by reading `START_HERE.md`** (kickoff prompt, file map, signed-off decisions, production steps, open issues), then `BRIEF.md` (§0 story, §4 acts, §7 preferences, §8 review rounds). Python: `~/infinite-launch-video/.venv/bin/python`.

- Measured tempo **153.0 BPM** (owner said ~145), first downbeat 0.080 s; sections on bars 1/25/41/57/75/83/99.
- Story (final, 2026-10-04): no cage; the man sits on a red stool; the film is the snake's POV; the snake chokes him (his skin flushes magenta); it enters his spiral mouth into a dreamland of nested realities (portal inside portal) and comes out; the reveal is that the room sits inside another spiral (the loop is the cage); the film loops.
- Design signed off 2026-10-04 ("not bad, we are ready"): characters (owner sheets + 7 round-3 changes), the 3D room (`lib/room.py`, sheets r00-r07) and the **sketch ink style** (`core.STYLE[0]="sketch"`, `lib/sketch.py`). Nose `none` / ears `hidden` are defaults the owner never picked.
- All owner reference images are saved in `assets/refs/` (cover, owner_sheets, style_sketch_r3, dreamland, style_flat_r0); recovered from the chat transcript.
- 2026-10-04: step 1 sent to owner: track map (BRIEF §4a: kick continues through bars 57-74; kick drops at 23-24 and 96; silent after ~b100.5), shot list r1 (§4b), storyboard `out/board/board_r1_{a,b}.png` from `tools/storyboard.py`. Owner said go and delegated decisions (r4): I decide, self-QC every frame sheet (composition, man/snake relative scale, pillars), re-check after fixes. Snake scale locked SNAKE_K=0.65. Steps 2-3 done (world on the new room, film.py shot table, act I QC'd; `tools/qc_shots.py` makes the per-shot QC sheets). Owner liked act I (r5) and asked for all remaining acts to be built meanwhile; I-1 now has the snake in moonlight with the fixed red eyes following it (frame 0 stays eyes-only, so VII-2 must end on it). Full film r1 sent 2026-10-04 (`out/film_r1_1080p.mp4`); owner r6 notes (BRIEF §8 row 6): fix choke head/body cut, struggle then give up, man tracks snake in II, dream faster with snake crossing frame + 3 new worlds + lands in the real room, fast zoom-out no snake, quick spiral cuts, no exit from mouth, Droste ring = the snake spiral. Round 7 (2026-10-04) built all r6 notes + owner r7 directing rules (choke hygiene, camera cheats, 12 inserts incl. snake's-eye POV); full film r2 `out/film_r2_1080p.mp4`. Round 8: dream worlds share one psychedelic palette/ring sky/portal rim (BRIEF §7 row); owner dropped the trailer; final master delivered 2026-10-04: `out/ek_pinjare_mai_final_1440p.mp4`. Lessons saved in the `film-studio` skill (case-studies.md; animated-film retired 2026-10-05).

- 2026-10-05: film remade in 2D (r10-r11: `film2d.py` director + `render2d.py`, see NEXT_SESSION.md). Owner closed the revamp after r11g; readiness check passed; 1440p master (`render2d.py film 1 104 --w 2560 --jobs 3`) waits for the owner's go. The old r8 1440p master is superseded.

**Why:** a personal music video, not an Infinite brand film; the Infinite brand rules (logo, coral) don't apply, but the owner's reply rules do: tables, no Artifacts, no attribution.
**How to apply:** follow the gates in START_HERE.md §3; record owner notes in BRIEF §8 the same turn. See [[owner-film-review-workflow]].
