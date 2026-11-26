import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { BULLET_SPEED, BULLET_RANGE, JUICE } from '../Settings.js';
import { hAt } from '../World/Grid.js';
import { shotSound } from '../Core/Audio.js';
import { slowmo, kick, popText } from '../FX/Juice.js';

// Balas de los agentes rojos: viajan en línea recta a la altura del pecho.
// Los escritorios no las frenan (son bajos); los paneles, muros y paredes sí. Camuflado no te dan.
const bullets = [];
let nearCool = 0;                                                        // un "casi me dan" a la vez
let scene, geo, mat;

export function initBullets(s) {
  scene = s; geo = new THREE.BoxGeometry(3.2, .55, .55);                // alargada: se ve como un trazo
  mat = new THREE.MeshBasicMaterial({ color: 0xff3b3b });
}

// origin (opcional): punto de salida, p. ej. cada cañón del vigía; si no, sale del pecho del agente
export function fireBullet(from, target, origin) {
  const o = origin || from, ang = Math.atan2(target.y - o.y, target.x - o.x), m = new THREE.Mesh(geo, mat), off = origin ? 0 : 3;
  m.rotation.y = ang; scene.add(m);
  const sp = from.P?.bulletSpeed || BULLET_SPEED;                       // el vigía dispara balas más rápidas
  bullets.push({ x: o.x + Math.cos(ang) * off, y: o.y + Math.sin(ang) * off, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, sp, dist: 0, m, from });
  shotSound();
}

// mueve las balas; devuelve el agente que le dio al jugador (o null)
export function updateBullets(dt, p) {
  let hitBy = null;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i], steps = Math.max(1, Math.ceil(b.sp * dt / .5)); let dead = false;
    for (let s = 0; s < steps && !dead; s++) {                         // en pasitos para no atravesar paredes delgadas
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps; b.dist += b.sp * dt / steps;
      if (hAt(b.x, b.y) >= 9 || b.dist > BULLET_RANGE) dead = true;
      else {
        const dp = Math.hypot(b.x - p.x, b.y - p.y);
        if (!G.hiddenKind && dp < 1.8) { hitBy = b.from; dead = true; b.hit = true; }
        else if (!G.hiddenKind && dp < JUICE.nearMiss) b.close = true;   // pasó rozando…
        else if (b.close && dp > JUICE.nearMiss + 1) { b.close = false; nearMiss(p); }   // …y siguió de largo
      }
    }
    if (dead && b.close && !b.hit) nearMiss(p);                          // chocó contra la pared justo después de rozarte
    if (dead) { scene.remove(b.m); bullets.splice(i, 1); } else b.m.position.set(b.x, Z + 9, -b.y);
  }
  nearCool = Math.max(0, nearCool - dt);
  return hitBy;
}

// "¡casi!": cámara lenta cortita, golpe de zoom y texto
function nearMiss(p) {
  if (nearCool > 0 || G.mode !== 'play') return; nearCool = 1.2;
  slowmo(.3, .4); kick(.05); popText(p.x, p.y, 'CLOSE CALL!', 'red');
}

export function clearBullets() { for (const b of bullets) scene.remove(b.m); bullets.length = 0; }
