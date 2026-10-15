"""Install offline V5 alignment using a runtime BP route spline.

Executed installer, retained for repeatable maintenance. Entry point:
  build_v5_rails('/Game/.../BP_MineRailRoute')
The caller owns creating/compiling that Blueprint and runtime cart behavior.
"""
def build_v5_rails(route_blueprint_path, force=False, reuse_existing=False):
    import unreal, json, math, os, hashlib, time
    sd=os.path.join(unreal.Paths.project_saved_dir(),'CaveNetworkRebuild')
    fn=os.path.join(sd,'RAIL_NETWORK_V5.json')
    raw=open(fn,'rb').read(); data=json.loads(raw); digest=hashlib.sha256(raw).hexdigest()
    marker=os.path.join(sd,'RAIL_V5_BUILD.json')
    # User-authorized local construction adjustment, explicitly bounded. Support
    # collision and actual cart/headroom sweeps remain required acceptance checks.
    RAISED_BED_AUTHORIZED=True
    assert not data['footprint_failures'], 'Uncontained rail footprint'
    assert RAISED_BED_AUTHORIZED and data['height_audit']['max_railbed_lift_cm']<=150, 'Raised bed exceeds reviewed envelope'
    eas=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    sds=unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    lib=unreal.SubobjectDataBlueprintFunctionLibrary
    world=unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    assert world and world.get_path_name().split('.')[0]=='/Game/Untitled', 'Mine map must already be loaded; this installer does not move the camera or load maps'
    owned=eas.get_all_level_actors(); routes=[a for a in owned if a.get_actor_label()=='MineRailV5_Route']
    if not force and os.path.exists(marker):
        old=json.load(open(marker))
        if old.get('alignment_sha256')==digest and routes and any(a.get_actor_label().startswith('MineRailV5_Art_') for a in owned):
            print('V5 rail build already present; preserved');return old
    V=unreal.Vector; CS=unreal.SplineCoordinateSpace.WORLD
    mesh=unreal.load_asset('/Game/Scene_OldMine/Assets/Megascans/3D_Assets/Ind_Min_Rail_Tracks_Wood_Modular_01/SM_Ind_Min_Rail_Tracks_Wood_Modular_01_B')
    material=unreal.load_asset('/Game/Generated_Materials/MI_MineV4_SealedGround')
    assert mesh and material, 'Required existing rail/bed assets missing'
    if routes:route=routes[0]
    else:
        cls=unreal.EditorAssetLibrary.load_blueprint_class(route_blueprint_path)
        assert cls, 'Compile BP_MineRailRoute before installing track'
        route=eas.spawn_actor_from_class(cls,V(0,0,0));assert route
    route.modify();route.set_actor_label('MineRailV5_Route');route.set_folder_path('Mine_Rebuild/V5_Rail/Runtime')
    splines=route.get_components_by_class(unreal.SplineComponent)
    spline=next((c for c in splines if c.get_name()=='RouteSpline'),splines[0] if splines else None)
    assert spline, 'BP_MineRailRoute needs a persisted RouteSpline component'
    # Flags can rerun construction and invalidate this component pointer. Set
    # them before population, then reacquire the live instance component.
    spline.modify();spline.set_editor_property('bSplineHasBeenEdited',True)
    spline.set_editor_property('bInputSplinePointsToConstructionScript',False)
    splines=route.get_components_by_class(unreal.SplineComponent)
    spline=next((c for c in splines if c.get_name()=='RouteSpline'),splines[0])
    spline.modify();spline.clear_spline_points(False)
    rows=data['samples']; points=[V(p['position_cm'][0],p['position_cm'][1],p['position_cm'][2]+75.5) for p in rows];N=len(points)
    for p in points:spline.add_spline_point(p,CS,False)
    for i,row in enumerate(rows):
        t=V(*row['tangent_unit']);prev=(points[i]-points[(i-1)%N]).length();nxt=(points[(i+1)%N]-points[i]).length()
        spline.set_spline_point_type(i,unreal.SplinePointType.CURVE_CUSTOM_TANGENT,False)
        spline.set_tangents_at_spline_point(i,t*prev,t*nxt,CS,False)
    spline.set_closed_loop(True,False)
    spline.update_spline()
    length=spline.get_spline_length();assert abs(length-data['circuit_length_cm'])/length<.005, 'Unexpected runtime spline length change'
    stamp=str(int(time.time()));prefix='MineRailV5_Staging_'+stamp+'_'
    hosts={};straight={};curves=0;bed_boxes=0;bed_hosts={};deck_boxes=0;deck_hosts={};component_count=0
    by_label={a.get_actor_label():a for a in owned};reused=set();component_pools={}
    def spawn(cls,label):
        old=by_label.get('MineRailV5_'+label) if reuse_existing else None
        if old:
            old.modify();reused.add(old.get_path_name())
            if label.startswith('Art_'):
                for kind in (unreal.SplineMeshComponent,unreal.HierarchicalInstancedStaticMeshComponent):
                    component_pools[(old.get_path_name(),str(kind))]=list(old.get_components_by_class(kind))
            return old
        a=eas.spawn_actor_from_class(cls,V(0,0,0));assert a,label
        a.modify();a.set_actor_label(prefix+label);a.set_folder_path('Mine_Rebuild/V5_Rail/Track');return a
    def component(a,cls):
        if reuse_existing and a.get_path_name() in reused:
            key=(a.get_path_name(),str(cls))
            if key not in component_pools:component_pools[key]=list(a.get_components_by_class(cls))
            if component_pools[key]:
                c=component_pools[key].pop(0);c.modify();return c
        a.modify();root=sds.k2_gather_subobject_data_for_instance(a)[0]
        h,_=sds.add_new_subobject(unreal.AddNewSubobjectParams(parent_handle=root,new_class=cls))
        c=lib.get_associated_object(sds.k2_find_subobject_data_from_handle(h));assert c
        c.modify();return c
    def unit(v):return v/v.length()
    def distance(a,b):return (a-b).length()
    def sample(d):
        p=spline.get_location_at_distance_along_spline(d%length,CS)-V(0,0,73.4)
        t=spline.get_direction_at_distance_along_spline(d%length,CS)
        return p,t
    bounds=mesh.get_bounding_box();native_length=bounds.max.x-bounds.min.x
    section_count=math.ceil(length/native_length);step=length/section_count
    for j in range(section_count):
        d=j*step;a,ta=sample(d);b,tb=sample(d+step);mid,tm=sample(d+step*.5)
        group=min(39,int(d/length*40))
        if group not in hosts:hosts[group]=spawn(unreal.Actor,'Art_%02d'%group)
        straight_enough=distance(mid,(a+b)*.5)<.20 and sum(ta.to_tuple()[k]*tb.to_tuple()[k] for k in range(3))>.99995
        if straight_enough:
            forward=unit(b-a);rot=unreal.MathLibrary.make_rot_from_x(forward)
            # Native mesh pivot is near X=0; do not center it on each segment.
            p=a-forward*bounds.min.x
            straight.setdefault(group,[]).append(unreal.Transform(location=p,rotation=rot,scale=V(distance(a,b)/native_length,1.3,.48)))
        else:
            c=component(hosts[group],unreal.SplineMeshComponent);c.modify();c.set_mobility(unreal.ComponentMobility.STATIC)
            c.set_static_mesh(mesh);c.set_collision_profile_name('NoCollision')
            c.set_forward_axis(unreal.SplineMeshAxis.X,False)
            c.set_boundary_min(bounds.min.x,False);c.set_boundary_max(bounds.max.x,False)
            c.set_start_scale(unreal.Vector2D(1.3,.48),False);c.set_end_scale(unreal.Vector2D(1.3,.48),False)
            c.set_start_and_end(a,ta*step,b,tb*step,True);curves+=1
        if j%5000==0:print('V5 rail sections',j,'/',section_count)
    for group,transforms in straight.items():
        c=component(hosts[group],unreal.HierarchicalInstancedStaticMeshComponent);c.modify()
        c.set_static_mesh(mesh);c.set_collision_profile_name('NoCollision');c.clear_instances();c.add_instances(transforms,False,True,False)
    # Unused old curved components relinquish their mesh; preserve component
    # objects for future reuse rather than duplicating thousands of components.
    for remaining in component_pools.values():
        for c in remaining:
            c.modify()
            if isinstance(c,unreal.InstancedStaticMeshComponent):c.clear_instances()
            else:c.set_static_mesh(None)
    # Solid rock/ballast foundations cover every raised portion. Box top is the
    # smoothed bed datum, width190cm leaves85+cm outer shoulders in6m drifts.
    opts=unreal.GeometryScriptPrimitiveOptions()
    for i,row in enumerate(rows):
        nxt=rows[(i+1)%N];lift=max(row['railbed_lift_cm'],nxt['railbed_lift_cm'])
        if lift<3:continue
        group=min(39,int(row['distance_cm']/data['circuit_length_cm']*40))
        if group not in bed_hosts:
            a=spawn(unreal.DynamicMeshActor,'Bed_%02d'%group);a.modify()
            c=a.get_component_by_class(unreal.DynamicMeshComponent);c.modify();dm=c.get_dynamic_mesh();dm.modify();dm.reset();c.set_material(0,material)
            bed_hosts[group]=(a,c,dm)
        a,c,dm=bed_hosts[group];a.modify();c.modify();dm.modify()
        pa,pb=V(*row['position_cm']),V(*nxt['position_cm']);forward=pb-pa
        yaw=math.degrees(math.atan2(forward.y,forward.x));pitch=math.degrees(math.atan2(forward.z,math.hypot(forward.x,forward.y)))
        rot=unreal.Rotator(pitch=pitch,yaw=yaw,roll=0);up=unreal.MathLibrary.get_up_vector(rot);depth=lift+12
        unreal.GeometryScript_Primitives.append_box(dm,opts,unreal.Transform(location=(pa+pb)*.5-up*depth*.5,rotation=rot),forward.length()+3,190,depth,0,0,0,unreal.GeometryScriptPrimitiveOriginMode.CENTER)
        bed_boxes+=1
    deck_pairs=data.get('central_deck_plan',{}).get('pairs',[])
    for first,second in zip(deck_pairs,deck_pairs[1:]):
        if second['outgoing_sample']-first['outgoing_sample']!=1:continue
        ia,ib=first['outgoing_sample'],second['outgoing_sample'];ja,jb=first['return_sample'],second['return_sample']
        pa,pb=V(*first['center']),V(*second['center']);fwd=pb-pa
        if fwd.length()<1 or fwd.length()>200:continue
        group=min(39,int(rows[ia]['distance_cm']/data['circuit_length_cm']*40))
        if group not in deck_hosts:
            a=spawn(unreal.DynamicMeshActor,'WalkDeck_%02d'%group);a.modify();c=a.get_component_by_class(unreal.DynamicMeshComponent);c.modify();dm=c.get_dynamic_mesh();dm.modify();dm.reset();c.set_material(0,material);deck_hosts[group]=(a,c,dm)
        a,c,dm=deck_hosts[group];a.modify();c.modify();dm.modify()
        out=(V(*rows[ia]['position_cm'])+V(*rows[ib]['position_cm']))*.5;ret=(V(*rows[ja]['position_cm'])+V(*rows[jb]['position_cm']))*.5
        across=out-ret;horizontal=math.hypot(across.x,across.y);height=across.z
        across=V(across.x,across.y,height*horizontal/120)
        rot=unreal.MathLibrary.make_rot_from_xy(fwd,across);up=unreal.MathLibrary.get_up_vector(rot)
        depth=max(rows[ia]['railbed_lift_cm'],rows[ib]['railbed_lift_cm'],rows[ja]['railbed_lift_cm'],rows[jb]['railbed_lift_cm'])+20
        unreal.GeometryScript_Primitives.append_box(dm,opts,unreal.Transform(location=(pa+pb)*.5-up*depth*.5,rotation=rot),fwd.length()+3,math.hypot(120,height),depth,0,0,0,unreal.GeometryScriptPrimitiveOriginMode.CENTER);deck_boxes+=1
    for group,(a,c,dm) in list(bed_hosts.items())+list(deck_hosts.items()):
        a.modify();c.modify();dm.modify()
        unreal.GeometryScript_UVs.set_mesh_u_vs_from_box_projection(dm,0,unreal.Transform(scale=V(100,100,100)),unreal.GeometryScriptMeshSelection())
        c.set_complex_as_simple_collision_enabled(True,True);c.update_collision(False);c.set_collision_profile_name('BlockAll')
        a.set_editor_property('bIsSpatiallyLoaded',False)
    assert section_count>6000 and curves>0 and straight and bed_boxes>0
    assert unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True,True), 'New rail geometry must save before hiding old rails'
    # Commit only after replacement geometry is built and saved. Preserve owned
    # original components for rollback, rather than deleting asset-pack content.
    hidden=0
    for a in owned:
        label=a.get_actor_label()
        if label.startswith(('MineRailV5_Art_','MineRailV5_Bed_','MineRailV5_WalkDeck_')):
            if a.get_path_name() in reused:continue
            a.modify();eas.destroy_actor(a);continue
        if label.startswith(('MineBeauty4_','MineDemo2_')):
            for c in a.get_components_by_class(unreal.StaticMeshComponent):
                source=c.static_mesh
                if source and 'Ind_Min_Rail_Tracks_Wood_Modular_01' in source.get_name():
                    c.modify();c.set_visibility(False);c.set_hidden_in_game(True);hidden+=1
    for group,a in hosts.items():a.modify();a.set_actor_label('MineRailV5_Art_%02d'%group)
    for group,(a,c,dm) in bed_hosts.items():a.modify();a.set_actor_label('MineRailV5_Bed_%02d'%group)
    for group,(a,c,dm) in deck_hosts.items():a.modify();a.set_actor_label('MineRailV5_WalkDeck_%02d'%group)
    route.modify();route.set_editor_property('bIsSpatiallyLoaded',False)
    saved=unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True,True)
    result=dict(status='geometry_installed_runtime_and_collision_tests_pending',alignment_sha256=digest,route_actor=route.get_path_name(),route_length_cm=length,route_points=N,track_sections=section_count,straight_instances=sum(map(len,straight.values())),curved_components=curves,art_hosts=len(hosts),raised_bed_boxes=bed_boxes,raised_bed_hosts=len(bed_hosts),max_railbed_lift_cm=data['height_audit']['max_railbed_lift_cm'],old_track_components_hidden=hidden,saved=saved,cart_root_above_bed_cm=75.5,visible_track_base_above_bed_cm=2.1)
    result.update(central_walking_deck_boxes=deck_boxes,central_walking_deck_hosts=len(deck_hosts))
    result.update(reused_existing_hosts=len(reused),in_place_update=bool(reuse_existing))
    assert saved,'Final rail installation save failed'
    with open(marker,'w') as fh:json.dump(result,fh,indent=2)
    print(json.dumps(result));return result
