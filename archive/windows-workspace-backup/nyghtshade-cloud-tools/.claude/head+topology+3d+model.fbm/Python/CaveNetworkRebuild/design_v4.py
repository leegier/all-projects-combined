"""Offline route design. Does not touch the Unreal world."""
import json, math, copy
from pathlib import Path
ROOT=Path(__file__).parents[3]/'Saved'/'CaveNetworkRebuild'
old=json.loads((ROOT/'CONNECTED_ROUTE_GEOMETRY_V3.json').read_text())
districts=[
 dict(name='Foundry Entrance',center=[18006,5000,28560],yaw=0,sx=1,sy=1,wave=0),
 dict(name='East Timber Workings',center=[74000,45000,24560],yaw=32,sx=1.27,sy=.80,wave=.10),
 dict(name='Cathedral Fault',center=[124000,-18000,19560],yaw=-21,sx=1.18,sy=.88,wave=.15),
 dict(name='Southern Quarry',center=[55000,-82000,13560],yaw=58,sx=1.08,sy=1.22,wave=.12),
 dict(name='Drowned Western Workings',center=[-28000,-57000,8560],yaw=-37,sx=1.28,sy=.82,wave=.09),
]
for district in districts:district['center'][2]+=14000
def transform(p,level):
 d=districts[level];x,y=p[0]-18006,p[1]-5000;a=math.atan2(y,x)
 k=1+d['wave']*math.sin(3*a+level*.7)+d['wave']*.4*math.cos(5*a-level)
 x*=d['sx']*k;y*=d['sy']*k;r=math.radians(d['yaw'])
 return [d['center'][0]+x*math.cos(r)-y*math.sin(r),d['center'][1]+x*math.sin(r)+y*math.cos(r),d['center'][2]+p[2]-(28560-1800*level)]
segments=[]
for s in old['segments'][:180]:
 n=copy.deepcopy(s);n['a']=transform(s['a'],s['level']);n['b']=transform(s['b'],s['level']);n['source']=s['source'].replace('V3','V4');segments.append(n)
def add(a,b,level,kind,width=680,source=None):
 i=len(segments);segments.append(dict(id=i,a=a,b=b,level=level,kind=kind,width_cm=width,source=source or f'Mine_Drift_Floors_V4_{kind}_{i}'))
def districtnode(level,index):return segments[level*36+index]['a']
ramps=[]
# Endpoints face each other across independent districts. Smooth, long approach curves.
for level,(ia,ib) in enumerate([(2,19),(27,10),(21,6),(16,2)]):
 a=districtnode(level,ia);b=districtnode(level+1,ib)
 ca=districts[level]['center'];cb=districts[level+1]['center']
 def outward(p,c):
  d=[p[0]-c[0],p[1]-c[1]];le=math.hypot(*d);return [v/le for v in d]
 ua=outward(a,ca);ub=outward(b,cb);distance=math.dist(a,b);arm=max(6500,min(18000,distance*.4))
 if level==0:arm=30000
 c1=[a[0]+ua[0]*arm,a[1]+ua[1]*arm];c2=[b[0]+ub[0]*arm,b[1]+ub[1]*arm]
 pts=[]
 for k in range(11):
  t=k/10;v=1-t
  pts.append([v**3*a[j]+3*v*v*t*c1[j]+3*v*t*t*c2[j]+t**3*b[j] for j in range(2)]+[a[2]+(b[2]-a[2])*t])
 total=sum(math.dist(x[:2],y[:2]) for x,y in zip(pts,pts[1:]));travel=0
 for k,p in enumerate(pts):
  if k:travel+=math.dist(pts[k-1][:2],p[:2])
  p[2]=a[2]+(b[2]-a[2])*travel/total
 first=len(segments)
 for x,y in zip(pts,pts[1:]):add(x,y,level,'ramp',720,f'Mine_Drift_Floors_V4_Ramp_{level}')
 ramps.append(list(range(first,len(segments))))
sump_shift=[-46006,-62000,1200]
def shiftsump(p):return [p[j]+sump_shift[j] for j in range(3)]
bottom=districtnode(4,24);approach=shiftsump(old['segments'][220]['b']);sump_start=shiftsump(old['segments'][222]['a'])
add(bottom,approach,4,'sump_link',680,'Mine_Drift_Floors_V4_SumpAccess')
add(approach,sump_start,4,'sump_link',680,'Mine_Drift_Floors_V4_SumpAccess')
for s in old['segments'][222:231]:
 n=copy.deepcopy(s);n['a']=shiftsump(s['a']);n['b']=shiftsump(s['b']);n['id']=len(segments);segments.append(n)
n=copy.deepcopy(old['segments'][231]);n['id']=len(segments);n['a'][2]+=14000;n['b'][2]+=14000;n['source']=n['source'].replace('V3','V4');segments.append(n)
# Three chambers occupy reserved space beyond the districts, not directly above other rooms.
giants=[]
for level,adit,radius,height,title,water in [(1,32,5000,3000,'Lantern Lake',True),(2,33,6500,4200,'Cathedral of Stone',False),(4,32,5500,3400,'Drowned Quarry',True)]:
 s=segments[level*36+adit];a=s['b'];c=districts[level]['center'];v=[a[0]-c[0],a[1]-c[1]];le=math.hypot(*v);v=[x/le for x in v]
 b=[a[0]+v[0]*(radius+6500),a[1]+v[1]*(radius+6500),a[2]]
 add(a,b,level,'cavern_access',720,f'Mine_Drift_Floors_V4_HeroAccess_{level}')
 giants.append(dict(name=title,segment_id=len(segments)-1,center=b,radius=radius,height=height,water=water))
nodes=[]
for s in segments:
 s['ends']=[]
 for p in [s['a'],s['b']]:
  found=next((i for i,n in enumerate(nodes) if math.dist(n,p)<100),None)
  if found is None:found=len(nodes);nodes.append(p)
  s['ends'].append(found)
length=sum(math.dist(s['a'],s['b']) for s in segments)
grades=[math.degrees(math.atan2(abs(s['b'][2]-s['a'][2]),math.dist(s['a'][:2],s['b'][:2]))) for s in segments]
crossings=[]
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
for i,s in enumerate(segments):
 for t in segments[i+1:]:
  if set(s['ends']) & set(t['ends']):continue
  a=s['a'];b=s['b'];c=t['a'];d=t['b'];v=[b[k]-a[k] for k in range(2)];w=[d[k]-c[k] for k in range(2)];q=[c[k]-a[k] for k in range(2)];den=cross(v,w)
  if abs(den)<1e-7:continue
  u=cross(q,w)/den;r=cross(q,v)/den
  if 0<u<1 and 0<r<1:
   dz=abs(a[2]+u*(b[2]-a[2])-c[2]-r*(d[2]-c[2]))
   if dz<1100:crossings.append([s['id'],t['id'],round(dz,1)])
adj=[set() for _ in nodes]
for s in segments:a,b=s['ends'];adj[a].add(b);adj[b].add(a)
seen={0};todo=[0]
while todo:
 for j in adj[todo.pop()]:
  if j not in seen:seen.add(j);todo.append(j)
data=dict(status='V4 design; not yet built or traversal verified',units='cm',districts=districts,segments=segments,nodes=[dict(id=i,position=p) for i,p in enumerate(nodes)],hero_segment_ids=old['hero_segment_ids'],giant_caverns=giants,ramps=ramps,sump_shift=sump_shift,length_cm=length,length_km=length/1e5,length_miles=length/160934.4,max_grade_degrees=max(grades),connected=len(seen)==len(nodes),close_crossings=crossings)
(ROOT/'CONNECTED_ROUTE_GEOMETRY_V4.json').write_text(json.dumps(data,indent=2))
print(json.dumps({k:data[k] for k in ['length_km','length_miles','max_grade_degrees','connected','close_crossings']}))
