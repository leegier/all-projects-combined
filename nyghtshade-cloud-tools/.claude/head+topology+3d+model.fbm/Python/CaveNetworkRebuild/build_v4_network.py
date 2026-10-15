"""V4 base network build (structural floors + imported-asset HISM art + lights).

Repair notes
------------
The previous run failed with `AttributeError: 'NoneType' object has no attribute
'modify'`. Root cause was NOT a bad component lookup: the editor had **no level
(world) loaded**, so `EditorActorSubsystem.spawn_actor_from_class()` returned
`None` and the subsequent `actor.modify()` blew up. This version:

* ensures the target map is loaded before building (so spawns cannot return None),
* guards every spawn and component lookup with an explicit error,
* rebuilds only owned base-network geometry idempotently (all V2/V3/V4 drift
  floors are cleared and re-made; a pre-existing valid floor actor whose label
  matches a floor group is reused in place), and
* verifies the result and saves the level before writing V4_BASE_COMPLETE.json.

Room shells (`MineRoomShell_*`) and demo assemblies (`MineDemo2_*`) are owned by
the parent pipeline and are deliberately NOT touched here.
"""

import unreal
import os
import json
import math
import random

TARGET_MAP = '/Game/Untitled'

# Owned generated geometry replaced by this base pass.
# NOTE: 'MineRoomShell_' and 'MineDemo2_' are intentionally excluded - the parent
# pipeline owns room shells and demo assemblies.
PREFIXES = (
    'MineBeauty2_', 'MineBeauty4_',
    'MineCavernArt_', 'MineCavernSeal_',
    'MineNaturalFloor_', 'MineRawDetail_',
    'MineCinematicDetail_', 'MineCinematic',
    'Mine_CaveIn_', 'Mine_RampBeacon_', 'Mine_SumpApproachRoom',
    'Mine_Drift_Floors_',
)

HOST_PREFIX = 'MineBeauty4_'
LIGHT_PREFIX = 'MineBeauty4_Light_'


def _ensure_world():
    ues = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
    world = ues.get_editor_world()
    cur = world.get_path_name().split('.')[0] if world else ''
    if cur != TARGET_MAP:
        world = unreal.EditorLoadingAndSavingUtils.load_map(TARGET_MAP)
        if world is None:
            raise RuntimeError('Could not load target map %s' % TARGET_MAP)
    return world


def build_v4():
    sd = os.path.join(unreal.Paths.project_saved_dir(), 'CaveNetworkRebuild')
    geom_path = os.path.join(sd, 'CONNECTED_ROUTE_GEOMETRY_V4.json')
    marker_path = os.path.join(sd, 'V4_BASE_COMPLETE.json')
    result_path = os.path.join(sd, 'BEAUTY_BUILD_RESULT_V4.json')

    if os.path.exists(marker_path):
        # Aura's preview pass rolls the scene back but leaves this on-disk marker,
        # so a marker alone must never skip the real build - verify live geometry.
        try:
            with open(geom_path) as _gfh:
                _gdata = json.load(_gfh)
            _glabels = set(s['source'] for s in _gdata['segments'])
        except Exception:
            _glabels = set()
        _live = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
        _lf = [a for a in _live if isinstance(a, unreal.DynamicMeshActor) and a.get_actor_label() in _glabels]
        _lh = [a for a in _live if a.get_actor_label().startswith(HOST_PREFIX) and not a.get_actor_label().startswith(LIGHT_PREFIX)]
        _ll = [a for a in _live if a.get_actor_label().startswith(LIGHT_PREFIX)]
        if _lf and _lh and _ll:
            print('V4 base already built and present in level; preserved')
            return
        print('WARNING: stale V4 marker with no live base geometry (preview rollback); rebuilding')

    if not os.path.exists(geom_path):
        raise RuntimeError('Missing route geometry %s' % geom_path)

    with open(geom_path) as fh:
        data = json.load(fh)

    if not (data['connected'] and not data['close_crossings'] and data['max_grade_degrees'] < 9):
        raise RuntimeError('Route geometry failed connectivity/grade validation')

    _ensure_world()

    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    sds = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    lib = unreal.SubobjectDataBlueprintFunctionLibrary
    rng = random.Random(92726)
    V = unreal.Vector

    def spawn(cls, loc):
        a = eas.spawn_actor_from_class(cls, loc)
        if a is None:
            raise RuntimeError('spawn_actor_from_class returned None for %s (no world loaded?)' % cls)
        return a

    def vec(p):
        return V(float(p[0]), float(p[1]), float(p[2]))

    def norm(v):
        l = math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
        return v / l

    # ---- Reconcile measured endpoints at the same 1m tolerance used by the verified repair.
    nodes = []
    edges = []
    for s in data['segments']:
        ids = []
        for p in [s['a'], s['b']]:
            found = next((i for i, n in enumerate(nodes) if math.dist(p, n['p']) < 100), None)
            if found is None:
                found = len(nodes)
                nodes.append({'p': list(p), 'links': []})
            ids.append(found)
        edges.append(dict(s, ends=ids))
    for i, s in enumerate(edges):
        for n in s['ends']:
            nodes[n]['links'].append(i)
    hero_ids = [edges[i]['ends'][1] for i in data['hero_segment_ids']]
    giants = {edges[g['segment_id']]['ends'][1]: g for g in data['giant_caverns']}
    for ni, n in enumerate(nodes):
        dirs = []
        for ei in n['links']:
            s = edges[ei]
            other = s['ends'][1] if s['ends'][0] == ni else s['ends'][0]
            dirs.append(norm(vec(nodes[other]['p']) - vec(n['p'])))
        n['dirs'] = dirs
        n['room'] = len(dirs) != 2 or sum(dirs[0].to_tuple()[k] * dirs[1].to_tuple()[k] for k in range(3)) > -0.985
        n['radius'] = 1500 if ni in hero_ids else 620
        n['height'] = 800 if ni in hero_ids else 350
        if ni in hero_ids:
            n['room'] = True
        if ni in giants:
            n.update(room=True, radius=giants[ni]['radius'], height=giants[ni]['height'])
        if ni == edges[220]['ends'][1]:
            n.update(room=True, radius=1700, height=400)

    paths = {
        'old': '/Game/Scene_OldMine/Assets/Custom/Ind_Min_Cave/SM_Ind_Min_Cave',
        'natural': '/Game/RockEnv_Pack/Meshes/Tunnel_Caves/SM_Tunnel_Cave_1',
        'deep': '/Game/RockEnv_Pack/Meshes/Tunnel_Caves/SM_Tunnel_Cave_10',
        'rock': '/Game/RockEnv_Pack/Meshes/Rocks/SM_Rock_1',
        'slab': '/Game/RockEnv_Pack/Meshes/Rocks/SM_Rock_10',
        'pebble': '/Game/RockEnv_Pack/Meshes/Small_Rocks/SM_Small_Rock_1',
        'ground': '/Game/Scene_OldMine/Assets/Custom/Ind_Min_Ground/SM_Ind_Min_Ground',
        'beam': '/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Beam_Square_Wood_Worn_03/SM_Ind_Min_Beam_Square_Wood_Worn_03',
        'track': '/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Rail_Tracks_Wood_Modular_01/SM_Ind_Min_Rail_Tracks_Wood_Modular_01_A',
        'lamp': '/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_War_Light_Bulkhead_Metal_Caged_01/SM_Ind_War_Light_Bulkhead_Metal_Caged_01',
        'cart': '/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Cart_Metal_Old_01/SM_Ind_Min_Cart_Metal_Old_01',
    }

    meshes = {k: unreal.load_asset(p) for k, p in paths.items()}
    missing = [k for k, m in meshes.items() if m is None]
    if missing:
        raise RuntimeError('Missing required imported mesh: %s' % missing)

    groups = {}
    light_specs = []

    def add(chunk, key, p, rot=None, scale=None):
        groups.setdefault((chunk, key), []).append(
            unreal.Transform(location=p,
                             rotation=rot or unreal.Rotator(pitch=0, yaw=0, roll=0),
                             scale=scale or V(1, 1, 1)))

    for i, s in enumerate(edges):
        na, nb = [nodes[n] for n in s['ends']]
        a = vec(na['p']); b = vec(nb['p']); d = b - a
        length = math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z); f = d / length
        right = norm(V(-f.y, f.x, 0))
        up = norm(V(f.y * right.z - f.z * right.y, f.z * right.x - f.x * right.z, f.x * right.y - f.y * right.x))
        rot = unreal.MathLibrary.make_rot_from_yz(f, up)
        yaw = math.degrees(math.atan2(f.y, f.x)); pitch = math.degrees(math.asin(f.z))
        chunk = s['source']; width = s['width_cm']; sump = chunk.startswith('Sump')
        key = 'old' if s['level'] < 2 or sump or s['kind'] == 'entry' else ('natural' if s['level'] < 4 else 'deep')
        mb = meshes[key].get_bounding_box(); sz = mb.max - mb.min
        start = min(na['radius'] * .92, length * .45) if na['room'] else 0
        finish = length - (min(nb['radius'] * .92, length * .8 if s['kind'] == 'cavern_access' else length * .45) if nb['room'] else 0)
        target_height = 300 if sump else (350 if key == 'old' else 500)
        sx = (width + 65) / sz.x; sy = 1; szscale = target_height / sz.z
        count = max(1, math.ceil((finish - start) / (sz.y * .94)))
        step = (finish - start) / count; sy = (step + 65) / sz.y
        for j in range(count):
            dist = start + (j + .5) * step
            p = a + f * dist - f * ((mb.min.y + mb.max.y) * .5 * sy)
            # native floor datum ~ Z=0; lower to avoid z-fighting
            p = p - up * (5 if key == 'old' else 145)
            add(chunk, key, p, rot, V(sx, sy, szscale))
        if key != 'old':
            count_ground = max(1, math.ceil(length / 500))
            for g in range(count_ground):
                add(chunk, 'ground', a + f * ((g + .5) * length / count_ground) + up * 2,
                    unreal.Rotator(pitch=pitch, yaw=yaw, roll=0),
                    V((length / count_ground + 15) / 100, width / 100, 1))
        # Timbers and track on upper developed mine levels, leaving full pedestrian clearance.
        if s['level'] < 2 and s['kind'] != 'ramp':
            for dist in range(int(start + 350), int(finish - 150), 800):
                p = a + f * dist
                for side in [-1, 1]:
                    add(chunk, 'beam', p + right * (side * (width * .5 - 75)) + up * 155,
                        unreal.Rotator(pitch=90, yaw=yaw, roll=0), V(2.55, 2, 2))
                add(chunk, 'beam', p + up * 310,
                    unreal.Rotator(pitch=0, yaw=yaw + 90, roll=0), V((width - 90) / 123, 2.4, 2.4))
            for dist in range(int(start + 80), int(finish - 260), 250):
                add(chunk, 'track', a + f * dist + up * 2,
                    unreal.Rotator(pitch=pitch, yaw=yaw, roll=0), V(1, 1, 0.48))
        for dist in range(int(start + 450), int(finish - 150), 1700):
            p = a + f * dist + right * (width * .5 - 75) + up * 230
            add(chunk, 'lamp', p, unreal.Rotator(pitch=0, yaw=yaw + 90, roll=0), V(1.6, 1.6, 1.6))
            light_specs.append((p - right * 90, s['level'] < 2, i))
        for j in range(max(1, int(length / 700))):
            dist = rng.uniform(start, finish); side = rng.choice([-1, 1])
            p = a + f * dist + right * (side * rng.uniform(width * .35, width * .46)) + up * 6
            add(chunk, 'pebble', p,
                unreal.Rotator(pitch=0, yaw=rng.uniform(-180, 180), roll=0),
                V(rng.uniform(3, 8), rng.uniform(3, 8), rng.uniform(2, 5)))

    floor_groups = {}
    for segment in edges:
        floor_groups.setdefault(segment['source'], []).append(segment)

    deleted = 0
    floor_actor_count = 0
    total = 0
    hosts = []
    light_count = 0

    with unreal.ScopedEditorTransaction('Build imported mine cave network art pass'):
        # Only owned generated geometry is replaced. Source demo worlds/assets remain intact.
        # Room shells (MineRoomShell_) and demo assemblies (MineDemo2_) are parent-owned.
        for old in list(eas.get_all_level_actors()):
            if old.get_actor_label().startswith(PREFIXES):
                old.modify()
                eas.destroy_actor(old)
                deleted += 1

        # Move the proven swimming volume and water surface as one complete system (once).
        shift = vec(data['sump_shift'])
        for old in eas.get_all_level_actors():
            if (old.get_actor_label() in ('Sump_Walls', 'Sump_WaterVolume', 'Sump_WaterSurface', 'Mine_Sump_UnderwaterLook')
                    and 'V4Relocated' not in [str(t) for t in old.tags]):
                old.modify()
                old.set_actor_location(old.get_actor_location() + shift, False, False)
                old.tags = list(old.tags) + [unreal.Name('V4Relocated')]

        # ---- Structural floors: one actor per route source.
        # A pre-existing valid DynamicMeshActor already carrying a floor-group label
        # (e.g. the retained 'Sump_Floors') is reused in place; stale/duplicate actors
        # sharing that label are removed first.
        floors_by_label = {}
        for a in eas.get_all_level_actors():
            floors_by_label.setdefault(a.get_actor_label(), []).append(a)

        for group_label, segments in floor_groups.items():
            actor = None
            for cand in floors_by_label.get(group_label, []):
                if actor is None and cand.get_component_by_class(unreal.DynamicMeshComponent) is not None:
                    actor = cand
                else:
                    eas.destroy_actor(cand)
            if actor is None:
                actor = spawn(unreal.DynamicMeshActor, V(0, 0, 0))
            actor.modify()
            actor.set_actor_label(group_label)
            actor.set_folder_path('Mine_Rebuild/V4StructuralFloors')
            offset = actor.get_actor_location()
            component = actor.get_component_by_class(unreal.DynamicMeshComponent)
            if component is None:
                raise RuntimeError('DynamicMeshComponent missing on floor actor %s' % group_label)
            component.modify()
            dm = component.get_dynamic_mesh()
            dm.modify()
            dm.reset()
            for segment in segments:
                pa = vec(segment['a']); pb = vec(segment['b']); delta = pb - pa
                le = math.sqrt(delta.x * delta.x + delta.y * delta.y + delta.z * delta.z)
                yaw = math.degrees(math.atan2(delta.y, delta.x))
                pitch = math.degrees(math.asin(delta.z / le))
                rotation = unreal.Rotator(pitch=pitch, yaw=yaw, roll=0)
                up_vector = unreal.MathLibrary.get_up_vector(rotation)
                center = (pa + pb) * .5 - up_vector * 20 - offset
                unreal.GeometryScript_Primitives.append_box(
                    dm, unreal.GeometryScriptPrimitiveOptions(),
                    unreal.Transform(location=center, rotation=rotation, scale=V(1, 1, 1)),
                    le + 30, segment['width_cm'], 40, 0, 0, 0,
                    unreal.GeometryScriptPrimitiveOriginMode.CENTER)
            component.set_complex_as_simple_collision_enabled(True, True)
            component.set_collision_profile_name('BlockAll')
            component.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS)
            actor.set_actor_enable_collision(True)
            actor.set_actor_hidden_in_game(True)
            actor.set_is_temporarily_hidden_in_editor(True)
            floor_actor_count += 1

        # ---- Imported-asset HISM placements.
        for (chunk, key), transforms in groups.items():
            host = spawn(unreal.Actor, transforms[0].translation)
            host.modify()
            host.set_actor_label(HOST_PREFIX + chunk + '_' + key)
            host.set_folder_path('Mine_Rebuild/ImportedAssets/' + chunk)
            handles = sds.k2_gather_subobject_data_for_instance(host)
            if not handles:
                raise RuntimeError('No subobject handles for host %s' % host.get_actor_label())
            params = unreal.AddNewSubobjectParams()
            params.set_editor_property('parent_handle', handles[0])
            params.set_editor_property('new_class', unreal.HierarchicalInstancedStaticMeshComponent)
            h, reason = sds.add_new_subobject(params)
            comp = lib.get_associated_object(sds.k2_find_subobject_data_from_handle(h))
            if not comp:
                raise RuntimeError('HISM creation failed for %s: %s' % (host.get_actor_label(), str(reason)))
            comp.modify()
            comp.set_static_mesh(meshes[key])
            comp.set_collision_profile_name('BlockAll' if key in ['old', 'natural', 'deep', 'rock', 'ground'] else 'NoCollision')
            comp.set_editor_property('CastShadow', True)
            comp.add_instances(transforms, False, True, False)
            total += comp.get_instance_count()
            hosts.append(host.get_actor_label())

        # ---- Junction shells are built by the dedicated cavern pass; none here.
        junction_rooms = 0

        # ---- Lighting fixtures.
        for j, (p, warm, seg) in enumerate(light_specs):
            a = spawn(unreal.PointLight, p)
            a.modify()
            a.set_actor_label(LIGHT_PREFIX + '%04d' % j)
            a.set_folder_path('Mine_Rebuild/Lighting')
            c = a.get_component_by_class(unreal.PointLightComponent)
            if c is None:
                raise RuntimeError('PointLight %s has no PointLightComponent' % a.get_actor_label())
            c.modify()
            c.set_editor_property('IntensityUnits', unreal.LightUnits.LUMENS)
            c.set_intensity(1100)
            c.set_light_color(unreal.LinearColor(1, .84, .68, 1) if warm else unreal.LinearColor(.62, .76, .85, 1))
            c.set_editor_property('AttenuationRadius', 1250.0)
            c.set_editor_property('CastShadows', j % 4 == 0)
            c.set_editor_property('IndirectLightingIntensity', 0.5)
            light_count += 1

    # ---- Independent post-build verification of what is actually in the level.
    live = eas.get_all_level_actors()
    group_labels = set(floor_groups.keys())
    live_floors = [a for a in live
                   if isinstance(a, unreal.DynamicMeshActor) and a.get_actor_label() in group_labels]
    live_hosts = [a for a in live if a.get_actor_label().startswith(HOST_PREFIX) and not a.get_actor_label().startswith(LIGHT_PREFIX)]
    live_lights = [a for a in live if a.get_actor_label().startswith(LIGHT_PREFIX)]
    floor_label_count = len({a.get_actor_label() for a in live_floors})

    result = {
        'stage': 'V4_separated_layout_imported_asset_art_pass',
        'segments': len(edges),
        'floor_actors': floor_actor_count,
        'floors_in_level': len(live_floors),
        'floor_groups': len(floor_groups),
        'junction_rooms': junction_rooms,
        'large_caverns': len(hero_ids),
        'instances': total,
        'instance_hosts': len(hosts),
        'hosts_in_level': len(live_hosts),
        'lights': light_count,
        'lights_in_level': len(live_lights),
        'deleted_owned_actors': deleted,
        'mesh_paths': paths,
        'visual_and_full_traversal_verified': False,
    }

    checks = {
        'segments_235': len(edges) == 235,
        'floors_complete': len(live_floors) == len(floor_groups) == floor_actor_count,
        'no_floor_label_dupes': floor_label_count == len(live_floors) and floor_label_count == len(floor_groups),
        'instances_built': total > 0 and len(live_hosts) == len(hosts),
        'lights_built': light_count > 0 and len(live_lights) == light_count,
    }
    result['checks'] = checks
    if not all(checks.values()):
        raise RuntimeError('V4 base verification failed: %s' % checks)

    saved = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()
    if not saved:
        raise RuntimeError('V4 base built but level save failed; marker withheld')
    result['level_saved'] = True

    with open(result_path, 'w') as f:
        json.dump(result, f, indent=2)
    with open(marker_path, 'w') as f:
        json.dump(result, f, indent=2)

    print(json.dumps(result))
    print('V4_BASE_COMPLETE written')


build_v4()
