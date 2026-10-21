import * as THREE from "three";
import { mulberry32 } from "../utils/random.js";
import { HILL_CENTER_Z, getTerrainHeight } from "./terrain.js";

export function createFlowers() {
  const count = 1500;
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x10f10a);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [0xfff4d6, 0xffe27d, 0xf3c7d4, 0xd9e7ff, 0xffffff];

  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 29;
    const x = Math.cos(angle) * distance;
    const z = HILL_CENTER_Z + Math.sin(angle) * distance;
    const y = getTerrainHeight(x, z) + 0.28 + random() * 0.34;
    const scale = 0.026 + random() * 0.028;

    dummy.position.set(x, y, z);
    dummy.rotation.set(
      random() * Math.PI,
      random() * Math.PI,
      random() * Math.PI,
    );
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    color.set(palette[Math.floor(random() * palette.length)]);
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
