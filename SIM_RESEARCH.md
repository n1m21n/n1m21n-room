# Research map: theory -> design element

Status: [V] = confirmed by web search this session, [M] = from memory, check before citing in print.

| Theory / paper | Idea | Where it lands in the sim |
|---|---|---|
| Keramati & Gutkin 2014, eLife 3:e04811 [V] | Reward = reduction of distance between internal state and setpoint (homeostatic RL) | Motive urgency (1-m)^2; reward = drive reduction; section 2, 5 |
| Berridge & Robinson (2016 review) [V] | Wanting (dopamine, incentive salience) is separable from liking (hedonic) | Two numbers per action: desire (pre) and pleasure (post); DA variable |
| Schurger, Sitt & Dehaene 2012, PNAS 109(42) [V] | Spontaneous action timing = noisy leaky accumulator crossing a threshold, not a hidden decision | Seeded noise in the decision accumulator; "free will" feel without a coin flip |
| Libet 1983; Soon et al. 2008 [M] | Neural precursors precede conscious intent | Justifies determinism with noise: choice = utility + accumulator noise |
| Gebhard 2005, ALMA, AAMAS [V] | Three time scales: emotion (short), mood (medium), personality (long); OCC appraisal + Big Five | Ledger traces (tau minutes), mood (hours), drives/personality (fixed) |
| Ortony, Clore, Collins 1988 (OCC) [M] | Emotions from appraising events, actions, objects | Event tags in the ledger -> emotion labels |
| Russell 1980 circumplex; Mehrabian PAD [M] | Valence/arousal(/dominance) space | Derived read-outs for face and posture |
| Lovheim 2012 cube of emotion [M] | Serotonin, dopamine, noradrenaline levels span 8 basic emotions | Section 14 neuromodulator layer |
| Doya 2002, metalearning and neuromodulation [M] | DA ~ reward error, 5HT ~ time horizon, NE ~ exploration noise, ACh ~ learning rate | NE scales accumulator noise; 5HT scales patience/discount |
| Panksepp, affective neuroscience [M] | Primary systems: SEEKING, RAGE, FEAR, LUST, CARE, PANIC, PLAY | Foundational drives (section 1) |
| Damasio, somatic markers [M] | Body state biases decisions | Posture/fatigue feed back into score |
| Barrett 2017, constructed emotion [M] | Emotions are categories built from interoception + context | Emotions derived from variables, not stored as states |
| Sterling, allostasis [M] | Setpoints move with predicted demand | Baselines shift with day plan and mood |
| Yerkes-Dodson; Csikszentmihalyi flow [M] | Performance peaks at mid arousal; skill-challenge match | Work duration/quality peaks mid-NE; flow bonus |
| Dennett compatibilism; Sapolsky [M] | Deterministic yet self-caused agent | Design stance: deterministic given seed + state, persisted |
| FACS (Ekman); Laban Effort; emotional gait (Montepare, Roether) [M] | Face action units, movement qualities, gait cues | emotions.json coordinate sets, walk speed/slump |
| O'Keefe, Moser (place/grid cells); Tolman; Moravec/Elfes occupancy grids; Gibson affordances; Hall proxemics [M] | Cognitive maps, occupancy, affordances, space comfort | Section 10 grid, smart objects |
| Ebbinghaus; ACT-R base-level activation [M] | Exponential/power-law forgetting | Memory traces with tau |

Honest limit: free will is not modelled, only its observable signature (noisy, state-dependent, self-initiated timing). Neurochemical mapping is simplified.
