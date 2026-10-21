import * as THREE from "three";
import { mulberry32 } from "../utils/random.js";
import {
  HILL_CENTER_Z,
  getStreamCenterZ,
  getTerrainHeight,
} from "./terrain.js";

function createBladeGeometry() {
  const width = 0.05;
  const positions = new Float32Array([
    -width,
    0,
    0,
    width,
    0,
    0,
    -width * 0.72,
    0.46,
    0.025,
    width * 0.72,
    0.46,
    0.025,
    -width * 0.3,
    0.78,
    0.055,
    width * 0.3,
    0.78,
    0.055,
    0,
    1,
    0.075,
  ]);
  const colors = new Float32Array(positions.length);
  for (let i = 0; i < positions.length / 3; i += 1) {
    const shade = 0.56 + positions[i * 3 + 1] * 0.54;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGrass() {
  const count = 120000;
  const radius = 43;
  const geometry = createBladeGeometry();
  const timeUniform = { value: 0 };
  const playerPositionUniform = { value: new THREE.Vector3(0, -100, 0) };
  const playerRadiusUniform = { value: 1 };
  const playerPushUniform = { value: 0.55 };

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
    dithering: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.uniforms.uPlayerPosition = playerPositionUniform;
    shader.uniforms.uPlayerRadius = playerRadiusUniform;
    shader.uniforms.uPlayerPush = playerPushUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `
          #include <common>
          uniform float uTime;
          uniform vec3 uPlayerPosition;
          uniform float uPlayerRadius;
          uniform float uPlayerPush;
        `,
      )
      .replace(
        "#include <begin_vertex>",
        `
          #include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 instanceOrigin = instanceMatrix[3].xyz;
            float bend = clamp(position.y, 0.0, 1.0);
            bend *= bend;
            float phase = instanceOrigin.x * 0.43 + instanceOrigin.z * 0.31;
            float sway = sin(uTime * 1.35 + phase) * 0.13
                       + sin(uTime * 2.65 + phase * 1.7) * 0.045;
            transformed.x += sway * bend;
            transformed.z += sway * 0.36 * bend;

            vec2 toPlayer = instanceOrigin.xz - uPlayerPosition.xz;
            float playerDistance = length(toPlayer);
            float playerInfluence = 1.0 - smoothstep(
              0.12,
              uPlayerRadius,
              playerDistance
            );
            playerInfluence *= playerInfluence;
            float heightInfluence = 1.0 - smoothstep(
              0.55,
              1.5,
              uPlayerPosition.y - instanceOrigin.y
            );
            float push = playerInfluence * heightInfluence * uPlayerPush * bend;
            vec2 away = toPlayer / max(playerDistance, 0.0001);
            vec2 localAway = vec2(
              dot(away, normalize(instanceMatrix[0].xz)),
              dot(away, normalize(instanceMatrix[2].xz))
            );
            transformed.x += localAway.x * push;
            transformed.z += localAway.y * push;
          #endif
        `,
      );
  };

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x5eeda11);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let placed = 0;

  while (placed < count) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const x = Math.cos(angle) * distance;
    const z = HILL_CENTER_Z + Math.sin(angle) * distance;

    if (Math.abs(z - getStreamCenterZ(x)) < 7) {
      continue;
    }

    const y = getTerrainHeight(x, z);
    const height = 0.46 + random() * 0.58;
    const spread = 0.82 + random() * 0.46;

    dummy.position.set(x, y - 0.015, z);
    dummy.rotation.set(
      (random() - 0.5) * 0.16,
      random() * Math.PI * 2,
      (random() - 0.5) * 0.16,
    );
    dummy.scale.set(spread, height, spread);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);

    color.setHSL(
      0.225 + random() * 0.065,
      0.43 + random() * 0.19,
      0.27 + random() * 0.14,
    );
    mesh.setColorAt(placed, color);
    placed += 1;
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;

  return {
    mesh,
    update(time, position) {
      timeUniform.value = time;
      playerPositionUniform.value.copy(position);
    },
  };
}
