"""Offline native-CSV comparison only; no engine launch, asset write or PASS claim."""
import argparse, datetime, hashlib, json, pathlib, subprocess, sys

ROOT = pathlib.Path('H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup')
BASE = ROOT/'Performance/20261010T155835320927Z/Run_20261010T1559416483497Z/Metrics/PERFORMANCE_DIAGNOSTIC.json'
CANDIDATE = ROOT/'PerformanceCandidates/WPO150m/20261010T165524714062Z/CANDIDATE_PREPARATION_RECEIPT.json'
PARSER = pathlib.Path('E:/_codex_tasks/summarize_environment_game_performance.py')

def read(p): return json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def need(v,s):
    if not v: raise RuntimeError(s)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--candidate-receipt',required=True,help='Completed LAUNCH_AND_COLLECTION_RECEIPT.json')
    ap.add_argument('--out');args=ap.parse_args()
    receipt=pathlib.Path(args.candidate_receipt).resolve();launch=read(receipt);prepared=read(CANDIDATE)
    need(prepared['status']=='CANDIDATE_PREPARED_NOT_MEASURED_OR_ACCEPTED','Expected exact prepared candidate.')
    need(pathlib.Path(launch['build_receipt']).resolve()==pathlib.Path(prepared['candidate_build_receipt']).resolve(),'Collection belongs to another candidate.')
    need(launch['status']=='CAPTURE_COLLECTED_metrics_and_camera_review_required' and launch['exit_code']==0,'Native collection is not complete.')
    out=pathlib.Path(args.out) if args.out else receipt.parent/'Comparison_V013_WPO150m'
    out.mkdir(parents=True,exist_ok=False)
    subprocess.run([sys.executable,str(PARSER),'--receipt',str(receipt),'--out',str(out/'NativeMetrics')],check=True)
    candpath=out/'NativeMetrics/PERFORMANCE_DIAGNOSTIC.json';base,cand=read(BASE),read(candpath)
    for data in (base,cand):
        for path_key,hash_key in [('collection_receipt','collection_receipt_sha256'),('build_receipt','build_receipt_sha256')]:
            need(sha(data[path_key])==data[hash_key],'Metrics provenance changed: '+path_key)
        need(sha(pathlib.Path(data['collection_receipt']).parent/'UnrealGame.log')==data['log_sha256'],'Runtime log changed since parsing.')
        need(data['requested_resolution']==[1920,1080],'Requested resolution differs.')
        need(data['source_map']=='/Game/Nyghtshade/Maps/NH_EnvRefine_Codex_v013','Do not compare other environment revisions.')
        for s in data['scene_results']:
            need(s['requested_viewport_verified_at_capture_boundaries'] and s['csv_reported_resolution']==[1920,1080], 'Actual viewport boundary/CSV resolution mismatch.')
            need(sha(s['csv'])==s['sha256'],'Native CSV changed after parsing.')
    for k in ('hardware','route_sha256','presentation','build_type','warmup_seconds'):
        need(base[k]==cand[k],'Comparison control differs: '+k)
    bs={s['label']:s for s in base['scene_results']};cs={s['label']:s for s in cand['scene_results']}
    need(bs.keys()==cs.keys(),'Scene labels differ.')
    rows=[]
    for label,b in bs.items():
        c=cs[label]
        for k in ('gpu','gpudriver','cpu','engineversion','rhifeaturelevel','rhiname','shaderplatform','deviceprofile','config','raytracing','streamingpoolsizemb'):
            need(b['metadata'].get(k)==c['metadata'].get(k),'Native hardware/settings metadata differs: '+label+' '+k)
        bv={k:v['value'] for k,v in b['last_logged_cvars_before_capture'].items()}
        cv={k:v['value'] for k,v in c['last_logged_cvars_before_capture'].items()}
        need(bv==cv,'Logged runtime CVar controls differ in '+label)
        need(b['planned_capture_window']['camera_path_source']==c['planned_capture_window']['camera_path_source'],'Camera path/exposure differs.')
        row={'scene':label,'baseline_frames':b['timings']['FrameTime']['count'],'candidate_frames':c['timings']['FrameTime']['count'],
             'baseline_mean_fps':b['mean_fps_from_frame_time'],'candidate_mean_fps':c['mean_fps_from_frame_time'],
             'timing_changes':[], 'baseline_hitches':b['frame_budget_exceedances'],'candidate_hitches':c['frame_budget_exceedances'],
             'baseline_warnings':b['warnings'],'candidate_warnings':c['warnings'],
             'baseline_selected_counters':b['selected_counters'],'candidate_selected_counters':c['selected_counters']}
        for counter in ('FrameTime','GPUTime','GameThreadTime','RenderThreadTime','RHIThreadTime'):
            x,y=b['timings'].get(counter,{}),c['timings'].get(counter,{})
            if not (x.get('available') and y.get('available')):continue
            for stat in ('mean','median','p95','p99','max'):
                row['timing_changes'].append({'counter':counter,'statistic':stat,'baseline_ms':x[stat],'candidate_ms':y[stat],
                    'delta_ms_candidate_minus_baseline':y[stat]-x[stat], 'delta_percent':100*(y[stat]/x[stat]-1) if x[stat] else None})
        for d,k in ((b,'baseline_shadow_depths'),(c,'candidate_shadow_depths')):
            row[k]=next((e for e in d['top_gpu_events_by_mean'] if e['name']=='GPU/ShadowDepths'),None)
        rows.append(row)
    report={'classification':'ONE_MATCHED_DIAGNOSTIC_COMPARISON_NOT_OPTIMIZATION_ACCEPTANCE',
            'generated_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'controls_matched':True,
            'baseline_metrics':str(BASE),'baseline_metrics_sha256':sha(BASE),'candidate_metrics':str(candpath),'candidate_metrics_sha256':sha(candpath),
            'candidate_preparation':str(CANDIDATE),'candidate_preparation_sha256':sha(CANDIDATE),'rows':rows,
            'visual_acceptance':False,'rollout_approved':False,'limits':['Single baseline/candidate pair; no robust repeat-run or Shipping claim.',
            'Retain PSO misses, hitches and warnings; no cherry-picked frames or timing from MRQ.',
            'Ordinary uncooked camera workload; no player/combat/vehicle workload.',
            'Three-station stills and a separate moving near/far wind-shadow review are still required.']}
    (out/'COMPARISON.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    lines=['# One matched 1080p diagnostic comparison','', 'No optimization acceptance or rollout is implied. Negative frame-time delta is faster.','',
           '| Scene | Frame median baseline → candidate | Frame p95 baseline → candidate | Mean FPS baseline → candidate |','|---|---|---|---|']
    for r in rows:
        vals={x['statistic']:x for x in r['timing_changes'] if x['counter']=='FrameTime'}
        m,p=vals['median'],vals['p95']
        lines.append('| '+r['scene']+f" | {m['baseline_ms']:.3f} → {m['candidate_ms']:.3f} ms | {p['baseline_ms']:.3f} → {p['candidate_ms']:.3f} ms | {r['baseline_mean_fps']:.2f} → {r['candidate_mean_fps']:.2f} |")
    lines+=['','Full counters, hitch counts, warnings, controls and provenance: COMPARISON.json.','']+report['limits']
    (out/'COMPARISON.md').write_text('\n'.join(lines),encoding='utf-8')
    print('COMPARISON_WRITTEN_NOT_ACCEPTED',str(out))

if __name__=='__main__':main()
