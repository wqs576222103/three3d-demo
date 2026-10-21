import * as THREE from "three";
import { fbm, smooth01 } from "../utils/random.js";

export const HILL_CENTER_Z = -6;
export const HILL_RADIUS = 31;
export const HILL_HEIGHT = 8.4;
export const WATER_LEVEL = -0.82;
export const TERRAIN_SIZE = 430;
export const TERRAIN_CENTER_Z = -62;

export function getStreamCenterZ(x) {
  return (
    -52 + Math.sin(x * 0.032 + 0.7) * 8.5 + Math.sin(x * 0.087 - 0.4) * 2.8
  );
}

export function getStreamSlope(x) {
  const delta = 0.5;
  return (
    (getStreamCenterZ(x + delta) - getStreamCenterZ(x - delta)) / (delta * 2)
  );
}

export function getTerrainHeight(x, z) {
  const dx = x;
  const dz = z - HILL_CENTER_Z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const hillMask = smooth01(1 - distance / HILL_RADIUS);
  const hill = Math.pow(hillMask, 1.35) * HILL_HEIGHT;
  const rolling = (fbm(x * 0.034, z * 0.034, 4) - 0.5) * 2.1;
  const detail = (fbm(x * 0.17, z * 0.17, 2) - 0.5) * 0.22;
  const distantRise = Math.max(0, -z - 58) * 0.075;
  const ground = hill + rolling + detail + distantRise - 0.45;

  const streamDistance = Math.abs(z - getStreamCenterZ(x));
  const channel = smooth01(1 - streamDistance / 11);
  return ground * (1 - channel * 0.94) + -1.78 * channel * 0.94;
}

export function createTerrain() {
  const segments = 258;
  const geometry = new THREE.PlaneGeometry(
    TERRAIN_SIZE,
    TERRAIN_SIZE,
    segments,
    segments,
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, TERRAIN_CENTER_Z);

  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const grassDark = new THREE.Color(0x31552b);
  const grassMid = new THREE.Color(0x527b38);
  const grassLight = new THREE.Color(0x739647);
  const dryGrass = new THREE.Color(0x8a9751);
  const streamSilt = new THREE.Color(0x64664b);
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = getTerrainHeight(x, z);
    positions.setY(i, y);

    const broad = fbm(x * 0.055 + 12, z * 0.055 - 8, 4);
    const fine = fbm(x * 0.26, z * 0.26, 3);
    color.copy(grassDark).lerp(grassMid, smooth01(broad * 1.45 - 0.16));
    color.lerp(grassLight, smooth01(fine * 1.2 - 0.38) * 0.5);
    color.lerp(dryGrass, smooth01(broad * fine * 2.4 - 0.75) * 0.42);

    const hillGlow = smooth01(
      1 - Math.hypot(x, z - HILL_CENTER_Z) / HILL_RADIUS,
    );
    color.offsetHSL(0, 0, hillGlow * 0.025);

    const streamDistance = Math.abs(z - getStreamCenterZ(x));
    const silt = smooth01(1 - streamDistance / 9);
    color.lerp(streamSilt, silt * 0.62);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    dithering: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}
