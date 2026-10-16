# ============================================================
# FRANKENSTINE AUTO-RESTART - All Services (PowerShell)
# Runs completely hidden via Task Scheduler on every login
# Services: Ollama, Telegram Bot, Discord Bot
# ============================================================

$LogFile = "$env:USERPROFILE\service-autostart.log"

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ts] $msg"
}

Log "=== AUTO-START INITIATED ==="

# Wait for system to settle
Start-Sleep -Seconds 15

# --- 1. OLLAMA ---
$ollamaRunning = Get-Process -Name "ollama app" -ErrorAction SilentlyContinue
if (-not $ollamaRunning) {
    Log "Starting Ollama..."
    Start-Process "$env:LOCALAPPDATA\Programs\Ollama\ollama app.exe"
    Start-Sleep -Seconds 10
    $check = Get-Process -Name "ollama*" -ErrorAction SilentlyContinue
    if ($check) { Log "Ollama started (PID: $($check[0].Id))" }
    else { Log "WARNING: Ollama may have failed to start" }
} else {
    Log "Ollama already running (PID: $($ollamaRunning.Id))"
}

# --- 2. TELEGRAM BOT (kill duplicates first) ---
# Find any existing telegram-bot node processes
$existingNodes = Get-Process node -ErrorAction SilentlyContinue
$telegramRunning = $false
$discordRunning = $false

foreach ($proc in $existingNodes) {
    try {
        $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
        if ($cmdline -match "telegram-bot") { $telegramRunning = $true }
        if ($cmdline -match "mission-control.*bot\.js|bot\.js.*mission-control") { $discordRunning = $true }
    } catch {}
}

if (-not $telegramRunning) {
    Log "Starting Telegram Bot..."
    Start-Process cmd -ArgumentList "/c","cd /d E:\openclaw\workspace\scripts && node telegram-bot.js >> telegram-bot.log 2>&1" -WindowStyle Hidden
    Start-Sleep -Seconds 5
    Log "Telegram Bot started"
} else {
    Log "Telegram Bot already running"
}

# --- 3. DISCORD BOT ---
if (-not $discordRunning) {
    Log "Starting Discord Mission Control Bot..."
    Start-Process cmd -ArgumentList "/c","cd /d E:\openclaw\workspace\mission-control && node bot.js >> discord-bot.log 2>&1" -WindowStyle Hidden
    Start-Sleep -Seconds 5
    Log "Discord Bot started"
} else {
    Log "Discord Bot already running"
}

Log "=== AUTO-START COMPLETED ==="

# --- 4. WATCHDOG: Re-check every 10 minutes forever ---
while ($true) {
    Start-Sleep -Seconds 600
    
    # Check Ollama
    $ollamaCheck = Get-Process -Name "ollama*" -ErrorAction SilentlyContinue
    if (-not $ollamaCheck) {
        Log "WATCHDOG: Ollama died! Restarting..."
        Start-Process "$env:LOCALAPPDATA\Programs\Ollama\ollama app.exe"
    }
    
    # Check Telegram Bot
    $nodeProcs = Get-Process node -ErrorAction SilentlyContinue
    $tgAlive = $false
    $dcAlive = $false
    foreach ($proc in $nodeProcs) {
        try {
            $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            if ($cmdline -match "telegram-bot") { $tgAlive = $true }
            if ($cmdline -match "bot\.js") { $dcAlive = $true }
        } catch {}
    }
    
    if (-not $tgAlive) {
        Log "WATCHDOG: Telegram Bot died! Restarting..."
        Start-Process cmd -ArgumentList "/c","cd /d E:\openclaw\workspace\scripts && node telegram-bot.js >> telegram-bot.log 2>&1" -WindowStyle Hidden
    }
    
    if (-not $dcAlive) {
        Log "WATCHDOG: Discord Bot died! Restarting..."
        Start-Process cmd -ArgumentList "/c","cd /d E:\openclaw\workspace\mission-control && node bot.js >> discord-bot.log 2>&1" -WindowStyle Hidden
    }
}
