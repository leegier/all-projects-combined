// Material library built from the procedural textures. `tile` = metres per texture repeat; world
// UVs are generated in geo.js so every wall/floor lines up regardless of the box size.
import * as THREE from 'three';
import { TEX, DECALS, signTexture } from './textures.js';

export const MAT = {};
export const TILE = {};

function pbr(tex, { tile = 2, normal = 1, color = 0xffffff, rough = 1, metal = 1, env = 1, clampV = false, emissive = null } = {}) {
  if (clampV) {
    [tex.map, tex.normalMap, tex.ormMap].forEach((t) => { t.wrapT = THREE.ClampToEdgeWrapping; });
  }
  const m = new THREE.MeshStandardMaterial({
    map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(normal, normal),
    roughnessMap: tex.ormMap, metalnessMap: tex.ormMap, roughness: rough, metalness: metal,
    color, vertexColors: true, envMapIntensity: env,
  });
  if (emissive) { m.emissive = new THREE.Color(emissive); }
  m.userData.tile = tile; m.userData.clampV = clampV;
  return m;
}
function plain(color, { rough = 0.8, metal = 0, emissive = 0x000000, ei = 0, tile = 1, transparent = false, opacity = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei, vertexColors: true, transparent, opacity });
  m.userData.tile = tile;
  return m;
}
function decalMat(tex, color = 0xffffff, opacity = 1) {
  const m = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, vertexColors: true, fog: true });
  m.userData.tile = 1; m.userData.decal = true;
  return m;
}

export function buildMaterials() {
  MAT.floor = pbr(TEX.concrete, { tile: 4, normal: 1.1 });
  MAT.floorDark = pbr(TEX.concrete, { tile: 4, normal: 1, color: 0x8a8e94 });
  MAT.ceiling = pbr(TEX.concrete, { tile: 4, normal: 0.8, color: 0x666a70 });
  MAT.wallGreen = pbr(TEX.blockGreen, { tile: 3.2, clampV: true, normal: 1.1 });
  MAT.wallGrey = pbr(TEX.blockGrey, { tile: 3.2, clampV: true, normal: 1.1 });
  MAT.wallRed = pbr(TEX.blockRed, { tile: 3.2, clampV: true, normal: 1.1 });
  MAT.wallBlue = pbr(TEX.blockBlue, { tile: 3.2, clampV: true, normal: 1.1 });
  MAT.plaster = pbr(TEX.plaster, { tile: 4, normal: 1 });
  MAT.brick = pbr(TEX.brick, { tile: 2, normal: 1.3 });
  MAT.lino = pbr(TEX.lino, { tile: 2.4, normal: 0.8 });
  MAT.steel = pbr(TEX.steel, { tile: 1 });
  MAT.steelLight = pbr(TEX.steelLight, { tile: 1 });
  MAT.grating = pbr(TEX.grating, { tile: 1, normal: 1.4 });
  MAT.wood = pbr(TEX.wood, { tile: 1 });
  MAT.woodDark = pbr(TEX.woodDark, { tile: 1 });
  MAT.mattress = pbr(TEX.mattress, { tile: 0.9 });
  MAT.blanket = pbr(TEX.blanket, { tile: 0.8 });
  MAT.flag = pbr(TEX.flagstone, { tile: 4, normal: 1.2 });
  MAT.ground = pbr(TEX.ground, { tile: 8, normal: 1 });
  MAT.bark = pbr(TEX.bark, { tile: 1.5 });
  MAT.pipe = pbr(TEX.pipe, { tile: 1 });
  MAT.pipeRed = pbr(TEX.pipeRed, { tile: 1 });
  MAT.door = pbr(TEX.steel, { tile: 1, color: 0x7a8088 });
  MAT.bars = plain(0x15171a, { rough: 0.55, metal: 0.9 });
  MAT.rail = plain(0x2c3034, { rough: 0.5, metal: 0.9 });
  MAT.rubber = plain(0x0c0c0d, { rough: 0.9 });
  MAT.porcelain = plain(0xb7b9b4, { rough: 0.25 });
  MAT.paper = plain(0xc9c3ae, { rough: 0.95 });
  MAT.white = plain(0xbdbbb2, { rough: 0.9 });
  MAT.black = plain(0x050506, { rough: 0.7 });
  MAT.leather = plain(0x2a1c14, { rough: 0.55 });
  MAT.canvasOrange = plain(0xa3501c, { rough: 0.9 });
  MAT.glass = new THREE.MeshPhysicalMaterial({ color: 0x9fb4b8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, vertexColors: true, envMapIntensity: 1.5 });
  MAT.glass.userData.tile = 1;
  MAT.stone = pbr(TEX.flagstone, { tile: 2.5, color: 0xb0aca4, normal: 1.2 });
  MAT.wax = plain(0xcdbf9a, { rough: 0.6 });
  MAT.leaf = plain(0x2a3d1d, { rough: 0.9 });
  MAT.leafDark = plain(0x16240f, { rough: 0.95 });
  MAT.rugRed = pbr(TEX.blanket, { tile: 1.2, color: 0x7a2a28 });

  MAT.books = new THREE.MeshStandardMaterial({ map: DECALS.books, roughness: 0.85, vertexColors: true });
  MAT.books.userData.tile = 1; MAT.books.userData.keepUv = true;

  // emissive: fluorescent, bulbs, screens
  MAT.tube = plain(0xffffff, { emissive: 0xdff4ec, ei: 2.2, rough: 0.4 });
  MAT.tubeWarm = plain(0xffffff, { emissive: 0xffd9a0, ei: 2.2, rough: 0.4 });
  MAT.bulb = plain(0xffffff, { emissive: 0xffc66e, ei: 3, rough: 0.4 });
  MAT.exitSign = plain(0x103010, { emissive: 0x22ff55, ei: 1.6 });
  MAT.redLamp = plain(0x300404, { emissive: 0xff1810, ei: 0.0 });
  MAT.candleFlame = plain(0xffffff, { emissive: 0xffb040, ei: 4 });
  MAT.screenGreen = plain(0x061006, { emissive: 0x54ff9a, ei: 1.3 });

  MAT.puddle = new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.72, depthWrite: false, vertexColors: true, envMapIntensity: 2.5 });
  MAT.puddle.userData.tile = 1;
  MAT.cloth = pbr(TEX.blanket, { tile: 0.6, color: 0x8a6a4a });

  // decals
  MAT.dStain = decalMat(DECALS.stain, 0xffffff, 0.8);
  MAT.dStain2 = decalMat(DECALS.stain2, 0xffffff, 0.7);
  MAT.dStreak = decalMat(DECALS.streak, 0xffffff, 0.9);
  MAT.dTally = decalMat(DECALS.tally, 0xffffff, 0.9);
  MAT.dPool = new THREE.MeshBasicMaterial({ map: DECALS.pool, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xcfe9df, vertexColors: true, fog: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  MAT.dPool.userData.tile = 1; MAT.dPool.userData.decal = true;
  MAT.dPoolWarm = MAT.dPool.clone(); MAT.dPoolWarm.color.set(0xffd2a0); MAT.dPoolWarm.userData = { tile: 1, decal: true };
  return MAT;
}

/** Make a unlit-ish textured sign material. */
export function signMaterial(lines, opts) {
  const m = new THREE.MeshStandardMaterial({ map: signTexture(lines, opts), roughness: 0.55, metalness: 0.0, vertexColors: true });
  m.userData.tile = 1;
  return m;
}
