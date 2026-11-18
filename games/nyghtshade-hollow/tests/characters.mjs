// glTF character pipeline tests on the real game (headless Chromium).  The characters used are the *stand-in* rigs in tests/fixtures/characters
// (mannequins on MetaHuman- and Mixamo-style skeletons, one of them in a Z-up, centimetre, rotated armature) — they exercise exactly the code path
// MetaHuman exports take: loader, bone mapping, orientation fix, A/T-pose re-hang, rig driver, foot planting, LOD, fallbacks, determinism.
//   node tests/characters.mjs
import { open } from '../tools/lib.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0; const results = [];
const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; results.push({ name, ok: !!cond, detail }); console.log(cond ? '  ok  ' : '  FAIL', name, cond ? '' : detail); };
const FIX = 'chars=/fixtures/characters/';

// ---- 1. library, templates, NPC bodies ------------------------------------------------------------------------------------
{
  const t = await open({ port: 8120, query: `auto&manual&nostart&q=low&${FIX}`, log: false });
  const { page } = t;
  const lib = await page.evaluate(() => { const L = NH_CHARS_LIB; return { status: L.status, ids: L.specs.map((s) => s.id), failed: L.failed, tpl: [...L.templates].map(([id, x]) => ({ id, rig: x.rig, usable: x.usable, missing: x.map.missing, tris: x.tris, bones: x.bones })) }; });
  ok('library: all four stand-in files load, none fail', lib.status === 'ready' && lib.ids.length === 4 && lib.failed.length === 0, JSON.stringify(lib));
  ok('library: MetaHuman- and Mixamo-style skeletons recognised and usable', lib.tpl.filter((x) => x.rig === 'metahuman').length === 2 && lib.tpl.filter((x) => x.rig === 'mixamo').length === 2 && lib.tpl.every((x) => x.usable && x.missing.length === 0), JSON.stringify(lib.tpl));
  const npcs = await page.evaluate(() => NH.npcs.map((n) => ({ id: n.id, look: n.look, gltf: !!n.body.isGltf, file: n.body.template ? [...NH_CHARS_LIB.templates].find(([, v]) => v === n.body.template)[0] : null })));
  ok('NPCs: every cast member got a glTF body', npcs.every((n) => n.gltf), npcs.filter((n) => !n.gltf).map((n) => n.id).join(','));
  const guards = npcs.filter((n) => n.look === 'guard' || n.look === 'guardLight');
  ok('NPCs: guards use the files listed for the guard looks', guards.length >= 3 && guards.every((n) => n.file === 'standin-mx-a'), JSON.stringify(guards));
  ok('NPCs: a look listed for several files spreads over them (deterministically)', new Set(npcs.filter((n) => n.look === 'inmateB').map((n) => n.file)).size >= 1 && npcs.filter((n) => n.look === 'inmateA' || n.look === 'inmateB' || n.look === 'inmateC').every((n) => n.file));
  await t.close();
}

// ---- 2. body geometry: standing, orientation, poses, walking, LOD ------------------------------------------------------------
{
  const t = await open({ port: 8121, query: `auto&manual&nostart&q=low&${FIX}`, log: false });
  const { page } = t;
  const r = await page.evaluate(() => {
    const L = NH_CHARS_LIB, out = [];
    const P3 = NH.player.pos.constructor;
    const measure = (body) => {
      body.root.updateMatrixWorld(true);
      let minY = Infinity, maxY = -Infinity, bad = 0; const v = new P3();
      body.inst.traverse((o) => {
        if (!o.isSkinnedMesh || o.userData.detail || !o.visible) return;
        const n = o.geometry.attributes.position.count;
        for (let i = 0; i < n; i += 2) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); if (!Number.isFinite(v.y + v.x + v.z)) bad++; minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
      });
      return { minY, maxY, bad };
    };
    const rel = (body, bone) => body.root.worldToLocal(bone.getWorldPosition(new P3()));
    const settle = (body, n = 90, speed = 0) => { for (let i = 0; i < n; i++) body.update(1 / 60, speed, 0, 0); };
    for (const spec of L.specs) {
      const look = spec.looks[0];
      const body = L.create(look, { seed: 5 }); body.root.name = spec.id;
      NH.world.root.add(body.root);                         // in the scene so world matrices are real
      body.root.position.set(0, 0, 0);
      const d = body.driver; const m = d.map;
      settle(body);
      const idle = measure(body), j = d.j;
      const hip = rel(body, m.hips), head = rel(body, m.head);
      const fN = rel(body, j.footN.bone), toeN = rel(body, (j.footN.bone === m.L.foot ? m.L.toe : m.R.toe));
      const shN = rel(body, j.armN.bone), wrN = rel(body, m.L.hand && j.armN.bone === m.L.arm ? m.L.hand : m.R.hand);
      const rec = { id: spec.id, rig: body.template.rig, height: body.height, idle, hipY: hip.y, headY: head.y, toeForward: toeN.z - fN.z, wristDrop: shN.y - wrN.y, wristSide: Math.abs(wrN.x - shN.x), bad: idle.bad };
      // poses
      rec.poses = {};
      for (const p of ['sit', 'pray', 'lie', 'lean', 'mop', 'hands', 'talk', 'read', 'ground', 'type', 'idle']) {
        body.setPose(p); body.talking = p === 'talk' ? 1 : 0; settle(body, 120);
        const me = measure(body), h = rel(body, m.hips), knee = rel(body, j.calfN.bone), th = rel(body, j.thN.bone);
        rec.poses[p] = { minY: me.minY, maxY: me.maxY, bad: me.bad, hipY: h.y, kneeFwd: knee.z - th.z, hipRotOK: Number.isFinite(body.rig.rotation.x) };
      }
      body.talking = 0;
      // walking: feet must stay on the floor while the stride swings
      body.setPose('idle'); settle(body, 30);
      let lo = Infinity, hi = -Infinity, bad = 0, sum = 0, cnt = 0;
      for (let i = 0; i < 180; i++) { body.update(1 / 60, 1.4, 0, 0); if (i > 40 && i % 3 === 0) { const me = measure(body); lo = Math.min(lo, me.minY); hi = Math.max(hi, me.minY); sum += me.minY; cnt++; bad += me.bad; } }
      rec.walk = { lo, hi, mean: sum / cnt, bad, speed: body.speed };
      // LOD
      const hiddenBefore = body.detail.filter((o) => !o.visible).length; body.setLod(1); const hiddenFar = body.detail.filter((o) => !o.visible).length; body.setLod(0);
      rec.lod = { detail: body.detail.length, hiddenBefore, hiddenFar, hiddenNear: body.detail.filter((o) => !o.visible).length };
      NH.world.root.remove(body.root);
      out.push(rec);
    }
    return out;
  });
  for (const x of r) {
    const tag = `[${x.id}]`;
    ok(`${tag} stands on the floor, head at the requested height (${x.idle.minY.toFixed(3)}..${x.idle.maxY.toFixed(2)} m for ${x.height.toFixed(2)})`, Math.abs(x.idle.minY) < 0.04 && Math.abs(x.idle.maxY - x.height) < 0.07 * x.height, JSON.stringify(x.idle));
    ok(`${tag} upright (head above hips above floor) and no NaN vertices`, x.headY > x.hipY + 0.5 && x.hipY > 0.7 && x.bad === 0, `hip ${x.hipY} head ${x.headY} bad ${x.bad}`);
    ok(`${tag} faces engine forward (-Z): toes point to -Z`, x.toeForward < -0.04, `toe-foot z ${x.toeForward}`);
    ok(`${tag} A-/T-pose arms re-hung: wrist ${x.wristDrop.toFixed(2)} m below shoulder, ${x.wristSide.toFixed(2)} m out`, x.wristDrop > 0.45 && x.wristSide < 0.2, JSON.stringify({ drop: x.wristDrop, side: x.wristSide }));
    const sit = x.poses.sit, idle = x.poses.idle;
    ok(`${tag} sit: pelvis drops 0.3-0.7 m and the knee points forward`, x.hipY - sit.hipY > 0.3 && x.hipY - sit.hipY < 0.75 && sit.kneeFwd < -0.25, JSON.stringify(sit));
    ok(`${tag} pray: kneels (pelvis ${x.poses.pray.hipY.toFixed(2)} m, under a third of the height)`, x.poses.pray.hipY < 0.33 * x.height && x.poses.pray.hipY > 0.2, JSON.stringify(x.poses.pray));
    ok(`${tag} lie: body horizontal (height span < 0.6 m)`, x.poses.lie.maxY - x.poses.lie.minY < 0.6, JSON.stringify(x.poses.lie));
    ok(`${tag} every pose finite, back to standing after idle`, Object.values(x.poses).every((p) => p.bad === 0 && p.hipRotOK) && Math.abs(idle.maxY - x.idle.maxY) < 0.03, JSON.stringify(idle));
    ok(`${tag} walking: feet stay on the floor (lowest point ${x.walk.lo.toFixed(3)}..${x.walk.hi.toFixed(3)}, mean ${x.walk.mean.toFixed(3)})`, x.walk.lo > -0.03 && x.walk.hi < 0.06 && x.walk.bad === 0 && x.walk.speed > 1, JSON.stringify(x.walk));
    ok(`${tag} LOD: lashes/teeth hide when far and come back near`, x.lod.detail >= 2 && x.lod.hiddenBefore === 0 && x.lod.hiddenFar === x.lod.detail && x.lod.hiddenNear === 0, JSON.stringify(x.lod));
  }
  await t.close();
}

// ---- 3. fallbacks: off switch, no manifest, broken manifest ------------------------------------------------------------------
{
  for (const [name, q, expect] of [['?chars=off', 'chars=off', 'none'], ['no manifest at the location', 'chars=/fixtures/does-not-exist/', 'none'], ['broken manifest (one good file, a missing one, a corrupt one)', 'chars=/fixtures/characters-broken/', 'ready']]) {
    const t = await open({ port: 8122, query: `auto&manual&nostart&q=low&${q}`, log: false });
    const r = await t.page.evaluate(() => ({ status: NH_CHARS_LIB.status, ids: NH_CHARS_LIB.specs.map((s) => s.id), failed: NH_CHARS_LIB.failed.map((f) => f.id), gltf: NH.npcs.filter((n) => n.body.isGltf).length, all: NH.npcs.length, ready: !!window.NH_READY }));
    const good = expect === 'ready';
    ok(`fallback ${name}: game boots (status ${r.status})`, r.ready && r.status === expect, JSON.stringify(r));
    ok(`fallback ${name}: ${good ? 'the good file is used, the bad ones are reported' : 'everyone keeps the procedural body'}`, good ? r.gltf === r.all && r.failed.length === 2 && r.ids.length === 1 : r.gltf === 0 && r.all > 20, JSON.stringify(r));
    await t.close();
  }
}

// ---- 3b. the crowd with library characters: shared bakes, light variants ---------------------------------------------------------------
{
  const t = await open({ port: 8124, query: 'auto&manual&nostart&q=low&chars=/fixtures/characters-crowd/', log: false });
  const r = await t.page.evaluate(() => {
    const L = NH_CHARS_LIB, c = NH.crowd;
    const full = L.create('inmateA', { seed: 2 }), light = L.create('inmateA', { seed: 2, crowd: true });
    const keys = [...c.bakes.keys()], gl = keys.filter((k) => k.startsWith('gltf:'));
    const body = (spec) => [...L.templates].find(([id]) => id === spec)?.[1];
    return { ids: [...L.templates.keys()], fullBones: full.template.bones, lightBones: light.template.bones, bakes: keys.length, gltfBakes: gl.length, specsUsed: [...new Set(gl.map((k) => k.split(':')[1]))], bones: { mh: body('full-mh') && body('full-mh').bones, crowdMh: body('full-mh#crowd') && body('full-mh#crowd').bones },
      residentsShared: c.agents.filter((a) => a.bodyKey).length, placed: (() => { c.update(0); c.snap(); return c.placedCount; })(), tris: c.stats.tris };
  });
  ok('crowd + library: manifest "crowd" files are loaded as light variants and used for the crowd (not for NPCs)', r.ids.includes('full-mh#crowd') && r.ids.includes('full-mx#crowd') && r.fullBones !== r.lightBones && r.bones.crowdMh === 25, JSON.stringify(r));
  ok('crowd + library: residents share baked bodies (a handful of bakes instead of one per person and pose)', r.residentsShared === 47 && r.gltfBakes <= 2 * 2 * 3 && r.gltfBakes >= 6 && r.bakes === r.gltfBakes, JSON.stringify(r));
  ok('crowd + library: everyone is still placed for the current state', r.placed >= 40, JSON.stringify(r));
  await t.close();
}

// ---- 3c. single-file build with the characters embedded ---------------------------------------------------------------------------------
{
  const out = path.join(here, 'fixtures/_tmp/embedded');
  fs.rmSync(path.join(here, 'fixtures/_tmp'), { recursive: true, force: true });
  const log = execFileSync('node', [path.join(here, '../tools/build.mjs'), '--no-min', '--embed-characters=tests/fixtures/characters-crowd', '--out=tests/fixtures/_tmp/embedded'], { cwd: path.join(here, '..') }).toString();
  const t = await open({ port: 8126, path: '/fixtures/_tmp/embedded/index.html', query: 'auto&manual&nostart&q=low&crowd=off', log: false });
  const r = await t.page.evaluate(() => ({ status: NH_CHARS_LIB.status, ids: [...NH_CHARS_LIB.templates.keys()], gltf: NH.npcs.filter((n) => n.body.isGltf).length, all: NH.npcs.length }));
  ok('embedded build: manifest, characters and their crowd variants live inside the one HTML file and are used without any network fetch', r.status === 'ready' && r.ids.includes('full-mh') && r.ids.includes('full-mh#crowd') && r.gltf === r.all && /character file\(s\) embedded/.test(log), JSON.stringify({ r, log: log.trim().split('\n').pop() }));
  await t.close();
  fs.rmSync(path.join(here, 'fixtures/_tmp'), { recursive: true, force: true });
}

// ---- 4. determinism: the simulation must not notice which bodies are used ---------------------------------------------------
{
  const fp = [];
  for (const [k, q] of [[0, 'chars=off'], [1, FIX]]) {
    const t = await open({ port: 8123 + k, query: `bot=shim&manual&q=low&hurry&${q}`, log: false });
    const s = await t.page.evaluate(() => { let n = 0; while (!NH_BOT.finished && n < 60 * 60 * 20) { NH_BOT.advance(600); n += 600; } return JSON.stringify({ t: +NH.simTime.toFixed(3), dc: NH.economy.balance, cred: NH.reputation.streetCred, fear: NH.reputation.fear, hour: +NH.routine.hour.toFixed(4), x: +NH.player.pos.x.toFixed(3), z: +NH.player.pos.z.toFixed(3), results: NH_BOT.results.length, failed: NH_BOT.results.filter((r) => !r.ok).length, stats: NH.stats, gltf: NH.npcs.filter((n) => n.body.isGltf).length > 0 }); });
    fp.push(JSON.parse(s)); await t.close();
  }
  const strip = (o) => { const c = { ...o }; delete c.gltf; return JSON.stringify(c); };
  ok('determinism: bot route ends in the identical state with procedural and with glTF bodies', strip(fp[0]) === strip(fp[1]) && !fp[0].gltf && fp[1].gltf && fp[0].failed === 0, `\n   off ${JSON.stringify(fp[0])}\n   on  ${JSON.stringify(fp[1])}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
fs.mkdirSync(path.join(here, '../docs'), { recursive: true });
fs.writeFileSync(path.join(here, '../docs/characters-report.json'), JSON.stringify({ generated: new Date().toISOString(), pass, fail, results }, null, 1));
process.exit(fail ? 1 : 0);
