// The forest outside the wire: gully, clearing with the old oak, tree line, prison perimeter backdrop, procedural sky.
import * as THREE from 'three';
import { Batch } from '../geo.js';
import { MAT } from '../../proc/materials.js';
import { TEX } from '../../proc/textures.js';
import { glowSprite } from '../../core/gfx.js';
import { fbm } from '../../proc/noise.js';
import { mulberry32, smoothstep, clamp, lerp } from '../../util.js';
import { buildBroadleaf, buildSpruce, leafClusterTexture, spruceTexture, grassTexture, fernTexture, tuftGeometry } from '../foliage.js';
import { lightShaft } from '../../core/gfx.js';


/** Split a big instance list into spatial cells (own bounding spheres) so frustum culling works for the camera and the shadow passes. */
function chunkedInstances(g, geo, mat, items, cell, { cast = false, receive = false } = {}) {
  const cells = new Map();
  for (const it of items) { const k = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell); let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(it); }
  for (const list of cells.values()) {
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { inst.setMatrixAt(i, it.m); if (it.c) inst.setColorAt(i, it.c); });
    inst.castShadow = cast; inst.receiveShadow = receive;
    inst.computeBoundingSphere(); inst.frustumCulled = true;
    g.add(inst);
  }
}

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
  { const sm = Math.min(2048, +(new URLSearchParams(location.search).get('sunsm') || 2048)); sun.shadow.mapSize.set(sm, sm); }
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  sun.position.set(CLEARING.x + 38, 32, CLEARING.z + 55);
  sun.target.position.copy(CLEARING);
  sun.layers.enable(1);
  g.add(sun); g.add(sun.target);
  ctx.sun = sun;

  // ---- vegetation ----------------------------------------------------------------------------
  const leafTex = leafClusterTexture(3);
  const leafTex2 = leafClusterTexture(8, { h: 78, s: 46, l: [26, 48] });
  const spruceTex = spruceTexture(4);
  const mkLeafMat = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, ...extra });
  const leafMat = mkLeafMat(leafTex), leafMat2 = mkLeafMat(leafTex2), spruceMat = mkLeafMat(spruceTex, { alphaTest: 0.35 });
  const barkMat = MAT.bark;
  ctx.vegMats = [leafMat, leafMat2, spruceMat];
  // three levels of detail per species: full cards near the clearing, thinned crowns with bigger leaves further out, coarse backdrop trees beyond
  const LOD = [{ cards: 1, leaf: 1, whorls: 1 }, { cards: 0.62, leaf: 1.2, whorls: 0.75 }, { cards: 0.36, leaf: 1.5, whorls: 0.5 }];
  const broadSpec = (seed, i, l) => ({ height: 5.4 + i * 0.9, trunkR: 0.3 + i * 0.05, crownR: 3.1 + i * 0.5, limbs: 5, leafCards: Math.round(240 * l.cards), seed, leafSize: 1.45 * l.leaf, hue: i * 0.2 - 0.2 });
  const spruceSpec = (seed, i, l) => ({ height: 8 + i * 1.6, trunkR: 0.24 + i * 0.03, seed, whorls: Math.max(6, Math.round(15 * l.whorls)), branchLen: 2.5 + i * 0.3 });
  const broad = [11, 12, 13].map((seed, i) => ({ geos: LOD.map((l) => buildBroadleaf(broadSpec(seed, i, l))), mat: i === 1 ? leafMat2 : leafMat }));
  const spr = [21, 22, 23].map((seed, i) => ({ geos: LOD.map((l) => buildSpruce(spruceSpec(seed, i, l))), mat: spruceMat }));
  const placesAll = [];
  for (let i = 0; i < 700 && placesAll.length < 330; i++) {
    const x = lerp(X0 + 3, X1 - 3, rnd()), z = lerp(Z0 + 3, Z1 - 4, rnd());
    const dc = Math.hypot(x - CLEARING.x, z - CLEARING.z);
    if (dc < 15) continue;
    const [pd] = polyDist(x, z);
    if (pd < 4.2 && x < -70) continue;
    if (x > -82 && z > -30 && z < -19) continue;
    if (z > -19.5 && rnd() < 0.6) continue;
    if (placesAll.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3.2)) continue;
    placesAll.push([x, z]);
  }
  ctx.trees = placesAll;
  const variants = [...broad.map((v) => ({ ...v, kind: 'broad' })), ...spr.map((v) => ({ ...v, kind: 'spruce' }))];
  const groups = variants.map(() => ({ near: [], mid: [], far: [] }));
  for (const [x, z] of placesAll) {
    const k = rnd() < 0.42 ? Math.floor(rnd() * 3) : 3 + Math.floor(rnd() * 3);
    const dd = Math.hypot(x - CLEARING.x, z - CLEARING.z);
    groups[k][dd < 24 ? 'near' : dd < 46 ? 'mid' : 'far'].push([x, z]);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  variants.forEach((v, vi) => {
    for (const [bi, bucket] of ['near', 'mid', 'far'].entries()) {
      const list = groups[vi][bucket]; if (!list.length) continue;
      const geo = v.geos[bi];
      // one transform per tree, shared by trunk and crown so the crown actually sits on its branches
      const items = list.map(([x, z]) => {
        const sc = (v.kind === 'broad' ? 0.9 : 0.85) + rnd() * 0.5;
        _e.set((rnd() - 0.5) * 0.05, rnd() * 6.283, (rnd() - 0.5) * 0.05); _q.setFromEuler(_e);
        _p.set(x, terrainHeight(x, z) - 0.1, z); _s.set(sc, sc * (0.9 + rnd() * 0.25), sc);
        const k = 0.8 + rnd() * 0.4;
        return { x, z, m: new THREE.Matrix4().compose(_p, _q, _s), c: new THREE.Color().setRGB(k, k * (0.96 + rnd() * 0.08), k * 0.92) };
      });
      chunkedInstances(g, geo.bark, barkMat, items, 24, { cast: bucket !== 'far', receive: false });
      chunkedInstances(g, geo.leaves, v.mat, items, 24, { cast: bucket !== 'far', receive: false });
    }
  });

  // ---- ground cover: grass tufts, ferns, rocks, logs ---------------------------------------
  {
    const grassA = new THREE.MeshLambertMaterial({ map: grassTexture(5, 0.35), alphaTest: 0.4, side: THREE.DoubleSide });
    const grassB = new THREE.MeshLambertMaterial({ map: grassTexture(11, 0.0), alphaTest: 0.4, side: THREE.DoubleSide });
    const fernMat = new THREE.MeshLambertMaterial({ map: fernTexture(2), alphaTest: 0.4, side: THREE.DoubleSide });
    // a trodden lawn around the two figures under the oak keeps the ending's composition readable
    const LAWN = { x: -103, z: -32.6, r0: 5.6, r1: 8.6 };
    const scatter = (geo, mat, N, rMax, hMin, hMax, wMul = 1, avoidPath = 1.2, lawnOnly = false) => {
      const items = [];
      let n = 0, guard = 0;
      while (n < N && guard++ < N * 8) {
        let x, z;
        if (lawnOnly) { const a = rnd() * 6.283, rr = Math.sqrt(rnd()) * LAWN.r1; x = LAWN.x + Math.cos(a) * rr; z = LAWN.z + Math.sin(a) * rr; }
        else {
          const a = rnd() * 6.283, rr = Math.sqrt(rnd()) * rMax;
          x = CLEARING.x + Math.cos(a) * rr * 1.35 + 5; z = CLEARING.z + Math.sin(a) * rr;
          const dl = Math.hypot(x - LAWN.x, z - LAWN.z);
          if (dl < LAWN.r0 || (dl < LAWN.r1 && rnd() < (LAWN.r1 - dl) / (LAWN.r1 - LAWN.r0))) continue;
        }
        if (z > -15.5 || z < -96) continue;
        const [pd] = polyDist(x, z); if (pd < avoidPath && x < -77) continue;
        if (x > -76.3) continue;
        const sc = hMin + rnd() * (hMax - hMin);
        _e.set(0, rnd() * 6.283, 0); _q.setFromEuler(_e); _p.set(x, terrainHeight(x, z) - 0.03, z); _s.set(sc * wMul, sc, sc * wMul);
        const k = 0.85 + rnd() * 0.3;
        items.push({ x, z, m: new THREE.Matrix4().compose(_p, _q, _s), c: new THREE.Color().setRGB(k, k, k * 0.9) });
        n++;
      }
      chunkedInstances(g, geo, mat, items, 10, { cast: false, receive: false });
    };
    scatter(tuftGeometry(0.9, 0.9, 3), grassA, 3600, 30, 0.6, 1.35);
    scatter(tuftGeometry(0.8, 0.7, 3), grassB, 2400, 34, 0.5, 1.1);
    scatter(tuftGeometry(1.5, 1.2, 2), fernMat, 420, 30, 0.7, 1.4, 1, 2.5);
    scatter(tuftGeometry(0.8, 0.7, 3), grassB, 900, 0, 0.16, 0.34, 1.2, 0, true);   // short lawn grass
    // rocks
    const rockGeo = new THREE.IcosahedronGeometry(0.5, 2); { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const n = 1 + (fbm(p.getX(i) * 0.9 + 0.5, p.getZ(i) * 0.9 + 0.5, 4, 3, 7) - 0.5) * 0.6; p.setXYZ(i, p.getX(i) * n * 1.25, p.getY(i) * n * 0.7, p.getZ(i) * n); } rockGeo.computeVertexNormals(); }
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.95, map: TEX.flagstone.map, normalMap: TEX.flagstone.normalMap });
    for (let i = 0; i < 26; i++) {
      const a = rnd() * 6.283, rr = 5 + rnd() * 26; const x = CLEARING.x + Math.cos(a) * rr * 1.3, z = CLEARING.z + Math.sin(a) * rr;
      if (z > -16 || x > -78) continue; const [pd] = polyDist(x, z); if (pd < 1.6) continue;
      const m = new THREE.Mesh(rockGeo, rockMat); const sc = 0.5 + rnd() * 1.6; m.scale.set(sc, sc * (0.8 + rnd() * 0.5), sc); m.position.set(x, terrainHeight(x, z) + 0.05 * sc, z); m.rotation.y = rnd() * 6.28; m.castShadow = m.receiveShadow = true; g.add(m);
    }
    // fallen logs
    for (let i = 0; i < 6; i++) {
      const a = rnd() * 6.283, rr = 12 + rnd() * 22; const x = CLEARING.x + Math.cos(a) * rr * 1.2, z = CLEARING.z + Math.sin(a) * rr;
      if (z > -17 || x > -80) continue; const [pd] = polyDist(x, z); if (pd < 3) continue;
      const len = 2.5 + rnd() * 3.5, lg = new THREE.CylinderGeometry(0.2 + rnd() * 0.1, 0.26 + rnd() * 0.1, len, 9); lg.rotateZ(Math.PI / 2);
      const lu = lg.attributes.uv; for (let k = 0; k < lu.count; k++) lu.setXY(k, lu.getX(k) * 2, lu.getY(k) * len * 0.5);
      const m = new THREE.Mesh(lg, barkMat); m.position.set(x, terrainHeight(x, z) + 0.2, z); m.rotation.y = rnd() * 6.28; m.castShadow = m.receiveShadow = true; g.add(m);
    }
  }

  // ---- the old oak, crate and blanket ---------------------------------------------------------
  {
    const oakGeo = buildBroadleaf({ height: 7.6, trunkR: 0.62, crownR: 6.4, limbs: 8, leafCards: 760, seed: 5, leafSize: 2.0, hue: 0.1 });
    const y0 = terrainHeight(OAK.x, OAK.z);
    const bark = new THREE.Mesh(oakGeo.bark, barkMat), leaves = new THREE.Mesh(oakGeo.leaves, leafMat2);
    for (const m of [bark, leaves]) { m.position.set(OAK.x, y0 - 0.1, OAK.z); m.castShadow = true; m.receiveShadow = m === leaves; m.frustumCulled = false; g.add(m); }
    ctx.oakLeaves = leaves;
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
  // ---- golden-hour shafts through the canopy -------------------------------------------------
  ctx.sunShafts = [];
  for (const [dx, dz, w] of [[-3, 6, 2.2], [2, 3, 1.6], [-7, 1, 2.6], [5, -4, 1.8], [-1, -6, 2.0], [-9, -7, 2.4]]) {
    const top = new THREE.Vector3(CLEARING.x + dx + 22, 24, CLEARING.z + dz + 30), bot = new THREE.Vector3(CLEARING.x + dx, terrainHeight(CLEARING.x + dx, CLEARING.z + dz) + 0.2, CLEARING.z + dz);
    const sh = lightShaft(top, bot, 0.4, w, 0xffd7a0, 0.0); g.add(sh); ctx.sunShafts.push(sh);
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
    // lit windows on the masses behind the wall (read as a living prison from the forest at night) + stained-glass nave
    {
      const mk = (c, e) => { const m = MAT.bulb.clone(); m.color.set(c); m.emissive.set(c); m.emissiveIntensity = e; m.fog = true; return m; };
      const place = (list, w, h, mat) => {
        if (!list.length) return;
        const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(w, h), mat, list.length);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3();
        list.forEach(([x, y, z], i) => inst.setMatrixAt(i, m4.compose(ps.set(x, y, z), q, sc)));
        inst.frustumCulled = false; g.add(inst);
      };
      const warm = [], cool = [], dim = [];
      const wr = mulberry32(77);
      const rows = (x0, x1, ys, z) => { for (const y of ys) for (let x = x0; x <= x1; x += 2.4) { const r = wr(); if (r < 0.3) continue; (r < 0.62 ? warm : r < 0.86 ? dim : cool).push([x, y, z - 0.02]); } };
      rows(-38, -12, [7.3, 9.3], -10);
      rows(-108, -78, [6.85], -9);
      rows(-100, -52, [], -9);
      place(warm, 1.1, 0.7, mk(0xffc27a, 1.5)); place(cool, 1.1, 0.7, mk(0xbfd4ff, 1.3)); place(dim, 1.1, 0.7, mk(0xb4793a, 0.7));
      // nave windows: tall, stained glass
      for (const [i, c] of [0xb83a3a, 0x3f9a58, 0x3b62c8, 0xc9a03a, 0xb83a3a, 0x3f9a58, 0x3b62c8].entries()) place([[-70.2 + i * 3.4, 7.55, -13.22]], 1.0, 2.0, mk(c, 1.25));
    }
    // aircraft-warning beacon on the bell cross
    { const bc = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), MAT.bulb.clone()); bc.material.color.set(0xff2a20); bc.material.emissive.set(0xff2a20); bc.position.set(-61, 17.4, -13.3); g.add(bc); ctx.beacon = bc; }
  }
  marks.clearing = CLEARING.clone();
  marks.gullyStart = new THREE.Vector3(-78.5, terrainHeight(-78.5, -24), -24);
  marks.sitSpot = new THREE.Vector3(OAK.x + 3.3, terrainHeight(OAK.x + 3.3, OAK.z + 1.3), OAK.z + 1.3);
  area.group.visible = false;
  return { area, sun, sky };
}
