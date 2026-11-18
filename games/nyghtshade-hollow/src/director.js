// Director: the cinematic camera + staging API used by tools/cine (installed only with ?cine as window.NH_DIR).
// Visual only: a shot may stage the scene first (hour, who stands where, extra lights) and then every frame is a camera pose + lens / depth of field /
// motion blur / grade; nothing here reads the shared RNG or writes simulation state while frames are being rendered.
//   NH_DIR.stage(scene)          set the world up for a shot (see stage())
//   NH_DIR.frame(f)              advance the simulation, apply the camera and effects, render one frame (see frame())
//   NH_DIR.clear()               hand the camera back to the player
import * as THREE from 'three';
import { fovFromLens, cocScale } from './core/cinefx.js';

export function installDirector(game) {
  const g = game, gfx = g.gfx, V3 = THREE.Vector3;
  const prev = new THREE.PerspectiveCamera();
  let area = null, extra = [];

  const entity = (id) => {
    if (id === 'player') return { pos: g.player.pos, yaw: g.player.yaw };
    const n = g.story.npcMap[id]; if (!n) throw new Error('director: unknown entity ' + id);
    return { pos: n.pos, yaw: n.yaw };
  };
  /** [x,y,z] in the world, or { rel: 'player' | npcId, off: [right, up, forward] } in that entity's frame (forward = where it faces). */
  const resolve = (v, out = new V3()) => {
    if (Array.isArray(v)) return out.set(v[0], v[1], v[2]);
    const e = entity(v.rel), sy = Math.sin(e.yaw), cy = Math.cos(e.yaw), o = v.off;
    return out.set(e.pos.x + cy * o[0] - sy * o[2], e.pos.y + o[1], e.pos.z - sy * o[0] - cy * o[2]);
  };
  const setupPose = (cam, s) => {                                       // pose of a camera spec on a THREE camera (used for the previous-frame pose of motion blur)
    cam.position.copy(resolve(s.p)); cam.lookAt(resolve(s.l)); if (s.roll) cam.rotateZ(s.roll);
    cam.fov = s.fov ?? fovFromLens(s.lens || 35); cam.aspect = gfx.camera.aspect; cam.near = gfx.camera.near; cam.far = gfx.camera.far; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  };
  let tracked = [];                                                      // lights whose position / target follow an entity: { light, spec }
  const lightFrom = (d) => {
    let l;
    if (d.type === 'spot') { l = new THREE.SpotLight(new THREE.Color(d.color || '#ffffff'), d.intensity ?? 40, d.distance ?? 20, d.angle ?? 0.6, d.penumbra ?? 0.6, d.decay ?? 1.5); g.scene.add(l.target); extra.push(l.target); }
    else l = new THREE.PointLight(new THREE.Color(d.color || '#ffffff'), d.intensity ?? 10, d.distance ?? 12, d.decay ?? 2);
    l.castShadow = !!d.shadow; l.layers.enable(0); g.scene.add(l); extra.push(l);
    const place = () => { resolve(d.p, l.position); if (l.target) resolve(d.target || [0, 0, 0], l.target.position); };
    place(); if (!Array.isArray(d.p) || (d.target && !Array.isArray(d.target))) tracked.push(place);
    return l;
  };
  const clearLights = () => { for (const o of extra) { if (o.parent) o.parent.remove(o); if (o.dispose) o.dispose(); } extra = []; tracked = []; };

  const D = window.NH_DIR = {
    resolve,
    /** Set the world up for a shot. scene = { hour, released, outside:'night'|'gold', area, env, player:[x,y,z,yaw], npcs:[[id,x,z,pose,faceX,faceZ]], show:[ids], hide:[ids],
     *  lights:[{type,p,color,intensity,distance,angle,penumbra,target,shadow}], advance:steps, snap:true, js:'code using g' } */
    stage(s = {}) {
      clearLights();
      g.cine = null; g.camOverride = null; g.mode = 'cine'; g.player.frozen = true; g.letter = 0; g.fade = 0; g.fadeTarget = 0; g.eyelid = 0; g.blur = 0; g.flash = 0;
      g.viewmodel.visible = false; g.outsideMode = s.outside === 'gold' ? 'gold' : 'night'; g.camInOutside = !!s.camOutside || s.area === 'outside';
      g.cineHumans = s.humans || 'show';                                                                       // 'hide': no NPC and no crowd member is drawn (only the double, if asked for)
      const r = g.routine;
      if (s.hour !== undefined) { r.paused = true; r.hour = s.hour; r._evaluate(true); }
      g.story.cellsReleased = s.released !== false;
      const p = s.player || [0, 0, 3, 0]; g.player.teleport(p[0], p[1], p[2], p[3] || 0); g.player.pitch = 0; g.player.crouch = 0;
      for (const [id, x, z, pose, fx, fz] of s.npcs || []) { const n = g.story.npcMap[id]; if (!n) throw new Error('stage: unknown npc ' + id); n.teleport(x, z); n.hiddenFromWorld = false; if (pose) n.setPose(pose); if (fx !== undefined) { n.facePoint(fx, fz); n.yaw = n.targetYaw; } }
      for (const id of s.show || []) g.story.npcMap[id].hiddenFromWorld = false;
      for (const id of s.hide || []) g.story.npcMap[id].hiddenFromWorld = true;
      for (const d of s.lights || []) lightFrom(d);
      if (s.js) new Function('g', 'D', s.js)(g, D);
      area = s.area || null;
      if (area) { g.world.setActiveArea(area); g.applyEnv(s.env || g.envFor(g.world.areas.get(area)), true); }
      g.advance(s.advance ?? 40);
      if (g.crowd) { g.crowd.update(0); if (s.snap !== false) g.crowd.snap(); }
      g.stepEnv(5, true);
    },
    /** Extra staging for a shot that follows the playtest bot: only lights / js (the bot owns the world). */
    stageBot(s = {}) { clearLights(); g.cineHumans = s.humans || 'show'; for (const d of s.lights || []) lightFrom(d); if (s.js) new Function('g', 'D', s.js)(g, D); },
    /** Camera + effects for the next render. s = { p, l, lens | fov, roll, area, env, outside, ev, bloom, grade:{…}, dof:{focus(m|point), fstop, maxR, boost, taps},
     *  prev:{p,l,lens,roll}, mb:amount, streak:{amount,threshold,len,tint} } — p / l are [x,y,z] or { rel, off }. */
    set(s) {
      const lens = s.lens || 35, fov = s.fov ?? fovFromLens(lens);
      g.directorCam = s.fpv ? null : { pos: resolve(s.p), look: resolve(s.l), fov, roll: s.roll || 0 };      // fpv: the player's own eyes, effects only
      if (g.cineHumans === 'hide') { for (const n of g.npcs) n.root.visible = false; if (g.crowd) g.crowd.root.visible = false; } else if (g.crowd) g.crowd.root.visible = true;
      gfx.vmPass.enabled = !!s.fpv;                                                                            // no first-person hands in third-person shots
      if (s.area) { if (s.area !== area) { area = s.area; g.world.setActiveArea(area); g.applyEnv(s.env || g.envFor(g.world.areas.get(area)), true); } else { g.world.setActiveArea(area); g.envTarget = s.env || g.envTarget; } }
      if (s.outside !== undefined) g.camInOutside = !!s.outside;
      for (const place of tracked) place();
      g.cineGrade = s.grade || null; g.cineEv = s.ev || 0; g.cineBloom = s.bloom ?? 1;
      g.eyelid = s.eyelid || 0; g.blur = s.blur || 0; g.flash = s.flash || 0;
      g.cineEnv = s.light ? { hi: s.light.hi ?? 1, ai: s.light.ai ?? 1, fog: s.light.fog ?? 1 } : null;         // fill (hemisphere / ambient) and haze multipliers
      const fx = {};
      if (s.dof && !s.fpv) {
        const f = s.dof.focus, focus = typeof f === 'number' ? f : g.directorCam.pos.distanceTo(resolve(f));
        fx.dof = { focus, cocK: cocScale(lens, s.dof.fstop || 2, focus, gfx.h), maxR: s.dof.maxR ?? 26, boost: s.dof.boost ?? 2.2, taps: s.dof.taps ?? 56 };
      }
      if (s.mb && s.prev) { setupPose(prev, s.prev); fx.mb = { amount: s.mb, prev, samples: s.mbSamples, maxLen: s.mbMax }; }
      if (s.streak) fx.streak = s.streak;
      gfx.setCine(fx);
    },
    /** Maddox's visible double (the 'maddox' NPC) follows the player for third-person shots. */
    double(on) {
      const m = g.story.npcMap.maddox; if (!m) return;
      if (!on) { m.root.visible = false; return; }
      const p = g.player; m.pos.copy(p.pos); m.yaw = p.yaw; m.root.position.copy(p.pos); m.root.rotation.y = p.yaw;
      m.body.update(1 / 24, p.speed, 0, 0); m.body.setCast(true); m.root.visible = true;
    },
    /** One output frame: f = { steps, dt, hour, bot, double, …set() fields }. `hour` drives the routine clock (paused) like the real clock would: slot events, doors and the crowd's moves fire. */
    frame(f) {
      const r = g.routine;
      if (f.hour !== undefined) {
        r.paused = true; r.hour = f.hour; r._evaluate(false);
        const slot = r.slot, locked = slot === 'LightsOut' || (slot === 'Count' && (f.hour < 6.75 || (f.hour >= 21 && f.hour < 21.95)));
        g.story.cellsReleased = f.released ?? !locked; g.story.updateNpcPresence();
      } else if (f.released !== undefined) g.story.cellsReleased = f.released;
      if (f.steps) { if (f.bot && window.NH_CAP) window.NH_CAP.adv(f.steps); else g.advance(f.steps); }
      if (f.pl) { const p = g.player; p.pos.set(f.pl.pos[0], f.pl.pos[1], f.pl.pos[2]); p.prevPos.copy(p.pos); p.yaw = f.pl.yaw; p.speed = f.pl.speed; }      // scripted walk of the player stand-in (staged shots)
      D.set(f); D.double(!!f.double);
      if (f.noRender) return;
      const dt = f.dt || 1 / 24;
      if (window.NH_CAP) window.NH_CAP.frame(dt); else g.render(1, dt);
    },
    /** Hand the camera back (bot-driven cutaways): the player's own area and environment return. */
    clear() {
      g.directorCam = null; g.cineGrade = null; g.cineEv = 0; g.cineBloom = 1; g.cineEnv = null; g.cineHumans = 'show'; if (g.crowd) g.crowd.root.visible = true; gfx.setCine({}); D.double(false); clearLights();
      const a = g.player.area; if (a) { g.world.setActiveArea(a.name); g.applyEnv(g.envFor(a), true); } g.camInOutside = false; area = null;
    },
    info() { return { area: g.player.area && g.player.area.name, hour: +g.routine.hour.toFixed(3), mode: g.mode, calls: gfx.renderer.info.render.calls, tris: gfx.renderer.info.render.triangles }; },
  };
  return D;
}
