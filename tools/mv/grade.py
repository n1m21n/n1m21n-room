import json, sys, os, math, numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lights import L
ST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../build-cache/review/stills/')
def rgb(h): h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], float) / 255
def grade(name, flash_on=False):
  spec = L[name]; im = np.asarray(Image.open(ST + f'mv-{name}.png').convert('RGB'), float) / 255
  H, W = im.shape[:2]; A = json.load(open(ST + f'mv-{name}.json'))
  yy, xx = np.mgrid[0:H, 0:W]; xx = xx / W; yy = yy / H
  mask = np.zeros((H, W)); tint = np.zeros((H, W, 3)); add = np.zeros((H, W, 3))
  for where, r, col in spec.get('spots', []):
    if isinstance(where, str):
      if where == 'body': x, y = A['hips'][0], (A['head'][1] + A['hips'][1]) / 2
      elif where == 'head': x, y = A['head'][0], A['head'][1] - 0.12
      else: x, y = A[where][:2]
    else: x, y = where
    d = np.sqrt(((xx - x) * W / H) ** 2 + (yy - y) ** 2) / r
    m = np.clip(1.25 - d, 0, 1) ** 1.5
    # beam from the rig above to the spot
    if y > 0.2:
      t = np.clip(yy / max(y, 1e-3), 0, 1); half = r * 0.25 + r * 0.6 * t
      side = np.clip(1 - np.abs((xx - x) * W / H) / half, 0, 1) ** 2
      beam = side * np.clip(1 - (yy - y) / (r * 0.6), 0, 1) * 0.16 * np.clip(t, 0, 1) ** 1.5
      add += beam[..., None] * rgb(col)
    mask = np.maximum(mask, m); tint += m[..., None] * rgb(col)
  dark = spec['dark']
  base = im * dark * np.array([0.75, 0.75, 1.0])
  lit = im * (0.75 + 0.45 * np.clip(tint, 0, 1))
  out = base * (1 - mask[..., None]) + lit * mask[..., None] + add
  rng = np.random.default_rng(len(name))
  for i in range(spec.get('beams', 0)):              # rave rig: coloured cones from the top edge, lasers
    col = rgb(['#FF3EA5', '#3EE6FF', '#FFE14D', '#8A5BFF', '#FF6A3D'][i % 5])
    x0 = 0.1 + 0.8 * rng.random(); ang = (rng.random() - 0.5) * 1.2
    dx = xx - (x0 + np.tan(ang) * yy); w = 0.01 + 0.07 * yy
    cone = np.clip(1 - np.abs(dx) / w, 0, 1) * 0.35 * (1 - yy * 0.6)
    out += cone[..., None] * col
    if i % 2 == 0:
      lx = xx - (x0 + np.tan(-ang * 1.6) * yy); out += (np.abs(lx) < 0.0018)[..., None] * col * 0.9
  if flash_on and spec.get('flash'):              # beat pulse: the lights fire, the ground lifts ~0.1 in the pulse colour (no full-screen white)
    out = out + (out - base * (1 - mask[..., None])) * 0.6 + rgb(spec['flash']) * 0.10
  img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
  return img
if __name__ == '__main__':
  for n in L:
    grade(n).save(ST + f'mvL-{n}.png')
    if L[n].get('flash'): grade(n, True).save(ST + f'mvF-{n}.png')
  print('ok')
