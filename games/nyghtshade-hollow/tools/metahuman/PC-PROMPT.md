# Hand-off for the PC with Unreal Engine: export the MetaHumans

## What the packages turned out to be (read from your Drive on 2026-10-15)

`drive-pull.mjs` read the table of contents of every package without downloading them. They are **Editable Characters from MetaHuman Creator**, not 3D models:

| package | engine that saved it | contents |
|---|---|---|
| `mhc_maria` (8.6 MB), `skotukeda5` (430 MB) | Unreal 5.8 | one `MetaHumanCharacter` asset |
| `mhc_gavin` (160 MB) | 5.7 | the character asset + `MHC_Gavin_ExportedFace` (a face mesh with the rig data) + a strand-groom hair |
| `mhc_advika` (140 MB), `mhc_hannah` (139 MB) | 5.7 | one `MetaHumanCharacter` asset |
| `walker` (1.28 GB) | 5.6 | one `MetaHumanCharacter` asset + two source textures |
| `hair_f_ponytail_messywavy_01` (49 MB) | — | a strand groom (the card meshes it lists are not in the zip) |

Every manifest says `includedLods: 0, lod0VertCount: 0`. A character asset is the *recipe* (face and body parameters, skin / eye / makeup settings, textures); only the MetaHuman Creator plugin inside Unreal Engine builds the head and body meshes from it. That cannot be done in the cloud session, so **one export step has to happen on a PC with Unreal Engine 5.8** (5.8 opens the 5.6 and 5.7 packages too; 5.7 is enough for Gavin, Advika, Hannah and Walker).

Epic's licence page says MetaHumans may be used with any engine; check it yourself before shipping.

## Paste this into Claude Code on that PC (an empty folder)

> Goal: export my MetaHumans so the browser game *Nyghtshade Hollow* can use them. Clone the **public** repo `leegier/all-projects-combined` (branch `claude/prison-game-demo-build-mqhocm`, read-only: never push to it), read `games/nyghtshade-hollow/tools/metahuman/PC-PROMPT.md` in it, and follow the section **"What the PC session does"**. Work autonomously, check each step, and report numbers, not impressions. Stop and ask me in one short message only if a step needs a decision.

## What the PC session does

1. **Find Unreal Engine 5.8** (and 5.7) under `C:\Program Files\Epic Games\`, and confirm the **MetaHuman Creator** plugin is available (UE 5.6+ includes it; it needs an Epic account). If Unreal or the plugin is missing, stop and say exactly what to install; do not guess.
2. **Find the packages**: Google Drive for desktop → the folder with `mhc_maria.mhpkg`, `mhc_gavin.mhpkg`, `mhc_advika.mhpkg`, `mhc_hannah.mhpkg`, `skotukeda5.mhpkg`, `walker.mhpkg` (also try Downloads and *Saved from Chrome*). Ignore `oa_t_shirt.mhpkg` (empty) and the hair pack for now. Never change or delete anything in Drive.
3. **Import** each package into a new UE 5.8 project with Epic's standard import for `.mhpkg` (Fab library / the MetaHuman plugin; use whatever the installed version documents). Each one appears as a *MetaHuman Character* asset. If one cannot be imported with the installed version, say which and carry on.
4. **Export** every character with the MetaHuman Creator **export tool → DCC export** (Epic: it writes the head DNA, the body DNA and the skin textures as a zip of `.dna`, `.png` and `.json` files). Use the highest texture resolution the editor offers (if it needs Epic's online texture service, log in). Save each as `export\<name>.zip`. Also save one portrait screenshot per character (`export\<name>_ref.png`, front view, neutral light) so the web render can be compared with Unreal's.
5. **If the DCC export is not available** in the installed version, export the assembled skeletal meshes (Body, Face, clothing) with Unreal's glTF exporter (LOD 0, materials baked to textures) to `export\<name>.glb` and say that this is what you did.
6. **Publish privately.** `gh repo view leegier/NYGHTSHADE --json isPrivate` must say `true` (stop otherwise). In a clone of `leegier/NYGHTSHADE`, new branch `metahuman-web-assets`, folder `nyghtshade-hollow/exports/`: the zips / GLBs and reference PNGs (Git LFS for anything over 50 MB: `git lfs install; git lfs track "*.zip" "*.glb"`). Commit and push.
7. **Report**: branch name, each file with its size, which export route was used per character, anything that failed and what you did about it.

**Rules.** Never push MetaHuman files to a public repo (`all-projects-combined` is public). Do not modify or delete files in Drive or in any repo.

## What happens next (cloud session)

`dna2glb.py` (head and body from the DNA, UE5 joint names, skin weights) → `optimize.mjs` → `assets/characters/manifest.json`; uniform, hair and eye/skin shading in the game; the character and crowd tests with the real files; then the trailer and the 10-minute video are rendered.
