"""Offline V5 rail alignment; reads V4 geometry, never imports unreal or edits assets.

Geometric containment is against documented floor/room footprints, not dressed
mesh collision. Installation must sweep carts and adjust props, floor height,
wheel contact, and streaming in the actual map before declaring playability.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).parents[3] / 'Saved' / 'CaveNetworkRebuild'
V4 = json.loads((ROOT / 'CONNECTED_ROUTE_GEOMETRY_V4.json').read_text())
EDGES = V4['segments']
LANE = 110.0
HALF_SLEEPER = 150.2133331298828 * 1.3 / 2
STEP = 125.0
TURN_RADIUS = 450.0
TERMINAL_TRIM = 900.0


def add(a, b): return [a[i] + b[i] for i in range(3)]
def sub(a, b): return [a[i] - b[i] for i in range(3)]
def mul(a, s): return [q * s for q in a]
def mix(a, b, t): return add(mul(a, 1-t), mul(b, t))
def unit(a): return mul(a, 1 / math.sqrt(sum(q*q for q in a)))
def xyunit(a): return [a[0]/math.hypot(a[0], a[1]), a[1]/math.hypot(a[0], a[1]), 0]
def right(a): return [-a[1], a[0], 0]
def dot(a, b): return sum(x*y for x, y in zip(a, b))
def dist(a, b): return math.dist(a, b)


nodes = [dict(p=n['position'], links=[]) for n in V4['nodes']]
for e in EDGES:
    for i in e['ends']: nodes[i]['links'].append(e)
hero_nodes = {EDGES[i]['ends'][1] for i in V4['hero_segment_ids']}
rooms = []
for i, n in enumerate(nodes):
    dirs = []
    for e in n['links']:
        other = e['ends'][1] if e['ends'][0] == i else e['ends'][0]
        dirs.append(unit(sub(nodes[other]['p'], n['p'])))
    if len(dirs) != 2 or dot(dirs[0], dirs[1]) > -.985 or i in hero_nodes:
        radius=1500.0 if i in hero_nodes else 620.0
        rim=[]
        for j in range(64):
            angle=2*math.pi*j/64;rx,ry=math.cos(angle),math.sin(angle)
            weights=[max(0,rx*d[0]+ry*d[1])**8 for d in dirs];sw=sum(weights)
            z=sum(w*d[2]/max(.01,math.hypot(d[0],d[1]))*(radius+180) for w,d in zip(weights,dirs))/sw if sw>.001 else 0
            rim.append([rx*(radius+180),ry*(radius+180),z])
        rooms.append(dict(id=i, p=n['p'], radius=radius,rim=rim))


def structural_floor_z(p):
    """Reproduce V4 plane/fan structural tops; imported surface art not queried."""
    heights=[]
    for room in rooms:
        cx,cy,cz=room['p'];x,y=p[0]-cx,p[1]-cy
        if abs(cz-p[2])>500 or math.hypot(x,y)>room['radius']+180:continue
        j=int((math.atan2(y,x)%(2*math.pi))/(2*math.pi/64))%64
        a,b=room['rim'][j],room['rim'][(j+1)%64]
        den=a[0]*b[1]-a[1]*b[0]
        u=(x*b[1]-y*b[0])/den;v=(a[0]*y-a[1]*x)/den
        if u+v<=1.000001:heights.append(cz+u*a[2]+v*b[2])
    for e in EDGES:
        if e['kind'] not in ('ring','ramp','entry'):continue
        a,b=e['a'],e['b'];dx,dy=b[0]-a[0],b[1]-a[1];le=math.hypot(dx,dy)
        t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(le*le)
        lateral=abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/le
        z=a[2]+t*(b[2]-a[2])
        if -15/le<=t<=1+15/le and lateral<=e['width_cm']/2 and abs(z-p[2])<500:heights.append(z)
    return max(heights) if heights else p[2]


def covered(p):
    """Point footprint coverage; excludes other storeys via 5 m Z proximity."""
    for room in rooms:
        if abs(room['p'][2]-p[2]) < 500 and math.dist(p[:2], room['p'][:2]) <= room['radius']-8:
            return True
    for e in EDGES:
        if e['kind'] not in ('ring', 'ramp', 'entry'): continue
        a, b = e['a'], e['b']; dx, dy = b[0]-a[0], b[1]-a[1]
        t = ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)
        end_extra = 15/math.hypot(dx,dy)
        if -end_extra <= t <= 1+end_extra:
            z = a[2]+t*(b[2]-a[2])
            lateral = abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/math.hypot(dx,dy)
            if abs(z-p[2]) < 500 and lateral < e['width_cm']/2-8: return True
    return False


def envelope_covered(p, tangent):
    r = right(xyunit(tangent)); f = xyunit(tangent)
    # Sleepers and front/rear corners of a conservative 2.10 m x 1.45 m cart.
    for side in (-1, 1):
        if not covered(add(p, mul(r, side*(LANE+HALF_SLEEPER)))): return False
        for cross in (LANE-72.5, LANE+72.5):
            for fore in (-105,105):
                if not covered(add(add(p,mul(r,side*cross)),mul(f,fore))): return False
    return True


# 32 ring segments per district. Deliberately longer arcs give broad coverage;
# side workings, lakes, giant cavern approaches, and mandatory sump stay rail-free.
choices = [(20,2,1), (19,27,-1), (10,21,-1), (6,16,-1), (2,20,1)]
points, edge_ids, district_spans = [], [], []
for level, (a,b,step) in enumerate(choices):
    begin = len(points); i = a
    while i != b:
        j = (i+step)%32
        e = EDGES[level*36+(i if step==1 else j)]
        points.append(list(e['a'] if step==1 else e['b']))
        edge_ids.append(e['id']); i=j
    district_spans.append(dict(level=level, start_vertex=begin, end_vertex=len(points), start_ring_node=a, end_ring_node=b, direction=step))
    if level < 4:
        for si in V4['ramps'][level]: points.append(list(EDGES[si]['a'])); edge_ids.append(si)
    else: points.append(list(EDGES[level*36+b]['a']))

first_room, last_room = list(points[0]), list(points[-1])
first_dir = xyunit(sub(points[1],points[0])); last_dir=xyunit(sub(points[-1],points[-2]))
points[0] = add(points[0],mul(first_dir,TERMINAL_TRIM))
points[-1] = sub(points[-1],mul(last_dir,TERMINAL_TRIM))


def fillet(index, radius):
    a,p,b=points[index-1:index+2]
    u,v=xyunit(sub(p,a)),xyunit(sub(b,p))
    theta=math.acos(max(-1,min(1,dot(u,v))))
    sign=1 if u[0]*v[1]-u[1]*v[0] > 0 else -1
    trim=radius*math.tan(theta/2)
    if trim > min(math.dist(a[:2],p[:2]),math.dist(p[:2],b[:2]))*.85: return None
    start=mix(p,a,trim/math.dist(a[:2],p[:2])); end=mix(p,b,trim/math.dist(p[:2],b[:2]))
    c=add(start,mul(right(u),sign*radius)); start_angle=math.atan2(start[1]-c[1],start[0]-c[0])
    count=max(4,math.ceil(radius*theta/50))
    samples=[]
    for k in range(count+1):
        t=k/count;ang=start_angle+sign*theta*t
        q=[c[0]+radius*math.cos(ang),c[1]+radius*math.sin(ang),start[2]+(end[2]-start[2])*t]
        tangent=[-sign*math.sin(ang),sign*math.cos(ang),(end[2]-start[2])/(radius*theta)]
        if not envelope_covered(q,tangent): return None
        samples.append((q,unit(tangent)))
    return dict(vertex=index, radius_cm=radius, angle_degrees=math.degrees(theta), trim_cm=trim, start=start,end=end,samples=samples)


corners={}; unresolved=[]
for i in range(1,len(points)-1):
    u=xyunit(sub(points[i],points[i-1]));v=xyunit(sub(points[i+1],points[i]))
    theta=math.degrees(math.acos(max(-1,min(1,dot(u,v)))))
    if theta < .1: continue
    chosen=None
    for radius in range(5000,409,-25):
        chosen=fillet(i,radius)
        if chosen:break
    if chosen:corners[i]=chosen
    else:unresolved.append(dict(vertex=i,point=points[i],angle_degrees=theta,edges=edge_ids[max(0,i-1):i+1]))
for i in range(len(points)-1):
    available = math.dist(points[i][:2],points[i+1][:2])-80
    while sum(corners[k]['trim_cm'] for k in (i,i+1) if k in corners) > available:
        choices_to_shrink = sorted((k for k in (i,i+1) if k in corners and corners[k]['radius_cm']>425),key=lambda k:corners[k]['trim_cm'],reverse=True)
        shrunk=False
        for k in choices_to_shrink:
            for radius in range(int(corners[k]['radius_cm']-25),409,-25):
                c=fillet(k,radius)
                if c:corners[k]=c;shrunk=True;break
            if shrunk:break
        if not shrunk:
            unresolved.append(dict(vertex=i,reason='adjacent fillet trims exceed segment length',edge=edge_ids[i]));break
if unresolved:
    (ROOT/'RAIL_NETWORK_V5_FAILED.json').write_text(json.dumps(dict(unresolved=unresolved),indent=2))
    raise RuntimeError('No safe room-contained fillet for %d vertices; see failure report'%len(unresolved))


center=[]
def append(q,t,kind,edge=None,radius=None):
    if center and dist(center[-1]['p'],q)<.001:return
    center.append(dict(p=q,t=unit(t),kind=kind,source_edge_id=edge,curve_radius_cm=radius))
for i in range(len(points)-1):
    start=corners[i]['end'] if i in corners else points[i]
    end=corners[i+1]['start'] if i+1 in corners else points[i+1]
    tangent=unit(sub(end,start));count=max(1,math.ceil(dist(start,end)/STEP))
    for k in range(count+1):append(mix(start,end,k/count),tangent,'straight',edge_ids[i])
    if i+1 in corners:
        c=corners[i+1]
        for q,t in c['samples']:append(q,t,'curve',edge_ids[i],c['radius_cm'])


def lane_rows(sign,reverse=False):
    result=[]
    for row in (reversed(center) if reverse else center):
        r=right(xyunit(row['t']));q=add(row['p'],mul(r,sign*LANE))
        result.append(dict(position_cm=q,tangent_unit=mul(row['t'],-1 if reverse else 1),section='return' if reverse else 'outgoing',source_edge_id=row['source_edge_id'],curve_radius_cm=row['curve_radius_cm']))
    return result


def terminal(room,forward,name):
    r=right(forward);result=[]
    def emit(x,y,tx,ty):
        q=add(add(room,mul(forward,x)),mul(r,y));t=unit(add(mul(forward,tx),mul(r,ty)))
        result.append(dict(position_cm=q,tangent_unit=t,section=name,source_edge_id=None,curve_radius_cm=None))
    # Cubic approaches expand the 2.2 m parallel-lane spacing to a 9 m diameter
    # circle wholly inside the existing 30 m hero room.
    def bezier(ps):
        for k in range(31):
            t=k/30;s=1-t
            x=sum(w*p[0] for w,p in zip((s**3,3*s*s*t,3*s*t*t,t**3),ps))
            y=sum(w*p[1] for w,p in zip((s**3,3*s*s*t,3*s*t*t,t**3),ps))
            tx=sum(w*(ps[j+1][0]-ps[j][0]) for j,w in enumerate((3*s*s,6*s*t,3*t*t)))
            ty=sum(w*(ps[j+1][1]-ps[j][1]) for j,w in enumerate((3*s*s,6*s*t,3*t*t)))
            emit(x,y,tx,ty)
    bezier([(-900,LANE),(-450,LANE),(-450,TURN_RADIUS),(0,TURN_RADIUS)])
    for k in range(1,41):
        a=math.pi/2-math.pi*k/40
        emit(TURN_RADIUS*math.cos(a),TURN_RADIUS*math.sin(a),math.sin(a),-math.cos(a))
    bezier([(0,-TURN_RADIUS),(-450,-TURN_RADIUS),(-450,-LANE),(-900,-LANE)])
    return result


route=[]
for part in (lane_rows(1),terminal(last_room,last_dir,'lower_turnaround'),lane_rows(-1,True),terminal(first_room,mul(first_dir,-1),'upper_turnaround')):
    for row in part:
        if route and dist(route[-1]['position_cm'],row['position_cm'])<.001:continue
        route.append(row)
if dist(route[-1]['position_cm'],route[0]['position_cm'])<.001:route.pop()
# Raise-only grade envelope prevents the generated railbed from cutting existing
# floors. Limits are reported rather than silently clipping to a false 30 cm cap.
original_z=[r['position_cm'][2] for r in route]
floor_z=[structural_floor_z(r['position_cm']) for r in route]
bed_z=floor_z[:];n=len(route)
height_limits=[math.dist(route[i]['position_cm'][:2],route[(i+1)%n]['position_cm'][:2])*math.tan(math.radians(9)) for i in range(n)]
for sweep in range(3):
    for i in range(n):
        j=(i+1)%n;bed_z[j]=max(bed_z[j],bed_z[i]-height_limits[i])
    for i in range(n-1,-1,-1):
        j=(i+1)%n;bed_z[i]=max(bed_z[i],bed_z[j]-height_limits[i])
for i,row in enumerate(route):
    row['original_datum_z_cm']=round(original_z[i],4)
    row['structural_floor_z_cm']=round(floor_z[i],4)
    row['railbed_lift_cm']=round(bed_z[i]-floor_z[i],4)
    row['z_lift_cm']=row['railbed_lift_cm']
    row['position_cm'][2]=bed_z[i]
height_audit=dict(method='Exact source V4 structural plane/fan formula, followed by raise-only 9 degree grade envelope. Actual imported art/collision traces still needed.',max_grade_degrees=9.0,max_railbed_lift_cm=max(z-f for z,f in zip(bed_z,floor_z)),min_railbed_lift_cm=min(z-f for z,f in zip(bed_z,floor_z)),samples_above_30cm=sum(z-f>30 for z,f in zip(bed_z,floor_z)),requires_raised_bed_exception=any(z-f>30 for z,f in zip(bed_z,floor_z)))
length=0
for i,row in enumerate(route):
    if i:length+=dist(route[i-1]['position_cm'],row['position_cm'])
    row['distance_cm']=length
    for k in ('position_cm','tangent_unit'):row[k]=[round(x,6) for x in row[k]]
length+=dist(route[-1]['position_cm'],route[0]['position_cm'])
for i,row in enumerate(route):
    a=route[(i-1)%len(route)]['position_cm'];p=row['position_cm'];b=route[(i+1)%len(route)]['position_cm']
    u=unit(sub(p,a));v=unit(sub(b,p))
    row['tangent_unit']=[round(x,7) for x in unit(add(u,v))]
    cross=abs((p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0]))
    radius=(math.dist(a[:2],p[:2])*math.dist(p[:2],b[:2])*math.dist(a[:2],b[:2])/(2*cross)) if cross>1e-5 else None
    row['geometry_kind']='curve' if (row['curve_radius_cm'] is not None or 'turnaround' in row['section']) else 'straight'
    row['centerline_curve_radius_cm']=row['curve_radius_cm']
    row['curve_radius_cm']=round(radius,3) if radius is not None else None

stations=[]
for level,d in enumerate(V4['districts']):
    candidates=[(i,r) for i,r in enumerate(route) if r['section']=='outgoing' and r['source_edge_id'] is not None and EDGES[r['source_edge_id']]['level']==level and EDGES[r['source_edge_id']]['kind']=='ring' and r['geometry_kind']=='straight']
    # Select the longest straight section for stopping/boarding; new platform
    # dressing must retain the 70 cm diameter player capsule's usable pavement.
    best=max(candidates,key=lambda ir:EDGES[ir[1]['source_edge_id']]['length_cm'])
    same=[ir for ir in candidates if ir[1]['source_edge_id']==best[1]['source_edge_id']]
    i,r=same[len(same)//2];q=r['position_cm'];t=r['tangent_unit'];ped=add(q,mul(right(xyunit(t)),145))
    j,rr=min(((j,s) for j,s in enumerate(route) if s['section']=='return'),key=lambda js:dist(js[1]['position_cm'],q))
    stations.append(dict(id='station_%d'%level,name=d['name'],district=level,outgoing_sample=i,outgoing_distance_cm=r['distance_cm'],return_sample=j,return_distance_cm=rr['distance_cm'],outgoing_cart_stop_cm=q,proposed_outer_boarding_cm=ped,source_edge_id=r['source_edge_id'],status='layout_only_needs_actual_capsule_sweep_and_art_clearance'))
for name,level,index in [('Foundry Cart Depot',0,0),('Deep Mine Turnaround',4,next(i for i,r in enumerate(route) if r['section']=='lower_turnaround')+50)]:
    row=route[index];t=xyunit(row['tangent_unit']);q=row['position_cm']
    stations.append(dict(id='depot' if level==0 else 'deep_terminus',name=name,district=level,outgoing_sample=index,outgoing_distance_cm=row['distance_cm'],return_sample=index,return_distance_cm=row['distance_cm'],single_shared_stop=True,outgoing_cart_stop_cm=q,proposed_outer_boarding_cm=add(q,mul(right(t),145)),source_edge_id=row['source_edge_id'],status='layout_only_needs_actual_capsule_sweep_and_art_clearance'))

# Verify lateral envelope of the complete circuit, including every terminal.
bad=[]
for i,row in enumerate(route):
    p=row['position_cm'];t=xyunit(row['tangent_unit']);r=right(t)
    if any(not covered(add(p,mul(r,s*HALF_SLEEPER))) for s in (-1,1)):bad.append(i)
result=dict(schema='MineRailNetworkV5.1',status='offline_alignment_only_not_installed_or_runtime_tested',units='cm',source_geometry='CONNECTED_ROUTE_GEOMETRY_V4.json',closed_loop=True,lane_offset_cm=LANE,sleeper_half_width_cm=HALF_SLEEPER,proposed_track_scale_y=1.3,proposed_track_scale_z=.48,proposed_rail_base_lift_cm=2.1,centerline_length_km=sum(dist(a['p'],b['p']) for a,b in zip(center,center[1:]))/1e5,circuit_length_km=length/1e5,circuit_length_cm=length,source_edge_ids=edge_ids,ring_segments_served=sum(EDGES[i]['kind']=='ring' for i in edge_ids),ramp_segments_served=sum(EDGES[i]['kind']=='ramp' for i in edge_ids),district_spans=district_spans,stations=stations,turnaround_rooms=[dict(center=first_room,radius_cm=1500),dict(center=last_room,radius_cm=1500)],minimum_centerline_curve_radius_cm=min(c['radius_cm'] for c in corners.values()),minimum_offset_curve_radius_cm=min(c['radius_cm'] for c in corners.values())-LANE,unresolved_corners=unresolved,footprint_failures=bad,validation=dict(scope='Source geometric footprints only. No actual dressed-mesh collision, headroom, railhead contact, railbed height, or runtime validation yet.',water_sump_edges_included=[i for i in edge_ids if EDGES[i]['kind'].startswith('sump')],all_five_districts=True,all_four_descents=True,turnarounds_within_hero_rooms=True,source_floor_width_min_cm=min(EDGES[i]['width_cm'] for i in edge_ids),nominal_outer_pedestrian_width_min_cm=300-LANE-HALF_SLEEPER),installation_notes=['Use these positions and tangents as a SINGLE source for the runtime spline and visible spline-mesh rail sections.','Runtime spline and visuals must share exact spline interpolation; do not animate carts along raw V4 polygon corners.','Do not place rails across sump, swim passage, new lakes, collapsed adits, or creature fissures.','Source rail forward axis is X; vehicle cart source forward axis appears Y and requires relative yaw correction.','Approximate datum Z is preserved here; trace each railbed against actual floor geometry and inspect slope transitions before final installation.','Station coordinates are suggested stopping locations, not preapproved safe exit transforms. Sweep actual player capsule and move decorative props locally.','All route/control actors needed by occupied carts must persist; near-cart streaming source and readiness guard are needed before entering unloaded art.','Reserve blocks or enforce headway between carts. Automatic service must yield to a manually controlled cart on the same lane.'],samples=route)
(ROOT/'RAIL_NETWORK_V5.json').write_text(json.dumps(result,separators=(',',':')))
result['height_audit']=height_audit
result['physical_stop_count']=12
(ROOT/'RAIL_NETWORK_V5.json').write_text(json.dumps(result,separators=(',',':')))
summary={k:result[k] for k in ('status','centerline_length_km','circuit_length_km','ring_segments_served','ramp_segments_served','minimum_centerline_curve_radius_cm','minimum_offset_curve_radius_cm','footprint_failures')}
summary['sample_count']=len(route)
summary['height_audit']=height_audit
(ROOT/'RAIL_NETWORK_V5_SUMMARY.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary))
