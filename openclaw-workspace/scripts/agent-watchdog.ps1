# Agent Watchdog — runs every 5 minutes
# Kicks MAX + all sub-agents if idle, ensures everyone is working on revenue tasks

$logFile = "Z:\openclaw\workspace\WATCHDOG.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logPath = "$env:LOCALAPPDATA\Temp\openclaw\openclaw-$(Get-Date -Format 'yyyy-MM-dd').log"

# Check for agent activity in last 5 minutes
$cutoff = (Get-Date).AddMinutes(-5)
$recentLines = Get-Content $logPath -Tail 100 -ErrorAction SilentlyContinue
$recentActivity = $recentLines | Where-Object { $_ -match "(tool_call|executing|agent reply|task complete)" }

Add-Content $logFile "[$timestamp] Watchdog check — activity: $($null -ne $recentActivity)"

# Always kick MAX to keep working
& openclaw agent --agent main --message "Watchdog check. Report: what task are you currently executing? Then immediately continue working on the next uncompleted item from BRIEF.md mission priority list. Use sub-agents for parallel tasks: SCOUT for research, INK for copy, GHOST for bounties. Keep going." --deliver --channel discord

# Kick GHOST to scan for bounties
& openclaw agent --agent security-scanner --message "Scan GitHub for open bounties tagged good-first-issue or bounty with rewards. Use GitHub PAT from Z:/openclaw/workspace/credentials.json (github.pat_1). Find 3 bounties MAX can claim. Write findings to Z:/openclaw/workspace/redteam/BOUNTIES.md"

# Kick SCOUT to find freelance jobs
& openclaw agent --agent research-assistant --message "Search for freelance jobs posted in the last 24 hours on Upwork and Fiverr matching: AI automation, game development, Unity, Unreal Engine, Python scripting. Find 5 jobs MAX can bid on. Write to Z:/openclaw/workspace/LEADS.md"

# Kick INK to write content
& openclaw agent --agent content-writer --message "Check Z:/openclaw/workspace/PLATFORM_GIGS.md. If any Fiverr gigs are not yet published, write optimized gig titles, descriptions, and tags for them. Save to Z:/openclaw/workspace/GIG_COPY.md"

Add-Content $logFile "[$timestamp] All agents kicked"
