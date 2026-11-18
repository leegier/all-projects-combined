import json,pathlib,unreal
path='/Game/NyghtshadeHollow/CharacterRepair_20261005/Maddox/LocalPosterior_20261009T185221510217Z/BP_Maddox_ProofWalk_Driver'
bp=unreal.load_asset(path);ed=unreal.BlueprintGraphEditor.get_graph_editor_by_name(bp,'EventGraph')
nodes=[n for n in ed.list_all_nodes() if n.find_input_pin('WorldDirection').is_valid() and n.find_input_pin('ScaleValue').is_valid()]
assert len(nodes)==2
for n in nodes:
    p=n.find_input_pin('ScaleValue');assert abs(float(p.get_pin_value())-0.28)<1e-5;assert p.set_pin_value('0.18')
assert unreal.BlueprintEditorLibrary.compile_blueprint(bp)
assert unreal.EditorAssetLibrary.save_loaded_asset(bp,False)
pathlib.Path(r'H:\NyghtshadeHollow_Development\2026-10-09\Maddox_Solo_Walkthrough\Walk_Framing_Adjustment.json').write_text(json.dumps({'changed_asset':path,'prior_input_scale':0.28,'new_input_scale':0.18,'reason':'Keep whole character within static proof camera frame. Changes only isolated test driver.'},indent=2),encoding='utf-8')
