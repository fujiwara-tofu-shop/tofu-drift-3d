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

// Collection effects
const collectParticles = [];

function createCollectEffect(position) {
  const particleCount = 20;
  const particles = [];
  
  for (let i = 0; i < particleCount; i++) {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({ 
      color: Math.random() > 0.5 ? 0xffdd88 : 0xffffff,
      transparent: true,
      opacity: 1
    });
    const particle = new THREE.Mesh(geo, mat);
    
    particle.position.copy(position);
    particle.position.y = 0.5;
    
    // Random velocity
    particle.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      Math.random() * 0.2 + 0.1,
      (Math.random() - 0.5) * 0.3
    );
    particle.userData.life = 1.0;
    
    scene.add(particle);
    particles.push(particle);
  }
  
  collectParticles.push(...particles);
}

function createScorePopup(position, points) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffdd44';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`+${points}`, 64, 48);
  
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true,
    opacity: 1 
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(position);
  sprite.position.y = 1;
  sprite.scale.set(1.5, 0.75, 1);
  sprite.userData.velocity = 0.03;
  sprite.userData.life = 1.0;
  
  scene.add(sprite);
  collectParticles.push(sprite);
}

function flashScreen() {
  const flash = document.getElementById('flash');
  if (flash) {
    flash.style.opacity = '0.4';
    setTimeout(() => flash.style.opacity = '0', 100);
  }
}

// Screen shake
let shakeIntensity = 0;
let shakeDecay = 0.9;

function triggerShake(intensity = 0.3) {
  shakeIntensity = intensity;
}

// Audio context for synthesized sounds
let audioCtx = null;
let ambientPlaying = false;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Midnight Tofu Run - Night drive synthwave vibes
function startAmbientSound() {
  if (ambientPlaying) return;
  
  try {
    const ctx = initAudio();
    if (ctx.state === 'suspended') ctx.resume();
    
    ambientPlaying = true;
    
    const BPM = 82; // Night drive tempo
    const beatTime = 60 / BPM;
    const sixteenth = beatTime / 4;
    
    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(ctx.destination);
    
    // Kick drum
    function playKick(time) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
      gain.gain.setValueAtTime(0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(time);
      osc.stop(time + 0.3);
    }
    
    // Snare (noise-based)
    function playSnare(time) {
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1000;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(time);
    }
    
    // Hi-hat
    function playHiHat(time, open = false) {
      const bufferSize = ctx.sampleRate * (open ? 0.2 : 0.05);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, open ? 0.5 : 2);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      
      const gain = ctx.createGain();
      gain.gain.value = open ? 0.15 : 0.12;
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      noise.start(time);
    }
    
    // Bass synth
    const bassGain = ctx.createGain();
    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 300;
    bassFilter.Q.value = 5;
    bassGain.gain.value = 0.35;
    bassFilter.connect(bassGain);
    bassGain.connect(masterGain);
    
    function playBass(time, freq, duration) {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      noteGain.gain.setValueAtTime(0.5, time);
      noteGain.gain.setValueAtTime(0.5, time + duration - 0.05);
      noteGain.gain.exponentialRampToValueAtTime(0.01, time + duration);
      osc.connect(noteGain);
      noteGain.connect(bassFilter);
      osc.start(time);
      osc.stop(time + duration);
    }
    
    // Lo-fi pad
    const padGain = ctx.createGain();
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 600;
    padGain.gain.value = 0.12;
    padFilter.connect(padGain);
    padGain.connect(masterGain);
    
    const padNotes = [164.81, 196, 246.94, 293.66]; // E3, G3, B3, D4 (Em7)
    padNotes.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(padFilter);
      osc.start();
      
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 1.005; // Slight detune
      osc2.connect(padFilter);
      osc2.start();
    });
    
    // Synthwave lead
    function playLead(time, freq) {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc.frequency.value = freq;
      osc2.frequency.value = freq * 1.005;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, time);
      filter.frequency.exponentialRampToValueAtTime(500, time + beatTime * 2);
      filter.Q.value = 3;
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + beatTime * 2);
      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      osc.start(time);
      osc2.start(time);
      osc.stop(time + beatTime * 2);
      osc2.stop(time + beatTime * 2);
    }
    
    // Beat pattern - Night drive vibes
    const bassPattern = [55, 55, 82.41, 73.42, 55, 55, 82.41, 61.74];
    const leadNotes = [329.63, 392, 493.88, 440, 392, 329.63, 293.66, 329.63];
    let barIndex = 0;
    let stepIndex = 0;
    
    function scheduleBar(startTime) {
      if (!ambientPlaying) return;
      
      const bassNote = bassPattern[stepIndex % bassPattern.length];
      
      // Beat 1 - Kick
      playKick(startTime);
      playHiHat(startTime);
      playBass(startTime, bassNote, beatTime * 0.9);
      
      // Synthwave lead every 4 bars
      if (stepIndex % 4 === 0) {
        playLead(startTime, leadNotes[(stepIndex / 4) % leadNotes.length]);
      }
      
      // 1-and - Hi-hat
      playHiHat(startTime + beatTime * 0.5);
      
      // Beat 2 - Snare + Hi-hat
      playSnare(startTime + beatTime);
      playHiHat(startTime + beatTime);
      
      // 2-and - Kick + Hi-hat
      playKick(startTime + beatTime * 1.5);
      playHiHat(startTime + beatTime * 1.5);
      
      // Beat 3 - Kick + Hi-hat
      playKick(startTime + beatTime * 2);
      playHiHat(startTime + beatTime * 2);
      playBass(startTime + beatTime * 2, bassNote * 1.5, beatTime * 0.9);
      
      // 3-and - Hi-hat
      playHiHat(startTime + beatTime * 2.5);
      
      // Beat 4 - Snare + Hi-hat
      playSnare(startTime + beatTime * 3);
      playHiHat(startTime + beatTime * 3, true); // Open hat
      
      // 4-and - Kick
      playKick(startTime + beatTime * 3.5);
      
      stepIndex++;
      
      // Schedule next bar
      setTimeout(() => {
        scheduleBar(ctx.currentTime);
      }, beatTime * 4 * 1000 - 50);
    }
    
    // Start the beat
    scheduleBar(ctx.currentTime + 0.1);
    
  } catch (e) {
    console.log('Ambient audio error:', e);
  }
}

function playCollectSound() {
  try {
    const ctx = initAudio();
    if (ctx.state === 'suspended') ctx.resume();
    
    // Create a nice "ding" sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Quick ascending arpeggio
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.05); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1); // G5
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialDecayTo && gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // Audio not supported or blocked
  }
}

function playCrashSound() {
  try {
    const ctx = initAudio();
    if (ctx.state === 'suspended') ctx.resume();
    
    // Noise burst for crash
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    
    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    noise.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    
    noise.start();
  } catch (e) {
    // Audio not supported
  }
}

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

// Touch controls - hold left/right side of screen
let activeTouches = new Map();

document.addEventListener('touchstart', (e) => {
  e.preventDefault();
  
  // Start game on any touch if not playing
  if (!gameState.isPlaying) {
    gameState.start();
    return;
  }
  
  // Track all active touches
  for (const touch of e.changedTouches) {
    const x = touch.clientX;
    const screenHalf = window.innerWidth / 2;
    activeTouches.set(touch.identifier, x < screenHalf ? 'left' : 'right');
  }
  
  updateTouchDirection();
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  e.preventDefault();
  
  // Update touch positions (in case finger slides across center)
  for (const touch of e.changedTouches) {
    if (activeTouches.has(touch.identifier)) {
      const x = touch.clientX;
      const screenHalf = window.innerWidth / 2;
      activeTouches.set(touch.identifier, x < screenHalf ? 'left' : 'right');
    }
  }
  
  updateTouchDirection();
}, { passive: false });

document.addEventListener('touchend', (e) => {
  // Remove ended touches
  for (const touch of e.changedTouches) {
    activeTouches.delete(touch.identifier);
  }
  
  updateTouchDirection();
});

document.addEventListener('touchcancel', (e) => {
  // Remove cancelled touches
  for (const touch of e.changedTouches) {
    activeTouches.delete(touch.identifier);
  }
  
  updateTouchDirection();
});

function updateTouchDirection() {
  // Check what sides are being touched
  let hasLeft = false;
  let hasRight = false;
  
  for (const side of activeTouches.values()) {
    if (side === 'left') hasLeft = true;
    if (side === 'right') hasRight = true;
  }
  
  // If touching both sides, cancel out (go straight)
  // Otherwise, set direction
  keys.left = hasLeft && !hasRight;
  keys.right = hasRight && !hasLeft;
}

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
  
  // Start ambient cyberpunk atmosphere
  startAmbientSound();
  
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
    if (keys.left) lateralVel = -GAME.PLAYER_LATERAL_SPEED;
    if (keys.right) lateralVel = GAME.PLAYER_LATERAL_SPEED;
    
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
        triggerShake(0.8);
        playCrashSound();
        
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
        // Spawn effects at tofu position before removing
        createCollectEffect(tofu.position.clone());
        createScorePopup(tofu.position.clone(), 1);
        flashScreen();
        triggerShake(0.15);
        playCollectSound();
        
        // Scale bounce on player car
        player.scale.set(1.1, 1.1, 1.1);
        setTimeout(() => player.scale.set(1, 1, 1), 100);
        
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
    
    // Update collection particles
    for (let i = collectParticles.length - 1; i >= 0; i--) {
      const p = collectParticles[i];
      p.userData.life -= 0.03;
      
      if (p.userData.life <= 0) {
        scene.remove(p);
        collectParticles.splice(i, 1);
        continue;
      }
      
      // Update position
      if (p.userData.velocity instanceof THREE.Vector3) {
        // Particle burst
        p.position.add(p.userData.velocity);
        p.userData.velocity.y -= 0.01; // gravity
        p.rotation.x += 0.1;
        p.rotation.y += 0.1;
      } else {
        // Score popup - float up
        p.position.y += p.userData.velocity;
      }
      
      // Fade out
      if (p.material) {
        p.material.opacity = p.userData.life;
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
  let targetCamX = player.position.x * 0.3;
  let targetCamY = GAME.CAMERA_HEIGHT;
  
  // Apply screen shake
  if (shakeIntensity > 0.01) {
    targetCamX += (Math.random() - 0.5) * shakeIntensity;
    targetCamY += (Math.random() - 0.5) * shakeIntensity * 0.5;
    shakeIntensity *= shakeDecay;
  }
  
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 0.1);
  camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.1);
  
  renderer.render(scene, camera);
}

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
