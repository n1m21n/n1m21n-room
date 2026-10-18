---
name: render-progress-mod
description: Claude Code mod /render shows live render % for the Ek Pinjare film; plus planned asset panel and storyboard SVG
metadata:
  type: project
---

Mod `film-dashboard` at `~/.claude/dev-mods/<session-id>/film-dashboard/` (built 2026-10-06, merged render-progress + film-assets). `/film` opens ONE pane: tabs Refs & sheets (thumbnail grid via Svg data-URI, click opens file) and Render; progress bar header on every tab; status line `render N%`. Thumbs in the mod's `thumbs/` are static copies. Reads `out/r11/render_progress.json` + per-chunk `.prog` files written by `render2d.film()` (backup `lib/_archive/render2d_pre_progress.py`).

Owner wants everything in one dashboard (no separate commands). Next: storyboard tab (SVG board from BRIEF act table + shot list) in the same mod. Desktop pane has no Image element (terminal only).

**Why:** owner wants refs/sheets/render status visible inside Claude Code. **How to apply:** if the mod is missing after a restart, copy it to a permanent folder and load with `claude --plugin-dir`. See [[ek-pinjare-mai-video]].
