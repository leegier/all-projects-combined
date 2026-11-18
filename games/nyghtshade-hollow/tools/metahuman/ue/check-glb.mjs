// check-glb.mjs - structural check of a GLB written by `mhue export` (or any GLB).
//   node tools/metahuman/ue/check-glb.mjs <file.glb> [--json] [--expect-skin]
// Needs `npm install` in tools/metahuman (uses @gltf-transform/core from there).
// Exit 0 = every skinned primitive has valid JOINTS_0/WEIGHTS_0; 1 = problem; 2 = unreadable.
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
const expectSkin = args.includes('--expect-skin');
if (!file) { console.error('usage: node check-glb.mjs <file.glb> [--json] [--expect-skin]'); process.exit(2); }

let doc;
try {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  doc = await io.read(file);
} catch (e) { console.error('unreadable GLB: ' + e.message); process.exit(2); }

const root = doc.getRoot();
const problems = [];
const report = { file, nodes: root.listNodes().length, meshes: [], skins: [], materials: root.listMaterials().length, textures: root.listTextures().length, extensions: root.listExtensionsUsed().map((e) => e.extensionName) };

for (const skin of root.listSkins()) {
  report.skins.push({ name: skin.getName(), joints: skin.listJoints().length, inverseBindMatrices: !!skin.getInverseBindMatrices() });
  if (!skin.getInverseBindMatrices()) problems.push(`skin ${skin.getName() || '(unnamed)'} has no inverseBindMatrices`);
}
const skinned = new Set(root.listNodes().filter((n) => n.getSkin()).map((n) => n.getMesh()).filter(Boolean));
const jointCount = Math.max(0, ...report.skins.map((s) => s.joints));

for (const mesh of root.listMeshes()) {
  const m = { name: mesh.getName(), skinned: skinned.has(mesh), primitives: [] };
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    const p = { vertices: pos ? pos.getCount() : 0, triangles: idx ? idx.getCount() / 3 : pos ? pos.getCount() / 3 : 0, morphTargets: prim.listTargets().length, uv: !!prim.getAttribute('TEXCOORD_0'), normals: !!prim.getAttribute('NORMAL'), material: prim.getMaterial()?.getName() };
    if (pos) { const min = [], max = []; pos.getMinNormalized?.(min); p.bbox = { min: pos.getMin([]), max: pos.getMax([]) }; }
    const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
    if (m.skinned) {
      if (!J || !W) problems.push(`mesh ${m.name}: skinned but JOINTS_0/WEIGHTS_0 missing`);
      else {
        const a = [0, 0, 0, 0]; const w = [0, 0, 0, 0];
        let minSum = Infinity, maxSum = -Infinity, zero = 0, maxJoint = -1, sum = 0;
        for (let i = 0; i < W.getCount(); i++) {
          W.getElement(i, w); J.getElement(i, a);
          const s = w[0] + w[1] + w[2] + w[3];
          minSum = Math.min(minSum, s); maxSum = Math.max(maxSum, s); sum += s;
          if (s < 1e-6) zero++;
          for (let k = 0; k < 4; k++) if (w[k] > 0) maxJoint = Math.max(maxJoint, a[k]);
        }
        p.skin = { weightSumMin: +minSum.toFixed(5), weightSumMax: +maxSum.toFixed(5), verticesWithoutWeights: zero, maxJointIndexUsed: maxJoint, jointCount };
        if (zero) problems.push(`mesh ${m.name}: ${zero} vertices have no skin weight`);
        if (maxSum > 1.01 || (minSum < 0.99 && zero === 0)) problems.push(`mesh ${m.name}: weights do not sum to 1 (min ${minSum}, max ${maxSum})`);
        if (maxJoint >= jointCount) problems.push(`mesh ${m.name}: joint index ${maxJoint} >= joint count ${jointCount}`);
      }
    }
    m.primitives.push(p);
  }
  report.meshes.push(m);
}
if (expectSkin && !report.skins.length) problems.push('no skin in file but --expect-skin given');
report.problems = problems;

if (asJson) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`${file}: ${report.nodes} nodes, ${report.meshes.length} mesh(es), ${report.skins.length} skin(s), ${report.materials} material(s), ${report.textures} texture(s)`);
  for (const s of report.skins) console.log(`  skin "${s.name}": ${s.joints} joints, inverseBindMatrices=${s.inverseBindMatrices}`);
  for (const m of report.meshes) for (const p of m.primitives)
    console.log(`  mesh "${m.name}"${m.skinned ? ' [skinned]' : ''}: ${p.vertices} verts, ${p.triangles} tris, uv=${p.uv}, normals=${p.normals}, morphTargets=${p.morphTargets}` + (p.skin ? `, weights sum ${p.skin.weightSumMin}..${p.skin.weightSumMax}, max joint ${p.skin.maxJointIndexUsed}/${p.skin.jointCount}` : ''));
  console.log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'OK');
}
process.exit(problems.length ? 1 : 0);
