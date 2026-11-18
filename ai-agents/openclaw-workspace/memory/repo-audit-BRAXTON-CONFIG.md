# Repo Audit: BRAXTON-CONFIG

**Audited:** 2026-04-01
**Location:** `E:\repos\BRAXTON-CONFIG`
**GitHub:** https://github.com/daddy-gier/BRAXTON-CONFIG.git
**Commits:** 1 (initial commit only)
**Total Source Files:** 8 (excluding .git)

---

## What Is It?

**BRAXTON-CONFIG** is a **desktop Electron app** that serves as a personal local AI chat console. It's branded "CLAWBOT" and provides a sleek dark-mode UI to chat with a local Ollama model (gemma3:27b) running on localhost.

### Architecture
```
Electron (main.js)  →  loads Vite/React frontend
    ↓
Express server (server/index.js, port 3002)  →  proxies to Ollama API (localhost:11434)
    ↓
React UI (web/src/BraxtonConfig.jsx)  →  chat interface with GPU node dashboard
```

### Key Features
- **Chat with local AI** via Ollama (gemma3:27b model)
- **Conversation memory** — messages persist in-session
- **GPU node dashboard** — shows 6 GPU nodes with animated load bars (CAPTAIN/GTX 1080, FRANKENSTINE/RX 7700 XT, etc.) — currently hardcoded/simulated
- **Windows Speech Recognition** — voice input via PowerShell System.Speech
- **Electron Forge packaging** — ready to build Windows installer (Squirrel)
- **Dark cyberpunk UI** — #050508 background, cyan (#00BCD4) accent, monospace font

### File Inventory
| File | Purpose | Lines |
|------|---------|-------|
| `package.json` | Electron + Vite + React config, Forge packaging | 52 |
| `main.js` | Electron main process, window, server spawn, speech IPC | 101 |
| `preload.js` | Context bridge for speech + app control | 12 |
| `index.html` | Shell HTML | 12 |
| `vite.config.js` | Vite dev server on port 5174 | 9 |
| `server/package.json` | Express server deps | 13 |
| `server/index.js` | Express API proxy to Ollama /api/chat | 69 |
| `web/src/BraxtonConfig.jsx` | Main React UI (chat, GPU dashboard) | 230→237 |
| `web/src/main.jsx` | React entry point | 5 |
| `.gitignore` | Standard ignores | 12 |

---

## Bugs Found & Fixed

### 1. `.gitignore` had stray ` ```javascript ` at end (line 13)
**Fixed:** Removed the garbage line.

### 2. STOP button was non-functional (AbortController never wired)
**Problem:** `abortRef` was declared but never assigned an `AbortController`. Clicking STOP did nothing — the fetch would continue.
**Fixed:** Added `const controller = new AbortController(); abortRef.current = controller;` before fetch, and passed `controller.signal` to the fetch call. Also added AbortError handling to prevent false error banners.

### 3. Conversation history was discarded on each query
**Problem:** `queryOllama()` only sent `messages[messages.length - 1].content` — the last message — despite claiming "memory is active across messages."
**Fixed:** Now sends full conversation history as formatted prompt so CLAWBOT actually remembers context.

---

## Useful for Making Money?

**Rating: 3/10 — Low direct value, moderate indirect value**

- ❌ Not sellable as-is — it's a basic Ollama chat wrapper
- ❌ GPU dashboard is 100% fake (hardcoded simulated data)
- ❌ No unique features beyond what Ollama WebUI already provides free
- ✅ Could become the foundation for a branded CLAWED AI companion app
- ✅ The Electron packaging is ready — could bundle as a "CLAWED AI Assistant" product
- ✅ Speech recognition is a nice differentiator if polished

### Monetization Ideas
1. **Bundle with CLAWED game** as "CLAWBOT Companion" — an in-lore AI assistant
2. **Sell on itch.io** as a standalone local AI desktop app (niche but possible)
3. **Use as internal tool** for managing CLAWED game dev with AI assistance

---

## Useful for CLAWED Game?

**Rating: 6/10 — Good foundation for game companion/dev tool**

- ✅ Already branded as "CLAWBOT" — fits CLAWED universe
- ✅ Could be the desktop companion for prison RPG lore (interrogation AI, security system terminal)
- ✅ GPU node dashboard could display actual game server status
- ✅ Speech recognition could power in-game voice commands
- ❌ Needs real data feeds (not simulated)
- ❌ Needs game-specific prompts and lore integration

---

## Recommendations

1. **Wire GPU dashboard to real Ollama/system data** — `nvidia-smi` or `rocm-smi` for actual GPU stats
2. **Add persistent conversation storage** — save chat history to SQLite or JSON files
3. **Integrate with OpenClaw** — use as a front-end for MAX agent system
4. **Add model selection** — let user pick from available Ollama models
5. **Production build not tested** — `build/` directory doesn't exist; need `npm run build` first

---

## Dependencies Status
- `react 18.2.0`, `react-dom 18.2.0` — current
- `electron latest` — ⚠️ should pin version
- `vite 4.3.9` — slightly old (5.x available)
- `express 4.18.2` — current
- `electron-forge 7.11.1` — current
- **No node_modules present** — needs `npm run setup` before first use
