import * as THREE from "three";

export function createSky(sunDirection) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x35679d) },
      uHorizon: { value: new THREE.Color(0xeec49d) },
      uHaze: { value: new THREE.Color(0xf4d5b0) },
      uSunColor: { value: new THREE.Color(0xffc27a) },
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
        color = mix(color, uHaze, lowSky * 0.4);
        vec2 flatDirection =
          direction.xz / max(length(direction.xz), 0.0001);
        vec2 flatSun =
          uSunDirection.xz / max(length(uSunDirection.xz), 0.0001);
        float sunAzimuth = max(dot(flatDirection, flatSun), 0.0);
        float horizonBand = 1.0 - smoothstep(0.0, 0.24, height);
        color = mix(
          color,
          vec3(0.94, 0.55, 0.32),
          pow(sunAzimuth, 3.0) * horizonBand * 0.3
        );
        float sun = max(dot(direction, normalize(uSunDirection)), 0.0);
        color += uSunColor * pow(sun, 750.0) * 1.8;
        color += uSunColor * pow(sun, 14.0) * 0.13;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(850, 32, 20), material);
  mesh.frustumCulled = false;
  return mesh;
}
