import * as THREE from "three";

function createSunTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);

  gradient.addColorStop(0, "rgba(255, 255, 250, 1)");
  gradient.addColorStop(0.3, "rgba(255, 249, 224, 1)");
  gradient.addColorStop(0.42, "rgba(255, 225, 168, 0.96)");
  gradient.addColorStop(0.5, "rgba(255, 187, 108, 0.7)");
  gradient.addColorStop(0.66, "rgba(255, 141, 72, 0.2)");
  gradient.addColorStop(1, "rgba(255, 110, 54, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);

  gradient.addColorStop(0, "rgba(255, 226, 178, 0.62)");
  gradient.addColorStop(0.18, "rgba(255, 186, 112, 0.38)");
  gradient.addColorStop(0.45, "rgba(255, 132, 72, 0.13)");
  gradient.addColorStop(0.72, "rgba(255, 104, 60, 0.035)");
  gradient.addColorStop(1, "rgba(255, 90, 50, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSunset(direction) {
  const group = new THREE.Group();
  const position = direction.clone().normalize().multiplyScalar(800);
  group.position.copy(position);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.95,
      toneMapped: false,
      fog: false,
    }),
  );
  const core = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createSunTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 1,
      toneMapped: false,
      fog: false,
    }),
  );

  glow.scale.set(360, 250, 1);
  glow.renderOrder = 4;
  core.scale.set(82, 82, 1);
  core.renderOrder = 5;
  group.add(glow, core);

  return group;
}
