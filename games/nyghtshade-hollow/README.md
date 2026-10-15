# Nyghtshade Hollow — *The Intake*

A playable first-person vertical slice of the prison game: one morning inside **C-Block**, four hours of
freedom under an old oak. It runs in any modern browser (WebGL 2), needs **no assets and no install** —
every texture, model, sound and cinematic is generated procedurally at start-up — and ships as a single
`dist/index.html`.

> You are **Maddox Callahan Thatcher, inmate 1106553**. Nine years in. A name moves on the transfer ledger,
> an old chaplain is about to be shipped out, and under the chapel floor there is a tunnel that has not been
> opened in thirty-one years. Work the prison's clock, learn who sells what, get into Records without being
> seen, and carry page fourteen to the one man who can open the floor.

The slice plays for about 8 minutes (06:00 → ~15:00 on the prison clock). It is a
re-implementation of the systems prototyped in `games/clawed-unity` (routine clock, DC economy, reputation,
guard AI, survival) on a web stack, plus all of the content, art, audio and cinematics needed to play it.

```
06:00  COUNT ─ 07:00 CHOW ─ 08:00 WORK DETAIL ─ … ─ 13:00 CHAPEL ─ … ─ 21:00 FINAL COUNT ─ 22:00 LIGHTS OUT
```

## Play it

```bash
# 1. just open the built file
xdg-open dist/index.html            # file:// works – it is a single self-contained page

# 2. or serve it
npm install                         # three, esbuild, playwright-core
npm run build                       # esbuild -> dist/index.html (minified single file)
npm run serve                       # http://localhost:8080
```

URL options: `?q=low|medium|high` (quality preset, default `high`), `?w=1920&h=1080`, `?fast` (skip the 25 s
content advisory), `?debug` (fps / draw calls, or press F3), `?bot=shim|keycard|bribe|alarm` (let the playtest
bot play, see [Testing](#testing--the-playtest-bot)).

### Controls

| Key | Action | Key | Action |
|---|---|---|---|
| **W A S D** | move | **E** | interact (hold for long actions) |
| **Shift** | run (drains stamina) | **Space** | advance dialogue |
| **C** | crouch | **1–4** | choose a dialogue option |
| **Mouse** | look (click to capture) | **Tab / J** | journal: objective · inventory · standing · schedule |
| **T** (hold) | fast-forward the prison clock while it is safe | **M** | toggle minimap |
| **Esc / P** | pause · save | **Backspace** | skip a skippable cinematic |

## What is in the slice

| System | What it does in the slice |
|---|---|
| **Routine clock** | 13 schedule entries / 11 slot types (Count, Chow, Work Detail, Yard, Free Time, Chapel/Library, Gym, Visitation, Lockdown, Lights Out…). Drives PA announcements, cell doors, sally gates, the canteen and chapel, and which areas are *restricted*. 45 s of real time = 1 game hour; hold **T** to compress it. |
| **Count** | Stand at your cell door when the PA calls it. Miss it and you take a write-up (DC fine, guard standing, street cred). |
| **Survival** | Health · hunger · thirst · stamina. Chow trays, fountains, commissary food. Starving drains health. |
| **DC economy** | Prison scrip. Free tray at chow, a 30 DC mop detail, commissary (water, ramen, cigarettes, buns), cigarettes as hard currency, Cutter's shim (25 DC) / keycard (60 DC), a 40 DC bribe. |
| **Reputation** | Street cred (tiers *Nobody → Shot-caller*), fear, and nine faction standings. Dialogue choices move them; they gate options and prices. |
| **Branching dialogue** | 50 nodes across 18 scripts, typewriter subtitles with per-character voice blips, a portrait camera that frames the speaker, NPCs turn to face you. Choices can cost DC, shift standing, set flags. |
| **Guard AI** | Waypoint nav graph (169 nodes, A\*), cone-of-vision with line-of-sight against level geometry, a detection meter, suspicious → chase → search states, sweeping gaze at posts, patrols, arrest. Guards only care about what you are *not allowed to be doing right now*. |
| **Stealth** | Records Room, three ways in: **keycard** (buy it), **shim** (work the reader while Pruitt looks away), **bribe** (pay Pruitt). Inside, a ceiling camera sweeps the room: crouch, time the sweep. |
| **Failure path** | Walk in without timing the sweep → camera alarm → Pruitt breaks his post → chase → arrest cinematic → fined, standing lost, one hour later in your cell. |
| **Interactions** | Pickups, fountains, bunk rest, chow tray → eat, commissary shop UI, mop bucket + four spills, reader/shim hold-to-use, ledger copy → document viewer, baptismal font lift. |
| **Journal / HUD** | Objective + distance, minimap with guard vision cones, vitals, DC and street-cred, detection ring, alert bar, PA ticker, toasts. |
| **Cinematics** | Exterior night establishing shot → C-Block dolly → waking in the cell (eyelids/blur) → arrest cut → font reveal → golden-hour ending under the oak with a piano motif. |
| **Save / load** | `localStorage` slot (Esc → Save, *Continue* on the title screen). |

### The golden path (what the bot plays)

`wake → stand for count → pick up smokes → talk to a day-room inmate → drink → hold T until CHOW → walk the sally
port to the mess hall → get a tray from Tuck, eat → commissary → Cutter (ledger lead, buy a shim) → kitchen mop
job (+30 DC) → Intake → shim the Records reader while Pruitt looks away → crouch past the camera, copy page 14 →
read it → journal → hold T until 13:00 → chapel → give page 14 to Harrington → lift the baptismal font → follow
his lantern down the stair and through the tunnel → the clearing → ending.`

## Graphics & audio

Everything is built at start-up from code; the page is ~0.8 MB minified.

* **Renderer** — Three.js r170, HalfFloat HDR pipeline with MSAA, ACES tone-mapping, unreal bloom, and a custom
  grade pass (vignette, grain, chromatic aberration, letterbox, eyelid/blur/alarm overlays). First-person arms render
  in their own pass so they never clip into walls.
* **Materials** — canvas-generated **PBR texture sets** (albedo + normal + roughness/metal/AO packed): block, brick,
  plaster, lino, steel, grating, wood, fabric, flagstone, ground, bark, skin… plus decals (stains, tally marks,
  stained-glass, window cookies). World-space UVs, one merged draw per material per area.
* **Lighting** — a pooled real-light rig (nearest N fixtures get real point lights, others fade in/out), cookie-mapped
  spot lights through the barred windows and the chapel glass, light-shaft cones, dust motes, glow sprites, a low
  golden-hour sun with PCF-soft shadows outside, per-area fog/exposure presets.
* **Characters** — jointed humanoids with a sculpted procedural head (displaced ellipsoid, eyes with lids/brows, hair and
  beard shells), tapered limbs, uniforms with stencil/badge textures, blob shadows and a pose-blending animator
  (walk, idle, talk, sit, pray, mop, lie…). First-person hands are fully modelled (three-segment fingers, tattoo sleeve).
* **Foliage** — procedural broadleaf, spruce, grass, fern and leaf-card textures with three LOD buckets and spatially chunked
  instancing for frustum culling.
* **Audio** — a WebAudio engine with room tone, fluorescent hum, drone/tension/warm pads, footsteps per surface, doors,
  gates, buzzers, PA chimes, voice blips, heartbeat, birds/wind, piano. Every call is scheduled against an injectable
  clock, so the same code renders **offline** from the simulation clock for the video soundtrack.

## Testing & the playtest bot

`src/bot/bot.js` is a generator-based player that drives the **real input layer** (virtual keys + smooth look) in fixed
60 Hz steps, with assertions along the way.

| Suite | Command | What it covers |
|---|---|---|
| Unit (Node, 27 tests) | `npm run test:unit` | routine clock/doors/PA, economy, reputation, survival, alert, inventory, dialogue graph integrity (no dead ends, no orphans, every `fx`/`cond` handled) |
| Bot routes (headless Chromium) | `npm run test:bot` | **shim**, **keycard**, **bribe** golden paths (39 checks each) and the **alarm** failure path (26 checks) |
| Integration (Chromium, 14 tests) | `npm run test:integration` | save/load round trip, nav-graph connectivity, door policy per slot, restricted-area rules, **determinism** (two runs of a route end in the identical state) |

`npm test` runs all three; reports land in `docs/*.json`. See [docs/TESTING.md](docs/TESTING.md).

## The video

`media/` holds the recording of the bot playing the slice (8 min 8 s, real input, real game, live assertions ticking green on
screen, chapter markers): the 480p `-lite` file, 21 stills and a contact sheet; the 720p master (99.9 MB) is handed over with the
pull request rather than committed. It is produced by a **deterministic capture pipeline**
(`tools/capture.mjs`, `tools/make-video.sh`): the simulation is a pure function of the step count, so each browser
worker re-simulates from t = 0 in a few seconds and renders only its slice of frames; UI timers and CSS animations are
re-driven by simulation time; the soundtrack is rendered offline from the same simulation and cut/tempo-matched to the
frame schedule; ffmpeg muxes everything. Stretches where the bot just walks or waits are time-lapsed (badge in the
top bar). Structure: golden path (shim route) → keycard and bribe clips → failure path (camera alarm, chase, arrest) → report
card. Details in [docs/VIDEO.md](docs/VIDEO.md), media index in [media/README.md](media/README.md).

## Layout

```
games/nyghtshade-hollow/
├─ dist/            built single-file game (index.html)
├─ src/
│  ├─ core/         gfx (composer, light rig, shafts, grade), audio, input, stage
│  ├─ proc/         procedural textures + materials + noise
│  ├─ world/        World, areas, doors, props, foliage, levels/{hall,east,west,tunnel,outside}, nav definition
│  ├─ chars/        humanoid rig, sculpted heads, first-person viewmodel
│  ├─ ai/           nav graph + A*, NPC, Guard (+ SecurityCam)
│  ├─ systems/      routine, economy, reputation, survival, alert, inventory, player controller, save
│  ├─ story/        quest/story state machine, dialogue scripts, cinematics
│  ├─ ui/           HUD, dialogue, journal, shop, document viewer, title/pause/end screens
│  ├─ bot/          playtest bot (routes: shim · keycard · bribe · alarm)
│  ├─ capture.js    deterministic capture API (window.NH_CAP)
│  └─ game.js, main.js
├─ tests/           unit.mjs · run-tests.mjs (bot) · integration.mjs
├─ tools/           build · serve · capture.mjs + make-video.sh + chapters.mjs (video) · look (stills) · perf (render cost)
│                   montage.py / stills.py (contact sheets, media stills) · report.mjs (docs/TESTING.md)
├─ docs/            DESIGN · TESTING · VIDEO · FINDINGS + machine-readable reports
└─ media/           playtest video + screenshots
```

## Known limits / next

* One area of the prison is built (C-Block, east wing: sally port, corridor, mess hall + commissary + kitchen, Intake,
  Records; west wing: corridor, library, chapel; tunnel; forest). Yard, gym, visitation, the hit market, Arianna's
  office and Valley's arrival are the next vertical slices (the end screen lists them).
* Characters are procedural and stylised; no skeletal animation clips, no lip-sync (voice blips + captions instead).
* No spoken voice-over: PA lines are subtitles + chimes (the live game also uses `speechSynthesis` for PA when the
  browser offers it).
* Software rendering (no GPU) is ~2 s/frame at 1080p; on a real GPU the slice runs at 60 fps on `high`.
