import unreal, os, json, math, random
from mine_cart_policy import is_mine_cart_asset
sd=os.path.join(unreal.Paths.project_saved_dir(),'CaveNetworkRebuild')
data=json.load(open(os.path.join(sd,'RECOVERED_ROUTE_GEOMETRY.json')))
eas=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
sds=unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
lib=unreal.SubobjectDataBlueprintFunctionLibrary
rng=random.Random(92726)
V=unreal.Vector
def vec(p): return V(float(p[0]),float(p[1]),float(p[2]))
def norm(v):
 l=math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z)
 return v/l
# Reconcile measured endpoints at the same 1m tolerance used by the verified repair.
nodes=[]; edges=[]
for s in data['segments']:
 ids=[]
 for p in [s['a'],s['b']]:
  found=next((i for i,n in enumerate(nodes) if math.dist(p,n['p'])<100),None)
  if found is None:
   found=len(nodes);nodes.append({'p':list(p),'links':[]})
  ids.append(found)
 edges.append(dict(s,ends=ids))
for i,s in enumerate(edges):
 for n in s['ends']:nodes[n]['links'].append(i)
hero_ids=[edges[i]['ends'][1] for i in [20,45,70,98,132,159,190]]
for ni,n in enumerate(nodes):
 dirs=[]
 for ei in n['links']:
  s=edges[ei]; other=s['ends'][1] if s['ends'][0]==ni else s['ends'][0]
  dirs.append(norm(vec(nodes[other]['p'])-vec(n['p'])))
 n['dirs']=dirs
 n['room']=len(dirs)!=2 or sum(dirs[0].to_tuple()[k]*dirs[1].to_tuple()[k] for k in range(3))>-0.985
 n['radius']=1500 if ni in hero_ids else 620
 n['height']=800 if ni in hero_ids else 350
 if ni in hero_ids:n['room']=True
paths={
 'old':'/Game/Scene_OldMine/Assets/Custom/Ind_Min_Cave/SM_Ind_Min_Cave',
 'natural':'/Game/RockEnv_Pack/Meshes/Tunnel_Caves/SM_Tunnel_Cave_1',
 'deep':'/Game/RockEnv_Pack/Meshes/Tunnel_Caves/SM_Tunnel_Cave_10',
 'rock':'/Game/RockEnv_Pack/Meshes/Rocks/SM_Rock_1',
 'slab':'/Game/RockEnv_Pack/Meshes/Rocks/SM_Rock_10',
 'pebble':'/Game/RockEnv_Pack/Meshes/Small_Rocks/SM_Small_Rock_1',
 'ground':'/Game/Scene_OldMine/Assets/Custom/Ind_Min_Ground/SM_Ind_Min_Ground',
 'beam':'/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Beam_Square_Wood_Worn_03/SM_Ind_Min_Beam_Square_Wood_Worn_03',
 'track':'/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Rail_Tracks_Wood_Modular_01/SM_Ind_Min_Rail_Tracks_Wood_Modular_01_A',
 'lamp':'/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_War_Light_Bulkhead_Metal_Caged_01/SM_Ind_War_Light_Bulkhead_Metal_Caged_01',
 'cart':'/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Cart_Metal_Old_01/SM_Ind_Min_Cart_Metal_Old_01'}
meshes={k:unreal.load_asset(p) for k,p in paths.items()}
assert all(meshes.values()),'Missing required imported mesh'
groups={};light_specs=[];roof_boxes=[]
def add(chunk,key,p,rot=None,scale=None):
 # Keep argument evaluation/RNG draws, but never queue removed carts.
 if is_mine_cart_asset(paths[key]):return
 groups.setdefault((chunk,key),[]).append(unreal.Transform(location=p,rotation=rot or unreal.Rotator(pitch=0,yaw=0,roll=0),scale=scale or V(1,1,1)))
def center_rock(chunk,key,p,size,yaw):
 b=meshes[key].get_bounding_box(); extent=b.max-b.min;center=(b.max+b.min)*0.5
 sc=V(size[0]/extent.x,size[1]/extent.y,size[2]/extent.z)
 ang=math.radians(yaw);offset=V(center.x*sc.x*math.cos(ang)-center.y*sc.y*math.sin(ang),center.x*sc.x*math.sin(ang)+center.y*sc.y*math.cos(ang),center.z*sc.z)
 add(chunk,key,p-offset,unreal.Rotator(pitch=0,yaw=yaw,roll=0),sc)
for i,s in enumerate(edges):
 na,nb=[nodes[n] for n in s['ends']];a=vec(na['p']);b=vec(nb['p']);d=b-a
 length=math.sqrt(d.x*d.x+d.y*d.y+d.z*d.z); f=d/length
 right=norm(V(-f.y,f.x,0));up=norm(V(f.y*right.z-f.z*right.y,f.z*right.x-f.x*right.z,f.x*right.y-f.y*right.x))
 rot=unreal.MathLibrary.make_rot_from_yz(f,up)
 yaw=math.degrees(math.atan2(f.y,f.x));pitch=math.degrees(math.asin(f.z))
 chunk=s['source'];width=s['width_cm'];sump=chunk.startswith('Sump')
 key='old' if i<75 or sump else ('natural' if i<150 else 'deep')
 mb=meshes[key].get_bounding_box();sz=mb.max-mb.min
 start=min(na['radius']*0.74,length*.3) if na['room'] else 0
 finish=length-(min(nb['radius']*.74,length*.3) if nb['room'] else 0)
 target_height=300 if sump else (350 if key=='old' else 430)
 sx=(width+65)/sz.x;sy=1;szscale=target_height/sz.z
 count=max(1,math.ceil((finish-start)/(sz.y*.94)))
 step=(finish-start)/count;sy=(step+65)/sz.y
 for j in range(count):
  dist=start+(j+.5)*step
  p=a+f*dist-f*((mb.min.y+mb.max.y)*.5*sy)
  # The module's native floor datum is approximately Z=0; lower 5cm to avoid z fighting.
  p=p-up*5
  add(chunk,key,p,rot,V(sx,sy,szscale))
 # Timbers and track on upper developed mine levels, leaving full pedestrian clearance.
 if i<75:
  for dist in range(int(start+350),int(finish-150),800):
   p=a+f*dist
   for side in [-1,1]:
    add(chunk,'beam',p+right*(side*(width*.5-75))+up*155,unreal.Rotator(pitch=90,yaw=yaw,roll=0),V(2.55,2,2))
   add(chunk,'beam',p+up*310,unreal.Rotator(pitch=0,yaw=yaw+90,roll=0),V((width-90)/123,2.4,2.4))
  for dist in range(int(start+80),int(finish-260),250):
   add(chunk,'track',a+f*dist+up*2,unreal.Rotator(pitch=pitch,yaw=yaw,roll=0),V(1,1,0.48))
 for dist in range(int(start+450),int(finish-150),1700):
  p=a+f*dist+right*(width*.5-75)+up*230
  add(chunk,'lamp',p,unreal.Rotator(pitch=0,yaw=yaw+90,roll=0),V(1.6,1.6,1.6))
  light_specs.append((p-right*90, i<75, i))
 for j in range(max(1,int(length/700))):
  dist=rng.uniform(start,finish);side=rng.choice([-1,1])
  p=a+f*dist+right*(side*rng.uniform(width*.35,width*.46))+up*6
  add(chunk,'pebble',p,unreal.Rotator(pitch=0,yaw=rng.uniform(-180,180),roll=0),V(rng.uniform(3,8),rng.uniform(3,8),rng.uniform(2,5)))
# Junctions are rooms with openings aligned to every connected edge, not overlapping closed tunnel sidewalls.
for ni,n in enumerate(nodes):
 if not n['room']:continue
 p=vec(n['p']);radius=n['radius'];height=n['height'];chunk='Junction_%03d'%ni
 add(chunk,'ground',p+V(0,0,1),scale=V(radius*2.5/100,radius*2.5/100,1))
 roof_boxes.append((p+V(0,0,height+70),radius*2.5,height))
 for j in range(24):
  ang=2*math.pi*j/24;junction_direction=V(math.cos(ang),math.sin(ang),0)
  opening=False
  for ei,d in zip(n['links'],n['dirs']):
   half=edges[ei]['width_cm']*.5+140
   if junction_direction.x*d.x+junction_direction.y*d.y>math.cos(math.asin(min(.95,half/radius))):opening=True
  if opening:continue
  center_rock(chunk,'rock',p+junction_direction*radius+V(0,0,height*.48),(radius*.55, radius*.55,height*1.1),math.degrees(ang)+rng.uniform(-20,20))
 for xx in [-.66,0,.66]:
  for yy in [-.66,0,.66]:
   center_rock(chunk,'slab',p+V(radius*xx,radius*yy,height+80),(radius*.98,radius*.98,210),rng.uniform(-15,15))
 light_specs.append((p+V(0,0,min(height-80,450)), ni not in hero_ids,ni))
 if ni in hero_ids:
  # Broken side workings, rubble at room edges, and an abandoned cart leave the central route clear.
  for j in range(14):
   ang=rng.uniform(0,math.pi*2)
   q=p+V(math.cos(ang)*radius*.8,math.sin(ang)*radius*.8,rng.uniform(10,90))
   center_rock(chunk,'rock',q,(rng.uniform(100,250),rng.uniform(100,230),rng.uniform(80,200)),rng.uniform(-180,180))
  add(chunk,'cart',p+V(radius*.55,0,0),unreal.Rotator(pitch=0,yaw=ni*17,roll=0),V(1.4,1.4,1.4))
with unreal.ScopedEditorTransaction('Build imported mine cave network art pass'):
 # Preserve the earlier generated pass as a disabled recoverable set.
 for old in eas.get_all_level_actors():
  label=old.get_actor_label()
  if label.startswith('MineBeauty2_'):
   old.modify();eas.destroy_actor(old)
  elif label.startswith('MineBeauty_'):
   old.modify();old.set_actor_hidden_in_game(True);old.set_is_temporarily_hidden_in_editor(True);old.set_actor_enable_collision(False)
  elif label.startswith(('Mine_Timber_','Mine_Lamp_','Mine_Light_','Mine_CavLight_','Mine_Partial','Mine_Hero','Mine_Cavern_')):
   old.modify();old.set_actor_hidden_in_game(True);old.set_is_temporarily_hidden_in_editor(True);old.set_actor_enable_collision(False)
  elif label.startswith(('Mine_Drift_Walls','Sump_Walls')):
   old.modify();old.set_actor_hidden_in_game(True);old.set_is_temporarily_hidden_in_editor(True);old.set_actor_enable_collision(False)
  elif label.startswith(('Mine_Drift_Floors','Sump_Floors')):
   old.modify();old.set_actor_hidden_in_game(True);old.set_is_temporarily_hidden_in_editor(True)
 total=0;hosts=[]
 for (chunk,key),transforms in groups.items():
  host=eas.spawn_actor_from_class(unreal.Actor,transforms[0].translation)
  host.modify();host.set_actor_label('MineBeauty2_'+chunk+'_'+key);host.set_folder_path('Mine_Rebuild/ImportedAssets/'+chunk)
  handles=sds.k2_gather_subobject_data_for_instance(host)
  h,reason=sds.add_new_subobject(unreal.AddNewSubobjectParams(parent_handle=handles[0],new_class=unreal.HierarchicalInstancedStaticMeshComponent))
  c=lib.get_associated_object(sds.k2_find_subobject_data_from_handle(h));assert c,str(reason)
  c.modify();c.set_static_mesh(meshes[key]);c.set_collision_profile_name('BlockAll' if key in ['old','natural','deep','rock','ground'] else 'NoCollision')
  c.set_editor_property('CastShadow',True)
  c.add_instances(transforms,False,True,False)
  total+=c.get_instance_count();hosts.append(host.get_actor_label())
 # One structural ceiling/floor component per junction; imported rocks cover visible ceiling surfaces.
 for j,(p,size,height) in enumerate(roof_boxes):
  a=eas.spawn_actor_from_class(unreal.DynamicMeshActor,V(0,0,0));a.modify()
  a.set_actor_label('MineBeauty2_JunctionShell_%03d'%j);a.set_folder_path('Mine_Rebuild/JunctionShells')
  c=a.get_component_by_class(unreal.DynamicMeshComponent);c.modify();m=c.get_dynamic_mesh();m.modify()
  for loc,depth in [(p,100),(p-V(0,0,height+90),40)]:
   unreal.GeometryScript_Primitives.append_box(m,unreal.GeometryScriptPrimitiveOptions(),unreal.Transform(location=loc,rotation=unreal.Rotator(pitch=0,yaw=0,roll=0),scale=V(1,1,1)),size,size,depth,0,0,0,unreal.GeometryScriptPrimitiveOriginMode.CENTER)
  c.set_material(0,unreal.load_asset('/Game/Scene_OldMine/Assets/Megascans/Surfaces/Wall_Mine_Rock_01/MI_Wall_Mine_Rock_01_A'))
  c.set_complex_as_simple_collision_enabled(True,True);c.set_collision_profile_name('BlockAll');c.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS)
 for j,(p,warm,seg) in enumerate(light_specs):
  a=eas.spawn_actor_from_class(unreal.PointLight,p);a.modify();a.set_actor_label('MineBeauty2_Light_%04d'%j);a.set_folder_path('Mine_Rebuild/Lighting')
  c=a.get_component_by_class(unreal.PointLightComponent);c.modify()
  c.set_intensity(2600 if warm else 1700)
  c.set_light_color(unreal.LinearColor(1,.62,.30,1) if warm else unreal.LinearColor(.37,.65,.78,1))
  c.set_editor_property('AttenuationRadius',1500.0)
  c.set_editor_property('CastShadows',False)
  c.set_editor_property('IndirectLightingIntensity',0.5)
result={'stage':'imported_asset_art_pass','segments':len(edges),'junction_rooms':len(roof_boxes),'large_caverns':len(hero_ids),'instances':total,'instance_hosts':len(hosts),'lights':len(light_specs),'mesh_paths':paths,'visual_and_full_traversal_verified':False}
with open(os.path.join(sd,'BEAUTY_BUILD_RESULT.json'),'w') as f:json.dump(result,f,indent=2)
print(json.dumps(result))
print('saved',unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level())
