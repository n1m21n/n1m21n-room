#!/usr/bin/env python3
"""Index the local Mutopia MIDI set: title, composer, instrument and licence from each piece's .ly header on mutopiaproject.org.
Output: tools/music/mutopia_index.json (cached; re-run only fetches what is missing)."""
import json, os, re, time, urllib.request
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
MID = os.path.join(ROOT, 'data', 'raw', 'midi', 'mutopia'); OUT = os.path.join(os.path.dirname(__file__), 'mutopia_index.json')
idx = json.load(open(OUT)) if os.path.exists(OUT) else {}
def get(u):
    for _ in range(3):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'n1m21n-personal-research'}), timeout=30).read().decode('utf8', 'ignore')
        except Exception: time.sleep(2)
    return ''
for dp, _, fs in os.walk(MID):
    for f in sorted(fs):
        if not f.endswith('.mid'): continue
        rel = os.path.relpath(os.path.join(dp, f), MID)
        if rel in idx: continue
        ly = get('https://www.mutopiaproject.org/ftp/' + rel[:-4] + '.ly'); time.sleep(0.15)
        g = lambda k: (re.search(r'\b' + k + r'\s*=\s*"([^"]*)"', ly) or [None, ''])[1]
        idx[rel] = {'title': g('mutopiatitle') or g('title'), 'composer': g('mutopiacomposer'), 'instrument': g('mutopiainstrument'), 'licence': g('copyright'), 'ok': bool(ly)}
json.dump(idx, open(OUT, 'w'), indent=1)
print(len(idx), 'indexed')
