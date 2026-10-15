# Media

| File | What |
|---|---|
| `nyghtshade-hollow-playtest-lite.mp4` | The playtest recording at 854×480 · 30 fps · H.264 + AAC · 8 min 8 s · 32 MB, with the chapter markers below |
| `stills/*.jpg` | 21 stills (1280×720) picked from the capture: intro, C-Block, count, routine board, serve line, Cutter's choices, mop job, Records, chapel, baptismal font, tunnel, forest, clearing, ending, report card, camera alarm, keycard and bribe routes |
| `contact-sheet.jpg` | One frame every 8 s of the golden path (49 tiles), for a quick visual review of the whole run |
| `stills/crowd-*.jpg` + `crowd-contact-sheet.jpg` | **After the video was recorded** the block was populated (see [`docs/CHARACTERS.md`](../docs/CHARACTERS.md)): 45 residents + 2 kitchen hands living by the clock. Eight 1280×720 stills at high quality — count at the cell doors, both rows, the day room, the mess hall at chow, the serving line, the chapel, the library, lights out. The video above predates this and shows the original, sparsely populated block; it has **not** been re-recorded |

The **full-quality master** — `nyghtshade-hollow-playtest.mp4`, 1280×720 · 30 fps · H.264 (≈ 1.5 Mbit/s) + AAC, 99.9 MB — is not committed
(it is just under GitHub's 100 MiB file limit); it was handed over in the Claude session that built it (as four parts, because uploads there are capped at 30 MiB, plus a 480p single-file copy). Rebuild it any time with
[`tools/make-video.sh`](../tools/make-video.sh) → [`tools/make-video-extras.sh`](../tools/make-video-extras.sh) → [`tools/assemble.mjs`](../tools/assemble.mjs)
(≈ 3 hours of wall-clock on 4 cores, no GPU), and the lite version with [`tools/make-lite.sh`](../tools/make-lite.sh).

The video is **not** a screen recording of someone playing: the bot drives the real game through its input layer, a
deterministic capture pipeline renders every frame (WebGL canvas **and** DOM HUD), and the soundtrack is rendered offline from the
same simulation. How it is made, what the overlays mean and how to reproduce it: [`../docs/VIDEO.md`](../docs/VIDEO.md).

## Chapters

| Time | Chapter |
|---|---|
| 0:00 | Title |
| 0:04 | Intro cinematic — compound, C-Block, waking in C-107 |
| 0:38 | Routine system — 11-slot prison clock drives PA, doors and guards |
| 0:59 | Survival + pickups — Health · hunger · thirst · stamina |
| 1:03 | Dialogue — Branching dialogue with voice blips |
| 1:26 | Time flow — Hold T to fast-forward the routine clock while it is safe |
| 1:35 | Guard AI — Guards patrol with vision cones |
| 1:37 | Chow + commissary — Free tray, hunger restores |
| 1:53 | Economy — DC scrip: earn from work, spend at the commissary, trade,… |
| 2:00 | Reputation + dialogue — Choices change Street Cred, Fear and faction standing |
| 2:31 | Work detail — Kitchen mop job: four spills, 30 DC and Guard standing |
| 2:42 | Stealth — Three ways into Records — keycard, shim, or a bribe |
| 2:50 | Stealth — Pruitt sweeps his gaze |
| 2:58 | Security camera — The ceiling camera sweeps Records |
| 3:29 | Journal — Objective tracking, inventory, reputation tiers and the… |
| 3:46 | Time flow — The chapel only opens at 13:00 — fast-forward the clock |
| 3:56 | The chapel — Stained glass, candles, pews |
| 4:20 | The baptismal — Hold E to lift the stone font and reveal the hidden stair |
| 4:33 | The tunnel — Follow Harrington and his lantern under the wire |
| 5:25 | The clearing — Old oak, a crate, a blanket — four hours of being unowned |
| 6:34 | Alternate route — keycard |
| 6:53 | Alternate route — bribe |
| 7:17 | Failure path — camera alarm, chase, arrest |
| 7:58 | Playtest report |

The golden path (0:00 – 6:34) is the `shim` route, 7 min 42 s of game time with time-lapse (`▶▶` badge) while the bot walks or waits;
the keycard and bribe clips show the other two ways into Records; the failure path shows the camera alarm → Pruitt's chase → arrest.
