# Build E:\GameDev - one home for ALL game-dev material  -  written by Claude, 2026-10-06
# DEFAULT = DRY RUN. Add -Go to apply.   NOTHING is deleted. Every moved folder gets a junction (link) left at its OLD path,
# so project files, shortcuts and tools that remember the old path keep working.
#   Preview:  powershell -ExecutionPolicy Bypass -File organize_gamedev.ps1
#   Apply:    powershell -ExecutionPolicy Bypass -File organize_gamedev.ps1 -Go      (close Unreal, Blender, Epic Launcher, Steam first)
# Run organize_drives.ps1 -Go first or after - they don't conflict (it also targets E:\GameDev).
# Installed programs (Blender, Unreal engine, Reallusion, Epic, Unity Hub) are NOT moved - they stay on the fast NVMe/their own drive
# so they keep working; Tools\ and Engines\ hold SHORTCUTS to them, and 00_START_HERE.txt lists every real location.
param([switch]$Go)

$Hub = 'E:\GameDev'
function Say($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }

function Find-Links($root) {                       # reparse points under $root, without descending into them
  Get-ChildItem -LiteralPath $root -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) { $_ } else { Find-Links $_.FullName }
  }
}

function ReHome([string]$src, [string]$dst, [bool]$leaveLink, [string]$why) {
  if (-not (Test-Path -LiteralPath $src)) { Say "SKIP (missing): $src"; return }
  if ((Get-Item -LiteralPath $src -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { Say "SKIP (already a link): $src"; return }
  $merge = Test-Path -LiteralPath $dst                 # hub folders are pre-created, so merge into an existing destination instead of skipping
  Say ("{0}`n    {1}`n -> {2}{3}{4}" -f $why, $src, $dst, $(if ($merge) { '   (merging into existing folder)' } else { '' }), $(if ($leaveLink) { '   (+ link left at old path)' } else { '' }))
  if (-not $Go) { return }
  New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
  if (((Split-Path $src -Qualifier) -eq (Split-Path $dst -Qualifier)) -and -not $merge) { Move-Item -LiteralPath $src -Destination $dst; $rc = 0 }
  else { robocopy $src $dst /E /MOVE /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /NFL /NDL /NP /MT:8 | Out-Null; $rc = $LASTEXITCODE }
  if ($rc -ge 8) { Say "  !! robocopy reported errors (rc=$rc) - source left in place, nothing linked" 'Yellow'; return }
  if (Test-Path -LiteralPath $src) {                 # robocopy skips links: recreate them at the destination, keep the old shell under a new name
    foreach ($l in Find-Links $src) {
      $t = Join-Path $dst $l.FullName.Substring($src.Length).TrimStart('\')
      if (-not (Test-Path -LiteralPath $t)) { New-Item -ItemType Directory -Force -Path (Split-Path $t -Parent) | Out-Null; New-Item -ItemType Junction -Path $t -Target (@($l.Target)[0]) | Out-Null }
    }
    Rename-Item -LiteralPath $src -NewName ((Split-Path $src -Leaf) + '_old_link_stub_safe_to_delete')
  }
  if ($leaveLink -and -not (Test-Path -LiteralPath $src)) { New-Item -ItemType Junction -Path $src -Target $dst | Out-Null }
  Say '  done' 'Green'
}

function Make-Shortcut([string]$lnkPath, [string]$target) {
  if (-not $target -or -not (Test-Path -LiteralPath $target)) { return }
  Say ("shortcut: {0}  ->  {1}" -f $lnkPath, $target)
  if (-not $Go) { return }
  New-Item -ItemType Directory -Force -Path (Split-Path $lnkPath -Parent) | Out-Null
  $s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnkPath); $s.TargetPath = $target; $s.WorkingDirectory = $(if (Test-Path -LiteralPath $target -PathType Container) { $target } else { Split-Path $target -Parent }); $s.Save()
}
function Find-Exe($root, $pattern) { if (Test-Path $root) { Get-ChildItem $root -Recurse -Depth 3 -Filter $pattern -File -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName } }

# ---- 1. Folder structure ------------------------------------------------------------------------------------
Say '=== 1. Structure' 'Cyan'
$dirs = 'Projects\Unreal','Projects\Unity','Projects\Game_Dev_Projects','Projects\Nyghtshade','Assets\3D_Models','Assets\Megascans_Library',
        'Assets\Prison','Assets\Characters','Assets\Textures','Assets\Audio','Assets\Animations','Tools','Engines','AI_Models','Backups','Reference','Games'
foreach ($d in $dirs) { Say "  $Hub\$d"; if ($Go) { New-Item -ItemType Directory -Force -Path "$Hub\$d" | Out-Null } }

# ---- 2. Re-home earlier moves + cold game-dev data off the slow F: disk ---------------------------------------
Say "`n=== 2. Move game-dev data onto the SSD (E:)" 'Cyan'
ReHome 'E:\Organized\Unreal_Projects' "$Hub\Projects\Unreal" $false 'Unreal projects moved earlier'
if ($Go -and (Test-Path "$Hub\Projects\Unreal\MyProject_5.8")) {   # repoint the old Documents link to the new home
  $old = 'C:\Users\Gierl\Documents\Unreal Projects\MyProject 5.8'
  if ((Test-Path -LiteralPath $old) -and ((Get-Item -LiteralPath $old -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { cmd /c rmdir "$old" | Out-Null; New-Item -ItemType Junction -Path $old -Target "$Hub\Projects\Unreal\MyProject_5.8" | Out-Null; Say '  repointed Documents\Unreal Projects\MyProject 5.8' 'Green' }
}
ReHome 'F:\Megascans Library'                        "$Hub\Assets\Megascans_Library"        $true 'Megascans library (18.6 GB) off the HDD'
ReHome 'F:\PrisonAssets'                             "$Hub\Assets\Prison\PrisonAssets"      $true 'Prison assets'
ReHome 'F:\PrisonScripts'                            "$Hub\Assets\Prison\PrisonScripts"     $true 'Prison scripts'
ReHome 'F:\Unreal Projects'                          "$Hub\Projects\Unreal\_from_F_Unreal_Projects" $true 'Unreal projects on F: (ElectricDreams, AutoClaw, ...)'
ReHome 'F:\NyghtshadeHollow'                         "$Hub\Projects\Nyghtshade\NyghtshadeHollow"    $true 'Nyghtshade Hollow main project (live links keep working via the left-behind link)'
ReHome 'F:\NyghtshadeHollow_Staging'                 "$Hub\Projects\Nyghtshade\NyghtshadeHollow_Staging" $true 'Nyghtshade staging'
ReHome 'F:\NYGHTSHADE_AI'                            "$Hub\Projects\Nyghtshade\NYGHTSHADE_AI"       $true 'Nyghtshade AI data (41 GB)'
ReHome 'F:\NYGHTSHADE_HOLLOW_DEVELOPER_HANDOFF'      "$Hub\Projects\Nyghtshade\DEVELOPER_HANDOFF"   $true 'Nyghtshade handoff docs'
ReHome 'F:\Unreal'                                   "$Hub\Projects\Nyghtshade\Unreal_builds"       $true 'Nyghtshade UE builds/backups'
ReHome 'F:\DONNA_Relocation_Backups'                 "$Hub\Backups\DONNA_Relocation_Backups"        $true 'Relocation backups (69 GB)'

# ---- 3. Game folders that already live on E: -> E:\GameDev\Games (instant rename, link left behind so shortcuts still work)
Say "`n=== 3. Games sitting in E:\Telegram Desktop -> $Hub\Games" 'Cyan'
foreach ($g in 'FS25','DisneySpeedstorm','Farming.Simulator.25.v1.2.1.0','Farming.Simulator.25.Update.v1.15.0.0','READY.OR.NOT.B16793412.REPACK-KaOs') {
  ReHome "E:\Telegram Desktop\$g" "$Hub\Games\$g" $true 'game folder'
}
ReHome 'F:\PoppyPlaytimeChapterOne' "$Hub\Games\PoppyPlaytimeChapterOne" $true 'game folder off the HDD'

# ---- 4. Tools + engines: shortcuts to where each program really lives ------------------------------------------
Say "`n=== 4. Tools and engines (shortcuts only - programs are not moved)" 'Cyan'
$rl = 'C:\Program Files\Reallusion'
$tools = [ordered]@{
  'Blender 5.2'               = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
  'Unreal Editor 5.8'         = 'H:\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe'
  'Epic Games Launcher'       = 'C:\Program Files\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe'
  'Unity Hub'                 = $(if (Test-Path 'F:\UE_5.8\Unity Hub\Unity Hub.exe') { 'F:\UE_5.8\Unity Hub\Unity Hub.exe' } else { 'E:\Telegram Desktop\UE_5.8\Unity Hub\Unity Hub.exe' })
  'Reallusion Hub'            = (Find-Exe 'C:\Program Files (x86)\Reallusion' 'Reallusion Hub*.exe')
  'Character Creator 5'       = (Find-Exe "$rl\Character Creator 5" 'CharacterCreator*.exe')
  'iClone 8'                  = (Find-Exe "$rl\iClone 8" 'iClone.exe')
  'AI Studio (Reallusion)'    = (Find-Exe "$rl\AI Studio" '*.exe')
  'Steam'                     = 'F:\steam\steam.exe'
}
foreach ($k in $tools.Keys) { Make-Shortcut "$Hub\Tools\$k.lnk" $tools[$k] }
$folders = [ordered]@{
  'FOLDER - Reallusion install'         = $rl
  'FOLDER - Reallusion content'         = 'C:\Users\Public\Documents\Reallusion'
  'FOLDER - DevTools (Blender MCP, Python, Unreal MCP)' = 'F:\DevTools'
  'FOLDER - Active Unreal project MyProject2' = 'C:\Users\Gierl\Documents\Unreal Projects\MyProject2'
  'FOLDER - MetaHuman Arianna work (Blender, FaceBuilder, Unreal exports)' = 'H:\Arianna_FaceBuilder_2026-10-05'
  'FOLDER - Nyghtshade Hollow Development (NVMe)' = 'H:\NyghtshadeHollow_Development'
  'FOLDER - Nyghtshade Hollow Unity (NVMe)' = 'H:\NyghtshadeHollow_Unity'
}
foreach ($k in $folders.Keys) { Make-Shortcut "$Hub\Tools\$k.lnk" $folders[$k] }
Make-Shortcut "$Hub\Engines\Unreal Engine 5.8 (registered engine).lnk" 'H:\UE_5.8'
Make-Shortcut "$Hub\Engines\Blender 5.2.lnk" 'C:\Program Files\Blender Foundation\Blender 5.2'

# ---- 5. Index file ---------------------------------------------------------------------------------------------
Say "`n=== 5. Index: $Hub\00_START_HERE.txt" 'Cyan'
$readme = @"
GAMEDEV HUB - E: (2 TB SSD)                                   generated by Claude 2026-10-06
Projects\            Unreal\ (MyProject 5.8, ElectricDreams, ...), Unity\, Nyghtshade\ (Hollow, AI, handoff, builds), Game_Dev_Projects\ (DONNA)
Assets\              3D_Models\ (loose blend/fbx/glb), Megascans_Library\, Prison\, Characters\, Textures\, Audio\, Animations\
Tools\               SHORTCUTS to every program and tool folder (programs are NOT moved, so they keep working)
Engines\             shortcuts to Unreal 5.8 (H:\UE_5.8 is the registered engine) and Blender
AI_Models\           ollama-backup, LocalGLM (the live 236 GB GLM model stays on H:\models)
Backups\             DONNA relocation backups
Games\               game folders you play
Reference\           reference material

WHERE THINGS REALLY LIVE
Unreal Editor 5.8 .......... H:\UE_5.8                        (NVMe; the only registered engine)
Active project MyProject2 ... C:\Users\Gierl\Documents\Unreal Projects\MyProject2   (NVMe, hot project)
Blender 5.2.1 .............. C:\Program Files\Blender Foundation\Blender 5.2
Reallusion (Character Creator 5, iClone 8, AI Studio, Headshot 3) ... C:\Program Files\Reallusion
Reallusion content .......... C:\Users\Public\Documents\Reallusion   (set a new content path in Reallusion Hub > Settings to move it to E:)
Blender MCP, Python, Unreal MCP ... F:\DevTools
MetaHuman Arianna work ...... H:\Arianna_FaceBuilder_2026-10-05
Epic vault (Fab purchases) .. C:\ProgramData\Epic\EpicGamesLauncher\VaultCache
Old paths still work: each moved folder left a link behind at its old location.
"@
Say $readme
if ($Go) { New-Item -ItemType Directory -Force $Hub | Out-Null; Set-Content -LiteralPath "$Hub\00_START_HERE.txt" -Value $readme -Encoding UTF8 }

if (-not $Go) { Say "`nDRY RUN ONLY. Re-run with -Go to apply." 'Yellow' }
Say "`nLeft alone on purpose: installed programs, F:\steam (use Steam > Settings > Storage to move installed games to the SSD), H:\UE_5.8 engine, F:\UE_5.8 (vault + .git), E:\Telegram Desktop\UE_5.8, E:\.tmp.driveupload." 'Yellow'
