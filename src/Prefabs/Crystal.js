import * as THREE from 'three';
import { Z, EDITOR } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { CRYSTAL } from '../Settings.js';
import { hasCrystal } from '../Data/Progress.js';
import { crystalSound } from '../Core/Audio.js';
import { puff } from '../FX/Particles.js';

// Cristal: un "fragmento de realidad" por nivel (level.crystal = { x, y }, se pone en el editor › Nivel › Cristal).
// Flota y gira; al tocarlo se recoge. Cuenta para el progreso cuando terminas el piso con él.
// Si ya lo tenías de antes, se ve transparente (puedes volver a tomarlo, pero no suma otro).
// Es celeste a propósito: el color del mundo real, frente al verde de la Matrix.
let group, core, shell, light, ring, toast, toastT;

export function initCrystal(scene) {
  group = new THREE.Group(); scene.add(group);
  const geo = new THREE.OctahedronGeometry(1.7).scale(1, 1.7, 1);
  core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true }));
  shell = new THREE.Mesh(geo.clone().scale(1.45, 1.3, 1.45), new THREE.MeshBasicMaterial({ color: 0x4fd2ff, transparent: true, opacity: .3, depthWrite: false }));
  light = new THREE.PointLight(0x7fdcff, 260, 30, 2);
  ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.9, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4fd2ff, transparent: true, opacity: .45, depthWrite: false }));
  ring.renderOrder = 2; group.add(core, shell, light, ring);
  toast = document.createElement('div'); toast.id = 'fragToast'; document.body.append(toast);   // aviso al recogerlo
}
function showToast(text) {
  toast.innerHTML = `<i>◆</i> ${text}`; toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2300);
}

export function syncCrystal() { group.visible = !!G.level.crystal; resetCrystal(); }
export function resetCrystal() { G.gotCrystal = false; G.hadCrystal = !EDITOR && hasCrystal(G.levelName); }

// lógica (jugando): recogerlo al tocarlo
export function updateCrystal(dt, p) {
  const c = G.level.crystal; if (!c || G.gotCrystal) return;
  if (Math.hypot(p.x - c.x, p.y - c.y) < CRYSTAL.pickR) {
    G.gotCrystal = true; crystalSound(); puff(c.x, c.y);
    showToast(G.hadCrystal ? 'REALITY FRAGMENT <small>(already yours)</small>' : 'REALITY FRAGMENT ACQUIRED');
  }
}

// visual
export function animateCrystal() {
  const c = G.level.crystal;
  group.visible = !!c && !(G.gotCrystal && G.mode !== 'edit');
  if (!group.visible) return;
  const y = Z + 6 + Math.sin(G.t * 2.4) * .8, faded = G.hadCrystal && G.mode !== 'edit';
  for (const m of [core, shell]) { m.position.set(c.x, y, -c.y); m.rotation.y = G.t * 1.6; }
  core.material.opacity = faded ? .35 : 1; shell.material.opacity = faded ? .1 : .25 + .12 * Math.sin(G.t * 5);
  light.position.set(c.x, y, -c.y); light.intensity = faded ? 60 : 260;
  ring.position.set(c.x, Z + .32, -c.y); ring.scale.setScalar(1 + .12 * Math.sin(G.t * 3));
}
