#!/usr/bin/env python3
"""Artworks for the gallery halls: ../artworks (Instagram export) -> site/public/media/art/*.webp + data/art.json.
Skips Infinite / DAW promos. Halls are eras. Images now; videos get a poster frame + a 720p mp4 (played when near).
Run:  ~/infinite-launch-video/.venv/bin/python tools/export_art.py"""
import json, os, re, subprocess
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), "artworks")
OUT = os.path.join(ROOT, "site", "public", "media", "art")
DATA = os.path.join(ROOT, "site", "public", "data", "art.json")
SKIP = re.compile(r"infinite|\bdaw\b|node|launch|waitlist|beta", re.I)
HALLS = [  # id, title, years
    ("early", "early days · 2017–2021", range(2017, 2022)),
    ("y2022", "2022", [2022]),
    ("y2324", "2023–2024", [2023, 2024]),
    ("y2025", "2025", [2025]),
    ("y2026", "2026", [2026]),
]
MAX = 1024


def caption(meta):
    d = (meta.get("description") or "").strip().split("\n")[0]
    return d[:140]


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.dirname(DATA), exist_ok=True)
    works = []
    for f in sorted(os.listdir(SRC)):
        if not f.endswith((".jpg", ".mp4")):
            continue
        meta = {}
        if os.path.exists(os.path.join(SRC, f + ".json")):
            meta = json.load(open(os.path.join(SRC, f + ".json")))
        cap = caption(meta)
        if SKIP.search(cap):
            continue
        year = int(f[:4])
        hall = next(h for h, _, ys in HALLS if year in ys)
        stem = f.rsplit(".", 1)[0]
        poster = os.path.join(OUT, stem + ".webp")
        video = None
        if f.endswith(".mp4"):
            video = stem + ".mp4"
            if not os.path.exists(os.path.join(OUT, video)):
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(SRC, f), "-t", "8", "-an",
                                "-vf", "scale='min(480,iw)':-2,fps=24", "-c:v", "libx264", "-crf", "31", "-preset", "slow",
                                "-pix_fmt", "yuv420p", "-movflags", "+faststart", os.path.join(OUT, video)], check=True)
            if not os.path.exists(poster):
                png = poster[:-5] + ".png"
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(SRC, f), "-vf", "thumbnail=30",
                                "-frames:v", "1", png], check=True)
                im = Image.open(png).convert("RGB")
                im.thumbnail((MAX, MAX))
                im.save(poster, "WEBP", quality=80, method=6)
                os.remove(png)
        elif not os.path.exists(poster):
            im = Image.open(os.path.join(SRC, f)).convert("RGB")
            im.thumbnail((MAX, MAX))
            im.save(poster, "WEBP", quality=82, method=6)
        w, h = Image.open(poster).size
        works.append(dict(id=stem, hall=hall, date=f[:10], caption=cap, url=meta.get("post_url", ""),
                          img=f"/media/art/{stem}.webp", video=f"/media/art/{video}" if video else None, w=w, h=h))
    halls = [dict(id=h, title=t, works=[w for w in works if w["hall"] == h]) for h, t, _ in HALLS]
    json.dump(dict(halls=halls), open(DATA, "w"), indent=1)
    for h in halls:
        print(h["id"], len(h["works"]), "works,", sum(1 for w in h["works"] if w["video"]), "videos")
    print(sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT)) // 2**20, "MB")


main()
