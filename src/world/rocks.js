import * as THREE from "three";
import { mulberry32 } from "../utils/random.js";
import { HILL_CENTER_Z, getTerrainHeight } from "./terrain.js";

export function createRocks(collisionWorld) {
  const group = new THREE.Group();
  const random = mulberry32(0x0c0ffee);
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const materials = [
    new THREE.MeshStandardMaterial({
      color: 0x6f736b,
      roughness: 0.98,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x85867c,
      roughness: 0.98,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x5c625c,
      roughness: 0.98,
      flatShading: true,
    }),
  ];

  for (let i = 0; i < 22; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = 4.5 + random() * 24;
    const x = Math.cos(angle) * distance;
    const z = HILL_CENTER_Z + Math.sin(angle) * distance;
    const scale = 0.18 + random() * 0.58;
    const rock = new THREE.Mesh(
      geometry,
      materials[Math.floor(random() * materials.length)],
    );
    const scaleX = scale * (1.1 + random() * 0.8);
    const scaleZ = scale * (0.9 + random() * 0.6);
    rock.position.set(x, getTerrainHeight(x, z) + scale * 0.2, z);
    rock.rotation.set(
      random() * Math.PI,
      random() * Math.PI,
      random() * Math.PI,
    );
    rock.scale.set(scaleX, scale * 0.7, scaleZ);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
    collisionWorld?.addCircle(x, z, Math.max(scaleX, scaleZ) * 0.82);
  }

  return group;
}
