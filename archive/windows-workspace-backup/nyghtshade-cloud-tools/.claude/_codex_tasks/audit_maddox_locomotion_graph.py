import json,pathlib,traceback,unreal
ROOT='/Game/NyghtshadeHollow/CharacterRepair_20261005/Maddox'
path=ROOT+'/LocalPosterior_20261009T185221510217Z/Maddox_ABP_Unarmed_LocalInset35'
R={'graphs':[],'blendspace':{},'clips':[],'errors':[]}
def op(o):
    try:return o.get_path_name() if o else None
    except Exception:return str(o)
def props(o,names):
    r={}
    for n in names:
        try:
            val=o.get_editor_property(n)
            r[n]=op(val) if isinstance(val,unreal.Object) else str(val)
        except Exception:pass
    return r
try:
    bp=unreal.load_asset(path)
    for graph in unreal.BlueprintEditorLibrary.list_graphs(bp):
        ed=unreal.BlueprintGraphEditor.get_graph_editor(graph)
        row={'name':graph.get_name(),'nodes':[]}
        for n in ed.list_all_nodes():
            nr={'name':n.get_name(),'class':n.get_class().get_name(),'title':n.get_node_title(),'properties':props(n,['bound_graph','result_node','blend_space','sequence','transition_rule','automatic_rule_based_on_sequence_player_in_state','logic_type','transition_type','crossfade_duration'])}
            try:
                node=n.get_editor_property('node');nr['runtime_node']=str(node);nr['runtime_props']=props(node,['blend_space','sequence','x','y','play_rate','loop_animation','internal_time_accumulator','blend_weight','pose_index','blend_time','b_reset_on_becoming_relevant'])
            except Exception:pass
            nr['pins']=[]
            for p in list(n.list_input_pins())+list(n.list_output_pins()):
                nr['pins'].append({'name':str(p.get_pin_name()),'value':p.get_pin_value(),'links':[x.get_owning_node().get_name()+':'+str(x.get_pin_name()) for x in p.list_connected_pins()]})
            row['nodes'].append(nr)
        R['graphs'].append(row)
    bs=unreal.load_asset(ROOT+'/Locomotion/Anims/Maddox_BS_Idle_Walk_Run')
    R['blendspace']={'path':op(bs),'skeleton':op(bs.get_editor_property('skeleton')),'samples':[]}
    for sample in bs.get_editor_property('sample_data'):
        R['blendspace']['samples'].append({'animation':op(sample.get_editor_property('animation')),'sample_value':str(sample.get_editor_property('sample_value'))})
    for name in ['Maddox_MF_Unarmed_Walk_Fwd','Maddox_MM_Idle']:
        clip=unreal.load_asset(ROOT+'/Locomotion/Anims/'+name)
        model=clip.get_editor_property('data_model_interface')
        cr={'path':op(clip),'skeleton':op(clip.get_editor_property('skeleton')),'length':clip.get_play_length(),'tracks':[]}
        for bone in ['root','pelvis','foot_l','foot_r']:
            if model.is_valid_bone_track_name(bone):
                data=model.get_bone_track_by_name(bone).get_editor_property('internal_track_data')
                ps=list(data.get_positional_keys());rs=list(data.get_rotational_keys())
                cr['tracks'].append({'bone':bone,'positions':len(ps),'rotations':len(rs),'position_ranges':[float(max(getattr(k,a) for k in ps)-min(getattr(k,a) for k in ps)) for a in ['x','y','z']] if ps else [],'rotation_first':str(rs[0]) if rs else None,'rotation_mid':str(rs[len(rs)//2]) if rs else None})
        R['clips'].append(cr)
except Exception:R['errors'].append(traceback.format_exc())
pathlib.Path(r'H:\NyghtshadeHollow_Development\2026-10-09\Maddox_Solo_Walkthrough\Locomotion_Graph_And_Clip_Audit.json').write_text(json.dumps(R,indent=2),encoding='utf-8')
