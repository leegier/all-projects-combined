def atmosphere_v4():
 import unreal,json,os,math
 V=unreal.Vector;sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem);sds=unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem);lib=unreal.SubobjectDataBlueprintFunctionLibrary;data=json.load(open(os.path.join(unreal.Paths.project_saved_dir(),'CaveNetworkRebuild','CONNECTED_ROUTE_GEOMETRY_V4.json')))
 for a in sub.get_all_level_actors():
  if a.get_actor_label().startswith('MineV4Mood_'):a.modify();sub.destroy_actor(a)
 lamp=unreal.load_asset('/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_War_Light_Bulkhead_Metal_Caged_01/SM_Ind_War_Light_Bulkhead_Metal_Caged_01')
 for i,g in enumerate(data['giant_caverns']):
  p=V(*g['center']);radius=g['radius'];height=g['height'];ni=data['segments'][g['segment_id']]['ends'][1]
  fog=sub.spawn_actor_from_class(unreal.LocalFogVolume,p+V(0,0,700));fog.modify();fog.set_actor_label('MineV4Mood_Haze_%d'%i);fog.set_folder_path('Mine_Rebuild/V4_Atmosphere');fog.set_actor_scale3d(V(radius/500,radius/500,radius/500));fc=fog.get_component_by_class(unreal.LocalFogVolumeComponent);fc.modify();fc.set_editor_property('RadialFogExtinction',.10);fc.set_editor_property('HeightFogExtinction',.025);fc.set_editor_property('HeightFogFalloff',2.0);fc.set_editor_property('HeightFogOffset',-.35);fc.set_editor_property('FogAlbedo',unreal.LinearColor(.42,.52,.61,1));fc.set_editor_property('FogEmissive',unreal.LinearColor(.0002,.0003,.0004,1));fc.set_editor_property('FogPhaseG',.2)
  actor=sub.spawn_actor_from_class(unreal.Actor,p+V(0,0,height*.45));actor.modify();actor.set_actor_label('MineV4Mood_Grade_%d'%i);actor.set_folder_path('Mine_Rebuild/V4_Atmosphere');root=sds.k2_gather_subobject_data_for_instance(actor)[0]
  bh,_=sds.add_new_subobject(unreal.AddNewSubobjectParams(parent_handle=root,new_class=unreal.BoxComponent));box=lib.get_associated_object(sds.k2_find_subobject_data_from_handle(bh));box.modify();box.set_box_extent(V(radius+300,radius+300,height*.6),False);box.set_collision_profile_name('NoCollision')
  ph,_=sds.add_new_subobject(unreal.AddNewSubobjectParams(parent_handle=bh,new_class=unreal.PostProcessComponent));pp=lib.get_associated_object(sds.k2_find_subobject_data_from_handle(ph));pp.modify();pp.set_editor_property('bUnbound',False);pp.set_editor_property('Priority',10.0);pp.set_editor_property('BlendRadius',400.0)
  settings=pp.get_editor_property('Settings');settings.set_editor_property('bOverride_AutoExposureBias',True);settings.set_editor_property('AutoExposureBias',-1.15);settings.set_editor_property('bOverride_ColorSaturation',True);settings.set_editor_property('ColorSaturation',unreal.Vector4(.86,.86,.86,1));pp.set_editor_property('Settings',settings)
  for light in sub.get_all_level_actors():
   if light.get_actor_label().startswith('MineV4_GrottoAccent_%03d_'%ni):
    q=light.get_actor_location();fixture=sub.spawn_actor_from_class(unreal.StaticMeshActor,q+V(0,0,15));fixture.modify();fixture.set_actor_label('MineV4Mood_Practical_'+light.get_actor_label());fixture.set_folder_path('Mine_Rebuild/V4_Atmosphere');fixture.set_actor_scale3d(V(2,2,2));fixture.set_actor_rotation(unreal.MathLibrary.find_look_at_rotation(q,p),False);c=fixture.get_component_by_class(unreal.StaticMeshComponent);c.modify();c.set_static_mesh(lamp);c.set_collision_profile_name('NoCollision')
 print('Three bounded cavern atmosphere treatments and practical lamps saved',unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True,True))
atmosphere_v4()
