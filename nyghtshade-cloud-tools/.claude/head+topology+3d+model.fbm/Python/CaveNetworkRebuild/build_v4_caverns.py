def build_v4_caverns():
 import unreal,math,json,os,random
 V=unreal.Vector;sd=os.path.join(unreal.Paths.project_saved_dir(),'CaveNetworkRebuild');data=json.load(open(os.path.join(sd,'CONNECTED_ROUTE_GEOMETRY_V4.json')));edges=data['segments'];rng=random.Random(92841)
 sub=unreal.get_editor_subsystem(unreal.EditorActorSubsystem);sds=unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem);lib=unreal.SubobjectDataBlueprintFunctionLibrary
 for a in sub.get_all_level_actors():
  if a.get_actor_label().startswith(('MineV4_','MineRoomShell_')):
   a.modify();sub.destroy_actor(a)
 nodes=[dict(p=V(*n['position']),links=[]) for n in data['nodes']]
 for i,e in enumerate(edges):
  for j in e['ends']:nodes[j]['links'].append(i)
 heroes={edges[i]['ends'][1] for i in data['hero_segment_ids']};giants={edges[g['segment_id']]['ends'][1]:g for g in data['giant_caverns']}
 rockmat=unreal.load_asset('/Game/Scene_OldMine/Assets/Megascans/Surfaces/Wall_Mine_Rock_01/MI_Wall_Mine_Rock_01_A')
 ground=unreal.load_asset('/Game/Scene_OldMine/Assets/Custom/Ind_Min_Ground/SM_Ind_Min_Ground')
 groundmat=ground.get_material(0)
 watermat=unreal.load_asset('/Game/Generated_Materials/MI_MineSumpWater')
 cliff=unreal.load_asset('/Game/Megascans/3D_Assets/MassiveNordicCoastalCliff/SM_MassiveNordicCoastalCliff_01')
 slab=unreal.load_asset('/Game/RockEnv_Pack/Meshes/Rocks/SM_Rock_10')
 lamp=unreal.load_asset('/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_War_Light_Bulkhead_Metal_Caged_01/SM_Ind_War_Light_Bulkhead_Metal_Caged_01')
 opts=unreal.GeometryScriptPrimitiveOptions()
 def spawn(cls,p,label):
  a=sub.spawn_actor_from_class(cls,p);assert a,label;a.modify();a.set_actor_label('MineV4_'+label);a.set_folder_path('Mine_Rebuild/V4_Caverns');return a
 def dynamic(p,label,mat,collision=True):
  a=spawn(unreal.DynamicMeshActor,p,label);c=a.get_component_by_class(unreal.DynamicMeshComponent);assert c,label;c.modify();m=c.get_dynamic_mesh();m.modify();c.set_material(0,mat)
  c.set_complex_as_simple_collision_enabled(collision,True);c.set_collision_profile_name('BlockAll' if collision else 'NoCollision');return a,c,m
 def box(m,p,size,yaw=0):
  unreal.GeometryScript_Primitives.append_box(m,opts,unreal.Transform(location=p,rotation=unreal.Rotator(pitch=0,yaw=yaw,roll=0)),*size,0,0,0,unreal.GeometryScriptPrimitiveOriginMode.CENTER)
 def buffers(m,vertices,triangles):
  normals=[V(0,0,0) for p in vertices]
  for i,j,k in triangles:
   u=vertices[j]-vertices[i];v=vertices[k]-vertices[i];n=V(u.y*v.z-u.z*v.y,u.z*v.x-u.x*v.z,u.x*v.y-u.y*v.x)
   for q in (i,j,k):normals[q]=normals[q]+n
  normals=[n/n.length() if n.length()>1e-7 else V(0,0,1) for n in normals]
  b=unreal.GeometryScriptSimpleMeshBuffers(vertices=vertices,normals=normals,uv0=[unreal.Vector2D(p.x/250,p.y/250) for p in vertices],vertex_colors=[unreal.LinearColor(1,1,1,1) for p in vertices],triangles=[unreal.IntVector(t[0],t[2],t[1]) for t in triangles])
  unreal.GeometryScript_MeshEdits.append_buffers_to_mesh(m,b,0,False)
 def finish(c,m):
  unreal.GeometryScript_UVs.set_mesh_u_vs_from_box_projection(m,0,unreal.Transform(scale=V(250,250,250)),unreal.GeometryScriptMeshSelection());c.set_complex_as_simple_collision_enabled(True,True);c.update_collision(False)
 def host(label,mesh,ts,collision=False):
  if not ts:return
  a=spawn(unreal.Actor,ts[0].translation,label);root=sds.k2_gather_subobject_data_for_instance(a)[0];h,_=sds.add_new_subobject(unreal.AddNewSubobjectParams(parent_handle=root,new_class=unreal.HierarchicalInstancedStaticMeshComponent));c=lib.get_associated_object(sds.k2_find_subobject_data_from_handle(h));c.modify();c.set_static_mesh(mesh);c.set_collision_profile_name('BlockAll' if collision else 'NoCollision');c.add_instances(ts,False,True,False)
 def light(label,p,intensity,radius,color,shadow=False):
  a=spawn(unreal.PointLight,p,label);c=a.get_component_by_class(unreal.PointLightComponent);c.modify();c.set_editor_property('IntensityUnits',unreal.LightUnits.LUMENS);c.set_intensity(intensity);c.set_attenuation_radius(radius);c.set_light_color(unreal.LinearColor(*color,1));c.set_editor_property('SourceRadius',100);c.set_editor_property('CastShadows',shadow);return a
 water_source=next(a for a in sub.get_all_level_actors() if a.get_actor_label()=='Sump_WaterVolume')
 world=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
 room_count=0;lake_count=0
 for ni,n in enumerate(nodes):
  p=n['p'];links=n['links'];dirs=[]
  for ei in links:
   e=edges[ei];other=e['ends'][1] if e['ends'][0]==ni else e['ends'][0];d=nodes[other]['p']-p;dirs.append(d/d.length())
  bend=len(dirs)!=2 or sum(dirs[0].to_tuple()[j]*dirs[1].to_tuple()[j] for j in range(3))>-.985
  if not bend and ni not in heroes and ni not in giants:continue
  room_count+=1;g=giants.get(ni);radius=g['radius'] if g else (1500 if ni in heroes else 620);height=g['height'] if g else (800 if ni in heroes else 430)
  if ni==edges[220]['ends'][1]:radius=1700;height=430
  a,c,m=dynamic(p,'Room_%03d'%ni,rockmat);N=96 if g else 64;wall_height=height*.66 if g else height;opening_height=360
  # Continuous wall ring, with actual apertures aligned to every connected tunnel.
  for j in range(N):
   angle=2*math.pi*(j+.5)/N;rad=V(math.cos(angle),math.sin(angle),0);opening=False;slope=0
   for ei,d in zip(links,dirs):
    half=edges[ei]['width_cm']*.5+30
    if rad.x*d.x+rad.y*d.y>math.cos(math.asin(min(.98,half/radius))+math.pi/N):opening=True;slope=d.z/max(.01,math.hypot(d.x,d.y))
   bottom=opening_height+radius*slope if opening else -100
   high=max(80,wall_height-bottom)
   box(m,rad*(radius+80)+V(0,0,bottom+high*.5),(200,2*(radius+100)*math.tan(math.pi/N)+15,high),math.degrees(angle))
  # Vaulted ceiling: a continuous rock surface behind the full-resolution formations.
  verts=[V(0,0,height)];tris=[]
  for ring in range(1,5):
   rr=(radius+170)*ring/4;z=height-(height-wall_height)*(ring/4)**2
   for j in range(N):
    ang=2*math.pi*j/N;verts.append(V(math.cos(ang)*rr,math.sin(ang)*rr,z))
  for j in range(N):tris.append((0,1+(j+1)%N,1+j))
  for ring in range(1,4):
   inner=1+(ring-1)*N;outer=1+ring*N
   for j in range(N):
    q=(j+1)%N;tris.extend([(inner+j,inner+q,outer+q),(inner+j,outer+q,outer+j)])
  buffers(m,verts,tris);finish(c,m)
  fa,fc,fm=dynamic(p,'Floor_%03d'%ni,groundmat)
  yaw=0
  if g:
   incoming=dirs[0]*-1;yaw=math.degrees(math.atan2(incoming.y,incoming.x));fa.modify();fa.set_actor_rotation(unreal.Rotator(pitch=0,yaw=yaw,roll=0),False)
  if g and g['water']:
   # A deep basin occupies one side. The 12m-wide central promenade stays dry.
   xmin,xmax=-radius*.58,radius*.58;ymin,ymax=radius*.20,radius*.73;outer=radius+200
   box(fm,V((-outer+xmin)*.5,0,-25),(xmin+outer,2*outer,50));box(fm,V((xmax+outer)*.5,0,-25),(outer-xmax,2*outer,50))
   box(fm,V((xmin+xmax)*.5,(-outer+ymin)*.5,-25),(xmax-xmin,ymin+outer,50));box(fm,V((xmin+xmax)*.5,(ymax+outer)*.5,-25),(xmax-xmin,outer-ymax,50))
   box(fm,V((xmin+xmax)*.5,(ymin+ymax)*.5,-475),(xmax-xmin,ymax-ymin,50))
   for yy in [ymin,ymax]:box(fm,V(0,yy,-240),(xmax-xmin,40,480))
   for xx in [xmin,xmax]:box(fm,V(xx,(ymin+ymax)*.5,-240),(40,ymax-ymin,480))
   ra=V(-radius*.35,ymin-100,0);rb=V(-radius*.35,ymin+1400,-450);delta=rb-ra;pitch=math.degrees(math.atan2(delta.z,delta.y))
   unreal.GeometryScript_Primitives.append_box(fm,opts,unreal.Transform(location=(ra+rb)*.5-V(0,0,25),rotation=unreal.Rotator(pitch=pitch,yaw=90,roll=0)),delta.length()+40,750,50,0,0,0,unreal.GeometryScriptPrimitiveOriginMode.CENTER)
   t=unreal.Transform(location=p,rotation=unreal.Rotator(pitch=0,yaw=yaw,roll=0));lake_center=unreal.MathLibrary.transform_location(t,V(0,(ymin+ymax)*.5,-180))
   wa,wc,wm=dynamic(lake_center,'Lake_%03d'%ni,watermat,False);wa.modify();wa.set_actor_rotation(unreal.Rotator(pitch=0,yaw=yaw,roll=0),False);box(wm,V(0,0,0),(xmax-xmin,ymax-ymin,2))
   volume=sub.duplicate_actor(water_source,world,V(0,0,0));volume.modify();volume.set_actor_label('MineV4_LakeVolume_%03d'%ni);volume.set_folder_path('Mine_Rebuild/V4_Caverns');volume.set_actor_location(lake_center-V(0,0,135),False,False);volume.set_actor_rotation(unreal.Rotator(pitch=0,yaw=yaw,roll=0),False);volume.set_actor_scale3d(V((xmax-xmin)/200,(ymax-ymin)/200,270/200));lake_count+=1
  else:
   # Fan floor follows the slope of each ramp mouth to avoid a step at the room edge.
   verts=[V(0,0,0)];tris=[]
   for j in range(N):
    angle=2*math.pi*j/N;rad=V(math.cos(angle),math.sin(angle),0);rr=radius+180
    weights=[max(0,rad.x*d.x+rad.y*d.y)**8 for d in dirs];sw=sum(weights)
    z=sum(w*d.z/max(.01,math.hypot(d.x,d.y))*rr for w,d in zip(weights,dirs))/sw if sw>.001 else 0
    verts.append(rad*rr+V(0,0,z))
   for j in range(N):tris.append((0,j+1,(j+1)%N+1))
   buffers(fm,verts,tris)
  finish(fc,fm)
  light('RoomFill_%03d'%ni,p+V(0,0,min(height*.62,1700)),2300 if not g else 42000,radius*1.65,(.72,.84,1) if ni in heroes or g else (1,.84,.68))
  # Imported, full-detail rock surfaces form the cavern's visible perimeter.
  if g:
   ts=[];bb=cliff.get_bounding_box();mid=(bb.min+bb.max)*.5
   cliff_count=round(2*math.pi*radius/1450)
   for j in range(cliff_count):
    angle=2*math.pi*(j+rng.uniform(-.17,.17))/cliff_count;rad=V(math.cos(angle),math.sin(angle),0)
    if any(rad.x*d.x+rad.y*d.y>math.cos(math.asin(min(.98,1500/radius))) for d in dirs):continue
    for layer in range(1):
     rot=unreal.Rotator(pitch=rng.uniform(-14,14),yaw=math.degrees(angle)+rng.choice([75,100,250,280]),roll=rng.uniform(-13,13));sc=rng.uniform(1.12,1.52);rotation=unreal.Transform(rotation=rot,scale=V(sc,sc,sc));offset=unreal.MathLibrary.transform_location(rotation,mid)
     target=p+rad*(radius+rng.uniform(150,500))+V(0,0,850+rng.uniform(-180,320))
     ts.append(unreal.Transform(location=target-offset,rotation=rot,scale=V(sc,sc,sc)))
   host('Cliffs_%03d'%ni,cliff,ts)
   formation_ts=[]
   for k in range(7):
    angle=k*2*math.pi/7+.2;rad=V(math.cos(angle),math.sin(angle),0)
    if any(rad.x*d.x+rad.y*d.y>.92 for d in dirs):continue
    q=p+rad*(radius*.72);light('GrottoAccent_%03d_%d'%(ni,k),q+V(0,0,350),8500,radius*.70,(1,.83,.65),k%3==0)
   # Native scan roof shelves break up the continuous vault silhouette.
   shelf=unreal.load_asset('/Game/Megascans/3D_Assets/ForestRockShelf/SM_ForestRockShelf_01');sb=shelf.get_bounding_box();smid=(sb.min+sb.max)*.5
   roof=[]
   for k in range(16):
    angle=k*2*math.pi/16;rr=radius*rng.uniform(.45,.8);rot=unreal.Rotator(pitch=180,yaw=rng.uniform(-180,180),roll=0);sc=rng.uniform(.8,1.15);offset=unreal.MathLibrary.transform_location(unreal.Transform(rotation=rot,scale=V(sc,sc,sc)),smid);z=height-(height-wall_height)*(rr/radius)**2
    roof.append(unreal.Transform(location=p+V(math.cos(angle)*rr,math.sin(angle)*rr,z-40)-offset,rotation=rot,scale=V(sc,sc,sc)))
   host('RoofShelves_%03d'%ni,shelf,roof)
  if ni in heroes or g:
   formations=unreal.load_asset('/Game/RockEnv_Pack/Meshes/Drip_Stones/SM_Drip_Stones_4');ts=[]
   for j in range(18 if g else 10):
    angle=rng.uniform(0,math.pi*2);rad=V(math.cos(angle),math.sin(angle),0)
    if any(rad.x*d.x+rad.y*d.y>math.cos(math.asin(min(.98,650/radius))) for d in dirs):continue
    pos=p+rad*radius*.80;scale=rng.uniform(.9,1.8);ts.append(unreal.Transform(location=pos,rotation=unreal.Rotator(pitch=0,yaw=rng.uniform(-180,180),roll=0),scale=V(scale,scale,scale*1.5)))
    ts.append(unreal.Transform(location=pos+V(0,0,wall_height-30),rotation=unreal.Rotator(pitch=180,yaw=rng.uniform(-180,180),roll=0),scale=V(scale,scale,scale*1.3)))
   host('Formations_%03d'%ni,formations,ts)
  # Practical caged lights identify each gateway and visibly motivate warm illumination.
  fixture_ts=[]
  for k,(ei,d) in enumerate(zip(links,dirs)):
   right=V(-d.y,d.x,0);right=right/max(.001,right.length())
   for side in [-1,1]:
    q=p+d*(radius*.94)+right*side*(edges[ei]['width_cm']*.5-55)+V(0,0,230)
    fixture_ts.append(unreal.Transform(location=q,rotation=unreal.Rotator(pitch=0,yaw=math.degrees(math.atan2(d.y,d.x))+90*side,roll=0),scale=V(1.8,1.8,1.8)))
    light('PortalLight_%03d_%d_%d'%(ni,k,side),q-right*side*70,250,800,(1,.84,.68))
  host('PortalFixtures_%03d'%ni,lamp,fixture_ts)
 # Extend the established exposure treatment over all new districts, keeping underwater priority.
 for a in sub.get_all_level_actors():
  if a.get_actor_label()=='Mine_CinematicExposure':
   a.modify();a.set_actor_location(V(45000,-15000,33500),False,False);b=a.get_component_by_class(unreal.BoxComponent);b.modify();b.set_box_extent(V(160000,160000,14000),False)
 print(json.dumps({'continuous_rooms':room_count,'giant_caverns':len(giants),'new_lakes':lake_count,'saved':unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True,True)}))
 with open(os.path.join(sd,'V4_CAVERNS_COMPLETE.json'),'w') as f:json.dump({'rooms':room_count,'giants':data['giant_caverns'],'lakes':lake_count},f,indent=2)
build_v4_caverns()
