# CLAWED Hourly Build Agent
# Runs via Task Scheduler every hour — checks build status, reports via Claude Code

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$projectPath = "E:\Gier\Projects\CLAWED\CLAWED\CLAWED.uproject"
$logPath = "E:\Gier\Projects\CLAWED\CLAWED\Saved\Logs"
$statusFile = "E:\openclaw\workspace\clawed-build-status.md"

# Get latest build log
$latestLog = Get-ChildItem $logPath -Filter "*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$logContent = if ($latestLog) { Get-Content $latestLog.FullName -Tail 100 -ErrorAction SilentlyContinue | Out-String } else { "No build log found" }

# Check if UE5 editor is running
$ueRunning = Get-Process -Name "UnrealEditor" -ErrorAction SilentlyContinue

# Write local status file
$status = @"
# CLAWED Build Status
**Timestamp:** $timestamp
**UE5 Editor Running:** $(if ($ueRunning) { 'YES' } else { 'NO' })
**Latest Log:** $(if ($latestLog) { $latestLog.Name } else { 'None' })

## Last 100 Log Lines
``````
$logContent
``````
"@

Set-Content -Path $statusFile -Value $status -Encoding UTF8

# Run Claude Code for analysis (non-interactive)
$prompt = @"
You are the CLAWED build agent. Timestamp: $timestamp
Project: $projectPath (NOTE: E: drive, not Z:)

Latest build log (last 100 lines):
$logContent

UE5 Editor Running: $(if ($ueRunning) { 'YES - do NOT trigger rebuild' } else { 'NO' })

Tasks:
1. Identify any compile errors or warnings in the log
2. If errors found and editor is NOT running, suggest rebuild command
3. Write a brief status summary
4. If critical error, note it for Telegram notification

Keep it brief. Report status and next action.
"@

# Only run claude if it exists
if (Get-Command claude -ErrorAction SilentlyContinue) {
    claude --print "$prompt" 2>&1 | Tee-Object -FilePath "E:\openclaw\workspace\clawed-agent-latest.log"
} else {
    Write-Output "Claude Code not found in PATH - skipping analysis"
    Add-Content -Path $statusFile -Value "`n## Agent Note`nClaude Code CLI not found. Install or add to PATH."
}

Write-Output "CLAWED build agent completed at $timestamp"
