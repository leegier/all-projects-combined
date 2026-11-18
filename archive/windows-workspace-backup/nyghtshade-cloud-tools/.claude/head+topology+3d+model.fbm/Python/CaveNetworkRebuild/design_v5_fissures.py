"""Offline V5 fissure reservations; does not import Unreal or mutate a level.

Actual creeper/crawler definitions are absent. These are adjustable architectural
reservations, never a claim of creature navigation or animation compatibility.
"""
from pathlib import Path
import json
import math

ROOT = Path(__file__).parents[3]
SAVED = ROOT / 'Saved' / 'CaveNetworkRebuild'
SOURCE = SAVED / 'CONNECTED_ROUTE_GEOMETRY_V4.json'


def add(a, b):
    return [a[i] + b[i] for i in range(3)]


def mul(a, s):
    return [x * s for x in a]


def sub(a, b):
    return [a[i] - b[i] for i in range(3)]


def unit_xy(v):
    n = math.hypot(v[0], v[1])
    return [v[0] / n, v[1] / n, 0]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def distance_to_segment(p, a, b):
    delta = sub(b, a)
    t = max(0, min(1, dot(sub(p, a), delta) / dot(delta, delta)))
    return math.dist(p, add(a, mul(delta, t)))


def main():
    data = json.loads(SOURCE.read_text())
    segments = data['segments']
    nodes = data['nodes']
    links = {n['id']: [] for n in nodes}
    for edge in segments:
        for ni in edge['ends']:
            links[ni].append(edge)
    heroes = {segments[i]['ends'][1] for i in data['hero_segment_ids']}
    giants = {segments[g['segment_id']]['ends'][1] for g in data['giant_caverns']}
    pairs = {0: [(7, 9), (25, 27)], 1: [(0, 2), (13, 15), (21, 22)],
             2: [(0, 2), (13, 15)], 3: [(1, 3), (9, 11), (21, 23)],
             4: [(15, 17), (29, 31)]}
    visual_types = ['low fractured bedding gap', 'narrow vertical split',
                    'diagonal seam behind projecting slab', 'excavation-exposed fracture',
                    'partly screened timber-side gap', 'rubble-margin opening']
    routes = []
    errors = []
    profile_order = ['narrow_bend', 'vertical_split', 'low_gap', 'narrow_bend',
                     'narrow_bend', 'vertical_split', 'low_gap', 'narrow_bend',
                     'narrow_bend', 'vertical_split', 'low_gap', 'narrow_bend']
    profiles = {
        'narrow_bend': dict(width=60, height=110, points=[[-30, 0], [30, 0], [30, 65],
            [23, 90], [8, 110], [-14, 104], [-29, 79]],
            intent='An asymmetric fractured arch receding around a geological bend'),
        'vertical_split': dict(width=46, height=165, points=[[-18, 0], [19, 0], [23, 49],
            [17, 114], [10, 159], [-4, 165], [-18, 119], [-23, 48]],
            intent='A tall narrow split with leaning shoulders and an irregular crown'),
        'low_gap': dict(width=64, height=72, points=[[-28, 0], [27, 0], [32, 19],
            [25, 52], [9, 72], [-15, 65], [-32, 31]],
            intent='A compressed bedding-plane gap under a sloping fallen slab'),
    }

    def shaped_profile(name, variation):
        profile = profiles[name]
        lean = [-4, 3, 5, -3][variation % 4]
        coords = [[x + lean * (z / profile['height'] - .5), z] for x, z in profile['points']]
        lo = min(q[0] for q in coords)
        hi = max(q[0] for q in coords)
        coords = [[(x - (hi + lo) * .5) * profile['width'] / (hi - lo), z] for x, z in coords]
        if variation % 2:
            coords = [[-x, z] for x, z in reversed(coords)]
            # Put the flat floor edge first, preserving counterclockwise ordering.
            first = next(i for i, q in enumerate(coords) if q[1] == 0 and q[0] < 0)
            coords = coords[first:] + coords[:first]
        return dict(name=name, maximum_width_cm=profile['width'], maximum_height_cm=profile['height'],
                    inner_polygon_yz_cm=coords, lean_cm=lean, floor_edge_index=0,
                    outer_backing_thickness_cm=35, visual_intent=profile['intent'])

    def room_exists(ni):
        ds = []
        for e in links[ni]:
            other = e['ends'][1] if e['ends'][0] == ni else e['ends'][0]
            delta = sub(nodes[other]['position'], nodes[ni]['position'])
            ds.append(mul(delta, 1 / math.sqrt(dot(delta, delta))))
        return len(ds) != 2 or dot(ds[0], ds[1]) > -.985

    def aperture(ni, level, variation, profile):
        p = nodes[ni]['position']
        outward = unit_xy(sub(p, data['districts'][level]['center']))
        directions = []
        limits = []
        for e in links[ni]:
            other = e['ends'][1] if e['ends'][0] == ni else e['ends'][0]
            directions.append(unit_xy(sub(nodes[other]['position'], p)))
            limits.append(math.asin(min(.98, (e['width_cm'] * .5 + 30) / 620)) + math.pi / 64)
        # Choose an outward-facing sector comfortably clear of existing gateways.
        choices = []
        base = math.atan2(outward[1], outward[0])
        for offset in range(-28, 29, 2):
            ang = base + math.radians(offset)
            u = [math.cos(ang), math.sin(ang), 0]
            margin = min(math.acos(max(-1, min(1, dot(u, d)))) - limit
                         for d, limit in zip(directions, limits))
            if margin > math.radians(13):
                choices.append((abs(offset - [-12, 8, 16, -6][variation % 4]), -margin, u))
        if not choices:
            raise ValueError(f'No safe wall aperture at node {ni}')
        direction = min(choices, key=lambda x: x[:2])[2]
        floor_offset = [0, 8, 14, 4][variation % 4]
        basepos = add(p, [0, 0, floor_offset])
        width, height = profile['maximum_width_cm'], profile['maximum_height_cm']
        return dict(node_id=ni, room_actor_label=f'MineV4_Room_{ni:03d}',
                    floor_actor_label=f'MineV4_Floor_{ni:03d}',
                    node_position=p, outward_direction=direction,
                    district_radial_direction=outward,
                    profile_type=profile['name'], clear_width_cm=width, clear_height_cm=height,
                    inner_polygon_yz_cm=profile['inner_polygon_yz_cm'],
                    floor_offset_cm=floor_offset,
                    center=add(add(basepos, mul(direction, 710)), [0, 0, height * .5]),
                    inside_route_point=add(basepos, mul(direction, 535)),
                    outside_route_point=add(basepos, mul(direction, 995)),
                    cutter=dict(local_dimensions_cm=[520, width, height],
                                world_location=add(add(basepos, mul(direction, 730)), [0, 0, height * .5]),
                                yaw_degrees=math.degrees(math.atan2(direction[1], direction[0])),
                                pitch_degrees=0, roll_degrees=0),
                    visual_intent=visual_types[variation % len(visual_types)],
                    geological_frame_roll_degrees=[0, -11, 8, -5, 13, 4][variation % 6],
                    opening_geometry_roll_degrees=0,
                    note='Bounds include the irregular arch; width varies with height. Bore stays narrower than the70cm player capsule.')

    for level, pairlist in pairs.items():
        for ia, ib in pairlist:
            rid = len(routes)
            a = segments[level * 36 + ia]['ends'][0]
            b = segments[level * 36 + ib]['ends'][0]
            assert room_exists(a) and room_exists(b), (a, b)
            assert a not in heroes | giants and b not in heroes | giants
            assert len(links[a]) == 2 and len(links[b]) == 2, 'Keep away from portals/ramp junctions'
            profile = shaped_profile(profile_order[rid], rid)
            mouths = [aperture(a, level, rid * 2, profile), aperture(b, level, rid * 2 + 1, profile)]
            offset = [1400, 1650, 1500, 1800][rid % 4]
            pts = [mouths[0]['inside_route_point'], mouths[0]['outside_route_point']]
            # Follow the outside of the existing district bend, at a generous
            # offset behind the rock. No arbitrary cross-district shortcuts.
            for idx in range(ia, ib + 1):
                ni = segments[level * 36 + idx]['ends'][0]
                p = nodes[ni]['position']
                radial = unit_xy(sub(p, data['districts'][level]['center']))
                blend = (idx - ia) / max(1, ib - ia)
                zoff = mouths[0]['floor_offset_cm'] * (1 - blend) + mouths[1]['floor_offset_cm'] * blend
                pts.append(add(add(p, mul(radial, offset)), [0, 0, zoff]))
            pts.extend([mouths[1]['outside_route_point'], mouths[1]['inside_route_point']])
            length = sum(math.dist(x, y) for x, y in zip(pts, pts[1:]))
            # Check centerline samples against every existing main tunnel. The
            # first/last 11m around the two owned rooms is the intended interface.
            min_margin = float('inf')
            for p0, p1 in zip(pts, pts[1:]):
                n = max(1, math.ceil(math.dist(p0, p1) / 70))
                for k in range(n + 1):
                    p = add(p0, mul(sub(p1, p0), k / n))
                    if min(math.dist(p, nodes[a]['position']), math.dist(p, nodes[b]['position'])) < 1100:
                        continue
                    for e in segments:
                        # 100cm reserves even the widest67cm outer-half-profile
                        # and the modest extra width of the smoothed tube miters.
                        margin = distance_to_segment(p, e['a'], e['b']) - e['width_cm'] * .5 - 100
                        min_margin = min(min_margin, margin)
            if min_margin < 100:
                errors.append(dict(route=rid, main_route_clearance_cm=min_margin))
            grades = [math.degrees(math.atan2(abs(y[2] - x[2]), math.dist(x[:2], y[:2])))
                      for x, y in zip(pts, pts[1:])]
            routes.append(dict(id=f'FIS_{rid:02d}', district_index=level,
                               district=data['districts'][level]['name'],
                               encounter_group=f'V5_{level}_{ia}_{ib}',
                               status='geometry_reserved_unbound',
                               geometry_built=False, implemented_ai_traversal=False,
                               runtime_creature_tested=False, runtime_player_exclusion_tested=False,
                               applicable_creature_types=[], missing='Actual creeper/crawler definitions absent',
                               bidirectional_design=True, cross_district=False, underwater=False,
                               requires_climbing=False, elevation_change_cm=abs(pts[-1][2] - pts[0][2]),
                               main_route_segment_ids=list(range(level * 36 + ia, level * 36 + ib)),
                               main_route_endpoint_nodes=[a, b], mouths=mouths,
                               route_floor_points=pts, length_cm=length,
                               profile=profile,
                               nominal_clear_width_cm=profile['maximum_width_cm'],
                               nominal_clear_height_cm=profile['maximum_height_cm'],
                               shell_thickness_cm=35, proposed_minimum_turn_radius_cm=120,
                               max_grade_degrees=max(grades),
                               centerline_sample_clearance_from_main_tunnel_envelope_cm=min_margin,
                               introduction_role=['notice_only', 'reserved_audio_warning', 'reserved_witnessed_traversal'][rid % 3],
                               audio_event=None, ai_route_binding=None, save_state_binding=None,
                               acceptance='Do not label this route functioning until geometry and actual creature traversal pass.',
                               visual_intent='Rock surfaces continue through doglegs; no flat black endcard. Keep concealed and dry.'))

    minimum_room_clearance = float('inf')
    room_clearance_at = None
    giant_by_node = {segments[g['segment_id']]['ends'][1]: g for g in data['giant_caverns']}
    for route in routes:
        for a, b in zip(route['route_floor_points'], route['route_floor_points'][1:]):
            samples = max(1, math.ceil(math.dist(a, b) / 70))
            for k in range(samples + 1):
                p = add(a, mul(sub(b, a), k / samples))
                for n in nodes:
                    ni = n['id']
                    if ni in route['main_route_endpoint_nodes'] or abs(p[2] - n['position'][2]) > 1200:
                        continue
                    radius = giant_by_node[ni]['radius'] if ni in giant_by_node else 1500 if ni in heroes else 620
                    clearance = math.dist(p[:2], n['position'][:2]) - radius - 180 - 100
                    if clearance < minimum_room_clearance:
                        minimum_room_clearance = clearance
                        room_clearance_at = [route['id'], ni]
    if minimum_room_clearance < 100:
        errors.append(dict(room_envelope_clearance_cm=minimum_room_clearance, at=room_clearance_at))
    result = dict(version=5, units='cm', source_geometry=str(SOURCE),
                  source_route_length_km=data['length_km'],
                  source_district_datums_cm=[d['center'][2] for d in data['districts']],
                  status='geometry_reserved_unbound', notes=[
                      'Current V4 datum retained; pasted older plan was 140m lower.',
                      'Same-district disconnected encounter groups avoid progression shortcuts.',
                      'Foundry entrance node18 and the player staging region are excluded.',
                      'Sump, all lake geometry, giant cavern walls, and ramp portals are excluded.',
                      'Numerical clearance is a planning check, not Unreal collision validation.',
                      'Player diameter70cm is confirmed; creature sizes are not known.'],
                  player_collision=dict(radius_cm=35, half_height_cm=90, can_crouch=False,
                                        crouched_half_height_property_cm=40),
                  route_count=len(routes), mouth_count=len(routes) * 2,
                  profile_distribution={name: profile_order.count(name) for name in profiles},
                  total_length_cm=sum(r['length_cm'] for r in routes),
                  planner_clearance_failures=errors, routes=routes,
                  nonendpoint_room_envelope_numerical_check=dict(
                      minimum_clearance_cm=minimum_room_clearance, at=room_clearance_at,
                      actual_collision_tested=False))
    output = SAVED / 'FISSURE_NETWORK_V5.json'
    output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({'output': str(output), 'route_count':len(routes),
                      'mouth_count':len(routes)*2, 'total_length_m':result['total_length_cm']/100,
                      'clearance_failures':errors,
                      'node_pairs':[r['main_route_endpoint_nodes'] for r in routes]}))
    if errors:
        raise SystemExit('Resolve route clearance failures before constructing')


if __name__ == '__main__':
    main()
