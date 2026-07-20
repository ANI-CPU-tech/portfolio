import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer }  from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GLTFLoader }      from 'three/examples/jsm/loaders/GLTFLoader.js';

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
// Tone-mapping required for bloom to look correct
renderer.toneMapping        = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// ─── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a0f, 0.025);

// ─── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.copy(CAM_OFFSET);
camera.lookAt(0, 0, 0);

// ─── Post-processing composer ─────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6,   // strength
  0.4,   // radius
  0.2,   // threshold – only pixels brighter than this bloom
);
composer.addPass(bloomPass);

// OutputPass applies tone-mapping & colour-space conversion as the final step
composer.addPass(new OutputPass());

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
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.resolution.set(window.innerWidth, window.innerHeight);
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
const modalLinkBtn      = document.getElementById('project-link')        as HTMLAnchorElement;

let isModalOpen = false;

function openModal(ped: { label: string; description: string; url: string; accent: string; accentRgb: string }) {
  modalTitle.textContent       = ped.label;
  modalDescription.textContent = ped.description;
  modalLinkBtn.href            = ped.url;
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

// ─── GLTF loader (singleton) ──────────────────────────────────────────────────
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

// Shared texture palette for all GLTF models
const paletteTexture = textureLoader.load('/models/colormap.png');
paletteTexture.flipY      = false;                // GLTF models use lower-left origin
paletteTexture.colorSpace = THREE.SRGBColorSpace; // proper color interpretation

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

/**
 * Load a GLB asset, enable shadows on all meshes, position + scale it,
 * then auto-fit a static Rapier cuboid collider from its bounding box.
 *
 * The collider centre is placed at the bounding-box centre of the scaled model
 * so it matches the visual exactly regardless of the GLB's internal pivot.
 */
async function loadModelWithPhysics(
  world:    RAPIER.World,
  url:      string,
  position: THREE.Vector3,
  scale:    number,
): Promise<THREE.Group> {
  const gltf  = await gltfLoader.loadAsync(url);
  const model = gltf.scene;

  model.scale.setScalar(scale);
  model.position.copy(position);

  // Enable shadows on every mesh in the hierarchy + apply shared texture
  model.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;

      // Apply the shared colormap palette texture
      if (mesh.material) {
        // Handle both single materials and material arrays
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
            mat.map = paletteTexture;
            mat.needsUpdate = true;
          }
        });
      }
    }
  });

  scene.add(model);

  // ── Bounding-box physics collider ──────────────────────────────────────
  // Must compute AFTER scale + position are applied so Box3 is in world space.
  const box    = new THREE.Box3().setFromObject(model);
  const size   = new THREE.Vector3();
  const centre = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(centre);

  // Rapier cuboid takes half-extents
  const hx = size.x / 2;
  const hy = size.y / 2;
  const hz = size.z / 2;

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(centre.x, centre.y, centre.z)
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);

  return model;
}

// ─── Pedestal data ────────────────────────────────────────────────────────────
interface PedestalDef {
  label:       string;
  description: string;
  url:         string;
  model:       string;   // path served from /public/models/
  modelScale:  number;   // uniform scale applied to the GLB
  color:       number;
  accent:      string;
  accentRgb:   string;
  x:           number;
  z:           number;
}

const PEDESTALS: PedestalDef[] = [
  {
    label:       'Aegis',
    description: 'A cybersecurity project focused on continuous identity verification for zero trust environments.',
    url:         'https://github.com/ANI-CPU-tech',
    model:       '/models/building-type-a.glb',
    modelScale:  1.5,
    color: 0x1a6fff, accent: '#1a6fff', accentRgb: '26,111,255',
    x: -10, z: -10,
  },
  {
    label:       'Agent OPSYN',
    description: 'An AI-powered developer operations assistant featuring a four-zone architecture, originally built for a hackathon submission.',
    url:         'https://github.com/ANI-CPU-tech',
    model:       '/models/building-type-b.glb',
    modelScale:  1.5,
    color: 0xff3d6e, accent: '#ff3d6e', accentRgb: '255,61,110',
    x:  10, z: -10,
  },
  {
    label:       'FitGyldrah',
    description: 'A robust backend gym management system built with Python, Django, and PostgreSQL.',
    url:         'https://github.com/ANI-CPU-tech',
    model:       '/models/tree-large.glb',
    modelScale:  2.0,
    color: 0x2ecc71, accent: '#2ecc71', accentRgb: '46,204,113',
    x: -10, z:  10,
  },
  {
    label:       'About Me',
    description: 'I am an engineering student with a passion for software development, technical hackathons, and community tech projects. My stack includes Python, Django, Docker, and experimenting with local LLMs via Ollama.',
    url:         'https://github.com/ANI-CPU-tech',
    model:       '/models/planter.glb',
    modelScale:  2.5,
    color: 0xf5a623, accent: '#f5a623', accentRgb: '245,166,35',
    x:  10, z:  10,
  },
];

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

  // ── Atmospheric dust particles ────────────────────────────────────────────
  const PARTICLE_COUNT = 500;
  const dustPositions  = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    dustPositions[i * 3 + 0] = (Math.random() - 0.5) * FLOOR_HALF * 2; // X: ±20
    dustPositions[i * 3 + 1] =  Math.random() * 10;                     // Y:  0–10
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * FLOOR_HALF * 2; // Z: ±20
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

  const dustMat = new THREE.PointsMaterial({
    color:       0xffffff,
    size:        0.1,
    transparent: true,
    opacity:     0.45,
    depthWrite:  false,           // don't occlude geometry behind particles
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(dustGeo, dustMat);
  scene.add(particles);

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

  // ── Zone models (GLTF) + labels + lights ─────────────────────────────────
  // Load all four models in parallel; each call also creates the physics collider.
  await Promise.all(PEDESTALS.map(async (ped) => {
    const position = new THREE.Vector3(ped.x, 0, ped.z);

    // Load model + physics — loadModelWithPhysics measures the real bounding box
    // after scaling and places a static Rapier cuboid collider to match.
    const model = await loadModelWithPhysics(world, ped.model, position, ped.modelScale);

    // Measure the loaded model's bounding box so we can float the label/light
    // the right distance above its actual top face.
    const box    = new THREE.Box3().setFromObject(model);
    const top    = box.max.y;          // world-space Y of the model's top
    const centre = new THREE.Vector3();
    box.getCenter(centre);

    // Floating label sprite — 1.1 units above the model top
    const label = buildLabelSprite(ped.label, ped.accent);
    label.position.set(centre.x, top + 1.1, centre.z);
    scene.add(label);

    // Glow point light — 0.5 units above the model top, no shadows (perf)
    const pLight = new THREE.PointLight(ped.color, 1.2, 8);
    pLight.position.set(centre.x, top + 0.5, centre.z);
    scene.add(pLight);
  }));

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

    // Slowly rotate dust particles for a drifting atmosphere
    particles.rotation.y += 0.0005;

    // Post-processed render (bloom → output)
    composer.render();
  }

  gameLoop();
}

start().catch(console.error);
