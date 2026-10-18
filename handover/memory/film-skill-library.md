---
name: film-skill-library
description: owner wants film/animation skills general-purpose and project-adaptable; 21-skill library rebuilt 2026-10-05 with film-studio as hub
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6bcb7631-7c56-4b98-8dd8-59516524e79b
  modified: 2026-10-05T13:41:27.325Z
---

The film skills in ~/.claude/skills were rebuilt on 2026-10-05 as a library of 21 skills plus a stub, with `film-studio` as the hub. The old skills are backed up in ~/.claude/skills-backup-2026-10-05/.

- General skills: film-direction, camera-language, design-style, colour-and-light, character-design, environment-design, character-animation, scene-animation, motion-animation, motion-typography, motion-sfx, compositing.
- Engines: anim-2d, anim-25d, anim-3d.
- 3D craft: model-3d, sim-3d.
- Project adapters: motion-film, node-tutorial-film, re-web-motion.
- `animated-film` is now a stub that points to film-studio.

**Why:** the owner wants every skill to be general purpose and repeatable, adapting to each project. Project-specific taste (Infinite brand, ek-pinjare-mai choices) must not be baked into general rules.

**How to apply:**
- Put new lessons into the general skill as a generic rule.
- Put project specifics into that skill's case-studies section or into the project's adapter or BRIEF §7.
- The owner asks for completeness by topic (for example "all parts of 3D", "all of colouring"). Check coverage against their list and fill the gaps.

Hygiene conventions (applied 2026-10-05, after Anthropic's skill best-practices; backup in ~/.claude/skills-backup-hygiene-2026-10-05/):
- Write `description` as a JSON double-quoted string. Unquoted text that contains ": " breaks the YAML, and the skill then loads with no description.
- Keep each description under 1024 characters: what the skill does, then "Use when ...". The "Pairs with" list goes in a `## Related skills` section of the body.
- Cross-skill links use explicit relative paths, e.g. `../anim-3d/references/setup.md`.
- Any reference file over 100 lines starts with a `## Contents` list.

Related: [[ek-pinjare-mai-video]], [[owner-film-review-workflow]].
