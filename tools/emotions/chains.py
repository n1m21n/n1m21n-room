#!/usr/bin/env python3
"""Chain tool. list | check | add.
  python3 chains.py list
  python3 chains.py check                         # every act exists, window sane, normal chains pay positive, abnormal pay mixed/negative
  python3 chains.py add NAME --kind normal --steps shower dress --window 360-1320 --reward chain_complete [--trigger-motive hygiene<0.4]
Steps may carry ? for optional (tea?) and *a-b for counts (guitar*2-4)."""
import sys, argparse, subprocess, os
from common import load, save, HERE

def parse_step(s):
    opt = s.endswith("?"); s = s.rstrip("?"); step = {}
    if "*" in s:
        s, c = s.split("*"); a, _, b = c.partition("-"); step["count"] = [int(a), int(b or a)]
    step["act"] = s
    if opt: step["optional"] = True
    return step

def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list"); sub.add_parser("check")
    a = sub.add_parser("add"); a.add_argument("name"); a.add_argument("--kind", default="normal"); a.add_argument("--steps", nargs="+", required=True)
    a.add_argument("--window"); a.add_argument("--reward", default="chain_complete"); a.add_argument("--trigger-motive")
    args = ap.parse_args(); d = load("chains"); C = d["chains"] if "chains" in d else d
    if args.cmd == "list":
        for n, c in C.items(): print(f'{n:20} {c["kind"]:9} {" > ".join(s["act"] + ("?" if s.get("optional") else "") for s in c["steps"])}  win={c.get("window")}')
    elif args.cmd == "check":
        A = load("activities")["activities"]; L = load("ledger_events"); E = L["events"]; bad = 0
        for n, c in C.items():
            for s in c["steps"]:
                if s["act"] not in A: print("ERR", n, "unknown act", s["act"]); bad += 1
            ev = E.get(c["reward"])
            if not ev: print("ERR", n, "unknown reward event", c["reward"]); bad += 1; continue
            v = ev["deltas"].get("valence", 0) + ev["deltas"].get("pride", 0) - ev["deltas"].get("stress", 0)
            if c["kind"] == "normal" and v < 0: print("WARN normal chain pays negative:", n)
        print("chains ok" if not bad else f"{bad} errors"); sys.exit(1 if bad else 0)
    elif args.cmd == "add":
        if args.name in C: sys.exit("exists")
        c = {"kind": args.kind, "steps": [parse_step(s) for s in args.steps], "reward": args.reward}
        if args.window: lo, hi = args.window.split("-"); c["window"] = [[int(lo), int(hi)]]
        if args.trigger_motive:
            import re; m, op, x = re.match(r"(\w+)([<>])([\d.]+)", args.trigger_motive).groups(); c["trigger"] = {"motive": {m: op + x}}
        C[args.name] = c; save("chains", d); subprocess.run([sys.executable, os.path.join(HERE, "gen.py")])

if __name__ == "__main__": main()
