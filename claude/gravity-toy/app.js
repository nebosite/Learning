const canvas = document.getElementById('gravityCanvas');
const ctx = canvas.getContext('2d');

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

const G = 200;
const bodies = [];
let lastTimestamp = 0;
let accumulatedTime = 0;
let paused = false;
let stepCount = 0;
let fps = 0;
let fpsFrameCount = 0;
let fpsTimer = 0;
let activeDrag = null;
let pointerOffset = { x: 0, y: 0 };

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * window.devicePixelRatio);
  canvas.height = Math.floor(rect.height * window.devicePixelRatio);
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function createBody(x, y, massScale = 1) {
  const mass = random(4, 14) * massScale;
  const radius = Math.max(3, Math.min(18, mass));
  return {
    x,
    y,
    vx: random(-20, 20),
    vy: random(-20, 20),
    mass,
    radius,
    color: `hsl(${Math.round(random(180, 320))}, 85%, 60%)`,
    trail: [],
  };
}

function resetSimulation() {
  bodies.length = 0;
  const defaultCount = parseInt(bodyCountRange.value, 10);
  for (let i = 0; i < defaultCount; i += 1) {
    bodies.push(createBody(random(100, canvas.width / window.devicePixelRatio - 100), random(100, canvas.height / window.devicePixelRatio - 100), parseFloat(massScaleRange.value)));
  }
  stepCount = 0;
  updateStats();
}

function updateStats() {
  fpsValue.textContent = Math.round(fps);
  bodyCountDisplay.textContent = bodies.length.toString();
  stepValue.textContent = stepCount.toString();
}

function getBodyAt(x, y) {
  for (let i = bodies.length - 1; i >= 0; i -= 1) {
    const body = bodies[i];
    const dx = x - body.x;
    const dy = y - body.y;
    if (Math.hypot(dx, dy) < body.radius + 5) {
      return body;
    }
  }
  return null;
}

function simulateStep(delta) {
  const dt = delta * parseFloat(speedRange.value);
  const massScale = parseFloat(massScaleRange.value);

  for (let i = 0; i < bodies.length; i += 1) {
    const bodyA = bodies[i];
    let ax = 0;
    let ay = 0;

    for (let j = 0; j < bodies.length; j += 1) {
      if (i === j) continue;
      const bodyB = bodies[j];
      const dx = bodyB.x - bodyA.x;
      const dy = bodyB.y - bodyA.y;
      const distSq = Math.max(dx * dx + dy * dy, 25);
      const dist = Math.sqrt(distSq);
      const force = (G * bodyA.mass * bodyB.mass * massScale) / distSq;
      ax += (force / bodyA.mass) * (dx / dist);
      ay += (force / bodyA.mass) * (dy / dist);
    }

    bodyA.vx += ax * dt * 0.001;
    bodyA.vy += ay * dt * 0.001;
  }

  for (const body of bodies) {
    body.x += body.vx * dt * 0.05;
    body.y += body.vy * dt * 0.05;

    if (trailToggle.checked) {
      body.trail.push({ x: body.x, y: body.y });
      if (body.trail.length > 40) {
        body.trail.shift();
      }
    } else {
      body.trail.length = 0;
    }

    if (body.x < -50) body.x = canvas.width / window.devicePixelRatio + 50;
    if (body.x > canvas.width / window.devicePixelRatio + 50) body.x = -50;
    if (body.y < -50) body.y = canvas.height / window.devicePixelRatio + 50;
    if (body.y > canvas.height / window.devicePixelRatio + 50) body.y = -50;
  }

  stepCount += 1;
}

function renderFrame() {
  const width = canvas.width / window.devicePixelRatio;
  const height = canvas.height / window.devicePixelRatio;
  ctx.clearRect(0, 0, width, height);

  if (trailToggle.checked) {
    ctx.lineWidth = 1;
    for (const body of bodies) {
      if (body.trail.length < 2) continue;
      ctx.strokeStyle = `${body.color}33`;
      ctx.beginPath();
      ctx.moveTo(body.trail[0].x, body.trail[0].y);
      for (let i = 1; i < body.trail.length; i += 1) {
        ctx.lineTo(body.trail[i].x, body.trail[i].y);
      }
      ctx.stroke();
    }
  }

  for (const body of bodies) {
    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
    ctx.fill();

    if (velocityToggle.checked) {
      ctx.strokeStyle = '#ffffffaa';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(body.x, body.y);
      ctx.lineTo(body.x + body.vx * 0.5, body.y + body.vy * 0.5);
      ctx.stroke();
    }
  }
}

function updateUI() {
  speedValue.textContent = `${parseFloat(speedRange.value).toFixed(1)}x`;
  bodyCountValue.textContent = bodyCountRange.value;
  massScaleValue.textContent = `${parseFloat(massScaleRange.value).toFixed(1)}x`;
}

function animate(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }

  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  if (!paused) {
    accumulatedTime += delta;
    const stepTime = 16.7;
    while (accumulatedTime >= stepTime) {
      simulateStep(stepTime);
      accumulatedTime -= stepTime;
    }
    renderFrame();
  }

  fpsFrameCount += 1;
  fpsTimer += delta;
  if (fpsTimer >= 500) {
    fps = (fpsFrameCount / fpsTimer) * 1000;
    fpsFrameCount = 0;
    fpsTimer = 0;
    updateStats();
  }

  requestAnimationFrame(animate);
}

function onPointerDown(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left);
  const y = (event.clientY - rect.top);
  const body = getBodyAt(x, y);

  if (body) {
    activeDrag = body;
    pointerOffset.x = body.x - x;
    pointerOffset.y = body.y - y;
  } else {
    bodies.push(createBody(x, y, parseFloat(massScaleRange.value)));
    updateStats();
  }
}

function onPointerMove(event) {
  if (!activeDrag) return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left);
  const y = (event.clientY - rect.top);
  activeDrag.x = x + pointerOffset.x;
  activeDrag.y = y + pointerOffset.y;
}

function onPointerUp() {
  activeDrag = null;
}

speedRange.addEventListener('input', updateUI);
bodyCountRange.addEventListener('input', () => {
  updateUI();
  bodyCountDisplay.textContent = bodyCountRange.value;
});
massScaleRange.addEventListener('input', updateUI);
trailToggle.addEventListener('change', () => {
  if (!trailToggle.checked) {
    for (const body of bodies) {
      body.trail.length = 0;
    }
  }
});
velocityToggle.addEventListener('change', renderFrame);

pauseButton.addEventListener('click', () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
});

resetButton.addEventListener('click', () => {
  resetSimulation();
});

addBodyButton.addEventListener('click', () => {
  bodies.push(createBody(canvas.width / window.devicePixelRatio / 2, canvas.height / window.devicePixelRatio / 2, parseFloat(massScaleRange.value)));
  updateStats();
});

removeBodyButton.addEventListener('click', () => {
  bodies.pop();
  updateStats();
});

canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('resize', () => {
  resizeCanvas();
  renderFrame();
});

function init() {
  resizeCanvas();
  updateUI();
  resetSimulation();
  requestAnimationFrame(animate);
}

init();
