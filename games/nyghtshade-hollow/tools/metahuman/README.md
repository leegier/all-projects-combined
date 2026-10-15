# MetaHuman → web GLB

Nyghtshade Hollow draws its cast and its background crowd from glTF characters when `assets/characters/` has any
(see [assets/characters/README.md](../../assets/characters/README.md)). A raw MetaHuman export is far too heavy for a web
page (hundreds of MB of 4K textures, ~800 joints, several skeletons), so every character goes through
`optimize.mjs` first. This folder has the tool, its tests and the checklist for the Windows machine that has Unreal Engine
(**[PC-PROMPT.md](PC-PROMPT.md)** is a ready-to-paste prompt for a Claude Code session running there).

> **Licence.** MetaHuman assets may be used in your own projects but must not be redistributed as raw files. Keep them (and the
> optimised GLBs) out of any public repository — `.gitignore` in this game already excludes them. Push them only to a private repo.

## What the game needs from a character file

| | |
|---|---|
| **Skeleton** | one humanoid skeleton with recognisable bone names: UE5 / MetaHuman (`pelvis`, `spine_01…05`, `neck_01/02`, `head`, `clavicle_l`, `upperarm_l`, `lowerarm_l`, `hand_l`, `thigh_l`, `calf_l`, `foot_l`, `ball_l`), Mixamo, Rigify, VRM / VRoid are all understood (`src/chars/rigmap.js`, unit-tested). Any rest pose: T, A or relaxed — arms are re-hung automatically. Any axis convention, unit (cm or m) or facing direction. |
| **Meshes** | skinned meshes: head, body, clothes, eyes, teeth, hair cards. Eye shells / cornea / occlusion meshes are drawn see-through; lashes, brows, teeth are recognised by name and hidden at distance. |
| **Materials** | PBR textures embedded in the GLB (base colour, normal, roughness/metal). Hair cards (name contains `hair`/`cards`/`lash`/`brow`) are drawn alpha-tested. |
| **Size** | ≈ 40k triangles, 1024 px textures, ≤ 40 MB per character; the optional crowd variant ≈ 6k triangles, 256 px. |

The game animates characters **procedurally** (no animation clips needed): the same pose table drives every body — walk,
idle, sit, lie, pray, mop, type, talk (jaw) — through the mapped bones, with foot planting and a ground lock.

## 1 — get a raw GLB

Any route that ends in a skinned GLB works. Which one is available depends on your Unreal / MetaHuman version — check Epic's
current MetaHuman documentation for the exact menu names.

* **Unreal Engine** (the machine that already imports your MetaHuman packages): open the character, select its skeletal meshes
  (Body, Face, and the clothing meshes if they are separate; hair cards if your export has them), *Asset Actions → Export…* or
  *File → Export Selected…* with the built-in **glTF Exporter** (`.glb`), LOD 0 only, materials baked to textures. A MetaHuman's Body and Face
  are two skeletal meshes on two skeletons — that is fine, `optimize.mjs` merges them (see below).
* **Maya / Blender** with Epic's MetaHuman DCC export (one rig for body + face) → export glTF.
* **Anything else humanoid** (Mixamo, Ready Player Me, VRM) → GLB.

## 2 — look at it

```bash
cd tools/metahuman && npm install          # once: @gltf-transform, meshoptimizer, sharp
node optimize.mjs --inspect raw/gavin.glb
```

prints JSON: skeletons (joint counts, which rig, whether the game can drive it, missing roles), meshes (triangles, skinned,
materials), textures (sizes), and **warnings** — e.g. *"2 separate skeletons … the face would not follow the body"*, *"vertices
use more than 4 joint influences"*, *"3 textures are larger than 2048 px"*.

## 3 — optimise

```bash
# the character itself (hero NPCs): ~40k triangles, 1024 px WebP textures
node optimize.mjs raw/gavin.glb ../../assets/characters/gavin.glb --tex 1024 --tris 40000

# its light twin for the background crowd (baked into static meshes — 45 of them are on screen at count)
node optimize.mjs raw/gavin.glb ../../assets/characters/gavin_crowd.glb --tex 256 --tris 6000
```

What it does, in order (all of it reported):

1. **Merge skeletons** — several skins (UE exports Body and Face separately; each mesh may also carry its own skin) become one: every
   mesh is re-skinned onto the body skeleton by bone name, and the face skeleton's *jaw* becomes a joint under the body's head,
   so the face, hair and eyes follow the head and the jaw can move while the character talks.
2. **Collapse joints the game never animates** into their nearest kept parent (skin weights follow): ~800 facial joints, twist /
   corrective / helper joints, fingers. A real MetaHuman has several hundred joints, most of them facial; what is left is the ~60 the game drives (the test stand-ins go from 42–48 to 27–32). `--keep-face-rig`, `--keep-twist`, `--keep-fingers` keep them.
3. **Limit skinning to 4 influences per vertex** (what three.js reads; MetaHuman uses 8), renormalised.
3a. **Sockets are kept**: a plain mesh hung on a joint that gets collapsed or merged (glasses, hair, a hat, eyes attached to the face skeleton) is re-attached to the nearest kept joint **without moving** (world transform preserved).
3b. **Morph targets (blend shapes) are removed** — the game does not animate them and a MetaHuman face export can carry hundreds (`--keep-morphs` keeps them).
4. dedup / prune / weld; optional **triangle budget** (`--tris`, meshoptimizer simplification).
5. **Textures** resized to `--tex` and converted (`--format webp|jpeg|png|keep`; default WebP).
6. **Meshopt compression** (`EXT_meshopt_compression`; `--no-meshopt` to skip).

Which joints are "essential" comes from the game's own `src/chars/rigmap.js`, so the tool keeps exactly what the game drives.

## 4 — tell the game who is who

Copy `assets/characters/manifest.example.json` to `manifest.json`, one entry per character: which looks it may play
(`inmateA/B/C`, `guard`, `guardLight`, `cutter`, `tuck`, `harrington`, `maddox`), its height, its `crowd` file.
The 45 background inmates are spread over every character that lists an `inmate*` look.

## 5 — check it in the game

```bash
npm run build && npm run serve        # http://localhost:8080 — open the browser console (F12)
```

One line per character (`[NH] character gavin: metahuman rig, 61 bones, 38950 tris, 1.84 m` (example numbers)), then
`[NH] crowd: 45 residents + 2 staff, … baked poses`. Walk to the hall: at 06:00 everybody stands at a cell door, at 07:00 the mess hall fills.
`?chars=off` shows the procedural humans for comparison; `?crowd=off` hides the crowd.
For screenshots without a display: `npx playwright-core install chromium` (once), then `node tools/look.mjs tools/shots-crowd.json out` renders eight stills of the crowd
(`NH_CHROME=/path/to/chrome` picks another browser; `NH_QUERY='chars=/fixtures/characters/'` points it at another character folder).

| symptom | cause | fix |
|---|---|---|
| console: *N separate skeletons* / the head stays behind | Body and Face exported on two skeletons | run `optimize.mjs` (merges them) |
| console: *skeleton not recognised* | bone names are not in a known scheme | rename bones to UE5 / Mixamo / Rigify / VRM names, or add the scheme to `roleOf()` in `src/chars/rigmap.js` (+ a case in `tests/unit.mjs`) |
| console: *N bones / N k triangles: slow* | raw export | `optimize.mjs … --tris 40000` |
| arms stick out | should not happen (arms are re-hung from the rest pose) | send the `--inspect` JSON |
| no hair | MetaHuman hair is a *groom* (strands), glTF cannot carry it | export the hair-cards LOD, or add a hair-card mesh in Blender |
| skin looks flat / black | materials exported without baked textures | re-export with material baking on |
| eyes look cloudy | an eye-shell material is drawn too opaque — shells are matched by name (`eyeshell`, `cornea`, `occlusion`, `tearline`…) | rename the material or adjust `SHELL` in `src/chars/gltf-human.js` |
| feet float / sink | no `foot_*` / `ball_*` bones found | check the inspect output for missing `L.foot` / `L.toe` |

## Tests

`npm run test:tools` (from the game folder, after `npm install` here) runs the optimiser on a stand-in export whose face lives on its own skeleton
and loads the result in the real game: skeletons merged, jaw created once, joints reduced, file smaller, triangle budget honoured,
**the face follows the head** (and does *not* in the raw file — that is the control), jaw animates, blend shapes are removed (or kept with `--keep-morphs`), socketed meshes (a badge on a facial joint, a radio on a twist joint) end up on the nearest kept joint and follow it, a single-skeleton export works.
The stand-ins (`tools/standin/gen.js`, `tools/make-standin.mjs`) are rigid-skinned mannequins on MetaHuman- and Mixamo-style skeletons,
**not MetaHumans** — they exist so the whole pipeline can be tested without licensed assets.

| script | does |
|---|---|
| `optimize.mjs` | inspect / optimise (this document) |
| `../make-standin.mjs` | regenerates the test characters in `tests/fixtures/` |
| `../look.mjs` | stills from the real game: `NH_QUERY='chars=/fixtures/characters/' node tools/look.mjs shots.json outDir` |
