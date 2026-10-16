"""Authored mine torch hardware and Niagara fire; preserves existing lighting."""
def build_v5_torches():
 import unreal,json,math,os
 V=unreal.Vector; root=os.path.join(unreal.Paths.project_saved_dir(),'CaveNetworkRebuild')
 data=json.load(open(os.path.join(root,'CONNECTED_ROUTE_GEOMETRY_V4.json')))
 system=unreal.load_asset('/Game/MineGameplay/V5/NS_MineTorchFlame')
 if not system:raise RuntimeError('Verified torch Niagara system missing')
 sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
 for a in sub.get_all_level_actors():
  if a.get_actor_label().startswith('MineV5Torch_'):a.modify();sub.destroy_actor(a)
 wood=unreal.load_asset('/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Beam_Round_Wood_Worn_01/MI_Ind_Min_Beam_Round_Wood_Worn_01_A')
 metal=unreal.load_asset('/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Equipment_Stakes_Metal_Pack_01/MI_Ind_Min_Equipment_Stakes_Metal_Pack_01')
 opts=unreal.GeometryScriptPrimitiveOptions(); records=[]
 def spawn(cls,p,label):
  a=sub.spawn_actor_from_class(cls,p);assert a,label;a.modify();a.set_actor_label('MineV5Torch_'+label);a.set_folder_path('Mine_Rebuild/V5/Torches');return a
 def mesh(p,label,mat):
  a=spawn(unreal.DynamicMeshActor,p,label);c=a.get_component_by_class(unreal.DynamicMeshComponent);c.modify();m=c.get_dynamic_mesh();m.modify();c.set_material(0,mat);c.set_collision_profile_name('NoCollision');return a,c,m
 def cylinder(m,p,r,h,rot=None):
  unreal.GeometryScript_Primitives.append_cylinder(m,opts,unreal.Transform(location=p,rotation=rot or unreal.Rotator()),r,h,16,0,True,unreal.GeometryScriptPrimitiveOriginMode.BASE)
 def box(m,p,s):unreal.GeometryScript_Primitives.append_box(m,opts,unreal.Transform(location=p),*s,0,0,0,unreal.GeometryScriptPrimitiveOriginMode.CENTER)
 # Select real bend rooms, with irregular spacing and no blanket illumination.
 selected=[]
 for level,indices in enumerate([[3,12,20,28],[2,11,20,29],[5,14,20,27],[3,12,20,28],[6,15,20,29]]):
  for k in indices:selected.append((level,data['segments'][level*36+k]['ends'][0]))
 labels={a.get_actor_label():a for a in sub.get_all_level_actors()}
 for i,(level,node) in enumerate(selected):
  room=labels.get('MineV4_Room_%03d'%node)
  if not room:continue
  center=V(*data['nodes'][node]['position']);district=V(*data['districts'][level]['center']);rad=center-district;rad.z=0;rad=rad/rad.length()
  radius=1500 if node in [data['segments'][j]['ends'][1] for j in data['hero_segment_ids']] else 620
  # Outward-facing wall sectors stay clear of the two rail lanes and portal mouths.
  p=center+rad*(radius-38)+V(0,0,145+(i%3)*12);yaw=math.degrees(math.atan2(-rad.y,-rad.x));rot=unreal.Rotator(pitch=0,yaw=yaw,roll=0)
  a,c,m=mesh(p,'%02d_Wood'%i,wood);a.modify();a.set_actor_rotation(rot,False)
  cylinder(m,V(12,0,0),3.6,66)
  unreal.GeometryScript_UVs.set_mesh_u_vs_from_box_projection(m,0,unreal.Transform(scale=V(25,25,80)),unreal.GeometryScriptMeshSelection())
  a,c,m=mesh(p,'%02d_Iron'%i,metal);a.modify();a.set_actor_rotation(rot,False)
  box(m,V(-4,0,27),(5,15,45));box(m,V(5,0,12),(22,5,5));box(m,V(5,0,48),(22,5,5))
  cylinder(m,V(12,0,60),9,6)
  for j in range(6):
   theta=j*math.pi/3;cylinder(m,V(12+8*math.cos(theta),8*math.sin(theta),65),.9,14)
  unreal.GeometryScript_Primitives.append_torus(m,opts,unreal.Transform(location=V(12,0,77)),unreal.GeometryScriptRevolveOptions(),8,1.1,24,6,unreal.GeometryScriptPrimitiveOriginMode.CENTER)
  unreal.GeometryScript_UVs.set_mesh_u_vs_from_box_projection(m,0,unreal.Transform(scale=V(35,35,35)),unreal.GeometryScriptMeshSelection())
  flame=p-rad*12+V(0,0,69)
  actor=spawn(unreal.NiagaraActor,flame,'%02d_Flame'%i);component=actor.get_component_by_class(unreal.NiagaraComponent);component.modify();component.set_asset(system);component.set_auto_activate(True);component.activate(True)
  lamp=spawn(unreal.PointLight,flame+V(0,0,20),'%02d_Light'%i);lc=lamp.get_component_by_class(unreal.PointLightComponent);lc.modify();lc.set_editor_property('IntensityUnits',unreal.LightUnits.LUMENS);lc.set_intensity(260);lc.set_attenuation_radius(730);lc.set_light_color(unreal.LinearColor(1,.38,.105,1));lc.set_editor_property('SourceRadius',9);lc.set_editor_property('CastShadows',i%3==0)
  records.append({'id':i,'district':level,'node':node,'location':flame.to_tuple(),'niagara':system.get_path_name(),'runtime_tested':False})
 result={'torch_count':len(records),'records':records,'saved':unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True,True)}
 json.dump(result,open(os.path.join(root,'TORCH_BUILD_V5.json'),'w'),indent=2);print(json.dumps({'torch_count':len(records),'saved':result['saved']}))
build_v5_torches()
