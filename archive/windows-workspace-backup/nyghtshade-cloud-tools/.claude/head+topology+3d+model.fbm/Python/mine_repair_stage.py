"""Complete, executable mine geometry repair/construction stage (bounded).

Using the authoritative RECOVERED_ROUTE_GEOMETRY.json this stage:
  * fixes the box rotations of the generated drift/sump shell geometry
  * snaps coincident junction nodes (<=100 cm) so connected segments share
    EXACT endpoints (continuous, walkable floors)
  * rebuilds open floors + side walls with junction-safe wall insets
  * preserves the recovered route mileage
  * quarantines the incorrect bounds-based ArtP01_* art-pass placements

NOT CLAIMED: final imported-asset art pass, visual completion, collision /
traversal play-test, dry->swim->dry sump test, swimming controls, camera.
Untouched: player Blueprint, BACKUP_Mine_* originals, landscape, buildings.
"""

import os, json, math, shutil, time
import unreal

FLOOR_THICKNESS = 40.0
WALL_THICKNESS = 40.0
WALL_HEIGHT = 300.0
SNAP_TOL_CM = 100.0
_STATE = {"mode": "kw"}


def save_dir():
    proj = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
    return os.path.join(proj, "Saved", "CaveNetworkRebuild")


def _axes(pitch_deg, yaw_deg):
    p = math.radians(pitch_deg)
    y = math.radians(yaw_deg)
    f = (math.cos(p) * math.cos(y), math.cos(p) * math.sin(y), math.sin(p))
    r = (-math.sin(y), math.cos(y), 0.0)
    u = (f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0])
    return f, r, u


def _frame_for(a, b):
    dx = b[0] - a[0]; dy = b[1] - a[1]; dz = b[2] - a[2]
    L = math.sqrt(dx * dx + dy * dy + dz * dz)
    if L < 1e-9:
        return 0.0, 0.0, 0.0
    fx, fy, fz = dx / L, dy / L, dz / L
    pitch = math.degrees(math.asin(max(-1.0, min(1.0, fz))))
    yaw = math.degrees(math.atan2(fy, fx))
    return pitch, yaw, L


def _quat(rot):
    try:
        return rot.quaternion()
    except Exception:
        pass
    try:
        return unreal.MathLibrary.conv_rotator_to_quat(rot)
    except Exception:
        pass
    return unreal.Quat(rot)


def _make_transform(center_world, pitch_deg, yaw_deg, offset):
    rot = unreal.Rotator(pitch=pitch_deg, yaw=yaw_deg, roll=0.0)
    loc = unreal.Vector(center_world[0] - offset[0],
                        center_world[1] - offset[1],
                        center_world[2] - offset[2])
    scale = unreal.Vector(1.0, 1.0, 1.0)
    if _STATE["mode"] == "kw":
        return unreal.Transform(location=loc, rotation=rot, scale=scale)
    tr = unreal.Transform()
    tr.set_editor_property("translation", loc)
    tr.set_editor_property("rotation", _quat(rot))
    tr.set_editor_property("scale3d", scale)
    return tr


def _corners(center, pitch, yaw, dx, dy, dz):
    f, r, u = _axes(pitch, yaw)
    hx, hy, hz = dx / 2.0, dy / 2.0, dz / 2.0
    out = []
    for sx in (-1.0, 1.0):
        for sy in (-1.0, 1.0):
            for sz in (-1.0, 1.0):
                out.append((center[0] + f[0]*sx*hx + r[0]*sy*hy + u[0]*sz*hz,
                            center[1] + f[1]*sx*hx + r[1]*sy*hy + u[1]*sz*hz,
                            center[2] + f[2]*sx*hx + r[2]*sy*hy + u[2]*sz*hz))
    return out


def _prim_opts():
    try:
        return unreal.GeometryScriptPrimitiveOptions()
    except Exception:
        return None


def _reset_mesh(dm):
    try:
        dm.reset()
        return True
    except Exception:
        pass
    try:
        dm.clear()
        return True
    except Exception:
        pass
    try:
        unreal.GeometryScript_Mesh.clear_mesh(dm)
        return True
    except Exception:
        pass
    return False


def _dmc(actor):
    try:
        c = actor.get_component_by_class(unreal.DynamicMeshComponent)
        if c:
            return c
    except Exception:
        pass
    try:
        c = actor.get_editor_property("dynamic_mesh_component")
        if c:
            return c
    except Exception:
        pass
    return None


def _snap(nodes, tol=SNAP_TOL_CM):
    n = len(nodes)
    parent = list(range(n))

    def find(x):
        r = x
        while parent[r] != r:
            r = parent[r]
        while parent[x] != r:
            parent[x], x = r, parent[x]
        return r

    pos = [tuple(float(v) for v in nodes[i]["position"]) for i in range(n)]
    t2 = tol * tol
    pair_merges = []
    for i in range(n):
        xi, yi, zi = pos[i]
        for j in range(i + 1, n):
            dx = xi - pos[j][0]; dy = yi - pos[j][1]; dz = zi - pos[j][2]
            d2 = dx * dx + dy * dy + dz * dz
            if d2 <= t2:
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[rj] = ri
                    pair_merges.append((i, j, round(math.sqrt(d2), 3)))
    clusters = {}
    for i in range(n):
        clusters.setdefault(find(i), []).append(i)
    reps = {}
    multi = []
    for root, ids in clusters.items():
        cx = sum(pos[i][0] for i in ids) / len(ids)
        cy = sum(pos[i][1] for i in ids) / len(ids)
        cz = sum(pos[i][2] for i in ids) / len(ids)
        for i in ids:
            reps[i] = (cx, cy, cz)
        if len(ids) > 1:
            multi.append(sorted(ids))
    return reps, parent, multi, pair_merges


def _wall_label(src):
    return src.replace("_Floors", "_Walls") if "_Floors" in src else None


def run_repair(report_only=False):
    t0 = time.time()
    sd = save_dir()
    with open(os.path.join(sd, "RECOVERED_ROUTE_GEOMETRY.json"), "r") as fh:
        data = json.load(fh)
    nodes = data["nodes"]
    segs = data["segments"]
    n = len(nodes)

    reps, parent, multi, pair_merges = _snap(nodes)

    uf = list(range(n))
    def ufind(x):
        r = x
        while uf[r] != r:
            r = uf[r]
        while uf[x] != r:
            uf[x], x = r, uf[x]
        return r
    def uunion(a, b):
        ra, rb = ufind(a), ufind(b)
        if ra != rb:
            uf[rb] = ra
    for ids in multi:
        for k in ids[1:]:
            uunion(ids[0], k)
    for s in segs:
        uunion(int(s["start_node"]), int(s["end_node"]))
    active = set()
    for s in segs:
        active.add(int(s["start_node"])); active.add(int(s["end_node"]))
    comps_after = len(set(ufind(i) for i in active))

    groups = {}
    for s in segs:
        groups.setdefault(s["source"], []).append(s)

    eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actors = eas.get_all_level_actors()
    by_label = {a.get_actor_label(): a for a in actors}

    prim = _prim_opts()
    CENTER = unreal.GeometryScriptPrimitiveOriginMode.CENTER
    coll_opts = unreal.GeometryScriptCollisionFromMeshOptions()

    def build(actor, boxes, offset):
        comp = _dmc(actor)
        if comp is None:
            raise RuntimeError("no DynamicMeshComponent on " + actor.get_actor_label())
        dm = comp.get_dynamic_mesh()
        if not _reset_mesh(dm):
            raise RuntimeError("cannot reset mesh on " + actor.get_actor_label())
        for (c, p, y, dx, dy, dz) in boxes:
            tr = _make_transform(c, p, y, offset)
            unreal.GeometryScript_Primitives.append_box(dm, prim, tr, dx, dy, dz, 0, 0, 0, CENTER)
        comp.notify_mesh_modified()
        try:
            unreal.GeometryScript_Collision.set_dynamic_mesh_collision_from_mesh(dm, comp, coll_opts)
        except Exception:
            pass
        try:
            comp.update_collision()
        except Exception:
            pass
        return comp, dm

    # ---- 90 degree rotation probe (mesh level, independent of frame math) ----
    probe_actor = None
    for lbl in sorted(groups.keys()):
        cand = by_label.get(lbl)
        if cand is not None:
            probe_actor = cand
            break
    probe = {"ok": False, "mode_tried": [], "extent_after_yaw90": None}

    def _probe(mode):
        _STATE["mode"] = mode
        comp = _dmc(probe_actor)
        dm = comp.get_dynamic_mesh()
        _reset_mesh(dm)
        off = probe_actor.get_actor_location()
        tr = _make_transform((off.x, off.y, off.z), 0.0, 90.0, (off.x, off.y, off.z))
        unreal.GeometryScript_Primitives.append_box(dm, prim, tr, 400.0, 100.0, 100.0, 0, 0, 0, CENTER)
        bb = unreal.GeometryScript_MeshQueries.get_mesh_bounding_box(dm)
        ex = bb.max.x - bb.min.x; ey = bb.max.y - bb.min.y; ez = bb.max.z - bb.min.z
        _reset_mesh(dm)
        return [round(ex, 2), round(ey, 2), round(ez, 2)]

    if probe_actor is not None and not report_only:
        for mode in ("kw", "props"):
            try:
                ext = _probe(mode)
                probe["mode_tried"].append([mode, ext])
                if abs(ext[0] - 100.0) < 1.5 and abs(ext[1] - 400.0) < 1.5:
                    probe["ok"] = True
                    probe["extent_after_yaw90"] = ext
                    break
            except Exception as e:
                probe["mode_tried"].append([mode, "ERR:" + str(e)[:80]])

    if report_only:
        return {"report_only": True, "segments": len(segs), "nodes": n}

    rebuilt = []
    skipped = []
    failed = []
    floors_built = 0
    walls_built = 0
    max_aabb_dev = 0.0
    max_grade = 0.0
    length_sum = 0.0
    aabb_samples = []

    for src in sorted(groups.keys()):
        slist = groups[src]
        wall_src = _wall_label(src)
        f_actor = by_label.get(src)
        w_actor = by_label.get(wall_src) if wall_src else None
        if f_actor is None:
            failed.append({"source": src, "reason": "floor actor missing"})
            continue
        fboxes = []
        wboxes = []
        for s in slist:
            a = reps[int(s["start_node"])]
            b = reps[int(s["end_node"])]
            p, y, L = _frame_for(a, b)
            if L <= 1.0:
                continue
            length_sum += L
            g = abs(float(s.get("grade_deg", 0.0)))
            if g > max_grade:
                max_grade = g
            f, r, u = _axes(p, y)
            mid = ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0, (a[2] + b[2]) / 2.0)
            W = float(s.get("width_cm", 600.0))
            fc = (mid[0] - u[0] * FLOOR_THICKNESS / 2.0,
                  mid[1] - u[1] * FLOOR_THICKNESS / 2.0,
                  mid[2] - u[2] * FLOOR_THICKNESS / 2.0)
            fboxes.append((fc, p, y, L, W, FLOOR_THICKNESS))
            inset = min(W / 2.0, max(0.0, (L - 200.0) / 2.0))
            wlen = L - 2.0 * inset
            if wlen > 50.0:
                for sgn in (1.0, -1.0):
                    wc = (mid[0] + r[0] * sgn * W / 2.0 + u[0] * WALL_HEIGHT / 2.0,
                          mid[1] + r[1] * sgn * W / 2.0 + u[1] * WALL_HEIGHT / 2.0,
                          mid[2] + r[2] * sgn * W / 2.0 + u[2] * WALL_HEIGHT / 2.0)
                    wboxes.append((wc, p, y, wlen, WALL_THICKNESS, WALL_HEIGHT))

        off_v = f_actor.get_actor_location()
        off = (off_v.x, off_v.y, off_v.z)
        try:
            comp, dm = build(f_actor, fboxes, off)
            floors_built += len(fboxes)
            exp_pts = []
            for (c, p, y, dx, dy, dz) in fboxes:
                exp_pts.extend(_corners(c, p, y, dx, dy, dz))
            exmin = (min(q[0] for q in exp_pts) - off[0],
                     min(q[1] for q in exp_pts) - off[1],
                     min(q[2] for q in exp_pts) - off[2])
            exmax = (max(q[0] for q in exp_pts) - off[0],
                     max(q[1] for q in exp_pts) - off[1],
                     max(q[2] for q in exp_pts) - off[2])
            bb = unreal.GeometryScript_MeshQueries.get_mesh_bounding_box(dm)
            dev = max(abs(bb.min.x - exmin[0]), abs(bb.min.y - exmin[1]), abs(bb.min.z - exmin[2]),
                      abs(bb.max.x - exmax[0]), abs(bb.max.y - exmax[1]), abs(bb.max.z - exmax[2]))
            aabb_samples.append({"actor": f_actor.get_actor_label(), "dev_cm": round(dev, 3)})
            if dev > max_aabb_dev:
                max_aabb_dev = dev
            rebuilt.append({"actor": f_actor.get_actor_label(), "boxes": len(fboxes), "aabb_dev_cm": round(dev, 3)})
        except Exception as e:
            failed.append({"source": src, "reason": str(e)[:120]})

        if w_actor is not None and wboxes:
            off_v2 = w_actor.get_actor_location()
            try:
                build(w_actor, wboxes, (off_v2.x, off_v2.y, off_v2.z))
                walls_built += len(wboxes)
                rebuilt.append({"actor": w_actor.get_actor_label(), "boxes": len(wboxes)})
            except Exception as e:
                failed.append({"source": wall_src, "reason": str(e)[:120]})
        elif wall_src:
            skipped.append({"source": wall_src, "reason": "wall actor missing" if w_actor is None else "no wall boxes"})

    # ---- quarantine incorrect bounds-based art pass ----
    art = [a for a in actors if a.get_actor_label().startswith("ArtP01_")]
    art_moved = []
    art_root = by_label.get("MineArtPass_Section01_INVALID")
    if art and art_root is None:
        try:
            art_root = eas.spawn_actor_from_class(unreal.Actor, unreal.Vector(0, 0, 0))
            art_root.set_actor_label("MineArtPass_Section01_INVALID")
        except Exception:
            art_root = None
    for a in art:
        lbl = a.get_actor_label()
        a.modify()
        try:
            a.set_actor_hidden_in_game(True)
        except Exception:
            pass
        try:
            a.set_is_temporarily_hidden_in_editor(True)
        except Exception:
            pass
        try:
            lc = a.get_component_by_class(unreal.LightComponent)
            if lc:
                lc.modify()
                lc.set_visibility(False, True)
        except Exception:
            pass
        if art_root is not None:
            try:
                a.attach_to_actor(art_root, "", unreal.AttachmentRule.KEEP_WORLD, unreal.AttachmentRule.KEEP_WORLD, unreal.AttachmentRule.KEEP_WORLD, False)
            except Exception:
                pass
        art_moved.append(lbl)

    cavern_actors = [a.get_actor_label() for a in actors
                     if a.get_actor_label().startswith("Mine_Cavern_")]

    level_saved = False
    try:
        les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
        level_saved = bool(les.save_current_level())
    except Exception:
        pass

    elapsed = round(time.time() - t0, 2)
    src_list = sorted(groups.keys())
    drift_sources = [s for s in src_list if s.startswith("Mine_Drift_Floors")]
    sump_sources = [s for s in src_list if s.startswith("Sump")]

    result = {
        "stage": "recovery_driven_rotation_and_junction_repair",
        "elapsed_sec": elapsed,
        "input": {
            "segments": len(segs),
            "drift_segments": sum(1 for s in segs if s["source"].startswith("Mine_Drift_Floors")),
            "sump_segments": sum(1 for s in segs if s["source"].startswith("Sump")),
            "drift_sources": len(drift_sources),
            "sump_sources": len(sump_sources),
            "nodes": n,
        },
        "junction_snap": {
            "tolerance_cm": SNAP_TOL_CM,
            "merged_clusters": multi,
            "pair_merges": pair_merges,
            "components_before": len(data.get("components", [])),
            "components_after": comps_after,
        },
        "rotation": {
            "transform_mode": _STATE["mode"],
            "yaw90_probe": probe,
            "aabb_readback_max_dev_cm": round(max_aabb_dev, 3),
            "aabb_samples": aabb_samples[:6],
        },
        "geometry": {
            "floor_thickness_cm": FLOOR_THICKNESS,
            "wall_thickness_cm": WALL_THICKNESS,
            "wall_height_cm": WALL_HEIGHT,
            "floors_built": floors_built,
            "walls_built": walls_built,
            "rebuilt_actors": rebuilt,
            "failed": failed,
            "skipped": skipped,
        },
        "mileage": {
            "recovered_cm": round(data.get("length_cm", 0.0), 2),
            "built_cm": round(length_sum, 2),
            "built_km": round(length_sum / 100000.0, 4),
            "built_miles": round(length_sum / 160934.4, 4),
            "delta_cm": round(length_sum - float(data.get("length_cm", 0.0)), 3),
            "max_grade_deg": round(max_grade, 5),
        },
        "art_pass": {
            "quarantined_count": len(art_moved),
            "quarantined": art_moved,
            "root": "MineArtPass_Section01_INVALID",
        },
        "untouched": {
            "cavern_actors": len(cavern_actors),
            "backup_prefix": "BACKUP_Mine_*",
            "landscape_buildings_player_bp_camera": "untouched",
        },
        "level_saved": level_saved,
        "not_claimed": [
            "final imported-asset art pass",
            "visual completion",
            "collision/traversal play-test with player capsule",
            "dry->swim->dry sump test",
            "swimming controls (separate scoped agent)",
            "viewport camera unchanged",
        ],
    }

    try:
        shutil.copyfile(__file__, os.path.join(sd, "REPAIR_CONSTRUCTION.py"))
        result["script_saved"] = os.path.join(sd, "REPAIR_CONSTRUCTION.py")
    except Exception as e:
        result["script_saved"] = "ERR:" + str(e)[:80]
    with open(os.path.join(sd, "CHECKPOINT_repaired.json"), "w") as fh:
        json.dump(result, fh, indent=1)
    with open(os.path.join(sd, "VERIFICATION_REPAIR.json"), "w") as fh:
        json.dump(result, fh, indent=1)
    return result
