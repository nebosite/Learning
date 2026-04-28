import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

const canvas = document.getElementById('gravityCanvas');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const bodyCountRange = document.getElementById('bodyCountRange');
const bodyCountValue = document.getElementById('bodyCountValue');
const massScaleRange = document.getElementById('massScaleRange');
const massScaleValue = document.getElementById('massScaleValue');
const trailToggle = document.getElementById('trailToggle');
const velocityToggle = document.getElementById('velocityToggle');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const addBodyButton = document.getElementById('addBodyButton');
const removeBodyButton = document.getElementById('removeBodyButton');
const fpsValue = document.getElementById('fpsValue');
const bodyCountDisplay = document.getElementById('bodyCountDisplay');
const stepValue = document.getElementById('stepValue');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a14);

const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
camera.position.set(0, 40, 110);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 30;
controls.maxDistance = 240;

const ambientLight = new THREE.AmbientLight(0xdbeeff, 0.45);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(30, 50, 20);
scene.add(directionalLight);

const world = new CANNON.World();
world.gravity.set(0, 0, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 12;

const bodies = [];
const PHYSICS_G = 1.4e4;
const fixedTimeStep = 1 / 60;
let lastTimestamp = 0;
let paused = false;
let stepCount = 0;
let fps = 0;
let fpsFrameCount = 0;
let fpsTimer = 0;

const raycaster = new THREE.Raycaster();
const clickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const clickPoint = new THREE.Vector3();

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomColor() {
  return new THREE.Color(`hsl(${Math.round(randomBetween(180, 340))}, 82%, 64%)`);
}

function createBody(position, velocity, massScale = 1) {
  const mass = randomBetween(0.9, 2.8) * massScale;
  const radius = THREE.MathUtils.clamp(mass * 1.8, 1.8, 5.2);
  const shape = new CANNON.Sphere(radius);
  const physicsBody = new CANNON.Body({ mass, shape });
  physicsBody.position.set(position.x, position.y, position.z);
  physicsBody.velocity.set(velocity.x, velocity.y, velocity.z);
  physicsBody.linearDamping = 0.02;
  world.addBody(physicsBody);

  const color = randomColor();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 20), material);
  mesh.position.copy(position);
  scene.add(mesh);

  const trailGeometry = new THREE.BufferGeometry();
  const trailLine = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28 }));
  trailLine.frustumCulled = false;
  scene.add(trailLine);

  const velocityGeometry = new THREE.BufferGeometry();
  velocityGeometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const velocityLine = new THREE.Line(velocityGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
  velocityLine.frustumCulled = false;
  scene.add(velocityLine);

  return {
    body: physicsBody,
    mesh,
    mass,
    radius,
    color,
    trail: [],
    trailLine,
    velocityLine,
  };
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

function spawnBodies(count) {
  removeAllBodies();
  const massScale = parseFloat(massScaleRange.value);
  for (let i = 0; i < count; i += 1) {
    const position = new THREE.Vector3(randomBetween(-36, 36), randomBetween(-28, 28), randomBetween(-24, 24));
    const velocity = new THREE.Vector3(randomBetween(-9, 9), randomBetween(-9, 9), randomBetween(-9, 9));
    bodies.push(createBody(position, velocity, massScale));
  }
  stepCount = 0;
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
      const distSq = Math.max(diff.lengthSquared(), 2.5);
      const dist = Math.sqrt(distSq);
      const forceMag = (PHYSICS_G * itemA.mass * itemB.mass) / distSq;
      diff.scale(forceMag / dist, diff);
      itemA.body.applyForce(diff, posA);
      itemB.body.applyForce(diff.negate(new CANNON.Vec3()), posB);
    }
  }
}

function updateBodyMeshes() {
  bodies.forEach((item) => {
    const position = item.body.position;
    item.mesh.position.set(position.x, position.y, position.z);

    if (trailToggle.checked) {
      item.trail.push(new THREE.Vector3(position.x, position.y, position.z));
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
      const start = new THREE.Vector3(position.x, position.y, position.z);
      const end = new THREE.Vector3(position.x + velocity.x * 0.55, position.y + velocity.y * 0.55, position.z + velocity.z * 0.55);
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
  renderer.render(scene, camera);
}

function updateStats() {
  fpsValue.textContent = Math.round(fps);
  bodyCountDisplay.textContent = bodies.length.toString();
  stepValue.textContent = stepCount.toString();
}

function updateUI() {
  speedValue.textContent = `${parseFloat(speedRange.value).toFixed(1)}x`;
  bodyCountValue.textContent = bodyCountRange.value;
  massScaleValue.textContent = `${parseFloat(massScaleRange.value).toFixed(1)}x`;
}

function addBodyAtPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * 2 - 1;
  const y = -(event.clientY - rect.top) / rect.height * 2 + 1;
  raycaster.setFromCamera({ x, y }, camera);
  raycaster.ray.intersectPlane(clickPlane, clickPoint);
  const position = clickPoint.clone();
  const velocity = new THREE.Vector3(randomBetween(-4, 4), randomBetween(-4, 4), randomBetween(-4, 4));
  bodies.push(createBody(position, velocity, parseFloat(massScaleRange.value)));
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
    applyGravitationalForces();
    world.step(fixedTimeStep * parseFloat(speedRange.value), deltaSeconds, 4);
    updateBodyMeshes();
  }

  fpsFrameCount += 1;
  fpsTimer += deltaSeconds;
  if (fpsTimer >= 0.5) {
    fps = fpsFrameCount / fpsTimer;
    fpsFrameCount = 0;
    fpsTimer = 0;
    updateStats();
  }

  renderScene();
  requestAnimationFrame(animate);
}

speedRange.addEventListener('input', updateUI);
bodyCountRange.addEventListener('input', () => {
  updateUI();
  updateStats();
});
massScaleRange.addEventListener('input', updateUI);
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
  spawnBodies(parseInt(bodyCountRange.value, 10));
});

addBodyButton.addEventListener('click', () => {
  const position = new THREE.Vector3(randomBetween(-18, 18), randomBetween(-18, 18), randomBetween(-18, 18));
  const velocity = new THREE.Vector3(randomBetween(-5, 5), randomBetween(-5, 5), randomBetween(-5, 5));
  bodies.push(createBody(position, velocity, parseFloat(massScaleRange.value)));
  updateStats();
});

removeBodyButton.addEventListener('click', () => {
  const item = bodies.pop();
  if (item) {
    world.removeBody(item.body);
    scene.remove(item.mesh);
    scene.remove(item.trailLine);
    scene.remove(item.velocityLine);
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
  spawnBodies(parseInt(bodyCountRange.value, 10));
  requestAnimationFrame(animate);
}

init();
