"""Build and optionally render an isolated 20-second native UE outdoor proof.

Prepared offline for the sole Unreal writer. This file does nothing until that
writer executes it inside the intended UE 5.8 project.

Environment variables:
  NH_OUTDOOR_PROOF_ACTION       inspect (default), build, or render
  NH_OUTDOOR_PROOF_TARGET       saved /Game map; defaults to v011
  NH_OUTDOOR_PROOF_PLAN         exact JSON plan path
  NH_OUTDOOR_PROOF_EV100        fixed outdoor EV100; defaults to 15.0
  NH_OUTDOOR_PROOF_RESUME_RUN   resume this script's own prior build/run
  NH_OUTDOOR_PROOF_QUIT         1 to quit after render or failure

The source map and closed gate leaves are never saved or animated. Build/render
creates a unique review-map clone and Level Sequence under /Game/_CodexReview.
MRQ uses a private transient queue, so the editor's saved queue is not changed.
"""
import builtins
import datetime
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import traceback
import uuid

import unreal as U


PROJECT = Path('E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009')
DEFAULT_PLAN = Path('E:/_codex_tasks/nh_outdoor_proof_plan_v011_20261010.json')
PLAN_PATH = Path(os.environ.get('NH_OUTDOOR_PROOF_PLAN', str(DEFAULT_PLAN)))
SOURCE = os.environ.get(
    'NH_OUTDOOR_PROOF_TARGET',
    '/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v011')
ACTION = os.environ.get('NH_OUTDOOR_PROOF_ACTION', 'inspect').strip().lower()
EV100 = float(os.environ.get('NH_OUTDOOR_PROOF_EV100', '15.0'))
RESUME = os.environ.get('NH_OUTDOOR_PROOF_RESUME_RUN', '').strip()
RUN = RESUME or (
    'Run_' + datetime.datetime.now().strftime('%Y%m%d_%H%M%S') + '_'
    + uuid.uuid4().hex[:8])
DEST = '/Game/_CodexReview/OutdoorProof/' + RUN
REVIEW_MAP = DEST + '/L_OutdoorProof_v011'
SEQUENCE = DEST + '/LS_OutdoorProof_20s'
OUT = (Path('H:/NyghtshadeHollow_Development/2026-10-10/OutdoorProof')
       / RUN)
RENDER_DIR = OUT / 'Render'

SAVE = U.EditorLoadingAndSavingUtils
ELL = U.EditorAssetLibrary
WORLD = U.get_editor_subsystem(U.UnrealEditorSubsystem)
ACTORS = U.get_editor_subsystem(U.EditorActorSubsystem)
MRQ = U.get_editor_subsystem(U.MoviePipelineQueueSubsystem)
ASSETS = U.AssetToolsHelpers.get_asset_tools()

REPORT = {
    'status': 'STARTED',
    'action': ACTION,
    'run': RUN,
    'source_map': SOURCE,
    'review_map': REVIEW_MAP,
    'sequence': SEQUENCE,
    'plan_path': str(PLAN_PATH),
    'output_directory': str(RENDER_DIR),
    'fixed_ev100': EV100,
    'runtime_tested': False,
    'visual_review_passed': False,
    'gate_operations': [],
    'source_map_saved': False,
    'warnings': [
        'The camera coordinates come from saved static design data.',
        'A successful build or render receipt is not visual approval.',
        'The road camera stops before the closed gateway and does not prove '
        'vehicle or character traversal.',
    ],
}


def check(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest().upper()


def write_json(name, value):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(
        json.dumps(value, indent=2, sort_keys=False), encoding='utf-8')


def package(obj):
    return obj.get_package().get_name()


def vec(values):
    return U.Vector(*[float(value) for value in values])


def settings(obj, values):
    for key, value in values.items():
        obj.set_editor_property(key, value)


def transform_receipt(actor):
    location = actor.get_actor_location()
    rotation = actor.get_actor_rotation()
    scale = actor.get_actor_scale3d()
    return [
        float(location.x), float(location.y), float(location.z),
        float(rotation.roll), float(rotation.pitch), float(rotation.yaw),
        float(scale.x), float(scale.y), float(scale.z),
    ]


def max_transform_delta(left, right):
    return max(abs(float(a) - float(b)) for a, b in zip(left, right))


def source_file_for(long_package):
    return (PROJECT / 'Content'
            / Path(long_package[len('/Game/'):].replace('/', os.sep) + '.umap'))


def assert_review_world():
    check(package(WORLD.get_editor_world()) == REVIEW_MAP,
          'Current editor world is not the isolated review map')


def unique_actor_by_label(label):
    matches = [actor for actor in ACTORS.get_all_level_actors()
               if actor.get_actor_label() == label]
    check(len(matches) == 1,
          'Expected exactly one actor labelled %s, found %d'
          % (label, len(matches)))
    return matches[0]


def interpolation(name):
    allowed = {
        'AUTO': U.MovieSceneKeyInterpolation.AUTO,
        'LINEAR': U.MovieSceneKeyInterpolation.LINEAR,
        'CONSTANT': U.MovieSceneKeyInterpolation.CONSTANT,
    }
    check(name in allowed, 'Unsupported interpolation ' + str(name))
    return allowed[name]


def validate_plan(document):
    check(document.get('source_map') == SOURCE,
          'Plan target and requested source map differ')
    check(int(document.get('fps', 0)) == 24, 'Plan must be 24 fps')
    check(int(document.get('total_frames', 0)) == 480,
          'Plan must contain exactly 480 output frames')
    check(abs(float(document.get('duration_seconds', 0.0)) - 20.0) < 1e-6,
          'Plan must be exactly 20 seconds')
    check(document.get('resolution') == [1280, 720],
          'Plan resolution must be 1280x720')
    check(document.get('filmback_mm') == [36.0, 20.25],
          'Plan filmback must be 36 x 20.25 mm')

    source_plan = Path(document['source_plan']['path'])
    check(source_plan.is_file(), 'Missing source camera-plan evidence')
    actual_source_plan_hash = digest(source_plan)
    check(actual_source_plan_hash == document['source_plan']['sha256'].upper(),
          'Source camera-plan evidence hash changed')

    segments = document.get('segments', [])
    check(len(segments) == 5, 'Expected five native camera-cut segments')
    cursor = 0
    segment_ids = []
    for segment in segments:
        segment_id = segment['id']
        check(segment_id not in segment_ids,
              'Duplicate segment id ' + segment_id)
        segment_ids.append(segment_id)
        start = int(segment['start_frame_inclusive'])
        end = int(segment['end_frame_exclusive'])
        check(start == cursor and end > start,
              'Segments must be contiguous and positive')
        cursor = end
        keys = segment.get('keys', [])
        check(len(keys) >= 2, segment_id + ' needs at least two endpoint keys')
        frames = [int(key['frame']) for key in keys]
        check(frames == sorted(frames), segment_id + ' keys are not ordered')
        check(frames[0] == start and frames[-1] == end,
              segment_id + ' must have keys on both section boundaries')
        for key in keys:
            numbers = (key['camera_cm'] + key['target_cm']
                       + [key['focal_length_mm'], key['horizontal_fov_deg']])
            check(all(math.isfinite(float(number)) for number in numbers),
                  segment_id + ' has a non-finite camera value')
            focal = float(key['focal_length_mm'])
            predicted_fov = math.degrees(2.0 * math.atan(36.0 / (2.0 * focal)))
            check(abs(predicted_fov - float(key['horizontal_fov_deg'])) < 0.02,
                  segment_id + ' focal length and horizontal FOV disagree')
        interpolation(segment['interpolation'])
    check(cursor == 480, 'Segments do not fill the 480-frame playback range')

    clips = document.get('editorial_clips', [])
    check([clip['name'] for clip in clips] == [
        'Road_Gateway_Markings',
        'Main_Bridge_Both_Approaches',
        'Central_Oak_Full_Silhouette',
    ], 'Editorial clips must remain road, bridge, and oak in that order')
    check([int(clip['start_frame_inclusive']) for clip in clips] == [0, 168, 336],
          'Editorial clip start frames changed')
    check([int(clip['end_frame_exclusive']) for clip in clips] == [168, 336, 480],
          'Editorial clip end frames changed')

    gate = document['gate_policy']
    check(gate['sequence_may_bind_or_animate_gate_leaves'] is False,
          'This proof may not bind or animate the gate leaves')
    road = next(segment for segment in segments if segment['id'] == 'road_gateway')
    gate_x = float(gate['gate_plane_x_cm'])
    margin = float(gate['minimum_camera_stop_margin_cm'])
    check(all(float(key['camera_cm'][0]) <= gate_x - margin
              for key in road['keys']),
          'A road camera key crosses the closed-gate stop margin')
    check(abs(float(road['keys'][-1]['camera_cm'][0])
              - (gate_x - margin)) < 1e-6,
          'Road endpoint no longer stops exactly 500 cm before the gate')
    return document


def exposure(component):
    pp = component.get_editor_property('post_process_settings')
    settings(pp, {
        'override_auto_exposure_method': True,
        'auto_exposure_method': U.AutoExposureMethod.AEM_HISTOGRAM,
        'override_auto_exposure_min_brightness': True,
        'auto_exposure_min_brightness': EV100,
        'override_auto_exposure_max_brightness': True,
        'auto_exposure_max_brightness': EV100,
        'override_auto_exposure_bias': True,
        'auto_exposure_bias': 0.0,
        'override_auto_exposure_bias_curve': True,
        'auto_exposure_bias_curve': None,
        'override_auto_exposure_apply_physical_camera_exposure': True,
        'auto_exposure_apply_physical_camera_exposure': False,
        'override_local_exposure_highlight_contrast_scale': True,
        'local_exposure_highlight_contrast_scale': 1.0,
        'override_local_exposure_shadow_contrast_scale': True,
        'local_exposure_shadow_contrast_scale': 1.0,
        'override_local_exposure_detail_strength': True,
        'local_exposure_detail_strength': 1.0,
        'override_local_exposure_middle_grey_bias': True,
        'local_exposure_middle_grey_bias': 0.0,
        'override_motion_blur_amount': True,
        'motion_blur_amount': 0.0,
    })
    component.set_editor_property('post_process_settings', pp)
    component.set_editor_property('post_process_blend_weight', 1.0)
    readback = component.get_editor_property('post_process_settings')
    check(abs(float(readback.get_editor_property(
        'auto_exposure_min_brightness')) - EV100) < 1e-5,
        'Fixed exposure minimum did not read back')
    check(abs(float(readback.get_editor_property(
        'auto_exposure_max_brightness')) - EV100) < 1e-5,
        'Fixed exposure maximum did not read back')


def preflight():
    check(ACTION in ('inspect', 'build', 'render'),
          'Action must be inspect, build, or render')
    check(math.isfinite(EV100) and 8.0 <= EV100 <= 20.0,
          'Outdoor EV100 is outside the bounded 8-20 range')
    check(Path(U.Paths.project_dir()).resolve() == PROJECT.resolve(),
          'Wrong Unreal project; no project changes made')
    check(SOURCE.startswith('/Game/') and '.' not in SOURCE and '..' not in SOURCE,
          'Target must be a /Game long package name')
    source_file = source_file_for(SOURCE)
    check(source_file.is_file() and ELL.does_asset_exist(SOURCE),
          'The v011 target map is not saved on disk')
    check(PLAN_PATH.is_file(), 'Missing exact camera-plan JSON')
    check(not MRQ.is_rendering() and MRQ.get_active_executor() is None,
          'Another Movie Render Queue executor is active')
    check(WORLD.get_game_world() is None, 'Stop PIE before running this script')
    dirty = (list(SAVE.get_dirty_map_packages())
             + list(SAVE.get_dirty_content_packages()))
    check(not dirty,
          'Unsaved packages exist; resolve them before the isolated proof: '
          + ', '.join(item.get_name() for item in dirty[:20]))
    check(U.SystemLibrary.get_console_variable_int_value(
        'r.DefaultFeature.AutoExposure.ExtendDefaultLuminanceRange') == 1,
        'Extended luminance range must be enabled for EV100')
    check(hasattr(U, 'MoviePipelineMP4EncoderOutput'),
          'The installed native MP4 encoder class is unavailable')
    check(hasattr(U, 'MoviePipelineLibrary'),
          'Installed Python ScriptName MoviePipelineLibrary is unavailable')

    document = validate_plan(json.loads(PLAN_PATH.read_text(encoding='utf-8')))
    REPORT.update({
        'source_file': str(source_file),
        'source_sha256_before': digest(source_file),
        'plan_sha256': digest(PLAN_PATH),
        'source_plan_sha256': document['source_plan']['sha256'].upper(),
        'editor_queue_jobs_before': [
            job.get_path_name() for job in MRQ.get_queue().get_jobs()],
        'expected_frames': 480,
        'expected_mp4_files': 1,
        'expected_camera_cut_shots': 5,
        'gate_leaf_labels': document['gate_policy'][
            'stone_gateway_actor_labels'],
    })
    return source_file, document


def configure_cine_camera(component, document, initial_focal):
    filmback = component.get_editor_property('filmback')
    filmback.set_editor_property('sensor_width', float(document['filmback_mm'][0]))
    filmback.set_editor_property('sensor_height', float(document['filmback_mm'][1]))
    component.set_editor_property('filmback', filmback)
    component.set_editor_property('current_focal_length', float(initial_focal))
    component.set_editor_property('current_aperture', float(document['aperture']))
    focus = component.get_editor_property('focus_settings')
    focus.set_editor_property('focus_method', U.CameraFocusMethod.DISABLE)
    component.set_editor_property('focus_settings', focus)
    exposure(component)


def add_segment_camera(sequence, cuts, segment, document, ordinal):
    first = segment['keys'][0]
    start = int(segment['start_frame_inclusive'])
    end = int(segment['end_frame_exclusive'])
    location = vec(first['camera_cm'])
    rotation = U.MathLibrary.find_look_at_rotation(
        location, vec(first['target_cm']))
    camera = ACTORS.spawn_actor_from_class(U.CineCameraActor, location, rotation)
    check(camera is not None and package(camera) == REVIEW_MAP,
          'Camera did not spawn into the isolated review map')
    label = 'NH_OUTDOOR_PROOF_%02d_%s' % (ordinal, segment['id'])
    camera.set_actor_label(label)
    camera.set_folder_path('Codex/OutdoorProof/' + RUN)
    component = camera.get_cine_camera_component()
    check(component is not None, 'Cine camera component is missing')
    configure_cine_camera(component, document, first['focal_length_mm'])

    binding = sequence.add_possessable(camera)
    transform_track = binding.add_track(U.MovieScene3DTransformTrack)
    transform_section = transform_track.add_section()
    # The key at the exclusive cut end controls the final interpolation sample.
    transform_section.set_range(start, end + 1)
    transform_channels = list(transform_section.get_all_channels())
    check(len(transform_channels) == 9,
          'Unexpected CineCameraActor transform-channel count')

    component_binding = sequence.add_possessable(component)
    component_binding.set_parent(binding)
    focal_track = component_binding.add_track(U.MovieSceneFloatTrack)
    focal_track.set_property_name_and_path(
        'CurrentFocalLength', 'CurrentFocalLength')
    focal_section = focal_track.add_section()
    focal_section.set_range(start, end + 1)
    focal_channels = list(focal_section.get_all_channels())
    check(len(focal_channels) == 1,
          'Unexpected cine-camera focal-length channel count')

    time_unit = U.MovieSceneTimeUnit.DISPLAY_RATE
    key_interpolation = interpolation(segment['interpolation'])
    keyed = []
    for key in segment['keys']:
        frame = int(key['frame'])
        key_location = vec(key['camera_cm'])
        key_rotation = U.MathLibrary.find_look_at_rotation(
            key_location, vec(key['target_cm']))
        values = (
            float(key_location.x), float(key_location.y), float(key_location.z),
            float(key_rotation.roll), float(key_rotation.pitch),
            float(key_rotation.yaw), 1.0, 1.0, 1.0,
        )
        for channel, value in zip(transform_channels, values):
            channel.add_key(U.FrameNumber(frame), value, 0.0,
                            time_unit, key_interpolation)
        focal_channels[0].add_key(
            U.FrameNumber(frame), float(key['focal_length_mm']), 0.0,
            time_unit, key_interpolation)
        keyed.append({
            'frame': frame,
            'camera_cm': [float(v) for v in key['camera_cm']],
            'target_cm': [float(v) for v in key['target_cm']],
            'rotation_pitch_yaw_roll_deg': [
                float(key_rotation.pitch), float(key_rotation.yaw),
                float(key_rotation.roll)],
            'focal_length_mm': float(key['focal_length_mm']),
        })

    cut = cuts.add_section()
    cut.set_range(start, end)
    cut.set_camera_binding_id(
        U.MovieSceneSequenceExtensions.get_binding_id(sequence, binding))
    return {
        'segment': segment['id'],
        'editorial_clip': segment['editorial_clip'],
        'actor_label': label,
        'actor_path': camera.get_path_name(),
        'binding_display_name': str(binding.get_display_name()),
        'cut_start_inclusive': start,
        'cut_end_exclusive': end,
        'interpolation': segment['interpolation'],
        'keys': keyed,
    }


def build_assets(document):
    check(not ELL.does_asset_exist(REVIEW_MAP)
          and not ELL.does_asset_exist(SEQUENCE),
          'Unique review destination already exists')
    check(SAVE.load_map(SOURCE) is not None, 'Cannot load v011 source map')
    check(package(WORLD.get_editor_world()) == SOURCE,
          'Loaded source-world identity mismatch')
    ELL.make_directory(DEST)
    check(SAVE.save_map(WORLD.get_editor_world(), REVIEW_MAP),
          'Cannot Save As the isolated review map')
    check(SAVE.load_map(REVIEW_MAP) is not None,
          'Cannot reload the isolated review map before edits')
    assert_review_world()
    REPORT['source_clone_reloaded_before_edits'] = True

    gate_before = {}
    for label in document['gate_policy']['stone_gateway_actor_labels']:
        actor = unique_actor_by_label(label)
        check(package(actor) == REVIEW_MAP,
              label + ' is not owned by the isolated review map')
        gate_before[label] = transform_receipt(actor)
    REPORT['closed_gate_transforms_before'] = gate_before

    sequence = ASSETS.create_asset(
        'LS_OutdoorProof_20s', DEST, U.LevelSequence,
        U.LevelSequenceFactoryNew())
    check(sequence is not None and package(sequence) == SEQUENCE,
          'Level Sequence creation failed')
    sequence.set_display_rate(U.FrameRate(24, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(480)
    cuts = sequence.add_track(U.MovieSceneCameraCutTrack)
    camera_receipts = []
    for ordinal, segment in enumerate(document['segments'], 1):
        assert_review_world()
        camera_receipts.append(add_segment_camera(
            sequence, cuts, segment, document, ordinal))

    check(ELL.save_asset(SEQUENCE, only_if_is_dirty=False),
          'Level Sequence save failed')
    assert_review_world()
    check(SAVE.save_map(WORLD.get_editor_world(), REVIEW_MAP),
          'Isolated review-map save failed')
    REPORT['camera_segments'] = camera_receipts
    REPORT['gate_bindings_created'] = []
    REPORT['gate_operations'] = []

    # Reopen the candidate before handing it to MRQ, then prove the closed gate
    # transforms survived and this script created exactly five proof cameras.
    check(SAVE.load_map(REVIEW_MAP) is not None,
          'Cannot reopen the saved isolated review map')
    assert_review_world()
    gate_after = {}
    gate_delta = {}
    for label, expected in gate_before.items():
        actor = unique_actor_by_label(label)
        actual = transform_receipt(actor)
        gate_after[label] = actual
        gate_delta[label] = max_transform_delta(expected, actual)
        check(gate_delta[label] < 0.01,
              label + ' moved while building the proof')
    proof_labels = sorted(
        actor.get_actor_label() for actor in ACTORS.get_all_level_actors()
        if actor.get_actor_label().startswith('NH_OUTDOOR_PROOF_'))
    check(len(proof_labels) == 5 and len(set(proof_labels)) == 5,
          'Saved review map does not contain exactly five unique proof cameras')
    sequence = ELL.load_asset(SEQUENCE)
    check(sequence is not None, 'Cannot reopen the saved Level Sequence')
    REPORT.update({
        'closed_gate_transforms_after_reopen': gate_after,
        'closed_gate_max_abs_delta_after_reopen': gate_delta,
        'proof_camera_labels_after_reopen': proof_labels,
        'review_assets_reopened': True,
    })
    return sequence


def make_queue(sequence, document):
    queue = U.new_object(U.MoviePipelineQueue)
    job = queue.allocate_new_job(U.MoviePipelineExecutorJob)
    job.set_editor_property('job_name', 'Nyghtshade_OutdoorProof_' + RUN)
    # UE 5.8 exposes these as FSoftObjectPath properties. The ScriptName for
    # UMoviePipelineBlueprintLibrary is MoviePipelineLibrary in Python.
    job.set_editor_property('map', U.SoftObjectPath(REVIEW_MAP))
    job.set_editor_property('sequence', U.SoftObjectPath(SEQUENCE))
    U.MoviePipelineLibrary.update_job_shot_list_from_sequence(sequence, job)
    shots = list(job.get_editor_property('shot_info'))
    check(len(shots) == 5,
          'MRQ did not discover exactly five native camera-cut shots')

    configuration = job.get_configuration()
    output = configuration.find_or_add_setting_by_class(
        U.MoviePipelineOutputSetting)
    settings(output, {
        'output_resolution': U.IntPoint(1280, 720),
        'output_directory': U.DirectoryPath(str(RENDER_DIR)),
        'file_name_format': 'Nyghtshade_OutdoorProof_{frame_number}',
        'zero_pad_frame_numbers': 4,
        'frame_number_offset': 0,
        'output_frame_step': 1,
        'handle_frame_count': 0,
        'use_custom_playback_range': False,
        'use_custom_frame_rate': True,
        'output_frame_rate': U.FrameRate(24, 1),
        'override_existing_output': False,
        # This must remain false so the MP4 writer spans all five camera cuts.
        'flush_disk_writes_per_shot': False,
    })
    configuration.find_or_add_setting_by_class(U.MoviePipelineDeferredPassBase)
    configuration.find_or_add_setting_by_class(
        U.MoviePipelineImageSequenceOutput_JPG)
    mp4 = configuration.find_or_add_setting_by_class(
        U.MoviePipelineMP4EncoderOutput)
    settings(mp4, {
        'constant_rate_factor': 18,
        'include_audio': False,
    })
    anti_aliasing = configuration.find_or_add_setting_by_class(
        U.MoviePipelineAntiAliasingSetting)
    settings(anti_aliasing, {
        'engine_warm_up_count': 48,
        'use_camera_cut_for_warm_up': False,
        'render_warm_up_frames': True,
        'render_warm_up_count': 1,
        'temporal_sample_count': 1,
        'spatial_sample_count': 1,
    })
    game = configuration.find_or_add_setting_by_class(
        U.MoviePipelineGameOverrideSetting)
    # Installed Python nativizes this TSoftClassPtr from the class object.
    settings(game, {
        'soft_game_mode_override': U.GameModeBase,
        'cinematic_quality_settings': False,
        'use_lod_zero': False,
        'disable_hlods': False,
        'use_high_quality_shadows': False,
        'override_view_distance_scale': False,
        'flush_grass_streaming': False,
        'override_grass_cull_distance_scale': False,
        'override_grass_density_scale': False,
        'override_virtual_texture_feedback_factor': False,
        'texture_streaming': U.MoviePipelineTextureStreamingMethod.FULLY_LOAD,
    })
    console = configuration.find_or_add_setting_by_class(
        U.MoviePipelineConsoleVariableSetting)
    console.add_or_update_console_variable('r.MotionBlurQuality', 0.0)

    REPORT['mrq'] = {
        'private_transient_queue': True,
        'camera_cut_shots': len(shots),
        'sequence_frames_start_inclusive': 0,
        'sequence_frames_end_exclusive': 480,
        'fps': 24,
        'resolution': [1280, 720],
        'jpeg_sequence': True,
        'native_mp4': True,
        'mp4_constant_rate_factor': 18,
        'mp4_audio': False,
        'single_mp4_across_camera_cuts': True,
        'flush_disk_writes_per_shot': False,
        'engine_warm_up_count': 48,
        'render_warm_up_frames': True,
        'render_warm_up_count': 1,
        'use_camera_cut_for_warm_up': False,
        'temporal_samples': 1,
        'spatial_samples': 1,
        'fixed_ev100': EV100,
        'game_mode': '/Script/Engine.GameModeBase',
    }
    return queue


def jpeg_dimensions(path):
    data = Path(path).read_bytes()
    if len(data) < 4 or data[:2] != b'\xff\xd8':
        return None
    offset = 2
    sof = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
           0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while offset + 4 <= len(data):
        while offset < len(data) and data[offset] != 0xFF:
            offset += 1
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            break
        marker = data[offset]
        offset += 1
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        if offset + 2 > len(data):
            break
        length = struct.unpack('>H', data[offset:offset + 2])[0]
        if length < 2 or offset + length > len(data):
            break
        if marker in sof and length >= 7:
            height, width = struct.unpack('>HH', data[offset + 3:offset + 7])
            return [int(width), int(height)]
        offset += length
    return None


def file_receipt(path, kind):
    path = Path(path)
    result = {
        'path': str(path),
        'exists': path.is_file(),
        'kind': kind,
    }
    if not path.is_file():
        return result
    result.update({'bytes': path.stat().st_size, 'sha256': digest(path)})
    if kind == 'jpeg':
        result['resolution'] = jpeg_dimensions(path)
        result['valid_header'] = result['resolution'] is not None
    elif kind == 'mp4':
        with path.open('rb') as stream:
            header = stream.read(16)
        result['valid_header'] = len(header) >= 12 and header[4:8] == b'ftyp'
    return result


def verify_source(source_file):
    after = digest(source_file)
    REPORT['source_sha256_after'] = after
    REPORT['source_map_unchanged'] = (
        after == REPORT['source_sha256_before'])
    check(REPORT['source_map_unchanged'],
          'Source v011 package changed; stop and preserve evidence')


def expected_output_index(document):
    return {
        'status': 'EXPECTED_OUTPUT_NOT_RENDERED',
        'source_map': SOURCE,
        'review_map': REVIEW_MAP,
        'sequence': SEQUENCE,
        'plan_path': str(PLAN_PATH),
        'plan_sha256': REPORT.get('plan_sha256'),
        'fps': 24,
        'total_frames': 480,
        'duration_seconds': 20.0,
        'resolution': [1280, 720],
        'editorial_clips': document['editorial_clips'],
        'camera_cut_segments': [
            {
                'id': segment['id'],
                'editorial_clip': segment['editorial_clip'],
                'start_frame_inclusive': segment['start_frame_inclusive'],
                'end_frame_exclusive': segment['end_frame_exclusive'],
                'interpolation': segment['interpolation'],
            }
            for segment in document['segments']
        ],
        'gate_policy': document['gate_policy'],
        'runtime_tested': False,
        'visual_review_passed': False,
    }


def render(queue, source_file, index):
    def finished(executor, success):
        try:
            jpegs = sorted(list(RENDER_DIR.rglob('*.jpg'))
                           + list(RENDER_DIR.rglob('*.jpeg')))
            videos = sorted(RENDER_DIR.rglob('*.mp4'))
            if jpegs:
                sample_indices = sorted(set(
                    [0, min(167, len(jpegs) - 1),
                     min(227, len(jpegs) - 1),
                     min(335, len(jpegs) - 1), len(jpegs) - 1]))
                jpeg_samples = [file_receipt(jpegs[i], 'jpeg')
                                for i in sample_indices]
            else:
                sample_indices = []
                jpeg_samples = []
            video_receipts = [file_receipt(path, 'mp4') for path in videos]
            verify_source(source_file)
            queue_after = [
                job.get_path_name() for job in MRQ.get_queue().get_jobs()]
            queue_unchanged = (
                queue_after == REPORT['editor_queue_jobs_before'])
            complete = (
                bool(success)
                and len(jpegs) == 480
                and len(videos) == 1
                and all(item.get('valid_header')
                        and item.get('resolution') == [1280, 720]
                        for item in jpeg_samples)
                and all(item.get('valid_header') for item in video_receipts)
                and queue_unchanged
                and REPORT['source_map_unchanged'])
            REPORT.update({
                'executor_success': bool(success),
                'actual_jpeg_count': len(jpegs),
                'actual_mp4_count': len(videos),
                'jpeg_sample_indices': sample_indices,
                'jpeg_sample_receipts': jpeg_samples,
                'mp4_receipts': video_receipts,
                'editor_queue_jobs_after': queue_after,
                'editor_queue_unchanged': queue_unchanged,
                'status': (
                    'RENDER_OUTPUTS_PRESENT_PENDING_VISUAL_REVIEW'
                    if complete else 'RENDER_VALIDATION_FAILED'),
            })
            index['status'] = REPORT['status']
            index['actual_jpeg_count'] = len(jpegs)
            index['actual_mp4_count'] = len(videos)
            index['jpeg_sample_receipts'] = jpeg_samples
            index['mp4_receipts'] = video_receipts
            write_json('output_index.json', index)
        except Exception:
            REPORT['status'] = 'RENDER_RECEIPT_FAILED'
            REPORT['error'] = traceback.format_exc()
        finally:
            write_json('receipt.json', REPORT)
            U.log('Outdoor proof completed: %s | %s'
                  % (REPORT['status'], str(OUT)))
            if os.environ.get('NH_OUTDOOR_PROOF_QUIT') == '1':
                U.SystemLibrary.execute_console_command(None, 'QUIT_EDITOR')

    executor = U.new_object(U.MoviePipelinePIEExecutor)
    executor.on_executor_finished_delegate.add_callable(finished)
    # Keep transient UObjects and the Python callback alive through async PIE.
    builtins._NH_OUTDOOR_PROOF_KEEPALIVE = (
        queue, executor, finished, REPORT, index)
    REPORT['status'] = 'RENDER_SUBMITTED'
    write_json('receipt.json', REPORT)
    MRQ.render_queue_instance_with_executor_instance(queue, executor)


def main():
    source_file, document = preflight()
    index = expected_output_index(document)
    write_json('output_index.json', index)
    if ACTION == 'inspect':
        REPORT['status'] = 'PREFLIGHT_PASSED_NO_PROJECT_CHANGES'
        write_json('receipt.json', REPORT)
        U.log('Outdoor proof preflight only: ' + str(OUT))
        return

    if RESUME:
        receipt_path = OUT / 'receipt.json'
        check(receipt_path.is_file(), 'Resume receipt is missing')
        old = json.loads(receipt_path.read_text(encoding='utf-8'))
        check(old.get('review_map') == REVIEW_MAP
              and old.get('sequence') == SEQUENCE,
              'Resume is restricted to this script own candidate')
        check(old.get('status') in (
            'BUILT_NOT_RENDERED', 'FAILED_NO_AUTOMATIC_ROLLBACK',
            'RENDER_VALIDATION_FAILED', 'RENDER_RECEIPT_FAILED'),
            'Resume status is not eligible')
        check(old.get('source_sha256_before') == digest(source_file),
              'Source v011 changed since this candidate was built')
        check(SAVE.load_map(REVIEW_MAP) is not None,
              'Cannot load own isolated review map')
        assert_review_world()
        sequence = ELL.load_asset(SEQUENCE)
        check(sequence is not None, 'Own saved Level Sequence is missing')
        for label, expected in old.get(
                'closed_gate_transforms_after_reopen', {}).items():
            actual = transform_receipt(unique_actor_by_label(label))
            check(max_transform_delta(expected, actual) < 0.01,
                  label + ' moved since this candidate was built')
        REPORT.update({
            'source_sha256_before': old['source_sha256_before'],
            'source_clone_reloaded_before_edits': old.get(
                'source_clone_reloaded_before_edits'),
            'camera_segments': old.get('camera_segments', []),
            'closed_gate_transforms_before': old.get(
                'closed_gate_transforms_before', {}),
            'closed_gate_transforms_after_reopen': old.get(
                'closed_gate_transforms_after_reopen', {}),
            'closed_gate_max_abs_delta_after_reopen': old.get(
                'closed_gate_max_abs_delta_after_reopen', {}),
            'gate_bindings_created': [],
            'resumed_own_candidate': True,
        })
    else:
        sequence = build_assets(document)

    verify_source(source_file)
    queue = make_queue(sequence, document)
    REPORT['editor_queue_jobs_after_build'] = [
        job.get_path_name() for job in MRQ.get_queue().get_jobs()]
    REPORT['editor_queue_unchanged_after_build'] = (
        REPORT['editor_queue_jobs_after_build']
        == REPORT['editor_queue_jobs_before'])
    check(REPORT['editor_queue_unchanged_after_build'],
          'Private queue construction changed the editor queue')
    index = expected_output_index(document)
    write_json('output_index.json', index)
    REPORT['status'] = 'BUILT_NOT_RENDERED'
    write_json('receipt.json', REPORT)

    if ACTION == 'render':
        if RENDER_DIR.exists():
            existing = list(RENDER_DIR.iterdir())
            check(not existing,
                  'Render directory is not empty; refusing overwrite')
        else:
            RENDER_DIR.mkdir(parents=True, exist_ok=False)
        render(queue, source_file, index)
    else:
        builtins._NH_OUTDOOR_PROOF_KEEPALIVE = (queue, REPORT, index)
        U.log('Built isolated outdoor proof; not rendered: ' + str(OUT))


try:
    main()
except Exception:
    REPORT['status'] = 'FAILED_NO_AUTOMATIC_ROLLBACK'
    REPORT['error'] = traceback.format_exc()
    write_json('receipt.json', REPORT)
    U.log_error(REPORT['error'])
    if os.environ.get('NH_OUTDOOR_PROOF_QUIT') == '1':
        U.SystemLibrary.execute_console_command(None, 'QUIT_EDITOR')
    raise
