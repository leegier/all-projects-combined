// Render-cost probe: node tools/perf.mjs  (run under xvfb with NH_GL=llvmpipe). Times g.render() for a few scenes × toggles.
import { open } from './lib.mjs';
const t = await open({ query: 'auto&manual&nostart&q=high' + (process.env.NH_QEXTRA ? '&' + process.env.NH_QEXTRA : ''), log: false });
const { page } = t;
await page.evaluate(() => { NH.ui.show('u-disc', false); NH.mode = 'play'; NH.ui.hud(false); NH.ui.el('u-title').classList.remove('on'); });
const scenes = {
  hall: { pos: [-9, 0, 0.6], yaw: -1.5708, hour: 7, outside: 'night' },
  canteen: { pos: [33, 0, -5.3], yaw: 0.4, hour: 7.8, outside: 'night' },
  forest: { pos: [-92, 0, -27], yaw: 2.2, hour: 14.5, outside: 'gold' },
};
const variants = {
  base: '',
  noShadows: 'g.gfx.renderer.shadowMap.enabled=false; g.scene && 0;',
  noMSAA: 'g.gfx.composer.renderTarget1.samples=0; g.gfx.composer.renderTarget2.samples=0;',
  noBloom: 'g.gfx.bloom.enabled=false;',
  half: 'g.gfx.composer.setPixelRatio(0.5);',
};
for (const [sn, s] of Object.entries(scenes)) {
  for (const [vn, js] of Object.entries(variants)) {
    const ms = await page.evaluate(({ s, js }) => {
      const g = NH;
      g.cine = null; g.camOverride = null; g.mode = 'play'; g.player.frozen = false; g.letter = 0; g.fade = 0; g.fadeTarget = 0; g.eyelid = 0; g.blur = 0;
      g.routine.hour = s.hour; g.routine._evaluate(true); g.outsideMode = s.outside; g.story.cellsReleased = true;
      g.player.teleport(s.pos[0], s.pos[1], s.pos[2], s.yaw); g.advance(30);
      // reset toggles
      g.gfx.renderer.shadowMap.enabled = true; g.gfx.bloom.enabled = true;
      for (const rt of [g.gfx.composer.renderTarget1, g.gfx.composer.renderTarget2]) rt.samples = g.gfx.q.samples;
      g.gfx.composer.setPixelRatio(1); g.gfx.composer.setSize(1280, 720);
      new Function('g', js)(g);
      const gl = g.gfx.renderer.getContext(), px = new Uint8Array(4);
      for (let i = 0; i < 3; i++) { g.render(1, 0.05); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      const t0 = performance.now();
      for (let i = 0; i < 4; i++) { g.render(1, 0.05); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      return (performance.now() - t0) / 4;
    }, { s, js });
    console.log(sn.padEnd(8), vn.padEnd(10), ms.toFixed(0) + ' ms');
  }
}
await t.close();
