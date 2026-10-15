"""Create separate source-derived seat/control meshes; no BP/map/camera edits."""
import json
import math
import os
import unreal


def derive_v5_cart_seat_hardware():
    V = unreal.Vector
    root = '/Game/Generated_Meshes/MineV5'
    sources = {
        'chair': '/Game/Modular_Rural_Cabin/Meshes/Props/Office_Chair',
        'hammer': '/Game/Scene_OldMine/Assets/Megascans/3D_Assets/His_Med_Tools_Hammer_Metal_Old_01/SM_His_Med_Tools_Hammer_Metal_Old_01',
        'hydraulic': '/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Equipment_Hydraulic_Metal_Old_02/SM_Ind_Min_Equipment_Hydraulic_Metal_Old_02',
        'beam': '/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Beam_Square_Wood_Worn_03/SM_Ind_Min_Beam_Square_Wood_Worn_03',
    }
    assets = {key: unreal.load_asset(path) for key, path in sources.items()}
    assert all(assets.values()), 'Required original asset missing'
    read_lod = unreal.GeometryScriptMeshReadLOD(lod_type=unreal.GeometryScriptLODType.SOURCE_MODEL, lod_index=0)
    read_options = unreal.GeometryScriptCopyMeshFromAssetOptions(request_tangents=True)
    write_options = unreal.GeometryScriptCopyMeshToAssetOptions(
        enable_recompute_normals=False, enable_recompute_tangents=False,
        replace_materials=True)
    specs = [
        dict(name='SM_MineCart_RiderSeat', source='chair', low=45.0, high=None,
             pivot=[1.330891, 2.5, 45.0], rotation=[0, -90, 0], scale=1.0),
        dict(name='SM_MineCart_SeatPedestal', source='chair', low=15.0, high=45.0,
             pivot=[1.330891, 2.5, 15.0], rotation=[0, -90, 0], scale=1.0),
        dict(name='SM_MineCart_BrakeLever', source='hammer', low=None, high=None,
             pivot=[-24.601177215576172, 0, 2.0], rotation=[90, 0, 0], scale=1.0),
        dict(name='SM_MineCart_BrakeAnchor', source='hydraulic', low=None, high=25.0,
             pivot=[-4.410748, 4.119214, -0.0419464111328125], rotation=[0, 0, 0], scale=0.45),
        dict(name='SM_MineCart_ReclaimedDeck', source='beam', low=None, high=None,
             pivot=[0, 0, 10.908952713012695], rotation=[0, 0, 0], scale=1.0,
             repeat_y_cm=[-51, -34, -17, 0, 17, 34, 51]),
    ]
    report = dict(status='derived_assets_created_fit_spec_pending_cart_visual_review',
                  blueprint_modified=False, level_modified=False, camera_modified=False,
                  source_assets_modified=False, source_uvs_preserved=True, assets=[],
                  orientation='+X forward, +Y right, +Z up; transforms below relative to CartCollision root')
    for spec in specs:
        source = assets[spec['source']]
        mesh = unreal.DynamicMesh()
        mesh.modify()
        unused, outcome = unreal.GeometryScript_AssetUtils.copy_mesh_from_static_mesh(source, mesh, read_options, read_lod)
        assert outcome == unreal.GeometryScriptOutcomePins.SUCCESS
        before = mesh.get_triangle_count()
        if 'repeat_y_cm' in spec:
            combined = unreal.DynamicMesh()
            combined.modify()
            for i, y in enumerate(spec['repeat_y_cm']):
                combined.modify()
                unreal.GeometryScript_MeshEdits.append_mesh(
                    combined, mesh, unreal.Transform(location=V(0, y, 0),
                                                     rotation=unreal.Rotator(pitch=0, yaw=180 * (i % 2), roll=0)))
            mesh = combined
        materials, indices, slots, material_outcome = unreal.GeometryScript_AssetUtils.get_section_material_list_from_static_mesh(source, read_lod)
        assert material_outcome == unreal.GeometryScriptOutcomePins.SUCCESS
        if spec['low'] is not None:
            mesh.modify()
            unreal.GeometryScript_MeshBooleans.apply_mesh_plane_cut(
                mesh, unreal.Transform(location=V(0, 0, spec['low'])),
                unreal.GeometryScriptMeshPlaneCutOptions(fill_holes=True, fill_spans=True,
                                                        flip_cut_side=True, hole_fill_material_id=0,
                                                        uv_world_dimension=25))
        if spec['high'] is not None:
            mesh.modify()
            unreal.GeometryScript_MeshBooleans.apply_mesh_plane_cut(
                mesh, unreal.Transform(location=V(0, 0, spec['high'])),
                unreal.GeometryScriptMeshPlaneCutOptions(fill_holes=True, fill_spans=True,
                                                        flip_cut_side=False, hole_fill_material_id=0,
                                                        uv_world_dimension=25))
        assert mesh.get_triangle_count() > 0, 'Cut removed entire mesh'
        mesh.modify()
        unreal.GeometryScript_MeshTransforms.transform_mesh(mesh, unreal.Transform(location=-V(*spec['pivot'])))
        mesh.modify()
        unreal.GeometryScript_MeshTransforms.transform_mesh(
            mesh, unreal.Transform(rotation=unreal.Rotator(pitch=spec['rotation'][0], yaw=spec['rotation'][1], roll=spec['rotation'][2]),
                                   scale=V(spec['scale'], spec['scale'], spec['scale'])))
        bounds = mesh.get_mesh_bounding_box()
        size = bounds.max - bounds.min
        if spec['name'] == 'SM_MineCart_RiderSeat':
            assert abs(bounds.min.z) < 0.05 and 87 < size.z < 90, 'Upper seat cut incorrect'
            assert size.x < 73 and size.y < 70, 'Seat must fit measured cart deck'
        if spec['name'] == 'SM_MineCart_SeatPedestal':
            assert abs(bounds.min.z) < 0.05 and 29.9 < size.z < 30.1, 'Pedestal cut incorrect'
            assert max(size.x, size.y) < 30, 'Caster geometry must be absent'
        if spec['name'] == 'SM_MineCart_BrakeLever':
            assert abs(bounds.min.z) < 0.05 and 49 < size.z < 50, 'Brake grip must point upward'
        target_path = root + '/' + spec['name']
        target = unreal.load_asset(target_path) if unreal.EditorAssetLibrary.does_asset_exist(target_path) else None
        if target:
            target.modify()
            write_options = unreal.GeometryScriptCopyMeshToAssetOptions(
                enable_recompute_normals=False, enable_recompute_tangents=False,
                replace_materials=True, new_materials=materials, new_material_slot_names=slots)
            unused, outcome = unreal.GeometryScript_AssetUtils.copy_mesh_to_static_mesh(
                mesh, target, write_options, unreal.GeometryScriptMeshWriteLOD(lod_index=0), True)
        else:
            target, outcome = unreal.GeometryScript_NewAssetUtils.create_new_static_mesh_asset_from_mesh(
                mesh, target_path,
                unreal.GeometryScriptCreateNewStaticMeshAssetOptions(
                    enable_collision=False, enable_nanite=False,
                    enable_recompute_normals=False, enable_recompute_tangents=False))
        assert target and outcome == unreal.GeometryScriptOutcomePins.SUCCESS, target_path
        target.modify()
        for index, material in enumerate(materials):
            target.set_material(index, material)
        if mesh.get_triangle_count() > 50000:
            target.modify()
            unreal.get_editor_subsystem(unreal.StaticMeshEditorSubsystem).set_nanite_settings(
                target, unreal.MeshNaniteSettings(enabled=True, explicit_tangents=True), True)
        assert unreal.EditorAssetLibrary.save_loaded_asset(target, False), target_path
        report['assets'].append(dict(path=target_path, source=sources[spec['source']],
                                      source_triangles=before, derived_triangles=mesh.get_triangle_count(),
                                      min_cm=list(bounds.min.to_tuple()), max_cm=list(bounds.max.to_tuple()),
                                      size_cm=list(size.to_tuple()),
                                      nanite_enabled=mesh.get_triangle_count() > 50000,
                                      source_materials=[m.get_path_name() for m in materials],
                                      derivation=spec))
    # Deck plane is provided by the actual cart rebuild, not assumed from the
    # generic source mesh origin. These placements preserve source chair joints.
    deck = -31.0
    seat_base = 31.0
    report['placement_spec'] = dict(
        reference='CartCollision root at railbed+105.5cm; CartBody yaw=-90, scale=1.6, relativeZ=-96',
        railbed_to_actor_root_cm=105.5, deck_surface_z_cm=deck,
        child_component_collision='NoCollision; CartCollision handles rider/vehicle collision',
        components=[
            dict(name='ReclaimedDeckVisual', mesh=root + '/SM_MineCart_ReclaimedDeck',
                 relative_location_cm=[0, 0, deck], relative_rotation_pyr=[0, 0, 0], uniform_scale=1),
            dict(name='RiderSeatVisual', mesh=root + '/SM_MineCart_RiderSeat',
                 relative_location_cm=[-25, 0, seat_base], relative_rotation_pyr=[0, 0, 0], uniform_scale=1),
            dict(name='SeatPedestalVisual', mesh=root + '/SM_MineCart_SeatPedestal',
                 relative_location_cm=[-25, 0, deck], relative_rotation_pyr=[0, 0, 0], uniform_scale=62/30),
            dict(name='BrakeAnchorVisual', mesh=root + '/SM_MineCart_BrakeAnchor',
                 relative_location_cm=[29, 37, deck], relative_rotation_pyr=[0, 0, 0], uniform_scale=3.4),
            dict(name='BrakeLeverVisual', mesh=root + '/SM_MineCart_BrakeLever',
                 relative_location_cm=[29, 37, 7], relative_rotation_pyr=[12, 0, 0], uniform_scale=1),
        ],
        rider_seat_hip_location_cm=[-21, 0, 38],
        seated_first_person_eye_cm=[-9, 0, 110],
        camera_rotation_pyr=[0, 0, 0],
        camera_note='Use with the existing ride camera system; no new player animation or ability is implemented here.',
        control_grip_estimate_cm=[18.77, 37, 55.13],
        source_chair_cushion_estimate_cm=51.56,
        source_chair_front='+Y before derived yaw -90',
        deck_half_width_cm=59.895,
        seat_half_width_cm=32.80,
        lateral_deck_clearance_each_side_cm=27.095,
        cart_frame_half_width_cm=67,
        seat_back_top_world_above_railbed_cm=225.116,
        seated_eye_world_above_railbed_cm=215.5,
        support_evidence='Source trolley center Y=0 is open. Crossmembers at native Y=-30/+30 have measured upper surfaces Z34.87..41.12cm, mapping to actor Z-40.21..-30.21. Native timber deck occupies actor Z-41.91..-31 and spans crossmembers at actor X=-48/+48.',
        note='This corrected specification supersedes initial 75.5cm deck-plane assumption. Full fit envelope and source proportions checked numerically; actual rider pose, hand alignment and cart screenshot remain to be verified.')
    saved = os.path.join(unreal.Paths.project_saved_dir(), 'CaveNetworkRebuild')
    with open(os.path.join(saved, 'V5_CART_SEAT_HARDWARE_SPEC.json'), 'w', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2)
    unreal.log(json.dumps({'status': report['status'], 'assets': report['assets'], 'placement_spec': report['placement_spec']}))
    return report


if __name__ == '__main__':
    derive_v5_cart_seat_hardware()
