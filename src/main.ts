import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

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

// ─── CSS2D Label Renderer ─────────────────────────────────────────────────────
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';  // Let clicks pass through to the game
labelRenderer.domElement.style.zIndex = '10';  // Above WebGL canvas
document.body.appendChild(labelRenderer.domElement);

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

// Warm fill light from opposite side for softer shadows
const fillLight = new THREE.DirectionalLight(0xffd0a0, 0.25);
fillLight.position.set(-10, 8, -10);
scene.add(fillLight);

// Main sun light will be created dynamically from Dummy_Sphere position

// ─── Resize ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
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
async function loadMedievalTerrain(world: RAPIER.World): Promise<{ 
  scene: THREE.Group; 
  dummyCube: THREE.Object3D | null;
  dummySphere: THREE.Object3D | null;
  aboutStatue: THREE.Object3D | null;
  aboutLabel: CSS2DObject | null;
}> {
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
    if (!dummyCube && child.name.toLowerCase().includes('dummy') && !child.name.toLowerCase().includes('sphere')) {
      dummyCube = child;
    }
  });

  // Find the dummy sphere sun position reference using fuzzy search
  let dummySphere: THREE.Object3D | null = null;
  terrainScene.traverse((child) => {
    if (!dummySphere && child.name.toLowerCase().includes('dummy_sphere')) {
      dummySphere = child;
    }
  });

  // Find the about-statue interaction point and attach 3D label
  let aboutStatue: THREE.Object3D | null = null;
  let aboutLabel: CSS2DObject | null = null;
  
  terrainScene.traverse((child) => {
    if (!aboutStatue && (child.name.toLowerCase().includes('about-statue') || child.name.toLowerCase().includes('about_statue'))) {
      aboutStatue = child;
      
      // Create stylized 3D label with nested structure to avoid transform conflicts
      const labelContainer = document.createElement('div');
      labelContainer.className = 'bruno-label-container';
      labelContainer.innerHTML = `<div class="bruno-label-inner">ABOUT ME <div class="key-indicator">E</div></div>`;
      
      aboutLabel = new CSS2DObject(labelContainer);
      aboutLabel.position.set(1.2, 0.8, 0);  // Lower and to the side of the statue
      aboutStatue.add(aboutLabel);
      
      console.log('Attached 3D label to about-statue');
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

  return { scene: terrainScene, dummyCube, dummySphere, aboutStatue, aboutLabel };
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
  const { scene: terrainScene, dummyCube, dummySphere, aboutStatue, aboutLabel } = await loadMedievalTerrain(world);

  // ── Get About Statue Position ──────────────────────────────────────────────
  const aboutStatuePos = new THREE.Vector3();
  if (aboutStatue) {
    aboutStatue.getWorldPosition(aboutStatuePos);
    console.log('Found about-statue at:', aboutStatuePos);
  } else {
    console.warn('about-statue not found in GLB. Interaction will be disabled.');
  }

  // ── Inject Stylized CSS for 3D Label and Modal ─────────────────────────────
  const style = document.createElement('style');
  style.innerHTML = `
    .bruno-label-container {
      /* Three.js controls this wrapper's transform. Do NOT put scales/rotations here. */
      pointer-events: none;
    }
    .bruno-label-inner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #1a1a1a;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 4px;
      font-family: 'Impact', 'Arial Black', sans-serif;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 2px;
      border: 3px solid #ffffff;
      box-shadow: 4px 4px 0px rgba(0,0,0,0.5);
      transform: scale(0) translateY(20px);
      opacity: 0;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
    }
    .bruno-label-container.visible .bruno-label-inner {
      transform: scale(1) translateY(0px);
      opacity: 1;
    }
    .key-indicator {
      background: #ffffff;
      color: #1a1a1a;
      padding: 2px 8px;
      border-radius: 2px;
      font-weight: bold;
      transform: rotate(5deg);
    }
    .about-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: transparent;
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      pointer-events: none;
    }
    .about-modal {
      background: #1a1a1a;
      color: #f0f0f0;
      border: 6px solid #ffffff;
      border-radius: 12px;
      box-shadow: 15px 15px 0px rgba(0,0,0,0.9);
      width: 95%;
      max-width: 1050px;
      height: auto;
      max-height: 85vh;
      padding: 40px;
      position: relative;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      gap: 50px;
      align-items: center;
      pointer-events: auto;
      overflow-y: auto;
    }
    .about-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: #ffffff;
      color: #1a1a1a;
      border: 5px solid #1a1a1a;
      box-shadow: 5px 5px 0px rgba(0,0,0,0.6);
      width: 60px;
      height: 60px;
      font-family: 'Impact', sans-serif;
      font-size: 28px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .about-close:active {
      transform: translate(5px, 5px);
      box-shadow: 0px 0px 0px rgba(0,0,0,0.6);
    }
    .about-img {
      width: 280px;
      height: 280px;
      background: #2a2a2a;
      border: 6px solid #ffffff;
      object-fit: cover;
      flex-shrink: 0;
      border-radius: 8px;
      box-shadow: 8px 8px 0px rgba(0,0,0,0.5);
    }
    .about-content {
      flex-grow: 1;
    }
    .about-content h1 {
      font-family: 'Impact', sans-serif;
      font-size: 56px;
      margin: 0 0 5px 0;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #ffffff;
      text-shadow: 4px 4px 0px #000;
    }
    .about-content h3 {
      color: #a3a3a3;
      margin: 0 0 25px 0;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 700;
    }
    .about-content p.bio {
      line-height: 1.7;
      font-size: 18px;
      margin-bottom: 25px;
      color: #d1d1d1;
    }
  `;
  document.head.appendChild(style);

  // ── Configure Sun Light from Dummy_Sphere ─────────────────────────────────
  if (dummySphere) {
    console.log('Found sun position anchor:', dummySphere.name);

    // Hide the placeholder sphere
    dummySphere.visible = false;

    // Get world position of the sphere
    const sunPos = new THREE.Vector3();
    dummySphere.getWorldPosition(sunPos);

    // Create directional sun light with warm color
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.5);
    sunLight.position.copy(sunPos);
    
    // Target the center of the village
    sunLight.target.position.set(0, 0, 0);
    scene.add(sunLight.target);

    // Enable shadows with island-wide coverage
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    
    // Large frustum to cover entire island
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.bias = -0.0005;

    scene.add(sunLight);
    console.log('Sun light positioned at:', sunPos);
  } else {
    console.warn('Dummy_Sphere not found. Using default sun light configuration.');
    
    // Fallback sun light
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.5);
    sunLight.position.set(15, 28, 15);
    sunLight.target.position.set(0, 0, 0);
    scene.add(sunLight.target);
    
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.bias = -0.0005;
    
    scene.add(sunLight);
  }

  // ── Extract spawn position and scale from Dummy_Cube ──────────────────────
  let spawnPos: THREE.Vector3;
  let clampedWidth: number;
  let clampedHeight: number;

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
  } else {
    // Fallback: no dummy cube found
    console.warn('Dummy_Cube anchor not found in GLB. Falling back to default spawn/scale.');
    
    spawnPos = new THREE.Vector3(0, 13, 0);  // elevated spawn
    clampedWidth = 0.8;
    clampedHeight = 1.2;
  }

  // Calculate capsule collider dimensions - doubled to match larger character (2x previous size)
  const capsuleRadius = 0.3;      // 2x previous 0.15
  const capsuleHalfHeight = 0.5;  // 2x previous 0.25
  const PLAYER_SPEED = 4.5;       // Faster speed for larger stride

  // Visual offset so character feet sit at bottom of capsule
  const characterYOffset = -(capsuleHalfHeight + capsuleRadius);  // = -0.8

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

  // ── Player Character ──────────────────────────────────────────────────────
  // Load 3D character model with embedded texture
  const characterGltf = await gltfLoader.loadAsync('/models/character-j.glb');
  const characterModel = characterGltf.scene;

  // Apply crisp pixel filtering to embedded texture and enable shadows
  characterModel.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Fix embedded texture filtering for pixel-art style
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial) {
            // Set white base color to avoid tinting
            mat.color.setHex(0xffffff);
            
            // Apply NearestFilter to embedded texture for crisp pixels
            if (mat.map) {
              mat.map.magFilter = THREE.NearestFilter;
              mat.map.minFilter = THREE.NearestFilter;
            }
            
            mat.needsUpdate = true;
          }
        });
      }
    }
  });

  // Scale character up (2x larger than previous 0.35 scale)
  characterModel.scale.set(0.7, 0.7, 0.7);

  scene.add(characterModel);

  // ── Setup Animation System ─────────────────────────────────────────────────
  let mixer: THREE.AnimationMixer | null = null;
  let idleAction: THREE.AnimationAction | null = null;
  let walkAction: THREE.AnimationAction | null = null;
  let activeAction: THREE.AnimationAction | null = null;

  if (characterGltf.animations && characterGltf.animations.length > 0) {
    console.log('Loaded animation clips:', characterGltf.animations.map(a => a.name));
    
    mixer = new THREE.AnimationMixer(characterModel);
    
    // Find idle and walk clips by name keywords
    let idleClip: THREE.AnimationClip | null = null;
    let walkClip: THREE.AnimationClip | null = null;

    for (const clip of characterGltf.animations) {
      const name = clip.name.toLowerCase();
      if (name.includes('idle') && !idleClip) {
        idleClip = clip;
        console.log('Found idle animation:', clip.name);
      } else if ((name.includes('walk') || name.includes('run')) && !walkClip) {
        walkClip = clip;
        console.log('Found walk animation:', clip.name);
      }
    }

    // Fallback to first two animations if keywords not found
    if (!idleClip && characterGltf.animations.length > 0) {
      idleClip = characterGltf.animations[0];
      console.log('Using fallback idle animation:', idleClip.name);
    }
    if (!walkClip && characterGltf.animations.length > 1) {
      walkClip = characterGltf.animations[1];
      console.log('Using fallback walk animation:', walkClip.name);
    }

    // Create actions if clips were found
    if (idleClip) {
      idleAction = mixer.clipAction(idleClip);
      idleAction.play();
      activeAction = idleAction;
    }
    if (walkClip) {
      walkAction = mixer.clipAction(walkClip);
    }
  }

  // Helper function for smooth animation transitions
  function switchAnimation(newAction: THREE.AnimationAction) {
    if (activeAction !== newAction) {
      if (activeAction) {
        activeAction.fadeOut(0.2);
      }
      newAction.reset().fadeIn(0.2).play();
      activeAction = newAction;
    }
  }

  const shadowSprite = buildShadowSprite();
  // Scale shadow proportionally to larger character capsule radius
  shadowSprite.scale.set(capsuleRadius * 3, capsuleRadius * 1.2, 1);
  scene.add(shadowSprite);

  // ── Movement ──────────────────────────────────────────────────────────────
  const CAM_FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
  const CAM_RIGHT   = new THREE.Vector3( 1, 0, -1).normalize();
  const CAMERA_OFFSET = new THREE.Vector3(15, 15, 15);  // isometric offset from player

  const moveVec   = new THREE.Vector3();
  let yVelocity = -0.1;  // small negative to start grounded

  // ── Initial sync: position character model and camera at spawn point ──────
  characterModel.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
  shadowSprite.position.set(spawnPos.x, 0.02, spawnPos.z);
  
  // Position camera at isometric offset looking directly at spawn
  const cameraOffset = spawnPos.clone().add(new THREE.Vector3(15, 15, 15));
  camera.position.copy(cameraOffset);
  camera.lookAt(spawnPos);

  let lastTime = performance.now();

  // ── Create About Me Modal ──────────────────────────────────────────────────
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'about-overlay';
  modalOverlay.id = 'about-modal-overlay';
  modalOverlay.innerHTML = `
    <div class="about-modal">
      <div class="about-close" id="about-close-btn">X</div>
      <img src="/models/profile.jpg" alt="Profile" class="about-img" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMyYTJhMmEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iI2ZmZiIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjI4MHgyODA8L3RleHQ+PC9zdmc+'" />
      <div class="about-content" style="flex-grow: 1; overflow-y: auto; padding-right: 15px;">
        <h1 style="font-family: 'Impact', sans-serif; font-size: 56px; margin: 0 0 5px 0; letter-spacing: 2px; text-transform: uppercase; color: #ffffff; text-shadow: 4px 4px 0px #000;">Anirudh</h1>
        <h3 style="color: #a3a3a3; margin: 0 0 25px 0; font-size: 20px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">[ YOUR AWESOME TAGLINE GOES HERE ]</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 20px;">
          <!-- Column 1: About Me -->
          <div>
            <h4 style="color: #fff; font-family: 'Impact', sans-serif; letter-spacing: 1px; font-size: 22px; margin: 0 0 10px 0; text-transform: uppercase;">About Me</h4>
            <p style="color: #d1d1d1; line-height: 1.7; font-size: 15px; margin: 0;">Welcome to my interactive portfolio. I am passionate about building robust systems from the ground up, directing custom AI-generated cinematic videos, and continuously expanding my technical boundaries.</p>
          </div>
          <!-- Column 2: Experience & Background -->
          <div>
            <h4 style="color: #fff; font-family: 'Impact', sans-serif; letter-spacing: 1px; font-size: 22px; margin: 0 0 10px 0; text-transform: uppercase;">Experience & Background</h4>
            <p style="color: #d1d1d1; line-height: 1.7; font-size: 15px; margin: 0;">Engineering student actively participating in competitive software engineering events like HackToFuture. Experienced in architecting complex data flows, managing multi-container environments, and designing secure backend infrastructure.</p>
          </div>
          <!-- Column 3: Core Skills & Tools -->
          <div>
            <h4 style="color: #fff; font-family: 'Impact', sans-serif; letter-spacing: 1px; font-size: 22px; margin: 0 0 10px 0; text-transform: uppercase;">Core Skills & Tools</h4>
            <ul style="color: #d1d1d1; line-height: 1.8; font-size: 15px; margin: 0; padding-left: 20px;">
              <li>Python & Django</li>
              <li>Docker & Containerization</li>
              <li>PostgreSQL & TimescaleDB</li>
              <li>Firebase Auth</li>
              <li>System Architecture</li>
            </ul>
          </div>
          <!-- Column 4: Interests & Hobbies -->
          <div>
            <h4 style="color: #fff; font-family: 'Impact', sans-serif; letter-spacing: 1px; font-size: 22px; margin: 0 0 10px 0; text-transform: uppercase;">Interests & Hobbies</h4>
            <ul style="color: #d1d1d1; line-height: 1.8; font-size: 15px; margin: 0; padding-left: 20px;">
              <li>AI Media Generation</li>
              <li>[ Placeholder Hobby 1 ]</li>
              <li>[ Placeholder Hobby 2 ]</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  // ── Interaction State ──────────────────────────────────────────────────────
  let canInteractAbout = false;
  let isAboutModalOpen = false;

  // Handle E key interaction
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'e') {
      if (canInteractAbout && !isAboutModalOpen) {
        modalOverlay.style.display = 'flex';
        isAboutModalOpen = true;
      } else if (isAboutModalOpen) {
        modalOverlay.style.display = 'none';
        isAboutModalOpen = false;
      }
    }
  });

  // Handle close button click
  document.getElementById('about-close-btn')!.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    isAboutModalOpen = false;
  });

  // ── Game Loop ─────────────────────────────────────────────────────────────
  function gameLoop() {
    requestAnimationFrame(gameLoop);

    const now   = performance.now();
    const delta = Math.min((now - lastTime) / 1000, 0.05);
    lastTime    = now;

    // Step physics simulation
    world.step();

    // Update animation mixer
    if (mixer) {
      mixer.update(delta);
    }

    // ── Input → Desired Movement ──────────────────────────────────────────
    moveVec.set(0, 0, 0);
    if (keys.w || keys.ArrowUp)    moveVec.addScaledVector(CAM_FORWARD,  1);
    if (keys.s || keys.ArrowDown)  moveVec.addScaledVector(CAM_FORWARD, -1);
    if (keys.d || keys.ArrowRight) moveVec.addScaledVector(CAM_RIGHT,    1);
    if (keys.a || keys.ArrowLeft)  moveVec.addScaledVector(CAM_RIGHT,   -1);
    
    const isMoving = moveVec.lengthSq() > 0;
    if (isMoving) moveVec.normalize();

    // ── Character Animation State ──────────────────────────────────────────
    if (idleAction && walkAction) {
      if (isMoving) {
        switchAnimation(walkAction);
      } else {
        switchAnimation(idleAction);
      }
    }

    // ── Character Rotation ─────────────────────────────────────────────────
    if (isMoving) {
      // Calculate target angle based on movement direction
      const targetAngle = Math.atan2(moveVec.x, moveVec.z);
      // Smoothly interpolate rotation
      characterModel.rotation.y = THREE.MathUtils.lerp(
        characterModel.rotation.y,
        targetAngle,
        0.15  // rotation lerp factor
      );
    }

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

    // Sync character model to physics body position with Y-offset for feet placement
    const pos = playerBody.translation();
    characterModel.position.set(pos.x, pos.y + characterYOffset, pos.z);
    shadowSprite.position.set(pos.x, 0.02, pos.z);

    // ── Proximity Detection for About Statue ───────────────────────────────
    if (aboutStatue && aboutLabel) {
      // Update statue position dynamically every frame
      aboutStatue.getWorldPosition(aboutStatuePos);
      
      const playerPos = new THREE.Vector3(pos.x, pos.y, pos.z);
      const distance = playerPos.distanceTo(aboutStatuePos);
      
      if (distance < 5.0) {  // Interaction radius (slightly larger)
        if (!canInteractAbout) {
          aboutLabel.element.classList.add('visible');
          canInteractAbout = true;
        }
      } else {
        if (canInteractAbout) {
          aboutLabel.element.classList.remove('visible');
          canInteractAbout = false;
        }
      }
    }

    // Camera follow
    const targetCamPos = new THREE.Vector3(
      pos.x + CAMERA_OFFSET.x,
      CAMERA_OFFSET.y,
      pos.z + CAMERA_OFFSET.z
    );
    camera.position.lerp(targetCamPos, CAM_LERP);
    camera.lookAt(pos.x, pos.y, pos.z);

    // Render WebGL scene and CSS2D labels
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  gameLoop();
}

start().catch(console.error);
