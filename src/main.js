import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createClouds } from "./world/clouds.js";
import { createFlowers } from "./world/flowers.js";
import { createPineForest } from "./world/forest.js";
import { createGrass } from "./world/grass.js";
import { createMountains } from "./world/mountains.js";
import { createPollen } from "./world/pollen.js";
import { createRocks } from "./world/rocks.js";
import { createSky } from "./world/sky.js";
import { createStream } from "./world/stream.js";
import {
  createTerrain,
  getTerrainHeight,
  HILL_CENTER_Z,
} from "./world/terrain.js";
import { createTree } from "./world/tree.js";

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.querySelector("#app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb7cbda, 110, 690);

const camera = new THREE.PerspectiveCamera(
  46,
  window.innerWidth / window.innerHeight,
  0.1,
  1500,
);
camera.position.set(8, getTerrainHeight(8, 15) + 2.15, 15);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 9.2, HILL_CENTER_Z);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 7;
controls.maxDistance = 62;
controls.minPolarAngle = 0.42;
controls.maxPolarAngle = Math.PI * 0.49;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.7;
controls.update();

const sunDirection = new THREE.Vector3(-0.48, 0.72, 0.5).normalize();

scene.add(createSky(sunDirection));

const hemisphere = new THREE.HemisphereLight(0xcfe5ff, 0x567044, 1.25);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight(0xffe8c7, 2.75);
sun.position.copy(sunDirection).multiplyScalar(90);
sun.target.position.set(0, 4, HILL_CENTER_Z);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 190;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.035;
scene.add(sun);
scene.add(sun.target);

const terrain = createTerrain();
const stream = createStream(sunDirection);
const grass = createGrass();
const flowers = createFlowers();
const tree = createTree();
const rocks = createRocks();
const forest = createPineForest();
const mountains = createMountains();
const clouds = createClouds();
const pollen = createPollen();

scene.add(
  terrain,
  stream.group,
  grass.mesh,
  flowers,
  tree.group,
  rocks,
  forest,
  mountains,
  clouds.group,
  pollen.points,
);

const clock = new THREE.Clock();
let hasRendered = false;

function animate() {
  const elapsed = clock.getElapsedTime();

  grass.update(elapsed);
  stream.update(elapsed);
  clouds.update(elapsed);
  pollen.update(elapsed);

  tree.foliage.rotation.z = Math.sin(elapsed * 0.55) * 0.008;
  tree.foliage.rotation.x = Math.sin(elapsed * 0.43 + 1.2) * 0.005;

  controls.update();
  renderer.render(scene, camera);

  if (!hasRendered) {
    hasRendered = true;
    window.setTimeout(() => {
      document.querySelector("#loader").classList.add("is-hidden");
    }, 320);
  }
}

renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
