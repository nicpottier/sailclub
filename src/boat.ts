import * as THREE from 'three';

// Hull dimensions — proportioned for a ~40ft cruiser
const DECK_Y = 0.45;
const MAST_X = 0;
const MAST_Z = -0.5;
const MAST_HEIGHT = 7.0;
const MAST_TOP_Y = DECK_Y + MAST_HEIGHT;
const BOOM_Y = DECK_Y + 0.6; // above the coachroof
const BOOM_LENGTH = 2.0;
const BELLY_DEPTH = 0.22;

// Jib geometry
const JIB_TACK_Y = DECK_Y + 0.1;
const JIB_TACK_Z = -2.4;
const JIB_HEAD_Y = MAST_TOP_Y - 0.3;
const JIB_HEAD_Z = MAST_Z;
const JIB_FOOT_LENGTH = 1.8;
const JIB_CLEW_Y = DECK_Y + 0.15;
const JIB_BELLY_DEPTH = 0.3;

// Sail dynamics
const NO_GO_ZONE = Math.PI / 6; // ~30° — can't sail closer than this
export const INITIAL_WIND_ANGLE = -Math.PI / 2.5; // port tack, close reach

// Mesh grid sizes
const MAIN_ROWS = 16;
const MAIN_COLS = 16;
const JIB_ROWS = 20;
const JIB_COLS = 20;

// Cross-sections: [z, halfWidth, depth below waterline]
const HULL_SECTIONS: [number, number, number][] = [
  [-2.5, 0.0,  0.0 ],
  [-2.2, 0.12, 0.12],
  [-1.8, 0.32, 0.3 ],
  [-1.3, 0.52, 0.45],
  [-0.8, 0.65, 0.52],
  [-0.3, 0.72, 0.55],
  [ 0.2, 0.75, 0.55],
  [ 0.7, 0.74, 0.53],
  [ 1.2, 0.7,  0.48],
  [ 1.7, 0.62, 0.38],
  [ 2.0, 0.55, 0.28],
  [ 2.3, 0.48, 0.18],
  [ 2.5, 0.42, 0.1 ],
];

// ── Module state ──────────────────────────────────────────────
let boomGroupRef: THREE.Group;
let mainSailMesh: THREE.Mesh;
let jibMesh: THREE.Mesh;
let currentBoomAngle = 0;
let currentJibAngle = 0;

/** Normalized boat speed 0‥1. Peaks at beam reach, zero in irons. */
export function getBoatSpeed(windAngle: number): number {
  const absWind = Math.abs(windAngle);
  if (absWind < NO_GO_ZONE) return 0;
  const t = (absWind - NO_GO_ZONE) / (Math.PI - NO_GO_ZONE);
  return Math.sin(t * Math.PI); // peak at t≈0.5 (beam reach)
}

// ── Public API ────────────────────────────────────────────────

export function createBoat(): THREE.Group {
  const boat = new THREE.Group();

  boat.add(createHull());
  boat.add(createDeck());
  boat.add(createMast());
  boat.add(createCoachroof());
  boat.add(createForestay());

  // Jib
  jibMesh = createJibMesh();
  boat.add(jibMesh);

  // Boom + mainsail in a group that pivots at the mast
  boomGroupRef = new THREE.Group();
  boomGroupRef.position.set(MAST_X, 0, MAST_Z);
  boomGroupRef.add(createBoomMesh());
  mainSailMesh = createMainsailMesh();
  boomGroupRef.add(mainSailMesh);
  boat.add(boomGroupRef);

  // Set initial sail positions from the initial wind angle
  computeSailAngles(INITIAL_WIND_ANGLE);
  boomGroupRef.rotation.y = currentBoomAngle;
  writeMainsailPositions(0, 0);
  writeJibPositions(0, 0);

  return boat;
}

/**
 * Update sail trim for the current wind angle. Call each frame.
 * windAngle: where the wind blows FROM relative to bow.
 *   negative = from port, positive = from starboard.
 */
export function updateSails(windAngle: number, dt: number, elapsed: number): void {
  const [targetBoom, targetJib] = computeTargetAngles(windAngle);

  // Smooth exponential lerp
  const rate = 1 - Math.exp(-3.5 * dt);
  currentBoomAngle += (targetBoom - currentBoomAngle) * rate;
  currentJibAngle += (targetJib - currentJibAngle) * rate;

  // Luff factor: 1 = fully luffing (head to wind), 0 = sails drawing
  const absWind = Math.abs(windAngle);
  const luff = absWind < NO_GO_ZONE ? 1 - absWind / NO_GO_ZONE : 0;

  boomGroupRef.rotation.y = currentBoomAngle;
  writeMainsailPositions(luff, elapsed);
  writeJibPositions(luff, elapsed);
}

// ── Sail angle computation ────────────────────────────────────

function computeTargetAngles(windAngle: number): [number, number] {
  const absWind = Math.abs(windAngle);

  if (absWind < NO_GO_ZONE) {
    // In irons — sails centered and depowered
    return [0, 0];
  }

  const t = (absWind - NO_GO_ZONE) / (Math.PI - NO_GO_ZONE); // 0‥1
  const side = -Math.sign(windAngle); // boom goes opposite to wind
  const boomMag = 0.15 + t * 1.3;    // ~9° close-hauled … ~83° running
  const jibMag = 0.10 + t * 0.7;     // ~6° … ~46°
  return [side * boomMag, side * jibMag];
}

function computeSailAngles(windAngle: number): void {
  [currentBoomAngle, currentJibAngle] = computeTargetAngles(windAngle);
}

// ── Sail power (belly fullness) ───────────────────────────────

function sailPower(windAngle: number): number {
  const absWind = Math.abs(windAngle);
  if (absWind >= NO_GO_ZONE) return 1;
  return absWind / NO_GO_ZONE; // 0 head-to-wind … 1 at edge
}

// ── Vertex buffer writers ─────────────────────────────────────

function writeMainsailPositions(luff: number, t: number): void {
  const pos = mainSailMesh.geometry.attributes.position as THREE.BufferAttribute;
  const bellySign = currentBoomAngle >= 0 ? 1 : -1;
  const sailHeight = MAST_TOP_Y - BOOM_Y;
  let idx = 0;

  for (let i = 0; i <= MAIN_ROWS; i++) {
    const u = i / MAIN_ROWS;
    for (let j = 0; j <= MAIN_COLS; j++) {
      const v = j / MAIN_COLS;
      const chord = (1 - u) * BOOM_LENGTH;

      // Normal belly when sails are drawing
      let belly = BELLY_DEPTH * Math.sin(v * Math.PI) * (1 - u) * (1 - u * 0.3);

      if (luff > 0) {
        // Flutter: rapid oscillation that increases toward the leech (v→1)
        // and reduces near the luff (v→0, attached to mast)
        const flutter = Math.sin(t * 12 + v * 8 + u * 5) * v * 0.25
                      + Math.sin(t * 17 + v * 11 - u * 3) * v * 0.12;
        belly = belly * (1 - luff) + flutter * luff * (1 - u);
      }

      pos.setXYZ(idx++, belly * bellySign, BOOM_Y + u * sailHeight, v * chord);
    }
  }

  pos.needsUpdate = true;
  mainSailMesh.geometry.computeVertexNormals();
}

function writeJibPositions(luff: number, t: number): void {
  const pos = jibMesh.geometry.attributes.position as THREE.BufferAttribute;
  const angle = currentJibAngle;
  const clewX = JIB_FOOT_LENGTH * Math.sin(angle);
  const clewZ = JIB_TACK_Z + JIB_FOOT_LENGTH * Math.cos(angle);
  const bellySign = angle >= 0 ? 1 : -1;
  let idx = 0;

  for (let i = 0; i <= JIB_ROWS; i++) {
    const u = i / JIB_ROWS;
    for (let j = 0; j <= JIB_COLS; j++) {
      const v = j / JIB_COLS;

      // Luff (forestay)
      const ly = JIB_TACK_Y + u * (JIB_HEAD_Y - JIB_TACK_Y);
      const lz = JIB_TACK_Z + u * (JIB_HEAD_Z - JIB_TACK_Z);

      // Leech (clew → head)
      const rx = clewX * (1 - u);
      const ry = JIB_CLEW_Y * (1 - u) + JIB_HEAD_Y * u;
      const rz = clewZ * (1 - u) + JIB_HEAD_Z * u;

      let x = rx * v;
      let y = ly * (1 - v) + ry * v;
      let z = lz * (1 - v) + rz * v;

      let belly = JIB_BELLY_DEPTH * Math.sin(v * Math.PI) * (1 - u) * (1 - u * 0.3);

      if (luff > 0) {
        const flutter = Math.sin(t * 14 + v * 9 + u * 4) * v * 0.3
                      + Math.sin(t * 19 - v * 7 + u * 6) * v * 0.15;
        belly = belly * (1 - luff) + flutter * luff * (1 - u);
      }

      x += belly * bellySign;

      pos.setXYZ(idx++, x, y, z);
    }
  }

  pos.needsUpdate = true;
  jibMesh.geometry.computeVertexNormals();
}

// ── Mesh factories (geometry + material, indices set once) ────

function createMainsailMesh(): THREE.Mesh {
  const count = (MAIN_ROWS + 1) * (MAIN_COLS + 1);
  const positions = new Float32Array(count * 3);
  const indices: number[] = [];

  for (let i = 0; i < MAIN_ROWS; i++) {
    for (let j = 0; j < MAIN_COLS; j++) {
      const a = i * (MAIN_COLS + 1) + j;
      const b = a + 1;
      const c = a + (MAIN_COLS + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xfff8f0,
      roughness: 0.6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    }),
  );
}

function createJibMesh(): THREE.Mesh {
  const count = (JIB_ROWS + 1) * (JIB_COLS + 1);
  const positions = new Float32Array(count * 3);
  const indices: number[] = [];

  for (let i = 0; i < JIB_ROWS; i++) {
    for (let j = 0; j < JIB_COLS; j++) {
      const a = i * (JIB_COLS + 1) + j;
      const b = a + 1;
      const c = a + (JIB_COLS + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xfff8f0,
      roughness: 0.6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    }),
  );
}

// ── Hull, deck, cabin, rig (unchanged) ────────────────────────

function createHull(): THREE.Mesh {
  const pointsPerSection = 12;
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const hullColor = new THREE.Color(0xf5f0e8);
  const bottomColor = new THREE.Color(0x1a2838);

  for (const [z, halfWidth, depth] of HULL_SECTIONS) {
    for (let i = 0; i < pointsPerSection; i++) {
      const t = i / (pointsPerSection - 1);
      const angle = t * Math.PI;
      const x = -halfWidth * Math.cos(angle);
      const y = DECK_Y - (DECK_Y + depth) * Math.sin(angle);
      vertices.push(x, y, z);

      const blend = THREE.MathUtils.smoothstep(y, -0.08, 0.08);
      const color = bottomColor.clone().lerp(hullColor, blend);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let s = 0; s < HULL_SECTIONS.length - 1; s++) {
    for (let i = 0; i < pointsPerSection - 1; i++) {
      const a = s * pointsPerSection + i;
      const b = a + 1;
      const c = (s + 1) * pointsPerSection + i;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Transom
  const stern = HULL_SECTIONS[HULL_SECTIONS.length - 1];
  const sternCenterY = (DECK_Y + (DECK_Y - stern[2])) / 2;
  vertices.push(0, sternCenterY, stern[0]);
  const blend = THREE.MathUtils.smoothstep(sternCenterY, -0.08, 0.08);
  const cc = bottomColor.clone().lerp(hullColor, blend);
  colors.push(cc.r, cc.g, cc.b);
  const centerIdx = vertices.length / 3 - 1;

  const sternBase = (HULL_SECTIONS.length - 1) * pointsPerSection;
  for (let i = 0; i < pointsPerSection; i++) {
    const next = (i + 1) % pointsPerSection;
    indices.push(centerIdx, sternBase + i, sternBase + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, side: THREE.DoubleSide }),
  );
}

function createDeck(): THREE.Mesh {
  const n = HULL_SECTIONS.length;
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const [z, hw] of HULL_SECTIONS) vertices.push(-hw, DECK_Y, z);
  for (const [z, hw] of HULL_SECTIONS) vertices.push(hw, DECK_Y, z);

  for (let i = 0; i < n - 1; i++) {
    indices.push(i, i + 1, n + i);
    indices.push(i + 1, n + i + 1, n + i);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xddd5c5, roughness: 0.8 }),
  );
}

function createMast(): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(0.04, 0.04, MAST_HEIGHT, 8);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.4, metalness: 0.3 }),
  );
  mesh.position.set(MAST_X, DECK_Y + MAST_HEIGHT / 2, MAST_Z);
  return mesh;
}

function createCoachroof(): THREE.Mesh {
  const sections: [number, number, number][] = [
    [-1.8, 0.05, 0.05],
    [-1.5, 0.22, 0.3 ],
    [-1.0, 0.28, 0.35],
    [-0.5, 0.3,  0.37],
    [ 0.0, 0.3,  0.37],
    [ 0.3, 0.28, 0.34],
    [ 0.6, 0.22, 0.25],
    [ 0.8, 0.1,  0.1 ],
  ];

  const ptsPerSection = 6;
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const [z, hw, h] of sections) {
    const crown = h * 0.06;
    const inset = hw * 0.08;
    vertices.push(-hw, DECK_Y, z);
    vertices.push(-hw + inset, DECK_Y + h, z);
    vertices.push(-hw * 0.35, DECK_Y + h + crown, z);
    vertices.push( hw * 0.35, DECK_Y + h + crown, z);
    vertices.push( hw - inset, DECK_Y + h, z);
    vertices.push( hw, DECK_Y, z);
  }

  for (let s = 0; s < sections.length - 1; s++) {
    for (let i = 0; i < ptsPerSection - 1; i++) {
      const a = s * ptsPerSection + i;
      const b = a + 1;
      const c = (s + 1) * ptsPerSection + i;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const frontBase = 0;
  const backBase = (sections.length - 1) * ptsPerSection;
  for (let i = 1; i < ptsPerSection - 1; i++) {
    indices.push(frontBase, frontBase + i + 1, frontBase + i);
    indices.push(backBase, backBase + i, backBase + i + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.4, side: THREE.DoubleSide }),
  );
}

function createBoomMesh(): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(0.025, 0.025, BOOM_LENGTH, 8);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.4, metalness: 0.3 }),
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(0, BOOM_Y, BOOM_LENGTH / 2);
  return mesh;
}

function createForestay(): THREE.Mesh {
  const start = new THREE.Vector3(0, JIB_TACK_Y, JIB_TACK_Z);
  const end = new THREE.Vector3(0, JIB_HEAD_Y, JIB_HEAD_Z);
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  dir.normalize();

  const geometry = new THREE.CylinderGeometry(0.015, 0.015, len, 6);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.5 }),
  );

  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  mesh.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
  return mesh;
}
