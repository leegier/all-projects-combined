# mine_build.py - procedural Old Mine network builder v2 (MyProject2)
import unreal, math, random, json, os

BASE_X = 4006.0
BASE_Y = -745.0
BAND_Z = [28200.0, 26400.0, 24600.0, 22800.0, 21000.0]
CELL = 4000.0
ROOT_LABEL = "Blockout_MineNetwork"
REPORT = r"C:/Users/Gierl/Documents/Unreal Projects/MyProject2/Saved/CaveNetworkRebuild"

M_CAVE = "/Game/Scene_OldMine/Assets/SM_Ind_Min_Cave"
M_TUNNEL = "/Game/RockEnv_Pack/Meshes/Tunnel_Caves/SM_Tunnel_Cave_10"


def V(x, y, z):
    return unreal.Vector(float(x), float(y), float(z))

def sub(a, b):
    return V(a.x - b.x, a.y - b.y, a.z - b.z)

def add(a, b):
    return V(a.x + b.x, a.y + b.y, a.z + b.z)

def mul(a, s):
    return V(a.x * s, a.y * s, a.z * s)

def mid(a, b):
    return V((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5)

def dist(a, b):
    d = sub(a, b)
    return math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z)


def look_rot(p0, p1):
    d = sub(p1, p0)
    L = math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z)
    if L < 1e-4:
        return unreal.Rotator(0.0, 0.0, 0.0)
    yaw = math.degrees(math.atan2(d.y, d.x))
    pitch = math.degrees(math.asin(max(-1.0, min(1.0, d.z / L))))
    return unreal.Rotator(pitch, yaw, 0.0)


def rightv(rot):
    cy = math.cos(math.radians(rot.yaw)); sy = math.sin(math.radians(rot.yaw))
    return V(-sy, cy, 0.0)


def upv(rot):
    cp = math.cos(math.radians(rot.pitch)); sp = math.sin(math.radians(rot.pitch))
    cy = math.cos(math.radians(rot.yaw)); sy = math.sin(math.radians(rot.yaw))
    return V(-sp * cy, -sp * sy, cp)


def _eas():
    return unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def get_root():
    for a in _eas().get_all_level_actors():
        if a.get_actor_label() == ROOT_LABEL:
            return a
    r = _eas().spawn_actor_from_class(unreal.Actor, V(0, 0, 0))
    r.set_actor_label(ROOT_LABEL)
    return r


def load_asset(path):
    nm = path.rsplit("/", 1)[-1]
    for p in (path, path + "." + nm):
        for fn in (unreal.EditorAssetLibrary.load_asset, unreal.load_asset):
            try:
                a = fn(p)
            except Exception:
                a = None
            if a is not None:
                return a
    return None


def mat_of(path, slot=0):
    sm = load_asset(path)
    if sm is None:
        print("MAT_MISSING", path)
        return None
    try:
        mats = sm.get_editor_property("static_materials")
        if mats and len(mats) > slot:
            return mats[slot].get_editor_property("material_interface")
    except Exception as e:
        print("MAT_ERR", path, str(e))
    return None


def backup_material(name_hint):
    for a in _eas().get_all_level_actors():
        if a.get_actor_label().startswith("BACKUP_Mine_"):
            for c in a.get_components_by_class(unreal.DynamicMeshComponent):
                for i in range(c.get_num_materials()):
                    m = c.get_material(i)
                    if m and name_hint in m.get_name():
                        return m
    return None


def get_mats():
    rock = mat_of(M_CAVE)
    floor = mat_of(M_TUNNEL)
    if rock is None:
        rock = backup_material("MIC_Wall")
    if floor is None:
        floor = backup_material("MIC_Walkable")
    if floor is None:
        floor = rock
    print("MATS rock=%s floor=%s" % (rock.get_name() if rock else "none", floor.get_name() if floor else "none"))
    return rock, floor


def spawn_dm(label, parent):
    a = _eas().spawn_actor_from_class(unreal.DynamicMeshActor, V(0, 0, 0))
    a.set_actor_label(label)
    try:
        a.attach_to_actor(parent, "", unreal.AttachmentRule.KEEP_RELATIVE,
                          unreal.AttachmentRule.KEEP_RELATIVE,
                          unreal.AttachmentRule.KEEP_RELATIVE, False)
    except Exception as e:
        print("ATTACH_ERR", label, str(e))
    comp = a.get_editor_property("dynamic_mesh_component")
    return a, comp, comp.get_dynamic_mesh()


def finish(comp, dm, mat):
    if mat is not None:
        try:
            comp.set_material(0, mat)
        except Exception as e:
            print("SETMAT_ERR", str(e))
    try:
        opts = unreal.GeometryScriptCollisionFromMeshOptions()
        unreal.GeometryScript_Collision.set_dynamic_mesh_collision_from_mesh(dm, comp, opts)
    except Exception as e:
        print("COL_ERR", str(e))
    try:
        comp.notify_mesh_modified()
    except Exception:
        pass


def abox(dm, loc, rot, dx, dy, dz):
    t = unreal.Transform(location=loc, rotation=rot, scale=V(1, 1, 1))
    unreal.GeometryScript_Primitives.append_box(
        dm, unreal.GeometryScriptPrimitiveOptions(), t,
        float(dx), float(dy), float(dz), 0, 0, 0,
        unreal.GeometryScriptPrimitiveOriginMode.CENTER)


def _step(rng, occ, x, y, heading, z, tz):
    for attempt in range(10):
        h = heading + rng.uniform(-22.0, 22.0)
        dx, dy = x - BASE_X, y - BASE_Y
        d = math.hypot(dx, dy)
        if d > 24000.0:
            toward = math.degrees(math.atan2(-dy, -dx))
            h = h * 0.5 + toward * 0.5
        L = rng.uniform(4500.0, 7500.0)
        nx = x + L * math.cos(math.radians(h))
        ny = y + L * math.sin(math.radians(h))
        cells = []
        ok = True
        for t in (0.4, 0.7, 1.0):
            px, py = x + (nx - x) * t, y + (ny - y) * t
            c = (int(px // CELL), int(py // CELL))
            if c in occ:
                ok = False
                break
            cells.append(c)
        if not ok:
            heading = h + 45.0
            continue
        for c in cells:
            occ.add(c)
        dz = max(-900.0, min(900.0, tz - z))
        return nx, ny, h, z + dz, L
    h = heading + 180.0 + rng.uniform(-25.0, 25.0)
    L = 5000.0
    nx = x + L * math.cos(math.radians(h))
    ny = y + L * math.sin(math.radians(h))
    occ.add((int(nx // CELL), int(ny // CELL)))
    return nx, ny, h, z, L


def gen_routes(seed=1337):
    rng = random.Random(seed)
    occ = set()
    segs = []
    cav = []
    branch_ends = []
    x, y = BASE_X - 12000.0, BASE_Y - 8000.0
    heading = 10.0
    z = BAND_Z[0]
    idx = 0
    for band in range(5):
        n = 32 - band * 2
        for i in range(n):
            z0 = z
            tz = BAND_Z[band] + 220.0 * math.sin(idx * 0.35)
            nx, ny, heading, z, L = _step(rng, occ, x, y, heading, z, tz)
            w = 380.0 + 200.0 * (0.5 + 0.5 * math.sin(idx * 0.5)) + rng.uniform(-40.0, 40.0)
            hgt = 360.0 + 150.0 * (0.5 + 0.5 * math.cos(idx * 0.41)) + rng.uniform(-30.0, 30.0)
            segs.append({"p0": [x, y, z0], "p1": [nx, ny, z], "w": w, "h": hgt, "band": band})
            x, y = nx, ny
            idx += 1
            if idx % 22 == 0:
                cav.append([x, y, z])
        if band < 4:
            for k in range(6):
                z0 = z
                nx, ny, heading, z, L = _step(rng, occ, x, y, heading, z, BAND_Z[band + 1])
                segs.append({"p0": [x, y, z0], "p1": [nx, ny, z], "w": 440.0, "h": 430.0, "band": band})
                x, y = nx, ny
                idx += 1
    for bi in range(6):
        si = 26 + bi * 26
        if si >= len(segs):
            si = len(segs) - 1
        b = segs[si]
        bx, by, bz = b["p1"]
        hh = math.degrees(math.atan2(b["p1"][1] - b["p0"][1], b["p1"][0] - b["p0"][0])) + 90.0 + rng.uniform(-30.0, 30.0)
        for k in range(7):
            z0 = bz
            nx, ny, hh, bz, L = _step(rng, occ, bx, by, hh, bz, bz - 220.0 * (k + 1))
            segs.append({"p0": [bx, by, z0], "p1": [nx, ny, bz], "w": 400.0, "h": 370.0, "band": -1})
            bx, by = nx, ny
        branch_ends.append([bx, by, bz])
    return {"segs": segs, "cav": cav, "branch_ends": branch_ends}


def route_length(segs):
    t = 0.0
    for s in segs:
        t += dist(V(*s["p0"]), V(*s["p1"]))
    return t


def build_shell(data, root, sec=12):
    segs = data["segs"]
    m_rock, m_coarse = get_mats()
    rng = random.Random(4242)
    made = []
    for si in range(0, len(segs), sec):
        chunk = segs[si:si + sec]
        wa, wc, wd = spawn_dm("Mine_Drift_Walls_%02d" % (si // sec), root)
        fa, fc, fd = spawn_dm("Mine_Drift_Floors_%02d" % (si // sec), root)
        for s in chunk:
            p0 = V(*s["p0"]); p1 = V(*s["p1"])
            L = dist(p0, p1)
            rot = look_rot(p0, p1)
            m = mid(p0, p1)
            r = rightv(rot); u = upv(rot)
            w = s["w"]; hgt = s["h"]
            abox(fd, sub(m, mul(u, 30.0)), rot, L + 80.0, w + 160.0, 60.0)
            abox(wd, add(m, mul(u, hgt + 30.0)), rot, L + 80.0, w + 180.0, 70.0)
            abox(wd, add(add(m, mul(r, -(w * 0.5 + 40.0))), mul(u, hgt * 0.5)), rot, L + 80.0, 80.0, hgt + 120.0)
            abox(wd, add(add(m, mul(r, (w * 0.5 + 40.0))), mul(u, hgt * 0.5)), rot, L + 80.0, 80.0, hgt + 120.0)
            for k in range(3):
                t = rng.uniform(0.05, 0.95)
                q = add(mul(p0, 1.0 - t), mul(p1, t))
                side = -1.0 if (k % 2 == 0) else 1.0
                off = mul(r, side * (w * 0.5 + rng.uniform(10.0, 70.0)))
                zoff = V(0, 0, rng.uniform(60.0, max(90.0, hgt - 80.0)))
                jr = unreal.Rotator(rot.pitch, rot.yaw + rng.uniform(-25.0, 25.0), 0.0)
                abox(wd, add(add(q, off), zoff), jr,
                     rng.uniform(160.0, 420.0), rng.uniform(90.0, 200.0), rng.uniform(160.0, 420.0))
        finish(wc, wd, m_rock)
        finish(fc, fd, m_coarse)
        made.append(wa.get_actor_label())
        made.append(fa.get_actor_label())
    return made


def build_caverns(data, root, seed=99):
    rng = random.Random(seed)
    m_rock, m_coarse = get_mats()
    pts = []
    for s in data["segs"]:
        pts.append(V(*s["p0"]))
        pts.append(V(*s["p1"]))
    made = []
    for ci, node in enumerate(data["cav"]):
        c = V(*node)
        R = rng.uniform(1500.0, 2600.0)
        H = rng.uniform(950.0, 1650.0)
        wa, wc, wd = spawn_dm("Mine_Cavern_Walls_%02d" % ci, root)
        fa, fc, fd = spawn_dm("Mine_Cavern_Floors_%02d" % ci, root)
        abox(fd, V(c.x, c.y, c.z - 30.0), unreal.Rotator(0, 0, 0), 2 * R + 400.0, 2 * R + 400.0, 60.0)
        abox(wd, V(c.x, c.y, c.z + H + 30.0), unreal.Rotator(0, 0, 0), 2 * R + 400.0, 2 * R + 400.0, 60.0)
        n = 14
        rad = [R * rng.uniform(0.72, 1.15) for _ in range(n)]
        ang = [2.0 * math.pi * i / n for i in range(n)]
        for i in range(n):
            a0 = ang[i]; a1 = ang[(i + 1) % n]
            p0 = V(c.x + math.cos(a0) * rad[i], c.y + math.sin(a0) * rad[i], c.z)
            p1 = V(c.x + math.cos(a1) * rad[(i + 1) % n], c.y + math.sin(a1) * rad[(i + 1) % n], c.z)
            em = mid(p0, p1)
            near = False
            for q in pts:
                if dist(q, em) < 800.0:
                    near = True
                    break
            if near:
                continue
            rot = look_rot(p0, p1)
            L = dist(p0, p1)
            rv = rightv(rot)
            abox(wd, add(add(em, mul(rv, 40.0)), V(0, 0, H * 0.5)), rot, L + 140.0, 80.0, H + 120.0)
            abox(wd, add(add(em, mul(rv, -90.0)), V(0, 0, H * 0.35)), rot,
                 rng.uniform(300.0, 700.0), rng.uniform(150.0, 300.0), rng.uniform(300.0, 700.0))
        finish(wc, wd, m_rock)
        finish(fc, fd, m_coarse)
        made.append(wa.get_actor_label())
        made.append(fa.get_actor_label())
    return made


def build_sump(data, root):
    m_rock, m_coarse = get_mats()
    mains = [s for s in data["segs"] if s["band"] == 4]
    last = mains[-1]
    E = V(*last["p1"])
    yaw = math.degrees(math.atan2(last["p1"][1] - last["p0"][1], last["p1"][0] - last["p0"][0]))
    WL = 20850.0
    prof = [(0.0, 21000.0), (6000.0, 21000.0), (12000.0, 20850.0), (18000.0, 20650.0),
            (20000.0, 20420.0), (22000.0, 20400.0), (24000.0, 20420.0), (30000.0, 20650.0),
            (36000.0, 20850.0), (42000.0, 21000.0)]
    cy = math.cos(math.radians(yaw)); sy = math.sin(math.radians(yaw))
    pts = [V(E.x + d * cy, E.y + d * sy, z) for d, z in prof]
    wa, wc, wd = spawn_dm("Sump_Walls", root)
    fa, fc, fd = spawn_dm("Sump_Floors", root)
    W = 460.0; H = 420.0
    for i in range(len(pts) - 1):
        p0, p1 = pts[i], pts[i + 1]
        L = dist(p0, p1); rot = look_rot(p0, p1); m = mid(p0, p1)
        r = rightv(rot); u = upv(rot)
        abox(fd, sub(m, mul(u, 30.0)), rot, L + 80.0, W + 160.0, 60.0)
        abox(wd, add(m, mul(u, H + 30.0)), rot, L + 80.0, W + 180.0, 70.0)
        abox(wd, add(add(m, mul(r, -(W * 0.5 + 40.0))), mul(u, H * 0.5)), rot, L + 80.0, 80.0, H + 140.0)
        abox(wd, add(add(m, mul(r, (W * 0.5 + 40.0))), mul(u, H * 0.5)), rot, L + 80.0, 80.0, H + 140.0)
    finish(wc, wd, m_rock)
    finish(fc, fd, m_coarse)
    length = 0.0
    for i in range(len(pts) - 1):
        length += dist(pts[i], pts[i + 1])
    xs = [p.x for p in pts]; ys = [p.y for p in pts]
    minx, maxx = min(xs) - W * 0.5 - 200.0, max(xs) + W * 0.5 + 200.0
    miny, maxy = min(ys) - W * 0.5 - 200.0, max(ys) + W * 0.5 + 200.0
    zlo, zhi = 20250.0, WL
    cen = V((minx + maxx) * 0.5, (miny + maxy) * 0.5, (zlo + zhi) * 0.5)
    szx, szy, szz = (maxx - minx), (maxy - miny), (zhi - zlo)
    pv = _eas().spawn_actor_from_class(unreal.PhysicsVolume, cen)
    pv.set_actor_label("Sump_WaterVolume")
    pv.set_editor_property("water_volume", True)
    try:
        pv.set_editor_property("display_shaded_volume", True)
        pv.set_editor_property("shaded_volume_opacity_value", 0.45)
    except Exception:
        pass
    pv.modify()
    pv.set_actor_scale3d(V(szx / 200.0, szy / 200.0, szz / 200.0))
    try:
        pv.attach_to_actor(root, "", unreal.AttachmentRule.KEEP_RELATIVE,
                           unreal.AttachmentRule.KEEP_RELATIVE,
                           unreal.AttachmentRule.KEEP_RELATIVE, False)
    except Exception as e:
        print("WATER_ATTACH_ERR", str(e))
    wm = backup_material("MIC_Prop") or backup_material("Water")
    sa, sc, sd = spawn_dm("Sump_WaterSurface", root)
    abox(sd, V((minx + maxx) * 0.5, (miny + maxy) * 0.5, WL), unreal.Rotator(0, 0, 0), szx, szy, 20.0)
    finish(sc, sd, wm)
    return {"length_cm": length, "water_actor": pv.get_actor_label(), "wl": WL,
            "submerged_start_cm": 20000.0, "submerged_end_cm": 24000.0,
            "submerged_span_m": 40.0,
            "entry": [pts[0].x, pts[0].y, pts[0].z], "exit": [pts[-1].x, pts[-1].y, pts[-1].z],
            "submerged_mid": [pts[5].x, pts[5].y, pts[5].z]}


def run(seed=1337):
    data = gen_routes(seed)
    root = get_root()
    shell = build_shell(data, root)
    cav = build_caverns(data, root)
    sump = build_sump(data, root)
    total = route_length(data["segs"]) + sump["length_cm"]
    stats = {
        "segments": len(data["segs"]),
        "route_length_cm": round(total, 1),
        "route_length_km": round(total / 100000.0, 3),
        "route_length_miles": round(total / 160934.4, 3),
        "cavern_count": len(data["cav"]),
        "shell_actors": len(shell),
        "cavern_actors": len(cav),
        "sump": sump,
        "branch_ends": [[round(v, 1) for v in b] for b in data["branch_ends"]],
        "cav_nodes": [[round(v, 1) for v in c] for c in data["cav"]],
    }
    with open(os.path.join(REPORT, "route_manifest_v2.json"), "w") as f:
        json.dump(stats, f, indent=1)
    return stats
