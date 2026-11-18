# Computer map (Gierl) — written 2026-10-02 by Claude Code

Quick top-level survey, not a full scan. Nothing was changed, moved, deleted or installed.
Rules agreed with the user: ask before deleting, overwriting, moving or installing anything, and before sending any email.

## Drives
| Drive | Label | Size / free | What it is |
|---|---|---|---|
| C: | CORE | 476 GB / 129 GB free | Windows, Epic Launcher, Blender 5.2, Codex desktop app, user profile, `Documents\Unreal Projects` (incl. MyProject2) |
| E: | (none) | 1.9 TB / 1.12 TB free | Dumping ground / download + backup drive, not a clean asset library (details below) |
| F: | ARMORY | 931 GB / 290 GB free | Dev tools + Nyghtshade Hollow project copies + asset libraries + Steam |
| H: | ARCHIVE | 477 GB / 190 GB free | The ACTIVE Unreal Engine 5.8.2 install, Unity project, local LLM models |

## Unreal Engine
- **Active engine: `H:\UE_5.8` = UE 5.8.2** (changelist 56702186). Registered in HKCU as build GUID `{EF5B6F51-4366-B808-BAB1-5DB0DF3BCB3C}`. Desktop shortcuts "Unreal Engine 5.8.2" and "MyProject2" launch `H:\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe`.
- `F:\UE_5.8` = UE **5.8.0** (changelist 55116800), an older/other copy; also holds a .git, .claude, AutoClaw, scripts (build_castle.py, mcp_client.py ...). `E:\Telegram Desktop\UE_5.8` also exists (not checked).
- Epic Games Launcher 1.3.210.0 at `C:\Program Files\Epic Games\Launcher`.
- Projects under `C:\Users\Gierl\Documents\Unreal Projects\`:
  - **MyProject2** — engine GUID = H:\UE_5.8 (5.8.2). Folders: Config, Content, DerivedDataCache, Intermediate, Plugins, Saved, Source, `_RawImports_Archive`. Plugins: Engine, Marketplace, Tripo3DUEBridge-UE5.8-Win64. `Source` holds mocap/mannequin FBX docs, not C++ game code. Uproject enables MetaHuman, Aura, AIAssistant, ProceduralVegetationEditor, GameplayStateTree, ModelingTools. Content has ~50 folders (AK-47, AnimStarterPack, Blockouts, Blueprints, Character(s), Chase, Fab, Levels, MetaHumans, Megascans, Megaplant_Library, MineGameplay, Modular_Rural_Cabin, PCG, Scene_OldMine, ThirdPerson, Tripo imports, ...).
  - MyProject (older; engine GUID {71E64E54-...}, not registered now), MyProject 5.8 (same GUID as H:\UE_5.8), ElectricDreamsEnv (no .uproject at this level)
- Projects elsewhere on F: `F:\Unreal Projects\{MyProject, AutoClaw, ElectricDreamsEnv(ElectricDreamsSample.uproject)}`; `F:\Unreal\{NyghtshadeHollow_UE58, NyghtshadeHollow_Fresh, NyghtshadeHollow_UE58_backup}`; `F:\NyghtshadeHollow_Fresh`, `F:\NyghtshadeHollow` (Builds, NativeIntake). All 5.8 association.
- Unity: `F:\Unity\NyghtshadeHollow`, `H:\NyghtshadeHollow_Unity` (has .git; Assets, Library, Packages). Unity Hub is on F:.
- Unreal MCP workspace: `F:\DevTools\UnrealMCPWorkspace\RecoveryWorkspace.uproject`, launched by the "Unreal MCP Recovery Workspace" shortcut with `-ModelContextProtocolStartServer -ModelContextProtocolPort=8000`.

## Blender
- **Blender 5.2.1** — `C:\Program Files\Blender Foundation\Blender 5.2` (proper install, registry-registered).
- **Blender 5.1.x** — portable at `E:\Telegram Desktop\Blender` (the "Blender 5.1.2" and "Blender MCP + Home Builder" shortcuts point here; exe reports 5.1).
- Blender MCP: `F:\DevTools\Blender\start_mcp.py`, `F:\DevTools\BlenderMCP`, extensions/scripts in `F:\DevTools\Blender`.
- Installer on E: `Blender 4.5 LTS Installer.exe` (not installed as far as found).
- Many .blend files at the root of E: (FINALPRISONDRAFTINTOUE5.9*.blend, Untitled*.blend, newblwnd.blend ...).

## Codex
- **Codex CLI 0.157.0** (`@openai/codex`) via npm global in `F:\DevTools\npm` (`codex.cmd`). Desktop shortcut "Codex CLI".
- **Codex desktop app** `OpenAI.Codex` 26.928.1915.0 (Microsoft Store package under C:\Program Files\WindowsApps).
- Config/state in `C:\Users\Gierl\.codex` (config.toml, sessions, skills, plugins, sqlite history). Workspace notes in `C:\Users\Gierl\Documents\Codex\2026-09-27`.
- Other npm globals: openclaw 2026.9.5, opencode-ai 1.18.31. Node v24.18.0, Python 3.12.13, Git 2.54.0 (Git at H:\Program Files\Git). `dotnet` not on PATH.

## Home folder (C:\Users\Gierl) top level
Standard profile folders plus `.claude`, `.codex`, `.cache`, `.config`, `.local`, `.sparc3d-runtime`, `.thumbnails`, `OneDrive`, `.claude.json`.

## Documents
`Codex\`, `Game-Recovery-Audit-2026-09-20\`, `Unreal Projects\`, loose files `3up.fbx`, `new3.fbx`, `Untitled.blend`.

## Downloads
Mostly 2026-10-02 downloads: many Tripo/Sketchfab-style 3D model zips (female/child/head/strongman/muscular man/bikini ...), ~14 `higgsfield-*.mp4` videos, `drive-download-*.zip` x2 (290 MB, 85 MB), `Nyghtshade_Hollow_Dialogue.pdf` x2, `Claude Setup.exe`, a few `.crdownload` leftovers.

## Desktop
Folders: `aurabound`, `ElectricDreamsEnv`, `athletic+female+3d+model.fbm`, `tripo_convert_*.fbm`. Shortcuts: Blender 5.1.2 / 5.2 / MCP + Home Builder, Codex CLI, Unreal Engine 5.8.2, Unreal MCP Recovery Workspace, MyProject2, Nyghtshade Hollow (Play, Unreal Editor, Build Notes), Telegram, Edge, Aura. Files: models (.fbx/.glb: ranch house, barndominium, 3up/13up/new3, tripo), `NYGHTSHADE_MASTER_DOSSIER.md`, `NYGHTSHADE_REPORT_FOR_CHATGPT_2026-09-25.zip` (159 MB), many Codex check/log .txt files and big untitled .txt chat dumps (many duplicated as "- Copy"), 10 IMG_118x.png.

## Drive contents (top level only)
### C:\
Standard Windows + AMD, inetpub, OneDriveTemp, Program Files(x86), Users.

### E:\ (1.9 TB, NO label) — mixed, not a curated asset library
- Root is cluttered with: Prison project files (FINALPRISONDRAFT*.fbx/.blend/.fbm, FPD2BINARY, L_GYM, the cave, aris house, unrealari), 3D-model zips from downloads, installers (Epic, Steam, ChatGPT, Hi3D, VC_redist, Aura), logs (unreal_build.log, unity_compile.log, full_drive_scan.txt, SCENE_INVENTORY.txt), screenshots, Nyghtshade docs (ProjectSweep .docx, Fiverr_Clean.zip).
- Folders: `Telegram Desktop` (the real bulk: Blender 5.1 portable, C_Drive_Overflow_2026-09-15, DevTools, Games incl. Disney Speedstorm / Farming Simulator 25 / FS25 / Ready or Not, GitHub_Audit / GitHub_FRESH / GitHub_Master_Backup, Hermes_*, GameForgeOS, LocalGLM, llama.cpp, models, ollama-backup, UE_5.8, plus hundreds of loose mp3/png/zip/installers/docs, GDD docx), `Recovery-Audit-2026-09-20` (audit logs, Blender-MCP setup, mail-index), `FINALPRISONDRAFT1ACS2ed.fbm`, `FPD2BINARY.fbm`, AMD/Aura/Chipset installers, `Hi3DAgent`, `PPC`, `.tmp.driveupload`.
- Treat E: as backup/overflow + models in progress. It is where most duplicate/junk cleanup candidates live (nothing touched).

### F:\ ARMORY (931 GB) — dev tools + project copies + the Megascans library
- Asset libraries: `Megascans Library\Downloaded\UAssets` (Quixel Megascans), `PrisonAssets\{FBX, Textures}` (2 FBX entries, Textures empty), `PoppyPlaytimeChapterOne`, `Unity`.
- Tools: `DevTools` (bin, Blender, BlenderMCP, cache, npm, OpenClaw, Python, UnrealMCPWorkspace, UnrealSDKs), `ollama`, `ocu`, `steam`.
- Project/dev copies: `NyghtshadeHollow`, `_Fresh`, `_Staging`, `NYGHTSHADE_AI` (Docs, Installers, Logs, OllamaModels), `NYGHTSHADE_HOLLOW_DEVELOPER_HANDOFF`, `PrisonScripts`, `Unreal`, `Unreal Projects`, `UE_5.8` (5.8.0), `New folder\AutoClaw`.
- Root also has ~40 shortcuts (Steam, Epic, Unity Hub, VS Code, Git Bash, Roblox Studio, Google Drive/Docs/Sheets/Slides ...), move logs (megascans_move.log, hogwarts_move.log, myproject_move.log), and `pagefile.sys`.

### H:\ ARCHIVE (477 GB) — engine + models
- `UE_5.8` (**active 5.8.2 engine**), `NyghtshadeHollow_Unity` (git repo), `models\GLM-5.2-UD-Q2_K_XL` and `ollama\models` (local LLMs), `Farming.Simulator.25.v1.13.0.0`, `Program Files\Git`, `Users\Gierl` (only AppData), `Users\CodexSandboxOffline`, `.claude\settings.local.json`.
- Not an art library.

## Connectors
- **Google Drive: WORKS.** Found folder `GAMEDEV` (id 1CqXQj4ZtJ-tPNxcAk_ClMFS-Ifz68y6R, created 2026-03-09, last viewed 2026-04-03). It contains one subfolder, "New folder", at top level (the listing was not walked further). The folder is owned by leegier6@gmail.com, which is not the login email on this Claude Code session (maxgier2026@gmail.com), so Drive is connected as a different or shared account. Verify which one before writing there.
- **Gmail: DOES NOT WORK.** The Gmail connector was disconnected earlier this session (`/mcp` -> "Disconnected from claude.ai Gmail") and no Gmail tools are exposed. Reconnect via `/mcp`. A "Superhuman Mail" connector is listed but needs OAuth sign-in (not started).
- Also listed but NOT signed in: Slack, Notion, Figma, Stripe, PayPal, etc. Calendar tools are exposed (not tested). Hugging Face is connected.

## Things to be careful about
- Several files on E: look sensitive (e.g. `github-recovery-codes*.txt`, leases, employment/insurance PDFs, resume). They were NOT opened. Consider moving them off a cluttered shared drive (needs the user's OK).
- Duplicates: many Desktop "- Copy" files, repeated Downloads zips, 3+ UE 5.8 copies (F:, H:, E:Telegram) — large cleanup potential, but nothing should be removed without asking.
- Three different engine trees: only H:\UE_5.8 (5.8.2) is registered/used by MyProject2.
