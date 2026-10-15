import json, os, traceback, unreal

OUT = r"H:\NyghtshadeHollow_Development\2026-10-09\Maddox_Solo_Walkthrough\Maddox_Blueprint_Subobject_Audit.json"
PATHS = {
    "visual": "/Game/NyghtshadeHollow/CharacterRepair_20261005/BP_Maddox_Visual_Work",
    "playable": "/Game/NyghtshadeHollow/CharacterRepair_20261005/BP_Maddox_Playable_Work",
    "referencefit": "/Game/JERE_MetaHuman/Work_20261004_ReferenceFit/Assembled_Codex_20261004/Maddox_ReferenceFit/BP_Maddox_ReferenceFit",
}

def opath(o):
    try: return o.get_path_name() if o else None
    except Exception: return str(o)

def prop(o, names):
    for n in names:
        try: return o.get_editor_property(n)
        except Exception: pass
    return None

def lineage(cls):
    out=[]
    while cls:
        out.append(opath(cls))
        try: cls = cls.get_super_class()
        except Exception: break
    return out

def component_row(o):
    row={"name":o.get_name(),"class":o.get_class().get_name(),"path":opath(o)}
    if isinstance(o, unreal.SkeletalMeshComponent):
        row["skeletal_mesh"] = opath(prop(o,["skeletal_mesh_asset","skeletal_mesh"]))
        row["anim_class"] = opath(prop(o,["anim_class"]))
        row["leader_pose_component"] = opath(prop(o,["leader_pose_component"]))
        row["animation_mode"] = str(prop(o,["animation_mode"]))
    if isinstance(o, unreal.ChildActorComponent):
        row["child_actor_class"] = opath(prop(o,["child_actor_class"]))
        row["child_actor_template"] = opath(prop(o,["child_actor_template"]))
    try: row["relative_location"] = list(prop(o,["relative_location"]).to_tuple())
    except Exception: pass
    return row

res={"engine":unreal.SystemLibrary.get_engine_version(),"blueprints":{},"errors":[]}
try:
    sds=unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    lib=unreal.SubobjectDataBlueprintFunctionLibrary
    for key,path in PATHS.items():
        bp=unreal.load_asset(path)
        row={"loaded":bool(bp),"asset":opath(bp),"subobjects":[]}
        if bp:
            cls=bp.generated_class(); cdo=unreal.get_default_object(cls)
            row.update({"generated_class":opath(cls),"class_lineage":lineage(cls),"cdo":opath(cdo),"cdo_python_type":str(type(cdo))})
            try:
                handles=sds.k2_gather_subobject_data_for_blueprint(bp)
                row["subobject_count"]=len(handles)
                for h in handles:
                    d=lib.get_data(h)
                    o=lib.get_associated_object(d)
                    srow={"object":opath(o),"object_type":str(type(o)),"is_valid":bool(lib.is_handle_valid(h))}
                    if o and isinstance(o,unreal.ActorComponent): srow.update(component_row(o))
                    try: srow["display_name"] = str(lib.get_display_name(d))
                    except Exception: pass
                    try: srow["variable_name"] = str(lib.get_variable_name(d))
                    except Exception: pass
                    row["subobjects"].append(srow)
            except Exception: row["subobject_error"]=traceback.format_exc()
        res["blueprints"][key]=row
except Exception:
    res["errors"].append(traceback.format_exc())

os.makedirs(os.path.dirname(OUT),exist_ok=True)
with open(OUT,"w",encoding="utf-8") as f: json.dump(res,f,indent=2)
print("CODEX_MADDOX_SUBOBJECT_AUDIT_COMPLETE",OUT)
