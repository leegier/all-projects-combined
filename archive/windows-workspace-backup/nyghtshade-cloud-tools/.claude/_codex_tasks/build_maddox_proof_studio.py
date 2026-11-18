import json, pathlib, math, traceback, unreal

DEST='/Game/NyghtshadeHollow/CharacterRepair_20261005/Maddox/LocalPosterior_20261009T185221510217Z'
OUT=pathlib.Path(r'H:\NyghtshadeHollow_Development\2026-10-09\Maddox_Solo_Walkthrough\Studio_Build_Receipt.json')
FPS=24; TU=unreal.MovieSceneTimeUnit.DISPLAY_RATE; CON=unreal.MovieSceneKeyInterpolation.CONSTANT
EL=unreal.EditorAssetLibrary; BEL=unreal.BlueprintEditorLibrary; GE=unreal.BlueprintGraphEditor
R={'status':'started','maps':[],'sequences':[],'cameras':[],'runtime_input_method':'scripted AddMovementInput for dedicated proof only','errors':[]}
def need(v,msg):
    if not v: raise RuntimeError(msg)
    return v
def v(x,y,z):return unreal.Vector(float(x),float(y),float(z))
def look(a,b):
    d=b-a;return unreal.Rotator(pitch=math.degrees(math.atan2(d.z,math.hypot(d.x,d.y))),yaw=math.degrees(math.atan2(d.y,d.x)),roll=0)
def pin(p):return need(p if p.is_valid() else None,'Invalid pin')
def link(a,b):need(pin(a).try_create_connection(pin(b)),'Schema rejected connection')
def literal(p,value):need(pin(p).set_pin_value(str(value)),'Schema rejected default')
def call(ed,path,inputs=None):
    n=need(ed.add_call_function_node(path),'Missing native '+path)
    for k,val in (inputs or {}).items():
        if isinstance(val,unreal.BlueprintGraphPin):link(val,n.find_input_pin(k))
        else:literal(n.find_input_pin(k),val)
    return n
def output(n,name='ReturnValue'):return pin(n.find_output_pin(name))
def make_walk_driver():
    p=DEST+'/BP_Maddox_ProofWalk_Driver'
    need(not EL.does_asset_exist(p),'Fresh walk driver required')
    bp=need(BEL.create_blueprint_asset_with_parent(p,unreal.Actor.static_class()),'Proof driver create')
    ed=GE.get_graph_editor_by_name(bp,'EventGraph')
    event=BEL.add_event_override(bp,'ReceiveTick',unreal.IntPoint(0,0))
    if event is None:event=ed.find_event_node('ReceiveTick')
    now=call(ed,'/Script/Engine.GameplayStatics.GetTimeSeconds')
    remainder=call(ed,'/Script/Engine.KismetMathLibrary.Percent_FloatFloat',{'A':output(now),'B':8.0})
    cond=call(ed,'/Script/Engine.KismetMathLibrary.Less_DoubleDouble',{'A':output(remainder),'B':4.0})
    branch=need(ed.add_branch_node(),'Branch');link(event.find_then_pin(),branch.find_execute_pin());link(output(cond),branch.find_condition_pin())
    pawn=call(ed,'/Script/Engine.GameplayStatics.GetPlayerPawn',{'PlayerIndex':0})
    for direction,execpin in [(1.0,branch.find_then_pin()),(-1.0,branch.find_else_pin())]:
        vec=call(ed,'/Script/Engine.KismetMathLibrary.MakeVector',{'X':direction,'Y':0.0,'Z':0.0})
        move=call(ed,'/Script/Engine.Pawn.AddMovementInput',{'WorldDirection':output(vec),'ScaleValue':0.28,'bForce':True})
        link(output(pawn),move.find_self_pin());link(execpin,move.find_execute_pin())
    need(BEL.compile_blueprint(bp),'Walk driver compile');need(EL.save_loaded_asset(bp,False),'Walk driver save')
    R['walk_driver']=p
    return bp
def make_material():
    p=DEST+'/M_ProofStudio_Gray';need(not EL.does_asset_exist(p),'Fresh studio material required')
    mat=need(unreal.AssetToolsHelpers.get_asset_tools().create_asset('M_ProofStudio_Gray',DEST,unreal.Material,unreal.MaterialFactoryNew()),'Studio material')
    mel=unreal.MaterialEditingLibrary
    col=mel.create_material_expression(mat,unreal.MaterialExpressionConstant3Vector,-200,0);col.set_editor_property('constant',unreal.LinearColor(0.16,0.16,0.16,1))
    rough=mel.create_material_expression(mat,unreal.MaterialExpressionConstant,-200,180);rough.set_editor_property('r',0.8)
    mel.connect_material_property(col,'',unreal.MaterialProperty.MP_BASE_COLOR);mel.connect_material_property(rough,'',unreal.MaterialProperty.MP_ROUGHNESS)
    mel.recompile_material(mat);need(EL.save_loaded_asset(mat,False),'Studio material save');return mat
def camera(eas,label,loc,target,focal):
    actor=eas.spawn_actor_from_class(unreal.CineCameraActor,loc,look(loc,target));actor.set_actor_label(label)
    c=actor.get_cine_camera_component();c.set_editor_property('current_focal_length',focal)
    c.set_editor_property('focus_settings',unreal.CameraFocusSettings(focus_method=unreal.CameraFocusMethod.DISABLE))
    film=c.get_editor_property('filmback');film.set_editor_property('sensor_width',36.0);film.set_editor_property('sensor_height',20.25);c.set_editor_property('filmback',film)
    pp=c.get_editor_property('post_process_settings')
    for name,val in {'override_auto_exposure_method':True,'auto_exposure_method':unreal.AutoExposureMethod.AEM_HISTOGRAM,'override_auto_exposure_min_brightness':True,'override_auto_exposure_max_brightness':True,'auto_exposure_min_brightness':4.0,'auto_exposure_max_brightness':4.0,'override_auto_exposure_bias':True,'auto_exposure_bias':0.0,'override_motion_blur_amount':True,'motion_blur_amount':0.0}.items():pp.set_editor_property(name,val)
    c.set_editor_property('post_process_settings',pp);c.set_editor_property('post_process_blend_weight',1.0)
    R['cameras'].append({'name':label,'position_cm':[loc.x,loc.y,loc.z],'target_cm':[target.x,target.y,target.z],'focal_mm':focal,'fixed_ev100':4})
    return actor
def seq_for(eas,mode):
    name='LS_Maddox_'+mode+'_Proof';path=DEST+'/'+name;need(not EL.does_asset_exist(path),'Fresh sequence '+path)
    seq=need(unreal.AssetToolsHelpers.get_asset_tools().create_asset(name,DEST,unreal.LevelSequence,unreal.LevelSequenceFactoryNew()),'Sequence')
    seq.set_display_rate(unreal.FrameRate(FPS,1));seq.set_playback_start(0);seq.set_playback_end(144)
    if mode=='Walk':shots=[('Walk_Side',v(240,800,120),v(240,0,95),36.0,0,144)]
    else:shots=[('Side',v(0,600,98),v(0,0,98),50.0,0,48),('Rear',v(-600,0,98),v(0,0,98),50.0,48,96),('PelvisSide',v(0,300,92),v(0,0,92),60.0,96,144)]
    cuts=seq.add_track(unreal.MovieSceneCameraCutTrack)
    for label,loc,target,focal,start,end in shots:
        actor=camera(eas,'MaddoxProof_'+label,loc,target,focal);binding=seq.add_possessable(actor)
        track=binding.add_track(unreal.MovieScene3DTransformTrack);section=track.add_section();section.set_range(0,144)
        rot=actor.get_actor_rotation();vals=[loc.x,loc.y,loc.z,rot.roll,rot.pitch,rot.yaw,1,1,1]
        for chan,val in zip(section.get_all_channels(),vals):chan.add_key(unreal.FrameNumber(start),float(val),0,TU,CON)
        cut=cuts.add_section();cut.set_range(start,end);cut.set_camera_binding_id(unreal.MovieSceneSequenceExtensions.get_binding_id(seq,binding))
    need(EL.save_loaded_asset(seq,False),'Sequence save');R['sequences'].append(path);return seq
def studio(mode,gm,material,driver):
    path=DEST+'/L_Maddox_'+mode+'_Proof';need(not EL.does_asset_exist(path),'Fresh studio map '+path)
    world=need(unreal.EditorLoadingAndSavingUtils.new_blank_map(False),'Blank proof studio')
    eas=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    world.get_world_settings().set_editor_property('default_game_mode',gm)
    floor=eas.spawn_actor_from_class(unreal.StaticMeshActor,v(0,0,-10),unreal.Rotator());floor.set_actor_label('ProofStudio_Floor')
    fc=floor.static_mesh_component;fc.set_static_mesh(unreal.load_asset('/Engine/BasicShapes/Cube'));floor.set_actor_scale3d(v(40,40,0.2));fc.set_material(0,material)
    start=eas.spawn_actor_from_class(unreal.PlayerStart,v(0,0,100),unreal.Rotator());start.set_actor_label('ProofStudio_PlayerStart')
    for label,loc,target,lumens in [('Key',v(300,250,300),v(0,0,95),16000),('Fill',v(150,-300,220),v(0,0,95),9000),('Rear',v(-260,-200,280),v(0,0,95),13000)]:
        actor=eas.spawn_actor_from_class(unreal.RectLight,loc,look(loc,target));actor.set_actor_label('ProofStudio_'+label)
        lc=actor.get_component_by_class(unreal.RectLightComponent);lc.set_editor_property('intensity_units',unreal.LightUnits.LUMENS);lc.set_intensity(lumens);lc.set_editor_property('source_width',180.0);lc.set_editor_property('source_height',180.0);lc.set_editor_property('attenuation_radius',1800.0)
    if mode=='Walk':
        a=eas.spawn_actor_from_class(driver.generated_class(),v(0,0,0));a.set_actor_label('TEST_ONLY_ScriptedWalk');a.set_editor_property('tags',[unreal.Name('MaddoxProofOnly')])
    seq=seq_for(eas,mode)
    need(unreal.EditorLoadingAndSavingUtils.save_map(world,path),'Proof map save')
    R['maps'].append({'mode':mode,'map':path,'gamemode':gm.get_path_name(),'sequence':seq.get_path_name().split('.')[0]})
try:
    driver=make_walk_driver();material=make_material()
    originalgm=need(EL.load_blueprint_class('/Game/NyghtshadeHollow/CharacterRepair_20261005/BP_Maddox_TestGameMode'),'Original GameMode')
    candidategm=need(EL.load_blueprint_class(DEST+'/BP_Maddox_LocalInset35_TestGameMode'),'Candidate GameMode')
    studio('Before',originalgm,material,driver);studio('After',candidategm,material,driver);studio('Walk',candidategm,material,driver)
    R['status']='PASS_saved_proof_studios_NOT_runtime_tested'
except Exception:R['status']='FAIL';R['errors'].append(traceback.format_exc())
OUT.write_text(json.dumps(R,indent=2),encoding='utf-8');print('CODEX_MADDOX_STUDIO_BUILD',R['status'],OUT)
