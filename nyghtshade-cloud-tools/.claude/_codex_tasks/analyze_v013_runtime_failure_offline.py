"""Offline audit of the one v013 runtime collision failure.

Reads saved JSON/arrays only. Does not import Unreal or modify project content.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path


RUNTIME = Path(
    r"H:\NyghtshadeHollow_Development\2026-10-10\EnvironmentCleanup\Evidence"
    r"\RuntimeCollision_NH_EnvRefine_Codex_v013_20261010T152127279618Z"
    r"\NH_EnvRefine_Codex_v013_RuntimeCollision.json"
)
DESIGN = Path(
    r"E:\GameDev\Staging\MyProject2_EnvCopy_Claude_20261009"
    r"\_claude_evidence\stageE\terrain_design.json"
)
ROADS = Path(
    r"E:\GameDev\Staging\MyProject2_EnvCopy_Claude_20261009"
    r"\_claude_evidence\stageE\road_meshes.json"
)
OUT = Path(
    r"H:\NyghtshadeHollow_Development\2026-10-10\EnvironmentCleanup\Evidence"
    r"\V013_RuntimeFailure_OfflineClassification.json"
)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def closest_segment(point, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    denominator = dx * dx + dy * dy
    t = 0.0 if denominator == 0.0 else (
        (point[0] - a[0]) * dx + (point[1] - a[1]) * dy
    ) / denominator
    clamped = max(0.0, min(1.0, t))
    closest = (a[0] + clamped * dx, a[1] + clamped * dy)
    return {
        "t_unclamped": t,
        "t_clamped": clamped,
        "closest_xy_cm": [closest[0], closest[1]],
        "distance_cm": math.dist(point, closest),
    }


runtime = json.loads(RUNTIME.read_text(encoding="utf-8"))
design = json.loads(DESIGN.read_text(encoding="utf-8"))
roads = json.loads(ROADS.read_text(encoding="utf-8"))
failures = [
    row
    for row in runtime["gates"]["road_floor_collision"]["samples"]
    if row["status"] != "PASS"
]
if len(failures) != 1:
    raise RuntimeError(f"Expected one road-floor failure, found {len(failures)}")
failure = failures[0]

# The five first drive vertices are the complete 730 cm transverse end row.
first_row = [tuple(vertex[:2]) for vertex in roads["drive"]["V"][:5]]
sample_xy = tuple(float(value) for value in failure["xy_cm"])
edge_segments = []
for start_index in range(4):
    result = closest_segment(sample_xy, first_row[start_index], first_row[start_index + 1])
    result["vertex_indices"] = [start_index, start_index + 1]
    edge_segments.append(result)
nearest_edge = min(edge_segments, key=lambda row: row["distance_cm"])

p0 = design["drive"]["pts"][0]
p1 = design["drive"]["pts"][1]
forward = (float(p1[0]) - float(p0[0]), float(p1[1]) - float(p0[1]))
forward_length = math.hypot(*forward)
forward_unit = (forward[0] / forward_length, forward[1] / forward_length)
sample_delta = (sample_xy[0] - float(p0[0]), sample_xy[1] - float(p0[1]))
along_station = sample_delta[0] * forward_unit[0] + sample_delta[1] * forward_unit[1]
lateral_station = -sample_delta[0] * forward_unit[1] + sample_delta[1] * forward_unit[0]

bridge_regions = runtime["gates"]["bridge_floor_collision"]["regions"]
corridor_groups = runtime["gates"]["representative_camera_corridor"]["groups"]
payload = {
    "classification": "offline interpretation of sealed PIE runtime JSON and saved static arrays; no Unreal execution or package writes",
    "sources": [
        {"path": str(path), "sha256": sha(path)}
        for path in (RUNTIME, DESIGN, ROADS)
    ],
    "overall_runtime_status": runtime["status"],
    "gate_summary": runtime["required_gate_statuses"],
    "genuine_failure": {
        "count": 1,
        "gate": "road_floor_collision",
        "route": failure["sample"]["route"],
        "route_index": failure["sample"]["route_index"],
        "lateral_offset_cm": failure["sample"]["lateral_offset_cm"],
        "sample_xy_cm": list(sample_xy),
        "expected_road_z_cm": failure["expected_surface_z_cm"],
        "first_hit_actor": failure["hit"]["actor_label"],
        "first_hit_z_cm": failure["hit"]["impact_point_cm"][2],
        "vertical_difference_cm": failure["surface_error_cm"],
        "normal_z": failure["hit"]["impact_normal"][2],
        "blocks_pawn": failure["component_collision"]["blocks_pawn"],
        "drive_start_centerline_xy_cm": p0,
        "sample_local_station_cm": {
            "along_route": along_station,
            "lateral": lateral_station,
        },
        "first_mesh_end_row_xy_cm": [list(vertex) for vertex in first_row],
        "distance_to_saved_end_row_cm": nearest_edge["distance_cm"],
        "nearest_end_row_segment": nearest_edge,
        "interpretation": (
            "The failing trace is on the transverse terminal edge of the first driveway cross-section, not an interior "
            "30 m road sample. It misses CL_Driveway_Blacktop and lands on the blocking foundation CL_GroundPiece_00 "
            "8 cm below. This is a real terminal seam/coverage condition, but it is not evidence of a 30 m road-height "
            "error or a player-control failure."
        ),
    },
    "verified_passes": {
        "road_floor_samples": runtime["gates"]["road_floor_collision"]["counts"],
        "bridge_regions": {
            name: {
                "status": value["status"],
                "sample_count": value["sample_count"],
                "counts": value["counts"],
            }
            for name, value in bridge_regions.items()
        },
        "camera_groups": {
            name: {
                "status": value["status"],
                "segments": value["segment_count"],
                "unexpected_blocks": value["unexpected_block_count"],
                "expected_closed_blocks": value["expected_obstruction_count"],
            }
            for name, value in corridor_groups.items()
        },
        "gateway_footprint": runtime["gates"]["gateway_footprint_and_floor"]["status"],
        "hit_schema": runtime["gates"]["hitresult_schema"]["status"],
    },
    "observations_not_control_passes": [
        "The Sally Port leaf blocked one drive-start Camera sweep as expected in the closed state; its open state remains unproved.",
        "The Gothic gate leaf blocked the gateway center as expected in the closed state; its open state remains unproved.",
        "The +220 cm Camera sphere sweeps are geometric clearance evidence, not physical keyboard, possession, vehicle, or character traversal.",
        "The 14.25% bridge grade still requires a possessed practical drivability test.",
    ],
    "minimal_repair": {
        "recommended": (
            "Extend the driveway mesh one short cross-section upstream of station 0, at the existing -13 cm surface "
            "height, and connect it to the existing first row. Preserve the 730 cm width, material, center/edge markings, "
            "complex-as-simple collision, and the closed Sally Port. This moves the collision query off the open terminal "
            "triangle edge without changing the long road profile or foundation."
        ),
        "do_not": [
            "do not whitelist CL_GroundPiece_00 in the road gate",
            "do not disable foundation collision",
            "do not move the massive CL_GroundPiece_00 actor",
            "do not raise the first 30 m solely because the measured miss is 8 cm; Z-only lifting does not add missing XY coverage and would enlarge the terminal lip",
            "do not change validator tolerances or skip route index 0",
        ],
        "required_fresh_checks": [
            "rerun the identical route-index-0 offsets -250, 0, +250 cm",
            "add dense short seam samples 2, 10, 25, 50, and 100 cm on both sides of station 0",
            "rerun the closed Sally Port Camera observation",
            "perform a possessed traversal across the terminal seam when the gate state permits",
        ],
    },
}

OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"output": str(OUT), "sha256": sha(OUT), "summary": payload["genuine_failure"]}, indent=2))
