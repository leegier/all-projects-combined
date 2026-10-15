# Drive reorganization - written by Claude, 2026-10-06
# DEFAULT = DRY RUN (only prints what it would do).  To actually move: powershell -File move_plan.ps1 -Go
# Nothing is permanently deleted. Cross-drive moves use robocopy /MOVE (source removed only after each file copies OK).
# Same-drive "quarantine" moves are instant renames. Review the _QUARANTINE folders, then delete them yourself when satisfied.
# Close Unreal Editor, Epic Launcher and Blender before running with -Go.
param([switch]$Go)

$Q  = 'E:\Organized\_QUARANTINE_duplicates_review_then_delete'
$FQ = 'F:\_QUARANTINE_duplicates_review_then_delete'

function Do-Move($src, $dst, [bool]$junction, $why) {
  if (-not (Test-Path -LiteralPath $src)) { Write-Host "SKIP (missing): $src"; return }
  if (Test-Path -LiteralPath $dst)        { Write-Host "SKIP (destination exists): $dst"; return }
  Write-Host ("{0}`n    {1}`n -> {2}{3}" -f $why, $src, $dst, $(if ($junction) { '   (+ junction left at old path)' } else { '' }))
  if (-not $Go) { return }
  New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
  $sameVol = ((Split-Path $src -Qualifier) -eq (Split-Path $dst -Qualifier))
  if ($sameVol) { Move-Item -LiteralPath $src -Destination $dst; $rc = 0 }
  else { robocopy $src $dst /E /MOVE /COPY:DAT /DCOPY:DAT /R:1 /W:1 /XJ /NFL /NDL /NP /MT:8 | Out-Null; $rc = $LASTEXITCODE }
  if ($rc -ge 8 -or (Test-Path -LiteralPath $src)) { Write-Host "  !! incomplete (robocopy rc=$rc) - source left in place, no junction made"; return }
  if ($junction) { New-Item -ItemType Junction -Path $src -Target $dst | Out-Null }
  Write-Host '  done'
}

# ---- 1. Free C: (biggest wins) ------------------------------------------------------------------
Do-Move 'C:\Users\Gierl\Desktop\aurabound' 'E:\Organized\Recovery\aurabound' $false '44 GB data-recovery output off the C: desktop'
Do-Move 'C:\Users\Gierl\Documents\Unreal Projects\ElectricDreamsEnv' "$Q\C_Documents_ElectricDreamsEnv_incomplete_no_uproject" $false '55.6 GB INCOMPLETE copy of ElectricDreams (no .uproject); complete copies exist on F: and H:'
Do-Move 'C:\Users\Gierl\Documents\Unreal Projects\MyProject 5.8' 'E:\Organized\Unreal_Projects\MyProject_5.8' $true '63 GB older project (last used 2026-09-26) to the 2 TB SSD'

# ---- 2. Exact / unregistered duplicates -> quarantine (same-drive = instant) --------------------
Do-Move 'E:\Telegram Desktop\models' "$Q\E_models_exact_dup_of_H_models" $false '236 GB GLM model - byte-for-byte same 7 files as H:\models (kept on fast NVMe H:)'
Do-Move 'F:\UE_5.8\Engine' "$FQ\F_UE_5.8_Engine_dup_of_H_UE_5.8" $false '35 GB Unreal 5.8 engine copy that is NOT the registered one (your projects use H:\UE_5.8)'
Do-Move 'E:\Telegram Desktop\Blender' "$Q\Blender_5.1.2_older_than_5.2.1" $false 'Blender 5.1.2 (older); 5.2.1 stays in C:\Program Files'
Do-Move 'H:\ElectricDreamsEnv2' "$Q\H_ElectricDreamsEnv2_dup_of_F_ElectricDreams" $false '56 GB near-identical ElectricDreams copy; frees fast NVMe H:'

if (-not $Go) { Write-Host "`nDRY RUN ONLY. Re-run with -Go to perform the moves." }
