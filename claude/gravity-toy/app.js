import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

const canvas = document.getElementById('gravityCanvas');
const starMassRange = document.getElementById('starMassRange');
const starMassValue = document.getElementById('starMassValue');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const bodyCountRange = document.getElementById('bodyCountRange');
const bodyCountValue = document.getElementById('bodyCountValue');
const trailToggle = document.getElementById('trailToggle');
const velocityToggle = document.getElementById('velocityToggle');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const addBodyButton = document.getElementById('addBodyButton');
const removeBodyButton = document.getElementById('removeBodyButton');
const fpsValue = document.getElementById('fpsValue');
const bodyCountDisplay = document.getElementById('bodyCountDisplay');
const stepValue = document.getElementById('stepValue');
const speedDisplay = document.getElementById('speedDisplay');
const zoomDisplay = document.getElementById('zoomDisplay');


// Physical constants (SI units: kg, m, s)
const GRAV_CONSTANT = 6.674e-11; // m³/(kg·s²)
const SOLAR_MASS_KG = 1.989e30; // kg
const AU_METERS = 1.496e11; // meters
const SECONDS_PER_DAY = 86400; // seconds
const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY; // seconds

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a14);

const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.001, 1000); // Near/far in AU
camera.position.set(0, 2, 10); // Position in AU
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.01; // Minimum zoom in AU
controls.maxDistance = 1000; // Maximum zoom in AU
controls.target.set(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0xdbeeff, 0.45);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(30, 50, 20);
scene.add(directionalLight);

const world = new CANNON.World();
world.gravity.set(0, 0, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 12;

world.addEventListener('beginContact', (event) => {
  const bodyA = event.bodyA;
  const bodyB = event.bodyB;
  const itemA = bodies.find(item => item.body === bodyA);
  const itemB = bodies.find(item => item.body === bodyB);
  if (itemA && itemB) {
    // Defer merge to avoid modifying array during iteration
    pendingMerges.push({ itemA, itemB });
  }
});

const bodies = [];
const fixedTimeStep = 1 / 60; // seconds per physics frame
let lastTimestamp = 0;
let accumulatedRealTime = 0; // real seconds
let simulationTime = 0; // simulated seconds
let paused = false;
let stepCount = 0;
let fps = 0;
let fpsFrameCount = 0;
let fpsTimer = 0;
const pendingMerges = [];

const raycaster = new THREE.Raycaster();
const clickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const clickPoint = new THREE.Vector3();

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomColor() {
  return new THREE.Color(`hsl(${Math.round(randomBetween(180, 340))}, 82%, 64%)`);
}

function createAstronomicalBody(position, velocity, massKg, type) {
  const density = type === 'star' ? 1408 : type === 'planet' ? 5514 : 600; // kg/m³
  const volume = massKg / density;
  const radius = Math.cbrt(volume * 3 / (4 * Math.PI));
  const shape = new CANNON.Sphere(Math.max(radius, 1e6));
  const physicsBody = new CANNON.Body({ mass: massKg, shape });
  physicsBody.position.set(position.x, position.y, position.z);
  physicsBody.velocity.set(velocity.x, velocity.y, velocity.z);
  physicsBody.linearDamping = 0.001;
  world.addBody(physicsBody);

  // Create mesh with AU-scale radius (minimum 1 AU for visibility)
  const radiusAU = Math.max(radius / AU_METERS, 1.0);
  const color = type === 'star' ? new THREE.Color(0xffd700) : type === 'planet' ? new THREE.Color(0x4a90e2) : new THREE.Color(0x8b4513);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radiusAU, 16, 12), material);
  // Position will be set in updateBodyMeshes
  mesh.position.set(0, 0, 0);
  scene.add(mesh);

  const trailGeometry = new THREE.BufferGeometry();
  const trailLine = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 }));
  trailLine.frustumCulled = false;
  scene.add(trailLine);

  const velocityGeometry = new THREE.BufferGeometry();
  velocityGeometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const velocityLine = new THREE.Line(velocityGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
  velocityLine.frustumCulled = false;
  scene.add(velocityLine);

  return {
    body: physicsBody,
    mesh,
    mass: massKg,
    radius,
    color,
    type,
    trail: [],
    trailLine,
    velocityLine,
  };
}

function removeBody(item) {
  world.removeBody(item.body);
  scene.remove(item.mesh);
  scene.remove(item.trailLine);
  scene.remove(item.velocityLine);
}

function mergeBodies(itemA, itemB) {
  // Determine which is larger
  const larger = itemA.mass > itemB.mass ? itemA : itemB;
  const smaller = itemA.mass > itemB.mass ? itemB : itemA;

  // Calculate new mass
  const newMass = larger.mass + smaller.mass;

  // Calculate new position (center of mass)
  const totalMass = newMass;
  const newPos = new CANNON.Vec3();
  newPos.x = (larger.body.position.x * larger.mass + smaller.body.position.x * smaller.mass) / totalMass;
  newPos.y = (larger.body.position.y * larger.mass + smaller.body.position.y * smaller.mass) / totalMass;
  newPos.z = (larger.body.position.z * larger.mass + smaller.body.position.z * smaller.mass) / totalMass;

  // Calculate new velocity (momentum conservation)
  const newVel = new CANNON.Vec3();
  newVel.x = (larger.body.velocity.x * larger.mass + smaller.body.velocity.x * smaller.mass) / totalMass;
  newVel.y = (larger.body.velocity.y * larger.mass + smaller.body.velocity.y * smaller.mass) / totalMass;
  newVel.z = (larger.body.velocity.z * larger.mass + smaller.body.velocity.z * smaller.mass) / totalMass;

  // Update larger body
  larger.mass = newMass;
  larger.body.mass = newMass;
  const density = larger.type === 'star' ? 1408 : larger.type === 'planet' ? 5514 : 600;
  const volume = newMass / density;
  const newRadius = Math.cbrt(volume * 3 / (4 * Math.PI));
  larger.radius = Math.max(newRadius, 1e6);
  larger.body.shapes[0].radius = larger.radius;

  // Update mesh geometry to new AU-scale radius
  const newRadiusAU = Math.max(newRadius / AU_METERS, 1.0);
  larger.mesh.geometry = new THREE.SphereGeometry(newRadiusAU, 16, 12);

  larger.body.position.copy(newPos);
  larger.body.velocity.copy(newVel);
  // Position will be updated in updateBodyMeshes

  // Clear trails
  larger.trail.length = 0;
  larger.trailLine.geometry.setFromPoints([]);

  // Remove smaller body
  const index = bodies.indexOf(smaller);
  if (index > -1) {
    bodies.splice(index, 1);
  }
  removeBody(smaller);
}

function removeAllBodies() {
  bodies.forEach((item) => {
    world.removeBody(item.body);
    scene.remove(item.mesh);
    scene.remove(item.trailLine);
    scene.remove(item.velocityLine);
  });
  bodies.length = 0;
}

function spawnSolarSystem() {
  removeAllBodies();
  const starMassSolar = parseFloat(starMassRange.value);
  const starMassKg = starMassSolar * SOLAR_MASS_KG;
  const totalBodies = parseInt(bodyCountRange.value, 10);

  // Create star at center
  const star = createAstronomicalBody(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), starMassKg, 'star');
  bodies.push(star);

  // Create planets (about 20% of bodies)
  const numPlanets = Math.max(1, Math.floor(totalBodies * 0.2));
  for (let i = 0; i < numPlanets; i += 1) {
    const distanceAU = randomBetween(0.5, 5);
    const distanceM = distanceAU * AU_METERS;
    const angle = randomBetween(0, Math.PI * 2);
    const height = randomBetween(-0.1 * distanceM, 0.1 * distanceM);
    const position = new THREE.Vector3(Math.cos(angle) * distanceM, height, Math.sin(angle) * distanceM);
    
    // Orbital velocity: v = sqrt(G * M / r)
    const orbitalSpeed = Math.sqrt(GRAV_CONSTANT * starMassKg / distanceM);
    const velocity = new THREE.Vector3(-Math.sin(angle) * orbitalSpeed, 0, Math.cos(angle) * orbitalSpeed);
    
    // Planet mass: 0.3 to 3 Earth masses
    const planetMassKg = randomBetween(0.3, 3) * 5.972e24; // Earth mass
    const planet = createAstronomicalBody(position, velocity, planetMassKg, 'planet');
    bodies.push(planet);
  }

  // Create comets (rest of bodies)
  const numComets = totalBodies - 1 - numPlanets;
  for (let i = 0; i < numComets; i += 1) {
    const positionAU = [randomBetween(-30, 30), randomBetween(-10, 10), randomBetween(-30, 30)];
    const position = new THREE.Vector3(positionAU[0] * AU_METERS, positionAU[1] * AU_METERS, positionAU[2] * AU_METERS);
    const velocityMs = [randomBetween(-1e4, 1e4), randomBetween(-1e4, 1e4), randomBetween(-1e4, 1e4)];
    const velocity = new THREE.Vector3(velocityMs[0], velocityMs[1], velocityMs[2]);
    const cometMassKg = randomBetween(1e20, 1e21); // Small asteroids
    const comet = createAstronomicalBody(position, velocity, cometMassKg, 'comet');
    bodies.push(comet);
  }

  stepCount = 0;
  simulationTime = 0;
  updateStats();
}

function applyGravitationalForces() {
  const n = bodies.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const itemA = bodies[i];
      const itemB = bodies[j];
      const posA = itemA.body.position;
      const posB = itemB.body.position;
      const diff = new CANNON.Vec3();
      posB.vsub(posA, diff);
      const distSq = Math.max(diff.lengthSquared(), 1e12); // Minimum distance to avoid singularity
      const dist = Math.sqrt(distSq);
      const forceMag = (GRAV_CONSTANT * itemA.mass * itemB.mass) / distSq;
      diff.scale(forceMag / dist, diff);
      itemA.body.applyForce(diff, posA);
      itemB.body.applyForce(diff.negate(new CANNON.Vec3()), posB);
    }
  }
}

function updateBodyMeshes() {
  bodies.forEach((item) => {
    const position = item.body.position;
    // Convert position from meters to AU for rendering
    const positionAU = new THREE.Vector3(
      position.x / AU_METERS,
      position.y / AU_METERS,
      position.z / AU_METERS
    );
    item.mesh.position.copy(positionAU);

    // Convert radius from meters to AU with minimum size of 1 AU
    const radiusAU = Math.max(item.radius / AU_METERS, 1.0);
    item.mesh.scale.setScalar(radiusAU);

    if (trailToggle.checked) {
      // Convert trail positions to AU
      const trailPointAU = new THREE.Vector3(
        position.x / AU_METERS,
        position.y / AU_METERS,
        position.z / AU_METERS
      );
      item.trail.push(trailPointAU);
      if (item.trail.length > 45) {
        item.trail.shift();
      }
      if (item.trail.length > 1) {
        item.trailLine.geometry.setFromPoints(item.trail);
        item.trailLine.visible = true;
      }
    } else {
      item.trail.length = 0;
      item.trailLine.visible = false;
    }

    if (velocityToggle.checked) {
      const velocity = item.body.velocity;
      const start = new THREE.Vector3(position.x / AU_METERS, position.y / AU_METERS, position.z / AU_METERS);
      // Scale velocity vector for visibility (convert to AU/day for display)
      const velocityScale = 86400 / AU_METERS; // Convert m/s to AU/day
      const end = new THREE.Vector3(
        start.x + velocity.x * velocityScale,
        start.y + velocity.y * velocityScale,
        start.z + velocity.z * velocityScale
      );
      item.velocityLine.geometry.setFromPoints([start, end]);
      item.velocityLine.visible = true;
    } else {
      item.velocityLine.visible = false;
    }
  });
}

function resizeRenderer() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width * window.devicePixelRatio || canvas.height !== height * window.devicePixelRatio) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function renderScene() {
  resizeRenderer();
  controls.update();
  renderer.clear();
  renderer.render(scene, camera);
}

function updateStats() {
  fpsValue.textContent = Math.round(fps);
  bodyCountDisplay.textContent = bodies.length.toString();
  stepValue.textContent = stepCount.toString();
}

function updateZoomAndSpeed() {
  // Calculate view width in AU based on camera distance
  const cameraDistance = camera.position.length(); // Already in AU
  const fovRad = camera.fov * Math.PI / 180;
  const viewHeight = 2 * cameraDistance * Math.tan(fovRad / 2);
  const aspectRatio = canvas.clientWidth / canvas.clientHeight;
  const viewWidth = viewHeight * aspectRatio;
  zoomDisplay.textContent = viewWidth.toFixed(2);

  // Calculate simulation speed in days per second
  if (accumulatedRealTime > 0) {
    const daysPerSecond = simulationTime / SECONDS_PER_DAY / accumulatedRealTime;
    speedDisplay.textContent = daysPerSecond.toFixed(4);
  }
}

function updateUI() {
  starMassValue.textContent = `${parseFloat(starMassRange.value).toFixed(1)}`;
  speedValue.textContent = `${parseFloat(speedRange.value).toFixed(1)}x`;
  bodyCountValue.textContent = bodyCountRange.value;
}

function addBodyAtPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * 2 - 1;
  const y = -(event.clientY - rect.top) / rect.height * 2 + 1;
  raycaster.setFromCamera({ x, y }, camera);
  raycaster.ray.intersectPlane(clickPlane, clickPoint);
  const position = clickPoint.clone();
  const velocityMs = [randomBetween(-1e4, 1e4), randomBetween(-1e4, 1e4), randomBetween(-1e4, 1e4)];
  const velocity = new THREE.Vector3(velocityMs[0], velocityMs[1], velocityMs[2]);
  const cometMassKg = randomBetween(1e20, 1e21);
  bodies.push(createAstronomicalBody(position, velocity, cometMassKg, 'comet'));
  updateStats();
}

function animate(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }

  const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.033);
  lastTimestamp = timestamp;

  if (!paused) {
    stepCount += 1;
    const speedFactor = parseFloat(speedRange.value);
    const physicsTimeStep = fixedTimeStep * speedFactor;
    simulationTime += physicsTimeStep;
    accumulatedRealTime += deltaSeconds;
    applyGravitationalForces();
    world.step(physicsTimeStep, deltaSeconds, 4);
    // Process deferred merges after physics step
    while (pendingMerges.length > 0) {
      const merge = pendingMerges.shift();
      mergeBodies(merge.itemA, merge.itemB);
    }
    updateBodyMeshes();
  }

  fpsFrameCount += 1;
  fpsTimer += deltaSeconds;
  if (fpsTimer >= 0.5) {
    fps = fpsFrameCount / fpsTimer;
    fpsFrameCount = 0;
    fpsTimer = 0;
    updateStats();
    updateZoomAndSpeed();
  }

  renderScene();
  requestAnimationFrame(animate);
}

starMassRange.addEventListener('input', () => {
  starMassValue.textContent = `${parseFloat(starMassRange.value).toFixed(1)}`;
});
speedRange.addEventListener('input', updateUI);
bodyCountRange.addEventListener('input', () => {
  updateUI();
  updateStats();
});
trailToggle.addEventListener('change', () => {
  if (!trailToggle.checked) {
    bodies.forEach((item) => {
      item.trail.length = 0;
      item.trailLine.visible = false;
    });
  }
});

pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
});

resetButton.addEventListener('click', () => {
  spawnSolarSystem();
  // Reset camera to good viewing position in AU
  camera.position.set(0, 2, 10);
  controls.target.set(0, 0, 0);
  controls.update();
});

addBodyButton.addEventListener('click', () => {
  const positionAU = [randomBetween(-30, 30), randomBetween(-10, 10), randomBetween(-30, 30)];
  const position = new THREE.Vector3(positionAU[0] * AU_METERS, positionAU[1] * AU_METERS, positionAU[2] * AU_METERS);
  const velocityMs = [randomBetween(-1e4, 1e4), randomBetween(-1e4, 1e4), randomBetween(-1e4, 1e4)];
  const velocity = new THREE.Vector3(velocityMs[0], velocityMs[1], velocityMs[2]);
  const cometMassKg = randomBetween(1e20, 1e21);
  bodies.push(createAstronomicalBody(position, velocity, cometMassKg, 'comet'));
  updateStats();
});

removeBodyButton.addEventListener('click', () => {
  const item = bodies.pop();
  if (item) {
    removeBody(item);
  }
  updateStats();
});

canvas.addEventListener('click', (event) => {
  if (event.target === canvas) {
    addBodyAtPointer(event);
  }
});

window.addEventListener('resize', () => {
  resizeRenderer();
});

function init() {
  updateUI();
  spawnSolarSystem();
  requestAnimationFrame(animate);
}

init();
