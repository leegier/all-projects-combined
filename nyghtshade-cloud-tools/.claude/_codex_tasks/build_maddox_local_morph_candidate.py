import json
from pathlib import Path

inspection_path = Path(r"H:\NyghtshadeHollow_Development\2026-10-05\Recovery_Inventory\MADDOX_LOCAL_MORPH_INSPECT_20261009T164751922052Z.json")
inspection = json.loads(inspection_path.read_text(encoding="utf-8"))

by_role = {asset["role"]: asset for asset in inspection["assets"]}
config = {
    "assets": [
        {
            "role": "body",
            "path": "/Game/JERE_MetaHuman/Work_20261004_ReferenceFit/Assembled_Codex_20261004/Maddox_ReferenceFit/Body/SKM_MH_Maddox_ReferenceFit_BodyMesh",
        },
        {
            "role": "shorts",
            "path": "/Game/JERE_MetaHuman/Work_20261004_ReferenceFit/Assembled_Codex_20261004/Maddox_ReferenceFit/Clothing/MH_Maddox_ReferenceFit_Outfits_2",
        },
    ],
    "axis_evidence": (
        "The prior fixed-profile Blender source renders establish Blender +Y posterior. "
        "FBX conversion flips depth: native UE pelvis Y is +3.0578616 cm and native shorts rear apex "
        "Y=-22.48043 cm maps exactly to the Blender +22.48043 cm recorded rear apex. "
        "Therefore native UE rear is -Y and the native pelvis origin is +3.0578616 cm."
    ),
    "roi": {
        "rear_axis": 1,
        "rear_sign": -1,
        "rear_origin_cm": 3.057861566543579,
        "rear_fade_cm": [0.0, 15.0],
        "lateral_center_cm": 0.0,
        "lateral_fade_cm": [12.0, 32.0],
        "z_fade_cm": [75.0, 93.0, 105.0, 122.0],
        "inset_cm": 3.5,
    },
    "expected_inspection": {
        "body": {str(lod["lod"]): lod["before"] for lod in by_role["body"]["lods"]},
        "shorts": {str(lod["lod"]): lod["before"] for lod in by_role["outfit_unknown_2"]["lods"]},
    },
}

script_path = Path(r"E:\_codex_tasks\maddox_local_morph_ue58_working.py")
scope = {
    "MORPH_MODE": "build",
    "MORPH_CONFIG": config,
    "__name__": "__main__",
}
exec(compile(script_path.read_text(encoding="utf-8"), str(script_path), "exec"), scope)
