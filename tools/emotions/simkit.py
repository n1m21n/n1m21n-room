#!/usr/bin/env python3
"""simkit: one CLI over the sim data. Everything lives in ONE space (the master matrix):
  affect  V A ST E D            (valence, arousal, stress, energy, dominance; emotion prototypes are POSITIONS 0..1,
                                 everything else is an OFFSET: which way it pushes him from neutral)
  motives energy hunger fun focus hygiene bladder social   (what it pays / drains)
  neuro   DA HT NE CORT OXY SLP (chemistry deltas, where the data has them)
Rows: emotion, act, object, chain, piece (MIDI), event (ledger), hazard, node (Infinite), param (Infinite node param).

  python3 simkit.py matrix [--csv]            # write master_matrix.json (+ .csv) next to this file
  python3 simkit.py explain ROW              # one row + the emotions it sits nearest / points toward   (ROW = kind:name or name)
  python3 simkit.py near EMOTION [--kind act] [-n 10]   # what in the world pulls toward this emotion
  python3 simkit.py act-emotion | music-emotion         # mapping tables
  python3 simkit.py reward [EVENT]           # the reward system: ledger events, where the code writes them, what they pay
  python3 simkit.py interrupt [EVENT hard|soft|none]    # list / set how each hazard interrupts chains
  python3 simkit.py art-map [NODE]           # Infinite node params -> axis -> emotion coords
  python3 simkit.py add-emotion NAME --v .7 --a .4 --st .1 --e .6 --d .5 --like calm [--margin .12 --hold 0]
  python3 simkit.py add-object NAME --acts tea sip --motives fun --placement "kitchen shelf"
  python3 simkit.py add-act ... / add-chain ...         # passed through to categorize.py add / chains.py add
Writers run gen.py afterwards. Read SIM_DESIGN.md / SIM_REVIEW.md for the model itself."""
import sys, os, json, math, re, argparse, subprocess, csv
from common import load, save, HERE, ROOT, MOTIVES

AFF = ["V", "A", "ST", "E", "D"]
NEU = ["DA", "HT", "NE", "CORT", "OXY", "SLP"]
COLS = AFF + MOTIVES + NEU
LONG = {"valence": "V", "arousal": "A", "stress": "ST", "energy": "E", "dominance": "D"}
# ledger trace -> affect offset (traces are the slow mood channels the ledger writes; see ledger_events.json traces)
TRACE = {"valence": {"V": 1}, "arousal": {"A": 1}, "stress": {"ST": 1}, "frustration": {"ST": .7, "V": -.3},
         "pride": {"D": 1}, "comfort": {"V": .5, "ST": -.5}, "loneliness": {"V": -.6}, "boredom": {"A": -.6, "V": -.3},
         "curiosity": {"A": .6, "V": .2}, "fatigueDebt": {"E": -1}}
PULL = 0.1   # an act's emotionPull weight 1.0 = a nudge of 0.1 along that emotion's direction from neutral
ART = os.path.join(ROOT, "tools", "art")


def regen():
    subprocess.run([sys.executable, "-s", os.path.join(HERE, "gen.py")], check=False, env={**os.environ, "PYTHONPATH": HERE})


def row(kind, name, mode, **kw):
    r = {"kind": kind, "name": name, "mode": mode, **{c: None for c in COLS}}
    for k, v in kw.items():
        if k in COLS: r[k] = round(v, 4) if isinstance(v, (int, float)) else v
        else: r[k] = v
    return r


def add(vec, src, scale=1.0, keymap=None):
    for k, v in (src or {}).items():
        if not isinstance(v, (int, float)): continue
        for kk, w in ((keymap or {}).get(k) or {(LONG.get(k, k)): 1}).items():
            if kk in COLS: vec[kk] = (vec.get(kk) or 0) + v * w * scale
    return vec


def mean_rows(rows):
    out = {}
    for c in COLS:
        xs = [r[c] for r in rows if r.get(c) is not None]
        if xs: out[c] = sum(xs) / len(xs)
    return out


def build():
    em = load("emotions")["emotions"]; acts = load("activities")["activities"]; ch = load("chains"); C = ch.get("chains", ch)
    led = load("ledger_events")["events"]; haz = load("hazards").get("events", {}); feel = load("act_feel")["acts"]
    mm = load("motive_matrix")["matrix"]; objs = load("objects")["objects"]; midi = load("midi_rewards")["pieces"]
    neutral = {LONG[k]: v for k, v in em["neutral"]["prototype"].items()}
    rows = []
    for n, e in em.items():
        rows.append(row("emotion", n, "position", **{LONG[k]: v for k, v in e["prototype"].items()}))
    E = {r["name"]: r for r in rows}
    act_rows = {}
    for n, a in acts.items():
        v = add({}, {k: x for k, x in feel.get(n, {}).items() if k in LONG})
        for emo, w in (a.get("emotionPull") or {}).items():
            if emo in E:
                for c in AFF: v[c] = (v.get(c) or 0) + PULL * w * (E[emo][c] - neutral[c])
        for m, pct in (mm.get(n) or {}).items(): v[m] = pct / 100
        r = row("act", n, "offset", category=a.get("category"), actKind=a.get("kind"), **v); rows.append(r); act_rows[n] = r
    ev_rows = {}
    for n, e in led.items():
        v = add({}, e.get("deltas"), keymap=TRACE); add(v, e.get("motives")); add(v, e.get("neuro"))
        r = row("event", n, "offset", eventKind=e.get("kind"), **v); rows.append(r); ev_rows[n] = r
    for n, o in objs.items():
        rs = [act_rows[a] for a in o.get("acts", []) if a in act_rows]
        rows.append(row("object", n, "offset", acts=o.get("acts"), status=o.get("status"), **mean_rows(rs)))
    for n, c in C.items():
        v = mean_rows([act_rows[s["act"]] for s in c["steps"] if s["act"] in act_rows])
        rw = ev_rows.get(c.get("reward"))
        if rw:
            for col in COLS:
                if rw[col] is not None: v[col] = (v.get(col) or 0) + rw[col]
        rows.append(row("chain", n, "offset", chainKind=c.get("kind"), steps=[s["act"] for s in c["steps"]], **v))
    for n, p in midi.items():
        a = p.get("auto", {}); a = {**a, **(p.get("manual") or {})}
        v = {LONG[k]: x for k, x in (a.get("target") or {}).items() if k in LONG}
        for m, x in (a.get("pays") or {}).items(): v[m] = x
        rows.append(row("piece", n, "position", suits=a.get("suits"), **v))
    for n, h in haz.items():
        r = ev_rows.get(h.get("ledger"))
        rows.append(row("hazard", n, "offset", interrupt=h.get("interrupt", "hard"), perDay=round((h.get("h0") or 0) * 1440, 3), **({c: r[c] for c in COLS if r and r[c] is not None})))
    try:
        sem = json.load(open(os.path.join(ART, "param_semantics.json")))["axes"]; nodes = json.load(open(os.path.join(ART, "node_catalog.json")))
    except FileNotFoundError:
        sem, nodes = {}, {}
    for n, nd in nodes.items():
        prs = []
        for p in nd.get("params", []):
            w = sem.get(p.get("axis"), {})
            if not w: continue
            r = row("param", f"{n}.{p['key']}", "offset", node=n, axis=p["axis"], **w); rows.append(r); prs.append(r)
        if prs: rows.append(row("node", n, "offset", category=nd.get("category"), params=len(prs), **mean_rows(prs)))
    for r in rows: r["nearest"] = nearest(r, E, neutral)
    return rows


def nearest(r, E, neutral, k=3):
    dims = [c for c in AFF if r.get(c) is not None]
    if not dims: return []
    out = []
    for n, e in E.items():
        if r["kind"] == "emotion" and n == r["name"]: continue
        if r["mode"] == "position":
            d = math.sqrt(sum((r[c] - e[c]) ** 2 for c in dims)); out.append((n, round(1 - d / math.sqrt(len(dims)), 3)))
        else:
            a = [r[c] for c in dims]; b = [e[c] - neutral[c] for c in dims]
            na, nb = math.hypot(*a), math.hypot(*b)
            if na < 1e-9 or nb < 1e-9: continue
            out.append((n, round(sum(x * y for x, y in zip(a, b)) / na / nb, 3)))
    return sorted(out, key=lambda t: -t[1])[:k]


def find(rows, q):
    kind, _, name = q.rpartition(":")
    hits = [r for r in rows if r["name"] == name and (not kind or r["kind"] == kind)]
    if not hits: sys.exit(f"no row {q!r}; try kind:name, e.g. act:tea, piece:..., param:Blur.radius")
    return hits


def fmt(r):
    vals = "  ".join(f"{c}={r[c]:+.2f}" for c in COLS if r.get(c) is not None)
    near = ", ".join(f"{n} {s:.2f}" for n, s in r["nearest"])
    return f"{r['kind']:8} {r['name']:28} [{r['mode']}] {vals}\n{'':38}-> {near}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("matrix"); m.add_argument("--csv", action="store_true")
    x = sub.add_parser("explain"); x.add_argument("row")
    n = sub.add_parser("near"); n.add_argument("emotion"); n.add_argument("--kind"); n.add_argument("-n", type=int, default=10)
    sub.add_parser("act-emotion"); sub.add_parser("music-emotion")
    rw = sub.add_parser("reward"); rw.add_argument("event", nargs="?")
    it = sub.add_parser("interrupt"); it.add_argument("event", nargs="?"); it.add_argument("policy", nargs="?", choices=["hard", "soft", "none"])
    am = sub.add_parser("art-map"); am.add_argument("node", nargs="?")
    ae = sub.add_parser("add-emotion"); ae.add_argument("name")
    for k in ["v", "a", "st", "e", "d"]: ae.add_argument("--" + k, type=float, required=True)
    ae.add_argument("--like", required=True, help="existing emotion whose music/face bank it borrows"); ae.add_argument("--margin", type=float, default=0.12); ae.add_argument("--hold", type=float, default=0.0)
    ao = sub.add_parser("add-object"); ao.add_argument("name"); ao.add_argument("--acts", nargs="+", required=True); ao.add_argument("--motives", nargs="*", default=[]); ao.add_argument("--placement", default="")
    sub.add_parser("add-act", add_help=False); sub.add_parser("add-chain", add_help=False)
    if len(sys.argv) > 1 and sys.argv[1] in ("add-act", "add-chain"):
        tool = "categorize.py" if sys.argv[1] == "add-act" else "chains.py"
        sys.exit(subprocess.run([sys.executable, os.path.join(HERE, tool), "add", *sys.argv[2:]]).returncode)
    a = ap.parse_args()

    if a.cmd == "matrix":
        rows = build(); out = os.path.join(HERE, "master_matrix.json")
        json.dump({"doc": __doc__.split("\n\n")[0], "columns": COLS, "rows": rows}, open(out, "w"), indent=0); print(f"{len(rows)} rows -> {out}")
        if a.csv:
            with open(out[:-4] + "csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["kind", "name", "mode", *COLS, "nearest"])
                for r in rows: w.writerow([r["kind"], r["name"], r["mode"], *("" if r[c] is None else r[c] for c in COLS), " ".join(f"{n}:{s}" for n, s in r["nearest"])])
            print("csv ->", out[:-4] + "csv")
        from collections import Counter; print(dict(Counter(r["kind"] for r in rows)))
    elif a.cmd == "explain":
        for r in find(build(), a.row): print(fmt(r))
    elif a.cmd == "near":
        rows = build(); E = {r["name"] for r in rows if r["kind"] == "emotion"}
        if a.emotion not in E: sys.exit(f"unknown emotion; have: {', '.join(sorted(E))}")
        hits = []
        for r in rows:
            if a.kind and r["kind"] != a.kind: continue
            if r["kind"] == "emotion": continue
            s = dict(r["nearest"]).get(a.emotion)
            if s is not None: hits.append((s, r))
        for s, r in sorted(hits, key=lambda t: -t[0])[:a.n]: print(f"{s:+.2f}  {r['kind']:7} {r['name']}")
    elif a.cmd in ("act-emotion", "music-emotion"):
        kind = "act" if a.cmd == "act-emotion" else "piece"
        for r in build():
            if r["kind"] != kind: continue
            extra = ""
            if kind == "piece" and r.get("suits"): extra = "  suits(hand): " + ", ".join(f"{k} {v:.2f}" for k, v in sorted(r["suits"].items(), key=lambda t: -t[1])[:3])
            print(f"{r['name']:28} -> " + ", ".join(f"{n} {s:.2f}" for n, s in r["nearest"]) + extra)
    elif a.cmd == "reward":
        led = load("ledger_events"); SIM = os.path.join(ROOT, "site", "src", "sim")
        src = "".join(open(os.path.join(SIM, f)).read() for f in os.listdir(SIM) if f.endswith(".js"))
        src += "".join(open(os.path.join(HERE, f + ".json")).read() for f in ("hazards", "outcomes", "activities", "stability"))
        print(f"kindWeight {led['kindWeight']}  traces (tau, story minutes): " + ", ".join(f"{k} {v['tau']}" for k, v in led["traces"].items()))
        rows = {r["name"]: r for r in build() if r["kind"] == "event"}
        for n, e in led["events"].items():
            if a.event and n != a.event: continue
            used = len(re.findall(r"['\"]" + re.escape(n) + r"['\"]", src))
            ch = [k for k, c in load("chains")["chains"].items() if c.get("reward") == n]
            print(fmt(rows[n]) + f"\n{'':38}   named in code/data x{used}" + (f", chain reward of {', '.join(ch)}" if ch else "") + ("  ** never written **" if not used and not ch else ""))
    elif a.cmd == "interrupt":
        hz = load("hazards")
        if a.event:
            if a.event not in hz["events"]: sys.exit("unknown hazard")
            hz["events"][a.event]["interrupt"] = a.policy or "hard"; save("hazards", hz); regen(); print(a.event, "->", hz["events"][a.event]["interrupt"])
        for n, h in hz["events"].items(): print(f"{n:20} {h.get('interrupt', 'hard'):5} {h['h0'] * 1440:6.3f}/day base  ledger={h.get('ledger')}")
        print("hard = breaks every live chain; soft = suspends them (resume odds exp(-away/resumeTau)); none = no effect on chains")
    elif a.cmd == "art-map":
        sem = json.load(open(os.path.join(ART, "param_semantics.json")))["axes"]; nodes = json.load(open(os.path.join(ART, "node_catalog.json")))
        if not a.node:
            from collections import Counter
            cnt = Counter(p.get("axis") for nd in nodes.values() for p in nd.get("params", []))
            print(f"{len(nodes)} nodes, {sum(cnt.values())} params")
            for ax, c in cnt.most_common(): print(f"  {ax:10} {c:5} params  -> {sem.get(ax) or '(no emotion weight)'}")
        else:
            nd = nodes.get(a.node) or sys.exit("unknown node")
            for p in nd["params"]: print(f"  {p['key']:24} {p.get('kind', ''):6} axis={p.get('axis'):10} -> {sem.get(p.get('axis')) or '-'}")
    elif a.cmd == "add-emotion":
        d = load("emotions"); E = d["emotions"]
        if a.name in E: sys.exit("exists")
        if a.like not in E or not E[a.like].get("existing"): sys.exit("--like must be an existing (legacy) emotion: " + ", ".join(k for k, v in E.items() if v.get("existing")))
        proto = {"valence": a.v, "arousal": a.a, "stress": a.st, "energy": a.e, "dominance": a.d}
        close = sorted((math.dist(list(proto.values()), [e["prototype"][k] for k in proto]), n) for n, e in E.items())[:3]
        for dist, n in close:
            if dist < a.margin * 1.5: print(f"warning: {n} is only {dist:.2f} away; the two will flicker unless margin/hold separate them")
        E[a.name] = {"prototype": proto, "margin": a.margin, "hold": a.hold, "existing": False, "musicLike": a.like}
        save("emotions", d); regen(); print("added; nearest:", ", ".join(f"{n} {d_:.2f}" for d_, n in close), "\nnext: lovheimCube / emotionPull / chain triggers may name it; node tools/sim/montecarlo.mjs to see it occur")
    elif a.cmd == "add-object":
        d = load("objects"); acts = load("activities")["activities"]
        bad = [x for x in a.acts if x not in acts]
        if bad: sys.exit(f"unknown acts {bad}; add them first with simkit.py add-act")
        d["objects"][a.name] = {"status": "todo", "acts": a.acts, "motives": a.motives, "placement": a.placement}
        save("objects", d); print("added", a.name, "(status todo: needs a model + station in the room)")


if __name__ == "__main__":
    main()
