#!/usr/bin/env python3
"""Fit fine-grained indoor daily living transitions and groom/kitchen sub-splits from CASAS (Milan, Cairo, Kyoto7)
and Van Kasteren smart-home continuous single-resident datasets.
Solves the ATUS coarse-prefix limitation (where shower, brush, wash, loo all share code 010201 'groom').
Writes tools/data/smarthome_fit.json."""
import collections, json, os, re
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "../../data/raw/smarthome")

# Map smart-home dataset labels to our simulation's fine-grained acts
CASAS_MAP = {
    "Bed_to_Toilet": "loo",
    "R1_Bed_to_Toilet": "loo",
    "R2_Bed_to_Toilet": "loo",
    "Guest_Bathroom": "loo",
    "Master_Bathroom": "shower",
    "Wash_Bathtub": "shower",
    "Bathing": "shower",
    "R1_Personal_Hygiene": "brush",
    "R2_Personal_Hygiene": "brush",
    "Personal_hygiene": "brush",
    "Morning_Meds": "wash",
    "Eve_Meds": "wash",
    "Kitchen_Activity": "cook",
    "Meal_Preparation": "cook",
    "Breakfast": "eat",
    "Lunch": "eat",
    "Dinner": "eat",
    "Dining_Rm_Activity": "eat",
    "Desk_Activity": "work",
    "R1_Work": "work",
    "R2_Work": "work",
    "Study": "work",
    "Read": "read",
    "Watch_TV": "tv",
    "Meditate": "bench",
    "Chores": "gather",
    "Clean": "gather",
    "Laundry": "dress",
    "Master_Bedroom_Activity": "dress",
    "Sleep": "sleep",
    "R1_Sleep": "sleep",
    "R2_Sleep": "sleep",
    "Bed": "sleep",
    "Leave_Home": "roam",
    "Leave": "roam",
}

KASTEREN_MAP = {
    "UseToilet": "loo",
    "TakeShower": "shower",
    "BrushTeeth": "brush",
    "GoToBed": "sleep",
    "PrepareBreakfast": "cook",
    "PrepareDinner": "cook",
    "GetDrink": "tea",
    "LeaveHouse": "roam",
}


def parse_casas():
    episodes = []
    for fn in ("milan.txt", "cairo.txt", "kyoto7.txt"):
        path = os.path.join(RAW, "casas", fn)
        if not os.path.exists(path):
            continue
        seq = []
        last_act = None
        last_ts = None
        with open(path) as f:
            for ln in f:
                parts = ln.strip().split()
                if len(parts) < 5:
                    continue
                raw_label = parts[4]
                status = parts[5] if len(parts) > 5 else "begin"
                act = CASAS_MAP.get(raw_label)
                if not act:
                    continue
                try:
                    ts = datetime.fromisoformat(parts[0] + "T" + parts[1][:8])
                except Exception:
                    continue
                if status.lower() in ("begin", "on") or act != last_act:
                    if last_act != act:
                        seq.append((act, ts.hour))
                        last_act = act
                        last_ts = ts
        episodes.append((fn, seq))
    return episodes


def parse_kasteren():
    path = os.path.join(RAW, "kasteren", "base_kasteren.csv")
    if not os.path.exists(path):
        return []
    seq = []
    last_act = None
    with open(path) as f:
        for ln in f:
            parts = ln.strip().split()
            if len(parts) < 6:
                continue
            raw_label = parts[-1]
            act = KASTEREN_MAP.get(raw_label)
            if not act:
                continue
            try:
                hr = int(parts[1].split(":")[0])
            except Exception:
                hr = 12
            if act != last_act:
                seq.append((act, hr))
                last_act = act
    return [("kasteren", seq)]


all_runs = parse_casas() + parse_kasteren()
counts = collections.Counter()
trans = collections.Counter()
nxt = collections.Counter()
hours = collections.defaultdict(lambda: [0] * 24)

for name, seq in all_runs:
    for i, (act, hr) in enumerate(seq):
        counts[act] += 1
        hours[act][hr % 24] += 1
        if i + 1 < len(seq) and seq[i + 1][0] != act:
            b = seq[i + 1][0]
            trans[(act, b)] += 1
            nxt[b] += 1

tot_eps = sum(counts.values())
tot_pairs = sum(trans.values())
lift = {}
for (a, b), n in trans.items():
    pa = sum(v for (x, _), v in trans.items() if x == a)
    if n >= 5 and pa >= 15 and nxt[b] > 0:
        l = (n / pa) / (nxt[b] / tot_pairs)
        lift[f"{a}>{b}"] = round(min(4.0, max(0.35, l)), 3)

hour_shape = {
    a: [round(x / sum(h), 4) for x in h]
    for a, h in hours.items()
    if sum(h) >= 15
}

groom_acts = ("loo", "shower", "brush", "wash", "dress")
groom_tot = sum(counts[a] for a in groom_acts) or 1
groom_split = {a: round(counts[a] / groom_tot, 4) for a in groom_acts}

out = {
    "source": "CASAS (Milan, Cairo, Kyoto7) + Van Kasteren continuous single-resident smart-home datasets",
    "total_episodes": tot_eps,
    "total_transitions": tot_pairs,
    "counts": dict(counts.most_common()),
    "groom_subsplit": groom_split,
    "lift": lift,
    "hour_shape": hour_shape,
}
with open(os.path.join(HERE, "smarthome_fit.json"), "w") as f:
    json.dump(out, f, indent=1)
print(f"smarthome_fit: {tot_eps} episodes, {len(lift)} transition lifts, groom split: {groom_split}")
