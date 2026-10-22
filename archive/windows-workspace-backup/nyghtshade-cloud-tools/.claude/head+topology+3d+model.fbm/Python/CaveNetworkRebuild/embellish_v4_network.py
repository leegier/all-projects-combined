def embellish_v4():
 import unreal,math,json,os
 from mine_cart_policy import is_mine_cart_actor
 V=unreal.Vector
 sd=os.path.join(unreal.Paths.project_saved_dir(),'CaveNetworkRebuild')
 data=json.load(open(os.path.join(sd,'CONNECTED_ROUTE_GEOMETRY_V4.json')));route=data['segments']
 sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem);world=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
 sds=unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem);lib=unreal.SubobjectDataBlueprintFunctionLibrary
 for a in sub.get_all_level_actors():
  if a.get_actor_label().startswith(('MineDemo2_','MineCavernArt_','MineCavernSeal_')):a.modify();sub.destroy_actor(a)
 source=unreal.load_asset('/Game/Scene_OldMine/Maps/Industrial_OldMine')
 sources=unreal.GameplayStatics.get_all_actors_of_class(source,unreal.Actor)
 sites=list(range(0,72,6));count=0
 for site in sites:
  seg=route[site];p=V(*seg['a']);q=V(*seg['b']);center=(p+q)*.5;f=(q-p)/(q-p).length();right=V(-f.y,f.x,0)
  cave=site%12==0
  pivot=V(10360,-940,3.758) if cave else V(11300,-9,3.018)
  rot=unreal.MathLibrary.make_rot_from_yz(f*-1,V(0,0,1)) if cave else unreal.Rotator(pitch=math.degrees(math.asin(f.z)),yaw=math.degrees(math.atan2(f.y,f.x)),roll=0)
  basis=unreal.Transform(location=center,rotation=rot,scale=V(1.25,1.25,1.25));cartn=0
  for n,original in enumerate(sources):
   loc=original.get_actor_location()
   inside=(10000<loc.x<10700 and -1380<loc.y<-330) if cave else (10800<loc.x<11800 and -180<loc.y<180)
   valid=isinstance(original,unreal.PointLight) or any(c.static_mesh and '/Scene_OldMine/Assets/' in c.static_mesh.get_path_name() for c in original.get_components_by_class(unreal.StaticMeshComponent))
   if not inside or not valid:continue
   # Inspect mesh references, including mine-cart parts under generic labels.
   if is_mine_cart_actor(original):continue
   dup=sub.duplicate_actor(original,world,V(0,0,0))
   if not dup:continue
   dup.modify();t=original.get_actor_transform();t.translation=t.translation-pivot
   dup.set_actor_transform(unreal.MathLibrary.compose_transforms(t,basis),False,False)
   label=original.get_actor_label();dup.set_actor_label('MineDemo2_%03d_%03d_%s'%(site,n,label));dup.set_folder_path('Mine_Rebuild/DemoAssemblies')
   if 'Cart' in label and 'Wheel' not in label:
    dup.set_actor_location(center+f*(1100+cartn*200)+right*190+V(0,0,20),False,False);cartn+=1
   if isinstance(dup,unreal.PointLight):
    c=dup.get_component_by_class(unreal.PointLightComponent);c.modify();c.set_editor_property('IntensityUnits',unreal.LightUnits.LUMENS);c.set_intensity(300);c.set_attenuation_radius(700);c.set_light_color(unreal.LinearColor(1,.88,.73,1))
   count+=1
  for actor in sub.get_all_level_actors():
   if not actor.get_actor_label().startswith('MineBeauty4_') or 'track' not in actor.get_actor_label():continue
   for c in actor.get_components_by_class(unreal.HierarchicalInstancedStaticMeshComponent):
    remove=[i for i in range(c.get_instance_count()) if (c.get_instance_transform(i,True).translation-center).length()<900]
    if remove:c.modify();c.remove_instances(remove)
 def host(label,mesh,transforms):
  if not transforms:return
  a=sub.spawn_actor_from_class(unreal.Actor,transforms[0].translation);a.modify();a.set_actor_label(label);a.set_folder_path('Mine_Rebuild/CavernArt')
  h,_=sds.add_new_subobject(unreal.AddNewSubobjectParams(parent_handle=sds.k2_gather_subobject_data_for_instance(a)[0],new_class=unreal.HierarchicalInstancedStaticMeshComponent))
  c=lib.get_associated_object(sds.k2_find_subobject_data_from_handle(h));c.modify();c.set_static_mesh(mesh);c.set_collision_profile_name('BlockAll');c.add_instances(transforms,False,True,False)
 def light(label,p,intensity,radius,color):
  a=sub.spawn_actor_from_class(unreal.PointLight,p);a.modify();a.set_actor_label(label);a.set_folder_path('Mine_Rebuild/CavernArt')
  c=a.get_component_by_class(unreal.PointLightComponent);c.modify();c.set_editor_property('IntensityUnits',unreal.LightUnits.LUMENS);c.set_intensity(intensity);c.set_attenuation_radius(radius);c.set_light_color(color);c.set_editor_property('CastShadows',False)
 slab=unreal.load_asset('/Game/RockEnv_Pack/Meshes/Rocks/SM_Rock_10');bb=slab.get_bounding_box();extent=bb.max-bb.min;mc=(bb.max+bb.min)*.5
 for ci,idx in enumerate([]):
  center=V(*route[idx]['b']);crowns=[]
  for seg in route:
   for end,other in [('a','b'),('b','a')]:
    if math.dist(seg[end],route[idx]['b'])>100:continue
    f=V(*seg[other])-center;f=V(f.x,f.y,0);f=f/f.length();yaw=math.degrees(math.atan2(f.y,f.x));ang=math.radians(yaw)
    sc=V(1400/extent.x,(seg['width_cm']+650)/extent.y,560/extent.z)
    offset=V(mc.x*sc.x*math.cos(ang)-mc.y*sc.y*math.sin(ang),mc.x*sc.x*math.sin(ang)+mc.y*sc.y*math.cos(ang),mc.z*sc.z)
    crowns.append(unreal.Transform(location=center+f*1330+V(0,0,620)-offset,rotation=unreal.Rotator(pitch=0,yaw=yaw,roll=0),scale=sc))
  host('MineCavernSeal_%02d'%ci,slab,crowns)
  for mi,variant in enumerate([2,4,7,11,15]):
   mesh=unreal.load_asset('/Game/RockEnv_Pack/Meshes/Drip_Stones/SM_Drip_Stones_'+str(variant));ts=[]
   for k in range(4):
    angle=2*math.pi*(mi*4+k)/20;p=center+V(math.cos(angle)*1080,math.sin(angle)*1080,0);clear=True
    for seg in route:
     a=V(*seg['a']);b=V(*seg['b']);d=b-a;t=max(0,min(1,((p-a).x*d.x+(p-a).y*d.y+(p-a).z*d.z)/(d.length()**2)))
     if (p-(a+d*t)).length()<500:clear=False;break
    if clear:
     ts.append(unreal.Transform(location=p,rotation=unreal.Rotator(pitch=0,yaw=math.degrees(angle),roll=0),scale=V(1.2,1.2,1.4)))
     ts.append(unreal.Transform(location=p+V(0,0,790),rotation=unreal.Rotator(pitch=180,yaw=math.degrees(angle),roll=0),scale=V(.7,.7,1)))
   host('MineCavernArt_%02d_%02d'%(ci,mi),mesh,ts)
  light('MineCavernSeal_Fill_%02d'%ci,center+V(0,0,550),4500,2200,unreal.LinearColor(.72,.84,1,1))
  for k in range(3):
   angle=k*math.pi*2/3
   light('MineCavernArt_Accent_%02d_%d'%(ci,k),center+V(math.cos(angle)*950,math.sin(angle)*950,180),1600,1300,unreal.LinearColor(1,.85,.69,1))
 saved=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()
 print(json.dumps({'demo_actors':count,'demo_sites':sites,'caverns':7,'saved':saved}))
embellish_v4()
