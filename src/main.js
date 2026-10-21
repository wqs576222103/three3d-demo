import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const HILL_CENTER_Z = -6;
const HILL_RADIUS = 31;
const HILL_HEIGHT = 8.4;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth01 = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = smooth01(fx);
  const v = smooth01(fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x, y, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += noise2(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / total;
}

function getTerrainHeight(x, z) {
  const dx = x;
  const dz = z - HILL_CENTER_Z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const hillMask = smooth01(1 - distance / HILL_RADIUS);
  const hill = Math.pow(hillMask, 1.35) * HILL_HEIGHT;
  const rolling = (fbm(x * 0.034, z * 0.034, 4) - 0.5) * 2.1;
  const detail = (fbm(x * 0.17, z * 0.17, 2) - 0.5) * 0.22;
  const distantRise = Math.max(0, -z - 58) * 0.075;
  return hill + rolling + detail + distantRise - 0.45;
}

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.querySelector("#app").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb7cbda, 110, 690);

const camera = new THREE.PerspectiveCamera(
  46,
  window.innerWidth / window.innerHeight,
  0.1,
  1500,
);
camera.position.set(8, getTerrainHeight(8, 15) + 2.15, 15);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 9.2, HILL_CENTER_Z);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 7;
controls.maxDistance = 62;
controls.minPolarAngle = 0.42;
controls.maxPolarAngle = Math.PI * 0.49;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.7;
controls.update();

const sunDirection = new THREE.Vector3(-0.48, 0.72, 0.5).normalize();

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(850, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x3d72b0) },
      uHorizon: { value: new THREE.Color(0xd3e1e8) },
      uHaze: { value: new THREE.Color(0xf1e8d7) },
      uSunColor: { value: new THREE.Color(0xffdda1) },
      uSunDirection: { value: sunDirection },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uHaze;
      uniform vec3 uSunColor;
      uniform vec3 uSunDirection;

      void main() {
        vec3 direction = normalize(vWorldPosition - cameraPosition);
        float height = clamp(direction.y, -0.05, 1.0);
        float gradient = pow(smoothstep(-0.02, 0.68, height), 0.72);
        vec3 color = mix(uHorizon, uTop, gradient);
        float lowSky = 1.0 - smoothstep(0.0, 0.32, height);
        color = mix(color, uHaze, lowSky * 0.34);
        float sun = max(dot(direction, normalize(uSunDirection)), 0.0);
        color += uSunColor * pow(sun, 750.0) * 1.8;
        color += uSunColor * pow(sun, 14.0) * 0.13;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }),
);
sky.frustumCulled = false;
scene.add(sky);

const hemisphere = new THREE.HemisphereLight(0xcfe5ff, 0x567044, 1.25);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight(0xffe8c7, 2.75);
sun.position.copy(sunDirection).multiplyScalar(90);
sun.target.position.set(0, 4, HILL_CENTER_Z);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 190;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.035;
scene.add(sun);
scene.add(sun.target);

function createTerrain() {
  const size = 430;
  const segments = 258;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -62);

  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const grassDark = new THREE.Color(0x31552b);
  const grassMid = new THREE.Color(0x527b38);
  const grassLight = new THREE.Color(0x739647);
  const dryGrass = new THREE.Color(0x8a9751);
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = getTerrainHeight(x, z);
    positions.setY(i, y);

    const broad = fbm(x * 0.055 + 12, z * 0.055 - 8, 4);
    const fine = fbm(x * 0.26, z * 0.26, 3);
    color.copy(grassDark).lerp(grassMid, smooth01(broad * 1.45 - 0.16));
    color.lerp(grassLight, smooth01(fine * 1.2 - 0.38) * 0.5);
    color.lerp(dryGrass, smooth01(broad * fine * 2.4 - 0.75) * 0.42);

    const hillGlow = smooth01(
      1 - Math.hypot(x, z - HILL_CENTER_Z) / HILL_RADIUS,
    );
    color.offsetHSL(0, 0, hillGlow * 0.025);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    dithering: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

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

const windUniforms = { uTime: { value: 0 } };

function createGrass() {
  const count = 120000;
  const geometry = createBladeGeometry();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
    dithering: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `
          #include <common>
          uniform float uTime;
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
          #endif
        `,
      );
  };

  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x5eeda11);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const radius = 43;

  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const x = Math.cos(angle) * distance;
    const z = HILL_CENTER_Z + Math.sin(angle) * distance;
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
    mesh.setMatrixAt(i, dummy.matrix);

    color.setHSL(
      0.225 + random() * 0.065,
      0.43 + random() * 0.19,
      0.27 + random() * 0.14,
    );
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function createFlowers() {
  const count = 1500;
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x10f10a);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [0xfff4d6, 0xffe27d, 0xf3c7d4, 0xd9e7ff, 0xffffff];

  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 29;
    const x = Math.cos(angle) * distance;
    const z = HILL_CENTER_Z + Math.sin(angle) * distance;
    const y = getTerrainHeight(x, z) + 0.28 + random() * 0.34;
    const scale = 0.026 + random() * 0.028;

    dummy.position.set(x, y, z);
    dummy.rotation.set(
      random() * Math.PI,
      random() * Math.PI,
      random() * Math.PI,
    );
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    color.set(palette[Math.floor(random() * palette.length)]);
    mesh.setColorAt(i, color);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
}

function createCylinderBetween(start, end, startRadius, endRadius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(
    endRadius,
    startRadius,
    length,
    8,
    1,
    false,
  );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createTree() {
  const tree = new THREE.Group();
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x5e4530,
    roughness: 0.96,
    flatShading: true,
  });
  const leafMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0x315427,
      roughness: 0.92,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x3f682e,
      roughness: 0.92,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x527b36,
      roughness: 0.92,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x648a3d,
      roughness: 0.92,
      flatShading: true,
    }),
  ];

  const trunkPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.12, 1.25, 0.06),
    new THREE.Vector3(-0.04, 2.55, 0.02),
    new THREE.Vector3(0.1, 3.65, -0.04),
    new THREE.Vector3(0.02, 4.55, 0),
  ];
  const trunkRadii = [0.5, 0.38, 0.28, 0.19, 0.12];
  for (let i = 0; i < trunkPoints.length - 1; i += 1) {
    tree.add(
      createCylinderBetween(
        trunkPoints[i],
        trunkPoints[i + 1],
        trunkRadii[i],
        trunkRadii[i + 1],
        trunkMaterial,
      ),
    );
  }

  const branchTips = [
    new THREE.Vector3(1.75, 3.95, 0.42),
    new THREE.Vector3(-1.55, 4.35, -0.38),
    new THREE.Vector3(0.95, 5.05, -0.72),
    new THREE.Vector3(-0.92, 4.6, 0.78),
    new THREE.Vector3(0.28, 5.45, 0.42),
  ];
  const branchBases = [
    new THREE.Vector3(0.06, 2.38, 0.02),
    new THREE.Vector3(-0.02, 2.92, 0.01),
    new THREE.Vector3(0.08, 3.56, -0.02),
    new THREE.Vector3(-0.04, 3.28, 0.01),
    new THREE.Vector3(0.03, 4.2, 0),
  ];
  branchTips.forEach((tip, index) => {
    tree.add(
      createCylinderBetween(
        branchBases[index],
        tip,
        0.15 - index * 0.012,
        0.045,
        trunkMaterial,
      ),
    );
    const twigEnd = tip
      .clone()
      .add(
        new THREE.Vector3(
          (index % 2 ? -1 : 1) * 0.55,
          0.55,
          ((index % 3) - 1) * 0.4,
        ),
      );
    tree.add(createCylinderBetween(tip, twigEnd, 0.045, 0.02, trunkMaterial));
  });

  const foliage = new THREE.Group();
  const random = mulberry32(0x7ee5);
  const leafGeometry = new THREE.IcosahedronGeometry(1, 1);
  const clusterPositions = [];

  branchTips.forEach((tip, index) => {
    clusterPositions.push({
      position: tip.clone().add(new THREE.Vector3(0, 0.5 + index * 0.06, 0)),
      scale: 1.15 + random() * 0.55,
    });
  });

  for (let i = 0; i < 18; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random());
    const x = Math.cos(angle) * distance * 2.55;
    const z = Math.sin(angle) * distance * 2.15;
    const y = 5.55 + (random() - 0.46) * 2.15;
    clusterPositions.push({
      position: new THREE.Vector3(x, y, z),
      scale: 0.82 + random() * 0.78,
    });
  }

  clusterPositions.forEach((cluster) => {
    const material = leafMaterials[Math.floor(random() * leafMaterials.length)];
    const leaves = new THREE.Mesh(leafGeometry, material);
    leaves.position.copy(cluster.position);
    leaves.scale.set(
      cluster.scale * (0.95 + random() * 0.22),
      cluster.scale * (0.82 + random() * 0.22),
      cluster.scale * (0.95 + random() * 0.22),
    );
    leaves.rotation.set(
      random() * Math.PI,
      random() * Math.PI,
      random() * Math.PI,
    );
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    foliage.add(leaves);
  });

  tree.add(foliage);
  tree.position.set(
    0,
    getTerrainHeight(0, HILL_CENTER_Z) - 0.12,
    HILL_CENTER_Z,
  );
  scene.add(tree);
  return foliage;
}

function createRocks() {
  const random = mulberry32(0x0c0ffee);
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  const materials = [
    new THREE.MeshStandardMaterial({
      color: 0x6f736b,
      roughness: 0.98,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x85867c,
      roughness: 0.98,
      flatShading: true,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x5c625c,
      roughness: 0.98,
      flatShading: true,
    }),
  ];

  for (let i = 0; i < 22; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = 4.5 + random() * 24;
    const x = Math.cos(angle) * distance;
    const z = HILL_CENTER_Z + Math.sin(angle) * distance;
    const scale = 0.18 + random() * 0.58;
    const rock = new THREE.Mesh(
      geometry,
      materials[Math.floor(random() * materials.length)],
    );
    rock.position.set(x, getTerrainHeight(x, z) + scale * 0.2, z);
    rock.rotation.set(
      random() * Math.PI,
      random() * Math.PI,
      random() * Math.PI,
    );
    rock.scale.set(
      scale * (1.1 + random() * 0.8),
      scale * 0.7,
      scale * (0.9 + random() * 0.6),
    );
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

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
  scene.add(mesh);
}

function createPineForest() {
  const geometries = [];
  for (let i = 0; i < 3; i += 1) {
    const cone = new THREE.ConeGeometry(0.36 - i * 0.07, 0.58, 7);
    cone.translate(0, 0.44 + i * 0.27, 0);
    geometries.push(cone);
  }
  const trunk = new THREE.CylinderGeometry(0.045, 0.065, 0.38, 5);
  trunk.translate(0, 0.19, 0);
  geometries.push(trunk);

  const geometry = mergeGeometries(geometries);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    flatShading: true,
  });
  const count = 260;
  const forest = new THREE.InstancedMesh(geometry, material, count);
  const random = mulberry32(0x7a1e5);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const x = (random() - 0.5) * 310;
    const z = -58 - random() * 62;
    const y = getTerrainHeight(x, z);
    const scale = 2.4 + random() * 4.3;

    dummy.position.set(x, y - 0.1, z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.set(
      scale * (0.8 + random() * 0.25),
      scale,
      scale * (0.8 + random() * 0.25),
    );
    dummy.updateMatrix();
    forest.setMatrixAt(i, dummy.matrix);

    color.setHSL(
      0.31 + random() * 0.04,
      0.26 + random() * 0.15,
      0.16 + random() * 0.08,
    );
    forest.setColorAt(i, color);
  }

  forest.instanceMatrix.needsUpdate = true;
  forest.instanceColor.needsUpdate = true;
  forest.computeBoundingSphere();
  scene.add(forest);
}

function createClouds() {
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
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });

  const random = mulberry32(0xc10d);
  const clouds = [];
  for (let i = 0; i < 8; i += 1) {
    const sprite = new THREE.Sprite(material.clone());
    const scale = 48 + random() * 70;
    sprite.position.set(
      (random() - 0.5) * 560,
      72 + random() * 72,
      -300 - random() * 160,
    );
    sprite.scale.set(scale, scale * 0.4, 1);
    sprite.material.opacity = 0.3 + random() * 0.28;
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.phase = random() * Math.PI * 2;
    clouds.push(sprite);
    scene.add(sprite);
  }
  return clouds;
}

function createPollen() {
  const count = 320;
  const positions = new Float32Array(count * 3);
  const data = [];
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
    data.push({
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
  scene.add(points);
  return { points, data };
}

createTerrain();
createGrass();
createFlowers();
const foliage = createTree();
createRocks();
createPineForest();

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
});

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
});

const clouds = createClouds();
const pollen = createPollen();

const clock = new THREE.Clock();
let hasRendered = false;

function animate() {
  const elapsed = clock.getElapsedTime();
  windUniforms.uTime.value = elapsed;

  foliage.rotation.z = Math.sin(elapsed * 0.55) * 0.008;
  foliage.rotation.x = Math.sin(elapsed * 0.43 + 1.2) * 0.005;

  clouds.forEach((cloud) => {
    cloud.position.x =
      cloud.userData.baseX +
      Math.sin(elapsed * 0.012 + cloud.userData.phase) * 14;
  });

  const pollenPositions = pollen.points.geometry.getAttribute("position");
  pollen.data.forEach((particle, index) => {
    const drift = elapsed * particle.speed + particle.phase;
    pollenPositions.setX(index, particle.baseX + Math.sin(drift * 0.8) * 0.6);
    pollenPositions.setY(index, particle.baseY + Math.sin(drift) * 0.45);
    pollenPositions.setZ(index, particle.baseZ + Math.cos(drift * 0.65) * 0.55);
  });
  pollenPositions.needsUpdate = true;

  controls.update();
  renderer.render(scene, camera);

  if (!hasRendered) {
    hasRendered = true;
    window.setTimeout(() => {
      document.querySelector("#loader").classList.add("is-hidden");
    }, 320);
  }
}

renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});
