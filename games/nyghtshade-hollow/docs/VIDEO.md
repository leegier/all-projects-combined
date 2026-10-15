# The playtest video

The master recording (`nyghtshade-hollow-playtest.mp4`) shows the **playtest bot** playing *The Intake* start to finish while the
assertions it makes appear on screen: 8 min 8 s, 1280×720, 30 fps, H.264 + AAC, 24 chapter markers. Nothing is faked: the
video frames are screenshots of the real game (WebGL canvas **and** DOM HUD) at chosen simulation steps; the audio is the game's
own procedural soundtrack rendered from the same simulation. The master is 99.9 MB, just under GitHub's file limit, so it is not committed — it was handed over in the Claude session (as four ≤ 30 MiB parts cut at keyframes, plus a 480p single-file copy); the
repository carries `media/nyghtshade-hollow-playtest-lite.mp4` (854×480, 32 MB, same chapters), 21 stills and a contact sheet.

## What you see

| On screen | Meaning |
|---|---|
| top-centre badge `● PLAYTEST BOT · T+03:21 · ● live ×1` | simulation time and playback speed; `▶▶ ×2 / ×3 time-lapse` while the bot merely walks or waits |
| bottom-left yellow caption | the system being exercised right now (routine clock, guard AI, stealth, economy…) |
| bottom-right green ticks `✔ …` | live assertions from the bot (39 on the golden path), shown as they pass |
| the game's own HUD | clock + slot, objective + distance, DC/cred/fear, vitals, minimap with guard cones, detection ring, alert bar, PA ticker |

Structure: title card → **golden path** (`shim` route: intro cinematic, count, survival, dialogue, chow, commissary,
Cutter, mop job, Records stealth, ledger, journal, chapel, baptismal font, tunnel, clearing, ending) → **alternate routes**
(two short clips of the other ways into Records: `keycard` — buy it from Cutter, swipe the reader; `bribe` — pay Pruitt to
look away) → **failure path** (`alarm` route: rush into Records → camera alarm → Pruitt chases → arrest cinematic → fined,
an hour later in the cell) → report card. The file carries chapter markers (one per system the bot exercises).

## How it is made

```
node tools/capture.mjs  ──►  plan      bot runs headless (fast, no rendering) → plan.json: speed markers, assertions, checkpoints
                        ──►  audio     same run with an OfflineAudioContext on the sim clock → PCM → make-up gain measured
                        ──►  frames    N Chromium workers; each re-simulates to its first frame, renders its slice, screenshots
                        ──►  cards     title / interlude / report cards (DOM, animations driven by virtual time)
                        ──►  encode    image sequence + audio segments (atempo for time-lapse) → libx264 / AAC
tools/make-video.sh         runs the above for the golden path + failure path and concatenates A (title+golden path) · B (failure path) · C (report)
tools/make-video-extras.sh  renders the keycard / bribe clips (K.mp4, R.mp4: a window of the route + an interlude card)
tools/assemble.mjs          final concat  A · K · R · B · C  with chapter markers (FFMETADATA) → nyghtshade-hollow-playtest.mp4
```

Why this works:

* **The simulation is deterministic.** Fixed 60 Hz steps, seeded RNG, no wall-clock reads, `Math.random` is never used.
  `tests/integration.mjs` asserts that two runs of a route end in the identical state, and every capture worker
  verifies its re-simulated state against checkpoints recorded by the plan pass every 20 simulated seconds
  (a mismatch aborts the capture).
* **Time is virtual.** `src/capture.js` replaces `setTimeout` with a sim-clock scheduler and pauses every CSS
  animation/transition, setting `currentTime` from the sim clock before each screenshot — toasts, fades and the
  typewriter subtitles look exactly as they would at 60 fps in real time.
* **Frames are chosen, not recorded.** The bot calls `bot.speed(n)` around stretches where it just walks or waits; the
  capture tool turns those into a frame schedule (`n × 2` simulation steps per frame at 30 fps). Warm-up frames are
  rendered (not saved) at the start of every slice so camera/light smoothing has converged.
* **Audio follows the same schedule.** The soundtrack is rendered once for the whole simulation, then cut into
  constant-speed runs; time-lapse runs are `atempo`-sped, low-passed and ducked; the master gets a make-up gain to
  ≈ −16 LUFS and a limiter.
* **Software rendering.** The container has no GPU. Chromium runs under Xvfb with ANGLE → Mesa llvmpipe
  (`NH_GL=llvmpipe`, ~6× faster than SwiftShader). Capture-only trims: 1024² shadow maps (`?sm=1024&sunsm=1024`);
  everything else is the `high` preset (4× MSAA, bloom, 6 pooled point lights, HDR grade) plus half film grain. Cost: ≈ 0.5 s of
  4-core time per frame in the halls and ≈ 1 s in the forest, so the 14 000 frames of the whole video take about three hours.

## Reproduce

```bash
npm run build:dev                                    # or any build; the capture serves dist/
NH_GL=llvmpipe xvfb-run -a -s "-screen 0 1400x900x24" bash tools/make-video.sh /tmp/nh-video 3
# stills for look review:
NH_GL=llvmpipe xvfb-run -a node tools/capture.mjs --out /tmp/nh-video/shim --stage plan,frames --preview 4
python3 tools/montage.py /tmp/nh-video/shim/preview /tmp/nh-video/sheet 3 3 560
```

Encode defaults are CRF 27 with a 4.5 Mbit/s cap (`--crf`, `--maxrate`, `--bufsize`) — CRF 22 made the master ≈ 250 MB; the
forest (grass blades + time-lapse) is the expensive part, the dialogue close-ups cost almost nothing. The lite file is
`bash tools/make-lite.sh IN.mp4 OUT.mp4` (480p, light denoise, CRF 30).

Useful flags: `--route shim|keycard|bribe|alarm`, `--fps`, `--workers`, `--q`, `--qx "sm=2048&sunsm=2048"`, `--from/--to` (seconds of
simulated time), `--resume` (skip frames already on disk), `--parts title,frames,outro`, `--crf`.
Patching after a fix: `--redo "139-144.4,293-295.6"` deletes and re-renders only the frames whose simulation time falls in those
windows; add `--only-redo` to run it beside another render of the same directory (it leaves `schedule.json` alone). `NH_PORT=8400`
moves the local servers' base port so two captures can run at once. Then re-run `--stage encode` and `node tools/assemble.mjs OUTDIR`.

## Visual review log (what the stills review changed)

Each pass rendered a contact sheet every 4 s of the run and looked at it frame by frame. Fixed along the way:

* intro: the eyelid shader was closed for the first 17 s (black screen) → open during the establishing/dolly shots;
  establishing shot rebuilt (higher, closer, moonlit forest, **lit windows, stained-glass nave windows, beacon, floodlight halos**)
* first-person hands: "toe" knuckles and a flower-pot sleeve → modelled hand (tapered back, 3-segment fingers, nails),
  sleeve that runs up the arm out of frame, arm key light with a clamped near field so fixtures above the camera cannot blow the hands out
* characters: stacked-capsule torso (visible seams) → single smooth lathe torso + yoke; tapered limbs with joint caps;
  boots, belts, apron bib, flat-colour skin that matches the head; blob shadows; foot-planting while walking
* tunnel: Harrington's lantern lit his whole coat white → carried at his hip, 5 cd, small glow
* ending: grass hid the two men → trodden lawn around the oak; three authored shots (eye-level push-in, low sunlit drift,
  rising pull-back toward the prison in the haze); sun-shaft cones fade to zero at the ground (they showed hard polygon edges)
* HUD dims during dialogue so the portrait camera + subtitles read cleanly; on choice screens the subtitle lifts above the list
  and the yellow caption / assertion feed step aside (the list used to cover the line being answered, then the caption covered choice 1)
* baptismal-font cinematic: HUD hidden while it plays
* audio: a whole tier of cell doors opened at once and clipped → staggered/thinned + limiter; sub-bass rumble trimmed


## Crowd reel (added after the playtest video)

The playtest video predates the populated block (see [CHARACTERS.md](CHARACTERS.md)). `media/nyghtshade-hollow-crowd-reel.mp4` is a short, silent
reel of the crowd living through a day: count at the cell doors, both rows, chow, free time, chapel, lights out. It is rendered by
`tools/crowd-reel.mjs` (six authored camera shots; camera, prison hour and caption are interpolated per frame, and each frame advances the **real
simulation** 12 steps, so doors, routine events and the residents' staggered departures/arrivals are the game's own — the clock runs ≈ 2.4× real time)
and encoded by `tools/make-reel.sh`:

```bash
NH_GL=llvmpipe xvfb-run -a node tools/crowd-reel.mjs /tmp/reel 15 high      # ≈ 26 min on 4 cores, no GPU
bash tools/make-reel.sh /tmp/reel media/nyghtshade-hollow-crowd-reel.mp4 15
```

`REEL_FRAMES=3` renders three frames per shot for a smoke test. It is a time-lapse of a bot-free world: nobody plays.
