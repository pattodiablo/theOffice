import * as THREE from 'three';
import { Z, EDITOR, $ } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { PORTAL, ENDING_MESSAGES } from '../Settings.js';
import { cam, stage } from '../Core/Engine.js';
import { crystalCount } from '../Data/Progress.js';
import { portalSound } from '../Core/Audio.js';

// Portal (level.portal = { x, y }, editor › Nivel › Portal): la salida de la Matrix, pensado para el nivel 21.
// Se abre solo si juntaste PORTAL.need cristales (en el editor siempre está abierto, para probarlo).
// Cerrado: aro gris apagado con el contador "◆ 12/20". Abierto: aro celeste girando; al entrar, final del juego.
let group, ring, disc, inner, light, label, endEl, et = -1, msg = '', onEnd = null;

export function initPortal(scene, { restart }) {
  onEnd = restart;
  group = new THREE.Group(); scene.add(group);
  ring = new THREE.Mesh(new THREE.TorusGeometry(7, .9, 10, 40), new THREE.MeshLambertMaterial({ color: 0x5a6068, emissive: 0x000000 }));
  disc = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40), new THREE.MeshBasicMaterial({ color: 0x0b1a22, transparent: true, opacity: .85, side: THREE.DoubleSide, depthWrite: false }));
  inner = new THREE.Mesh(new THREE.TorusGeometry(4, .25, 6, 40), new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0 }));
  light = new THREE.PointLight(0x7fdcff, 0, 60, 2);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 1, 24), new THREE.MeshLambertMaterial({ color: 0x3a4048 }));
  for (const m of [ring, disc, inner]) { m.position.y = 8.5; group.add(m); }
  base.position.y = .5; group.add(base, light); light.position.y = 8;
  group.rotation.y = Math.PI / 4;                                           // de frente a la cámara
  label = document.createElement('div'); label.id = 'portalNum'; document.body.append(label);
  endEl = document.createElement('div'); endEl.id = 'ending';
  endEl.innerHTML = '<p class="emsg"></p><button class="playbtn" id="endAgain">Play again</button>'; document.body.append(endEl);
  $('#endAgain').addEventListener('click', () => { endEl.classList.remove('show', 'done'); et = -1; onEnd && onEnd(); });
}

export const portalOpen = () => EDITOR || crystalCount() >= PORTAL.need;
export function syncPortal() { group.visible = !!G.level.portal; }

// lógica (jugando): entrar al portal abierto termina el juego
export function updatePortal(dt, p) {
  const q = G.level.portal; if (!q || !portalOpen()) return false;
  if (Math.hypot(p.x - q.x, p.y - q.y) < PORTAL.enterR) {
    G.mode = 'ending'; et = 0; msg = ENDING_MESSAGES[Math.random() * ENDING_MESSAGES.length | 0]; portalSound();
    endEl.classList.add('show'); endEl.querySelector('.emsg').textContent = '';
    return true;
  }
  return false;
}

export function animatePortal(dt) {
  const q = G.level.portal, open = portalOpen();
  label.style.display = q && !open && (G.mode === 'play' || G.mode === 'edit') ? 'block' : 'none';
  if (q) {
    group.position.set(q.x, Z, -q.y);
    ring.rotation.z += dt * (open ? 1.2 : .1); inner.rotation.z -= dt * 2.5;
    ring.material.color.setHex(open ? 0x7fdcff : 0x5a6068); ring.material.emissive.setHex(open ? 0x1d6a88 : 0);
    disc.material.color.setHex(open ? 0xdff8ff : 0x0b1a22); disc.material.opacity = open ? .55 + .2 * Math.sin(G.t * 4) : .85;
    inner.material.opacity = open ? .8 : 0; inner.scale.setScalar(open ? 1 + .25 * Math.sin(G.t * 3) : 1);
    light.intensity = open ? 700 : 0;
    if (label.style.display === 'block') {
      const v = new THREE.Vector3(q.x, Z + 19, -q.y).project(cam);
      label.style.left = ((v.x + 1) / 2 * stage.clientWidth) + 'px'; label.style.top = ((1 - v.y) / 2 * stage.clientHeight) + 'px';
      label.textContent = `◆ ${crystalCount()}/${PORTAL.need}`;
    }
  }
  // final: la pantalla se vuelve blanca y se escribe el mensaje
  if (et >= 0) {
    et += dt;
    const n = Math.max(0, Math.floor((et - 1.6) / .045));
    endEl.querySelector('.emsg').textContent = msg.slice(0, n);
    endEl.classList.toggle('done', n >= msg.length + 8);
  }
}
