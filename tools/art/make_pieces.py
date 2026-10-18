#!/usr/bin/env python3
"""Render N of his pieces (graph_builder, seeded) to site/public/art/sim/piece-<n>.webp + manifest.json.
The live site shows them on the desk monitor while he is in an art act (?sim=1|life).
Look step: each frame is read back (coverage, brightness, colour spread); flat or empty ones are re-rolled (up to 6 seeds).
  make_pieces.py [N] [--out DIR] [--sheet FILE]     (--out defaults to site/public/art/sim; use a scratch dir for review)"""
import argparse, json, os, random, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
import executor
from PIL import Image, ImageStat

ap = argparse.ArgumentParser(); ap.add_argument('n', nargs='?', type=int, default=12)
ap.add_argument('--out'); ap.add_argument('--sheet'); ap.add_argument('--t', default='6')
o = ap.parse_args()
HERE = os.path.dirname(__file__)
OUT = o.out or os.path.join(HERE, '..', '..', 'site', 'public', 'art', 'sim')
os.makedirs(OUT, exist_ok=True)
taste = json.load(open(os.path.join(HERE, 'taste.json')))['guideline']['axes']


def look(im):
    """-> (ok, stats). Flat = near-black, blown out, or one colour wash."""
    g = im.convert('L').resize((128, 128)); lum = ImageStat.Stat(g).mean[0] / 255
    px = list(g.getdata()); lit = sum(1 for p in px if p > 40) / len(px); sd = ImageStat.Stat(g).stddev[0] / 255
    return 0.06 < lum < 0.75 and 0.15 < lit < 0.95 and sd > 0.12, {'luma': round(lum, 3), 'lit': round(lit, 3), 'sd': round(sd, 3)}


man, thumbs = [], []
for n in range(o.n):
    for attempt in range(6):
        seed = 1000 + n + 97 * attempt
        r = random.Random(seed)
        axes = {k: min(1, max(0, v + r.uniform(-.3, .3))) for k, v in taste.items()}
        inf_text = executor.build(axes, seed)
        with tempfile.TemporaryDirectory() as d:
            inf = os.path.join(d, 'p.inf'); open(inf, 'w').write(inf_text)
            rc, msg = executor.run('--frame', inf, o.t, d)
            if rc: print(msg); sys.exit(rc)
            png = [f for f in os.listdir(d) if f.startswith('frame_')][0]
            im = Image.open(os.path.join(d, png)).convert('RGB').resize((640, 640))
        ok, st = look(im)
        if ok: break
        print(f'piece {n} attempt {attempt} flat {st}, re-rolling')
    im.save(os.path.join(OUT, f'piece-{n}.webp'), quality=85)
    open(os.path.join(OUT, f'piece-{n}.inf'), 'w').write(inf_text)
    thumbs.append(im.resize((320, 320)))
    head = [l for l in inf_text.splitlines() if l.startswith('# axes')][0]
    man.append({'file': f'piece-{n}.webp', 'axes': {k: round(v, 3) for k, v in axes.items()}, 'seed': seed, 'look': st, 'recipe': head[2:]})
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
if o.sheet:
    cols = 4; rows = (len(thumbs) + cols - 1) // cols
    s = Image.new('RGB', (cols * 320, rows * 320))
    for i, t in enumerate(thumbs): s.paste(t, ((i % cols) * 320, (i // cols) * 320))
    s.save(o.sheet)
print('wrote', o.n, 'pieces to', os.path.normpath(OUT))
