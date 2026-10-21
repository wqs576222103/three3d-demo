import * as THREE from "three";
import { mulberry32 } from "../utils/random.js";

function createCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  for (let i = 0; i < 22; i += 1) {
    const x = 40 + Math.random() * 176;
    const y = 46 + Math.random() * 38;
    const radius = 22 + Math.random() * 34;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.52)");
    gradient.addColorStop(0.55, "rgba(255, 255, 255, 0.22)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createClouds() {
  const group = new THREE.Group();
  const texture = createCloudTexture();
  const random = mulberry32(0xc10d);
  const sprites = [];

  for (let i = 0; i < 8; i += 1) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.3 + random() * 0.28,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    const scale = 48 + random() * 70;
    sprite.position.set(
      (random() - 0.5) * 560,
      72 + random() * 72,
      -300 - random() * 160,
    );
    sprite.scale.set(scale, scale * 0.4, 1);
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.phase = random() * Math.PI * 2;
    sprites.push(sprite);
    group.add(sprite);
  }

  return {
    group,
    update(time) {
      sprites.forEach((sprite) => {
        sprite.position.x =
          sprite.userData.baseX +
          Math.sin(time * 0.012 + sprite.userData.phase) * 14;
      });
    },
  };
}
