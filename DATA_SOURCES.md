# Data sources for the sim (researched 2026-10-17; downloaded into data/raw/)

Principle: every number in `motive_matrix.json`, `follow.json`, `hazards.json`, `ledger_events.json` and the MIDI profiles should be fitted to real data, with the source recorded next to it. Guesses are placeholders only.

## A. What people do, in what order (feeds follow.json, time-of-day windows, chain motifs, durations)
| Source | What it is | Size / access |
|---|---|---|
| ATUS 2003-2024 (US BLS) | minute-level diaries; activity file has every episode in order (start, stop, activity code, place, who with) | atusact-0324.zip 77.1 MB, atussum 15 MB, atusresp 15.5 MB; public domain, direct download from bls.gov/tus |
| MTUS (Centre for Time Use Research) | 1.5-2M harmonised diary days, 25+ countries; episode files | free, registration needed (timeuse.org) |
| HETUS (Eurostat) | harmonised European diaries | via Eurostat / MTUS |
| UK Time Use Survey 2014-15 (CTUR) | UK diaries | timeuse.org, registration |
| CASAS (Aruba 220 days, Milan 72, Cairo 58) | one home, sensors + labelled activities, minute-resolution routines | WSU CASAS, free |
| Orange4Home | 4 weeks of one occupant, 20 labelled activities, planned sequences | Inria, free |
| ARAS, Kasteren | smart-home activity sequences | free |

## B. How activities feel and what they do to needs (feeds motive_matrix.json weights, emotion pulls, ledger deltas)
| Source | What it is |
|---|---|
| ATUS Well-Being Module (2010, 2012, 2013, 2021) | per-activity ratings 0-6 of happy, stressed, tired, sad, pain for 3 random episodes per respondent: a direct "activity -> affect" table |
| Kahneman et al. 2004 Day Reconstruction Method; Kahneman and Krueger 2006 | enjoyment ranking of activities (relaxing with friends high; commuting, time with boss low) |
| Experience-sampling archives: jmbh/EmotionTimeSeries (7 studies), Fisher 2017 (OSF, 40 people, 28 affect items), Mendeley EMA mood and activity (CC BY 4.0), StudentLife | affect over time in daily life |
| Self-determination theory diary studies (Hewett 2017, Neubauer 2020, Coxen 2021 review) | autonomy, competence, relatedness satisfaction per activity: gives the social/creative motive weights |

## C. Music (feeds midi_rewards.json: mood, pays, relief per file)
| Source | Size | Note |
|---|---|---|
| EMOPIA (Zenodo 5624519) | 1,087 clips, 387 songs, 4 valence-arousal classes | CC BY 4.0 (card), MIDI transcribed from audio |
| XMIDI | 108,023 MIDI, 11 emotion classes, 6 genres | largest emotion-labelled set |
| VGMIDI | 95 game pieces with valence | |
| Mutopia Project | about 2,100 pieces, CC | public-domain classical, clean piano/guitar |
| MAESTRO | about 1,200 piano performances | non-commercial licence, fine for personal |
| GiantMIDI-Piano, ATEPP, ASAP, POP909, Lakh, PDMX, GigaMIDI, MetaMIDI | large | index: github.com/asigalov61/awesome-midi-repos |
| BitMidi | 100k+ old web MIDI | no bulk download or licence found; scraping rights unclear |

## D. Literature (for structure, not numbers)
- Sims-style needs AI; Maslow; self-determination theory (Deci and Ryan).
- Generative Agents (Park et al. 2023), ORACLE NPC daily activities (arXiv 2603.23933), DISCOVER daily-living patterns (arXiv 2503.01733): learning routine chains from sensor data.
- Russell circumplex (valence-arousal) for the emotion prototypes.

## Plan once downloaded
1. ATUS activity file -> map ATUS codes to our 45 acts -> transition counts act>act, time-of-day hazard per act, duration distributions -> overwrite `follow.json` and windows, with counts in the file.
2. ATUS Well-Being -> per-act happy/stress/tired/sad means -> initial matrix weights and ledger deltas (rescaled), with the source cell recorded.
3. EMOPIA/XMIDI -> train a small valence/arousal profile for each of our MIDI files; keep the hand overrides.
4. Leave non-mappable acts (art, snake, guitar) hand-set and mark them `source: hand`.

## Status (2026-10-17)
Downloaded: ATUS activity/summary 2003-24, ATUS Well-Being 2010/12/13, EMOPIA, MAESTRO (MIDI only), Mutopia (crawl), GoEmotions taxonomy + train.tsv, Warriner 2013, NRC VAD v2.1, Cowen-Keltner 2017 map data (34 emotions x 14 appraisal dims, from the map page). Not fetched: MTUS/HETUS (registration), XMIDI and the large MIDI collections (size/licence), BitMidi (no bulk licence).

Used for:
- tools/data/fit_atus.py -> follow.json (930 pairs), motive_matrix.json (blend 0.6), validate.mjs (time split vs real).
- tools/data/apply_feel.py -> act_feel.json: per-activity mood offset (happy, stress) from the Well-Being module. Sim vs real correlation: happy 0.76, stress 0.87 (was -0.17 / -0.36 before).
- tools/data/audit_emotions.py + candidates.py -> emotion_audit.json, emotion_candidates.json. Five new transient emotions (awe, aesthetic_appreciation, nostalgia, amusement, triumph) with VAD means from the three sources. VAD alone cannot separate them from delighted/curious, so they are event-triggered (art verdict, music relief, gallery, positive surprise), not picked by nearest prototype.
Known gaps: TV, social, care, chores, exercise too low in the sim; relax, music, hobby, read, groom too high (music/hobby are persona); frustrated dominance (0.75 vs ~0.35 in data) not yet changed.
