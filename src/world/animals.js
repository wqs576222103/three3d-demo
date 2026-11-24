import * as THREE from "three";
import { clamp01, mulberry32 } from "../utils/random.js";
import { getGroundHeight } from "./mountains.js";
import {
  TERRAIN_CENTER_Z,
  TERRAIN_SIZE,
  WATER_LEVEL,
  getStreamCenterZ,
} from "./terrain.js";

const MAP_HALF_X = TERRAIN_SIZE / 2 - 4;
const MAP_MIN_Z = TERRAIN_CENTER_Z - TERRAIN_SIZE / 2 + 4;
const MAP_MAX_Z = TERRAIN_CENTER_Z + TERRAIN_SIZE / 2 - 4;

// 水深超过这个值才算“泡在水里”，水牛和马的水陆速度档在这里切换
const WADING_DEPTH = 0.18;

function dampAngle(current, target, lambda, dt) {
  const difference = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + difference * (1 - Math.exp(-lambda * dt));
}

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function box(w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function mat(color, roughness = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    flatShading: true,
  });
}

function makeLeg(materials, hipY, upper, lower, hoof, x, z) {
  const hip = new THREE.Group();
  hip.position.set(x, hipY, z);
  hip.add(
    box(upper * 1.1, upper, upper * 1.1, materials.hide, 0, -upper / 2, 0),
  );

  const knee = new THREE.Group();
  knee.position.y = -upper;
  knee.add(
    box(lower * 0.84, lower, lower * 0.88, materials.hide, 0, -lower / 2, 0),
  );
  knee.add(
    box(
      hoof.x,
      hoof.y,
      hoof.z,
      materials.hoof,
      0,
      -lower - hoof.y / 2 + 0.02,
      hoof.z * 0.14,
    ),
  );

  hip.add(knee);
  return { hip, knee };
}

// 对角步态：左前+右后同相，右前+左后反相
function attachLegs(parent, materials, spec) {
  return [
    [-spec.frontX, spec.frontZ, 0],
    [spec.frontX, spec.frontZ, Math.PI],
    [-spec.rearX, spec.rearZ, Math.PI],
    [spec.rearX, spec.rearZ, 0],
  ].map(([x, z, phase]) => {
    const leg = makeLeg(
      materials,
      spec.hipY,
      spec.upper,
      spec.lower,
      spec.hoof,
      x,
      z,
    );
    parent.add(leg.hip);
    return { ...leg, phase };
  });
}

function hornGeometry(mirror) {
  const s = mirror ? -1 : 1;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.17 * s, 0.13, -0.03),
    new THREE.Vector3(0.31 * s, 0.15, -0.17),
    new THREE.Vector3(0.33 * s, 0.05, -0.33),
  ]);
  return new THREE.TubeGeometry(curve, 8, 0.055, 5, false);
}

// 水牛：肩峰高耸、大弯角，脚踩在河水里
function buildBuffalo() {
  const materials = {
    hide: mat(0x4e545c),
    belly: mat(0x3b4047),
    hoof: mat(0x2a2c2f),
    horn: mat(0x9c9488, 0.8),
    muzzle: mat(0x6d5f62, 0.9),
    eye: mat(0x15161a, 0.4),
  };

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  body.add(box(1.06, 0.84, 2.0, materials.hide, 0, 1.42, -0.05));
  body.add(box(0.92, 0.36, 0.95, materials.hide, 0, 1.79, 0.48));
  body.add(box(0.92, 0.4, 1.5, materials.belly, 0, 1.08, 0));
  body.add(box(1.0, 0.72, 0.74, materials.hide, 0, 1.44, -1.08));

  const neck = new THREE.Group();
  neck.position.set(0, 1.62, 0.94);
  neck.add(box(0.44, 0.46, 0.62, materials.hide, 0, 0.02, 0.24));

  const head = new THREE.Group();
  head.position.set(0, -0.02, 0.52);
  head.add(box(0.38, 0.44, 0.62, materials.hide, 0, 0, 0.26));
  head.add(box(0.3, 0.26, 0.3, materials.muzzle, 0, -0.11, 0.6));
  const jaw = box(0.24, 0.1, 0.26, materials.belly, 0, -0.24, 0.58);
  head.add(jaw);

  const ears = [-1, 1].map((side) => {
    const ear = box(0.22, 0.1, 0.16, materials.hide, side * 0.28, 0.1, 0.16);
    ear.rotation.y = -side * 0.5;
    head.add(ear);
    return ear;
  });

  [-1, 1].forEach((side) => {
    const horn = new THREE.Mesh(hornGeometry(side < 0), materials.horn);
    horn.position.set(side * 0.16, 0.2, 0.16);
    horn.castShadow = true;
    head.add(horn);
  });

  head.add(box(0.06, 0.06, 0.05, materials.eye, -0.18, 0.06, 0.46));
  head.add(box(0.06, 0.06, 0.05, materials.eye, 0.18, 0.06, 0.46));
  neck.add(head);
  body.add(neck);

  const tail = new THREE.Group();
  tail.position.set(0, 1.6, -1.42);
  tail.add(box(0.1, 0.66, 0.1, materials.hide, 0, -0.33, 0));
  tail.add(box(0.16, 0.26, 0.16, materials.belly, 0, -0.76, -0.02));
  body.add(tail);

  const legs = attachLegs(group, materials, {
    hipY: 1.24,
    frontX: 0.36,
    frontZ: 0.66,
    rearX: 0.36,
    rearZ: -1.06,
    upper: 0.6,
    lower: 0.46,
    hoof: { x: 0.22, y: 0.2, z: 0.28 },
  });

  return { group, body, neck, jaw, tail, legs, ears };
}

// 马：鬃毛、鞍垫，站在草坡上低头吃草
function buildHorse() {
  const materials = {
    hide: mat(0x9c6b40),
    belly: mat(0x855833),
    hoof: mat(0x33261b),
    muzzle: mat(0x4a382a, 0.9),
    eye: mat(0x15161a, 0.4),
  };
  const mane = mat(0x3a2a1c);
  const blanket = mat(0x96452f);
  const leather = mat(0x54382a);

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  body.add(box(0.64, 0.74, 1.76, materials.hide, 0, 1.42, -0.04));
  body.add(box(0.58, 0.62, 0.5, materials.hide, 0, 1.4, 0.78));
  body.add(box(0.66, 0.72, 0.62, materials.hide, 0, 1.44, -0.88));
  body.add(box(0.5, 0.3, 1.3, materials.belly, 0, 1.1, 0));

  const neck = new THREE.Group();
  neck.position.set(0, 1.62, 0.86);
  const neckMesh = box(0.3, 0.76, 0.36, materials.hide, 0, 0.3, 0.06);
  neckMesh.rotation.x = -0.34;
  neck.add(neckMesh);
  [-0.04, 0.22, 0.46].forEach((y, i) => {
    const strand = box(0.08, 0.26, 0.32, mane, 0, y, 0.04 - i * 0.04);
    strand.rotation.x = -0.34;
    neck.add(strand);
  });

  const head = new THREE.Group();
  head.position.set(0, 0.54, 0.22);
  head.add(box(0.24, 0.3, 0.6, materials.hide, 0, 0, 0.22));
  head.add(box(0.2, 0.22, 0.26, materials.muzzle, 0, -0.05, 0.56));
  const jaw = box(0.17, 0.08, 0.22, materials.belly, 0, -0.18, 0.54);
  head.add(jaw);
  head.add(box(0.11, 0.17, 0.17, mane, -0.13, 0.11, 0.58));
  head.add(box(0.11, 0.17, 0.17, mane, 0.13, 0.11, 0.58));

  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 4), materials.hide);
    ear.position.set(side * 0.09, 0.24, -0.02);
    ear.rotation.z = side * 0.22;
    ear.castShadow = true;
    head.add(ear);
    return ear;
  });

  head.add(box(0.05, 0.05, 0.05, materials.eye, -0.13, 0.05, 0.3));
  head.add(box(0.05, 0.05, 0.05, materials.eye, 0.13, 0.05, 0.3));
  neck.add(head);
  body.add(neck);

  body.add(box(0.74, 0.1, 0.86, blanket, 0, 1.8, 0.04));
  body.add(box(0.58, 0.13, 0.17, leather, 0, 1.87, 0.04));
  [-1, 1].forEach((side) => {
    body.add(box(0.06, 0.58, 0.13, leather, side * 0.33, 1.52, 0.04));
  });

  const tail = new THREE.Group();
  tail.position.set(0, 1.74, -1.16);
  tail.add(box(0.15, 0.5, 0.17, mane, 0, -0.24, -0.02));
  tail.add(box(0.12, 0.46, 0.14, mane, 0, -0.66, -0.07));
  tail.add(box(0.09, 0.38, 0.11, mane, 0, -1.04, -0.12));
  body.add(tail);

  const legs = attachLegs(group, materials, {
    hipY: 1.34,
    frontX: 0.22,
    frontZ: 0.62,
    rearX: 0.24,
    rearZ: -0.86,
    upper: 0.62,
    lower: 0.5,
    hoof: { x: 0.17, y: 0.2, z: 0.22 },
  });

  return { group, body, neck, jaw, tail, legs, ears };
}

function createRipplePool() {
  const group = new THREE.Group();
  const geometry = new THREE.RingGeometry(0.4, 0.5, 18);
  geometry.rotateX(-Math.PI / 2);
  const pool = [];

  for (let i = 0; i < 10; i += 1) {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0xe6f2f5,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.visible = false;
    group.add(mesh);
    pool.push({ mesh, life: 0 });
  }

  let cursor = 0;

  return {
    group,
    spawn(x, z) {
      const item = pool[cursor];
      cursor = (cursor + 1) % pool.length;
      item.mesh.position.set(x, WATER_LEVEL + 0.04, z);
      item.mesh.scale.setScalar(0.45);
      item.mesh.visible = true;
      item.mesh.material.opacity = 0.4;
      item.life = 1;
    },
    update(dt) {
      pool.forEach((item) => {
        if (item.life <= 0) return;
        item.life -= dt * 1.1;
        if (item.life <= 0) {
          item.mesh.visible = false;
          item.mesh.material.opacity = 0;
          return;
        }
        item.mesh.scale.setScalar(0.45 + (1 - item.life) * 2.1);
        item.mesh.material.opacity = 0.4 * item.life;
      });
    },
  };
}

function createMountActor({ build, cfg, spawn, collisionWorld, ripples, rng }) {
  const model = build();
  model.group.position.set(spawn.x, getGroundHeight(spawn.x, spawn.z), spawn.z);
  model.group.rotation.y = spawn.heading;

  const actor = {
    x: spawn.x,
    z: spawn.z,
    y: model.group.position.y,
    heading: spawn.heading,
    speed: 0,
    phase: rng() * Math.PI * 2,
    ridden: false,
    drive: { throttle: 0, turn: 0, sprint: false },
    attention: 0,
    feed: { mode: "feed", timer: 2 + rng() * 3, level: 0, target: spawn.heading },
    earTwitch: 1 + rng() * 4,
    earFlick: 0,
    rippleTimer: 0,
    rippleSide: 1,
    lift: 0,
    jumpVel: 0,
    airborne: false,
  };

  const depthAt = (x, z) => WATER_LEVEL - getGroundHeight(x, z);

  function nextIdleAction() {
    const feed = actor.feed;
    if (feed.mode === "feed") {
      if (rng() < 0.5) {
        // 换个地方接着吃：先记一个临时航向，慢走几步再低头
        feed.mode = "shift";
        feed.target = actor.heading + (rng() - 0.5) * 2.4;
        feed.timer = 1.3 + rng() * 1.3;
      } else {
        feed.mode = "rest";
        feed.timer = 1.6 + rng() * 2.4;
      }
    } else {
      feed.mode = "feed";
      feed.timer = 4 + rng() * 5;
    }
  }

  function stepIdle(dt) {
    const feed = actor.feed;
    feed.timer -= dt;
    if (feed.timer <= 0) nextIdleAction();

    let wishSpeed = 0;
    if (feed.mode === "shift") {
      actor.heading = dampAngle(actor.heading, feed.target, 2.2, dt);
      wishSpeed = cfg.idleWalk;
      const distance = Math.hypot(actor.x - spawn.x, actor.z - spawn.z);
      if (distance > cfg.roamRadius) {
        actor.heading = dampAngle(
          actor.heading,
          Math.atan2(spawn.x - actor.x, spawn.z - actor.z),
          2.6,
          dt,
        );
      }
    }

    actor.speed = damp(actor.speed, wishSpeed, 2.4, dt);
    feed.level = damp(feed.level, feed.mode === "feed" ? 1 : 0, 1.7, dt);
    return feed.level;
  }

  function stepRidden(dt) {
    const { throttle, turn, sprint } = actor.drive;
    const profile = depthAt(actor.x, actor.z) > WADING_DEPTH ? cfg.water : cfg.land;
    let wishSpeed = 0;
    if (throttle > 0) {
      wishSpeed = sprint ? profile.run : profile.cruise;
    } else if (throttle < 0) {
      // 倒车和前进一个速度，只是方向相反
      wishSpeed = -(sprint ? profile.run : profile.cruise);
    }
    actor.speed = damp(actor.speed, wishSpeed, wishSpeed === 0 ? 3.8 : 2.1, dt);

    // 停下来时转不动：转向权限跟速度挂钩，避免原地打转
    const authority = clamp01(Math.abs(actor.speed) / 2.2);
    // 速度越过 8 后收紧方向，否则一按就甩尾：
    // 满速转弯半径约 26 米，慢走时仍保留 5 米的小半径好在小院里掉头
    const grip = 1 / (1 + Math.max(0, Math.abs(actor.speed) - 8) * 0.06);
    // 倒车时不翻转方向键：按 A 马头始终往左摆，和前进时同一套直觉
    actor.heading += turn * cfg.turnRate * authority * grip * dt;

    actor.feed.level = damp(actor.feed.level, 0, 3.4, dt);
    return actor.feed.level;
  }

  function stepJump(dt) {
    if (!actor.airborne) return;
    actor.jumpVel -= cfg.jump.gravity * dt;
    actor.lift += actor.jumpVel * dt;
    if (actor.lift <= 0) {
      actor.lift = 0;
      actor.jumpVel = 0;
      actor.airborne = false;
    }
  }

  function move(dt) {
    let nextX = actor.x + Math.sin(actor.heading) * actor.speed * dt;
    let nextZ = actor.z + Math.cos(actor.heading) * actor.speed * dt;
    nextX = THREE.MathUtils.clamp(nextX, -MAP_HALF_X, MAP_HALF_X);
    nextZ = THREE.MathUtils.clamp(nextZ, MAP_MIN_Z, MAP_MAX_Z);

    // 腾空时不受树干和礁石阻挡，跳过去就是跳过去
    if (collisionWorld && !actor.airborne) {
      const hit = collisionWorld.resolve(nextX, nextZ, cfg.collideRadius, actor.y);
      if (hit.hit) {
        nextX = hit.x;
        nextZ = hit.z;
        actor.speed *= 0.3;
      }
    }

    actor.x = nextX;
    actor.z = nextZ;
    actor.y = getGroundHeight(nextX, nextZ) + actor.lift;
  }

  function animate(elapsed, dt, headDown, inWater) {
    const stride = clamp01(Math.abs(actor.speed) / cfg.strideRef);
    actor.phase +=
      dt * (2.4 + Math.min(Math.abs(actor.speed), cfg.strideRef) * 1.15);

    model.legs.forEach((leg) => {
      const swing = Math.sin(actor.phase + leg.phase);
      const front = leg.hip.position.z > 0;
      let hipTarget = swing * (0.1 + 0.62 * stride);
      let kneeTarget = 0.06 + Math.max(0, swing) * (0.16 + stride);
      if (actor.airborne) {
        hipTarget = front ? -0.5 : 0.44;
        kneeTarget = front ? 1.18 : 0.3;
      }
      leg.hip.rotation.x = damp(leg.hip.rotation.x, hipTarget, 14, dt);
      leg.knee.rotation.x = damp(leg.knee.rotation.x, kneeTarget, 14, dt);
    });

    model.neck.rotation.x = damp(
      model.neck.rotation.x,
      actor.airborne
        ? cfg.headUp
        : THREE.MathUtils.lerp(cfg.headUp, cfg.headDown, headDown),
      4.2,
      dt,
    );
    model.jaw.rotation.x =
      headDown > 0.5 ? 0.05 + Math.sin(elapsed * 7.4) * 0.05 : 0;

    const swish = 0.16 + 0.42 * inWater + 0.28 * stride;
    model.tail.rotation.x = -0.2 + Math.sin(elapsed * 1.3) * 0.08;
    model.tail.rotation.z = Math.sin(elapsed * 2.6) * swish;

    actor.earTwitch -= dt;
    if (actor.earTwitch <= 0) {
      actor.earTwitch = 2.2 + rng() * 4.5;
      actor.earFlick = 0.24;
    }
    if (actor.earFlick > 0) {
      actor.earFlick -= dt;
      const flick = Math.sin(actor.earFlick * 26) * 0.4;
      model.ears.forEach((ear, i) => {
        ear.rotation.x = i === 0 ? flick : -flick * 0.7;
      });
    } else {
      model.ears.forEach((ear) => {
        ear.rotation.x = damp(ear.rotation.x, 0, 8, dt);
      });
    }

    const bob = Math.sin(actor.phase * 2) * 0.028 * stride;
    model.body.position.y = damp(model.body.position.y, bob, 10, dt);
    model.body.rotation.z = Math.sin(actor.phase) * 0.016 * stride;
  }

  function emitRipples(dt, inWater) {
    if (!inWater || Math.abs(actor.speed) < 1.6) {
      actor.rippleTimer = 0;
      return;
    }
    actor.rippleTimer -= dt;
    if (actor.rippleTimer > 0) return;
    actor.rippleTimer = 0.28;
    actor.rippleSide *= -1;
    // 涟漪留在世界坐标里，所以跟着跨步左右交替生成
    const side = actor.rippleSide * cfg.collideRadius * 0.62;
    ripples.spawn(
      actor.x + Math.cos(actor.heading) * side,
      actor.z - Math.sin(actor.heading) * side,
    );
  }

  return {
    group: model.group,
    label: cfg.label,
    hint: cfg.hint || "",
    flankOffset: cfg.flankOffset,
    get heading() {
      return actor.heading;
    },
    get ridden() {
      return actor.ridden;
    },
    get speed() {
      return actor.speed;
    },
    get canJump() {
      return Boolean(cfg.jump);
    },
    jump() {
      if (!cfg.jump || actor.airborne) return false;
      actor.airborne = true;
      actor.jumpVel = cfg.jump.velocity;
      return true;
    },
    distanceTo(point) {
      return Math.hypot(actor.x - point.x, actor.z - point.z);
    },
    setRidden(on) {
      actor.ridden = on;
      actor.drive.throttle = 0;
      actor.drive.turn = 0;
      if (!on) {
        actor.feed.mode = "rest";
        actor.feed.timer = 2.2;
        actor.lift = 0;
        actor.jumpVel = 0;
        actor.airborne = false;
      }
    },
    setDrive(drive) {
      actor.drive.throttle = drive.throttle;
      actor.drive.turn = drive.turn;
      actor.drive.sprint = drive.sprint;
    },
    saddleWorld(out) {
      const s = Math.sin(actor.heading);
      const c = Math.cos(actor.heading);
      const { x, y, z } = cfg.saddle;
      out.set(
        model.group.position.x + x * c + z * s,
        model.group.position.y + y,
        model.group.position.z - x * s + z * c,
      );
    },
    update(elapsed, dt, playerPosition) {
      const inWater = depthAt(actor.x, actor.z) > WADING_DEPTH ? 1 : 0;
      let headDown = 0;

      if (actor.ridden) {
        actor.attention = 0;
        headDown = stepRidden(dt);
      } else {
        const near =
          Math.hypot(actor.x - playerPosition.x, actor.z - playerPosition.z) <
          cfg.attentionRadius;
        actor.attention = damp(actor.attention, near ? 1 : 0, 2.2, dt);
        if (actor.attention > 0.55) {
          // 察觉来人：停步、抬头、慢慢转向玩家，方便靠近骑乘
          actor.speed = damp(actor.speed, 0, 3.2, dt);
          actor.feed.level = damp(actor.feed.level, 0, 4, dt);
          actor.heading = dampAngle(
            actor.heading,
            Math.atan2(playerPosition.x - actor.x, playerPosition.z - actor.z),
            1.5 * actor.attention,
            dt,
          );
        } else {
          headDown = stepIdle(dt);
        }
      }

      stepJump(dt);
      move(dt);
      model.group.position.set(actor.x, actor.y, actor.z);
      model.group.rotation.y = actor.heading;

      animate(elapsed, dt, headDown, inWater);
      emitRipples(dt, inWater);
    },
  };
}

const BUFFALO_CFG = {
  label: "水牛",
  hint: "下水比岸上快一倍",
  collideRadius: 0.82,
  flankOffset: 1.2,
  saddle: { x: 0, y: 1.05, z: 0.02 },
  turnRate: 1.5,
  // 驮着两吨身子，只够抬起来半米：滞空 0.45 秒，岸上蹦一步不到四米，
  // 只有在河里跑起来才勉强跳得远些，比马差一大截
  jump: { velocity: 5.0, gravity: 22 },
  idleWalk: 0.55,
  roamRadius: 6,
  attentionRadius: 6,
  headDown: 0.92,
  headUp: -0.12,
  strideRef: 11,
  // 泡在河里才是水牛的主场，岸上拖着身子走：水中正好是岸上的两倍
  land: { cruise: 7, run: 12 },
  water: { cruise: 14, run: 22 },
};

const HORSE_CFG = {
  label: "马",
  collideRadius: 0.6,
  flankOffset: 0.95,
  saddle: { x: 0, y: 1.0, z: -0.02 },
  turnRate: 1.8,
  // 腾起 1.5 米、滞空将近 1 秒：把重力放轻而不是把马顶更高，
  // 这样疾奔时一步能跨过二十多米，慢三步也能跳过十来米外的礁石
  jump: { velocity: 6.4, gravity: 13.6 },
  idleWalk: 0.6,
  roamRadius: 8,
  attentionRadius: 6.5,
  headDown: 1.05,
  headUp: -0.05,
  strideRef: 14,
  // 马是陆地主力，全速接近玩家奔跑的 2.5 倍；涉水仍慢，但不再比人趟水还慢
  land: { cruise: 11, run: 24 },
  water: { cruise: 6.5, run: 8.5 },
};

export function createAnimals({ collisionWorld = null } = {}) {
  const group = new THREE.Group();
  const rng = mulberry32(0x51de7);
  const ripples = createRipplePool();

  // 水牛踩在河道南岸浅水里、头朝河心喝水；马在小屋与河之间的草坡吃草
  const buffaloX = -14;
  const horseX = 5.5;
  const horseZ = -22.5;

  const mounts = [
    createMountActor({
      build: buildBuffalo,
      cfg: BUFFALO_CFG,
      spawn: {
        x: buffaloX,
        z: getStreamCenterZ(buffaloX) + 2.2,
        heading: Math.PI,
      },
      collisionWorld,
      ripples,
      rng,
    }),
    createMountActor({
      build: buildHorse,
      cfg: HORSE_CFG,
      spawn: { x: horseX, z: horseZ, heading: -0.6 },
      collisionWorld,
      ripples,
      rng,
    }),
  ];

  group.add(ripples.group);
  mounts.forEach((mount) => group.add(mount.group));

  return {
    group,
    mounts,
    update(elapsed, delta, playerPosition) {
      const dt = Math.min(delta, 0.05);
      mounts.forEach((mount) => mount.update(elapsed, dt, playerPosition));
      ripples.update(dt);
    },
  };
}
