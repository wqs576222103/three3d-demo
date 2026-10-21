import * as THREE from "three";
import { mulberry32 } from "../utils/random.js";
import { TERRAIN_SIZE, WATER_LEVEL, getStreamCenterZ } from "./terrain.js";

const FISH_COUNT = 32;
const FLEE_RADIUS = 5.8;
const BANK_OFFSET = 3.15;
const BODY_LEVEL = WATER_LEVEL - 0.1;

function dampAngle(current, target, lambda, delta) {
  const difference = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + difference * (1 - Math.exp(-lambda * delta));
}

function createFishModel(random) {
  const group = new THREE.Group();
  const color = new THREE.Color().setHSL(
    0.065 + random() * 0.05,
    0.46 + random() * 0.24,
    0.38 + random() * 0.16,
  );
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.04,
    flatShading: true,
    emissive: color,
    emissiveIntensity: 0.12,
  });
  const finMaterial = new THREE.MeshStandardMaterial({
    color: 0xd08a55,
    roughness: 0.72,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b1b17,
    roughness: 0.4,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), bodyMaterial);
  body.scale.set(0.09, 0.062, 0.2);
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), bodyMaterial);
  head.scale.set(0.07, 0.055, 0.07);
  head.position.set(0, 0.008, 0.185);
  group.add(head);

  const eyeGeometry = new THREE.SphereGeometry(0.012, 5, 3);
  const eyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eyeLeft.position.set(-0.048, 0.032, 0.212);
  const eyeRight = eyeLeft.clone();
  eyeRight.position.x = 0.048;
  group.add(eyeLeft, eyeRight);

  const dorsal = new THREE.Mesh(
    new THREE.ConeGeometry(0.035, 0.09, 3),
    finMaterial,
  );
  dorsal.position.set(0, 0.075, -0.02);
  dorsal.rotation.x = -0.35;
  group.add(dorsal);

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0, -0.17);
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.16, 3),
    finMaterial,
  );
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -0.06;
  tailPivot.add(tail);
  group.add(tailPivot);

  const scale = 0.9 + random() * 0.55;
  group.scale.setScalar(scale);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  return { group, tailPivot, scale };
}

export function createFish() {
  const group = new THREE.Group();
  const random = mulberry32(0x51f15);
  const fishes = [];
  const halfMap = TERRAIN_SIZE / 2 - 9;

  for (let i = 0; i < FISH_COUNT; i += 1) {
    const fish = createFishModel(random);
    const x = -halfMap + random() * halfMap * 2;
    const z = getStreamCenterZ(x) + (random() * 2 - 1) * 2.3;
    const baseHeading = random() < 0.5 ? -Math.PI / 2 : Math.PI / 2;

    fish.group.position.set(x, BODY_LEVEL, z);
    fish.group.rotation.y = baseHeading;
    group.add(fish.group);

    fishes.push({
      ...fish,
      x,
      z,
      heading: baseHeading,
      baseHeading,
      cruiseSpeed: 0.2 + random() * 0.3,
      wanderFreq: 0.32 + random() * 0.4,
      phase: random() * Math.PI * 2,
      panic: 0,
    });
  }

  return {
    group,
    update(elapsed, delta, playerPosition) {
      const dt = Math.min(delta, 0.05);

      fishes.forEach((fish) => {
        const dx = fish.x - playerPosition.x;
        const dz = fish.z - playerPosition.z;
        const distance = Math.hypot(dx, dz);
        const fleeing = distance < FLEE_RADIUS;
        let desiredHeading =
          fish.baseHeading +
          Math.sin(elapsed * fish.wanderFreq + fish.phase) * 0.62;

        if (fleeing) {
          desiredHeading = Math.atan2(dx, dz);
        }

        const centerZ = getStreamCenterZ(fish.x);
        const bankOffset = fish.z - centerZ;
        const edgeDistance = halfMap - Math.abs(fish.x);
        const edgeSteer =
          edgeDistance < 3.5
            ? (fish.x < 0 ? 1 : -1) * (3.5 - edgeDistance) * 0.8
            : 0;
        const directionX = Math.sin(desiredHeading) + edgeSteer;
        const directionZ = Math.cos(desiredHeading) - bankOffset * 0.9;
        desiredHeading = Math.atan2(directionX, directionZ);

        fish.heading = dampAngle(
          fish.heading,
          desiredHeading,
          fleeing ? 10 : 2.4,
          dt,
        );
        const panicTarget = fleeing ? 1 : 0;
        fish.panic +=
          (panicTarget - fish.panic) *
          (1 - Math.exp(-(fleeing ? 9 : 1.6) * dt));

        const speed = THREE.MathUtils.lerp(fish.cruiseSpeed, 6.4, fish.panic);
        fish.x += Math.sin(fish.heading) * speed * dt;
        fish.z += Math.cos(fish.heading) * speed * dt;

        if (fish.x < -halfMap) {
          fish.x = -halfMap;
          fish.baseHeading = Math.PI / 2;
        } else if (fish.x > halfMap) {
          fish.x = halfMap;
          fish.baseHeading = -Math.PI / 2;
        }

        const streamZ = getStreamCenterZ(fish.x);
        fish.z = THREE.MathUtils.clamp(
          fish.z,
          streamZ - BANK_OFFSET,
          streamZ + BANK_OFFSET,
        );

        const bob = Math.sin(elapsed * (1.7 + fish.cruiseSpeed) + fish.phase);
        fish.group.position.set(fish.x, BODY_LEVEL + bob * 0.018, fish.z);
        fish.group.rotation.y = fish.heading;
        fish.group.rotation.z = Math.sin(elapsed * 2.1 + fish.phase) * 0.05;
        fish.tailPivot.rotation.y =
          Math.sin(elapsed * (6.5 + fish.panic * 13) + fish.phase) *
          (0.2 + fish.panic * 0.24);
      });
    },
  };
}
