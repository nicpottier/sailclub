import * as THREE from 'three';

const RING_RADIUS = 60; // far enough to sit behind the fog/horizon
const HILL_Y_BASE = -0.5; // base sits below waterline so only peaks show

/**
 * Creates a group of distant mountain/hill silhouettes arranged in a ring
 * around the boat. The group is rotated in main.ts as the boat changes heading,
 * giving the player a fixed landmark reference for turns.
 */
export function createLandscape(): THREE.Group {
  const group = new THREE.Group();

  // Several clusters of hills at different angles around the ring
  const clusters = [
    { angle: 0, peaks: [3.5, 5.0, 4.2, 2.8] },          // "north"
    { angle: Math.PI * 0.35, peaks: [2.5, 3.8, 3.0] },   // northeast
    { angle: Math.PI * 0.7, peaks: [4.5, 6.0, 5.2, 3.5, 2.0] }, // east — tall range
    { angle: -Math.PI * 0.5, peaks: [2.0, 3.0, 2.5] },   // west — small island
    { angle: -Math.PI * 0.85, peaks: [3.0, 4.2, 3.6, 2.5] }, // southwest
  ];

  for (const cluster of clusters) {
    const mesh = createMountainRange(cluster.peaks, cluster.angle);
    group.add(mesh);
  }

  return group;
}

function createMountainRange(peakHeights: number[], angle: number): THREE.Mesh {
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const peakCount = peakHeights.length;
  const totalWidth = peakCount * 6; // spacing between peaks
  const halfWidth = totalWidth / 2;

  // Place at the ring radius in the direction of `angle`
  const cx = Math.sin(angle) * RING_RADIUS;
  const cz = -Math.cos(angle) * RING_RADIUS;
  // Tangent direction (perpendicular to radius, for spreading peaks along the arc)
  const tx = Math.cos(angle);
  const tz = Math.sin(angle);

  // Color palette — muted blues/greens for distant mountains
  const baseColor = new THREE.Color(0x556677);
  const peakColor = new THREE.Color(0x7788a0);
  const darkColor = new THREE.Color(0x3a4a5a);

  // Build a mountain silhouette as a series of overlapping triangular peaks
  // Each peak: a triangle from base-left, up to summit, down to base-right
  // Peaks overlap for a natural ridge look
  const resolution = 32; // points along the base of each peak

  for (let p = 0; p < peakCount; p++) {
    const peakH = peakHeights[p];
    const peakOffset = (p - (peakCount - 1) / 2) * 6; // spread along tangent

    // Peak world position
    const px = cx + tx * peakOffset;
    const pz = cz + tz * peakOffset;

    const baseVtx = vertices.length / 3;

    // Generate a smooth mountain profile
    for (let i = 0; i <= resolution; i++) {
      const t = i / resolution; // 0 to 1 across the base
      const localOffset = (t - 0.5) * 8; // -4 to +4 local width

      const wx = px + tx * localOffset;
      const wz = pz + tz * localOffset;

      // Height profile: bell curve with some roughness
      const bell = Math.exp(-localOffset * localOffset * 0.12);
      const rough = 1 + Math.sin(localOffset * 3.7) * 0.08 + Math.sin(localOffset * 7.1) * 0.04;
      const h = peakH * bell * rough;

      // Top vertex
      vertices.push(wx, HILL_Y_BASE + h, wz);
      // Bottom vertex (at base)
      vertices.push(wx, HILL_Y_BASE, wz);

      // Colors: darker at base, lighter at peaks
      const blend = bell * 0.6;
      const topCol = baseColor.clone().lerp(peakColor, blend);
      const botCol = darkColor.clone();
      colors.push(topCol.r, topCol.g, topCol.b);
      colors.push(botCol.r, botCol.g, botCol.b);
    }

    // Indices: triangle strip connecting top/bottom pairs
    for (let i = 0; i < resolution; i++) {
      const a = baseVtx + i * 2;     // top-left
      const b = a + 1;               // bottom-left
      const c = a + 2;               // top-right
      const d = a + 3;               // bottom-right
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      fog: true,
      side: THREE.DoubleSide,
    }),
  );
}
