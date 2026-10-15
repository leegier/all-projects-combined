#!/usr/bin/env python3
"""dna2glb.py - MetaHuman DNA file  ->  skinned GLB that Nyghtshade Hollow's pipeline accepts.

A MetaHuman head's geometry, joints, skin weights and blend shapes live in a binary .dna file (inside a .mhpkg it is
SourceAssets/<Name>.dna).  This tool turns one into a single GLB:

  * the LOD0 meshes (head, teeth, eyeLeft, eyeRight, eyelashes, ... the DNA mesh names are kept) as separate named meshes,
    one primitive each, one material each (material name = mesh name without the _lodN_mesh suffix, which is what the game's
    name rules - hair / lash / teeth / eyeshell ... - look at)
  * the DNA joints with their names and hierarchy, as glTF nodes, one skin, inverse bind matrices from the neutral pose
  * skin weights limited to 4 influences per vertex and renormalised
  * metres, +Y up, character facing +Z (DNA unit and axis convention are read from the file and converted)
  * UVs flipped to glTF's top-left origin; quads/n-gons triangulated; vertices split where position/UV/normal layouts differ
  * with --morphs: DNA blend shape targets as morph targets (sparse accessors, one target per DNA channel); default off

USAGE
  python3 dna2glb.py INPUT.dna OUTPUT.glb [options]
  python3 dna2glb.py --probe INPUT.dna            # header + (if the bindings load) a summary of what the file holds
  python3 dna2glb.py --selftest [--keep DIR]      # converter checks on a synthetic DNA-shaped model (no DNA file needed)

OPTIONS
  --lod N               LOD to export (default 0)
  --morphs              also export blend shapes as morph targets (default off: the game does not animate them)
  --body-stub           a head-only DNA has no arms/legs, so the game cannot drive it: add the missing UE5 body JOINTS
                        (pelvis, spine_01..05, neck, clavicle/upperarm/lowerarm/hand, thigh/calf/foot/ball) scaled to the head
                        height, plus an invisible zero-area proxy triangle at sole level (the game measures a character's height from its mesh
                        bounds and stands it on the floor, so without it a head-only GLB is scaled to full-body size and lies chin-on-floor).
                        No body mesh: you get a head floating on an invisible skeleton, enough for faces
  --joint-space S       auto (default) | world | local - how the DNA stores neutral joint transforms.  auto tries both and keeps
                        the one that puts the joints at the skin they weight (reported); force it if auto picks wrong
  --euler ORDER         xyz (default; R = Rz*Ry*Rx, Maya's "xyz") | zyx - convention of the DNA joint rotations
  --flip-winding W      auto (default; judged against the DNA normals) | yes | no
  --unit U / --axes X,Y,Z   override what the file declares (cm|m; each of left,right,up,down,front,back)
  --max-influences N    skin influences per vertex (default 4, the most three.js reads)
  --dna-lib DIR         folder holding Epic's `dna` Python bindings (the folder with dna.py / _dna.so or dna.pyd for THIS python);
                        also read from $DNA_LIB.  Without it, `import dna` is tried
  -q                    quiet

READING THE DNA.  The .dna format is Epic's (github.com/EpicGamesExt/MetaHuman-DNA-Calibration).  This tool does not carry a parser
of its own: it reads through Epic's official `dna` Python bindings (the module the DNACalib release ships), which keeps it correct
across DNA versions.  See tools/metahuman/README.md section 3b for where to get them and how to match them to your python.
Pure stdlib otherwise (no numpy, no pip install).

STATUS.  The conversion core and the GLB writer are verified with --selftest (synthetic DNA-shaped data, see below) and the
output is accepted by `node optimize.mjs --inspect` and loads in the game.  The adapter that talks to the real `dna` module
is written against Epic's documented Reader API and has NOT yet run against a real DNA file; `--probe` lists every API
call it needs and which are missing in the module you have, so a mismatch is reported precisely instead of failing deep inside.
"""
from __future__ import annotations

import argparse
import array
import json
import math
import os
import re
import struct
import sys
from typing import Callable, Dict, List, Optional, Sequence, Tuple

Vec = Tuple[float, float, float]
Mat3 = Tuple[float, ...]            # 9 floats, row-major
Xf = Tuple[Mat3, Vec]               # rotation + translation (rigid, no scale)

QUIET = False


def log(*a) -> None:
    if not QUIET:
        print(*a, file=sys.stderr)


# --------------------------------------------------------------------------------------------------------------------
# small linear algebra (rigid transforms only)
# --------------------------------------------------------------------------------------------------------------------
I3: Mat3 = (1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0)


def m3mul(a: Mat3, b: Mat3) -> Mat3:
    return tuple(sum(a[r * 3 + k] * b[k * 3 + c] for k in range(3)) for r in range(3) for c in range(3))  # type: ignore


def m3t(a: Mat3) -> Mat3:
    return (a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8])


def m3v(a: Mat3, v: Sequence[float]) -> Vec:
    return (a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2])


def m3det(a: Mat3) -> float:
    return (a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]))


def xf_mul(a: Xf, b: Xf) -> Xf:
    r = m3mul(a[0], b[0])
    t = m3v(a[0], b[1])
    return r, (t[0] + a[1][0], t[1] + a[1][1], t[2] + a[1][2])


def xf_inv(a: Xf) -> Xf:
    rt = m3t(a[0])
    t = m3v(rt, a[1])
    return rt, (-t[0], -t[1], -t[2])


def euler_to_m3(rx: float, ry: float, rz: float, order: str) -> Mat3:
    """Radians.  'xyz' = Maya's rotate order xyz: X is applied first, R = Rz*Ry*Rx.  'zyx': R = Rx*Ry*Rz."""
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    mx: Mat3 = (1, 0, 0, 0, cx, -sx, 0, sx, cx)
    my: Mat3 = (cy, 0, sy, 0, 1, 0, -sy, 0, cy)
    mz: Mat3 = (cz, -sz, 0, sz, cz, 0, 0, 0, 1)
    return m3mul(mz, m3mul(my, mx)) if order == 'xyz' else m3mul(mx, m3mul(my, mz))


def m3_to_quat(m: Mat3) -> Tuple[float, float, float, float]:
    """x, y, z, w."""
    tr = m[0] + m[4] + m[8]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        q = ((m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s, 0.25 * s)
    elif m[0] > m[4] and m[0] > m[8]:
        s = math.sqrt(1.0 + m[0] - m[4] - m[8]) * 2
        q = (0.25 * s, (m[1] + m[3]) / s, (m[2] + m[6]) / s, (m[7] - m[5]) / s)
    elif m[4] > m[8]:
        s = math.sqrt(1.0 + m[4] - m[0] - m[8]) * 2
        q = ((m[1] + m[3]) / s, 0.25 * s, (m[5] + m[7]) / s, (m[2] - m[6]) / s)
    else:
        s = math.sqrt(1.0 + m[8] - m[0] - m[4]) * 2
        q = ((m[2] + m[6]) / s, (m[5] + m[7]) / s, 0.25 * s, (m[3] - m[1]) / s)
    n = math.sqrt(sum(c * c for c in q)) or 1.0
    q = tuple(c / n for c in q)
    return q if q[3] >= 0 else tuple(-c for c in q)  # type: ignore


# --------------------------------------------------------------------------------------------------------------------
# the neutral data model (what the DNA holds, in the DNA's own units and axes)
# --------------------------------------------------------------------------------------------------------------------
class Joint:
    __slots__ = ('name', 'parent', 't', 'r')

    def __init__(self, name: str, parent: int, t: Vec, r: Vec):
        self.name, self.parent, self.t, self.r = name, parent, t, r


class Target:
    """One blend shape target of one mesh: deltas for some DNA positions."""
    __slots__ = ('channel', 'name', 'indices', 'deltas')

    def __init__(self, channel: int, name: str, indices: List[int], deltas: List[Vec]):
        self.channel, self.name, self.indices, self.deltas = channel, name, indices, deltas


class Mesh:
    def __init__(self, name: str):
        self.name = name
        self.positions: List[Vec] = []
        self.uvs: List[Tuple[float, float]] = []
        self.normals: List[Vec] = []
        self.layouts: List[Tuple[int, int, int]] = []        # (position, uv, normal) index triples
        self.faces: List[List[int]] = []                     # layout indices per face (tris, quads, n-gons)
        self.influences: List[List[Tuple[int, float]]] = []  # per POSITION: [(joint, weight)]
        self.targets: List[Target] = []


class DnaModel:
    def __init__(self):
        self.name = ''
        self.joints: List[Joint] = []
        self.meshes: List[Mesh] = []
        self.unit = 'cm'                                      # translation unit of positions and joint translations
        self.rot_unit = 'degrees'
        self.axes = ('left', 'up', 'front')                   # direction of the DNA's x, y, z axes
        self.lod = 0
        self.lod_count = 1
        self.channel_count = 0


# --------------------------------------------------------------------------------------------------------------------
# reading through Epic's `dna` Python bindings
# --------------------------------------------------------------------------------------------------------------------
READER_API = [   # every Reader call the adapter makes (names as in Epic's Reader interface)
    'getJointCount', 'getJointName', 'getJointParentIndex', 'getNeutralJointTranslation', 'getNeutralJointRotation',
    'getMeshCount', 'getMeshName', 'getVertexPositionCount', 'getVertexPosition', 'getVertexTextureCoordinateCount',
    'getVertexTextureCoordinate', 'getVertexNormalCount', 'getVertexNormal', 'getVertexLayoutCount', 'getVertexLayout',
    'getFaceCount', 'getFaceVertexLayoutIndices', 'getSkinWeightsCount', 'getSkinWeightsValues', 'getSkinWeightsJointIndices',
]
READER_API_OPTIONAL = [   # used when present (otherwise a documented fallback)
    'getLODCount', 'getMeshIndicesForLOD', 'getTranslationUnit', 'getRotationUnit', 'getCoordinateSystem', 'getName',
    'getBlendShapeChannelCount', 'getBlendShapeChannelName', 'getBlendShapeTargetCount', 'getBlendShapeChannelIndex',
    'getBlendShapeTargetDeltaCount', 'getBlendShapeTargetDelta', 'getBlendShapeTargetVertexIndices',
]
_DIRS = ['left', 'right', 'up', 'down', 'front', 'back']


def import_dna(libdir: Optional[str]):
    for d in ([libdir] if libdir else []) + ([os.environ['DNA_LIB']] if os.environ.get('DNA_LIB') else []):
        if d and os.path.isdir(d) and d not in sys.path:
            sys.path.insert(0, d)
    try:
        import dna  # type: ignore
        return dna
    except ImportError as e:
        raise SystemExit(
            "cannot import Epic's `dna` Python module (%s).\n"
            "  - it comes with the DNACalib release / the MetaHuman-DNA-Calibration repository (lib/ folder, one build per python minor version);\n"
            "  - point --dna-lib (or $DNA_LIB) at the folder that contains dna.py and the _dna extension for python %d.%d,\n"
            "    or run this script with the python the bindings were built for.  tools/metahuman/README.md section 3b has the details."
            % (e, sys.version_info[0], sys.version_info[1]))


def enum_name(dna, kind: str, value) -> Optional[str]:
    """'cm' for TranslationUnit_cm == value, 'up' for Direction_up ... ; also accepts ints in declaration order."""
    s = str(value)
    if '.' in s and s.split('.')[0].endswith(kind):
        return s.split('.')[-1]
    if dna is not None:
        for k in dir(dna):
            if k.startswith(kind + '_') and getattr(dna, k) == value:
                return k[len(kind) + 1:]
    if isinstance(value, int):
        table = {'TranslationUnit': ['cm', 'm'], 'RotationUnit': ['degrees', 'radians'], 'Direction': _DIRS}.get(kind)
        if table and 0 <= value < len(table):
            return table[value]
    return None


def check_api(reader) -> Tuple[List[str], List[str]]:
    return ([n for n in READER_API if not hasattr(reader, n)], [n for n in READER_API_OPTIONAL if not hasattr(reader, n)])


def model_from_reader(r, dna=None, lod: int = 0, morphs: bool = False, unit: Optional[str] = None,
                      axes: Optional[Sequence[str]] = None) -> DnaModel:
    """Everything the converter needs, from an object with Epic's Reader API (the real BinaryStreamReader, or the test double)."""
    missing, _ = check_api(r)
    if missing:
        raise SystemExit('the dna module lacks Reader calls this tool needs: ' + ', '.join(missing) + '\n  (run --probe for the full list; the module may be a different DNA API generation)')
    m = DnaModel()
    m.lod = lod
    try:
        m.name = str(r.getName())
    except Exception:
        m.name = ''
    try:
        m.lod_count = int(r.getLODCount())
    except Exception:
        m.lod_count = 1
    # units and axes
    u = unit
    if not u and hasattr(r, 'getTranslationUnit'):
        u = enum_name(dna, 'TranslationUnit', r.getTranslationUnit())
    m.unit = u or 'cm'
    if hasattr(r, 'getRotationUnit'):
        m.rot_unit = enum_name(dna, 'RotationUnit', r.getRotationUnit()) or 'degrees'
    if axes:
        m.axes = tuple(axes)  # type: ignore
    elif hasattr(r, 'getCoordinateSystem'):
        cs = r.getCoordinateSystem()
        got = tuple(enum_name(dna, 'Direction', getattr(cs, k)) for k in ('xAxis', 'yAxis', 'zAxis'))
        if all(got):
            m.axes = got  # type: ignore
    # joints
    n = int(r.getJointCount())
    for i in range(n):
        p = int(r.getJointParentIndex(i))
        t, ro = r.getNeutralJointTranslation(i), r.getNeutralJointRotation(i)
        m.joints.append(Joint(str(r.getJointName(i)), p if (p != i and 0 <= p < n) else -1, (t.x, t.y, t.z), (ro.x, ro.y, ro.z)))
    # which meshes belong to the LOD
    count = int(r.getMeshCount())
    names = [str(r.getMeshName(i)) for i in range(count)]
    idxs: List[int] = []
    if hasattr(r, 'getMeshIndicesForLOD'):
        try:
            idxs = [int(i) for i in r.getMeshIndicesForLOD(lod)]
        except Exception:
            idxs = []
    if not idxs:
        idxs = [i for i, nm in enumerate(names) if re.search(r'lod%d(_|$)' % lod, nm.lower())]
    if not idxs and m.lod_count <= 1:
        idxs = list(range(count))
    if not idxs:
        raise SystemExit('no meshes found for LOD %d (meshes in the file: %s)' % (lod, ', '.join(names)))
    have_blend = morphs and all(hasattr(r, k) for k in ('getBlendShapeTargetCount', 'getBlendShapeChannelIndex', 'getBlendShapeTargetDeltaCount',
                                                          'getBlendShapeTargetDelta', 'getBlendShapeTargetVertexIndices'))
    if morphs and not have_blend:
        log('warning: this dna module has no blend shape accessors - exporting without morph targets')
    if have_blend and hasattr(r, 'getBlendShapeChannelCount'):
        m.channel_count = int(r.getBlendShapeChannelCount())
    for mi in idxs:
        me = Mesh(names[mi])
        me.positions = [(p.x, p.y, p.z) for p in (r.getVertexPosition(mi, i) for i in range(int(r.getVertexPositionCount(mi))))]
        me.uvs = [(t.u, t.v) for t in (r.getVertexTextureCoordinate(mi, i) for i in range(int(r.getVertexTextureCoordinateCount(mi))))]
        me.normals = [(t.x, t.y, t.z) for t in (r.getVertexNormal(mi, i) for i in range(int(r.getVertexNormalCount(mi))))]
        for li in range(int(r.getVertexLayoutCount(mi))):
            lay = r.getVertexLayout(mi, li)
            me.layouts.append((int(lay.position), int(lay.textureCoordinate), int(lay.normal)))
        me.faces = [[int(x) for x in r.getFaceVertexLayoutIndices(mi, f)] for f in range(int(r.getFaceCount(mi)))]
        for v in range(int(r.getSkinWeightsCount(mi))):
            me.influences.append(list(zip((int(j) for j in r.getSkinWeightsJointIndices(mi, v)), (float(w) for w in r.getSkinWeightsValues(mi, v)))))
        if have_blend:
            for ti in range(int(r.getBlendShapeTargetCount(mi))):
                ch = int(r.getBlendShapeChannelIndex(mi, ti))
                cname = str(r.getBlendShapeChannelName(ch)) if hasattr(r, 'getBlendShapeChannelName') else 'channel_%d' % ch
                vi = [int(x) for x in r.getBlendShapeTargetVertexIndices(mi, ti)]
                de = [(d.x, d.y, d.z) for d in (r.getBlendShapeTargetDelta(mi, ti, k) for k in range(int(r.getBlendShapeTargetDeltaCount(mi, ti))))]
                if vi and len(vi) == len(de):
                    me.targets.append(Target(ch, cname, vi, de))
        m.meshes.append(me)
    return m


def read_dna(path: str, libdir: Optional[str], lod: int, morphs: bool, unit: Optional[str], axes: Optional[Sequence[str]]) -> DnaModel:
    dna = import_dna(libdir)
    stream = dna.FileStream(path, dna.FileStream.AccessMode_Read, dna.FileStream.OpenMode_Binary)
    reader = dna.BinaryStreamReader(stream, dna.DataLayer_All)
    reader.read()
    if not dna.Status.isOk():
        raise SystemExit('cannot read %s: %s' % (path, dna.Status.get().message))
    return model_from_reader(reader, dna, lod, morphs, unit, axes)


def probe(path: str, libdir: Optional[str]) -> None:
    """Header sniff (no bindings needed) and, if the bindings load, a summary of the file and of the API this tool needs."""
    size = os.path.getsize(path)
    with open(path, 'rb') as f:
        head = f.read(16)
    print('file        %s (%.1f MB)' % (path, size / 1048576))
    print('first bytes %s' % head.hex(' '))
    sig = head[:3]
    print('signature   %r %s' % (sig, 'ok (DNA)' if sig == b'DNA' else 'NOT "DNA" - this is not a DNA file (or it is a different container: a .mhpkg is a zip, extract SourceAssets/<Name>.dna first)'))
    if len(head) >= 7:
        print('generation/version if big-endian %d.%d, if little-endian %d.%d (the plausible one is a small number)'
              % (*struct.unpack('>HH', head[3:7]), *struct.unpack('<HH', head[3:7])))
    try:
        dna = import_dna(libdir)
    except SystemExit as e:
        print('\nbindings    NOT available: %s' % e)
        return
    print('\nbindings    %s' % getattr(dna, '__file__', dna))
    stream = dna.FileStream(path, dna.FileStream.AccessMode_Read, dna.FileStream.OpenMode_Binary)
    reader = dna.BinaryStreamReader(stream, dna.DataLayer_All)
    reader.read()
    if not dna.Status.isOk():
        print('read failed: %s' % dna.Status.get().message)
        return
    miss, opt = check_api(reader)
    print('Reader API  missing required: %s' % (miss or 'none'))
    print('            missing optional: %s' % (opt or 'none'))
    if miss:
        return
    m = model_from_reader(reader, dna, 0, False, None, None)
    print('name %r, unit %s, rotation %s, axes x=%s y=%s z=%s, LODs %d' % (m.name, m.unit, m.rot_unit, *m.axes, m.lod_count))
    print('joints %d, LOD0 meshes:' % len(m.joints))
    for me in m.meshes:
        print('  %-28s %6d positions %6d faces %6d layouts %6d weighted vertices' % (me.name, len(me.positions), len(me.faces), len(me.layouts), len(me.influences)))
    names = {j.name.lower() for j in m.joints}
    for k in ('root', 'pelvis', 'spine_01', 'head', 'thigh_l', 'upperarm_l', 'facial_c_jaw'):
        print('  joint %-14s %s' % (k, 'yes' if k in names else 'no'))


# --------------------------------------------------------------------------------------------------------------------
# conversion
# --------------------------------------------------------------------------------------------------------------------
_TARGET_AXIS = {'left': (1, 0, 0), 'right': (-1, 0, 0), 'up': (0, 1, 0), 'down': (0, -1, 0), 'front': (0, 0, 1), 'back': (0, 0, -1)}


def axis_matrix(axes: Sequence[str]) -> Mat3:
    """DNA vector -> glTF vector.  glTF here: +X = the character's left, +Y up, +Z front (a right-handed system)."""
    cols = []
    for a in axes:
        if a not in _TARGET_AXIS:
            raise SystemExit('unknown axis direction %r (use left,right,up,down,front,back)' % a)
        cols.append(_TARGET_AXIS[a])
    m = tuple(cols[c][r] for r in range(3) for c in range(3))
    if abs(m3det(m)) != 1:  # type: ignore
        raise SystemExit('the three DNA axes %s do not span three different directions' % (list(axes),))
    return m  # type: ignore


def topo_order(parents: List[int]) -> List[int]:
    n, seen, order = len(parents), [False] * len(parents), []
    for s in range(n):
        chain, i = [], s
        while 0 <= i < n and not seen[i]:
            seen[i] = True
            chain.append(i)
            i = parents[i]
        order.extend(reversed(chain))
    # parents that were visited later than their children (chain started mid-way): do a clean pass
    pos = {j: k for k, j in enumerate(order)}
    out, done = [], [False] * n

    def visit(i: int, depth: int = 0) -> None:
        if done[i] or depth > n:
            return
        p = parents[i]
        if 0 <= p < n:
            visit(p, depth + 1)
        if not done[i]:
            done[i] = True
            out.append(i)
    for i in order:
        visit(i)
    return out


class Rig:
    """Joints in the final frame (metres, +Y up, +Z front) with WORLD rigid transforms."""

    def __init__(self):
        self.names: List[str] = []
        self.parent: List[int] = []
        self.world: List[Xf] = []

    def index(self, name: str) -> int:
        low = name.lower()
        for i, n in enumerate(self.names):
            if n.lower() == low:
                return i
        return -1

    def add(self, name: str, parent: int, pos: Vec) -> int:
        self.names.append(name)
        self.parent.append(parent)
        self.world.append((I3, pos))
        return len(self.names) - 1


def joint_worlds_dna(joints: List[Joint], space: str, order: str, rot_unit: str) -> List[Xf]:
    """World rigid transforms in the DNA's own frame and unit."""
    k = math.pi / 180.0 if rot_unit == 'degrees' else 1.0
    loc = [(euler_to_m3(j.r[0] * k, j.r[1] * k, j.r[2] * k, order), j.t) for j in joints]
    if space == 'world':
        return loc
    parents = [j.parent for j in joints]
    world: List[Optional[Xf]] = [None] * len(joints)
    for i in topo_order(parents):
        p = parents[i]
        world[i] = loc[i] if p < 0 else xf_mul(world[p], loc[i])  # type: ignore
    return world  # type: ignore


def to_final(xf: Xf, M: Mat3, scale: float) -> Xf:
    t = m3v(M, xf[1])
    return m3mul(M, m3mul(xf[0], m3t(M))), (t[0] * scale, t[1] * scale, t[2] * scale)


def top_influences(pairs: List[Tuple[int, float]], k: int) -> List[Tuple[int, float]]:
    p = [(j, w) for j, w in pairs if w > 1e-7]
    p.sort(key=lambda x: (-x[1], x[0]))
    p = p[:k]
    s = sum(w for _, w in p)
    return [(j, w / s) for j, w in p] if s > 0 else []


def fit_error(rig_world: List[Xf], mesh: Mesh, positions_final: List[Vec], max_samples: int = 3000) -> float:
    """Mean distance (m) between a vertex and the joint that weights it most.  Small for the right interpretation of the joint data."""
    n = len(mesh.influences)
    if n == 0:
        return float('nan')
    step = max(1, n // max_samples)
    tot, cnt = 0.0, 0
    for v in range(0, min(n, len(positions_final)), step):
        inf = mesh.influences[v]
        if not inf:
            continue
        j = max(inf, key=lambda x: x[1])[0]
        if j >= len(rig_world):
            continue
        p, t = positions_final[v], rig_world[j][1]
        tot += math.sqrt((p[0] - t[0]) ** 2 + (p[1] - t[1]) ** 2 + (p[2] - t[2]) ** 2)
        cnt += 1
    return tot / cnt if cnt else float('nan')


# UE5 mannequin-like rest pose (A-pose), metres, +X = character's left, for a head joint at 1.62 m.  Used by --body-stub only.
_STUB_REF_HEAD = 1.62
_STUB = [
    ('root', None, (0, 0, 0)),
    ('pelvis', 'root', (0, 0.97, 0)),
    ('spine_01', 'pelvis', (0, 1.04, 0.005)), ('spine_02', 'spine_01', (0, 1.12, 0.01)), ('spine_03', 'spine_02', (0, 1.21, 0.01)),
    ('spine_04', 'spine_03', (0, 1.30, 0.005)), ('spine_05', 'spine_04', (0, 1.39, 0.0)),
    ('neck_01', 'spine_05', (0, 1.50, 0.0)), ('neck_02', 'neck_01', (0, 1.56, 0.01)),
    ('clavicle_l', 'spine_05', (0.03, 1.46, 0.0)), ('upperarm_l', 'clavicle_l', (0.17, 1.45, 0.0)),
    ('lowerarm_l', 'upperarm_l', (0.37, 1.25, 0.0)), ('hand_l', 'lowerarm_l', (0.55, 1.07, 0.0)),
    ('clavicle_r', 'spine_05', (-0.03, 1.46, 0.0)), ('upperarm_r', 'clavicle_r', (-0.17, 1.45, 0.0)),
    ('lowerarm_r', 'upperarm_r', (-0.37, 1.25, 0.0)), ('hand_r', 'lowerarm_r', (-0.55, 1.07, 0.0)),
    ('thigh_l', 'pelvis', (0.09, 0.93, 0.0)), ('calf_l', 'thigh_l', (0.09, 0.52, 0.005)),
    ('foot_l', 'calf_l', (0.09, 0.08, -0.02)), ('ball_l', 'foot_l', (0.09, 0.02, 0.10)),
    ('thigh_r', 'pelvis', (-0.09, 0.93, 0.0)), ('calf_r', 'thigh_r', (-0.09, 0.52, 0.005)),
    ('foot_r', 'calf_r', (-0.09, 0.08, -0.02)), ('ball_r', 'foot_r', (-0.09, 0.02, 0.10)),
]


def add_body_stub(rig: Rig) -> List[str]:
    """Add the missing UE5 body joints (no mesh).  Returns the names added."""
    head = rig.index('head')
    if head < 0:
        raise SystemExit('--body-stub needs a joint named "head" to scale the body to; this DNA has none')
    s = rig.world[head][1][1] / _STUB_REF_HEAD
    if not (0.6 < s < 1.5):
        log('warning: head joint at %.2f m - the stub body will be scaled by %.2f' % (rig.world[head][1][1], s))
    added: List[str] = []
    for name, par, pos in _STUB:
        if rig.index(name) >= 0:
            continue
        if par is None:
            continue
        pi = rig.index(par)
        if pi < 0 and par == 'root':
            pi = -1
        elif pi < 0:
            continue
        rig.add(name, pi, (pos[0] * s, pos[1] * s, pos[2] * s))
        added.append(name)
    # the spine/neck/head chain must hang below the pelvis, not beside it: re-parent every chain joint that is not under the pelvis
    pel = rig.index('pelvis')

    def under_pelvis(i: int) -> bool:
        while i >= 0:
            if i == pel:
                return True
            i = rig.parent[i]
        return False
    chain = [rig.index(n) for n in ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'spine_04', 'spine_05', 'neck_01', 'neck_02', 'head')]
    chain = [c for c in chain if c >= 0]
    for k in range(1, len(chain)):
        if pel >= 0 and not under_pelvis(chain[k]):
            rig.parent[chain[k]] = chain[k - 1]
            added.append('(%s re-parented under %s)' % (rig.names[chain[k]], rig.names[chain[k - 1]]))
    return added


def ground_proxy(rig: Rig) -> 'OutMesh':
    """A zero-area triangle at sole level, skinned to the feet: draws nothing, but it makes the mesh bounding box reach the floor, which is how the
    game measures a character's height and stands it on the ground.  Without it a head-only GLB would be scaled up to a full body's height and put chin-on-floor."""
    feet = [rig.index(n) for n in ('foot_l', 'foot_r', 'ball_l', 'ball_r')]
    feet = [f for f in feet if f >= 0]
    y0 = min(rig.world[f][1][1] for f in feet) - 0.02 if feet else 0.0
    me = OutMesh('stub_ground_proxy')
    fl, fr = (rig.index('foot_l'), rig.index('foot_r'))
    me.pos = [(-0.09, y0, 0.0), (0.0, y0, 0.0), (0.09, y0, 0.0)]
    me.nrm = [(0.0, 1.0, 0.0)] * 3
    me.uv = [(0.0, 0.0)] * 3
    me.joints = [(max(fr, 0), 0, 0, 0), (max(fl, 0), 0, 0, 0), (max(fl, 0), 0, 0, 0)]
    me.weights = [(1.0, 0.0, 0.0, 0.0)] * 3
    me.tris = [0, 1, 2]
    me.stats = {'over_limit': 0, 'winding_agree': 1.0, 'flipped': 0.0, 'source_vertices': 3}
    return me


class OutMesh:
    def __init__(self, name: str):
        self.name = name
        self.pos: List[Vec] = []
        self.nrm: List[Vec] = []
        self.uv: List[Tuple[float, float]] = []
        self.joints: List[Tuple[int, int, int, int]] = []
        self.weights: List[Tuple[float, float, float, float]] = []
        self.tris: List[int] = []
        self.targets: List[Tuple[str, List[int], List[Vec]]] = []   # (name, sorted output vertex indices, deltas)
        self.stats: Dict[str, float] = {}


def normalize(v: Vec) -> Vec:
    l = math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
    return (v[0] / l, v[1] / l, v[2] / l) if l > 1e-12 else (0.0, 1.0, 0.0)


def smooth_normals(pos: List[Vec], faces: List[List[int]], layouts: List[Tuple[int, int, int]]) -> List[Vec]:
    acc = [[0.0, 0.0, 0.0] for _ in pos]
    for f in faces:
        ids = [layouts[l][0] for l in f]
        for k in range(1, len(ids) - 1):
            a, b, c = pos[ids[0]], pos[ids[k]], pos[ids[k + 1]]
            u, v = (b[0] - a[0], b[1] - a[1], b[2] - a[2]), (c[0] - a[0], c[1] - a[1], c[2] - a[2])
            n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
            for i in (ids[0], ids[k], ids[k + 1]):
                acc[i][0] += n[0]; acc[i][1] += n[1]; acc[i][2] += n[2]
    return [normalize((a[0], a[1], a[2])) for a in acc]


def convert_mesh(me: Mesh, M: Mat3, scale: float, max_inf: int, flip: str, rig_n: int, nearest_joint: Callable[[Vec], int],
                 morphs: bool) -> OutMesh:
    out = OutMesh(me.name)
    P = [tuple(c * scale for c in m3v(M, p)) for p in me.positions]
    normals_src = me.normals if me.normals else smooth_normals([tuple(p) for p in me.positions], me.faces, me.layouts)
    N = [normalize(m3v(M, n)) for n in normals_src]
    uvs = me.uvs if me.uvs else [(0.0, 0.0)]
    # per-position skin weights, limited and renormalised
    over = 0
    skin: List[Tuple[Tuple[int, int, int, int], Tuple[float, float, float, float]]] = []
    for v in range(len(P)):
        raw = me.influences[v] if v < len(me.influences) else []
        raw = [(j, w) for j, w in raw if 0 <= j < rig_n]
        if len([1 for _, w in raw if w > 1e-7]) > max_inf:
            over += 1
        top = top_influences(raw, max_inf)
        if not top:
            top = [(nearest_joint(P[v]), 1.0)]
        top = top + [(0, 0.0)] * (4 - len(top))
        skin.append((tuple(j for j, _ in top[:4]), tuple(w for _, w in top[:4])))  # type: ignore
    # split vertices per (position, uv, normal) layout
    key2out: Dict[Tuple[int, int, int], int] = {}
    lay2out: List[int] = []
    pos2out: List[List[int]] = [[] for _ in P]
    for (pi, ti, ni) in me.layouts:
        k = (pi, ti, ni)
        o = key2out.get(k)
        if o is None:
            o = len(out.pos)
            key2out[k] = o
            out.pos.append(P[pi])
            out.nrm.append(N[ni] if ni < len(N) else N[pi])
            u, v = uvs[ti] if ti < len(uvs) else (0.0, 0.0)
            out.uv.append((u, 1.0 - v))
            out.joints.append(skin[pi][0])
            out.weights.append(skin[pi][1])
            pos2out[pi].append(o)
        lay2out.append(o)
    tris: List[int] = []
    for f in me.faces:
        ids = [lay2out[l] for l in f]
        for k in range(1, len(ids) - 1):
            tris += [ids[0], ids[k], ids[k + 1]]
    # winding: judged against the DNA normals, so a mirrored axis description cannot turn the head inside out
    agree = 0
    total = 0
    step = max(1, (len(tris) // 3) // 2000)
    for t in range(0, len(tris) // 3, step):
        a, b, c = out.pos[tris[3 * t]], out.pos[tris[3 * t + 1]], out.pos[tris[3 * t + 2]]
        u, v = (b[0] - a[0], b[1] - a[1], b[2] - a[2]), (c[0] - a[0], c[1] - a[1], c[2] - a[2])
        n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
        vn = out.nrm[tris[3 * t]]
        d = n[0] * vn[0] + n[1] * vn[1] + n[2] * vn[2]
        if abs(d) > 1e-18:
            total += 1
            agree += d > 0
    frac = agree / total if total else 1.0
    do_flip = flip == 'yes' or (flip == 'auto' and frac < 0.5)
    if do_flip:
        for t in range(0, len(tris), 3):
            tris[t + 1], tris[t + 2] = tris[t + 2], tris[t + 1]
    out.tris = tris
    out.stats = {'over_limit': over, 'winding_agree': (1 - frac) if do_flip else frac, 'flipped': float(do_flip), 'source_vertices': len(P)}
    if morphs:
        for tg in me.targets:
            acc: Dict[int, List[float]] = {}
            for pi, d in zip(tg.indices, tg.deltas):
                if 0 <= pi < len(P):
                    dv = m3v(M, d)
                    dv = (dv[0] * scale, dv[1] * scale, dv[2] * scale)
                    if abs(dv[0]) + abs(dv[1]) + abs(dv[2]) < 1e-9:
                        continue
                    for o in pos2out[pi]:
                        acc[o] = list(dv)
            if acc:
                ids = sorted(acc)
                out.targets.append((tg.name, ids, [tuple(acc[i]) for i in ids]))  # type: ignore
    return out


# --------------------------------------------------------------------------------------------------------------------
# GLB writer
# --------------------------------------------------------------------------------------------------------------------
F32, U32, U16 = 5126, 5125, 5123


class Glb:
    def __init__(self):
        self.bin = bytearray()
        self.views: List[dict] = []
        self.accessors: List[dict] = []

    def view(self, data: bytes, target: Optional[int] = None) -> int:
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data)}
        if target:
            v['target'] = target
        self.bin += data
        self.views.append(v)
        return len(self.views) - 1

    def accessor(self, ctype: int, count: int, atype: str, data: Optional[bytes] = None, target: Optional[int] = None,
                 mn: Optional[list] = None, mx: Optional[list] = None, sparse: Optional[dict] = None) -> int:
        a: dict = {'componentType': ctype, 'count': count, 'type': atype}
        if data is not None:
            a['bufferView'] = self.view(data, target)
        if mn is not None:
            a['min'], a['max'] = mn, mx
        if sparse is not None:
            a['sparse'] = sparse
        self.accessors.append(a)
        return len(self.accessors) - 1


def pack_f32(seq: Sequence[float]) -> bytes:
    a = array.array('f', seq)
    if sys.byteorder == 'big':
        a.byteswap()
    return a.tobytes()


def pack_idx(seq: Sequence[int], code: str) -> bytes:
    a = array.array(code, seq)
    if sys.byteorder == 'big':
        a.byteswap()
    return a.tobytes()


_COLORS = [   # (name regex, base colour, roughness, doubleSided, alpha mode) - placeholders until the real textures are applied
    (r'proxy', (0.0, 0.0, 0.0, 0.0), 1.0, False, 'BLEND'),
    (r'eyeshell|eye_shell|cornea|occlusion|tearline|saliva|eyeedge|eye_edge', (0.9, 0.9, 0.95, 0.15), 0.05, True, 'BLEND'),
    (r'lash|brow', (0.03, 0.025, 0.02, 1.0), 0.6, True, 'MASK'),
    (r'teeth|tongue', (0.85, 0.82, 0.74, 1.0), 0.35, False, 'OPAQUE'),
    (r'eye', (0.92, 0.92, 0.9, 1.0), 0.15, False, 'OPAQUE'),
    (r'.*', (0.62, 0.45, 0.37, 1.0), 0.55, False, 'OPAQUE'),
]


def material_for(name: str) -> dict:
    base = re.sub(r'_?lod\d+_?(mesh)?$', '', name, flags=re.I) or name
    for rx, col, rough, dbl, mode in _COLORS:
        if re.search(rx, base.lower()):
            m = {'name': base, 'pbrMetallicRoughness': {'baseColorFactor': list(col), 'metallicFactor': 0.0, 'roughnessFactor': rough}, 'doubleSided': dbl}
            if mode != 'OPAQUE':
                m['alphaMode'] = mode
                if mode == 'MASK':
                    m['alphaCutoff'] = 0.5
            return m
    raise AssertionError


def build_glb(rig: Rig, meshes: List[OutMesh], extras: dict) -> bytes:
    g = Glb()
    nodes: List[dict] = []
    n_j = len(rig.names)
    local: List[Xf] = []
    for i in range(n_j):
        p = rig.parent[i]
        local.append(rig.world[i] if p < 0 else xf_mul(xf_inv(rig.world[p]), rig.world[i]))
    kids: Dict[int, List[int]] = {}
    for i in range(n_j):
        kids.setdefault(rig.parent[i], []).append(i)
    for i in range(n_j):
        q = m3_to_quat(local[i][0])
        nd: dict = {'name': rig.names[i], 'translation': [local[i][1][0], local[i][1][1], local[i][1][2]], 'rotation': list(q)}
        if i in kids:
            nd['children'] = kids[i]
        nodes.append(nd)
    ibm = []
    for i in range(n_j):
        r, t = xf_inv(rig.world[i])
        ibm += [r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, t[0], t[1], t[2], 1]    # column-major
    ibm_acc = g.accessor(F32, n_j, 'MAT4', pack_f32(ibm))
    roots = kids.get(-1, [])
    skin = {'joints': list(range(n_j)), 'inverseBindMatrices': ibm_acc, 'name': 'dna_skeleton'}
    if roots:
        skin['skeleton'] = roots[0]
    gl_meshes, gl_materials = [], []
    scene_nodes = list(roots)
    for me in meshes:
        flat = [c for p in me.pos for c in p]
        mn = [min(p[k] for p in me.pos) for k in range(3)]
        mx = [max(p[k] for p in me.pos) for k in range(3)]
        att = {
            'POSITION': g.accessor(F32, len(me.pos), 'VEC3', pack_f32(flat), 34962, mn, mx),
            'NORMAL': g.accessor(F32, len(me.nrm), 'VEC3', pack_f32([c for n in me.nrm for c in n]), 34962),
            'TEXCOORD_0': g.accessor(F32, len(me.uv), 'VEC2', pack_f32([c for u in me.uv for c in u]), 34962),
            'JOINTS_0': g.accessor(U16, len(me.joints), 'VEC4', pack_idx([c for j in me.joints for c in j], 'H'), 34962),
            'WEIGHTS_0': g.accessor(F32, len(me.weights), 'VEC4', pack_f32([c for w in me.weights for c in w]), 34962),
        }
        big = len(me.pos) > 65535
        idx = g.accessor(U32 if big else U16, len(me.tris), 'SCALAR', pack_idx(me.tris, 'I' if big else 'H'), 34963)
        gl_materials.append(material_for(me.name))
        prim: dict = {'attributes': att, 'indices': idx, 'material': len(gl_materials) - 1, 'mode': 4}
        mesh: dict = {'name': me.name, 'primitives': [prim], 'extras': {'dnaMesh': me.name}}
        if me.targets:
            tg = []
            for (tname, ids, deltas) in me.targets:
                ia = g.view(pack_idx(ids, 'I'))
                va = g.view(pack_f32([c for d in deltas for c in d]))
                tg.append({'POSITION': len(g.accessors)})
                g.accessors.append({'componentType': F32, 'count': len(me.pos), 'type': 'VEC3',
                                    'sparse': {'count': len(ids), 'indices': {'bufferView': ia, 'componentType': U32}, 'values': {'bufferView': va}}})
            prim['targets'] = tg
            mesh['weights'] = [0.0] * len(tg)
            mesh['extras']['targetNames'] = [t[0] for t in me.targets]
        gl_meshes.append(mesh)
        nodes.append({'name': me.name, 'mesh': len(gl_meshes) - 1, 'skin': 0})
        scene_nodes.append(len(nodes) - 1)
    doc = {
        'asset': {'version': '2.0', 'generator': 'dna2glb.py (Nyghtshade Hollow)', 'extras': extras},
        'scene': 0, 'scenes': [{'name': 'dna', 'nodes': scene_nodes}],
        'nodes': nodes, 'skins': [skin], 'meshes': gl_meshes, 'materials': gl_materials,
        'accessors': g.accessors, 'bufferViews': g.views, 'buffers': [{'byteLength': len(g.bin)}],
    }
    js = json.dumps(doc, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    body = bytes(g.bin) + b'\0' * (-len(g.bin) % 4)
    total = 12 + 8 + len(js) + 8 + len(body)
    return b'glTF' + struct.pack('<II', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(body), b'BIN\0') + body


# --------------------------------------------------------------------------------------------------------------------
# the whole conversion
# --------------------------------------------------------------------------------------------------------------------
def convert(model: DnaModel, *, morphs: bool = False, body_stub: bool = False, joint_space: str = 'auto', euler: str = 'xyz',
            flip: str = 'auto', max_inf: int = 4) -> Tuple[bytes, dict]:
    if not model.joints:
        raise SystemExit('the DNA has no joints')
    scale = {'cm': 0.01, 'm': 1.0, 'mm': 0.001}.get(model.unit)
    if scale is None:
        raise SystemExit('unknown translation unit %r (use --unit cm|m)' % model.unit)
    M = axis_matrix(model.axes)
    positions_final = [[tuple(c * scale for c in m3v(M, p)) for p in me.positions] for me in model.meshes]
    cands = ['world', 'local'] if joint_space == 'auto' else [joint_space]
    fits: Dict[str, float] = {}
    worlds: Dict[str, List[Xf]] = {}
    for sp in cands:
        w = [to_final(x, M, scale) for x in joint_worlds_dna(model.joints, sp, euler, model.rot_unit)]
        worlds[sp] = w
        errs = [fit_error(w, me, pf) for me, pf in zip(model.meshes, positions_final)]
        errs = [e for e in errs if not math.isnan(e)]
        fits[sp] = sum(errs) / len(errs) if errs else float('nan')
    if joint_space == 'auto':
        valid = {k: v for k, v in fits.items() if not math.isnan(v)}
        if valid:
            space = min(valid, key=valid.get)  # type: ignore
        else:   # no skin weights to judge by: the head joint of the right reading sits at human height
            def head_h(sp: str) -> float:
                for j, x in zip(model.joints, worlds[sp]):
                    if j.name.lower() == 'head':
                        return x[1][1]
                return 0.0
            space = min(cands, key=lambda s: abs(head_h(s) - 1.6))
    else:
        space = joint_space
    rig = Rig()
    for j, x in zip(model.joints, worlds[space]):
        rig.names.append(j.name)
        rig.parent.append(j.parent)
        rig.world.append(x)
    added: List[str] = []
    if body_stub:
        added = add_body_stub(rig)
    # nearest-joint fallback for vertices without any weight
    def nearest(p: Vec) -> int:
        best, bi = 1e18, 0
        for i, (_, t) in enumerate(rig.world):
            d = (p[0] - t[0]) ** 2 + (p[1] - t[1]) ** 2 + (p[2] - t[2]) ** 2
            if d < best:
                best, bi = d, i
        return bi
    out = [convert_mesh(me, M, scale, max_inf, flip, len(rig.names), nearest, morphs) for me in model.meshes]
    if body_stub:
        out.append(ground_proxy(rig))
    head = rig.index('head')
    info = {
        'dna_name': model.name, 'lod': model.lod, 'unit_in': model.unit, 'axes_in': list(model.axes), 'joint_space': space,
        'joint_fit_m': {k: (None if math.isnan(v) else round(v, 4)) for k, v in fits.items()}, 'euler': euler,
        'joints': len(rig.names), 'stub_joints': added, 'head_height_m': (round(rig.world[head][1][1], 3) if head >= 0 else None),
        'meshes': {o.name: {'vertices': len(o.pos), 'triangles': len(o.tris) // 3, 'morph_targets': len(o.targets),
                            'vertices_over_influence_limit': int(o.stats['over_limit']), 'winding_flipped': bool(o.stats['flipped'])} for o in out},
    }
    extras = {'source': 'MetaHuman DNA', 'dnaName': model.name, 'lod': model.lod, 'units': 'm', 'jointSpace': space, 'influences': max_inf,
              'note': 'untextured geometry+rig from the DNA; apply the package textures separately'}
    return build_glb(rig, out, extras), info


# --------------------------------------------------------------------------------------------------------------------
# --selftest: a synthetic DNA-shaped model, a test double of Epic's Reader, and a GLB reader to check the result
# --------------------------------------------------------------------------------------------------------------------
class NS:
    def __init__(self, **k):
        self.__dict__.update(k)


class FakeDnaModule:
    """Just the enum constants the adapter looks up."""
    TranslationUnit_cm, TranslationUnit_m = 0, 1
    RotationUnit_degrees, RotationUnit_radians = 0, 1
    Direction_left, Direction_right, Direction_up, Direction_down, Direction_front, Direction_back = range(6)


class FakeReader:
    """Implements the slice of Epic's Reader API the adapter uses, over plain Python data."""

    def __init__(self, joints, meshes, lod_of, channels, unit, axes):
        self.j, self.m, self.lod_of, self.ch, self.unit, self.axes = joints, meshes, lod_of, channels, unit, axes

    def getName(self): return 'selftest'
    def getLODCount(self): return 2
    def getTranslationUnit(self): return FakeDnaModule.TranslationUnit_cm if self.unit == 'cm' else FakeDnaModule.TranslationUnit_m
    def getRotationUnit(self): return FakeDnaModule.RotationUnit_degrees
    def getCoordinateSystem(self): return NS(**{k: getattr(FakeDnaModule, 'Direction_' + a) for k, a in zip(('xAxis', 'yAxis', 'zAxis'), self.axes)})
    def getJointCount(self): return len(self.j)
    def getJointName(self, i): return self.j[i].name
    def getJointParentIndex(self, i): return self.j[i].parent if self.j[i].parent >= 0 else i
    def getNeutralJointTranslation(self, i): return NS(x=self.j[i].t[0], y=self.j[i].t[1], z=self.j[i].t[2])
    def getNeutralJointRotation(self, i): return NS(x=self.j[i].r[0], y=self.j[i].r[1], z=self.j[i].r[2])
    def getMeshCount(self): return len(self.m)
    def getMeshName(self, i): return self.m[i].name
    def getMeshIndicesForLOD(self, lod): return [i for i, l in enumerate(self.lod_of) if l == lod]
    def getVertexPositionCount(self, mi): return len(self.m[mi].positions)
    def getVertexPosition(self, mi, i): p = self.m[mi].positions[i]; return NS(x=p[0], y=p[1], z=p[2])
    def getVertexTextureCoordinateCount(self, mi): return len(self.m[mi].uvs)
    def getVertexTextureCoordinate(self, mi, i): u = self.m[mi].uvs[i]; return NS(u=u[0], v=u[1])
    def getVertexNormalCount(self, mi): return len(self.m[mi].normals)
    def getVertexNormal(self, mi, i): n = self.m[mi].normals[i]; return NS(x=n[0], y=n[1], z=n[2])
    def getVertexLayoutCount(self, mi): return len(self.m[mi].layouts)
    def getVertexLayout(self, mi, i): l = self.m[mi].layouts[i]; return NS(position=l[0], textureCoordinate=l[1], normal=l[2])
    def getFaceCount(self, mi): return len(self.m[mi].faces)
    def getFaceVertexLayoutIndices(self, mi, f): return self.m[mi].faces[f]
    def getSkinWeightsCount(self, mi): return len(self.m[mi].influences)
    def getSkinWeightsValues(self, mi, v): return [w for _, w in self.m[mi].influences[v]]
    def getSkinWeightsJointIndices(self, mi, v): return [j for j, _ in self.m[mi].influences[v]]
    def getBlendShapeChannelCount(self): return len(self.ch)
    def getBlendShapeChannelName(self, c): return self.ch[c]
    def getBlendShapeTargetCount(self, mi): return len(self.m[mi].targets)
    def getBlendShapeChannelIndex(self, mi, t): return self.m[mi].targets[t].channel
    def getBlendShapeTargetDeltaCount(self, mi, t): return len(self.m[mi].targets[t].deltas)
    def getBlendShapeTargetDelta(self, mi, t, k): d = self.m[mi].targets[t].deltas[k]; return NS(x=d[0], y=d[1], z=d[2])
    def getBlendShapeTargetVertexIndices(self, mi, t): return self.m[mi].targets[t].indices


# joint table in the final frame, centimetres: (name, parent, x [+ = character's left], y, z [+ = front])
_SYN_JOINTS = [
    ('root', None, 0, 0, 0), ('pelvis', 'root', 0, 97, 0),
    ('spine_01', 'pelvis', 0, 104, 0.5), ('spine_02', 'spine_01', 0, 112, 1), ('spine_03', 'spine_02', 0, 121, 1),
    ('spine_04', 'spine_03', 0, 130, 0.5), ('spine_05', 'spine_04', 0, 139, 0), ('neck_01', 'spine_05', 0, 150, 0),
    ('neck_02', 'neck_01', 0, 156, 1), ('head', 'neck_02', 0, 162, 1),
    ('clavicle_l', 'spine_05', 3, 146, 0), ('upperarm_l', 'clavicle_l', 17, 145, 0), ('lowerarm_l', 'upperarm_l', 37, 125, 0), ('hand_l', 'lowerarm_l', 55, 107, 0),
    ('clavicle_r', 'spine_05', -3, 146, 0), ('upperarm_r', 'clavicle_r', -17, 145, 0), ('lowerarm_r', 'upperarm_r', -37, 125, 0), ('hand_r', 'lowerarm_r', -55, 107, 0),
    ('thigh_l', 'pelvis', 9, 93, 0), ('calf_l', 'thigh_l', 9, 52, 0.5), ('foot_l', 'calf_l', 9, 8, -2), ('ball_l', 'foot_l', 9, 2, 10),
    ('thigh_r', 'pelvis', -9, 93, 0), ('calf_r', 'thigh_r', -9, 52, 0.5), ('foot_r', 'calf_r', -9, 8, -2), ('ball_r', 'foot_r', -9, 2, 10),
    ('FACIAL_C_FacialRoot', 'head', 0, 165, 3), ('FACIAL_C_Jaw', 'FACIAL_C_FacialRoot', 0, 159, 4),
    ('FACIAL_L_Eye', 'FACIAL_C_FacialRoot', 3.2, 166, 9), ('FACIAL_R_Eye', 'FACIAL_C_FacialRoot', -3.2, 166, 9),
    ('FACIAL_L_LipCorner', 'FACIAL_C_Jaw', 2.5, 157, 9.5), ('FACIAL_R_LipCorner', 'FACIAL_C_Jaw', -2.5, 157, 9.5),
    ('FACIAL_C_LipUpper', 'FACIAL_C_FacialRoot', 0, 158.5, 10.5), ('FACIAL_C_Brow', 'FACIAL_C_FacialRoot', 0, 170, 9),
]


def _sphere(name: str, center: Vec, radii: Vec, nu: int, nv: int, weigh: Callable[[Vec], List[Tuple[int, float]]], nose: float = 0.0) -> Mesh:
    """A UV sphere made of quads (triangles at the poles), seam duplicated in UV space, optional nose bump towards +z."""
    me = Mesh(name)
    ring = []
    me.positions.append((center[0], center[1] + radii[1], center[2]))
    for j in range(1, nv):
        th = math.pi * j / nv
        for i in range(nu):
            ph = 2 * math.pi * i / nu
            x, y, z = math.sin(th) * math.sin(ph), math.cos(th), math.sin(th) * math.cos(ph)
            bump = nose * math.exp(-(((x) ** 2 + (y - 0.05) ** 2) / 0.03)) if z > 0 else 0.0
            me.positions.append((center[0] + x * radii[0], center[1] + y * radii[1], center[2] + z * radii[2] + bump))
            ring.append((j, i))
    me.positions.append((center[0], center[1] - radii[1], center[2]))
    top, bot = 0, len(me.positions) - 1
    pid = lambda j, i: 1 + (j - 1) * nu + (i % nu)
    for k, p in enumerate(me.positions):                                        # normals: radial (smooth)
        d = ((p[0] - center[0]) / radii[0], (p[1] - center[1]) / radii[1], (p[2] - center[2]) / radii[2])
        me.normals.append(normalize(d))
    lay: Dict[Tuple[int, int, int], int] = {}

    def L(p: int, ui: int, vj: int) -> int:                                     # layout with its own uv index (seam: ui == nu is a second column)
        uvi = vj * (nu + 1) + ui
        k = (p, uvi, p)
        if k not in lay:
            lay[k] = len(me.layouts)
            me.layouts.append(k)
        return lay[k]
    for vj in range(nv + 1):
        for ui in range(nu + 1):
            me.uvs.append((ui / nu, 1 - vj / nv))
    for i in range(nu):
        me.faces.append([L(top, i, 0), L(pid(1, i + 1), i + 1, 1), L(pid(1, i), i, 1)])
        for j in range(1, nv - 1):
            me.faces.append([L(pid(j, i), i, j), L(pid(j, i + 1), i + 1, j), L(pid(j + 1, i + 1), i + 1, j + 1), L(pid(j + 1, i), i, j + 1)])
        me.faces.append([L(bot, i, nv), L(pid(nv - 1, i), i, nv - 1), L(pid(nv - 1, i + 1), i + 1, nv - 1)])
    me.influences = [weigh(p) for p in me.positions]
    return me


def synthetic_model(space: str, axes: Tuple[str, str, str], unit: str = 'cm', lod_extra: bool = True, with_morphs: bool = True):
    """A DNA-shaped model: UE5/MetaHuman joint names, head/teeth/eyes/lashes meshes (+ a LOD1 head), 6-8 influences per vertex,
    blend shapes.  Data is written the way a DNA would hold it for the given joint space and axis description."""
    names = [j[0] for j in _SYN_JOINTS]
    idx = {n: i for i, n in enumerate(names)}
    # final-frame (cm, +X left, +Y up, +Z front) -> DNA axes: a mirror when the DNA calls +x "right"
    flip_x = axes[0] == 'right'
    sx = -1.0 if flip_x else 1.0
    w_pos = [(j[2], j[3], j[4]) for j in _SYN_JOINTS]
    # joint rotations: a few single-axis spins in the DNA frame (only without mirroring - a mirrored frame keeps them zero)
    rot = {n: (0.0, 0.0, 0.0) for n in names}
    if not flip_x:
        rot.update({'upperarm_l': (0.0, 0.0, -45.0), 'upperarm_r': (0.0, 0.0, 45.0), 'FACIAL_C_Jaw': (12.0, 0.0, 0.0), 'foot_l': (0.0, 8.0, 0.0)})
    jts: List[Joint] = []
    for n, par, x, y, z in _SYN_JOINTS:
        p = idx[par] if par else -1
        if space == 'world':
            t = (x * sx, y, z)
        else:   # local data: translation relative to the parent's frame - build with the same FK the converter will undo
            t = (x * sx, y, z)   # placeholder, fixed below
        jts.append(Joint(n, p, t, rot[n]))
    if space == 'local':
        # choose local translations so that the FK result (with the rotations above) puts every joint where w_pos says
        worlds: List[Optional[Xf]] = [None] * len(jts)
        order = topo_order([j.parent for j in jts])
        for i in order:
            j = jts[i]
            R = euler_to_m3(*(math.radians(a) for a in j.r), 'xyz')
            tgt = (w_pos[i][0] * sx, w_pos[i][1], w_pos[i][2])
            if j.parent < 0:
                j.t = tgt
                worlds[i] = (R, tgt)
            else:
                pw = worlds[j.parent]
                d = (tgt[0] - pw[1][0], tgt[1] - pw[1][1], tgt[2] - pw[1][2])
                j.t = m3v(m3t(pw[0]), d)
                worlds[i] = xf_mul(pw, (R, j.t))

    def J(n: str) -> int: return idx[n]

    def head_w(p: Vec) -> List[Tuple[int, float]]:                              # 8 influences, deliberately not summing to 1
        c = [('FACIAL_C_Jaw', (159, 4)), ('head', (162, 1)), ('FACIAL_L_LipCorner', (157, 9.5)), ('FACIAL_R_LipCorner', (157, 9.5)),
             ('FACIAL_C_LipUpper', (158.5, 10.5)), ('FACIAL_C_Brow', (170, 9)), ('neck_02', (156, 1)), ('FACIAL_C_FacialRoot', (165, 3))]
        ws = [(J(n), 1.0 / (0.5 + math.dist((p[1], p[2]), yz) + 0.0 * p[0] ** 2) ** 2) for n, yz in c]
        s = sum(w for _, w in ws)
        return [(j, 0.9 * w / s) for j, w in ws]
    def one(n: str):
        return lambda p: [(J(n), 1.0)]
    # build the shapes in the final frame (cm), then express them in the DNA frame (mirror x when needed)
    meshes: List[Mesh] = []
    lod_of: List[int] = []
    meshes.append(_sphere('head_lod0_mesh', (0, 164, 1), (8.5, 11.5, 9.5), 24, 16, head_w, nose=2.0))
    meshes.append(_sphere('teeth_lod0_mesh', (0, 158.5, 5), (3.5, 1.2, 1.6), 12, 6, one('FACIAL_C_Jaw')))
    meshes.append(_sphere('eyeLeft_lod0_mesh', (3.2, 166, 9.6), (1.3, 1.3, 1.3), 12, 8, one('FACIAL_L_Eye')))
    meshes.append(_sphere('eyeRight_lod0_mesh', (-3.2, 166, 9.6), (1.3, 1.3, 1.3), 12, 8, one('FACIAL_R_Eye')))
    meshes.append(_sphere('eyelashes_lod0_mesh', (0, 167.8, 10.3), (5.0, 0.4, 0.6), 12, 4, one('FACIAL_C_FacialRoot')))
    lod_of += [0, 0, 0, 0, 0]
    if lod_extra:
        meshes.append(_sphere('head_lod1_mesh', (0, 164, 1), (8.5, 11.5, 9.5), 12, 8, head_w, nose=2.0))
        lod_of.append(1)
    channels = ['jawOpen', 'browRaise', 'smileLeft']
    if with_morphs:
        h = meshes[0]
        for ci, (c, region) in enumerate(zip(channels, ((158, 5), (170, 9), (157, 9.5)))):
            ids, de = [], []
            for pi, p in enumerate(h.positions):
                d = math.dist((p[1], p[2]), region)
                if d < 5:
                    ids.append(pi)
                    de.append(((0.2 * (5 - d)) * (1 if ci != 2 else p[0] / 8), -0.5 * (5 - d) * (1 if ci == 0 else 0.2), 0.1 * (5 - d)))
            h.targets.append(Target(ci, c, ids, de))
    # mirror into the DNA frame if requested (positions, normals, morph deltas); winding indices stay as they are
    if flip_x:
        for me in meshes:
            me.positions = [(-p[0], p[1], p[2]) for p in me.positions]
            me.normals = [(-n[0], n[1], n[2]) for n in me.normals]
            for t in me.targets:
                t.deltas = [(-d[0], d[1], d[2]) for d in t.deltas]
    return jts, meshes, lod_of, channels


def read_glb(data: bytes) -> Tuple[dict, bytes]:
    assert data[:4] == b'glTF' and struct.unpack('<I', data[4:8])[0] == 2, 'not a glb v2'
    assert struct.unpack('<I', data[8:12])[0] == len(data), 'glb length field wrong'
    jl, jt = struct.unpack('<I4s', data[12:20])
    assert jt == b'JSON'
    doc = json.loads(data[20:20 + jl])
    off = 20 + jl
    bl, bt = struct.unpack('<I4s', data[off:off + 8])
    assert bt == b'BIN\0'
    return doc, data[off + 8: off + 8 + bl]


def _acc(doc: dict, binb: bytes, i: int):
    a = doc['accessors'][i]
    comp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    code = {F32: 'f', U32: 'I', U16: 'H'}[a['componentType']]
    n = a['count'] * comp
    out: List[float] = []
    if 'bufferView' in a:
        v = doc['bufferViews'][a['bufferView']]
        arr = array.array(code)
        arr.frombytes(binb[v['byteOffset']: v['byteOffset'] + n * arr.itemsize])
        out = list(arr)
    else:
        out = [0.0] * n
    if 'sparse' in a:
        sp = a['sparse']
        iv, vv = doc['bufferViews'][sp['indices']['bufferView']], doc['bufferViews'][sp['values']['bufferView']]
        ia = array.array({U32: 'I', U16: 'H', 5121: 'B'}[sp['indices']['componentType']])
        ia.frombytes(binb[iv['byteOffset']: iv['byteOffset'] + sp['count'] * ia.itemsize])
        va = array.array(code)
        va.frombytes(binb[vv['byteOffset']: vv['byteOffset'] + sp['count'] * comp * va.itemsize])
        for k, vi in enumerate(ia):
            for c in range(comp):
                out[vi * comp + c] = va[k * comp + c]
    return out, comp


def verify_glb(data: bytes, expect_morphs: bool, label: str) -> List[Tuple[str, bool, str]]:
    """Independent checks of a produced GLB (own parser, nothing shared with the writer except the file)."""
    res: List[Tuple[str, bool, str]] = []

    def ck(name: str, ok: bool, detail: str = '') -> None:
        res.append((label + ': ' + name, bool(ok), detail))
    doc, binb = read_glb(data)
    ck('glb container (magic, version, lengths, JSON+BIN)', True)
    names = [n['name'] for n in doc['nodes']]
    skin = doc['skins'][0]
    jn = skin['joints']
    ck('one skin, joint nodes carry the DNA names', all(x in names for x in ('pelvis', 'spine_01', 'head', 'thigh_l', 'upperarm_r', 'FACIAL_C_Jaw')), '%d joints' % len(jn))
    meshes = {m['name']: m for m in doc['meshes']}
    ck('LOD0 meshes present as separate named meshes with one primitive each',
       all(k in meshes for k in ('head_lod0_mesh', 'teeth_lod0_mesh', 'eyeLeft_lod0_mesh', 'eyeRight_lod0_mesh', 'eyelashes_lod0_mesh')) and all(len(m['primitives']) == 1 for m in meshes.values()),
       ', '.join(meshes))
    ck('LOD1 mesh not exported', not any('lod1' in k for k in meshes))
    ck('material names = mesh names without _lodN_mesh', [m['name'] for m in doc['materials']][:2] == ['head', 'teeth'], str([m['name'] for m in doc['materials']]))
    # world matrices of the joint nodes
    children = {i: n.get('children', []) for i, n in enumerate(doc['nodes'])}
    parent = {c: p for p, cs in children.items() for c in cs}
    worldc: Dict[int, Xf] = {}

    def world(i: int) -> Xf:
        if i in worldc:
            return worldc[i]
        n = doc['nodes'][i]
        x, y, z, w = n.get('rotation', [0, 0, 0, 1])
        R: Mat3 = (1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
                   2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y))
        loc = (R, tuple(n.get('translation', [0, 0, 0])))
        worldc[i] = loc if i not in parent else xf_mul(world(parent[i]), loc)  # type: ignore
        return worldc[i]
    head_y = world(names.index('head'))[1][1]
    pel_y = world(names.index('pelvis'))[1][1]
    ck('metres, +Y up: head joint 1.4-1.9 m, above the pelvis', 1.4 < head_y < 1.9 and head_y > pel_y > 0.7, 'head %.3f m, pelvis %.3f m' % (head_y, pel_y))
    sides = [(n, world(names.index(n))[1][0]) for n in ('upperarm_l', 'thigh_l', 'hand_l', 'FACIAL_L_Eye', 'upperarm_r', 'thigh_r', 'hand_r', 'FACIAL_R_Eye') if n in names]
    ck("left/right: the character's left joints sit on +X, the right ones on -X (facing +Z)",
       len(sides) >= 6 and all((x > 0) == n.endswith('_l') or (x > 0) == ('_L_' in n) for n, x in sides), ', '.join('%s %.2f' % (n, x) for n, x in sides[:4]))
    ibm, _ = _acc(doc, binb, skin['inverseBindMatrices'])
    ok_ibm = True
    for k, j in enumerate(jn):
        W = world(j)
        m = ibm[k * 16:(k + 1) * 16]
        R = (m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10])
        t = (m[12], m[13], m[14])
        comp = xf_mul((R, t), W)
        if any(abs(a - b) > 1e-5 for a, b in zip(comp[0], I3)) or any(abs(c) > 1e-5 for c in comp[1]):
            ok_ibm = False
    ck('inverse bind matrix x node world matrix = identity for every joint', ok_ibm)
    for mname, m in meshes.items():
        prim = m['primitives'][0]
        at = prim['attributes']
        pos, _ = _acc(doc, binb, at['POSITION'])
        jv, _ = _acc(doc, binb, at['JOINTS_0'])
        wv, _ = _acc(doc, binb, at['WEIGHTS_0'])
        nrm, _ = _acc(doc, binb, at['NORMAL'])
        idx, _ = _acc(doc, binb, prim['indices'])
        n = len(pos) // 3
        sums = [sum(wv[4 * v:4 * v + 4]) for v in range(n)]
        nz = [sum(1 for w in wv[4 * v:4 * v + 4] if w > 0) for v in range(n)]
        ck('%s: weights sum to 1, <= 4 influences, joint indices valid' % mname,
           max(abs(s - 1) for s in sums) < 1e-5 and max(nz) <= 4 and max(jv) < len(jn), 'max |sum-1| %.1e, max influences %d' % (max(abs(s - 1) for s in sums), max(nz)))
        # bind pose: sum w * (W_j * IBM_j * v) == v
        worst = 0.0
        for v in range(0, n, max(1, n // 200)):
            p = pos[3 * v:3 * v + 3]
            acc3 = [0.0, 0.0, 0.0]
            for k in range(4):
                w = wv[4 * v + k]
                if w == 0:
                    continue
                kk = int(jv[4 * v + k])
                mm = ibm[kk * 16:(kk + 1) * 16]
                lp = (mm[0] * p[0] + mm[4] * p[1] + mm[8] * p[2] + mm[12], mm[1] * p[0] + mm[5] * p[1] + mm[9] * p[2] + mm[13], mm[2] * p[0] + mm[6] * p[1] + mm[10] * p[2] + mm[14])
                W = world(jn[kk])
                wp = m3v(W[0], lp)
                for c in range(3):
                    acc3[c] += w * (wp[c] + W[1][c])
            worst = max(worst, max(abs(acc3[c] - p[c]) for c in range(3)))
        ck('%s: skinning at the bind pose reproduces the mesh' % mname, worst < 1e-4, 'worst error %.2e m' % worst)
        # winding vs normals
        agree = tot = 0
        for t in range(len(idx) // 3):
            a, b, c = (pos[3 * idx[3 * t + k]: 3 * idx[3 * t + k] + 3] for k in range(3))
            u, w2 = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
            nn = (u[1] * w2[2] - u[2] * w2[1], u[2] * w2[0] - u[0] * w2[2], u[0] * w2[1] - u[1] * w2[0])
            vn = nrm[3 * idx[3 * t]: 3 * idx[3 * t] + 3]
            d = sum(nn[i] * vn[i] for i in range(3))
            if abs(d) > 1e-18:
                tot += 1
                agree += d > 0
        if mname != 'stub_ground_proxy':
            ck('%s: triangle winding agrees with the normals (%d tris)' % (mname, tot), tot > 0 and agree / tot > 0.99, '%.1f %%' % (100 * agree / max(tot, 1)))
        if mname in ('eyeLeft_lod0_mesh', 'eyeRight_lod0_mesh'):
            cx = sum(pos[0::3]) / n
            ck('%s sits on the %s side' % (mname, 'character-left +X' if 'Left' in mname else 'character-right -X'), (cx > 0) == ('Left' in mname) and abs(cx) > 0.01, 'centre x %.3f m' % cx)
        if mname == 'head_lod0_mesh':
            xs, ys, zs = pos[0::3], pos[1::3], pos[2::3]
            ck('head: 0.2-0.3 m tall, nose points to +Z, centred on x=0',
               0.2 < max(ys) - min(ys) < 0.3 and max(zs) > abs(min(zs)) and abs((max(xs) + min(xs)) / 2) < 0.01,
               'height %.3f m, z range %.3f..%.3f' % (max(ys) - min(ys), min(zs), max(zs)))
            uv, _ = _acc(doc, binb, at['TEXCOORD_0'])
            top = max(range(n), key=lambda v: ys[v])
            bottom = min(range(n), key=lambda v: ys[v])
            ck('head: UV origin is glTF top-left (top of the head v~0, chin v~1)', uv[2 * top + 1] < 0.1 and uv[2 * bottom + 1] > 0.9, 'v(top) %.2f, v(chin) %.2f' % (uv[2 * top + 1], uv[2 * bottom + 1]))
            if expect_morphs:
                tg = prim.get('targets', [])
                dense, _ = _acc(doc, binb, tg[0]['POSITION']) if tg else ([], 0)
                jaw, _ = _acc(doc, binb, tg[0]['POSITION'])
                smile, _ = _acc(doc, binb, tg[2]['POSITION'])
                jy = [jaw[3 * v + 1] for v in range(n) if jaw[3 * v + 1] != 0]
                sx_ = [(smile[3 * v], xs[v]) for v in range(n) if smile[3 * v] != 0 and abs(xs[v]) > 0.005]
                ck('head: morph deltas are metres and follow the axis mapping (jaw opens down, smile-left moves +X side outwards)',
                   jy and 0.0005 < max(abs(x) for x in jy) < 0.03 and sum(jy) < 0 and sx_ and all(d * x > 0 for d, x in sx_),
                   'jaw dy mean %.4f m, %d smile deltas on the +/-X sides' % (sum(jy) / max(len(jy), 1), len(sx_)))
                ck('head: blend shapes exported as sparse morph targets with names', len(tg) == 3 and m['extras']['targetNames'] == ['jawOpen', 'browRaise', 'smileLeft'] and any(abs(x) > 0 for x in dense),
                   '%d targets, %d non-zero deltas in the first' % (len(tg), sum(1 for x in dense if x)))
            else:
                ck('head: no morph targets by default', 'targets' not in prim)
    return res


def selftest(keep: Optional[str]) -> int:
    import tempfile
    results: List[Tuple[str, bool, str]] = []
    variants = [
        ('A world-space joints, axes left/up/front', 'world', ('left', 'up', 'front'), {}),
        ('B parent-relative joints, axes left/up/front', 'local', ('left', 'up', 'front'), {}),
        ('C world-space, mirrored axes right/up/front, metres', 'world', ('right', 'up', 'front'), {'unit': 'm'}),
    ]
    out_dir = keep or tempfile.mkdtemp(prefix='dna2glb-selftest-')
    os.makedirs(out_dir, exist_ok=True)
    for label, space, axes, extra in variants:
        jts, meshes, lod_of, channels = synthetic_model(space, axes)
        unit = extra.get('unit', 'cm')
        if unit == 'm':   # the same data, written in metres
            for j in jts:
                j.t = tuple(c / 100 for c in j.t)  # type: ignore
            for me in meshes:
                me.positions = [tuple(c / 100 for c in p) for p in me.positions]  # type: ignore
                for t in me.targets:
                    t.deltas = [tuple(c / 100 for c in d) for d in t.deltas]  # type: ignore
        reader = FakeReader(jts, meshes, lod_of, channels, unit, axes)
        for morphs in (False, True):
            model = model_from_reader(reader, FakeDnaModule, lod=0, morphs=morphs)
            glb, info = convert(model, morphs=morphs)
            tag = '%s%s' % (label.split()[0], '+morphs' if morphs else '')
            results.append((tag + ': joint space detected as %s' % space, info['joint_space'] == space, json.dumps(info['joint_fit_m'])))
            results += verify_glb(glb, morphs, tag)
            with open(os.path.join(out_dir, 'selftest-%s.glb' % tag.replace('+', '-')), 'wb') as f:
                f.write(glb)
    # body stub on a head-only skeleton
    jts, meshes, lod_of, channels = synthetic_model('world', ('left', 'up', 'front'))
    keep_names = {'root', 'spine_05', 'neck_01', 'neck_02', 'head'} | {j.name for j in jts if j.name.startswith('FACIAL')}
    keep_idx = [i for i, j in enumerate(jts) if j.name in keep_names]
    remap = {old: new for new, old in enumerate(keep_idx)}
    jts2 = []
    for old in keep_idx:
        j = jts[old]
        p = j.parent
        while p >= 0 and p not in remap:
            p = jts[p].parent
        jts2.append(Joint(j.name, remap[p] if p >= 0 else -1, j.t, j.r))
    for me in meshes:
        me.influences = [[(remap[j], w) for j, w in inf if j in remap] for inf in me.influences]
    reader = FakeReader(jts2, meshes, lod_of, channels, 'cm', ('left', 'up', 'front'))
    glb, info = convert(model_from_reader(reader, FakeDnaModule), body_stub=True)
    doc, _ = read_glb(glb)
    nm = [n['name'] for n in doc['nodes']]
    results.append(('stub: head-only DNA gets the UE5 body joints', all(k in nm for k in ('pelvis', 'thigh_l', 'calf_r', 'foot_l', 'upperarm_l', 'hand_r', 'ball_r')), ', '.join(info['stub_joints'][:6]) + ' ...'))
    results += [r for r in verify_glb(glb, False, 'stub')]
    pm = [m for m in doc['meshes'] if m['name'] == 'stub_ground_proxy']
    lo, hi = 1e9, -1e9
    for m in doc['meshes']:
        a = doc['accessors'][m['primitives'][0]['attributes']['POSITION']]
        lo, hi = min(lo, a['min'][1]), max(hi, a['max'][1])
    results.append(('stub: invisible ground proxy makes the mesh bounds span floor to head (the game measures height from them)', len(pm) == 1 and abs(lo) < 0.01 and 1.6 < hi < 1.9,
                    'y %.3f .. %.3f m' % (lo, hi)))
    with open(os.path.join(out_dir, 'selftest-stub.glb'), 'wb') as f:
        f.write(glb)
    # API probe on the test double
    miss, opt = check_api(reader)
    results.append(('adapter: test double implements every required Reader call', not miss, str(miss)))
    bad = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print(('PASS ' if ok else 'FAIL ') + name + (('  [' + detail + ']') if detail and not QUIET else ''))
    print('\n%d checks, %d failed.  Output: %s' % (len(results), len(bad), out_dir))
    print('NOTE: these checks prove the converter and the GLB writer on synthetic, DNA-shaped data.  They do NOT prove that the adapter matches a '
          'real `dna` module or that conventions assumed for real MetaHuman DNA files (joint space, rotation order) hold - see README 3b.')
    return 1 if bad else 0


# --------------------------------------------------------------------------------------------------------------------
def main(argv: Optional[Sequence[str]] = None) -> int:
    global QUIET
    ap = argparse.ArgumentParser(description='MetaHuman DNA -> skinned GLB (see the header of this file)', formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('input', nargs='?')
    ap.add_argument('output', nargs='?')
    ap.add_argument('--lod', type=int, default=0)
    ap.add_argument('--morphs', action='store_true')
    ap.add_argument('--body-stub', action='store_true')
    ap.add_argument('--joint-space', choices=['auto', 'world', 'local'], default='auto')
    ap.add_argument('--euler', choices=['xyz', 'zyx'], default='xyz')
    ap.add_argument('--flip-winding', choices=['auto', 'yes', 'no'], default='auto')
    ap.add_argument('--unit', choices=['cm', 'm'])
    ap.add_argument('--axes')
    ap.add_argument('--max-influences', type=int, default=4)
    ap.add_argument('--dna-lib')
    ap.add_argument('--probe', action='store_true')
    ap.add_argument('--selftest', action='store_true')
    ap.add_argument('--keep')
    ap.add_argument('-q', action='store_true')
    a = ap.parse_args(argv)
    QUIET = a.q
    if a.selftest:
        return selftest(a.keep)
    if not a.input:
        ap.error('INPUT.dna is required (or --selftest)')
    if a.probe:
        probe(a.input, a.dna_lib)
        return 0
    if not a.output:
        ap.error('OUTPUT.glb is required')
    if not 1 <= a.max_influences <= 4:
        ap.error('--max-influences must be 1..4 (a glTF primitive here carries JOINTS_0/WEIGHTS_0 only)')
    axes = a.axes.split(',') if a.axes else None
    if axes is not None and len(axes) != 3:
        ap.error('--axes needs three directions, e.g. left,up,front')
    log('reading %s ...' % a.input)
    model = read_dna(a.input, a.dna_lib, a.lod, a.morphs, a.unit, axes)
    log('%d joints, %d LOD%d meshes, unit %s, axes %s' % (len(model.joints), len(model.meshes), a.lod, model.unit, ','.join(model.axes)))
    glb, info = convert(model, morphs=a.morphs, body_stub=a.body_stub, joint_space=a.joint_space, euler=a.euler, flip=a.flip_winding, max_inf=a.max_influences)
    with open(a.output, 'wb') as f:
        f.write(glb)
    log(json.dumps(info, indent=1))
    log('wrote %s (%.1f MB)' % (a.output, len(glb) / 1048576))
    hh = info['head_height_m']
    if hh is not None and not 1.2 < hh < 2.1:
        log('warning: the head joint is at %.2f m - wrong unit (--unit) or axes (--axes), or a DNA that is not a standing human' % hh)
    if info['joint_space'] and info['joint_fit_m'] and len(info['joint_fit_m']) == 2:
        fv = [v for v in info['joint_fit_m'].values() if v is not None]
        if len(fv) == 2 and max(fv) < 3 * min(fv):
            log('warning: --joint-space auto could not tell world from local data (fit %s); check the result or force --joint-space' % info['joint_fit_m'])
    return 0


if __name__ == '__main__':
    sys.exit(main())
