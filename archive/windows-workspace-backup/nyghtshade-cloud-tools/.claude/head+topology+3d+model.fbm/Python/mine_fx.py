# mine_fx.py - registry-resolved dressing pass for the rebuilt mine (MyProject2)
import unreal, math, random, json, os
import mine_build as mb
from mine_cart_policy import is_mine_cart_asset

ROOTS = ["/Game/Scene_OldMine", "/Game/RockEnv_Pack", "/Game/RP_Vol_01",
         "/Game/Fab/Megascans/3D/Modular_Mine_Tunnel_Kit_wcckeezdw"]

TIMBERS = ["SM_Ind_Min_Tunnel_Wall_Log_Modular_0%d" % i for i in (1, 2, 3, 4)]
BEAMS = ["SM_His_Med_Beam_Wood_Worn_0%d" % i for i in (1, 2, 3, 4, 5)] + \
        ["SM_Ind_Min_Beam_Round_Wood_Worn_01", "SM_Ind_Min_Beam_Square_Wood_Worn_03",
         "SM_Ind_Min_Beam_Square_Wood_Worn_04"]
RAILS = ["SM_Ind_Min_Rail_Tracks_Wood_Modular_01_%s" % s for s in ("A", "B", "C")] + \
        ["SM_Ind_Min_Rail_Metal_Pack_01_%s" % s for s in ("A", "B", "C", "D")]
CARTS = ["SM_Ind_Min_Cart_Metal_Old_01", "SM_Ind_Min_Cart_Metal_Old_02",
         "SM_Ind_Min_Cart_Log_Wood_Old_01", "SM_Ind_Min_Vehicle_Cart_Metal_Old_02"]
LAMP = "SM_Ind_War_Light_Bulkhead_Metal_Caged_01"
DEBRIS = "SM_Ind_Rub_Debris_Board_Wood_Old_02"
TOOLS = ["SM_His_Med_Tools_Pickaxe_Metal_Old_03", "SM_Ind_Min_Tool_Shovel_Old_01"]
HERO = "SM_Ind_Min_Cave"
FORMATIONS = ["SM_Rock_Cave_%d" % i for i in range(1, 6)]
ROCKS = ["SM_Rock_%d" % i for i in range(1, 16)] + ["SM_Cliff_Rock_%d" % i for i in range(1, 10)] + \
        ["SM_Mesa_Rock_%d" % i for i in range(1, 15)] + ["SM_Jungle_Rock_%d" % i for i in range(1, 8)]
DRIPS = ["SM_Drip_Stones_%d" % i for i in range(1, 18)]
PEBBLES = ["SM_RP_Vol_01_%02d" % i for i in range(1, 13)]

_eas = None
_map = None
_cache = {}

def eas():
    global _eas
    if _eas is None:
        _eas = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    return _eas

def asset_map():
    global _map
    if _map is not None:
        return _map
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    SM = unreal.TopLevelAssetPath("/Script/Engine", "StaticMesh")
    m = {}
    for fld in ROOTS:
        try:
            f = unreal.ARFilter(class_paths=[SM], package_paths=[fld], recursive_paths=True)
            for ad in ar.get_assets(f):
                nm = str(ad.asset_name)
                m.setdefault(nm, str(ad.package_name) + "." + nm)
        except Exception as e:
            print("REG_ERR", fld, str(e))
    _map = m
    return m

def get_sm(name):
    if name in _cache:
        return _cache[name]
    p = asset_map().get(name)
    sm = None
    if p:
        try:
            sm = unreal.EditorAssetLibrary.load_asset(p)
        except Exception:
            sm = None
    _cache[name] = sm
    return sm

def mesh_h(sm):
    try:
        b = sm.get_bounds()
        return b.box_extent.z * 2.0
    except Exception:
        return 0.0

def spawn_sm(name, loc, rot, scale, parent, label):
    # The user removed mine carts; reject them regardless of actor label.
    if is_mine_cart_asset(name):
        return None
    sm = get_sm(name)
    if sm is None:
        return None
    a = eas().spawn_actor_from_class(unreal.StaticMeshActor, loc)
    if a is None:
        return None
    a.set_actor_label(label)
    a.modify()
    comp = a.get_editor_property("static_mesh_component")
    try:
        comp.set_mobility(unreal.ComponentMobility.MOVABLE)
    except Exception:
        pass
    comp.set_static_mesh(sm)
    try:
        a.set_actor_scale3d(mb.V(scale[0], scale[1], scale[2]))
        a.set_actor_rotation(rot, False)
    except Exception as e:
        print("XF_ERR", label, str(e))
    try:
        a.attach_to_actor(parent, "", unreal.AttachmentRule.KEEP_RELATIVE,
                          unreal.AttachmentRule.KEEP_RELATIVE,
                          unreal.AttachmentRule.KEEP_RELATIVE, False)
    except Exception:
        pass
    return a

def add_light(loc, parent, label, warm=True, shadows=False, intensity=90.0):
    l = eas().spawn_actor_from_class(unreal.PointLight, loc)
    if l is None:
        return None
    l.set_actor_label(label)
    lc = l.get_editor_property("point_light_component")
    try:
        lc.set_mobility(unreal.ComponentMobility.MOVABLE)
    except Exception:
        pass
    ok = False
    try:
        lc.set_editor_property("intensity_units", unreal.LightUnits.CANDELAS)
        lc.set_editor_property("intensity", intensity)
        ok = True
    except Exception:
        pass
    if not ok:
        try:
            lc.set_editor_property("intensity", intensity * 50.0)
        except Exception:
            pass
    try:
        lc.set_editor_property("attenuation_radius", 2000.0)
        lc.set_editor_property("light_color", unreal.Color(255, 186, 118, 255) if warm else unreal.Color(150, 190, 255, 255))
        lc.set_editor_property("cast_shadows", shadows)
    except Exception:
        pass
    try:
        l.attach_to_actor(parent, "", unreal.AttachmentRule.KEEP_RELATIVE,
                          unreal.AttachmentRule.KEEP_RELATIVE,
                          unreal.AttachmentRule.KEEP_RELATIVE, False)
    except Exception:
        pass
    return l

PREFIXES = ("Mine_Timber_", "Mine_Rail_", "Mine_Cart_", "Mine_HeroRock_", "Mine_Form_",
            "Mine_Drip_", "Mine_Rubble_", "Mine_Collapse_", "Mine_SnapBeam_", "Mine_Partial_",
            "Mine_PartialBeam_", "Mine_Lamp_", "Mine_Light_", "Mine_CavLight_", "Mine_Prop_")

def cleanup():
    n = 0
    for a in list(eas().get_all_level_actors()):
        if a.get_actor_label().startswith(PREFIXES):
            eas().destroy_actor(a)
            n += 1
    return n

def dress_all(seed=1337):
    data = mb.gen_routes(seed)
    root = mb.get_root()
    rng = random.Random(2026)
    segs = data["segs"]
    c = {"timber": 0, "rails": 0, "carts": 0, "hero": 0, "rocks": 0, "lamps": 0,
         "lights": 0, "caveins": 0, "drips": 0, "pebbles": 0}

    def seg_frame(s, loc_fn, tag, name_pool, base_scale=1.0, fit=False):
        p0 = mb.V(*s["p0"]); p1 = mb.V(*s["p1"])
        rot = mb.look_rot(p0, p1)
        m = mb.mid(p0, p1)
        r = mb.rightv(rot); u = mb.upv(rot)
        loc = loc_fn(m, r, u, s)
        nm = rng.choice(name_pool)
        sc = base_scale
        if fit:
            sm = get_sm(nm)
            mh = mesh_h(sm) if sm is not None else 0.0
            if mh > 1.0:
                sc = base_scale * max(0.35, min(1.4, (s["h"] + 140.0) / mh))
        return spawn_sm(nm, loc, rot, (sc, sc, sc), root, tag)

    for i, s in enumerate(segs):
        if s["band"] in (0, 1) and i % 2 == 0:
            if seg_frame(s, lambda m, r, u, q: mb.add(m, mb.mul(u, q["h"] * 0.5)),
                         "Mine_Timber_%03d" % i, TIMBERS, 1.0, True) is not None:
                c["timber"] += 1

    for i, s in enumerate(segs):
        if s["band"] == 0 and i % 3 == 0:
            if seg_frame(s, lambda m, r, u, q: mb.add(m, mb.mul(u, 18.0)),
                         "Mine_Rail_%03d" % i, RAILS, 1.0) is not None:
                c["rails"] += 1

    # Preserve legacy RNG draws without recreating the removed carts.
    # spawn_sm rejects cart assets before loading or spawning.
    for k, si in enumerate((14, 42, 70, 98, 140)):
        if si < len(segs):
            s = segs[si]
            if seg_frame(s, lambda m, r, u, q: mb.add(mb.add(m, mb.mul(r, q["w"] * 0.22)), mb.mul(u, 60.0)),
                         "Mine_Cart_%02d" % k, CARTS, 1.0) is not None:
                c["carts"] += 1

    for i, s in enumerate(segs):
        if s["band"] in (0, 1, 2) and i % 7 == 3:
            side = -1.0 if (i % 2 == 0) else 1.0
            if seg_frame(s, lambda m, r, u, q: mb.add(mb.add(m, mb.mul(r, side * (q["w"] * 0.5 + 60.0))), mb.mul(u, q["h"] * 0.45)),
                         "Mine_HeroRock_%03d" % i, [HERO], 1.0) is not None:
                c["hero"] += 1

    for ci, node in enumerate(data["cav"]):
        cv = mb.V(*node)
        for k in range(4):
            a = 2.0 * math.pi * rng.random()
            rr = rng.uniform(500.0, 1400.0)
            sc = rng.uniform(0.7, 1.6)
            if spawn_sm(rng.choice(FORMATIONS), mb.V(cv.x + math.cos(a) * rr, cv.y + math.sin(a) * rr, cv.z),
                        unreal.Rotator(0, rng.uniform(0, 360), 0), (sc, sc, sc), root,
                        "Mine_Form_%02d_%d" % (ci, k)) is not None:
                c["rocks"] += 1
        for k in range(5):
            a = 2.0 * math.pi * rng.random()
            rr = rng.uniform(300.0, 1800.0)
            sc = rng.uniform(0.5, 1.1)
            if spawn_sm(rng.choice(DRIPS), mb.V(cv.x + math.cos(a) * rr, cv.y + math.sin(a) * rr,
                                                cv.z + rng.uniform(700.0, 1300.0)),
                        unreal.Rotator(180, rng.uniform(0, 360), 0), (sc, sc, sc), root,
                        "Mine_Drip_%02d_%d" % (ci, k)) is not None:
                c["drips"] += 1

    for i, s in enumerate(segs):
        if i % 5 == 2:
            p0 = mb.V(*s["p0"]); p1 = mb.V(*s["p1"])
            rot = mb.look_rot(p0, p1)
            m = mb.mid(p0, p1)
            r = mb.rightv(rot); u = mb.upv(rot)
            for k in range(2):
                loc = mb.add(mb.add(m, mb.mul(r, rng.uniform(-0.35, 0.35) * s["w"])), mb.mul(u, 25.0))
                sc = rng.uniform(0.6, 1.5)
                if spawn_sm(rng.choice(ROCKS + PEBBLES), loc,
                            unreal.Rotator(0, rng.uniform(0, 360), rng.uniform(-15, 15)),
                            (sc, sc, sc), root, "Mine_Rubble_%03d_%d" % (i, k)) is not None:
                    c["pebbles"] += 1

    for bi, be in enumerate(data["branch_ends"]):
        bp = mb.V(*be)
        for k in range(8):
            a = 2.0 * math.pi * rng.random()
            rr = rng.uniform(0.0, 420.0)
            sc = rng.uniform(0.8, 2.0)
            if spawn_sm(rng.choice(ROCKS + FORMATIONS),
                        mb.V(bp.x + math.cos(a) * rr, bp.y + math.sin(a) * rr, bp.z + rng.uniform(0.0, 380.0)),
                        unreal.Rotator(0, rng.uniform(0, 360), rng.uniform(-30, 30)), (sc, sc, sc), root,
                        "Mine_Collapse_%02d_%d" % (bi, k)) is not None:
                c["caveins"] += 1
        for k in range(3):
            if spawn_sm(rng.choice(BEAMS + [DEBRIS]),
                        mb.V(bp.x + rng.uniform(-350, 350), bp.y + rng.uniform(-350, 350), bp.z + rng.uniform(40, 300)),
                        unreal.Rotator(rng.uniform(-60, 60), rng.uniform(0, 360), rng.uniform(-60, 60)),
                        (1, 1, 1), root, "Mine_SnapBeam_%02d_%d" % (bi, k)) is not None:
                c["caveins"] += 1

    for pi, si in enumerate((60, 110, 150, 175)):
        if si >= len(segs):
            continue
        s = segs[si]
        p0 = mb.V(*s["p0"]); p1 = mb.V(*s["p1"])
        rot = mb.look_rot(p0, p1)
        m = mb.mid(p0, p1)
        r = mb.rightv(rot); u = mb.upv(rot)
        for k in range(6):
            loc = mb.add(mb.add(m, mb.mul(r, -s["w"] * 0.42 + rng.uniform(-40, 40))),
                         mb.mul(u, rng.uniform(30.0, s["h"] - 40.0)))
            sc = rng.uniform(0.7, 1.6)
            if spawn_sm(rng.choice(ROCKS), loc, unreal.Rotator(0, rng.uniform(0, 360), rng.uniform(-25, 25)),
                        (sc, sc, sc), root, "Mine_Partial_%02d_%d" % (pi, k)) is not None:
                c["caveins"] += 1
        for k in range(2):
            if spawn_sm(rng.choice(BEAMS), mb.add(mb.add(m, mb.mul(r, -s["w"] * 0.30)), mb.mul(u, rng.uniform(80, 250))),
                        unreal.Rotator(rng.uniform(-50, 50), rng.uniform(0, 360), rng.uniform(-50, 50)),
                        (1, 1, 1), root, "Mine_PartialBeam_%02d_%d" % (pi, k)) is not None:
                c["caveins"] += 1

    for i, s in enumerate(segs):
        if i % 6 != 0:
            continue
        p0 = mb.V(*s["p0"]); p1 = mb.V(*s["p1"])
        rot = mb.look_rot(p0, p1)
        m = mb.mid(p0, p1)
        r = mb.rightv(rot); u = mb.upv(rot)
        lamp_loc = mb.add(mb.add(m, mb.mul(r, s["w"] * 0.42)), mb.mul(u, s["h"] - 120.0))
        if spawn_sm(LAMP, lamp_loc, unreal.Rotator(0, rot.yaw + 90.0, 0), (1.6, 1.6, 1.6), root,
                    "Mine_Lamp_%03d" % i) is not None:
            c["lamps"] += 1
        warm = s["band"] != 3
        if add_light(m, root, "Mine_Light_%03d" % i, warm=warm, shadows=(i % 18 == 0),
                     intensity=90.0 if warm else 55.0) is not None:
            c["lights"] += 1

    for ci, node in enumerate(data["cav"]):
        cv = mb.V(*node)
        if add_light(mb.V(cv.x, cv.y, cv.z + 700.0), root, "Mine_CavLight_%02d" % ci,
                     warm=(ci % 2 == 0), shadows=True, intensity=160.0) is not None:
            c["lights"] += 1

    with open(os.path.join(mb.REPORT, "dress_manifest.json"), "w") as f:
        json.dump(c, f, indent=1)
    return c
