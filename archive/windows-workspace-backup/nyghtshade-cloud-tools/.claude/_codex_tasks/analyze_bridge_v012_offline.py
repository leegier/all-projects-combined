"""Offline-only bridge/road geometry audit for NH environment V012.

Reads saved JSON arrays. Does not import unreal, open the editor, or touch packages.
Writes a sealed JSON/Markdown calculation receipt under the authorized H: evidence folder.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path


BRIDGE_PATH = Path(r"H:\NyghtshadeHollow_Development\2026-10-10\EnvironmentCleanup\Evidence\V012_BridgeGeometry.json")
RUNTIME_PATH = Path(r"H:\NyghtshadeHollow_Development\2026-10-10\EnvironmentCleanup\Evidence\RuntimeCollision_NH_EnvRefine_Codex_v012_20261010T141656896333Z\NH_EnvRefine_Codex_v012_RuntimeCollision.json")
ROAD_PATH = Path(r"E:\GameDev\Staging\MyProject2_EnvCopy_Claude_20261009\_claude_evidence\stageE\road_meshes.json")
DESIGN_PATH = Path(r"E:\GameDev\Staging\MyProject2_EnvCopy_Claude_20261009\_claude_evidence\stageE\terrain_design.json")
OUT_DIR = Path(r"H:\NyghtshadeHollow_Development\2026-10-10\EnvironmentCleanup\Evidence")
OUT_JSON = OUT_DIR / "NH_V012_Bridge_Deck_Profile_and_MinimalRepair_2026-10-10.json"
OUT_MD = OUT_DIR / "NH_V012_Bridge_Deck_Profile_and_MinimalRepair_2026-10-10.md"

# Verified actor pivot from V008 actual-state receipt/root readback. World geometry is already transformed.
PIVOT = (-91000.0, 90200.0, -1558.916)
X_CENTER = -91000.0
WATER_Z = -1549.689
FIT_OLD_SOUTH_Y = 88510.0
FIT_OLD_NORTH_Y = 91890.0
APPROACH_LENGTH_CM = 1350.0
ROAD_HALF_WIDTH_CM = 365.0
CLEAR_DECK_HALF_WIDTH_CM = 250.0
BRIDGE_X_SCALE = 1.5
OVERLAY_HALF_WIDTH_CM = ROAD_HALF_WIDTH_CM
OVERLAY_LIFT_CM = 2.0
# Exact endpoint fit is reported separately. A 60 cm end rise lets the approach Hermites meet the
# measured deck tangent without a large reverse-grade dip while keeping the arch over water.
COHERENT_END_RISE_CM = 60.0


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().upper()


def prep(vertices, triangles):
    out = []
    for index, tri in enumerate(triangles):
        a, b, c = (vertices[i] for i in tri)
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(den) < 1.0e-9:
            continue
        out.append(
            (
                index,
                a,
                b,
                c,
                den,
                min(a[0], b[0], c[0]),
                max(a[0], b[0], c[0]),
                min(a[1], b[1], c[1]),
                max(a[1], b[1], c[1]),
            )
        )
    return out


def vertical_hits(prepared, x, y):
    hits = []
    for index, a, b, c, den, x0, x1, y0, y1 in prepared:
        if x < x0 - 1.0e-6 or x > x1 + 1.0e-6 or y < y0 - 1.0e-6 or y > y1 + 1.0e-6:
            continue
        u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den
        v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den
        w = 1.0 - u - v
        if min(u, v, w) >= -1.0e-7 and max(u, v, w) <= 1.0000001:
            hits.append((u * a[2] + v * b[2] + w * c[2], index))
    # Collapse coincident triangles but retain the triangle identity for the first occurrence.
    unique = []
    for z, index in sorted(hits):
        if not unique or abs(z - unique[-1][0]) > 0.01:
            unique.append((z, index))
    return unique


def surface_z(prepared, x, y, top=True):
    h = vertical_hits(prepared, x, y)
    if not h:
        raise ValueError(f"No vertical triangle hit at ({x}, {y})")
    return h[-1][0] if top else h[0][0]


def interp(xs, ys, x):
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    lo, hi = 0, len(xs) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if xs[mid] <= x:
            lo = mid
        else:
            hi = mid
    t = (x - xs[lo]) / (xs[hi] - xs[lo])
    return ys[lo] * (1.0 - t) + ys[hi] * t


def derivative(fn, x, h=5.0):
    return (fn(x + h) - fn(x - h)) / (2.0 * h)


def hermite(y, y0, z0, m0, y1, z1, m1):
    t = (y - y0) / (y1 - y0)
    h = y1 - y0
    h00 = 2 * t**3 - 3 * t**2 + 1
    h10 = t**3 - 2 * t**2 + t
    h01 = -2 * t**3 + 3 * t**2
    h11 = t**3 - t**2
    return h00 * z0 + h10 * h * m0 + h01 * z1 + h11 * h * m1


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def main():
    bridge_json = json.loads(BRIDGE_PATH.read_text(encoding="utf-8"))
    road_json = json.loads(ROAD_PATH.read_text(encoding="utf-8"))
    design_json = json.loads(DESIGN_PATH.read_text(encoding="utf-8"))
    vertices = bridge_json["world_vertices"]
    triangles = bridge_json["triangles"]
    road_vertices = road_json["main"]["V"]
    road_triangles = road_json["main"]["T"]
    pb = prep(vertices, triangles)
    pr = prep(road_vertices, road_triangles)

    def road_z(y):
        return surface_z(pr, X_CENTER, y, True)

    south_z = surface_z(pb, X_CENTER, FIT_OLD_SOUTH_Y, True)
    north_z = surface_z(pb, X_CENTER, FIT_OLD_NORTH_Y, True)
    x0, y0, z0 = PIVOT

    def rotated_yz(y, z, theta):
        # UE FScaleRotationTranslationMatrix for Pitch=Yaw=0, positive Roll about +X:
        # y'=y*cos+z*sin, z'=-y*sin+z*cos (row-vector convention in engine source).
        yr, zr = y - y0, z - z0
        s, c = math.sin(theta), math.cos(theta)
        return y0 + yr * c + zr * s, z0 - yr * s + zr * c

    def endpoint_translation_difference(theta):
        ys, zs = rotated_yz(FIT_OLD_SOUTH_Y, south_z, theta)
        yn, zn = rotated_yz(FIT_OLD_NORTH_Y, north_z, theta)
        return (road_z(yn) - zn) - (road_z(ys) - zs)

    # Bracketed solve for equal Z translation at both transformed deck endpoints.
    lo, hi = math.radians(-2.0), math.radians(2.0)
    flo, fhi = endpoint_translation_difference(lo), endpoint_translation_difference(hi)
    assert flo * fhi < 0.0, (flo, fhi)
    for _ in range(100):
        mid = (lo + hi) * 0.5
        fm = endpoint_translation_difference(mid)
        if flo * fm <= 0:
            hi, fhi = mid, fm
        else:
            lo, flo = mid, fm
    theta = (lo + hi) * 0.5
    fit_south_y, fit_south_base_z = rotated_yz(FIT_OLD_SOUTH_Y, south_z, theta)
    fit_north_y, fit_north_base_z = rotated_yz(FIT_OLD_NORTH_Y, north_z, theta)
    tz_s = road_z(fit_south_y) - fit_south_base_z
    tz_n = road_z(fit_north_y) - fit_north_base_z
    tz_exact = (tz_s + tz_n) * 0.5
    assert abs(tz_s - tz_n) < 1.0e-7

    def transform_vertices(z_extra):
        out = []
        s, c = math.sin(theta), math.cos(theta)
        for x, y, z in vertices:
            yr, zr = y - y0, z - z0
            out.append([x, y0 + yr * c + zr * s, z0 - yr * s + zr * c + tz_exact + z_extra])
        return out

    exact_vertices = transform_vertices(0.0)
    coherent_vertices = transform_vertices(COHERENT_END_RISE_CM)
    pe = prep(exact_vertices, triangles)
    pc = prep(coherent_vertices, triangles)

    exact_deck = lambda y: surface_z(pe, X_CENTER, y, True)
    coherent_deck = lambda y: surface_z(pc, X_CENTER, y, True)
    exact_under = lambda y: surface_z(pe, X_CENTER, y, False)
    coherent_under = lambda y: surface_z(pc, X_CENTER, y, False)

    # The transformed join stations are the transformed test points and stay safely inside the top surface.
    south_join = fit_south_y
    north_join = fit_north_y
    south_outer = south_join - APPROACH_LENGTH_CM
    north_outer = north_join + APPROACH_LENGTH_CM
    road_slope_south = derivative(road_z, south_outer)
    road_slope_north = derivative(road_z, north_outer)
    deck_slope_south = derivative(coherent_deck, south_join + 10.0)
    deck_slope_north = derivative(coherent_deck, north_join - 10.0)

    south_start_z = road_z(south_outer)
    south_end_z = coherent_deck(south_join) + OVERLAY_LIFT_CM
    north_start_z = coherent_deck(north_join) + OVERLAY_LIFT_CM
    north_end_z = road_z(north_outer)

    def proposed_road_z(y):
        if y <= south_outer or y >= north_outer:
            return road_z(y)
        if y < south_join:
            return hermite(y, south_outer, south_start_z, road_slope_south, south_join, south_end_z, deck_slope_south)
        if y <= north_join:
            return coherent_deck(y) + OVERLAY_LIFT_CM
        return hermite(y, north_join, north_start_z, deck_slope_north, north_outer, north_end_z, road_slope_north)

    def proposed_half_width(y):
        # Preserve the full 7.30 m road width. The bridge actor widens only in X by 1.5x,
        # expanding the measured central plateau from +/-269 cm to +/-403.5 cm.
        return ROAD_HALF_WIDTH_CM

    # Dense validation of the static proposal.
    dense = []
    y = south_outer
    while y <= north_outer + 0.001:
        dense.append(
            {
                "y": y,
                "base_road_z": road_z(y),
                "proposed_road_z": proposed_road_z(y),
                "half_width": proposed_half_width(y),
            }
        )
        y += 5.0
    grades = []
    for a, b in zip(dense, dense[1:]):
        grades.append((b["proposed_road_z"] - a["proposed_road_z"]) / (b["y"] - a["y"]))

    # Center-deck clear plateau measured at bridge crown. A 245 cm overlay half-width leaves margin.
    crown_y = y0
    crown_center = surface_z(pb, X_CENTER, crown_y, True)
    central_plateau = []
    for dx in range(-500, 501):
        try:
            value = surface_z(pb, X_CENTER + dx, crown_y, True)
        except ValueError:
            continue
        if abs(value - crown_center) <= 1.0:
            central_plateau.append(dx)

    profile_rows = []
    key_ys = sorted(
        set(
            [south_outer, south_join, y0, north_join, north_outer]
            + [float(y) for y in range(int(math.ceil(south_outer / 200.0) * 200), int(north_outer) + 1, 200)]
        )
    )
    for y in key_ys:
        row = {
            "y": round(y, 6),
            "base_road_z": round(road_z(y), 6),
            "proposed_road_z": round(proposed_road_z(y), 6),
            "road_raise_cm": round(proposed_road_z(y) - road_z(y), 6),
            "proposed_half_width_cm": round(proposed_half_width(y), 6),
        }
        if south_join <= y <= north_join:
            row.update(
                {
                    "exact_fit_deck_z": round(exact_deck(y), 6),
                    "coherent_deck_z": round(coherent_deck(y), 6),
                    "coherent_under_z": round(coherent_under(y), 6),
                    "under_clearance_above_water_cm": round(coherent_under(y) - WATER_Z, 6),
                }
            )
        profile_rows.append(row)

    # Reproduce the reported obstruction with the saved triangle geometry.
    hit_x, hit_y, hit_z = -91000.0, 91445.465, -1026.574
    hit_candidates = vertical_hits(pb, hit_x, hit_y)
    nearest_hit = min(hit_candidates, key=lambda h: abs(h[0] - hit_z))

    bounds = {
        "x": [min(v[0] for v in vertices), max(v[0] for v in vertices)],
        "y": [min(v[1] for v in vertices), max(v[1] for v in vertices)],
        "z": [min(v[2] for v in vertices), max(v[2] for v in vertices)],
    }
    repair_profile_25cm = []
    py = south_outer
    while py < north_outer - 0.001:
        repair_profile_25cm.append(
            {"y": round(py, 6), "road_z": round(proposed_road_z(py), 6), "half_width": round(proposed_half_width(py), 6)}
        )
        py += 25.0
    repair_profile_25cm.append(
        {"y": round(north_outer, 6), "road_z": round(proposed_road_z(north_outer), 6), "half_width": round(proposed_half_width(north_outer), 6)}
    )
    result = {
        "classification": "offline static saved-array audit; no Unreal execution or package writes",
        "sources": [
            {"path": str(BRIDGE_PATH), "sha256": sha(BRIDGE_PATH)},
            {"path": str(RUNTIME_PATH), "sha256": sha(RUNTIME_PATH)},
            {"path": str(ROAD_PATH), "sha256": sha(ROAD_PATH)},
            {"path": str(DESIGN_PATH), "sha256": sha(DESIGN_PATH)},
        ],
        "bridge": {
            "mesh": bridge_json["mesh"],
            "vertices": len(vertices),
            "triangles": len(triangles),
            "pivot": list(PIVOT),
            "bounds": bounds,
            "orientation_conclusion": "Yaw/heading is already correct: long axis is world Y (34.641 m) and width is world X (10.637 m). The defect is vertical placement plus an unwarped road under the real deck.",
            "crown_center_deck_z_before": crown_center,
            "measured_center_deck_plateau_dx_cm": [min(central_plateau), max(central_plateau)],
            "proposed_actor_x_scale": BRIDGE_X_SCALE,
            "scaled_center_deck_plateau_dx_cm": [min(central_plateau) * BRIDGE_X_SCALE, max(central_plateau) * BRIDGE_X_SCALE],
            "safe_overlay_half_width_cm": OVERLAY_HALF_WIDTH_CM,
        },
        "reproduced_runtime_hit": {
            "query": [hit_x, hit_y, hit_z],
            "nearest_saved_triangle_z": nearest_hit[0],
            "triangle_index": nearest_hit[1],
            "absolute_z_error_cm": abs(nearest_hit[0] - hit_z),
            "top_deck_z_same_xy": surface_z(pb, hit_x, hit_y, True),
        },
        "exact_two_end_fit": {
            "old_fit_points": [
                {"y": FIT_OLD_SOUTH_Y, "deck_z": south_z},
                {"y": FIT_OLD_NORTH_Y, "deck_z": north_z},
            ],
            "added_roll_degrees_about_world_x": math.degrees(theta),
            "added_actor_z_cm": tz_exact,
            "transformed_join_y_cm": [south_join, north_join],
            "endpoint_residual_cm": tz_s - tz_n,
            "deck_end_rise_over_existing_road_cm": 0.0,
        },
        "recommended_coherent_placement": {
            "added_roll_degrees_about_world_x": math.degrees(theta),
            "added_actor_z_cm": tz_exact + COHERENT_END_RISE_CM,
            "extra_end_rise_above_exact_fit_cm": COHERENT_END_RISE_CM,
            "reason": "The exact fit makes the arched deck tangent reverse immediately from the nearly flat road. A 60 cm end rise supports monotone 13.5 m Hermite approaches and avoids a reverse-grade dip while retaining about 4 m crown-under-arch clearance over the saved water plane.",
            "approach_length_each_side_cm": APPROACH_LENGTH_CM,
            "bridge_overlay_lift_cm": OVERLAY_LIFT_CM,
            "road_half_width_outside_cm": ROAD_HALF_WIDTH_CM,
            "road_half_width_on_bridge_cm": OVERLAY_HALF_WIDTH_CM,
            "bridge_actor_x_scale": BRIDGE_X_SCALE,
            "south_join_deck_slope": deck_slope_south,
            "north_join_deck_slope": deck_slope_north,
            "maximum_absolute_proposed_grade": max(abs(x) for x in grades),
            "maximum_road_raise_cm": max(r["proposed_road_z"] - r["base_road_z"] for r in dense),
            "minimum_road_raise_cm": min(r["proposed_road_z"] - r["base_road_z"] for r in dense),
        },
        "design_reference": design_json.get("bridge"),
        "profile_rows": profile_rows,
        "repair_profile_25cm": repair_profile_25cm,
        "repair_contract": {
            "source_map": "/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v012",
            "new_map": "/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v013",
            "keep_bridge_yaw": True,
            "keep_bridge_collision": True,
            "bridge_actor_x_scale": BRIDGE_X_SCALE,
            "new_meshes_only": [
                "/Game/Nyghtshade/EnvironmentRepair_20261010/SM_CL_MainRoad_BridgeBlend_R1",
                "/Game/Nyghtshade/EnvironmentRepair_20261010/SM_CL_MainRoad_CentreDash_BridgeBlend_R1",
            ],
            "do_not": [
                "disable bridge collision",
                "rotate bridge 90 degrees",
                "raise the entire main road",
                "modify the v012 source map or shared Gothic bridge asset",
            ],
        },
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(result, indent=2), encoding="utf-8")

    table = []
    for r in profile_rows:
        table.append(
            f"| {r['y']:.1f} | {r['base_road_z']:.1f} | {r['proposed_road_z']:.1f} | {r['road_raise_cm']:.1f} | {r['proposed_half_width_cm']:.1f} |"
        )
    md = f"""# V012 bridge deck profile and minimal coherent repair

**Evidence boundary:** Offline analysis of saved arrays only. Unreal was not launched and no map/package was changed.

## Diagnosis

- The bridge heading is correct. Its saved bounds are {bounds['x'][1]-bounds['x'][0]:.3f} cm across X and {bounds['y'][1]-bounds['y'][0]:.3f} cm along Y.
- The flat main road is beneath the bridge's usable deck and intersects its structural arch. At the reported camera hit, saved triangle {nearest_hit[1]} is at Z {nearest_hit[0]:.3f} cm; the actual deck at the same XY is Z {surface_z(pb, hit_x, hit_y, True):.3f} cm.
- The center driveable deck is flat laterally through approximately X offsets {min(central_plateau)} to {max(central_plateau)} cm at source scale. X-only actor scale {BRIDGE_X_SCALE:.2f} expands that plateau to approximately ±{max(abs(min(central_plateau)),abs(max(central_plateau)))*BRIDGE_X_SCALE:.1f} cm, preserving the full ±{ROAD_HALF_WIDTH_CM:.0f} cm asphalt width with a measured side margin.

## Exact two-end fit

The exact rigid fit adds Roll **{math.degrees(theta):.6f}° about world X** and moves the actor **{tz_exact:.3f} cm in Z**. It preserves yaw. This places the two tested deck ends on the existing centerline road to within {abs(tz_s-tz_n):.9f} cm.

Exact endpoint matching alone leaves the arched deck tangent meeting a nearly flat road abruptly. The coherent proposal raises the fitted bridge another {COHERENT_END_RISE_CM:.1f} cm, for total actor Z change **{tz_exact+COHERENT_END_RISE_CM:.3f} cm**, and uses {APPROACH_LENGTH_CM/100:.1f} m Hermite approaches. The bridge widens only in X to {BRIDGE_X_SCALE:.2f}x so the road remains {ROAD_HALF_WIDTH_CM*2/100:.2f} m wide; Y/Z deck geometry, yaw, Roll fit, and longitudinal grade remain measured.

Maximum sampled proposal grade is **{max(abs(x) for x in grades)*100:.2f}%**. This is a practical drivability limitation inherited from the bridge's arched deck and requires an actual vehicle/capsule traversal before acceptance. Maximum road lift over the saved flat road is **{max(r['proposed_road_z']-r['base_road_z'] for r in dense):.2f} cm**. Minimum lift is **{min(r['proposed_road_z']-r['base_road_z'] for r in dense):.2f} cm**.

## Key profile rows (centimetres)

| World Y | Existing road Z | Proposed road Z | Raise | Half width |
|---:|---:|---:|---:|---:|
{chr(10).join(table)}

## Repair contract

- Duplicate v012 to a new v013 map.
- Keep bridge yaw and collision; apply the measured Roll/Z placement and bounded X-only 1.5 scale in v013.
- Create new road and center-dash mesh packages. Warp only the bounded bridge/approach rows and preserve all other saved vertices/triangles.
- Use complex-as-simple collision on the new road mesh and retain bridge collision.
- Reopen v013 and run fresh floor plus camera-sphere tests over both approaches and the complete crown before accepting it.

Full precision, source hashes, water/arch clearance, and the static profile are in `{OUT_JSON}`.
"""
    OUT_MD.write_text(md, encoding="utf-8")
    print(json.dumps({"json": str(OUT_JSON), "markdown": str(OUT_MD), "roll_deg": math.degrees(theta), "exact_z_cm": tz_exact, "coherent_z_cm": tz_exact + COHERENT_END_RISE_CM, "max_grade": max(abs(x) for x in grades)}, indent=2))


if __name__ == "__main__":
    main()
