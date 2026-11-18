# TEAM.md — Your Sub-Agents (REAL OpenClaw Agents)

These are LIVE agents. Delegate to them using the `session` tool or `openclaw agent --to <agent-id>`.

## How to Delegate

```
openclaw agent --to research-assistant --message "Research task here" --deliver
```
Or via session tool inside your context:
```
session.create(agentId: "research-assistant")
→ session.send(sessionId, "task")
→ session.receive(sessionId)
```

## Agents

### 🔍 SCOUT — Research Assistant
- **Agent ID:** `research-assistant`
- **Workspace:** `Z:\openclaw\agents\research-assistant`
- **Use for:** Web research, finding sources, current info, market research
- **Model:** ollama/mistral-nemo-agent:latest

### 🧠 DEEP — Research Bot
- **Agent ID:** `research-bot`
- **Workspace:** `Z:\openclaw\agents\research-bot`
- **Use for:** Deep multi-source research, credibility checks, comprehensive reports
- **Model:** ollama/mistral-nemo-agent:latest

### ✍️ INK — Content Writer
- **Agent ID:** `content-writer`
- **Workspace:** `Z:\openclaw\agents\content-writer`
- **Use for:** Blog posts, social copy, itch.io listings, marketing emails
- **Model:** ollama/mistral-nemo-agent:latest

### 🛠️ LINT — Code Reviewer
- **Agent ID:** `code-reviewer`
- **Workspace:** `Z:\openclaw\agents\code-reviewer`
- **Use for:** Unity C# bugs, UE5 C++ compile errors, code audits
- **Model:** ollama/mistral-nemo-agent:latest

### 👻 GHOST — Security Scanner
- **Agent ID:** `security-scanner`
- **Workspace:** `Z:\openclaw\agents\security-scanner`
- **Use for:** Bug bounties, vulnerability research, security audits
- **Model:** ollama/mistral-nemo-agent:latest

## Failure Protocol
Every agent writes failures to: `Z:\openclaw\workspace\AGENT_FAILURES.md`
Format: `[TIMESTAMP] AGENTNAME_FAIL: reason | TASK: what | BLOCKED_BY: what`

**MAX: After every delegated task, check if AGENT_FAILURES.md was updated. If yes, post the failure to Discord channel 1484731361272139838 immediately.**

## Rules
- Delegate when the task clearly fits a specialist
- Always sanity-check output before passing to Lee
- If a sub-agent fails twice, handle it yourself and log to AGENT_FAILURES.md
- Report ALL failures to Lee via Discord — no silent failures
