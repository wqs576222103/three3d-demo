export function createModal({ element, trigger }) {
  const closeControls = element.querySelectorAll("[data-modal-close]");
  let isOpen = false;

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    element.classList.add("is-open");
    document.body.classList.add("is-modal-open");
    element.querySelector("[data-modal-close]")?.focus();
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    element.classList.remove("is-open");
    document.body.classList.remove("is-modal-open");
    trigger?.focus();
  };

  const onTriggerClick = () => open();
  const onCloseClick = () => close();
  const onKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) close();
  };

  trigger?.addEventListener("click", onTriggerClick);
  closeControls.forEach((control) =>
    control.addEventListener("click", onCloseClick),
  );
  window.addEventListener("keydown", onKeyDown);

  return {
    open,
    close,
    get isOpen() {
      return isOpen;
    },
    dispose() {
      trigger?.removeEventListener("click", onTriggerClick);
      closeControls.forEach((control) =>
        control.removeEventListener("click", onCloseClick),
      );
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
