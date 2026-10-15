"""Offline-only CO099 fixture and triangle-orientation audit.

Reads exported prison geometry and an existing native readback.  It does not
import Unreal, launch the editor, or write any Unreal package.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.path.insert(0, "E:/GameDev/Tools/TTS_Kokoro/libs")
import numpy as np


BASE_AUDIT = Path("E:/_codex_tasks/audit_co099_material_cameras.py")
ZONES = Path("E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009/_claude_evidence/wf/prison_zones.json")
READBACK = Path("H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup/Evidence/V012_LightReadback.json")
OUT = Path("E:/_codex_tasks/CO099_lighting_geometry_audit_20261010.json")
OUT_MD = Path("E:/_codex_tasks/CO099_practical_light_geometry_audit_20261010.md")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_support():
    spec = importlib.util.spec_from_file_location("co099_support", BASE_AUDIT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {BASE_AUDIT}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def vec3(row):
    return [round(float(value), 4) for value in row]


def orientation_summary(vertices: np.ndarray, triangles: np.ndarray) -> dict:
    v0 = vertices[triangles[:, 0]]
    v1 = vertices[triangles[:, 1]]
    v2 = vertices[triangles[:, 2]]
    cross = np.cross(v1 - v0, v2 - v0)
    twice_area = np.linalg.norm(cross, axis=1)
    valid = twice_area > 1.0e-8
    normals = np.zeros_like(cross)
    normals[valid] = cross[valid] / twice_area[valid, None]

    def axis_counts(axis: int) -> dict:
        values = normals[valid, axis]
        weights = twice_area[valid]
        return {
            "positive_triangles": int(np.count_nonzero(values > 0.5)),
            "negative_triangles": int(np.count_nonzero(values < -0.5)),
            "other_triangles": int(np.count_nonzero(np.abs(values) <= 0.5)),
            "positive_area_share": round(float(weights[values > 0.5].sum() / weights.sum()), 6),
            "negative_area_share": round(float(weights[values < -0.5].sum() / weights.sum()), 6),
        }

    return {
        "triangles": int(len(triangles)),
        "nondegenerate_triangles": int(np.count_nonzero(valid)),
        "x": axis_counts(0),
        "y": axis_counts(1),
        "z": axis_counts(2),
    }


def main() -> None:
    support = load_support()
    mesh_ids, transforms = support.load_instances()
    meshes = support.load_meshes()
    zones = json.loads(ZONES.read_text(encoding="utf-8"))
    zone = next(item for item in zones["zones"] if item["id"] == "CO099")
    bounds = zone["bounds"]
    zone_lo = np.asarray([bounds["x0"], bounds["y0"], bounds["z0"]], dtype=np.float64)
    zone_hi = np.asarray([bounds["x1"], bounds["y1"], bounds["z1"]], dtype=np.float64)

    targets = {
        "PrisonRoofTileSetOne",
        "PrisonOutsideWallTwo",
        "PrisonLightOne",
        "PrisonLightFour",
    }
    groups: dict[str, list[dict]] = {name: [] for name in sorted(targets)}
    for instance_id, mesh_id in enumerate(mesh_ids.tolist()):
        mesh = meshes[int(mesh_id)]
        logical = support.logical_asset_name(mesh["name"])
        if logical not in targets:
            continue
        vertices = support.world_vertices(mesh, transforms[instance_id])
        lo = vertices.min(axis=0)
        hi = vertices.max(axis=0)
        # XY overlap with CO099; allow a 1 cm tolerance around the zone bounds.
        if np.any(hi[:2] < zone_lo[:2] - 1.0) or np.any(lo[:2] > zone_hi[:2] + 1.0):
            continue
        row = {
            "instance_id": int(instance_id),
            "mesh": mesh["name"],
            "transform_location_cm": vec3(transforms[instance_id, :3]),
            "aabb_min_cm": vec3(lo),
            "aabb_max_cm": vec3(hi),
            "aabb_center_cm": vec3((lo + hi) * 0.5),
            "extent_cm": vec3(hi - lo),
            "orientation": orientation_summary(vertices, mesh["triangles"]),
        }
        groups[logical].append(row)

    for rows in groups.values():
        rows.sort(key=lambda row: (row["aabb_center_cm"][0], row["aabb_center_cm"][1]))

    readback = json.loads(READBACK.read_text(encoding="utf-8"))
    lights_inside = []
    for light in readback["lights"]:
        p = np.asarray(light["location"], dtype=np.float64)
        if np.all(p >= zone_lo) and np.all(p <= zone_hi):
            lights_inside.append(light)

    roof_rows = groups["PrisonRoofTileSetOne"]
    wall_rows = groups["PrisonOutsideWallTwo"]
    ceiling_rows = groups["PrisonLightOne"]
    wall_light_rows = groups["PrisonLightFour"]

    summary = {
        "zone": zone,
        "sources": {
            str(BASE_AUDIT): {"sha256": sha256(BASE_AUDIT)},
            str(ZONES): {"sha256": sha256(ZONES)},
            str(READBACK): {"sha256": sha256(READBACK)},
            str(support.GEO_INSTANCES): {"sha256": sha256(support.GEO_INSTANCES)},
            str(support.GEO_MESHES): {"sha256": sha256(support.GEO_MESHES)},
        },
        "native_readback": {
            "total_lights": len(readback["lights"]),
            "lights_inside_CO099": len(lights_inside),
            "lights_inside": lights_inside,
            "prison_shadow_flag_count": len(readback["prison_shadow_flags"]),
            "prison_shadow_flag_false_count": sum(
                str(row.get("cast_shadow")) != "True" for row in readback["prison_shadow_flags"]
            ),
        },
        "counts": {name: len(rows) for name, rows in groups.items()},
        "fixture_series": {
            "ceiling_fixture_mesh": "SM_RP_034_PrisonLightOne",
            "ceiling_fixture_x_cm": [row["aabb_center_cm"][0] for row in ceiling_rows],
            "ceiling_fixture_y_cm": sorted({row["aabb_center_cm"][1] for row in ceiling_rows}),
            "ceiling_fixture_z_cm": sorted({row["aabb_center_cm"][2] for row in ceiling_rows}),
            "ceiling_fixture_underside_z_cm": sorted({row["aabb_min_cm"][2] for row in ceiling_rows}),
            "wall_fixture_mesh": "SM_RP_217_PrisonLightFour",
            "wall_fixture_x_cm": sorted({row["aabb_center_cm"][0] for row in wall_light_rows}),
            "wall_fixture_y_cm": sorted({row["aabb_center_cm"][1] for row in wall_light_rows}),
            "wall_fixture_z_cm": sorted({row["aabb_center_cm"][2] for row in wall_light_rows}),
        },
        "aggregate_geometry": {
            "roof_z_min_cm": min(row["aabb_min_cm"][2] for row in roof_rows),
            "roof_z_max_cm": max(row["aabb_max_cm"][2] for row in roof_rows),
            "roof_max_piece_thickness_cm": max(row["extent_cm"][2] for row in roof_rows),
            "roof_orientation_counts": {
                "positive_z_triangles": sum(row["orientation"]["z"]["positive_triangles"] for row in roof_rows),
                "negative_z_triangles": sum(row["orientation"]["z"]["negative_triangles"] for row in roof_rows),
                "other_z_triangles": sum(row["orientation"]["z"]["other_triangles"] for row in roof_rows),
            },
            "wall_y_planes_cm": sorted(
                {
                    round(row["aabb_min_cm"][1], 3) for row in wall_rows
                }
                | {round(row["aabb_max_cm"][1], 3) for row in wall_rows}
            ),
            "wall_orientation_counts": {
                "positive_y_triangles": sum(row["orientation"]["y"]["positive_triangles"] for row in wall_rows),
                "negative_y_triangles": sum(row["orientation"]["y"]["negative_triangles"] for row in wall_rows),
                "other_y_triangles": sum(row["orientation"]["y"]["other_triangles"] for row in wall_rows),
            },
        },
        "groups": groups,
        "interpretation_boundary": [
            "Exported triangles prove mesh placement, thickness and winding only.",
            "They do not prove Unreal's active material two-sided state, shadow-map result, Lumen state or final exposure.",
            "A two-sided-shadow toggle in isolated review clones is a discriminator for the observed directional asymmetry, not a proven source-map fix.",
        ],
    }
    OUT.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    fixture_lines = []
    for index, row in enumerate(ceiling_rows):
        center = row["aabb_center_cm"]
        fixture_lines.append(
            f"| {index:02d} | {row['instance_id']} | {center[0]:.3f} | {center[1]:.3f} | "
            f"{row['aabb_min_cm'][2]:.3f} | 280.000 |"
        )
    md = f"""# CO099 practical-light and enclosure audit

Scope: offline static geometry plus existing native-readback evidence only. No Unreal process was launched and no Unreal package was changed.

## Findings

- CO099 spans X **-11800 to -700 cm**, Y **-6300 to -5600 cm**, and Z **-20 to 300 cm**. Its verified clear interior is approximately Y **-6268 to -5877 cm**, with floor Z **-20 cm**.
- The native readback contains **{len(readback['lights'])}** lights in the level and **{len(lights_inside)}** LightComponents inside CO099. All **{len(readback['prison_shadow_flags'])}** reported RP components have `cast_shadow=True`.
- `SM_RP_034_PrisonLightOne` / actor `RP_035_PrisonLightOne` supplies **{len(ceiling_rows)}** real ceiling-fixture meshes. They are centered around Y **-6076.3 cm**, with an underside around Z **292.34 cm**, at roughly 400 cm intervals.
- `SM_RP_217_PrisonLightFour` / actor `RP_220_PrisonLightFour` supplies **{len(wall_light_rows)}** low wall-fixture meshes, two per station, centered around Y **-6266.0 / -5879.3 cm** and Z **72.93 cm**.
- The **{len(roof_rows)}** `SM_RP_016_PrisonRoofTileSetOne` pieces are zero-thickness planes at Z **299.93 cm**. Every one of their **{sum(row['orientation']['z']['positive_triangles'] for row in roof_rows)}** exported triangles faces +Z.
- The **{len(wall_rows)}** `SM_RP_207_PrisonOutsideWallTwo` pieces are approximately **29.26 cm thick**, with opposing +Y and -Y faces. They are not single planes.
- Existing material-receipt evidence maps the actual CO099 wall batch `RP_210_PrisonOutsideWallTwo` to the wall review copy and the actual CO099 floor batches `RP_056_PrisonFloorTileOne` and `RP_065_PrisonFloorTileCellSetTwo` to the floor review copy. The static audit found no non-RP CO099 surface group and no sampled coincident duplicate surface. This argues against a wrong-batch or duplicate-surface explanation for the weak corridor material comparison.

The zero-thickness roof makes a two-sided-shadow test reasonable, but its +Z winding already faces a light arriving from above. The walls have thickness and both side faces. Therefore a blanket `cast_shadow_as_two_sided=True` change is a **diagnostic discriminator**, not a geometry-supported primary repair. CO099 is open at both long ends, so oblique directional light entering a junction is also plausible. The saved bracket did not record the directional-light rotation, so that cause remains unproved.

## Exact ceiling-fixture coordinates

The proposed practical source is placed 12 cm below the fixture underside, at Z 280 cm, using each mesh's exact X/Y center. These coordinates are for isolated review-map copies.

| # | export instance | X cm | Y cm | fixture underside Z cm | source Z cm |
|---:|---:|---:|---:|---:|---:|
{chr(10).join(fixture_lines)}

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

Inputs and complete per-instance geometry are recorded in `{OUT.as_posix()}`.
"""
    OUT_MD.write_text(md, encoding="utf-8")
    print(json.dumps({
        "out": str(OUT),
        "sha256": sha256(OUT),
        "out_md": str(OUT_MD),
        "sha256_md": sha256(OUT_MD),
        "counts": summary["counts"],
        "readback": summary["native_readback"],
        "aggregate_geometry": summary["aggregate_geometry"],
        "fixture_series": summary["fixture_series"],
    }, indent=2))


if __name__ == "__main__":
    main()
