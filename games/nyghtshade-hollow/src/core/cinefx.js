// Cinematic post passes (only built with ?cine): linear depth, depth of field with highlight bokeh, camera motion blur, anamorphic streaks.
// All of them work on the HDR image before bloom / tone mapping, are visual only (no simulation state is read or written) and are skipped
// (pass.enabled = false) unless a shot asks for them.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const target = (w, h, type = THREE.HalfFloatType) => new THREE.WebGLRenderTarget(w, h, { type, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
const mat = (uniforms, fragmentShader) => new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader, depthTest: false, depthWrite: false });

/** Copies the scene's depth texture into a plain colour texture holding view-space distance (so later passes can sample it while writing into the same targets). */
export class DepthLinPass extends Pass {
  constructor(camera) {
    super();
    this.needsSwap = false; this.camera = camera; this.rt = target(1, 1);
    this.rt.texture.minFilter = THREE.NearestFilter; this.rt.texture.magFilter = THREE.NearestFilter;
    this.m = mat({ tDepth: { value: null }, near: { value: 0.05 }, far: { value: 400 } },
      `uniform sampler2D tDepth; uniform float near, far; varying vec2 vUv;
       void main(){ float d = texture2D(tDepth, vUv).x; float z = d * 2.0 - 1.0; gl_FragColor = vec4(2.0 * near * far / (far + near - z * (far - near)), 0.0, 0.0, 1.0); }`);
    this.quad = new FullScreenQuad(this.m);
  }
  setSize(w, h) { this.rt.setSize(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    if (!readBuffer.depthTexture) return;
    this.m.uniforms.tDepth.value = readBuffer.depthTexture; this.m.uniforms.near.value = this.camera.near; this.m.uniforms.far.value = this.camera.far;
    renderer.setRenderTarget(this.rt); this.quad.render(renderer);
  }
  get texture() { return this.rt.texture; }
  dispose() { this.rt.dispose(); this.m.dispose(); this.quad.dispose(); }
}

/** Depth of field: half-resolution disc gather weighted by each sample's own circle of confusion (foreground blur bleeds over sharp background, sharp foreground edges stay clean),
 *  bright samples are boosted so lights become bokeh discs. Parameters (set per frame by the director): focus (m), cocK (px of blur per unit of relative defocus), maxR (px), boost, taps. */
export class DofPass extends Pass {
  constructor(depth) {
    super();
    this.needsSwap = true; this.depth = depth;
    this.half = target(1, 1); this.blur = target(1, 1);
    this.p = { focus: 4, cocK: 0, maxR: 26, boost: 2.2, taps: 56 };
    this.mPre = mat({ tColor: { value: null } }, `uniform sampler2D tColor; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0); }`);
    const cocFn = `float cocAt(float z){ return cocK * (z - focus) / max(z, 0.01); }`;
    this.mGather = mat({ tHalf: { value: null }, tDepth: { value: null }, resFull: { value: new THREE.Vector2(1, 1) }, focus: { value: 4 }, cocK: { value: 0 }, maxR: { value: 26 }, boost: { value: 2 }, taps: { value: 56 } },
      `uniform sampler2D tHalf, tDepth; uniform vec2 resFull; uniform float focus, cocK, maxR, boost; uniform int taps; varying vec2 vUv;
       ${cocFn}
       float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
       void main(){
         float zc = texture2D(tDepth, vUv).r, rc = min(abs(cocAt(zc)) * 0.5, maxR);
         // probe the neighbourhood for the largest blur radius that could reach this pixel
         float R = rc;
         for (int i = 0; i < 12; i++) {
           float a = float(i) * 0.5235988, k = (i < 6) ? 0.5 : 1.0;
           vec2 o = vec2(cos(a * 2.0 + 0.4), sin(a * 2.0 + 0.4)) * maxR * k / resFull;
           float zs = texture2D(tDepth, vUv + o).r; R = max(R, min(abs(cocAt(zs)) * 0.5, maxR));
         }
         vec3 c0 = texture2D(tHalf, vUv).rgb;
         if (R < 0.8) { gl_FragColor = vec4(c0, 0.0); return; }
         float rot = hash(gl_FragCoord.xy) * 6.2831853;
         vec3 acc = c0; float ws = 1.0, cov = rc > 1.0 ? 1.0 : 0.0, nt = float(taps);
         for (int i = 0; i < 96; i++) {
           if (i >= taps) break;
           float fi = float(i) + 0.5, rho = sqrt(fi / nt), th = fi * 2.39996323 + rot;
           vec2 o = vec2(cos(th), sin(th)) * rho * R;
           vec2 uv = vUv + o / resFull;
           float zs = texture2D(tDepth, uv).r, rs = min(abs(cocAt(zs)) * 0.5, maxR), d = length(o);
           float reach = (zs > zc + 0.12) ? min(rs, rc) : rs;                       // a sample behind us can only bleed within our own blur
           float w = clamp(reach - d + 1.0, 0.0, 1.0);
           if (w <= 0.0) continue;
           vec3 s = texture2D(tHalf, uv).rgb;
           float l = max(max(s.r, s.g), s.b);
           w *= 1.0 + boost * smoothstep(1.2, 6.0, l);
           acc += s * w; ws += w; cov += w * (rs > 1.0 ? 1.0 : 0.0);
         }
         gl_FragColor = vec4(acc / ws, clamp(cov / ws, 0.0, 1.0));
       }`);
    this.mComp = mat({ tColor: { value: null }, tBlur: { value: null }, tDepth: { value: null }, focus: { value: 4 }, cocK: { value: 0 } },
      `uniform sampler2D tColor, tBlur, tDepth; uniform float focus, cocK; varying vec2 vUv;
       ${cocFn}
       void main(){
         vec3 sharp = texture2D(tColor, vUv).rgb; float rc = abs(cocAt(texture2D(tDepth, vUv).r)) * 0.5; vec4 b = texture2D(tBlur, vUv);
         float k = max(smoothstep(0.6, 3.0, rc), b.a);
         gl_FragColor = vec4(mix(sharp, b.rgb, k), 1.0);
       }`);
    this.quad = new FullScreenQuad(this.mPre);
  }
  setSize(w, h) { this.half.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); this.blur.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1)); this.mGather.uniforms.resFull.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    const p = this.p, dt = this.depth.texture;
    this.quad.material = this.mPre; this.mPre.uniforms.tColor.value = readBuffer.texture; renderer.setRenderTarget(this.half); this.quad.render(renderer);
    const g = this.mGather.uniforms; g.tHalf.value = this.half.texture; g.tDepth.value = dt; g.focus.value = p.focus; g.cocK.value = p.cocK; g.maxR.value = p.maxR; g.boost.value = p.boost; g.taps.value = p.taps;
    this.quad.material = this.mGather; renderer.setRenderTarget(this.blur); this.quad.render(renderer);
    const c = this.mComp.uniforms; c.tColor.value = readBuffer.texture; c.tBlur.value = this.blur.texture; c.tDepth.value = dt; c.focus.value = p.focus; c.cocK.value = p.cocK;
    this.quad.material = this.mComp; renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
  dispose() { this.half.dispose(); this.blur.dispose(); this.mPre.dispose(); this.mGather.dispose(); this.mComp.dispose(); this.quad.dispose(); }
}

/** Camera motion blur from depth re-projection: every pixel is smeared along the screen-space displacement the camera produced since `prevVP` (view-projection at t - shutter). */
export class MotionBlurPass extends Pass {
  constructor(depth, camera) {
    super();
    this.needsSwap = true; this.depth = depth; this.camera = camera;
    this.prevVP = new THREE.Matrix4(); this.amount = 1; this.samples = 14; this.maxLen = 0.07;
    this.m = mat({ tColor: { value: null }, tDepth: { value: null }, prevVP: { value: this.prevVP }, camWorld: { value: new THREE.Matrix4() }, tanHalf: { value: new THREE.Vector2(1, 1) }, amount: { value: 1 }, maxLen: { value: 0.07 }, n: { value: 14 } },
      `uniform sampler2D tColor, tDepth; uniform mat4 prevVP, camWorld; uniform vec2 tanHalf; uniform float amount, maxLen; uniform int n; varying vec2 vUv;
       float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
       void main(){
         float vz = texture2D(tDepth, vUv).r;
         vec3 vp = vec3((vUv * 2.0 - 1.0) * tanHalf * vz, -vz);
         vec4 pc = prevVP * (camWorld * vec4(vp, 1.0));
         vec2 prevUv = pc.xy / pc.w * 0.5 + 0.5;
         vec2 v = (vUv - prevUv) * amount;
         float len = length(v); if (len > maxLen) v *= maxLen / len;
         if (len < 0.0006) { gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0); return; }
         vec3 acc = vec3(0.0); float j = hash(gl_FragCoord.xy) - 0.5, nf = float(n);
         for (int i = 0; i < 32; i++) { if (i >= n) break; float t = (float(i) + 0.5 + j) / nf - 0.5; acc += texture2D(tColor, vUv + v * t).rgb; }
         gl_FragColor = vec4(acc / nf, 1.0);
       }`);
    this.quad = new FullScreenQuad(this.m);
  }
  setPrev(camera) { this.prevVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); }
  render(renderer, writeBuffer, readBuffer) {
    const u = this.m.uniforms, cam = this.camera;
    u.tColor.value = readBuffer.texture; u.tDepth.value = this.depth.texture; u.camWorld.value.copy(cam.matrixWorld);
    const th = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2); u.tanHalf.value.set(th * cam.aspect, th);
    u.amount.value = this.amount; u.maxLen.value = this.maxLen; u.n.value = this.samples;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
  dispose() { this.m.dispose(); this.quad.dispose(); }
}

/** Anamorphic streaks: bright pixels are pooled at quarter resolution, smeared horizontally (two widening passes) and added back, tinted. */
export class StreakPass extends Pass {
  constructor() {
    super();
    this.needsSwap = true; this.amount = 0.6; this.threshold = 2.2; this.tint = new THREE.Color(0.42, 0.62, 1.0); this.len = 1;
    this.a = target(1, 1); this.b = target(1, 1);
    this.mBright = mat({ tColor: { value: null }, threshold: { value: 2.2 } },
      `uniform sampler2D tColor; uniform float threshold; varying vec2 vUv;
       void main(){ vec3 c = texture2D(tColor, vUv).rgb; float l = max(max(c.r, c.g), c.b); gl_FragColor = vec4(c * max(l - threshold, 0.0) / max(l, 1e-4), 1.0); }`);
    this.mBlur = mat({ tColor: { value: null }, stp: { value: new THREE.Vector2(1, 0) } },
      `uniform sampler2D tColor; uniform vec2 stp; varying vec2 vUv;
       void main(){ vec3 acc = vec3(0.0); float ws = 0.0;
         for (int i = -16; i <= 16; i++) { float f = float(i); float w = exp(-f * f * 0.012); acc += texture2D(tColor, vUv + stp * f).rgb * w; ws += w; }
         gl_FragColor = vec4(acc / ws, 1.0); }`);
    this.mComp = mat({ tColor: { value: null }, tStreak: { value: null }, tint: { value: this.tint }, amount: { value: 0.6 } },
      `uniform sampler2D tColor, tStreak; uniform vec3 tint; uniform float amount; varying vec2 vUv;
       void main(){ vec3 s = texture2D(tStreak, vUv).rgb; gl_FragColor = vec4(texture2D(tColor, vUv).rgb + s * tint * amount, 1.0); }`);
    this.quad = new FullScreenQuad(this.mBright);
  }
  setSize(w, h) { this.w = Math.max(1, w >> 2); this.h = Math.max(1, h >> 2); this.a.setSize(this.w, this.h); this.b.setSize(this.w, this.h); }
  render(renderer, writeBuffer, readBuffer) {
    const q = this.quad;
    q.material = this.mBright; this.mBright.uniforms.tColor.value = readBuffer.texture; this.mBright.uniforms.threshold.value = this.threshold; renderer.setRenderTarget(this.a); q.render(renderer);
    q.material = this.mBlur; const s = this.mBlur.uniforms;
    s.tColor.value = this.a.texture; s.stp.value.set(1.6 * this.len / this.w, 0); renderer.setRenderTarget(this.b); q.render(renderer);
    s.tColor.value = this.b.texture; s.stp.value.set(5.0 * this.len / this.w, 0); renderer.setRenderTarget(this.a); q.render(renderer);
    const c = this.mComp.uniforms; c.tColor.value = readBuffer.texture; c.tStreak.value = this.a.texture; c.amount.value = this.amount;
    q.material = this.mComp; renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); q.render(renderer);
  }
  dispose() { this.a.dispose(); this.b.dispose(); this.mBright.dispose(); this.mBlur.dispose(); this.mComp.dispose(); this.quad.dispose(); }
}

/** Sensor height (mm) of the 2.39:1 frame on a 36 mm wide sensor; lens focal lengths in the shot lists are full-frame equivalents. */
export const SENSOR_H = 36 / 2.39;
export const fovFromLens = (mm) => THREE.MathUtils.radToDeg(2 * Math.atan(SENSOR_H / (2 * mm)));
/** CoC scale: pixels of blur diameter per unit of relative defocus (|S - S1| / S) for a lens of `mm` at f/`fstop` focused at `focusM` metres, on a frame `heightPx` tall. */
export const cocScale = (mm, fstop, focusM, heightPx) => (mm * mm / (fstop * Math.max(1, focusM * 1000 - mm))) / SENSOR_H * heightPx;
