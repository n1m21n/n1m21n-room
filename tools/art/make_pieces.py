#!/usr/bin/env python3
"""Render N of his pieces (axes from executor.py, seeded) to site/public/art/sim/piece-<n>.webp + manifest.json.
The live site shows them on the desk monitor while he is in an art act (?sim=1|life)."""
import json, os, random, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
import executor
from PIL import Image

N = int(sys.argv[1]) if len(sys.argv) > 1 else 12
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'site', 'public', 'art', 'sim')
os.makedirs(OUT, exist_ok=True)
taste = json.load(open(os.path.join(os.path.dirname(__file__), 'taste.json')))['guideline']['axes']
man = []
for n in range(N):
    r = random.Random(1000 + n)
    axes = {k: min(1, max(0, v + r.uniform(-.3, .3))) for k, v in taste.items()}
    with tempfile.TemporaryDirectory() as d:
        inf = os.path.join(d, 'p.inf'); open(inf, 'w').write(executor.build(axes, n))
        rc, msg = executor.run('--frame', inf, '1', d)
        if rc: print(msg); sys.exit(rc)
        png = [f for f in os.listdir(d) if f.startswith('frame_')][0]
        Image.open(os.path.join(d, png)).convert('RGB').resize((640, 640)).save(os.path.join(OUT, f'piece-{n}.webp'), quality=85)
    man.append({'file': f'piece-{n}.webp', 'axes': {k: round(v, 3) for k, v in axes.items()}})
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print('wrote', N, 'pieces to', os.path.normpath(OUT))
