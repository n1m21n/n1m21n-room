#!/usr/bin/env python3
"""Face textures for the 3D man, drawn by the signed-off 2D code (ek-pinjare-mai lib/man2d.py: eye, nose, spiral).
Maps man2d canvas px -> head UV the same way tools/build_man.py projects the head (front planar, 0.30 m window):
  x = (px - 636) * S,  z = 1.76 - (py - 146) * S   (metres, S = 0.00081 m per 2D px);  u = .5 + x/.3,  v = .5 + (z-1.64)/.3
Run:  ~/infinite-launch-video/.venv/bin/python tools/export_face.py [expr ...]"""
import os, subprocess, sys
import numpy as np
from PIL import Image

FILM = os.path.expanduser("~/music videos/ek-pinjare-mai")
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site", "public", "media", "man")
sys.path.insert(0, FILM)
os.chdir(FILM)
from lib import man2d as M                      # noqa: E402
from lib.riso import Plates, poly, hexc         # noqa: E402

N = 1024
S, WIN = 0.00081, 0.30
K = N * S / WIN                                  # 2D px -> texture px
TX, TY = (N / 2) / K - 636, (N * (0.5 - (1.76 - 1.64) / WIN)) / K - 146

FACES = dict(                                    # name -> (expression, eyes_open, gaze)
    neutral=("neutral", 1.0, (0.0, 0.1)),
    calm=("calm", 0.8, (0.0, 0.2)),
    curious=("curious", 1.0, (0.2, -0.2)),
    delighted=("delighted", 1.0, (0.0, 0.1)),
    uneasy=("uneasy", 1.0, (-0.3, 0.1)),
    sleep=("calm", 0.0, (0.0, 0.0)),
    alarm=("alarm", 1.0, (0.0, 0.0)),
    dazed=("dazed", 0.75, (0.2, 0.2)),
    given_up=("given_up", 0.6, (0.0, 0.3)),
)


def features(P, ex, eyes_open, gaze):
    M.eye(P, (578, 276), -38, 13, gaze, open_=eyes_open, ex=ex)
    M.eye(P, (698, 272), 37, 13, gaze, open_=eyes_open, ex=ex)
    if eyes_open < 0.1:                                                  # closed: just the heavy lid line
        for cx, sx in ((578, -1), (698, 1)):
            P.line(poly([(cx - 38, 276), (cx, 284), (cx + 38, 276)], closed=False, smooth=True), 6.0)
    nose = poly([(640, 282), (654, 284), (668, 322), (680, 344), (674, 360), (652, 364), (628, 360), (620, 348),
                 (630, 336), (638, 316)], smooth=True)
    P.fill(nose, hexc(M.sk("nose")), 0)
    P.line(poly([(654, 284), (668, 322), (681, 344), (674, 360), (656, 364)], closed=False, smooth=True), 3.8)
    P.line(poly([(620, 348), (632, 358), (646, 356)], closed=False, smooth=True), 3.4)
    P.ink_fill(M.ellipse_path(642, 354, 5, 3.2))
    e = dict(M.EXPR0); e.update(ex or {})
    M.spiral(P, (632, 384), e["sp_r"], e["sp_turns"], 0.0, e["sp_sq"], e["mouth"])


def export(name):
    ename, eyes_open, gaze = FACES[name]
    P = Plates(N, N, K, 0)
    for c in (P.f, P.k):
        c.translate(TX, TY)
    features(P, M.EXPRS[ename], eyes_open, gaze)
    F = P.F.makeImageSnapshot().toarray().astype(np.float32) / 255       # RGBA premultiplied
    Kp = P.K.makeImageSnapshot().toarray().astype(np.float32) / 255
    skin = np.array([int(M.C["skin"][i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)
    out = skin * (1 - F[..., 3:4]) + F[..., :3]
    out = out * (1 - Kp[..., 3:4]) + Kp[..., :3]
    rgb = (np.clip(out, 0, 1) * 255).astype(np.uint8)
    os.makedirs(OUT, exist_ok=True)
    png = os.path.join(OUT, f"face-{name}.png")
    Image.fromarray(rgb, "RGB").save(png)
    subprocess.run(["cwebp", "-quiet", "-q", "88", png, "-o", png[:-4] + ".webp"], check=True)
    os.remove(png)
    print(name, os.path.getsize(png[:-4] + ".webp") // 1024, "KB")


for n in sys.argv[1:] or list(FACES):
    export(n)
