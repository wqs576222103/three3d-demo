import * as THREE from "three";

function distXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function createInteraction({
  player,
  camera,
  controls,
  input,
  hut,
  riding,
  fishing,
  promptEl,
  overlayEl,
}) {
  const overlayTextEl = overlayEl ? overlayEl.querySelector("span") : null;

  const outsideLimits = {
    min: controls.minDistance,
    max: controls.maxDistance,
    minPolar: controls.minPolarAngle,
    maxPolar: controls.maxPolarAngle,
  };

  let mode = "outside";
  let sleeping = false;
  let sitting = false;
  let fade = null;
  let toast = null;
  let currentPrompt = null;

  function setPrompt(text) {
    if (text === currentPrompt || !promptEl) return;
    currentPrompt = text;
    promptEl.textContent = text;
    promptEl.classList.toggle("is-visible", Boolean(text));
  }

  function setOverlay(opacity, text) {
    if (!overlayEl) return;
    overlayEl.style.opacity = String(opacity);
    overlayEl.style.visibility = opacity > 0.001 ? "visible" : "hidden";
    if (overlayTextEl && text !== undefined) overlayTextEl.textContent = text;
  }

  // 屋内镜头的可用距离区间：postCamera 每帧按墙距收紧，避免与
  // OrbitControls 的最小距离互相拉扯（表现为靠墙时镜头抖动感）。
  let camMinDistance = outsideLimits.min;
  let camMaxDistance = outsideLimits.max;

  function setInsideCamera(on) {
    if (on) {
      camMinDistance = 0.6;
      camMaxDistance = 4.5;
      controls.minPolarAngle = 0.6;
      controls.maxPolarAngle = Math.PI * 0.49;
    } else {
      camMinDistance = outsideLimits.min;
      camMaxDistance = outsideLimits.max;
      controls.minPolarAngle = outsideLimits.minPolar;
      controls.maxPolarAngle = outsideLimits.maxPolar;
    }
    controls.minDistance = camMinDistance;
    controls.maxDistance = camMaxDistance;
  }

  // 坐着或躺着时移动已锁定，不用顾虑"前进方向反了"，
  // 放开俯仰、距离与偏航，镜头能绕着人自由转一圈。
  function setRestCamera(on) {
    controls.minPolarAngle = on ? 0.22 : 0.6;
    controls.maxPolarAngle = on ? Math.PI * 0.62 : Math.PI * 0.49;
    camMinDistance = on ? 0.35 : 0.6;
    camMaxDistance = on ? 5.6 : 4.5;
  }

  const _target = new THREE.Vector3();

  function frameOutsideCamera() {
    const p = player.group.position;
    _target.set(p.x, p.y + player.cameraAnchor, p.z);
    controls.target.copy(_target);
    camera.position.copy(_target).add(new THREE.Vector3(0, 2.2, 6.5));
  }

  // 走进门时保持角色的位置与朝向，只把高度抬到地板；不做任何方向修正
  function stepInside() {
    const p = player.group.position;
    player.teleport(p.x, hut.floorY, p.z, player.group.rotation.y);
  }

  function sitDown() {
    const s = hut.sitPoint;
    player.setSitting(false);
    player.teleport(s.x, s.y, s.z, s.facing);
    player.setSitting(true);
    sitting = true;
    setRestCamera(true);
  }

  function standUp() {
    player.setSitting(false);
    sitting = false;
    setRestCamera(false);
    const p = player.group.position;
    player.teleport(p.x, p.y, p.z, player.group.rotation.y);
  }

  function exitHut() {
    const e = hut.exitPoint;
    player.teleport(e.x, e.y, e.z, Math.PI);
    frameOutsideCamera();
  }

  function beginFade(options = {}) {
    fade = {
      t: 0,
      out: 0.34,
      hold: 0,
      inn: 0.42,
      message: "",
      mid: null,
      onDone: null,
      midDone: false,
      ...options,
    };
  }

  function updateFade(delta) {
    if (!fade) return;
    fade.t += delta;
    const { out, hold, inn } = fade;
    if (!fade.midDone && fade.t >= out) {
      fade.midDone = true;
      if (fade.mid) fade.mid();
    }
    let opacity;
    if (fade.t < out) opacity = fade.t / out;
    else if (fade.t < out + hold) opacity = 1;
    else if (fade.t < out + hold + inn)
      opacity = 1 - (fade.t - out - hold) / inn;
    else opacity = 0;
    setOverlay(opacity, fade.message);
    if (fade.t >= out + hold + inn) {
      const done = fade.onDone;
      fade = null;
      // 睡觉状态保持一层暗幕，直到按 E 起床
      setOverlay(sleeping ? 0.6 : 0, sleeping ? "睡眠中…" : "");
      if (done) done();
    }
  }

  // 上床睡觉：锁定移动，只有再按 E 才能起床
  function startSleep() {
    const bed = hut.bedLiePoint;
    player.setSitting(false);
    sitting = false;
    player.teleport(bed.x, bed.y, bed.z, bed.facing);
    player.setSleeping(true);
    sleeping = true;
    setRestCamera(true);
    beginFade({
      out: 0.45,
      hold: 1.2,
      inn: 0.6,
      message: "睡眠中…",
    });
  }

  function wakeUp() {
    player.setSleeping(false);
    sleeping = false;
    setRestCamera(false);
    const p = player.group.position;
    player.teleport(p.x, hut.floorY, p.z, player.group.rotation.y);
    setOverlay(0, "");

    toast = { text: "睡醒了，伸个懒腰", t: 2.2 };
  }

  function handleInteract(inside) {
    const p = player.group.position;
    if (sleeping) {
      wakeUp();
      return;
    }
    if (sitting) {
      standUp();
      return;
    }
    if (riding.active) {
      beginFade({ out: 0.14, hold: 0, inn: 0.24, mid: riding.dismount });
      return;
    }
    // 鱼竿的拾取点在溪边石墩，比骑乘判定更具体，先问它
    if (fishing.handleInteract()) return;
    const mount = riding.findMount(p);
    if (mount) {
      beginFade({
        out: 0.16,
        hold: 0,
        inn: 0.26,
        mid: () => riding.mountOn(mount),
      });
      return;
    }
    if (!inside) return;
    if (hut.isNearBed(p.x, p.z)) {
      startSleep();
    } else if (distXZ(p, hut.stoolAnchor) < 1.25) {
      sitDown();
    } else if (distXZ(p, hut.doorInside) < 1.7) {
      beginFade({ out: 0.28, hold: 0.06, inn: 0.42, mid: exitHut });
    }
  }

  function update(delta) {
    updateFade(delta);
    if (toast) {
      toast.t -= delta;
      if (toast.t <= 0) toast = null;
    }

    const px = player.group.position.x;
    const pz = player.group.position.z;
    // 骑在牲口上时不进屋接管镜头：马头探进门框就会把相机压进屋里
    const inside = !riding.active && hut.isInside(px, pz);

    if (!fade && input.consumeInteract()) {
      handleInteract(inside);
    }

    const nowInside = inside;
    if (nowInside !== (mode === "inside")) {
      mode = nowInside ? "inside" : "outside";
      setInsideCamera(nowInside);
      if (nowInside) {
        if (!fade) stepInside();
      } else if (!fade) {
        frameOutsideCamera();
      }
    }

    let shown = "";
    if (toast) {
      shown = toast.text;
    } else if (fishing.toast) {
      shown = fishing.toast;
    } else if (sleeping) {
      shown = fade ? "" : "睡眠中 · 按 E 起床";
    } else if (sitting) {
      shown = "按 E 起身";
    } else if (riding.active) {
      shown = fade
        ? ""
        : `骑乘中 · WASD 驾驭${riding.canJump ? " · 空格 跳" : ""} · 按 E 从${riding.label}上下来`;
    } else if (!fade) {
      const p = player.group.position;
      const mount = riding.findMount(p);
      const fishingPrompt = fishing.prompt();
      // 下杆/收线中的提示压过骑乘：手里有竿的时候先顾鱼
      const busy =
        fishing.state === "bite" ||
        fishing.state === "cast" ||
        fishing.state === "aim";
      if (fishingPrompt && (!mount || busy)) shown = fishingPrompt;
      else if (mount) {
        shown = `按 E 骑上${mount.label}${mount.hint ? ` · ${mount.hint}` : ""}`;
      } else if (mode === "inside") {
        if (hut.isNearBed(p.x, p.z)) shown = "按 E 睡觉";
        else if (distXZ(p, hut.stoolAnchor) < 1.25) shown = "按 E 坐下休息";
        else if (distXZ(p, hut.doorInside) < 1.7) shown = "按 E 走出茅草屋";
      }
    }
    setPrompt(shown);
  }

  const _off = new THREE.Vector3();
  const _sph = new THREE.Spherical();

  // 镜头偏航相对角色背向的最大偏离：鼠标可以自由环绕，
  // 但永远不会绕到角色前面导致前进方向感觉反了。
  const AZIMUTH_SLACK = 1.4;

  function wrapAngle(a) {
    let x = a;
    while (x > Math.PI) x -= Math.PI * 2;
    while (x < -Math.PI) x += Math.PI * 2;
    return x;
  }

  // 镜头可停留的空间：屋内 + 门洞走廊。沿射线逐段推进取并集，
  // 这样站在门口时镜头能退到门框里，而不是被北墙挤到角色身上。
  const _zones = [hut.cameraBounds, hut.doorCorridor];

  const inZone = (b, x, y, z) =>
    x >= b.minX &&
    x <= b.maxX &&
    y >= b.minY &&
    y <= b.maxY &&
    z >= b.minZ &&
    z <= b.maxZ;

  function freeDistanceAlong(dir, t) {
    if (!_zones.some((b) => inZone(b, t.x, t.y, t.z))) {
      // 目标点本身不在任何可停留空间（站在门框正中间时可能发生），
      // 这一帧先不做距离压缩，避免镜头被压进角色身体。
      return Infinity;
    }
    const step = 0.1;
    let dist = 0;
    for (let i = 0; i < 96; i += 1) {
      const next = dist + step;
      if (
        !_zones.some((b) =>
          inZone(b, t.x + dir.x * next, t.y + dir.y * next, t.z + dir.z * next),
        )
      ) {
        break;
      }
      dist = next;
    }
    return dist;
  }

  // 保留鼠标轨道结果，只做两件事：偏航限位 + 距离被屋墙压缩。
  function postCamera() {
    if (mode !== "inside") return;

    const p = player.group.position;
    // 躺下时把注视点压到躯干高度，绕床环绕才不会被顶到屋顶
    _target.set(p.x, p.y + (sleeping ? -0.1 : player.cameraAnchor), p.z);

    _off.copy(camera.position).sub(controls.target);
    if (_off.lengthSq() < 1e-4) {
      _off.set(0, 1.2, -2);
    }
    _sph.setFromVector3(_off);
    if (!Number.isFinite(_sph.theta)) _sph.theta = Math.PI;

    // 只有需要 WASD 操作时才限制偏航，坐下/睡觉中移动已锁定，可以任意环绕
    if (!sleeping && !sitting) {
      const back = player.group.rotation.y + Math.PI;
      const drift = wrapAngle(_sph.theta - back);
      if (Math.abs(drift) > AZIMUTH_SLACK) {
        _sph.theta = back + Math.sign(drift) * AZIMUTH_SLACK;
      }
    }
    _sph.makeSafe();
    const limit = Math.max(
      0.3,
      freeDistanceAlong(_off.setFromSpherical(_sph).normalize(), _target),
    );
    // 屋内空间不足时以墙为准，否则 OrbitControls 的最小距离会把镜头
    // 又顶回墙外，靠墙转动就成了一段一段的抖动。
    const minDistance = Math.min(camMinDistance, limit);
    controls.minDistance = minDistance;
    controls.maxDistance = Math.max(minDistance, camMaxDistance);
    _sph.radius = Math.max(minDistance, Math.min(_sph.radius, limit));

    controls.target.copy(_target);
    camera.position.setFromSpherical(_sph).add(_target);
    camera.lookAt(_target);
  }

  return {
    update,
    postCamera,
    get mode() {
      return mode;
    },
    get sleeping() {
      return sleeping;
    },
    get sitting() {
      return sitting;
    },
  };
}
