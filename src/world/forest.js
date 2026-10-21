import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../utils/random.js";
import { getTerrainHeight } from "./terrain.js";

export function createPineForest() {
  const geometries = [];
  for (let i = 0; i < 3; i += 1) {
    const cone = new THREE.ConeGeometry(0.36 - i * 0.07, 0.58, 7);
    cone.translate(0, 0.44 + i * 0.27, 0);
    geometries.push(cone);
  }
  const trunk = new THREE.CylinderGeometry(0.045, 0.065, 0.38, 5);
  trunk.translate(0, 0.19, 0);
  geometries.push(trunk);

  const geometry = mergeGeometries(geometries);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    flatShading: true,
  });
  const count = 230;
  const forest = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x7a1e5);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const x = (random() - 0.5) * 320;
    const z = -72 - random() * 52;
    const y = getTerrainHeight(x, z);
    const scale = 2.4 + random() * 4.3;

    dummy.position.set(x, y - 0.1, z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.set(
      scale * (0.8 + random() * 0.25),
      scale,
      scale * (0.8 + random() * 0.25),
    );
    dummy.updateMatrix();
    forest.setMatrixAt(i, dummy.matrix);

    color.setHSL(
      0.31 + random() * 0.04,
      0.26 + random() * 0.15,
      0.16 + random() * 0.08,
    );
    forest.setColorAt(i, color);
  }

  forest.instanceMatrix.needsUpdate = true;
  forest.instanceColor.needsUpdate = true;
  forest.computeBoundingSphere();
  return forest;
}
