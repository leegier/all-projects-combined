# Build report — 25 September 2026

## Delivered result
Native Windows and Linux builds of **Nyghtshade Hollow — The Intake**, plus the editable Godot 4.5.2 project. The architecture is an extracted region of the user's actual recovered prison source. No live Windows Unreal/Aura editor connection was available in this session; the user's existing Unreal project was not edited.

## Evidence
| Check | Result | Scope |
|---|---|---|
| Source mission/system checks | 27/27 passed | Quest prerequisites, one-time completion rewards, save/load, guard visibility/bribery/catch, floors, six interaction sight lines |
| Physical walking route | 26/26 passed | Real first-person controller, original collision, all mission areas; officer cleared for this movement test |
| Exported Linux game checks | 27/27 passed | Same logic and sight-line checks using packaged executable and PCK |
| Vulkan Forward+ image captures | Completed and visually reviewed | Title, cellblock, intake corridor; software Vulkan renderer |
| Windows release export | Succeeded | x86_64 EXE plus PCK; Windows execution not available here |

Raw source results are `test_results.json` and `route_results.json`. Packaged Linux results are `exported_test_results.json`. Screenshots are genuine in-engine captures at 1280×720, not image-generator output.

## Findings fixed during verification
- Preserved source parent/world transforms before joining meshes for export.
- Corrected the first-person route to the actual corridor's offset.
- Routed around the central watch booth and original ground-floor railings.
- Positioned the count terminal on the accessible side of the far railing.
- Verified all six interactions with the camera-facing, distance and ray-occlusion selector.
- Kept the guard on a bounded perimeter patrol; high suspicion uses a stationary challenge.

## Open limitations
Windows playtesting and hardware frame-rate profiling are outstanding. No performance number is claimed. The guard is a procedural prototype, not a polished realistic human. Upper-tier collision and optional rooms need broader playtesting. There is no full campaign or open-world exterior. No DLSS or hardware ray tracing is implemented.

Dummy-audio automated runs emit an exit-time ventilation WAV playback resource warning; tests still complete. That warning and normal Windows audio/shutdown should be checked on the target PC.

## Source and design basis
Architecture: `FINALPRISONDRAFTINTOUE5.9.blend` (137,053,393 bytes), supplied through the user's Google Drive. 62,775 mesh objects inspected; 3,139 selected objects in the connected region, merged into 11 groups. Original Blender source was not overwritten. Reader compatibility warning: the source was written by a newer Blender version than the available 4.5.3 reader. The recovered region was validated visually and through physical traversal, not declared a lossless full-source conversion.

Design references: the user's Nyghtshade Hollow/CLAWED design PDF and rebuild plan. Reused pillars: prison routine, reputation, credits and cigarettes; black/crimson prison appearance. The transfer-ledger mission is a newly authored demonstration. This build does not resolve conflicting historical engine versions, recover the A111/PERFECT map, or reconstruct every planned system.

## Next implementation priorities
1. Play the Windows build on the target machine; capture frame times and collision complaints.
2. Replace the prototype officer with a licensed, properly rigged realistic character and animations.
3. Improve light/material detail and streaming/mesh partitioning based on measured GPU and CPU costs.
4. Build the next bounded prison loop: routine schedules, faction reputation and contraband persistence.
5. Reconcile the recovered assets with the actual Unreal project through local Aura, if Unreal remains the production engine. This Godot slice can serve as a playable reference; its GDScript is not drop-in Unreal code.352784729404015   355163569199539
