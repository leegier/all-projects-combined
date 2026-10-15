// Background crowd tests on the real game (headless Chromium): who is where in each routine state, nobody inside walls or furniture, nobody sharing a
// seat, colliders only where someone sits, the sleeper NPCs and the crowd never overlap, the off switch, and — most important — the crowd must not
// change the simulation (the bot route ends in the identical state with and without it).
//   node tests/crowd.mjs
import { open } from '../tools/lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0; const results = [];
const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; results.push({ name, ok: !!cond, detail }); console.log(cond ? '  ok  ' : '  FAIL', name, cond ? '' : detail); };

{
  const t = await open({ port: 8140, query: 'auto&manual&nostart&q=low', log: false });
  const { page } = t;
  const boot = await page.evaluate(() => { const c = NH.crowd; return { on: !!c, stats: c && c.stats, members: c && c.members.length, npcs: NH.npcs.length }; });
  ok('crowd: 45 residents (one per cell but the player\'s) + 2 kitchen hands, every pose baked', boot.on && boot.stats.residents === 45 && boot.stats.staff === 2 && boot.stats.bakes >= 120, JSON.stringify(boot));
  ok('crowd: baked bodies are light (≤ 9k triangles on average) and share materials (< 400 in all)', boot.stats.tris / boot.stats.bakes < 9000 && boot.stats.materials < 400, JSON.stringify(boot.stats));

  const states = await page.evaluate(() => {
    const g = NH, c = g.crowd, r = g.routine, out = {};
    const at = (name, hour, released = true, lockdown = false) => {
      r.lockdown = lockdown; r.hour = hour; r._evaluate(true); g.story.cellsReleased = released; g.story.updateNpcPresence();
      c.update(0); c.snap();
      const placed = c.members.filter((m) => m.cur);
      const key = (s) => `${s.x.toFixed(2)},${s.z.toFixed(2)},${s.y.toFixed(2)}`;
      const keys = placed.map((m) => key(m.cur)), dup = keys.length - new Set(keys).size;
      const area = {}; for (const m of placed) area[m.cur.area] = (area[m.cur.area] || 0) + 1;
      const pose = {}; for (const m of placed) pose[m.cur.pose] = (pose[m.cur.pose] || 0) + 1;
      // colliders of seats / queue spots: enabled exactly where someone is
      const withCol = placed.filter((m) => m.cur.collider), enabled = g.world.colliders.filter((x) => x.tag === 'crowd' && x.enabled).length;
      // furniture / wall collisions for people standing or sitting in the open (not on bunks: those are inside the bunk's own box)
      let inside = 0, worst = 0;
      const P3 = g.player.pos.constructor;
      for (const m of placed) {
        const s = m.cur; if (s.pose === 'lie' || (s.pose === 'sit' && s.area === 'hall' && s.z * s.z > 7 * 7 - 0.01 && Math.abs(s.z) > 7)) continue;
        if (s.area === 'hall' && Math.abs(s.z) > 5.5) continue;                      // inside a cell: bars/doors are in front, bunks beside — checked visually
        if (s.area === 'chapel') continue;                                            // sitting on a pew = inside the pew's own collider
        const p = new P3(s.x, s.y, s.z), x0 = p.x, z0 = p.z;
        g.world.resolveCircle(p, 0.2, 1.4, new Set(['crowd', 'celldoor']));
        const d = Math.hypot(p.x - x0, p.z - z0); if (d > 0.06) { inside++; worst = Math.max(worst, d); }
      }
      out[name] = { state: c.state, placed: placed.length, dup, area, pose, collidersOn: enabled, withCol: withCol.length, inside, worst: +worst.toFixed(2),
        sleepersHidden: g.npcs.filter((n) => n.sleeper).every((n) => n.hiddenFromWorld), sleepersShown: g.npcs.filter((n) => n.sleeper).every((n) => !n.hiddenFromWorld) };
    };
    at('count', 6.3, false); at('lights', 23, false); at('lockdown', 9.5, true, true); at('after', 6.5, true); at('chow', 7.4); at('work', 9); at('yard', 10.4); at('free', 18.5); at('chapel', 13.6); at('gym', 15.5); at('visit', 16.4);
    return out;
  });
  const S = states;
  ok('count: all 45 residents stand at their cell doors and the sleeper NPCs step aside', S.count.state === 'count' && S.count.placed === 45 && S.count.pose.idle === 45 && S.count.sleepersHidden, JSON.stringify(S.count));
  ok('lights out: the cells hold sleepers (41: four cells already have a sleeper NPC) and those NPCs are back in their bunks', S.lights.state === 'lights' && S.lights.placed === 41 && S.lights.pose.lie === 41 && S.lights.sleepersShown, JSON.stringify(S.lights));
  ok('lockdown: everyone sits in their cell', S.lockdown.state === 'lockdown' && S.lockdown.placed === 41 && S.lockdown.pose.sit === 41, JSON.stringify(S.lockdown));
  ok('chow: the mess hall is full (diners, serving line, commissary, two cooks) and cells are mostly empty', S.chow.area.canteen >= 25 && S.chow.area.canteen <= 31 && S.chow.placed >= 28, JSON.stringify(S.chow));
  ok('free time: about 21 men at the day-room tables, some in the mess hall and in cells', S.free.area.hall >= 25 && S.free.area.canteen >= 4, JSON.stringify(S.free));
  ok('chapel hours: pews and the library are used', S.chapel.area.chapel >= 6 && S.chapel.area.library >= 3 && S.chapel.area.hall >= 10, JSON.stringify(S.chapel));
  ok('work / yard / gym / visitation: the block is quieter but not empty', [S.work, S.yard, S.gym, S.visit].every((x) => x.placed >= 10 && x.placed <= 30), JSON.stringify([S.work.placed, S.yard.placed, S.gym.placed, S.visit.placed]));
  ok('nobody shares a seat or a cell in any state', Object.values(S).every((x) => x.dup === 0), JSON.stringify(Object.entries(S).map(([k, x]) => [k, x.dup])));
  ok('nobody stands or sits inside a wall or furniture (open-floor positions)', Object.values(S).every((x) => x.inside === 0), JSON.stringify(Object.entries(S).map(([k, x]) => [k, x.inside, x.worst])));
  ok('colliders: enabled exactly for the occupied seats / queue spots', Object.values(S).every((x) => x.collidersOn === x.withCol), JSON.stringify(Object.entries(S).map(([k, x]) => [k, x.collidersOn, x.withCol])));

  // drawn only where the player can see
  const vis = await page.evaluate(() => {
    const g = NH, c = g.crowd, r = g.routine;
    r.lockdown = false; r.hour = 6.3; r._evaluate(true); g.story.cellsReleased = false; c.update(0); c.snap();
    g.world.setActiveArea('hall'); c.update(0); const inHall = c.visibleCount;
    g.world.setActiveArea('canteen'); c.update(0); const inCanteen = c.visibleCount;
    g.world.setActiveArea('hall'); c.update(0);
    return { inHall, inCanteen, placed: c.placedCount };
  });
  ok('visibility follows the active areas (cells are not drawn from the canteen)', vis.inHall === vis.placed && vis.inCanteen < vis.placed, JSON.stringify(vis));

  // state changes are staggered (leave first, then arrive), seats never double-booked on the way
  const flow = await page.evaluate(() => {
    const g = NH, c = g.crowd, r = g.routine; c.soft = true;
    r.lockdown = false; r.hour = 6.3; r._evaluate(true); g.story.cellsReleased = false; c.update(0); c.snap();
    r.hour = 7.2; r._evaluate(true); g.story.cellsReleased = true; g.story.updateNpcPresence();
    const log = []; let maxDup = 0;
    for (let i = 0; i < 60 * 14; i++) {
      g.time += 1 / 60; c.update(1 / 60);                                  // the crowd runs on game time
      if (i % 60 === 0) {
        const placed = c.members.filter((m) => m.cur), keys = placed.map((m) => `${m.cur.x},${m.cur.z},${m.cur.y}`);
        maxDup = Math.max(maxDup, keys.length - new Set(keys).size); log.push(placed.length);
      }
    }
    return { log, maxDup, state: c.state, pending: c.members.filter((m) => m.next !== undefined).length };
  });
  ok('transitions: people drift out and in over several seconds (count drops, then fills the mess hall), never two on one seat', flow.state === 'Chow' && flow.pending === 0 && flow.maxDup === 0 && Math.min(...flow.log) < flow.log[flow.log.length - 1] && new Set(flow.log).size >= 4, JSON.stringify(flow));

  // cost: draw calls / triangles with the crowd at its busiest views
  const cost = await page.evaluate(() => {
    const g = NH, c = g.crowd, r = g.routine, out = {};
    const view = (name, hour, released, area, px, py, pz, lx, ly, lz) => {
      r.hour = hour; r._evaluate(true); g.story.cellsReleased = released; g.story.updateNpcPresence(); c.update(0); c.snap();
      g.cine = null; g.mode = 'cine'; g.player.frozen = true; g.camOverride = { pos: new g.player.pos.constructor(px, py, pz), look: new g.player.pos.constructor(lx, ly, lz), fov: 62, roll: 0 };
      g.world.setActiveArea(area); g.applyEnv(area); g.advance(2);
      g.render(1, 0.05); const rd = g.gfx.renderer; rd.info.autoReset = false; rd.info.reset(); g.render(1, 0.05);       // all passes (shadows, scene, post) summed
      const info = rd.info.render; out[name] = { calls: info.calls, tris: info.triangles }; rd.info.autoReset = true;
    };
    view('count down the tier', 6.3, false, 'hall', 16.5, 1.7, -3.4, -14, 1.7, -6);
    view('free time hall', 18.5, true, 'hall', -15.6, 2.0, 0.4, -6.5, 1.0, 1.6);
    view('chow canteen', 7.4, true, 'canteen', 25.6, 1.9, -4.2, 33, 1.0, -10.5);
    return out;
  });
  ok('cost: the busiest crowd views stay under 2400 draw calls and 1.6 M triangles (all passes summed)', Object.values(cost).every((x) => x.calls > 100 && x.calls < 2400 && x.tris < 1.6e6), JSON.stringify(cost));
  await t.close();
}

// ---- off switch and the simulation --------------------------------------------------------------------------------------------------------------
{
  const t = await open({ port: 8141, query: 'auto&manual&nostart&q=low&crowd=off', log: false });
  const r = await t.page.evaluate(() => ({ crowd: NH.crowd, on: NH.crowdOn, npcs: NH.npcs.length, colliders: NH.world.colliders.filter((x) => x.tag === 'crowd').length }));
  ok('?crowd=off: no crowd, no crowd colliders, the 24 cast members are untouched', r.crowd === null && !r.on && r.npcs === 24 && r.colliders === 0, JSON.stringify(r));
  await t.close();
}
{
  const fp = [];
  for (const [k, q] of [[0, 'crowd=off'], [1, 'crowd=on']]) {
    const t = await open({ port: 8142 + k, query: `bot=shim&manual&q=low&hurry&${q}`, log: false });
    const s = await t.page.evaluate(() => { let n = 0; while (!NH_BOT.finished && n < 60 * 60 * 20) { NH_BOT.advance(600); n += 600; } return JSON.stringify({ t: +NH.simTime.toFixed(2), dc: NH.economy.balance, cred: NH.reputation.streetCred, fear: NH.reputation.fear, hour: +NH.routine.hour.toFixed(3), x: +NH.player.pos.x.toFixed(2), z: +NH.player.pos.z.toFixed(2), results: NH_BOT.results.length, failed: NH_BOT.results.filter((r) => !r.ok).length, stuck: NH_BOT.stuckCount, stats: NH.stats }); });
    fp.push(JSON.parse(s)); await t.close();
  }
  const core = (o) => JSON.stringify({ dc: o.dc, cred: o.cred, fear: o.fear, x: o.x, z: o.z, results: o.results, failed: o.failed, stats: o.stats });
  ok('simulation: the bot route ends in the same state with and without the crowd (clock within 2 s), never stuck on it', core(fp[0]) === core(fp[1]) && Math.abs(fp[0].t - fp[1].t) < 2 && fp[1].failed === 0 && fp[1].stuck === 0, `\n   off ${JSON.stringify(fp[0])}\n   on  ${JSON.stringify(fp[1])}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
fs.mkdirSync(path.join(here, '../docs'), { recursive: true });
fs.writeFileSync(path.join(here, '../docs/crowd-report.json'), JSON.stringify({ generated: new Date().toISOString(), pass, fail, results }, null, 1));
process.exit(fail ? 1 : 0);
