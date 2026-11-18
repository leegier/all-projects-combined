# CO099 practical-light and enclosure audit

Scope: offline static geometry plus existing native-readback evidence only. No Unreal process was launched and no Unreal package was changed.

## Findings

- CO099 spans X **-11800 to -700 cm**, Y **-6300 to -5600 cm**, and Z **-20 to 300 cm**. Its verified clear interior is approximately Y **-6268 to -5877 cm**, with floor Z **-20 cm**.
- The native readback contains **90** lights in the level and **0** LightComponents inside CO099. All **256** reported RP components have `cast_shadow=True`.
- `SM_RP_034_PrisonLightOne` / actor `RP_035_PrisonLightOne` supplies **28** real ceiling-fixture meshes. They are centered around Y **-6076.3 cm**, with an underside around Z **292.34 cm**, at roughly 400 cm intervals.
- `SM_RP_217_PrisonLightFour` / actor `RP_220_PrisonLightFour` supplies **56** low wall-fixture meshes, two per station, centered around Y **-6266.0 / -5879.3 cm** and Z **72.93 cm**.
- The **29** `SM_RP_016_PrisonRoofTileSetOne` pieces are zero-thickness planes at Z **299.93 cm**. Every one of their **928** exported triangles faces +Z.
- The **58** `SM_RP_207_PrisonOutsideWallTwo` pieces are approximately **29.26 cm thick**, with opposing +Y and -Y faces. They are not single planes.
- Existing material-receipt evidence maps the actual CO099 wall batch `RP_210_PrisonOutsideWallTwo` to the wall review copy and the actual CO099 floor batches `RP_056_PrisonFloorTileOne` and `RP_065_PrisonFloorTileCellSetTwo` to the floor review copy. The static audit found no non-RP CO099 surface group and no sampled coincident duplicate surface. This argues against a wrong-batch or duplicate-surface explanation for the weak corridor material comparison.

The zero-thickness roof makes a two-sided-shadow test reasonable, but its +Z winding already faces a light arriving from above. The walls have thickness and both side faces. Therefore a blanket `cast_shadow_as_two_sided=True` change is a **diagnostic discriminator**, not a geometry-supported primary repair. CO099 is open at both long ends, so oblique directional light entering a junction is also plausible. The saved bracket did not record the directional-light rotation, so that cause remains unproved.

## Exact ceiling-fixture coordinates

The proposed practical source is placed 12 cm below the fixture underside, at Z 280 cm, using each mesh's exact X/Y center. These coordinates are for isolated review-map copies.

| # | export instance | X cm | Y cm | fixture underside Z cm | source Z cm |
|---:|---:|---:|---:|---:|---:|
| 00 | 11552 | -11786.973 | -6076.323 | 292.338 | 280.000 |
| 01 | 11544 | -11386.973 | -6076.323 | 292.338 | 280.000 |
| 02 | 11415 | -10986.973 | -6076.323 | 292.338 | 280.000 |
| 03 | 11366 | -10586.973 | -6076.323 | 292.338 | 280.000 |
| 04 | 11534 | -10186.973 | -6076.323 | 292.338 | 280.000 |
| 05 | 11131 | -9786.977 | -6076.222 | 292.404 | 280.000 |
| 06 | 11553 | -9391.973 | -6076.323 | 292.338 | 280.000 |
| 07 | 11545 | -8991.973 | -6076.323 | 292.338 | 280.000 |
| 08 | 11416 | -8591.973 | -6076.323 | 292.338 | 280.000 |
| 09 | 11368 | -8191.973 | -6076.323 | 292.338 | 280.000 |
| 10 | 11535 | -7791.973 | -6076.323 | 292.338 | 280.000 |
| 11 | 11132 | -7391.976 | -6076.222 | 292.403 | 280.000 |
| 12 | 11555 | -7008.973 | -6076.323 | 292.338 | 280.000 |
| 13 | 11548 | -6608.973 | -6076.323 | 292.338 | 280.000 |
| 14 | 11419 | -6208.973 | -6076.323 | 292.338 | 280.000 |
| 15 | 11371 | -5808.973 | -6076.323 | 292.338 | 280.000 |
| 16 | 11538 | -5408.973 | -6076.323 | 292.338 | 280.000 |
| 17 | 11136 | -5008.976 | -6076.222 | 292.403 | 280.000 |
| 18 | 11546 | -4625.973 | -6076.323 | 292.338 | 280.000 |
| 19 | 11417 | -4225.973 | -6076.323 | 292.338 | 280.000 |
| 20 | 11369 | -3825.973 | -6076.323 | 292.338 | 280.000 |
| 21 | 11536 | -3425.972 | -6076.323 | 292.338 | 280.000 |
| 22 | 11133 | -3025.976 | -6076.222 | 292.403 | 280.000 |
| 23 | 11556 | -2642.972 | -6076.323 | 292.338 | 280.000 |
| 24 | 11549 | -2242.972 | -6076.323 | 292.338 | 280.000 |
| 25 | 11420 | -1842.973 | -6076.323 | 292.338 | 280.000 |
| 26 | 11372 | -1442.973 | -6076.323 | 292.338 | 280.000 |
| 27 | 11539 | -1042.973 | -6076.323 | 292.337 | 280.000 |

## Bounded repair and proof sequence

1. Preserve the source map and create/reuse isolated `Before` and `After` review clones. Use the same actor transforms, same lights, same fixed exposure, and same camera in both.
2. Add one downward-facing RectLight at each coordinate above, matching the fixture footprint (start at 50 × 50 cm), temperature 3400 K, attenuation 650 cm, and shadow casting enabled. Do not add lights to only one material variant.
3. Preferred representative interior test: remove the inherited directional sun from **the review clones only** (or cap the two corridor portals outside the shot), fix exposure at EV100 8, and bracket the fixture output at 4,000 / 8,000 / 16,000 lm. This keeps the practical source physically legible and tests the materials without the 75,000-intensity inherited sun dominating them.
4. If the comparison must remain at EV100 12, use an explicitly review-only 64,000 / 128,000 / 256,000 lm bracket. EV12 is four stops darker than EV8, so equal pixel energy requires 16× the fixture output. Do not carry that artificial proof intensity into production lighting without a separate art review.
5. Use the same wide camera in both variants: origin `(-8500,-6100,140)`, target `(-4300,-6100,135)`, FOV 70. For detail proof, reuse the corrected interior cameras already audited: wall front `(-6500,-6100,150)` → `(-6500,-5800,145)`, FOV 50; floor three-quarter `(-6440,-6100,150)` → `(-5850,-5920,-20)`, FOV 55.
6. If asymmetric daylight remains with practicals off, run exactly one discriminator pair on the isolated clone: original shadow settings versus `cast_shadow_as_two_sided=True` on `RP_017_PrisonRoofTileSetOne` and `RP_210_PrisonOutsideWallTwo`. If the raster does not materially change, revert the toggle and test portal light entry or the directional-light rotation instead.
7. Accept the material comparison only when identical-camera frames show wall and floor detail on both sides, retain the requested deep-black/crimson treatment, and avoid white clipping or crushed featureless regions. Seal receipt, frame, exposure, light settings, source hashes, and raster statistics together.

## Evidence boundary

Exported triangles prove geometry placement, thickness, and winding. The native readback proves the reported light/shadow properties. Neither proves final Lumen/shadow-map behavior, fixture intensity, or artistic approval. Those require the bounded same-camera render above.

Inputs and complete per-instance geometry are recorded in `E:/_codex_tasks/CO099_lighting_geometry_audit_20261010.json`.
