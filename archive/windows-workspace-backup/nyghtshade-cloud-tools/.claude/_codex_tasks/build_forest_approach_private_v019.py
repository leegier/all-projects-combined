"""Build the sealed forest-approach stairs in a fresh private candidate map.

Prepared and syntax-checked offline.  Run only in the sole-writer full Unreal
GUI editor after review.  The script never saves the source map.  It verifies
the actual tunnel concrete material, clones the current saved source to a new
private map, creates visible stair/retaining and two-rail meshes with real
BlockAll collision, adds the exact 100-foot measurement spline, saves, reopens,
and proves all pre-existing actor/component/HISM signatures stayed unchanged.

This is a review candidate.  It is not approval, pixel proof, PIE collision
proof, a possessed traversal, or a claim that outdoor stairs are accepted art.
"""

import collections
import datetime
import hashlib
import json
import math
import os
import pathlib
import traceback

import unreal as U


ROOT = pathlib.Path("E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009")
EVIDENCE = pathlib.Path("H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup/Evidence")
DEFAULT_SOURCE_RECEIPT = EVIDENCE / "V018_WaterfallR5_WindingUV_RepairReceipt.json"
DEFAULT_SOURCE_RECEIPT_SHA256 = "45977D38C7DAB8F7D7987A31A20DC0971A469A27AC426AB1104C8179A84A9878"
DEFAULT_SOURCE_MAP = "/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v018"
DEFAULT_SOURCE_MAP_SHA256 = "A66BAD052704DEBED7F05D7A521D536E2EF0FD595497D1D84F95EBE479043EBB"

SOURCE_RECEIPT = pathlib.Path(
    os.environ.get("NH_FOREST_APPROACH_SOURCE_RECEIPT", str(DEFAULT_SOURCE_RECEIPT))
)
TARGET_MAP = os.environ.get(
    "NH_FOREST_APPROACH_TARGET_MAP",
    "/Game/_CodexReview/ForestApproach/NH_ForestApproach_Review_v019",
)
ASSET_DIR = "/Game/_CodexReview/ForestApproach/Generated_v019"
STAIR_ASSET = ASSET_DIR + "/SM_NH_ForestApproach_StairRetaining_v019"
RAIL_ASSET = ASSET_DIR + "/SM_NH_ForestApproach_Rails_v019"
RECEIPT_PATH = pathlib.Path(
    os.environ.get(
        "NH_FOREST_APPROACH_BUILD_RECEIPT",
        str(EVIDENCE / "V019_ForestApproach_PrivateBuildReceipt.json"),
    )
)

GEOMETRY_PATH = pathlib.Path("E:/_codex_tasks/V019_ForestApproach_StairGeometry.json")
GEOMETRY_SHA256 = "E60D0A284624E5238B7583BBCD55327D39E1805D87629BF4EDFEC936D07A1CE8"
ROUTE_PROPOSAL_PATH = pathlib.Path("E:/_codex_tasks/V017_ForestApproach_100ft_Proposal.json")
ROUTE_PROPOSAL_SHA256 = "3BE52EB07132684CE8A7998034C7F742377DD45BF072AD79ACFC167C19952FBC"

TUNNEL_ACTOR_LABEL = "NH_Tunnel_SquareConcreteShell"
TUNNEL_CONCRETE = "/Game/Sankoolarts_CompoundWall_Kit/Material_Instances/MI_Mix_Concrete_Wall_01"
ROUTE_ACTOR_LABEL = "NH_ForestApproach_100ft_Route"
STAIR_ACTOR_LABEL = "CL_ForestApproach_StairRetaining_v019"
RAIL_ACTOR_LABEL = "CL_ForestApproach_Rails_v019"
NEW_LABELS = (ROUTE_ACTOR_LABEL, STAIR_ACTOR_LABEL, RAIL_ACTOR_LABEL)
TAG = U.Name("NH_FOREST_APPROACH_PRIVATE_V019")
FOLDER = "Nyghtshade/Review/ForestApproach"

E = U.EditorAssetLibrary
AA = U.get_editor_subsystem(U.EditorActorSubsystem)
WW = U.get_editor_subsystem(U.UnrealEditorSubsystem)
SME = U.get_editor_subsystem(U.StaticMeshEditorSubsystem)


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


def asset_package_file(asset):
    package_name = str(asset.get_path_name()).split(".", 1)[0]
    return package_file(package_name, ".uasset")


def gs(function_name):
    for name in dir(U):
        namespace = getattr(U, name)
        if name.startswith("GeometryScript") and hasattr(namespace, function_name):
            return getattr(namespace, function_name)
    raise RuntimeError("Missing supported GeometryScript method " + function_name)


def pick(value, expected_class):
    if isinstance(value, expected_class):
        return value
    return next(item for item in value if isinstance(item, expected_class))


def vec(value):
    return [round(float(value.x), 5), round(float(value.y), 5), round(float(value.z), 5)]


def quaternion(value):
    row = [float(value.x), float(value.y), float(value.z), float(value.w)]
    if row[3] < 0.0:
        row = [-number for number in row]
    return [round(number, 6) for number in row]


def object_path(value):
    try:
        return value.get_path_name() if value else None
    except Exception:
        return str(value)


def actor_label(actor):
    return str(actor.get_actor_label())


def actor_map():
    actors = list(AA.get_all_level_actors())
    counts = collections.Counter(actor_label(actor) for actor in actors)
    duplicates = sorted(label for label, count in counts.items() if count != 1)
    if duplicates:
        raise RuntimeError("Duplicate saved actor labels prevent exact preservation proof: " + repr(duplicates[:20]))
    return {actor_label(actor): actor for actor in actors}


def component_signature(component):
    row = {
        "name": str(component.get_name()),
        "class": str(component.get_class().get_path_name()),
    }
    if isinstance(component, U.SceneComponent):
        # UE 5.8 does not expose get_relative_location/get_relative_rotation
        # consistently to Python.  These native editor properties were already
        # exercised successfully by the saved v017/v018 diagnostic scripts.
        row["relative_location_cm"] = vec(component.get_editor_property("relative_location"))
        rotation = component.get_editor_property("relative_rotation")
        row["relative_rotation_pitch_yaw_roll"] = [
            round(float(rotation.pitch), 5),
            round(float(rotation.yaw), 5),
            round(float(rotation.roll), 5),
        ]
        row["relative_scale"] = vec(component.get_editor_property("relative_scale3d"))
    if isinstance(component, U.StaticMeshComponent):
        row["static_mesh"] = object_path(component.static_mesh)
    if isinstance(component, U.MeshComponent):
        row["materials"] = [
            object_path(component.get_material(index))
            for index in range(int(component.get_num_materials()))
        ]
    if isinstance(component, U.PrimitiveComponent):
        try:
            row["collision_enabled"] = str(component.get_collision_enabled())
            row["collision_profile"] = str(component.get_collision_profile_name())
        except Exception:
            pass
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


def saved_actor_signature(actor):
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
        "components": sorted(
            [component_signature(component) for component in actor.get_components_by_class(U.ActorComponent)],
            key=lambda row: (row["class"], row["name"]),
        ),
    }


def world_signature(actors_by_label, labels):
    rows = {label: saved_actor_signature(actors_by_label[label]) for label in sorted(labels)}
    payload = json.dumps(rows, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return rows, hashlib.sha256(payload).hexdigest().upper()


def create_dynamic_mesh(record):
    vertices = record["vertices_cm"]
    triangles = record["triangles"]
    uvs = record["uv0"]
    if len(vertices) != int(record["vertex_count"]) or len(triangles) != int(record["triangle_count"]):
        raise RuntimeError("sealed geometry counts disagree")
    if len(vertices) != len(uvs):
        raise RuntimeError("sealed vertex/UV counts disagree")
    mesh = U.DynamicMesh()
    gs("add_vertices_to_mesh")(
        mesh,
        pick(
            U.GeometryScript_List.convert_array_to_vector_list([U.Vector(*row) for row in vertices]),
            U.GeometryScriptVectorList,
        ),
    )
    gs("add_triangles_to_mesh")(
        mesh,
        pick(
            U.GeometryScript_List.convert_array_to_triangle_list([U.IntVector(*row) for row in triangles]),
            U.GeometryScriptTriangleList,
        ),
        0,
    )
    gs("set_num_uv_sets")(mesh, 1)
    for index, triangle in enumerate(triangles):
        triangle_uv = U.GeometryScriptUVTriangle()
        triangle_uv.set_editor_property("uv0", U.Vector2D(*uvs[triangle[0]]))
        triangle_uv.set_editor_property("uv1", U.Vector2D(*uvs[triangle[1]]))
        triangle_uv.set_editor_property("uv2", U.Vector2D(*uvs[triangle[2]]))
        gs("set_mesh_triangle_u_vs")(mesh, 0, index, triangle_uv, True)
    return mesh


def save_new_collision_mesh(record, destination, material):
    if E.does_asset_exist(destination):
        raise RuntimeError("Refusing existing private candidate mesh " + destination)
    if not E.duplicate_asset("/Engine/BasicShapes/Plane", destination):
        raise RuntimeError("Failed to seed private candidate mesh " + destination)
    asset = E.load_asset(destination)
    if not asset:
        raise RuntimeError("Could not load seeded private candidate mesh " + destination)
    nanite = asset.get_editor_property("nanite_settings")
    nanite.set_editor_property("enabled", False)
    asset.set_editor_property("nanite_settings", nanite)
    options = U.GeometryScriptCopyMeshToAssetOptions()
    options.set_editor_property("enable_recompute_normals", True)
    options.set_editor_property("enable_recompute_tangents", True)
    options.set_editor_property("replace_materials", True)
    options.set_editor_property("new_materials", [material])
    U.GeometryScript_AssetUtils.copy_mesh_to_static_mesh(
        create_dynamic_mesh(record), asset, options, U.GeometryScriptMeshWriteLOD()
    )
    body = asset.get_editor_property("body_setup")
    if not body:
        raise RuntimeError("Private candidate mesh has no BodySetup")
    body.set_editor_property("collision_trace_flag", U.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    body.set_editor_property("double_sided_geometry", False)
    if not E.save_asset(destination):
        raise RuntimeError("Failed to save private candidate mesh " + destination)
    if int(asset.get_num_triangles(0)) != int(record["triangle_count"]):
        raise RuntimeError("Saved mesh triangle count differs from sealed arrays")
    if int(SME.get_num_uv_channels(asset, 0)) < 1:
        raise RuntimeError("Saved mesh lost UV0")
    return asset


def spawn_blocking_mesh(label, mesh, material):
    actor = AA.spawn_actor_from_class(U.StaticMeshActor, U.Vector(0.0, 0.0, 0.0))
    if not actor:
        raise RuntimeError("Failed to spawn " + label)
    actor.set_actor_label(label)
    actor.set_folder_path(FOLDER)
    actor.set_editor_property("tags", [TAG])
    component = actor.static_mesh_component
    component.set_static_mesh(mesh)
    component.set_material(0, material)
    actor.set_actor_enable_collision(True)
    component.set_collision_profile_name("BlockAll")
    component.set_collision_enabled(U.CollisionEnabled.QUERY_AND_PHYSICS)
    component.set_cast_shadow(True)
    return actor


def add_instance_scene_component(actor, component_class, name):
    subsystem = U.get_engine_subsystem(U.SubobjectDataSubsystem)
    library = U.SubobjectDataBlueprintFunctionLibrary
    if subsystem is None:
        raise RuntimeError("SubobjectDataSubsystem unavailable")
    actor_handle = None
    root_handle = None
    for handle in subsystem.k2_gather_subobject_data_for_instance(actor):
        data = library.get_data(handle)
        if library.is_actor(data):
            actor_handle = handle
        if library.is_root_component(data):
            root_handle = handle
    if actor_handle is None:
        raise RuntimeError("Could not obtain route actor SubobjectData handle")
    if root_handle is None:
        root_handle, error = subsystem.add_new_subobject(
            U.AddNewSubobjectParams(
                parent_handle=actor_handle,
                new_class=U.SceneComponent.static_class(),
                blueprint_context=None,
            )
        )
        if not error.is_empty():
            raise RuntimeError("Could not add route root component: " + str(error))
        subsystem.rename_subobject(handle=root_handle, new_name=U.Text("DefaultSceneRoot"))
    handle, error = subsystem.add_new_subobject(
        U.AddNewSubobjectParams(
            parent_handle=root_handle,
            new_class=component_class,
            blueprint_context=None,
        )
    )
    if not error.is_empty():
        raise RuntimeError("Could not add route spline component: " + str(error))
    subsystem.rename_subobject(handle=handle, new_name=U.Text(name))
    data = library.get_data(handle)
    component = library.get_associated_object(data)
    if not component or not isinstance(component, component_class):
        raise RuntimeError("SubobjectData did not return the new spline component")
    return component


def spawn_route_actor(points):
    actor = AA.spawn_actor_from_class(U.Actor, U.Vector(0.0, 0.0, 0.0))
    if not actor:
        raise RuntimeError("Failed to spawn measurement-route actor")
    actor.set_actor_label(ROUTE_ACTOR_LABEL)
    actor.set_folder_path(FOLDER)
    actor.set_editor_property("tags", [TAG])
    spline = add_instance_scene_component(actor, U.SplineComponent, "RouteSpline_Exact100ft")
    spline.clear_spline_points(False)
    for index, point in enumerate(points):
        spline.add_spline_point(U.Vector(*point), U.SplineCoordinateSpace.WORLD, False)
        spline.set_spline_point_type(index, U.SplinePointType.LINEAR, False)
    spline.set_closed_loop(False, False)
    spline.update_spline()
    spline.set_draw_debug(True)
    return actor, spline


def exact_actor_material(label_map):
    if TUNNEL_ACTOR_LABEL not in label_map:
        raise RuntimeError("Actual tunnel shell actor is absent: " + TUNNEL_ACTOR_LABEL)
    matches = []
    for component in label_map[TUNNEL_ACTOR_LABEL].get_components_by_class(U.MeshComponent):
        for index in range(int(component.get_num_materials())):
            material = component.get_material(index)
            if material and object_path(material).split(".", 1)[0] == TUNNEL_CONCRETE:
                matches.append(material)
    if len(matches) != 1:
        raise RuntimeError(
            "Expected exactly one actual tunnel material slot using %s; found %d"
            % (TUNNEL_CONCRETE, len(matches))
        )
    if not E.does_asset_exist(TUNNEL_CONCRETE):
        raise RuntimeError("Verified tunnel material package does not exist")
    return matches[0]


receipt = {
    "status": "STARTED_OFFLINE_PREPARED_PRIVATE_BUILD_NOT_YET_VERIFIED",
    "generated_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "source_receipt": str(SOURCE_RECEIPT).replace("\\", "/"),
    "target_map": TARGET_MAP,
    "classification": (
        "fresh private candidate; visible 30-step concrete stair/retaining and two-rail barriers; "
        "no hidden ramp; pending pixel, PIE collision, and possessed-traversal proof and Lee approval"
    ),
    "created_assets": [],
    "created_actors": [],
    "map_or_package_saved": False,
    "source_map_saved": False,
}

try:
    if normalized(U.Paths.convert_relative_path_to_full(U.Paths.project_dir())) != normalized(ROOT):
        raise RuntimeError("Wrong Unreal project")
    if SME is None or U.get_editor_subsystem(U.AssetEditorSubsystem) is None:
        raise RuntimeError("Full owned GUI editor subsystems are unavailable")
    if not hasattr(U, "SubobjectDataSubsystem") or not hasattr(U, "AddNewSubobjectParams"):
        raise RuntimeError("Supported SubobjectData route-component APIs are unavailable")
    if sha256(GEOMETRY_PATH) != GEOMETRY_SHA256:
        raise RuntimeError("Sealed stair geometry hash changed")
    if sha256(ROUTE_PROPOSAL_PATH) != ROUTE_PROPOSAL_SHA256:
        raise RuntimeError("Sealed 100-foot route proposal hash changed")
    geometry = json.loads(GEOMETRY_PATH.read_text(encoding="utf-8"))
    if geometry["status"] != "OFFLINE_ARRAYS_PASS_PENDING_PRIVATE_UNREAL_BUILD_PIXEL_AND_RUNTIME_PROOF":
        raise RuntimeError("Unexpected sealed geometry status")
    if geometry["stair"]["tread_count"] != 30 or geometry["stair"]["no_hidden_ramp"] is not True:
        raise RuntimeError("Sealed stair contract changed")
    if "project-proven reversed UE 5.8 GeometryScript/Chaos face convention" not in geometry["classification"]:
        raise RuntimeError("Sealed geometry lacks the native-proven one-sided face convention")
    if abs(float(geometry["measurement_route"]["polyline_length_cm"]) - 3048.0) > 0.25:
        raise RuntimeError("Sealed measurement polyline is not 100 feet")
    points = geometry["measurement_route"]["polyline_points_world_cm"]
    fixed = geometry["fixed_invariants"]
    if math.hypot(points[0][0] - fixed["portal_xy_cm"][0], points[0][1] - fixed["portal_xy_cm"][1]) > 0.02:
        raise RuntimeError("Measurement route no longer starts at the fixed portal")
    if math.hypot(points[-1][0] - fixed["clearing_west_edge_xy_cm"][0], points[-1][1] - fixed["clearing_west_edge_xy_cm"][1]) > 0.02:
        raise RuntimeError("Measurement route no longer ends at the fixed clearing boundary")
    if abs(
        math.hypot(
            fixed["hero_root_cm"][0] - fixed["clearing_west_edge_xy_cm"][0],
            fixed["hero_root_cm"][1] - fixed["clearing_west_edge_xy_cm"][1],
        )
        - float(fixed["clearing_radius_cm"])
    ) > 0.02:
        raise RuntimeError("Fixed oak/clearing-boundary geometry no longer closes at 24 m")

    if not SOURCE_RECEIPT.is_file():
        raise RuntimeError("Missing source receipt")
    source_receipt_sha = sha256(SOURCE_RECEIPT)
    source_receipt = json.loads(SOURCE_RECEIPT.read_text(encoding="utf-8"))
    source_map = str(source_receipt.get("target_map", ""))
    source_status = str(source_receipt.get("status", ""))
    if "SAVED_AND_REOPENED" not in source_status and "SAVED_REOPENED" not in source_status:
        raise RuntimeError("Source receipt does not prove a saved-and-reopened map")
    expected_source_sha = str(
        source_receipt.get("target_saved_sha256") or source_receipt.get("target_sha256") or ""
    ).strip().upper()
    expected_hash_source = (
        "receipt.target_saved_sha256"
        if source_receipt.get("target_saved_sha256")
        else "receipt.target_sha256"
    )
    if normalized(SOURCE_RECEIPT) == normalized(DEFAULT_SOURCE_RECEIPT):
        if source_receipt_sha != DEFAULT_SOURCE_RECEIPT_SHA256:
            raise RuntimeError("Default v018 source receipt changed")
        if source_map != DEFAULT_SOURCE_MAP:
            raise RuntimeError("Default v018 source receipt map changed")
        expected_source_sha = DEFAULT_SOURCE_MAP_SHA256
        expected_hash_source = "exact compatibility guard for default v018 receipt"
    elif not expected_source_sha:
        raise RuntimeError("Override source receipt must include target_saved_sha256 or target_sha256")
    source_package = package_file(source_map, ".umap")
    if not source_package.is_file() or sha256(source_package) != expected_source_sha:
        raise RuntimeError("Actual source map package hash differs from its receipt/compatibility guard")
    source_hash_before = sha256(source_package)

    if not (
        TARGET_MAP.startswith("/Game/_CodexReview/ForestApproach/")
        or TARGET_MAP == "/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v019"
    ):
        raise RuntimeError("Target must be the reserved private forest review map or exact v019 candidate")
    if TARGET_MAP == source_map or E.does_asset_exist(TARGET_MAP) or package_file(TARGET_MAP, ".umap").exists():
        raise RuntimeError("Refusing existing/equal target map " + TARGET_MAP)
    for path in (STAIR_ASSET, RAIL_ASSET):
        if E.does_asset_exist(path) or package_file(path, ".uasset").exists():
            raise RuntimeError("Refusing existing private candidate asset " + path)
    if not E.does_asset_exist(source_map):
        raise RuntimeError("Source map asset is missing")

    if U.EditorLoadingAndSavingUtils.load_map(source_map) is None:
        raise RuntimeError("Could not load guarded source map")
    source_labels = actor_map()
    expected_actor_count = source_receipt.get("target_actor_count")
    if expected_actor_count is not None and len(source_labels) != int(expected_actor_count):
        raise RuntimeError("Source actor count differs from saved receipt")
    for label in NEW_LABELS:
        if label in source_labels:
            raise RuntimeError("Source already contains reserved private actor label " + label)
    for required_label in (
        "NH_CentralOak_ExactCenter",
        "NH_ClearingCenter_MeasureMarker",
        "CL_Terrain_Forest",
        "CL_Terrain_Hollow",
        "CL_Forest_CollisionProxies_TrunksShrubs",
    ):
        if required_label not in source_labels:
            raise RuntimeError("Source lacks fixed environment actor " + required_label)
    hero_location = source_labels["NH_CentralOak_ExactCenter"].get_actor_location()
    if math.sqrt(
        (float(hero_location.x) - fixed["hero_root_cm"][0]) ** 2
        + (float(hero_location.y) - fixed["hero_root_cm"][1]) ** 2
        + (float(hero_location.z) - fixed["hero_root_cm"][2]) ** 2
    ) > 0.02:
        raise RuntimeError("Saved hero oak root differs from the sealed fixed transform")
    material = exact_actor_material(source_labels)
    material_package = asset_package_file(material)
    material_hash_before = sha256(material_package)
    original_labels = sorted(source_labels)
    source_signatures, source_scene_signature = world_signature(source_labels, original_labels)

    receipt["preflight"] = {
        "completed_before_any_map_or_asset_mutation": True,
        "source_map": source_map,
        "source_receipt_sha256": source_receipt_sha,
        "source_map_sha256_before": source_hash_before,
        "source_expected_hash_source": expected_hash_source,
        "source_actor_count": len(source_labels),
        "source_scene_signature_sha256": source_scene_signature,
        "verified_existing_tunnel_actor": TUNNEL_ACTOR_LABEL,
        "verified_existing_tunnel_material": object_path(material),
        "verified_existing_tunnel_material_package_sha256": material_hash_before,
        "fixed_hero_oak_world_location_cm": vec(hero_location),
        "fixed_actor_labels_verified": [
            "NH_CentralOak_ExactCenter",
            "NH_ClearingCenter_MeasureMarker",
            "CL_Terrain_Forest",
            "CL_Terrain_Hollow",
            "CL_Forest_CollisionProxies_TrunksShrubs",
        ],
        "StaticMeshEditorSubsystem": "AVAILABLE",
        "AssetEditorSubsystem": "AVAILABLE",
        "SubobjectDataSubsystem": "AVAILABLE",
    }

    if not U.EditorLoadingAndSavingUtils.save_map(WW.get_editor_world(), TARGET_MAP):
        raise RuntimeError("Could not clone source into fresh private candidate map")
    receipt["map_or_package_saved"] = True
    if U.EditorLoadingAndSavingUtils.load_map(TARGET_MAP) is None:
        raise RuntimeError("Could not reopen fresh private candidate map")

    stair_mesh = save_new_collision_mesh(geometry["stair"]["mesh"], STAIR_ASSET, material)
    receipt["created_assets"].append(STAIR_ASSET)
    rail_mesh = save_new_collision_mesh(geometry["rails"]["mesh"], RAIL_ASSET, material)
    receipt["created_assets"].append(RAIL_ASSET)
    stair_actor = spawn_blocking_mesh(STAIR_ACTOR_LABEL, stair_mesh, material)
    rail_actor = spawn_blocking_mesh(RAIL_ACTOR_LABEL, rail_mesh, material)
    route_actor, route_spline = spawn_route_actor(
        geometry["measurement_route"]["polyline_points_world_cm"]
    )
    receipt["created_actors"] = [STAIR_ACTOR_LABEL, RAIL_ACTOR_LABEL, ROUTE_ACTOR_LABEL]

    actual_spline_length = float(route_spline.get_spline_length())
    if abs(actual_spline_length - 3048.0) > 0.25:
        raise RuntimeError("Actual created measurement spline is not 100 feet")
    for actor in (stair_actor, rail_actor):
        component = actor.static_mesh_component
        if not actor.get_actor_enable_collision():
            raise RuntimeError(actor_label(actor) + " actor collision is disabled")
        if component.get_collision_enabled() != U.CollisionEnabled.QUERY_AND_PHYSICS:
            raise RuntimeError(actor_label(actor) + " is not QueryAndPhysics")
        if str(component.get_collision_profile_name()) != "BlockAll":
            raise RuntimeError(actor_label(actor) + " is not BlockAll")

    if not U.EditorLoadingAndSavingUtils.save_map(WW.get_editor_world(), TARGET_MAP):
        raise RuntimeError("Could not save built private candidate map")
    if U.EditorLoadingAndSavingUtils.load_map(TARGET_MAP) is None:
        raise RuntimeError("Could not reopen built private candidate map")
    reopened = actor_map()
    if len(reopened) != len(source_labels) + 3:
        raise RuntimeError("Reopened candidate actor count is not source + 3")
    for label in NEW_LABELS:
        if label not in reopened:
            raise RuntimeError("Reopened candidate lost " + label)
    reopened_existing = {label: reopened[label] for label in original_labels}
    reopened_signatures, reopened_scene_signature = world_signature(reopened_existing, original_labels)
    if reopened_signatures != source_signatures or reopened_scene_signature != source_scene_signature:
        raise RuntimeError("A pre-existing actor/component/HISM signature changed in the private candidate")

    reopened_route_components = reopened[ROUTE_ACTOR_LABEL].get_components_by_class(U.SplineComponent)
    if len(reopened_route_components) != 1:
        raise RuntimeError("Reopened route actor does not contain exactly one SplineComponent")
    reopened_spline_length = float(reopened_route_components[0].get_spline_length())
    if abs(reopened_spline_length - 3048.0) > 0.25:
        raise RuntimeError("Reopened measurement spline length changed")
    for label, asset_path, triangle_count in (
        (STAIR_ACTOR_LABEL, STAIR_ASSET, geometry["stair"]["mesh"]["triangle_count"]),
        (RAIL_ACTOR_LABEL, RAIL_ASSET, geometry["rails"]["mesh"]["triangle_count"]),
    ):
        actor = reopened[label]
        component = actor.static_mesh_component
        if object_path(component.static_mesh).split(".", 1)[0] != asset_path:
            raise RuntimeError(label + " reopened with the wrong mesh")
        if int(component.static_mesh.get_num_triangles(0)) != int(triangle_count):
            raise RuntimeError(label + " reopened with the wrong triangle count")
        if component.get_collision_enabled() != U.CollisionEnabled.QUERY_AND_PHYSICS:
            raise RuntimeError(label + " lost collision after reopen")
        if str(component.get_collision_profile_name()) != "BlockAll":
            raise RuntimeError(label + " lost BlockAll profile after reopen")

    source_hash_after = sha256(source_package)
    material_hash_after = sha256(material_package)
    if source_hash_after != source_hash_before:
        raise RuntimeError("Source map package changed")
    if material_hash_after != material_hash_before:
        raise RuntimeError("Existing tunnel material package changed")
    target_package = package_file(TARGET_MAP, ".umap")
    if not target_package.is_file():
        raise RuntimeError("Saved private target package is missing")
    target_saved_sha256 = sha256(target_package)
    created_asset_hashes = {
        path: sha256(package_file(path, ".uasset")) for path in (STAIR_ASSET, RAIL_ASSET)
    }
    receipt.update(
        {
            "status": "SAVED_AND_REOPENED_PRIVATE_CANDIDATE_PENDING_PIXEL_PIE_AND_POSSESSED_PROOF_AND_LEE_APPROVAL",
            "source_map": source_map,
            "source_map_sha256_before": source_hash_before,
            "source_map_sha256_after": source_hash_after,
            "source_map_unchanged": True,
            "target_saved_sha256": target_saved_sha256,
            "target_actor_count": len(reopened),
            "existing_actor_component_hism_signature_before": source_scene_signature,
            "existing_actor_component_hism_signature_after": reopened_scene_signature,
            "all_preexisting_actor_component_hism_signatures_unchanged": True,
            "existing_tunnel_material_package_sha256_before": material_hash_before,
            "existing_tunnel_material_package_sha256_after": material_hash_after,
            "existing_tunnel_material_unchanged": True,
            "created_asset_sha256": created_asset_hashes,
            "measurement_spline_length_cm_before_save": actual_spline_length,
            "measurement_spline_length_cm_after_reopen": reopened_spline_length,
            "fixed_geometry_preservation": {
                "portal_xy_cm": geometry["fixed_invariants"]["portal_xy_cm"],
                "clearing_west_edge_xy_cm": geometry["fixed_invariants"]["clearing_west_edge_xy_cm"],
                "hero_root_cm": geometry["fixed_invariants"]["hero_root_cm"],
                "clearing_radius_cm": geometry["fixed_invariants"]["clearing_radius_cm"],
                "preservation_method": "strict signatures for every pre-existing actor/component and every HISM transform",
            },
            "collision_configuration": {
                STAIR_ACTOR_LABEL: "visible mesh; complex-as-simple BodySetup; BlockAll; QueryAndPhysics",
                RAIL_ACTOR_LABEL: "visible mesh; complex-as-simple BodySetup; BlockAll; QueryAndPhysics",
                "hidden_ramp_or_invisible_blocker_created": False,
            },
            "required_next_checks": [
                "actual matched-camera pixel proof of portal, full stair/retaining profile, landing, rails, and forest context",
                "v5 actual PIE first-hit floor on all 30 treads and post-stair terrain lanes",
                "v5 actual PIE WorldStatic body and Camera sphere sweeps",
                "possessed-player traversal both directions and physical-control evidence",
                "Lee approval of the additional outdoor stair/route art",
            ],
        }
    )
except Exception:
    receipt["status"] = "FAILED_PRIVATE_BUILD_PARTIAL_PACKAGES_PRESERVED_DO_NOT_RETRY_BLINDLY"
    receipt["error"] = traceback.format_exc()
finally:
    receipt["completed_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    RECEIPT_PATH.parent.mkdir(parents=True, exist_ok=True)
    RECEIPT_PATH.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print("NH_FOREST_APPROACH_PRIVATE_V019", receipt["status"], str(RECEIPT_PATH))
