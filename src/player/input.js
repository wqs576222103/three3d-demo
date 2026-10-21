const MOVEMENT_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "KeyC",
]);

export function createInput() {
  const held = new Set();
  let jumpQueued = false;
  let crouched = false;

  const onKeyDown = (event) => {
    if (MOVEMENT_CODES.has(event.code)) {
      event.preventDefault();
    }
    held.add(event.code);
    if (event.code === "Space" && !event.repeat) {
      jumpQueued = true;
    }
    if (
      !event.repeat &&
      (event.code === "ControlLeft" ||
        event.code === "ControlRight" ||
        event.code === "KeyC")
    ) {
      crouched = !crouched;
    }
  };

  const onKeyUp = (event) => {
    held.delete(event.code);
  };

  const onBlur = () => {
    held.clear();
    jumpQueued = false;
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

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
      return held.has("ShiftLeft") || held.has("ShiftRight");
    },
    get crouch() {
      return crouched;
    },
    consumeJump() {
      const queued = jumpQueued;
      jumpQueued = false;
      return queued;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
