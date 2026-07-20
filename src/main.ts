import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_SPEED      = 5.0;
const CAM_OFFSET        = new THREE.Vector3(10, 10, 10);
const CAM_LERP          = 0.08;
const PLAYER_START_Y    = 0.8;
const PROXIMITY_RADIUS  = 3.5;   // world units – trigger distance for UI prompt

// Floor is 40×40 units; half-extent = 20
const FLOOR_HALF     = 20;
const FLOOR_THICK    = 0.25; // half-thickness of the floor slab

// Wall thickness (invisible) – fat enough to never tunnel through
const WALL_THICK     = 1.0;
const WALL_HEIGHT    = 4.0;  // tall enough to block the capsule

// ─── Renderer ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0a0a0f);

// ─── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a0f, 0.025);

// ─── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.copy(CAM_OFFSET);
camera.lookAt(0, 0, 0);

// ─── Lighting ────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

// Warm fill from the opposite side for softer shadows on pedestals
const fillLight = new THREE.DirectionalLight(0xffd0a0, 0.25);
fillLight.position.set(-10, 8, -10);
scene.add(fillLight);

// Key light – wide frustum to cover the bigger floor + cast crisp pedestal shadows
const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(15, 28, 15);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width  = 4096;
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.near   = 0.5;
dirLight.shadow.camera.far    = 120;
dirLight.shadow.camera.left   = -30;
dirLight.shadow.camera.right  =  30;
dirLight.shadow.camera.top    =  30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.bias          = -0.0005;
scene.add(dirLight);

// ─── Resize ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ─── WASD Input ──────────────────────────────────────────────────────────────
const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (k in keys) keys[k] = true; });
window.addEventListener('keyup',   (e) => { const k = e.key.toLowerCase(); if (k in keys) keys[k] = false; });

// ─── Proximity UI refs ───────────────────────────────────────────────────────
const proximityUI    = document.getElementById('proximity-ui')    as HTMLDivElement;
const proximityLabel = document.getElementById('proximity-label') as HTMLParagraphElement;

/** Show the prompt with the pedestal's accent colour */
function showPrompt(name: string, accent: string, accentRgb: string) {
  proximityLabel.style.setProperty('--accent-color', accent);
  proximityLabel.style.setProperty('--accent-rgb',   accentRgb);
  proximityLabel.innerHTML =
    `Press <span class="key-badge">E</span>&nbsp;to view&nbsp;<span class="project-name">${name}</span>`;
  proximityUI.classList.add('visible');
}

function hidePrompt() {
  proximityUI.classList.remove('visible');
}

// ─── Modal refs & state ───────────────────────────────────────────────────────
const projectModal      = document.getElementById('project-modal')      as HTMLDivElement;
const modalTitle        = document.getElementById('modal-title')         as HTMLHeadingElement;
const modalDescription  = document.getElementById('modal-description')   as HTMLParagraphElement;
const modalAccentBar    = document.getElementById('modal-accent-bar')    as HTMLDivElement;
const modalCloseBtn     = document.getElementById('modal-close')         as HTMLButtonElement;

let isModalOpen = false;

function openModal(ped: { label: string; description: string; accent: string; accentRgb: string }) {
  modalTitle.textContent       = ped.label;
  modalDescription.textContent = ped.description;
  // Apply accent colour as CSS custom properties on the card
  projectModal.style.setProperty('--modal-accent-color', ped.accent);
  projectModal.style.setProperty('--modal-accent-rgb',   ped.accentRgb);
  modalAccentBar.style.background = ped.accent;
  modalAccentBar.style.boxShadow  = `0 0 10px ${ped.accent}`;
  projectModal.removeAttribute('hidden');
  isModalOpen = true;
  // Move focus to the close button for keyboard accessibility
  modalCloseBtn.focus();
}

function closeModal() {
  projectModal.setAttribute('hidden', '');
  isModalOpen = false;
}

// Close on button click
modalCloseBtn.addEventListener('click', closeModal);

// Close on Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isModalOpen) closeModal();
});

// Close on backdrop click (click outside the card)
projectModal.addEventListener('click', (e) => {
  if (e.target === projectModal || (e.target as HTMLElement).classList.contains('modal-backdrop')) {
    closeModal();
  }
});

// ─── Texture helpers ─────────────────────────────────────────────────────────

function buildPlayerTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size * 2;
  const ctx = c.getContext('2d')!;

  const bodyGrad = ctx.createLinearGradient(0, size * 0.3, 0, size * 2);
  bodyGrad.addColorStop(0, '#00e5ff');
  bodyGrad.addColorStop(1, '#006080');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(size * 0.2, size * 0.45, size * 0.6, size * 1.3, size * 0.12);
  ctx.fill();

  const headGrad = ctx.createRadialGradient(size*0.5, size*0.22, size*0.04, size*0.5, size*0.24, size*0.22);
  headGrad.addColorStop(0, '#ffe0b2');
  headGrad.addColorStop(1, '#bf8040');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.24, size * 0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(size * 0.38, size * 0.22, size * 0.05, 0, Math.PI * 2);
  ctx.arc(size * 0.62, size * 0.22, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,229,255,0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(size * 0.2, size * 0.45, size * 0.6, size * 1.3, size * 0.12);
  ctx.stroke();

  return new THREE.CanvasTexture(c);
}

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
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.2, 0.4, 1);
  return sprite;
}

/** Render a text label into a Sprite that floats above a pedestal */
function buildLabelSprite(text: string, accentColor: string): THREE.Sprite {
  const W = 512, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;

  // Pill background
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(10,10,20,0.78)';
  ctx.beginPath();
  ctx.roundRect(8, 8, W - 16, H - 16, 24);
  ctx.fill();

  // Accent border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(8, 8, W - 16, H - 16, 24);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = accentColor;
  ctx.shadowBlur  = 18;
  ctx.fillText(text, W / 2, H / 2);

  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(mat);
  // Scale so the label looks right in world space (wide pill, short height)
  sprite.scale.set(4, 1, 1);
  return sprite;
}

// ─── Physics helpers ──────────────────────────────────────────────────────────

/** Add an invisible static wall collider (no mesh) */
function addWall(
  world: RAPIER.World,
  x: number, y: number, z: number,
  hx: number, hy: number, hz: number
) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
}

// ─── Pedestal data ────────────────────────────────────────────────────────────
interface PedestalDef {
  label:       string;
  description: string;
  color:       number;
  accent:      string;
  accentRgb:   string;
  x:           number;
  z:           number;
}

// Arranged in a wide arc centred on the origin so the player can approach each one
const PEDESTALS: PedestalDef[] = [
  {
    label:       'Aegis',
    description: 'A cybersecurity project focused on continuous identity verification for zero trust environments.',
    color: 0x1a6fff, accent: '#1a6fff', accentRgb: '26,111,255',
    x: -10, z: -10,
  },
  {
    label:       'Agent OPSYN',
    description: 'An AI-powered developer operations assistant featuring a four-zone architecture, originally built for a hackathon submission.',
    color: 0xff3d6e, accent: '#ff3d6e', accentRgb: '255,61,110',
    x:  10, z: -10,
  },
  {
    label:       'FitGyldrah',
    description: 'A robust backend gym management system built with Python, Django, and PostgreSQL.',
    color: 0x2ecc71, accent: '#2ecc71', accentRgb: '46,204,113',
    x: -10, z:  10,
  },
  {
    label:       'About Me',
    description: 'I am an engineering student with a passion for software development, technical hackathons, and community tech projects. My stack includes Python, Django, Docker, and experimenting with local LLMs via Ollama.',
    color: 0xf5a623, accent: '#f5a623', accentRgb: '245,166,35',
    x:  10, z:  10,
  },
];

// Pedestal geometry constants
const PED_W = 2.0;   // full width / depth
const PED_H = 1.2;   // full height
// half-extents for Rapier
const PED_HX = PED_W / 2;
const PED_HY = PED_H / 2;
const PED_HZ = PED_W / 2;

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function start() {
  await RAPIER.init();

  const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

  // Character controller – offset 0.01 keeps the shape slightly away from surfaces
  // to avoid getting stuck in micro-gaps between colliders.
  const characterController = world.createCharacterController(0.01);

  // ── Floor (40×40) ────────────────────────────────────────────────────────
  const floorBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, -FLOOR_THICK, 0)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(FLOOR_HALF, FLOOR_THICK, FLOOR_HALF),
    floorBody,
  );

  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(FLOOR_HALF * 2, FLOOR_THICK * 2, FLOOR_HALF * 2),
    new THREE.MeshStandardMaterial({ color: 0x263040, roughness: 0.85, metalness: 0.05 }),
  );
  floorMesh.receiveShadow = true;
  floorMesh.position.set(0, -FLOOR_THICK, 0);
  scene.add(floorMesh);

  // Grid
  const grid = new THREE.GridHelper(FLOOR_HALF * 2, 40, 0x344456, 0x1e2c3a);
  grid.position.y = 0.01;
  scene.add(grid);

  // ── Invisible boundary walls ─────────────────────────────────────────────
  // Each wall is placed just outside the floor edge; centre at mid-height.
  const wallY  = WALL_HEIGHT / 2;
  const edge   = FLOOR_HALF + WALL_THICK / 2;

  // North (+Z face)
  addWall(world,      0, wallY,  edge,  FLOOR_HALF, WALL_HEIGHT, WALL_THICK / 2);
  // South (-Z face)
  addWall(world,      0, wallY, -edge,  FLOOR_HALF, WALL_HEIGHT, WALL_THICK / 2);
  // East  (+X face)
  addWall(world,   edge, wallY,     0,  WALL_THICK / 2, WALL_HEIGHT, FLOOR_HALF);
  // West  (-X face)
  addWall(world,  -edge, wallY,     0,  WALL_THICK / 2, WALL_HEIGHT, FLOOR_HALF);

  // ── Pedestals ─────────────────────────────────────────────────────────────
  for (const ped of PEDESTALS) {
    const pedestalY = PED_HY; // centre at half-height so base sits on floor

    // Physics: static cuboid
    const pedBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(ped.x, pedestalY, ped.z)
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(PED_HX, PED_HY, PED_HZ), pedBody);

    // Visual mesh
    const pedMesh = new THREE.Mesh(
      new THREE.BoxGeometry(PED_W, PED_H, PED_W),
      new THREE.MeshStandardMaterial({
        color:     ped.color,
        roughness: 0.4,
        metalness: 0.5,
        emissive:  ped.color,
        emissiveIntensity: 0.08,
      }),
    );
    pedMesh.castShadow    = true;
    pedMesh.receiveShadow = true;
    pedMesh.position.set(ped.x, pedestalY, ped.z);
    scene.add(pedMesh);

    // Top cap — slightly lighter face for HD-2D top-lit look
    const capMesh = new THREE.Mesh(
      new THREE.BoxGeometry(PED_W + 0.1, 0.12, PED_W + 0.1),
      new THREE.MeshStandardMaterial({
        color:     new THREE.Color(ped.color).lerp(new THREE.Color(0xffffff), 0.35),
        roughness: 0.3,
        metalness: 0.6,
      }),
    );
    capMesh.castShadow    = true;
    capMesh.receiveShadow = true;
    capMesh.position.set(ped.x, PED_H + 0.06, ped.z);
    scene.add(capMesh);

    // Floating label sprite
    const label = buildLabelSprite(ped.label, ped.accent);
    // Float 1.1 units above the top of the pedestal
    label.position.set(ped.x, PED_H + 1.1, ped.z);
    scene.add(label);

    // Glow point light for each pedestal – no shadows (perf)
    const pLight = new THREE.PointLight(ped.color, 1.2, 8);
    pLight.position.set(ped.x, PED_H + 0.5, ped.z);
    scene.add(pLight);
  }

  // ── Player Physics ────────────────────────────────────────────────────────
  const playerBodyDesc = RAPIER.RigidBodyDesc
    .kinematicPositionBased()
    .setTranslation(0, PLAYER_START_Y, 0);
  const playerBody     = world.createRigidBody(playerBodyDesc);
  // Store collider in its own variable so the character controller can reference it
  const playerCollider = world.createCollider(RAPIER.ColliderDesc.capsule(0.3, 0.3), playerBody);

  // ── Player Sprite ─────────────────────────────────────────────────────────
  const playerSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: buildPlayerTexture(),
      transparent: true,
      alphaTest: 0.05,
      sizeAttenuation: true,
    }),
  );
  playerSprite.scale.set(0.9, 1.6, 1);
  // castShadow is intentionally NOT set — sprites break shadow maps in HD-2D style
  scene.add(playerSprite);

  const shadowSprite = buildShadowSprite();
  scene.add(shadowSprite);

  // ── Movement ──────────────────────────────────────────────────────────────
  const CAM_FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
  const CAM_RIGHT   = new THREE.Vector3( 1, 0, -1).normalize();

  const moveVec   = new THREE.Vector3();
  const camTarget = new THREE.Vector3();

  // BOUND kept for reference; walls + character controller handle actual clamping
  const BOUND = FLOOR_HALF - 0.5; void BOUND;

  let lastTime = performance.now();

  // ── Proximity state ───────────────────────────────────────────────────────
  // Track which pedestal the player is currently near (null = none)
  let nearestPedestal: PedestalDef | null = null;

  // E key interaction
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'e') return;
    if (!nearestPedestal || isModalOpen) return;
    openModal(nearestPedestal);
  });

  // ── Game Loop ─────────────────────────────────────────────────────────────
  function gameLoop() {
    requestAnimationFrame(gameLoop);

    const now   = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime    = now;

    // Input → desired movement delta for this frame
    // Movement is blocked while a modal is open
    moveVec.set(0, 0, 0);
    if (!isModalOpen) {
      if (keys.w) moveVec.addScaledVector(CAM_FORWARD,  1);
      if (keys.s) moveVec.addScaledVector(CAM_FORWARD, -1);
      if (keys.d) moveVec.addScaledVector(CAM_RIGHT,    1);
      if (keys.a) moveVec.addScaledVector(CAM_RIGHT,   -1);
      if (moveVec.lengthSq() > 0) moveVec.normalize();
    }

    // Desired translation delta this frame (Y = 0, we lock to floor height)
    const desiredMovement = {
      x: moveVec.x * PLAYER_SPEED * delta,
      y: 0,
      z: moveVec.z * PLAYER_SPEED * delta,
    };

    // Let Rapier resolve collisions and slide the capsule along surfaces
    characterController.computeColliderMovement(playerCollider, desiredMovement);
    const corrected = characterController.computedMovement();

    const cur = playerBody.translation();
    playerBody.setNextKinematicTranslation({
      x: cur.x + corrected.x,
      y: PLAYER_START_Y,        // keep locked to floor — no gravity needed for kinematic
      z: cur.z + corrected.z,
    });
    world.step();

    // Sync visuals
    const pos = playerBody.translation();
    playerSprite.position.set(pos.x, pos.y + 0.1, pos.z);
    shadowSprite.position.set(pos.x, 0.02, pos.z);

    // ── Proximity check ───────────────────────────────────────────────────
    // Compare XZ distance only (ignore Y) to each pedestal centre
    let found: PedestalDef | null = null;
    let closestDist = Infinity;

    for (const ped of PEDESTALS) {
      const dx   = pos.x - ped.x;
      const dz   = pos.z - ped.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < PROXIMITY_RADIUS && dist < closestDist) {
        closestDist = dist;
        found = ped;
      }
    }

    if (found !== nearestPedestal) {
      nearestPedestal = found;
      if (found) {
        showPrompt(found.label, found.accent, found.accentRgb);
      } else {
        hidePrompt();
      }
    }

    // Camera follow
    camTarget.set(pos.x + CAM_OFFSET.x, CAM_OFFSET.y, pos.z + CAM_OFFSET.z);
    camera.position.lerp(camTarget, CAM_LERP);
    camera.lookAt(pos.x, 0, pos.z);

    renderer.render(scene, camera);
  }

  gameLoop();
}

start().catch(console.error);
