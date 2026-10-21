import * as THREE from "three";
import { mulberry32 } from "../utils/random.js";
import { HILL_CENTER_Z, getTerrainHeight } from "./terrain.js";

function createCylinderBetween(start, end, startRadius, endRadius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(
    endRadius,
    startRadius,
    length,
    8,
    1,
    false,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createTree() {
  const tree = new THREE.Group();
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x5e4530,
    roughness: 0.96,
    flatShading: true,
  });
  const leafMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0x315427,
      roughness: 0.92,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x3f682e,
      roughness: 0.92,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x527b36,
      roughness: 0.92,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x648a3d,
      roughness: 0.92,
      flatShading: true,
    }),
  ];

  const trunkPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.12, 1.25, 0.06),
    new THREE.Vector3(-0.04, 2.55, 0.02),
    new THREE.Vector3(0.1, 3.65, -0.04),
    new THREE.Vector3(0.02, 4.55, 0),
  ];
  const trunkRadii = [0.5, 0.38, 0.28, 0.19, 0.12];

  for (let i = 0; i < trunkPoints.length - 1; i += 1) {
    tree.add(
      createCylinderBetween(
        trunkPoints[i],
        trunkPoints[i + 1],
        trunkRadii[i],
        trunkRadii[i + 1],
        trunkMaterial,
      ),
    );
  }

  const branchBases = [
    new THREE.Vector3(0.06, 2.38, 0.02),
    new THREE.Vector3(-0.02, 2.92, 0.01),
    new THREE.Vector3(0.08, 3.56, -0.02),
    new THREE.Vector3(-0.04, 3.28, 0.01),
    new THREE.Vector3(0.03, 4.2, 0),
  ];
  const branchTips = [
    new THREE.Vector3(1.75, 3.95, 0.42),
    new THREE.Vector3(-1.55, 4.35, -0.38),
    new THREE.Vector3(0.95, 5.05, -0.72),
    new THREE.Vector3(-0.92, 4.6, 0.78),
    new THREE.Vector3(0.28, 5.45, 0.42),
  ];

  branchTips.forEach((tip, index) => {
    tree.add(
      createCylinderBetween(
        branchBases[index],
        tip,
        0.15 - index * 0.012,
        0.045,
        trunkMaterial,
      ),
    );
    const twigEnd = tip
      .clone()
      .add(
        new THREE.Vector3(
          (index % 2 ? -1 : 1) * 0.55,
          0.55,
          ((index % 3) - 1) * 0.4,
        ),
      );
    tree.add(createCylinderBetween(tip, twigEnd, 0.045, 0.02, trunkMaterial));
  });

  const foliage = new THREE.Group();
  const random = mulberry32(0x7ee5);
  const leafGeometry = new THREE.IcosahedronGeometry(1, 1);
  const clusters = [];

  branchTips.forEach((tip, index) => {
    clusters.push({
      position: tip.clone().add(new THREE.Vector3(0, 0.5 + index * 0.06, 0)),
      scale: 1.15 + random() * 0.55,
    });
  });

  for (let i = 0; i < 18; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random());
    const x = Math.cos(angle) * distance * 2.55;
    const z = Math.sin(angle) * distance * 2.15;
    const y = 5.55 + (random() - 0.46) * 2.15;
    clusters.push({
      position: new THREE.Vector3(x, y, z),
      scale: 0.82 + random() * 0.78,
    });
  }

  clusters.forEach((cluster) => {
    const material = leafMaterials[Math.floor(random() * leafMaterials.length)];
    const leaves = new THREE.Mesh(leafGeometry, material);
    leaves.position.copy(cluster.position);
    leaves.scale.set(
      cluster.scale * (0.95 + random() * 0.22),
      cluster.scale * (0.82 + random() * 0.22),
      cluster.scale * (0.95 + random() * 0.22),
    );
    leaves.rotation.set(
      random() * Math.PI,
      random() * Math.PI,
      random() * Math.PI,
    );
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    foliage.add(leaves);
  });

  tree.add(foliage);
  tree.position.set(
    0,
    getTerrainHeight(0, HILL_CENTER_Z) - 0.12,
    HILL_CENTER_Z,
  );
  return { group: tree, foliage };
}
