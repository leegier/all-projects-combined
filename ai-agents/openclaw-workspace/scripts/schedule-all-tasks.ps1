# Empire Scheduled Tasks Setup
# Run this ONCE as Administrator in PowerShell
# Right-click PowerShell -> Run as Administrator -> paste this path

$ErrorActionPreference = "Stop"
Write-Host "Setting up Empire Scheduled Tasks..." -ForegroundColor Cyan

# Find node.exe
$nodePath = (Get-Command node).Source
Write-Host "Node found at: $nodePath" -ForegroundColor Gray

# Task 1: 2 AM Nightly Autonomous Worker
$action1 = New-ScheduledTaskAction -Execute $nodePath -Argument "Z:\openclaw\workspace\scripts\nightly-worker.js" -WorkingDirectory "Z:\openclaw\workspace\scripts"
$trigger1 = New-ScheduledTaskTrigger -Daily -At "02:00AM"
$settings1 = New-ScheduledTaskSettingsSet -StartWhenAvailable -DisallowStartIfOnBatteries $false -StopIfGoingOnBatteries $false -ExecutionTimeLimit (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "Empire-NightlyWorker-2AM" -Action $action1 -Trigger $trigger1 -Settings $settings1 -RunLevel Highest -Force
Write-Host "  [OK] 2 AM Nightly Worker" -ForegroundColor Green

# Task 2: 7 AM Stock Research Report
$action2 = New-ScheduledTaskAction -Execute $nodePath -Argument "Z:\openclaw\workspace\scripts\stock-research.js" -WorkingDirectory "Z:\openclaw\workspace\scripts"
$trigger2 = New-ScheduledTaskTrigger -Daily -At "07:00AM"
$settings2 = New-ScheduledTaskSettingsSet -StartWhenAvailable -DisallowStartIfOnBatteries $false -StopIfGoingOnBatteries $false -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName "Empire-StockResearch-7AM" -Action $action2 -Trigger $trigger2 -Settings $settings2 -RunLevel Highest -Force
Write-Host "  [OK] 7 AM Stock Research" -ForegroundColor Green

# Task 3: 8 AM Trend Scout
$action3 = New-ScheduledTaskAction -Execute $nodePath -Argument "Z:\openclaw\workspace\scripts\trend-scout.js" -WorkingDirectory "Z:\openclaw\workspace\scripts"
$trigger3 = New-ScheduledTaskTrigger -Daily -At "08:00AM"
$settings3 = New-ScheduledTaskSettingsSet -StartWhenAvailable -DisallowStartIfOnBatteries $false -StopIfGoingOnBatteries $false -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName "Empire-TrendScout-8AM" -Action $action3 -Trigger $trigger3 -Settings $settings3 -RunLevel Highest -Force
Write-Host "  [OK] 8 AM Trend Scout" -ForegroundColor Green

# Task 4: 1 PM Daily Brief
$action4 = New-ScheduledTaskAction -Execute $nodePath -Argument "Z:\openclaw\workspace\scripts\daily-brief.js" -WorkingDirectory "Z:\openclaw\workspace\scripts"
$trigger4 = New-ScheduledTaskTrigger -Daily -At "01:00PM"
$settings4 = New-ScheduledTaskSettingsSet -StartWhenAvailable -DisallowStartIfOnBatteries $false -StopIfGoingOnBatteries $false -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName "Empire-DailyBrief-1PM" -Action $action4 -Trigger $trigger4 -Settings $settings4 -RunLevel Highest -Force
Write-Host "  [OK] 1 PM Daily Brief" -ForegroundColor Green

# Task 5: Sunday 9 PM R&D Debate
$debateArg = "Z:\openclaw\workspace\rd-team\weekly-debate.js `"What is the best revenue opportunity for our empire this week?`""
$action5 = New-ScheduledTaskAction -Execute $nodePath -Argument $debateArg -WorkingDirectory "Z:\openclaw\workspace\rd-team"
$trigger5 = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "09:00PM"
$settings5 = New-ScheduledTaskSettingsSet -StartWhenAvailable -DisallowStartIfOnBatteries $false -StopIfGoingOnBatteries $false -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName "Empire-RDDebate-SundayPM" -Action $action5 -Trigger $trigger5 -Settings $settings5 -RunLevel Highest -Force
Write-Host "  [OK] Sunday 9 PM R&D Debate" -ForegroundColor Green

Write-Host ""
Write-Host "All 5 tasks registered!" -ForegroundColor Cyan
Write-Host "Verify in Task Scheduler: press Win+R -> taskschd.msc" -ForegroundColor Gray
Write-Host ""
Write-Host "IMPORTANT: Make sure ANTHROPIC_API_KEY is set in your user environment variables." -ForegroundColor Yellow
Write-Host "Win+R -> sysdm.cpl -> Advanced -> Environment Variables -> New" -ForegroundColor Gray
