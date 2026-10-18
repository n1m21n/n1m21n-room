# Two sites, one core (stream + website)

- `naman.infinitedevices.org` — the website. `naman.infinitedevices.org/?stream=1&yt=<videoId>&k=<STREAM_KEY>` — the stream page for OBS / YouTube (auto-enter, sound on).
- Both run the SAME shared life (`site/src/sim/`, `life.json`); the algorithm is untouched.

## Core (both sites): `site/src/`
- `sim/`, `man.js`, `room.js`, `routine.js`, … the character and the room.
- `thoughts.js` thought / speech bubbles (`say()`, `setPace()`).
- `camera-director.js` automatic camera: shots by act, cuts, clear-view check. Runs while `routine.mine` (nobody touching). Any drag / tap / key turns it off; back after 2 idle minutes or "go live".
- `errands/` chat errands played on both sites: `commands.js` (command table, parser, queue; also imported by the server), `notes.js` (paper notes on the desk), `playback.js` (walk to desk, read, answer in a bubble, do the act), `feed.js` (poll the server log, announce).
- `functions/api/chatq.js` + `migrations/0004_chatq.sql`: the server picks the start time of each errand, so both sites play it at the same moment.

## Stream engine only: `site/src/stream/` (loaded only on `?stream=1`, separate chunk)
- `index.js` the queue (votes, cooldowns), notes to himself when chat is quiet, nudges, quicker musings.
- `bridge.js` YouTube chat poll (`functions/api/chat.js`) and the local test feed. `hud.js` the overlay.

## Commands (final list)
!tea !synth (!keys !music) !guitar !art (!paint) !read !tv !records !snake !window !work !cook !eat !snack !plant !call !wash !brush !dress (!outfit) !letter !stretch !water !pace !roam, `!play <song name>` (stream audio only), plus questions (synth, music, tea, who, where, snake, hello). !loo !shower !sleep are answered with a joke and no act. Each errand is under a minute. Nothing a viewer types is shown except their cleaned first name.

## Setup (once)
1. `npx wrangler@4 d1 migrations apply naman-room-nudges --remote`
2. Pages secrets: `STREAM_KEY` (any long random string), `YT_API_KEY` (Google Cloud, YouTube Data API v3).
3. OBS browser source: `https://naman.infinitedevices.org/?stream=1&yt=<live video id>&k=<STREAM_KEY>`.
Test without YouTube: `?stream=1&feed=test` (fake viewers) or type `chat('!tea','sam')` in the console. Without STREAM_KEY the stream plays errands only on itself.
