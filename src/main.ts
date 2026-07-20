import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

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

// ─── Camera (isometric-style perspective) ────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(10, 10, 10);
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
dirLight.shadow.camera.left = -15;
dirLight.shadow.camera.right = 15;
dirLight.shadow.camera.top = 15;
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

// ─── Physics + Scene bootstrap ───────────────────────────────────────────────
async function start() {
  // 1. Init Rapier WASM
  await RAPIER.init();

  // 2. Create physics world
  const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

  // ── Floor ──────────────────────────────────────────────────────────────────
  // Physics: static rigid body + cuboid collider
  const floorBodyDesc = RAPIER.RigidBodyDesc.fixed();
  const floorBody = world.createRigidBody(floorBodyDesc);
  const floorColliderDesc = RAPIER.ColliderDesc.cuboid(10, 0.25, 10);
  world.createCollider(floorColliderDesc, floorBody);

  // Three.js mesh
  const floorGeo = new THREE.BoxGeometry(20, 0.5, 20);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x334455,
    roughness: 0.8,
    metalness: 0.1,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  floorMesh.position.set(0, -0.25, 0);
  scene.add(floorMesh);

  // Grid helper for visual reference
  const grid = new THREE.GridHelper(20, 20, 0x445566, 0x223344);
  grid.position.y = 0.01;
  scene.add(grid);

  // ── Falling cube ───────────────────────────────────────────────────────────
  // Physics: dynamic rigid body starting at y = 5
  const cubeBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0);
  const cubeBody = world.createRigidBody(cubeBodyDesc);
  const cubeColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
    .setRestitution(0.4)
    .setFriction(0.7);
  world.createCollider(cubeColliderDesc, cubeBody);

  // Three.js mesh
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  const cubeMat = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    roughness: 0.3,
    metalness: 0.6,
    emissive: 0x002233,
  });
  const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
  cubeMesh.castShadow = true;
  cubeMesh.receiveShadow = true;
  scene.add(cubeMesh);

  // ── Game Loop ──────────────────────────────────────────────────────────────
  function gameLoop() {
    requestAnimationFrame(gameLoop);

    // Step physics
    world.step();

    // Sync falling cube: physics → Three.js
    const pos = cubeBody.translation();
    const rot = cubeBody.rotation();

    cubeMesh.position.set(pos.x, pos.y, pos.z);
    cubeMesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    // Render
    renderer.render(scene, camera);
  }

  gameLoop();
}

start().catch(console.error);
