"""Offline-only sealed design for the v017 100-foot forest approach.

This script does not import Unreal and cannot open or save a package.  It
derives a C2 centerline from the fixed portal to the fixed 24 m clearing west
edge, samples the sealed stageE terrain triangles, and audits the sealed
forest proxy inventory plus the saved v014 clearing-ring receipt.
"""

from __future__ import annotations

import array
import collections
import datetime
import hashlib
import json
import math
import pathlib
import struct
import sys


OUT = pathlib.Path(r"E:/_codex_tasks/V017_ForestApproach_100ft_Proposal.json")
SCATTER = pathlib.Path(
    r"E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009/_claude_evidence/stageE/forest_scatter.json"
)
TERRAIN = pathlib.Path(
    r"E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009/_claude_evidence/stageE/terrain_mesh.bin"
)
CANOPY_RECEIPT = pathlib.Path(
    r"H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup/Evidence/"
    r"V014_CanopyTransformRepairReceipt.json"
)

EXPECTED_HASHES = {
    str(SCATTER).replace("\\", "/"): "8CD6742653538F522559450FEA6A4AA91B7FA0540CFC65FE4268DCF8D6656477",
    str(TERRAIN).replace("\\", "/"): "9D8E4FDC484542E2F4974D6D33651CCF055A09BA461DFAB623992FD8248E30DA",
    str(CANOPY_RECEIPT).replace("\\", "/"): "42876F6B970165CDBB8DB682C5666DD09D34154FB0AB866F5A07872D700953BF",
}
EXPECTED_TERRAIN_SHAPES = (
    (56205, 3),
    (110978, 3),
    (110978, 1),
    (10057, 3),
    (19712, 3),
    (19712, 1),
)

PORTAL = (26364.0, -880.0)
CLEARING_WEST_EDGE = (28840.8, -880.0)
HERO_ROOT = (31240.8, -880.0, -810.0)
CLEARING_RADIUS_CM = 2400.0
CORRIDOR_HALF_WIDTH_CM = 600.0
TARGET_WALK_LENGTH_CM = 3048.0
# Thirty 28 cm runs and thirty 16.5 cm drops make an exact 32.5 cm
# nose-to-nose centerline per step: 30 * 32.5 = 975 cm.  The remaining
# ground-following centerline is 2,073 cm, so the total plan arc is exactly
# 840 + 2,073 = 2,913 cm while the three-dimensional walk is exactly 3,048 cm.
STAIR_COUNT = 30
STAIR_RUN_PER_STEP_CM = 28.0
STAIR_RISE_PER_STEP_CM = 16.5
STAIR_PLAN_RUN_CM = STAIR_COUNT * STAIR_RUN_PER_STEP_CM
STAIR_WALK_LENGTH_CM = STAIR_COUNT * math.hypot(STAIR_RUN_PER_STEP_CM, STAIR_RISE_PER_STEP_CM)
PLAN_ARC_LENGTH_CM = TARGET_WALK_LENGTH_CM - STAIR_WALK_LENGTH_CM + STAIR_PLAN_RUN_CM
HALF_PLAN_ARC_LENGTH_CM = PLAN_ARC_LENGTH_CM / 2.0
RAMP_LENGTH_CM = 360.0
TURN_LENGTH_CM = 720.0
GROUND_PATH_FINISHED_WIDTH_CM = 300.0
LANE_OFFSETS_CM = (-100.0, 0.0, 100.0)
BODY_RADIUS_CM = 42.0
SAMPLE_SPACING_CM = 100.0


def sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def smoothstep5(value: float) -> float:
    return 10.0 * value**3 - 15.0 * value**4 + 6.0 * value**5


def smoothstep5_derivative(value: float) -> float:
    return 30.0 * value**2 * (1.0 - value) ** 2


def simpson(function, start: float, end: float, panels: int = 4096) -> float:
    if panels % 2:
        panels += 1
    step = (end - start) / panels
    total = function(start) + function(end)
    total += 4.0 * sum(function(start + step * index) for index in range(1, panels, 2))
    total += 2.0 * sum(function(start + step * index) for index in range(2, panels, 2))
    return total * step / 3.0


def profile_durations(theta_peak: float):
    ramp_sin_average = simpson(lambda u: math.sin(theta_peak * smoothstep5(u)), 0.0, 1.0)
    negative_hold_minus_positive_hold = (
        RAMP_LENGTH_CM * ramp_sin_average / math.sin(theta_peak)
    )
    positive_hold = (
        HALF_PLAN_ARC_LENGTH_CM
        - RAMP_LENGTH_CM
        - TURN_LENGTH_CM
        - negative_hold_minus_positive_hold
    ) / 2.0
    negative_hold = positive_hold + negative_hold_minus_positive_hold
    if positive_hold <= 0.0:
        raise RuntimeError("curve profile has no positive-angle hold")
    return positive_hold, negative_hold


def theta_at_half(s_value: float, theta_peak: float, positive_hold: float, negative_hold: float) -> float:
    if s_value <= RAMP_LENGTH_CM:
        return theta_peak * smoothstep5(max(0.0, min(1.0, s_value / RAMP_LENGTH_CM)))
    cursor = RAMP_LENGTH_CM
    if s_value <= cursor + positive_hold:
        return theta_peak
    cursor += positive_hold
    if s_value <= cursor + TURN_LENGTH_CM:
        u_value = max(0.0, min(1.0, (s_value - cursor) / TURN_LENGTH_CM))
        return theta_peak * (1.0 - 2.0 * smoothstep5(u_value))
    cursor += TURN_LENGTH_CM
    if s_value <= cursor + negative_hold + 1.0e-7:
        return -theta_peak
    raise RuntimeError("half-profile station outside sealed segments: %.9f" % s_value)


def theta_at(s_value: float, theta_peak: float, positive_hold: float, negative_hold: float) -> float:
    station = max(0.0, min(PLAN_ARC_LENGTH_CM, float(s_value)))
    mirrored = station if station <= HALF_PLAN_ARC_LENGTH_CM else PLAN_ARC_LENGTH_CM - station
    return theta_at_half(mirrored, theta_peak, positive_hold, negative_hold)


def dx_for_peak(theta_peak: float) -> float:
    positive_hold, negative_hold = profile_durations(theta_peak)
    ramp_cos_average = simpson(lambda u: math.cos(theta_peak * smoothstep5(u)), 0.0, 1.0)
    turn_cos_average = simpson(
        lambda u: math.cos(theta_peak * (1.0 - 2.0 * smoothstep5(u))), 0.0, 1.0
    )
    half_dx = (
        RAMP_LENGTH_CM * ramp_cos_average
        + TURN_LENGTH_CM * turn_cos_average
        + (positive_hold + negative_hold) * math.cos(theta_peak)
    )
    return 2.0 * half_dx


def solve_theta_peak() -> float:
    wanted_dx = CLEARING_WEST_EDGE[0] - PORTAL[0]
    low = math.radians(25.0)
    high = math.radians(65.0)
    for _ in range(100):
        midpoint = (low + high) / 2.0
        if dx_for_peak(midpoint) > wanted_dx:
            low = midpoint
        else:
            high = midpoint
    return (low + high) / 2.0


def integrate_xy(end_station: float, theta_peak: float, positive_hold: float, negative_hold: float):
    if end_station <= 0.0:
        return PORTAL
    station = min(PLAN_ARC_LENGTH_CM, end_station)
    # Integrate each requested point independently.  Piecewise theta is smooth,
    # and 8,192 Simpson panels keep endpoint error far below the 0.02 cm seal.
    x_delta = simpson(
        lambda s: math.cos(theta_at(s, theta_peak, positive_hold, negative_hold)),
        0.0,
        station,
        8192,
    )
    y_delta = simpson(
        lambda s: math.sin(theta_at(s, theta_peak, positive_hold, negative_hold)),
        0.0,
        station,
        8192,
    )
    return PORTAL[0] + x_delta, PORTAL[1] + y_delta


def plan_to_walk_station(plan_station: float) -> float:
    station = max(0.0, min(PLAN_ARC_LENGTH_CM, float(plan_station)))
    if station <= STAIR_PLAN_RUN_CM:
        return station * math.hypot(STAIR_RUN_PER_STEP_CM, STAIR_RISE_PER_STEP_CM) / STAIR_RUN_PER_STEP_CM
    return STAIR_WALK_LENGTH_CM + station - STAIR_PLAN_RUN_CM


def designed_nose_centerline_z(plan_station: float) -> float:
    station = max(0.0, min(PLAN_ARC_LENGTH_CM, float(plan_station)))
    if station <= STAIR_PLAN_RUN_CM:
        return -300.0 - (STAIR_COUNT * STAIR_RISE_PER_STEP_CM) * station / STAIR_PLAN_RUN_CM
    return -795.0


class TriangleTerrain:
    def __init__(self, path: pathlib.Path):
        raw = path.read_bytes()
        offset = 0
        arrays = []
        shapes = []
        for value_format in ("f", "i", "b", "f", "i", "b"):
            count, width = struct.unpack_from("<II", raw, offset)
            offset += 8
            values = array.array(value_format)
            byte_count = values.itemsize * count * width
            values.frombytes(raw[offset : offset + byte_count])
            offset += byte_count
            if sys.byteorder != "little" and values.itemsize > 1:
                values.byteswap()
            arrays.append(
                [tuple(values[index * width : (index + 1) * width]) for index in range(count)]
                if width > 1
                else list(values)
            )
            shapes.append((count, width))
        if offset != len(raw) or tuple(shapes) != EXPECTED_TERRAIN_SHAPES:
            raise RuntimeError("sealed terrain binary layout mismatch: %r" % (shapes,))
        self.shapes = tuple(shapes)
        self.v_base, self.t_base, self.m_base, self.v_patch, self.t_patch, self.m_patch = arrays
        self.cell = 1000.0
        self.base_index = self._make_index(self.v_base, self.t_base)
        self.patch_index = self._make_index(self.v_patch, self.t_patch)

    def _make_index(self, vertices, triangles):
        result = collections.defaultdict(list)
        for triangle_index, triangle in enumerate(triangles):
            points = [vertices[int(index)] for index in triangle]
            for ix in range(math.floor(min(p[0] for p in points) / self.cell), math.floor(max(p[0] for p in points) / self.cell) + 1):
                for iy in range(math.floor(min(p[1] for p in points) / self.cell), math.floor(max(p[1] for p in points) / self.cell) + 1):
                    result[(ix, iy)].append(triangle_index)
        return result

    def _query(self, x_value, y_value, vertices, triangles, index):
        key = (math.floor(x_value / self.cell), math.floor(y_value / self.cell))
        for triangle_index in index.get(key, ()):
            ia, ib, ic = triangles[triangle_index]
            a, b, c = vertices[int(ia)], vertices[int(ib)], vertices[int(ic)]
            denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(denominator) < 1.0e-12:
                continue
            wa = ((b[1] - c[1]) * (x_value - c[0]) + (c[0] - b[0]) * (y_value - c[1])) / denominator
            wb = ((c[1] - a[1]) * (x_value - c[0]) + (a[0] - c[0]) * (y_value - c[1])) / denominator
            wc = 1.0 - wa - wb
            if wa >= -1.0e-6 and wb >= -1.0e-6 and wc >= -1.0e-6:
                return wa * a[2] + wb * b[2] + wc * c[2]
        return None

    def surface_z(self, x_value, y_value):
        result = self._query(x_value, y_value, self.v_patch, self.t_patch, self.patch_index)
        if result is None:
            result = self._query(x_value, y_value, self.v_base, self.t_base, self.base_index)
        if result is None:
            raise RuntimeError("no sealed terrain triangle at %.3f, %.3f" % (x_value, y_value))
        return float(result)


def distance_to_segment(px, py, ax, ay, bx, by):
    dx = bx - ax
    dy = by - ay
    denominator = dx * dx + dy * dy
    if denominator <= 0.0:
        return math.hypot(px - ax, py - ay)
    amount = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denominator))
    return math.hypot(px - (ax + amount * dx), py - (ay + amount * dy))


def distance_to_polyline(px, py, points):
    return min(
        distance_to_segment(px, py, points[index][0], points[index][1], points[index + 1][0], points[index + 1][1])
        for index in range(len(points) - 1)
    )


def ring_world_bounds(row):
    old_location = row["old_location"]
    new_location = row["new_location"]
    old_center = row["old_bounds_center"]
    center = (
        float(new_location[0]) + float(old_center[0]) - float(old_location[0]),
        float(new_location[1]) + float(old_center[1]) - float(old_location[1]),
    )
    extent = (float(row["old_bounds_extent"][0]), float(row["old_bounds_extent"][1]))
    return center, extent


def main():
    observed_hashes = {str(path).replace("\\", "/"): sha256(path) for path in (SCATTER, TERRAIN, CANOPY_RECEIPT)}
    if observed_hashes != EXPECTED_HASHES:
        raise RuntimeError("sealed input hash mismatch: %r" % observed_hashes)

    theta_peak = solve_theta_peak()
    positive_hold, negative_hold = profile_durations(theta_peak)
    end_xy = integrate_xy(PLAN_ARC_LENGTH_CM, theta_peak, positive_hold, negative_hold)
    if math.hypot(end_xy[0] - CLEARING_WEST_EDGE[0], end_xy[1] - CLEARING_WEST_EDGE[1]) > 0.02:
        raise RuntimeError("curve endpoint did not close: %r" % (end_xy,))

    terrain = TriangleTerrain(TERRAIN)
    station_values = [float(value) for value in range(0, 2901, 100)] + [PLAN_ARC_LENGTH_CM]
    stations = []
    all_lane_z = []
    for station in station_values:
        x_value, y_value = integrate_xy(station, theta_peak, positive_hold, negative_hold)
        theta_value = theta_at(station, theta_peak, positive_hold, negative_hold)
        lanes = []
        for lateral in LANE_OFFSETS_CM:
            lane_x = x_value - math.sin(theta_value) * lateral
            lane_y = y_value + math.cos(theta_value) * lateral
            lane_z = terrain.surface_z(lane_x, lane_y)
            lanes.append({"offset_cm": lateral, "x_cm": lane_x, "y_cm": lane_y, "terrain_z_cm": lane_z})
            all_lane_z.append(lane_z)
        stations.append(
            {
                "plan_station_cm": station,
                "walkable_station_cm": plan_to_walk_station(station),
                "x_cm": x_value,
                "y_cm": y_value,
                "underlying_terrain_z_cm": lanes[1]["terrain_z_cm"],
                "designed_nose_centerline_z_cm": designed_nose_centerline_z(station),
                "tangent_heading_degrees": math.degrees(theta_value),
                "unit_tangent_xy": [math.cos(theta_value), math.sin(theta_value)],
                "unit_left_normal_xy": [-math.sin(theta_value), math.cos(theta_value)],
                "lanes": lanes,
            }
        )

    grades = []
    for left, right in zip(stations, stations[1:]):
        station_delta = right["plan_station_cm"] - left["plan_station_cm"]
        dz = right["underlying_terrain_z_cm"] - left["underlying_terrain_z_cm"]
        grades.append(
            {
                "from_plan_station_cm": left["plan_station_cm"],
                "to_plan_station_cm": right["plan_station_cm"],
                "delta_z_cm": dz,
                "grade_percent_by_centerline_arc": 100.0 * dz / station_delta,
            }
        )

    stair_tread_validation = []
    for tread_index in range(STAIR_COUNT):
        plan_station = (tread_index + 0.5) * STAIR_RUN_PER_STEP_CM
        x_value, y_value = integrate_xy(plan_station, theta_peak, positive_hold, negative_hold)
        theta_value = theta_at(plan_station, theta_peak, positive_hold, negative_hold)
        tread_top_z = -300.0 - tread_index * STAIR_RISE_PER_STEP_CM
        stair_tread_validation.append(
            {
                "tread_index_zero_based": tread_index,
                "plan_station_cm": plan_station,
                "walkable_station_cm": plan_to_walk_station(plan_station),
                "center_xy_cm": [x_value, y_value],
                "expected_tread_top_z_cm": tread_top_z,
                "heading_degrees": math.degrees(theta_value),
                "floor_sample_lateral_offsets_cm": [-80.0, 0.0, 80.0],
            }
        )

    post_stair_ground_validation = []
    ground_plan_stations = []
    cursor = STAIR_PLAN_RUN_CM
    while cursor < PLAN_ARC_LENGTH_CM:
        ground_plan_stations.append(cursor)
        cursor += SAMPLE_SPACING_CM
    if not ground_plan_stations or abs(ground_plan_stations[-1] - PLAN_ARC_LENGTH_CM) > 1.0e-9:
        ground_plan_stations.append(PLAN_ARC_LENGTH_CM)
    for plan_station in ground_plan_stations:
        x_value, y_value = integrate_xy(plan_station, theta_peak, positive_hold, negative_hold)
        theta_value = theta_at(plan_station, theta_peak, positive_hold, negative_hold)
        lanes = []
        for lateral in LANE_OFFSETS_CM:
            lane_x = x_value - math.sin(theta_value) * lateral
            lane_y = y_value + math.cos(theta_value) * lateral
            lanes.append(
                {
                    "offset_cm": lateral,
                    "x_cm": lane_x,
                    "y_cm": lane_y,
                    "expected_terrain_z_cm": terrain.surface_z(lane_x, lane_y),
                }
            )
        post_stair_ground_validation.append(
            {
                "plan_station_cm": plan_station,
                "walkable_station_cm": plan_to_walk_station(plan_station),
                "center_xy_cm": [x_value, y_value],
                "heading_degrees": math.degrees(theta_value),
                "lanes": lanes,
            }
        )

    # A 10 cm polyline is fine enough for conservative circle/path distance
    # auditing; the authoritative curve remains the analytic arc-length profile.
    dense_points = []
    for index in range(int(PLAN_ARC_LENGTH_CM / 10.0) + 1):
        dense_points.append(integrate_xy(index * 10.0, theta_peak, positive_hold, negative_hold))
    if dense_points[-1] != end_xy:
        dense_points.append(end_xy)

    scatter = json.loads(SCATTER.read_text(encoding="utf-8"))
    receipt = json.loads(CANOPY_RECEIPT.read_text(encoding="utf-8"))
    collision_rows = [list(map(float, row)) for row in scatter["collision_circles_cm"]]
    for move in receipt["hism_instance_moves"]:
        proxy_index = int(move["proxy_instance_index"])
        new_proxy = [float(value) for value in move["new_proxy_location"]]
        collision_rows[proxy_index][0] = new_proxy[0]
        collision_rows[proxy_index][1] = new_proxy[1]
        collision_rows[proxy_index][2] = new_proxy[2] - 150.0

    proxy_candidates = []
    min_x = PORTAL[0] - 1000.0
    max_x = CLEARING_WEST_EDGE[0] + 1000.0
    min_y = PORTAL[1] - CORRIDOR_HALF_WIDTH_CM - 1000.0
    max_y = PORTAL[1] + CORRIDOR_HALF_WIDTH_CM + 1000.0
    for index, row in enumerate(collision_rows):
        x_value, y_value, z_value, radius = row
        if min_x <= x_value <= max_x and min_y <= y_value <= max_y:
            edge_clearance = distance_to_polyline(x_value, y_value, dense_points) - radius - BODY_RADIUS_CM
            proxy_candidates.append(
                {
                    "proxy_index": index,
                    "x_cm": x_value,
                    "y_cm": y_value,
                    "radius_cm": radius,
                    "body_centerline_edge_clearance_cm": edge_clearance,
                }
            )
    proxy_candidates.sort(key=lambda row: row["body_centerline_edge_clearance_cm"])

    ring_root_rows = []
    ring_canopy_rows = []
    for row in receipt["ring_actor_moves"]:
        new_location = [float(value) for value in row["new_location"]]
        footprint = float(row["terrain_root_footprint_cm"])
        root_clearance = distance_to_polyline(new_location[0], new_location[1], dense_points) - footprint - BODY_RADIUS_CM
        ring_root_rows.append(
            {
                "label": row["label"],
                "root_xy_cm": new_location[:2],
                "terrain_root_footprint_cm": footprint,
                "body_centerline_edge_clearance_cm": root_clearance,
            }
        )
        center, extent = ring_world_bounds(row)
        # Rectangle-vs-polyline proximity surrogate: distance from the AABB
        # center to the path minus the XY AABB circumscribed radius.  Negative
        # means visual canopy may overhang; it is not root collision evidence.
        canopy_radius = math.hypot(extent[0], extent[1])
        canopy_clearance = distance_to_polyline(center[0], center[1], dense_points) - canopy_radius
        ring_canopy_rows.append(
            {
                "label": row["label"],
                "bounds_center_xy_cm": list(center),
                "bounds_extent_xy_cm": list(extent),
                "conservative_circumscribed_canopy_radius_cm": canopy_radius,
                "conservative_canopy_clearance_to_centerline_cm": canopy_clearance,
            }
        )
    ring_root_rows.sort(key=lambda row: row["body_centerline_edge_clearance_cm"])
    ring_canopy_rows.sort(key=lambda row: row["conservative_canopy_clearance_to_centerline_cm"])

    max_abs_y_offset = max(abs(point[1] - PORTAL[1]) for point in dense_points)
    curvature_max = max(
        1.875 * theta_peak / RAMP_LENGTH_CM,
        3.75 * theta_peak / TURN_LENGTH_CM,
    )
    direct_distance = math.hypot(CLEARING_WEST_EDGE[0] - PORTAL[0], CLEARING_WEST_EDGE[1] - PORTAL[1])
    proposal = {
        "status": "OFFLINE_SEALED_PROPOSAL_ONLY_UNIMPLEMENTED_AND_RUNTIME_UNTESTED",
        "generated_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "scope": "v015 baseline to fresh v017 candidate; no Unreal process, package, actor, asset, or binary was opened or written",
        "source_baseline": {
            "map": "/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v015",
            "v015_package_sha256": "7307884BD3E79F8D418FD67149070FE4853AF49DDA4D65DA40BA991C17269672",
            "v016_status": "failed partial packages preserved; explicitly excluded as a source",
            "sealed_inputs": observed_hashes,
            "terrain_shapes": [list(shape) for shape in terrain.shapes],
        },
        "fixed_invariants": {
            "portal_xy_cm": list(PORTAL),
            "clearing_west_edge_xy_cm": list(CLEARING_WEST_EDGE),
            "hero_root_cm": list(HERO_ROOT),
            "clearing_radius_cm": CLEARING_RADIUS_CM,
            "approach_corridor": {
                "x_min_cm": PORTAL[0],
                "x_max_cm": CLEARING_WEST_EDGE[0],
                "center_y_cm": PORTAL[1],
                "half_width_cm": CORRIDOR_HALF_WIDTH_CM,
                "y_min_cm": PORTAL[1] - CORRIDOR_HALF_WIDTH_CM,
                "y_max_cm": PORTAL[1] + CORRIDOR_HALF_WIDTH_CM,
            },
            "prohibited_changes": [
                "portal transform",
                "hero oak transform/mesh/scale/yaw",
                "clearing marker transform",
                "24 m geometric clearing boundary",
                "owned foliage meshes or source scatter inventory",
            ],
        },
        "centerline": {
            "measurement_convention": (
                "three-dimensional nose-to-nose walking centerline: 30 curved steps contribute 975 cm "
                "(each 28 cm plan run and 16.5 cm drop gives 32.5 cm), followed by 2,073 cm of ground path"
            ),
            "target_and_measured_walkable_arc_length_cm": TARGET_WALK_LENGTH_CM,
            "target_and_measured_walkable_arc_length_ft": TARGET_WALK_LENGTH_CM / 30.48,
            "measured_horizontal_plan_arc_length_cm": PLAN_ARC_LENGTH_CM,
            "measured_horizontal_plan_arc_length_ft": PLAN_ARC_LENGTH_CM / 30.48,
            "exact_length_decomposition_cm": {
                "stair_plan_run": STAIR_PLAN_RUN_CM,
                "stair_vertical_drop": STAIR_COUNT * STAIR_RISE_PER_STEP_CM,
                "stair_nose_to_nose_walk": STAIR_WALK_LENGTH_CM,
                "post_stair_ground_path": PLAN_ARC_LENGTH_CM - STAIR_PLAN_RUN_CM,
                "total_walk": STAIR_WALK_LENGTH_CM + PLAN_ARC_LENGTH_CM - STAIR_PLAN_RUN_CM,
            },
            "direct_endpoint_distance_cm": direct_distance,
            "former_straight_distance_ft": direct_distance / 30.48,
            "added_measured_walk_length_cm": TARGET_WALK_LENGTH_CM - direct_distance,
            "profile": {
                "parameter": "s_plan is true horizontal XY arc length in centimeters",
                "differential_equations": "dx/ds=cos(theta(s)); dy/ds=sin(theta(s))",
                "smoothstep": "q(u)=10u^3-15u^4+6u^5",
                "first_half_segments_cm": [
                    {"kind": "ramp 0 to +theta_peak", "length": RAMP_LENGTH_CM},
                    {"kind": "hold +theta_peak", "length": positive_hold},
                    {"kind": "quintic turn +theta_peak to -theta_peak", "length": TURN_LENGTH_CM},
                    {"kind": "hold -theta_peak", "length": negative_hold},
                ],
                "second_half": "exact mirror theta(2913-s_plan), producing the opposite-side meander and zero endpoint heading",
                "theta_peak_degrees": math.degrees(theta_peak),
                "endpoint_heading_degrees": [0.0, 0.0],
                "continuity": "C2 centerline; theta and curvature are continuous and curvature is zero at every segment join",
            },
            "endpoint_closure_error_cm": math.hypot(end_xy[0] - CLEARING_WEST_EDGE[0], end_xy[1] - CLEARING_WEST_EDGE[1]),
            "maximum_abs_lateral_centerline_offset_cm": max_abs_y_offset,
            "minimum_centerline_margin_to_12m_corridor_edge_cm": CORRIDOR_HALF_WIDTH_CM - max_abs_y_offset,
            "maximum_absolute_heading_degrees": math.degrees(theta_peak),
            "maximum_curvature_per_cm": curvature_max,
            "minimum_curvature_radius_cm": 1.0 / curvature_max,
            "stations": stations,
            "designed_walkable_floor": {
                "portal_floor_z_cm": -300.0,
                "forest_ground_z_cm": -795.0,
                "stair_count": STAIR_COUNT,
                "curved_centerline_plan_run_cm": STAIR_PLAN_RUN_CM,
                "tread_run_cm": STAIR_RUN_PER_STEP_CM,
                "riser_height_cm": STAIR_RISE_PER_STEP_CM,
                "nose_to_nose_step_centerline_cm": math.hypot(STAIR_RUN_PER_STEP_CM, STAIR_RISE_PER_STEP_CM),
                "stair_width_cm": 220.0,
                "post_stair_finished_ground_path_width_cm": GROUND_PATH_FINISHED_WIDTH_CM,
                "post_stair_path_plan_and_walk_length_cm": PLAN_ARC_LENGTH_CM - STAIR_PLAN_RUN_CM,
                "required_actor_label_prefix": "CL_ForestApproach_Stair",
                "construction": (
                    "one new local curved stair/retaining assembly on the fresh candidate; 30 tread tops follow the "
                    "sealed XY centerline in 28 cm plan increments and drop 16.5 cm each, landing on -795 cm terrain at s_plan=840"
                ),
                "reason": (
                    "the sealed terrain drops from -300 cm to -795 cm in roughly the first 136 cm of X; direct terrain "
                    "grades exceed 300%, so a label/decal alone cannot make this route walkable"
                ),
            },
            "terrain_profile": {
                "center_start_z_cm": stations[0]["underlying_terrain_z_cm"],
                "center_end_z_cm": stations[-1]["underlying_terrain_z_cm"],
                "net_delta_z_cm": stations[-1]["underlying_terrain_z_cm"] - stations[0]["underlying_terrain_z_cm"],
                "minimum_lane_z_cm": min(all_lane_z),
                "maximum_lane_z_cm": max(all_lane_z),
                "maximum_absolute_sampled_underlying_terrain_grade_percent": max(abs(row["grade_percent_by_centerline_arc"]) for row in grades),
                "grades_between_stations": grades,
                "caution": (
                    "the first two underlying-terrain intervals are an actual topographic blocker, not a candidate floor. "
                    "The designed curved stair supplies the walkable collision there. Actual PIE first-hit collision, "
                    "tread normals, body clearance, and camera clearance remain mandatory"
                ),
            },
            "runtime_validation_samples": {
                "stair_tread_centers": stair_tread_validation,
                "stair_final_landing": {
                    "plan_station_cm": STAIR_PLAN_RUN_CM,
                    "walkable_station_cm": STAIR_WALK_LENGTH_CM,
                    "center_xy_cm": list(integrate_xy(STAIR_PLAN_RUN_CM, theta_peak, positive_hold, negative_hold)),
                    "expected_floor_z_cm": -795.0,
                    "floor_sample_lateral_offsets_cm": [-80.0, 0.0, 80.0],
                },
                "post_stair_ground_plan_station_start_cm": STAIR_PLAN_RUN_CM,
                "post_stair_ground_lateral_offsets_cm": list(LANE_OFFSETS_CM),
                "post_stair_ground_stations": post_stair_ground_validation,
            },
        },
        "offline_obstacle_audit": {
            "sealed_hism_collision_proxy_count": len(collision_rows),
            "nearby_proxy_candidate_count_within_10m_bbox": len(proxy_candidates),
            "minimum_proxy_body_edge_clearance_cm": proxy_candidates[0]["body_centerline_edge_clearance_cm"] if proxy_candidates else None,
            "minimum_proxy_body_edge_clearance_at_outer_100cm_lane_cm": (
                proxy_candidates[0]["body_centerline_edge_clearance_cm"] - 100.0 if proxy_candidates else None
            ),
            "nearest_proxy_candidates": proxy_candidates[:20],
            "ring_actor_count": len(ring_root_rows),
            "minimum_ring_root_body_edge_clearance_cm": ring_root_rows[0]["body_centerline_edge_clearance_cm"],
            "minimum_ring_root_body_edge_clearance_at_outer_100cm_lane_cm": (
                ring_root_rows[0]["body_centerline_edge_clearance_cm"] - 100.0
            ),
            "nearest_ring_roots": ring_root_rows[:12],
            "visual_canopy_overhangs": [
                row for row in ring_canopy_rows if row["conservative_canopy_clearance_to_centerline_cm"] < 0.0
            ],
            "interpretation": (
                "root/proxy circles are collision-proximity evidence; conservative crown/AABB overlap is visual canopy layering only. "
                "Do not move a tree solely because its crown overhangs the path. Runtime sweeps decide actual blocking collision."
            ),
        },
        "smallest_reversible_implementation": {
            "required": [
                "create one new named approach spline/route actor in the fresh v017 candidate using this sealed C2 plan centerline",
                "add the 30-tread curved stair/retaining assembly only for s_plan 0..840 cm; this is required by the sealed 4.95 m terrain drop and must expose real visible collision geometry",
                "retain the existing terrain as the collision floor from s_plan=840 cm through the fixed clearing boundary",
                "use a restrained 300 cm finished-width no-collision ground dressing strip or existing licensed dirt/leaf material centered on the spline only if visual readability needs it",
                "keep all existing foliage, portal, oak, marker, terrain, and collision-proxy transforms unchanged unless an actual runtime sweep identifies a blocker",
            ],
            "optional_after_pixel_review": [
                "locally suppress only non-colliding grass/groundcover inside roughly 120 cm of the centerline; preserve shrubs and canopy outside that narrow dressing band",
                "add sparse sticks/leaf litter outside the clear tread rather than widening the path into a bare corridor",
            ],
            "explicitly_not_authorized_by_this_proposal": [
                "tree/proxy relocation based only on crown overlap",
                "portal, oak, marker, or clearing-boundary movement",
                "base-terrain sculpting",
                "source-mesh or source-scatter edits",
                "claiming walkability before fresh PIE traces and possessed traversal",
            ],
        },
        "required_validation": [
            "sealed proposal/hash and endpoint/corridor invariants",
            "actual PIE first-hit floor on all 30 stair tread centers at center and +/-80 cm, then terrain first-hit at center and true-normal +/-100 cm lanes across the 300 cm finished ground path after s_plan=840",
            "actual PIE 42 cm WorldStatic body-sphere sweeps over the designed floor at +95 cm",
            "actual PIE 24 cm Camera-channel sphere sweeps over the designed floor at +220 cm",
            "actual path actor/spline geometry agrees with this centerline rather than merely labeling a shorter route 100 ft",
            "possessed-player walk in both directions remains a separate required test",
        ],
    }
    OUT.write_text(json.dumps(proposal, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"proposal": str(OUT), "sha256": sha256(OUT), "metrics": {
        "walkable_arc_length_cm": TARGET_WALK_LENGTH_CM,
        "plan_arc_length_cm": PLAN_ARC_LENGTH_CM,
        "theta_peak_degrees": math.degrees(theta_peak),
        "max_lateral_cm": max_abs_y_offset,
        "min_radius_cm": 1.0 / curvature_max,
        "max_abs_underlying_terrain_grade_percent": proposal["centerline"]["terrain_profile"]["maximum_absolute_sampled_underlying_terrain_grade_percent"],
        "min_proxy_clearance_cm": proposal["offline_obstacle_audit"]["minimum_proxy_body_edge_clearance_cm"],
        "min_ring_root_clearance_cm": proposal["offline_obstacle_audit"]["minimum_ring_root_body_edge_clearance_cm"],
    }}, indent=2))


if __name__ == "__main__":
    main()
