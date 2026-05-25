import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform float uFlowOffset;

  void main() {
    vec4 baseWorld = modelMatrix * vec4(position, 1.0);
    float wx = baseWorld.x;
    float wz = baseWorld.z;

    // Flow: offset Z so wave pattern scrolls from bow to stern
    float fz = wz - uFlowOffset;

    // Multi-frequency wave displacement (using flowing coords)
    float h = sin(wx * 0.5 + uTime * 0.8) * 0.12
            + sin(fz * 0.3 + uTime * 0.5) * 0.08
            + sin((wx + fz) * 0.7 + uTime * 1.1) * 0.04
            + sin(wx * 1.2 - fz * 0.8 + uTime * 0.6) * 0.03;

    vec3 worldPos = vec3(wx, h, wz);
    vWorldPos = worldPos;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vWorldPos;
  uniform float uTime;
  uniform vec3 uCameraPos;
  uniform float uFlowOffset;
  uniform float uBoatSpeed;

  void main() {
    vec3 deepColor = vec3(0.02, 0.10, 0.25);
    vec3 surfaceColor = vec3(0.05, 0.25, 0.42);
    vec3 skyReflect = vec3(0.35, 0.55, 0.75);
    vec3 foamColor = vec3(0.85, 0.93, 0.97);

    // Flowing Z for color patterns
    float fz = vWorldPos.z - uFlowOffset;

    // Color variation (flowing)
    float p1 = sin(vWorldPos.x * 1.2 + uTime * 0.6) * sin(fz * 0.8 + uTime * 0.4);
    float p2 = sin(vWorldPos.x * 2.5 - uTime * 0.3) * sin(fz * 2.0 + uTime * 0.2);
    vec3 color = mix(deepColor, surfaceColor, p1 * 0.3 + p2 * 0.15 + 0.55);

    // Surface normal (flowing coords)
    float dhdx = cos(vWorldPos.x * 0.5 + uTime * 0.8) * 0.06
               + cos((vWorldPos.x + fz) * 0.7 + uTime * 1.1) * 0.028
               + cos(vWorldPos.x * 1.2 - fz * 0.8 + uTime * 0.6) * 0.036;
    float dhdz = cos(fz * 0.3 + uTime * 0.5) * 0.024
               + cos((vWorldPos.x + fz) * 0.7 + uTime * 1.1) * 0.028
               + cos(vWorldPos.x * 1.2 - fz * 0.8 + uTime * 0.6) * (-0.024);
    vec3 normal = normalize(vec3(-dhdx, 1.0, -dhdz));

    // Sun specular
    vec3 sunDir = normalize(vec3(0.3, 0.8, 0.2));
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    vec3 reflDir = reflect(-sunDir, normal);
    float spec = pow(max(dot(viewDir, reflDir), 0.0), 128.0);
    color += vec3(1.0, 0.97, 0.9) * spec * 0.6;

    // Fresnel
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
    color = mix(color, skyReflect, fresnel * 0.35);

    // ── Bow wave ──────────────────────────────────────────
    float bowZ = vWorldPos.z + 2.3;                         // 0 at bow
    float bowDist = length(vec2(vWorldPos.x * 2.5, bowZ));  // elliptical
    float bowWave = smoothstep(0.9, 0.0, bowDist) * smoothstep(-0.2, 0.3, bowZ);
    color = mix(color, foamColor, bowWave * uBoatSpeed * 0.5);

    // ── Wake (V-shape behind stern) ───────────────────────
    float sternZ = 2.5;
    float behind = vWorldPos.z - sternZ;
    if (behind > 0.0) {
      // V-shape: expands with distance
      float halfW = behind * 0.1 + 0.08;
      float edge = abs(vWorldPos.x) / halfW;
      float wake = (1.0 - smoothstep(0.6, 1.0, edge))
                 * smoothstep(0.0, 0.4, behind)
                 * smoothstep(18.0, 1.0, behind);

      // Turbulent foam texture
      float turb = sin(vWorldPos.x * 14.0 + uTime * 4.0)
                 * sin(behind * 7.0 - uTime * 6.0) * 0.3 + 0.7;

      // Centerline disturbance
      float center = exp(-vWorldPos.x * vWorldPos.x * 8.0)
                   * smoothstep(0.0, 0.3, behind)
                   * smoothstep(10.0, 0.5, behind);

      float foam = (wake * turb + center * 0.4) * uBoatSpeed;
      color = mix(color, foamColor, clamp(foam * 0.6, 0.0, 1.0));
    }

    // Distance fog
    float dist = length(vWorldPos.xz);
    vec3 fogColor = vec3(0.53, 0.81, 0.92);
    float fogFactor = smoothstep(25.0, 75.0, dist);
    color = mix(color, fogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createWater(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(200, 200, 128, 128);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCameraPos: { value: new THREE.Vector3() },
      uFlowOffset: { value: 0 },
      uBoatSpeed: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
