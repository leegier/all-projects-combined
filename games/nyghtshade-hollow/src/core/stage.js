// Scene-wide lighting/environment shared by every area.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function setupStage(gfx) {
  const { scene, renderer } = gfx;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;
  scene.fog = new THREE.FogExp2(0x0b0f14, 0.012);
  scene.background = new THREE.Color(0x05070a);
  const hemi = new THREE.HemisphereLight(0x4d6a85, 0x241b14, 0.55);
  hemi.layers.enable(0); hemi.layers.enable(1);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x1a2230, 0.5);
  ambient.layers.enable(0); ambient.layers.enable(1);
  scene.add(ambient);
  return { hemi, ambient, pmrem };
}
