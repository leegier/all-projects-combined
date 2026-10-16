# Register Windows Task Scheduler task for auto-start on login
# Run this ONCE to set it up

# Remove old task if exists
try {
    Unregister-ScheduledTask -TaskName 'FrankenstineAutoStart' -Confirm:$false -ErrorAction Stop
    Write-Output "Old task removed"
} catch {
    Write-Output "No existing task to remove"
}

# Create the action - run PowerShell hidden with the startup script
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-WindowStyle Hidden -ExecutionPolicy Bypass -File E:\openclaw\workspace\scripts\startup-services.ps1'

# Trigger on any user logon
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register the task
Register-ScheduledTask -TaskName 'FrankenstineAutoStart' -Action $action -Trigger $trigger -Settings $settings -Description 'Auto-starts Ollama, Telegram Bot, Discord Bot. Includes watchdog.' -RunLevel Highest

Write-Output "=== TASK REGISTERED ==="
Get-ScheduledTask -TaskName 'FrankenstineAutoStart' | Format-List TaskName,State,Description
