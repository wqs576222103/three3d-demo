const SHIFT_DOUBLE_TAP_MS = 400;

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

  const onKeyDown = (event) => {
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
  };

  const onBlur = () => {
    held.clear();
    jumpQueued = false;
    interactQueued = false;
    castQueued = false;
    reelQueued = false;
    lastShiftTap = -Infinity;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("pointerdown", onPointerDown);

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
    },
  };
}
