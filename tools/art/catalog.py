#!/usr/bin/env python3
"""Build the art-making catalog from the Infinite engine's own description of every node.
  python3 catalog.py            # reads infinite_nodes.raw.json (made by: Infinite --describe --json <file>)
Writes: node_catalog.json (nodes, params, slots), graph_rules.json (what can wire into what, per kind and category),
        param_semantics.json (every param key -> semantic axis -> emotion coordinate weights), catalog_report.md.
Nothing here is guessed: kinds, ranges, options and slots come from the binary."""
import json, os, re, sys
from collections import Counter, defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
raw = json.load(open(os.path.join(HERE, "infinite_nodes.raw.json")))

# ---- role: what a node DOES in a chain (behaviour class). Rules are ordered; first match wins. ----
ROLE_RULES = [
 ("output",     r"^(Output|Audio Out|Render 3D|Scope|Viewer)"),
 ("combine_add",r"^(Add|Mix|Mixer|Layer Stack|Join Geometry|Group 3D|Screen|Sum|Merge)$|Add$"),
 ("combine_sub",r"(Subtract|Difference|Multiply|Divide|Min$|Max$)"),
 ("boolean",    r"(Union|Intersect|Boolean|Xor|And$|Or$|Not$)"),
 ("blend",      r"(Blend|Composite|Over|Matte|Key$|Mask)"),
 ("modulator",  None),                                           # by category
 ("source",     None), ("generator", None),
 ("filter",     None), ("geometry_op", None), ("analyzer", None), ("audio_fx", None), ("synth", None), ("note", None), ("utility", None), ("macro", None), ("prediction", None),
]
CAT_ROLE = {"Source": "source", "Modulators": "modulator", "Effects": "filter", "Compositing": "blend", "3D": "geometry_op",
            "AudioEffects": "audio_fx", "Synths": "synth", "Notes": "note", "Utility": "utility", "Macros": "macro", "Prediction": "prediction"}
GEN3D = re.compile(r"^(Cube|Sphere|Plane|Cone|Cylinder|Capsule|Disc|Prism|Pyramid|Helix|Icosphere|Octahedron|Dodecahedron|Torus|Curve|Particle System|Ocean|Gear 3D|Arrow 3D|Klein Bottle|Mobius Strip|Rounded Cube|Geometry|Model 3D|Field Primitive|Distribute)")
def role_of(t):
    n, c = t["type"], t["category"]
    for role, rx in ROLE_RULES:
        if rx and re.search(rx, n): return role
    if c == "3D" and GEN3D.search(n): return "generator"
    if c == "3D" and not t["inputs"]: return "generator"
    if c == "Source": return "source"
    if re.search(r"Analy|Meter|Detect|Follow|Spectrum", n): return "analyzer"
    return CAT_ROLE.get(c, "utility")

# ---- param semantics: which perceptual axis a parameter drives; weights are emotion coordinates (V,A,ST,E,D). ----
AXES = [
 ("speed",     r"rate|speed|freq|hz|tempo|bpm|period|beats|scroll|spin|rot.*speed|flow",           dict(A=0.8, E=0.4)),
 ("amount",    r"amount|depth|intensity|strength|mix|wet|gain|level|amp|volume|opacity|alpha|gamma|drive", dict(E=0.6, D=0.4, A=0.3)),
 ("size",      r"size|scale|radius|width|height|zoom|length|thick|diam|spread",                   dict(D=0.7, E=0.3)),
 ("noise",     r"noise|jitter|random|seed|chaos|grain|turb|rough|distort|warp|glitch|scatter",    dict(ST=0.8, A=0.4)),
 ("softness",  r"blur|soft|smooth|feather|glow|bloom|haze|fog|diffus|slew|glide|feedback|decay|release|trail", dict(V=0.4, ST=-0.5, A=-0.3)),
 ("brightness",r"bright|exposure|lumin|white|light|lift|emiss|value$",                            dict(V=0.7, E=0.3)),
 ("hue",       r"hue|color|colour|tint|sat|chroma|palette|ramp",                                  dict(V=0.4, A=0.3)),
 ("contrast",  r"contrast|sharp|edge|thresh|clip|crush|hard|resonance|q$",                        dict(ST=0.5, D=0.5)),
 ("symmetry",  r"mirror|symm|kaleid|repeat|tile|array|count|steps|segments|copies|instances",    dict(D=0.2, ST=-0.4, V=0.2)),
 ("shape",     r"shape|wave|type|mode|kind|style|waveform|curve|ease|interp",                     dict()),
 ("position",  r"^x$|^y$|^z$|pos|offset|translate|center|centre|pivot|origin|phase|delay|time",    dict(A=0.1)),
 ("pitch",     r"pitch|note|octave|semi|cutoff|tone|filter",                                      dict(A=0.5, V=0.2)),
]
def axis_of(key, label):
    s = (key + " " + (label or "")).lower()
    for ax, rx, w in AXES:
        if re.search(rx, s): return ax, w
    return "other", {}

catalog, sem = {}, {}
kinds_in, kinds_out = defaultdict(list), defaultdict(list)
for t in raw["types"]:
    mod = {m["key"]: m for m in t.get("modulatable", []) if m.get("key")}
    params = []
    for r in t["rows"]:
        if not r.get("ui"): continue
        m = mod.get(r["key"], {})
        kind = "enum" if r["options"] else ("bool" if r["tag"] == "b" else ("color" if r["tag"] == "c" else ("text" if r["tag"] == "s" else ("int" if r["tag"] == "i" else "float"))))
        ax, w = axis_of(r["key"], r.get("label"))
        p = dict(key=r["key"], label=r.get("label"), kind=kind, default=r["default"], min=r["min"], max=r["max"], step=r["step"], modulatable=r["key"] in mod, axis=ax)
        if r["options"]: p["options"] = r["options"]
        params.append(p); sem.setdefault(ax, w)
    node = dict(type=t["type"], category=t["category"], role=role_of(t), hardware=t["hardware_driven"], can_bypass=t["can_bypass"],
                inputs=[dict(slot=i["slot"], name=i["name"], kind=i["kind"]) for i in t["inputs"]],
                outputs=[dict(output=o["output"], label=o["label"], kind=o["kind"]) for o in t["outputs"]], params=params)
    catalog[t["type"]] = node
    for i in node["inputs"]: kinds_in[i["kind"]].append(t["type"])
    for o in node["outputs"]: kinds_out[o["kind"]].append(t["type"])

# ---- graph rules: a cable is legal when kinds match. Summarise at kind level and category level. ----
rules = {"wire_kinds": sorted(set(kinds_in) | set(kinds_out)),
         "accepts": {k: sorted(set(v)) for k, v in kinds_in.items()}, "produces": {k: sorted(set(v)) for k, v in kinds_out.items()},
         "modulation": {"sources": sorted(t for t, n in catalog.items() if any(o["kind"] == "modulator" for o in n["outputs"])),
                        "binding": "mod <dst> <param> <src> <srcOutput> <polarity> <depth> <centre>  (param must be modulatable); depth/centre are 0..1",
                        "polarity": [0, 1]},
         "bypass": sorted(t for t, n in catalog.items() if n["can_bypass"]),
         "never_bypass_multi_input": True}
cat_flow = Counter()
for t, n in catalog.items():
    for o in n["outputs"]:
        for u in kinds_in.get(o["kind"], []): cat_flow[(n["category"], catalog[u]["category"])] += 1
rules["category_flow"] = {f"{a}>{b}": c for (a, b), c in sorted(cat_flow.items(), key=lambda x: -x[1])}

# ---- the actor's verbs over a chain; each becomes an activity in the sim (see art_activities.json) ----
VERBS = [
 dict(verb="add_node", needs="type", note="pick a type by role and what the open chain end can accept"),
 dict(verb="wire", needs="src,dst,slot", note="legal when output kind == input slot kind"),
 dict(verb="set_param", needs="node,param,value01", note="value01 in 0..1 maps to min..max (enum: index; bool: threshold)"),
 dict(verb="modulate", needs="node,param,source,depth,centre,polarity", note="only on modulatable params"),
 dict(verb="bypass", needs="node", note="single-input nodes only"),
 dict(verb="split", needs="node,branches", note="fan one output into several branches of different roles"),
 dict(verb="merge", needs="branches,combiner", note="join branches with a combine_* / blend / boolean node"),
 dict(verb="swap_type", needs="node,type", note="replace with a same-kind node"),
 dict(verb="remove_node", needs="node"),
 dict(verb="duplicate", needs="node"),
 dict(verb="seed_roll", needs="node", note="re-roll a seed param"),
 dict(verb="look", needs="", note="render a frame/contact sheet and read frame_stats (mean_luma etc.)"),
 dict(verb="finish", needs="", note="validate, lay out, render, put in the gallery"),
]
json.dump(catalog, open(os.path.join(HERE, "node_catalog.json"), "w"), indent=1)
json.dump(dict(rules, verbs=VERBS), open(os.path.join(HERE, "graph_rules.json"), "w"), indent=1)
json.dump(dict(doc="Param axis -> weights over emotion coordinates V (valence) A (arousal) ST (stress) E (energy) D (dominance). A positive weight means: higher coordinate pushes the param value up.", axes=sem), open(os.path.join(HERE, "param_semantics.json"), "w"), indent=1)

roles = Counter(n["role"] for n in catalog.values()); axes = Counter(p["axis"] for n in catalog.values() for p in n["params"])
kinds = Counter(p["kind"] for n in catalog.values() for p in n["params"])
rep = ["# Infinite node catalog", "", f"{len(catalog)} node types, {sum(len(n['params']) for n in catalog.values())} UI params, {sum(1 for n in catalog.values() for p in n['params'] if p['modulatable'])} modulatable.", "",
       "## Roles", *[f"- {r}: {c}" for r, c in roles.most_common()], "", "## Param kinds", *[f"- {k}: {c}" for k, c in kinds.most_common()], "", "## Param axes (emotion-mappable)", *[f"- {a}: {c}" for a, c in axes.most_common()], "",
       "## Wire kinds", *[f"- {k}: {len(rules['produces'].get(k, []))} producers, {len(rules['accepts'].get(k, []))} consumers" for k in rules["wire_kinds"]], "",
       "## Top category flows", *[f"- {k}: {v}" for k, v in list(rules["category_flow"].items())[:15]]]
open(os.path.join(HERE, "catalog_report.md"), "w").write("\n".join(rep))
print("\n".join(rep[:45]))
