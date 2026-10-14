#!/usr/bin/env python3
"""Build the site's music data + streaming media from ../catalog.json and ../music/.

Outputs (all under site/public/):
  data/music.json                     albums, tracks, links, release dates, durations, waveform peaks
  media/covers/<album>-{1000,400}.webp
  media/audio/<album>/<nn>-<track>.m4a   AAC 128k, faststart (streams after ~100 KB)

Idempotent: skips any output that already exists. Run: python3 tools/build_music.py [--jobs 8]
"""
import argparse, concurrent.futures as cf, difflib, html, json, os, re, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                       # n1m21n-room
SRC = os.path.dirname(ROOT)                        # music videos
PUB = os.path.join(ROOT, "site", "public")
FFMPEG = "/opt/homebrew/bin/ffmpeg"
MATCHES = []
UA = {"User-Agent": "Mozilla/5.0"}


def slug(s):
    s = s.lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "x"


def get(url, binary=False):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        b = r.read()
    return b if binary else b.decode("utf-8", "replace")


def itunes(album_url):
    aid = re.search(r"/(\d+)(?:\?|$)", album_url).group(1)
    d = json.loads(get(f"https://itunes.apple.com/lookup?id={aid}&entity=song&country=in"))
    head, songs = d["results"][0], d["results"][1:]
    art = head["artworkUrl100"].replace("100x100bb", "1400x1400bb")
    return {"released": head["releaseDate"][:10], "genre": head.get("primaryGenreName"), "art": art,
            "durations": {s["trackNumber"]: s["trackTimeMillis"] / 1000 for s in songs if "trackNumber" in s}}


def bandcamp(album_url):
    page = get(album_url)
    art = re.search(r'<meta property="og:image" content="([^"]+)"', page).group(1)
    art = re.sub(r"_\d+\.jpg", "_10.jpg", art)    # _10 = original size
    m = re.search(r'"datePublished"\s*:\s*"([^"]+)"', page)
    from email.utils import parsedate_to_datetime
    released = parsedate_to_datetime(m.group(1)).date().isoformat() if m else None
    return {"released": released, "genre": None, "art": art, "durations": {}}


def local_files(folder):
    d = os.path.join(SRC, "music", folder)
    return {f: os.path.join(d, f) for f in sorted(os.listdir(d)) if f.lower().endswith((".mp3", ".wav", ".flac"))} if os.path.isdir(d) else {}


def match(title, files):
    norm = lambda s: re.sub(r"^\d+\s*-\s*|\.(mp3|wav|flac)$|[^a-z0-9]", "", s.lower())
    keys = {norm(f): p for f, p in files.items()}
    hit = difflib.get_close_matches(norm(title), keys, n=1, cutoff=0.6)
    return keys[hit[0]] if hit else None


def encode(src, dst):
    if os.path.exists(dst):
        return dst
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    tmp = dst + ".tmp.m4a"
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", src, "-map", "0:a", "-c:a", "aac", "-b:a", "128k",
                    "-ar", "44100", "-movflags", "+faststart", "-map_metadata", "-1", tmp], check=True)
    os.replace(tmp, dst)
    return dst


def peaks(path, n=96):
    """n loudness peaks 0-99 for the player's waveform (decoded at 2 kHz mono, cheap)."""
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-ac", "1", "-ar", "2000", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    import array
    a = array.array("h", raw)
    step = max(1, len(a) // n)
    vals = [max((abs(x) for x in a[i:i + step]), default=0) for i in range(0, step * n, step)]
    top = max(vals) or 1
    return [round(99 * v / top) for v in vals], len(a) / 2000


def cover(url, name):
    out = os.path.join(PUB, "media", "covers")
    os.makedirs(out, exist_ok=True)
    big, small = (os.path.join(out, f"{name}-{s}.webp") for s in (1000, 400))
    if not os.path.exists(small):
        src = os.path.join(ROOT, "build-cache", f"{name}.jpg")
        os.makedirs(os.path.dirname(src), exist_ok=True)
        if not os.path.exists(src):
            open(src, "wb").write(get(url, binary=True))
        for path, px, q in ((big, 1000, 82), (small, 400, 78)):
            subprocess.run(["cwebp", "-quiet", "-q", str(q), "-resize", str(px), "0", src, "-o", path], check=True)
    return {"1000": f"media/covers/{name}-1000.webp", "400": f"media/covers/{name}-400.webp"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", type=int, default=os.cpu_count())
    args = ap.parse_args()
    cat = json.load(open(os.path.join(SRC, "catalog.json")))
    folders = os.listdir(os.path.join(SRC, "music"))

    albums, jobs = [], []
    plan = [(a, "album") for a in cat["albums"]] + [(a, "bandcamp") for a in cat.get("bandcamp_exclusives", [])]
    for a, kind in plan:
        title = a.get("album_title") or a["title"]
        aslug = slug(title)
        meta = itunes(a["apple_music"]["url"]) if kind == "album" and a.get("apple_music") else bandcamp(a["url"])
        folder = difflib.get_close_matches(title.replace("?", "_"), folders, n=1, cutoff=0.5)
        files = local_files(folder[0]) if folder else {}
        if title == "Andhera":                       # masters beat the mp3s
            files = {**files, **local_files("Andhera (Master WAVs)")}
        if kind == "bandcamp" and not files:
            files = local_files(os.path.join("Bandcamp Exclusives", title)) or local_files(os.path.join("Bandcamp Exclusives", "Singles"))
        links = {k: (a[k]["url"] if isinstance(a.get(k), dict) else a.get(k))
                 for k in ("spotify", "apple_music", "youtube_music", "bandcamp")}
        if kind == "bandcamp":
            links = {"bandcamp": a["url"]}
        tracks = []
        for i, t in enumerate(a["tracks"], 1):
            n = t.get("track_number", i)
            src = match(t["title"], files)
            if src:
                MATCHES.append((title, t["title"], os.path.basename(src)))
            rel = f"media/audio/{aslug}/{n:02d}-{slug(t['title'])}.m4a" if src else None
            tr = {"n": n, "title": t["title"], "src": rel, "dur": meta["durations"].get(n),
                  "links": {k: t.get(k) if kind == "album" else (t.get("url") if k == "bandcamp" else None)
                            for k in ("spotify", "apple_music", "youtube_music", "bandcamp")}}
            tr["links"] = {k: v for k, v in tr["links"].items() if v}
            tracks.append(tr)
            if src:
                jobs.append((tr, src, os.path.join(PUB, rel)))
            else:
                print(f"  no local file: {title} / {t['title']}", file=sys.stderr)
        albums.append({"id": aslug, "title": title, "kind": kind, "released": meta["released"],
                       "genre": meta["genre"], "cover": cover(meta["art"], aslug),
                       "links": {k: v for k, v in links.items() if v}, "tracks": tracks})
        print(f"{title:28s} {meta['released']}  {sum(1 for t in tracks if t['src'])}/{len(tracks)} local")

    with open(os.path.join(ROOT, "build-cache", "matches.tsv"), "w") as f:
        f.writelines("\t".join(m) + "\n" for m in MATCHES)

    def work(job):
        tr, src, dst = job
        encode(src, dst)
        tr["peaks"], secs = peaks(dst)
        tr["dur"] = tr["dur"] or round(secs, 1)
        tr["bytes"] = os.path.getsize(dst)
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        for _ in ex.map(work, jobs):
            pass

    albums.sort(key=lambda x: x["released"] or "", reverse=True)
    out = {"artist": cat["artist"], "albums": albums}
    os.makedirs(os.path.join(PUB, "data"), exist_ok=True)
    json.dump(out, open(os.path.join(PUB, "data", "music.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    total = sum(t.get("bytes", 0) for a in albums for t in a["tracks"])
    print(f"\n{len(albums)} albums, {len(jobs)} tracks encoded, {total / 1e6:.0f} MB audio")


if __name__ == "__main__":
    main()
