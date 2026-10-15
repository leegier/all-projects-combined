"""Derive the original trolley chassis and four wheels after explicit coordination.

This file has no automatic entry point. Call derive_v5_cart_wheels() only after
main-editor PIE is ended and the parent has authorized the asset creation.
It changes only five generated StaticMesh assets, never source art, BPs or maps.
All reports are written to Saved, never JSON inside Content (auto-import hazard).
"""
import json
import os
import time
import unreal


def derive_v5_cart_wheels():
    out = os.path.join(unreal.Paths.project_saved_dir(), 'CaveNetworkRebuild')
    with open(os.path.join(out, 'V5_CART_WHEEL_SEPARATION_ASSESSMENT.json')) as stream:
        spec = json.load(stream)
    source = unreal.load_asset(spec['source'])
    assert source, 'Original trolley source is required'
    asset_root = '/Game/Generated_Meshes/MineV5'
    lod = unreal.GeometryScriptMeshReadLOD(
        lod_type=unreal.GeometryScriptLODType.SOURCE_MODEL, lod_index=0)
    materials, indices, slots, result = unreal.GeometryScript_AssetUtils.get_section_material_list_from_static_mesh(source, lod)
    assert result == unreal.GeometryScriptOutcomePins.SUCCESS and materials
    read_options = unreal.GeometryScriptCopyMeshFromAssetOptions(request_tangents=True)
    source_mesh = unreal.DynamicMesh()
    source_mesh.modify()
    unused, result = unreal.GeometryScript_AssetUtils.copy_mesh_from_static_mesh(source, source_mesh, read_options, lod)
    assert result == unreal.GeometryScriptOutcomePins.SUCCESS
    assert source_mesh.get_triangle_count() == spec['source_triangles']
    source_open_edges = unreal.GeometryScript_MeshQueries.get_num_open_border_edges(source_mesh)
    report = dict(schema='mine-v5-derived-cart-wheels-1',
                  source=spec['source'], source_triangles=source_mesh.get_triangle_count(),
                  source_open_edges=source_open_edges, source_modified=False,
                  blueprint_modified=False, map_modified=False, viewport_modified=False,
                  preserves_original_uvs_normals_tangents=True,
                  cap_note='New UVs/normals exist only on concealed axle cut caps.',
                  geometry=[], started_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))

    def copy_source():
        mesh = unreal.DynamicMesh()
        mesh.modify()
        unreal.GeometryScript_MeshEdits.append_mesh(mesh, source_mesh, unreal.Transform())
        return mesh

    def cut(mesh, normal, point, positive, cap):
        mesh.modify()
        rotation = unreal.MathLibrary.make_rot_from_z(unreal.Vector(*normal))
        unreal.GeometryScript_MeshBooleans.apply_mesh_plane_cut(
            mesh, unreal.Transform(location=unreal.Vector(*point), rotation=rotation),
            unreal.GeometryScriptMeshPlaneCutOptions(
                fill_holes=cap, fill_spans=cap, flip_cut_side=positive,
                hole_fill_material_id=0, uv_world_dimension=25))
        assert mesh.get_triangle_count() > 0, 'Unexpected empty plane-cut result'

    def write_mesh(name, mesh, extra):
        path = asset_root + '/' + name
        bounds = mesh.get_mesh_bounding_box()
        item = dict(path=path, triangles=mesh.get_triangle_count(),
                    min_cm=list(bounds.min.to_tuple()), max_cm=list(bounds.max.to_tuple()),
                    open_edges=unreal.GeometryScript_MeshQueries.get_num_open_border_edges(mesh),
                    materials=[material.get_path_name() for material in materials],
                    nanite=True, original_orientation_preserved=True)
        item.update(extra)
        assert item['open_edges'] <= source_open_edges, 'Derivation introduced an open boundary'
        if unreal.EditorAssetLibrary.does_asset_exist(path):
            target = unreal.load_asset(path)
            assert isinstance(target, unreal.StaticMesh)
            target.modify()
            unused, result = unreal.GeometryScript_AssetUtils.copy_mesh_to_static_mesh(
                mesh, target, unreal.GeometryScriptCopyMeshToAssetOptions(
                    enable_recompute_normals=False, enable_recompute_tangents=False,
                    replace_materials=True, new_materials=materials, new_material_slot_names=slots),
                unreal.GeometryScriptMeshWriteLOD(lod_index=0), True)
        else:
            target, result = unreal.GeometryScript_NewAssetUtils.create_new_static_mesh_asset_from_mesh(
                mesh, path, unreal.GeometryScriptCreateNewStaticMeshAssetOptions(
                    enable_collision=False, enable_nanite=True,
                    enable_recompute_normals=False, enable_recompute_tangents=False))
        assert target and result == unreal.GeometryScriptOutcomePins.SUCCESS, path
        target.modify()
        for index, material in enumerate(materials):
            target.set_material(index, material)
        target.modify()
        unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem).set_nanite_settings(
            target, unreal.MeshNaniteSettings(enabled=True, explicit_tangents=True), True)
        assert unreal.EditorAssetLibrary.save_loaded_asset(target, False), path
        report['geometry'].append(item)
        return item

    # No cap at the horizontal split: reunite its identical boundary edges after
    # removing the four outer wheel regions. Only the axle-end caps are new art.
    # The 0.7mm-tall seam meets the X=+/-16 axle caps at a handful of junction
    # vertices that each have more than one coincident partner; only_unique_pairs
    # would refuse to merge those and leave them reported as open border edges.
    # Merging all coincident pairs at the same tolerance closes the seam to 0.
    upper = copy_source()
    cut(upper, (0,0,1), (0,0,32), True, False)
    center = copy_source()
    cut(center, (0,0,1), (0,0,32), False, False)
    cut(center, (1,0,0), (-16,0,0), True, True)
    cut(center, (1,0,0), (16,0,0), False, True)
    upper.modify()
    unreal.GeometryScript_MeshEdits.append_mesh(upper, center, unreal.Transform())
    upper.modify()
    unreal.GeometryScript_MeshRepair.weld_mesh_edges(
        upper, unreal.GeometryScriptWeldEdgesOptions(tolerance=0.001, only_unique_pairs=False))
    assert 1100000 < upper.get_triangle_count() < 1200000, 'Chassis count outside measured cut expectation'
    assert unreal.GeometryScript_MeshQueries.get_num_open_border_edges(upper) <= source_open_edges, \
        'Chassis rejoin left an open boundary'
    write_mesh('SM_MineCart_Chassis', upper,
               dict(pivot_native_cm=[0,0,0], component_location_actor_cm=[0,0,-96],
                    component_rotation_pyr=[0,-90,0], component_uniform_scale=1.6))
    del upper, center

    for wheel in spec['wheels']:
        mesh = copy_source()
        side = wheel['native_side']
        cut(mesh, (0,0,1), (0,0,32), False, False)
        cut(mesh, (side,0,0), (side*16,0,0), True, True)
        cut(mesh, (0,1,0), (0,1.5,0), wheel['native_end'] > 0, False)
        minimum = wheel['original_triangles_fully_retained']
        assert minimum <= mesh.get_triangle_count() < minimum+5000, 'Wheel count outside measured cut expectation'
        mesh.modify()
        pivot = unreal.Vector(*wheel['pivot_native_cm'])
        unreal.GeometryScript_MeshTransforms.transform_mesh(mesh, unreal.Transform(location=-pivot))
        bound = mesh.get_mesh_bounding_box()
        size = bound.max-bound.min
        assert size.x < 16 and 29 < size.y < 31 and 29 < size.z < 31, 'Wheel bounds do not match measured source'
        write_mesh('SM_MineCart_Wheel_'+wheel['naming_hint'], mesh,
                   dict(pivot_native_cm=wheel['pivot_native_cm'],
                        component_location_actor_cm=wheel['component_location_actor_cm'],
                        component_rotation_pyr=[0,-90,0], component_uniform_scale=1.6,
                        local_rotation_axis='X',
                        rolling_radius_world_cm=wheel['recommended_rolling_radius_world_cm']))
        del mesh
    report.update(status='generated_assets_saved_runtime_visual_review_pending',
                  completed_utc=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()))
    path = os.path.join(out, 'V5_CART_DERIVED_WHEELS.json')
    with open(path, 'w') as stream:
        json.dump(report, stream, indent=2)
    unreal.log('Saved source-derived chassis and four wheels; source, Blueprint, map and viewport untouched')
    return report
