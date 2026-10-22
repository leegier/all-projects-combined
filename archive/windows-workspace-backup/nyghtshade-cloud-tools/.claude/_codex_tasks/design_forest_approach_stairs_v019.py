"""Seal exact offline geometry for the private forest-approach stair candidate.

This script is ordinary CPython only.  It reads the already sealed 100-foot
route proposal/generator and writes deterministic vertex/triangle/UV arrays for
one visible concrete stair/retaining solid and one visible two-rail barrier.
It does not import Unreal or touch a project package.
"""

import datetime
import hashlib
import importlib.util
import json
import math
import pathlib


TASK_ROOT = pathlib.Path("E:/_codex_tasks")
ROUTE_GENERATOR = TASK_ROOT / "design_forest_approach_v017_100ft.py"
ROUTE_PROPOSAL = TASK_ROOT / "V017_ForestApproach_100ft_Proposal.json"
OUTPUT = TASK_ROOT / "V019_ForestApproach_StairGeometry.json"
EXPECTED_ROUTE_GENERATOR_SHA256 = "E71340632212187E7F31E268DBAE1812E826116DA392DED617183CC08A068D4E"
EXPECTED_ROUTE_PROPOSAL_SHA256 = "3BE52EB07132684CE8A7998034C7F742377DD45BF072AD79ACFC167C19952FBC"

STAIR_HALF_WIDTH_CM = 110.0
RETAINING_BASE_Z_CM = -825.0
RAIL_LATERAL_CM = 116.0
RAIL_POST_SPACING_PLAN_CM = 56.0
RAIL_POST_SIZE_CM = 8.0
RAIL_HEIGHT_CM = 112.0
RAIL_LEVELS_CM = (54.0, 106.0)
RAIL_BEAM_SIZE_CM = 8.0
ROUTE_POLYLINE_SPACING_PLAN_CM = 3.0
UV_WORLD_SCALE_CM = 100.0


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def load_route_module():
    if sha256(ROUTE_GENERATOR) != EXPECTED_ROUTE_GENERATOR_SHA256:
        raise RuntimeError("sealed route generator hash changed")
    spec = importlib.util.spec_from_file_location("nh_sealed_route", ROUTE_GENERATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def add(a, b):
    return tuple(float(a[index]) + float(b[index]) for index in range(3))


def sub(a, b):
    return tuple(float(a[index]) - float(b[index]) for index in range(3))


def mul(a, value):
    return tuple(float(component) * float(value) for component in a)


def length(a):
    return math.sqrt(sum(float(component) ** 2 for component in a))


def unit(a):
    magnitude = length(a)
    if magnitude <= 1.0e-9:
        raise RuntimeError("degenerate vector")
    return mul(a, 1.0 / magnitude)


def cross(a, b):
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


class MeshBuilder:
    def __init__(self):
        self.vertices = []
        self.triangles = []
        self.uvs = []

    def quad(self, p0, p1, p2, p3):
        points = [tuple(map(float, point)) for point in (p0, p1, p2, p3)]
        base = len(self.vertices)
        self.vertices.extend(points)
        u_length = 0.5 * (length(sub(points[1], points[0])) + length(sub(points[2], points[3])))
        v_length = 0.5 * (length(sub(points[3], points[0])) + length(sub(points[2], points[1])))
        self.uvs.extend(
            [
                (0.0, 0.0),
                (u_length / UV_WORLD_SCALE_CM, 0.0),
                (u_length / UV_WORLD_SCALE_CM, v_length / UV_WORLD_SCALE_CM),
                (0.0, v_length / UV_WORLD_SCALE_CM),
            ]
        )
        # UE 5.8 GeometryScript/Chaos treats the opposite side of the ordinary
        # mathematical cross-product winding as the one-sided front.  v018's
        # native above/below traces proved this convention in this exact
        # project.  Reverse each authored outward quad once so tread collision
        # hits from above and the closed rail/retaining solids face outward.
        self.triangles.extend(((base, base + 2, base + 1), (base, base + 3, base + 2)))

    def box(self, center, axis_x, axis_y, axis_z, size_x, size_y, size_z):
        axes = (unit(axis_x), unit(axis_y), unit(axis_z))
        if abs(sum(cross(axes[0], axes[1])[i] * axes[2][i] for i in range(3)) - 1.0) > 0.02:
            raise RuntimeError("box axes are not a right-handed orthonormal frame")
        half = (0.5 * size_x, 0.5 * size_y, 0.5 * size_z)
        corners = []
        for sx, sy, sz in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                           (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)):
            point = tuple(float(value) for value in center)
            point = add(point, mul(axes[0], sx * half[0]))
            point = add(point, mul(axes[1], sy * half[1]))
            point = add(point, mul(axes[2], sz * half[2]))
            corners.append(point)
        for face in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                     (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            self.quad(*(corners[index] for index in face))

    def record(self):
        if len(self.vertices) != len(self.uvs):
            raise RuntimeError("vertex/UV count mismatch")
        if not self.triangles or max(max(row) for row in self.triangles) >= len(self.vertices):
            raise RuntimeError("triangle index outside vertex array")
        values = [value for point in self.vertices for value in point]
        if not all(math.isfinite(value) for value in values):
            raise RuntimeError("non-finite mesh vertex")
        minimum = [min(point[axis] for point in self.vertices) for axis in range(3)]
        maximum = [max(point[axis] for point in self.vertices) for axis in range(3)]
        return {
            "vertices_cm": [list(row) for row in self.vertices],
            "triangles": [list(row) for row in self.triangles],
            "uv0": [list(row) for row in self.uvs],
            "vertex_count": len(self.vertices),
            "triangle_count": len(self.triangles),
            "bounds_min_cm": minimum,
            "bounds_max_cm": maximum,
        }


def main():
    if sha256(ROUTE_PROPOSAL) != EXPECTED_ROUTE_PROPOSAL_SHA256:
        raise RuntimeError("sealed route proposal hash changed")
    proposal = json.loads(ROUTE_PROPOSAL.read_text(encoding="utf-8"))
    if proposal["status"] != "OFFLINE_SEALED_PROPOSAL_ONLY_UNIMPLEMENTED_AND_RUNTIME_UNTESTED":
        raise RuntimeError("unexpected route proposal status")
    route = load_route_module()
    theta_peak = route.solve_theta_peak()
    positive_hold, negative_hold = route.profile_durations(theta_peak)

    def plan_point(station):
        x_value, y_value = route.integrate_xy(float(station), theta_peak, positive_hold, negative_hold)
        heading = route.theta_at(float(station), theta_peak, positive_hold, negative_hold)
        tangent = (math.cos(heading), math.sin(heading), 0.0)
        normal = (-math.sin(heading), math.cos(heading), 0.0)
        return (x_value, y_value), tangent, normal

    def measurement_z(station):
        if station <= route.STAIR_PLAN_RUN_CM:
            return -300.0 - 495.0 * float(station) / route.STAIR_PLAN_RUN_CM
        return -795.0

    def stair_floor_z(station):
        if station >= route.STAIR_PLAN_RUN_CM - 1.0e-6:
            return -795.0
        index = min(route.STAIR_COUNT - 1, int(math.floor(max(0.0, station) / route.STAIR_RUN_PER_STEP_CM)))
        return -300.0 - index * route.STAIR_RISE_PER_STEP_CM

    stair = MeshBuilder()
    boundaries = []
    for index in range(route.STAIR_COUNT + 1):
        station = index * route.STAIR_RUN_PER_STEP_CM
        xy, tangent, normal = plan_point(station)
        boundaries.append({"station": station, "xy": xy, "tangent": tangent, "normal": normal})

    for index in range(route.STAIR_COUNT):
        start = boundaries[index]
        end = boundaries[index + 1]
        top_z = -300.0 - index * route.STAIR_RISE_PER_STEP_CM
        next_z = -300.0 - (index + 1) * route.STAIR_RISE_PER_STEP_CM
        ls = (start["xy"][0] + start["normal"][0] * STAIR_HALF_WIDTH_CM,
              start["xy"][1] + start["normal"][1] * STAIR_HALF_WIDTH_CM, top_z)
        rs = (start["xy"][0] - start["normal"][0] * STAIR_HALF_WIDTH_CM,
              start["xy"][1] - start["normal"][1] * STAIR_HALF_WIDTH_CM, top_z)
        le = (end["xy"][0] + end["normal"][0] * STAIR_HALF_WIDTH_CM,
              end["xy"][1] + end["normal"][1] * STAIR_HALF_WIDTH_CM, top_z)
        re = (end["xy"][0] - end["normal"][0] * STAIR_HALF_WIDTH_CM,
              end["xy"][1] - end["normal"][1] * STAIR_HALF_WIDTH_CM, top_z)
        lsb = (ls[0], ls[1], RETAINING_BASE_Z_CM)
        rsb = (rs[0], rs[1], RETAINING_BASE_Z_CM)
        leb = (le[0], le[1], RETAINING_BASE_Z_CM)
        reb = (re[0], re[1], RETAINING_BASE_Z_CM)
        # Top normal +Z; side normals point away from the finished 220 cm tread.
        stair.quad(ls, rs, re, le)
        stair.quad(ls, le, leb, lsb)
        stair.quad(re, rs, rsb, reb)
        stair.quad(lsb, leb, reb, rsb)
        # Every visible riser faces uphill, toward the portal; the last one meets
        # the exact -795 cm forest floor with no hidden ramp.
        left_low = (le[0], le[1], next_z)
        right_low = (re[0], re[1], next_z)
        stair.quad(re, le, left_low, right_low)
    first = boundaries[0]
    last = boundaries[-1]
    left_first = (first["xy"][0] + first["normal"][0] * STAIR_HALF_WIDTH_CM,
                  first["xy"][1] + first["normal"][1] * STAIR_HALF_WIDTH_CM, -300.0)
    right_first = (first["xy"][0] - first["normal"][0] * STAIR_HALF_WIDTH_CM,
                   first["xy"][1] - first["normal"][1] * STAIR_HALF_WIDTH_CM, -300.0)
    stair.quad(right_first, left_first,
               (left_first[0], left_first[1], RETAINING_BASE_Z_CM),
               (right_first[0], right_first[1], RETAINING_BASE_Z_CM))
    left_last = (last["xy"][0] + last["normal"][0] * STAIR_HALF_WIDTH_CM,
                 last["xy"][1] + last["normal"][1] * STAIR_HALF_WIDTH_CM, -795.0)
    right_last = (last["xy"][0] - last["normal"][0] * STAIR_HALF_WIDTH_CM,
                  last["xy"][1] - last["normal"][1] * STAIR_HALF_WIDTH_CM, -795.0)
    stair.quad(left_last, right_last,
               (right_last[0], right_last[1], RETAINING_BASE_Z_CM),
               (left_last[0], left_last[1], RETAINING_BASE_Z_CM))

    rails = MeshBuilder()
    post_stations = []
    cursor = 0.0
    while cursor < route.STAIR_PLAN_RUN_CM - 1.0e-6:
        post_stations.append(cursor)
        cursor += RAIL_POST_SPACING_PLAN_CM
    post_stations.append(route.STAIR_PLAN_RUN_CM)
    sides = (-1.0, 1.0)
    post_rows = {}
    for side in sides:
        rows = []
        for station in post_stations:
            xy, tangent, normal = plan_point(station)
            floor_z = stair_floor_z(station)
            location = (xy[0] + normal[0] * RAIL_LATERAL_CM * side,
                        xy[1] + normal[1] * RAIL_LATERAL_CM * side,
                        floor_z + RAIL_HEIGHT_CM * 0.5)
            rails.box(location, tangent, normal, (0.0, 0.0, 1.0),
                      RAIL_POST_SIZE_CM, RAIL_POST_SIZE_CM, RAIL_HEIGHT_CM)
            rows.append({"station": station, "xy": xy, "normal": normal, "floor_z": floor_z})
        post_rows[side] = rows

    for side in sides:
        rows = post_rows[side]
        for first_row, second_row in zip(rows, rows[1:]):
            for relative_height in RAIL_LEVELS_CM:
                p0 = (first_row["xy"][0] + first_row["normal"][0] * RAIL_LATERAL_CM * side,
                      first_row["xy"][1] + first_row["normal"][1] * RAIL_LATERAL_CM * side,
                      first_row["floor_z"] + relative_height)
                p1 = (second_row["xy"][0] + second_row["normal"][0] * RAIL_LATERAL_CM * side,
                      second_row["xy"][1] + second_row["normal"][1] * RAIL_LATERAL_CM * side,
                      second_row["floor_z"] + relative_height)
                axis_x = unit(sub(p1, p0))
                horizontal_normal = unit((-axis_x[1], axis_x[0], 0.0))
                axis_z = unit(cross(axis_x, horizontal_normal))
                rails.box(mul(add(p0, p1), 0.5), axis_x, horizontal_normal, axis_z,
                          length(sub(p1, p0)) + RAIL_POST_SIZE_CM,
                          RAIL_BEAM_SIZE_CM, RAIL_BEAM_SIZE_CM)

    route_points = []
    count = int(round(route.PLAN_ARC_LENGTH_CM / ROUTE_POLYLINE_SPACING_PLAN_CM))
    for index in range(count + 1):
        station = min(route.PLAN_ARC_LENGTH_CM, index * ROUTE_POLYLINE_SPACING_PLAN_CM)
        xy, _tangent, _normal = plan_point(station)
        route_points.append([xy[0], xy[1], measurement_z(station)])
    if abs(route_points[-1][0] - route.CLEARING_WEST_EDGE[0]) > 0.02:
        raise RuntimeError("measurement polyline endpoint mismatch")
    polyline_length = sum(length(sub(right, left)) for left, right in zip(route_points, route_points[1:]))
    if abs(polyline_length - route.TARGET_WALK_LENGTH_CM) > 0.25:
        raise RuntimeError("measurement polyline approximation exceeds 0.25 cm error")

    stair_record = stair.record()
    rail_record = rails.record()
    combined_min = [min(stair_record["bounds_min_cm"][axis], rail_record["bounds_min_cm"][axis]) for axis in range(3)]
    combined_max = [max(stair_record["bounds_max_cm"][axis], rail_record["bounds_max_cm"][axis]) for axis in range(3)]
    corridor = proposal["fixed_invariants"]["approach_corridor"]
    if combined_min[1] < float(corridor["y_min_cm"]) or combined_max[1] > float(corridor["y_max_cm"]):
        raise RuntimeError("stair/rail geometry escaped the sealed 12 m approach corridor")

    result = {
        "status": "OFFLINE_ARRAYS_PASS_PENDING_PRIVATE_UNREAL_BUILD_PIXEL_AND_RUNTIME_PROOF",
        "generated_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "classification": (
            "visible stair, retaining, and rail arrays only; no hidden ramp or collision-only blocker; "
            "all desired-outward quads use the project-proven reversed UE 5.8 GeometryScript/Chaos face convention"
        ),
        "sealed_inputs": {
            "route_generator": {"path": str(ROUTE_GENERATOR).replace("\\", "/"), "sha256": EXPECTED_ROUTE_GENERATOR_SHA256},
            "route_proposal": {"path": str(ROUTE_PROPOSAL).replace("\\", "/"), "sha256": EXPECTED_ROUTE_PROPOSAL_SHA256},
        },
        "fixed_invariants": proposal["fixed_invariants"],
        "measurement_route": {
            "actor_label": "NH_ForestApproach_100ft_Route",
            "point_type": "LINEAR",
            "polyline_points_world_cm": route_points,
            "point_spacing_plan_cm": ROUTE_POLYLINE_SPACING_PLAN_CM,
            "polyline_length_cm": polyline_length,
            "target_length_cm": route.TARGET_WALK_LENGTH_CM,
            "length_error_cm": abs(polyline_length - route.TARGET_WALK_LENGTH_CM),
            "start_world_cm": route_points[0],
            "end_world_cm": route_points[-1],
        },
        "stair": {
            "actor_label": "CL_ForestApproach_StairRetaining_v019",
            "tread_count": route.STAIR_COUNT,
            "tread_run_cm": route.STAIR_RUN_PER_STEP_CM,
            "riser_cm": route.STAIR_RISE_PER_STEP_CM,
            "finished_width_cm": 2.0 * STAIR_HALF_WIDTH_CM,
            "retaining_base_z_cm": RETAINING_BASE_Z_CM,
            "no_hidden_ramp": True,
            "mesh": stair_record,
        },
        "rails": {
            "actor_label": "CL_ForestApproach_Rails_v019",
            "two_sided": True,
            "post_count_per_side": len(post_stations),
            "post_stations_plan_cm": post_stations,
            "post_height_cm": RAIL_HEIGHT_CM,
            "rail_levels_above_floor_cm": list(RAIL_LEVELS_CM),
            "mesh": rail_record,
        },
        "bounds_guard": {
            "combined_min_cm": combined_min,
            "combined_max_cm": combined_max,
            "sealed_corridor_y_min_cm": corridor["y_min_cm"],
            "sealed_corridor_y_max_cm": corridor["y_max_cm"],
            "inside_corridor": True,
        },
        "implementation_limits": [
            "new private candidate map only; source map/package remains unchanged",
            "no foliage, proxy, terrain, portal, clearing-boundary, marker, or hero-oak transform changes",
            "existing tunnel concrete material must be verified from the actual source actor before any candidate save",
            "candidate remains pending actual pixel proof, PIE first-hit collision/sweeps, and possessed traversal",
            "outdoor stair art remains subject to Lee's approval",
        ],
    }
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(OUTPUT).replace("\\", "/"),
        "sha256": sha256(OUTPUT),
        "stair_vertices": stair_record["vertex_count"],
        "stair_triangles": stair_record["triangle_count"],
        "rail_vertices": rail_record["vertex_count"],
        "rail_triangles": rail_record["triangle_count"],
        "measurement_polyline_length_cm": polyline_length,
        "measurement_polyline_error_cm": abs(polyline_length - route.TARGET_WALK_LENGTH_CM),
    }, indent=2))


if __name__ == "__main__":
    main()
