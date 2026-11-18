# PC cleanup + optimize  -  written by Claude, 2026-10-06
# DEFAULT = DRY RUN: prints what it would do and how much space it frees. Nothing changes.
#   Dry run:         powershell -ExecutionPolicy Bypass -File optimize_pc.ps1
#   Do it:           powershell -ExecutionPolicy Bypass -File optimize_pc.ps1 -Go
#   Also trim boot:  add -DisableStartup     (reversible: Task Manager > Startup apps > Enable)
#   Disk maintenance (TRIM SSDs, defrag the HDD): run from an ADMIN PowerShell and add -Optimize
# Deletes ONLY: old temp files, recycle bin, pip cache.  Everything else is MOVED (nothing of yours is deleted).
# Close Unreal / Blender / browsers first for best results (locked files are skipped, not forced).
param([switch]$Go, [switch]$DisableStartup, [switch]$Optimize)

$freed = 0L
function GB($b) { '{0:N2} GB' -f ($b / 1GB) }
function Section($t) { Write-Host "`n=== $t" -ForegroundColor Cyan }
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $Go) { Write-Host 'DRY RUN - nothing will be changed. Add -Go to apply.' -ForegroundColor Yellow }

# ---- 1. Temp files older than 2 days (never touches the active Claude session folder) -------------------
Section '1. Old temp files'
foreach ($t in @($env:TEMP, 'C:\Windows\Temp')) {
  if (-not (Test-Path $t)) { continue }
  $old = Get-ChildItem $t -Recurse -Force -File -ErrorAction SilentlyContinue |
         Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-2) -and $_.FullName -notmatch '\\claude\\' }
  $sz = ($old | Measure-Object Length -Sum).Sum
  Write-Host ("{0}: {1} files, {2}" -f $t, $old.Count, (GB $sz))
  if ($Go) { $old | Remove-Item -Force -ErrorAction SilentlyContinue; $freed += $sz }
}

# ---- 2. Recycle Bin -------------------------------------------------------------------------------------
Section '2. Recycle Bin'
$rb = (Get-ChildItem 'C:\$Recycle.Bin' -Force -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
Write-Host ("Recycle Bin on C: ~ {0}" -f (GB $rb))
if ($Go) { Clear-RecycleBin -Force -ErrorAction SilentlyContinue; $freed += $rb }

# ---- 3. Regenerable caches ------------------------------------------------------------------------------
Section '3. Caches (pip, crash dumps)'
foreach ($c in @("$env:LOCALAPPDATA\pip\Cache", "$env:LOCALAPPDATA\CrashDumps")) {
  if (Test-Path $c) {
    $sz = (Get-ChildItem $c -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
    Write-Host ("{0}: {1}" -f $c, (GB $sz))
    if ($Go) { Get-ChildItem $c -Recurse -Force -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue; $freed += $sz }
  }
}

# ---- 4. Loose installers / partial downloads -> moved (not deleted) -------------------------------------
Section '4. Installers and partial downloads -> E:\Organized\Installers'
$inst = 'E:\Organized\Installers'
$candidates = @('E:\AuraInstaller-1.0.6.exe', 'E:\Hi3D-1.1.2-win-x64 (1).exe', 'E:\Unconfirmed 893377.crdownload',
                'E:\EpicInstaller-20.3.3-unrealEngine-bd35e620e0ba4a71856e4ebaa5e6fdf1.exe')
foreach ($f in $candidates) {
  if (Test-Path -LiteralPath $f) { Write-Host ("{0}  ({1})" -f $f, (GB (Get-Item -LiteralPath $f).Length)); if ($Go) { New-Item -ItemType Directory -Force $inst | Out-Null; Move-Item -LiteralPath $f -Destination $inst } }
}

# ---- 5. Downloads on C: (model zips, recordings) -> moved to E: ----------------------------------------
Section '5. C:\Users\Gierl\Downloads -> E:\Organized\Downloads_archive'
$dl = 'C:\Users\Gierl\Downloads'; $dlDst = 'E:\Organized\Downloads_archive'
$items = Get-ChildItem $dl -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.zip', '.mp4', '.exe', '.rar', '.7z' -and $_.Name -ne 'iClone_Personal_Hub.exe' }
Write-Host ("{0} files, {1}" -f $items.Count, (GB (($items | Measure-Object Length -Sum).Sum)))
if ($Go) { New-Item -ItemType Directory -Force $dlDst | Out-Null; $items | Move-Item -Destination $dlDst -ErrorAction SilentlyContinue }

# ---- 6. Boot-time apps (opt-in; reversible) -------------------------------------------------------------
Section '6. Startup apps'
$trim = 'Steam', 'EpicGamesLauncher', 'AMDNoiseSuppression', 'StartAUEP'
$runKeys = @{ 'HKCU' = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'; 'HKLM' = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run' }
foreach ($hive in $runKeys.Keys) {
  foreach ($n in $trim) {
    if ((Get-ItemProperty $runKeys[$hive] -ErrorAction SilentlyContinue).PSObject.Properties.Name -contains $n) {
      Write-Host ("{0} starts at boot ({1})" -f $n, $hive)
      if ($Go -and $DisableStartup) {
        $ap = "$($hive):\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run"
        try { if (-not (Test-Path $ap)) { New-Item $ap -Force -ErrorAction Stop | Out-Null }; Set-ItemProperty $ap -Name $n -Value ([byte[]](3,0,0,0,0,0,0,0,0,0,0,0)) -Type Binary -ErrorAction Stop; Write-Host '   -> disabled (re-enable in Task Manager > Startup apps)' }
        catch { Write-Host "   -> NOT disabled: needs an ADMIN PowerShell ($hive entry)" -ForegroundColor Yellow }
      }
    }
  }
}
if (-not $DisableStartup) { Write-Host '(add -DisableStartup with -Go to turn these off at boot)' }

# ---- 7. Drive maintenance (admin) -----------------------------------------------------------------------
Section '7. Drive maintenance'
Write-Host 'SSDs (C:, E:, H:) get TRIM only - never defragmented. The HDD (F:) gets a real defrag.'
if ($Go -and $Optimize) {
  if (-not $isAdmin) { Write-Host 'Needs an ADMIN PowerShell - skipped.' -ForegroundColor Yellow }
  else {
    foreach ($d in 'C', 'E', 'H') { if (Test-Path "$($d):\") { Write-Host "TRIM $($d):"; Optimize-Volume -DriveLetter $d -ReTrim -ErrorAction SilentlyContinue } }
    if (Test-Path 'F:\') { Write-Host 'Defrag F: (can take a while)'; Optimize-Volume -DriveLetter F -Defrag -ErrorAction SilentlyContinue }
  }
} else { Write-Host '(add -Go -Optimize from an admin PowerShell to run this)' }

Section 'Summary'
if ($Go) { Write-Host ("Deleted ~{0} of temp/cache files. C: free now: {1}" -f (GB $freed), (GB (Get-PSDrive C).Free)) }
else { Write-Host 'Dry run complete. Review the list above, then re-run with -Go.' }
Write-Host "`nNOT touched (your call): E:\.tmp.driveupload (709 GB, 599k files, no sync app running), the quarantine folders, Epic VaultCache, Unreal shared cache, Codex app data (17 GB)." -ForegroundColor Yellow
