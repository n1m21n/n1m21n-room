# Character-sim review checklist

Run in order; each item is a probe you can script.

1. **Determinism**: same seed twice → identical journal. Snapshot at an odd minute, restore into a fresh
   instance, advance both N days → identical events after the snapshot point (40 seeds). Diff the full
   snapshot minute by minute to find the first divergent field. Typical culprits: key collisions in the
   snapshot object, cooldown timestamps, "current act" reset on restore, memo caches, signed vs unsigned RNG
   state (cosmetic).
2. **Counters**: every per-day counter increments once per event (not once per candidate scored).
3. **Interrupted acts**: refund the unlived drain, pay rewards pro rata, book only lived minutes.
4. **Interruption policy**: list every hazard with hard / soft / none; check resume odds and that soft ones
   do not break routines.
5. **Chain health**: tally break reasons (skipped / timeout / interrupt) by chain and by the three acts
   before the break. Phantom chains opened by optional steps are the usual top offender.
6. **Reward wiring**: every ledger event is written somewhere; none is double-counted.
7. **Chemistry → affect map**: check the table against the source (e.g. Lövheim: axes are 5-HT, DA, NA;
   000 shame, 001 distress, 010 fear, 011 anger, 100 contempt, 101 surprise, 110 joy, 111 interest) and that
   baseline maps to nothing.
8. **Music / art mapping**: suits tables cover all emotions or fall back to congruence; no surprising
   values without a stated reason.
9. **Patches**: list hard caps and special cases; plan to fold them into satiation / habituation.
10. **Human-likeness**: watch a live day; odd-hour acts, repetition, emotional whiplash, and acts that
    contradict the shown emotion.
11. **Monte Carlo** before and after; record the table in the review doc.
