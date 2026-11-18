# Nyghtshade v011 native outdoor proof

Prepared offline on 2026-10-10. These files have **not** been executed in Unreal:

- Builder/render script: `E:\_codex_tasks\build_render_outdoor_proof_v011_20261010.py`
- Exact 20-second camera plan: `E:\_codex_tasks\nh_outdoor_proof_plan_v011_20261010.json`
- Target map: `/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v011`

The script defaults to `inspect`. It refuses to proceed when another MRQ executor, PIE session, or unsaved package is present. `build` and `render` Save As a unique map under `/Game/_CodexReview/OutdoorProof/<run>` and never save the v011 source. It records and rechecks the two closed Gothic gateway leaf transforms. The road camera stops 500 cm before the closed gate; the sequence does not bind or animate either leaf.

The 20-second sequence is 480 frames at 24 fps:

1. Road, markings, and closed gateway: frames `[0, 168)` — 7 seconds.
2. Main bridge from both approaches and structural side: frames `[168, 336)` — 7 seconds.
3. Full central-oak silhouette: frames `[336, 480)` — 6 seconds.

It creates one private transient MRQ job with five native camera cuts. MRQ writes a 1280×720 JPEG sequence and one H.264 MP4. `flush_disk_writes_per_shot` is false so the native MP4 writer remains open across the five cuts. Exposure is fixed to EV100 15, local exposure is neutral, physical-camera exposure and motion blur are disabled, and 48 engine warm-up frames are configured.

Only the sole Unreal writer should run this. Example PowerShell launch:

```powershell
$env:NH_OUTDOOR_PROOF_ACTION = 'render'
$env:NH_OUTDOOR_PROOF_QUIT = '1'
& 'H:\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe' `
  'E:\GameDev\Staging\MyProject2_EnvCopy_Claude_20261009\MyProject2.uproject' `
  '-ExecutePythonScript=E:\_codex_tasks\build_render_outdoor_proof_v011_20261010.py' `
  -unattended -nop4 -nosplash -stdout -FullStdOutLogOutput
```

Receipts and output are written to:

`H:\NyghtshadeHollow_Development\2026-10-10\OutdoorProof\<run>`

The render callback checks for 480 JPEGs, one MP4 with an MP4 header, sampled 1280×720 JPEG headers, unchanged v011 hash, and an unchanged editor queue. Its strongest automated success state is `RENDER_OUTPUTS_PRESENT_PENDING_VISUAL_REVIEW`; rendered pixels still require review against the plan's road, bridge, and oak gates.

## Installed UE 5.8 API validation

The implementation follows the installed source rather than guessed names:

- `MoviePipelineBlueprintLibrary.h:18` declares `ScriptName = "MoviePipelineLibrary"`; line 137 declares `UpdateJobShotListFromSequence`. The script therefore calls `unreal.MoviePipelineLibrary.update_job_shot_list_from_sequence(...)`.
- `MoviePipelineQueue.h:692` and `:696` expose `Sequence` and `Map` as `FSoftObjectPath`. The script assigns them with `job.set_editor_property('sequence', unreal.SoftObjectPath(...))` and the matching map call.
- `MoviePipelineGameOverrideSetting.h:83` declares `TSoftClassPtr<AGameModeBase> SoftGameModeOverride`. The installed Python bridge is used with `soft_game_mode_override = unreal.GameModeBase`.
- `MoviePipelineMP4EncoderOutput.h:14`, `:79`, and `:100` confirm the native MP4 class, CRF, and audio settings.
- `MoviePipelineVideoOutputBase.cpp:25-41` shows that per-shot flushing finalizes writers; lines 114 and 175-202 show frame tokens are removed for video and a stable writer is reused. The proof explicitly leaves per-shot flushing disabled.

Offline validation performed: JSON parsed, all segment ranges are contiguous, focal-length/FOV pairs agree within 0.001 degrees, the road keys stay at least 500 cm before the gate plane, and the Python file passes `py_compile`. No Unreal package was opened or changed during this validation.
