// 3D prototype spike — completely isolated from the real 2D game (src/engine/*).
// Goal: prove out whether a Three.js-based world is viable before touching anything real.
// Nothing in src/engine/ imports this, and nothing here imports from src/engine/.

import * as THREE from 'three';
import { createRoomAPI } from './roomAPI.js';
import { loadRoom3D } from './RoomLoader3D.js';

const container = document.getElementById('game-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0ff);
scene.fog = new THREE.Fog(0x8fd0ff, 30, 90);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Lighting -----------------------------------------------------------
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(20, 30, 10);
sun.castShadow = true;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

// --- Player (capsule stand-in for a character render) --------------------
// Sized to match the scale Gemini's testRoom.js actually designed at (a
// ~6-unit-tall counter/stool/wall scale implies a ~5-unit-tall occupant),
// not the abstract "1.5 units" the prompt asked it to target — real output
// didn't hold to that number, so the prototype now matches the output
// instead of re-prompting. Worth folding a clearer scale anchor (e.g. real-
// world foot/meter references) into prompts.js if this recurs on other rooms.
const PLAYER_RADIUS = 1.0;
const PLAYER_LENGTH = 3.0; // capsule cylinder length, excluding the two rounded caps
const PLAYER_HEIGHT = PLAYER_LENGTH + PLAYER_RADIUS * 2; // ~5 units total

const player = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_LENGTH, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0xff5757 })
);
body.position.y = PLAYER_HEIGHT / 2;
body.castShadow = true;
player.add(body);
player.position.set(0, 0, 0);
scene.add(player);

// --- Optional generated test room (src/engine3d/rooms/testRoom.js) -------
// Paste Gemini's output from prompts.js's PROMPT_3D_EXPORT into that file
// (see src/engine3d/rooms/_template.js) to test it here. If the file
// doesn't exist yet, fall back to a handful of placeholder blocks so the
// scene isn't empty.
const roomModules = import.meta.glob('./rooms/testRoom.js', { eager: true });
const testRoomModule = roomModules['./rooms/testRoom.js'];

const scene3d = createRoomAPI(scene, player);
let loadedRoom = null;
const hintEl = document.getElementById('hint');

if (testRoomModule) {
  const result = loadRoom3D(testRoomModule, scene3d);
  if (result.ok) {
    loadedRoom = result;
    if (hintEl) hintEl.innerHTML += `<br/><b>Loaded room: ${testRoomModule.name}</b>`;
  } else if (hintEl) {
    hintEl.innerHTML += `<br/><span style="color:#ff8888">Room failed to load: ${result.errors.join('; ')}</span>`;
  }
} else {
  scene3d.addGround(0x7ec850);
  const roomColors = [0xffb347, 0x6ec6ff, 0xff6f91, 0xb497ff, 0xffe066];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    scene3d.addBox(Math.cos(angle) * 20, 2, Math.sin(angle) * 20, 6, 4, 6, roomColors[i]);
  }
}

// --- Third-person follow camera + mouse-drag orbit ------------------------
let yaw = 0;
let pitch = -0.3;
let dragging = false;
let lastX = 0;
let lastY = 0;

renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  yaw -= (e.clientX - lastX) * 0.005;
  pitch = Math.max(-1.2, Math.min(-0.05, pitch - (e.clientY - lastY) * 0.005));
  lastX = e.clientX;
  lastY = e.clientY;
});

const CAMERA_DISTANCE = PLAYER_HEIGHT * 4.5; // same ratio the old 2-unit player used (9 / 2)

function updateCamera() {
  const offset = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    -Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  ).multiplyScalar(CAMERA_DISTANCE);
  camera.position.copy(player.position).add(offset).add(new THREE.Vector3(0, PLAYER_HEIGHT, 0));
  camera.lookAt(player.position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT / 2, 0)));
}

// --- Movement (WASD, camera-relative) -------------------------------------
const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

const MOVE_SPEED = PLAYER_HEIGHT * 3; // units/sec, same ratio the old 2-unit player used (6 / 2)
const clock = new THREE.Clock();

function updateMovement(dt) {
  let moveX = 0;
  let moveZ = 0;
  if (keys.has('w') || keys.has('arrowup')) moveZ -= 1;
  if (keys.has('s') || keys.has('arrowdown')) moveZ += 1;
  if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
  if (keys.has('d') || keys.has('arrowright')) moveX += 1;

  if (moveX !== 0 || moveZ !== 0) {
    const len = Math.hypot(moveX, moveZ);
    moveX /= len;
    moveZ /= len;

    // Move relative to camera yaw so WASD feels consistent regardless of look direction.
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const dir = forward.multiplyScalar(moveZ).add(right.multiplyScalar(moveX));
    dir.normalize().multiplyScalar(MOVE_SPEED * dt);

    player.position.add(dir);
    player.rotation.y = Math.atan2(dir.x, dir.z);
  }
}

// --- Render loop ------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  updateMovement(dt);
  if (loadedRoom) loadedRoom.update(dt);
  updateCamera();
  renderer.render(scene, camera);
}
updateCamera();
animate();
