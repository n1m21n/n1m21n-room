#!/usr/bin/env python3
"""Generate Audio RSS Feed (feed.xml) and JSON Feed 1.1 (feed.json) for Naman's music catalog."""

from datetime import datetime, timezone
import json
import os
import xml.sax.saxutils as saxutils

BASE = "https://naman.infinitedevices.org"
HERE = os.path.dirname(os.path.abspath(__file__))
MUSIC_JSON = os.path.join(HERE, "site", "public", "data", "music.json")
PUBLIC_DIR = os.path.join(HERE, "site", "public")

def parse_date(date_str):
    try:
        parts = [int(p) for p in date_str.split("-")]
        if len(parts) == 3:
            return datetime(parts[0], parts[1], parts[2], 12, 0, 0, tzinfo=timezone.utc)
        elif len(parts) == 1:
            return datetime(parts[0], 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    except Exception:
        pass
    return datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

def main():
    with open(MUSIC_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    albums = data.get("albums", [])
    print(f"Generating open audio feeds for {len(albums)} releases...")

    # Flatten tracks with album context
    all_tracks = []
    for album in albums:
        album_title = album.get("title", "")
        album_id = album.get("id", "")
        album_genre = album.get("genre") or "Electronic"
        release_date = album.get("released", "2024-01-01")
        dt = parse_date(release_date)
        cover_path = album.get("cover", {}).get("1000") or album.get("cover", {}).get("400") or ""
        cover_url = f"{BASE}/{cover_path}" if cover_path else f"{BASE}/favicon.svg"

        for track in album.get("tracks", []):
            src = track.get("src", "")
            audio_url = f"{BASE}/{src}"
            dur = int(round(track.get("dur", 180)))
            byte_size = track.get("bytes", 3000000)
            track_title = track.get("title", "")
            track_num = track.get("n", 1)
            spotify_url = track.get("links", {}).get("spotify") or album.get("links", {}).get("spotify")
            apple_url = track.get("links", {}).get("apple_music") or album.get("links", {}).get("apple_music")
            bandcamp_url = track.get("links", {}).get("bandcamp") or album.get("links", {}).get("bandcamp")

            all_tracks.append({
                "album_title": album_title,
                "album_id": album_id,
                "album_genre": album_genre,
                "release_date": release_date,
                "dt": dt,
                "cover_url": cover_url,
                "track_title": track_title,
                "track_num": track_num,
                "audio_url": audio_url,
                "duration": dur,
                "bytes": byte_size,
                "spotify": spotify_url,
                "apple": apple_url,
                "bandcamp": bandcamp_url
            })

    # Sort newest first
    all_tracks.sort(key=lambda t: t["dt"], reverse=True)

    # 1. Generate Audio RSS 2.0 (feed.xml)
    xml_items = []
    for t in all_tracks:
        rfc822_date = t["dt"].strftime("%a, %d %b %Y %H:%M:%S +0000")
        title_esc = saxutils.escape(f"{t['album_title']} - {t['track_title']}")
        desc = (
            f"Track {t['track_num']} from the album '{t['album_title']}'. "
            f"Genre: {t['album_genre']}. "
            f"Produced by Naman Soni (n1m21n). "
            f"Stream directly or visit {BASE}."
        )
        desc_esc = saxutils.escape(desc)
        guid = saxutils.escape(t["audio_url"])
        audio_url_esc = saxutils.escape(t["audio_url"])
        cover_url_esc = saxutils.escape(t["cover_url"])

        item = f"""    <item>
      <title>{title_esc}</title>
      <link>{BASE}/#music</link>
      <description>{desc_esc}</description>
      <pubDate>{rfc822_date}</pubDate>
      <guid isPermaLink="true">{guid}</guid>
      <enclosure url="{audio_url_esc}" length="{t['bytes']}" type="audio/mp4" />
      <itunes:author>Naman Soni (n1m21n)</itunes:author>
      <itunes:duration>{t['duration']}</itunes:duration>
      <itunes:image href="{cover_url_esc}" />
    </item>"""
        xml_items.append(item)

    rss_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Naman (n1m21n) - Open Audio Feed</title>
    <link>{BASE}</link>
    <description>Open-access, self-hosted electronic music feed by producer and visual artist Naman Soni (n1m21n). Direct streaming audio across house, IDM, downtempo, jazztronica, electronica, psychedelic, and ambient.</description>
    <language>en</language>
    <itunes:author>Naman Soni (n1m21n)</itunes:author>
    <itunes:owner>
      <itunes:name>Naman Soni</itunes:name>
      <itunes:email>namansoniiii21@gmail.com</itunes:email>
    </itunes:owner>
    <itunes:image href="{BASE}/media/covers/andhera-1000.webp" />
    <itunes:category text="Music" />
{chr(10).join(xml_items)}
  </channel>
</rss>
"""

    # 2. Generate JSON Feed 1.1 (feed.json)
    json_items = []
    for t in all_tracks:
        item = {
            "id": t["audio_url"],
            "url": t["audio_url"],
            "title": f"{t['album_title']} - {t['track_title']}",
            "summary": f"Track from '{t['album_title']}' by Naman Soni. Genre: {t['album_genre']}",
            "date_published": t["dt"].isoformat(),
            "image": t["cover_url"],
            "tags": [t["album_genre"], "Electronic", "Independent"],
            "attachments": [
                {
                    "url": t["audio_url"],
                    "mime_type": "audio/mp4",
                    "size_in_bytes": t["bytes"],
                    "duration_in_seconds": t["duration"]
                }
            ],
            "external_links": {
                "spotify": t["spotify"],
                "apple_music": t["apple"],
                "bandcamp": t["bandcamp"]
            }
        }
        json_items.append(item)

    json_feed = {
        "version": "https://jsonfeed.org/version/1.1",
        "title": "Naman (n1m21n) - Open Music Feed",
        "home_page_url": BASE,
        "feed_url": f"{BASE}/feed.json",
        "description": "Direct, machine-readable music stream by electronic music producer Naman Soni (n1m21n). Streamable by human listeners, podcast apps, and autonomous AI agents.",
        "icon": f"{BASE}/media/covers/andhera-1000.webp",
        "favicon": f"{BASE}/favicon.svg",
        "authors": [
            {
                "name": "Naman Soni (n1m21n)",
                "url": BASE,
                "avatar": f"{BASE}/media/covers/andhera-400.webp"
            }
        ],
        "items": json_items
    }

    # Write files
    rss_path = os.path.join(PUBLIC_DIR, "feed.xml")
    json_path = os.path.join(PUBLIC_DIR, "feed.json")

    with open(rss_path, "w", encoding="utf-8") as f:
        f.write(rss_content)
    print(f"Wrote RSS audio feed ({len(xml_items)} tracks) to {rss_path}")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_feed, f, indent=2)
    print(f"Wrote JSON audio feed ({len(json_items)} tracks) to {json_path}")

if __name__ == "__main__":
    main()
