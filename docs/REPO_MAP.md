# Repository map

Every original repository is kept intact (same internal layout, same files) and now lives in a
category folder. Nothing was deleted or edited during the move; `git log --follow <path>` still
traces each file back through the rename.

| Category | Folder | Original repo | What it is |
|---|---|---|---|
| **games** | `games/nyghtshade-hollow` | *(new)* | Playable vertical slice of the prison game — "The Intake" |
| | `games/clawed-unity` | `leegier/CLAWED-Unity` | Unity 6 / URP prototype: survival, stealth, guard AI, routine, DC economy, reputation (the systems the slice re-implements) |
| **apps** | `apps/haunted-america` | `leegier/haunted-america` | Paranormal-investigation web platform landing page |
| | `apps/FinMind` | `leegier/FinMind` | Personal-finance app (fork) |
| **game-dev-tools** | `game-dev-tools/OpenSourceLudus` | `leegier/OpenSourceLudus` | Ludus-style MCP server + Unity/UE5 bridges |
| | `game-dev-tools/demoIN-HERE` | `leegier/demoIN-HERE` | Unity editor "Ludus AI" window plugin |
| | `game-dev-tools/GIT-BRAXTONCONFIGDOWNLOADPLUGINUE5` | `leegier/GIT-BRAXTONCONFIGDOWNLOADPLUGINUE5` | Nyghtshade landing site + MCP server + UE5/Unity bridges |
| | `game-dev-tools/prison-navigation` | `leegier/nyghtshade-cloud-tools` (`tools/`, `data/`) | Occupancy-grid & route tools for the UE5 prison map |
| **ai-agents** | `ai-agents/openclaw-workspace` | `leegier/openclaw-workspace` | OpenClaw agent workspace, skills, content pipeline |
| | `ai-agents/Auto-Claude` | `leegier/Auto-Claude` | Multi-agent autonomous coding framework (fork) |
| | `ai-agents/claude-builders-bounty` | `leegier/claude-builders-bounty` | Bounty-board README (fork) |
| **platform-and-devops** | `platform-and-devops/coolify` | `leegier/coolify` | Self-hosted PaaS (fork) |
| **archive** | `archive/windows-workspace-backup/nyghtshade-cloud-tools` | `leegier/nyghtshade-cloud-tools` (everything except `tools/`, `data/`) | Windows profile / tool-state backup, design PDFs, UE recovery audits |
| | `archive/pc-backups/*` | `OZARK01-BACKUP`, `NYGHTSHADE`, `from-pc-should-be-everything` | PC backup indexes |
| | `archive/placeholders/*` | `101`, `NewRepo`, `NewRepo111…`, `clawedhomenstuff`, `this-setup-page-t`, `hollow` | Empty / stub repositories kept for completeness |

## Notes

- `ai-agents/Auto-Claude/braxtonconfig/the nyghtshade hollow/` is a stray duplicate copy of Auto-Claude
  (it is not game content). It was left in place to keep this move non-destructive.
- `archive/placeholders/hollow` is an Auto-Claude `CLAUDE.md` + Apache licence stub, not game code.
- Third-party forks (`coolify`, `Auto-Claude`, `FinMind`, `claude-builders-bounty`) keep their own licences.
