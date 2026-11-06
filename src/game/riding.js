import * as THREE from "three";
import { getGroundHeight } from "../world/mountains.js";

// 够得着鞍的高度差在这个半径内即可上马，动物会主动转向玩家，所以不用太大
const MOUNT_RADIUS = 2.6;
const RIDER_RADIUS = 0.34;

export function createRiding({ player, animals, collisionWorld }) {
  let ridden = null;
  const saddle = new THREE.Vector3();

  function findMount(position) {
    let best = null;
    let bestDistance = MOUNT_RADIUS;
    animals.mounts.forEach((candidate) => {
      if (candidate.ridden) return;
      const distance = candidate.distanceTo(position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    });
    return best;
  }

  function sync() {
    if (!ridden) return;
    ridden.saddleWorld(saddle);
    player.group.position.copy(saddle);
    player.group.rotation.y = ridden.heading;
  }

  function mountOn(target) {
    if (!target || ridden) return;
    ridden = target;
    ridden.setRidden(true);
    player.setRiding(true);
    sync();
  }

  function dismount() {
    if (!ridden) return;
    const left = ridden;
    left.setRidden(false);
    ridden = null;

    // 从牲口右侧下马，落点先避开躯干，再交给碰撞系统推出障碍
    const p = left.group.position;
    const heading = left.heading;
    const offset = -left.flankOffset;
    const rawX = p.x + offset * Math.cos(heading);
    const rawZ = p.z - offset * Math.sin(heading);
    const landed = collisionWorld
      ? collisionWorld.resolve(rawX, rawZ, RIDER_RADIUS, getGroundHeight(rawX, rawZ))
      : { x: rawX, z: rawZ };

    player.setRiding(false);
    player.teleport(
      landed.x,
      getGroundHeight(landed.x, landed.z),
      landed.z,
      heading,
    );
  }

  function update(input) {
    if (!ridden) return;
    let throttle = 0;
    if (input.forward) throttle = 1;
    else if (input.backward) throttle = -1;

    // heading = atan2(前向.x, 前向.z)，增大机头会扫向牲口自身左侧，所以向右压键要减 heading
    let turn = 0;
    if (input.left) turn += 1;
    if (input.right) turn -= 1;

    ridden.setDrive({ throttle, turn, sprint: input.sprint });
    if (input.consumeJump()) ridden.jump();
  }

  return {
    findMount,
    mountOn,
    dismount,
    update,
    sync,
    get active() {
      return Boolean(ridden);
    },
    get label() {
      return ridden ? ridden.label : "";
    },
    get canJump() {
      return ridden ? ridden.canJump : false;
    },
    get mount() {
      return ridden;
    },
  };
}
