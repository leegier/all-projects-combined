// Browser integration tests on the real game (headless Chromium): save/load round trip, navigation graph connectivity,
// door policy by routine slot, restricted-area rules, determinism (two runs of the same bot route end in the same state).
//   node tests/integration.mjs
import { open } from '../tools/lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0; const results = [];
const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; results.push({ name, ok: !!cond, detail }); console.log(cond ? '  ok  ' : '  FAIL', name, cond ? '' : detail); };

// ---- 1. state, save/load, nav, door policy -------------------------------------------------------------------------------
{
  const t = await open({ port: 8110, query: 'auto&manual&q=low', log: false });
  const { page } = t;
  await page.evaluate(() => { NH.ui.show('u-disc', false); NH.toTitle(); NH.newGame(); NH.advance(2150); });
  const mode = await page.evaluate(() => NH.mode);
  ok('new game: intro hands control to the player', mode === 'play', `mode ${mode}`);

  const snap = await page.evaluate(() => {
    const g = NH;
    g.economy.earn(37, 'test'); g.inventory.add('keycard'); g.inventory.add('cigs', 3); g.reputation.addCred(15); g.reputation.addStanding('Guards', 5);
    g.routine.skipTo(9.5); g.survival.hunger = 41; g.story.setFlag('metCutter'); g.player.teleport(10.5, 0, 0.4, 1.2);
    g.save();
    const a = JSON.stringify([g.economy.balance, g.inventory.serialize(), g.reputation.streetCred, g.reputation.standing.Guards, +g.routine.hour.toFixed(2), g.survival.hunger, g.story.flag('metCutter'), +g.player.pos.x.toFixed(2)]);
    // wreck the state, then load
    g.economy.spend(g.economy.balance, 'wipe'); g.inventory.load([]); g.reputation.addCred(-100); g.routine.skipTo(18); g.survival.hunger = 5; g.story.f.metCutter = false; g.player.teleport(-20, 0, 0, 0);
    const wrecked = g.economy.balance === 0 && !g.inventory.has('keycard');
    g.continueGame();
    const b = JSON.stringify([g.economy.balance, g.inventory.serialize(), g.reputation.streetCred, g.reputation.standing.Guards, +g.routine.hour.toFixed(2), g.survival.hunger, g.story.flag('metCutter'), +g.player.pos.x.toFixed(2)]);
    return { a, b, wrecked, mode: g.mode, has: !!localStorage.getItem('nyghtshade-hollow.intake.v2') };
  });
  ok('save writes a slot in localStorage', snap.has);
  ok('state was really wrecked before loading (test sanity)', snap.wrecked);
  ok('continue restores economy, inventory, reputation, clock, vitals, flags and position', snap.a === snap.b, `\n   saved  ${snap.a}\n   loaded ${snap.b}`);
  ok('continue returns to play mode', snap.mode === 'play');

  const nav = await page.evaluate(() => {
    const g = NH, W = g.world.waypoints, out = { isolated: [], bad: [] };
    for (const [k, n] of W) { if (!n.links || !n.links.size) out.isolated.push(k); }
    const route = ['H.w1', 'H.e1', 'E.g1', 'E.cd', 'C.in', 'C.s', 'C.cut', 'E.id', 'I.a', 'I.r', 'R.in', 'R.l', 'W.g1', 'W.c4', 'P.in', 'P.pew', 'P.f', 'T.top', 'T.foot', 'T.m', 'O.g', 'O.oak', 'U.n2', 'St.nb', 'N1', 'S12'];
    for (let i = 0; i + 1 < route.length; i++) {
      const a = W.get(route[i]), p = g.nav.path(a.x, a.z, a.y || 0, route[i + 1]);
      if (!p || !p.length) out.bad.push(`${route[i]} -> ${route[i + 1]}`);
    }
    out.nodes = W.size;
    return out;
  });
  ok(`nav graph: no isolated waypoints (${nav.nodes} nodes)`, nav.isolated.length === 0, nav.isolated.join(', '));
  ok('nav graph: every hop of the golden-path route is connected', nav.bad.length === 0, nav.bad.join(', '));

  const doors = await page.evaluate(() => {
    const g = NH, r = g.routine, out = {};
    const at = (h) => { r.hour = h; r._evaluate(true); g.story.cellsReleased = !(r.slot === 'Count' || r.slot === 'LightsOut'); g.advance(30); return { gate: g.world.doors.get('gate-sally-1').locked, chapel: g.world.doors.get('door-chapel').locked, cell: g.world.doors.get('cell-N0-7').locked, records: g.world.doors.get('door-records').locked }; };
    out.count = at(6.3); out.chow = at(7.3); out.chapelClosed = at(12.4); out.chapelOpen = at(13.5); out.lights = at(23);
    return out;
  });
  ok('doors: sally gate locked at COUNT, open at CHOW', doors.count.gate && !doors.chow.gate, JSON.stringify([doors.count.gate, doors.chow.gate]));
  ok('doors: chapel locked before 13:00, open 13:00-15:00', doors.chapelClosed.chapel && !doors.chapelOpen.chapel);
  ok('doors: cells locked at COUNT and LIGHTS OUT, open in between', doors.count.cell && doors.lights.cell && !doors.chow.cell);
  ok('doors: Records stays locked without keycard/shim/bribe', doors.chow.records && doors.chapelOpen.records);

  const rules = await page.evaluate(() => {
    const g = NH, r = g.routine, pl = g.player, res = {};
    const area = (n) => g.world.areas.get(n);
    // player standing in the hall (not in their own cell), cells still locked at count
    pl.teleport(0, 0, 0, 0); pl.area = area('hall');
    r.hour = 6.3; r._evaluate(true); g.story.cellsReleased = false; res.hallCountLocked = g.isRestricted(pl);
    g.story.cellsReleased = true; res.hallCountReleased = g.isRestricted(pl);
    r.hour = 7.3; r._evaluate(true); res.hallChow = g.isRestricted(pl);
    pl.area = area('records'); res.records = g.isRestricted(pl);
    pl.area = area('canteen'); res.canteenChow = g.isRestricted(pl); r.hour = 6.3; r._evaluate(true); res.canteenCount = g.isRestricted(pl);
    pl.area = area('chapel'); r.hour = 9; r._evaluate(true); res.chapelClosed = g.isRestricted(pl); r.hour = 13.5; r._evaluate(true); res.chapelOpen = g.isRestricted(pl);
    return res;
  });
  ok('restricted: hall only while locked in at count', rules.hallCountLocked && !rules.hallCountReleased && !rules.hallChow, JSON.stringify(rules));
  ok('restricted: Records always; canteen only outside meal hours; chapel only while closed', rules.records && !rules.canteenChow && rules.canteenCount && rules.chapelClosed && !rules.chapelOpen, JSON.stringify(rules));
  await t.close();
}

// ---- 2. determinism: same route twice -> identical end state ----------------------------------------------------------------
{
  const fin = [];
  for (let k = 0; k < 2; k++) {
    const t = await open({ port: 8111 + k, query: 'bot=shim&manual&q=low&hurry', log: false });
    const s = await t.page.evaluate(() => { let n = 0; while (!NH_BOT.finished && n < 60 * 60 * 20) { NH_BOT.advance(600); n += 600; } return JSON.stringify({ t: +NH.simTime.toFixed(3), dc: NH.economy.balance, cred: NH.reputation.streetCred, fear: NH.reputation.fear, hour: +NH.routine.hour.toFixed(4), x: +NH.player.pos.x.toFixed(3), z: +NH.player.pos.z.toFixed(3), results: NH_BOT.results.length, rng: NH.stats }); });
    fin.push(s); await t.close();
  }
  ok('determinism: two bot runs of the shim route end in the identical state', fin[0] === fin[1], `\n   ${fin[0]}\n   ${fin[1]}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
fs.mkdirSync(path.join(here, '../docs'), { recursive: true });
fs.writeFileSync(path.join(here, '../docs/integration-report.json'), JSON.stringify({ generated: new Date().toISOString(), pass, fail, results }, null, 1));
process.exit(fail ? 1 : 0);
