// main.js - Tofu Drift 3D
import * as THREE from 'three';
import { GAME, COLORS } from './Constants.js';
import { eventBus, EVENTS } from './EventBus.js';
import { gameState } from './GameState.js';

// OpenGameProtocol SDK integration
let ogp = null;
let ogpReady = false;

if (typeof OpenGameSDK !== 'undefined') {
  ogp = new OpenGameSDK({
    ui: { usePointsWidget: true, theme: 'dark' },
    logLevel: 1,
  });
  
  ogp.on('OnReady', () => {
    console.log('OGP SDK ready');
    ogpReady = true;
  });
  
  ogp.on('SavePointsSuccess', () => {
    console.log('Score saved to OGP!');
  });
  
  ogp.on('SavePointsFailed', () => {
    console.log('Failed to save score to OGP');
  });
  
  ogp.init({ gameId: 'e58f4e5e-1491-430f-8e25-88b04c446123' });
}

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app').appendChild(renderer.domElement);

// Gradient sky
const skyGeo = new THREE.SphereGeometry(500, 32, 32);
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    topColor: { value: new THREE.Color(GAME.SKY_TOP_COLOR) },
    bottomColor: { value: new THREE.Color(GAME.SKY_BOTTOM_COLOR) },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
    }
  `,
  side: THREE.BackSide,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// Fog
scene.fog = new THREE.Fog(GAME.FOG_COLOR, GAME.FOG_NEAR, GAME.FOG_FAR);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404050, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Road
function createRoad() {
  const roadGroup = new THREE.Group();
  
  // Main road surface
  const roadGeo = new THREE.PlaneGeometry(GAME.ROAD_WIDTH, GAME.ROAD_LENGTH, 1, GAME.ROAD_SEGMENTS);
  const roadMat = new THREE.MeshStandardMaterial({ color: COLORS.ROAD });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.z = -GAME.ROAD_LENGTH / 2 + 10;
  roadGroup.add(road);
  
  // Center line
  const lineGeo = new THREE.PlaneGeometry(0.15, GAME.ROAD_LENGTH);
  const lineMat = new THREE.MeshBasicMaterial({ color: COLORS.ROAD_LINE });
  const centerLine = new THREE.Mesh(lineGeo, lineMat);
  centerLine.rotation.x = -Math.PI / 2;
  centerLine.position.y = 0.01;
  centerLine.position.z = -GAME.ROAD_LENGTH / 2 + 10;
  roadGroup.add(centerLine);
  
  // Dashed side lines
  for (let side of [-1, 1]) {
    for (let i = 0; i < 20; i++) {
      const dashGeo = new THREE.PlaneGeometry(0.1, 4);
      const dash = new THREE.Mesh(dashGeo, lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(side * (GAME.ROAD_WIDTH / 2 - 0.5), 0.01, -i * 10);
      roadGroup.add(dash);
    }
  }
  
  return roadGroup;
}

const road = createRoad();
scene.add(road);

// Player car (AE86-inspired)
function createCar() {
  const carGroup = new THREE.Group();
  
  // Body
  const bodyGeo = new THREE.BoxGeometry(
    GAME.PLAYER_SIZE.width,
    GAME.PLAYER_SIZE.height,
    GAME.PLAYER_SIZE.depth
  );
  const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.CAR_BODY });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = GAME.PLAYER_SIZE.height / 2;
  carGroup.add(body);
  
  // Roof
  const roofGeo = new THREE.BoxGeometry(
    GAME.PLAYER_SIZE.width * 0.8,
    GAME.PLAYER_SIZE.height * 0.6,
    GAME.PLAYER_SIZE.depth * 0.5
  );
  const roofMat = new THREE.MeshStandardMaterial({ color: COLORS.CAR_ROOF });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = GAME.PLAYER_SIZE.height + 0.2;
  roof.position.z = -0.2;
  carGroup.add(roof);
  
  // Headlights
  const lightGeo = new THREE.BoxGeometry(0.2, 0.15, 0.05);
  const lightMat = new THREE.MeshBasicMaterial({ color: COLORS.HEADLIGHT });
  for (let x of [-0.4, 0.4]) {
    const headlight = new THREE.Mesh(lightGeo, lightMat);
    headlight.position.set(x, 0.3, -GAME.PLAYER_SIZE.depth / 2);
    carGroup.add(headlight);
  }
  
  // Taillights
  const tailMat = new THREE.MeshBasicMaterial({ color: COLORS.TAILLIGHT });
  for (let x of [-0.4, 0.4]) {
    const taillight = new THREE.Mesh(lightGeo, tailMat);
    taillight.position.set(x, 0.3, GAME.PLAYER_SIZE.depth / 2);
    carGroup.add(taillight);
  }
  
  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.15, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const wheelPositions = [
    [-0.6, 0.25, -0.6],
    [0.6, 0.25, -0.6],
    [-0.6, 0.25, 0.6],
    [0.6, 0.25, 0.6],
  ];
  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(...pos);
    carGroup.add(wheel);
  });
  
  carGroup.position.y = GAME.PLAYER_Y;
  return carGroup;
}

const player = createCar();
scene.add(player);

// Obstacles
const obstacles = [];

function createObstacle(type) {
  let obstacle;
  
  switch (type) {
    case 'tree':
      obstacle = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8),
        new THREE.MeshStandardMaterial({ color: COLORS.TREE_TRUNK })
      );
      trunk.position.y = 0.75;
      obstacle.add(trunk);
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(1, 2, 8),
        new THREE.MeshStandardMaterial({ color: COLORS.TREE_LEAVES })
      );
      leaves.position.y = 2.5;
      obstacle.add(leaves);
      obstacle.userData = { radius: 0.5, height: 3.5 };
      break;
      
    case 'rock':
      obstacle = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.6),
        new THREE.MeshStandardMaterial({ color: COLORS.ROCK })
      );
      obstacle.position.y = 0.4;
      obstacle.rotation.set(Math.random(), Math.random(), Math.random());
      obstacle.userData = { radius: 0.6, height: 1 };
      break;
      
    case 'cone':
      obstacle = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: COLORS.CONE })
      );
      obstacle.position.y = 0.4;
      obstacle.userData = { radius: 0.3, height: 0.8 };
      break;
  }
  
  obstacle.userData.type = type;
  obstacle.userData.isObstacle = true;
  return obstacle;
}

function spawnObstacle() {
  const type = GAME.OBSTACLE_TYPES[Math.floor(Math.random() * GAME.OBSTACLE_TYPES.length)];
  const obstacle = createObstacle(type);
  
  // Random x position on road
  obstacle.position.x = (Math.random() - 0.5) * (GAME.ROAD_WIDTH - 2);
  obstacle.position.z = -GAME.ROAD_LENGTH / 2;
  obstacle.userData.speed = GAME.OBSTACLE_MIN_SPEED + Math.random() * (GAME.OBSTACLE_MAX_SPEED - GAME.OBSTACLE_MIN_SPEED);
  
  scene.add(obstacle);
  obstacles.push(obstacle);
}

// Tofu collectibles
const tofuBlocks = [];

function createTofuBlock() {
  const tofu = new THREE.Group();
  
  // Main tofu block
  const tofuGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
  const tofuMat = new THREE.MeshStandardMaterial({ 
    color: COLORS.TOFU_BOX,
    emissive: 0x443322,
    emissiveIntensity: 0.2
  });
  const block = new THREE.Mesh(tofuGeo, tofuMat);
  block.position.y = 0.3;
  tofu.add(block);
  
  // Glow ring
  const ringGeo = new THREE.RingGeometry(0.4, 0.5, 16);
  const ringMat = new THREE.MeshBasicMaterial({ 
    color: 0xffdd88, 
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  tofu.add(ring);
  
  tofu.userData = { radius: 0.4, isTofu: true };
  return tofu;
}

function spawnTofu() {
  const tofu = createTofuBlock();
  
  // Random x position on road, avoiding edges
  tofu.position.x = (Math.random() - 0.5) * (GAME.ROAD_WIDTH - 3);
  tofu.position.z = -GAME.ROAD_LENGTH / 2;
  tofu.userData.speed = GAME.OBSTACLE_MIN_SPEED + Math.random() * 0.1;
  
  scene.add(tofu);
  tofuBlocks.push(tofu);
}

// Particles (speed lines)
const particles = [];
function createParticles() {
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(GAME.PARTICLE_COUNT * 3);
  
  for (let i = 0; i < GAME.PARTICLE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = Math.random() * 5 + 0.5;
    positions[i * 3 + 2] = Math.random() * -50;
  }
  
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const particleMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.05,
    transparent: true,
    opacity: 0.6,
  });
  
  const particleSystem = new THREE.Points(particleGeo, particleMat);
  scene.add(particleSystem);
  return particleSystem;
}

const particleSystem = createParticles();

// Input handling
const keys = { left: false, right: false };

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (e.code === 'Space' && !gameState.isPlaying) {
    gameState.start();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

// Touch controls
let touchStartX = 0;
document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  if (!gameState.isPlaying) gameState.start();
});

document.addEventListener('touchmove', (e) => {
  const touchX = e.touches[0].clientX;
  const diff = touchX - touchStartX;
  keys.left = diff < -20;
  keys.right = diff > 20;
});

document.addEventListener('touchend', () => {
  keys.left = false;
  keys.right = false;
});

// Click to start
document.addEventListener('click', () => {
  if (!gameState.isPlaying) gameState.start();
});

// UI
const ui = document.getElementById('ui');
const scoreEl = document.getElementById('score');
const menuEl = document.getElementById('menu');
const finalScoreEl = document.getElementById('final-score');

eventBus.on(EVENTS.SCORE_UPDATE, ({ score }) => {
  scoreEl.textContent = `Tofu: ${score}`;
});

eventBus.on(EVENTS.GAME_START, () => {
  menuEl.style.display = 'none';
  ui.style.display = 'block';
  scoreEl.textContent = 'Tofu: 0';
  
  // Clear obstacles and tofu
  obstacles.forEach(o => scene.remove(o));
  obstacles.length = 0;
  tofuBlocks.forEach(t => scene.remove(t));
  tofuBlocks.length = 0;
  
  // Reset player position
  player.position.x = 0;
  player.rotation.z = 0;
});

eventBus.on(EVENTS.GAME_OVER, async ({ score }) => {
  finalScoreEl.textContent = `You collected ${score} tofu!`;
  menuEl.querySelector('h1').textContent = 'CRASHED!';
  menuEl.querySelector('.subtitle').textContent = 'Click/Tap to try again';
  menuEl.style.display = 'flex';
  
  // Save score to OGP
  if (ogp && ogpReady && score > 0) {
    try {
      await ogp.savePoints(score);
    } catch (err) {
      console.log('OGP save error:', err);
    }
  }
});

// Collision detection
function checkCollision(obj) {
  const dx = player.position.x - obj.position.x;
  const dz = player.position.z - obj.position.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  
  const playerRadius = GAME.PLAYER_SIZE.width / 2;
  const objRadius = obj.userData.radius || 0.5;
  
  return distance < (playerRadius + objRadius);
}

// Camera setup
camera.position.set(0, GAME.CAMERA_HEIGHT, GAME.CAMERA_DISTANCE);
camera.lookAt(0, 0, -GAME.CAMERA_LOOK_AHEAD);

// Animation loop
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);
  frameCount++;
  
  if (gameState.isPlaying) {
    // Player movement
    let lateralVel = 0;
    if (keys.left) lateralVel = GAME.PLAYER_LATERAL_SPEED;
    if (keys.right) lateralVel = -GAME.PLAYER_LATERAL_SPEED;
    
    player.position.x += lateralVel;
    player.position.x = Math.max(-GAME.ROAD_WIDTH / 2 + 1, Math.min(GAME.ROAD_WIDTH / 2 - 1, player.position.x));
    
    // Car tilt on turn
    player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -lateralVel * 3, 0.1);
    
    // Spawn obstacles
    if (frameCount % GAME.OBSTACLE_SPAWN_RATE === 0) {
      spawnObstacle();
    }
    
    // Spawn tofu blocks
    if (frameCount % 45 === 0) { // More frequent than obstacles
      spawnTofu();
    }
    
    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.position.z += obs.userData.speed;
      
      // Remove if past player
      if (obs.position.z > 10) {
        scene.remove(obs);
        obstacles.splice(i, 1);
        continue;
      }
      
      // Collision = game over
      if (checkCollision(obs)) {
        // Screen shake
        camera.position.x = (Math.random() - 0.5) * 0.5;
        camera.position.y = GAME.CAMERA_HEIGHT + (Math.random() - 0.5) * 0.3;
        setTimeout(() => {
          camera.position.x = 0;
          camera.position.y = GAME.CAMERA_HEIGHT;
        }, 150);
        
        gameState.gameOver();
        return;
      }
    }
    
    // Update tofu blocks
    for (let i = tofuBlocks.length - 1; i >= 0; i--) {
      const tofu = tofuBlocks[i];
      tofu.position.z += tofu.userData.speed;
      
      // Spin animation
      tofu.rotation.y += 0.05;
      
      // Remove if past player
      if (tofu.position.z > 10) {
        scene.remove(tofu);
        tofuBlocks.splice(i, 1);
        continue;
      }
      
      // Collect tofu
      if (checkCollision(tofu)) {
        scene.remove(tofu);
        tofuBlocks.splice(i, 1);
        
        // Add points
        gameState.addScore(1);
        
        // OGP points
        if (ogp && ogpReady) {
          ogp.addPoints(1);
        }
      }
    }
    
    // Update particles
    const positions = particleSystem.geometry.attributes.position.array;
    for (let i = 0; i < GAME.PARTICLE_COUNT; i++) {
      positions[i * 3 + 2] += gameState.speed * 2;
      if (positions[i * 3 + 2] > 5) {
        positions[i * 3 + 2] = -50;
        positions[i * 3] = (Math.random() - 0.5) * 20;
      }
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
    
    // Road scroll effect (move road lines)
    road.position.z = (road.position.z + gameState.speed) % 10;
  }
  
  // Camera follow
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.3, 0.05);
  
  renderer.render(scene, camera);
}

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
