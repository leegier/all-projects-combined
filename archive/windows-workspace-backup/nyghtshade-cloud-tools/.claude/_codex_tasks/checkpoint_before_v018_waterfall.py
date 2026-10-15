"""Bounded pre-v018 generated dependency/map checkpoint. No deletes or UE launch."""
import datetime,hashlib,json,pathlib,shutil,subprocess
P=pathlib.Path('E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009')
C=pathlib.Path('H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup/Checkpoints')
O=pathlib.Path('C:/Users/Gierl/Documents/Unreal Projects/MyProject2/Content/Nyghtshade/Maps/RecoveredPrisonReview.umap')
OSH='DCAD1878E452EA2AF5DC2C62505652A5F25A942FC2C8F67ECB58346BA60B3535'
V17SH='77339D12BCD2A3D63E79B0D4E2AE7552F2314093A51D82D8D77097DFE523DFE6'
def sha(p):
 h=hashlib.sha256()
 with pathlib.Path(p).open('rb') as f:
  for b in iter(lambda:f.read(8388608),b''):h.update(b)
 return h.hexdigest().upper()
def owners():
 command="@(Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'UnrealEditor|ShaderCompileWorker|^MyProject2.*\\.exe$' } | ForEach-Object {[pscustomobject]@{pid=$_.ProcessId;name=$_.Name;cmd=$_.CommandLine;created=$_.CreationDate.ToUniversalTime().ToString('o')}}) | ConvertTo-Json -Compress"
 data=subprocess.check_output(['powershell','-NoProfile','-Command',command],text=True)
 rows=json.loads(data) if data.strip() else [];rows=rows if isinstance(rows,list) else [rows]
 for r in rows:
  assert r['pid']==27212 and r['name']=='UnrealEditor.exe' and r['created']=='2026-10-10T03:03:35.8910120Z' and r['cmd'].strip()=='"H:\\UE_5.8\\Engine\\Binaries\\Win64\\UnrealEditor.exe"', 'Project writer or unknown owner present'
 return [{'pid':r['pid'],'name':r['name'],'created_utc':r['created'],'role':'untouched_user_project_browser'} for r in rows]
def inventory():
 files=[P/'MyProject2.uproject']
 for d in ['Config','Content/Nyghtshade/EnvironmentRepair_20261010']:
  files.extend(x for x in (P/d).rglob('*') if x.is_file())
 for v in ['015','017']:
  f=P/f'Content/Nyghtshade/Maps/NH_EnvRefine_Codex_v{v}.umap'; files.append(f)
  for ext in ['.uexp','.ubulk','.uptnl']:
   if f.with_suffix(ext).exists():files.append(f.with_suffix(ext))
  built=f.with_name(f.stem+'_BuiltData.uasset')
  if built.exists():files.append(built)
 return sorted(set(files))
R={'status':'STARTED','scope':'Bounded pre-v018 maps/generated assets/Config; requires pre-v008,pre-v014 and unchanged EnvCopy owned dependencies. Not full archive or restore test.','files':[],'restore_tested':False}
D=None
try:
 R['owners_before']=owners(); assert sha(O)==OSH
 assert sha(P/'Content/Nyghtshade/Maps/NH_EnvRefine_Codex_v017.umap')==V17SH
 fs=inventory();assert len(fs)<200; total=sum(f.stat().st_size for f in fs);assert total<1073741824 and shutil.disk_usage(C).free>total+536870912
 D=C/('pre_v018_waterfall_'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'));D.mkdir(exist_ok=False)
 for f in fs:
  assert f.resolve().is_relative_to(P.resolve()) and not f.is_symlink()
  assert not (getattr(f.stat(),'st_file_attributes',0)&0x400)
  rel=f.relative_to(P); stat=f.stat(); before=(stat.st_size,stat.st_mtime_ns); h=sha(f)
  target=D/'EnvCopy'/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,target)
  after=f.stat();assert before==(after.st_size,after.st_mtime_ns) and sha(f)==h and sha(target)==h
  R['files'].append({'relative_path':str(rel).replace('\\','/'),'bytes':before[0],'sha256':h,'checkpoint_path':'EnvCopy/'+str(rel).replace('\\','/')})
 assert inventory()==fs;R['owners_after']=owners();assert sha(O)==OSH
 for row in R['files']:assert sha(P/row['relative_path'])==row['sha256']
 R.update(status='BOUNDED_COPY_HASH_VERIFIED_NOT_RESTORE_TESTED',checkpoint=str(D),bytes=total,file_count=len(fs),all_copy_hashes_match=True,source_stable=True,accepted_source_sha256=sha(O),v017_source_sha256=V17SH)
 (D/'MANIFEST.json').write_text(json.dumps(R,indent=2),encoding='utf-8')
 (D/'RESTORE.md').write_text('Restore only to a separate recovery copy after verifying every payload hash. Keep unchanged third-party dependencies and prior pre-v008/pre-v014 layers. Overlay EnvCopy paths together. No source deletion or merge is authorized. Reopen UE5.8.2 and retest; actual restoration was not executed. v017 is preserved failed water evidence; v015 remains the bounded collision-query working source.',encoding='utf-8')
 print(json.dumps({k:v for k,v in R.items() if k!='files'},indent=2));print('MANIFEST_SHA256 '+sha(D/'MANIFEST.json'))
except Exception:
 if D:(D/'MANIFEST_INCOMPLETE.json').write_text(json.dumps(R,indent=2),encoding='utf-8')
 raise
