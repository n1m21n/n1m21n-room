# n1m21n room — interactive 3D portfolio (BRIEF)

Single source of truth. Status: **phase 0 (setup). §1 decided 2026-10-14; data pipeline running.**

## 0. Idea
- One room you move around in on phone or laptop, using gestures. It is the Ek Pinjare Mai room, with the same man and snake.
- You walk the man to objects. Each object opens part of the portfolio: music, art, Infinite, books, films, timeline.
- Look: hypnotic and psychedelic, the owner's art style. The approved 2D sketch-ink look carried into 3D.
- It must feel quick: instant first paint, then lazy-load the rest.

## 1. Decisions (proposed; owner signs off)
| # | Topic | Proposal | Why |
|---|---|---|---|
| D1 | Domain | **owner: subdomain of infinitedevices.org**, **`naman.infinitedevices.org`** (owner 2026-10-14) (DNS is already on Cloudflare) | free; owner's pick |
| D2 | Hosting | GitHub repo `n1m21n/n1m21n-room` = source + data + media -> **Cloudflare Pages** (free: unlimited bandwidth, 20k files, 25 MB/file; custom subdomain is one click because the zone is on the same Cloudflare account) | GitHub as backend, $0, no traffic cap for full tracks |
| D3 | Audio | **owner: full tracks streamed** + listen / save on Spotify, Apple, YT Music, Bandcamp. Mechanism: AAC 128k `.m4a` with faststart (plays after ~100 KB), `preload=none`, prefetch the next track's head, service-worker cache of played tracks, precomputed waveform peaks json, nothing loads until asked | quick on 4G, ~450 MB total, under the 1 GB repo soft limit |
| D4 | Engine | Vite + vanilla three.js, glTF + meshopt + KTX2 textures; room modelled in Blender from `ek-pinjare-mai/lib/room.py` dimensions (9 x 9 x 3.4 m) | the fastest load per feature |
| D5 | 3D look | toon "sketch ink" shader: cel bands in the thermal palette, inverted-hull ink lines (weight: characters > props > walls, as on r11), screen-space hatching in shadow, white dry-brush rim, paper grain + riso misregistration post pass | reproduces the r11 2D look in 3D |
| D6 | Character + snake | owner: keep the art style; full 3D only if it matches. Look test decides. **A (rec.)** paper-puppet: 2D man and snake sprites rendered from the existing 2D engine (`man2d.py`, `snake2d.py`) at 8 angles per pose, standing in the 3D room. **B** full 3D rig in Blender + ~12 animations. A/B sheet before choosing | A keeps the signed-off character exactly, and is lighter and faster |
| D7 | Camera | diorama: the room is always readable; orbit is limited to the open front ±70°, pinch to zoom, glide between stations | works one-handed on a phone; no lost-in-a-room moments |
| D8 | Gestures | owner: touch / trackpad. The Infinite museum grammar (`~/infinte-main/website/museum.js`: drag + inertia, pinch, swipe, tap) + tap-to-walk; laptop adds WASD / arrows and wheel. Optional later: webcam hand tracking (MediaPipe) as a toggle | proven code, no camera permission at the start |
| D9 | Live time | Delhi time (IST) drives the sky and his activity; the visitor can override | "come back at night and he's asleep" |

## 2. Stations (objects -> what they open)
| Object | New? | Man action | Opens |
|---|---|---|---|
| Record shelf + turntable | | crate-digs, drops the vinyl | 15 albums as sleeves; pick one -> it goes on the platter -> 30 s preview, full tracklist, platform links. Mini player stays docked |
| Painting wall | | stands, looks, head tilts | curated artworks swap into the frames; tap -> viewer + Instagram post link |
| Computer desk | **new** | types | Infinite preview (launch film loop / reels) -> infinitedevices.org |
| Keyboard | | plays | playable: generative chord engine (Infinite-style), scale-locked, notes glow magenta |
| Guitar | | strums | playable strums / arps, same generative engine |
| Window | | looks out, thinks | thought bubbles: a mix of his own voice (from Substack, Instagram captions, YouTube, bio, album phases) and philosophical lines in that spirit, `data/thoughts.json`; sky = live time |
| Lamp | | reaches up | on / off -> the room lighting flips |
| Bed | **new** | sleeps (Zzz) | idle state at night |
| Bookshelf | **new** | reads | 17 book covers + the owner's own book as an **"unreleased"** spine/cover (no file; teaser only) |
| TV / CRT | **new** | watches | 26 film / show recommendations (posters) |
| Snake | | pets / plays with it | always roaming on a path as a side character; tap = interaction |
| Wall calendar / pinboard | **new** | | timeline 2019 -> 2026 (§4) |
| Stool | | sits | bio text (§5) |

Live schedule (IST, proposal): 00-07 sleeps (lamp off) · 07-10 window · 10-17 computer · 17-20 guitar · 20-24 keyboard / making music.

## 3. Assets on disk (inventory 2026-10-14)
| Asset | Where | State |
|---|---|---|
| Album / track links + release dates + covers + streams | `tools/build_music.py` -> `site/public/data/music.json` (129 KB), `media/covers/*.webp`, `media/audio/**.m4a` | **done 2026-10-14**: 20 releases (15 albums + 1 Bandcamp album + 4 singles), 162 tracks, 434 MB AAC 128k, waveform peaks; dates from iTunes / Bandcamp |
| Music sources | `../music/` | 168 mp3, 9 wav, 1 flac (`Local Masters & Stems` unreleased: not on the site unless the owner asks) |
| Artworks (Instagram) | `../artworks/` + `ARTWORKS_CATALOG.md` | 466 files (312 jpg, 154 mp4); **curation needed** (drop Infinite promos and non-art posts) |
| Book covers | `../covers/books/` | 17 |
| Film posters | `../covers/movies_and_shows/` | 26 |
| Room, man, snake, poses, interactions | `../ek-pinjare-mai/lib/*2d.py`, `out/design/r11_*.png` | signed off (2D) |
| Palette | `ek-pinjare-mai/lib/core.py PAL` | thermal, from the अँधेरा cover |
| Gesture code | `~/infinte-main/website/museum.js` | reuse |
| Infinite brand (for reference, not copied) | `~/infinte-main/website/brand.css` | |

## 4. Timeline (data: `site/public/data/links.json`)
2017-2020 dance crew ([video](https://www.youtube.com/watch?v=2Xsf6wzNTA4)) · 2019 Procreate · 2020 Hansraj DU, Blender, Spark AR · 2023 MBA IIM Ranchi · 2023 music (Logic, Ableton, Bitwig, Bespoke; first release Species 2023-11-22) · 2023-26 releases (album dates) + artwork dates · 2026 founded Infinite Devices.

## 4b. Socials (all `n1m21n`; in `links.json`)
Instagram, X / Twitter, YouTube, Substack, Spotify, Apple Music, YouTube Music, Bandcamp, GitHub. Shown on the stool / bio panel + a persistent footer row; the dance video plays on the TV or timeline card.

## 5. Bio (owner text, use as is)
naman is a visual artist, electronic musician, creative technologist, and dancer based in delhi ncr. (full text in the 2026-10-14 brief; phases: rehab -> hiraku -> awakened -> naked space -> godsdie -> paranoia -> synthetic vision -> redhand -> andhera.)

## 6. Build order (gate each step)
| # | Step | Output | Gate |
|---|---|---|---|
| 0 | Decisions §1 | this file | owner yes |
| 1 | Brand book: wordmark, type, colour, UI kit (buttons, player, panels, helper text, loader) | `brand/brand_book.html` + A/B | owner picks |
| 2 | Data: catalog + dates + covers + previews; artwork curation sheet; books / films json | `site/public/data/*.json`, `media/` | owner checks curation |
| 3 | Look test: one corner of the room in three.js with the sketch shader + one puppet pose (D6 A vs B) | stills + live URL | owner picks |
| 4 | Room + navigation + gestures + loader | live preview | phone test |
| 5 | Stations one by one (records first) | live | per station |
| 6 | Live time, snake AI, polish, perf budget (first load < 4 MB, LCP < 1.5 s on 4G) | | |
| 7 | Launch on the domain | | |

## 7. Owner preferences
- Replies: tables and bullets, short. No Artifacts. No Claude attribution anywhere (commits included).
- Show stills / A-B before building motion; one change per round.
