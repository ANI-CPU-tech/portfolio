import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_SPEED   = 5.0;   // units per second
const CAM_OFFSET     = new THREE.Vector3(10, 10, 10); // isometric offset
const CAM_LERP       = 0.08;  // camera smoothing (0 = never, 1 = instant)
const PLAYER_START_Y = 0.8;   // just above the floor surface (floor top = 0)

// ─── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0a0a0f);

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a0f, 0.04);

// ─── Camera ───────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.copy(CAM_OFFSET);
camera.lookAt(0, 0, 0);

// ─── Lighting ─────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(8, 16, 8);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 60;
dirLight.shadow.camera.left  = -15;
dirLight.shadow.camera.right =  15;
dirLight.shadow.camera.top   =  15;
dirLight.shadow.camera.bottom = -15;
dirLight.shadow.bias = -0.001;
scene.add(dirLight);

// ─── Resize handler ───────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ─── WASD Input ───────────────────────────────────────────────────────────────
const keys: Record<string, boolean> = {
  w: false,
  a: false,
  s: false,
  d: false,
};

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

// ─── Player Sprite Texture (canvas placeholder) ───────────────────────────────
function buildPlayerTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width  = size;
  c.height = size * 2; // tall character proportions

  const ctx = c.getContext('2d')!;

  // Body gradient — cyan/teal HD-2D palette
  const bodyGrad = ctx.createLinearGradient(0, size * 0.3, 0, size * 2);
  bodyGrad.addColorStop(0, '#00e5ff');
  bodyGrad.addColorStop(1, '#006080');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(size * 0.2, size * 0.45, size * 0.6, size * 1.3, size * 0.12);
  ctx.fill();

  // Head
  const headGrad = ctx.createRadialGradient(
    size * 0.5, size * 0.22,
    size * 0.04,
    size * 0.5, size * 0.24,
    size * 0.22,
  );
  headGrad.addColorStop(0, '#ffe0b2');
  headGrad.addColorStop(1, '#bf8040');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.24, size * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(size * 0.38, size * 0.22, size * 0.05, 0, Math.PI * 2);
  ctx.arc(size * 0.62, size * 0.22, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Rim light (HD-2D characteristic outline glow)
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(size * 0.2, size * 0.45, size * 0.6, size * 1.3, size * 0.12);
  ctx.stroke();

  return new THREE.CanvasTexture(c);
}

// ─── Shadow blob under player ─────────────────────────────────────────────────
function buildShadowSprite(): THREE.Sprite {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.2, 0.4, 1);
  return sprite;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function start() {
  await RAPIER.init();

  const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

  // ── Floor ────────────────────────────────────────────────────────────────
  // Physics: floor top surface sits at y = 0
  const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.25, 0);
  const floorBody     = world.createRigidBody(floorBodyDesc);
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.25, 10), floorBody);

  // Visual
  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(20, 0.5, 20),
    new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.8, metalness: 0.1 }),
  );
  floorMesh.receiveShadow = true;
  floorMesh.position.set(0, -0.25, 0);
  scene.add(floorMesh);

  const grid = new THREE.GridHelper(20, 20, 0x445566, 0x223344);
  grid.position.y = 0.01;
  scene.add(grid);

  // ── Player Physics ────────────────────────────────────────────────────────
  // Kinematic position-based body — we drive it ourselves via setNextKinematicTranslation
  const playerBodyDesc = RAPIER.RigidBodyDesc
    .kinematicPositionBased()
    .setTranslation(0, PLAYER_START_Y, 0);
  const playerBody = world.createRigidBody(playerBodyDesc);

  // Capsule collider: radius 0.3, halfHeight 0.3  →  total height ~1.2 units
  world.createCollider(
    RAPIER.ColliderDesc.capsule(0.3, 0.3),
    playerBody,
  );

  // ── Player Sprite (HD-2D billboard) ──────────────────────────────────────
  const playerSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: buildPlayerTexture(),
      transparent: true,
      alphaTest: 0.05,
      sizeAttenuation: true,
    }),
  );
  // Scale to match capsule visual proportions (width ~0.8, height ~1.5)
  playerSprite.scale.set(0.9, 1.6, 1);
  scene.add(playerSprite);

  // Shadow blob
  const shadowSprite = buildShadowSprite();
  scene.add(shadowSprite);

  // ── Movement helpers ─────────────────────────────────────────────────────
  // The isometric camera sits at offset (10,10,10) → forward is (-1,0,-1) normalised.
  // We project WASD onto the XZ plane aligned to that view.
  const CAM_FORWARD = new THREE.Vector3(-1, 0, -1).normalize(); // W
  const CAM_RIGHT   = new THREE.Vector3( 1, 0, -1).normalize(); // D

  const moveVec   = new THREE.Vector3();
  const targetPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();

  let lastTime = performance.now();

  // ── Game Loop ─────────────────────────────────────────────────────────────
  function gameLoop() {
    requestAnimationFrame(gameLoop);

    const now   = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05); // seconds, capped at 50 ms
    lastTime    = now;

    // Build movement direction from keys
    moveVec.set(0, 0, 0);
    if (keys.w) moveVec.addScaledVector(CAM_FORWARD,  1);
    if (keys.s) moveVec.addScaledVector(CAM_FORWARD, -1);
    if (keys.d) moveVec.addScaledVector(CAM_RIGHT,    1);
    if (keys.a) moveVec.addScaledVector(CAM_RIGHT,   -1);

    // Normalize so diagonal speed == straight speed
    if (moveVec.lengthSq() > 0) moveVec.normalize();

    // Compute new XZ position, keep Y fixed (kinematic on flat floor)
    const currentPos = playerBody.translation();
    targetPos.set(
      currentPos.x + moveVec.x * PLAYER_SPEED * delta,
      PLAYER_START_Y,                                      // lock to floor height
      currentPos.z + moveVec.z * PLAYER_SPEED * delta,
    );

    // Clamp to floor bounds so the player can't walk off the edge
    targetPos.x = Math.max(-9.5, Math.min(9.5, targetPos.x));
    targetPos.z = Math.max(-9.5, Math.min(9.5, targetPos.z));

    playerBody.setNextKinematicTranslation(targetPos);

    // Step physics world
    world.step();

    // Sync sprite to body
    const pos = playerBody.translation();
    playerSprite.position.set(pos.x, pos.y + 0.1, pos.z);

    // Shadow stays flat on the floor
    shadowSprite.position.set(pos.x, 0.02, pos.z);

    // Smooth camera follow — maintain isometric offset from player
    camTarget.set(pos.x + CAM_OFFSET.x, CAM_OFFSET.y, pos.z + CAM_OFFSET.z);
    camera.position.lerp(camTarget, CAM_LERP);
    camera.lookAt(pos.x, 0, pos.z);

    renderer.render(scene, camera);
  }

  gameLoop();
}

start().catch(console.error);
