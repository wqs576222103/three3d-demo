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

  function setInsideCamera(on) {
    if (on) {
      controls.minDistance = 1.2;
      controls.maxDistance = 3.4;
      controls.minPolarAngle = 0.6;
      controls.maxPolarAngle = Math.PI * 0.49;
    } else {
      controls.minDistance = outsideLimits.min;
      controls.maxDistance = outsideLimits.max;
      controls.minPolarAngle = outsideLimits.minPolar;
      controls.maxPolarAngle = outsideLimits.maxPolar;
    }
  }

  const _target = new THREE.Vector3();

  // 室内镜头放在角色身后，避免被夹到角色前面导致方向感反转
  function frameInsideCamera() {
    const p = player.group.position;
    _target.set(p.x, p.y + player.cameraAnchor, p.z);
    controls.target.copy(_target);
    const rotY = player.group.rotation.y;
    const behindX = -Math.sin(rotY);
    const behindZ = -Math.cos(rotY);
    camera.position.set(
      _target.x + behindX * 2.5,
      _target.y + 0.9,
      _target.z + behindZ * 2.5,
    );
  }

  function frameOutsideCamera() {
    const p = player.group.position;
    _target.set(p.x, p.y + player.cameraAnchor, p.z);
    controls.target.copy(_target);
    camera.position.copy(_target).add(new THREE.Vector3(0, 2.2, 6.5));
  }

  function enterHut() {
    const e = hut.enterPoint;
    player.teleport(e.x, e.y, e.z, 0);
    frameInsideCamera();
  }

  function stepInside() {
    const e = hut.enterPoint;
    player.teleport(e.x, e.y, e.z, player.group.rotation.y);
    frameInsideCamera();
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
    else if (fade.t < out + hold + inn) opacity = 1 - (fade.t - out - hold) / inn;
    else opacity = 0;
    setOverlay(opacity, fade.message);
    if (fade.t >= out + hold + inn) {
      const done = fade.onDone;
      fade = null;
      setOverlay(0, "");
      if (done) done();
    }
  }

  function startSleep() {
    sleeping = true;
    beginFade({
      out: 0.9,
      hold: 1.7,
      inn: 1.1,
      message: "睡眠中…",
      onDone: () => {
        sleeping = false;
        toast = { text: "睡了个好觉，精神焕发", t: 2.6 };
      },
    });
  }

  function handleInteract(inside) {
    const p = player.group.position;
    if (!inside && distXZ(p, hut.doorOutside) < 1.9) {
      beginFade({ out: 0.3, hold: 0.06, inn: 0.42, mid: enterHut });
      return;
    }
    if (inside) {
      if (distXZ(p, hut.bedAnchor) < 1.35) {
        startSleep();
      } else if (distXZ(p, hut.doorInside) < 1.7) {
        beginFade({ out: 0.28, hold: 0.06, inn: 0.42, mid: exitHut });
      }
    }
  }

  function update(delta) {
    updateFade(delta);
    if (toast) {
      toast.t -= delta;
      if (toast.t <= 0) toast = null;
    }

    const inside = hut.isInside(player.group.position.x, player.group.position.z);

    if (!fade && !sleeping && input.consumeInteract()) {
      handleInteract(inside);
    }

    const nowInside = hut.isInside(player.group.position.x, player.group.position.z);
    if (nowInside !== (mode === "inside")) {
      mode = nowInside ? "inside" : "outside";
      setInsideCamera(nowInside);
      if (fade) {
        if (!nowInside) frameOutsideCamera();
      } else if (nowInside) {
        beginFade({ out: 0.16, hold: 0, inn: 0.34, mid: stepInside });
      } else {
        frameOutsideCamera();
      }
    }

    let shown = "";
    if (toast) {
      shown = toast.text;
    } else if (!fade && !sleeping) {
      const p = player.group.position;
      if (mode === "inside") {
        if (distXZ(p, hut.bedAnchor) < 1.35) shown = "按 E 睡觉";
        else if (distXZ(p, hut.doorInside) < 1.7) shown = "按 E 走出茅草屋";
      } else if (distXZ(p, hut.doorOutside) < 1.9) {
        shown = "按 E 进入茅草屋";
      }
    }
    setPrompt(shown);
  }

  function postCamera() {
    if (mode !== "inside") return;
    const b = hut.bounds;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, b.minX, b.maxX);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, b.minZ, b.maxZ);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, b.minY, b.maxY);
    camera.lookAt(controls.target);
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
  };
}
