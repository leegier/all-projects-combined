import json, pathlib, unreal
DEST='/Game/NyghtshadeHollow/CharacterRepair_20261005/Maddox/LocalPosterior_20261009T185221510217Z'
R={}
for k,path in [('original','/Game/NyghtshadeHollow/CharacterRepair_20261005/BP_Maddox_Playable_Work'),('candidate',DEST+'/BP_Maddox_Playable_LocalInset35')]:
    bp=unreal.load_asset(path);cdo=unreal.get_default_object(bp.generated_class());mesh=cdo.get_component_by_class(unreal.SkeletalMeshComponent)
    row={}
    for prop in ['visibility_based_anim_tick_option','hidden_in_game','visible','component_tick','animation_mode','enable_update_rate_optimizations','pause_anims','no_skeleton_update','anim_class']:
        try:row[prop]=str(mesh.get_editor_property(prop))
        except Exception as e:row[prop]='unavailable '+str(e)
    R[k]=row
pathlib.Path(r'H:\NyghtshadeHollow_Development\2026-10-09\Maddox_Solo_Walkthrough\Driver_Animation_Audit.json').write_text(json.dumps(R,indent=2),encoding='utf-8')
