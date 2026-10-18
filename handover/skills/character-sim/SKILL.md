---
name: character-sim
description: "Build, review and tune a believable simulated character (a 'little life' or sim) whose day emerges from needs, emotions and habits: motives that decay, utility-based action choice, action chains (routines) with interruption and resumption, outcomes and prediction error, a reward ledger, neurochemistry and an emotion model (prototypes in valence / arousal / stress / energy / dominance space with hysteresis), music and art mapped to emotion, and a master matrix that puts every entity in one shared space. Covers adding an emotion, prop / object, action or chain; mapping actions or music to emotions; the reward system; interruptions; generative-art mapping (node params to emotion axes); and validating with determinism checks and Monte Carlo. Use when asked to \"make the character more human\", \"review / vet the sim\", \"add an emotion / action / object / chain\", \"map music or actions to emotions\", \"why does he keep doing X\", \"explain the reward system\", \"what is the master matrix\", or when a sim feels robotic, repetitive, jittery or drifts."
---

# character-sim: believable needs-driven characters

General craft for any agent-based character (game NPC, web toy, film background extra, installation).
Project specifics live in `references/case-studies.md`; the loop and the maths in `references/model.md`;
the review checklist in `references/review-checklist.md`.

## The loop (one shared shape)

drive → motive (decaying meters) → desire (utility + noise + emotion pull + clock window) → chain (routine)
→ act → outcome (ok / partial / fail / side / surprise, with prediction error) → ledger (reward events with
decaying traces) → chemistry (DA HT NE CORT OXY SLP) → emotion (nearest prototype with hysteresis) → back
into desire. Every new feature must enter this loop somewhere; a feature that bypasses it (a hard-coded
cap, a special-case `if`) is a patch, write it down as debt.

## Core rules

1. **Data in files, logic in one engine.** Emotions, acts, chains, rewards, hazards, objects are JSON
   tables; a generator validates and bakes them. Tunables live in one tune file. Never hand-edit baked output.
2. **Seeded and resumable.** One RNG with saved state. snapshot → restore → advance must equal advancing
   straight through; test it across many seeds (compare only events after the snapshot, journals get
   trimmed). Everything a decision reads (cooldown stamps, current act, memo caches, de-dupe keys) belongs in
   the snapshot.
3. **Humans are mostly routine, sometimes not.** Target ~85-90 % habitual acts; erratic acts are rare and
   state-driven (hazards as Poisson rates that rise with stress / fatigue), not dice on a timer.
4. **Interruptions are of two kinds.** Hard (startle, collapse, bladder emergency) break the routine; soft
   (phone, knock, stumble) suspend it and he resumes with odds that fall with time away
   (goal-activation decay, e.g. exp(-away/45 min)). An interrupted act pays only the progress made, drains
   only the minutes lived, and costs a small frustration event.
5. **A routine he never started is not a failure.** Optional openers (tea before work, opening the fridge)
   must not count as broken goals when he drifts off; drop them silently. Mid-repetition jumps (one stint of
   two, then the window) are micro-breaks, tolerate once.
6. **Rest is not joy.** Any lookup from chemistry to affect (e.g. the Lövheim cube) needs a dead zone around
   baseline, or the resting state reads as an emotion.
7. **Emotion is sticky.** Prototypes plus margin and hold time (hysteresis); add an emotion only if it is
   further than ~1.5 × margin from its neighbours, or the face flickers.
8. **Rewards must be wired.** Every ledger event should be written by code or named in data; audit for
   dead events (`simkit reward` style). Counters must count events, not candidates.
9. **Music and art map through the same space.** A piece has a target position (V/A/E); suitability for an
   emotion = closeness (or a deliberate mood-repair rule, stated as such). Generative-art params get an axis,
   axes get weights over emotion coords; the emotion moves the knobs.
10. **Validate with numbers, not vibes.** After every model change: unit tests, the resume-vs-replay probe,
    Monte Carlo (mood mean / spread, stress, acts per day, sleep, chains done : broken : dropped, fail rate,
    top-act shares, between-seed spread). Compare before / after in the review notes.

## The master matrix

Every entity is one row in the same columns: affect V A ST E D, the motives, the neurochemicals. Emotion
prototypes and music targets are **positions**; acts, rewards, chains, objects, hazards and art params are
**offsets** (which way they push from neutral). Nearest emotion = distance for positions, cosine to
(prototype − neutral) for offsets. Uses: map actions / music / art to emotions, find gaps (emotions nothing
leads to), catch contradictions (a "calm" act that pushes stress up), drive art and score from one table.

## Workflows

- **Add an emotion**: prototype + margin + hold + a fallback bank (music / face) → regenerate → check
  neighbours → wire where it can arise (emotion pulls, chain triggers, chemistry map) → Monte Carlo to see it
  occur and not flicker.
- **Add an act**: motive rewards / drains, minutes, cooldown, category, normal or erratic, feel offset,
  station / object → maybe a chain step → regenerate → Monte Carlo share.
- **Add an object / prop**: acts it affords + motives + placement; it is only real when a station exists.
- **Add a chain**: steps (optional, counts), window, trigger, reward event, branches on break (with a
  resume branch for interruptions) and next chains.
- **Review**: run `references/review-checklist.md`, fix, re-measure, write the review doc.

## Related skills

`../sim-3d/SKILL.md` (physics FX, not behaviour) · `../character-animation/SKILL.md` (acting the
emotion on the body) · `../music-sound/SKILL.md` (scores) · `../film-studio/SKILL.md` (if the character
is in a film).
