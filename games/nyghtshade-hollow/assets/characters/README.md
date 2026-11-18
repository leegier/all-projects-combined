# Character files (MetaHumans)

The game ships with procedural humans and runs without anything in this folder. Put web-sized GLB characters here
(MetaHumans exported from Unreal / Maya / Blender and shrunk with `tools/metahuman/optimize.mjs`) and the cast **and the
background crowd** use them instead.

```
assets/characters/
├─ manifest.json            ← you write this (manifest.example.json is the template)
├─ gavin.glb                ← optimize.mjs output, ≤ ~40 MB, ≤ ~40k triangles, 1024 px textures
├─ gavin_crowd.glb          ← optional light variant for the baked crowd (≈ 6k triangles, 256 px textures)
└─ …
```

**These files are licensed MetaHuman assets: they must never be committed to the public repository.** `.gitignore` already
excludes `*.glb`, `*.gltf`, `*.mhpkg` and `manifest.json` here. Keep them on the machine, or in a *private* repo (Git LFS).

## manifest.json

```json
{ "defaults": { "height": 1.78 },
  "characters": [
    { "id": "gavin", "file": "gavin.glb", "crowd": "gavin_crowd.glb", "looks": ["inmateA", "guard"], "height": 1.84 }
  ] }
```

| field | meaning |
|---|---|
| `id` | any unique name |
| `file` | the GLB (relative to this folder) |
| `crowd` | optional lighter GLB of the *same* character, used only for the baked background crowd (full file is used if absent) |
| `looks` | the roles this character may play. `"*"` = any. Several characters may list the same look: each NPC picks one from its seed, so the same person always gets the same face |
| `height` | metres; the model is scaled to this (±2.5 % per NPC so repeats are not clones). Default `defaults.height` |

**Look names the game asks for**

| look | who | notes |
|---|---|---|
| `guard`, `guardLight` | CO Reyes, CO Pruitt / CO Dalton | uniform comes from the character's own clothing — dress them as officers when you export |
| `inmateA` `inmateB` `inmateC` | the day-room / chapel / hall inmates **and the whole crowd** (45 residents are spread over every character that lists one of these) | |
| `cutter` `tuck` `harrington` `maddox` | the named inmates (Cutter, Tuck the kitchen trustee, old Harrington, Maddox = the player's own body in cutscenes) | a look with no entry falls back to the procedural body for that person |

## Using it

```bash
npm run build                 # single-file dist/index.html (procedural humans)
npm run serve                 # dist/ + this folder served at /assets/  → http://localhost:8080
npm run build -- --embed-characters      # bake the manifest + GLBs into dist/index.html itself (one file, can be large)
```

URL switches: `?chars=off` (procedural only) · `?chars=/some/folder/` (another manifest) · `?crowd=off` (no background crowd).
The console prints one line per character (rig, bones, triangles, height) and a warning for anything that will look wrong
(separate face skeleton, > 300 bones, > 120k triangles, unrecognised bone names) together with the command that fixes it.

See `tools/metahuman/README.md` for the export / optimise steps and `docs/CHARACTERS.md` for how the game drives them.
