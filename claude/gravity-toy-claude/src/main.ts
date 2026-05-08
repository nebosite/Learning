import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const viewport = canvas.parentElement as HTMLElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(devicePixelRatio);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1e6);
camera.position.set(0, 30, 80);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const sunLight = new THREE.PointLight(0xfffbe0, 2, 0, 2);
scene.add(sunLight);

const starGeo = new THREE.SphereGeometry(3, 32, 32);
const starMat = new THREE.MeshStandardMaterial({ color: 0xffee88, emissive: 0xffaa00, emissiveIntensity: 1 });
scene.add(new THREE.Mesh(starGeo, starMat));

function resize(): void {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(viewport);
resize();

function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
