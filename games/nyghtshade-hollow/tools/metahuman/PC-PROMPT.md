# Prompt for the Windows PC (Claude Code with Unreal Engine installed)

The MetaHumans are on a machine with Unreal Engine; the web game's cloud session cannot move them (Google Drive's connector fails above
~5 MB per file, the packages are 9 MB – 1.3 GB). So the conversion happens there, and only the small, web-sized results travel — through a
**private** GitHub repo.

Open Claude Code in a folder on that PC and paste everything between the lines.

---

**Goal.** Convert my MetaHumans into web-ready GLB files for the browser game *Nyghtshade Hollow* and push them to my **private** GitHub repo
`leegier/NYGHTSHADE` so the game's cloud session can pull them. Work autonomously, verify each step with the commands given, and report numbers, not impressions.

**Where things are.**
- The MetaHuman packages (`*.mhpkg`, from MetaHuman Creator): `mhc_maria`, `mhc_gavin`, `mhc_advika`, `mhc_hannah`, `walker`, `skotukeda5`
  (custom) and the hair pack `hair_f_ponytail_messywavy_01`. Look in Google Drive for desktop → *Saved from Chrome*, and in Downloads. Ignore `oa_t_shirt.mhpkg` (13 bytes, empty).
- Unreal Engine 5.x with the MetaHuman support installed: look under `C:\Program Files\Epic Games\`.
- The game: public repo `leegier/all-projects-combined`, folder `games/nyghtshade-hollow`, branch `claude/prison-game-demo-build-mqhocm`. Clone it (read-only use; **never push to it**), `cd games/nyghtshade-hollow/tools/metahuman && npm install`.
  Read `tools/metahuman/README.md` and `assets/characters/README.md` there first.

**What the game needs per character** (details in the README): one GLB with a skinned humanoid using the MetaHuman / UE5 bone names
(`pelvis, spine_01…05, neck_01/02, head, clavicle_l, upperarm_l, lowerarm_l, hand_l, thigh_l, calf_l, foot_l, ball_l …`), LOD 0 meshes (head, body, clothes, eyes, teeth,
hair cards if available), textures embedded and baked (base colour, normal, roughness). Body and Face may be on separate skeletons — that is fine, the optimiser merges them.
The characters should wear what they play (see the `looks` in `assets/characters/manifest.example.json`): if it is easy in Unreal, dress them in navy officers' uniforms for the `guard` looks and in orange jumpsuits for the
`inmate` looks; if not, export them as they are and say so. If it is unclear which character should play which role, keep the example mapping and note it in your report.

**Do this.**
1. Find the packages; list them with sizes. They are zip archives: for each one write its table of contents (`python -m zipfile -l <package>` or 7-Zip) to `listings\<name>.txt` — **file names and sizes only, never extract
   or commit their content** — and say whether any of them contains `.glb`, `.gltf` or `.fbx` files directly. (The cloud session has never been able to open one, so this tells it what a package really is.)
2. Get each character into Unreal (the way my other project did — MetaHuman Creator in the editor, or importing the package through the MetaHuman plugin; use whatever the installed version supports). If a
   package cannot be imported with the installed version, say exactly which version/plugin is needed and carry on with the others.
3. Export each character's skeletal meshes with Unreal's glTF Exporter to `raw\<id>.glb` (LOD 0, materials baked to textures). If you can script it with the editor's Python
   (`unreal` module), do; otherwise do it through the editor and tell me which clicks you need from me.
4. For every raw file run `node tools/metahuman/optimize.mjs --inspect raw\<id>.glb` and read the warnings. Then optimise:
   `node tools/metahuman/optimize.mjs raw\<id>.glb out\<id>.glb --tex 1024 --tris 40000` and the crowd twin `… out\<id>_crowd.glb --tex 256 --tris 6000`.
   The `--inspect` of each *output* must show `usable: true`, one skeleton, no warnings, and each file ≤ 50 MB. Fix what is wrong (re-export, or tell me).
5. Put the outputs and a `manifest.json` (start from `assets/characters/manifest.example.json`; keep the ids, and give heights from the real models) into `assets/characters/` of your clone, then check them in the real game:
   `npm install && npx playwright-core install chromium && npm run build`, then `node tools/look.mjs tools/shots-crowd.json shots` (renders eight stills — count at the cell doors, day room, mess hall, chapel, library, lights out — with a headless
   browser; set `NH_CHROME` to use another Chrome). Its output must show one `[NH] character …` line per file, `[NH] characters: N/24 NPCs use glTF bodies`, `[NH] crowd: 45 residents …`, and **no warnings**; look at the PNGs (are the faces, hair, uniforms,
   scale and feet right?) and keep them to show me. To look around yourself: `npm run serve`, open <http://localhost:8080/?fast>, New Game, **Backspace** skips the intro, hold **T** to fast-forward the clock to count (06:00) and chow (07:00).
6. **Publish privately.** Verify the repo is private (`gh repo view leegier/NYGHTSHADE --json isPrivate` must say `true`; stop otherwise). In a clone of `leegier/NYGHTSHADE`, new branch
   `metahuman-web-assets`, folder `nyghtshade-hollow/characters/`: copy the optimised `*.glb` and `manifest.json` (**not** the raw GLBs, **not** the `.mhpkg` files — GitHub's LFS allowance is 1 GB).
   Make sure `*.glb` is tracked by Git LFS (`git lfs install`, check `.gitattributes`, add `git lfs track "*.glb"` if needed). Also copy the small text files from step 1 (`listings\*.txt`) into `nyghtshade-hollow/characters/listings/`. Commit, `git push -u origin metahuman-web-assets`.
7. Report: branch name, each file with size / triangles / joints (from `--inspect`), the console lines from step 5, any problem and what you did about it.

**Rules.** Never push MetaHuman files to a public repo (`all-projects-combined` is public). Don't change sharing on any Google Drive file. Don't delete or overwrite anything in my Drive or repos. If a step
needs a decision from me, stop at that step and ask in one short message.
---

When it reports back, tell the cloud session: *"pushed `metahuman-web-assets`"* — it pulls the files (`git lfs pull`), copies them into `assets/characters/`,
runs the character and crowd tests with the real files, and tunes the look mapping and lighting.
