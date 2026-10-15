"""OFFLINE PREPARED; root is the only Unreal executor.

Create a fresh private R4 floor material from the natively read R3. Change only
Custom_2's vein mask; preserve the exact stone/color/guide suffix, other nodes,
textures, normal/roughness, wall, camera/light/geometry state and source packages.
Build four private one-frame review maps/sequences and render matched R3/R4
corridor and neutral views. These are samples only; global approval stays pending.
NH_FLOOR_R4_RENDER=0 prepares/saves without MRQ (default1).
NH_FLOOR_R4_QUIT_EDITOR=1 quits only root's dedicated process after completion
(default0 never quits). This script never launches or kills another process.
"""
import builtins, datetime, hashlib, html, json, os, pathlib, struct, traceback
import unreal as U

P=pathlib.Path('E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009')
READBACK=pathlib.Path('H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup/Evidence/PrisonFloor_R3_NativeGraph_20261010T175339641551Z.json')
READBACK_SHA='1175c6db62632da22d5591e3fe17dfc4257b3bab6a8e3059ac31120a7e1e9e22'
MASK=pathlib.Path('E:/_codex_tasks/prison_floor_R4_branching_mask.hlsl')
MASK_SHA='236182f8a756e92b294d18733eba5855b4687ac6083516b581c2851bce258160'
FLOOR='/Game/_CodexReview/PrisonMaterial/FloorR3_20261010_095836/M_PrisonFloor_After'
WALL='/Game/_CodexReview/PrisonMaterial/Run_20261010_082615_3d6b9856/Materials/M_PrisonWall_After'
CORRIDOR='/Game/_CodexReview/PrisonMaterial/FloorR3_20261010_095836/L_After'
NEUTRAL='/Game/_CodexReview/NeutralR3_20261010_104711/L_NeutralR3'
NEUTRAL_SHA='770b9f1e63afdabcba42154ce6d5b37f92096456188279cc60cee683a8df1f6e'
STAMP=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
RUN='FloorR4_'+STAMP
DEST='/Game/_CodexReview/PrisonMaterial/'+RUN
OUT=pathlib.Path('H:/NyghtshadeHollow_Development/2026-10-10/PrisonMaterialReview')/RUN
TARGET=DEST+'/M_PrisonFloor_R4_Branching'
E=U.EditorAssetLibrary;ME=U.MaterialEditingLibrary;SAVE=U.EditorLoadingAndSavingUtils
A=U.get_editor_subsystem(U.EditorActorSubsystem);W=U.get_editor_subsystem(U.UnrealEditorSubsystem)
R={'status':'STARTED','classification':'ISOLATED_R4_FLOOR_SAMPLE_NOT_GLOBAL_ROLLOUT','approval':'PENDING',
   'source_packages_modified':False,'created_assets':[],'jobs':[],'protected_hashes_before':{},'visual_accepted':False}

def need(v,s):
    if not v:raise RuntimeError(s)
    return v
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
def package(p,suffix='.uasset'):
    need(p.startswith('/Game/'),'Expected project package.')
    return P/'Content'/(p.split('.')[0][6:]+suffix)
def protected_file(p,expected=None):
    p=pathlib.Path(p);h=sha(p)
    if expected:need(h==expected,'Protected provenance changed: '+str(p))
    R['protected_hashes_before'][str(p)]=h
def protect(p,suffix='.uasset'):protected_file(package(p,suffix))
def preserve():
    for p,h in R['protected_hashes_before'].items():need(sha(p)==h,'Protected source changed: '+p)
def record():
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'Receipt.json').write_text(json.dumps(R,indent=2),encoding='utf-8')
def v3(v):return [float(v.x),float(v.y),float(v.z)]
def transform(c):
    t=c.get_world_transform() if isinstance(c,U.SceneComponent) else c.get_actor_transform()
    return {'location':v3(t.translation),'rotation':[float(t.rotation.x),float(t.rotation.y),float(t.rotation.z),float(t.rotation.w)],'scale':v3(t.scale3d)}
def inputs(mat,n):
    ns=list(ME.get_material_expression_input_names(n));vs=list(ME.get_inputs_for_material_expression(mat,n))
    need(len(ns)==len(vs),'Native input enumeration mismatch.')
    return {str(k):(v.get_name() if v else None) for k,v in zip(ns,vs)}
def graph(mat):
    rows=[]
    for n in ME.get_material_expressions(mat):
        cls=n.get_class().get_name();r={'name':n.get_name(),'class':cls,'inputs':inputs(mat,n)}
        if cls=='MaterialExpressionCustom':
            code=n.get_editor_property('code');r.update(code=code,code_sha256=hashlib.sha256(code.encode()).hexdigest(),
                 custom_input_names=[str(x.get_editor_property('input_name')) for x in n.get_editor_property('inputs')],
                 output_type=str(n.get_editor_property('output_type')))
        if cls in ('MaterialExpressionScalarParameter','MaterialExpressionVectorParameter'):
            r.update(parameter_name=str(n.get_editor_property('parameter_name')),default_value=str(n.get_editor_property('default_value')))
        if isinstance(n,U.MaterialExpressionTextureSample):
            t=n.get_editor_property('texture');r.update(texture=t.get_path_name() if t else None,sampler_type=str(n.get_editor_property('sampler_type')))
        if cls=='MaterialExpressionTextureCoordinate':
            for k in ('coordinate_index','u_tiling','v_tiling'):r[k]=n.get_editor_property(k)
        rows.append(r)
    return sorted(rows,key=lambda r:r['name'])
def world_snapshot():
    rows=[]
    for a in A.get_all_level_actors():
        row={'label':a.get_actor_label(),'class':a.get_class().get_path_name(),'transform':transform(a),'components':[]}
        for c in a.get_components_by_class(U.StaticMeshComponent):
            m=c.get_editor_property('static_mesh')
            d={'name':c.get_name(),'kind':'mesh','mesh':m.get_path_name() if m else None,'transform':transform(c),
               'materials':[m.get_path_name() if m else None for m in c.get_materials()],
               'collision':str(c.get_collision_enabled()),'cast_shadow':bool(c.get_editor_property('cast_shadow'))}
            if isinstance(c,U.InstancedStaticMeshComponent):d['instance_count']=c.get_instance_count()
            row['components'].append(d)
        for c in a.get_components_by_class(U.CameraComponent):
            pp=c.get_editor_property('post_process_settings')
            row['components'].append({'name':c.get_name(),'kind':'camera','transform':transform(c),
                 'fov':float(c.get_editor_property('field_of_view')),'aspect':float(c.get_editor_property('aspect_ratio')),
                 'constrain_aspect':bool(c.get_editor_property('constrain_aspect_ratio')),
                 'blend_weight':float(c.get_editor_property('post_process_blend_weight')),
                 'post_process':{k:str(pp.get_editor_property(k)) for k in ('override_auto_exposure_min_brightness',
                   'override_auto_exposure_max_brightness','auto_exposure_min_brightness','auto_exposure_max_brightness',
                   'override_auto_exposure_bias','auto_exposure_bias','auto_exposure_apply_physical_camera_exposure','motion_blur_amount')}})
        for c in a.get_components_by_class(U.LightComponentBase):
            color=c.get_editor_property('light_color')
            row['components'].append({'name':c.get_name(),'kind':'light','class':c.get_class().get_path_name(),'transform':transform(c),
                'intensity':float(c.get_editor_property('intensity')),'color':[int(color.r),int(color.g),int(color.b),int(color.a)],
                'mobility':str(c.get_editor_property('mobility')),'cast_shadows':bool(c.get_editor_property('cast_shadows'))})
        row['components']=sorted(row['components'],key=lambda x:(x['name'],x['kind']));rows.append(row)
    return sorted(rows,key=lambda x:(x['label'],x['class']))
def canonical_material_snapshot(rows):
    rows=json.loads(json.dumps(rows))
    for a in rows:
        for c in a['components']:
            if c['kind']=='mesh':c['materials']=[FLOOR+'.'+FLOOR.rsplit('/',1)[-1] if m and m.split('.')[0]==TARGET else m for m in c['materials']]
    return rows
def save_owned_map(path):
    need(path.startswith(DEST+'/'),'Refuse non-review map save.')
    need(SAVE.save_map(W.get_editor_world(),path),'Save private map.')
    need(SAVE.load_map(path),'Reopen private map.')
    need(W.get_editor_world().get_package().get_name()==path,'Private map ownership required.')

try:
    need(pathlib.Path(U.Paths.project_dir()).resolve()==P.resolve(),'Exact EnvCopy required.')
    need(not OUT.exists(),'Fresh review evidence folder required.')
    need(sha(READBACK)==READBACK_SHA,'Pinned native R3 readback changed.')
    native=read(READBACK)
    need(native['status']=='NATIVE_R3_GRAPH_CAPTURED_PROVENANCE_MATCH_PENDING_R4_PROPOSAL' and native['all_protected_packages_unchanged'], 'Native R3 prerequisite failed.')
    for p,h in native['protected_hashes_after'].items():protected_file(p,h)
    protected_file(package(NEUTRAL,'.umap'),NEUTRAL_SHA)
    protect('/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v013','.umap')
    protect('/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v015','.umap')
    original=pathlib.Path('C:/Users/Gierl/Documents/Unreal Projects/MyProject2/Content/Nyghtshade/Maps/RecoveredPrisonReview.umap')
    protected_file(original,'dcad1878e452ea2af5dc2c62505652a5f25a942fc2c8f67ecb58346ba60b3535')
    source=need(E.load_asset(FLOOR),'Load native R3 material.')
    expected=sorted(native['materials']['floor']['graph'],key=lambda x:x['name'])
    need(graph(source)==expected,'Current R3 graph differs from native prerequisite.')
    wall=need(E.load_asset(WALL),'Load retained stripe wall.')
    need(graph(wall)==sorted(native['materials']['wall']['graph'],key=lambda x:x['name']),'Stripe wall graph changed.')
    old=next(x['code'] for x in expected if x['name']=='MaterialExpressionCustom_2')
    tail=old[old.index('float3 stone='):]
    need('saturate(C)*.018' in tail and 'float3(.10,.0020,.0050)' in tail and 'float guideMask=' in tail,'Exact retained R3 suffix signature required.')
    need(sha(MASK)==MASK_SHA,'Prepared R4 mask changed; review and repin intentionally.')
    mask=MASK.read_text(encoding='utf-8');code=mask.rstrip()+'\n'+tail
    need(not E.does_asset_exist(TARGET),'Fresh material only.')
    mat=need(E.duplicate_asset(FLOOR,TARGET),'Duplicate R3 floor.')
    R['created_assets'].append(TARGET)
    node=need(next((n for n in ME.get_material_expressions(mat) if n.get_name()=='MaterialExpressionCustom_2'),None),'Exact copied Custom_2 required.')
    need(node.get_class().get_name()=='MaterialExpressionCustom','Known node class required.')
    node.set_editor_property('code',code)
    want=json.loads(json.dumps(expected))
    for row in want:
        if row['name']=='MaterialExpressionCustom_2':row.update(code=code,code_sha256=hashlib.sha256(code.encode()).hexdigest())
    need(graph(mat)==want,'Only Custom_2 code may change.')
    errors=list(ME.recompile_material(mat) or []);need(not errors,'Native shader compile errors: '+repr(errors))
    need(E.save_asset(TARGET),'Save private floor material.')
    need(graph(need(E.load_asset(TARGET),'Reload material.'))==want,'Saved candidate graph mismatch.')
    R.update(native_readback=str(READBACK),native_readback_sha256=READBACK_SHA,mask_file=str(MASK),mask_sha256=sha(MASK),
             old_color_code_sha256=hashlib.sha256(old.encode()).hexdigest(),new_color_code_sha256=hashlib.sha256(code.encode()).hexdigest(),
             preserved_suffix_sha256=hashlib.sha256(tail.encode()).hexdigest(),candidate_material=TARGET,shader_compile_errors=errors,
             preserved_graph_except_single_code=True,wall_package_unchanged=True,
             limits='Sparse open trunks and finite tapering branches are a proposed material sample. Native compile/save does not establish natural appearance, animation performance or user approval.')
    (OUT.mkdir(parents=True,exist_ok=False))
    (OUT/'R3_original_color.hlsl').write_text(old,encoding='utf-8');(OUT/'R4_candidate_color.hlsl').write_text(code,encoding='utf-8')
    baselines={}
    for scene,src,camera_label in (('Corridor',CORRIDOR,'NH_REVIEW_floor3q'),('Neutral',NEUTRAL,'PROBE_Oak_3')):
        for variant in ('R3','R4'):
            need(SAVE.load_map(src),'Load exact saved sample source.')
            source_state=world_snapshot()
            mp=DEST+'/L_'+scene+'_'+variant;sp=DEST+'/LS_'+scene+'_'+variant
            need(not E.does_asset_exist(mp) and not E.does_asset_exist(sp),'Fresh private review paths required.')
            save_owned_map(mp);R['created_assets'].append(mp)
            need(world_snapshot()==source_state,'Save-as altered source camera/light/mesh state.')
            changed=[]
            if variant=='R4':
                for a in A.get_all_level_actors():
                    for c in a.get_components_by_class(U.StaticMeshComponent):
                        for i,m in enumerate(c.get_materials()):
                            if m and m.get_path_name().split('.')[0]==FLOOR:
                                c.set_material(i,mat);changed.append({'actor':a.get_actor_label(),'component':c.get_name(),'slot':i})
                need(bool(changed),'No existing R3 floor material assignments found in '+scene)
            need(canonical_material_snapshot(world_snapshot())==source_state,'Unrelated scene state changed.')
            cameras=[a for a in A.get_all_level_actors() if a.get_actor_label()==camera_label]
            need(len(cameras)==1,'Exact existing comparison camera missing or duplicated.')
            seq=need(U.AssetToolsHelpers.get_asset_tools().create_asset('LS_'+scene+'_'+variant,DEST,U.LevelSequence,U.LevelSequenceFactoryNew()),'Create one-frame sequence.')
            seq.set_display_rate(U.FrameRate(24,1));seq.set_playback_start(0);seq.set_playback_end(1)
            cuts=seq.add_track(U.MovieSceneCameraCutTrack);binding=seq.add_possessable(cameras[0]);section=cuts.add_section();section.set_range(0,1)
            section.set_camera_binding_id(U.MovieSceneSequenceExtensions.get_binding_id(seq,binding))
            need(E.save_asset(sp),'Save private proof sequence.');R['created_assets'].append(sp)
            save_owned_map(mp)
            current=canonical_material_snapshot(world_snapshot());need(current==source_state,'Saved/reopened scene state mismatch.')
            if variant=='R3':baselines[scene]=current
            else:need(current==baselines[scene],'Before/after scene controls differ.')
            camera_state=next(a for a in current if a['label']==camera_label)
            R['jobs'].append({'name':scene+'_'+variant,'map':mp,'sequence':sp,'scene':scene,'variant':variant,
                 'camera':camera_state,'changed_material_slots':changed,'scene_state_sha256':hashlib.sha256(json.dumps(current,sort_keys=True).encode()).hexdigest(),
                 'private_map_sha256':sha(package(mp,'.umap')),'private_sequence_sha256':sha(package(sp))})
    preserve();R['status']='PRIVATE_SAMPLE_SAVED_REOPENED_PENDING_NATIVE_RENDER_AND_REVIEW';record()
    if os.environ.get('NH_FLOOR_R4_RENDER','1')=='1':
        queue=U.new_object(U.MoviePipelineQueue)
        for spec in R['jobs']:
            job=queue.allocate_new_job(U.MoviePipelineExecutorJob);job.set_editor_property('job_name',spec['name'])
            job.set_editor_property('map',U.SoftObjectPath(spec['map']));job.set_editor_property('sequence',U.SoftObjectPath(spec['sequence']))
            cfg=job.get_configuration();out=cfg.find_or_add_setting_by_class(U.MoviePipelineOutputSetting)
            out.set_editor_property('output_resolution',U.IntPoint(1600,900));out.set_editor_property('output_directory',U.DirectoryPath(str(OUT/spec['name'])))
            out.set_editor_property('file_name_format',spec['name']+'_{frame_number}')
            cfg.find_or_add_setting_by_class(U.MoviePipelineDeferredPassBase);cfg.find_or_add_setting_by_class(U.MoviePipelineImageSequenceOutput_PNG)
            aa=cfg.find_or_add_setting_by_class(U.MoviePipelineAntiAliasingSetting)
            for k,v in {'engine_warm_up_count':64,'render_warm_up_frames':True,'render_warm_up_count':16,'spatial_sample_count':16,
                'temporal_sample_count':1,'override_anti_aliasing':True,'anti_aliasing_method':U.AntiAliasingMethod.AAM_NONE}.items():aa.set_editor_property(k,v)
            gm=cfg.find_or_add_setting_by_class(U.MoviePipelineGameOverrideSetting);gm.set_editor_property('soft_game_mode_override',U.GameModeBase)
        R.update(status='FOUR_MATCHED_NATIVE_STILLS_REQUESTED',render_controls={'resolution':[1600,900],'spatial_samples':16,'temporal_samples':1,'engine_warmup':64,'render_warmup':16,'AA':'NONE','MRQ_cinematic_defaults_retained':True,'performance_claim':False});record()
        def finished(executor,success):
            try:
                need(success,'Native MRQ executor failed.');preserve()
                for spec in R['jobs']:
                    files=list((OUT/spec['name']).glob('*.png'));need(len(files)==1,'Expected one native frame for '+spec['name'])
                    p=files[0];data=p.read_bytes();need(data[:8]==b'\x89PNG\r\n\x1a\n','PNG signature required.')
                    dims=list(struct.unpack('>II',data[16:24]));need(dims==[1600,900],'PNG dimensions mismatch.')
                    spec['image']={'path':str(p),'sha256':hashlib.sha256(data).hexdigest(),'dimensions':dims}
                rows=[]
                for scene in ('Corridor','Neutral'):
                    imgs=[]
                    for s in [x for x in R['jobs'] if x['scene']==scene]:
                        rel=pathlib.Path(s['image']['path']).relative_to(OUT).as_posix()
                        imgs.append('<figure><figcaption>'+s['variant']+'</figcaption><a href="'+html.escape(rel)+'"><img src="'+html.escape(rel)+'"></a></figure>')
                    rows.append('<h2>'+scene+'</h2><div class="pair">'+''.join(imgs)+'</div>')
                page='<!doctype html><meta charset="utf-8"><title>R3 / R4 floor sample</title><style>body{background:#17191c;color:#eee;font:16px system-ui;margin:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}img{width:100%}</style><h1>Actual matched floor samples</h1><p>R3 left; proposed R4 right. Same saved cameras, lights and scene; floor color mask alone changed. User approval remains pending. No global rollout or performance claim.</p>'+''.join(rows)
                (OUT/'MATCHED_REVIEW.html').write_text(page,encoding='utf-8')
                R.update(status='FOUR_NATIVE_STILLS_COMPLETE_PENDING_ACTUAL_PIXEL_REVIEW_AND_USER_APPROVAL',all_protected_hashes_unchanged=True)
            except Exception:R.update(status='FAILED_NO_VISUAL_OR_APPROVAL_PASS',error=traceback.format_exc())
            record()
            if os.environ.get('NH_FLOOR_R4_QUIT_EDITOR','0')=='1':U.SystemLibrary.execute_console_command(None,'QUIT_EDITOR')
        ex=U.new_object(U.MoviePipelinePIEExecutor);ex.on_executor_finished_delegate.add_callable(finished)
        builtins._NH_PRISON_FLOOR_R4_KEEP=(queue,ex,finished)
        U.get_editor_subsystem(U.MoviePipelineQueueSubsystem).render_queue_instance_with_executor_instance(queue,ex)
except Exception:
    R.update(status='FAILED_PRIVATE_SAMPLE_NO_ACCEPTANCE',error=traceback.format_exc());record()
    if os.environ.get('NH_FLOOR_R4_QUIT_EDITOR','0')=='1':U.SystemLibrary.execute_console_command(None,'QUIT_EDITOR')
    raise
