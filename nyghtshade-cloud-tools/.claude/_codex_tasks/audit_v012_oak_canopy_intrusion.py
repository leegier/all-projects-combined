"""Offline-only v012 oak/clearing canopy audit and reversible transform plan.

Reads sealed JSON evidence only.  It never imports Unreal or touches packages.
"""
from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path


READBACK = Path(r"H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup/Evidence/V012_OakAndShadowReadback.json")
SCATTER = Path(r"E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009/_claude_evidence/stageE/forest_scatter.json")
SOURCE = Path(r"E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009/_claude_scripts/design_export_part.py")
OUT_JSON = Path(r"E:/_codex_tasks/V012_oak_canopy_intrusion_audit_20261010.json")
OUT_MD = Path(r"E:/_codex_tasks/V012_oak_canopy_intrusion_audit_20261010.md")

BOUNDARY_R = 2400.0
BOUNDARY_BUFFER = 150.0
CANOPY_BUFFER = 150.0
PORTAL_X = 26364.0
APPROACH_Y = -880.0
SHRUB_MARKERS = ("Camellia", "Ilex", "Dendropanax")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def xy_distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def solve_radial_translation(actor, hero_location, hero_center, hero_radius, tree_radius):
    """Smallest translation along the current root radial that clears both gates."""
    location = actor["location"][:2]
    center = actor["bounds_center"][:2]
    root_r = xy_distance(location, hero_location)
    ux = (location[0] - hero_location[0]) / root_r
    uy = (location[1] - hero_location[1]) / root_r
    root_t = max(0.0, BOUNDARY_R + BOUNDARY_BUFFER - root_r)

    dx = center[0] - hero_center[0]
    dy = center[1] - hero_center[1]
    target = hero_radius + tree_radius + CANOPY_BUFFER
    projected = dx * ux + dy * uy
    c = dx * dx + dy * dy - target * target
    disc = max(0.0, projected * projected - c)
    canopy_t = max(0.0, -projected + math.sqrt(disc))
    t = max(root_t, canopy_t)
    new_xy = [location[0] + t * ux, location[1] + t * uy]
    return {
        "translation_xy_cm": [round(t * ux, 3), round(t * uy, 3)],
        "translation_length_cm": round(t, 3),
        "proposed_location_xy_cm": [round(new_xy[0], 3), round(new_xy[1], 3)],
        "proposed_root_radius_cm": round(xy_distance(new_xy, hero_location), 3),
        "z_instruction": "terrain-reseat at new XY using a downward trace/root-footprint samples; retain yaw and scale",
    }


def main():
    readback = json.loads(READBACK.read_text(encoding="utf-8"))
    scatter = json.loads(SCATTER.read_text(encoding="utf-8"))
    actors = readback["actors"]
    hero = next(a for a in actors if a["label"] == "NH_CentralOak_ExactCenter")
    hloc = hero["location"][:2]
    hcenter = hero["bounds_center"][:2]
    hext = hero["bounds_extent"][:2]
    hradius = max(hext)

    per_mesh_unscaled_radius = defaultdict(list)
    for a in actors:
        if not a["label"].startswith("NH_ClearingTree_"):
            continue
        mesh = a["components"][0]["mesh"].split("/")[-1].split(".")[0]
        per_mesh_unscaled_radius[mesh].append(max(a["bounds_extent"][:2]) / a["scale"][0])
    mesh_radius = {k: max(v) for k, v in per_mesh_unscaled_radius.items()}
    largest_known_radius = max(mesh_radius.values())

    ring_rows = []
    for a in actors:
        if not a["label"].startswith("NH_ClearingTree_"):
            continue
        center = a["bounds_center"][:2]
        extent = a["bounds_extent"][:2]
        radius = max(extent)
        root_d = xy_distance(a["location"][:2], hloc)
        center_d = xy_distance(center, hcenter)
        circle_pen = hradius + radius - center_d
        overlap_x = max(0.0, min(hcenter[0] + hext[0], center[0] + extent[0]) - max(hcenter[0] - hext[0], center[0] - extent[0]))
        overlap_y = max(0.0, min(hcenter[1] + hext[1], center[1] + extent[1]) - max(hcenter[1] - hext[1], center[1] - extent[1]))
        mesh = a["components"][0]["mesh"].split("/")[-1].split(".")[0]
        plan = solve_radial_translation(a, hloc, hcenter, hradius, radius)
        ring_rows.append({
            "label": a["label"],
            "mesh": mesh,
            "location_cm": a["location"],
            "bounds_center_cm": a["bounds_center"],
            "bounds_extent_cm": a["bounds_extent"],
            "scale": a["scale"],
            "root_radius_cm": round(root_d, 3),
            "root_inside_fixed_24m_boundary": root_d < BOUNDARY_R,
            "conservative_circle_penetration_cm": round(circle_pen, 3),
            "conservative_circle_overlap": circle_pen > 0.0,
            "exact_world_aabb_overlap_xy_cm": [round(overlap_x, 3), round(overlap_y, 3)],
            "exact_world_aabb_overlap": overlap_x > 0.0 and overlap_y > 0.0,
            "minimal_radial_transform_plan": plan,
        })

    # The scatter file supplies exact transforms, but not mesh bounding boxes.  For
    # meshes represented by saved ring actors, derive a conservative per-mesh
    # horizontal radius from actual world-bound extent / uniform scale.  For the
    # five nearest unknown species, use the largest known broad-canopy radius as a
    # move-safe proxy and mark that classification as conservative, not exact.
    scatter_rows = []
    proxy_rows = []
    total_scatter = 0
    for asset, instances in scatter["instances"].items():
        mesh = asset.split("/")[-1]
        is_shrub = any(marker in mesh for marker in SHRUB_MARKERS)
        for index, transform in enumerate(instances):
            total_scatter += 1
            x, y, z, yaw, scale = transform
            root_d = xy_distance((x, y), hloc)
            if mesh in mesh_radius:
                radius = mesh_radius[mesh] * scale
                basis = "conservative radius from v012 world bounds of same mesh / uniform scale"
                exact_mesh_family = True
            elif not is_shrub:
                radius = largest_known_radius * scale
                basis = "largest known ring-tree radius proxy; exact mesh bounds absent from sealed readback"
                exact_mesh_family = False
            else:
                # Source tour proxy for shrubs; none approach the hero closely enough
                # to matter even with a deliberately generous 300 cm radius.
                radius = 300.0 * scale
                basis = "generous shrub proxy; exact mesh bounds absent from sealed readback"
                exact_mesh_family = False
            penetration = hradius + radius + CANOPY_BUFFER - root_d
            if penetration <= 0.0:
                continue
            ux = (x - hloc[0]) / root_d
            uy = (y - hloc[1]) / root_d
            move = max(0.0, BOUNDARY_R + BOUNDARY_BUFFER - root_d, penetration)
            row = {
                "asset": asset,
                "mesh": mesh,
                "source_instance_index_within_asset": index,
                "source_transform_xyz_yaw_scale": transform,
                "root_radius_cm": round(root_d, 3),
                "canopy_radius_used_cm": round(radius, 3),
                "radius_basis": basis,
                "same_mesh_world_bounds_available": exact_mesh_family,
                "conservative_penetration_including_150cm_buffer_cm": round(penetration, 3),
                "proposed_location_xy_cm": [round(x + move * ux, 3), round(y + move * uy, 3)],
                "translation_xy_cm": [round(move * ux, 3), round(move * uy, 3)],
                "z_instruction": "terrain-reseat visual instance and matching hidden collision proxy; retain yaw/scale",
            }
            proxy_rows.append(row)
            if exact_mesh_family:
                scatter_rows.append(row)

    # The geometry boundary/approach coordinates are fixed references and must not
    # be moved as part of a vegetation fix.
    west_boundary_x = hloc[0] - BOUNDARY_R
    approach_centerline_cm = west_boundary_x - PORTAL_X
    report = {
        "scope": "offline read-only; no Unreal launch or package mutation",
        "inputs": {
            str(READBACK): sha256(READBACK),
            str(SCATTER): sha256(SCATTER),
            str(SOURCE): sha256(SOURCE),
        },
        "hero_oak": {
            "location_cm": hero["location"],
            "bounds_center_cm": hero["bounds_center"],
            "bounds_extent_cm": hero["bounds_extent"],
            "horizontal_conservative_radius_cm": hradius,
        },
        "fixed_geometry": {
            "clearing_boundary_radius_cm": BOUNDARY_R,
            "portal_x_cm_from_source": PORTAL_X,
            "approach_centerline_y_cm": APPROACH_Y,
            "portal_to_west_24m_boundary_centerline_cm": round(approach_centerline_cm, 3),
            "portal_to_west_24m_boundary_centerline_ft": round(approach_centerline_cm / 30.48, 3),
            "instruction": "Do not move portal, oak, or 24 m boundary during vegetation repair; preserve/verify the roughly-100-ft approach separately.",
        },
        "ring_summary": {
            "placed_clearing_tree_count": len(ring_rows),
            "roots_inside_fixed_24m_boundary": sum(r["root_inside_fixed_24m_boundary"] for r in ring_rows),
            "conservative_circle_overlaps": sum(r["conservative_circle_overlap"] for r in ring_rows),
            "exact_world_aabb_overlaps": sum(r["exact_world_aabb_overlap"] for r in ring_rows),
            "minimum_root_radius_cm": round(min(r["root_radius_cm"] for r in ring_rows), 3),
            "maximum_root_radius_cm": round(max(r["root_radius_cm"] for r in ring_rows), 3),
        },
        "same_mesh_radius_registry_cm": {k: round(v, 6) for k, v in sorted(mesh_radius.items())},
        "ring_actors": ring_rows,
        "scatter_summary": {
            "total_source_instances": total_scatter,
            "exact_source_root_exclusion_cm": 2400.0,
            "overlaps_using_same_mesh_saved_world_bounds": len(scatter_rows),
            "move_safe_candidates_using_largest_known_tree_proxy": len(proxy_rows),
            "limitation": "forest_scatter.json has transforms but no mesh bounds; the v012 readback omitted HISM instance bounds. Same-mesh count is evidence-backed; proxy count intentionally over-selects unknown tree species for a reversible transform fix.",
        },
        "scatter_same_mesh_evidence_candidates": scatter_rows,
        "scatter_move_safe_proxy_candidates": proxy_rows,
        "recommended_v014_gate": [
            "Duplicate v013 to v014 and retain v013 recovery checkpoint.",
            "Translate only the listed ring actors and five move-safe HISM candidates; do not change meshes, yaw, or scale.",
            "Use the minimal radial XY proposals as initial transforms; terrain-reseat Z from actual terrain/root-footprint traces.",
            "Move the matching hidden collision-proxy instance by exact old XY lookup for every moved HISM source instance.",
            "Keep hero oak, portal, clearing measurement marker, and 24 m boundary fixed.",
            "Reject any transform that enters the verified player approach corridor; use a small tangential adjustment at the same or larger radius, record old/new transforms, then rerun canopy/path/collision proof.",
        ],
    }
    OUT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")

    known = scatter_rows
    move_safe = proxy_rows
    ring_move = [r for r in ring_rows if r["root_inside_fixed_24m_boundary"] or r["conservative_circle_overlap"]]
    lines = [
        "# v012 central-oak canopy intrusion audit (offline)",
        "",
        "This is sealed JSON/source analysis only. Unreal was not launched and no package was changed.",
        "",
        "## Result",
        "",
        f"- Hero oak: root `{hloc}`, world-bound center `{hcenter}`, horizontal conservative radius `{hradius:.1f} cm`.",
        f"- Placed clearing trees: **{len(ring_rows)}**. **{sum(r['root_inside_fixed_24m_boundary'] for r in ring_rows)} roots are already inside the fixed 24 m boundary** (range {min(r['root_radius_cm'] for r in ring_rows):.1f}–{max(r['root_radius_cm'] for r in ring_rows):.1f} cm).",
        f"- Conservative world-bound circle test: **{sum(r['conservative_circle_overlap'] for r in ring_rows)} overlaps**. Exact XY AABB test: **{sum(r['exact_world_aabb_overlap'] for r in ring_rows)} overlaps**.",
        f"- Minimal repair set under the boundary-or-circle gate: **{len(ring_move)} placed actors**.",
        f"- Source scatter: {total_scatter:,} exact transforms. Same-mesh saved-bound evidence identifies **{len(known)} HISM overlap**. A move-safe broad-canopy proxy selects **{len(move_safe)} HISM candidates** total; this deliberately includes four unknown-mesh candidates because their exact bounds were not included in the sealed readback.",
        "",
        "## Exact evidence-backed HISM candidate",
        "",
    ]
    for r in known:
        lines.append(f"- `{r['mesh']}` source index `{r['source_instance_index_within_asset']}` at `{r['source_transform_xyz_yaw_scale']}`; buffered penetration `{r['conservative_penetration_including_150cm_buffer_cm']:.1f} cm`; proposed XY `{r['proposed_location_xy_cm']}`.")
    lines += [
        "",
        "## Conservative reversible v014 proposal",
        "",
        "- Duplicate v013 to v014. Keep the hero oak, portal, measurement marker, and geometric 24 m clearing boundary fixed.",
        f"- Apply the JSON's minimal radial XY transforms to the {len(ring_move)} ring actors that fail either gate. Keep each mesh, yaw, and scale unchanged. Re-seat Z against the actual terrain using root-footprint traces.",
        f"- Move the {len(move_safe)} move-safe HISM candidates and their matching hidden collision proxies by old-XY lookup. The same-mesh evidence requires one; the other four are conservative and reversible until exact native mesh bounds are read during the writer pass.",
        "- Gate the transformed roots against the real walkable approach corridor. If a radial move enters it, slide that tree tangentially at the same or larger radius and record the substitution. Do not move the path or clearing boundary.",
        "- Reopen v014, verify the fixed hero as view target, capture an overhead boundary proof plus player-height 360-degree oak proof, and test the forest approach collision before accepting.",
        "",
        "## Geometry note",
        "",
        f"The source portal X and fixed west edge of a 24 m clearing yield {approach_centerline_cm:.1f} cm ({approach_centerline_cm / 30.48:.1f} ft) on the straight centerline. That is pre-existing geometry evidence, not caused by this transform plan. Preserve the geometry during canopy repair and verify the intended roughly-100-ft route along the actual walkable centerline separately.",
        "",
        "## Limitation",
        "",
        "The scatter JSON does not contain static-mesh bounds and the sealed v012 readback did not enumerate HISM instance bounds. The report therefore separates the one same-mesh evidence-backed HISM overlap from a five-item move-safe proxy set. It does not label proxy-only candidates as exact overlaps.",
    ]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({
        "json": str(OUT_JSON),
        "json_sha256": sha256(OUT_JSON),
        "markdown": str(OUT_MD),
        "markdown_sha256": sha256(OUT_MD),
        "ring_summary": report["ring_summary"],
        "scatter_summary": report["scatter_summary"],
    }, indent=2))


if __name__ == "__main__":
    main()
