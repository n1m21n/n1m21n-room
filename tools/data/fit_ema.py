#!/usr/bin/env python3
"""Fit longitudinal emotional inertia (autocorrelation -> tau), within-person mood SD, and cross-affect coupling
from 103k+ real Experience Sampling (EMA) observations in EmotionTimeSeries (Fisher2017, Rowland2020,
Bringmann2013, Bringmann2016, Fried2021, Wright2017) + EmoBank contextual VAD ratings.
Writes tools/data/ema_fit.json."""
import csv, glob, json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
ETS_DIR = os.path.join(HERE, "../../data/raw/emotion/emotion_timeseries/DataClean")
EMOBANK_CSV = os.path.join(HERE, "../../data/raw/emotion/emobank/emobank.csv")


def mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def sd(xs):
    if len(xs) < 2:
        return 0.0
    m = mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def corr(xs, ys):
    if len(xs) < 3 or len(xs) != len(ys):
        return 0.0
    mx, my = mean(xs), mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs)
    dy = sum((y - my) ** 2 for y in ys)
    return num / math.sqrt(dx * dy) if dx > 0 and dy > 0 else 0.0


def lag1_autocorr(series_by_subj):
    rs = []
    for _, xs in series_by_subj.items():
        if len(xs) >= 10 and sd(xs) > 1e-4:
            r = corr(xs[:-1], xs[1:])
            if not math.isnan(r):
                rs.append(r)
    return round(mean(rs), 3) if rs else 0.0


# 1. Analyze Fisher2017 (40 participants, ~4 pings/day over ~30 days, 0-100 visual analogue scale)
FISHER_COLS = (
    "energetic", "enthusiastic", "content", "irritable", "restless", "worried",
    "guilty", "afraid", "anhedonia", "angry", "hopeless", "down", "positive",
    "fatigue", "tension", "concentrate", "accepted", "threatened", "ruminate",
    "avoid_act", "reassure", "procrast"
)
fisher_path = os.path.join(ETS_DIR, "Fisher2017", "data_Fisher2017.csv")
fisher_subj = {}
fisher_rows = []
if os.path.exists(fisher_path):
    with open(fisher_path) as f:
        for r in csv.DictReader(f):
            sid = r.get("subj_id", "1")
            row = {}
            for k in FISHER_COLS:
                try:
                    v = float(r.get(k, ""))
                    if not math.isnan(v):
                        row[k] = v / 100.0
                except Exception:
                    pass
            if len(row) >= 8:
                fisher_subj.setdefault(sid, []).append(row)
                fisher_rows.append(row)

fisher_ac = {}
for dim in ("positive", "energetic", "fatigue", "worried", "irritable", "restless", "content", "down", "tension", "concentrate", "ruminate", "anhedonia"):
    by_s = {s: [x[dim] for x in rows if dim in x] for s, rows in fisher_subj.items()}
    fisher_ac[dim] = lag1_autocorr(by_s)


def pair_corr(k1, k2):
    pairs = [(x[k1], x[k2]) for x in fisher_rows if k1 in x and k2 in x]
    return round(corr([p[0] for p in pairs], [p[1] for p in pairs]), 3)


cross_coupling = {
    "tension_to_fatigue": pair_corr("tension", "fatigue"),
    "worried_to_restless": pair_corr("worried", "restless"),
    "irritable_to_tension": pair_corr("irritable", "tension"),
    "down_to_fatigue": pair_corr("down", "fatigue"),
    "down_to_anhedonia": pair_corr("down", "anhedonia"),
    "fatigue_to_concentrate": pair_corr("fatigue", "concentrate"),
    "tension_to_ruminate": pair_corr("tension", "ruminate"),
    "worried_to_avoid_act": pair_corr("worried", "avoid_act"),
    "fatigue_to_procrast": pair_corr("fatigue", "procrast"),
    "positive_to_energetic": pair_corr("positive", "energetic"),
    "content_to_tension": pair_corr("content", "tension"),
}

# 2. Analyze Rowland2020 (30,000 observations: happy, excited, relaxed, satisfied, angry, anxious, depressed, sad)
rowland_path = os.path.join(ETS_DIR, "Rowland2020", "data_Rowland2020.csv")
rowland_subj_v = {}
rowland_day_sds = []
if os.path.exists(rowland_path):
    subj_day = {}
    with open(rowland_path) as f:
        for r in csv.DictReader(f):
            sid = r.get("subj_id", "1")
            day = r.get("dayno", "1")
            try:
                pos = (float(r["happy"]) + float(r["relaxed"]) + float(r["satisfied"])) / 300.0
                neg = (float(r["anxious"]) + float(r["sad"]) + float(r["depressed"]) + float(r["angry"])) / 400.0
                val = max(0.0, min(1.0, 0.5 + 0.5 * (pos - neg)))
                rowland_subj_v.setdefault(sid, []).append(val)
                subj_day.setdefault((sid, day), []).append(val)
            except Exception:
                pass
    by_s_day_means = {}
    for (sid, _), vs in subj_day.items():
        if len(vs) >= 2:
            by_s_day_means.setdefault(sid, []).append(mean(vs))
    for sid, dmeans in by_s_day_means.items():
        if len(dmeans) >= 5:
            rowland_day_sds.append(sd(dmeans))

# 3. Count total EMA rows across all converted studies
study_counts = {}
for p in sorted(glob.glob(os.path.join(ETS_DIR, "*/*.csv"))):
    if p.endswith("_between.csv"):
        continue
    name = os.path.basename(os.path.dirname(p))
    with open(p) as f:
        study_counts[name] = sum(1 for _ in f) - 1

# 4. EmoBank contextual VAD distribution (1..5 scale -> normalized 0..1)
emobank_v, emobank_a, emobank_d = [], [], []
if os.path.exists(EMOBANK_CSV):
    with open(EMOBANK_CSV) as f:
        for r in csv.DictReader(f):
            try:
                emobank_v.append((float(r["V"]) - 1.0) / 4.0)
                emobank_a.append((float(r["A"]) - 1.0) / 4.0)
                emobank_d.append((float(r["D"]) - 1.0) / 4.0)
            except Exception:
                pass

out = {
    "source": "EmotionTimeSeries (6 EMA longitudinal studies) + EmoBank (10,062 contextual VAD ratings)",
    "ema_study_rows": study_counts,
    "total_ema_rows": sum(study_counts.values()),
    "fisher2017_lag1_autocorr": fisher_ac,
    "fisher2017_cross_correlations": cross_coupling,
    "rowland2020_valence": {
        "lag1_autocorr": lag1_autocorr(rowland_subj_v),
        "within_person_day_sd_mean": round(mean(rowland_day_sds), 4),
        "between_person_sd": round(sd([mean(vs) for vs in rowland_subj_v.values() if len(vs) >= 10]), 4),
        "overall_mean": round(mean([mean(vs) for vs in rowland_subj_v.values() if len(vs) >= 10]), 4),
    },
    "emobank_vad_01": {
        "n": len(emobank_v),
        "valence_mean": round(mean(emobank_v), 4),
        "valence_sd": round(sd(emobank_v), 4),
        "arousal_mean": round(mean(emobank_a), 4),
        "arousal_sd": round(sd(emobank_a), 4),
        "dominance_mean": round(mean(emobank_d), 4),
        "dominance_sd": round(sd(emobank_d), 4),
    },
}
with open(os.path.join(HERE, "ema_fit.json"), "w") as f:
    json.dump(out, f, indent=1)
print("ema_fit:", json.dumps(out, indent=1))
