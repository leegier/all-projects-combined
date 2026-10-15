# Characters & the crowd

Three layers, each optional on top of the one below:

```
procedural Humanoid  ──►  glTF characters (MetaHuman exports)  ──►  background crowd (45 residents + 2 kitchen hands, baked static meshes)
 src/chars/humanoid.js     src/chars/{library,gltf-human,rigmap,rigdriver,poses}.js        src/ai/crowd.js + src/chars/bake.js
```

The game boots and plays with nothing but the procedural humans. Drop web-sized GLBs and a manifest into `assets/characters/` and every
`NPC` (guards, Tuck, Cutter, Harrington, the day-room inmates…) *and* the crowd use them instead. The export / optimise pipeline for
MetaHumans is in [`tools/metahuman/README.md`](../tools/metahuman/README.md); the manifest format in
[`assets/characters/README.md`](../assets/characters/README.md).

> **Status.** The pipeline is built and tested end to end with *stand-in* rigs (mannequins on MetaHuman- and Mixamo-style skeletons).
> **No real MetaHuman has been loaded yet** — the packages are on a machine with Unreal Engine and could not be moved to the cloud session
> (Google Drive's connector fails above ~5 MB; the packages are 9 MB – 1.3 GB). `tools/metahuman/PC-PROMPT.md` is the hand-off.

## glTF characters

| Step | Where | What |
|---|---|---|
| load | `library.js` | `assets/characters/manifest.json` → GLTFLoader + MeshoptDecoder per file, in parallel with the rest of the boot; never rejects — a missing manifest, a missing file or a corrupt one just leaves that look procedural. `?chars=off`, `?chars=/folder/`. A single-file build can embed everything (`tools/build.mjs --embed-characters`). |
| analyse (once per file) | `gltf-human.js` `analyzeTemplate` | find the bones by name (`rigmap.js`: MetaHuman/UE5, Mixamo, Rigify, VRM/VRoid; helpers, twist, corrective, IK and finger bones are ignored), compute the rotation that stands the model up and turns it to face +Z from the rest-pose bone positions (so any axis convention, unit or facing works), measure height, fix materials (hair cards alpha-tested with alpha-to-coverage, eye shells see-through, skin roughness), list problems with the fix (`warnings`). |
| instance | `GltfHuman` | `SkeletonUtils.clone` — geometry and materials are shared, only the bones are new; scaled to the manifest height ±2.5 % per NPC. Same interface as the procedural `Humanoid`, so `NPC` does not know the difference. |
| animate | `rigdriver.js` + `poses.js` | **no animation clips**: the pose table the procedural Humanoid uses (walk, idle, sit, lie, pray, mop, read, type, talk…) drives whatever bones were found. Every rotation is expressed about the *rig's* axes and converted into each bone's own rest frame (`q = rest · Rx · Ry · Rz`), so T-pose, A-pose, X-along-the-bone (UE) and Y-along-the-bone (Blender/Mixamo) all work; arms are re-hung from T/A to hanging first; the pelvis is **ground-locked** — after the legs are posed, the lowest sole point (ankle/ball, measured at rest) is put on the floor, so one foot is always planted and nothing sinks or floats; the jaw opens while the NPC talks; head follows the look target. |
| level of detail | `GltfHuman.setLod` | lashes / brows / teeth / tongue hide beyond 14 m; shadows only within 16 m (as for the procedural bodies). |

### Rig mapping
`rigmap.js` is pure (no WebGL) and unit-tested for UE5/MetaHuman (twist, corrective, facial, IK and finger helpers present), Mixamo with and
without the `mixamorig:` colon glTF strips, Rigify deform/mechanism bones, VRM and VRoid (`J_Bip_L_UpperArm` keeps its side).
Unknown skeletons are reported (`missing: ['L.thigh', …]`), not guessed: the character is drawn in its rest pose and bobs while walking.

## The crowd (`src/ai/crowd.js`)

45 residents (one per cell — the player's own, `C-107`, is excluded) plus 2 kitchen hands, each with a face drawn from a pool of 16
(skin, hair, beard, build, height, shirt shade, tattoos, glasses — all from hashes of the index, never the shared RNG). They live by the routine
clock; the state comes from the slot and whether the cells are released:

| state | what you see |
|---|---|
| `count` (06:00, 21:00, doors locked) | **everyone at attention at their cell door**, both rows, both tiers (45); the four sleeper NPCs step aside |
| `lights` (22:00 –) | asleep on the bunks (41; four bunks already hold a sleeper NPC) |
| `lockdown` | sitting on the bunks |
| `Chow` | mess hall: 19 at the tables, 5 in the serving line, 2 beside the commissary, 3 in cells, 2 kitchen hands |
| `FreeTime` | 21 at the day-room tables, 5 in the mess hall, 12 in cells |
| `Chapel` | 8 on the pews (facing the altar), 4 in the library, 10 at the day-room tables, 12 in cells |
| `WorkDetail`, `Yard`, `Gym`, `Visitation`, count cleared | 10 – 30 around the block: the rest are "elsewhere" |

Residents drift between states: when the state changes everybody first **leaves** (0.3 – 3.3 s), then **arrives** (3.6 – 8.6 s), so seats are
never shared on the way and nobody pops in all at once. Seats and queue spots carry a collider only while someone is there; people in
cells have none.

**Cost.** A human is built once at crowd level of detail (≈ 6 k triangles instead of ≈ 20 k: fingers as a block, head 40×28 instead of
72×56, fewer radial segments), posed, and **baked** (`bake.js`): every mesh is transformed into the body's root space and merged per distinct material
(materials with the same key are shared across all bodies), so a resident is a handful of static meshes — no skeleton, no per-frame
animation. Boot: 133 baked poses (45 residents × stand / lie / sit, plus cooks) ≈ 0.7 – 0.9 s, 0.8 M triangles in memory.
Measured at `q=high`, all passes (shadows included) summed, busiest views: **+ ≈ 500 draw calls and + ≈ 250 k triangles** (down the north tier at count: 479 → 1044 calls; day room at free time 1037 → 1548;
mess hall at chow 531 → 901). Library characters are baked from their light `crowd` file when the manifest has one and **shared** between residents mapped to the same
file (at most files × 2 variants × 3 poses bakes instead of one per person and pose; height jitter ±5 % keeps repeats from being clones).

**It does not touch the simulation.** Residents are not in `game.npcs`, use no AI and no `game.rng`; positions are constants. Their colliders
exist only under seated/queuing people. `?crowd=off` removes them entirely. Verified: the bot's shim route ends in the same state with and
without the crowd (clock within a few frames), and all four bot routes pass with `stuck 0` and the same simulated times as before the crowd existed.

## Tests

| suite | file | what |
|---|---|---|
| rig mapping (Node) | `tests/unit.mjs` | MetaHuman / Mixamo / Rigify / VRM / VRoid name sets, helpers ignored, unknown skeletons reported |
| characters (Chromium) | `tests/characters.mjs` — 56 checks | all stand-ins load and are recognised; every NPC gets a glTF body, guards get the guard file; per character: stands on the floor at the requested height, faces −Z, A-/T-pose arms hang, sit / pray / lie correct, every pose finite, **feet stay on the floor while walking**, LOD; fallbacks (`?chars=off`, no manifest, a manifest with a missing and a corrupt file); crowd + library (light variants, shared bakes); **determinism** (bot route identical with procedural vs glTF bodies) |
| crowd (Chromium) | `tests/crowd.mjs` — 18 checks | counts per state, nobody inside a wall/furniture, nobody sharing a seat, correct heights (mattress / stool), colliders only under occupied seats, visibility by area, staggered transitions, cost budget, `?crowd=off`, simulation unchanged |
| MetaHuman tools | `tests/metahuman-tools.mjs` — 15 checks | optimiser on a split-skeleton export, then in the game (see the tools README) |

## Not done / next

* Load the real MetaHumans (hand-off above), map them to roles, retune lighting/exposure for skin, add hair cards where the export has none.
* Body animation is procedural; no mocap clips, no facial animation (jaw flap only), no lip-sync.
* The crowd is static: no walking residents beyond the two hall walkers (`wk1`, `wk2`) and the cast; no reaction to the player.
* Upper-tier cells and bunks are dark: from the floor the crowd reads as silhouettes at count — a light pass would sell it.
