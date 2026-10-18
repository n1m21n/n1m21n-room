#!/usr/bin/env python3
"""Generator + validator for the sim data. One entry in emotions.json -> face expression params, body coordinates,
posture matrix, music bank, texture map. Run:  python3 tools/emotions/gen.py [--check]
--check validates only (no writes). Exit code 1 if validation fails."""
import json, math, os, sys
from common import *

D = load_all()
EM, RIG, ACT, CH, LED, NEU, STAB, OUT, HAZ, INV = (D[k] for k in ["emotions", "rig", "activities", "chains", "ledger_events", "neuro", "stability", "outcomes", "hazards", "inventory"])
errors, warns = [], []
err = errors.append
warn = warns.append


def coords_for(name, e):
    p = e["prototype"]
    env = dict(v=(p["valence"] - 0.5) * 2, a=(p["arousal"] - 0.5) * 2, st=p["stress"], f=1 - p["energy"], d=(p["dominance"] - 0.5) * 2)
    out = {}
    for k, L in RIG["landmarks"].items():
        val = L["bias"] + L["v"] * env["v"] + L["a"] * env["a"] + L["st"] * env["st"] + L["f"] * env["f"] + L["d"] * env["d"]
        out[k] = round(clamp(val, L["lo"], L["hi"]), 4)
    for k, v in (e.get("coords") or {}).items():
        out[k] = v
    return out


def expression_for(c, p):
    env = dict(c, st=p["stress"], a=(p["arousal"] - 0.5) * 2)
    return {k: round(ev(x, env), 4) for k, x in RIG["derive"]["expression"].items()}


def derived(name, e, c):
    p = e["prototype"]
    env = dict(arousal=p["arousal"], valence=p["valence"], fatigue=1 - p["energy"], **c)
    d = RIG["derive"]
    post = {k: round(ev(x, env), 4) for k, x in d["posture"].items()}
    lo = round(ev(d["breathLo"], env), 3)
    return dict(tempo=round(ev(d["tempo"], env), 3), velocity=round(ev(d["velocity"], env), 3), breathHzRange=[lo, round(lo + d["breathSpan"], 3)],
                gait=round(ev(d["gait"], env), 3), **post)


# ---------- build emotions
LEG = {n: e for n, e in EM["emotions"].items() if e.get("existing")}
built, matrix, legacy_matrix, music_extra, face_map = {}, {}, {}, {}, {}
for n, e in EM["emotions"].items():
    p = e["prototype"]
    for k in EM["inputs"]:
        if not 0 <= p.get(k, -1) <= 1:
            err(f"{n}: prototype.{k} out of 0..1")
    c = coords_for(n, e)
    dv = derived(n, e, c)
    expr = expression_for(c, p)
    ent = dict(prototype=p, margin=e["margin"], hold=e.get("hold", 0.0), coords=c, expression=expr, existing=bool(e.get("existing")),
               transient=bool(e.get("transient")))
    if e.get("existing"):
        ent["face"] = e["face"]
        L = e.get("legacy")
        if L:
            ent.update(tempo=L["tempo"], velocity=L["velocity"], breathHzRange=L["breathHzRange"], spineSlumpRad=L["spineSlumpRad"], chestExpandRad=L["chestExpandRad"])
            legacy_matrix[n] = dict(face=n, condition=L["condition"], midi=L["midi"], keysProgression=L["keysProgression"], guitarProgression=L["guitarProgression"],
                                    tempo=L["tempo"], velocity=L["velocity"], breathHzRange=L["breathHzRange"], spineSlumpRad=L["spineSlumpRad"], chestExpandRad=L["chestExpandRad"])
        else:
            ent.update(tempo=dv["tempo"], velocity=dv["velocity"], breathHzRange=dv["breathHzRange"], spineSlumpRad=dv["spineSlumpRad"], chestExpandRad=dv["chestExpandRad"])
        ent["gait"] = dv["gait"]
        face_map[n] = n
    else:
        like = e["musicLike"]
        if like not in LEG:
            err(f"{n}: musicLike '{like}' is not an existing emotion")
        ent["face"] = dict(expression=n, eyes_open=round(c["eyelid_open"], 3), gaze=[round(c["gaze_x"], 3), round(c["gaze_y"], 3)])
        ent.update({k: dv[k] for k in ("tempo", "velocity", "breathHzRange", "spineSlumpRad", "chestExpandRad", "gait")})
        ent["musicLike"] = like
        music_extra[n] = dict(like=like, tempo=ent["tempo"], vel=ent["velocity"])
        tex = os.path.join(MEDIA, "man", f"face-{n}.webp")
        face_map[n] = n if os.path.exists(tex) else like
        if face_map[n] != n:
            warn(f"{n}: face texture not rendered yet, falling back to '{like}' (run tools/export_face.py {n})")
    L = legacy_matrix.get(n)
    base_like = LEG.get(e.get("musicLike", n), {}).get("legacy") or L
    matrix[n] = dict(face=face_map[n], condition=(L["condition"] if L else "nearest prototype"), midi=(base_like or {}).get("midi", "/media/midi/clair-de-lune.mid"),
                     keysProgression=(base_like or {}).get("keysProgression", ""), guitarProgression=(base_like or {}).get("guitarProgression", ""),
                     tempo=ent.get("tempo"), velocity=ent.get("velocity"), breathHzRange=ent.get("breathHzRange"), spineSlumpRad=ent.get("spineSlumpRad"), chestExpandRad=ent.get("chestExpandRad"))
    if base_like and base_like.get("midi"):
        mp = os.path.join(MEDIA, "midi", os.path.basename(base_like["midi"]))
        if not os.path.exists(mp):
            err(f"{n}: midi missing {mp}")
    for k, L2 in RIG["landmarks"].items():
        v = c[k]
        if not (L2["lo"] - 1e-6 <= v <= L2["hi"] + 1e-6):
            err(f"{n}: coord {k}={v} outside [{L2['lo']},{L2['hi']}]")
    built[n] = ent

# prototype separation (weighted euclid in 5D)
W = dict(valence=1.0, arousal=1.0, stress=0.8, energy=0.8, dominance=0.5)
names = list(built)
for i, a in enumerate(names):
    for b in names[i + 1:]:
        pa, pb = built[a]["prototype"], built[b]["prototype"]
        dist = math.sqrt(sum(W[k] * (pa[k] - pb[k]) ** 2 for k in W))
        need = 0.5 * (built[a]["margin"] + built[b]["margin"])
        if dist < need and not (built[a].get("transient") or built[b].get("transient")):   # transient reactions are event-triggered, never picked by nearest prototype
            err(f"prototypes too close: {a} ~ {b} dist {dist:.3f} < {need:.3f}")

# ---------- activities
acts = ACT["activities"]
# motive x act weights (percent) are the source of truth for rewards (+) and drain (-)
_mm = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "motive_matrix.json"))) if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "motive_matrix.json")) else None
if _mm:
    for n, row in _mm["matrix"].items():
        if n not in acts:
            err(f"motive_matrix: unknown act {n}"); continue
        acts[n]["rewards"] = {m: round(v / 100, 4) for m, v in row.items() if v > 0}
        acts[n]["drain"] = {m: round(-v / 100 * _mm["drainUnit"], 6) for m, v in row.items() if v < 0}
known_m = set(MOTIVES + EXTRA_MOTIVES)
cats = set()
for n, a in acts.items():
    for f in ("kind", "trivial", "category", "rewards", "drain", "baseMinutes"):
        if f not in a:
            err(f"activity {n}: missing {f}")
    if a.get("kind") not in ("normal", "erratic"):
        err(f"activity {n}: kind must be normal|erratic")
    for m in list(a.get("rewards", {})) + list(a.get("drain", {})):
        if m not in known_m:
            err(f"activity {n}: unknown motive {m}")
    for em in a.get("emotionPull", {}):
        if em not in built:
            err(f"activity {n}: emotionPull references unknown emotion {em}")
    cats.add(a.get("category"))
for c in cats:
    if c not in OUT["categories"]:
        err(f"outcomes.json has no distribution for category '{c}'")
for c, v in OUT["categories"].items():
    if abs(sum(v["p"].values()) - 1) > 1e-6:
        err(f"outcomes {c}: probabilities sum to {sum(v['p'].values())}")

# ---------- chains / ledger / hazards
for n, ch in CH["chains"].items():
    if ch["kind"] not in ("normal", "abnormal"):
        err(f"chain {n}: kind")
    for s in ch["steps"]:
        if s["act"] not in acts:
            err(f"chain {n}: unknown act {s['act']}")
    if ch["reward"] not in LED["events"]:
        err(f"chain {n}: reward event '{ch['reward']}' not in ledger_events")
    for em in ch.get("trigger", {}).get("emotion", []):
        if em not in built:
            err(f"chain {n}: trigger emotion '{em}' unknown")
    for br in ch.get("branches", []) + ch.get("next", []):
        if br["to"] != "@resume" and br["to"] not in CH["chains"]:
            err(f"chain {n}: branch target '{br['to']}' unknown")
    for w in ch.get("window", []):
        if not (0 <= w[0] < w[1] <= 1800):
            err(f"chain {n}: bad window {w}")
for n, ev_ in LED["events"].items():
    for k in ev_.get("deltas", {}):
        if k not in LED["traces"]:
            err(f"ledger event {n}: unknown trace '{k}'")
    for k in ev_.get("neuro", {}):
        if k not in NEU["vars"]:
            err(f"ledger event {n}: unknown neuro var '{k}'")
    if ev_["kind"] not in LED["kindWeight"]:
        err(f"ledger event {n}: kind")
for n, h in HAZ["events"].items():
    if h["ledger"] not in LED["events"]:
        err(f"hazard {n}: ledger event '{h['ledger']}' unknown")
for t, row in STAB["coupling"].items():
    if t == "doc":
        continue
    if t not in LED["traces"]:
        err(f"coupling: unknown trace {t}")
    if sum(row.values()) > 1.0001:
        err(f"coupling {t}: row sums > 1")
    for m in row:
        if m not in known_m:
            err(f"coupling {t}: unknown motive {m}")
for r, row in STAB["regimeTransitions"].items():
    if r not in STAB["regimes"]:
        err(f"regime {r} unknown")

# erratic weighting sanity: erratic events must outweigh normal in total magnitude
def mag(e):
    return sum(abs(x) for x in e.get("deltas", {}).values())
if LED["kindWeight"]["erratic"] <= LED["kindWeight"]["normal"]:
    err("kindWeight: erratic must exceed normal (owner rule)")

if "--check" in sys.argv or errors:
    pass

if errors:
    print("VALIDATION FAILED")
    for e in errors:
        print(" -", e)
    sys.exit(1)

for w in warns:
    print("warn:", w)
if "--check" in sys.argv:
    print(f"OK: {len(built)} emotions, {len(acts)} activities, {len(CH['chains'])} chains, {len(LED['events'])} ledger events")
    sys.exit(0)

# ---------- write generated JS
os.makedirs(GEN_DIR, exist_ok=True)
HDR = "// GENERATED by tools/emotions/gen.py from tools/emotions/*.json. Do not edit by hand.\n"


def js(path, parts):
    with open(os.path.join(GEN_DIR, path), "w") as f:
        f.write(HDR)
        for name, obj in parts:
            f.write(f"export const {name} = {json.dumps(obj, indent=1)};\n")
    print("wrote", path)


js("emotions.gen.js", [("EMOTIONS", built), ("POSTURE_MATRIX_FULL", matrix), ("POSTURE_MATRIX_LEGACY", legacy_matrix), ("MUSIC_EXTRA", music_extra),
                       ("FACE_MAP", face_map), ("FACE_TEXTURES", sorted({v for v in face_map.values()} | {"sleep"})),
                       ("EMOTION_INPUTS", EM["inputs"]), ("RIG", {k: v for k, v in RIG["landmarks"].items()})])
legacy_aff = {}
for n, a in acts.items():
    if a.get("station"):
        legacy_aff[n] = dict(rewards=a["rewards"], drain=a["drain"], rate=a["rate"], minDur=a["minDur"], cooldown=a["cooldown"], category=a["label"])
_fol = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "follow.json")))
for _k in list(_fol["pairs"]):
    _a, _b = _k.split(">")
    if _a not in acts or _b not in acts:
        err(f"follow.json: unknown act in {_k}")
_acls_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../data/atus_classes.json")
_acls = json.load(open(_acls_path))["acts"] if os.path.exists(_acls_path) else {}
_feel = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "act_feel.json")))["acts"]
js("feel.gen.js", [("FEEL", {k: {"v": x["valence"], "s": x["stress"]} for k, x in _feel.items()})])
js("follow.gen.js", [("FOLLOW", {"pairs": _fol["pairs"], "cats": _fol["cats"], "hourShape": _fol.get("hourShape", {}), "actClass": _acls})])
js("activities.gen.js", [("ACTIVITIES", acts), ("STATION_AFFORDANCES", legacy_aff), ("TIME_SCALE", ACT["timeScale"])])
_wm = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "world_model.json")))
_wm.pop("doc", None)
for _a in list(_wm["acts"]) + [n["act"] for n in _wm["needs"]]:
    if _a not in acts:
        err(f"world_model.json: unknown act {_a}")
for _a, _r in _wm["acts"].items():
    for _k in ("guard", "pre", "soft", "eff", "fail"):
        for _f in (_r.get(_k) or {}):
            if _f not in _wm["fluents"]:
                err(f"world_model.json: {_a}.{_k} uses unknown fluent {_f}")
    if "softKeep" in _r and not (isinstance(_r["softKeep"], (int, float)) and 0 <= _r["softKeep"] <= 1.5):
        err(f"world_model.json: {_a}.softKeep must be a number in 0..1.5")
_in = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "intentions.json")))
_in.pop("doc", None)
for _i, _r in _in["intentions"].items():
    for _a in _r["acts"] + _r.get("done", []):
        if _a not in acts:
            err(f"intentions.json: {_i} uses unknown act {_a}")
    if _r.get("on") and _r["on"]["fluent"] not in _wm["fluents"]:
        err(f"intentions.json: {_i}.on uses unknown fluent {_r['on']['fluent']}")
    if not (len(_r.get("window", [])) == 2 and 0 <= _r["window"][0] < _r["window"][1] <= 24):
        err(f"intentions.json: {_i}.window must be [from, to] hours within one day")
for _e in ("intention_kept", "intention_broken"):
    if _e not in LED["events"]:
        err(f"intentions: ledger event {_e} missing from ledger_events.json")
js("world.gen.js", [("WORLD_MODEL", _wm), ("INTENTIONS", _in), ("NEURO", NEU), ("LEDGER", LED), ("CHAINS", CH["chains"]), ("CHAIN_DEFAULTS", CH.get("defaults", {})), ("STABILITY", STAB), ("OUTCOMES", OUT), ("HAZARDS", HAZ["events"]), ("INVENTORY", INV)])

tune_path = os.path.join(HERE, "tune.json")
tune = {k: v for k, v in json.load(open(tune_path)).items() if k != "doc"} if os.path.exists(tune_path) else {}
js("tune.gen.js", [("TUNE_DEFAULTS", tune)])

# faces for export_face.py
faces = {n: dict(expression=e["expression"], eyes_open=e["face"]["eyes_open"], gaze=e["face"]["gaze"]) for n, e in built.items() if not e["existing"]}
with open(os.path.join(HERE, "faces.gen.json"), "w") as f:
    json.dump(faces, f, indent=1)

# report
lines = ["# Emotion report (generated)", "", f"{len(built)} emotions, {len(acts)} activities, {len(CH['chains'])} chains.", "",
         "| emotion | v | a | st | e | dom | face | texture | tempo | breath Hz | spine rad | chest rad |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
for n, e in built.items():
    p = e["prototype"]
    lines.append(f"| {n} | {p['valence']} | {p['arousal']} | {p['stress']} | {p['energy']} | {p['dominance']} | {e['face']['expression']} | {face_map[n]} | {e['tempo']} | {e['breathHzRange']} | {e['spineSlumpRad']} | {e['chestExpandRad']} |")
lines += ["", "## Body coordinates", "", "| emotion | " + " | ".join(RIG["landmarks"]) + " |", "|---|" + "---|" * len(RIG["landmarks"])]
for n, e in built.items():
    lines.append(f"| {n} | " + " | ".join(str(round(e["coords"][k], 2)) for k in RIG["landmarks"]) + " |")
lines += ["", "## Activities by kind / trivial", ""]
for kind in ("normal", "erratic"):
    for tr in (True, False):
        ns = [n for n, a in acts.items() if a["kind"] == kind and a["trivial"] == tr]
        lines.append(f"- {kind} / {'trivial' if tr else 'non-trivial'} ({len(ns)}): {', '.join(ns)}")
with open(os.path.join(HERE, "report.md"), "w") as f:
    f.write("\n".join(lines) + "\n")

# schematic contact sheet (SVG) drawn from the coordinates
cell, cols = 150, 6
rows = (len(built) + cols - 1) // cols
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{cols*cell}" height="{rows*(cell+24)}" font-family="sans-serif" font-size="11">', '<rect width="100%" height="100%" fill="#faf8f2"/>']
for i, (n, e) in enumerate(built.items()):
    c = e["coords"]
    cx, cy = (i % cols) * cell + cell / 2, (i // cols) * (cell + 24) + 70
    o = c["eyelid_open"]
    svg.append(f'<ellipse cx="{cx}" cy="{cy}" rx="38" ry="48" fill="#e9c9a8" stroke="#222" stroke-width="2"/>')
    for sx in (-1, 1):
        ex, ey = cx + sx * 16, cy - 8
        svg.append(f'<ellipse cx="{ex}" cy="{ey}" rx="8" ry="{1+6*o:.1f}" fill="#fff" stroke="#222"/>')
        svg.append(f'<circle cx="{ex + c["gaze_x"]*3:.1f}" cy="{ey + c["gaze_y"]*2:.1f}" r="{1.5+2.2*c["pupil_size"]:.1f}" fill="#222"/>')
        iy = cy - 20 - c["brow_inner_y"] * 7
        oy = cy - 20 - c["brow_outer_y"] * 7
        svg.append(f'<line x1="{cx+sx*6}" y1="{iy:.1f}" x2="{cx+sx*26}" y2="{oy:.1f}" stroke="#222" stroke-width="2.5"/>')
        svg.append(f'<ellipse cx="{cx+sx*40}" cy="{cy-4 - c["ear_forward"]*4:.1f}" rx="4" ry="9" fill="#e9c9a8" stroke="#222"/>')
    mw = 8 + 14 * c["mouth_width"]
    my = cy + 26
    mc = -c["mouth_corner_y"] * 8
    mo = c["mouth_open"] * 8
    svg.append(f'<path d="M{cx-mw:.1f} {my+mc:.1f} Q{cx} {my-mc+mo:.1f} {cx+mw:.1f} {my+mc:.1f}" fill="none" stroke="#222" stroke-width="2.5"/>')
    svg.append(f'<text x="{cx}" y="{cy+66}" text-anchor="middle" fill="#222">{n}</text>')
svg.append("</svg>")
with open(os.path.join(HERE, "faces_sheet.svg"), "w") as f:
    f.write("\n".join(svg))
print("wrote report.md, faces.gen.json, faces_sheet.svg")
