#!/usr/bin/env python3
"""Fit class-level behaviour from ATUS diaries: transition lifts, duration, hour-of-day shape, and Well-Being affect per class.
Output: tools/data/atus_fit.json (class level; apply_fit.py turns it into follow.json / matrix cells)."""
import csv, json, math, os, sys, collections
R = os.path.expanduser('~/music videos/n1m21n-room/data/raw/atus'); H = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(H + '/atus_classes.json')); PRE = M['prefix']
cache = {}
def cls(code):
    if code in cache: return cache[code]
    c = 'other'
    for n in range(6, 1, -1):
        if code[:n] in PRE: c = PRE[code[:n]]; break
    cache[code] = c; return c
def hm(s): h, m, _ = s.split(':'); return int(h) * 60 + int(m)
# ---- diaries
trans = collections.Counter(); marg = collections.Counter(); first = collections.Counter(); dur = collections.defaultdict(list); hours = collections.defaultdict(lambda: [0] * 24)
code_of = {}; cases = 0
cur = None; seq = []
def flush():
    global seq
    s = [x for x in seq if x[0] != 'other']
    for i, (c, st, d) in enumerate(s):
        marg[c] += 1; dur[c].append(d); hours[c][(st // 60) % 24] += 1
        if i + 1 < len(s): trans[(c, s[i + 1][0])] += 1
    seq = []
with open(R + '/atusact-0324/atusact_0324.dat') as f:
    rd = csv.DictReader(f)
    for r in rd:
        cid = r['TUCASEID']
        if cid != cur:
            if cur is not None: flush(); cases += 1
            cur = cid
        code = r['TRCODEP'].zfill(6); c = cls(code)
        code_of[(cid, r['TUACTIVITY_N'])] = (code, c)
        # merge consecutive episodes of one class
        st = hm(r['TUSTARTTIM']); d = int(r['TUACTDUR24'])
        if seq and seq[-1][0] == c: seq[-1] = (c, seq[-1][1], seq[-1][2] + d)
        else: seq.append((c, st, d))
flush(); cases += 1
print('diaries', cases, 'episodes', sum(marg.values()), file=sys.stderr)
tot = sum(marg.values()); pairs = sum(trans.values())
nxt = collections.Counter()
for (a, b), n in trans.items(): nxt[b] += n
lift = {}
for (a, b), n in trans.items():
    pa = sum(v for (x, y), v in trans.items() if x == a)
    if n >= 200 and pa >= 500: lift[a + '>' + b] = round((n / pa) / (nxt[b] / pairs), 3)
# ---- well-being
aff = collections.defaultdict(lambda: collections.defaultdict(float)); wsum = collections.defaultdict(float)
V = ['WUHAPPY', 'WUSTRESS', 'WUTIRED', 'WUSAD', 'WUPAIN', 'WUMEANING']
with open(R + '/wbact_1013/wbact_1013.dat') as f:
    for r in csv.DictReader(f):
        k = (r['TUCASEID'], r['TUACTIVITY_N']); 
        if k not in code_of: continue
        c = code_of[k][1]; w = float(r['WUFNACTWT'])
        if w <= 0: continue
        ok = True; vals = {}
        for v in V:
            x = float(r[v]);
            if x < 0: ok = False; break
            vals[v] = x
        if not ok: continue
        wsum[c] += w
        for v in V: aff[c][v] += w * vals[v]
        aff[c]['n'] += 1
wb = {c: {**{v[2:].lower(): round(aff[c][v] / wsum[c], 3) for v in V}, 'n': int(aff[c]['n'])} for c in aff if aff[c]['n'] >= 100}
tw = sum(wsum.values()); allm = {v[2:].lower(): round(sum(aff[c][v] for c in aff) / tw, 3) for v in V}
fit = {
  'source': 'ATUS 2003-2024 activity file (diaries) + ATUS Well-Being Module 2010/2012/2013 activity file', 'diaries': cases, 'episodes': tot,
  'minute_share': {c: round(sum(v) / sum(sum(x) for x in dur.values()), 4) for c, v in sorted(dur.items(), key=lambda kv: -sum(kv[1]))},
  'share': {c: round(n / tot, 4) for c, n in marg.most_common()},
  'duration_min': {c: {'median': sorted(v)[len(v) // 2], 'mean': round(sum(v) / len(v), 1)} for c, v in dur.items() if len(v) > 200},
  'hour_shape': {c: [round(x / sum(h), 4) for x in h] for c, h in hours.items() if sum(h) > 1000},
  'lift': lift, 'wellbeing': wb, 'wellbeing_mean': allm,
}
json.dump(fit, open(H + '/atus_fit.json', 'w'), indent=0)
print('classes', len(marg), 'lifts', len(lift), 'wb classes', len(wb), file=sys.stderr)
