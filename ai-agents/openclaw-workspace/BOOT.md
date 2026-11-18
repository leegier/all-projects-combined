# BOOT.md — Gateway Startup Checklist

Runs automatically when the OpenClaw gateway starts.

## CRITICAL: Session Metadata Handling

**When this runs, session metadata (message_id, sender_id, etc.) will be null.** This is an INTERNAL boot session — not a user message.

- **DO NOT output session metadata JSON to any channel.** Never echo back the session info block.
- **DO NOT send a message to Discord/Telegram unless you have actual status to report** (a completed task, a blocker, or it's been >8h since last contact).
- If you have nothing new to report, **run silently** — complete tasks without posting anything.
- The `NO_REPLY` / `HEARTBEAT_OK` debug text must NEVER be sent to channels. Those are internal markers only.

## Do This Every Boot

1. Check `memory/heartbeat-state.json` for last check timestamps
2. Brief Lee on Discord ONLY if it's been >8h since last message — keep it to 2–3 bullet points max, NO metadata dumps
3. Run background tasks silently (CLAWED compile check, FORGE progress) — report only if there's a blocker

**DO NOT read MEMORY.md, CLAWED_TASKS.md, IDENTITY.md, SOUL.md, or any other large file at boot.** BRIEF.md has everything you need. Reading extra files wastes the entire context window.
