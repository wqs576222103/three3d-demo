import * as THREE from "three";
import { clamp01, fbm, smooth01 } from "../utils/random.js";

function createMountainRange(options) {
  const {
    width,
    depth,
    centerZ,
    segmentsX,
    segmentsZ,
    peaks,
    seed,
    snowline,
    baseHeight,
    rockDark,
    rockLight,
    snowColor,
    baseColor,
  } = options;

  const positions = [];
  const indices = [];

  for (let iz = 0; iz <= segmentsZ; iz += 1) {
    const v = iz / segmentsZ;
    const z = centerZ + (v - 0.5) * depth;
    for (let ix = 0; ix <= segmentsX; ix += 1) {
      const u = ix / segmentsX;
      const x = (u - 0.5) * width;
      let height = 0;

      peaks.forEach((peak) => {
        const dx = (x - peak.x) / peak.radiusX;
        const dz = (z - (centerZ + peak.offsetZ)) / peak.radiusZ;
        const falloff = Math.exp(-(dx * dx + dz * dz) * 1.18);
        height = Math.max(height, peak.height * falloff);
      });

      const mainNoise = fbm(x * 0.021 + seed, z * 0.027 - seed, 4);
      const detailNoise = fbm(x * 0.083 - seed, z * 0.074 + seed * 0.6, 3);
      height *= 0.78 + mainNoise * 0.5;
      height += (detailNoise - 0.5) * 12 * smooth01(height / 18);
      height = Math.max(0, height);

      positions.push(x, height, z);
    }
  }

  for (let iz = 0; iz < segmentsZ; iz += 1) {
    for (let ix = 0; ix < segmentsX; ix += 1) {
      const a = iz * (segmentsX + 1) + ix;
      const b = a + 1;
      const c = a + segmentsX + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const normals = geometry.getAttribute("normal");
  const colors = new Float32Array(positions.length);
  const dark = new THREE.Color(rockDark);
  const light = new THREE.Color(rockLight);
  const snow = new THREE.Color(snowColor);
  const base = new THREE.Color(baseColor);
  const color = new THREE.Color();

  for (let i = 0; i < positions.length / 3; i += 1) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const normalY = normals.getY(i);
    const patch = fbm(x * 0.048 + 9, z * 0.05 - 3, 3);
    const snowAmount =
      smooth01((y - snowline + (patch - 0.5) * 15) / 19) *
      smooth01((normalY - 0.24) / 0.38);

    color.copy(dark).lerp(light, clamp01(patch * 0.85 + 0.15));
    color.lerp(snow, snowAmount);
    const baseAmount = 1 - smooth01((y - baseHeight) / 12);
    color.lerp(base, baseAmount * 0.72);

    const variation = 0.94 + patch * 0.12;
    colors[i * 3] = color.r * variation;
    colors[i * 3 + 1] = color.g * variation;
    colors[i * 3 + 2] = color.b * variation;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    dithering: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function createMountains() {
  const group = new THREE.Group();

  group.add(
    createMountainRange({
      width: 450,
      depth: 140,
      centerZ: -154,
      segmentsX: 180,
      segmentsZ: 56,
      seed: 3.7,
      snowline: 34,
      baseHeight: 4,
      rockDark: 0x525b62,
      rockLight: 0x828b90,
      snowColor: 0xf2f6fa,
      baseColor: 0x3f563f,
      peaks: [
        { x: -178, height: 47, radiusX: 84, radiusZ: 57, offsetZ: -9 },
        { x: -101, height: 64, radiusX: 68, radiusZ: 51, offsetZ: 5 },
        { x: -27, height: 79, radiusX: 62, radiusZ: 57, offsetZ: -11 },
        { x: 47, height: 57, radiusX: 71, radiusZ: 48, offsetZ: 8 },
        { x: 128, height: 69, radiusX: 71, radiusZ: 57, offsetZ: -2 },
        { x: 199, height: 48, radiusX: 83, radiusZ: 48, offsetZ: 10 },
      ],
    }),
  );

  group.add(
    createMountainRange({
      width: 760,
      depth: 200,
      centerZ: -292,
      segmentsX: 180,
      segmentsZ: 48,
      seed: 11.3,
      snowline: 31,
      baseHeight: 8,
      rockDark: 0x7890a2,
      rockLight: 0xa3b4c0,
      snowColor: 0xf6faff,
      baseColor: 0x647f8e,
      peaks: [
        { x: -310, height: 69, radiusX: 125, radiusZ: 72, offsetZ: -12 },
        { x: -198, height: 88, radiusX: 100, radiusZ: 72, offsetZ: 8 },
        { x: -92, height: 74, radiusX: 110, radiusZ: 68, offsetZ: -9 },
        { x: 5, height: 98, radiusX: 98, radiusZ: 75, offsetZ: 4 },
        { x: 112, height: 81, radiusX: 108, radiusZ: 70, offsetZ: -7 },
        { x: 218, height: 92, radiusX: 104, radiusZ: 73, offsetZ: 9 },
        { x: 328, height: 65, radiusX: 120, radiusZ: 70, offsetZ: -4 },
      ],
    }),
  );

  return group;
}
