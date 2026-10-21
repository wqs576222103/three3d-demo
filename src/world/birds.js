import * as THREE from "three";
import { mulberry32 } from "../utils/random.js";

const BODY_COLORS = [0x3c5368, 0x8b5d3c, 0x52676a, 0xb0763f];
const BEAK_COLORS = [0xd6a24b, 0xc58338];

function createBird(random) {
  const group = new THREE.Group();
  const bodyColor = BODY_COLORS[Math.floor(random() * BODY_COLORS.length)];
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.9,
    flatShading: true,
  });
  const bellyMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8b47e,
    roughness: 0.92,
    flatShading: true,
  });
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.9,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const beakMaterial = new THREE.MeshStandardMaterial({
    color: BEAK_COLORS[Math.floor(random() * BEAK_COLORS.length)],
    roughness: 0.8,
  });
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x171a1a,
    roughness: 0.35,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), bodyMaterial);
  body.scale.set(0.1, 0.09, 0.18);
  group.add(body);

  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(1, 6, 4),
    bellyMaterial,
  );
  belly.scale.set(0.075, 0.06, 0.14);
  belly.position.set(0, -0.028, 0.035);
  group.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), bodyMaterial);
  head.scale.setScalar(0.082);
  head.position.set(0, 0.055, 0.16);
  group.add(head);

  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.027, 0.085, 4),
    beakMaterial,
  );
  beak.position.set(0, 0.045, 0.245);
  beak.rotation.x = Math.PI / 2;
  group.add(beak);

  const eyeGeometry = new THREE.SphereGeometry(0.012, 5, 3);
  const eyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eyeLeft.position.set(-0.048, 0.078, 0.205);
  const eyeRight = eyeLeft.clone();
  eyeRight.position.x = 0.048;
  group.add(eyeLeft, eyeRight);

  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.14, 4),
    wingMaterial,
  );
  tail.position.set(0, 0.005, -0.2);
  tail.rotation.x = Math.PI / 2;
  group.add(tail);

  const wingGeometry = new THREE.BoxGeometry(0.3, 0.012, 0.14);
  const wingLeftPivot = new THREE.Group();
  const wingRightPivot = new THREE.Group();
  wingLeftPivot.position.set(-0.06, 0.03, 0.01);
  wingRightPivot.position.set(0.06, 0.03, 0.01);

  const wingLeft = new THREE.Mesh(wingGeometry, wingMaterial);
  wingLeft.position.x = -0.15;
  wingLeft.rotation.y = -0.13;
  const wingRight = new THREE.Mesh(wingGeometry, wingMaterial);
  wingRight.position.x = 0.15;
  wingRight.rotation.y = 0.13;
  wingLeftPivot.add(wingLeft);
  wingRightPivot.add(wingRight);
  group.add(wingLeftPivot, wingRightPivot);

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return {
    group,
    wingLeftPivot,
    wingRightPivot,
  };
}

export function createBirds() {
  const group = new THREE.Group();
  const random = mulberry32(0xb14d5);
  const flyers = [
    {
      center: new THREE.Vector3(0.15, 5.35, 0.1),
      radiusX: 2.35,
      radiusZ: 1.8,
      speed: 0.62,
      phase: 0.4,
      scale: 1.05,
    },
    {
      center: new THREE.Vector3(-0.2, 5.9, -0.2),
      radiusX: 1.55,
      radiusZ: 1.35,
      speed: -0.92,
      phase: 2.2,
      scale: 0.88,
    },
    {
      center: new THREE.Vector3(0.1, 4.85, 0.3),
      radiusX: 2.75,
      radiusZ: 2.1,
      speed: 0.46,
      phase: 4.4,
      scale: 1.14,
    },
  ];
  const perches = [
    { position: new THREE.Vector3(1.62, 3.99, 0.45), yaw: -0.7 },
    { position: new THREE.Vector3(-1.42, 4.32, -0.35), yaw: 0.8 },
  ];
  const birds = [];

  flyers.forEach((config) => {
    const bird = createBird(random);
    bird.group.scale.setScalar(config.scale);
    bird.kind = "flyer";
    bird.config = config;
    birds.push(bird);
    group.add(bird.group);
  });

  perches.forEach((config) => {
    const bird = createBird(random);
    bird.group.position.copy(config.position);
    bird.group.rotation.y = config.yaw;
    bird.group.scale.setScalar(0.82 + random() * 0.14);
    bird.kind = "perched";
    bird.config = config;
    bird.phase = random() * Math.PI * 2;
    birds.push(bird);
    group.add(bird.group);
  });

  return {
    group,
    update(elapsed) {
      birds.forEach((bird) => {
        if (bird.kind === "flyer") {
          const { center, radiusX, radiusZ, speed, phase } = bird.config;
          const angle = elapsed * speed + phase;
          bird.group.position.set(
            center.x + Math.cos(angle) * radiusX,
            center.y + Math.sin(angle * 2 + phase) * 0.26,
            center.z + Math.sin(angle) * radiusZ,
          );
          const velocityX = -Math.sin(angle) * radiusX * speed;
          const velocityZ = Math.cos(angle) * radiusZ * speed;
          bird.group.rotation.y = Math.atan2(velocityX, velocityZ);
          bird.group.rotation.z = Math.sin(angle * 2 + phase) * 0.1;
          const flap = Math.sin(elapsed * 17 + phase) * 0.58;
          bird.wingLeftPivot.rotation.z = -flap;
          bird.wingRightPivot.rotation.z = flap;
          return;
        }

        const { position, yaw } = bird.config;
        const hop = Math.max(0, Math.sin(elapsed * 1.35 + bird.phase));
        const flutter =
          Math.max(0, Math.sin(elapsed * 0.82 + bird.phase) - 0.72) / 0.28;
        const flap = Math.sin(elapsed * 18 + bird.phase) * 0.5 * flutter;
        bird.group.position.set(
          position.x + Math.sin(elapsed * 0.7 + bird.phase) * 0.025,
          position.y + hop * 0.055,
          position.z,
        );
        bird.group.rotation.y =
          yaw + Math.sin(elapsed * 0.55 + bird.phase) * 0.16;
        bird.group.rotation.z = Math.sin(elapsed * 1.1 + bird.phase) * 0.045;
        bird.wingLeftPivot.rotation.z = 0.72 - flap;
        bird.wingRightPivot.rotation.z = -0.72 + flap;
      });
    },
  };
}
