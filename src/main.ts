import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createBoat, updateSails, getBoatSpeed, INITIAL_WIND_ANGLE } from './boat';
import { createWater } from './water';
import { createLandscape } from './landscape';
import { createWindHUD, updateWindHUD } from './hud';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('app')!.appendChild(renderer.domElement);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0xa8cce0, 0.012);

// Camera
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0.3, 1.4, 3.5);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.2, -1);
controls.minDistance = 3;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 2.05;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.update();

// Lighting
scene.add(new THREE.AmbientLight(0x6688aa, 0.5));
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a6b5e, 0.4));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
sun.position.set(5, 10, 3);
scene.add(sun);

// Boat & water
const boat = createBoat();
scene.add(boat);
const water = createWater();
scene.add(water);

// Distant landscape — rotates around the boat when heading changes
const landscape = createLandscape();
scene.add(landscape);

// Wind HUD
createWindHUD();

// ── Input ─────────────────────────────────────────────────────
const keys = { left: false, right: false };
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
  if (e.key === 'ArrowRight') { keys.right = true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
});

// ── State ─────────────────────────────────────────────────────
let windAngle = INITIAL_WIND_ANGLE;
let flowOffset = 0;
let currentHeel = 0;
let headingOffset = 0; // cumulative boat heading change (for landscape rotation)
const TURN_SPEED = 0.8;
const MAX_FLOW_SPEED = 1.8;
const MAX_HEEL = 0.12;

// ── Animation ─────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;

  // Steering
  const prevWindAngle = windAngle;
  if (keys.left) windAngle += TURN_SPEED * dt;
  if (keys.right) windAngle -= TURN_SPEED * dt;
  while (windAngle > Math.PI) windAngle -= 2 * Math.PI;
  while (windAngle < -Math.PI) windAngle += 2 * Math.PI;

  // Track heading change (boat turns opposite to wind change)
  let windDelta = windAngle - prevWindAngle;
  if (windDelta > Math.PI) windDelta -= 2 * Math.PI;
  if (windDelta < -Math.PI) windDelta += 2 * Math.PI;
  headingOffset -= windDelta; // landscape rotates opposite to wind change

  // Sails
  updateSails(windAngle, dt, elapsed);

  // Speed & flow
  const speed = getBoatSpeed(windAngle);
  flowOffset += speed * MAX_FLOW_SPEED * dt;

  // Heel
  const absWind = Math.abs(windAngle);
  const heelTarget =
    Math.sign(windAngle) * speed * Math.sin(Math.min(absWind, Math.PI / 2)) * MAX_HEEL;
  currentHeel += (heelTarget - currentHeel) * (1 - Math.exp(-2 * dt));

  // Rotate landscape around the boat
  landscape.rotation.y = headingOffset;

  // Wind gauge
  updateWindHUD(windAngle);

  // Water uniforms
  const wm = water.material as THREE.ShaderMaterial;
  wm.uniforms.uTime.value = elapsed;
  wm.uniforms.uCameraPos.value.copy(camera.position);
  wm.uniforms.uFlowOffset.value = flowOffset;
  wm.uniforms.uBoatSpeed.value = speed;

  // Boat motion
  boat.rotation.z = currentHeel + Math.sin(elapsed * 0.5) * 0.015;
  boat.rotation.x = Math.sin(elapsed * 0.35) * 0.01;
  boat.position.y = Math.sin(elapsed * 0.4) * 0.03;

  controls.update();
  renderer.render(scene, camera);
}
animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
