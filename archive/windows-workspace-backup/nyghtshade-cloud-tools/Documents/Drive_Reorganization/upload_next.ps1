# Slow, one-asset-at-a-time uploader  -  written by Claude, 2026-10-06
# Target: https://github.com/leegier/all-projects-combined  (PUBLIC)   Destination folder in the repo: from-pc-should-be-everything/
#   -Scan                build/refresh the queue (manifest.csv) and print a summary. Uploads NOTHING.
#   (no switch)          preview the next item(s). Uploads NOTHING.
#   -Go                  upload the next -Count item(s): copy -> secret scan -> git add/commit/push, then mark them uploaded.
#   -Go -Loop            keep going, one batch every -DelayMinutes, until the queue is empty or you press Ctrl+C.
# Nothing is ever deleted from your PC. Files are COPIED into a local clone, so originals stay where they are.
# Safety filters (every item): size <= 95 MB (GitHub hard limit is 100 MB), name/path exclusions (secrets, personal, third-party/licensed
# content, game repacks, engines), allow-listed extensions only, and a content scan for keys/tokens/passwords/your e-mail on text files.
# Anything skipped is listed with the reason in  E:\GameDev\Backups\upload_state\manifest.csv  - review it, nothing is silently dropped.
param([switch]$Scan, [switch]$Go, [switch]$Loop, [int]$Count = 1, [int]$DelayMinutes = 10, [double]$MaxRepoGB = 4)

$Clone    = 'E:\GameDev\Backups\all-projects-combined'
$State    = 'E:\GameDev\Backups\upload_state'
$Manifest = Join-Path $State 'manifest.csv'
$DestRoot = 'from-pc-should-be-everything'
$MaxBytes = 95MB

# What to consider.  Only game-dev material - NOT Documents/Desktop/Downloads/AppData.
$Roots = @(
  @{ Src = 'E:\GameDev';                                   Dst = 'GameDev' },
  @{ Src = 'H:\Arianna_FaceBuilder_2026-10-05';            Dst = 'Arianna_FaceBuilder' },
  @{ Src = 'C:\Users\Gierl\Documents\Unreal Projects\MyProject2'; Dst = 'Unreal_Projects\MyProject2'; UnrealProject = $true }
)
# Directories never entered (any depth): build output, caches, VCS, third-party/licensed, games, engines, backups, the clone itself.
$SkipDirs = 'Intermediate','Saved','DerivedDataCache','Binaries','Build','.git','.vs','.idea','node_modules','__pycache__','Library','Temp','obj',
            'Megascans_Library','Megascans Library','VaultCache','Fab','Quixel','Marketplace','Reallusion','MetaHumans','Engine','UE_5.8',
            'Games','Backups','AI_Models','Tools','ElectricDreams','ElectricDreamsEnv','ElectricDreamsEnv2','steam','Content_ThirdParty',
            'AutoClaw','dist','site-packages','Lib','vendor','ThirdParty','packages','.pnpm','__MACOSX','resources'
$SkipDirLike = '*REPACK*','*Farming*','*FS25*','*Speedstorm*','*READY.OR.NOT*','*Poppy*','*Megascans*','*Quixel*','*Fab_*','*_QUARANTINE*','*old_link_stub*',
               '*.fbm','Prison*','*PrisonAssets*'      # kit textures/models of unknown licence: opt in per folder by removing these patterns once you confirm you own them
$SkipFileLike = '.env*','*.pem','*.key','*.pfx','*.p12','id_rsa*','*credential*','*secret*','*token*','*password*','*passwd*','auth.json','.npmrc','.netrc',
                'cookies*','*.kdbx','.mcp.json','settings.local.json','*.crt','*.cer','*.sqlite','*.db','*.lnk','*.url','*.exe','*.dll','*.zip','*.rar','*.7z','*.pdf','*.docx'
$AllowExt = @{
  'code'  = '.py','.ps1','.cs','.cpp','.h','.hpp','.c','.js','.ts','.json','.yml','.yaml','.toml','.xml','.ini','.bat','.sh','.md','.txt','.uproject','.uplugin','.usf','.ush','.shader','.hlsl','.glsl'
  'image' = '.png','.jpg','.jpeg','.webp','.gif','.tga','.bmp'
  'audio' = '.wav','.mp3','.ogg','.flac'
  'model' = '.blend','.fbx','.glb','.gltf','.obj','.usd','.usdz','.abc','.stl'
  # 'unreal' (.uasset/.umap) is deliberately NOT allowed: project Content mixes in Fab/Megascans/marketplace/MetaHuman assets that must not be redistributed publicly
}
$Rank = @{ code = 0; image = 1; audio = 2; model = 3; unreal = 4 }
$TextExt = $AllowExt['code']
$SecretPatterns = @(
  '-----BEGIN [A-Z ]*PRIVATE KEY-----', 'AKIA[0-9A-Z]{16}', 'ghp_[A-Za-z0-9]{30,}', 'github_pat_[A-Za-z0-9_]{40,}', 'gh[osur]_[A-Za-z0-9]{30,}',
  'sk-[A-Za-z0-9_\-]{20,}', 'AIza[0-9A-Za-z_\-]{30,}', 'xox[baprs]-[A-Za-z0-9\-]{10,}', 'hf_[A-Za-z0-9]{30,}', 'Bearer\s+[A-Za-z0-9\-\._~\+/]{20,}',
  '(?i)(api[_\-]?key|secret|token|passw(or)?d|authorization|client[_\-]?secret)["'']?\s*[:=]\s*["'']?[A-Za-z0-9_\-\.=+/]{16,}',
  '(?i)maxgier2026@gmail\.com', '(?i)postgres(ql)?://[^\s:]+:[^\s@]+@', '(?i)mongodb(\+srv)?://[^\s:]+:[^\s@]+@'
)

function Category($ext) { foreach ($k in $AllowExt.Keys) { if ($AllowExt[$k] -contains $ext) { return $k } }; return $null }
function Skip-Dir($name) { if ($SkipDirs -contains $name) { return $true }; foreach ($p in $SkipDirLike) { if ($name -like $p) { return $true } }; return $false }
function Skip-File($name) { foreach ($p in $SkipFileLike) { if ($name -like $p) { return $true } }; return $false }
function Has-Secret($path) {
  $txt = [IO.File]::ReadAllText($path)
  foreach ($p in $SecretPatterns) { if ($txt -match $p) { return $p } }
  return $null
}

function Build-Manifest {
  New-Item -ItemType Directory -Force -Path $State | Out-Null
  $rows = New-Object System.Collections.Generic.List[object]
  $old = @{}; if (Test-Path $Manifest) { foreach ($r in Import-Csv $Manifest) { $old[$r.Src] = $r } }
  foreach ($root in $Roots) {
    if (-not (Test-Path -LiteralPath $root.Src)) { Write-Host "missing root: $($root.Src)" -ForegroundColor Yellow; continue }
    $stack = New-Object System.Collections.Generic.Stack[string]; $stack.Push($root.Src)
    while ($stack.Count) {
      $dir = $stack.Pop()
      foreach ($d in Get-ChildItem -LiteralPath $dir -Directory -Force -ErrorAction SilentlyContinue) {
        if ($d.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }     # never follow junctions
        if (Skip-Dir $d.Name) { continue }
        if ($root.UnrealProject -and $d.Parent.FullName -eq $root.Src -and $d.Name -notin 'Config','Source','Python') { continue }   # Unreal project: code/config only, never Content
        $stack.Push($d.FullName)
      }
      foreach ($f in Get-ChildItem -LiteralPath $dir -File -Force -ErrorAction SilentlyContinue) {
        if ($f.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        $ext = $f.Extension.ToLower(); $cat = Category $ext
        $status = 'pending'; $reason = ''
        if ($old.ContainsKey($f.FullName) -and $old[$f.FullName].Status -in 'uploaded','skipped-secret') { $rows.Add($old[$f.FullName]); continue }
        if (Skip-File $f.Name) { $status = 'skipped'; $reason = 'excluded name/type (secret, personal, binary installer, shortcut or archive)' }
        elseif (-not $cat)     { $status = 'skipped'; $reason = 'extension not on the allow-list' }
        elseif ($root.UnrealProject -and $cat -eq 'unreal') { $status = 'skipped'; $reason = 'Unreal Content is never uploaded (third-party/licensed assets)' }
        elseif ($f.Length -gt $MaxBytes) { $status = 'skipped'; $reason = ('over GitHub 100 MB file limit ({0:N0} MB)' -f ($f.Length / 1MB)) }
        $rel = $f.FullName.Substring($root.Src.Length).TrimStart('\')
        $rows.Add([pscustomobject]@{ Src = $f.FullName; Dest = ($DestRoot + '\' + $root.Dst + '\' + $rel); Category = $cat; Bytes = $f.Length; Status = $status; Reason = $reason; When = '' })
      }
    }
  }
  $rows | Sort-Object @{ e = { if ($_.Category) { $Rank[$_.Category] } else { 9 } } }, Bytes | Export-Csv -NoTypeInformation -Encoding UTF8 $Manifest
  $m = Import-Csv $Manifest
  Write-Host "`nQueue summary ($Manifest)" -ForegroundColor Cyan
  $m | Group-Object Status | ForEach-Object { Write-Host ("  {0,-16} {1,8} files  {2,9:N2} GB" -f $_.Name, $_.Count, (($_.Group | Measure-Object Bytes -Sum).Sum / 1GB)) }
  Write-Host "`nPending by category:"; $m | Where-Object Status -eq 'pending' | Group-Object Category | ForEach-Object { Write-Host ("  {0,-8} {1,8} files  {2,9:N2} GB" -f $_.Name, $_.Count, (($_.Group | Measure-Object Bytes -Sum).Sum / 1GB)) }
  Write-Host "`nTop skip reasons:"; $m | Where-Object Status -eq 'skipped' | Group-Object Reason | Sort-Object Count -Descending | Select-Object -First 6 | ForEach-Object { Write-Host ("  {0,8}  {1}" -f $_.Count, $_.Name) }
}

function Do-Batch {
  $m = @(Import-Csv $Manifest)
  $todo = @($m | Where-Object Status -eq 'pending' | Select-Object -First $Count)
  if (-not $todo.Count) { Write-Host 'Queue empty - nothing pending.' -ForegroundColor Green; return $false }
  Write-Host ("Next {0} item(s):" -f $todo.Count) -ForegroundColor Cyan
  foreach ($t in $todo) { Write-Host ("  [{0}] {1}  ({2:N2} MB)  ->  {3}" -f $t.Category, $t.Src, ($t.Bytes / 1MB), $t.Dest) }
  if (-not $Go) { Write-Host "`nPREVIEW ONLY. Add -Go to upload." -ForegroundColor Yellow; return $false }

  gh auth status *> $null; if ($LASTEXITCODE -ne 0) { throw 'Not signed in. Run:  gh auth login' }
  if (-not (Test-Path (Join-Path $Clone '.git'))) { throw "Clone missing - run upload_setup.ps1 -Go first." }
  $gb = ((Get-ChildItem (Join-Path $Clone '.git') -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum) / 1GB
  if ($gb -gt $MaxRepoGB) { throw ("Repo is already {0:N2} GB (limit {1} GB). Stopping - GitHub is not meant to hold more; use a real backup for the rest." -f $gb, $MaxRepoGB) }
  git -C $Clone pull --ff-only 2>&1 | Out-Null

  $added = @()
  foreach ($t in $todo) {
    $row = $m | Where-Object Src -eq $t.Src | Select-Object -First 1
    if (-not (Test-Path -LiteralPath $t.Src)) { $row.Status = 'skipped'; $row.Reason = 'source file vanished'; continue }
    if ((Get-Item -LiteralPath $t.Src).Length -gt $MaxBytes) { $row.Status = 'skipped'; $row.Reason = 'grew past 95 MB'; continue }
    if ($TextExt -contains ([IO.Path]::GetExtension($t.Src).ToLower()) -and (Get-Item -LiteralPath $t.Src).Length -lt 8MB) {
      $hit = Has-Secret $t.Src
      if ($hit) { $row.Status = 'skipped-secret'; $row.Reason = "possible secret/personal data (pattern: $hit)"; Write-Host "  SKIPPED (possible secret): $($t.Src)" -ForegroundColor Yellow; continue }
    }
    $dst = Join-Path $Clone $t.Dest
    New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
    Copy-Item -LiteralPath $t.Src -Destination $dst -Force
    git -C $Clone add -- $t.Dest | Out-Null
    $added += $row
  }
  if ($added.Count) {
    $msg = if ($added.Count -eq 1) { "Add " + (Split-Path $added[0].Src -Leaf) } else { "Add $($added.Count) files" }
    git -C $Clone commit -m $msg | Out-Null
    git -C $Clone push 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { git -C $Clone pull --rebase 2>&1 | Out-Host; git -C $Clone push 2>&1 | Out-Host }
    if ($LASTEXITCODE -eq 0) { foreach ($r in $added) { $r.Status = 'uploaded'; $r.When = (Get-Date -Format 's') }; Write-Host ("Uploaded {0} file(s)." -f $added.Count) -ForegroundColor Green }
    else { Write-Host 'Push failed - items stay pending; fix the error above and re-run.' -ForegroundColor Red }
  }
  $m | Export-Csv -NoTypeInformation -Encoding UTF8 $Manifest
  return $true
}

if ($Scan -or -not (Test-Path $Manifest)) { Build-Manifest; if ($Scan) { exit 0 } }
do { $more = Do-Batch; if ($Go -and $Loop -and $more) { Write-Host "Waiting $DelayMinutes min (Ctrl+C to stop)..."; Start-Sleep -Seconds ($DelayMinutes * 60) } } while ($Go -and $Loop -and $more)
