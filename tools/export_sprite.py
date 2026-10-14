#!/usr/bin/env python3
"""Export the signed-off 2D man (ek-pinjare-mai lib/man2d.py) as transparent webp sprites for the site.
Run from anywhere with the film venv:  ~/infinite-launch-video/.venv/bin/python tools/export_sprite.py [pose ...]"""
import os, subprocess, sys
import numpy as np
from PIL import Image

FILM = os.path.expanduser("~/music videos/ek-pinjare-mai")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site", "public", "media", "sprites")
sys.path.insert(0, FILM)
os.chdir(FILM)
from lib import man2d as M          # noqa: E402
from lib.riso import Plates         # noqa: E402


def export(name, pose):
    P = Plates(M.CW, M.CH, 1.0, 0)
    M.draw_man(P, pose)
    rgb = P.compose("#F1E9D2", offset=(3, 2), coverage=0.12, grain=1.0, seed=3)
    F = P.F.makeImageSnapshot().toarray()[..., 3]
    K = P.K.makeImageSnapshot().toarray()[..., 3]
    a = np.maximum(np.roll(np.roll(F, 2, 0), 3, 1), K)          # include the misregistered colour plate
    img = Image.fromarray(np.dstack([rgb[..., :3], a]), "RGBA")
    img = img.crop(img.getbbox())
    img.thumbnail((600, 800))
    png = os.path.join(OUT, f"man-{name}.png")
    img.save(png)
    subprocess.run(["cwebp", "-quiet", "-q", "85", "-alpha_q", "90", png, "-o", png[:-4] + ".webp"], check=True)
    os.remove(png)
    print(name, img.size)


names = sys.argv[1:] or ["seated", "bob", "delighted"]
for n in names:
    export(n, M.POSES[n])
