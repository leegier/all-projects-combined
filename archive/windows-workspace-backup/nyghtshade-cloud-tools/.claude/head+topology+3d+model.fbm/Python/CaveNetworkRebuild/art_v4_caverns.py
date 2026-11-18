def art_v4_caverns():
 import unreal,math,json,os,random
 V=unreal.Vector;rng=random.Random(92898);sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem);sds=unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem);lib=unreal.SubobjectDataBlueprintFunctionLibrary
 data=json.load(open(os.path.join(unreal.Paths.project_saved_dir(),'CaveNetworkRebuild','CONNECTED_ROUTE_GEOMETRY_V4.json')));route=data['segments'];actors=sub.get_all_level_actors()
 for a in actors:
  if a.get_actor_label().startswith('MineV4Art_'):a.modify();sub.destroy_actor(a)
 meshes=[unreal.load_asset('/Game/Megascans/3D_Assets/MassiveNordicCoastalCliff/SM_MassiveNordicCoastalCliff_01'),unreal.load_asset('/Game/Megascans/3D_Assets/HugeSandstoneCliff/SM_HugeSandstoneCliff_01')]
 pebble=unreal.load_asset('/Game/RockEnv_Pack/Meshes/Rocks/SM_Rock_10');lamp=unreal.load_asset('/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_War_Light_Bulkhead_Metal_Caged_01/SM_Ind_War_Light_Bulkhead_Metal_Caged_01')
 def transform_center(mesh,p,rot,scale):
  bb=mesh.get_bounding_box();mid=(bb.min+bb.max)*.5;off=unreal.MathLibrary.transform_location(unreal.Transform(rotation=rot,scale=V(scale,scale,scale)),mid)
  return unreal.Transform(location=p-off,rotation=rot,scale=V(scale,scale,scale))
 def host(label,mesh,ts):
  if not ts:return
  a=sub.spawn_actor_from_class(unreal.Actor,ts[0].translation);a.modify();a.set_actor_label('MineV4Art_'+label);a.set_folder_path('Mine_Rebuild/V4_ArtDirection');h,_=sds.add_new_subobject(unreal.AddNewSubobjectParams(parent_handle=sds.k2_gather_subobject_data_for_instance(a)[0],new_class=unreal.HierarchicalInstancedStaticMeshComponent));c=lib.get_associated_object(sds.k2_find_subobject_data_from_handle(h));c.modify();c.set_static_mesh(mesh);c.set_collision_profile_name('NoCollision');c.add_instances(ts,False,True,False)
 count=0
 for gi,g in enumerate(data['giant_caverns']):
  center=V(*g['center']);r=g['radius'];height=g['height'];ni=route[g['segment_id']]['ends'][1];groups=[[],[]]
  # Interlocking, native-scale cliff fragments form a rough vault rather than a visible tiled dome.
  step=1000
  for ix in range(-int(r/step),int(r/step)+1):
   for iy in range(-int(r/step),int(r/step)+1):
    x=ix*step+rng.uniform(-240,240);y=iy*step+rng.uniform(-240,240);rr=math.hypot(x,y)
    if rr>r*.97:continue
    z=height-height*.34*(rr/r)**2+340+rng.uniform(-160,220)
    mi=(ix+iy)%2;rot=unreal.Rotator(pitch=rng.choice([-90,90])+rng.uniform(-20,20),yaw=rng.uniform(-180,180),roll=rng.uniform(-25,25));sc=rng.uniform(.82,1.16)
    groups[mi].append(transform_center(meshes[mi],center+V(x,y,z),rot,sc));count+=1
  # Irregular overhanging rock shoulders hide the straight backing wall/roof junction.
  incoming=center-V(*route[g['segment_id']]['a']);incoming=incoming/incoming.length();portal=incoming*-1
  for j in range(26):
   angle=2*math.pi*(j+rng.uniform(-.22,.22))/26;rad=V(math.cos(angle),math.sin(angle),0)
   if rad.x*portal.x+rad.y*portal.y>.96:continue
   mi=j%2;rot=unreal.Rotator(pitch=rng.uniform(30,70),yaw=math.degrees(angle)+rng.uniform(50,120),roll=rng.uniform(-20,20));sc=rng.uniform(.85,1.22)
   groups[mi].append(transform_center(meshes[mi],center+rad*(r+150)+V(0,0,height*.64+rng.uniform(-300,400)),rot,sc));count+=1
  for mi,ts in enumerate(groups):host('Vault_%d_%d'%(gi,mi),meshes[mi],ts)
  # Subtle cool depth fill under the practical warm lighting.
  for a in sub.get_all_level_actors():
   label=a.get_actor_label()
   if label=='MineV4_RoomFill_%03d'%ni:
    a.modify();c=a.get_component_by_class(unreal.PointLightComponent);c.modify();c.set_intensity(9500);c.set_light_color(unreal.LinearColor(.48,.68,.82,1));c.set_editor_property('SourceRadius',350)
  if g['water']:
   yaw=math.degrees(math.atan2(incoming.y,incoming.x));basis=unreal.Transform(location=center,rotation=unreal.Rotator(pitch=0,yaw=yaw,roll=0));ts=[]
   xmin,xmax=-r*.58,r*.58;ymin,ymax=r*.2,r*.73
   for y in [ymin,ymax]:
    for j in range(int((xmax-xmin)/150)+1):
     x=xmin+j*150
     if y==ymin and abs(x+r*.35)<600:continue
     p=unreal.MathLibrary.transform_location(basis,V(x+rng.uniform(-70,70),y+rng.uniform(-90,90),rng.uniform(-45,10)));ts.append(transform_center(pebble,p,unreal.Rotator(pitch=rng.uniform(-15,15),yaw=rng.uniform(-180,180),roll=rng.uniform(-10,10)),rng.uniform(.7,1.25)))
   for x in [xmin,xmax]:
    for j in range(int((ymax-ymin)/150)+1):
     p=unreal.MathLibrary.transform_location(basis,V(x+rng.uniform(-90,90),ymin+j*150,rng.uniform(-45,10)));ts.append(transform_center(pebble,p,unreal.Rotator(pitch=rng.uniform(-10,10),yaw=rng.uniform(-180,180),roll=0),rng.uniform(.7,1.2)))
   host('Shore_%d'%gi,pebble,ts)
 # Sink patch borders into the base surface, leaving only the scanned stone relief visible.
 for a in sub.get_all_level_actors():
  if a.get_actor_label().startswith('MineV4Fix_Surface_') and 'SunkPatchEdges' not in [str(t) for t in a.tags]:
   a.modify();a.set_actor_location(a.get_actor_location()-V(0,0,5.5),False,False);a.tags=list(a.tags)+[unreal.Name('SunkPatchEdges')]
 print(json.dumps({'native_scale_vault_cliff_instances':count,'saved':unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True,True)}))
art_v4_caverns()
