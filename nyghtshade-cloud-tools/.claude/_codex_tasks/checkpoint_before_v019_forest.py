"""Delta checkpoint of v018 and its six new R5 assets before private forest work."""
import datetime, hashlib, json, pathlib, shutil, subprocess

P = pathlib.Path('E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009')
C = pathlib.Path('H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup/Checkpoints')
PRIOR = C/'pre_v018_waterfall_20261010T180018932035Z'
ORIGINAL = pathlib.Path('C:/Users/Gierl/Documents/Unreal Projects/MyProject2/Content/Nyghtshade/Maps/RecoveredPrisonReview.umap')
EXPECTED_ORIGINAL = 'DCAD1878E452EA2AF5DC2C62505652A5F25A942FC2C8F67ECB58346BA60B3535'
EXPECTED_MAP = 'A66BAD052704DEBED7F05D7A521D536E2EF0FD595497D1D84F95EBE479043EBB'
EXPECTED_PRIOR = 'A502A1BFB76619CAC4FFA855525408F3BA00021BA6E8A07B334E540B0AFA4ECC'

def sha(p):
    h=hashlib.sha256()
    with pathlib.Path(p).open('rb') as f:
        for b in iter(lambda:f.read(8388608),b''): h.update(b)
    return h.hexdigest().upper()

def owners():
    cmd="@(Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'UnrealEditor|ShaderCompileWorker|^MyProject2.*\\.exe$' } | ForEach-Object {[pscustomobject]@{pid=$_.ProcessId;name=$_.Name;cmd=$_.CommandLine;created=$_.CreationDate.ToUniversalTime().ToString('o')}}) | ConvertTo-Json -Compress"
    raw=subprocess.check_output(['powershell','-NoProfile','-Command',cmd],text=True)
    rows=json.loads(raw) if raw.strip() else []; rows=rows if isinstance(rows,list) else [rows]
    for r in rows:
        assert r['pid']==27212 and r['name']=='UnrealEditor.exe' and r['created']=='2026-10-10T03:03:35.8910120Z' and r['cmd'].strip()=='"H:\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor.exe"', 'Unknown/project writer present'
    return [{'pid':r['pid'],'role':'untouched user project browser'} for r in rows]

R={'status':'STARTED','scope':'Seven-file delta; requires hash-verified pre_v018 plus pre_v014/pre_v008 and unchanged owned dependencies; not a complete project backup.','restore_tested':False,'files':[]}
D=None
try:
    R['owners_before']=owners()
    assert sha(ORIGINAL)==EXPECTED_ORIGINAL
    assert sha(PRIOR/'MANIFEST.json')==EXPECTED_PRIOR
    prior=json.loads((PRIOR/'MANIFEST.json').read_text(encoding='utf-8'))
    for row in prior['files']:
        assert sha(PRIOR/row['checkpoint_path'])==row['sha256']
    source_map=P/'Content/Nyghtshade/Maps/NH_EnvRefine_Codex_v018.umap'
    assert sha(source_map)==EXPECTED_MAP
    assets=sorted((P/'Content/Nyghtshade/EnvironmentRepair_20261010').glob('*R5*.uasset'))
    assert len(assets)==6, 'Expected exactly six new R5 meshes'
    files=[source_map]+assets
    total=sum(f.stat().st_size for f in files)
    assert total<268435456 and shutil.disk_usage(C).free>total+536870912
    D=C/('pre_v019_forest_'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'));D.mkdir(exist_ok=False)
    for f in files:
        assert f.resolve().is_relative_to(P.resolve()) and not f.is_symlink()
        assert not (getattr(f.stat(),'st_file_attributes',0)&0x400)
        sig=(f.stat().st_size,f.stat().st_mtime_ns); h=sha(f); rel=f.relative_to(P)
        target=D/'EnvCopy'/rel; target.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(f,target)
        assert sig==(f.stat().st_size,f.stat().st_mtime_ns) and sha(f)==h and sha(target)==h
        R['files'].append({'relative_path':rel.as_posix(),'checkpoint_path':'EnvCopy/'+rel.as_posix(),'bytes':sig[0],'sha256':h})
    R['owners_after']=owners()
    assert sha(ORIGINAL)==EXPECTED_ORIGINAL
    for row in R['files']: assert sha(P/row['relative_path'])==row['sha256']
    R.update(status='DELTA_COPY_HASH_VERIFIED_NOT_RESTORE_TESTED',checkpoint=str(D),file_count=len(files),bytes=total,all_copy_hashes_match=True,source_stable=True,accepted_source_sha256=EXPECTED_ORIGINAL,required_prior_checkpoint=str(PRIOR),required_prior_manifest_sha256=EXPECTED_PRIOR,prior_payload_hashes_verified=len(prior['files']))
    (D/'MANIFEST.json').write_text(json.dumps(R,indent=2),encoding='utf-8')
    (D/'RESTORE.md').write_text('Restore into a separate recovery copy only. Verify every manifest and payload hash, restore pre_v008/pre_v014/pre_v018 layers, then this v018 delta. Keep unchanged third-party dependencies. Reopen UE5.8.2 and rerun tests. Actual restoration has not been executed. Water collision passed; visual appearance remains failed.',encoding='utf-8')
    print(json.dumps({k:v for k,v in R.items() if k!='files'},indent=2));print('MANIFEST_SHA256 '+sha(D/'MANIFEST.json'))
except Exception:
    if D: (D/'MANIFEST_INCOMPLETE.json').write_text(json.dumps(R,indent=2),encoding='utf-8')
    raise
