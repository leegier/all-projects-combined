# ============================================================================
# WINDOWS 11 PERFORMANCE OPTIMIZATION FOR GAME DEVELOPMENT
# Machine: Ryzen 5 7600X | 32GB RAM | AMD RX 7700 XT
# Purpose: Unreal Engine 5.7 + Unity 6 Development
# Date: Generated 2026-03-30
# ============================================================================
# IMPORTANT: Run as Administrator!
# ============================================================================

$ErrorActionPreference = "Continue"
$LogFile = "E:\openclaw\workspace\scripts\pc-optimization-log.txt"
$TotalFreed = 0

function Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

# Clear previous log
if (Test-Path $LogFile) { Remove-Item $LogFile -Force }
Log "========== WINDOWS 11 OPTIMIZATION STARTED =========="
Log "Machine: $env:COMPUTERNAME | User: $env:USERNAME"
Log "OS: $(Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty Caption)"
Log "CPU: $(Get-CimInstance Win32_Processor | Select-Object -ExpandProperty Name)"
Log "RAM: $([math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)) GB"
Log "GPU: $(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name | Out-String)"

# ============================================================================
# 1. DISABLE WINDOWS BLOATWARE / TELEMETRY
# ============================================================================
Log ""
Log "===== SECTION 1: DISABLE BLOATWARE AND TELEMETRY ====="

# Disable DiagTrack (Connected User Experiences and Telemetry)
Log "Disabling DiagTrack service..."
try {
    Stop-Service -Name "DiagTrack" -Force -ErrorAction SilentlyContinue
    Set-Service -Name "DiagTrack" -StartupType Disabled -ErrorAction Stop
    Log "  [OK] DiagTrack disabled"
} catch { Log "  [WARN] DiagTrack: $_" }

# Disable dmwappushservice (WAP Push Message Routing Service)
Log "Disabling dmwappushservice..."
try {
    Stop-Service -Name "dmwappushservice" -Force -ErrorAction SilentlyContinue
    Set-Service -Name "dmwappushservice" -StartupType Disabled -ErrorAction Stop
    Log "  [OK] dmwappushservice disabled"
} catch { Log "  [WARN] dmwappushservice: $_" }

# Disable telemetry via registry
Log "Disabling telemetry via registry..."
$telemetryKeys = @(
    @{ Path = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection"; Name = "AllowTelemetry"; Value = 0; Type = "DWord" },
    @{ Path = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection"; Name = "AllowTelemetry"; Value = 0; Type = "DWord" },
    @{ Path = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection"; Name = "DoNotShowFeedbackNotifications"; Value = 1; Type = "DWord" }
)
foreach ($key in $telemetryKeys) {
    try {
        if (!(Test-Path $key.Path)) { New-Item -Path $key.Path -Force | Out-Null }
        Set-ItemProperty -Path $key.Path -Name $key.Name -Value $key.Value -Type $key.Type -Force
        Log "  [OK] Set $($key.Path)\$($key.Name) = $($key.Value)"
    } catch { Log "  [WARN] $($key.Path)\$($key.Name): $_" }
}

# Disable Cortana
Log "Disabling Cortana..."
try {
    $cortanaPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search"
    if (!(Test-Path $cortanaPath)) { New-Item -Path $cortanaPath -Force | Out-Null }
    Set-ItemProperty -Path $cortanaPath -Name "AllowCortana" -Value 0 -Type DWord -Force
    Set-ItemProperty -Path $cortanaPath -Name "AllowCortanaAboveLock" -Value 0 -Type DWord -Force
    Set-ItemProperty -Path $cortanaPath -Name "AllowSearchToUseLocation" -Value 0 -Type DWord -Force
    Log "  [OK] Cortana disabled"
} catch { Log "  [WARN] Cortana: $_" }

# Disable Windows Search indexing on E: drive (project drive)
Log "Disabling Windows Search indexing on E: drive..."
try {
    $searchPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search"
    if (!(Test-Path $searchPath)) { New-Item -Path $searchPath -Force | Out-Null }
    # Disable search indexing for E: drive via WMI
    $obj = New-Object -ComObject "Microsoft.Search.Interop.CSearchManager"
    $catalog = $obj.GetCatalog("SystemIndex")
    $crawlScope = $catalog.GetCrawlScopeManager()
    $crawlScope.AddDefaultScopeRule("file:///E:\", $false, 0)
    $crawlScope.SaveAll()
    Log "  [OK] E: drive excluded from search indexing"
} catch { 
    Log "  [INFO] COM search manager not available, using alternative method"
    try {
        # Alternative: Use registry to reduce search indexing
        Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search" -Name "AllowIndexingEncryptedStoresOrItems" -Value 0 -Type DWord -Force
        Log "  [OK] Search indexing restricted via registry"
    } catch { Log "  [WARN] Search indexing: $_" }
}

# Disable tips/suggestions/ads in Settings
Log "Disabling tips, suggestions, and ads..."
$adsKeys = @(
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "SystemPaneSuggestionsEnabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "SilentInstalledAppsEnabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "SoftLandingEnabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "SubscribedContent-338388Enabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "SubscribedContent-338389Enabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "SubscribedContent-310093Enabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "SubscribedContent-338393Enabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "SubscribedContent-353694Enabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "SubscribedContent-353696Enabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "RotatingLockScreenEnabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"; Name = "RotatingLockScreenOverlayEnabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"; Name = "ShowSyncProviderNotifications"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"; Name = "Start_IrisRecommendations"; Value = 0 }
)
foreach ($key in $adsKeys) {
    try {
        if (!(Test-Path $key.Path)) { New-Item -Path $key.Path -Force | Out-Null }
        Set-ItemProperty -Path $key.Path -Name $key.Name -Value $key.Value -Type DWord -Force
        Log "  [OK] Disabled: $($key.Name)"
    } catch { Log "  [WARN] $($key.Name): $_" }
}

# Disable Customer Experience Improvement Program
Log "Disabling CEIP..."
try {
    $ceipPath = "HKLM:\SOFTWARE\Policies\Microsoft\SQMClient\Windows"
    if (!(Test-Path $ceipPath)) { New-Item -Path $ceipPath -Force | Out-Null }
    Set-ItemProperty -Path $ceipPath -Name "CEIPEnable" -Value 0 -Type DWord -Force
    Log "  [OK] CEIP disabled"
} catch { Log "  [WARN] CEIP: $_" }

# Disable Windows Error Reporting
Log "Disabling Windows Error Reporting..."
try {
    Stop-Service -Name "WerSvc" -Force -ErrorAction SilentlyContinue
    Set-Service -Name "WerSvc" -StartupType Disabled -ErrorAction SilentlyContinue
    $werPath = "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting"
    Set-ItemProperty -Path $werPath -Name "Disabled" -Value 1 -Type DWord -Force
    Log "  [OK] Windows Error Reporting disabled"
} catch { Log "  [WARN] WER: $_" }

# Disable Delivery Optimization (P2P updates)
Log "Disabling Delivery Optimization P2P..."
try {
    $doPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization"
    if (!(Test-Path $doPath)) { New-Item -Path $doPath -Force | Out-Null }
    Set-ItemProperty -Path $doPath -Name "DODownloadMode" -Value 0 -Type DWord -Force
    Log "  [OK] Delivery Optimization P2P disabled (local only)"
} catch { Log "  [WARN] Delivery Optimization: $_" }

# Disable Game Bar and Game DVR
Log "Disabling Game Bar and Game DVR..."
$gameBarKeys = @(
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR"; Name = "AppCaptureEnabled"; Value = 0 },
    @{ Path = "HKCU:\System\GameConfigStore"; Name = "GameDVR_Enabled"; Value = 0 },
    @{ Path = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\GameDVR"; Name = "AllowGameDVR"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\GameBar"; Name = "UseNexusForGameBarEnabled"; Value = 0 },
    @{ Path = "HKCU:\Software\Microsoft\GameBar"; Name = "AutoGameModeEnabled"; Value = 0 }
)
foreach ($key in $gameBarKeys) {
    try {
        if (!(Test-Path $key.Path)) { New-Item -Path $key.Path -Force | Out-Null }
        Set-ItemProperty -Path $key.Path -Name $key.Name -Value $key.Value -Type DWord -Force
        Log "  [OK] GameBar: $($key.Name) = $($key.Value)"
    } catch { Log "  [WARN] GameBar $($key.Name): $_" }
}

# Disable Copilot
Log "Disabling Copilot..."
try {
    $copilotPath = "HKCU:\Software\Policies\Microsoft\Windows\WindowsCopilot"
    if (!(Test-Path $copilotPath)) { New-Item -Path $copilotPath -Force | Out-Null }
    Set-ItemProperty -Path $copilotPath -Name "TurnOffWindowsCopilot" -Value 1 -Type DWord -Force
    $copilotPath2 = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot"
    if (!(Test-Path $copilotPath2)) { New-Item -Path $copilotPath2 -Force | Out-Null }
    Set-ItemProperty -Path $copilotPath2 -Name "TurnOffWindowsCopilot" -Value 1 -Type DWord -Force
    Log "  [OK] Copilot disabled"
} catch { Log "  [WARN] Copilot: $_" }

# ============================================================================
# 2. OPTIMIZE POWER SETTINGS
# ============================================================================
Log ""
Log "===== SECTION 2: POWER SETTINGS ====="

# Enable Ultimate Performance power plan
Log "Enabling Ultimate Performance power plan..."
try {
    # First unhide it
    powercfg /duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>$null
    # List power plans to find it
    $plans = powercfg /list
    $ultimatePlan = ($plans | Select-String "Ultimate Performance" | ForEach-Object { 
        if ($_ -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') { $matches[1] }
    }) | Select-Object -First 1
    
    if ($ultimatePlan) {
        powercfg /setactive $ultimatePlan
        Log "  [OK] Ultimate Performance plan activated: $ultimatePlan"
    } else {
        # Fall back to High Performance
        $highPlan = ($plans | Select-String "High performance" | ForEach-Object { 
            if ($_ -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') { $matches[1] }
        }) | Select-Object -First 1
        if ($highPlan) {
            powercfg /setactive $highPlan
            Log "  [OK] High Performance plan activated: $highPlan"
        } else {
            Log "  [WARN] Could not find High Performance plan"
        }
    }
} catch { Log "  [WARN] Power plan: $_" }

# Disable USB selective suspend
Log "Configuring power settings..."
try {
    # USB Selective Suspend: Disable (AC and DC)
    powercfg /setacvalueindex scheme_current 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    powercfg /setdcvalueindex scheme_current 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    Log "  [OK] USB selective suspend disabled"
} catch { Log "  [WARN] USB suspend: $_" }

try {
    # PCI Express Link State Power Management: Off (0)
    powercfg /setacvalueindex scheme_current 501a4d13-42af-4429-9fd1-a8218c268e20 ee12f906-d277-404b-b6da-e5fa1a576df5 0
    powercfg /setdcvalueindex scheme_current 501a4d13-42af-4429-9fd1-a8218c268e20 ee12f906-d277-404b-b6da-e5fa1a576df5 0
    Log "  [OK] PCI Express ASPM disabled"
} catch { Log "  [WARN] PCIE ASPM: $_" }

try {
    # Processor min/max state: 100%
    powercfg /setacvalueindex scheme_current 54533251-82be-4824-96c1-47b60b740d00 893dee8e-2bef-41e0-89c6-b55d0929964c 100
    powercfg /setdcvalueindex scheme_current 54533251-82be-4824-96c1-47b60b740d00 893dee8e-2bef-41e0-89c6-b55d0929964c 100
    powercfg /setacvalueindex scheme_current 54533251-82be-4824-96c1-47b60b740d00 bc5038f7-23e0-4960-96da-33abaf5935ec 100
    powercfg /setdcvalueindex scheme_current 54533251-82be-4824-96c1-47b60b740d00 bc5038f7-23e0-4960-96da-33abaf5935ec 100
    Log "  [OK] Processor min/max power state set to 100%"
} catch { Log "  [WARN] Processor power: $_" }

try {
    # Hard disk sleep: Never (0)
    powercfg /setacvalueindex scheme_current 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0
    powercfg /setdcvalueindex scheme_current 0012ee47-9041-4b5d-9b77-535fba8b1442 6738e2c4-e8a5-4a42-b16a-e040e769756e 0
    Log "  [OK] Hard disk sleep disabled"
} catch { Log "  [WARN] HDD sleep: $_" }

try {
    # Display sleep: 30 minutes on AC, 15 on DC
    powercfg /setacvalueindex scheme_current 7516b95f-f776-4464-8c53-06167f40cc99 3c0bc021-c8a8-4e07-a973-6b14cbcb2b7e 1800
    powercfg /setdcvalueindex scheme_current 7516b95f-f776-4464-8c53-06167f40cc99 3c0bc021-c8a8-4e07-a973-6b14cbcb2b7e 900
    Log "  [OK] Display sleep set to 30 min AC / 15 min DC"
} catch { Log "  [WARN] Display sleep: $_" }

try {
    # Apply all changes
    powercfg /setactive scheme_current
    Log "  [OK] Power settings applied"
} catch { Log "  [WARN] Apply power: $_" }

# ============================================================================
# 3. CLEAR TEMP FILES
# ============================================================================
Log ""
Log "===== SECTION 3: CLEAR TEMP FILES ====="

function Get-FolderSize($path) {
    if (Test-Path $path) {
        return (Get-ChildItem -Path $path -Recurse -Force -ErrorAction SilentlyContinue | 
                Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
    }
    return 0
}

function Clear-FolderContents($path, $desc) {
    if (Test-Path $path) {
        $before = Get-FolderSize $path
        $beforeMB = [math]::Round($before / 1MB, 2)
        try {
            Get-ChildItem -Path $path -Force -ErrorAction SilentlyContinue | 
                Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
            $after = Get-FolderSize $path
            $freed = $before - $after
            $freedMB = [math]::Round($freed / 1MB, 2)
            $script:TotalFreed += $freed
            Log "  [OK] $desc - Freed ${freedMB} MB (was ${beforeMB} MB)"
        } catch { Log "  [WARN] $desc : $_" }
    } else {
        Log "  [SKIP] $desc - Path not found: $path"
    }
}

# Windows temp
Clear-FolderContents "C:\Windows\Temp" "Windows Temp"

# User temp
Clear-FolderContents "$env:TEMP" "User Temp ($env:TEMP)"
Clear-FolderContents "$env:LOCALAPPDATA\Temp" "User LocalAppData Temp"

# Windows Update cache
Log "Clearing Windows Update cache..."
try {
    Stop-Service -Name "wuauserv" -Force -ErrorAction SilentlyContinue
    $before = Get-FolderSize "C:\Windows\SoftwareDistribution\Download"
    Get-ChildItem "C:\Windows\SoftwareDistribution\Download" -Force -ErrorAction SilentlyContinue | 
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    $after = Get-FolderSize "C:\Windows\SoftwareDistribution\Download"
    $freed = $before - $after
    $script:TotalFreed += $freed
    Log "  [OK] Windows Update cache - Freed $([math]::Round($freed / 1MB, 2)) MB"
    Start-Service -Name "wuauserv" -ErrorAction SilentlyContinue
} catch { Log "  [WARN] WU cache: $_" }

# Thumbnail cache
Clear-FolderContents "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" "Thumbnail cache"

# DirectX shader cache
Clear-FolderContents "$env:LOCALAPPDATA\D3DSCache" "DirectX shader cache"
Clear-FolderContents "$env:LOCALAPPDATA\NVIDIA\DXCache" "NVIDIA DX cache"
Clear-FolderContents "$env:LOCALAPPDATA\AMD\DxCache" "AMD DX shader cache"
Clear-FolderContents "$env:LOCALAPPDATA\AMD\VkCache" "AMD Vulkan shader cache"
Clear-FolderContents "$env:LOCALAPPDATA\AMD\GLCache" "AMD GL shader cache"

# Unreal Engine derived data cache
$ueDDCPaths = @(
    "$env:LOCALAPPDATA\UnrealEngine\Common\DerivedDataCache",
    "$env:APPDATA\Unreal Engine\Common\DerivedDataCache",
    "$env:LOCALAPPDATA\UnrealEngine\Intermediate"
)
foreach ($path in $ueDDCPaths) {
    Clear-FolderContents $path "UE5 Derived Data Cache ($path)"
}

# Also check for UE project Intermediate/DerivedDataCache on E: drive
$ueProjects = Get-ChildItem "E:\" -Directory -ErrorAction SilentlyContinue | Where-Object { 
    Test-Path "$($_.FullName)\*.uproject" 
}
foreach ($proj in $ueProjects) {
    Clear-FolderContents "$($proj.FullName)\Intermediate" "UE Project Intermediate: $($proj.Name)"
    Clear-FolderContents "$($proj.FullName)\DerivedDataCache" "UE Project DDC: $($proj.Name)"
}

# Unity shader cache
$unityPaths = @(
    "$env:LOCALAPPDATA\Unity\cache",
    "$env:APPDATA\Unity\Asset Store-5.x",  # Old asset store cache
    "$env:LOCALAPPDATA\Unity\Editor\ShaderCache"
)
foreach ($path in $unityPaths) {
    Clear-FolderContents $path "Unity cache ($path)"
}

# Prefetch
Clear-FolderContents "C:\Windows\Prefetch" "Windows Prefetch"

# Windows error reports
Clear-FolderContents "C:\ProgramData\Microsoft\Windows\WER" "Windows Error Reports"
Clear-FolderContents "$env:LOCALAPPDATA\CrashDumps" "User Crash Dumps"

# Recycle Bin
Log "Clearing Recycle Bin..."
try {
    Clear-RecycleBin -Force -ErrorAction SilentlyContinue
    Log "  [OK] Recycle Bin emptied"
} catch { Log "  [WARN] Recycle Bin: $_" }

$totalFreedMB = [math]::Round($TotalFreed / 1MB, 2)
$totalFreedGB = [math]::Round($TotalFreed / 1GB, 2)
Log "  === TOTAL SPACE FREED: ${totalFreedMB} MB (${totalFreedGB} GB) ==="

# ============================================================================
# 4. OPTIMIZE UNREAL ENGINE BUILD SETTINGS
# ============================================================================
Log ""
Log "===== SECTION 4: UNREAL ENGINE BUILD OPTIMIZATION ====="

# BuildConfiguration.xml for parallel compilation
$buildConfigDir = "$env:APPDATA\Unreal Engine\UnrealBuildTool"
$buildConfigFile = "$buildConfigDir\BuildConfiguration.xml"

Log "Setting up UE5 BuildConfiguration.xml..."
try {
    if (!(Test-Path $buildConfigDir)) { 
        New-Item -Path $buildConfigDir -ItemType Directory -Force | Out-Null 
    }
    
    # Backup existing
    if (Test-Path $buildConfigFile) {
        Copy-Item $buildConfigFile "$buildConfigFile.bak" -Force
        Log "  [OK] Backed up existing BuildConfiguration.xml"
    }
    
    $numCores = (Get-CimInstance Win32_Processor).NumberOfCores
    $numThreads = (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors
    
    $buildConfig = @"
<?xml version="1.0" encoding="utf-8" ?>
<Configuration xmlns="https://www.unrealengine.com/BuildConfiguration">
    <ParallelExecutor>
        <MaxProcessorCount>$numThreads</MaxProcessorCount>
        <ProcessorCountMultiplier>1.0</ProcessorCountMultiplier>
        <bStopCompilationAfterErrors>false</bStopCompilationAfterErrors>
    </ParallelExecutor>
    <BuildConfiguration>
        <MaxParallelActions>$numThreads</MaxParallelActions>
        <bAllowHybridExecutor>true</bAllowHybridExecutor>
        <bAllowXGE>true</bAllowXGE>
        <bAllowFASTBuild>true</bAllowFASTBuild>
    </BuildConfiguration>
    <LocalExecutor>
        <MaxLocalActions>$numThreads</MaxLocalActions>
    </LocalExecutor>
    <WindowsPlatform>
        <MaximumShaderCompileWorkerCount>$numThreads</MaximumShaderCompileWorkerCount>
    </WindowsPlatform>
</Configuration>
"@
    
    Set-Content -Path $buildConfigFile -Value $buildConfig -Encoding UTF8
    Log "  [OK] BuildConfiguration.xml created with $numThreads parallel threads"
    Log "  [OK] Shader compilation set to use all $numThreads logical processors"
} catch { Log "  [WARN] BuildConfiguration.xml: $_" }

# Optimize UE5 ConsoleVariables.ini for dev builds
$ueConfigDir = "$env:APPDATA\Unreal Engine\Engine\Config"
if (!(Test-Path $ueConfigDir)) { New-Item -Path $ueConfigDir -ItemType Directory -Force | Out-Null }
$consolVarsFile = "$ueConfigDir\ConsoleVariables.ini"
Log "Setting UE5 console variables for dev performance..."
try {
    if (Test-Path $consolVarsFile) {
        Copy-Item $consolVarsFile "$consolVarsFile.bak" -Force
    }
    $consoleVars = @"
[Startup]
; Performance optimizations for development
r.ShaderDevelopmentMode=1
r.Shaders.Optimize=1
r.XGEShaderCompile=1
; Use all cores for shader compilation
r.ShaderCompiler.NumWorkers=$numThreads
; Faster iteration
r.CreateShadersOnLoad=1
; Reduce shader compilation stalls
r.ShaderPipelineCache.Enabled=1
"@
    Set-Content -Path $consolVarsFile -Value $consoleVars -Encoding UTF8
    Log "  [OK] ConsoleVariables.ini optimized for dev builds"
} catch { Log "  [WARN] ConsoleVariables.ini: $_" }

# ============================================================================
# 5. SET PROCESS PRIORITIES (creates boost-performance.bat)
# ============================================================================
Log ""
Log "===== SECTION 5: PROCESS PRIORITY SCRIPT ====="

$boostScript = @'
@echo off
:: ============================================================================
:: BOOST PERFORMANCE - Game Dev Priority Script
:: Sets high priority for dev tools, low priority for background services
:: Run as Administrator for best results
:: ============================================================================
echo [BOOST] Setting process priorities for game development...

:: HIGH PRIORITY for dev tools
:: UnrealEditor
wmic process where "name='UnrealEditor.exe'" CALL setpriority "high priority" >nul 2>&1
wmic process where "name='UnrealEditor-Win64-DebugGame.exe'" CALL setpriority "high priority" >nul 2>&1
wmic process where "name='UE4Editor.exe'" CALL setpriority "high priority" >nul 2>&1

:: Unity
wmic process where "name='Unity.exe'" CALL setpriority "high priority" >nul 2>&1

:: Visual Studio
wmic process where "name='devenv.exe'" CALL setpriority "above normal" >nul 2>&1
wmic process where "name='MSBuild.exe'" CALL setpriority "high priority" >nul 2>&1
wmic process where "name='cl.exe'" CALL setpriority "above normal" >nul 2>&1
wmic process where "name='link.exe'" CALL setpriority "above normal" >nul 2>&1

:: Node.js (for OpenClaw)
wmic process where "name='node.exe'" CALL setpriority "above normal" >nul 2>&1

:: Blender
wmic process where "name='blender.exe'" CALL setpriority "above normal" >nul 2>&1

:: Shader compilers
wmic process where "name='ShaderCompileWorker.exe'" CALL setpriority "above normal" >nul 2>&1

:: LOW PRIORITY for background services (don't kill, just deprioritize)
:: Windows Update
wmic process where "name='TiWorker.exe'" CALL setpriority "below normal" >nul 2>&1
wmic process where "name='TrustedInstaller.exe'" CALL setpriority "below normal" >nul 2>&1
wmic process where "name='wuauclt.exe'" CALL setpriority "below normal" >nul 2>&1

:: OneDrive
wmic process where "name='OneDrive.exe'" CALL setpriority "below normal" >nul 2>&1

:: Windows Defender (don't disable, just lower priority)
wmic process where "name='MsMpEng.exe'" CALL setpriority "below normal" >nul 2>&1

:: Microsoft Edge background
wmic process where "name='msedge.exe'" CALL setpriority "below normal" >nul 2>&1

:: Teams background
wmic process where "name='ms-teams.exe'" CALL setpriority "below normal" >nul 2>&1

:: Indexing
wmic process where "name='SearchIndexer.exe'" CALL setpriority "idle" >nul 2>&1
wmic process where "name='SearchProtocolHost.exe'" CALL setpriority "idle" >nul 2>&1

:: Set CPU affinity - ensure dev tools get priority on performance cores
echo [BOOST] Process priorities configured!
echo.
echo Priority levels applied:
echo   HIGH:         UnrealEditor, Unity, MSBuild, ShaderCompileWorker
echo   ABOVE NORMAL: devenv, node, blender, cl.exe, link.exe
echo   BELOW NORMAL: Windows Update, OneDrive, Defender, Edge, Teams
echo   IDLE:         SearchIndexer
echo.
echo Run this script periodically or after launching your dev tools.
pause
'@

Set-Content -Path "E:\openclaw\workspace\scripts\boost-performance.bat" -Value $boostScript -Encoding ASCII
Log "  [OK] Created boost-performance.bat"

# ============================================================================
# 6. DISABLE UNNECESSARY STARTUP PROGRAMS
# ============================================================================
Log ""
Log "===== SECTION 6: STARTUP PROGRAMS ====="

Log "Listing all startup programs..."

# Get startup items from registry
$startupPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run"
)

$allStartups = @()
foreach ($path in $startupPaths) {
    if (Test-Path $path) {
        $items = Get-ItemProperty $path -ErrorAction SilentlyContinue
        $items.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" } | ForEach-Object {
            $allStartups += [PSCustomObject]@{
                Name = $_.Name
                Path = $path
                Value = $_.Value
            }
            Log "  Found: $($_.Name) => $($_.Value)"
        }
    }
}

# Also check Task Scheduler for startup tasks
Log "Checking scheduled tasks at logon..."
$logonTasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object {
    $_.Triggers | Where-Object { $_.CimClass.CimClassName -eq 'MSFT_TaskLogonTrigger' }
} | Select-Object TaskName, State
foreach ($task in $logonTasks) {
    Log "  Scheduled at logon: $($task.TaskName) [$($task.State)]"
}

# Disable non-essential startup items
# Keep: Ollama, Discord, essential drivers (Realtek, AMD, etc.)
$keepPatterns = @("Ollama", "Discord", "Realtek", "AMD", "Security", "Defender", "cccreator", "RadeonSoftware")
$disableCount = 0

foreach ($item in $allStartups) {
    $shouldKeep = $false
    foreach ($pattern in $keepPatterns) {
        if ($item.Name -match $pattern -or $item.Value -match $pattern) {
            $shouldKeep = $true
            break
        }
    }
    
    if (-not $shouldKeep) {
        # Disable by renaming the registry value (prefix with -)
        try {
            # Store original for restore
            Log "  Disabling startup: $($item.Name)"
            # Move to disabled key
            $disabledPath = $item.Path -replace "\\Run$", "\Run-Disabled"
            if (!(Test-Path $disabledPath)) { New-Item -Path $disabledPath -Force | Out-Null }
            Set-ItemProperty -Path $disabledPath -Name $item.Name -Value $item.Value -Force
            Remove-ItemProperty -Path $item.Path -Name $item.Name -Force -ErrorAction SilentlyContinue
            $disableCount++
            Log "  [OK] Disabled: $($item.Name)"
        } catch { Log "  [WARN] Could not disable $($item.Name): $_" }
    } else {
        Log "  [KEEP] $($item.Name)"
    }
}

# Disable non-essential scheduled tasks
$disableTasks = @(
    "Microsoft\Windows\Application Experience\Microsoft Compatibility Appraiser",
    "Microsoft\Windows\Application Experience\ProgramDataUpdater",
    "Microsoft\Windows\Autochk\Proxy",
    "Microsoft\Windows\Customer Experience Improvement Program\Consolidator",
    "Microsoft\Windows\Customer Experience Improvement Program\UsbCeip",
    "Microsoft\Windows\DiskDiagnostic\Microsoft-Windows-DiskDiagnosticDataCollector",
    "Microsoft\Windows\Maps\MapsToastTask",
    "Microsoft\Windows\Maps\MapsUpdateTask",
    "Microsoft\Windows\Shell\FamilySafetyMonitor",
    "Microsoft\Windows\Shell\FamilySafetyRefreshTask"
)

foreach ($task in $disableTasks) {
    try {
        Disable-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue | Out-Null
        Log "  [OK] Disabled scheduled task: $task"
    } catch { Log "  [SKIP] Task $task not found or already disabled" }
}

Log "  Total startup items disabled: $disableCount"

# ============================================================================
# 7. OPTIMIZE GPU SETTINGS (AMD RX 7700 XT)
# ============================================================================
Log ""
Log "===== SECTION 7: AMD GPU OPTIMIZATION ====="

# AMD Radeon registry settings
$amdRegPaths = @(
    "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0000",
    "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0001"
)

foreach ($amdPath in $amdRegPaths) {
    if (Test-Path $amdPath) {
        Log "Found GPU registry at: $amdPath"
        
        # Performance mode
        try {
            Set-ItemProperty -Path $amdPath -Name "KMD_EnableComputePreemption" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
            Log "  [OK] Compute preemption optimized"
        } catch { Log "  [WARN] Compute preemption: $_" }
        
        # Disable ULPS (Ultra Low Power State) - prevents GPU from downclocking aggressively
        try {
            Set-ItemProperty -Path $amdPath -Name "EnableUlps" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
            Log "  [OK] ULPS disabled (prevents aggressive GPU downclocking)"
        } catch { Log "  [WARN] ULPS: $_" }
    }
}

# AMD Software settings via registry
$amdSoftwarePath = "HKCU:\Software\AMD\DVR"
if (!(Test-Path $amdSoftwarePath)) { New-Item -Path $amdSoftwarePath -Force | Out-Null }

# Global AMD settings
$amdSettings = @(
    @{ Path = "HKCU:\Software\AMD\CN"; Name = "AutoUpdateEnabled"; Value = 0; Desc = "Disable AMD auto-update" },
    @{ Path = "HKCU:\Software\AMD\CN"; Name = "TelemetryEnabled"; Value = 0; Desc = "Disable AMD telemetry" }
)

foreach ($setting in $amdSettings) {
    try {
        if (!(Test-Path $setting.Path)) { New-Item -Path $setting.Path -Force | Out-Null }
        Set-ItemProperty -Path $setting.Path -Name $setting.Name -Value $setting.Value -Type DWord -Force
        Log "  [OK] $($setting.Desc)"
    } catch { Log "  [WARN] $($setting.Desc): $_" }
}

# Set AMD shader cache location to E: drive
Log "Configuring AMD shader cache location..."
try {
    $amdCachePath = "E:\AMD_shader_cache"
    if (!(Test-Path $amdCachePath)) { New-Item -Path $amdCachePath -ItemType Directory -Force | Out-Null }
    # AMD uses environment variable for shader cache
    [System.Environment]::SetEnvironmentVariable("AMD_SHADER_CACHE_PATH", $amdCachePath, "User")
    Log "  [OK] AMD shader cache set to E:\AMD_shader_cache"
} catch { Log "  [WARN] AMD shader cache path: $_" }

# Disable HDCP via registry (helps with display latency)
Log "Disabling HDCP..."
try {
    foreach ($amdPath in $amdRegPaths) {
        if (Test-Path $amdPath) {
            Set-ItemProperty -Path $amdPath -Name "RMHdcpKeyglobZero" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
        }
    }
    Log "  [OK] HDCP disabled (registry)"
} catch { Log "  [WARN] HDCP: $_" }

# V-Sync: Let apps control (disable global)
Log "Setting V-Sync to application-controlled..."
try {
    foreach ($amdPath in $amdRegPaths) {
        if (Test-Path $amdPath) {
            # 0 = Use application setting, 1 = Always on, 2 = Always off
            Set-ItemProperty -Path $amdPath -Name "KMD_VSyncControl" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
        }
    }
    Log "  [OK] V-Sync set to application-controlled"
} catch { Log "  [WARN] V-Sync: $_" }

# Texture filtering to Performance
Log "Setting texture filtering to Performance..."
try {
    foreach ($amdPath in $amdRegPaths) {
        if (Test-Path $amdPath) {
            Set-ItemProperty -Path $amdPath -Name "KMD_TextureFilterQuality" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
        }
    }
    Log "  [OK] Texture filtering set to Performance"
} catch { Log "  [WARN] Texture filtering: $_" }

# ============================================================================
# 8. ADDITIONAL OPTIMIZATIONS
# ============================================================================
Log ""
Log "===== SECTION 8: ADDITIONAL OPTIMIZATIONS ====="

# Pagefile optimization for 32GB RAM (8GB-16GB on E:)
Log "Configuring pagefile..."
try {
    # Disable automatic pagefile management
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem
    if ($cs.AutomaticManagedPagefile) {
        # Use WMI to disable auto pagefile
        $cs | Set-CimInstance -Property @{AutomaticManagedPagefile=$false}
        Log "  [OK] Automatic pagefile management disabled"
    }
    
    # Set pagefile on E: drive (8192MB min, 16384MB max)
    # Remove existing pagefiles first
    $existingPagefiles = Get-CimInstance -ClassName Win32_PageFileSetting -ErrorAction SilentlyContinue
    foreach ($pf in $existingPagefiles) {
        Remove-CimInstance -InputObject $pf -ErrorAction SilentlyContinue
    }
    
    # Create pagefile on E:
    New-CimInstance -ClassName Win32_PageFileSetting -Property @{
        Name = "E:\pagefile.sys"
        InitialSize = 8192
        MaximumSize = 16384
    } -ErrorAction SilentlyContinue
    
    # Keep a small pagefile on C: for crash dumps
    New-CimInstance -ClassName Win32_PageFileSetting -Property @{
        Name = "C:\pagefile.sys"
        InitialSize = 2048
        MaximumSize = 4096
    } -ErrorAction SilentlyContinue
    
    Log "  [OK] Pagefile: E: 8GB-16GB, C: 2GB-4GB (for crash dumps)"
} catch { Log "  [WARN] Pagefile config: $_" }

# Disable transparency effects
Log "Disabling transparency and animations..."
try {
    Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "EnableTransparency" -Value 0 -Type DWord -Force
    Log "  [OK] Transparency effects disabled"
} catch { Log "  [WARN] Transparency: $_" }

# Disable animations / visual effects for performance
try {
    # SystemPropertiesPerformance -> Adjust for best performance (partial)
    $visualFxPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects"
    if (!(Test-Path $visualFxPath)) { New-Item -Path $visualFxPath -Force | Out-Null }
    Set-ItemProperty -Path $visualFxPath -Name "VisualFXSetting" -Value 2 -Type DWord -Force
    
    # Individual animation settings
    $advancedPath = "HKCU:\Control Panel\Desktop"
    Set-ItemProperty -Path $advancedPath -Name "UserPreferencesMask" -Value ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00)) -Type Binary -Force
    Set-ItemProperty -Path $advancedPath -Name "MenuShowDelay" -Value "0" -Force
    Set-ItemProperty -Path $advancedPath -Name "DragFullWindows" -Value "0" -Force
    
    $dwmPath = "HKCU:\Software\Microsoft\Windows\DWM"
    Set-ItemProperty -Path $dwmPath -Name "EnableAeroPeek" -Value 0 -Type DWord -Force
    Set-ItemProperty -Path $dwmPath -Name "AlwaysHibernateThumbnails" -Value 0 -Type DWord -Force
    
    # Disable window animations
    Set-ItemProperty -Path "HKCU:\Control Panel\Desktop\WindowMetrics" -Name "MinAnimate" -Value "0" -Force
    
    Log "  [OK] Visual effects set to performance mode"
} catch { Log "  [WARN] Visual effects: $_" }

# Set AMD GPU as preferred for UE5 and Unity
Log "Setting GPU preference for game dev apps..."
$gpuPreferenceApps = @(
    "UnrealEditor.exe",
    "Unity.exe",
    "blender.exe",
    "devenv.exe"
)
$gpuPrefPath = "HKCU:\Software\Microsoft\DirectX\UserGpuPreferences"
if (!(Test-Path $gpuPrefPath)) { New-Item -Path $gpuPrefPath -Force | Out-Null }

# Find UE5 and Unity paths
$ueEditorPaths = Get-ChildItem "C:\Program Files\Epic Games" -Recurse -Filter "UnrealEditor.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
$unityPaths = Get-ChildItem "C:\Program Files\Unity" -Recurse -Filter "Unity.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

$appPaths = @()
if ($ueEditorPaths) { $appPaths += $ueEditorPaths.FullName }
if ($unityPaths) { $appPaths += $unityPaths.FullName }

foreach ($app in $appPaths) {
    try {
        # GpuPreference=2 means High Performance GPU
        Set-ItemProperty -Path $gpuPrefPath -Name $app -Value "GpuPreference=2;" -Force
        Log "  [OK] GPU preference set to High Performance for: $app"
    } catch { Log "  [WARN] GPU preference for ${app}: $_" }
}

# Disable SysMain (SuperFetch) - reduces disk thrashing on dev workstations
Log "Disabling SysMain (SuperFetch)..."
try {
    Stop-Service -Name "SysMain" -Force -ErrorAction SilentlyContinue
    Set-Service -Name "SysMain" -StartupType Disabled -ErrorAction Stop
    Log "  [OK] SysMain/SuperFetch disabled"
} catch { Log "  [WARN] SysMain: $_" }

# Disable network adapter power management
Log "Disabling network adapter power management..."
try {
    $netAdapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }
    foreach ($adapter in $netAdapters) {
        # Disable power management via registry
        $adapterPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}"
        $subkeys = Get-ChildItem $adapterPath -ErrorAction SilentlyContinue
        foreach ($key in $subkeys) {
            $driverDesc = Get-ItemProperty -Path $key.PSPath -Name "DriverDesc" -ErrorAction SilentlyContinue
            if ($driverDesc.DriverDesc -eq $adapter.InterfaceDescription) {
                Set-ItemProperty -Path $key.PSPath -Name "PnPCapabilities" -Value 24 -Type DWord -Force -ErrorAction SilentlyContinue
                Log "  [OK] Power management disabled for: $($adapter.Name) ($($adapter.InterfaceDescription))"
            }
        }
    }
} catch { Log "  [WARN] Network power management: $_" }

# Disable Nagle's algorithm for better network latency
Log "Disabling Nagle's algorithm..."
try {
    $tcpPath = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces"
    $interfaces = Get-ChildItem $tcpPath -ErrorAction SilentlyContinue
    foreach ($iface in $interfaces) {
        $ipAddr = Get-ItemProperty -Path $iface.PSPath -Name "DhcpIPAddress" -ErrorAction SilentlyContinue
        if ($ipAddr.DhcpIPAddress -and $ipAddr.DhcpIPAddress -ne "0.0.0.0") {
            Set-ItemProperty -Path $iface.PSPath -Name "TcpAckFrequency" -Value 1 -Type DWord -Force
            Set-ItemProperty -Path $iface.PSPath -Name "TCPNoDelay" -Value 1 -Type DWord -Force
            Set-ItemProperty -Path $iface.PSPath -Name "TcpDelAckTicks" -Value 0 -Type DWord -Force
            Log "  [OK] Nagle's algorithm disabled for interface: $($iface.PSChildName)"
        }
    }
    # Also set global TCP parameters
    $globalTcpPath = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters"
    Set-ItemProperty -Path $globalTcpPath -Name "TcpAckFrequency" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $globalTcpPath -Name "TCPNoDelay" -Value 1 -Type DWord -Force -ErrorAction SilentlyContinue
    Log "  [OK] Global TCP optimization applied"
} catch { Log "  [WARN] Nagle: $_" }

# Additional: Disable Last Access Time updates on NTFS (reduces disk writes)
Log "Disabling NTFS last access time updates..."
try {
    fsutil behavior set disablelastaccess 1
    Log "  [OK] NTFS last access time updates disabled"
} catch { Log "  [WARN] NTFS lastaccess: $_" }

# Additional: Increase NTFS memory cache
Log "Optimizing NTFS memory usage..."
try {
    fsutil behavior set memoryusage 2
    Log "  [OK] NTFS memory usage set to level 2 (maximum)"
} catch { Log "  [WARN] NTFS memory: $_" }

# Disable hibernation (saves disk space)
Log "Disabling hibernation..."
try {
    powercfg /hibernate off
    Log "  [OK] Hibernation disabled (saves several GB on C:)"
} catch { Log "  [WARN] Hibernation: $_" }

# ============================================================================
# SUMMARY
# ============================================================================
Log ""
Log "========== OPTIMIZATION COMPLETE =========="
Log "Total disk space freed: ${totalFreedMB} MB (${totalFreedGB} GB)"
Log "Changes require a restart to fully take effect."
Log "Restore script: E:\openclaw\workspace\scripts\restore-defaults.bat"
Log "Boost script: E:\openclaw\workspace\scripts\boost-performance.bat"
Log "This log: $LogFile"
Log ""
Log "RECOMMENDED: Restart your PC now for all changes to take effect."

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  OPTIMIZATION COMPLETE!" -ForegroundColor Green
Write-Host "  Log saved to: $LogFile" -ForegroundColor Yellow
Write-Host "  Please restart your PC." -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Green
