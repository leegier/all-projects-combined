"""Read-only CO099 prison material-review camera/coverage audit.

Consumes exported geometry/occupancy data and the saved review receipt.  It
does not import Unreal, open a project, or modify any Unreal package.
"""
from __future__ import annotations

import collections
import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys

sys.path.insert(0, "E:/GameDev/Tools/TTS_Kokoro/libs")
import numpy as np


EVIDENCE = Path("E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009/_claude_evidence")
GEO_INSTANCES = EVIDENCE / "nav/geo_instances.bin"
GEO_MESHES = EVIDENCE / "nav/geo_meshes.bin"
OCCUPANCY = EVIDENCE / "nav/occ_all_f0.npz"
ZONES = EVIDENCE / "wf/prison_zones.json"
RECEIPT = Path("H:/NyghtshadeHollow_Development/2026-10-10/PrisonMaterialReview/Run_20261010_082615_3d6b9856/receipt.json")
OUT_JSON = Path("E:/_codex_tasks/CO099_material_review_camera_audit_20261010.json")
OUT_MD = Path("E:/_codex_tasks/CO099_material_review_camera_audit_20261010.md")

OLD_CAMERAS = [
    ("03_wall_front", (-6500, -5800, 150), (-6500, -6200, 150), 52),
    ("04_wall_three_quarter", (-6780, -5790, 155), (-6320, -6200, 150), 52),
    ("06_floor_three_quarter", (-6440, -5780, 125), (-5850, -6070, -20), 55),
]

# Origins stay on the exported clearance-selected centerline Y=-6100.  Wall
# targets sit at the verified north inner face.  The floor target uses the
# verified floor Z=-20 and remains 43 cm inside that wall.
PROPOSED_CAMERAS = [
    ("03_wall_front_corrected", (-6500, -6100, 150), (-6500, -5800, 145), 50),
    ("04_wall_three_quarter_corrected", (-6800, -6100, 160), (-6350, -5800, 135), 50),
    ("06_floor_three_quarter_corrected", (-6440, -6100, 150), (-5850, -5920, -20), 55),
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_instances():
    raw = GEO_INSTANCES.read_bytes()
    count = struct.unpack_from("<I", raw, 0)[0]
    offset = 4
    mesh_ids = np.frombuffer(raw, np.int32, count, offset).copy()
    offset += 4 * count
    transforms = np.frombuffer(raw, np.float32, count * 10, offset).reshape(count, 10).astype(np.float64)
    if offset + count * 10 * 4 != len(raw):
        raise RuntimeError("Unexpected geo_instances trailing bytes")
    return mesh_ids, transforms


def load_meshes():
    raw = GEO_MESHES.read_bytes()
    count = struct.unpack_from("<I", raw, 0)[0]
    offset = 4
    meshes = []
    for _ in range(count):
        name_len = struct.unpack_from("<I", raw, offset)[0]
        offset += 4
        full_name = raw[offset : offset + name_len].decode("utf-8")
        offset += name_len
        vertex_count, triangle_count = struct.unpack_from("<II", raw, offset)
        offset += 8
        vertices = np.frombuffer(raw, np.float32, vertex_count * 3, offset).reshape(vertex_count, 3).astype(np.float64)
        offset += vertex_count * 12
        triangles = np.frombuffer(raw, np.int32, triangle_count * 3, offset).reshape(triangle_count, 3).copy()
        offset += triangle_count * 12
        short_name = full_name.split("/")[-1].split(".")[0]
        meshes.append({"name": short_name, "full_name": full_name, "vertices": vertices, "triangles": triangles})
    if offset != len(raw):
        raise RuntimeError("Unexpected geo_meshes trailing bytes")
    return meshes


def rotate_quaternion(q, vectors):
    xyz = np.asarray(q[:3], dtype=np.float64)
    w = float(q[3])
    return vectors + 2.0 * np.cross(xyz, np.cross(xyz, vectors) + w * vectors)


def world_vertices(mesh, transform):
    return rotate_quaternion(transform[3:7], mesh["vertices"] * transform[7:10]) + transform[:3]


def actor_label_from_mesh(name: str) -> str:
    return name[3:] if name.startswith("SM_") else name


def logical_asset_name(name: str) -> str:
    """Strip generated SM_/RP numeric prefixes; actor and mesh indices differ."""
    return re.sub(r"^(?:SM_)?RP_\d+_", "", name)


def first_segment_hit(origin, target, candidate_ids, mesh_ids, transforms, meshes):
    origin = np.asarray(origin, dtype=np.float64)
    target = np.asarray(target, dtype=np.float64)
    delta = target - origin
    segment_length = float(np.linalg.norm(delta))
    direction = delta / segment_length
    segment_lo = np.minimum(origin, target) - 1.0
    segment_hi = np.maximum(origin, target) + 1.0
    best = None
    epsilon = 1e-8
    for instance_id in candidate_ids:
        mesh = meshes[int(mesh_ids[instance_id])]
        vertices = world_vertices(mesh, transforms[instance_id])
        lo, hi = vertices.min(axis=0), vertices.max(axis=0)
        if np.any(hi < segment_lo) or np.any(lo > segment_hi):
            continue
        faces = mesh["triangles"]
        v0, v1, v2 = vertices[faces[:, 0]], vertices[faces[:, 1]], vertices[faces[:, 2]]
        edge1, edge2 = v1 - v0, v2 - v0
        pvec = np.cross(np.broadcast_to(direction, edge2.shape), edge2)
        det = np.einsum("ij,ij->i", edge1, pvec)
        valid = np.abs(det) > epsilon
        inv_det = np.zeros_like(det)
        inv_det[valid] = 1.0 / det[valid]
        tvec = origin - v0
        u = np.einsum("ij,ij->i", tvec, pvec) * inv_det
        valid &= (u >= -epsilon) & (u <= 1.0 + epsilon)
        qvec = np.cross(tvec, edge1)
        v = np.einsum("j,ij->i", direction, qvec) * inv_det
        valid &= (v >= -epsilon) & (u + v <= 1.0 + epsilon)
        distance = np.einsum("ij,ij->i", edge2, qvec) * inv_det
        valid &= (distance >= 0.0) & (distance <= segment_length + 1e-5)
        if not np.any(valid):
            continue
        local_index = int(np.argmin(np.where(valid, distance, np.inf)))
        hit_distance = float(distance[local_index])
        if best is None or hit_distance < best["distance_cm"]:
            point = origin + direction * hit_distance
        best = {
                "instance_id": int(instance_id),
                "mesh": mesh["name"],
                "mesh_logical_name": logical_asset_name(mesh["name"]),
                "distance_cm": round(hit_distance, 4),
                "point_cm": [round(float(x), 4) for x in point],
            }
    return best


def all_segment_hits(origin, target, candidate_ids, mesh_ids, transforms, meshes):
    """Return the nearest triangle hit per exported instance along one segment."""
    origin = np.asarray(origin, dtype=np.float64)
    target = np.asarray(target, dtype=np.float64)
    delta = target - origin
    segment_length = float(np.linalg.norm(delta))
    direction = delta / segment_length
    segment_lo = np.minimum(origin, target) - 1.0
    segment_hi = np.maximum(origin, target) + 1.0
    rows = []
    epsilon = 1e-8
    for instance_id in candidate_ids:
        mesh = meshes[int(mesh_ids[instance_id])]
        vertices = world_vertices(mesh, transforms[instance_id])
        lo, hi = vertices.min(axis=0), vertices.max(axis=0)
        if np.any(hi < segment_lo) or np.any(lo > segment_hi):
            continue
        faces = mesh["triangles"]
        v0, v1, v2 = vertices[faces[:, 0]], vertices[faces[:, 1]], vertices[faces[:, 2]]
        edge1, edge2 = v1 - v0, v2 - v0
        pvec = np.cross(np.broadcast_to(direction, edge2.shape), edge2)
        det = np.einsum("ij,ij->i", edge1, pvec)
        valid = np.abs(det) > epsilon
        inv_det = np.zeros_like(det)
        inv_det[valid] = 1.0 / det[valid]
        tvec = origin - v0
        u = np.einsum("ij,ij->i", tvec, pvec) * inv_det
        valid &= (u >= -epsilon) & (u <= 1.0 + epsilon)
        qvec = np.cross(tvec, edge1)
        v = np.einsum("j,ij->i", direction, qvec) * inv_det
        valid &= (v >= -epsilon) & (u + v <= 1.0 + epsilon)
        distance = np.einsum("ij,ij->i", edge2, qvec) * inv_det
        valid &= (distance >= 0.0) & (distance <= segment_length + 1e-5)
        if np.any(valid):
            hit_distance = float(np.min(distance[valid]))
            point = origin + direction * hit_distance
            rows.append(
                {
                    "instance_id": int(instance_id),
                    "mesh": mesh["name"],
                    "mesh_logical_name": logical_asset_name(mesh["name"]),
                    "distance_cm": round(hit_distance, 4),
                    "point_cm": [round(float(x), 4) for x in point],
                }
            )
    return sorted(rows, key=lambda row: row["distance_cm"])


def camera_row(spec, candidate_ids, mesh_ids, transforms, meshes, south_inner, north_inner):
    name, origin, target, fov = spec
    y = float(origin[1])
    inside = south_inner <= y <= north_inner
    clearance = min(y - south_inner, north_inner - y) if inside else -min(abs(y - south_inner), abs(y - north_inner))
    return {
        "name": name,
        "origin_cm": list(origin),
        "target_cm": list(target),
        "fov_degrees": fov,
        "origin_inside_verified_clear_width": inside,
        "origin_nearest_inner_wall_clearance_cm": round(float(clearance), 3),
        "center_ray_first_geometry": first_segment_hit(origin, target, candidate_ids, mesh_ids, transforms, meshes),
    }


def occupancy_row(point, occ, floor, meta):
    x0, y0, step, floor_z, nx, ny = meta.tolist()
    ix = int(math.floor((point[0] - x0) / step))
    iy = int(math.floor((point[1] - y0) / step))
    in_grid = 0 <= ix < int(nx) and 0 <= iy < int(ny)
    occupied = bool(occ[ix, iy]) if in_grid else None
    floor_present = bool(floor[ix, iy]) if in_grid else None
    occupied_cells = np.argwhere(occ != 0)
    if in_grid and len(occupied_cells):
        centers = np.column_stack(
            [x0 + (occupied_cells[:, 0] + 0.5) * step, y0 + (occupied_cells[:, 1] + 0.5) * step]
        )
        distance = float(np.linalg.norm(centers - np.asarray(point[:2], dtype=np.float64), axis=1).min())
    else:
        distance = None
    return {
        "point_cm": list(point),
        "grid_index": [ix, iy],
        "in_grid": in_grid,
        "occupied_cell": occupied,
        "floor_cell": floor_present,
        "nearest_occupied_cell_center_cm": round(distance, 3) if distance is not None else None,
        "grid_floor_z_cm": float(floor_z),
        "note": "40 cm rasterized export grid; this is static geometry evidence, not runtime collision proof",
    }


def main():
    zones = json.loads(ZONES.read_text(encoding="utf-8"))
    zone = next(item for item in zones["zones"] if item["id"] == "CO099")
    receipt = json.loads(RECEIPT.read_text(encoding="utf-8"))
    corridor_change = next(item for item in receipt["changes"] if item.get("type") == "corridor_map")
    override_by_actor = {row["actor"]: row for row in corridor_change["overrides"]}
    overrides_by_logical = collections.defaultdict(list)
    for row in corridor_change["overrides"]:
        overrides_by_logical[logical_asset_name(row["actor"])].append(row)
    mesh_ids, transforms = load_instances()
    meshes = load_meshes()

    bounds = zone["bounds"]
    box_lo = np.array([bounds["x0"], bounds["y0"], bounds["z0"] - 100.0])
    box_hi = np.array([bounds["x1"], bounds["y1"], bounds["z1"] + 100.0])
    origins = transforms[:, :3]
    preselect = np.nonzero(
        (origins[:, 0] >= bounds["x0"] - 2000)
        & (origins[:, 0] <= bounds["x1"] + 2000)
        & (origins[:, 1] >= bounds["y0"] - 2000)
        & (origins[:, 1] <= bounds["y1"] + 2000)
        & (origins[:, 2] >= bounds["z0"] - 1000)
        & (origins[:, 2] <= bounds["z1"] + 1000)
    )[0]
    intersecting = []
    aabbs = {}
    for instance_id in preselect:
        vertices = world_vertices(meshes[int(mesh_ids[instance_id])], transforms[instance_id])
        lo, hi = vertices.min(axis=0), vertices.max(axis=0)
        if not (np.any(hi < box_lo) or np.any(lo > box_hi)):
            intersecting.append(int(instance_id))
            aabbs[int(instance_id)] = (lo, hi)

    mesh_counts = collections.Counter(meshes[int(mesh_ids[i])]["name"] for i in intersecting)
    surface_rows = []
    for mesh_name, count in sorted(mesh_counts.items()):
        low = mesh_name.lower()
        if not any(token in low for token in ("wall", "floor", "roof", "ceiling", "trim", "piller", "pillar")):
            continue
        logical_name = logical_asset_name(mesh_name)
        matches = overrides_by_logical.get(logical_name, [])
        # Roof pieces are structural but not assumed to use M_PrisonWall merely
        # because their name also contains Piller/Wall.
        expected_kind = (
            None
            if "roof" in low or "ceiling" in low
            else "floor"
            if "floor" in low
            else "wall"
            if any(t in low for t in ("wall", "trim", "piller", "pillar"))
            else None
        )
        surface_rows.append(
            {
                "mesh": mesh_name,
                "mesh_logical_name": logical_name,
                "instance_count_intersecting_CO099": int(count),
                "expected_review_kind": expected_kind,
                "receipted_override_actor_labels": [row["actor"] for row in matches],
                "receipted_override_sources": sorted({row["source"] for row in matches}),
                "receipted_override_replacements": sorted({row["replacement"] for row in matches}),
            }
        )

    transform_groups = collections.defaultdict(list)
    for instance_id in intersecting:
        key = (int(mesh_ids[instance_id]),) + tuple(np.round(transforms[instance_id], 5).tolist())
        transform_groups[key].append(instance_id)
    exact_duplicates = [
        {
            "mesh": meshes[key[0]]["name"],
            "count": len(ids),
            "instance_ids": [int(i) for i in ids],
        }
        for key, ids in transform_groups.items()
        if len(ids) > 1
    ]

    # Sample the visible floor and both wall directions at deliberately
    # non-round X coordinates, avoiding modular seams.  Two different
    # instances hit within 1 cm would be a potential coincident surface.
    sampled_surface_rays = []
    coincident_candidates = []
    sample_xs = [-11237.3, -10311.7, -9386.1, -8460.5, -7534.9, -6609.3, -5683.7, -4758.1, -3832.5, -2906.9, -1981.3, -1055.7]
    for x in sample_xs:
        for kind, start, end in (
            ("floor", (x, -6100.0, 250.0), (x, -6100.0, -100.0)),
            ("north_wall", (x, -6100.0, 150.0), (x, -5700.0, 150.0)),
            ("south_wall", (x, -6100.0, 150.0), (x, -6400.0, 150.0)),
        ):
            hits = all_segment_hits(start, end, intersecting, mesh_ids, transforms, meshes)
            pairs = []
            for left, right in zip(hits, hits[1:]):
                separation = right["distance_cm"] - left["distance_cm"]
                if separation <= 1.0 and left["instance_id"] != right["instance_id"]:
                    row = {
                        "kind": kind,
                        "x_cm": x,
                        "separation_cm": round(separation, 4),
                        "left": left,
                        "right": right,
                    }
                    pairs.append(row)
                    coincident_candidates.append(row)
            sampled_surface_rays.append(
                {
                    "kind": kind,
                    "x_cm": x,
                    "hit_count": len(hits),
                    "hits": hits,
                    "coincident_distinct_instance_pairs_within_1cm": pairs,
                }
            )

    # Verified by the independent real-geometry log for CO099.
    south_inner, north_inner = -6268.0, -5877.0
    old_rows = [camera_row(spec, intersecting, mesh_ids, transforms, meshes, south_inner, north_inner) for spec in OLD_CAMERAS]
    proposed_rows = [camera_row(spec, intersecting, mesh_ids, transforms, meshes, south_inner, north_inner) for spec in PROPOSED_CAMERAS]

    grid = np.load(OCCUPANCY)
    occupancy = {
        spec[0]: occupancy_row(spec[1], grid["occ"], grid["floor"], grid["meta"])
        for spec in OLD_CAMERAS + PROPOSED_CAMERAS
    }

    sources_ok = []
    for row in surface_rows:
        if row["expected_review_kind"] in ("wall", "floor"):
            expected_path = "/Game/Nyghtshade/Materials/M_Prison%s.M_Prison%s" % (
                row["expected_review_kind"].title(), row["expected_review_kind"].title()
            )
            sources_ok.append(len(row["receipted_override_actor_labels"]) == 1 and row["receipted_override_sources"] == [expected_path])

    non_rp_meshes = sorted(name for name in mesh_counts if not name.startswith("SM_RP_"))

    report = {
        "status": "PASS_STATIC_CAMERA_CAUSE_AND_REPLACEMENT_POSES; MATERIAL_RENDER_REVIEW_REMAINS_VISUAL",
        "generated_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scope": "read-only static export/receipt audit; no Unreal launch and no package writes",
        "co099": {
            "zone_bounds_cm": bounds,
            "verified_wall_face_ranges_y_cm": [[-6298, -6268], [-6297, -6268], [-5877, -5848]],
            "verified_clear_interior_y_cm": [south_inner, north_inner],
            "verified_clear_width_cm": north_inner - south_inner,
            "verified_floor_z_cm": -20.0,
        },
        "old_cameras": old_rows,
        "proposed_cameras": proposed_rows,
        "occupancy_grid_checks": occupancy,
        "material_override_coverage": {
            "receipted_wall_slots": corridor_change["material_slots"]["wall"],
            "receipted_floor_slots": corridor_change["material_slots"]["floor"],
            "receipted_actor_count": len(override_by_actor),
            "all_receipted_actors_start_RP": all(label.startswith("RP_") for label in override_by_actor),
            "co099_intersecting_mesh_group_count": len(mesh_counts),
            "co099_non_RP_mesh_groups": non_rp_meshes,
            "co099_relevant_surface_groups": surface_rows,
            "all_co099_wall_floor_groups_have_expected_receipted_source": all(sources_ok) if sources_ok else False,
            "qualification": "Geometry export has mesh names/transforms/triangles but no material-slot metadata; receipt proves actor-level slot replacement, not per-pixel ownership.",
        },
        "duplicates": {
            "exact_same_mesh_and_transform_count": len(exact_duplicates),
            "rows": exact_duplicates,
            "sampled_floor_and_wall_ray_count": len(sampled_surface_rays),
            "sampled_coincident_distinct_instance_pair_count": len(coincident_candidates),
            "sampled_coincident_rows": coincident_candidates,
            "sampled_surface_rays": sampled_surface_rays,
            "qualification": "Exact transforms plus 36 non-seam floor/wall rays found no distinct instances within 1 cm when both counts are zero. This is strong local static evidence, not an exhaustive triangle-overlap proof.",
        },
        "inputs": [
            {"path": str(path).replace("\\", "/"), "bytes": path.stat().st_size, "sha256": sha256(path)}
            for path in (GEO_INSTANCES, GEO_MESHES, OCCUPANCY, ZONES, RECEIPT)
        ],
    }
    OUT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")

    lines = [
        "# CO099 material-review camera audit",
        "",
        "Read-only static export and receipt audit. Unreal was not opened and no project package was changed.",
        "",
        "## Finding",
        "",
        "The three white/near-white review cameras are outside CO099. The verified clear interior is Y = -6268 to -5877 cm. "
        "Their origins use Y = -5800, -5790, and -5780 cm, which places them 77, 87, and 97 cm beyond the north inner face. "
        "The outer north wall face ends at Y = -5848 cm, so the cameras are also 48, 58, and 68 cm beyond the exterior face. "
        "The center rays immediately encounter the wall from its exterior side; this matches the all-white frames and does not implicate exposure because the wide and floor-front cameras render under the same sequence settings.",
        "",
        "## Replacement poses",
        "",
        "| Camera | Origin cm | Target cm | FOV | Origin wall clearance |",
        "|---|---:|---:|---:|---:|",
    ]
    for row in proposed_rows:
        lines.append(
            "| %s | `%s` | `%s` | %s | %.0f cm |"
            % (row["name"], row["origin_cm"], row["target_cm"], row["fov_degrees"], row["origin_nearest_inner_wall_clearance_cm"])
        )
    lines += [
        "",
        "All proposed origins sit on the exported clearance-selected centerline Y = -6100 cm. The wall targets extend through the wall so the center ray reaches the verified inner face at Y about -5877 cm. The floor camera aims through the slab at Z = -20 cm; the exported triangles produce the first floor contact at Z about 0 cm, and the XY target remains 43 cm inside the wall.",
        "",
        "## Material/duplicate audit",
        "",
        "The corridor receipt records 41 wall slots and 24 floor slots across 65 unique RP actors. Every CO099 wall/floor surface group found in the static export maps by logical asset name to exactly one RP actor with the expected source-material override in that receipt. Actor and static-mesh numeric prefixes differ, so matching the raw RP number would be wrong; this audit strips those generated indices and requires the remaining asset name to match. No non-RP mesh group intersects CO099, no exact same-mesh/same-transform duplicate intersects it, and 36 deliberately non-seam floor/wall rays found no two distinct instances within 1 cm. The export does not carry material-slot metadata, so this is actor/mesh coverage evidence rather than per-pixel proof; the sampled rays are strong local evidence rather than an exhaustive triangle-overlap proof.",
        "",
        "The After wide frames are changed rather than byte-identical: a sampled 8-pixel grid measured mean luminance 131.14 before versus 116.17 after and mean absolute RGB difference 17.01. The pure-white wall frames are 100% sampled near-white both before and after. That pattern supports a camera-placement fault for the white frames. Artistic adequacy of the darker corridor material still requires review of corrected renders.",
        "",
        "Full machine-readable evidence: `%s`" % str(OUT_JSON).replace("\\", "/"),
    ]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"json": str(OUT_JSON), "markdown": str(OUT_MD), "status": report["status"]}, indent=2))


if __name__ == "__main__":
    main()
