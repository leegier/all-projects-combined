"""UE 5.8 native Python. PREPARED ONLY; run by the sole Unreal writer.

Default action is read-only inspection. In the intended EnvCopy editor, set
NH_PRISON_LOOK_ACTION=build before exec(open(this_file, encoding='utf-8').read()).
Never starts Unreal, renders, clears a queue, deletes assets, or saves all packages.
Creates unique before/after material copies, corridor maps from v008, neutral maps,
and sequences. Render job JSON files are specifications, not executed commands.

Installed source references are documented in the companion README.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import traceback
import uuid
import unreal

PROJECT = Path(r'E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009')
SOURCE_MAP = '/Game/Nyghtshade/Maps/NH_EnvRefine_Claude_v008'
SOURCE_MATERIALS = {
    'wall': '/Game/Nyghtshade/Materials/M_PrisonWall',
    'floor': '/Game/Nyghtshade/Materials/M_PrisonFloor',
}
ACTION = os.environ.get('NH_PRISON_LOOK_ACTION', 'inspect').lower()
assert ACTION in ('inspect', 'build'), 'NH_PRISON_LOOK_ACTION must be inspect or build'
RUN = 'Run_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S') + '_' + uuid.uuid4().hex[:8]
DEST = '/Game/_CodexReview/PrisonMaterial/' + RUN
OUT = Path(r'H:/NyghtshadeHollow_Development/2026-10-10/PrisonMaterialReview') / RUN
CORRIDOR_EV = float(os.environ.get('NH_PRISON_CORRIDOR_EV100', '2.5'))
NEUTRAL_EV = float(os.environ.get('NH_PRISON_NEUTRAL_EV100', '5.0'))
assert -1.0 <= CORRIDOR_EV <= 8.0 and 0.0 <= NEUTRAL_EV <= 12.0
ELL = unreal.EditorAssetLibrary
MEL = unreal.MaterialEditingLibrary
SAVE = unreal.EditorLoadingAndSavingUtils
ASSETS = unreal.AssetToolsHelpers.get_asset_tools()
ACTORS = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
UES = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
REPORT = {'status': 'started', 'action': ACTION, 'run': RUN, 'destination': DEST,
          'source_map': SOURCE_MAP, 'changes': [], 'render_jobs': [],
          'warnings': ['Prepared script does not constitute a rendered or approved look.',
                       'The warm corridor lighting is preserved, not replaced by the neutral rig.',
                       'Batched prison components receive overrides only in the new review maps.'],
          'exposure_ev100': {'corridor': CORRIDOR_EV, 'neutral': NEUTRAL_EV}}

# Stripe period and exact hard intervals are intentionally unchanged from v008.
# Paint grain is continuous value noise instead of per-pixel salt-and-pepper noise.
WALL_CODE = r'''// NH isolated review: preserve v008 stripe intervals exactly.
float z=fmod(abs(P.z+20.0),320.0);
float stripe=(z>82.0&&z<100.0)||(z>154.0&&z<172.0)||(z>226.0&&z<244.0);
float3 q=P*0.11; float3 i=floor(q); float3 f=frac(q); f=f*f*(3.0-2.0*f);
float h000=frac(sin(dot(i,float3(12.9898,78.233,37.719)))*43758.5453);
float h100=frac(sin(dot(i+float3(1,0,0),float3(12.9898,78.233,37.719)))*43758.5453);
float h010=frac(sin(dot(i+float3(0,1,0),float3(12.9898,78.233,37.719)))*43758.5453);
float h110=frac(sin(dot(i+float3(1,1,0),float3(12.9898,78.233,37.719)))*43758.5453);
float h001=frac(sin(dot(i+float3(0,0,1),float3(12.9898,78.233,37.719)))*43758.5453);
float h101=frac(sin(dot(i+float3(1,0,1),float3(12.9898,78.233,37.719)))*43758.5453);
float h011=frac(sin(dot(i+float3(0,1,1),float3(12.9898,78.233,37.719)))*43758.5453);
float h111=frac(sin(dot(i+float3(1,1,1),float3(12.9898,78.233,37.719)))*43758.5453);
float n=lerp(lerp(lerp(h000,h100,f.x),lerp(h010,h110,f.x),f.y),lerp(lerp(h001,h101,f.x),lerp(h011,h111,f.x),f.y),f.z);
float grain=0.93+0.07*n;
return lerp(float3(.0072,.0076,.0082),float3(.34,.0045,.0135),stripe)*grain;'''

# Retains original UV/normal/roughness inputs, marble flow and guide-mask layout.
# Only the verified Substrate color modifier changes; no shader node is replaced.
FLOOR_CODE = r'''// NH isolated review: black stone with finer crimson veins.
float2 q=P.xy*.075;
float flow=q.x*.53+q.y*.28+1.7*sin(q.y*.77+.45*sin(q.x*.31))+.46*sin(q.x*1.71+q.y*.61);
float main=1.0-smoothstep(.0022,.0085,abs(sin(flow)));
float branch=(1.0-smoothstep(.0016,.0062,abs(sin(flow*2.63+sin(q.y*2.31)))))*.30;
float fine=(1.0-smoothstep(.0012,.0045,abs(sin(flow*5.9+1.3*sin(q.x*1.9)))))*.12;
float vein=saturate(main+branch+fine);
float3 stone=float3(.0052,.0056,.0061)+saturate(C)*.10;
float3 color=lerp(stone,float3(.060,.0016,.0034),vein);
float block=(P.x>2850&&P.x<5280&&abs(P.y)<1420)?1:0;
float edge=min(min(P.x-2850,5280-P.x),1420-abs(P.y));
float guideMask=block*(1.0-step(6.0,edge));
float hall=(P.x>-550&&P.x<2600)?1:0;
guideMask=max(guideMask,hall*(1.0-step(3.0,min(abs(P.y-80),abs(P.y-400)))));
guideMask*=1.0-step(90.0,P.z);
return lerp(color,float3(.22,.004,.008),guideMask);'''

def compact(s):
    return re.sub(r'\s+', '', s)

def check(condition, message):
    if not condition:
        raise RuntimeError(message)

def checkpoint_report():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/'receipt.json').write_text(json.dumps(REPORT, indent=2), encoding='utf-8')

def native_file(asset_path, extension='.uasset'):
    check(asset_path.startswith('/Game/'), 'Unexpected source mount: '+asset_path)
    return PROJECT/'Content'/Path(asset_path[len('/Game/'):]+extension)

def hash_file(p):
    with p.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def package_name(obj):
    return obj.get_package().get_name()

def writable(obj):
    check(package_name(obj).startswith(DEST+'/'), 'Refusing to edit outside unique review packages: '+package_name(obj))

def saved(asset):
    path=asset.get_path_name() if hasattr(asset, 'get_path_name') else asset
    check(path.startswith(DEST+'/'), 'Refusing to save outside review: '+path)
    check(ELL.save_asset(path, only_if_is_dirty=False), 'Asset save failed: '+path)

def inputs(mat, node):
    # Both native implementations iterate FExpressionInputIterator, including None entries.
    names=list(MEL.get_material_expression_input_names(node))
    values=list(MEL.get_inputs_for_material_expression(mat, node))
    check(len(names)==len(values), 'Native input-name/value counts differ: '+node.get_name())
    result={re.sub(r'[^a-z0-9]', '', str(n).lower()):v for n,v in zip(names,values)}
    return result

def material_graph(mat, kind, edited=False):
    expressions=list(MEL.get_material_expressions(mat))
    check(expressions, 'No material expressions found: '+mat.get_path_name())
    expected='MaterialExpressionCustom_0' if kind=='wall' else 'MaterialExpressionCustom_2'
    candidates=[e for e in expressions if e.get_name()==expected and e.get_class().get_name()=='MaterialExpressionCustom']
    check(len(candidates)==1, 'Expected exactly one '+expected+' in '+mat.get_path_name())
    custom=candidates[0]
    input_names={str(v.get_editor_property('input_name')) for v in custom.get_editor_property('inputs')}
    check(input_names==({'P'} if kind=='wall' else {'C','P'}), 'Custom input signature changed: '+expected)
    code=compact(custom.get_editor_property('code'))
    required=(['fmod(abs(P.z+20.0),320.0)', 'z>82.0&&z<100.0', 'z>154.0&&z<172.0', 'z>226.0&&z<244.0']
              if kind=='wall' else ['P.xy*.075', 'floatflow=', 'guideMask', 'saturate(C)'])
    check(all(s in code for s in required), 'Custom code signature changed; inspect instead of guessing: '+expected)
    substrates=[e for e in expressions if e.get_class().get_name()=='MaterialExpressionSubstrateShadingModels']
    linked=[s for s in substrates if inputs(mat,s).get('basecolor')==custom]
    check(len(linked)==1, 'Custom node does not uniquely feed Substrate BaseColor: '+expected)
    pins=inputs(mat,linked[0])
    if kind=='wall':
        for pin,param in [('roughness','Roughness'),('specular','Specular')]:
            node=pins.get(pin)
            check(node is not None and node.get_class().get_name()=='MaterialExpressionScalarParameter', 'Expected connected scalar for wall '+pin)
            check(str(node.get_editor_property('parameter_name'))==param, 'Wrong scalar connected to '+pin)
    if edited:
        check(custom.get_editor_property('code')==(WALL_CODE if kind=='wall' else FLOOR_CODE), 'Custom code readback failed')
    return custom, linked[0], pins

def graph_receipt(mat, kind, edited=False):
    custom,substrate,pins=material_graph(mat,kind,edited)
    data={'asset':mat.get_path_name(),'custom':custom.get_name(),'substrate':substrate.get_name(),
          'code_sha256':hashlib.sha256(custom.get_editor_property('code').encode()).hexdigest(),
          'input_nodes':{k:(v.get_name() if v else None) for k,v in pins.items()}}
    if kind=='wall':
        data['roughness']=float(pins['roughness'].get_editor_property('default_value'))
        data['specular']=float(pins['specular'].get_editor_property('default_value'))
    return data

def clone_materials():
    made={}
    for variant in ('Before','After'):
        made[variant]={}
        for kind,src in SOURCE_MATERIALS.items():
            path=DEST+'/Materials/M_Prison'+kind.title()+'_'+variant
            check(not ELL.does_asset_exist(path), 'Unique asset unexpectedly exists: '+path)
            m=ELL.duplicate_asset(src,path)
            check(m is not None, 'Material duplication failed: '+path)
            writable(m)
            before=graph_receipt(m,kind)
            if variant=='After':
                custom,substrate,pins=material_graph(m,kind)
                custom.set_editor_property('code',WALL_CODE if kind=='wall' else FLOOR_CODE)
                if kind=='wall':
                    # These are the actual UMaterial scalar expression defaults, not instance setters.
                    pins['roughness'].set_editor_property('default_value',0.88)
                    pins['specular'].set_editor_property('default_value',0.18)
                    check(abs(float(pins['roughness'].get_editor_property('default_value'))-.88)<1e-5,'Roughness readback failed')
                    check(abs(float(pins['specular'].get_editor_property('default_value'))-.18)<1e-5,'Specular readback failed')
                errors=list(MEL.recompile_material(m) or [])
                check(not errors, 'Material compile errors: '+repr(errors))
            saved(m)
            after=graph_receipt(m,kind,variant=='After')
            REPORT['changes'].append({'type':'material_duplicate','before':before,'after':after})
            made[variant][kind]=m
    return made

def save_map(world,path):
    check(path.startswith(DEST+'/Maps/'),'Map destination outside review')
    check(SAVE.save_map(world,path),'Map save failed: '+path)
    # Native Save As can retain the previous editor world's package identity.
    # Reload before any subsequent edit; do not assume Save As changes ownership.
    if package_name(UES.get_editor_world())!=path:
        check(SAVE.load_map(path) is not None,'Cannot reload newly saved review map')
    check(package_name(UES.get_editor_world())==path,'Reloaded world is not the review destination')

def vector(v):
    return unreal.Vector(*[float(x) for x in v])

def spawn(cls,label,loc,rotation=None):
    check(package_name(UES.get_editor_world()).startswith(DEST+'/Maps/'),'Spawn requires saved unique review map')
    a=ACTORS.spawn_actor_from_class(cls,vector(loc),rotation or unreal.Rotator())
    check(a is not None,'Could not spawn '+label)
    writable(a);a.set_actor_label(label);a.set_folder_path('Codex/PrisonMaterialReview/'+RUN)
    return a

def camera_settings(cc,ev):
    s=cc.get_editor_property('post_process_settings')
    values={
        'override_auto_exposure_method':True,'auto_exposure_method':unreal.AutoExposureMethod.AEM_HISTOGRAM,
        'override_auto_exposure_min_brightness':True,'auto_exposure_min_brightness':ev,
        'override_auto_exposure_max_brightness':True,'auto_exposure_max_brightness':ev,
        'override_auto_exposure_bias':True,'auto_exposure_bias':0.0,
        'override_auto_exposure_bias_curve':True,'auto_exposure_bias_curve':None,
        'override_auto_exposure_apply_physical_camera_exposure':True,'auto_exposure_apply_physical_camera_exposure':False,
        'override_local_exposure_highlight_contrast_scale':True,'local_exposure_highlight_contrast_scale':1.0,
        'override_local_exposure_shadow_contrast_scale':True,'local_exposure_shadow_contrast_scale':1.0,
        'override_local_exposure_detail_strength':True,'local_exposure_detail_strength':1.0,
        'override_local_exposure_middle_grey_bias':True,'local_exposure_middle_grey_bias':0.0,
        'override_motion_blur_amount':True,'motion_blur_amount':0.0,
    }
    for key,value in values.items():s.set_editor_property(key,value)
    cc.set_editor_property('post_process_settings',s);cc.set_editor_property('post_process_blend_weight',1.0)
    got=cc.get_editor_property('post_process_settings')
    check(abs(float(got.get_editor_property('auto_exposure_min_brightness'))-ev)<1e-5,'Exposure readback failed')
    check(abs(float(got.get_editor_property('auto_exposure_max_brightness'))-ev)<1e-5,'Exposure readback failed')

def make_camera(spec,ev):
    label,loc,target,fov=spec
    rot=unreal.MathLibrary.find_look_at_rotation(vector(loc),vector(target))
    a=spawn(unreal.CameraActor,'NH_MAT_'+label,loc,rot)
    cc=a.get_component_by_class(unreal.CameraComponent)
    cc.set_editor_property('field_of_view',float(fov));cc.set_editor_property('constrain_aspect_ratio',False)
    camera_settings(cc,ev)
    return a

def sequence(world_path,name,specs,ev):
    cams=[make_camera(spec,ev) for spec in specs]
    path=DEST+'/Sequences/LS_'+name
    seq=ASSETS.create_asset('LS_'+name,DEST+'/Sequences',unreal.LevelSequence,unreal.LevelSequenceFactoryNew())
    check(seq is not None,'Sequence creation failed')
    seq.set_display_rate(unreal.FrameRate(24,1));seq.set_playback_start(0);seq.set_playback_end(24*len(cams))
    cuts=seq.add_track(unreal.MovieSceneCameraCutTrack)
    for i,a in enumerate(cams):
        binding=seq.add_possessable(a);section=cuts.add_section();section.set_range(i*24,(i+1)*24)
        section.set_camera_binding_id(unreal.MovieSceneSequenceExtensions.get_binding_id(seq,binding))
    saved(seq);save_map(UES.get_editor_world(),world_path)
    job={'map':world_path,'seq':path,'out':str(OUT/name),'w':1920,'h':1080,'prefix':name,'warm':64,
         'status':'PREPARED_NOT_RENDERED','fps':24,'frames':24*len(cams),
         'camera_order':[{'name':s[0],'location_cm':s[1],'target_cm':s[2],'fov':s[3],'ev100':ev,
                          'frame_start':i*24,'frame_end_exclusive':(i+1)*24} for i,s in enumerate(specs)]}
    REPORT['render_jobs'].append(job)
    (OUT/(name+'_render_job.json')).write_text(json.dumps(job,indent=2),encoding='utf-8')

CORRIDOR_VIEWS=[
    ('01_corridor_forward',(-8500,-6100,140),(-4300,-6100,135),70),
    ('02_corridor_reverse',(-4600,-6100,140),(-8800,-6100,135),70),
    ('03_wall_front',(-6500,-5800,150),(-6500,-6200,150),52),
    ('04_wall_three_quarter',(-6780,-5790,155),(-6320,-6200,150),52),
    ('05_floor_front',(-6000,-6040,150),(-6000,-6040,-20),50),
    ('06_floor_three_quarter',(-6440,-5780,125),(-5850,-6070,-20),55),
]

def light_receipt():
    result=[]
    for a in ACTORS.get_all_level_actors():
        for lc in a.get_components_by_class(unreal.LightComponent):
            loc=a.get_actor_location()
            result.append({'label':a.get_actor_label(),'component':lc.get_name(),
                           'xyz':[loc.x,loc.y,loc.z],'class':lc.get_class().get_name(),
                           'intensity':float(lc.get_editor_property('intensity')),
                           'temperature':float(lc.get_editor_property('temperature')),
                           'use_temperature':bool(lc.get_editor_property('use_temperature')),
                           'color':str(lc.get_editor_property('light_color'))})
    return sorted(result,key=lambda v:(v['label'],v['component']))

def corridor_map(variant,materials):
    check(SAVE.load_map(SOURCE_MAP) is not None,'Cannot load source v008 map')
    world=UES.get_editor_world();path=DEST+'/Maps/L_Corridor_'+variant
    save_map(world,path)  # Save As before ANY actor edits; never save to v008/v009.
    source_lights=light_receipt();counts={'wall':0,'floor':0};changes=[]
    for a in ACTORS.get_all_level_actors():
        if not a.get_actor_label().startswith('RP_'):continue
        for comp in a.get_components_by_class(unreal.StaticMeshComponent):
            for slot,mat in enumerate(comp.get_materials()):
                if mat is None:continue
                kind=next((k for k,p in SOURCE_MATERIALS.items() if mat.get_path_name().split('.')[0]==p),None)
                if kind is None:continue
                writable(a);writable(comp)
                comp.set_material(slot,materials[kind]);counts[kind]+=1
                changes.append({'actor':a.get_actor_label(),'actor_path':a.get_path_name(),'component':comp.get_name(),
                                'slot':slot,'source':mat.get_path_name(),'replacement':materials[kind].get_path_name()})
    check(counts['wall']>0 and counts['floor']>0,'No source material slots found; stop and inspect v008')
    sequence(path,'Corridor_'+variant,CORRIDOR_VIEWS,CORRIDOR_EV)
    check(light_receipt()==source_lights,'A corridor light changed unexpectedly')
    REPORT['changes'].append({'type':'corridor_map','map':path,'material_slots':counts,
                             'lights_unchanged':True,'lights':source_lights,'overrides':changes})
    checkpoint_report()

def neutral_backdrop():
    path=DEST+'/Materials/M_NeutralBackdrop'
    m=ASSETS.create_asset('M_NeutralBackdrop',DEST+'/Materials',unreal.Material,unreal.MaterialFactoryNew())
    check(m is not None,'Backdrop material creation failed');writable(m)
    color=MEL.create_material_expression(m,unreal.MaterialExpressionConstant3Vector,-400,0)
    color.set_editor_property('constant',unreal.LinearColor(.18,.18,.18,1.0))
    rough=MEL.create_material_expression(m,unreal.MaterialExpressionConstant,-400,150)
    rough.set_editor_property('r',.85)
    check(MEL.connect_material_property(color,'',unreal.MaterialProperty.MP_BASE_COLOR),'Backdrop color connection failed')
    check(MEL.connect_material_property(rough,'',unreal.MaterialProperty.MP_ROUGHNESS),'Backdrop roughness connection failed')
    errors=list(MEL.recompile_material(m) or []);check(not errors,'Backdrop compile errors: '+repr(errors));saved(m)
    return m

def cube(label,loc,scale,material):
    a=spawn(unreal.StaticMeshActor,label,loc)
    comp=a.get_component_by_class(unreal.StaticMeshComponent)
    check(comp.set_static_mesh(ELL.load_asset('/Engine/BasicShapes/Cube.Cube')),'Cube mesh assignment failed')
    a.set_actor_scale3d(vector(scale));comp.set_material(0,material)
    return a

NEUTRAL_VIEWS=[
    ('01_wall_front',(0,-850,140),(0,0,140),50),
    ('02_wall_three_quarter',(-450,-700,165),(0,0,145),52),
    ('03_floor_front',(0,-330,720),(0,-330,-20),52),
    ('04_floor_three_quarter',(-400,-720,230),(0,-280,-20),55),
]

def neutral_map(variant,materials,backdrop):
    world=SAVE.new_blank_map(False);check(world is not None,'Blank neutral map creation failed')
    path=DEST+'/Maps/L_Neutral_'+variant;save_map(world,path)
    # At original corridor floor height, matching P.z stripe phase. The broad wall
    # face is X-Z (Y thickness 20 cm), perpendicular to the front camera's +Y view.
    cube('NH_Neutral_BackdropFloor',(0,-400,-40),(24,22,.2),backdrop)
    cube('NH_Neutral_BackdropWall',(0,100,450),(24,.2,10),backdrop)
    cube('NH_Neutral_WallSample',(0,0,140),(6,.2,3.4),materials['wall'])
    cube('NH_Neutral_FloorSample',(0,-340,-25),(6,6,.1),materials['floor'])
    for i,(loc,target,lumens,width,height) in enumerate([
        ((-450,-650,650),(0,-100,120),8000,500,500),
        ((500,-450,480),(0,-120,120),5000,400,400),
        ((0,-200,820),(0,-320,-20),3500,450,450),
    ]):
        rot=unreal.MathLibrary.find_look_at_rotation(vector(loc),vector(target))
        a=spawn(unreal.RectLight,'NH_Neutral_Rect_'+str(i),loc,rot)
        lc=a.get_component_by_class(unreal.RectLightComponent)
        lc.set_editor_property('intensity_units',unreal.LightUnits.LUMENS)
        lc.set_editor_property('intensity',float(lumens));lc.set_editor_property('source_width',float(width))
        lc.set_editor_property('source_height',float(height));lc.set_editor_property('attenuation_radius',2000.0)
        lc.set_editor_property('use_temperature',True);lc.set_editor_property('temperature',6500.0)
        lc.set_editor_property('light_color',unreal.Color(255,255,255,255))
    sequence(path,'Neutral_'+variant,NEUTRAL_VIEWS,NEUTRAL_EV)
    REPORT['changes'].append({'type':'neutral_map','map':path,'lights':light_receipt(),
                             'external_sky_or_fog_added':False,'wall_broad_face_normal_axis':'Y'})
    checkpoint_report()

def source_hashes():
    sources=[native_file(SOURCE_MAP,'.umap')]+[native_file(p) for p in SOURCE_MATERIALS.values()]
    return {str(p):hash_file(p) for p in sources}

def preflight():
    actual=Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()
    check(os.path.normcase(str(actual))==os.path.normcase(str(PROJECT.resolve())),'Wrong editor project: '+str(actual))
    dirty=list(SAVE.get_dirty_map_packages())+list(SAVE.get_dirty_content_packages())
    check(not dirty,'Editor has unsaved packages; sole writer must save/review them before this script: '+str([p.get_name() for p in dirty]))
    check(ELL.does_asset_exist(SOURCE_MAP),'Source v008 map missing')
    check(not ELL.does_directory_exist(DEST),'Unique destination already exists')
    check(unreal.SystemLibrary.get_console_variable_int_value('r.DefaultFeature.AutoExposure.ExtendDefaultLuminanceRange')==1,
          'Project must use extended EV100 range; fixed exposure values would otherwise have different units')
    REPORT['source_sha256_before']=source_hashes()
    REPORT['source_graphs']={kind:graph_receipt(ELL.load_asset(path),kind) for kind,path in SOURCE_MATERIALS.items()}
    REPORT['status']='preflight_passed_no_project_writes';checkpoint_report()

def main():
    preflight()
    if ACTION=='inspect':
        check(REPORT['source_sha256_before']==source_hashes(),'Source files changed during inspection')
        unreal.log('Prison material review inspection passed; no Unreal assets changed. Receipt: '+str(OUT/'receipt.json'))
        return
    # Back up the exact source map/material files to the receipt folder; originals are never overwritten.
    backup=OUT/'SourceCheckpoint';backup.mkdir()
    for src,digest in REPORT['source_sha256_before'].items():
        p=Path(src);dst=backup/p.name;shutil.copy2(p,dst)
        check(hash_file(dst)==digest,'Source checkpoint hash mismatch: '+str(dst))
    for sub in ('Materials','Maps','Sequences'):ELL.make_directory(DEST+'/'+sub)
    materials=clone_materials();checkpoint_report()
    for variant in ('Before','After'):corridor_map(variant,materials[variant])
    backdrop=neutral_backdrop()
    for variant in ('Before','After'):neutral_map(variant,materials[variant],backdrop)
    REPORT['source_sha256_after']=source_hashes()
    check(REPORT['source_sha256_before']==REPORT['source_sha256_after'],'Source file hash changed; stop and investigate concurrent writer')
    REPORT['status']='built_saved_not_rendered_not_approved'
    REPORT['verification']={'material_code_readback':True,'wall_scalar_readback':True,'material_compile_errors':[],
                            'source_files_unchanged':True,'corridor_lights_unchanged':True,
                            'rendered':False,'reopened_in_fresh_editor':False,'user_approved':False}
    checkpoint_report()
    # Show the saved candidate world on completion; do not alter v008/v009 or render queues.
    check(SAVE.load_map(DEST+'/Maps/L_Corridor_After') is not None,'Could not reopen saved review map')
    for variant in ('Before','After'):
        for kind in ('wall','floor'):
            m=ELL.load_asset(DEST+'/Materials/M_Prison'+kind.title()+'_'+variant)
            graph_receipt(m,kind,variant=='After')
    REPORT['verification']['review_map_reload_completed']=True;checkpoint_report()
    unreal.log('Prepared unique prison material review: '+DEST+' | '+str(OUT/'receipt.json'))

try:
    main()
except Exception:
    REPORT['status']='failed_no_automatic_cleanup'
    REPORT['error']=traceback.format_exc()
    checkpoint_report()
    unreal.log_error(REPORT['error'])
    raise
