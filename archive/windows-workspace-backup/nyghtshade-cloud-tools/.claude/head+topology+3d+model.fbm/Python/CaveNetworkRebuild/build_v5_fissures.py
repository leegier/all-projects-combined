"""Build reserved V5 fissure architecture. Execute only under root coordination.

Does not create creatures, claim AI traversal, invent abilities, or move a camera.
Room backups are real saved editor-only actors, not external preview markers.
"""
import json
import math
import os
import unreal


def build_v5_fissures():
    V = unreal.Vector
    saved = os.path.join(unreal.Paths.project_saved_dir(), 'CaveNetworkRebuild')
    with open(os.path.join(saved, 'FISSURE_NETWORK_V5.json'), encoding='utf-8') as stream:
        plan = json.load(stream)
    assert not plan['planner_clearance_failures'], 'Planner has unresolved overlaps'
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    assert world.get_path_name().startswith('/Game/Untitled.'), 'Wrong map; no changes made'
    existing = {a.get_actor_label(): a for a in subsystem.get_all_level_actors()}
    required = [m['room_actor_label'] for r in plan['routes'] for m in r['mouths']]
    missing = [label for label in required if label not in existing]
    assert not missing, 'Load required WorldPartition rooms first: ' + str(missing)
    rock = unreal.load_asset('/Game/Generated_Materials/MI_MineV4_SealedRock')
    ground = unreal.load_asset('/Game/Generated_Materials/MI_MineV4_SealedGround')
    frame_mesh = unreal.load_asset('/Game/RockEnv_Pack/Meshes/Rocks/SM_Rock_10')
    assert rock and ground and frame_mesh, 'Required existing material/rock unavailable'
    opts = unreal.GeometryScriptPrimitiveOptions()
    backup_prefix = 'MineV5Fissure_BackupRoom_'
    result = dict(status='geometry_built_creature_unbound', routes=[],
                  implemented_ai_traversal=False, runtime_creature_tested=False,
                  runtime_player_exclusion_tested=False,
                  source_plan='FISSURE_NETWORK_V5.json',
                  note='Geometry and actual surface collision built; awaiting real creature definitions and runtime tests.')

    def spawn_dynamic(label, position):
        actor = subsystem.spawn_actor_from_class(unreal.DynamicMeshActor, position)
        assert actor, label
        actor.modify()
        actor.set_actor_label(label)
        actor.set_folder_path('Mine_Rebuild/V5_Fissures')
        actor.set_editor_property('bIsSpatiallyLoaded', False)
        component = actor.get_component_by_class(unreal.DynamicMeshComponent)
        assert component, label
        component.modify()
        mesh = component.get_dynamic_mesh()
        mesh.modify()
        component.set_material(0, rock)
        component.set_material(1, ground)
        component.set_complex_as_simple_collision_enabled(True, False)
        component.set_collision_profile_name('BlockAll')
        return actor, component, mesh

    # Capture immutable originals before changing any room. Copies are separate
    # DynamicMesh objects, hidden and editor-only, so no duplicate runtime walls.
    backups = {}
    for route in plan['routes']:
        for mouth in route['mouths']:
            ni = mouth['node_id']
            room = existing[mouth['room_actor_label']]
            component = room.get_component_by_class(unreal.DynamicMeshComponent)
            assert component and component.get_dynamic_mesh().get_triangle_count() > 0
            label = backup_prefix + '%03d' % ni
            backup = existing.get(label)
            if not backup:
                backup, bc, bm = spawn_dynamic(label, room.get_actor_location())
                backup.modify()
                backup.set_actor_transform(room.get_actor_transform(), False, False)
                bc.modify()
                bm.modify()
                unreal.GeometryScript_MeshDecomposition.copy_mesh_to_mesh(component.get_dynamic_mesh(), bm)
                backup.set_actor_hidden_in_game(True)
                backup.set_is_temporarily_hidden_in_editor(True)
                backup.set_editor_property('bIsEditorOnlyActor', True)
                backup.set_folder_path('Mine_Rebuild/V5_Fissures_Recovery')
                bc.set_collision_profile_name('NoCollision')
                bc.set_visibility(False, True)
                existing[label] = backup
            backups[ni] = backup

    # Rebuild only this pass's generated tubes and frames. The persisted original
    # room backups remain available across editor restarts and preview undo.
    for actor in subsystem.get_all_level_actors():
        label = actor.get_actor_label()
        if label.startswith('MineV5Fissure_') and not label.startswith(backup_prefix):
            actor.modify()
            subsystem.destroy_actor(actor)

    def tuple_add(a, b):
        return [a[i] + b[i] for i in range(3)]

    def tuple_sub(a, b):
        return [a[i] - b[i] for i in range(3)]

    def tuple_mul(a, s):
        return [v * s for v in a]

    def normalized(a):
        length = math.sqrt(sum(v * v for v in a))
        return [v / length for v in a]

    def rounded_path(points):
        out = [points[0]]
        for i in range(1, len(points) - 1):
            current = points[i]
            to_prev = tuple_sub(points[i - 1], current)
            to_next = tuple_sub(points[i + 1], current)
            trim = min(180, math.dist(points[i - 1], current) * .23,
                       math.dist(points[i + 1], current) * .23)
            start = tuple_add(current, tuple_mul(normalized(to_prev), trim))
            end = tuple_add(current, tuple_mul(normalized(to_next), trim))
            out.append(start)
            for j in range(1, 9):
                t = j / 8
                out.append([((1 - t) ** 2 * start[k] + 2 * (1 - t) * t * current[k]
                             + t * t * end[k]) for k in range(3)])
        out.append(points[-1])
        return out

    def append_surface(mesh, vertices, triangles, material):
        normals = [V(0, 0, 0) for _ in vertices]
        for i, j, k in triangles:
            u = vertices[j] - vertices[i]
            v = vertices[k] - vertices[i]
            n = V(u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z, u.x * v.y - u.y * v.x)
            for q in (i, j, k):
                normals[q] = normals[q] + n
        normals = [n / n.length() if n.length() > .00001 else V(0, 0, 1) for n in normals]
        buffers = unreal.GeometryScriptSimpleMeshBuffers(
            vertices=vertices, normals=normals,
            uv0=[unreal.Vector2D(v.x / 120, v.y / 120) for v in vertices],
            vertex_colors=[unreal.LinearColor(1, 1, 1, 1) for _ in vertices],
            triangles=[unreal.IntVector(t[0], t[2], t[1]) for t in triangles])
        mesh.modify()
        unreal.GeometryScript_MeshEdits.append_buffers_to_mesh(mesh, buffers, material, False)

    def make_tube(route):
        points = rounded_path(route['route_floor_points'])
        origin = V(*points[0])
        actor, component, mesh = spawn_dynamic('MineV5Fissure_' + route['id'] + '_Tube', origin)
        actor.modify()
        actor.set_editor_property('Tags', [unreal.Name('V5FissureGeometry'),
                                          unreal.Name('CreatureUnbound'),
                                          unreal.Name(route['encounter_group'])])
        # Irregular geological polygons replace identical rectangular ducts.
        # Bounds remain below the70cm player diameter; every wall has solid backing.
        profile = route['profile']
        width = profile['maximum_width_cm']
        height = profile['maximum_height_cm']
        inner = profile['inner_polygon_yz_cm']
        count = len(inner)
        outer = [[y * (width + 70) / width,
                  (z - height * .5) * (height + 70) / height + height * .5] for y, z in inner]
        stride = count * 2
        rings = []
        for i, p in enumerate(points):
            if i == 0:
                tangent = normalized(tuple_sub(points[1], p))
            elif i == len(points) - 1:
                tangent = normalized(tuple_sub(p, points[i - 1]))
            else:
                previous = normalized(tuple_sub(p, points[i - 1]))
                following = normalized(tuple_sub(points[i + 1], p))
                tangent = normalized(tuple_add(previous, following))
            side = normalized([-tangent[1], tangent[0], 0])
            factor = 1
            if i > 0:
                prev = normalized(tuple_sub(p, points[i - 1]))
                prevside = normalized([-prev[1], prev[0], 0])
                factor = min(2.0, 1 / max(.5, sum(side[k] * prevside[k] for k in range(3))))
            ring = []
            for lateral, section_z in inner + outer:
                point = tuple_add(p, tuple_add(tuple_mul(side, lateral * factor), [0, 0, section_z]))
                ring.append(V(*point) - origin)
            rings.append(ring)
        vertices = [v for ring in rings for v in ring]
        rock_tris = []
        floor_tris = []

        def quad(target, a, b, c, d):
            target.extend([(a, b, c), (a, c, d)])

        for i in range(len(rings) - 1):
            a = i * stride
            b = (i + 1) * stride
            for j in range(count):
                q = (j + 1) % count
                quad(floor_tris if j == 0 else rock_tris, a + j, b + j, b + q, a + q)
                quad(rock_tris, a + count + q, b + count + q, b + count + j, a + count + j)
        # Only the annular rock thickness is closed at either end. The central
        # Polygonal opening is never capped or covered with a black plane.
        for at in [0, (len(rings) - 1) * stride]:
            for j in range(count):
                q = (j + 1) % count
                quad(rock_tris, at + j, at + q, at + count + q, at + count + j)
        append_surface(mesh, vertices, rock_tris, 0)
        append_surface(mesh, vertices, floor_tris, 1)
        mesh.modify()
        unreal.GeometryScript_UVs.set_mesh_u_vs_from_box_projection(
            mesh, 0, unreal.Transform(scale=V(120, 120, 120)), unreal.GeometryScriptMeshSelection())
        component.modify()
        component.set_complex_as_simple_collision_enabled(True, False)
        component.update_collision(False)
        return actor, mesh, points

    def frame_rock(label, center, direction, right_offset, z_offset, desired_size, roll):
        right = V(-direction[1], direction[0], 0)
        target = V(*center) + right * right_offset + V(0, 0, z_offset)
        bb = frame_mesh.get_bounding_box()
        size = bb.max - bb.min
        mid = (bb.max + bb.min) * .5
        scale = V(desired_size[0] / size.x, desired_size[1] / size.y, desired_size[2] / size.z)
        rotation = unreal.Rotator(pitch=0, yaw=math.degrees(math.atan2(direction[1], direction[0])), roll=roll)
        rotation_scale = unreal.Transform(rotation=rotation, scale=scale)
        transformed_center = unreal.MathLibrary.transform_location(rotation_scale, mid)
        actor = subsystem.spawn_actor_from_class(unreal.StaticMeshActor, target - transformed_center)
        assert actor, label
        actor.modify()
        actor.set_actor_label(label)
        actor.set_folder_path('Mine_Rebuild/V5_Fissures/MouthRock')
        actor.set_actor_rotation(rotation, False)
        actor.set_actor_scale3d(scale)
        actor.set_editor_property('bIsSpatiallyLoaded', False)
        component = actor.get_component_by_class(unreal.StaticMeshComponent)
        component.modify()
        component.set_static_mesh(frame_mesh)
        component.set_collision_profile_name('BlockAll')

    def varied_frame(route, mouth, index):
        p = mouth['node_position']
        u = mouth['outward_direction']
        rim = tuple_add(tuple_add(p, tuple_mul(u, 574)), [0, 0, mouth['floor_offset_cm']])
        stem = 'MineV5Fissure_' + route['id'] + '_Mouth' + str(index)
        width = route['profile']['maximum_width_cm']
        height = route['profile']['maximum_height_cm']
        variation = int(route['id'][-2:]) * 2 + index
        sign = 1 if variation % 2 else -1
        profile_type = route['profile']['name']

        def side_piece(suffix, side, dimensions, roll, z):
            # Rotated bounding-box extent keeps even a leaning scan outside
            # the entire clear bore, rather than relying on noncolliding props.
            r = math.radians(roll)
            extent_y = abs(math.cos(r)) * dimensions[1] * .5 + abs(math.sin(r)) * dimensions[2] * .5
            lateral = side * (width * .5 + 7 + extent_y)
            frame_rock(stem + suffix, rim, u, lateral, z, dimensions, roll)

        def crown_piece(suffix, dimensions, roll, lateral=0, lift=0):
            r = math.radians(roll)
            extent_z = abs(math.sin(r)) * dimensions[1] * .5 + abs(math.cos(r)) * dimensions[2] * .5
            frame_rock(stem + suffix, rim, u, lateral, height + 7 + extent_z + lift, dimensions, roll)

        if profile_type == 'vertical_split':
            side_piece('_TallSlabL', -1, [83, 29, height * 1.28], -8 * sign, height * .57)
            side_piece('_TallSlabR', 1, [69, 35, height * 1.13], 6 * sign, height * .52)
            crown_piece('_BrokenCrownA', [68, width * .9, 35], -15 * sign, -width * .18)
            crown_piece('_BrokenCrownB', [57, width * .8, 48], 11 * sign, width * .25, 14)
            side_piece('_BaseFragment', sign, [61, 24, 42], 18 * sign, 22)
        elif profile_type == 'low_gap':
            side_piece('_LowMarginL', -1, [82, 38, height * 1.12], -14 * sign, height * .40)
            side_piece('_LowMarginR', 1, [77, 43, height * 1.40], 11 * sign, height * .55)
            crown_piece('_FallenSlab', [95, width * 1.8, 30], 7 * sign)
            side_piece('_RubbleA', -1, [48, 31, 35], -17 * sign, 18)
            side_piece('_RubbleB', 1, [58, 38, 27], 9 * sign, 15)
            side_piece('_RubbleC', sign, [44, 27, 51], -10 * sign, 25)
        else:
            side_piece('_ArchShoulderL', -1, [75, 31, height * 1.22], -6 * sign, height * .58)
            side_piece('_ArchShoulderR', 1, [66, 27, height * 1.37], 9 * sign, height * .60)
            crown_piece('_LeaningCrown', [79, width * 1.7, 36], -9 * sign)
            side_piece('_ChippedMargin', sign, [49, 24, 37], 13 * sign, 22)

    for route in plan['routes']:
        cut_results = []
        for index, mouth in enumerate(route['mouths']):
            room = existing[mouth['room_actor_label']]
            component = room.get_component_by_class(unreal.DynamicMeshComponent)
            mesh = component.get_dynamic_mesh()
            backup_component = backups[mouth['node_id']].get_component_by_class(unreal.DynamicMeshComponent)
            room.modify()
            component.modify()
            mesh.modify()
            unreal.GeometryScript_MeshDecomposition.copy_mesh_to_mesh(backup_component.get_dynamic_mesh(), mesh)
            before = mesh.get_triangle_count()
            cutter = unreal.DynamicMesh()
            cutter.modify()
            dimensions = mouth['cutter']['local_dimensions_cm']
            unreal.GeometryScript_Primitives.append_box(cutter, opts, unreal.Transform(),
                dimensions[0], dimensions[1], dimensions[2], 0, 0, 0,
                unreal.GeometryScriptPrimitiveOriginMode.CENTER)
            cut = mouth['cutter']
            tool_transform = unreal.Transform(location=V(*cut['world_location']),
                rotation=unreal.Rotator(pitch=0, yaw=cut['yaw_degrees'], roll=0))
            mesh.modify()
            unreal.GeometryScript_MeshBooleans.apply_mesh_boolean(mesh, room.get_actor_transform(), cutter,
                tool_transform, unreal.GeometryScriptBooleanOperation.SUBTRACT,
                unreal.GeometryScriptMeshBooleanOptions(fill_holes=True, simplify_output=False,
                                                       allow_empty_result=False))
            after = mesh.get_triangle_count()
            assert after > 0, 'Boolean unexpectedly emptied room ' + mouth['room_actor_label']
            component.modify()
            component.set_complex_as_simple_collision_enabled(True, False)
            component.set_collision_profile_name('BlockAll')
            component.update_collision(False)
            room.set_editor_property('bIsSpatiallyLoaded', False)
            cut_results.append(dict(node_id=mouth['node_id'], room=mouth['room_actor_label'],
                                    triangles_before=before, triangles_after=after,
                                    collision_refreshed=True, runtime_mouth_checked=False))
            varied_frame(route, mouth, index)
        actor, mesh, points = make_tube(route)
        result['routes'].append(dict(id=route['id'], actor=actor.get_actor_label(),
            status='geometry_built_creature_unbound', geometry_triangles=mesh.get_triangle_count(),
            smoothed_floor_points=points, profile_type=route['profile']['name'],
            inner_polygon_yz_cm=route['profile']['inner_polygon_yz_cm'],
            clear_width_cm=route['profile']['maximum_width_cm'],
            clear_height_cm=route['profile']['maximum_height_cm'],
            editor_only_room_backups=[backups[m['node_id']].get_actor_label() for m in route['mouths']],
            room_cuts=cut_results, creature_types=[], implemented_ai_traversal=False,
            runtime_creature_tested=False, runtime_player_exclusion_tested=False))
    result['route_count'] = len(result['routes'])
    result['mouth_count'] = result['route_count'] * 2
    result['saved'] = unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    with open(os.path.join(saved, 'V5_FISSURE_BUILD_RESULT.json'), 'w', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2)
    unreal.log(json.dumps({'fissure_routes_built':result['route_count'], 'mouths_cut':result['mouth_count'],
                           'saved':result['saved'], 'creature_ai_implemented':False,
                           'creature_runtime_tested':False, 'player_exclusion_runtime_tested':False}))


build_v5_fissures()
