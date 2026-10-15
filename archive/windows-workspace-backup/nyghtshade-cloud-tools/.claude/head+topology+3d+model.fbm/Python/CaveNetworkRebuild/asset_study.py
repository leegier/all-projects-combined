def start_asset_study():
 import unreal,os,json,math,traceback
 from mine_cart_policy import is_mine_cart_asset
 V=unreal.Vector;sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem);world=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
 folder=os.path.join(unreal.Paths.project_saved_dir(),'CaveNetworkRebuild','AssetStudy');os.makedirs(folder,exist_ok=True)
 candidates=[
 ('vehicle_cart_native','/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Vehicle_Cart_Metal_Old_02/SM_Ind_Min_Vehicle_Cart_Metal_Old_02',1.0,True),
 ('vehicle_cart_ride_scale','/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Vehicle_Cart_Metal_Old_02/SM_Ind_Min_Vehicle_Cart_Metal_Old_02',1.6,True),
 ('ore_cart_native','/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Cart_Metal_Old_02/SM_Ind_Min_Cart_Metal_Old_02',1.0,True),
 ('caged_mine_light','/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_War_Light_Bulkhead_Metal_Caged_01/SM_Ind_War_Light_Bulkhead_Metal_Caged_01',1.0,False),
 ('sandstone_cliff','/Game/Megascans/3D_Assets/HugeSandstoneCliff/SM_HugeSandstoneCliff_01',1.0,True),
 ('coastal_cliff','/Game/Megascans/3D_Assets/MassiveNordicCoastalCliff/SM_MassiveNordicCoastalCliff_01',1.0,True),
 ('rock_formation','/Game/Megascans/3D_Assets/ForestRockFormation/SM_ForestRockFormation_01',1.0,True),
 ('rock_shelf','/Game/Megascans/3D_Assets/ForestRockShelf/SM_ForestRockShelf_01',1.0,True),
 ('riverbed','/Game/Megascans/3D_Assets/DryRiverBed/SM_DryRiverBed_01',1.0,False)]
 # Retain asset studies for the mine, excluding retired cart previews.
 candidates=[row for row in candidates if not is_mine_cart_asset(row[1])]
 origin=V(200000,200000,100000);owned=[]
 def spawn(cls,p,name):
  a=sub.spawn_actor_from_class(cls,p);a.modify();a.set_actor_label('TEMP_AssetStudy_'+name);owned.append(a);return a
 asset=spawn(unreal.StaticMeshActor,origin,'Asset');sm=asset.get_component_by_class(unreal.StaticMeshComponent);sm.modify();sm.set_collision_profile_name('NoCollision')
 floor=spawn(unreal.StaticMeshActor,origin,'Floor');fc=floor.get_component_by_class(unreal.StaticMeshComponent);fc.modify();fc.set_static_mesh(unreal.load_asset('/Engine/BasicShapes/Cube'));fc.set_collision_profile_name('NoCollision')
 player=spawn(unreal.load_class(None,'/Game/ThirdPerson/Blueprints/BP_ThirdPersonCharacter.BP_ThirdPersonCharacter_C'),origin,'PlayerScale');player.set_actor_enable_collision(False)
 camera=spawn(unreal.SceneCapture2D,origin,'Camera');capture=camera.get_component_by_class(unreal.SceneCaptureComponent2D);capture.modify()
 rt=unreal.RenderingLibrary.create_render_target2d(world,1600,1000,unreal.TextureRenderTargetFormat.RTF_RGBA8)
 capture.set_editor_property('TextureTarget',rt);capture.set_editor_property('CaptureSource',unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR);capture.set_editor_property('bCaptureEveryFrame',True);capture.set_editor_property('FOVAngle',45)
 capture.set_editor_property('PrimitiveRenderMode',unreal.SceneCapturePrimitiveRenderMode.PRM_USE_SHOW_ONLY_LIST)
 capture.show_only_actor_components(asset);capture.show_only_actor_components(floor);capture.show_only_actor_components(player,True)
 settings=capture.get_editor_property('PostProcessSettings');settings.set_editor_property('bOverride_AutoExposureBias',True);settings.set_editor_property('AutoExposureBias',0);capture.set_editor_property('PostProcessSettings',settings)
 lights=[]
 for k in range(2):
  a=spawn(unreal.PointLight,origin,'Light'+str(k));c=a.get_component_by_class(unreal.PointLightComponent);c.modify();c.set_editor_property('IntensityUnits',unreal.LightUnits.LUMENS);c.set_editor_property('CastShadows',True);lights.append((a,c))
 state={'index':0,'frames':0,'handle':None,'rows':[]}
 def setup():
  name,path,scale,gauge=candidates[state['index']];mesh=unreal.load_asset(path);assert mesh,path;sm.set_static_mesh(mesh);asset.set_actor_scale3d(V(scale,scale,scale))
  bb=mesh.get_bounding_box();lo=bb.min*scale;hi=bb.max*scale;asset.set_actor_location(origin-V(0,0,lo.z),False,False)
  width=hi.x-lo.x;depth=hi.y-lo.y;height=hi.z-lo.z;center=origin+V((hi.x+lo.x)*.5,(hi.y+lo.y)*.5,height*.5)
  player.set_actor_hidden_in_game(not gauge);player.set_actor_location(origin+V(hi.x+80,0,90),False,False)
  if gauge:center=center+V(50,0,max(0,180-height)*.25);width+=200;height=max(180,height)
  size=max(width,depth,height,25);floor.set_actor_location(origin+V(0,0,-10),False,False);floor.set_actor_scale3d(V((size+400)/100,(size+400)/100,.1))
  position=center+V(-.7,-1,.52)*(size*2.1);camera.set_actor_location(position,False,False);camera.set_actor_rotation(unreal.MathLibrary.find_look_at_rotation(position,center),False)
  for k,(a,c) in enumerate(lights):
   a.set_actor_location(center+V(-.8 if k==0 else 1.1,-.8 if k==0 else .8,1.4)*size,False,False);c.set_intensity((18000 if k==0 else 10000)*(size/100)**2);c.set_attenuation_radius(size*6);c.set_editor_property('SourceRadius',size*.35);c.set_light_color(unreal.LinearColor(1,.96,.9,1) if k==0 else unreal.LinearColor(.75,.86,1,1))
  state['rows'].append({'name':name,'path':path,'preview_scale':scale,'native_size_m':((bb.max-bb.min)/100).to_tuple(),'player_scale_reference':gauge})
 def cleanup():
  if state['handle']:unreal.unregister_slate_post_tick_callback(state['handle'])
  for a in reversed(owned):
   if unreal.is_valid(a):sub.destroy_actor(a)
  unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True,True)
 def tick(delta):
  try:
   state['frames']+=1
   if state['frames']<90:return
   name=candidates[state['index']][0];unreal.RenderingLibrary.export_render_target(world,rt,folder,name+'.png')
   state['index']+=1;state['frames']=0
   if state['index']>=len(candidates):
    with open(os.path.join(folder,'asset_study_manifest.json'),'w') as f:json.dump(state['rows'],f,indent=2)
    cleanup()
   else:setup()
  except Exception:
   with open(os.path.join(folder,'capture_error.txt'),'w') as f:f.write(traceback.format_exc())
   cleanup()
 setup();state['handle']=unreal.register_slate_post_tick_callback(tick)
 print('Asset study queued:',len(candidates),'native asset views')
start_asset_study()
