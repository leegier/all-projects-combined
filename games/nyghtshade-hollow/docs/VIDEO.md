# The playtest video

`media/nyghtshade-hollow-playtest.mp4` shows the **playtest bot** playing *The Intake* start to finish while the
assertions it makes appear on screen. 1280×720, 30 fps, H.264 + AAC. Nothing is faked: the video frames are
screenshots of the real game (WebGL canvas **and** DOM HUD) at chosen simulation steps; the audio is the game's own
procedural soundtrack rendered from the same simulation.

## What you see

| On screen | Meaning |
|---|---|
| top-centre badge `● PLAYTEST BOT · T+03:21 · ● live ×1` | simulation time and playback speed; `▶▶ ×2 / ×3 time-lapse` while the bot merely walks or waits |
| bottom-left yellow caption | the system being exercised right now (routine clock, guard AI, stealth, economy…) |
| bottom-right green ticks `✔ …` | live assertions from the bot (39 on the golden path), shown as they pass |
| the game's own HUD | clock + slot, objective + distance, DC/cred/fear, vitals, minimap with guard cones, detection ring, alert bar, PA ticker |

Structure: title card → **golden path** (`shim` route: intro cinematic, count, survival, dialogue, chow, commissary,
Cutter, mop job, Records stealth, ledger, journal, chapel, baptismal font, tunnel, clearing, ending) → **failure path**
interlude (`alarm` route: rush into Records → camera alarm → Pruitt chases → arrest cinematic → fined, an hour later in
the cell) → report card.

## How it is made

```
node tools/capture.mjs  ──►  plan      bot runs headless (fast, no rendering) → plan.json: speed markers, assertions, checkpoints
                        ──►  audio     same run with an OfflineAudioContext on the sim clock → PCM → make-up gain measured
                        ──►  frames    N Chromium workers; each re-simulates to its first frame, renders its slice, screenshots
                        ──►  cards     title / interlude / report cards (DOM, animations driven by virtual time)
                        ──►  encode    image sequence + audio segments (atempo for time-lapse) → libx264 / AAC
tools/make-video.sh    runs the above for both routes and concatenates the pieces
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
  everything else is the `high` preset (4× MSAA, bloom, 6 pooled point lights, HDR grade). Cost per frame:
  ≈ 0.25 s (mess hall) to ≈ 0.7 s (forest) on 4 cores.

## Reproduce

```bash
npm run build:dev                                    # or any build; the capture serves dist/
NH_GL=llvmpipe xvfb-run -a -s "-screen 0 1400x900x24" bash tools/make-video.sh /tmp/nh-video 3
# stills for look review:
NH_GL=llvmpipe xvfb-run -a node tools/capture.mjs --out /tmp/nh-video/shim --stage plan,frames --preview 4
python3 tools/montage.py /tmp/nh-video/shim/preview /tmp/nh-video/sheet 3 3 560
```

Useful flags: `--route shim|keycard|bribe|alarm`, `--fps`, `--workers`, `--q`, `--qx "sm=2048&sunsm=2048"`, `--from/--to` (seconds of
simulated time), `--resume` (skip frames already on disk), `--parts title,frames,outro`, `--crf`.

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
* HUD dims during dialogue so the portrait camera + subtitles read cleanly
* audio: a whole tier of cell doors opened at once and clipped → staggered/thinned + limiter; sub-bass rumble trimmed
