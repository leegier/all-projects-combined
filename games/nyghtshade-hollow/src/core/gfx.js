// Renderer, post-processing stack, light pool, volumetric-look helpers (shafts, dust, glows).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { DECALS } from '../proc/textures.js';
import { clamp, damp, hash01 } from '../util.js';

export const QUALITY = {
  low: { samples: 0, bloom: false, pixelRatio: 0.75, pool: 3, shadowMap: 512, grain: 0.5 },
  medium: { samples: 0, bloom: true, pixelRatio: 1, pool: 5, shadowMap: 1024, grain: 1 },
  high: { samples: 4, bloom: true, pixelRatio: 1, pool: 6, shadowMap: 2048, grain: 1 },
};

// ------------------------------------------------------------------------------------------------
// Final grade pass: LDR colour grade, vignette, chromatic aberration, grain, letterbox, fades
// ------------------------------------------------------------------------------------------------
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, fade: { value: 0 }, vignette: { value: 0.55 }, grain: { value: 0.035 },
    ca: { value: 0.0007 }, letter: { value: 0 }, eyelid: { value: 0 }, blur: { value: 0 }, damage: { value: 0 }, alarm: { value: 0 },
    suspicion: { value: 0 }, lift: { value: new THREE.Vector3(0.0, 0.004, 0.012) }, gain: { value: new THREE.Vector3(1.04, 1.0, 0.97) },
    sat: { value: 0.9 }, contrast: { value: 1.08 }, aspect: { value: 1.7778 }, res: { value: new THREE.Vector2(1280, 720) }, flash: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, fade, vignette, grain, ca, letter, eyelid, blur, damage, alarm, suspicion, sat, contrast, aspect, flash;
    uniform vec3 lift, gain; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float r2 = dot(c * vec2(aspect, 1.0), c * vec2(aspect, 1.0));
      vec2 dir = c * (ca * (0.6 + r2 * 3.0));
      vec3 col;
      if (blur > 0.001) {
        vec3 acc = vec3(0.0); float tw = 0.0;
        for (int i = -3; i <= 3; i++) for (int j = -3; j <= 3; j++) {
          vec2 o = vec2(float(i), float(j)) * blur / res * 6.0; float w = exp(-float(i*i + j*j) * 0.18);
          acc += texture2D(tDiffuse, vUv + o).rgb * w; tw += w;
        }
        col = acc / tw;
      } else {
        col = vec3(texture2D(tDiffuse, vUv + dir).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - dir).b);
      }
      // grade
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, sat);
      col = (col - 0.5) * contrast + 0.5;
      col = col * gain + lift;
      // vignette
      float v = smoothstep(0.95, 0.15, r2 * (1.0 + vignette)); col *= mix(1.0, v, vignette);
      // grain
      float g = h(vUv * res + fract(time) * 91.7) - 0.5; col += g * grain * (1.1 - l);
      // alarm / suspicion / damage tints at the edges
      float edge = smoothstep(0.1, 0.55, r2);
      col += vec3(0.8, 0.02, 0.0) * alarm * edge * 0.6;
      col = mix(col, col * vec3(1.0, 0.82, 0.82) + vec3(0.25,0.0,0.0) * edge, damage);
      col += vec3(0.9, 0.85, 0.5) * suspicion * edge * 0.25;
      col += vec3(flash);
      // eyelids (0 = open, 1 = closed)
      if (eyelid > 0.001) {
        float lid = eyelid * 0.62 + 0.0;
        float m = smoothstep(lid - 0.06, lid, abs(vUv.y - 0.5));
        col *= (1.0 - eyelid) * 0.0 + mix(1.0, m, 1.0) ;
        col = mix(col, vec3(0.0), smoothstep(0.92, 1.0, eyelid));
      }
      // letterbox
      float bar = letter * 0.125;
      if (vUv.y < bar || vUv.y > 1.0 - bar) col = vec3(0.0);
      col *= 1.0 - fade;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

/** Second pass for the first-person viewmodel: layer 1 only, depth cleared, background suppressed. */
class ViewmodelPass extends RenderPass {
  render(renderer, writeBuffer, readBuffer, dt, mask) {
    const bg = this.scene.background; const fog = this.scene.fog;
    this.scene.background = null; this.scene.fog = null;
    super.render(renderer, writeBuffer, readBuffer, dt, mask);
    this.scene.background = bg; this.scene.fog = fog;
  }
}

export class Gfx {
  constructor(canvas, { quality = 'high', width = 1280, height = 720 } = {}) {
    this.q = { ...(QUALITY[quality] || QUALITY.high) };
    // URL overrides (capture/perf experiments): ?msaa=2&sm=1024&pool=5
    { const sp = new URLSearchParams(typeof location !== 'undefined' ? location.search : ''); if (sp.has('msaa')) this.q.samples = +sp.get('msaa'); if (sp.has('sm')) this.q.shadowMap = +sp.get('sm'); if (sp.has('pool')) this.q.pool = +sp.get('pool'); if (sp.has('bloom')) this.q.bloom = sp.get('bloom') !== '0'; }
    this.qualityName = quality;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(this.q.pixelRatio);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    this.renderer = renderer;
    this.w = width; this.h = height;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, width / height, 0.05, 400);
    this.camera.layers.enable(0);
    this.scene.add(this.camera);
    this.vmCamera = new THREE.PerspectiveCamera(58, width / height, 0.01, 10);
    this.vmCamera.layers.set(1);
    this.camera.add(this.vmCamera);

    const rt = new THREE.WebGLRenderTarget(width * this.q.pixelRatio, height * this.q.pixelRatio, { type: THREE.HalfFloatType, samples: this.q.samples });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(1);
    this.composer.setSize(width * this.q.pixelRatio, height * this.q.pixelRatio);
    this.mainPass = new RenderPass(this.scene, this.camera);
    this.vmPass = new ViewmodelPass(this.scene, this.vmCamera);
    this.vmPass.clear = false; this.vmPass.clearDepth = true;
    this.composer.addPass(this.mainPass);
    this.composer.addPass(this.vmPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width * this.q.pixelRatio, height * this.q.pixelRatio), 0.5, 0.7, 0.92);
    this.bloom.enabled = this.q.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.res.value.set(width, height);
    this.grade.uniforms.aspect.value = width / height;
    this.composer.addPass(this.grade);
    this.u = this.grade.uniforms;
    this.time = 0;
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    const pr = this.q.pixelRatio;
    this.composer.setSize(w * pr, h * pr);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = w / h; this.vmCamera.updateProjectionMatrix();
    this.u.res.value.set(w, h); this.u.aspect.value = w / h;
  }

  render(time) {
    this.u.time.value = time;
    this.renderer.shadowMap.needsUpdate = true;
    this.composer.render();
  }
}

// ------------------------------------------------------------------------------------------------
// Light pool — N real point lights re-assigned to the nearest fixtures with a short crossfade.
// ------------------------------------------------------------------------------------------------
export class LightRig {
  constructor(scene, count, shadowCount = 1, shadowSize = 1024) {
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 16, 2);
      l.layers.enable(0);
      if (i < shadowCount) { l.castShadow = true; l.shadow.mapSize.set(shadowSize, shadowSize); l.shadow.bias = -0.0008; l.shadow.normalBias = 0.03; l.shadow.radius = 3; l.shadow.camera.near = 0.2; l.shadow.camera.far = 22; }
      scene.add(l);
      this.lights.push({ light: l, fx: null, next: null, level: 0 });
    }
  }
  /** fixtures: array of registered fixtures; camPos: THREE.Vector3; activeAreas: Set of names. */
  update(dt, time, fixtures, camPos, activeAreas) {
    const scored = [];
    for (const f of fixtures) {
      if (f.on <= 0.01) continue;
      if (f.area && activeAreas && !activeAreas.has(f.area)) continue;
      const d = f.pos.distanceToSquared(camPos);
      scored.push([d - (f.priority || 0) * 40, f]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    const want = scored.slice(0, this.lights.length).map((s) => s[1]);
    const taken = new Set();
    // keep those already assigned that are still wanted
    for (const slot of this.lights) {
      if (slot.fx && want.includes(slot.fx) && !taken.has(slot.fx)) { taken.add(slot.fx); slot.next = null; }
    }
    for (const slot of this.lights) {
      if (slot.fx && taken.has(slot.fx)) continue;
      const nf = want.find((f) => !taken.has(f) && !this.lights.some((s) => s !== slot && (s.fx === f || s.next === f)));
      if (nf) { slot.next = nf; taken.add(nf); } else slot.next = null;
      if (!slot.next && slot.fx) { /* fade out below */ }
    }
    for (const slot of this.lights) {
      const l = slot.light;
      // fade down if we need to swap or fixture dropped
      const wantsSwap = slot.next && slot.next !== slot.fx;
      const dropped = slot.fx && !want.includes(slot.fx);
      const target = (wantsSwap || dropped || !slot.fx) ? 0 : 1;
      slot.level = damp(slot.level, target, 14, dt);
      if ((wantsSwap || dropped || !slot.fx) && slot.level < 0.03) {
        slot.fx = slot.next || null; slot.next = null;
        if (slot.fx) {
          l.position.copy(slot.fx.pos); l.color.set(slot.fx.color); l.distance = slot.fx.range;
        }
      }
      if (slot.fx) {
        const f = slot.fx;
        let fl = 1;
        if (f.flicker > 0) fl = 1 - f.flicker * (0.5 + 0.5 * Math.sin(time * 37 + f.pos.x * 3.1)) * (hash01(Math.floor(time * 12) + f.pos.x * 17) > 0.6 ? 1 : 0.15);
        l.position.copy(f.pos);
        l.color.set(f.color);
        l.intensity = f.intensity * f.on * fl * slot.level;
        l.distance = f.range;
      } else l.intensity = 0;
    }
  }
}

// ------------------------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------------------------
export function glowSprite(pos, size, color = 0xdfeee8, opacity = 0.6) {
  const m = new THREE.SpriteMaterial({ map: DECALS.glow, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const s = new THREE.Sprite(m);
  s.position.copy(pos);
  s.scale.set(size, size, 1);
  s.userData.baseOpacity = opacity;
  return s;
}

const ShaftMat = (color, intensity) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { color: { value: new THREE.Color(color) }, intensity: { value: intensity }, time: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vH = uv.y; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 color; uniform float intensity, time; varying vec3 vN; varying vec3 vV; varying float vH;
    void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 1.6) * smoothstep(0.0, 0.35, vH) * (1.0 - vH * 0.55); a *= 0.85 + 0.15 * sin(time * 0.7 + vH * 9.0); a *= 1.0 - smoothstep(0.7, 1.0, vH); gl_FragColor = vec4(color * a * intensity, 1.0); }`,
});
/** Light shaft from `a` (source, small) to `b` (floor, wide). */
export function lightShaft(a, b, r0, r1, color = 0xbdd6ff, intensity = 0.18) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r0, r1, len, 20, 1, true);
  // uv.y: 1 at top (source) -> 0 at bottom; remap so alpha fades toward the far end
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const m = new THREE.Mesh(g, ShaftMat(color, intensity));
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  m.renderOrder = 4;
  m.frustumCulled = false;
  return m;
}

const BeamMat = (color, intensity) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { color: { value: new THREE.Color(color) }, intensity: { value: intensity } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vH = uv.y; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 color; uniform float intensity; varying vec3 vN; varying vec3 vV; varying float vH;
    void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 1.4) * pow(max(1.0 - vH, 0.0), 1.6) * smoothstep(0.0, 0.12, vH); gl_FragColor = vec4(color * a * intensity, 1.0); }`,
});
/** Soft volumetric-looking cone with its apex at the origin, opening toward local -z (security-camera vision cone). */
export function coneBeam(range, halfAngle, color = 0xffd070, intensity = 0.2) {
  const g = new THREE.CylinderGeometry(0.02, Math.tan(halfAngle) * range, range, 24, 1, true);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  g.translate(0, -range / 2, 0); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, BeamMat(color, intensity)); m.frustumCulled = false; m.renderOrder = 4;
  return m;
}

/** Drifting dust motes confined to a box; positions are a pure function of time. */
export function dustField(box, count, color = 0xffffff, size = 0.035, opacity = 0.5) {
  const [x0, y0, z0, x1, y1, z1] = box;
  const seeds = new Float32Array(count * 3);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { seeds[i * 3] = hash01(i + 1); seeds[i * 3 + 1] = hash01(i + 100); seeds[i * 3 + 2] = hash01(i + 200); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { time: { value: 0 }, box0: { value: new THREE.Vector3(x0, y0, z0) }, box1: { value: new THREE.Vector3(x1, y1, z1) }, color: { value: new THREE.Color(color) }, size: { value: size }, opacity: { value: opacity }, scale: { value: 700 } },
    vertexShader: `attribute vec3 seed; uniform float time, size, scale; uniform vec3 box0, box1; varying float vA;
      void main(){ vec3 s = seed; vec3 p = box0 + (box1 - box0) * fract(s + vec3(sin(time*0.05 + s.y*20.0)*0.02, -time*0.004*(0.5+s.z), cos(time*0.04 + s.x*18.0)*0.02) * 4.0 );
        p += vec3(sin(time*0.3 + s.x*40.0), sin(time*0.23 + s.y*30.0), cos(time*0.27 + s.z*50.0)) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * scale / max(0.4, -mv.z);
        vA = 0.35 + 0.65 * fract(s.x*7.0+s.z*3.0); }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); gl_FragColor = vec4(color * a * vA * opacity, 1.0); }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  return pts;
}
