# all-projects-combined

A combined, organised snapshot of all repositories — plus a new, playable vertical slice of the prison game.

## ▶ Play the demo

**[`games/nyghtshade-hollow`](games/nyghtshade-hollow/README.md) — *Nyghtshade Hollow: The Intake*.**
Open `games/nyghtshade-hollow/dist/index.html` in a browser (WebGL 2, keyboard + mouse; no install, no assets).
A recording of an automated playtest (real input, live assertions on screen, cinematics, failure path) is in
[`games/nyghtshade-hollow/media`](games/nyghtshade-hollow/media).

## Layout

Every original repository is kept intact in a category folder (full map and notes: [docs/REPO_MAP.md](docs/REPO_MAP.md)).

| Folder | Contents |
|---|---|
| [`games/`](games) | `nyghtshade-hollow` (the playable slice) · `clawed-unity` (Unity 6 prototype of the same systems) |
| [`apps/`](apps) | `haunted-america` · `FinMind` |
| [`game-dev-tools/`](game-dev-tools) | `OpenSourceLudus` · `demoIN-HERE` · `GIT-BRAXTONCONFIGDOWNLOADPLUGINUE5` · `prison-navigation` |
| [`ai-agents/`](ai-agents) | `openclaw-workspace` · `Auto-Claude` · `claude-builders-bounty` |
| [`platform-and-devops/`](platform-and-devops) | `coolify` |
| [`archive/`](archive) | Windows workspace backup (`nyghtshade-cloud-tools`) · PC backups · empty/stub repositories |

Notes:
- The move was done with `git mv`; `git log --follow <path>` traces files back to the original layout. Original per-repo commit history is not included.
- Live credentials found in the sources were replaced with `REDACTED` / placeholder values.
- Some folders are forks of third-party projects (`coolify`, `Auto-Claude`, `FinMind`, `OpenSourceLudus`, `claude-builders-bounty`) and keep their original licences.
- Binary/LFS assets (`.uasset`, `.dll`, `.exe`, …) are excluded; text and code only.
- Last updated: 2026-10-15
