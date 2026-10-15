"""Read-only analysis of existing EnvCopy grids. Outputs exclusively beside this script.
Does not import/execute any project script or use Unreal. Coordinates are cm.
"""
import sys
sys.path.insert(0, r'E:/GameDev/Tools/TTS_Kokoro/libs')
import numpy as np
import json, hashlib, math, heapq
from pathlib import Path
from collections import deque, Counter

ROOT=Path(r'E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009')
NAV=ROOT/'_claude_evidence/nav'
OUT=Path(r'E:/_codex_tasks')
PREFIX='envcopy_prison_offline_audit_20261010'
zones_path=ROOT/'_claude_evidence/wf/prison_zones.json'
source=json.loads(zones_path.read_text(encoding='utf-8'))
zones={z['id']:z for z in source['zones']}
grids=[np.load(NAV/f'occ_all_f{i}.npz',allow_pickle=False) for i in range(3)]
x0,y0,c,fz,nx,ny=grids[0]['meta']; nx,ny=int(nx),int(ny)
assert all(np.array_equal(g['meta'][[0,1,2,4,5]],grids[0]['meta'][[0,1,2,4,5]]) for g in grids)
floor=grids[0]['floor'].astype(bool); occ=grids[0]['occ'].astype(bool)
free=floor&~occ

def erode(mask):
    ans=np.zeros_like(mask)
    ans[1:-1,1:-1]=mask[1:-1,1:-1]
    for di,dj in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
        ans[1:-1,1:-1]&=mask[1+di:nx-1+di,1+dj:ny-1+dj]
    return ans

clr=np.zeros(free.shape,np.uint16); cur=free.copy(); k=0
while cur.any():
    k+=1; clr[cur]=k; cur=erode(cur)
ok=clr>=2
labels=np.zeros(ok.shape,np.int32); sizes={}; comp=0
for si,sj in np.argwhere(ok):
    si,sj=int(si),int(sj)
    if labels[si,sj]: continue
    comp+=1; labels[si,sj]=comp; q=deque([(si,sj)]); size=0
    while q:
        i,j=q.popleft(); size+=1
        for a,b in ((i+1,j),(i-1,j),(i,j+1),(i,j-1)):
            if 0<=a<nx and 0<=b<ny and ok[a,b] and labels[a,b]==0:
                labels[a,b]=comp; q.append((a,b))
    sizes[comp]=size

X=x0+(np.arange(nx)+.5)*c; Y=y0+(np.arange(ny)+.5)*c
def bbox_mask(b, margin=0):
    return ((X>=b['x0']+margin)&(X<=b['x1']-margin))[:,None]&((Y>=b['y0']+margin)&(Y<=b['y1']-margin))[None,:]
def xy(p): return [float(X[p[0]]),float(Y[p[1]])]
def info(p,z=140):
    return {'xyz_cm':xy(p)+[float(z)],'grid_ij':[int(p[0]),int(p[1])],
            'component':int(labels[p]),'conservative_grid_edge_clearance_cm':float((int(clr[p])-.5)*c)}
def largest_component(mask):
    vals=labels[mask]; vals=vals[vals>0]
    if not len(vals): return None
    counts=np.bincount(vals); counts[0]=0
    return int(counts.argmax())

# This is only a candidate open column: three sampled bands do not prove every height.
upper_empty=~(grids[1]['floor'].astype(bool)|grids[1]['occ'].astype(bool)|grids[2]['floor'].astype(bool)|grids[2]['occ'].astype(bool))
upper_empty=erode(upper_empty)
atria=[]
for n in range(1,19):
    zid=f'CB{n:02}'; z=zones[zid]; inside=bbox_mask(z['bounds'],200)&ok
    cp=zones[f'CP{n:02}']['bounds']
    enlarged={key: val+(-100 if key.endswith('0') else 100) for key,val in cp.items()}
    inside&=~bbox_mask(enlarged)
    candidate=inside&upper_empty
    chosen_comp=largest_component(candidate)
    if chosen_comp is None:
        atria.append({'zone':zid,'status':'NO_CANDIDATE_IN_EXISTING_GRIDS'}); continue
    candidates=np.argwhere(candidate&(labels==chosen_comp))
    center=np.array(z['centre']); positions=np.column_stack([X[candidates[:,0]],Y[candidates[:,1]]])
    clearance=clr[candidates[:,0],candidates[:,1]].astype(float)
    # Maximize clearance, then prefer closeness to block centre. Never place inside pod.
    scores=clearance*1000-np.linalg.norm(positions-center,axis=1)*.1
    p=tuple(int(v) for v in candidates[scores.argmax()])
    camera_z=float(z['floors'][0]['z'])+160
    rec={'zone':zid,'status':'OFFLINE_CANDIDATE_ONLY','camera':info(p,camera_z),
         'look_at_cm':[float(z['centre'][0]),float(z['centre'][1]),float(z['floors'][2]['z'])+120],
         'eligible_column_cells':int(candidate.sum()),'ground_component_size_cells':sizes[chosen_comp],
         'entrance_gates':[{key:e.get(key) for key in ['door_id','x','y','z','yaw','state','leads_to']} for e in z.get('entrances',[])],
         'notes':['Outside central control-pod bounds plus 100 cm margin.','No floor or occupancy in the two upper sampled grid bands; vertical sightline still requires an editor check.']}
    if n==18: rec['notes'].append('CB18 floor is 0 cm, 20 cm above the f0 grid reference; within raster floor tolerance but not a verified floor trace.')
    atria.append(rec)

def astar(mask,start,end):
    queue=[(0,0,start)]; cost={start:0.0}; came={}; steps=0
    while queue:
        _,g,p=heapq.heappop(queue)
        if g!=cost[p]: continue
        if p==end:
            path=[p]
            while p!=start: p=came[p]; path.append(p)
            return path[::-1]
        i,j=p
        for q in ((i+1,j),(i-1,j),(i,j+1),(i,j-1)):
            a,b=q
            if not(0<=a<nx and 0<=b<ny and mask[q]): continue
            ng=g+1+2/max(1,float(clr[q]))
            if ng<cost.get(q,float('inf')):
                cost[q]=ng; came[q]=p
                h=abs(a-end[0])+abs(b-end[1]); heapq.heappush(queue,(ng+h,ng,q))
    return None

hall_paths=[]
for zid in ['CO089','CO099','CO100','CO041','CO040','CO043','CO001','CO082']:
    z=zones[zid]; mask=ok&bbox_mask(z['bounds'])
    cid=largest_component(mask)
    if cid is None:
        hall_paths.append({'zone':zid,'status':'NO_CONSERVATIVE_FREE_COMPONENT'});continue
    mask&=labels==cid; cells=np.argwhere(mask)
    axis=0 if (z['bounds']['x1']-z['bounds']['x0'])>(z['bounds']['y1']-z['bounds']['y0']) else 1
    low,high=int(cells[:,axis].min()),int(cells[:,axis].max())
    def endcell(edge):
        targets=cells[np.abs(cells[:,axis]-edge)<=2]
        # Deepest clearance at end cap; stay within 80 cm of end of sampled free span.
        vals=clr[targets[:,0],targets[:,1]]
        return tuple(int(v) for v in targets[vals.argmax()])
    start,end=endcell(low),endcell(high)
    path=astar(mask,start,end)
    if not path:
        hall_paths.append({'zone':zid,'status':'NO_PATH_WITHIN_ZONE_BOUNDS','component':cid});continue
    bends=[path[0]]
    for a,b,d in zip(path,path[1:],path[2:]):
        if (b[0]-a[0],b[1]-a[1])!=(d[0]-b[0],d[1]-b[1]):bends.append(b)
    bends.append(path[-1])
    hall_paths.append({'zone':zid,'status':'NUMERIC_GRID_PATH_ONLY','component':cid,
        'length_m':round((len(path)-1)*c/100,2),'minimum_grid_edge_clearance_cm':float((min(int(clr[p]) for p in path)-.5)*c),
        'start':info(path[0]),'end':info(path[-1]),'grid_cells':len(path),
        'xyz_bend_waypoints_cm':[xy(p)+[140.0] for p in bends],
        'conditions':['4-connected grid path stays within this corridor zone and one original occupancy component.','No floor hole filling, door erasure, smoothing or direct segment shortcut.','Render triangles sampled at 40 cm are not physics/navmesh proof.']})

for rec in atria:
    if 'camera' not in rec:continue
    z=zones[rec['zone']]; cid=rec['camera']['component']
    mask=ok&bbox_mask(z['bounds'])&(labels==cid)
    cells=np.argwhere(mask); gate=z['entrances'][0]
    pos=np.column_stack([X[cells[:,0]],Y[cells[:,1]]])
    dist2=np.sum((pos-np.array([gate['x'],gate['y']]))**2,axis=1)
    start=tuple(int(v) for v in cells[dist2.argmin()]); end=tuple(rec['camera']['grid_ij'])
    path=astar(mask,start,end)
    rec['inside_gate_approach']=info(start,rec['camera']['xyz_cm'][2])
    rec['approach_distance_from_gate_cm']=round(float(np.sqrt(dist2.min())),1)
    if path:
        bends=[path[0]]
        for a,b,d in zip(path,path[1:],path[2:]):
            if (b[0]-a[0],b[1]-a[1])!=(d[0]-b[0],d[1]-b[1]):bends.append(b)
        bends.append(path[-1])
        rec['inside_walk_to_atrium']={'status':'NUMERIC_GRID_PATH_ONLY','length_m':round((len(path)-1)*c/100,2),
            'minimum_grid_edge_clearance_cm':float((min(int(clr[p]) for p in path)-.5)*c),
            'xyz_bend_waypoints_cm':[xy(p)+[rec['camera']['xyz_cm'][2]] for p in bends],
            'gate_crossing_included':False}
    else:rec['inside_walk_to_atrium']={'status':'NO_PATH_WITHIN_BLOCK_BOUNDS'}

# Connectivity proposal from the authored zone graph: retains every door's state.
excluded={'yard','guard_tower','control_pod'}
graph={zid:set() for zid,z in zones.items() if z['type'] not in excluded}
for a in graph:
    for b in zones[a].get('connects_to',[]):
        if b in graph:graph[a].add(b);graph[b].add(a)
def graph_path(a,b):
    q=deque([a]);prev={a:None}
    while q:
        p=q.popleft()
        if p==b:
            result=[]
            while p is not None:result.append(p);p=prev[p]
            return result[::-1]
        for nxt in sorted(graph[p]):
            if nxt not in prev:prev[nxt]=p;q.append(nxt)
    return None
targets=['AD01','AD02','AD03','VI01','IN01','ST01','SH17','KI01','CA01','CB17','CB18','JN03','JN04']+[f'CB{n:02}' for n in range(9,17)]+['JN04','CK17','JN01']+[f'CB{n:02}' for n in range(8,0,-1)]
itinerary=[]
for a,b in zip(targets,targets[1:]):
    path=graph_path(a,b)
    edges=[]
    if path:
        for x,y in zip(path,path[1:]):
            gates={}
            for zid,other in [(x,y),(y,x)]:
                for e in zones[zid].get('entrances',[]):
                    if other in e.get('leads_to',[]):gates[e['door_id']]={k:e.get(k) for k in ['door_id','x','y','z','yaw','state']}
            edges.append({'from':x,'to':y,'gates':list(gates.values()),'verification':'GATE_TEST_REQUIRED' if gates else 'GRAPH_ADJACENCY_ONLY'})
    itinerary.append({'from':a,'to':b,'zone_path':path,'edges':edges,'status':'CONDITIONAL_ZONE_GRAPH_PLAN' if path else 'NO_ZONE_GRAPH_PATH'})

files=[zones_path]+[NAV/f'occ_all_f{i}.npz' for i in range(3)]+[NAV/'geo_instances.bin',NAV/'geo_meshes.bin']
inputs=[{'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
counts={}
for variant in ['before','after']:
    fs=list((ROOT/f'_claude_evidence/prisonmat/look_{variant}').glob('*.png'))
    counts[variant]={'frames':len(fs),'bytes':sum(p.stat().st_size for p in fs)}
report={'scope':'OFFLINE READ-ONLY: existing EnvCopy inputs; no Unreal launch, no packages or source evidence changed',
 'root':str(ROOT),'source_grid_meta':grids[0]['meta'].tolist(),'method':{
 'free':'original floor AND NOT original occupancy; no pinhole filling',
 'occupancy_band_cm_above_floor':[35,265],'source':'occupancy.py, render triangle raster, NOT runtime collision',
 'minimum_clearance':'erode all eight neighbours once; every selected centre is >=60 cm from a blocked cell edge in this square-cell model',
 'connectivity':'4-neighbour, zero boundaries, no wraparound',
 'atrial_filter':'Inside CB minus 200 cm perimeter margin, outside CP +100 cm margin, upper f1/f2 floor/occupancy absent with one-cell margin',
 'warning':'Camera-only planning. No proof of floor normal, collision channel, capsule/head clearance, visible framing, lighting, door animation or navigation. Zone bounds themselves are pivot-based +/-1.5 m. Grid construction caps triangle sampling.'},
 'grid_counts':{'raw_free':int(free.sum()),'conservative_free':int(ok.sum()),'components':comp,'largest_components':sorted(sizes.items(),key=lambda p:p[1],reverse=True)[:20]},
 'look_render_counts':counts,'atrium_candidates':atria,'corridor_grid_paths':hall_paths,
 'conditional_itinerary_targets':targets,'conditional_itinerary_legs':itinerary,'inputs':inputs}
dest=OUT/f'{PREFIX}.json';dest.write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'output':str(dest),'grid_counts':report['grid_counts'],
 'look_render_counts':counts,'atria':[{'zone':r['zone'],'camera':r.get('camera'),'status':r['status']} for r in atria],
 'hall_paths':[{k:v for k,v in r.items() if k in ['zone','status','length_m','component','minimum_grid_edge_clearance_cm','grid_cells']} for r in hall_paths],
 'zone_itinerary_missing':[r['from']+' to '+r['to'] for r in itinerary if r['zone_path'] is None]},indent=2))
