// Dev viewer: builds levels and renders still shots for look-development (npm run build -- --dev)
import * as THREE from 'three';
import { loadAllTextures } from './proc/textures.js';
import { buildMaterials } from './proc/materials.js';
import { Gfx, LightRig, lightShaft, dustField } from './core/gfx.js';
import { setupStage } from './core/stage.js';
import { World } from './world/world.js';
import { buildHall } from './world/levels/hall.js';

window.DEV = {};
(async () => {
  const t0 = performance.now();
  await loadAllTextures();
  buildMaterials();
  window.DEV.texMs = performance.now() - t0;
  const gfx = new Gfx(document.getElementById('c'), { quality: new URLSearchParams(location.search).get('q') || 'high' });
  const stage = setupStage(gfx); window.DEV._gfx = gfx;
  const world = new World(gfx.scene);
  const ctx = { windowMat: new THREE.MeshBasicMaterial({ color: 0x182a44, fog: false }) };
  buildHall(world, ctx);
  const rig = new LightRig(gfx.scene, gfx.q.pool, 1, gfx.q.shadowMap);
  window.DEV.shot = (x, y, z, tx, ty, tz, fov = 70) => {
    gfx.camera.position.set(x, y, z); gfx.camera.lookAt(tx, ty, tz); gfx.camera.fov = fov; gfx.camera.updateProjectionMatrix();
    gfx.camera.updateMatrixWorld(true);
    const act = new Set(['hall']);
    for (let i = 0; i < 20; i++) rig.update(0.05, 1, world.fixtures, gfx.camera.position, act);
    gfx.render(1.0);
    return true;
  };
  window.DEV.info = () => ({ calls: gfx.renderer.info.render.calls, tris: gfx.renderer.info.render.triangles, geoms: gfx.renderer.info.memory.geometries, tex: gfx.renderer.info.memory.textures });
  window.DEV.ready = true;
})().catch((e) => { window.DEV.error = e.stack || String(e); console.error(e); });
window.DEV.direct = (x, y, z, tx, ty, tz) => {
  const gfx = window.DEV._gfx;
  gfx.camera.position.set(x, y, z); gfx.camera.lookAt(tx, ty, tz); gfx.camera.updateMatrixWorld(true);
  gfx.renderer.shadowMap.needsUpdate = true;
  gfx.renderer.render(gfx.scene, gfx.camera);
  return gfx.renderer.info.render.calls + ' calls ' + gfx.renderer.info.render.triangles + ' tris';
};
