# Ek Pinjare Mai (album: अंधेरा) in the n1m21n room: brief r2

Remake of the finished 2D film (r14) inside the room engine, the same way Bring Me Some Change is built. Story, acts and track map are the signed-off ones from `~/music videos/ek-pinjare-mai/BRIEF.md`; this file only says what changes for 3D. Nothing here is rendered as video yet.

## r2 (2026-10-20, Naman's notes on r1)
| Note | What r2 does |
|---|---|
| the snake stays on the floor | it lives on the floor in every scene except the peak choke (VI); it rears its head, it does not climb walls or furniture |
| use the room's own snake | the room snake (`site/src/snake.js`) has a director mode `drive({ points, s, look, collide })`; the live site never calls it |
| proper collision, they can never overlap | `site/src/contact.js`: his skinned body baked per pose, shrink-wrap paths on his outer surface (`wrap`, `ride`), then an iterative solver pushes every snake ring out of him, the stool and itself, keeps link length, clamps to the floor; `report()` gives the overlap in mm on every shot (`epm-qc-r2.json`, `epm_choke_keys.png`). All 38 snake shots: into 0, his 0, self 0 |
| the choke on a chair, perfect | VI-1..VI-7 on the red stool: climbs his back from the floor, head round the neck, loop on the collar with his hands gripping it (IK placed from the solved coil, then solved again), tighter, b96 hold, lets go |
| prison cell, scared, wants to go, tied up | iron bars on the door and window (the pinjara); he gets off the stool, tries the door and the window, the snake cuts him off on the floor and herds him back; it ties his ankles to the stool (III) |
| dimensions through the inbuilt portal | the room's own portal (`portal.js` gates) opens on the rug; he walks in, comes out of the same portal in each dream world with the snake following out of it on the ground, and comes back out into the same room (IV, V) |

Story r2, acts: I The cell (1-24), II He wants out (25-40), III Tied to the stool (41-56), IV Through the portal (57-74), V The same room (75-82), VI The choke (83-98), VII The loop (99-103). 49 scenes, see `epm_contact_sheet.png` and the act sheets.

## 0. Story (unchanged)
| Item | Value |
|---|---|
| Premise | a man sits on a red stool in a small surreal room and cannot leave; a cream snake is the real main character |
| Logline | The snake circles him, climbs him, chokes him, slides into his spiral mouth, travels through nested dream worlds, lands back on the floor, rises to face us, and the last pull-back shows the room sits inside another spiral mouth: the cage (pinjara) is the loop |
| Feeling | the room is comfortable, the snake is gentle, and that is the horror |
| Bookend | opens on two red eyes in the dark, ends on the same two eyes (last frame = frame 0, loop) |

## 1. Format
| Item | Value |
|---|---|
| Track | `~/music videos/ek-pinjare-mai/assets/track.wav`, 153.0 BPM, first downbeat 0.080 s, beat 0.392 s, bar 1.569 s, 103 bars, 161.57 s, untouched, no SFX |
| Medium | 3D: the n1m21n room engine (Three.js `site/`), staged with `tools/epm/` (built on `tools/mv/` from Bring Me Some Change) |
| Look | the room's toon + ink, dark, real stage lights from `look.js` (flash on him, spot on the set, area, flicker, rim); no overlay FX, no lens blur, no fisheye (owner rules from the 2D film) |
| Frame | 16:9, 24 fps, 1440p master, cuts snapped to the 153 BPM grid |
| Grid | `B(bar, beat) = 0.08 + ((bar-1)*4 + beat-1) * 60/153` |

## 2. Track map (measured in the 2D film)
| Bars | What the track does | Picture |
|---|---|---|
| 1-2 | pad + bass, no kick | eyes only |
| 3-5 | kick enters, no hats | blink b3 |
| 6-22 | hats in, steady groove | the room, the snake roaming |
| 23-24 | kick drops out (2-bar break) | tension hold, the gape |
| 25 / 33 / 41 | drop, then a hat step-up every 8 bars | bite; climb; choke |
| 57-74 | hats out, kick stays, lifts b61 b65 b69 b73 | dream worlds change on the lifts |
| 75 / 83 | beats back / hardest | exit lands b83.1 |
| 96 | kick drops for 1 bar | 1-bar hold in the Droste |
| 99-103 | tail, near silence from b100.5 | ring, then two eyes |

## 3. What the room gives us, what we add
| 2D film element | In the room engine | Status |
|---|---|---|
| Man (coral skin, shaggy hair, black eyes, spiral mouth, striped tee, jeans, boots) | the room's own man: the face textures already come from the 2D man (`tools/export_face.py`); spiral mouth is on his face | exists |
| Red stool | `room.js stool()` at (0.3, 0, 0) with the `stool` act (hands on knees, feet on the ring) | exists |
| Room (checker floor, window with night sky, eye + spiral paintings, plants, guitar, keyboard, lamp, turntable shelf, spiral rug) | the same room, nearly 1:1; night sky in the window | exists |
| Snake (cream, lavender belly, red arrow head, red slit eyes) | the room's roaming snake is a floor loop only; a director snake is built in `tools/epm/stage.mjs` (tube along any 3D path, head with red arrow and eyes, tongue, gape) | stills done; needs lavender belly + brow wedges + a runtime version in `site/` for rendering |
| Choke, flush to magenta | hands at the coil (IK), face `alarm` / `dazed`, magenta flash light on him only | stills done; real skin flush needs a shader uniform |
| Dreamland (7 worlds: sky man, door, boat, giant eye + poppies, melting eyes + volcano, giant head, then the room) | pocket sets far from the room (like the BSC rave stage), one ring-sky shader per world | rough blockouts in the stills; need art pass before render |
| One continuous zoom through nested worlds | a camera flying through the pocket sets, each portal framing the next | planned, not built |
| Droste (room inside his mouth inside the room) | render the room to a texture, paste it on his mouth, render again (3 levels pre-rendered) | one level proven in VI-3 |
| Snake eye glances (7) | ECU inserts of the snake head at b24.3, 40.3, 48.3, 52.3, 74.3, 86.3, 100.3 | to add to the shot list at the director step |

## 4. Acts (picture = music)
| Act | Bars | Time | Music | Density | Colour script |
|---|---|---|---|---|---|
| I The room in the dark | 1-24 | 0:00.1-0:37.8 | pad, kick b3, hats b6, break b23-24 | 0 -> 1 | low key indigo, one lamp pool, red eyes the only hot colour |
| II The bite and the climb | 25-40 | 0:37.8-1:02.9 | drop, techno | 2 | full palette, warm lamp, violet rim |
| III The choke | 41-56 | 1:02.9-1:28.0 | harder | 3 | magenta takes his face, the room goes black around him |
| IV Into the mouth | 57-74 | 1:28.0-1:56.3 | airy vocal, kick stays | 1 | one psychedelic ring palette, snake red the only hot colour |
| V Out | 75-82 | 1:56.3-2:08.8 | beats back | 2 -> 3 | worlds in reverse, then the room |
| VI The reveal | 83-98 | 2:08.8-2:33.9 | hardest | 3 | cream spot, magenta rim, the room in his mouth |
| VII The loop | 99-103 | 2:33.9-2:41.7 | tail | 1 -> 0 | lamp dims, two red eyes |

## 5. Scenes
See `epm_act_I..VII.png` (one sheet per act with camera, action, cut and light per scene) and `epm_contact_sheet.png` (all 43). Scene table source: `tools/epm/scenes.py`; camera, pose, snake path and light per scene: `tools/epm/shots.mjs`.

## 6. Direction rules carried from the 2D film and the film skills
- Every cut on the 153 BPM grid (<= 1 frame); major cuts on beat 1; inserts half a bar.
- Snake POV shots are out (owner r11e); use ECU inserts of its eye and his eyes.
- One camera idea per moment; the camera and the light do the work, no overlay FX.
- Dream is ONE continuous zoom, never zoom-stop-zoom (owner r14); only the b59 and b73 cuts spike.
- Choke escalates second by second (shake, flush); at b55.3 he gives up and the camera relaxes (owner r14).
- The snake knows the room: it rests on surfaces, goes behind props by depth, never floats over them (owner r11f).
- Strobes max 3 per second, no full-screen white flashes; frame 0 establishes, last frame = frame 0.
- No film renders until Naman says go; never deploy the site for this.

## 7. Open choices for Naman
| # | Question | My default |
|---|---|---|
| 1 | Dream worlds as 3D pocket sets (my default) or keep them as the 2D riso paintings mapped on screens in the room | 3D pocket sets, same ring palette |
| 2 | Snake size: 2.4 m long, 10 cm thick, head half his head width (matches the 2D size rule) | as is |
| 3 | The loop: end on two red eyes like the 2D film | yes |

## 8. Build state
- Branch `claude/project-thread-s0oofc` of n1m21n/n1m21n-room (BSC tooling merged in): `tools/epm/{stage.mjs, shots.mjs, scenes.py, sheet.py, peek.py}`.
- r1 stills rendered from the real room, one fresh page per shot; sheets in this folder.
- Next, on Naman's go: director `state(t)` on the bar grid, runtime snake in `site/`, dream art pass, act I proof mp4 with the track, then chunk by chunk.
