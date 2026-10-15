// The forest outside the wire: gully, clearing with the old oak, tree line, prison perimeter backdrop, procedural sky.
import * as THREE from 'three';
import { Batch } from '../geo.js';
import { MAT } from '../../proc/materials.js';
import { TEX } from '../../proc/textures.js';
import { glowSprite } from '../../core/gfx.js';
import { fbm } from '../../proc/noise.js';
import { mulberry32, smoothstep, clamp, lerp } from '../../util.js';

export const CLEARING = new THREE.Vector3(-102, 0, -32);
export const OAK = new THREE.Vector3(-105.5, 0, -35);
export const MOUTH = new THREE.Vector3(-76.3, -3.2, -24);
const PATH = [[-76.3, -24], [-84, -24], [-91, -26.5], [-97, -30], [-101, -32]];

function polyDist(x, z) {
  let best = 1e9, bs = 0, acc = 0, total = 0;
  const lens = [];
  for (let i = 0; i < PATH.length - 1; i++) { const l = Math.hypot(PATH[i + 1][0] - PATH[i][0], PATH[i + 1][1] - PATH[i][1]); lens.push(l); total += l; }
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / l2; t = clamp(t, 0, 1);
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; bs = (acc + lens[i] * t) / total; }
    acc += lens[i];
  }
  return [best, bs];
}

export function terrainHeight(x, z) {
  // rolling base
  let h = Math.sin(x * 0.043 + 1.3) * Math.cos(z * 0.051 + 0.4) * 1.3 + Math.sin(x * 0.11 + z * 0.083) * 0.45 + Math.sin(z * 0.2 + x * 0.13) * 0.18;
  h += 0.8;
  // flatten the clearing
  const dc = Math.hypot(x - CLEARING.x, z - CLEARING.z);
  const flat = 1 - smoothstep(13, 26, dc);
  h = lerp(h, 0.25 + Math.sin(x * 0.2) * Math.cos(z * 0.18) * 0.08, flat);
  // gully carved from the culvert mouth to the clearing
  const [d, s] = polyDist(x, z);
  let mask = 1 - smoothstep(1.9, 7.5 + s * 5, d);
  mask *= smoothstep(-75.6, -77.4, x);
  const gy = lerp(-3.45, 0.2, smoothstep(0.05, 0.92, s));
  h = lerp(h, gy, mask);
  // bank wall east of mouth stays high (tunnel passes beneath)
  if (x > -76.3) h = Math.max(h, 0.6);
  return h;
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zenith: { value: new THREE.Color(0x0b1224) }, horizon: { value: new THREE.Color(0x253347) }, sunDir: { value: new THREE.Vector3(0.3, 0.2, -0.9).normalize() }, sunColor: { value: new THREE.Color(0xffc080) }, sunSize: { value: 0.0 }, stars: { value: 1.0 }, time: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 zenith, horizon, sunDir, sunColor; uniform float sunSize, stars, time; varying vec3 vP;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vP); float y = max(d.y, 0.0);
        vec3 col = mix(horizon, zenith, pow(y, 0.55));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (pow(sd, 6.0) * 0.35 + pow(sd, 64.0) * 0.7 + smoothstep(0.9996, 0.9999, sd) * 4.0 * sunSize);
        col += sunColor * pow(1.0 - y, 6.0) * 0.18 * sunSize;
        // clouds
        vec2 cp = d.xz / (d.y + 0.25) * 1.4 + vec2(time * 0.004, 0.0);
        float c = n2(cp * 2.0) * 0.55 + n2(cp * 4.0) * 0.3 + n2(cp * 8.0) * 0.15;
        float cl = smoothstep(0.52, 0.78, c) * smoothstep(0.0, 0.25, y);
        col = mix(col, mix(horizon * 1.25, sunColor * 0.9, pow(sd, 3.0) * 0.6), cl * 0.55);
        // stars
        float st = step(0.9965, h21(floor(d.xz / (d.y + 0.2) * 190.0))) * stars * smoothstep(0.1, 0.5, y) * (1.0 - cl);
        col += vec3(st) * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function buildOutside(world, ctx) {
  const marks = ctx.marks;
  const area = world.addArea('outside', [-170, -100, -60, -13.8], { neighbors: ['tunnel2'], yRange: [-6, 60], tag: 'outdoor', reverb: 0.05 });
  area.surface = 'dirt';
  const rnd = mulberry32(777);
  const g = area.group;

  // ---- sky --------------------------------------------------------------------------------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMaterial());
  sky.renderOrder = -10; sky.frustumCulled = false;
  g.add(sky); ctx.sky = sky;

  // ---- terrain ----------------------------------------------------------------------------
  const X0 = -160, X1 = -60, Z0 = -98, Z1 = -13.9;
  const nx = 200, nz = 170;
  const tg = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (X0 + X1) / 2, z = pos.getZ(i) + (Z0 + Z1) / 2;
    const y = terrainHeight(x, z);
    pos.setXYZ(i, x, y, z);
    const [d, s] = polyDist(x, z);
    const n = fbm((x + 400) * 0.01 % 1, (z + 400) * 0.01 % 1, 8, 3, 3);
    const dc = Math.hypot(x - CLEARING.x, z - CLEARING.z);
    const meadow = 1 - smoothstep(10, 24, dc);
    const damp = (1 - smoothstep(1.5, 5, d)) * 0.5;
    cols[i * 3] = (0.7 + n * 0.35) * (1 - damp * 0.3) * (1 + meadow * 0.1);
    cols[i * 3 + 1] = (0.78 + n * 0.3) * (1 + meadow * 0.18);
    cols[i * 3 + 2] = (0.62 + n * 0.25) * (1 - damp * 0.2);
    uv[i * 2] = x / 8; uv[i * 2 + 1] = z / 8;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, MAT.ground);
  terrain.receiveShadow = true; terrain.castShadow = false;
  g.add(terrain);
  world.addSurface(X0, Z0, X1, Z1, 0, 0, 'x', terrainHeight);
  // invisible fence: keep the player inside the forest bowl
  for (const [a, b, c, d] of [[X0, Z0, X0 + 1, Z1], [X0, Z0, X1, Z0 + 1], [X1 - 1, Z0, X1, -26.5], [X1 - 1, -21.5, X1, Z1], [X0, Z1 - 1, X1, Z1]]) world.addCollider(a, -8, b, c, 40, d, { sight: false, tag: 'forest' });

  // ---- sun ---------------------------------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xffc990, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  sun.position.set(CLEARING.x + 38, 32, CLEARING.z + 55);
  sun.target.position.copy(CLEARING);
  sun.layers.enable(1);
  g.add(sun); g.add(sun.target);
  ctx.sun = sun;

  // ---- trees (instanced) -------------------------------------------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.26, 3.2, 7); trunkGeo.translate(0, 1.6, 0);
  const cone = (r, h, y) => { const c = new THREE.ConeGeometry(r, h, 8); c.translate(0, y + h / 2, 0); return c; };
  const colorize = (geo, r, gg, b, jitter = 0.08) => {
    const c = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < geo.attributes.position.count; i++) { const j = (rnd() - 0.5) * jitter; c[i * 3] = r + j; c[i * 3 + 1] = gg + j; c[i * 3 + 2] = b + j; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    return geo;
  };
  const merge = (arr) => { const out = new THREE.BufferGeometry(); const pos = [], nor = [], col = [], uvs = [], idx = []; let off = 0; for (const gm of arr) { const g2 = gm.index ? gm : gm; for (let i = 0; i < g2.attributes.position.count; i++) { pos.push(g2.attributes.position.getX(i), g2.attributes.position.getY(i), g2.attributes.position.getZ(i)); nor.push(g2.attributes.normal.getX(i), g2.attributes.normal.getY(i), g2.attributes.normal.getZ(i)); col.push(g2.attributes.color.getX(i), g2.attributes.color.getY(i), g2.attributes.color.getZ(i)); uvs.push(0, 0); } if (g2.index) { for (let i = 0; i < g2.index.count; i++) idx.push(g2.index.array[i] + off); } else { for (let i = 0; i < g2.attributes.position.count; i++) idx.push(i + off); } off += g2.attributes.position.count; } out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); out.setIndex(idx); return out; };
  const conifer = merge([
    colorize(trunkGeo.clone(), 0.2, 0.13, 0.08),
    colorize(cone(1.5, 2.4, 1.4), 0.07, 0.17, 0.09), colorize(cone(1.15, 2.2, 2.8), 0.08, 0.2, 0.1), colorize(cone(0.8, 2.0, 4.2), 0.09, 0.22, 0.11), colorize(cone(0.45, 1.5, 5.6), 0.1, 0.24, 0.12),
  ]);
  const broadleaf = (() => {
    const parts = [colorize(new THREE.CylinderGeometry(0.2, 0.35, 3.0, 7).translate(0, 1.5, 0), 0.19, 0.13, 0.09)];
    for (const [x, y, z, r] of [[0, 4.4, 0, 1.9], [1.1, 3.8, 0.4, 1.4], [-1.0, 4.0, -0.5, 1.5], [0.2, 5.5, 0.3, 1.2], [-0.3, 3.6, 1.2, 1.2]]) {
      const s = new THREE.IcosahedronGeometry(r, 1); s.translate(x, y, z);
      const p = s.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (rnd() - 0.5) * 0.25; p.setXYZ(i, p.getX(i) * k, p.getY(i) * (0.85 + rnd() * 0.1), p.getZ(i) * k); }
      s.computeVertexNormals(); parts.push(colorize(s, 0.14, 0.26, 0.09, 0.1));
    }
    return merge(parts);
  })();
  const treeMat = MAT.leaf.clone(); treeMat.vertexColors = true; treeMat.roughness = 0.92; treeMat.color.set(0xffffff);
  const places = [];
  for (let i = 0; i < 520 && places.length < 380; i++) {
    const x = lerp(X0 + 3, X1 - 3, rnd()), z = lerp(Z0 + 3, Z1 - 4, rnd());
    const dc = Math.hypot(x - CLEARING.x, z - CLEARING.z);
    if (dc < 15) continue;
    const [pd] = polyDist(x, z);
    if (pd < 4.5 && x < -70) continue;
    if (x > -82 && z > -30 && z < -19) continue; // keep the area above the tunnel mouth open
    if (z > -19.5) { if (rnd() < 0.55) continue; } // thin near the wall
    places.push([x, z]);
  }
  ctx.trees = places;
  for (const [geo, share] of [[conifer, 0.62], [broadleaf, 0.38]]) {
    const list = places.filter(() => rnd() < share);
    const inst = new THREE.InstancedMesh(geo, treeMat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    list.forEach(([x, z], i) => {
      const s = 0.8 + rnd() * 0.9; e.set((rnd() - 0.5) * 0.06, rnd() * 6.28, (rnd() - 0.5) * 0.06); q.setFromEuler(e);
      p.set(x, terrainHeight(x, z) - 0.15, z); sc.set(s, s * (0.9 + rnd() * 0.3), s);
      inst.setMatrixAt(i, m.compose(p, q, sc));
      col.setHSL(0.27 + (rnd() - 0.5) * 0.05, 0.25 + rnd() * 0.15, 0.55 + rnd() * 0.35); inst.setColorAt(i, col);
    });
    inst.castShadow = true; inst.receiveShadow = false; inst.frustumCulled = false;
    g.add(inst);
  }

  // ---- grass tufts around the clearing -----------------------------------------------------
  {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
    x.clearRect(0, 0, 128, 128);
    for (let b = 0; b < 18; b++) {
      const bx = 8 + rnd() * 112, h = 50 + rnd() * 70, lean = (rnd() - 0.5) * 36;
      const gr = x.createLinearGradient(0, 128, 0, 128 - h); gr.addColorStop(0, '#1d3a12'); gr.addColorStop(1, '#8fae4a');
      x.fillStyle = gr; x.beginPath(); x.moveTo(bx - 3, 128); x.quadraticCurveTo(bx + lean * 0.4, 128 - h * 0.6, bx + lean, 128 - h); x.quadraticCurveTo(bx + lean * 0.4 + 3, 128 - h * 0.6, bx + 3, 128); x.fill();
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const gm = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
    const q1 = new THREE.PlaneGeometry(0.7, 0.55); q1.translate(0, 0.27, 0);
    const q2 = q1.clone().rotateY(Math.PI / 2);
    const tuft = merge([q1, q2].map((gg) => { const gc = gg.clone(); gc.setAttribute('color', new THREE.BufferAttribute(new Float32Array(gc.attributes.position.count * 3).fill(1), 3)); return gc; }));
    // keep real uvs for the tuft
    const u1 = q1.attributes.uv.array, u2 = q2.attributes.uv.array; const uvs = new Float32Array(u1.length + u2.length); uvs.set(u1, 0); uvs.set(u2, u1.length); tuft.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    const N = 2600;
    const inst = new THREE.InstancedMesh(tuft, gm, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    let n = 0;
    while (n < N) {
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 30;
      const x2 = CLEARING.x + Math.cos(a) * r * 1.3 + 4, z2 = CLEARING.z + Math.sin(a) * r;
      if (z2 > -15 || z2 < -95) continue;
      const [pd] = polyDist(x2, z2); if (pd < 1.4) continue;
      const s = 0.7 + rnd() * 0.9;
      e.set(0, rnd() * 6.28, 0); q.setFromEuler(e); p.set(x2, terrainHeight(x2, z2) - 0.02, z2); sc.set(s, s * (0.8 + rnd() * 0.6), s);
      inst.setMatrixAt(n++, m.compose(p, q, sc));
    }
    inst.frustumCulled = false; inst.castShadow = false; inst.receiveShadow = false;
    g.add(inst);
  }

  // ---- the old oak, crate and blanket -----------------------------------------------------
  {
    const oak = new THREE.Group();
    const y0 = terrainHeight(OAK.x, OAK.z);
    oak.position.set(OAK.x, y0 - 0.1, OAK.z);
    // trunk: lathe with root flare
    const profile = [[0.9, 0], [0.74, 0.35], [0.62, 0.9], [0.6, 2.2], [0.57, 3.4], [0.5, 4.4]].map(([r, y]) => new THREE.Vector2(r, y));
    const lg = new THREE.LatheGeometry(profile, 14);
    const lp = lg.attributes.position; for (let i = 0; i < lp.count; i++) { const a = Math.atan2(lp.getZ(i), lp.getX(i)); const k = 1 + Math.sin(a * 5) * 0.06 * (1 - lp.getY(i) / 5) + Math.sin(a * 11 + lp.getY(i)) * 0.03; lp.setX(i, lp.getX(i) * k); lp.setZ(i, lp.getZ(i) * k); }
    lg.computeVertexNormals();
    const lu = lg.attributes.uv; for (let i = 0; i < lu.count; i++) lu.setXY(i, lu.getX(i) * 3, lu.getY(i) * 2);
    const trunk = new THREE.Mesh(lg, MAT.bark); trunk.castShadow = trunk.receiveShadow = true; oak.add(trunk);
    // roots
    for (let r = 0; r < 6; r++) { const rg = new THREE.CylinderGeometry(0.07, 0.22, 2.0, 6); rg.rotateZ(Math.PI / 2.6); rg.translate(0.9, 0.12, 0); const m = new THREE.Mesh(rg, MAT.bark); m.rotation.y = r * 1.05 + 0.3; m.castShadow = true; oak.add(m); }
    // limbs
    for (const [ang, h, len, tilt] of [[0.4, 3.9, 3.2, 0.9], [2.2, 4.1, 3.6, 0.85], [4.0, 3.6, 3.0, 1.0], [5.3, 4.5, 3.4, 0.8], [1.3, 4.6, 2.6, 0.7]]) {
      const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.26, len, 7), MAT.bark);
      lm.geometry.translate(0, len / 2, 0); lm.position.set(0, h, 0); lm.rotation.set(0, ang, tilt, 'YZX'); lm.castShadow = true; oak.add(lm);
    }
    // canopy blobs
    const lm = MAT.leaf.clone(); lm.color.set(0x3a5a22); lm.roughness = 0.9; lm.side = THREE.DoubleSide;
    const rr = mulberry32(31);
    for (let i = 0; i < 16; i++) {
      const a = rr() * 6.28, rad = 1.5 + rr() * 3.8;
      const bg = new THREE.IcosahedronGeometry(1.4 + rr() * 1.5, 2);
      const bp = bg.attributes.position; for (let k = 0; k < bp.count; k++) { const n = 1 + (rr() - 0.5) * 0.35; bp.setXYZ(k, bp.getX(k) * n, bp.getY(k) * n * 0.8, bp.getZ(k) * n); }
      bg.computeVertexNormals();
      const b = new THREE.Mesh(bg, lm); b.position.set(Math.cos(a) * rad, 5.2 + rr() * 2.6, Math.sin(a) * rad); b.castShadow = true; b.receiveShadow = true; oak.add(b);
    }
    g.add(oak);
    // crate + blanket + books + tin cup at the foot of the oak
    const B = new Batch();
    const cx = OAK.x + 1.5, cz = OAK.z + 1.4, cy = terrainHeight(cx, cz);
    B.box(cx, cy + 0.25, cz, 0.9, 0.5, 0.6, 'wood', { rotY: 0.5 });
    B.box(cx, cy + 0.52, cz, 0.94, 0.04, 0.64, 'woodDark', { rotY: 0.5 });
    B.box(cx - 1.4, cy + 0.03, cz + 0.5, 1.7, 0.05, 1.2, 'cloth', { rotY: 0.3 });  // blanket
    B.box(cx - 1.0, cy + 0.08, cz + 0.3, 0.25, 0.06, 0.18, 'leather', { rotY: 0.6 });
    B.box(cx - 0.8, cy + 0.07, cz + 0.62, 0.22, 0.05, 0.16, 'paper', { rotY: 0.2 });
    B.cyl(cx + 0.1, cy + 0.6, cz - 0.1, 0.045, 0.04, 0.09, 'steelLight', { seg: 10 });
    B.build(g);
    marks.crate = new THREE.Vector3(cx, cy + 0.3, cz);
    marks.oak = OAK.clone(); marks.blanket = new THREE.Vector3(cx - 1.4, cy, cz + 0.5);
  }

  // ---- prison perimeter & towers (backdrop) ------------------------------------------------
  {
    const B = new Batch();
    const wz = -14.5;
    for (const [a, b] of [[-110, -62], [-48, -40]]) { B.slab(a, 0, wz - 0.3, b, 6.2, wz, 'wallGrey', { vBase: 0 }); }
    B.slab(-62, 0, wz - 0.3, -48, 6.2, wz, 'wallGrey');
    for (let x = -110; x < -40; x += 6) B.box(x, 3.1, wz + 0.1, 0.5, 6.4, 0.55, 'floorDark');
    B.slab(-111, 0, wz - 0.4, -39, 0.8, wz + 0.15, 'floorDark');
    // razor wire coils
    const coil = new THREE.TorusGeometry(0.28, 0.012, 5, 10);
    for (let x = -110; x < -40; x += 0.42) B.geo(coil, 'steelLight', [x, 6.5, wz - 0.12], [0, 0, 0], [1, 1, 1]);
    B.slab(-110, 6.2, wz - 0.3, -40, 6.28, wz, 'steel');
    // towers
    ctx.towerLights = [];
    for (const tx of [-98, -50]) {
      B.box(tx - 1.1, 5, wz - 0.2, 0.25, 10, 0.25, 'steel'); B.box(tx + 1.1, 5, wz - 0.2, 0.25, 10, 0.25, 'steel');
      B.box(tx - 1.1, 5, wz + 1.6, 0.25, 10, 0.25, 'steel'); B.box(tx + 1.1, 5, wz + 1.6, 0.25, 10, 0.25, 'steel');
      B.box(tx, 10.7, wz + 0.7, 3.2, 2.0, 2.8, 'wallGrey');
      B.box(tx, 11.8, wz + 0.7, 3.8, 0.3, 3.4, 'steel');
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), MAT.bulb.clone()); win.material.emissiveIntensity = 1.4; win.position.set(tx, 10.9, wz - 0.72); win.rotation.y = Math.PI; g.add(win);
      g.add(glowSprite(new THREE.Vector3(tx, 10.9, wz - 0.8), 5, 0xffc27a, 0.5));
      // searchlight beam
      const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 34, 24, 1, true), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { k: { value: 0.0 } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vH; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vH = uv.y; gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform float k; varying vec3 vN; varying vec3 vV; varying float vH; void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float a = pow(f, 1.8) * (1.0 - vH) * 0.5 * k; gl_FragColor = vec4(vec3(0.9, 0.95, 1.0) * a, 1.0); }',
      }));
      beam.geometry.translate(0, -17, 0); beam.geometry.rotateX(Math.PI);  // apex at origin, opening toward -y after rotation
      beam.geometry.rotateX(Math.PI);
      beam.position.set(tx, 11.2, wz - 1.4); beam.frustumCulled = false; beam.renderOrder = 6;
      g.add(beam); ctx.towerLights.push({ beam, tx });
    }
    // compound masses behind the wall (chapel exterior etc.)
    B.slab(-73, 0, -13.2, -49, 8.8, 11, 'brick');             // chapel nave shell (solid; interior is separate)
    B.slab(-73.2, 8.8, -13.4, -48.8, 9.0, 11.2, 'steel');
    // pitched roof
    const roofG = new THREE.BufferGeometry();
    const rv = new Float32Array([-73.4, 8.9, -13.6, -48.6, 8.9, -13.6, -61, 13.2, -13.6, -73.4, 8.9, 11.4, -48.6, 8.9, 11.4, -61, 13.2, 11.4]);
    roofG.setAttribute('position', new THREE.BufferAttribute(rv, 3));
    roofG.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3]);
    roofG.computeVertexNormals();
    roofG.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(12), 2)); roofG.setAttribute('color', new THREE.BufferAttribute(new Float32Array(18).fill(1), 3));
    B.geo(roofG, 'steel', [0, 0, 0], [0, 0, 0], [1, 1, 1]);
    B.slab(-61.4, 13, -13.6, -60.6, 17.2, -13.0, 'steel');         // bell cross
    B.slab(-62.4, 15.6, -13.6, -59.6, 16.2, -13.0, 'steel');
    // hall roofs rising beyond
    B.slab(-40, 0, -10, -10, 11, 14, 'wallGrey');
    B.slab(-110, 0, -9, -76, 7.5, 14, 'wallGrey');
    B.slab(-75, 0, 14, -62, 9, 40, 'wallGrey');
    // floodlight masts
    ctx.floods = [];
    for (const fx of [-86, -72, -44]) {
      B.box(fx, 6, -12.5, 0.3, 12, 0.3, 'steel'); B.box(fx, 12.2, -12.5, 1.6, 0.9, 0.3, 'steel');
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.6), MAT.tube.clone()); fl.material.emissiveIntensity = 3; fl.position.set(fx, 12.2, -12.66); fl.rotation.y = Math.PI; g.add(fl);
      const sp = glowSprite(new THREE.Vector3(fx, 12.2, -12.9), 9, 0xe8f4ff, 0.65); g.add(sp); ctx.floods.push({ fl, sp });
    }
    B.build(g);
  }
  marks.clearing = CLEARING.clone();
  marks.gullyStart = new THREE.Vector3(-78.5, terrainHeight(-78.5, -24), -24);
  marks.sitSpot = new THREE.Vector3(OAK.x + 3.3, terrainHeight(OAK.x + 3.3, OAK.z + 1.3), OAK.z + 1.3);
  area.group.visible = false;
  return { area, sun, sky };
}
