# The model, in maths

- **Motive** m ∈ [0,1] decays: m ← m − decay·dt (slower asleep). An act adds reward·progress and drains
  drain·minutes.
- **Utility** of act a: Σ_m w_m(a) · urgency(m) + emotionPull(a, current emotion) + clock-window bonus −
  cooldown / repetition penalty + noise (softmax with temperature). Plans (intent lists) multiply weights.
- **Hazard** rate per minute λ = h0 + kStress·stress + kFatigue·fatigue (+ state terms); fire with
  P = 1 − exp(−λ·dt). Each hazard declares interrupt: hard | soft | none.
- **Resume after a soft interruption**: P(resume) = exp(−away / τ), τ ≈ 45 story minutes (goal-activation
  decay, Altmann & Trafton 2002). On resume the routine's gap clock restarts.
- **Outcome**: kind ∈ {ok, partial, fail, side, surprise}; prediction error = outcome − self-model
  expectation; the self-model learns slowly; surprise scales the ledger write.
- **Ledger**: events add deltas to traces (valence, stress, frustration, pride, comfort, loneliness, boredom,
  curiosity, fatigue debt), each decaying with its own τ; erratic events weigh more (kindWeight).
- **Chemistry**: six levels relax to baseline; ledger and acts push them. Lövheim cube read with a dead zone.
- **Affect**: V A ST E D = linear mix of traces + chemistry + act feel. **Emotion** = nearest prototype; it
  switches only when the new one wins by more than its margin and the old one has been held long enough.
- **Music**: piece target (V A E) from features (mode, tempo, density, velocity); suits(emotion) =
  1 − ‖target − prototype‖ / 0.9 unless hand-set.
- **Art**: taste axes = guideline·w_g + emotion-shift·w_e + learned·w_l; emotion-shift via per-axis
  weights over V A ST E D; params inherit their node's axis.
- **Master matrix**: rows = entities, columns = affect + motives + chemistry; positions vs offsets as in
  SKILL.md.

## Generated chains: goal planning over fluents

Do not hand-list chains; they explode combinatorially. Instead give acts a small world model:
- fluents f (0/1, counts like portions, ttl = minutes true, halfLife for levels such as caffeine);
- per act: guard (must already hold), pre (hard; planner inserts providers), pre_any + pay_any (alternatives
  that pay differently), soft (kept with p = clamp(b + e·energy − s·stress + h·habit)), eff, fail.

Chosen act = goal. plan(goal): for each unmet condition pick a provider with weight
appeal(p) · follow(prev, p) · (1 + habitW · habit(prev, p)) · pay², recurse to maxDepth.
Interruption suspends; resume p = exp(−away/τ) · decay^resumes; on resume **replan from the current state**
(that one rule gives resuming, branching after failure and adapting to a changed world). Damp acts that undo a
remaining step's precondition. Learn pair habits from finished episodes (fade over a week) so each run grows
its own routine. World facts can pull acts directly (need multipliers) and levels can push back (caffeine
lowers tea appeal). Case study: n1m21n round 3 (tea 4.3 -> 2.7/day, 632 distinct planned sequences in 60 seeds).
