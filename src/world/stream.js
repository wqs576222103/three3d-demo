import * as THREE from "three";
import { mulberry32 } from "../utils/random.js";
import {
  WATER_LEVEL,
  getStreamCenterZ,
  getStreamSlope,
  getTerrainHeight,
} from "./terrain.js";

function createWater(sunDirection) {
  const steps = 320;
  const halfWidth = 4.7;
  const startX = -212;
  const endX = 212;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= steps; i += 1) {
    const x = startX + ((endX - startX) * i) / steps;
    const centerZ = getStreamCenterZ(x);
    const slope = getStreamSlope(x);
    const length = Math.hypot(1, slope);
    const normalX = -slope / length;
    const normalZ = 1 / length;
    const u = (x - startX) / 8;

    positions.push(
      x + normalX * halfWidth,
      WATER_LEVEL,
      centerZ + normalZ * halfWidth,
      x - normalX * halfWidth,
      WATER_LEVEL,
      centerZ - normalZ * halfWidth,
    );
    uvs.push(u, 0, u, 1);
  }

  for (let i = 0; i < steps; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x264e50) },
      uShallow: { value: new THREE.Color(0x5f9285) },
      uSky: { value: new THREE.Color(0xb8d3e4) },
      uFoam: { value: new THREE.Color(0xe9f2f3) },
      uSunColor: { value: new THREE.Color(0xffe8c4) },
      uSunDirection: { value: sunDirection },
      uFogColor: { value: new THREE.Color(0xb7cbda) },
      uFogNear: { value: 110 },
      uFogFar: { value: 690 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uFoam;
      uniform vec3 uSunColor;
      uniform vec3 uSunDirection;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;

      varying vec2 vUv;
      varying vec3 vWorldPosition;

      void main() {
        vec2 p = vWorldPosition.xz;
        float waveA = sin(p.x * 1.35 + uTime * 1.8 + sin(p.y * 0.9) * 1.2);
        float waveB = sin(p.y * 2.2 - uTime * 1.25 + p.x * 0.65);
        vec3 normal = normalize(vec3(
          waveA * 0.055 + waveB * 0.03,
          1.0,
          waveB * 0.06 - waveA * 0.025
        ));

        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 3.0);
        float ripple = waveA * 0.5 + 0.5;

        vec3 color = mix(uDeep, uShallow, 0.36 + ripple * 0.34);
        color = mix(color, uSky, fresnel * 0.68);

        vec3 halfDirection = normalize(viewDirection + uSunDirection);
        float sparkle = pow(max(dot(normal, halfDirection), 0.0), 120.0);
        color += uSunColor * sparkle * 0.85;

        float edge = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
        float foam = (1.0 - edge) * (0.48 + 0.22 * sin(p.x * 1.8 + uTime * 2.2));
        color = mix(color, uFoam, clamp(foam, 0.0, 0.7));

        float distanceToCamera = length(cameraPosition - vWorldPosition);
        float fogFactor = smoothstep(uFogNear, uFogFar, distanceToCamera);
        color = mix(color, uFogColor, fogFactor);

        float alpha = 0.7 + fresnel * 0.18 + foam * 0.08;
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1;
  return { mesh, material };
}

function createBanks() {
  const group = new THREE.Group();
  const random = mulberry32(0x51eea);
  const halfWidth = 4.7;

  const pebbleGeometry = new THREE.DodecahedronGeometry(1, 0);
  const pebbleMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.98,
    flatShading: true,
  });
  const pebbleCount = 320;
  const pebbles = new THREE.InstancedMesh(
    pebbleGeometry,
    pebbleMaterial,
    pebbleCount,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < pebbleCount; i += 1) {
    const x = -206 + random() * 412;
    const side = random() < 0.5 ? -1 : 1;
    const slope = getStreamSlope(x);
    const length = Math.hypot(1, slope);
    const normalX = -slope / length;
    const normalZ = 1 / length;
    const offset = (halfWidth + 0.15 + random() * 2.4) * side;
    const px = x + normalX * offset;
    const pz = getStreamCenterZ(x) + normalZ * offset;
    const scale = 0.09 + random() * 0.36;

    dummy.position.set(px, getTerrainHeight(px, pz) + scale * 0.2, pz);
    dummy.rotation.set(
      random() * Math.PI,
      random() * Math.PI,
      random() * Math.PI,
    );
    dummy.scale.set(
      scale * (0.9 + random() * 0.8),
      scale * (0.55 + random() * 0.3),
      scale * (0.9 + random() * 0.7),
    );
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);

    const shade = 0.42 + random() * 0.3;
    color.setRGB(shade, shade * 0.98, shade * 0.92);
    pebbles.setColorAt(i, color);
  }

  pebbles.instanceMatrix.needsUpdate = true;
  pebbles.instanceColor.needsUpdate = true;
  pebbles.computeBoundingSphere();
  pebbles.receiveShadow = true;
  group.add(pebbles);

  const reedGeometry = new THREE.ConeGeometry(0.05, 1, 3);
  const reedMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const reedCount = 520;
  const reeds = new THREE.InstancedMesh(reedGeometry, reedMaterial, reedCount);

  for (let i = 0; i < reedCount; i += 1) {
    const x = -205 + random() * 410;
    const side = random() < 0.5 ? -1 : 1;
    const slope = getStreamSlope(x);
    const length = Math.hypot(1, slope);
    const normalX = -slope / length;
    const normalZ = 1 / length;
    const offset = (halfWidth + 0.6 + random() * 2.2) * side;
    const px = x + normalX * offset;
    const pz = getStreamCenterZ(x) + normalZ * offset;
    const height = 0.4 + random() * 0.9;

    dummy.position.set(px, getTerrainHeight(px, pz) + height * 0.48, pz);
    dummy.rotation.set(
      (random() - 0.5) * 0.2,
      random() * Math.PI * 2,
      (random() - 0.5) * 0.2,
    );
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    reeds.setMatrixAt(i, dummy.matrix);

    color.setHSL(
      0.22 + random() * 0.06,
      0.35 + random() * 0.18,
      0.23 + random() * 0.12,
    );
    reeds.setColorAt(i, color);
  }

  reeds.instanceMatrix.needsUpdate = true;
  reeds.instanceColor.needsUpdate = true;
  reeds.computeBoundingSphere();
  group.add(reeds);

  return group;
}

export function createStream(sunDirection) {
  const group = new THREE.Group();
  const water = createWater(sunDirection);
  group.add(water.mesh);
  group.add(createBanks());

  return {
    group,
    update(time) {
      water.material.uniforms.uTime.value = time;
    },
  };
}
