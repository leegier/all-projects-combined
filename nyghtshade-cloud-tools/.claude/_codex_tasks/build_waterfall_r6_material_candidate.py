"""Build an isolated material-only R6 waterfall review candidate.

Run only in the root-owned full Unreal GUI editor.  The script hash-guards the
saved v018 map and its R5 flow/support meshes, clones v018 to the fresh private
map ``/Game/_CodexReview/WaterfallR6``, and creates two new materials:

* a broad translucent DefaultLit flow material using the verified owned
  SoulCave diffuse and normal textures on physical UV0, with negative-V panners
  (V increases downhill in the sealed R5 arrays) and a normalized U edge fade;
* an opaque triplanar bedrock-color material using the owned Pavilion stone
  texture, so the steep support skirts no longer use the prior XY-planar UV.

It changes only material slot 0 on the three existing R5 flow actors and three
existing R5 support-bed actors.  No mesh, transform, collision, pool, terrain,
rock, or source package is edited.  Successful compile/save/reopen readback is
still pending one matched actual pixel and human review.
"""

import builtins
import collections
import datetime
import hashlib
import json
import os
import pathlib
import traceback

import unreal as U


ROOT = pathlib.Path("E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009")
EVIDENCE = pathlib.Path(
    "H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup/Evidence"
)
SOURCE_MAP = "/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v018"
SOURCE_PACKAGE = ROOT / "Content/Nyghtshade/Maps/NH_EnvRefine_Codex_v018.umap"
SOURCE_SHA256 = "A66BAD052704DEBED7F05D7A521D536E2EF0FD595497D1D84F95EBE479043EBB"
SOURCE_RECEIPT = EVIDENCE / "V018_WaterfallR5_WindingUV_RepairReceipt.json"
SOURCE_RECEIPT_SHA256 = "45977D38C7DAB8F7D7987A31A20DC0971A469A27AC426AB1104C8179A84A9878"

TARGET_MAP = "/Game/_CodexReview/WaterfallR6"
TARGET_PACKAGE = ROOT / "Content/_CodexReview/WaterfallR6.umap"
ASSET_DIR = "/Game/_CodexReview/WaterfallR6_Assets"
FLOW_MATERIAL = ASSET_DIR + "/M_NH_CascadeFlow_R6"
BED_MATERIAL = ASSET_DIR + "/M_NH_WetBedrock_R6"
RECEIPT_PATH = EVIDENCE / "WaterfallR6_MaterialCandidateBuildReceipt.json"

OLD_FLOW_MATERIAL = "/Game/Nyghtshade/EnvironmentRepair_20261010/M_NH_CascadeFlow_R4B"
OLD_BED_MATERIAL = "/Game/Nyghtshade/EnvironmentRepair_20261010/M_NH_WetBedrock_R4B"
FLOW_DIFFUSE = "/Game/SoulCave/Environment/Textures/Water/T_WaterStream0002_2_D"
FLOW_NORMAL = "/Game/SoulCave/Environment/Textures/Water/T_WaterStream0002_2_L_alpha2_N"
BED_COLOR = "/Game/SeyeonjeongPavilion/Texture/Rock/T_BaseStone_BC"

FLOW_SPEED_Y = -1.0
NORMAL_SPEED_Y = -0.65
EDGE_WIDTH_U = 0.12
CENTER_OPACITY = 0.74
BED_WORLD_REPEAT_CM = 180.0
BED_COLOR_MULTIPLIER = 0.48
BED_ROUGHNESS = 0.28
BED_SPECULAR = 0.45

FLOW_LABELS = tuple("CL_Waterfall_Stream_%d" % index for index in range(3))
BED_LABELS = tuple("CL_Waterfall_SupportBed_%d_R5" % index for index in range(3))
AFFECTED_LABELS = set(FLOW_LABELS + BED_LABELS)

E = U.EditorAssetLibrary
AA = U.get_editor_subsystem(U.EditorActorSubsystem)
WW = U.get_editor_subsystem(U.UnrealEditorSubsystem)
MEL = U.MaterialEditingLibrary
AT = U.AssetToolsHelpers.get_asset_tools()


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def normalized(path):
    return os.path.normcase(os.path.realpath(str(path))).replace("\\", "/").rstrip("/")


def package_file(long_package_name, extension):
    if not long_package_name.startswith("/Game/"):
        raise RuntimeError("Only /Game packages are permitted: " + long_package_name)
    relative = long_package_name[len("/Game/") :].replace("/", os.sep)
    candidate = ROOT / "Content" / (relative + extension)
    if not normalized(candidate).startswith(normalized(ROOT / "Content") + "/"):
        raise RuntimeError("Package path escaped project Content")
    return candidate


def object_path(value):
    if value is None:
        return None
    try:
        return str(value.get_path_name())
    except Exception:
        return str(value)


def asset_package_name(value):
    return object_path(value).split(".", 1)[0]


def vec(value):
    return [round(float(value.x), 5), round(float(value.y), 5), round(float(value.z), 5)]


def quaternion(value):
    row = [float(value.x), float(value.y), float(value.z), float(value.w)]
    if row[3] < 0.0:
        row = [-number for number in row]
    return [round(number, 6) for number in row]


def actor_label(actor):
    return str(actor.get_actor_label())


def actor_map():
    actors = list(AA.get_all_level_actors())
    counts = collections.Counter(actor_label(actor) for actor in actors)
    duplicates = sorted(label for label, count in counts.items() if count != 1)
    if duplicates:
        raise RuntimeError("Duplicate actor labels prevent exact preservation proof: " + repr(duplicates[:20]))
    return {actor_label(actor): actor for actor in actors}


def component_geometry_signature(component):
    row = {
        "name": str(component.get_name()),
        "class": str(component.get_class().get_path_name()),
    }
    if isinstance(component, U.SceneComponent):
        row["relative_location_cm"] = vec(component.get_editor_property("relative_location"))
        rotation = component.get_editor_property("relative_rotation")
        row["relative_rotation_pitch_yaw_roll"] = [
            round(float(rotation.pitch), 5),
            round(float(rotation.yaw), 5),
            round(float(rotation.roll), 5),
        ]
        row["relative_scale"] = vec(component.get_editor_property("relative_scale3d"))
    if isinstance(component, U.StaticMeshComponent):
        mesh = component.static_mesh
        row["static_mesh"] = object_path(mesh)
        if mesh:
            nanite = mesh.get_editor_property("nanite_settings")
            row["mesh_nanite_enabled"] = bool(nanite.get_editor_property("enabled"))
            body = mesh.get_editor_property("body_setup")
            if body:
                row["body_collision_trace_flag"] = str(body.get_editor_property("collision_trace_flag"))
                row["body_double_sided_geometry"] = bool(body.get_editor_property("double_sided_geometry"))
    if isinstance(component, U.PrimitiveComponent):
        row["collision_enabled"] = str(component.get_collision_enabled())
        row["collision_profile"] = str(component.get_collision_profile_name())
    if isinstance(component, U.InstancedStaticMeshComponent):
        count = int(component.get_instance_count())
        row["instance_count"] = count
        instances = []
        for index in range(count):
            transform = component.get_instance_transform(index, True)
            instances.append(
                {
                    "translation_cm": vec(transform.translation),
                    "rotation_quaternion": quaternion(transform.rotation),
                    "scale": vec(transform.scale3d),
                }
            )
        row["instance_transforms"] = instances
    return row


def actor_geometry_signature(actor):
    location = actor.get_actor_location()
    rotation = actor.get_actor_rotation()
    return {
        "label": actor_label(actor),
        "class": str(actor.get_class().get_path_name()),
        "location_cm": vec(location),
        "rotation_pitch_yaw_roll": [
            round(float(rotation.pitch), 5),
            round(float(rotation.yaw), 5),
            round(float(rotation.roll), 5),
        ],
        "scale": vec(actor.get_actor_scale3d()),
        "actor_collision_enabled": bool(actor.get_actor_enable_collision()),
        "components": sorted(
            [
                component_geometry_signature(component)
                for component in actor.get_components_by_class(U.ActorComponent)
            ],
            key=lambda row: (row["class"], row["name"]),
        ),
    }


def world_geometry_signature(labels):
    digest = hashlib.sha256()
    for label in sorted(labels):
        encoded = json.dumps(
            actor_geometry_signature(labels[label]),
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        digest.update(encoded)
        digest.update(b"\n")
    return digest.hexdigest().upper()


def material_assignment_signature(labels):
    rows = []
    for label in sorted(labels):
        actor = labels[label]
        for component in actor.get_components_by_class(U.MeshComponent):
            materials = [
                object_path(component.get_material(index))
                for index in range(int(component.get_num_materials()))
            ]
            if label in AFFECTED_LABELS and materials:
                materials[0] = "__R6_INTENTIONALLY_REPLACED_SLOT_ZERO__"
            rows.append(
                {
                    "actor": label,
                    "component": str(component.get_name()),
                    "materials": materials,
                }
            )
    payload = json.dumps(rows, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest().upper()


def mesh_actor_state(actor):
    component = actor.static_mesh_component
    mesh = component.static_mesh
    body = mesh.get_editor_property("body_setup") if mesh else None
    return {
        "label": actor_label(actor),
        "mesh": asset_package_name(mesh) if mesh else None,
        "location_cm": vec(actor.get_actor_location()),
        "rotation_pitch_yaw_roll": [
            round(float(actor.get_actor_rotation().pitch), 5),
            round(float(actor.get_actor_rotation().yaw), 5),
            round(float(actor.get_actor_rotation().roll), 5),
        ],
        "scale": vec(actor.get_actor_scale3d()),
        "material_slot_0": asset_package_name(component.get_material(0)),
        "actor_collision_enabled": bool(actor.get_actor_enable_collision()),
        "component_collision_enabled": str(component.get_collision_enabled()),
        "component_collision_profile": str(component.get_collision_profile_name()),
        "body_collision_trace_flag": str(body.get_editor_property("collision_trace_flag")) if body else None,
        "body_double_sided_geometry": bool(body.get_editor_property("double_sided_geometry")) if body else None,
    }


def node(material, expression_class, x, y):
    result = MEL.create_material_expression(material, expression_class, int(x), int(y))
    if not result:
        raise RuntimeError("Could not create " + str(expression_class))
    return result


def connect(source, source_output, destination, destination_input):
    if not MEL.connect_material_expressions(source, source_output, destination, destination_input):
        raise RuntimeError(
            "Could not connect %s.%s -> %s.%s"
            % (source.get_name(), source_output, destination.get_name(), destination_input)
        )


def connect_property(source, source_output, property_value):
    if not MEL.connect_material_property(source, source_output, property_value):
        raise RuntimeError(
            "Could not connect %s.%s -> %s"
            % (source.get_name(), source_output, str(property_value))
        )


def constant(material, value, x, y):
    result = node(material, U.MaterialExpressionConstant, x, y)
    result.set_editor_property("r", float(value))
    return result


def component_mask(material, source, channels, x, y):
    result = node(material, U.MaterialExpressionComponentMask, x, y)
    for key in ("r", "g", "b", "a"):
        result.set_editor_property(key, key.upper() in channels.upper())
    connect(source, "", result, "Input")
    return result


def texture_sample(material, texture, sampler_type, coordinate, x, y):
    result = node(material, U.MaterialExpressionTextureSample, x, y)
    result.set_editor_property("texture", texture)
    result.set_editor_property("sampler_type", sampler_type)
    connect(coordinate, "", result, "UVs")
    return result


def create_flow_material(textures, lighting_mode):
    material = AT.create_asset(
        FLOW_MATERIAL.rsplit("/", 1)[-1],
        ASSET_DIR,
        U.Material,
        U.MaterialFactoryNew(),
    )
    if not material:
        raise RuntimeError("Could not create fresh R6 flow material")
    material.set_editor_property("blend_mode", U.BlendMode.BLEND_TRANSLUCENT)
    material.set_editor_property("two_sided", True)
    material.set_editor_property("used_with_nanite", False)
    material.set_editor_property("translucency_lighting_mode", lighting_mode)

    uv0 = node(material, U.MaterialExpressionTextureCoordinate, -1300, -60)
    uv0.set_editor_property("coordinate_index", 0)
    uv0.set_editor_property("u_tiling", 1.0)
    uv0.set_editor_property("v_tiling", 1.0)

    color_pan = node(material, U.MaterialExpressionPanner, -1050, -320)
    color_pan.set_editor_property("speed_x", 0.0)
    color_pan.set_editor_property("speed_y", FLOW_SPEED_Y)
    connect(uv0, "", color_pan, "Coordinate")
    color_sample = texture_sample(
        material,
        textures[FLOW_DIFFUSE],
        U.MaterialSamplerType.SAMPLERTYPE_COLOR,
        color_pan,
        -780,
        -320,
    )
    connect_property(color_sample, "RGB", U.MaterialProperty.MP_BASE_COLOR)

    normal_pan = node(material, U.MaterialExpressionPanner, -1050, 20)
    normal_pan.set_editor_property("speed_x", 0.0)
    normal_pan.set_editor_property("speed_y", NORMAL_SPEED_Y)
    connect(uv0, "", normal_pan, "Coordinate")
    normal_sample = texture_sample(
        material,
        textures[FLOW_NORMAL],
        U.MaterialSamplerType.SAMPLERTYPE_NORMAL,
        normal_pan,
        -780,
        20,
    )
    connect_property(normal_sample, "RGB", U.MaterialProperty.MP_NORMAL)

    u_mask = component_mask(material, uv0, "R", -1050, 330)
    left_divide = node(material, U.MaterialExpressionDivide, -820, 260)
    left_divide.set_editor_property("const_b", EDGE_WIDTH_U)
    connect(u_mask, "", left_divide, "A")
    left_saturate = node(material, U.MaterialExpressionSaturate, -600, 260)
    connect(left_divide, "", left_saturate, "Input")

    one_minus_u = node(material, U.MaterialExpressionOneMinus, -820, 440)
    connect(u_mask, "", one_minus_u, "Input")
    right_divide = node(material, U.MaterialExpressionDivide, -600, 440)
    right_divide.set_editor_property("const_b", EDGE_WIDTH_U)
    connect(one_minus_u, "", right_divide, "A")
    right_saturate = node(material, U.MaterialExpressionSaturate, -390, 440)
    connect(right_divide, "", right_saturate, "Input")

    edge = node(material, U.MaterialExpressionMultiply, -170, 330)
    connect(left_saturate, "", edge, "A")
    connect(right_saturate, "", edge, "B")
    opacity = node(material, U.MaterialExpressionMultiply, 70, 330)
    connect(edge, "", opacity, "A")
    connect(constant(material, CENTER_OPACITY, -170, 570), "", opacity, "B")
    connect_property(opacity, "", U.MaterialProperty.MP_OPACITY)

    connect_property(constant(material, 0.18, 160, 10), "", U.MaterialProperty.MP_ROUGHNESS)
    connect_property(constant(material, 0.55, 160, 110), "", U.MaterialProperty.MP_SPECULAR)
    MEL.layout_material_expressions(material)
    errors = list(MEL.recompile_material(material))
    if errors:
        raise RuntimeError("R6 flow material compiler errors: " + repr(errors))
    if not E.save_asset(FLOW_MATERIAL):
        raise RuntimeError("Could not save R6 flow material")
    return material, errors


def create_bed_material(textures):
    material = AT.create_asset(
        BED_MATERIAL.rsplit("/", 1)[-1],
        ASSET_DIR,
        U.Material,
        U.MaterialFactoryNew(),
    )
    if not material:
        raise RuntimeError("Could not create fresh R6 bed material")
    material.set_editor_property("blend_mode", U.BlendMode.BLEND_OPAQUE)
    material.set_editor_property("two_sided", True)
    material.set_editor_property("used_with_nanite", False)

    world_position = node(material, U.MaterialExpressionWorldPosition, -1500, -250)
    scaled_position = node(material, U.MaterialExpressionDivide, -1280, -250)
    scaled_position.set_editor_property("const_b", BED_WORLD_REPEAT_CM)
    connect(world_position, "", scaled_position, "A")

    uv_yz = component_mask(material, scaled_position, "GB", -1060, -520)
    uv_xz = component_mask(material, scaled_position, "RB", -1060, -260)
    uv_xy = component_mask(material, scaled_position, "RG", -1060, 0)
    sample_yz = texture_sample(
        material,
        textures[BED_COLOR],
        U.MaterialSamplerType.SAMPLERTYPE_COLOR,
        uv_yz,
        -800,
        -520,
    )
    sample_xz = texture_sample(
        material,
        textures[BED_COLOR],
        U.MaterialSamplerType.SAMPLERTYPE_COLOR,
        uv_xz,
        -800,
        -260,
    )
    sample_xy = texture_sample(
        material,
        textures[BED_COLOR],
        U.MaterialSamplerType.SAMPLERTYPE_COLOR,
        uv_xy,
        -800,
        0,
    )

    pixel_normal = node(material, U.MaterialExpressionPixelNormalWS, -1500, 360)
    absolute_normal = node(material, U.MaterialExpressionAbs, -1280, 360)
    connect(pixel_normal, "", absolute_normal, "Input")
    sharpened_normal = node(material, U.MaterialExpressionPower, -1060, 360)
    sharpened_normal.set_editor_property("const_exponent", 4.0)
    connect(absolute_normal, "", sharpened_normal, "Base")
    weight_x = component_mask(material, sharpened_normal, "R", -820, 300)
    weight_y = component_mask(material, sharpened_normal, "G", -820, 410)
    weight_z = component_mask(material, sharpened_normal, "B", -820, 520)
    sum_xy = node(material, U.MaterialExpressionAdd, -590, 390)
    connect(weight_x, "", sum_xy, "A")
    connect(weight_y, "", sum_xy, "B")
    sum_xyz = node(material, U.MaterialExpressionAdd, -390, 430)
    connect(sum_xy, "", sum_xyz, "A")
    connect(weight_z, "", sum_xyz, "B")

    normalized_weights = []
    for weight, y in ((weight_x, 250), (weight_y, 390), (weight_z, 530)):
        divide = node(material, U.MaterialExpressionDivide, -150, y)
        connect(weight, "", divide, "A")
        connect(sum_xyz, "", divide, "B")
        normalized_weights.append(divide)

    weighted_samples = []
    for sample, weight, y in zip(
        (sample_yz, sample_xz, sample_xy), normalized_weights, (-320, -100, 120)
    ):
        multiply = node(material, U.MaterialExpressionMultiply, 90, y)
        connect(sample, "RGB", multiply, "A")
        connect(weight, "", multiply, "B")
        weighted_samples.append(multiply)
    first_add = node(material, U.MaterialExpressionAdd, 330, -180)
    connect(weighted_samples[0], "", first_add, "A")
    connect(weighted_samples[1], "", first_add, "B")
    second_add = node(material, U.MaterialExpressionAdd, 550, -70)
    connect(first_add, "", second_add, "A")
    connect(weighted_samples[2], "", second_add, "B")
    darken = node(material, U.MaterialExpressionMultiply, 780, -70)
    connect(second_add, "", darken, "A")
    connect(constant(material, BED_COLOR_MULTIPLIER, 550, 150), "", darken, "B")
    connect_property(darken, "", U.MaterialProperty.MP_BASE_COLOR)
    connect_property(
        constant(material, BED_ROUGHNESS, 780, 180),
        "",
        U.MaterialProperty.MP_ROUGHNESS,
    )
    connect_property(
        constant(material, BED_SPECULAR, 780, 290),
        "",
        U.MaterialProperty.MP_SPECULAR,
    )
    MEL.layout_material_expressions(material)
    errors = list(MEL.recompile_material(material))
    if errors:
        raise RuntimeError("R6 bed material compiler errors: " + repr(errors))
    if not E.save_asset(BED_MATERIAL):
        raise RuntimeError("Could not save R6 bed material")
    return material, errors


def dependencies(material, root):
    if root is None:
        return []
    ordered = []
    seen = set()
    pending = [root]
    while pending:
        current = pending.pop()
        path = object_path(current)
        if path in seen:
            continue
        seen.add(path)
        ordered.append(current)
        pending.extend(
            item
            for item in MEL.get_inputs_for_material_expression(material, current)
            if item is not None
        )
    return ordered


def property_graph(material, property_name):
    property_value = getattr(U.MaterialProperty, property_name)
    root = MEL.get_material_property_input_node(material, property_value)
    nodes = dependencies(material, root)
    textures = []
    panners = []
    coordinates = []
    for expression in nodes:
        class_name = str(expression.get_class().get_name())
        if class_name == "MaterialExpressionTextureSample":
            textures.append(object_path(expression.get_editor_property("texture")))
        elif class_name == "MaterialExpressionPanner":
            panners.append(
                {
                    "node": expression.get_name(),
                    "speed_x": float(expression.get_editor_property("speed_x")),
                    "speed_y": float(expression.get_editor_property("speed_y")),
                }
            )
        elif class_name == "MaterialExpressionTextureCoordinate":
            coordinates.append(
                {
                    "node": expression.get_name(),
                    "coordinate_index": int(expression.get_editor_property("coordinate_index")),
                    "u_tiling": float(expression.get_editor_property("u_tiling")),
                    "v_tiling": float(expression.get_editor_property("v_tiling")),
                }
            )
    return {
        "root_node": root.get_name() if root else None,
        "root_class": root.get_class().get_name() if root else None,
        "root_output": MEL.get_material_property_input_node_output_name(material, property_value),
        "node_count": len(nodes),
        "classes": dict(collections.Counter(node.get_class().get_name() for node in nodes)),
        "textures": textures,
        "panners": panners,
        "texture_coordinates": coordinates,
    }


def material_readback(material, properties):
    used_textures = sorted(
        object_path(texture) for texture in MEL.get_material_used_textures(material)
    )
    return {
        "path": asset_package_name(material),
        "blend_mode": str(material.get_editor_property("blend_mode")),
        "shading_model": str(material.get_editor_property("shading_model")),
        "two_sided": bool(material.get_editor_property("two_sided")),
        "used_with_nanite": bool(material.get_editor_property("used_with_nanite")),
        "expression_count": len(MEL.get_material_expressions(material)),
        "used_textures": used_textures,
        "properties": {name: property_graph(material, name) for name in properties},
    }


def verify_flow_contract(material):
    if U.BlendMode.BLEND_TRANSLUCENT != material.get_editor_property("blend_mode"):
        raise RuntimeError("R6 flow material is not Translucent")
    if "MSM_DEFAULT_LIT" not in str(material.get_editor_property("shading_model")).upper():
        raise RuntimeError("R6 flow material is not DefaultLit")
    if not bool(material.get_editor_property("two_sided")):
        raise RuntimeError("R6 flow material lost two-sided rendering")
    if bool(material.get_editor_property("used_with_nanite")):
        raise RuntimeError("R6 flow material unexpectedly enables Nanite usage")
    result = material_readback(
        material,
        ("MP_BASE_COLOR", "MP_NORMAL", "MP_ROUGHNESS", "MP_SPECULAR", "MP_OPACITY"),
    )
    for name in result["properties"]:
        if result["properties"][name]["root_node"] is None:
            raise RuntimeError("R6 flow material has no " + name + " input")
    base = result["properties"]["MP_BASE_COLOR"]
    normal = result["properties"]["MP_NORMAL"]
    opacity = result["properties"]["MP_OPACITY"]
    if object_path(E.load_asset(FLOW_DIFFUSE)) not in base["textures"]:
        raise RuntimeError("R6 BaseColor does not reach the owned flow diffuse texture")
    if object_path(E.load_asset(FLOW_NORMAL)) not in normal["textures"]:
        raise RuntimeError("R6 Normal does not reach the owned flow normal texture")
    if len(base["panners"]) != 1 or abs(base["panners"][0]["speed_y"] - FLOW_SPEED_Y) > 1e-6:
        raise RuntimeError("R6 BaseColor downhill Panner contract failed")
    if len(normal["panners"]) != 1 or abs(normal["panners"][0]["speed_y"] - NORMAL_SPEED_Y) > 1e-6:
        raise RuntimeError("R6 Normal downhill Panner contract failed")
    if opacity["textures"]:
        raise RuntimeError("R6 opacity unexpectedly depends on the old sparse texture alpha")
    for required_class in (
        "MaterialExpressionComponentMask",
        "MaterialExpressionDivide",
        "MaterialExpressionSaturate",
        "MaterialExpressionOneMinus",
        "MaterialExpressionMultiply",
    ):
        if opacity["classes"].get(required_class, 0) < 1:
            raise RuntimeError("R6 opacity lacks " + required_class)
    return result


def verify_bed_contract(material):
    if U.BlendMode.BLEND_OPAQUE != material.get_editor_property("blend_mode"):
        raise RuntimeError("R6 bed material is not Opaque")
    if "MSM_DEFAULT_LIT" not in str(material.get_editor_property("shading_model")).upper():
        raise RuntimeError("R6 bed material is not DefaultLit")
    if not bool(material.get_editor_property("two_sided")):
        raise RuntimeError("R6 bed material lost two-sided rendering")
    if bool(material.get_editor_property("used_with_nanite")):
        raise RuntimeError("R6 bed material unexpectedly enables Nanite usage")
    result = material_readback(
        material,
        ("MP_BASE_COLOR", "MP_NORMAL", "MP_ROUGHNESS", "MP_SPECULAR"),
    )
    for name in ("MP_BASE_COLOR", "MP_ROUGHNESS", "MP_SPECULAR"):
        if result["properties"][name]["root_node"] is None:
            raise RuntimeError("R6 bed material has no " + name + " input")
    if result["properties"]["MP_NORMAL"]["root_node"] is not None:
        raise RuntimeError("R6 bed material unexpectedly uses an unverified tangent normal projection")
    base = result["properties"]["MP_BASE_COLOR"]
    expected_texture = object_path(E.load_asset(BED_COLOR))
    if base["textures"].count(expected_texture) != 3:
        raise RuntimeError("R6 bed BaseColor does not have three owned triplanar samples")
    for required_class in (
        "MaterialExpressionWorldPosition",
        "MaterialExpressionPixelNormalWS",
        "MaterialExpressionAbs",
        "MaterialExpressionPower",
        "MaterialExpressionComponentMask",
        "MaterialExpressionDivide",
    ):
        if base["classes"].get(required_class, 0) < 1:
            raise RuntimeError("R6 triplanar graph lacks " + required_class)
    return result


def schedule_delayed_quit():
    if os.environ.get("NH_AUTO_QUIT", "0") != "1":
        return
    state = {"ticks": 0, "handle": None}

    def tick(_delta_seconds):
        state["ticks"] += 1
        if state["ticks"] < 300:
            return
        if state["handle"] is not None:
            U.unregister_slate_post_tick_callback(state["handle"])
            state["handle"] = None
        U.SystemLibrary.quit_editor()

    state["handle"] = U.register_slate_post_tick_callback(tick)
    builtins._NH_WATERFALL_R6_BUILD_QUIT = (state, tick)


receipt = {
    "status": "STARTED_PRIVATE_MATERIAL_ONLY_BUILD",
    "started_utc": utc_now(),
    "source_map": SOURCE_MAP,
    "source_expected_sha256": SOURCE_SHA256,
    "source_receipt": str(SOURCE_RECEIPT).replace("\\", "/"),
    "source_receipt_expected_sha256": SOURCE_RECEIPT_SHA256,
    "target_map": TARGET_MAP,
    "asset_directory": ASSET_DIR,
    "scope": (
        "Fresh private material-only R6 candidate. Replace only material slot 0 on the "
        "three v018 R5 flow actors and three v018 R5 support-bed actors."
    ),
    "fixed_material_parameters": {
        "flow_base_color_speed_y": FLOW_SPEED_Y,
        "flow_normal_speed_y": NORMAL_SPEED_Y,
        "edge_fade_width_u": EDGE_WIDTH_U,
        "center_opacity": CENTER_OPACITY,
        "bed_world_repeat_cm": BED_WORLD_REPEAT_CM,
        "bed_color_multiplier": BED_COLOR_MULTIPLIER,
        "bed_roughness": BED_ROUGHNESS,
        "bed_specular": BED_SPECULAR,
    },
    "unreal_packages_created": [],
    "unreal_packages_overwritten": [],
    "limits": [
        "No mesh silhouette, support skirt, pool seam, terrain, collision or stream-coverage geometry is changed.",
        "Compiler/save/reopen success is not visual acceptance.",
        "One matched actual frame and human pixel review are required next.",
        "The bed Normal input is intentionally unconnected; only owned BaseColor is triplanar-projected because a correct world-space normal transform was not part of this bounded material discriminator.",
    ],
}

fatal_error = None
try:
    if pathlib.Path(U.Paths.project_dir()).resolve() != ROOT.resolve():
        raise RuntimeError("Wrong Unreal project")
    if WW is None or AA is None or AT is None:
        raise RuntimeError("Required full-editor subsystem is unavailable")
    if RECEIPT_PATH.exists():
        raise RuntimeError("Refusing to overwrite the prior R6 build receipt")
    if E.does_asset_exist(TARGET_MAP) or TARGET_PACKAGE.exists():
        raise RuntimeError("Fresh R6 target already exists")
    for path in (FLOW_MATERIAL, BED_MATERIAL):
        if E.does_asset_exist(path) or package_file(path, ".uasset").exists():
            raise RuntimeError("Fresh R6 material already exists: " + path)
    if sha256(SOURCE_RECEIPT) != SOURCE_RECEIPT_SHA256:
        raise RuntimeError("v018 repair receipt hash changed")
    source_receipt = json.loads(SOURCE_RECEIPT.read_text(encoding="utf-8"))
    if source_receipt.get("target_map") != SOURCE_MAP:
        raise RuntimeError("v018 receipt target map mismatch")
    if source_receipt.get("target_sha256", "").upper() != SOURCE_SHA256:
        raise RuntimeError("v018 receipt target hash mismatch")
    if sha256(SOURCE_PACKAGE) != SOURCE_SHA256:
        raise RuntimeError("v018 source map package hash changed")

    # Native/reflected API preflight happens before any map or asset mutation.
    required_expression_classes = (
        U.MaterialExpressionTextureCoordinate,
        U.MaterialExpressionPanner,
        U.MaterialExpressionTextureSample,
        U.MaterialExpressionComponentMask,
        U.MaterialExpressionDivide,
        U.MaterialExpressionSaturate,
        U.MaterialExpressionOneMinus,
        U.MaterialExpressionMultiply,
        U.MaterialExpressionWorldPosition,
        U.MaterialExpressionPixelNormalWS,
        U.MaterialExpressionAbs,
        U.MaterialExpressionPower,
        U.MaterialExpressionAdd,
        U.MaterialExpressionConstant,
    )
    if any(expression is None for expression in required_expression_classes):
        raise RuntimeError("A required native material expression class is unavailable")
    lighting_mode = getattr(
        U.TranslucencyLightingMode, "TLM_SURFACE_PER_PIXEL_LIGHTING", None
    )
    if lighting_mode is None:
        raise RuntimeError("SurfacePerPixelLighting enum is unavailable")

    source_assets = {
        OLD_FLOW_MATERIAL,
        OLD_BED_MATERIAL,
        FLOW_DIFFUSE,
        FLOW_NORMAL,
        BED_COLOR,
    }
    expected_mesh_hashes = {
        str(path): str(value).upper()
        for path, value in source_receipt["new_asset_sha256"].items()
    }
    source_assets.update(expected_mesh_hashes)
    for path in sorted(source_assets):
        if not E.does_asset_exist(path):
            raise RuntimeError("Required source asset is absent: " + path)
    source_package_hashes_before = {}
    for path in sorted(source_assets):
        package = package_file(path, ".uasset")
        if not package.is_file():
            raise RuntimeError("Source package file is absent: " + str(package))
        actual_hash = sha256(package)
        if path in expected_mesh_hashes and actual_hash != expected_mesh_hashes[path]:
            raise RuntimeError("R5 mesh package hash changed: " + path)
        source_package_hashes_before[path] = actual_hash

    textures = {
        path: E.load_asset(path) for path in (FLOW_DIFFUSE, FLOW_NORMAL, BED_COLOR)
    }
    if not all(textures.values()):
        raise RuntimeError("Could not load all owned R6 input textures")

    if U.EditorLoadingAndSavingUtils.load_map(SOURCE_MAP) is None:
        raise RuntimeError("Could not load exact v018 source map")
    source_labels = actor_map()
    if not AFFECTED_LABELS.issubset(source_labels):
        raise RuntimeError("v018 lacks one or more exact R5 waterfall actor labels")
    source_actor_count = len(source_labels)
    source_label_set = sorted(source_labels)
    source_geometry_signature = world_geometry_signature(source_labels)
    source_material_signature = material_assignment_signature(source_labels)
    source_waterfall_state = {
        label: mesh_actor_state(source_labels[label]) for label in sorted(AFFECTED_LABELS)
    }

    for index, label in enumerate(FLOW_LABELS):
        state = source_waterfall_state[label]
        expected_mesh = "/Game/Nyghtshade/EnvironmentRepair_20261010/SM_NH_CascadeFlow_%d_R5" % index
        if state["mesh"] != expected_mesh or state["material_slot_0"] != OLD_FLOW_MATERIAL:
            raise RuntimeError("Unexpected v018 flow actor source state: " + label)
        if state["actor_collision_enabled"] or "NO_COLLISION" not in state["component_collision_enabled"].upper():
            raise RuntimeError("v018 flow collision contract changed: " + label)
    for index, label in enumerate(BED_LABELS):
        state = source_waterfall_state[label]
        expected_mesh = "/Game/Nyghtshade/EnvironmentRepair_20261010/SM_NH_CascadeBed_%d_R5" % index
        if state["mesh"] != expected_mesh or state["material_slot_0"] != OLD_BED_MATERIAL:
            raise RuntimeError("Unexpected v018 support actor source state: " + label)
        if not state["actor_collision_enabled"]:
            raise RuntimeError("v018 support actor collision disabled: " + label)
        if "QUERY_AND_PHYSICS" not in state["component_collision_enabled"].upper():
            raise RuntimeError("v018 support component collision changed: " + label)
        if state["component_collision_profile"] != "BlockAll":
            raise RuntimeError("v018 support collision profile changed: " + label)
        if "COMPLEX_AS_SIMPLE" not in state["body_collision_trace_flag"].upper():
            raise RuntimeError("v018 support BodySetup collision changed: " + label)
        if state["body_double_sided_geometry"]:
            raise RuntimeError("v018 support BodySetup unexpectedly became two-sided")

    receipt["preflight"] = {
        "completed_before_any_map_or_asset_mutation": True,
        "source_map_sha256_before": sha256(SOURCE_PACKAGE),
        "source_receipt_sha256": sha256(SOURCE_RECEIPT),
        "source_actor_count": source_actor_count,
        "source_geometry_signature_sha256": source_geometry_signature,
        "source_material_assignment_signature_excluding_six_slot0_replacements_sha256": source_material_signature,
        "source_package_sha256": source_package_hashes_before,
        "source_waterfall_state": source_waterfall_state,
        "owned_input_textures": [FLOW_DIFFUSE, FLOW_NORMAL, BED_COLOR],
        "flow_uv_contract": (
            "sealed R5 UV0 U=0..1 across each ribbon; V increases from 0 at y=-3950cm "
            "to approximately 5.13..5.34 at y=-3425cm; negative Panner Y is downhill"
        ),
    }

    if not U.EditorLoadingAndSavingUtils.save_map(WW.get_editor_world(), TARGET_MAP):
        raise RuntimeError("Could not clone v018 to fresh private R6 map")
    receipt["unreal_packages_created"].append(TARGET_MAP)
    if U.EditorLoadingAndSavingUtils.load_map(TARGET_MAP) is None:
        raise RuntimeError("Could not reopen fresh private R6 map")
    if not E.does_directory_exist(ASSET_DIR):
        E.make_directory(ASSET_DIR)

    flow_material, flow_compile_errors = create_flow_material(textures, lighting_mode)
    receipt["unreal_packages_created"].append(FLOW_MATERIAL)
    bed_material, bed_compile_errors = create_bed_material(textures)
    receipt["unreal_packages_created"].append(BED_MATERIAL)

    target_labels = actor_map()
    if sorted(target_labels) != source_label_set:
        raise RuntimeError("Private clone actor labels differ from v018")
    for label in FLOW_LABELS:
        target_labels[label].static_mesh_component.set_material(0, flow_material)
    for label in BED_LABELS:
        target_labels[label].static_mesh_component.set_material(0, bed_material)

    if not U.EditorLoadingAndSavingUtils.save_map(WW.get_editor_world(), TARGET_MAP):
        raise RuntimeError("Could not save material-only R6 map")
    if U.EditorLoadingAndSavingUtils.load_map(TARGET_MAP) is None:
        raise RuntimeError("Could not reopen material-only R6 map")

    reopened_labels = actor_map()
    if sorted(reopened_labels) != source_label_set or len(reopened_labels) != source_actor_count:
        raise RuntimeError("Reopened R6 actor inventory differs from v018")
    reopened_geometry_signature = world_geometry_signature(reopened_labels)
    if reopened_geometry_signature != source_geometry_signature:
        raise RuntimeError("R6 changed saved geometry, transforms, HISM state or collision")
    reopened_material_signature = material_assignment_signature(reopened_labels)
    if reopened_material_signature != source_material_signature:
        raise RuntimeError("R6 changed a material assignment outside the six intended slot-0 replacements")

    reopened_flow_material = E.load_asset(FLOW_MATERIAL)
    reopened_bed_material = E.load_asset(BED_MATERIAL)
    flow_reopen_compile_errors = list(MEL.recompile_material(reopened_flow_material))
    bed_reopen_compile_errors = list(MEL.recompile_material(reopened_bed_material))
    if flow_reopen_compile_errors or bed_reopen_compile_errors:
        raise RuntimeError(
            "Reopened R6 material compile errors: flow=%r bed=%r"
            % (flow_reopen_compile_errors, bed_reopen_compile_errors)
        )
    if not E.save_asset(FLOW_MATERIAL) or not E.save_asset(BED_MATERIAL):
        raise RuntimeError("Could not persist recompiled R6 materials")
    if U.EditorLoadingAndSavingUtils.load_map(TARGET_MAP) is None:
        raise RuntimeError("Could not perform final R6 map reopen")

    final_labels = actor_map()
    if world_geometry_signature(final_labels) != source_geometry_signature:
        raise RuntimeError("Final R6 reopen changed geometry/collision signature")
    if material_assignment_signature(final_labels) != source_material_signature:
        raise RuntimeError("Final R6 reopen changed unrelated material assignments")

    final_states = {
        label: mesh_actor_state(final_labels[label]) for label in sorted(AFFECTED_LABELS)
    }
    for label in FLOW_LABELS:
        if final_states[label]["material_slot_0"] != FLOW_MATERIAL:
            raise RuntimeError("Reopened flow actor lost R6 material: " + label)
        source_without_material = dict(source_waterfall_state[label])
        target_without_material = dict(final_states[label])
        source_without_material.pop("material_slot_0")
        target_without_material.pop("material_slot_0")
        if source_without_material != target_without_material:
            raise RuntimeError("R6 altered flow mesh/transform/collision: " + label)
    for label in BED_LABELS:
        if final_states[label]["material_slot_0"] != BED_MATERIAL:
            raise RuntimeError("Reopened support actor lost R6 material: " + label)
        source_without_material = dict(source_waterfall_state[label])
        target_without_material = dict(final_states[label])
        source_without_material.pop("material_slot_0")
        target_without_material.pop("material_slot_0")
        if source_without_material != target_without_material:
            raise RuntimeError("R6 altered support mesh/transform/collision: " + label)

    flow_graph = verify_flow_contract(reopened_flow_material)
    bed_graph = verify_bed_contract(reopened_bed_material)
    source_package_hashes_after = {
        path: sha256(package_file(path, ".uasset")) for path in sorted(source_assets)
    }
    if source_package_hashes_after != source_package_hashes_before:
        raise RuntimeError("An existing source mesh/material/texture package changed")
    source_hash_after = sha256(SOURCE_PACKAGE)
    if source_hash_after != SOURCE_SHA256:
        raise RuntimeError("v018 source map package changed")
    if not TARGET_PACKAGE.is_file():
        raise RuntimeError("Saved private R6 target package is missing")

    target_hash = sha256(TARGET_PACKAGE)
    material_hashes = {
        FLOW_MATERIAL: sha256(package_file(FLOW_MATERIAL, ".uasset")),
        BED_MATERIAL: sha256(package_file(BED_MATERIAL, ".uasset")),
    }
    receipt.update(
        {
            "status": "BUILT_COMPILED_SAVED_REOPENED_PENDING_ONE_FRAME_PIXEL_REVIEW",
            "source_map_sha256_before": SOURCE_SHA256,
            "source_map_sha256_after": source_hash_after,
            "source_map_unchanged": True,
            "source_package_sha256_before": source_package_hashes_before,
            "source_package_sha256_after": source_package_hashes_after,
            "all_existing_source_packages_unchanged": True,
            "target_sha256": target_hash,
            "target_actor_count": len(final_labels),
            "geometry_collision_signature_before": source_geometry_signature,
            "geometry_collision_signature_after": world_geometry_signature(final_labels),
            "all_geometry_transforms_hisms_and_collision_unchanged": True,
            "unrelated_material_assignment_signature_before": source_material_signature,
            "unrelated_material_assignment_signature_after": material_assignment_signature(final_labels),
            "all_unrelated_material_assignments_unchanged": True,
            "new_material_sha256": material_hashes,
            "compiler_errors": {
                "flow_initial": flow_compile_errors,
                "bed_initial": bed_compile_errors,
                "flow_after_reopen": flow_reopen_compile_errors,
                "bed_after_reopen": bed_reopen_compile_errors,
            },
            "material_graph_readback": {
                "flow": flow_graph,
                "support_bed": bed_graph,
            },
            "affected_actor_state_before": source_waterfall_state,
            "affected_actor_state_after": final_states,
            "actual_pixels": "PENDING_MATCHED_SINGLE_FRAME_108_RENDER_AND_HUMAN_REVIEW",
        }
    )
except Exception:
    fatal_error = traceback.format_exc()
    receipt["status"] = "FAILED_PARTIAL_PRIVATE_PACKAGES_PRESERVED_DO_NOT_RETRY_BLINDLY"
    receipt["error"] = fatal_error
finally:
    receipt["completed_utc"] = utc_now()
    RECEIPT_PATH.parent.mkdir(parents=True, exist_ok=True)
    RECEIPT_PATH.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print("NH_WATERFALL_R6_BUILD", receipt["status"], str(RECEIPT_PATH))
    schedule_delayed_quit()

if fatal_error:
    raise RuntimeError(fatal_error)

