"""Prepared offline. Copy-only bounded recovery checkpoint, never an engine launch.

Default is a read-only plan. Root executes --commit --stable-boundary-note "..."
only after all project-writing Unreal jobs have finished and writers are quiet.
The exactly identified user-owned empty project browser is preserved. No source moves,
deletes, automatic restore, project merge or cloud transfer.
"""
from pathlib import Path
import argparse, collections, datetime, hashlib, json, os, re, shutil, subprocess, traceback

P=Path('E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009')
SCRIPTS=Path('E:/_codex_tasks')
WORK=Path('H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup')
CHECKPOINTS=WORK/'Checkpoints'
ORIGINAL=Path('C:/Users/Gierl/Documents/Unreal Projects/MyProject2/Content/Nyghtshade/Maps/RecoveredPrisonReview.umap')
ORIGINAL_SHA='dcad1878e452ea2af5dc2c62505652a5f25a942fc2c8f67ecb58346ba60b3535'
CRITICAL={
    '013':'e6ca0eee3560257cab2832eaddda51e4ec581925306ceac06f1afcafc6a1efaf',
    '014':'59ae0523b9a38681b38ccd58ae88be1f61fea18331c25f63131e680c7cfc2a28',
    '015':'7307884bd3e79f8d418fd67149070fe4853af49dda4d65da40ba991c17269672',
    '016':'9f1193b7c99a3ef5e183b39346622bd804c10c99018b3d207fd83949d455f6a8',
    '017':'77339d12bcd2a3d63e79b0d4e2ae7552f2314093a51d82d8d77097dfe523dfe6',
    '018':'a66bad052704debed7f05d7a521d536e2ef0fd595497d1d84f95ebe479043ebb'}
LAYERS=[
    ('pre_v008_20261010_074713','9da5feed860b4df9ad21d1e9b92633f279ef8b26c41acbe6ab564aceb4bacae8'),
    ('pre_v014_20261010_104414','9afd61ec78450b3565d48b4fde0e834076baffff75d5c021c1ae6cf669b633a9'),
    ('pre_v018_waterfall_20261010T180018932035Z','a502a1bfb76619cac4ffa855525408f3ba00021ba6e8a07b334e540b0afa4ecc'),
    ('pre_v019_forest_20261010T182756849217Z','5746387e164fa582e37790c1a258c19cfb02437f4c54f510a0645f46c4443dbc')]
PRISON=Path('H:/NyghtshadeHollow_Development/2026-10-10/PrisonMaterialReview')
PROJECT_TREES=['Config','Content/Nyghtshade/EnvironmentRepair_20261010','Content/_CodexReview']
SCRIPT_PATTERNS=['*environment*','*forest*wpo*','*waterfall*','*cb01*','*CB01*','*oak*','*Oak*','*prison*review*',
                 '*prison*six*','*prison*floor*','*corridor*','*vein*','*material*neutral*','*performance*','V012_oak*','*canopy*','*topdown*','*TopDown*','*top_down*','*forest*','*Forest*','*v014*','*v015*','*v016*','*v017*','*v019*','*v020*','*v021*']
ALLOWED_SCRIPT_EXT={'.py','.ps1','.json','.md','.txt','.hlsl'}
EMPTY_BROWSER={'pid':27212,'name':'UnrealEditor.exe',
    'exe':'H:/UE_5.8/Engine/Binaries/Win64/UnrealEditor.exe',
    'created_utc':'2026-10-10T03:03:35.8910120Z'}
PROCESS_AUDITS=[]

def need(v,s):
    if not v: raise RuntimeError(s)
def sha(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for b in iter(lambda:f.read(8*1024*1024),b''):h.update(b)
    return h.hexdigest()
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def stamp():return datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
def signature(p):
    s=p.stat();return (s.st_size,s.st_mtime_ns)
def no_reparse(p):
    p=Path(p)
    for q in (p,*p.parents):
        if q.exists():need(not q.is_symlink() and not (getattr(q.stat(),'st_file_attributes',0)&0x400),'Reparse path refused: '+str(q))
def under(p,root):
    p=Path(p);root=Path(root)
    no_reparse(p);no_reparse(root)
    need(p.resolve().is_relative_to(root.resolve()),'Path outside admitted root: '+str(p))
    return p.relative_to(root)
def bounded_tree(folder):
    folder=Path(folder)
    if not folder.exists():return []
    no_reparse(folder);result=[]
    for base,dirs,files in os.walk(folder,followlinks=False):
        for name in dirs:no_reparse(Path(base)/name)
        for name in files:
            p=Path(base)/name;no_reparse(p);result.append(p)
    return result
def engine_processes():
    # Read-only ownership check. No process is ever signalled. The exception is
    # one exact user-owned empty Unreal project browser, not a blanket PID allow.
    # Persist hashes, not unrelated command lines; missing ownership data blocks.
    command="@(Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'UnrealEditor*' -or $_.Name -eq 'ShaderCompileWorker.exe' -or $_.Name -match '^MyProject2.*\\.exe$' } | ForEach-Object { [pscustomobject]@{ProcessId=$_.ProcessId;ParentProcessId=$_.ParentProcessId;Name=$_.Name;ExecutablePath=$_.ExecutablePath;CommandLine=$_.CommandLine;CreatedUTC=if ($_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString('o')} else {$null}} }) | ConvertTo-Json -Compress"
    result=subprocess.run(['powershell','-NoProfile','-NonInteractive','-Command',command],capture_output=True,text=True,check=True)
    value=json.loads(result.stdout) if result.stdout.strip() else []
    value=value if isinstance(value,list) else [value]
    audited=[];blockers=[]
    for p in value:
        cmd=(p.get('CommandLine') or '').strip()
        exe=(p.get('ExecutablePath') or '').replace('\\','/').casefold()
        quoted='"'+EMPTY_BROWSER['exe'].replace('/','\\')+'"'
        expected_cmd=cmd.replace('/','\\').casefold() in (quoted.casefold(),quoted[1:-1].casefold())
        exact_empty=(p.get('ProcessId')==EMPTY_BROWSER['pid'] and p.get('Name')==EMPTY_BROWSER['name']
                     and exe==EMPTY_BROWSER['exe'].casefold() and expected_cmd
                     and p.get('CreatedUTC')==EMPTY_BROWSER['created_utc'])
        role='verified_user_empty_project_browser_keep_open' if exact_empty else 'project_writer_or_unknown_ownership_blocking'
        row={'pid':p.get('ProcessId'),'parent_pid':p.get('ParentProcessId'),'name':p.get('Name'),
             'executable_path':p.get('ExecutablePath'),'created_utc':p.get('CreatedUTC'),
             'commandline_sha256':hashlib.sha256(cmd.encode('utf-8')).hexdigest(),'role':role}
        audited.append(row)
        if not exact_empty:blockers.append(row)
    PROCESS_AUDITS.append({'queried_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'processes':audited})
    return blockers

def collect(prior_paths, versions):
    files={}
    def add(p,root,namespace,required=False):
        p=Path(p)
        if not p.exists():
            need(not required,'Required checkpoint input missing: '+str(p));return
        need(p.is_file(),'Expected file: '+str(p))
        rel=under(p,root);key=str(p.resolve())
        files[key]={'path':p,'namespace':namespace,'relative':rel.as_posix()}
    add(P/'MyProject2.uproject',P,'EnvCopy',True)
    saved_versions={int(re.fullmatch(r'NH_EnvRefine_Codex_v(\d{3})\.umap',p.name).group(1)) for p in (P/'Content/Nyghtshade/Maps').glob('NH_EnvRefine_Codex_v[0-9][0-9][0-9].umap')}
    need(not any(v>int(versions[-1]) for v in saved_versions),'A later saved review map exists; explicitly review and admit the latest version before checkpoint.')
    for version in versions:
        map_path=P/f'Content/Nyghtshade/Maps/NH_EnvRefine_Codex_v{version}.umap'
        add(map_path,P,'EnvCopy',True)
        for suffix in ('.uexp','.ubulk','.uptnl'):
            add(map_path.with_suffix(suffix),P,'EnvCopy')
        built=map_path.with_name(map_path.stem+'_BuiltData.uasset')
        for suffix in ('.uasset','.uexp','.ubulk','.uptnl'):
            add(built.with_suffix(suffix),P,'EnvCopy')
    for folder in PROJECT_TREES:
        for p in bounded_tree(P/folder):add(p,P,'EnvCopy')
    for kind in ('__ExternalActors__','__ExternalObjects__'):
        for suffix in ['_CodexReview','Nyghtshade/EnvironmentRepair_20261010']+[f'Nyghtshade/Maps/NH_EnvRefine_Codex_v{v}' for v in versions]:
            for p in bounded_tree(P/'Content'/kind/suffix):add(p,P,'EnvCopy')
    # Already sealed generated/input files are a bounded list, not a drive scan.
    # Hash and copy any changed member; inherit identical bytes from prior layers.
    for rel in prior_paths:add(P/rel,P,'EnvCopy')
    add(WORK/'REQUIREMENTS.md',WORK,'EnvironmentCleanup',True)
    for folder in ('Evidence','Logs','Performance','PerformanceCandidates'):
        for p in bounded_tree(WORK/folder):add(p,WORK,'EnvironmentCleanup')
    for folder in ('MatchedReview_20261010_100138',):
        for p in bounded_tree(PRISON/folder):add(p,PRISON,'PrisonMaterialReviewEvidence')
    for pattern in ('FloorR3_*','FloorR4_*','FloorR5_*','MatchedReviewR4_*','MatchedReviewR5_*'):
        for folder in PRISON.glob(pattern):
            if folder.is_dir():
                for p in bounded_tree(folder):add(p,PRISON,'PrisonMaterialReviewEvidence')
    for name in ('receipt.json','RenderDone.json'):
        add(PRISON/'Run_20261010_082615_3d6b9856'/name,PRISON,'PrisonMaterialReviewEvidence')
    for pattern in SCRIPT_PATTERNS+['*v'+v+'*' for v in versions]:
        for p in SCRIPTS.glob(pattern):
            if p.is_file() and p.suffix.lower() in ALLOWED_SCRIPT_EXT:add(p,SCRIPTS,'TaskScripts')
    add(Path(__file__),SCRIPTS,'TaskScripts',True)
    return files

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--commit',action='store_true');ap.add_argument('--stable-boundary-note',default='')
    ap.add_argument('--through-map-version',type=int,default=17,help='Explicit last saved map to admit, e.g. 18 after v018 finishes. New versions are preserved but not declared accepted.')
    ap.add_argument('--max-bytes',type=int,default=8*1024**3);ap.add_argument('--max-files',type=int,default=12000)
    args=ap.parse_args();dest=None;rows=[]
    need(17<=args.through_map_version<=99,'Bounded final version must be 17..99.')
    versions=[f'{v:03d}' for v in range(13,args.through_map_version+1)]
    manifest={'status':'STARTED_NOT_RESTORE_TESTED','scope':'Copy-only bounded delta over sealed pre_v008, pre_v014, then pre_v018_waterfall and pre_v019_forest; no full-project/archive/cloud or gameplay PASS.',
              'project':str(P),'stable_boundary_note':args.stable_boundary_note,'files':rows,'unchanged_inherited_files':[],
              'layers':[],'restore_tested':False,'original_source_path':str(ORIGINAL),'original_source_expected_sha256':ORIGINAL_SHA,
              'admitted_map_versions':versions,'process_ownership_audits':PROCESS_AUDITS}
    try:
        if args.commit:
            need(bool(args.stable_boundary_note.strip()),'Root must state the stable boundary with --stable-boundary-note.')
            active=engine_processes();need(not active,'Refusing copy while a project writer or unknown Unreal/ShaderCompileWorker is active: '+json.dumps(active))
        need(sha(ORIGINAL)==ORIGINAL_SHA,'Preserved original project source hash changed.')
        for v,expected in CRITICAL.items():need(sha(P/f'Content/Nyghtshade/Maps/NH_EnvRefine_Codex_v{v}.umap')==expected,'Pinned map hash changed: v'+v)
        prior={}
        for name,expected in LAYERS:
            mp=CHECKPOINTS/name/'MANIFEST.json';need(sha(mp)==expected,'Prior layer manifest changed: '+name)
            m=read(mp);need(m['all_copy_hashes_match'],'Prior layer not copy-verified.')
            verified=0
            for item in m['files']:
                rel=item['relative_path'];payload_rel=item.get('checkpoint_path',rel);payload=mp.parent/payload_rel
                under(payload,mp.parent);need(payload.is_file() and sha(payload).lower()==item['sha256'].lower(),'Prior-layer payload missing/mismatched: '+str(payload))
                need(payload_rel==rel or payload_rel=='EnvCopy/'+rel,'Unexpected prior layer namespace; explicit mapping required.')
                prior[rel]={'sha256':item['sha256'].lower(),'layer':str(mp.parent),'payload_relative_path':payload_rel,'bytes':item['bytes']};verified+=1
            manifest['layers'].append({'path':str(mp),'sha256':expected,'payload_files_verified':verified,'payload_bytes':m['bytes']})
        inventory=collect(prior,versions);need(len(inventory)<=args.max_files,'Bounded file count exceeded; review scope instead of broadening automatically.')
        manifest['missing_current_prior_paths']=[rel for rel in prior if not (P/rel).exists()]
        copy=[];frozen={}
        for key,item in sorted(inventory.items()):
            p=item['path'];before=signature(p);h=sha(p);need(signature(p)==before,'Writer changed a source during inventory: '+str(p))
            frozen[key]=(before,h)
            sealed=prior.get(item['relative']) if item['namespace']=='EnvCopy' else None
            entry={'source':str(p),'namespace':item['namespace'],'relative_path':item['relative'],'bytes':before[0],'sha256':h,
                   'checkpoint_path':item['namespace']+'/'+item['relative']}
            if sealed and sealed['sha256']==h:
                entry['inherited_layer']=sealed['layer'];entry['inherited_payload_relative_path']=sealed['payload_relative_path'];manifest['unchanged_inherited_files'].append(entry)
            else:copy.append(entry)
        total=sum(x['bytes'] for x in copy);need(total<=args.max_bytes,'Bounded copy size exceeded; review explicit scope before raising cap.')
        manifest.update({'inventory_file_count':len(inventory),'copy_file_count':len(copy),'copy_bytes':total,
                         'inherited_file_count':len(manifest['unchanged_inherited_files']),'original_source_sha256_before':sha(ORIGINAL)})
        summary={k:v for k,v in manifest.items() if k not in ('files','unchanged_inherited_files')}
        if not args.commit:
            summary['status']='PLAN_ONLY_NO_FILES_COPIED';print(json.dumps(summary,indent=2));return
        need(not engine_processes(),'An engine job started during planning; no checkpoint copy begun.')
        need(shutil.disk_usage(CHECKPOINTS).free>total*1.05+512*1024**2,'Insufficient free checkpoint disk space.')
        dest=CHECKPOINTS/(f'post_v{args.through_map_version:03d}_review_'+stamp());under(dest,CHECKPOINTS);dest.mkdir(parents=False,exist_ok=False)
        manifest['checkpoint']=str(dest)
        for entry in copy:
            p=Path(entry['source']);expected_stat,expected_hash=frozen[str(p.resolve())]
            need(signature(p)==expected_stat and sha(p)==expected_hash,'Source changed before copy: '+str(p))
            target=dest/entry['checkpoint_path'];under(target,dest);target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(p,target)
            need(signature(p)==expected_stat and sha(p)==expected_hash and sha(target)==expected_hash,'Unstable or mismatched copy: '+str(p))
            rows.append(entry)
        final_inventory=collect(prior,versions)
        need(set(final_inventory)==set(inventory),'Source file inventory changed during checkpoint.')
        for key,(expected_stat,expected_hash) in frozen.items():
            p=Path(key);need(signature(p)==expected_stat and sha(p)==expected_hash,'Source changed after checkpoint: '+key)
        need(not engine_processes(),'Engine job started during checkpoint; refuse complete status.')
        need(sha(ORIGINAL)==ORIGINAL_SHA,'Original source hash changed during checkpoint.')
        manifest.update({'status':'BOUNDED_CHECKPOINT_COPY_HASH_VERIFIED_NOT_RESTORE_TESTED','all_copy_hashes_match':True,
                         'all_inherited_payload_hashes_verified':True,'all_current_sources_stable':True,'original_source_sha256_after':sha(ORIGINAL),
                         'completed_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
                         'last_bounded_runtime_query_passing_reference_map':'/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v015',
                         'later_map_acceptance':'Unclassified by checkpoint. New map versions are preserved, never automatically accepted; consult captured raw receipts and REQUIREMENTS.',
                         'preserved_failure_maps':['/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v016','/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v017'],
                         'v017_scope_note':'v017 saved/reopened, but subsequent native waterfall validation and visual flow proof failed. Preserve the build/crash/runtime/render receipts; no game-quality PASS.',
                         'performance_reference_map':'/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v013'})
        mp=dest/'MANIFEST.json';mp.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
        restore='''# Layered recovery instructions â€” restore not executed

This is a bounded local recovery checkpoint, not a full-project backup. Preserve the existing EnvCopy and its unchanged owned/third-party packages. No cloud transfer or original-project merge is implied.

1. Close all applications writing this EnvCopy. Recheck every layer manifest SHA256 and every listed payload SHA256. A manifest without its payload is not a backup.
2. Work in a separate recovery copy, never in the original C:/Users/Gierl/Documents/Unreal Projects/MyProject2. Retain a checkpoint of the destination before replacing any files.
3. Restore the relative project paths from pre_v008_20261010_074713, then overlay pre_v014_20261010_104414, then the EnvCopy payload from pre_v018_waterfall_20261010T180018932035Z, then pre_v019_forest_20261010T182756849217Z. Their exact manifest paths/hashes and payload namespaces are in this MANIFEST.json. Do not copy an EnvCopy directory inside the project root; its contents map to the project root.
4. Overlay this checkpoint's EnvCopy payload at the root of that same recovery copy. Inherited files were hash-verified against prior-layer payloads and the current source; they are intentionally not duplicated here. Restore maps, generated packages and sidecars together. Review missing_current_prior_paths: no deletion is automatic, and this tool did not erase source files.
5. TaskScripts and evidence namespaces are separate support artifacts. Restore them to new review folders first, not blindly over active scripts. EnvironmentCleanup evidence includes successes, partial work, failures, logs and performance receipts. Existing requirements/approval holds remain authoritative; an archived PNG is not a gameplay pass.
6. v015 is a previously captured passing bounded collision-query reference. Any later map versions are preserved without automatic acceptance; consult the captured native receipts and REQUIREMENTS for their current status. v016 and v017 are preserved failure/repair evidence, not accepted waterfall levels. The performance reference is exact v013. Keep these meanings distinct.
7. Verify restored hashes and package dependencies, then reopen a recovery copy in the matching UE5.8.2 and repeat required runtime/visual checks. This script has not tested an actual restore or launched the editor.
'''
        (dest/'RESTORE.md').write_text(restore,encoding='utf-8')
        verification={'manifest_sha256':sha(mp),'restore_instructions_sha256':sha(dest/'RESTORE.md'),'checkpoint':str(dest),
                      'copy_files':len(rows),'bytes':total,'restore_tested':False}
        (dest/'CHECKPOINT_VERIFICATION.json').write_text(json.dumps(verification,indent=2),encoding='utf-8')
        print(json.dumps({'status':manifest['status'],**verification},indent=2))
    except Exception:
        manifest.update(status='FAILED_INCOMPLETE_CHECKPOINT_DO_NOT_RESTORE',error=traceback.format_exc())
        if dest:(dest/'MANIFEST_INCOMPLETE.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
        raise

if __name__=='__main__':main()
