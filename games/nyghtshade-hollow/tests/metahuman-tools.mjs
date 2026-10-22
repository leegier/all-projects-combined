// Tests for tools/metahuman/optimize.mjs on a stand-in "raw export" whose face lives on its own skeleton (as UE exports a MetaHuman's Face mesh),
// then loads the result in the real game: the face must follow the head, the rig must be driven, the file must be smaller.
// Needs the tool's own dependencies:  (cd tools/metahuman && npm install)   — skipped with a notice when they are missing.
//   node tests/metahuman-tools.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
let tools;
try { tools = await import('../tools/metahuman/optimize.mjs'); }
catch (e) { console.log('SKIP metahuman tool tests: install its dependencies first:  (cd tools/metahuman && npm install)\n  (' + String(e.message).split('\n')[0] + ')'); process.exit(0); }
const { open } = await import('../tools/lib.mjs');
const { optimizeFile, inspectDocument, makeIO } = tools;
let pass = 0, fail = 0; const results = [];
const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; results.push({ name, ok: !!cond, detail }); console.log(cond ? '  ok  ' : '  FAIL', name, cond ? '' : detail); };

const raw = path.join(here, 'fixtures/raw/standin-mh-split.glb'), single = path.join(here, 'fixtures/raw/standin-mh-single.glb');
const tmp = path.join(here, 'fixtures/_tmp'); fs.rmSync(tmp, { recursive: true, force: true });
const dirs = { opt: path.join(tmp, 'opt'), raw: path.join(tmp, 'raw'), single: path.join(tmp, 'single') };
for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });
const skeletons = (info) => new Set(info.skins.map((s) => s.joints + ':' + s.roots.join())).size;

// ---- the file ------------------------------------------------------------------------------------------------------------------------
const io = await makeIO();
const before = inspectDocument(await io.read(raw));
ok('inspect: the raw export is recognised as MetaHuman-style and flagged for its separate face skeleton', before.skins.every((s) => s.rig === 'metahuman') && before.warnings.some((w) => /separate skeletons/.test(w)), JSON.stringify(before.warnings));
ok('inspect: blend shapes in the export are counted and flagged', before.morphTargets >= 12 && before.warnings.some((w) => /morph targets/.test(w)), JSON.stringify({ morphs: before.morphTargets, w: before.warnings }));
const rep = await optimizeFile(raw, path.join(dirs.opt, 'optimized.glb'), { log: () => {}, tex: 512 });
const after = inspectDocument(await io.read(path.join(dirs.opt, 'optimized.glb')));
ok('optimize: skeletons merged (no separate-skeleton warning left) and every skin drives the same joints', !after.warnings.some((w) => /separate skeletons/.test(w)) && new Set(after.skins.map((s) => s.joints)).size === 1, JSON.stringify(after.warnings));
ok('optimize: joints reduced (helpers / twist / fingers / facial collapsed) but the rig stays usable', after.skins[0].joints < before.skins[0].joints && after.skins.every((s) => s.usable && s.missing.length === 0), JSON.stringify({ before: before.skins[0].joints, after: after.skins.map((s) => s.joints) }));
ok('optimize: triangles unchanged without a budget, file much smaller (meshopt)', after.tris === before.tris && rep.bytes.out < rep.bytes.in * 0.5, JSON.stringify(rep.bytes));
ok('optimize: morph targets removed by default (and kept with --keep-morphs)', after.morphTargets === 0 && !after.warnings.some((w) => /morph/.test(w)) && inspectDocument(await io.read((await optimizeFile(raw, path.join(dirs.opt, 'morphs.glb'), { log: () => {}, keepMorphs: true, meshopt: false })).output && path.join(dirs.opt, 'morphs.glb'))).morphTargets >= 12, JSON.stringify({ after: after.morphTargets }));
const doc2 = await io.read(path.join(dirs.opt, 'optimized.glb'));
const jaws = doc2.getRoot().listNodes().filter((n) => /jaw/i.test(n.getName()));
ok('optimize: the face skeleton\'s jaw became one joint under the body\'s head', jaws.length === 1 && jaws[0].getParentNode() && /^head$/i.test(jaws[0].getParentNode().getName()), jaws.map((j) => j.getName()).join());
// socketed static meshes (a badge hung on a facial joint, a radio on a twist joint) must survive the collapse / merge exactly where they were
{
  const wt = (d, name) => { const n = d.getRoot().listNodes().find((x) => x.getName() === name); return n ? { pos: n.getWorldMatrix().slice(12, 15), parent: n.getParentNode() && n.getParentNode().getName(), joint: n.getParentNode() && d.getRoot().listSkins().some((sk) => sk.listJoints().includes(n.getParentNode())) } : null; };
  const rawDoc = await io.read(raw), outP = path.join(dirs.opt, 'sockets.glb');
  await optimizeFile(raw, outP, { log: () => {}, meshopt: false });
  const outDoc = await io.read(outP);
  const res = ['StaticBadge', 'StaticRadio'].map((n) => ({ n, a: wt(rawDoc, n), b: wt(outDoc, n) }));
  const moved = res.map((r) => (r.a && r.b ? Math.hypot(...r.a.pos.map((v, i) => v - r.b.pos[i])) : 9));
  ok('optimize: socketed static meshes stay where they were (≤ 1 mm) and hang from the nearest kept joint (badge → head, radio → upper arm)', moved.every((d) => d < 0.001) && res.every((r) => r.b && r.b.joint) && res[0].b.parent === 'head' && res[1].b.parent === 'upperarm_l', JSON.stringify({ moved, res: res.map((r) => [r.n, r.a && r.a.parent, r.b && r.b.parent, r.b && r.b.joint]) }));
}
const budget = await optimizeFile(raw, path.join(dirs.opt, 'budget.glb'), { log: () => {}, tris: 4000, meshopt: false });
ok('optimize --tris: triangle budget is honoured (±40 %)', budget.after.tris < 4000 * 1.4 && budget.after.tris > 1500, JSON.stringify(budget.after));
const keep = await optimizeFile(single, path.join(dirs.single, 'kept.glb'), { log: () => {}, keepFace: true, keepFingers: true, keepTwist: true, meshopt: false });
ok('optimize --keep-*: nothing is collapsed when asked to keep everything', keep.after.joints[0] >= keep.before.joints[0], JSON.stringify(keep));

// ---- in the game: manifests for the raw split export (negative control), the optimised file and a single-skeleton export -------------------------
fs.copyFileSync(raw, path.join(dirs.raw, 'raw.glb'));
const man = (file) => JSON.stringify({ characters: [{ id: 'x', file, looks: ['*'], height: 1.8 }] });
fs.writeFileSync(path.join(dirs.raw, 'manifest.json'), man('raw.glb'));
fs.writeFileSync(path.join(dirs.opt, 'manifest.json'), man('optimized.glb'));
fs.writeFileSync(path.join(dirs.single, 'manifest.json'), man('kept.glb'));
const probe = async (dir) => {
  const t = await open({ port: 8130, query: `auto&manual&nostart&q=low&crowd=off&chars=/fixtures/_tmp/${dir}/`, log: false });
  const r = await t.page.evaluate(() => {
    try {
    const L = NH_CHARS_LIB; if (!L.enabled) return { error: 'library not enabled: ' + JSON.stringify(L.failed) };
    const P3 = NH.player.pos.constructor, body = L.create('inmateA', { seed: 3 }); NH.world.root.add(body.root);
    const settle = (n) => { for (let i = 0; i < n; i++) body.update(1 / 60, 0, 0, 0); body.root.updateMatrixWorld(true); };
    const hair = body.inst.getObjectByName('Hair_cards'), eyes = body.inst.getObjectByName('Eyes'), face = body.inst.getObjectByName('Face_skin') || body.inst.getObjectByName('Teeth'), head = body.driver.map.head, jawBone = body.driver.map.jaw;
    const local = (mesh, i) => { const v = new P3(); mesh.getVertexPosition(Math.min(i, mesh.geometry.attributes.position.count - 1), v); v.applyMatrix4(mesh.matrixWorld); return head.worldToLocal(v); };
    const badge = body.inst.getObjectByName('StaticBadge'), radio = body.inst.getObjectByName('StaticRadio'), armBone = body.driver.map.L.arm;
    const sock = () => (badge && radio ? [head.worldToLocal(badge.getWorldPosition(new P3())), armBone.worldToLocal(radio.getWorldPosition(new P3()))] : null);
    const sample = () => [local(face, 3), local(face, 30), local(hair, 5), local(hair, 50), local(eyes, 3)];       // head-bound meshes: face skin (or teeth), hair, eyes
    body.setPose('idle'); settle(120); const a = sample(), sa = sock();
    body.setPose('pray'); settle(160); const b = sample(), sb = sock();
    const drift = a.map((p, k) => p.distanceTo(b[k]));
    const sockDrift = sa && sb ? sa.map((p, k) => p.distanceTo(sb[k])) : null;
    const out = { drift, sockDrift, rig: body.template.rig, usable: body.template.usable, bones: body.template.bones, hasJaw: !!jawBone, skins: 0, jawName: jawBone ? jawBone.name : null };
    body.inst.traverse((o) => { if (o.isSkinnedMesh) out.skins++; });
    // jaw opens while talking
    if (jawBone) { body.setPose('idle'); settle(60); const q0 = jawBone.quaternion.clone(); body.talking = 1; for (let i = 0; i < 40; i++) body.update(1 / 60, 0, 0, 0); out.jawMoved = q0.angleTo(jawBone.quaternion); }
    return out;
    } catch (e) { return { error: String(e.stack || e).slice(0, 400) }; }
  });
  await t.close(); return r;
};
const rawR = await probe('raw'), optR = await probe('opt'), oneR = await probe('single');
ok('game: the raw split export loads and its rig is recognised, but the face stays behind when the head moves (why the merge exists)', !rawR.error && rawR.usable && Math.max(...rawR.drift) > 0.05, JSON.stringify(rawR));
ok('game: after optimize.mjs the face and hair follow the head (drift < 1 cm over a pose change)', !optR.error && optR.usable && Math.max(...optR.drift) < 0.01, JSON.stringify(optR));
ok('game: socketed meshes follow their bone after optimising (badge on the head, radio on the arm); in the raw file the badge stays behind', !optR.error && optR.sockDrift && Math.max(...optR.sockDrift) < 0.01 && rawR.sockDrift && rawR.sockDrift[0] > 0.05 && rawR.sockDrift[1] < 0.01, JSON.stringify({ opt: optR.sockDrift, raw: rawR.sockDrift }));
ok('game: the merged jaw joint is found and animates while talking', !optR.error && optR.hasJaw && optR.jawMoved > 0.05, JSON.stringify(optR));
ok('game: a single-skeleton export kept whole works too', !oneR.error && oneR.usable && Math.max(...oneR.drift) < 0.01, JSON.stringify(oneR));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
fs.mkdirSync(path.join(here, '../docs'), { recursive: true });
fs.writeFileSync(path.join(here, '../docs/metahuman-tools-report.json'), JSON.stringify({ generated: new Date().toISOString(), pass, fail, results }, null, 1));
process.exit(fail ? 1 : 0);
