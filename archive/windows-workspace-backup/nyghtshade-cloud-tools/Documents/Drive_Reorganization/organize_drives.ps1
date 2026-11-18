# Sort loose files and clearly-categorizable folders into <drive>\Organized\<Category>  -  written by Claude, 2026-10-06
# DEFAULT = DRY RUN (prints what it would move). Add -Go to move. NOTHING is deleted; name clashes get a numeric suffix.
#   powershell -ExecutionPolicy Bypass -File organize_drives.ps1          (preview)
#   powershell -ExecutionPolicy Bypass -File organize_drives.ps1 -Go      (apply)
# NOT touched on purpose: installed programs, Unreal engines, Steam/Epic/ollama libraries, F:\NyghtshadeHollow (a live project
# links into it), anything inside a project folder, system files (pagefile, dll, ini, System Volume Information).
param([switch]$Go)

$ext = @{
  '3D_Models'     = '.blend','.blend1','.fbx','.glb','.gltf','.obj','.stl','.usd','.usdz','.abc'
  'Archives'      = '.zip','.rar','.7z'
  'Installers'    = '.exe','.msi'
  'Images_Video'  = '.png','.jpg','.jpeg','.webp','.gif','.bmp','.mp4','.mov','.mkv'
  'Documents'     = '.docx','.pdf','.txt','.md','.xlsx','.csv'
  'Logs'          = '.log'
  'Shortcuts'     = '.lnk','.url'
}
$gameCat = @{ '3D_Models' = 'E:\GameDev\Assets\3D_Models' }   # game-related categories live in the GameDev hub on the SSD
$skipNames = 'desktop.ini','pagefile.sys','swapfile.sys','hiberfil.sys','thumbs.db'
$moved = 0; $bytes = 0L

function Unique($path) {
  if (-not (Test-Path -LiteralPath $path)) { return $path }
  $dir = Split-Path $path -Parent; $base = [IO.Path]::GetFileNameWithoutExtension($path); $e = [IO.Path]::GetExtension($path); $i = 2
  while (Test-Path -LiteralPath (Join-Path $dir "$base ($i)$e")) { $i++ }
  Join-Path $dir "$base ($i)$e"
}
function Sort-Files($srcRoot, $dstRoot, [switch]$KeepShortcuts) {
  if (-not (Test-Path -LiteralPath $srcRoot)) { return }
  foreach ($f in Get-ChildItem -LiteralPath $srcRoot -File -Force -ErrorAction SilentlyContinue) {
    if ($skipNames -contains $f.Name.ToLower()) { continue }
    $e = $f.Extension.ToLower()
    if ($KeepShortcuts -and $e -in '.lnk','.url') { continue }
    $cat = ($ext.GetEnumerator() | Where-Object { $_.Value -contains $e } | Select-Object -First 1).Key
    if (-not $cat) { continue }
    $base = if ($gameCat.ContainsKey($cat)) { $gameCat[$cat] } else { Join-Path $dstRoot $cat }
    $dst = Unique (Join-Path $base $f.Name)
    Write-Host ("[{0}] {1}  ->  {2}" -f $cat, $f.FullName, $dst)
    $script:moved++; $script:bytes += $f.Length
    if ($Go) { New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null; Move-Item -LiteralPath $f.FullName -Destination $dst -ErrorAction SilentlyContinue }
  }
}
function Move-Folder($src, $dst) {
  if (-not (Test-Path -LiteralPath $src)) { return }
  if (Test-Path -LiteralPath $dst) { Write-Host "SKIP (exists): $dst"; return }
  Write-Host ("[folder] {0}  ->  {1}" -f $src, $dst)
  if ($Go) { New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null; Move-Item -LiteralPath $src -Destination $dst -ErrorAction Continue }
}

Write-Host '--- Loose files at drive roots and on C: Desktop/Documents ---' -ForegroundColor Cyan
foreach ($d in 'E','F','H') { Sort-Files "$($d):\" "$($d):\Organized" }
Sort-Files 'C:\Users\Gierl\Desktop'   'E:\Organized\From_C_Desktop'   -KeepShortcuts
Sort-Files 'C:\Users\Gierl\Documents' 'E:\Organized\From_C_Documents' -KeepShortcuts

Write-Host "`n--- Folders on E: (sibling .fbm texture folders go next to their FBX files so models keep their textures) ---" -ForegroundColor Cyan
$E3d = 'E:\GameDev\Assets\3D_Models'
Move-Folder 'E:\FINALPRISONDRAFT1ACS2ed.fbm' "$E3d\FINALPRISONDRAFT1ACS2ed.fbm"
Move-Folder 'E:\FPD2BINARY.fbm'              "$E3d\FPD2BINARY.fbm"
Move-Folder 'E:\DONNA_GameDev'               'E:\GameDev\Projects\Game_Dev_Projects\DONNA_GameDev'
Move-Folder 'E:\DONNA_GameDev_Archive'       'E:\GameDev\Projects\Game_Dev_Projects\DONNA_GameDev_Archive'
Move-Folder 'E:\DONNA_Relocated_From_C'      'E:\GameDev\Projects\Game_Dev_Projects\DONNA_Relocated_From_C'
Move-Folder 'E:\Recovery-Audit-2026-09-20'   'E:\Organized\Recovery\Recovery-Audit-2026-09-20'
Move-Folder 'E:\Chipset_Software'            'E:\Organized\Installers\Chipset_Software'
Move-Folder 'E:\Chipset_Installer'           'E:\Organized\Installers\Chipset_Installer'
Move-Folder 'E:\AMDSoftwareInstaller_DIME_Chipset' 'E:\Organized\Installers\AMDSoftwareInstaller_DIME_Chipset'
Move-Folder 'E:\Telegram Desktop\ollama-backup' 'E:\GameDev\AI_Models\ollama-backup'
Move-Folder 'E:\Telegram Desktop\LocalGLM'      'E:\GameDev\AI_Models\LocalGLM'
Move-Folder 'E:\Telegram Desktop\GitHub_Master_Backup' 'E:\Organized\Archives\GitHub_Master_Backup'

Write-Host ("`n{0} files ({1:N2} GB) {2}." -f $moved, ($bytes/1GB), $(if ($Go) { 'moved' } else { 'would move' })) -ForegroundColor Green
if (-not $Go) { Write-Host 'DRY RUN ONLY. Re-run with -Go to apply.' -ForegroundColor Yellow }
Write-Host "`nLeft where they are (review yourself): E:\Telegram Desktop game folders (FS25, Farming Simulator, DisneySpeedstorm, Ready or Not), E:\.tmp.driveupload,"
Write-Host 'F:\steam, F:\ollama, F:\Program Files*, F:\NyghtshadeHollow* and the other F: project folders (a live project links into F:\NyghtshadeHollow).'
