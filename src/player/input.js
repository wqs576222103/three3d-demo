const SHIFT_DOUBLE_TAP_MS = 400;
// 按下到抬起之间指针挪过这么多像素就算拖拽（转镜头），不算点击
const CLICK_SLOP_PX = 6;

const MOVEMENT_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyE",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
]);

export function createInput() {
  const held = new Set();
  let jumpQueued = false;
  let interactQueued = false;
  let castQueued = false;
  let reelQueued = false;
  let prone = false;
  let runMode = false;
  let lastShiftTap = -Infinity;
  // 指针位置（屏幕归一化 -1~1）：钓鱼选落点时拿它在水面上投影
  let pointerX = 0;
  let pointerY = 0;
  // 左键"点击"（按下抬起没挪窝）：选完落点用它下杆
  let castClickQueued = false;
  let pressing = false;
  let dragged = false;
  let pressX = 0;
  let pressY = 0;

  const onKeyDown = (event) => {
    // 蒙层弹窗打开时屏蔽游戏操作键，人物不在弹窗背后乱动
    if (document.body.classList.contains("is-modal-open")) return;
    if (MOVEMENT_CODES.has(event.code)) {
      event.preventDefault();
    }
    held.add(event.code);
    if (event.code === "Space" && !event.repeat) {
      jumpQueued = true;
    }
    if (event.code === "KeyE" && !event.repeat) {
      interactQueued = true;
    }
    if (event.code === "KeyR" && !event.repeat) {
      castQueued = true;
    }
    if (
      !event.repeat &&
      (event.code === "ShiftLeft" || event.code === "ShiftRight")
    ) {
      const now = performance.now();
      if (now - lastShiftTap <= SHIFT_DOUBLE_TAP_MS) {
        runMode = !runMode;
        lastShiftTap = -Infinity;
      } else {
        lastShiftTap = now;
      }
    }
    if (
      !event.repeat &&
      (event.code === "ControlLeft" || event.code === "ControlRight")
    ) {
      prone = !prone;
    }
  };

  const onKeyUp = (event) => {
    held.delete(event.code);
  };

  // 收线点击只认画布上的左键，点 HUD 不算
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target?.tagName !== "CANVAS") return;
    reelQueued = true;
    pressing = true;
    dragged = false;
    pressX = event.clientX;
    pressY = event.clientY;
  };

  const onPointerMove = (event) => {
    pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    pointerY = -(event.clientY / window.innerHeight) * 2 + 1;
    if (
      pressing &&
      Math.hypot(event.clientX - pressX, event.clientY - pressY) > CLICK_SLOP_PX
    ) {
      dragged = true;
    }
  };

  // 抬起时没怎么挪过才算"点击"：钓鱼选点用它下杆，拖拽转镜头不会误落杆
  const onPointerUp = (event) => {
    if (event.button !== 0 || !pressing) return;
    pressing = false;
    if (dragged) return;
    castClickQueued = true;
  };

  const onBlur = () => {
    held.clear();
    jumpQueued = false;
    interactQueued = false;
    castQueued = false;
    reelQueued = false;
    castClickQueued = false;
    pressing = false;
    dragged = false;
    lastShiftTap = -Infinity;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  return {
    get forward() {
      return held.has("ArrowUp") || held.has("KeyW");
    },
    get backward() {
      return held.has("ArrowDown") || held.has("KeyS");
    },
    get left() {
      return held.has("ArrowLeft") || held.has("KeyA");
    },
    get right() {
      return held.has("ArrowRight") || held.has("KeyD");
    },
    get sprint() {
      return runMode || held.has("ShiftLeft") || held.has("ShiftRight");
    },
    get prone() {
      return prone;
    },
    get pointerX() {
      return pointerX;
    },
    get pointerY() {
      return pointerY;
    },
    consumeJump() {
      const queued = jumpQueued;
      jumpQueued = false;
      return queued;
    },
    consumeInteract() {
      const queued = interactQueued;
      interactQueued = false;
      return queued;
    },
    consumeCast() {
      const queued = castQueued;
      castQueued = false;
      return queued;
    },
    consumeCastClick() {
      const queued = castClickQueued;
      castClickQueued = false;
      return queued;
    },
    consumeReel() {
      const queued = reelQueued;
      reelQueued = false;
      return queued;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    },
  };
}
