#!/usr/bin/env python3
"""Activity category tool. list | audit | add | set.
  python3 categorize.py list [--kind erratic] [--trivial]
  python3 categorize.py audit                       # balance of normal/erratic, trivial/non-trivial, categories, orphans
  python3 categorize.py add NAME --kind normal --category leisure --rewards fun=0.4 --drain energy=0.004 --minutes 12 [--trivial]
  python3 categorize.py set NAME key=value ...      # e.g. kind=erratic trivial=true baseMinutes=20
Run gen.py afterwards (add/set call it for you)."""
import sys, argparse, subprocess, os
from common import load, save, HERE, MOTIVES, EXTRA_MOTIVES

def acts():
    d = load("activities"); return d, d["activities"]

def kv(items):
    out = {}
    for s in items or []:
        k, v = s.split("="); out[k] = float(v)
    return out

def autoval(v):
    if v in ("true", "false"): return v == "true"
    try: return float(v) if "." in v else int(v)
    except ValueError: return v

def regen():
    subprocess.run([sys.executable, os.path.join(HERE, "gen.py")], check=False)

def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    l = sub.add_parser("list"); l.add_argument("--kind"); l.add_argument("--trivial", action="store_true")
    sub.add_parser("audit")
    a = sub.add_parser("add"); a.add_argument("name"); a.add_argument("--kind", default="normal"); a.add_argument("--category", default="leisure")
    a.add_argument("--rewards", nargs="*"); a.add_argument("--drain", nargs="*"); a.add_argument("--minutes", type=float, default=10)
    a.add_argument("--trivial", action="store_true"); a.add_argument("--label"); a.add_argument("--rate", type=float, default=0.03)
    s = sub.add_parser("set"); s.add_argument("name"); s.add_argument("pairs", nargs="+")
    args = ap.parse_args(); d, A = acts()
    if args.cmd == "list":
        for n, v in A.items():
            if args.kind and v["kind"] != args.kind: continue
            if args.trivial and not v["trivial"]: continue
            print(f'{n:14} {v["kind"]:8} {"trivial" if v["trivial"] else "       "} {v["category"]:13} rewards={v["rewards"]}')
    elif args.cmd == "audit":
        from collections import Counter
        kinds = Counter(v["kind"] for v in A.values()); triv = Counter(v["trivial"] for v in A.values()); cats = Counter(v["category"] for v in A.values())
        print("kind:", dict(kinds), "\ntrivial:", dict(triv), "\ncategories:", dict(cats))
        served = {m for v in A.values() for m in v["rewards"]}
        for m in MOTIVES:
            if m not in served: print("WARN no activity rewards motive", m)
        if kinds.get("erratic", 0) < 3: print("WARN fewer than 3 erratic acts")
        for n, v in A.items():
            if v["kind"] == "normal" and not v["rewards"] and not v["trivial"]: print("WARN non-trivial normal act with no reward:", n)
    elif args.cmd == "add":
        if args.name in A: sys.exit("exists: " + args.name)
        A[args.name] = {"kind": args.kind, "trivial": args.trivial, "category": args.category, "label": args.label or args.name,
                        "rewards": kv(args.rewards), "drain": kv(args.drain), "rate": args.rate, "minDur": max(1, int(args.minutes)), "cooldown": 30,
                        "baseMinutes": args.minutes, "spread": 0.3, "intensity": "tempo", "station": False, "requires": [], "emotionPull": {}}
        save("activities", d); regen()
    elif args.cmd == "set":
        if args.name not in A: sys.exit("unknown: " + args.name)
        for p in args.pairs:
            k, v = p.split("=", 1); A[args.name][k] = autoval(v)
        save("activities", d); regen()

if __name__ == "__main__": main()
