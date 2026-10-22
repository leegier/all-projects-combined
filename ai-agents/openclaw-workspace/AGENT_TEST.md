# AGENT TEST PROTOCOL

Run this every time you boot or after agents are created/updated.
Tests each sub-agent with a simple task. Reports pass/fail to Discord.

## Test Script (run each in order)

### Test 1 — SCOUT (research-assistant)
Task: "Search the web for 'top Unity asset store prison assets 2025' and return 3 results."
Expected: Returns 3 URLs/titles within 60 seconds.
Pass criteria: Gets results back, no error.

### Test 2 — DEEP (research-bot)
Task: "Find 2 recent freelance Unity developer jobs posted on Upwork or Fiverr in the last 7 days."
Expected: Returns job listings with links.
Pass criteria: Returns at least 1 result.

### Test 3 — INK (content-writer)
Task: "Write a 3-sentence itch.io game description for a Unity prison escape game called CLAWED."
Expected: Returns 3 polished sentences.
Pass criteria: Gets coherent copy back.

### Test 4 — LINT (code-reviewer)
Task: "Read Z:\Dev\UNITY\BETTERNOW\Assets\CLAWED\Scripts\ and list all .cs files."
Expected: Returns file list.
Pass criteria: Lists files without error.

### Test 5 — GHOST (security-scanner)
Task: "Search for open bug bounty programs on HackerOne that accept Unity or game engine submissions."
Expected: Returns program names/links.
Pass criteria: Returns at least 1 result.

## After Each Test
- PASS: Note in Discord as ✅ AGENTNAME PASS
- FAIL: Note in AGENT_FAILURES.md AND post to Discord as ❌ AGENTNAME FAIL: [reason]

## Run Command
openclaw agent --to <agent-id> --message "<test task>" --deliver
