# CO099 material-review camera audit

Read-only static export and receipt audit. Unreal was not opened and no project package was changed.

## Finding

The three white/near-white review cameras are outside CO099. The verified clear interior is Y = -6268 to -5877 cm. Their origins use Y = -5800, -5790, and -5780 cm, which places them 77, 87, and 97 cm beyond the north inner face. The outer north wall face ends at Y = -5848 cm, so the cameras are also 48, 58, and 68 cm beyond the exterior face. The center rays immediately encounter the wall from its exterior side; this matches the all-white frames and does not implicate exposure because the wide and floor-front cameras render under the same sequence settings.

## Replacement poses

| Camera | Origin cm | Target cm | FOV | Origin wall clearance |
|---|---:|---:|---:|---:|
| 03_wall_front_corrected | `[-6500, -6100, 150]` | `[-6500, -5800, 145]` | 50 | 168 cm |
| 04_wall_three_quarter_corrected | `[-6800, -6100, 160]` | `[-6350, -5800, 135]` | 50 | 168 cm |
| 06_floor_three_quarter_corrected | `[-6440, -6100, 150]` | `[-5850, -5920, -20]` | 55 | 168 cm |

All proposed origins sit on the exported clearance-selected centerline Y = -6100 cm. The wall targets extend through the wall so the center ray reaches the verified inner face at Y about -5877 cm. The floor camera aims through the slab at Z = -20 cm; the exported triangles produce the first floor contact at Z about 0 cm, and the XY target remains 43 cm inside the wall.

## Material/duplicate audit

The corridor receipt records 41 wall slots and 24 floor slots across 65 unique RP actors. Every CO099 wall/floor surface group found in the static export maps by logical asset name to exactly one RP actor with the expected source-material override in that receipt. Actor and static-mesh numeric prefixes differ, so matching the raw RP number would be wrong; this audit strips those generated indices and requires the remaining asset name to match. No non-RP mesh group intersects CO099, no exact same-mesh/same-transform duplicate intersects it, and 36 deliberately non-seam floor/wall rays found no two distinct instances within 1 cm. The export does not carry material-slot metadata, so this is actor/mesh coverage evidence rather than per-pixel proof; the sampled rays are strong local evidence rather than an exhaustive triangle-overlap proof.

The After wide frames are changed rather than byte-identical: a sampled 8-pixel grid measured mean luminance 131.14 before versus 116.17 after and mean absolute RGB difference 17.01. The pure-white wall frames are 100% sampled near-white both before and after. That pattern supports a camera-placement fault for the white frames. Artistic adequacy of the darker corridor material still requires review of corrected renders.

Full machine-readable evidence: `E:/_codex_tasks/CO099_material_review_camera_audit_20261010.json`
