import * as THREE from "three";
import { getGroundHeight } from "../world/mountains.js";
import { getStreamCenterZ, WATER_LEVEL } from "../world/terrain.js";

// 溪边石墩的拾取半径
const PICK_RADIUS = 1.7;
// 竿的家：屋北溪南岸的一块石墩，出屋走五米就到，离水面七米出头，
// 站在墩子边上就能下杆。拿走之后只能再放回这个墩子。
const ROD_HOME_X = -10;
const ROD_HOME_Z = getStreamCenterZ(ROD_HOME_X) + 7.4;
const ROD_HOME = new THREE.Vector3(
  ROD_HOME_X,
  getGroundHeight(ROD_HOME_X, ROD_HOME_Z),
  ROD_HOME_Z,
);
// 沿岸找水：从人身前 2.2 米起，最远够到 7.4 米，浅过 0.26 米钩不住鱼。
// 还要落在离水道中心 2.4 米以内，鱼平时只贴着中心线游，甩在边上它们到不了。
const CAST_START = 2.2;
const CAST_REACH = 7.4;
const CAST_STEP = 0.4;
const CAST_ARC = [-0.45, -0.22, 0, 0.22, 0.45];
const CAST_MIN_DEPTH = 0.26;
const CAST_MAX_OFF_CENTER = 2.4;
// 鱼把线扯出这个长度就绷断，站着下杆最稳
const LINE_LIMIT = 11;
const BITE_GAP = 0.7;
const BITE_TIMEOUT = 16;

// 收线：一次点击蓄 0.155，放着不点每秒掉 0.22，
// 所以每秒两下（约 0.45 秒一次）才刚好不倒退，三到四下才涨得快。
const CHARGE_PER_CLICK = 0.155;
const CHARGE_DECAY = 0.22;
const CATCH_CHARGE = 0.68;
// 张力：正常节奏一下 +0.1，每秒缓 0.55；间隔不足 0.18 秒算猛点，多 +0.3
const TENSION_PER_CLICK = 0.1;
const TENSION_SPAM = 0.3;
const TENSION_DECAY = 0.55;
const TENSION_SNAP = 1;
const SPAM_INTERVAL = 0.18;
// 咬钩后鱼带着钩子横向游动的幅度，线会被拖着走
const FISH_RUN = 0.35;
const LAND_TIME = 1.5;
// 竿身角度挂在屈起的小臂上，手臂加手肘总共压低约 1.7 弧度，
// 所以 2.4 上下是"杆头朝前上方端着"，3.6 左右才是"杆头压向水面"
const ROD_POSE = { held: 2.35, cast: 3.62, bite: 3.3, landed: 1.95 };

function bambooMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xd8b877,
    roughness: 0.62,
    metalness: 0.04,
    flatShading: true,
  });
}

function buildRod() {
  const rod = new THREE.Group();
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.05, 0.34, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.9 }),
  );
  grip.position.y = 0.17;
  const shaft = new THREE.Mesh(
    // 低模场景里 1 厘米粗的杆子远看就没了，放到 3.4 厘米才认得出来
    new THREE.CylinderGeometry(0.014, 0.034, 1.16, 5),
    bambooMaterial(),
  );
  shaft.position.y = 0.34 + 0.58;
  // 杆头系一小条红布：立在溪边时最容易看见
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.11),
    new THREE.MeshStandardMaterial({
      color: 0xd2453a,
      roughness: 0.7,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
  );
  flag.position.set(0.1, 1.4, 0);
  flag.rotation.set(0, 0.5, 0.9);
  const tip = new THREE.Object3D();
  tip.position.y = 1.5;
  rod.add(grip, shaft, flag, tip);
  rod.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return { rod, tip };
}

// 石墩加丫形木托：把竿稳稳架起来，杆头朝天比斜靠墙好认
function buildRodStand() {
  const stand = new THREE.Group();
  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.5, 0.3, 7),
    new THREE.MeshStandardMaterial({
      color: 0x8d8f86,
      roughness: 0.96,
      flatShading: true,
    }),
  );
  stone.position.y = 0.15;
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.062, 0.52, 6),
    bambooMaterial(),
  );
  post.position.y = 0.42;
  const prongGeometry = new THREE.CylinderGeometry(0.032, 0.042, 0.3, 5);
  const prongs = [-0.34, 0.34].map((lean) => {
    const prong = new THREE.Mesh(prongGeometry, bambooMaterial());
    prong.position.set(Math.sin(lean) * 0.12, 0.78, 0);
    prong.rotation.z = -lean;
    return prong;
  });
  stand.add(stone, post, ...prongs);
  stand.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  stand.position.copy(ROD_HOME);
  return stand;
}

export function createFishing({ player, fish, hut, input, riding }) {
  const group = new THREE.Group();

  const { rod, tip: rodTip } = buildRod();
  group.add(buildRodStand());
  rod.position.set(ROD_HOME.x, ROD_HOME.y + 0.8, ROD_HOME.z);
  // 架在木托上，杆头朝水面斜出去一点
  rod.rotation.set(-0.13, 0.55, 0.06);
  group.add(rod);

  const bobber = new THREE.Group();
  const float = new THREE.Mesh(
    new THREE.SphereGeometry(0.062, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xd2453a, roughness: 0.45, flatShading: true }),
  );
  float.scale.y = 1.35;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xf3efe2, roughness: 0.6, flatShading: true }),
  );
  cap.position.y = 0.1;
  bobber.add(float, cap);
  bobber.visible = false;
  group.add(bobber);

  const LINE_SEGMENTS = 12;
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array((LINE_SEGMENTS + 1) * 3), 3),
  );
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({
      color: 0xf5f7f2,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  // 顶点每帧重写，包围盒留在创建时的位置会整条线被裁掉
  line.frustumCulled = false;
  line.visible = false;
  group.add(line);

  let carrying = false;
  // home：杆架在溪边石墩 · held：拿在手上没下杆 · cast：钩在水里等口
  // bite：咬钩收线 · landed：起鱼动画
  let state = "home";
  let hook = null;
  let castPoint = null;
  let charge = 0;
  let tension = 0;
  let waitTime = 0;
  let fightTime = 0;
  let lastClickAt = -1;
  let landTime = 0;
  let runOffset = 0;
  let toast = null;
  // 钩入水后锁移动，收杆才解开
  let movementLocked = false;
  let nagged = false;

  const _tip = new THREE.Vector3();
  const _mid = new THREE.Vector3();

  function say(text, seconds = 2.6) {
    toast = { text, t: seconds };
  }

  function depthAt(x, z) {
    return WATER_LEVEL - getGroundHeight(x, z);
  }

  function nearHome(p) {
    return Math.hypot(p.x - ROD_HOME.x, p.z - ROD_HOME.z) < PICK_RADIUS;
  }

  // 前沿着视线左右扫，取最近的一个够深的点：溪岸弯弯曲曲，
  // 正前方往往是岸坡，偏一点才有水。
  function findCastPoint(p, facing) {
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    for (let d = CAST_START; d <= CAST_REACH; d += CAST_STEP) {
      for (let i = 0; i < CAST_ARC.length; i += 1) {
        const a = CAST_ARC[i];
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const x = p.x + (fx * ca + fz * sa) * d;
        const z = p.z + (-fx * sa + fz * ca) * d;
        if (depthAt(x, z) < CAST_MIN_DEPTH) continue;
        if (Math.abs(z - getStreamCenterZ(x)) > CAST_MAX_OFF_CENTER) continue;
        if (hut.isInside(x, z)) continue;
        return { x, y: WATER_LEVEL, z };
      }
    }
    return null;
  }

  // 手持时挂到右小臂上：走路摆臂、跳起抬臂，竿头和红布都跟着手走
  function attachRod() {
    if (carrying) {
      player.character.elbowRight.add(rod);
      // 竿尾抵在掌心，杆身顺着屈起的小臂朝前上方伸出去
      rod.position.set(0, -0.3, 0.03);
      rod.rotation.set(ROD_POSE.held, 0, 0.08);
    } else {
      group.add(rod);
      rod.position.set(ROD_HOME.x, ROD_HOME.y + 0.8, ROD_HOME.z);
      rod.rotation.set(-0.13, 0.55, 0.06);
    }
  }

  function dropLine() {
    bobber.visible = false;
    line.visible = false;
    fish.releaseHook();
    fish.clearLure();
    hook = null;
  }

  // 杆身按状态缓动到目标角度：等口时斜指水面，咬钩后压得更低并跟着抖
  function poseRod(dt, elapsed) {
    if (!carrying) return;
    let x = ROD_POSE.held;
    let z = 0.08;
    if (state === "cast") {
      x = ROD_POSE.cast;
      z = 0.04;
    } else if (state === "bite") {
      x = ROD_POSE.bite + Math.sin(elapsed * 12) * 0.05;
      z = 0.04;
    } else if (state === "landed") {
      x = ROD_POSE.landed;
      z = 0.16;
    }
    rod.rotation.x = THREE.MathUtils.damp(rod.rotation.x, x, 9, dt);
    rod.rotation.z = THREE.MathUtils.damp(rod.rotation.z, z, 9, dt);
  }

  function pickUp() {
    carrying = true;
    state = "held";
    player.setHandProp(true);
    attachRod();
    say("拿上鱼竿，往溪边找个深水点下杆");
  }

  function putBack() {
    dropLine();
    carrying = false;
    state = "home";
    player.setHandProp(false);
    attachRod();
    say("鱼竿架回溪边的石墩了");
  }

  function castLine() {
    if (!castPoint) {
      say("这里够不着水，往溪边走走再按 R");
      return;
    }
    hook = { ...castPoint };
    runOffset = 0;
    nagged = false;
    state = "cast";
    waitTime = 0;
    charge = 0;
    tension = 0;
    lastClickAt = -1;
    bobber.visible = true;
    line.visible = true;
    fish.setLure(hook.x, hook.z);
  }

  function retrieve(message) {
    dropLine();
    state = "held";
    if (message) say(message);
  }

  function hookBite() {
    state = "bite";
    charge = 0.12;
    tension = 0.1;
    fightTime = 0;
    lastClickAt = -1;
    say("鱼咬钩了！连点鼠标左键收线", 3.2);
  }

  function breakLine(message) {
    dropLine();
    state = "held";
    say(message);
  }

  function landFish() {
    state = "landed";
    landTime = 0;
    // 起鱼的瞬间浮漂就不见了，只剩鱼线牵着鱼往岸上甩
    bobber.visible = false;
    say("成功钓起一条鱼！", 3.2);
  }

  // 蓄力到 0.68 就够把鱼提出水，但一口气点太猛张力过 1 线就断
  function stepFight(dt, elapsed) {
    fightTime += dt;

    if (input.consumeReel()) {
      const gap = lastClickAt < 0 ? 1 : elapsed - lastClickAt;
      lastClickAt = elapsed;
      charge += CHARGE_PER_CLICK;
      tension += TENSION_PER_CLICK + (gap < SPAM_INTERVAL ? TENSION_SPAM : 0);
    }

    charge = Math.max(0, charge - CHARGE_DECAY * dt);
    tension = Math.max(0, tension - TENSION_DECAY * dt);

    if (tension >= TENSION_SNAP) {
      breakLine("点得太猛，线绷断了");
      return;
    }

    // 鱼拖着钩子横着跑，人站太远线就被扯到头
    runOffset = Math.sin(elapsed * 0.9 + fightTime) * FISH_RUN;
    const hx = hook.x + runOffset;
    const hz = hook.z - runOffset * 0.5;
    fish.moveHooked(hx, WATER_LEVEL - 0.05, hz);
    const p = player.group.position;
    if (Math.hypot(p.x - hx, p.z - hz) > LINE_LIMIT) {
      breakLine("鱼把线扯到尽头，断了");
      return;
    }

    if (charge >= CATCH_CHARGE) {
      landFish();
      return;
    }
    if (charge <= 0.02 && fightTime > 1.4) {
      breakLine("收线太慢，鱼脱钩跑了");
    }
  }

  function stepLanded(dt) {
    landTime += dt;
    const t = Math.min(landTime / LAND_TIME, 1);
    const p = player.group.position;
    const fx = Math.sin(player.group.rotation.y);
    const fz = Math.cos(player.group.rotation.y);
    const from = { x: hook.x + runOffset, z: hook.z - runOffset * 0.5 };
    const to = { x: p.x + fx * 1.1, z: p.z + fz * 1.1 };
    const lift = Math.sin(Math.PI * t) * 1.15;
    fish.moveHooked(
      THREE.MathUtils.lerp(from.x, to.x, t),
      WATER_LEVEL - 0.05 + lift,
      THREE.MathUtils.lerp(from.z, to.z, t),
    );
    if (t >= 1) {
      dropLine();
      state = "held";
    }
  }

  function poseLine(elapsed) {
    if (!hook) return;
    const dipping = state === "bite" ? 0.1 + Math.abs(Math.sin(elapsed * 7)) * 0.06 : 0;
    const bob = Math.sin(elapsed * 2.2) * 0.02;
    const hx = hook.x + (state === "bite" ? runOffset : 0);
    const hz = hook.z + (state === "bite" ? -runOffset * 0.5 : 0);
    bobber.position.set(hx, WATER_LEVEL + 0.02 + bob - dipping, hz);

    rodTip.getWorldPosition(_tip);
    const sag = state === "bite" ? 0.05 : 0.2;
    _mid.set((_tip.x + hx) * 0.5, Math.min(_tip.y, WATER_LEVEL) - sag, (_tip.z + hz) * 0.5);

    const attr = lineGeometry.getAttribute("position");
    for (let i = 0; i <= LINE_SEGMENTS; i += 1) {
      const t = i / LINE_SEGMENTS;
      const it = 1 - t;
      // 二次贝塞尔：杆头 → 下垂的中点 → 浮漂
      const x = it * it * _tip.x + 2 * it * t * _mid.x + t * t * hx;
      const y = it * it * _tip.y + 2 * it * t * _mid.y + t * t * (WATER_LEVEL + 0.02);
      const z = it * it * _tip.z + 2 * it * t * _mid.z + t * t * hz;
      attr.setXYZ(i, x, y, z);
    }
    attr.needsUpdate = true;
  }

  function update(delta, elapsed) {
    if (toast) {
      toast.t -= delta;
      if (toast.t <= 0) toast = null;
    }

    const p = player.group.position;
    const blocked = riding.active || player.sitting || player.sleeping;
    castPoint = carrying && state === "held" && !blocked ? findCastPoint(p, player.group.rotation.y) : null;

    // 钩在水里就是"钓鱼状态"：方向键和跳跃全部站死，想挪窝先收杆
    const shouldLock = state === "cast" || state === "bite" || state === "landed";
    if (shouldLock !== movementLocked) {
      movementLocked = shouldLock;
      player.setMovementLock(shouldLock);
    }
    if (shouldLock && !nagged && (input.forward || input.backward || input.left || input.right)) {
      nagged = true;
      say("钓鱼时站住别动，按 R 收杆再走", 2.2);
    }

    if (blocked && (state === "cast" || state === "bite")) {
      retrieve("骑乘中顾不上钓鱼，鱼竿收回来了");
    }

    if (!blocked && input.consumeCast()) {
      if (state === "held") castLine();
      else if (state === "cast") retrieve("提起鱼竿，什么也没钓到");
    }

    if (state === "cast") {
      waitTime += delta;
      if (fish.nearestLureGap() < BITE_GAP && fish.hookNearest(BITE_GAP + 0.5)) {
        hookBite();
      } else if (waitTime > BITE_TIMEOUT) {
        retrieve("半天没鱼咬钩，收杆换个位置");
      }
    } else if (state === "bite") {
      stepFight(delta, elapsed);
    } else if (state === "landed") {
      stepLanded(delta);
    }

    poseRod(delta, elapsed);
    poseLine(elapsed);
    updateBar();
  }

  // E 只处理鱼竿本身：溪边拾取、溪边放回、水中收线。
  // 拿着竿站在别处时返回 false，让屋里睡觉/坐下的交互照常生效。
  function handleInteract() {
    if (state === "bite" || state === "landed") return true;
    const p = player.group.position;
    if (!carrying) {
      if (!nearHome(p)) return false;
      pickUp();
      return true;
    }
    if (state === "cast") {
      retrieve("提起鱼竿，什么也没钓到");
      return true;
    }
    if (nearHome(p)) {
      putBack();
      return true;
    }
    return false;
  }

  function prompt() {
    if (state === "bite") return "鱼咬钩了！连点鼠标左键收线（点太慢蓄力会掉）";
    if (state === "landed") return "鱼上岸了";
    if (state === "cast") return "鱼钩已入水，等鱼咬钩（站定，按 R 收杆）";
    if (carrying) {
      if (nearHome(player.group.position)) return "按 E 把鱼竿架回石墩";
      return castPoint ? "按 R 落杆钓鱼" : "往前找段深水，按 R 落杆";
    }
    return nearHome(player.group.position) ? "按 E 拾起鱼竿" : "";
  }

  const reelEl = document.querySelector("#reel");
  const reelFillEl = reelEl ? reelEl.querySelector(".reel-fill") : null;
  const reelTensionEl = reelEl ? reelEl.querySelector(".reel-tension") : null;

  function updateBar() {
    if (!reelEl) return;
    const fighting = state === "bite";
    reelEl.classList.toggle("is-visible", fighting);
    if (fighting) {
      if (reelFillEl) reelFillEl.style.transform = `scaleX(${Math.min(charge, 1).toFixed(3)})`;
      if (reelTensionEl) {
        reelTensionEl.style.transform = `scaleX(${Math.min(tension, 1).toFixed(3)})`;
      }
      reelEl.classList.toggle("is-tight", tension > 0.7);
    }
  }

  return {
    group,
    update,
    handleInteract,
    prompt,
    get state() {
      return state;
    },
    get carrying() {
      return carrying;
    },
    get charge() {
      return charge;
    },
    get tension() {
      return tension;
    },
    get toast() {
      return toast ? toast.text : "";
    },
    get hook() {
      return hook;
    },
    get castPoint() {
      return castPoint;
    },
  };
}
