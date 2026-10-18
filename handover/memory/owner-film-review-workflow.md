---
name: owner-film-review-workflow
description: "How the owner reviews animation work: per-part sheets, before/after A/B stills, refs saved to disk"
metadata:
  node_type: memory
  type: feedback
  originSessionId: dc4ac3c9-cac1-4a05-8804-0efacb1bfaad
  modified: 2026-10-04T06:03:31.683Z
---

The owner reviews animation design through **sheets and A/B stills**, never full renders first:
- Wants one sheet per part (each body part; each room prop) and a whole-scene master sheet like their own model sheets.
- A style change ships as a **switch** (e.g. `core.STYLE`) and is shown as A (now) vs B (new) on the same cameras; they pick.
- Design proposals are shown as before/after and they keep or reject each one; keep a rollback copy in the project, not in the scratchpad (the scratchpad is wiped between sessions).
- Images they paste in chat are not on disk: save every reference image into the project's `assets/refs/<topic>/` the same turn.

**Why:** they iterated 3 rounds on the music video this way (2026-10-04), and the round-3 rollback files and refs almost got lost in the session scratchpad.
**How to apply:** for any film or animation work for this owner, gate on stills, one change per round, and reply in tables. Related: [[ek-pinjare-mai-video]].

Directing rules the owner gave (2026-10-04, r7): protect the scene the way real animators do (cheat with the camera or a cut instead of showing a broken angle), and use recurring snake's-eye POV cuts for attention and story depth.
