# Autonomous Agent Startup Pack — Setup Guide

Welcome to the Autonomous Agent Startup Pack. This guide walks you through everything you need to get your AI agent runtime running in under 30 minutes.

---

## Prerequisites

Before you begin, make sure you have the following installed and available:

- **OpenClaw** — the agent workspace shell (https://openclaw.ai)
- **Python 3.11+** — required for the agent runtime scripts
- **pip packages** — install with:
  ```
  pip install aiohttp aiosqlite
  ```
- **Ollama** — local LLM runner with `llama3.1:8b` pulled:
  ```
  ollama pull llama3.1:8b
  ```

---

## Step 1: Install OpenClaw

Download and install OpenClaw from https://openclaw.ai

OpenClaw provides the workspace environment, skill system, and agent context that the runtime depends on. Follow the installer instructions for your platform.

---

## Step 2: Copy Workspace Config Files to Your OpenClaw Workspace

After installing OpenClaw, copy the following files from this pack into your OpenClaw workspace root directory:

```
BRIEF.md
DIRECTIVES.md
SKILLS-GUIDE.md
PLATFORM_GIGS.md
AGENTS.md
MISSION.md
SOUL.md
IDENTITY.md
TOOLS.md
```

These files define your agent's identity, mission, directives, and available tools. OpenClaw reads them at boot to configure the agent context.

---

## Step 3: Install Agent-Runtime Dependencies

Navigate to the `agent-runtime/` folder from this pack and install the Python dependencies:

```bash
pip install aiohttp aiosqlite
```

Make sure Python 3.11 or higher is on your PATH:

```bash
python --version
```

---

## Step 4: Run the Orchestrator

Start the agent runtime by running the orchestrator:

```bash
python orchestrator.py
```

The orchestrator will:
- Initialize the SQLite database (`db.py`)
- Start the planner loop (`planner.py`)
- Spin up the executor workers (`executor.py`)
- Wire up the DAG task graph (`dag.py`)

On Windows you can also double-click `start-runtime.bat` to launch everything in one step.

---

## Step 5: Add Your First Goal

Once the orchestrator is running, submit a goal from a second terminal:

```bash
python orchestrator.py add "Your goal here"
```

Examples:

```bash
python orchestrator.py add "Research the top 5 competitors in the AI agent space"
python orchestrator.py add "Write a product description for my Gumroad listing"
python orchestrator.py add "Generate a 7-day content calendar for Twitter"
```

The planner will decompose the goal into tasks, build a dependency graph, and the executor will begin working through them autonomously.

---

## Telegram Setup

To receive agent status updates and interact via Telegram:

1. Create a bot via [@BotFather](https://t.me/BotFather) and get your bot token.
2. Add your token to the orchestrator config or set the environment variable:
   ```
   TELEGRAM_BOT_TOKEN=your_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   ```
3. The orchestrator will send task completion summaries and failure alerts to your Telegram chat.

---

## Discord Setup

To connect the agent runtime to a Discord server:

1. Go to https://discord.com/developers/applications and create a new application.
2. Under "Bot", generate a token and invite the bot to your server with message permissions.
3. Set the environment variables:
   ```
   DISCORD_BOT_TOKEN=your_token_here
   DISCORD_CHANNEL_ID=your_channel_id_here
   ```
4. The orchestrator will post goal updates and completions to the specified channel.

---

## Model Configuration

By default the runtime uses `llama3.1:8b` via Ollama on `http://localhost:11434`.

To change the model or endpoint, edit the top of `orchestrator.py`:

```python
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.1:8b"
```

Supported alternatives (must be available in your Ollama installation):

- `llama3.1:70b` — more capable, slower
- `mistral:7b` — fast and efficient
- `phi3:mini` — ultra-lightweight for constrained environments
- Any OpenAI-compatible endpoint — swap the base URL and add an API key variable

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: aiosqlite` | Run `pip install aiosqlite` |
| `Connection refused` on Ollama | Run `ollama serve` in a separate terminal |
| Database locked error | Make sure only one orchestrator instance is running |
| Tasks stuck in PENDING | Check planner logs — the model may be timing out |

---

## Support

For questions, issues, or feature requests, reach out via the Gumroad product page or open an issue at https://openclaw.ai

---

*Autonomous Agent Startup Pack v1 — built with OpenClaw*
