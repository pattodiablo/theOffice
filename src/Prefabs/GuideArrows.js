import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { GUIDE } from '../Settings.js';
import { player } from './Player.js';
import { guideSafe, safeCrystalPos } from './Safe.js';
import { portalTank, pendingDeposit } from './RealityPortal.js';

// Flechas guía de los primeros pisos (GUIDE.levels en Settings.js), sin palabras:
//  1. una flecha 3D grande que flota y rebota encima de la caja fuerte que guarda el cristal,
//  2. cuando se abre, encima del cristal hasta que lo recoges,
//  3. si el piso tiene portal de realidad (piso 1), encima del contenedor donde se echa el cristal.
// Además, si el objetivo está lejos, una flecha plana en el piso junto al jugador apunta hacia él.
const COL = 0x4fd2ff;
let big, ground, bigK = 0, groundK = 0, tx = 0, ty = 0, th = 0;

function arrowShape(w, head, len, hw) {          // flecha 2D: punta en +y
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, len); s.lineTo(hw / 2, len); s.lineTo(0, len + head); s.lineTo(-hw / 2, len); s.lineTo(-w / 2, len); s.closePath();
  return s;
}

export function initGuideArrows(scene) {
  const matTop = new THREE.MeshBasicMaterial({ color: COL, transparent: true }), matSide = new THREE.MeshBasicMaterial({ color: 0x1b7fb0, transparent: true });
  // flecha grande, apuntando hacia abajo, con grosor (estilo voxel: bordes rectos)
  const g1 = new THREE.ExtrudeGeometry(arrowShape(3.2, 5, 6, 8), { depth: 2.4, bevelEnabled: false }).translate(0, 0, -1.2);
  g1.rotateZ(Math.PI);                                                     // punta hacia abajo; la punta queda en y = 0 tras subirla
  g1.translate(0, 11, 0);
  big = new THREE.Group(); const m1 = new THREE.Mesh(g1, [matTop, matSide]); big.add(m1);
  const m1b = m1.clone(); m1b.rotation.y = Math.PI / 2; big.add(m1b);      // cruzada: se ve bien desde cualquier ángulo
  big.renderOrder = 5; big.visible = false; scene.add(big);
  // flecha plana del piso
  ground = new THREE.Group();
  const g2 = new THREE.ExtrudeGeometry(arrowShape(3, 4.8, 4.2, 8.6), { depth: .7, bevelEnabled: false }).rotateX(-Math.PI / 2);
  const g3 = new THREE.ExtrudeGeometry(arrowShape(4.6, 6.6, 4.6, 11.4), { depth: .4, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, 0, .9);   // borde oscuro
  const top = new THREE.Mesh(g2, [new THREE.MeshBasicMaterial({ color: COL, transparent: true, depthWrite: false }), new THREE.MeshBasicMaterial({ color: 0x1b7fb0, transparent: true, depthWrite: false })]);
  const rim = new THREE.Mesh(g3, new THREE.MeshBasicMaterial({ color: 0x06202c, transparent: true, depthWrite: false }));
  top.position.y = .3; top.renderOrder = 5; rim.renderOrder = 4; ground.add(rim, top);
  ground.visible = false; scene.add(ground);
}

function target() {
  if (!GUIDE.levels.includes(G.levelName)) return null;
  const s = guideSafe(); if (s && !G.hadCrystal) return { x: s.x, y: s.y, h: s.h + 4 };
  const c = safeCrystalPos(); if (c && !G.gotCrystal) return { x: c.x, y: c.y, h: 6 };
  const t = portalTank(); if (t && pendingDeposit() > 0) return { x: t.x, y: t.y, h: t.h + 12 };   // por encima del contador
  return null;
}

const fade = (mesh, k) => mesh.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.opacity = k; });

export function animateGuideArrows(dt) {
  if (!big) return;
  const play = G.mode === 'play' && G.intro < 0 && !(G.asm >= 0);
  const t = play ? target() : null;
  if (t) { if (bigK < .01) { tx = t.x; ty = t.y; th = t.h; } else { const k = Math.min(1, dt * 8); tx += (t.x - tx) * k; ty += (t.y - ty) * k; th += (t.h - th) * k; } }
  bigK += ((t ? 1 : 0) - bigK) * Math.min(1, dt * 6);
  big.visible = bigK > .02;
  if (big.visible) {
    const bob = Math.abs(Math.sin(G.t * 3.2)) * 4;                        // rebota como pelota
    big.position.set(tx, Z + th + bob, -ty); big.rotation.y = G.t * 1.2;
    const sq = 1 + (bob < .6 ? (.6 - bob) * .25 : 0);                     // se aplasta un poquito al tocar abajo
    big.scale.set(bigK * sq, bigK / sq, bigK * sq); fade(big, Math.min(1, bigK * 1.2));
  }
  // flecha del piso junto al jugador, si el objetivo está lejos
  const dx = tx - player.x, dy = ty - player.y, d = Math.hypot(dx, dy), far = t && d > GUIDE.far;
  groundK += ((far ? 1 : 0) - groundK) * Math.min(1, dt * 6);
  ground.visible = groundK > .02;
  if (ground.visible) {
    const a = Math.atan2(dy, dx), r = 9 + Math.max(0, Math.sin(G.t * 6)) * 2.2;      // empuja hacia adelante, como diciendo "por aquí"
    ground.position.set(player.x + Math.cos(a) * r, Z + .45, -(player.y + Math.sin(a) * r));
    ground.rotation.y = a - Math.PI / 2;
    ground.scale.setScalar(.6 + .4 * groundK); fade(ground, groundK);
  }
}
