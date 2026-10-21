import * as THREE from "three";
import { TERRAIN_CENTER_Z } from "./terrain.js";

const vertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  varying vec3 vWorldPosition;
  uniform float uTime;
  uniform float uScale;
  uniform float uSpeed;
  uniform float uOpacity;
  uniform vec3 uShadeColor;
  uniform vec3 uLightColor;
  uniform vec3 uSunsetColor;
  uniform vec3 uHazeColor;
  uniform vec3 uSunDirection;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i += 1) {
      value += amplitude * noise(p);
      p = rotation * p * 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 p = vWorldPosition.xz;
    vec2 drift = vec2(uTime * uSpeed, uTime * uSpeed * 0.42);
    float broad = fbm(p * uScale + drift);
    float detail = fbm(p * uScale * 3.2 - drift * 1.6);
    float cloud = smoothstep(0.36, 0.62, broad * 0.78 + detail * 0.32);

    vec2 fromCenter = p - vec2(0.0, ${TERRAIN_CENTER_Z.toFixed(1)});
    float distanceFromCenter = length(fromCenter);
    float edgeFade = 1.0 - smoothstep(470.0, 900.0, distanceFromCenter);

    vec2 flatDirection = fromCenter / max(distanceFromCenter, 0.0001);
    vec2 flatSun = uSunDirection.xz / max(length(uSunDirection.xz), 0.0001);
    float sunFacing = max(dot(flatDirection, flatSun), 0.0);

    vec3 color = mix(uShadeColor, uLightColor, smoothstep(0.25, 0.9, detail));
    color = mix(color, uSunsetColor, pow(sunFacing, 3.5) * 0.48);
    color += uSunsetColor * pow(sunFacing, 10.0) * 0.16;
    color = mix(color, uHazeColor, smoothstep(500.0, 900.0, distanceFromCenter) * 0.55);

    float alpha = mix(0.48, 0.94, cloud) * edgeFade * uOpacity;
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createLayer({
  y,
  scale,
  speed,
  opacity,
  shadeColor,
  lightColor,
  sunsetDirection,
}) {
  const timeUniform = { value: 0 };
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: timeUniform,
      uScale: { value: scale },
      uSpeed: { value: speed },
      uOpacity: { value: opacity },
      uShadeColor: { value: new THREE.Color(shadeColor) },
      uLightColor: { value: new THREE.Color(lightColor) },
      uSunsetColor: { value: new THREE.Color(0xff9a5f) },
      uHazeColor: { value: new THREE.Color(0xf2c9a8) },
      uSunDirection: { value: sunsetDirection.clone() },
    },
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, y, TERRAIN_CENTER_Z);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  return { mesh, timeUniform };
}

export function createCloudSea(sunsetDirection) {
  const group = new THREE.Group();
  const upper = createLayer({
    y: -7,
    scale: 0.0042,
    speed: 0.0042,
    opacity: 0.92,
    shadeColor: 0x8f8d9c,
    lightColor: 0xffe5d1,
    sunsetDirection,
  });
  const lower = createLayer({
    y: -15,
    scale: 0.003,
    speed: 0.0026,
    opacity: 0.72,
    shadeColor: 0x78879a,
    lightColor: 0xe8d9cc,
    sunsetDirection,
  });

  upper.mesh.renderOrder = 2;
  lower.mesh.renderOrder = 1;
  group.add(lower.mesh, upper.mesh);

  return {
    group,
    update(time) {
      upper.timeUniform.value = time;
      lower.timeUniform.value = time;
    },
  };
}
