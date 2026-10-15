# all-projects-combined

A combined snapshot of ~20 repositories gathered into a single repo. Each original
repository lives in its own top-level folder. This is a point-in-time snapshot of the
tracked files only:

- **No per-repo history** — original commit histories are not included; everything was
  combined into this repo in a single pass.
- **Credentials redacted** — live secrets found in the sources were replaced with
  `REDACTED` / placeholder values.

Use the index below as a map of what each folder is.

---

## Major applications

| Folder | Description | Tech stack |
|--------|-------------|------------|
| `coolify` | Fork of the self-hosting PaaS (an open-source Heroku / Netlify / Vercel alternative). | PHP 8.4 / Laravel 12 |
| `Auto-Claude` | Fork of [AndyMik90/Auto-Claude](https://github.com/AndyMik90/Auto-Claude) — an autonomous multi-agent coding framework that builds software through coordinated Claude Code SDK agent sessions in isolated workspaces. | Electron + Node frontend / Python 3.12 backend |
| `FinMind` | AI budget / bill-tracking app. Containerized full stack with Postgres + Redis. | React 18 + Vite + TypeScript frontend, Flask (Python) backend, Postgres 16 + Redis 7, Docker Compose |
| `openclaw-workspace` | Autonomous AI-agent operations workspace ("MAX agent"): Markdown control files (BRIEF, MISSION, DIRECTIVES, etc.), 222 skills, and helper scripts. | Markdown + Python / shell scripts |

## Game / Ludus–Nyghtshade automation

| Folder | Description | Tech stack |
|--------|-------------|------------|
| `CLAWED-Unity` | Unity prison-level game "CLAWED" (project sources: `Assets`, `Packages`, `ProjectSettings`). | Unity / C# |
| `GIT-BRAXTONCONFIGDOWNLOADPLUGINUE5` | "Nyghtshade Holo Site" static landing page plus a TypeScript MCP server (`xai-server`) for Unity / UE5 automation. | Static HTML/CSS/JS + TypeScript MCP server (`@modelcontextprotocol/sdk`) |
| `OpenSourceLudus` | TypeScript MCP server (`open-source-ludus`) for Unity / UE5 AI asset editing, with `unity/` and `ue5/` integration dirs. | TypeScript MCP server (`@modelcontextprotocol/sdk`) |
| `demoIN-HERE` | Unity editor plugin demo (`Assets/Editor/LudusAIWindow.cs`). | Unity / C# editor plugin |

## Sites & bounty board

| Folder | Description | Tech stack |
|--------|-------------|------------|
| `haunted-america` | Static single-page site for a paranormal platform. | Single `index.html` |
| `claude-builders-bounty` | Community bounty-board README + LICENSE (MIT) for Claude Code builders. | Markdown docs |

## Stubs, backups & placeholders

| Folder | Description | Contents |
|--------|-------------|----------|
| `OZARK01-BACKUP` | PC backup index describing a branch layout (MAX workspace, OpenClaw config, UE5 project, etc.). | `README.md` only |
| `NYGHTSHADE` | Backup note for a UE5 project. | `.gitattributes` + `backups/MyProject2_20261005/PREFLIGHT_ONLY.md` |
| `from-pc-should-be-everything` | One-line backup note ("everything in pc for the devproject"). | `README.md` only |
| `hollow` | Contains a **misplaced Auto-Claude `CLAUDE.md`** (stored as `README.md`) plus an Auto-Claude LICENSE. See notes below. | `README.md` + `LICENSE` |
| `101` | Empty placeholder. | `.gitignore` + `.gitattributes` only |
| `NewRepo` | Empty placeholder. | `.gitignore` + `.gitattributes` only |
| `NewRepo11111111111111111111111111111111111111111111` | Empty placeholder. | `.gitignore` + `.gitattributes` only |
| `clawedhomenstuff` | Empty placeholder. | `.gitattributes` only |
| `this-setup-page-t` | Empty placeholder. | `.gitattributes` only |

---

## Notes / known issues

- **`NewRepo111111111` is not present on disk.** An earlier version of this README listed a
  `NewRepo111111111` folder. It does not exist as its own top-level folder — only
  `NewRepo` and `NewRepo11111111111111111111111111111111111111111111` are present.
- **`hollow` duplicates Auto-Claude docs.** The `hollow/README.md` is actually a copy of
  Auto-Claude's `CLAUDE.md` guidance file, and `hollow/LICENSE` is Auto-Claude's license.
  The folder is kept as-is for now; it is not a distinct project.
- **Several folders are empty placeholders** (`101`, `NewRepo`,
  `NewRepo11111111111111111111111111111111111111111111`, `clawedhomenstuff`,
  `this-setup-page-t`) — they contain only `.gitignore` / `.gitattributes` stubs and no
  source.

---

## Forks & licenses

Some folders are forks of third-party projects and keep their original licenses:

- `coolify` — Apache-2.0
- `Auto-Claude` — AGPL-3.0 (see `Auto-Claude/agpl-3.0.txt`)
- `claude-builders-bounty` — MIT

Other third-party forks retain whatever license shipped with them. Check each folder's own
`LICENSE` file before reusing its code.
