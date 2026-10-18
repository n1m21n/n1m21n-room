---
name: n1m21n-room-website
description: "owner's interactive 3D portfolio site (Ek Pinjare Mai room + man + snake); brief in n1m21n-room/BRIEF.md"
metadata:
  node_type: memory
  type: project
  originSessionId: 8b1d0c10-3d07-4225-823a-5dd408251205
  modified: 2026-10-16T09:03:45.771Z
---

Started 2026-10-14. Interactive 3D room portfolio: walk the man to objects (records, paintings, computer -> Infinite, keyboard, guitar, window, lamp, bed, books, films, snake). Free hosting; owner can't buy a domain and won't use infinitedevices.org (company name). GitHub user is `n1m21n`. Domain `naman.infinitedevices.org` (Cloudflare DNS), repo `n1m21n/n1m21n-room` (public), deploy via Cloudflare Pages. Commits authored as n1m21n, no Claude attribution.

Man = B, 3D toon (decided 2026-10-14, must be playable): built headless in Blender by `tools/build_man.py` -> `site/public/media/man/man.glb`; face textures from man2d via `tools/export_face.py`; preview with `build-cache/man_preview.sh`. Don't solidify hair (its ink hull blacks out the highlights).

Status 2026-10-16 (uncommitted): room furnished, tap-to-walk A* nav, live snake, gallery curated to 169 artworks only (`tools/art_keep.txt`; no personal photos), procedural material marks in `look.js` (`toon({mat})`), record player in `site/src/music.js` (crate, deck, global switch, M key). Next stations from BRIEF: guitar, keyboard, computer, books, TV, pinboard.
Later 2026-10-16: gallery is a 5-hall maze (`gallery.js` ROUTE) with push-open doors (`doors.js`) and a bench per hall; camera spring arm on `userData.arm` walls. Mobile pass + sound 2026-10-16: phones (changed 2026-10-16 on owner's ask): fixed sticky joystick bottom-left, right thumb = camera, action button bottom-right, vinyl deck + tv player (`#tvp` in telly.js, replaces the old remote) at top under the HUD; mobile DPR floor 1.5 (Low Power Mode 30 fps used to blur it), `sfx.js` synthesises all fx + vinyl crackle, sound toggle in HUD. Deployed by direct upload: `npm run build && npx wrangler@4 pages deploy dist --project-name naman-room --branch main` (Pages project has the custom domain; art media is gitignored so Git deploys won't work). Time-aware 2026-10-16: `routine.js` runs his day on IST (sleep 0–6, desk 9–13/14–18, music 18–20, reading, window, gallery bench; one option per half hour, seeded by date); you arrive to find him at it, and after 2 min idle he walks back to it. HUD label shows the IST clock. Next: poster wall above the TV (26 posters, 9/8/9). Dev-test gotcha: a synthetic keydown leaves `player.keys` stuck (he stands/walks off) — `dev.player.keys.clear()` first; rAF is throttled in the hidden pane, so step `player.update`/`doors.update` by hand.

SEO/agents 2026-10-16: `site/seo.js` (vite plugin) builds JSON-LD, a screen-reader `#about` text twin of the room, robots.txt, sitemap.xml and llms.txt from `public/data`; `public/404.html` stops Pages' SPA soft-404s. Edit data, not those files.

**Why:** artist portfolio in their psychedelic style; reuses [[ek-pinjare-mai-video]] room and characters.
**How to apply:** start from `~/music videos/n1m21n-room/BRIEF.md` (decisions §1, build order §6); gate each step with stills like [[owner-film-review-workflow]].
