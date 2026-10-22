import * as THREE from "three";
import { mulberry32 } from "../utils/random.js";

const BODY_COLORS = [0x3c5368, 0x8b5d3c, 0x52676a, 0xb0763f, 0x8a8f55];
const BEAK_COLORS = [0xd6a24b, 0xc58338];

function dampAngle(current, target, lambda, delta) {
  const difference = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + difference * (1 - Math.exp(-lambda * delta));
}

function getRoutePosition(config, elapsed) {
  const angle = config.phase + elapsed * config.speed;
  const x =
    config.centerX +
    Math.cos(angle) * config.radiusX +
    Math.sin(angle * 2 + config.phase) * config.swayX;
  const z = config.centerZ + Math.sin(angle) * config.radiusZ;
  const rise = (1 - Math.sin(angle)) * 0.5;
  const y =
    config.baseHeight +
    rise * config.heightRise +
    Math.sin(elapsed * config.bobSpeed + config.phase) * config.bobAmp;
  return { x, y, z, angle };
}

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
      child.receiveShadow = true;
    }
  });
  [body, head, tail, wingLeft, wingRight].forEach((mesh) => {
    mesh.castShadow = true;
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
  const longRoutes = [
    {
      centerX: 0,
      centerZ: -58,
      radiusX: 19,
      radiusZ: 62,
      swayX: 3.5,
      baseHeight: 8.6,
      heightRise: 10,
      bobAmp: 0.35,
      bobSpeed: 2.1,
      speed: 0.19,
      phase: 0.25,
      flapSpeed: 21,
      scale: 0.56,
    },
    {
      centerX: -5,
      centerZ: -54,
      radiusX: 15,
      radiusZ: 58,
      swayX: 2.5,
      baseHeight: 9.4,
      heightRise: 8,
      bobAmp: 0.3,
      bobSpeed: 2.5,
      speed: 0.22,
      phase: 1.55,
      flapSpeed: 23,
      scale: 0.5,
    },
    {
      centerX: 6,
      centerZ: -61,
      radiusX: 22,
      radiusZ: 64,
      swayX: 4,
      baseHeight: 8.2,
      heightRise: 12,
      bobAmp: 0.4,
      bobSpeed: 1.8,
      speed: 0.17,
      phase: 2.8,
      flapSpeed: 19,
      scale: 0.6,
    },
    {
      centerX: -2,
      centerZ: -57,
      radiusX: 12,
      radiusZ: 61,
      swayX: 2,
      baseHeight: 10,
      heightRise: 9,
      bobAmp: 0.3,
      bobSpeed: 2.3,
      speed: 0.21,
      phase: 4,
      flapSpeed: 22,
      scale: 0.52,
    },
    {
      centerX: 4,
      centerZ: -60,
      radiusX: 17,
      radiusZ: 63,
      swayX: 3,
      baseHeight: 9,
      heightRise: 11,
      bobAmp: 0.36,
      bobSpeed: 2,
      speed: 0.18,
      phase: 5.15,
      flapSpeed: 20,
      scale: 0.58,
    },
    {
      centerX: -7,
      centerZ: -56,
      radiusX: 20,
      radiusZ: 60,
      swayX: 3.5,
      baseHeight: 8.8,
      heightRise: 9,
      bobAmp: 0.32,
      bobSpeed: 2.6,
      speed: 0.2,
      phase: 0.95,
      flapSpeed: 24,
      scale: 0.48,
    },
    {
      centerX: 2,
      centerZ: -62,
      radiusX: 14,
      radiusZ: 65,
      swayX: 2.6,
      baseHeight: 9.8,
      heightRise: 12,
      bobAmp: 0.42,
      bobSpeed: 1.9,
      speed: 0.185,
      phase: 3.45,
      flapSpeed: 20,
      scale: 0.54,
    },
    {
      centerX: 7,
      centerZ: -55,
      radiusX: 16,
      radiusZ: 59,
      swayX: 2.8,
      baseHeight: 8.4,
      heightRise: 10,
      bobAmp: 0.34,
      bobSpeed: 2.2,
      speed: 0.23,
      phase: 4.9,
      flapSpeed: 22,
      scale: 0.6,
    },
  ];
  const treeRoutes = [
    {
      centerX: 0.3,
      centerZ: 0.1,
      radiusX: 3.2,
      radiusZ: 2.8,
      swayX: 0.15,
      baseHeight: 5.2,
      heightRise: 0.5,
      bobAmp: 0.14,
      bobSpeed: 2.4,
      speed: 0.9,
      phase: 0.4,
      flapSpeed: 24,
      scale: 0.58,
    },
    {
      centerX: -0.4,
      centerZ: -0.2,
      radiusX: 2.8,
      radiusZ: 3.1,
      swayX: 0.2,
      baseHeight: 6,
      heightRise: 0.4,
      bobAmp: 0.16,
      bobSpeed: 2.1,
      speed: -1.1,
      phase: 2.2,
      flapSpeed: 26,
      scale: 0.53,
    },
    {
      centerX: 0.2,
      centerZ: 0.3,
      radiusX: 3.5,
      radiusZ: 2.5,
      swayX: 0.18,
      baseHeight: 4.6,
      heightRise: 0.5,
      bobAmp: 0.12,
      bobSpeed: 2.8,
      speed: 0.72,
      phase: 4.6,
      flapSpeed: 22,
      scale: 0.6,
    },
  ];
  const perches = [
    { position: new THREE.Vector3(1.62, 3.99, 0.45), yaw: -0.7, scale: 0.54 },
    { position: new THREE.Vector3(-1.42, 4.32, -0.35), yaw: 0.8, scale: 0.5 },
    { position: new THREE.Vector3(2.27, 4.55, 0.02), yaw: 1.1, scale: 0.46 },
  ];
  const birds = [];

  const addFlyer = (config) => {
    const bird = createBird(random);
    const start = getRoutePosition(config, 0);
    const ahead = getRoutePosition(config, 0.06);
    const horizontal = Math.hypot(ahead.x - start.x, ahead.z - start.z);
    bird.group.scale.setScalar(config.scale);
    bird.group.position.set(start.x, start.y, start.z);
    bird.group.rotation.y = Math.atan2(ahead.x - start.x, ahead.z - start.z);
    bird.group.rotation.x = THREE.MathUtils.clamp(
      -Math.atan2(ahead.y - start.y, Math.max(horizontal, 0.001)) * 0.8,
      -0.32,
      0.32,
    );
    bird.kind = "flyer";
    bird.config = config;
    bird.lastX = start.x;
    bird.lastY = start.y;
    bird.lastZ = start.z;
    birds.push(bird);
    group.add(bird.group);
  };

  longRoutes.forEach(addFlyer);
  treeRoutes.forEach(addFlyer);

  perches.forEach((config) => {
    const bird = createBird(random);
    bird.group.position.copy(config.position);
    bird.group.rotation.y = config.yaw;
    bird.group.scale.setScalar(config.scale);
    bird.kind = "perched";
    bird.config = config;
    bird.phase = random() * Math.PI * 2;
    birds.push(bird);
    group.add(bird.group);
  });

  return {
    group,
    update(elapsed, delta) {
      const dt = Math.min(delta, 0.05);

      birds.forEach((bird) => {
        if (bird.kind === "flyer") {
          const config = bird.config;
          const current = getRoutePosition(config, elapsed);
          const dx = current.x - bird.lastX;
          const dy = current.y - bird.lastY;
          const dz = current.z - bird.lastZ;
          const horizontal = Math.hypot(dx, dz);

          bird.group.position.set(current.x, current.y, current.z);

          if (horizontal > 0.00001) {
            const targetYaw = Math.atan2(dx, dz);
            bird.group.rotation.y = dampAngle(
              bird.group.rotation.y,
              targetYaw,
              6,
              dt,
            );
            const targetPitch = THREE.MathUtils.clamp(
              -Math.atan2(dy, horizontal) * 0.8,
              -0.32,
              0.32,
            );
            bird.group.rotation.x +=
              (targetPitch - bird.group.rotation.x) * (1 - Math.exp(-6 * dt));
          }

          bird.group.rotation.z = Math.sin(elapsed * 1.1 + config.phase) * 0.09;
          const flap =
            Math.sin(elapsed * config.flapSpeed + config.phase) * 0.55;
          bird.wingLeftPivot.rotation.z = -flap;
          bird.wingRightPivot.rotation.z = flap;

          bird.lastX = current.x;
          bird.lastY = current.y;
          bird.lastZ = current.z;
          return;
        }

        const { position, yaw } = bird.config;
        const hop = Math.max(0, Math.sin(elapsed * 1.35 + bird.phase));
        const flutter =
          Math.max(0, Math.sin(elapsed * 0.82 + bird.phase) - 0.72) / 0.28;
        const flap = Math.sin(elapsed * 18 + bird.phase) * 0.5 * flutter;
        bird.group.position.set(
          position.x + Math.sin(elapsed * 0.7 + bird.phase) * 0.022,
          position.y + hop * 0.045,
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
