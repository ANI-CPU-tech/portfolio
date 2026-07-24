import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader }      from 'three/examples/jsm/loaders/GLTFLoader.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const CAM_OFFSET        = new THREE.Vector3(5, 5, 5);  // closer camera for smaller scale
const CAM_LERP          = 0.08;

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
const keys: Record<string, boolean> = { 
  w: false, a: false, s: false, d: false,
  ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
};
window.addEventListener('keydown', (e) => { 
  const k = e.key;
  if (k.toLowerCase() in keys || k in keys) {
    keys[k.toLowerCase()] = true;
    keys[k] = true;
  }
});
window.addEventListener('keyup', (e) => { 
  const k = e.key;
  if (k.toLowerCase() in keys || k in keys) {
    keys[k.toLowerCase()] = false;
    keys[k] = false;
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

// ─── GLTF loader (singleton) ──────────────────────────────────────────────────
const gltfLoader = new GLTFLoader();

/**
 * Load the medieval castle terrain level with trimesh physics.
 * Returns the loaded scene and creates a single static trimesh collider for terrain traversal.
 */
async function loadMedievalTerrain(world: RAPIER.World): Promise<{ scene: THREE.Group; dummyCube: THREE.Object3D | null }> {
  const gltf = await gltfLoader.loadAsync('/models/medieval_castle_with_village.glb');
  const terrainScene = gltf.scene;

  // Enable shadows on all meshes and disable emissive materials
  terrainScene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Strip emissive glow from environment materials
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        });
      }
    }
  });

  scene.add(terrainScene);

  // Find the dummy cube spawn/scale reference using fuzzy search
  let dummyCube: THREE.Object3D | null = null;
  terrainScene.traverse((child) => {
    if (!dummyCube && child.name.toLowerCase().includes('dummy')) {
      dummyCube = child;
    }
  });

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

  return { scene: terrainScene, dummyCube };
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
  const { scene: terrainScene, dummyCube } = await loadMedievalTerrain(world);

  // ── Extract spawn position and scale from Dummy_Cube ──────────────────────
  let spawnPos: THREE.Vector3;
  let clampedWidth: number;
  let clampedHeight: number;
  let PLAYER_SPEED: number;

  if (dummyCube) {
    // Found the dummy anchor!
    console.log('Found dummy anchor:', dummyCube.name);

    // Hide the dummy cube (it's just a spawn/scale reference)
    dummyCube.visible = false;

    // Get world-space bounding box and size
    const box = new THREE.Box3().setFromObject(dummyCube);
    const cubeSize = box.getSize(new THREE.Vector3());
    spawnPos = new THREE.Vector3();
    dummyCube.getWorldPosition(spawnPos);

    // Offset spawn position: half cube height + extra elevation to prevent spawn-in-floor snag
    spawnPos.y += (cubeSize.y / 2) + 3.0;

    // Clamp the measured dimensions to sane bounds
    clampedWidth = Math.min(Math.max(cubeSize.x, 0.4), 2.5);
    clampedHeight = Math.min(Math.max(cubeSize.y, 0.6), 3.0);

    // Scale movement speed proportionally to character height
    PLAYER_SPEED = clampedHeight * 3;
  } else {
    // Fallback: no dummy cube found
    console.warn('Dummy_Cube anchor not found in GLB. Falling back to default spawn/scale.');
    
    spawnPos = new THREE.Vector3(0, 13, 0);  // elevated spawn
    clampedWidth = 0.8;
    clampedHeight = 1.2;
    PLAYER_SPEED = 3.6;  // 1.2 * 3
  }

  // Calculate capsule collider dimensions from clamped scale
  const capsuleRadius = clampedWidth / 2;
  const capsuleHalfHeight = Math.max(0.05, (clampedHeight - clampedWidth) / 2);

  // ── Player Physics ────────────────────────────────────────────────────────
  const playerBodyDesc = RAPIER.RigidBodyDesc
    .kinematicPositionBased()
    .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z);
  const playerBody     = world.createRigidBody(playerBodyDesc);
  // Capsule sized to match clamped dimensions
  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(capsuleHalfHeight, capsuleRadius),
    playerBody
  );

  // ── Player Sprite ─────────────────────────────────────────────────────────
  const playerSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: buildPlayerTexture(),
      transparent: true,
      alphaTest: 0.05,
      sizeAttenuation: true,
    }),
  );
  // Scale sprite to clamped dimensions
  playerSprite.scale.set(clampedWidth, clampedHeight, 1);
  // castShadow is intentionally NOT set — sprites break shadow maps in HD-2D style
  scene.add(playerSprite);

  const shadowSprite = buildShadowSprite();
  // Scale shadow proportionally to character width
  shadowSprite.scale.set(clampedWidth * 1.2, clampedWidth * 0.4, 1);
  scene.add(shadowSprite);

  // ── Movement ──────────────────────────────────────────────────────────────
  const CAM_FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
  const CAM_RIGHT   = new THREE.Vector3( 1, 0, -1).normalize();
  const CAMERA_OFFSET = new THREE.Vector3(15, 15, 15);  // isometric offset from player

  const moveVec   = new THREE.Vector3();
  let yVelocity = -0.1;  // small negative to start grounded

  // ── Initial sync: position sprites and camera at spawn point ─────────────
  playerSprite.position.set(spawnPos.x, spawnPos.y + 0.1, spawnPos.z);
  shadowSprite.position.set(spawnPos.x, 0.02, spawnPos.z);
  
  // Position camera at isometric offset looking directly at spawn
  const cameraOffset = spawnPos.clone().add(new THREE.Vector3(15, 15, 15));
  camera.position.copy(cameraOffset);
  camera.lookAt(spawnPos);

  let lastTime = performance.now();

  // ── Game Loop ─────────────────────────────────────────────────────────────
  function gameLoop() {
    requestAnimationFrame(gameLoop);

    const now   = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime    = now;

    // Step physics simulation
    world.step();

    // ── Input → Desired Movement ──────────────────────────────────────────
    moveVec.set(0, 0, 0);
    if (keys.w || keys.ArrowUp)    moveVec.addScaledVector(CAM_FORWARD,  1);
    if (keys.s || keys.ArrowDown)  moveVec.addScaledVector(CAM_FORWARD, -1);
    if (keys.d || keys.ArrowRight) moveVec.addScaledVector(CAM_RIGHT,    1);
    if (keys.a || keys.ArrowLeft)  moveVec.addScaledVector(CAM_RIGHT,   -1);
    if (moveVec.lengthSq() > 0) moveVec.normalize();

    // ── Gravity ────────────────────────────────────────────────────────────
    const isGrounded = characterController.computedGrounded();
    if (isGrounded) {
      // Snap to ground with small negative velocity
      yVelocity = -0.1;
    } else {
      // Apply gravity when airborne
      yVelocity -= 9.81 * delta;
    }

    // ── Desired Movement (XZ horizontal + Y gravity) ──────────────────────
    const desiredMovement = {
      x: moveVec.x * PLAYER_SPEED * delta,
      y: yVelocity * delta,
      z: moveVec.z * PLAYER_SPEED * delta,
    };

    // Let Rapier character controller resolve collisions and slopes
    characterController.computeColliderMovement(playerCollider, desiredMovement);
    const corrected = characterController.computedMovement();

    // Apply corrected movement to kinematic body
    const cur = playerBody.translation();
    playerBody.setNextKinematicTranslation({
      x: cur.x + corrected.x,
      y: cur.y + corrected.y,
      z: cur.z + corrected.z,
    });

    // Sync visuals
    const pos = playerBody.translation();
    playerSprite.position.set(pos.x, pos.y + 0.1, pos.z);
    shadowSprite.position.set(pos.x, 0.02, pos.z);

    // Camera follow
    const targetCamPos = new THREE.Vector3(
      pos.x + CAMERA_OFFSET.x,
      CAMERA_OFFSET.y,
      pos.z + CAMERA_OFFSET.z
    );
    camera.position.lerp(targetCamPos, CAM_LERP);
    camera.lookAt(pos.x, pos.y, pos.z);

    // Post-processed render (bloom → output)
    renderer.render(scene, camera);
  }

  gameLoop();
}

start().catch(console.error);
