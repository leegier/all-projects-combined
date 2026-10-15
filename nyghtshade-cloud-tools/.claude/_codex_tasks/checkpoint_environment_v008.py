from pathlib import Path
import hashlib, json, shutil, datetime, os
P = Path(r'E:\GameDev\Staging\MyProject2_EnvCopy_Claude_20261009')
stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
C = Path(r'H:\NyghtshadeHollow_Development\2026-10-10\EnvironmentCleanup\Checkpoints') / ('pre_v008_' + stamp)
files = [P / 'MyProject2.uproject', P / 'Content/Nyghtshade/Maps/NH_EnvRefine_Claude_v008.umap']
for folder in ['Content/_ClaudeEnv', 'Config', '_claude_scripts', '_claude_evidence/stageE']:
    files += [f for f in (P / folder).rglob('*') if f.is_file()]
for folder in ['Content/__ExternalActors__/Nyghtshade/Maps/NH_EnvRefine_Claude_v008', 'Content/__ExternalObjects__/Nyghtshade/Maps/NH_EnvRefine_Claude_v008']:
    if (P / folder).exists(): files += [f for f in (P / folder).rglob('*') if f.is_file()]
files = sorted(set(files))
def sha(f):
    h = hashlib.sha256()
    with f.open('rb') as s:
        for b in iter(lambda:s.read(8*1024*1024), b''): h.update(b)
    return h.hexdigest()
rows = []
for f in files:
    if f.is_symlink() or bool(f.stat().st_file_attributes & 0x400): raise RuntimeError('Reparse file refused: '+str(f))
    st = f.stat(); h = sha(f); dst = C / f.relative_to(P)
    dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(f, dst)
    now = f.stat()
    if (st.st_size, st.st_mtime_ns) != (now.st_size, now.st_mtime_ns) or sha(f) != h or sha(dst) != h: raise RuntimeError('Unstable/mismatched file: '+str(f))
    rows.append({'relative_path':f.relative_to(P).as_posix(), 'bytes':st.st_size, 'sha256':h})
source_map = Path(r'C:\Users\Gierl\Documents\Unreal Projects\MyProject2\Content\Nyghtshade\Maps\RecoveredPrisonReview.umap')
accepted = sha(source_map)
assert accepted == 'dcad1878e452ea2af5dc2c62505652a5f25a942fc2c8f67ecb58346ba60b3535'
manifest = {'checkpoint':str(C),'project':str(P),'map':'/Game/Nyghtshade/Maps/NH_EnvRefine_Claude_v008','scope':'Current map, all generated _ClaudeEnv packages, Config, project descriptor, Claude scripts and stageE design inputs. Unmodified third-party dependencies remain in the verified environment copy; this is a bounded recovery checkpoint, not an entire project backup.','file_count':len(rows),'bytes':sum(r['bytes'] for r in rows),'all_copy_hashes_match':True,'accepted_source_map_sha256':accepted,'files':rows}
(C / 'MANIFEST.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(C / 'RESTORE.md').write_text('Close any editor owning this environment copy. Verify MANIFEST.json hashes, then restore its relative paths under '+str(P)+'. Restore the whole listed generated-package set together with the map; v007 alone is not a geometry checkpoint. Third-party packages are unchanged and remain in the existing copy. Never restore into the original MyProject2.\n',encoding='utf-8')
Path(r'E:\_codex_tasks\environment_checkpoint_current.json').write_text(json.dumps({'checkpoint':str(C),'manifest_sha256':sha(C/'MANIFEST.json')},indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in manifest.items() if k!='files'},indent=2))
