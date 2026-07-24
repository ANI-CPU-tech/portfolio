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
const PLAYER_START_X    = 0;      // spawn in village center
const PLAYER_START_Y    = 10;     // spawn elevated, let gravity settle onto terrain
const PLAYER_START_Z    = 0;

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

// ─── GLTF loader (singleton) ──────────────────────────────────────────────────
const gltfLoader = new GLTFLoader();

/**
 * Load the medieval castle terrain level with trimesh physics.
 * Returns the loaded scene and creates a single static trimesh collider for terrain traversal.
 */
async function loadMedievalTerrain(world: RAPIER.World): Promise<THREE.Group> {
  const gltf = await gltfLoader.loadAsync('/models/medieval_castle_with_village.glb');
  const terrainScene = gltf.scene;

  // Enable shadows on all meshes
  terrainScene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  scene.add(terrainScene);

  // ── Extract geometry for Rapier trimesh collider ──────────────────────────
  // Collect all vertices and indices from every mesh in the terrain
  const allVertices: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  terrainScene.traverse((node) => {
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

  // Create single static trimesh collider for entire terrain
  if (allVertices.length > 0 && allIndices.length > 0) {
    const vertices = new Float32Array(allVertices);
    const indices = new Uint32Array(allIndices);

    const trimeshCollider = RAPIER.ColliderDesc.trimesh(vertices, indices);
    const terrainBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(trimeshCollider, terrainBody);
  }

  return terrainScene;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function start() {
  await RAPIER.init();

  const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

  // Character controller – offset 0.01 keeps the shape slightly away from surfaces
  // to avoid getting stuck in micro-gaps between colliders.
  const characterController = world.createCharacterController(0.01);
  
  // Enable terrain traversal features
  characterController.enableAutostep(0.3, 0.1, true);           // handles steps and path edges
  characterController.enableSnapToGround(0.4);                   // prevents floating on slopes
  characterController.setMaxSlopeClimbAngle(45 * (Math.PI / 180)); // allows walking up hills to 45°

  // ── Load medieval castle & village terrain ────────────────────────────────
  await loadMedievalTerrain(world);

  // ── Player Physics ────────────────────────────────────────────────────────
  const playerBodyDesc = RAPIER.RigidBodyDesc
    .kinematicPositionBased()
    .setTranslation(PLAYER_START_X, PLAYER_START_Y, PLAYER_START_Z);
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

  // ── Initial sync: position sprites and camera at spawn point ─────────────
  playerSprite.position.set(PLAYER_START_X, PLAYER_START_Y + 0.1, PLAYER_START_Z);
  shadowSprite.position.set(PLAYER_START_X, 0.02, PLAYER_START_Z);
  camera.position.set(
    PLAYER_START_X + CAM_OFFSET.x,
    CAM_OFFSET.y,
    PLAYER_START_Z + CAM_OFFSET.z
  );
  camera.lookAt(PLAYER_START_X, 0, PLAYER_START_Z);

  let lastTime = performance.now();

  // ── Game Loop ─────────────────────────────────────────────────────────────
  function gameLoop() {
    requestAnimationFrame(gameLoop);

    const now   = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime    = now;

    // Input → desired movement delta for this frame
    moveVec.set(0, 0, 0);
    if (keys.w) moveVec.addScaledVector(CAM_FORWARD,  1);
    if (keys.s) moveVec.addScaledVector(CAM_FORWARD, -1);
    if (keys.d) moveVec.addScaledVector(CAM_RIGHT,    1);
    if (keys.a) moveVec.addScaledVector(CAM_RIGHT,   -1);
    if (moveVec.lengthSq() > 0) moveVec.normalize();

    // Desired translation delta this frame (gravity handled by character controller)
    const desiredMovement = {
      x: moveVec.x * PLAYER_SPEED * delta,
      y: -9.81 * delta,  // gravity factor
      z: moveVec.z * PLAYER_SPEED * delta,
    };

    // Let Rapier resolve collisions and slide the capsule along surfaces
    characterController.computeColliderMovement(playerCollider, desiredMovement);
    const corrected = characterController.computedMovement();

    const cur = playerBody.translation();
    playerBody.setNextKinematicTranslation({
      x: cur.x + corrected.x,
      y: cur.y + corrected.y,   // use corrected Y to allow settling and ground snapping
      z: cur.z + corrected.z,
    });
    world.step();

    // Sync visuals
    const pos = playerBody.translation();
    playerSprite.position.set(pos.x, pos.y + 0.1, pos.z);
    shadowSprite.position.set(pos.x, 0.02, pos.z);

    // Camera follow
    camera.position.lerp(
      new THREE.Vector3(pos.x + CAM_OFFSET.x, CAM_OFFSET.y, pos.z + CAM_OFFSET.z),
      CAM_LERP
    );
    camera.lookAt(pos.x, 0, pos.z);

    // Post-processed render (bloom → output)
    composer.render();
  }

  gameLoop();
}

start().catch(console.error);
