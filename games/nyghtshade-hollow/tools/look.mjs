// Look-dev: renders stills from the real game at chosen spots.  node tools/look.mjs shots.json outDir [quality]
import { open } from './lib.mjs';
import fs from 'node:fs';
const shots = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3] || '/tmp/look';
const q = process.argv[4] || 'high';
fs.mkdirSync(out, { recursive: true });
const t = await open({ query: `auto&manual&nostart&q=${q}`, log: true });
const { page } = t;
await page.evaluate(() => { NH.ui.show('u-disc', false); NH.mode = 'play'; NH.ui.hud(false); NH.ui.el('u-title').classList.remove('on'); });
for (const s of shots) {
  const t0 = Date.now();
  await page.evaluate((s) => {
    const g = NH;
    g.cine = null; g.camOverride = null; g.mode = 'play'; g.player.frozen = false; g.letter = 0; g.fade = 0; g.fadeTarget = 0;
    g.eyelid = 0; g.blur = 0;
    if (s.hour !== undefined) { g.routine.hour = s.hour; g.routine._evaluate(true); }
    g.outsideMode = s.outside || 'night';
    g.story.cellsReleased = s.released !== false;
    g.player.teleport(s.pos[0], s.pos[1] || 0, s.pos[2], s.yaw || 0);
    g.player.pitch = s.pitch || 0; g.player.crouch = s.crouch || 0;
    if (s.npcs) for (const [id, x, z, pose] of s.npcs) { const n = g.story.npcMap[id]; n.teleport(x, z); if (pose) n.setPose(pose); n.hiddenFromWorld = false; }
    if (s.show) for (const id of s.show) g.story.npcMap[id].hiddenFromWorld = false;
    if (s.hud) g.ui.hud(true); else g.ui.hud(false);
    if (s.cam) {
      g.mode = 'cine'; g.player.frozen = true; g.letter = s.letter === false ? 0 : 1; g.u = null;
      g.camOverride = { pos: new g.player.pos.constructor(...s.cam.p), look: new g.player.pos.constructor(...s.cam.l), fov: s.cam.fov || 55, roll: 0 };
      g.camInOutside = !!s.camOutside; g._cineArea = null;
      if (s.area) { g.world.setActiveArea(s.area); g.applyEnv(s.env || s.area); }
      g.viewmodel.visible = false;
    } else g.viewmodel.visible = true;
    g.advance(40);
    if (s.dialogue) { g.ui.hud(false); g.story.startDialogue(s.dialogue[0], g.story.npcMap[s.dialogue[1]], { cam: s.dialogue[2] || 'face' }); g.advance(240); }
    for (let i = 0; i < 6; i++) g.render(1, 0.05);
    g.stepEnv(5, true);
    const gl = g.gfx.renderer.getContext(), px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now(); g.render(1, 0.05); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    window.__renderMs = performance.now() - t0;
  }, s);
  const buf = await page.screenshot();
  fs.writeFileSync(`${out}/${s.name}.png`, buf);
  console.log(s.name, `${Date.now() - t0}ms`, 'render', (await page.evaluate(() => window.__renderMs)).toFixed(0) + 'ms', JSON.stringify(await page.evaluate(() => ({ area: NH.player.area && NH.player.area.name }))));
}
await t.close();
