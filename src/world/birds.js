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

function buildFlightCurve(start, end, config) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const horizontal = Math.max(0.001, Math.hypot(dx, dz));
  const dirX = dx / horizontal;
  const dirZ = dz / horizontal;
  const perpX = -dirZ;
  const perpZ = dirX;
  const side = config.sway * config.side;
  const lift = Math.max(8, horizontal * 0.13);

  const control1 = new THREE.Vector3(
    start.x + perpX * side - dirX * 3,
    start.y + lift,
    start.z + perpZ * side - dirZ * 3,
  );
  const control2 = new THREE.Vector3(
    end.x - perpX * side * 0.5 + dirX * 3,
    end.y + lift * 0.72,
    end.z - perpZ * side * 0.5 + dirZ * 3,
  );

  return new THREE.CubicBezierCurve3(
    start.clone(),
    control1,
    control2,
    end.clone(),
  );
}

function getOrbitPoint(config, center, angle) {
  return {
    x:
      center.x +
      Math.cos(angle) * config.radiusX +
      Math.sin(angle * 2 + config.phase) * 0.18,
    y:
      center.y +
      config.heightOffset +
      Math.sin(angle * 2 + config.phase) * config.bobAmp,
    z: center.z + Math.sin(angle) * config.radiusZ,
  };
}

export function createBirds({ homeTree, destinationTree }) {
  const group = new THREE.Group();
  const random = mulberry32(0xb14d5);
  const birds = [];
  const shuttleBirds = [];
  const treeFlyers = [];
  const residentBirds = [];
  const homeAnchors = homeTree.perches;
  const destinationAnchors = destinationTree.perches;
  const homeCenter = homeTree.group.position.clone();
  homeCenter.y += 5.4 * homeTree.group.scale.x;

  const shuttleConfigs = [
    {
      anchorIndex: 3,
      startAt: "home",
      timer: 1.8,
      phase: 0.2,
      scale: 0.56,
      flapSpeed: 21,
      duration: 11.5,
      sway: 6,
      side: 1,
    },
    {
      anchorIndex: 4,
      startAt: "home",
      timer: 5.2,
      phase: 1.1,
      scale: 0.5,
      flapSpeed: 23,
      duration: 12.8,
      sway: 5.5,
      side: -1,
    },
    {
      anchorIndex: 5,
      startAt: "destination",
      timer: 2.5,
      phase: 2,
      scale: 0.58,
      flapSpeed: 20,
      duration: 12.2,
      sway: 7,
      side: 1,
    },
    {
      anchorIndex: 6,
      startAt: "destination",
      timer: 6.4,
      phase: 2.9,
      scale: 0.52,
      flapSpeed: 22,
      duration: 11,
      sway: 5,
      side: -1,
    },
    {
      anchorIndex: 7,
      startAt: "home",
      timer: 8.6,
      phase: 3.8,
      scale: 0.54,
      flapSpeed: 24,
      duration: 13.5,
      sway: 8,
      side: -1,
    },
    {
      anchorIndex: 8,
      startAt: "destination",
      timer: 9.5,
      phase: 4.7,
      scale: 0.6,
      flapSpeed: 19,
      duration: 12.6,
      sway: 6.5,
      side: 1,
    },
    {
      anchorIndex: 9,
      startAt: "home",
      timer: 12.2,
      phase: 5.6,
      scale: 0.48,
      flapSpeed: 25,
      duration: 10.5,
      sway: 4.5,
      side: 1,
    },
    {
      anchorIndex: 10,
      startAt: "destination",
      timer: 13.8,
      phase: 0.6,
      scale: 0.55,
      flapSpeed: 22,
      duration: 13,
      sway: 7.5,
      side: -1,
    },
  ];
  const orbitConfigs = [
    {
      radiusX: 3.2,
      radiusZ: 2.8,
      heightOffset: -0.3,
      bobAmp: 0.2,
      speed: 0.9,
      phase: 0.4,
      scale: 0.58,
      flapSpeed: 24,
    },
    {
      radiusX: 2.8,
      radiusZ: 3.1,
      heightOffset: 0.5,
      bobAmp: 0.25,
      speed: -1.1,
      phase: 2.2,
      scale: 0.53,
      flapSpeed: 26,
    },
    {
      radiusX: 3.5,
      radiusZ: 2.5,
      heightOffset: -0.8,
      bobAmp: 0.18,
      speed: 0.72,
      phase: 4.6,
      scale: 0.6,
      flapSpeed: 22,
    },
  ];

  const setPerchedWings = (bird) => {
    bird.wingLeftPivot.rotation.z = 0.72;
    bird.wingRightPivot.rotation.z = -0.72;
  };

  shuttleConfigs.forEach((config) => {
    const bird = createBird(random);
    bird.kind = "shuttle";
    bird.group.scale.setScalar(config.scale);
    bird.homeAnchor = homeAnchors[config.anchorIndex];
    bird.destinationAnchor = destinationAnchors[config.anchorIndex];
    bird.at = config.startAt;
    bird.to = null;
    bird.state = "perched";
    bird.timer = config.timer;
    bird.phase = config.phase;
    bird.flapSpeed = config.flapSpeed;
    bird.baseDuration = config.duration;
    bird.sway = config.sway;
    bird.side = config.side;
    const anchor =
      bird.at === "home" ? bird.homeAnchor : bird.destinationAnchor;
    bird.group.position.copy(anchor.position);
    bird.group.rotation.y = anchor.yaw;
    setPerchedWings(bird);
    shuttleBirds.push(bird);
    birds.push(bird);
    group.add(bird.group);
  });

  orbitConfigs.forEach((config) => {
    const bird = createBird(random);
    const start = getOrbitPoint(config, homeCenter, config.phase);
    const ahead = getOrbitPoint(config, homeCenter, config.phase + 0.05);
    bird.kind = "orbit";
    bird.config = config;
    bird.group.scale.setScalar(config.scale);
    bird.group.position.set(start.x, start.y, start.z);
    bird.group.rotation.y = Math.atan2(ahead.x - start.x, ahead.z - start.z);
    bird.lastX = start.x;
    bird.lastY = start.y;
    bird.lastZ = start.z;
    treeFlyers.push(bird);
    birds.push(bird);
    group.add(bird.group);
  });

  homeAnchors.slice(0, 3).forEach((anchor, index) => {
    const bird = createBird(random);
    bird.kind = "resident";
    bird.anchor = anchor;
    bird.phase = random() * Math.PI * 2;
    bird.group.scale.setScalar(0.46 + index * 0.025);
    bird.group.position.copy(anchor.position);
    bird.group.rotation.y = anchor.yaw;
    setPerchedWings(bird);
    residentBirds.push(bird);
    birds.push(bird);
    group.add(bird.group);
  });

  const startFlight = (bird) => {
    const to = bird.at === "home" ? "destination" : "home";
    const start =
      bird.at === "home"
        ? bird.homeAnchor.position
        : bird.destinationAnchor.position;
    const end =
      to === "home"
        ? bird.homeAnchor.position
        : bird.destinationAnchor.position;
    bird.curve = buildFlightCurve(start, end, bird);
    bird.to = to;
    bird.state = "flying";
    bird.flightTime = 0;
    bird.duration = bird.baseDuration * (0.92 + random() * 0.16);
    const tangent = bird.curve.getTangent(0);
    bird.group.rotation.y = Math.atan2(tangent.x, tangent.z);
    bird.group.rotation.x = THREE.MathUtils.clamp(
      -Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z)) * 0.9,
      -0.55,
      0.55,
    );
    bird.group.rotation.z = 0;
  };

  const finishFlight = (bird) => {
    bird.state = "perched";
    bird.at = bird.to;
    bird.to = null;
    const anchor =
      bird.at === "home" ? bird.homeAnchor : bird.destinationAnchor;
    bird.group.position.copy(anchor.position);
    bird.group.rotation.set(0, anchor.yaw, 0);
    bird.timer = bird.at === "home" ? 3.5 + random() * 4.5 : 5 + random() * 6;
    setPerchedWings(bird);
  };

  const updateShuttle = (bird, elapsed, dt) => {
    if (bird.state === "flying") {
      bird.flightTime += dt;
      const t = Math.min(1, bird.flightTime / bird.duration);
      const position = bird.curve.getPoint(t);
      const tangent = bird.curve.getTangent(t);
      const horizontal = Math.hypot(tangent.x, tangent.z);
      bird.group.position.copy(position);
      bird.group.rotation.y = dampAngle(
        bird.group.rotation.y,
        Math.atan2(tangent.x, tangent.z),
        6,
        dt,
      );
      const targetPitch = THREE.MathUtils.clamp(
        -Math.atan2(tangent.y, Math.max(horizontal, 0.001)) * 0.9,
        -0.55,
        0.55,
      );
      bird.group.rotation.x +=
        (targetPitch - bird.group.rotation.x) * (1 - Math.exp(-6 * dt));
      bird.group.rotation.z = Math.sin(elapsed * 1.1 + bird.phase) * 0.08;

      const flap = Math.sin(elapsed * bird.flapSpeed + bird.phase) * 0.58;
      bird.wingLeftPivot.rotation.z = -flap;
      bird.wingRightPivot.rotation.z = flap;

      if (t >= 1) {
        finishFlight(bird);
      }
      return;
    }

    const anchor =
      bird.at === "home" ? bird.homeAnchor : bird.destinationAnchor;
    bird.group.position.set(
      anchor.position.x + Math.sin(elapsed * 0.7 + bird.phase) * 0.02,
      anchor.position.y +
        Math.max(0, Math.sin(elapsed * 1.4 + bird.phase)) * 0.018,
      anchor.position.z,
    );
    bird.group.rotation.y = dampAngle(
      bird.group.rotation.y,
      anchor.yaw + Math.sin(elapsed * 0.55 + bird.phase) * 0.14,
      4,
      dt,
    );
    bird.group.rotation.x +=
      (0 - bird.group.rotation.x) * (1 - Math.exp(-5 * dt));
    bird.group.rotation.z = Math.sin(elapsed * 1.05 + bird.phase) * 0.035;

    const flutter =
      Math.max(0, Math.sin(elapsed * 0.82 + bird.phase) - 0.74) / 0.26;
    const flap = Math.sin(elapsed * 18 + bird.phase) * 0.45 * flutter;
    bird.wingLeftPivot.rotation.z = 0.72 - flap;
    bird.wingRightPivot.rotation.z = -0.72 + flap;

    bird.timer -= dt;
    if (bird.timer <= 0) {
      startFlight(bird);
    }
  };

  const updateOrbit = (bird, elapsed, dt) => {
    const config = bird.config;
    const angle = config.phase + elapsed * config.speed;
    const current = getOrbitPoint(config, homeCenter, angle);
    const dx = current.x - bird.lastX;
    const dy = current.y - bird.lastY;
    const dz = current.z - bird.lastZ;
    const horizontal = Math.hypot(dx, dz);

    bird.group.position.set(current.x, current.y, current.z);

    if (horizontal > 0.00001) {
      bird.group.rotation.y = dampAngle(
        bird.group.rotation.y,
        Math.atan2(dx, dz),
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

    bird.group.rotation.z = Math.sin(angle + config.phase) * 0.1;
    const flap = Math.sin(elapsed * config.flapSpeed + config.phase) * 0.55;
    bird.wingLeftPivot.rotation.z = -flap;
    bird.wingRightPivot.rotation.z = flap;

    bird.lastX = current.x;
    bird.lastY = current.y;
    bird.lastZ = current.z;
  };

  const updateResident = (bird, elapsed) => {
    const { anchor } = bird;
    const hop = Math.max(0, Math.sin(elapsed * 1.35 + bird.phase));
    const flutter =
      Math.max(0, Math.sin(elapsed * 0.82 + bird.phase) - 0.72) / 0.28;
    const flap = Math.sin(elapsed * 18 + bird.phase) * 0.5 * flutter;
    bird.group.position.set(
      anchor.position.x + Math.sin(elapsed * 0.7 + bird.phase) * 0.022,
      anchor.position.y + hop * 0.045,
      anchor.position.z,
    );
    bird.group.rotation.y =
      anchor.yaw + Math.sin(elapsed * 0.55 + bird.phase) * 0.16;
    bird.group.rotation.z = Math.sin(elapsed * 1.1 + bird.phase) * 0.045;
    bird.wingLeftPivot.rotation.z = 0.72 - flap;
    bird.wingRightPivot.rotation.z = -0.72 + flap;
  };

  return {
    group,
    update(elapsed, delta) {
      const dt = Math.min(delta, 0.05);
      shuttleBirds.forEach((bird) => updateShuttle(bird, elapsed, dt));
      treeFlyers.forEach((bird) => updateOrbit(bird, elapsed, dt));
      residentBirds.forEach((bird) => updateResident(bird, elapsed));
    },
  };
}
