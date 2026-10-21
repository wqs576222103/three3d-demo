import * as THREE from "three";
import { clamp01 } from "../utils/random.js";
import { getGroundHeight } from "../world/mountains.js";
import {
  TERRAIN_CENTER_Z,
  TERRAIN_SIZE,
  WATER_LEVEL,
} from "../world/terrain.js";

const WALK_SPEED = 4.2;
const RUN_SPEED = 9.6;
const CROUCH_SPEED = 1.8;
const JUMP_SPEED = 6.3;
const GRAVITY = 19;
const PLAYER_RADIUS = 0.3;
const MAP_HALF_X = TERRAIN_SIZE / 2 - 2;
const MAP_MIN_Z = TERRAIN_CENTER_Z - TERRAIN_SIZE / 2 + 2;
const MAP_MAX_Z = TERRAIN_CENTER_Z + TERRAIN_SIZE / 2 - 2;

const UP = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();
const desiredVelocity = new THREE.Vector3();

function createCharacter() {
  const visual = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({
    color: 0xc9793f,
    roughness: 0.88,
    flatShading: true,
  });
  const trousers = new THREE.MeshStandardMaterial({
    color: 0x3d4a3d,
    roughness: 0.95,
    flatShading: true,
  });
  const boots = new THREE.MeshStandardMaterial({
    color: 0x34291f,
    roughness: 1,
    flatShading: true,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xd7a276,
    roughness: 0.86,
    flatShading: true,
  });
  const hat = new THREE.MeshStandardMaterial({
    color: 0x33565a,
    roughness: 0.92,
    flatShading: true,
  });
  const pack = new THREE.MeshStandardMaterial({
    color: 0x73513a,
    roughness: 0.95,
    flatShading: true,
  });
  const scarf = new THREE.MeshStandardMaterial({
    color: 0xa94736,
    roughness: 0.9,
    flatShading: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x1e211f,
    roughness: 0.7,
  });

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.48, 4, 8),
    jacket,
  );
  torso.position.y = 1.16;
  torso.scale.z = 0.82;
  visual.add(torso);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.09, 8),
    scarf,
  );
  neck.position.y = 1.58;
  visual.add(neck);

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), skin);
  head.position.y = 1.76;
  visual.add(head);

  const hatCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.195, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hat,
  );
  hatCrown.position.y = 1.76;
  visual.add(hatCrown);

  const hatBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.198, 0.198, 0.07, 10),
    hat,
  );
  hatBrim.position.y = 1.75;
  visual.add(hatBrim);

  const eyeGeometry = new THREE.SphereGeometry(0.018, 6, 4);
  const eyeLeft = new THREE.Mesh(eyeGeometry, dark);
  eyeLeft.position.set(-0.065, 1.77, 0.165);
  const eyeRight = eyeLeft.clone();
  eyeRight.position.x = 0.065;
  visual.add(eyeLeft, eyeRight);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.24), pack);
  backpack.position.set(0, 1.16, -0.27);
  visual.add(backpack);

  const roll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.44, 7),
    scarf,
  );
  roll.position.set(0, 1.46, -0.3);
  roll.rotation.z = Math.PI / 2;
  visual.add(roll);

  const upperArmGeometry = new THREE.CapsuleGeometry(0.06, 0.18, 3, 6);
  const forearmGeometry = new THREE.CapsuleGeometry(0.055, 0.16, 3, 6);
  const handGeometry = new THREE.SphereGeometry(0.06, 6, 5);
  const armLeft = new THREE.Group();
  const armRight = new THREE.Group();
  const elbowLeft = new THREE.Group();
  const elbowRight = new THREE.Group();

  [
    [armLeft, elbowLeft, -0.3],
    [armRight, elbowRight, 0.3],
  ].forEach(([arm, elbow, x]) => {
    arm.position.set(x, 1.4, 0);
    const upperArm = new THREE.Mesh(upperArmGeometry, jacket);
    upperArm.position.y = -0.15;
    elbow.position.y = -0.3;
    const forearm = new THREE.Mesh(forearmGeometry, jacket);
    forearm.position.y = -0.135;
    const hand = new THREE.Mesh(handGeometry, skin);
    hand.position.y = -0.285;
    elbow.add(forearm, hand);
    arm.add(upperArm, elbow);
    visual.add(arm);
  });

  const upperLegGeometry = new THREE.CapsuleGeometry(0.085, 0.25, 3, 6);
  const lowerLegGeometry = new THREE.CapsuleGeometry(0.072, 0.2, 3, 6);
  const bootGeometry = new THREE.BoxGeometry(0.16, 0.14, 0.27);
  const legLeft = new THREE.Group();
  const legRight = new THREE.Group();
  const kneeLeft = new THREE.Group();
  const kneeRight = new THREE.Group();

  [
    [legLeft, kneeLeft, -0.12],
    [legRight, kneeRight, 0.12],
  ].forEach(([leg, knee, x]) => {
    leg.position.set(x, 0.85, 0);
    const upperLeg = new THREE.Mesh(upperLegGeometry, trousers);
    upperLeg.position.y = -0.21;
    knee.position.y = -0.42;
    const lowerLeg = new THREE.Mesh(lowerLegGeometry, trousers);
    lowerLeg.position.y = -0.16;
    const boot = new THREE.Mesh(bootGeometry, boots);
    boot.position.set(0, -0.35, 0.045);
    knee.add(lowerLeg, boot);
    leg.add(upperLeg, knee);
    visual.add(leg);
  });

  visual.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return {
    visual,
    armLeft,
    armRight,
    elbowLeft,
    elbowRight,
    legLeft,
    legRight,
    kneeLeft,
    kneeRight,
  };
}

export function createPlayer(startX = 5, startZ = 13, collisionWorld = null) {
  const group = new THREE.Group();
  const character = createCharacter();
  group.add(character.visual);
  group.position.set(startX, getGroundHeight(startX, startZ), startZ);
  group.rotation.y = Math.PI;

  const horizontalVelocity = new THREE.Vector2();
  let verticalVelocity = 0;
  let grounded = true;
  let facing = Math.PI;
  let walkPhase = 0;
  let cameraAnchor = 1.55;
  let crouchOffset = 0;

  function update(input, camera, delta, elapsed) {
    const dt = Math.min(delta, 0.05);

    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }
    right.crossVectors(forward, UP).normalize();

    wish.set(0, 0, 0);
    if (input.forward) wish.add(forward);
    if (input.backward) wish.sub(forward);
    if (input.right) wish.add(right);
    if (input.left) wish.sub(right);

    const moving = wish.lengthSq() > 0.0001;
    if (moving) {
      wish.normalize();
    }

    const crouching = input.crouch;
    const groundBefore = getGroundHeight(group.position.x, group.position.z);
    const wading = groundBefore < WATER_LEVEL - 0.2;
    let targetSpeed = 0;
    if (moving) {
      if (crouching) {
        targetSpeed = CROUCH_SPEED;
      } else if (input.sprint) {
        targetSpeed = RUN_SPEED;
      } else {
        targetSpeed = WALK_SPEED;
      }
    }
    if (wading) {
      targetSpeed *= 0.55;
    }

    desiredVelocity.copy(wish).multiplyScalar(targetSpeed);
    const response = grounded ? 13 : 5.5;
    const blend = 1 - Math.exp(-response * dt);
    horizontalVelocity.x += (desiredVelocity.x - horizontalVelocity.x) * blend;
    horizontalVelocity.y += (desiredVelocity.z - horizontalVelocity.y) * blend;

    let nextX = group.position.x + horizontalVelocity.x * dt;
    let nextZ = group.position.z + horizontalVelocity.y * dt;

    if (nextX < -MAP_HALF_X) {
      nextX = -MAP_HALF_X;
      horizontalVelocity.x = 0;
    } else if (nextX > MAP_HALF_X) {
      nextX = MAP_HALF_X;
      horizontalVelocity.x = 0;
    }

    if (nextZ < MAP_MIN_Z) {
      nextZ = MAP_MIN_Z;
      horizontalVelocity.y = 0;
    } else if (nextZ > MAP_MAX_Z) {
      nextZ = MAP_MAX_Z;
      horizontalVelocity.y = 0;
    }

    if (collisionWorld) {
      const collision = collisionWorld.resolve(
        nextX,
        nextZ,
        PLAYER_RADIUS,
        group.position.y,
      );
      if (collision.hit) {
        nextX = collision.x;
        nextZ = collision.z;
        const inward =
          horizontalVelocity.x * collision.normalX +
          horizontalVelocity.y * collision.normalZ;
        if (inward < 0) {
          horizontalVelocity.x -= collision.normalX * inward;
          horizontalVelocity.y -= collision.normalZ * inward;
        }
      }
    }

    group.position.x = nextX;
    group.position.z = nextZ;
    const ground = getGroundHeight(nextX, nextZ);

    if (grounded && input.consumeJump()) {
      grounded = false;
      verticalVelocity = JUMP_SPEED;
    }

    if (grounded) {
      group.position.y = ground;
      verticalVelocity = 0;
    } else {
      verticalVelocity -= GRAVITY * dt;
      group.position.y += verticalVelocity * dt;
      if (group.position.y <= ground) {
        group.position.y = ground;
        verticalVelocity = 0;
        grounded = true;
      }
    }

    const speed = horizontalVelocity.length();
    if (moving) {
      const targetFacing = Math.atan2(wish.x, wish.z);
      const difference = Math.atan2(
        Math.sin(targetFacing - facing),
        Math.cos(targetFacing - facing),
      );
      facing += difference * (1 - Math.exp(-12 * dt));
      group.rotation.y = facing;
    }

    const speedRatio = clamp01(speed / RUN_SPEED);
    const damping = 16;
    let hipLeftTarget = 0;
    let hipRightTarget = 0;
    let kneeLeftTarget = 0.03;
    let kneeRightTarget = 0.03;
    let armLeftTarget = 0.04;
    let armRightTarget = -0.04;
    let elbowLeftTarget = -0.14;
    let elbowRightTarget = -0.14;
    let bobTarget = 0;
    let crouchDropTarget = 0;
    let leanTarget = 0;

    if (!grounded) {
      const rising = verticalVelocity > 0;
      hipLeftTarget = rising ? -0.46 : 0.12;
      hipRightTarget = rising ? 0.3 : -0.08;
      kneeLeftTarget = rising ? 1.0 : 0.52;
      kneeRightTarget = rising ? 0.66 : 0.34;
      armLeftTarget = -0.72;
      armRightTarget = -0.72;
      elbowLeftTarget = -0.82;
      elbowRightTarget = -0.82;
      crouchDropTarget = crouching ? -0.12 : 0;
      leanTarget = 0.03;
    } else if (crouching) {
      crouchDropTarget = -0.29;
      leanTarget = 0.18;
      if (speed > 0.18) {
        walkPhase += dt * 5;
        const swing = Math.sin(walkPhase) * 0.22;
        hipLeftTarget = -0.85 + swing;
        hipRightTarget = -0.85 - swing;
        kneeLeftTarget = 1.7 - swing * 0.5;
        kneeRightTarget = 1.7 + swing * 0.5;
        armLeftTarget = -0.34 - swing * 0.5;
        armRightTarget = -0.34 + swing * 0.5;
        elbowLeftTarget = -0.68;
        elbowRightTarget = -0.68;
        bobTarget = Math.abs(Math.sin(walkPhase * 2)) * 0.012;
      } else {
        walkPhase = 0;
        hipLeftTarget = -0.85;
        hipRightTarget = -0.85;
        kneeLeftTarget = 1.7;
        kneeRightTarget = 1.7;
        armLeftTarget = -0.32;
        armRightTarget = -0.32;
        elbowLeftTarget = -0.62;
        elbowRightTarget = -0.62;
      }
    } else if (speed > 0.18) {
      walkPhase += dt * (5.6 + speed * 1.15);
      const stride = 0.28 + 0.45 * speedRatio;
      const swing = Math.sin(walkPhase) * stride;
      const kneeBend = 0.18 + 0.85 * speedRatio;
      const armSwing = 0.7 + 0.5 * speedRatio;

      hipLeftTarget = swing;
      hipRightTarget = -swing;
      kneeLeftTarget = 0.06 + Math.max(0, Math.sin(walkPhase)) * kneeBend;
      kneeRightTarget = 0.06 + Math.max(0, -Math.sin(walkPhase)) * kneeBend;
      armLeftTarget = -swing * armSwing;
      armRightTarget = swing * armSwing;
      elbowLeftTarget = -0.28 - 0.75 * speedRatio;
      elbowRightTarget = -0.28 - 0.75 * speedRatio;
      bobTarget =
        Math.abs(Math.sin(walkPhase * 2)) * (0.025 + 0.05 * speedRatio);
      leanTarget = 0.05 + 0.12 * speedRatio;
    } else {
      walkPhase = 0;
      armLeftTarget = 0.04 + Math.sin(elapsed * 1.6) * 0.025;
      armRightTarget = -0.04 - Math.sin(elapsed * 1.6) * 0.025;
      elbowLeftTarget = -0.14;
      elbowRightTarget = -0.14;
      bobTarget = Math.sin(elapsed * 1.8) * 0.008;
    }

    character.legLeft.rotation.x = THREE.MathUtils.damp(
      character.legLeft.rotation.x,
      hipLeftTarget,
      damping,
      dt,
    );
    character.legRight.rotation.x = THREE.MathUtils.damp(
      character.legRight.rotation.x,
      hipRightTarget,
      damping,
      dt,
    );
    character.kneeLeft.rotation.x = THREE.MathUtils.damp(
      character.kneeLeft.rotation.x,
      kneeLeftTarget,
      damping,
      dt,
    );
    character.kneeRight.rotation.x = THREE.MathUtils.damp(
      character.kneeRight.rotation.x,
      kneeRightTarget,
      damping,
      dt,
    );
    character.armLeft.rotation.x = THREE.MathUtils.damp(
      character.armLeft.rotation.x,
      armLeftTarget,
      damping,
      dt,
    );
    character.armRight.rotation.x = THREE.MathUtils.damp(
      character.armRight.rotation.x,
      armRightTarget,
      damping,
      dt,
    );
    character.elbowLeft.rotation.x = THREE.MathUtils.damp(
      character.elbowLeft.rotation.x,
      elbowLeftTarget,
      damping,
      dt,
    );
    character.elbowRight.rotation.x = THREE.MathUtils.damp(
      character.elbowRight.rotation.x,
      elbowRightTarget,
      damping,
      dt,
    );

    crouchOffset = THREE.MathUtils.damp(crouchOffset, crouchDropTarget, 10, dt);
    character.visual.position.y = THREE.MathUtils.damp(
      character.visual.position.y,
      bobTarget + crouchOffset,
      14,
      dt,
    );
    character.visual.rotation.x = THREE.MathUtils.damp(
      character.visual.rotation.x,
      leanTarget,
      8,
      dt,
    );
    cameraAnchor = THREE.MathUtils.damp(
      cameraAnchor,
      crouching ? 1.15 : 1.55,
      8,
      dt,
    );

    return { grounded, speed };
  }

  return {
    group,
    update,
    get grounded() {
      return grounded;
    },
    get speed() {
      return horizontalVelocity.length();
    },
    get cameraAnchor() {
      return cameraAnchor;
    },
  };
}
