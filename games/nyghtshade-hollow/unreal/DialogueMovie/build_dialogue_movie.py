"""Build the "Four Hours" dialogue movie as Level Sequences in Unreal Engine 5 (run inside the editor:
Tools > Execute Python Script, or `py build_dialogue_movie.py` in the Output Log).

What it does (nothing is overwritten; everything goes to /Game/NH/DialogueMovie):
  1. imports the 58 voice WAVs from ./lines next to this file as SoundWaves
  2. creates one LevelSequence per scene (S1..S7) at 24 fps, with an audio track holding every line
     at its time from dialogue_lines.csv
  3. binds the cast if actors with these labels exist in the open level (MetaHumans):
     Maddox (Dean), Harrington, Arianna - edit CAST below to match your Outliner labels
  4. adds a CineCameraActor per scene + camera cut track, framed on the first bound actor
  5. creates SEQ_FourHours_Master with the scenes in order (subsequence track)
Then: generate lip-sync/face per line with MetaHuman Animator (audio-driven, UE 5.5+) using the
same WAVs, add those animation sections on each MetaHuman's Face track, block the actors, render
with Movie Render Queue."""
import csv, os, unreal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = '/Game/NH/DialogueMovie'
FPS = 24
CAST = {'MADDOX': ['Maddox', 'Dean', 'BP_Dean'], 'HARRINGTON': ['Harrington'], 'ARIANNA': ['Arianna'], 'ALLEN': []}

tools = unreal.AssetToolsHelpers.get_asset_tools()
eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
log = unreal.log

def import_audio():
    tasks = []
    for f in sorted(os.listdir(os.path.join(HERE, 'lines'))):
        if not f.endswith('.wav'):
            continue
        t = unreal.AssetImportTask()
        t.filename = os.path.join(HERE, 'lines', f); t.destination_path = ROOT + '/Audio'
        t.automated = True; t.save = True; t.replace_existing = False
        tasks.append(t)
    tools.import_asset_tasks(tasks)
    log(f'[NH] imported {len(tasks)} voice lines')

def find_actor(labels):
    for a in eas.get_all_level_actors():
        lab = a.get_actor_label().lower()
        if any(l.lower() in lab for l in labels):
            return a
    return None

def binding_id(seq, b):
    for fn in (lambda: seq.get_binding_id(b),
               lambda: unreal.MovieSceneSequenceExtensions.get_portable_binding_id(seq, seq, b),
               lambda: unreal.MovieSceneSequenceExtensions.make_binding_id(seq, b, unreal.MovieSceneObjectBindingSpace.LOCAL)):
        try:
            return fn()
        except Exception:
            pass
    raise RuntimeError('no binding-id API found in this engine version')

def add_track(seq, cls):
    return seq.add_track(cls) if hasattr(seq, 'add_track') else seq.add_master_track(cls)

def build():
    rows = list(csv.DictReader(open(os.path.join(HERE, 'dialogue_lines.csv'))))
    scenes = []
    for r in rows:
        if r['Scene'] not in scenes:
            scenes.append(r['Scene'])
    made = []
    for sc in scenes:
        rs = [r for r in rows if r['Scene'] == sc]
        t0 = float(rs[0]['StartSeconds']) - 1.5
        t1 = float(rs[-1]['EndSeconds']) + 2.0
        name = f'SEQ_FourHours_{sc}'
        path = f'{ROOT}/{name}'
        if unreal.EditorAssetLibrary.does_asset_exist(path):
            log(f'[NH] {name} exists, skipped (delete it to rebuild)'); made.append(unreal.load_asset(path)); continue
        seq = tools.create_asset(name, ROOT, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
        seq.set_display_rate(unreal.FrameRate(FPS, 1))
        seq.set_playback_start(0); seq.set_playback_end(int((t1 - t0) * FPS))
        audio = add_track(seq, unreal.MovieSceneAudioTrack)
        for r in rs:
            snd = unreal.load_asset(f"{ROOT}/Audio/{r['AudioFile'][:-4]}")
            if not snd:
                unreal.log_warning(f"[NH] missing sound {r['AudioFile']}"); continue
            s = audio.add_section(); s.set_sound(snd)
            s.set_range(int((float(r['StartSeconds']) - t0) * FPS), int((float(r['EndSeconds']) - t0) * FPS) + 1)
        bound = None
        for who in {r['Speaker'] for r in rs}:
            a = find_actor(CAST.get(who, [])) if CAST.get(who) else None
            if a:
                seq.add_possessable(a); bound = bound or a
                log(f'[NH] {sc}: bound {who} -> {a.get_actor_label()}')
            elif CAST.get(who):
                unreal.log_warning(f'[NH] {sc}: no actor labelled {CAST[who]} for {who}; bind it by hand')
        loc = bound.get_actor_location() if bound else unreal.Vector(0, 0, 160)
        cam = eas.spawn_actor_from_class(unreal.CineCameraActor, loc + unreal.Vector(-260, 60, 150), unreal.Rotator(0, -5, 0))
        cam.set_actor_label(f'CAM_FourHours_{sc}')
        if bound:
            cam.set_actor_rotation(unreal.MathLibrary.find_look_at_rotation(cam.get_actor_location(), loc + unreal.Vector(0, 0, 150)), False)
        cb = seq.add_possessable(cam)
        cut = add_track(seq, unreal.MovieSceneCameraCutTrack).add_section()
        cut.set_range(0, int((t1 - t0) * FPS)); cut.set_camera_binding_id(binding_id(seq, cb))
        unreal.EditorAssetLibrary.save_loaded_asset(seq)
        made.append(seq); log(f'[NH] built {name}: {len(rs)} lines, {t1 - t0:.1f} s')
    master = tools.create_asset('SEQ_FourHours_Master', ROOT, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    master.set_display_rate(unreal.FrameRate(FPS, 1))
    sub = add_track(master, unreal.MovieSceneSubTrack); f = 0
    for seq in made:
        n = seq.get_playback_end() - seq.get_playback_start()
        s = sub.add_section(); s.set_sequence(seq); s.set_range(f, f + n); f += n
    master.set_playback_start(0); master.set_playback_end(f)
    unreal.EditorAssetLibrary.save_loaded_asset(master)
    log(f'[NH] master sequence: {f / FPS:.1f} s')

import_audio()
build()
