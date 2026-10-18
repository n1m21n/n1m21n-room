---
name: n1m21n-sim-design
description: "Owner's design for the n1m21n character sim (drive>motive>desire>chain>emotion loop, ledger, erratic/normal, spatial awareness); spec in n1m21n-room/SIM_DESIGN.md"
metadata:
  node_type: memory
  type: project
  originSessionId: 4c529143-9e18-4257-bb50-f4ec2e37e663
  modified: 2026-10-17T09:27:14.942Z
---

Spec written 2026-10-17 in `n1m21n-room/SIM_DESIGN.md` (not yet implemented beyond utility.js/posture.js basics).

Owner's pipeline: foundational drive -> motive -> desire -> chain of actions -> emotion (reward) -> repeat. Points matter mostly for motive and reward; a ledger adds/deducts points. Actions tagged normal vs erratic (erratic weighs more) and trivial vs non-trivial; chains of activities (e.g. wash, brush, loo, sleep) are normal. Emotions have memory that fades in real time. He must be spatially aware (open vs crowded) because later he will build things from materials, Minecraft-style. Wants a script tool that adds emotions to the character design automatically (emotions.json -> faces, matrix, music).

**Why:** owner wants every small human detail (walk speed, song, sleep length, skipping meals) driven by one structured system.
**How to apply:** read SIM_DESIGN.md first; build in its slice order; keep behaviour formulas data-driven. See [[ek-pinjare-mai-video]] for the face art pipeline (man2d.py, export_face.py).

2026-10-17 owner decisions: fast time-lapse; generative face/body coordinate tool; normal+abnormal chains; bad mood can cancel plan; mood persists across visits; grid space; neurochemical layer (SIM_DESIGN s14). Owner insists every stage is unstable/probabilistic, not deterministic (outcomes are distributions, ledger leaks across motives, regimes, self-model surprise) -> SIM_DESIGN s15. Research map in SIM_RESEARCH.md.

2026-10-17 BUILT (shadow mode): runtime in site/src/sim (core.js etc), data tools in tools/emotions, tests site/tests/sim.mjs, Monte Carlo tools/sim/montecarlo.mjs. Owner asked: what happens when away (catchUp journal), logs (core.journal/days), 1000s of sims pre-launch (montecarlo). Next: render 13 faces, `?sim=core` opt-in influence, tune loo/chains, enable instability one stage at a time. See SIM_DESIGN s16.

2026-10-17 owner vision (next phase, after emotion>motive>chain mapping is solid): give the character access to owner's "infinite" headless engine (Field language, Sketch 2D, 3D nodes, GLSL shaders) so he MAKES ART as a step in the flow emotion > motive > chain of actions. Every engine variable/node/modulation maps to an emotion/motive; every engine action (add node, modulate, split across chain, merge back, which node) is itself an emotion/motive-driven act; creative result earns a ledger reward; separate gallery/hall for his art. Engine already has node-chain generator tools/scripts. Also: run high-volume (1000s+) Monte Carlo parameter sweeps over factor categories to pick best tuning (loo overuse, chains never breaking found first). DECIDED: one shared character for all visitors (life.js); visitor nudges local only.

2026-10-17 sweep harness built+run (tools/sim, SIM_DESIGN s17): fitness 102->1.57 over 2 rounds, tuned values applied via sweep apply + gen.py (tune.gen.js). Remaining misses: chain_broken 0.45, chains_done 7, shower 2.2, fail_rate .105. Art catalog in tools/art; executor/gallery next (never start agents in Infinite repo without explicit owner yes).

2026-10-17 later: owner decided chain breaks always branch to next sequence (rules in SIM_DESIGN s18); social motive via visitor + phone/door/desk/easel objects; each MIDI file maps to its own reward; art quality = learned taste (brand guidelines .5, emotion .3, learned .2), only rare serene "satisfaction" chain = good; owner curates a feed into the gallery. Round-4 tuning applied. Open: art satisfied share too rare, chain break ratio ~.6 above band, art executor + gallery + sim-to-visuals (SIM_TO_VISUALS.md) next.

2026-10-17 end of session: live face/head/walk now follow the sim's emotion (posture.setSimEmotion, GAIT from Bandai-Namco); 14 Mutopia MIDIs added, guitar pool split; cooldown bug fixed. Another assistant (Antigravity) also edited sim files and wrote blueprints (reviewed in BLUEPRINT_REVIEW.md; several claims wrong). MMASH zip is truncated and not needed. START NEXT SESSION FROM n1m21n-room/NEXT_SESSION.md (known problems + phased plan to release). Top open: brush/dress overuse, time split 57 pts off, chain breaks .55, stress low.

Status 2026-10-17: Phases 1-3 done (tuned, body, live flag `?sim=1|life`, default OFF), Phase 4 art executor built (`tools/art/executor.py`, `make_pieces.py`, desk monitor shows pieces in art acts). Remaining: closed-loop self-judging, owner curation feed, labelled MIDI, Phase 5 release (owner OK needed to deploy). Handoff: n1m21n-room/NEXT_SESSION.md "STATUS UPDATE". Regenerate `life.json` after any tuning; run gen.py with `PYTHONPATH=tools/emotions`, not `-I`.

2026-10-18 review (owner asked to vet + refine): 11 fixes, see n1m21n-room/SIM_REVIEW.md. Hazards now hard/soft/none interrupts with resume odds; phantom chains (tea/fridge openers) are "dropped" not broken; done:broken 1.2 -> 2.3; resume = replay 40/40. New CLI tools/emotions/simkit.py (master matrix etc.) and general skill ~/.claude/skills/character-sim. Not deployed yet (owner OK needed). Next: habituation over hard caps, night clock prior, 11 dead ledger events.

2026-10-18 round 2: habituation over hard caps + night prior; props.js (phone, plant/watering can, easel where art is painted in stages); every planned act live except build/gather (need grid). All gates pass, life.json regenerated. NOT deployed (nudge.js whitelist changed; owner OK needed).

2026-10-18 round 3: owner wants chains generated, not listed (permutations, interruption, branching). Built a GOAP-style goal planner over fluents (world_model.json -> world.js, TUNE.goalPlan); named chains are now only motifs. Gaps listed in SIM_REVIEW.md Round 3 (work/boredom, one-step goals, no day intentions, no other agents, no ATUS re-check). Not deployed.
