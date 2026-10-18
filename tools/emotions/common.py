"""Shared loaders for the sim data tools. Source of truth = the JSON files next to this script."""
import json, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SITE = os.path.join(ROOT, "site")
GEN_DIR = os.path.join(SITE, "src", "sim", "data")
MEDIA = os.path.join(SITE, "public", "media")
FILES = ["emotions", "rig", "activities", "chains", "ledger_events", "neuro", "stability", "outcomes", "hazards", "inventory"]
MOTIVES = ["energy", "hunger", "fun", "focus", "hygiene", "bladder", "social"]
EXTRA_MOTIVES = ["stress", "comfort", "curiosity", "restlessness", "pride"]


def load(name):
    with open(os.path.join(HERE, name + ".json")) as f:
        return json.load(f)


def save(name, obj):
    with open(os.path.join(HERE, name + ".json"), "w") as f:
        json.dump(obj, f, indent=1)
        f.write("\n")


def load_all():
    return {n: load(n) for n in FILES}


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


SAFE = {"clamp": clamp, "min": min, "max": max, "abs": abs}


def ev(expr, env):
    return eval(expr, {"__builtins__": {}}, {**SAFE, **env})
