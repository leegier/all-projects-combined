# Native prison material review builder — prepared, not executed

Script: `E:\_codex_tasks\build_prison_material_review_native_20261010.py`

This is for the sole Unreal writer after the waterfall proof. It neither launches Unreal nor starts a render. No existing package, original material, v008, v009, or render queue is overwritten or deleted.

## Scope and expected result

- Runs only in `E:\GameDev\Staging\MyProject2_EnvCopy_Claude_20261009` and refuses an editor with unsaved map/content packages.
- Default `NH_PRISON_LOOK_ACTION=inspect` checks installed APIs, the actual source material graph signatures, source file hashes and extended EV100 exposure configuration. It writes only a diagnostic receipt on H:.
- With `NH_PRISON_LOOK_ACTION=build`, creates a unique `/Game/_CodexReview/PrisonMaterial/Run_<timestamp>_<uuid>/` folder. Four material copies preserve independent Before/After references. Two new corridor maps use v008 as their source; two separate blank neutral test maps exclude exterior sky, fog and distant-scene lighting.
- Creates four sequences and render-job JSON specifications: Corridor_Before, Corridor_After, Neutral_Before, Neutral_After. Each camera occupies 24 frames at 24 fps. The output manifest requests 1920×1080 with 64 warm-up frames. It does not enqueue, render, encode or call a renderer.
- Runtime receipts, three hashed source-package checkpoint copies and image output destinations are under `H:\NyghtshadeHollow_Development\2026-10-10\PrisonMaterialReview\Run_<timestamp>_<uuid>\`.
- Leaves the saved candidate corridor review map open. A successful builder receipt means **built and saved, not rendered, freshly restarted, accepted or rolled out**.

## Exact material repair

The floor bug occurred because property-root traversal missed the color modifier feeding the Substrate node. This script uses `MaterialEditingLibrary.get_material_expressions`, not legacy property traversal. It selects wall `MaterialExpressionCustom_0` and floor `MaterialExpressionCustom_2` by their actual name, expected Custom class, code signature and input-name set (`P` or `C,P`). It then confirms the selected node uniquely feeds the Substrate Base Color pin. There is no string comparison against an enum's printed representation.

Input pin names and input objects are paired through two native methods that use the same `FExpressionInputIterator`; null inputs are preserved so pin indexing does not drift. The wall's connected Roughness and Specular nodes must be scalar parameters named exactly `Roughness` and `Specular`. Their actual `default_value` properties become 0.88 and 0.18, then are read back. The instance-only setter is not used on a UMaterial.

Wall stripe math is copied exactly from v008: period 320 cm and open intervals 82–100, 154–172, 226–244 cm, with the original `P.z+20` phase. Color/grain use the previously proposed deeper black and continuous paint noise. Floor color uses the intended finer crimson veins; the original flow field, guide-mask positions, UV, normal and texture-driven roughness wiring remain. Floor roughness is **not** flattened to a constant, and no unverified floor-specular override is introduced.

The installed `recompile_material` returns compiler errors. Any error halts the script; it is not silently accepted. The script records shader hashes and input-node readbacks. It refuses unknown graph layouts rather than choosing another node by guesswork.

## Review cameras and exposure

- Corridor: forward/reverse wide views, front/three-quarter wall views and front/three-quarter floor views. Cameras use measured CO099 hall coordinates. Existing warm lights and their properties are preserved; a before/after light-property comparison must match.
- Isolated neutral maps: one identical material sample arrangement per variant, so Before/After view exactly the same world coordinates under exactly the same lights. The wall is broad in X-Z and thin in Y, perpendicular to the front camera, fixing the earlier edge-on comparison. Both front and three-quarter views are included for wall and floor.
- Fixed exposure is applied on each camera with full blend weight. Histogram min/max are equal, bias is zero, bias curve is cleared, physical camera exposure is disabled, local-exposure contrast scales are neutral and motion blur is zero. EV100 defaults are corridor 2.5 and neutral 5.0. These values need an actual render; matching settings do not guarantee attractive exposure.
- The neutral stage has three explicit 6500 K rectangular lights. It does not use the corridor's warm lighting. The two neutral variants have matching geometry, light positions and intensities.
- The reference prison may batch many instances per component. Material overrides apply to matching `RP_` components in these **new review maps only**. Every actor/component package is checked against the new review folder before mutation. No per-instance rollout or final-map change is performed.

## Execution in the intended editor, by the sole writer

First save and inspect any existing dirty work. The following is intended for the Unreal Python execution context, not a normal OS Python interpreter:

```python
import os
os.environ['NH_PRISON_LOOK_ACTION'] = 'inspect'
exec(open(r'E:\_codex_tasks\build_prison_material_review_native_20261010.py', encoding='utf-8').read())
```

After reviewing the inspection receipt, the already-authorized writer can set the action to `build` and execute the same file. Every invocation gets a new UUID destination; it never replaces a previous attempt. Optional `NH_PRISON_CORRIDOR_EV100` and `NH_PRISON_NEUTRAL_EV100` environment values adjust the matched exposure of their pairs.

Do not call existing `prison_look.py` as part of this flow; it contains destructive replacement of its prior review packages. Do not treat the generated render-job specifications as completed renders. Root should use its native render path after reviewing the saved assets, and show Lee the actual paired outputs before broader adoption.

## Installed source/API evidence

All checked in the installed `H:\UE_5.8` tree; no plugin bridge calls are needed.

- `Engine/Source/Editor/MaterialEditor/Public/MaterialEditingLibrary.h:139–141`: enumerate complete material expression list.
- Same header `:323–337`; implementation `Private/MaterialEditingLibrary.cpp:1203–1225,1262–1273`: input names and objects use the same iterator, including null connected nodes.
- `Engine/Source/Runtime/Engine/Private/Materials/MaterialExpressionSubstrate.cpp:442–449`: Substrate Shading Models BaseColor, Metallic, Specular and Roughness pin names.
- `Engine/Source/Runtime/Engine/Public/Materials/MaterialExpressionCustom.h:27–35,79–88`: Custom code and named inputs.
- `Engine/Source/Runtime/Engine/Public/Materials/MaterialExpressionScalarParameter.h:27–29`: editable scalar default value.
- `MaterialEditingLibrary.h:262–267`: recompile returns error strings; an empty array means compile succeeded.
- `Engine/Source/Editor/UnrealEd/Public/FileHelpers.h:45,64,75,136,144`: blank map, load/save-as map and dirty-package queries.
- `Engine/Source/Runtime/Engine/Classes/Camera/CameraComponent.h:315–353`: camera post-process settings and blend weight.
- `Engine/Source/Runtime/Engine/Classes/Engine/Scene.h:33–40,913–946,1932–2002`: exposure enum, override flags, bias/curve and exposure bounds.
- `Engine/Source/Runtime/Engine/Classes/Components/LocalLightComponent.h:28` and `LightComponent.h:56–69`: local light units and temperature properties.
- `Engine/Plugins/Editor/EditorScriptingUtilities/Source/EditorScriptingUtilities/Public/EditorAssetLibrary.h:175,281,301`: duplicate, explicitly save and check destination directory.
- Actual graph provenance: `_claude_evidence/prisonmat/prison_mat_graph.json`, `custom_code.json`, `_log_look.txt` in the EnvCopy project.

## Checks performed without Unreal

Python syntax passed. The exact original stripe formula and preserved floor-flow/guide-mask lines were checked against the local graph-code receipt. Static inspection confirms no delete, actor destruction, queue rendering, editor quit or global save calls. Isolated fake-graph checks show wall/floor Substrate nodes are found with null pin positions preserved, and incorrect input signatures are rejected.

`E:\_codex_tasks\build_prison_material_review_native_20261010_static_checks.json` records those checks. It is **not** a native Unreal execution result. Rendering, shader appearance, actual API execution, fresh-editor reopen and Lee approval remain for root.
