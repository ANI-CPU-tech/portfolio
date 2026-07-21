import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { EffectComposer }  from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GLTFLoader }      from 'three/examples/jsm/loaders/GLTFLoader.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_SPEED      = 3.5;    // walking pace for smaller character
const CAM_OFFSET        = new THREE.Vector3(5, 5, 5);  // closer camera for smaller scale
const CAM_LERP          = 0.08;
const PLAYER_START_Y    = 0.24;   // capsule height is ~0.48, centre at 0.24
const PROXIMITY_RADIUS  = 1.8;    // close interaction distance

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
 * Load a GLB asset, enable shadows on all meshes, position + scale + rotate it,
 * then auto-fit a static Rapier cuboid collider from its bounding box.
 *
 * The collider centre is placed at the bounding-box centre of the scaled model
 * so it matches the visual exactly regardless of the GLB's internal pivot.
 */
async function loadModelWithPhysics(
  world:     RAPIER.World,
  url:       string,
  position:  THREE.Vector3,
  scale:     number,
  rotationY: number = 0,
): Promise<THREE.Group> {
  const gltf  = await gltfLoader.loadAsync(url);
  const model = gltf.scene;

  model.scale.setScalar(scale);
  model.position.copy(position);
  model.rotation.y = rotationY;  // Apply rotation BEFORE bounding box calculation

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
  // Must compute AFTER scale + position + rotation so Box3 is in world space.
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

/**
 * Load the custom Blender-authored city level with trimesh physics.
 * Returns the loaded scene and creates a single static trimesh collider.
 */
async function loadBlenderLevel(world: RAPIER.World): Promise<THREE.Group> {
  const gltf = await gltfLoader.loadAsync('/models/custom-city.glb');
  const levelScene = gltf.scene;

  // Apply shared texture palette and enable shadows on all meshes
  levelScene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Apply colormap texture
      if (mesh.material) {
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

  scene.add(levelScene);

  // ── Extract geometry for Rapier trimesh collider ──────────────────────────
  // Collect all vertices and indices from every mesh in the level
  const allVertices: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  levelScene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      const geometry = mesh.geometry;

      // Apply world matrix to get vertices in world space
      mesh.updateWorldMatrix(true, false);
      const positionAttr = geometry.getAttribute('position');

      if (positionAttr) {
        const vertex = new THREE.Vector3();
        for (let i = 0; i < positionAttr.count; i++) {
          vertex.fromBufferAttribute(positionAttr, i);
          vertex.applyMatrix4(mesh.matrixWorld);
          allVertices.push(vertex.x, vertex.y, vertex.z);
        }

        // Collect indices
        const index = geometry.index;
        if (index) {
          for (let i = 0; i < index.count; i++) {
            allIndices.push(index.array[i] + vertexOffset);
          }
        } else {
          // Non-indexed geometry: create sequential indices
          for (let i = 0; i < positionAttr.count; i++) {
            allIndices.push(vertexOffset + i);
          }
        }

        vertexOffset += positionAttr.count;
      }
    }
  });

  // Create single static trimesh collider for entire level
  if (allVertices.length > 0 && allIndices.length > 0) {
    const vertices = new Float32Array(allVertices);
    const indices = new Uint32Array(allIndices);

    const trimeshCollider = RAPIER.ColliderDesc.trimesh(vertices, indices);
    const levelBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(trimeshCollider, levelBody);
  }

  return levelScene;
}

// ─── Interactive zone data ───────────────────────────────────────────────────
interface PedestalDef {
  label:       string;
  description: string;
  url:         string;
  x:           number;
  z:           number;
  y:           number;   // height for floating label
  color:       number;
  accent:      string;
  accentRgb:   string;
}

// Single interactive zone positioned in the Blender level's courtyard
const PEDESTALS: PedestalDef[] = [
  {
    label:       'Agent OPSYN',
    description: 'An AI-powered developer operations assistant featuring a four-zone architecture, originally built for a hackathon submission.',
    url:         'https://github.com/ANI-CPU-tech',
    x: 0,        // centred in courtyard
    z: 0,
    y: 2.5,      // floating label height
    color: 0xff3d6e, accent: '#ff3d6e', accentRgb: '255,61,110',
  },
];

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function start() {
  await RAPIER.init();

  const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

  // Character controller – offset 0.01 keeps the shape slightly away from surfaces
  // to avoid getting stuck in micro-gaps between colliders.
  const characterController = world.createCharacterController(0.01);
  
  // Enable autostep to climb small curbs/road edges (maxHeight 0.25, minWidth 0.05)
  characterController.enableAutostep(0.25, 0.05, true);
  // Snap to ground to prevent floating on uneven surfaces
  characterController.enableSnapToGround(0.2);

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

  // ── Load Blender-authored level ───────────────────────────────────────────
  await loadBlenderLevel(world);

  // ── Interactive zone markers ──────────────────────────────────────────────
  // Add floating labels and glow lights for each interactive zone
  PEDESTALS.forEach((ped) => {
    // Floating label sprite
    const label = buildLabelSprite(ped.label, ped.accent);
    label.position.set(ped.x, ped.y, ped.z);
    scene.add(label);

    // Glow point light
    const pLight = new THREE.PointLight(ped.color, 1.5, 10);
    pLight.position.set(ped.x, ped.y - 0.5, ped.z);
    scene.add(pLight);
  });

  // ── Player Physics ────────────────────────────────────────────────────────
  const playerBodyDesc = RAPIER.RigidBodyDesc
    .kinematicPositionBased()
    .setTranslation(0, PLAYER_START_Y, 0);
  const playerBody     = world.createRigidBody(playerBodyDesc);
  // Smaller capsule: radius 0.12, halfHeight 0.12 → total height ~0.48 units
  const playerCollider = world.createCollider(RAPIER.ColliderDesc.capsule(0.12, 0.12), playerBody);

  // ── Player Sprite ─────────────────────────────────────────────────────────
  const playerSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: buildPlayerTexture(),
      transparent: true,
      alphaTest: 0.05,
      sizeAttenuation: true,
    }),
  );
  // Scaled down to fit the smaller character (width 0.35, height 0.6)
  playerSprite.scale.set(0.35, 0.6, 1);
  // castShadow is intentionally NOT set — sprites break shadow maps in HD-2D style
  scene.add(playerSprite);

  const shadowSprite = buildShadowSprite();
  // Scale shadow to match smaller character
  shadowSprite.scale.set(0.4, 0.15, 1);
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
