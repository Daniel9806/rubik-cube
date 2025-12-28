import * as THREE from 'three';
import confetti from 'https://esm.sh/canvas-confetti@1.6.0';
import { createRubiksCube } from './cube.js';
import { createOrbitCameraController } from './camera.js';
import { createCubeInput } from './input.js';
import { bindUi } from './ui.js';

const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070a12, 10, 30);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
camera.position.set(6.2, 5.2, 7.2);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffffff, 0.85);
key.position.set(6, 10, 7);
scene.add(key);

const fill = new THREE.DirectionalLight(0x8fb3ff, 0.35);
fill.position.set(-9, 2, -6);
scene.add(fill);

const cube = createRubiksCube(scene);

const cameraController = createOrbitCameraController({ canvas, camera });
cameraController.bind();

const input = createCubeInput({ canvas, camera, cube, cameraController });
input.bind();

bindUi({ cube, input, cameraController });

let wasSolved = false;

function fireConfetti() {
  const defaults = { origin: { y: 0.7 } };
  confetti({ ...defaults, particleCount: 120, spread: 70, startVelocity: 45 });
  confetti({ ...defaults, particleCount: 80, spread: 120, startVelocity: 35, scalar: 0.9 });
}

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const need =
    canvas.width !== Math.floor(w * renderer.getPixelRatio()) ||
    canvas.height !== Math.floor(h * renderer.getPixelRatio());
  if (!need) return;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  resize();

  const dt = Math.min(clock.getDelta(), 0.033);
  cube.updateTurn(dt);
  cameraController.update(dt);

  const solved = cube.isSolved();
  if (solved && !wasSolved) {
    fireConfetti();
  }
  wasSolved = solved;

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', resize);
