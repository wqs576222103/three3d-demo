import * as THREE from "three";
import { mulberry32 } from "../utils/random.js";
import { HILL_CENTER_Z, getTerrainHeight } from "./terrain.js";

export function createPollen() {
  const count = 320;
  const positions = new Float32Array(count * 3);
  const particles = [];
  const random = mulberry32(0x9a1);

  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = 3 + Math.sqrt(random()) * 34;
    const x = Math.cos(angle) * distance;
    const z = HILL_CENTER_Z + Math.sin(angle) * distance;
    const y = getTerrainHeight(x, z) + 0.7 + random() * 5.2;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    particles.push({
      baseX: x,
      baseY: y,
      baseZ: z,
      phase: random() * Math.PI * 2,
      speed: 0.3 + random() * 0.5,
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xfff0c2,
    size: 0.085,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);

  return {
    points,
    update(time) {
      const attribute = geometry.getAttribute("position");
      particles.forEach((particle, index) => {
        const drift = time * particle.speed + particle.phase;
        attribute.setX(index, particle.baseX + Math.sin(drift * 0.8) * 0.6);
        attribute.setY(index, particle.baseY + Math.sin(drift) * 0.45);
        attribute.setZ(index, particle.baseZ + Math.cos(drift * 0.65) * 0.55);
      });
      attribute.needsUpdate = true;
    },
  };
}
