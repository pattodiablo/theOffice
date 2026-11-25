import * as THREE from 'three';
import { Z, W, D, $ } from './Constants.js';
import { G } from './Game.js';
import { CAM_PLAY_HALF, CAM_WALK_ZOOM, CAM_ZOOM_SPEED, ASSEMBLE_ZOOM } from '../Settings.js';

// Motor: renderer, escena 3D, cámara isométrica, luces y bucle de juego.
export let renderer, scene, cam;
export const stage = $('#stage');
const target = new THREE.Vector3(64, 6, -52), CENTER = target.clone(), camGoal = new THREE.Vector3();
let sun;
export const CAM_OFF = new THREE.Vector3(160, 135, 160);   // dirección de la cámara (isométrica, fija)
// vista del editor: se puede girar con el botón derecho (el juego siempre usa la vista isométrica fija)
const BASE_YAW = Math.atan2(CAM_OFF.x, CAM_OFF.z), BASE_PITCH = Math.asin(CAM_OFF.y / CAM_OFF.length()), CAM_DIST = CAM_OFF.length();
let viewYaw = BASE_YAW, viewPitch = BASE_PITCH;
const editOff = new THREE.Vector3();
export function rotateView(dx, dy) {               // dx, dy en píxeles arrastrados
  viewYaw -= dx * .008; viewPitch = Math.min(1.45, Math.max(.2, viewPitch + dy * .006));
}
export function resetView() { viewYaw = BASE_YAW; viewPitch = BASE_PITCH; }

export function initEngine() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);              // fondo transparente: detrás se ve la lluvia de código
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x03140a, 240, 420);    // lo lejano se hunde en verde oscuro
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
  cam.position.copy(target).add(CAM_OFF); cam.lookAt(target);
  scene.add(new THREE.HemisphereLight(0xc4ffd6, 0x0d2a18, 1.7));
  sun = new THREE.DirectionalLight(0xe2ffe9, 2.1);
  sun.position.set(130, 140, 20); sun.target.position.set(64, 0, -52); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.4;
  new ResizeObserver(resize).observe(stage); resize();
}

// editor: toda la oficina · jugando: cámara cerca que sigue al jugador
export function resize() {
  const w = stage.clientWidth, h = stage.clientHeight, a = w / h; renderer.setSize(w, h, false);
  const k = Math.max(W / 128, D / 104);              // el editor encuadra el nivel completo según su tamaño
  const half = G.mode === 'edit' ? (a < 1.25 ? 94 / a : 76) * k : (a < 1 ? CAM_PLAY_HALF * .9 / a : CAM_PLAY_HALF);
  cam.left = -half * a; cam.right = half * a; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
}

// sigue al jugador; zoom de la intro y al caminar
// el editor movió el contenido del nivel (al agrandarlo por la izquierda o el fondo): mueve la cámara igual
export function shiftView(dx, dy) { target.x += dx; target.z -= dy; }
let sized = '';
function fitWorld() {                                // centro del nivel y sombras según su tamaño
  CENTER.set(W / 2, 6, -D / 2); const k = Math.max(W / 128, D / 104) * 110;
  sun.target.position.set(W / 2, 0, -D / 2); sun.position.set(W / 2 + 66, 140, -D / 2 + 72);
  Object.assign(sun.shadow.camera, { left: -k, right: k, top: k, bottom: -k, far: 300 + k * 2 }); sun.shadow.camera.updateProjectionMatrix();
  resize();
}
export function updateCamera(dt, player) {
  if (sized !== W + 'x' + D) { sized = W + 'x' + D; fitWorld(); }
  if (G.mode === 'edit') camGoal.copy(CENTER); else camGoal.set(player.x, Z + 6, -player.y);
  const zoomGoal = G.asm >= 0 ? ASSEMBLE_ZOOM : G.intro >= 0 ? (G.intro < (G.entOk ? 2.4 : 2.7) ? 1.4 : 1) : G.mode === 'play' && player.moving ? CAM_WALK_ZOOM : 1;
  cam.zoom = G.snapCam ? zoomGoal : cam.zoom + (zoomGoal - cam.zoom) * Math.min(1, dt * CAM_ZOOM_SPEED); cam.updateProjectionMatrix();
  target.lerp(camGoal, G.snapCam ? 1 : Math.min(1, dt * 6)); G.snapCam = false;
  if (G.mode === 'edit') editOff.set(Math.sin(viewYaw) * Math.cos(viewPitch), Math.sin(viewPitch), Math.cos(viewYaw) * Math.cos(viewPitch)).multiplyScalar(CAM_DIST);
  cam.position.copy(target).add(G.mode === 'edit' ? editOff : CAM_OFF); cam.lookAt(target);
  if (G.shake > 0) {                                 // sacudón (al ser atrapado)
    cam.position.x += (Math.random() - .5) * G.shake * 2; cam.position.y += (Math.random() - .5) * G.shake * 2;
    G.shake = Math.max(0, G.shake - dt * 4);
  }
}

export const render = () => renderer.render(scene, cam);

// bucle: llama a update(dt) en cada frame (dt máximo 0.05 s)
export function startLoop(update) {
  let last = performance.now();
  const frame = now => { const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; update(dt); requestAnimationFrame(frame); }; // el primer frame puede traer un tiempo anterior: nunca negativo
  requestAnimationFrame(frame);
}
