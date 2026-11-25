import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { cam, stage } from '../Core/Engine.js';
import { G } from '../Core/Game.js';
import { HIDE_R, HIDE_KINDS, HIDE_TIME, HIDE_COOLDOWN, SEMA } from '../Settings.js';
import { PROPS, rot, propGeo } from '../Data/PropLibrary.js';
import { M } from '../Materials/Materials.js';
import { popScale } from '../Core/MathUtils.js';
import { puff } from '../FX/Particles.js';
import { puffSound } from '../Core/Audio.js';
import { shake, kick, hitstop, slowmo, flash, popText } from '../FX/Juice.js';

// Escondites: círculo en el piso + silueta del objeto. Dentro, el jugador se vuelve planta o basurero
// y los agentes no lo detectan. El disfraz dura HIDE_TIME segundos; después vuelves a la normalidad
// y ese escondite queda en recarga HIDE_COOLDOWN segundos (también si sales antes).
// Círculo con el semáforo: verde disponible · amarillo en uso · rojo recargando.
// Encima: una flecha que sube y baja marca los escondites disponibles, y una barra muestra el tiempo del disfraz o la recarga.
const hideProp = k => PROPS[HIDE_KINDS[k]?.prop] ? HIDE_KINDS[k].prop : 'plant_s';
let group, ringGeo, arrowGeo, arrowMat, zones = [];   // zones[i] = { ring, arrow, bar, cd } por escondite del nivel
const v = new THREE.Vector3();
let current = -1;                             // escondite en uso
export const disguises = {};                  // un modelo por tipo de disfraz

function propMesh(t, material) {             // prop centrado en el origen del grupo
  const R0 = rot(t, 0), m = new THREE.Mesh(propGeo(t, 0), material), g = new THREE.Group();
  m.rotation.x = -Math.PI / 2; m.position.set(-R0.w / 2, 0, R0.d / 2); m.castShadow = true; g.add(m); return g;
}
// une dos geometrías no indexadas/indexadas en una sola (para la flecha)
function mergeGeos(a, b) {
  const A = a.toNonIndexed(), B = b.toNonIndexed(), pos = new Float32Array(A.attributes.position.count * 3 + B.attributes.position.count * 3);
  pos.set(A.attributes.position.array, 0); pos.set(B.attributes.position.array, A.attributes.position.array.length);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return g;
}
const flatMat = color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide });

export function initHideSpots(scene) {
  group = new THREE.Group(); scene.add(group);
  ringGeo = new THREE.RingGeometry(HIDE_R - .9, HIDE_R, 32).rotateX(-Math.PI / 2);
  // flecha hacia abajo: punta piramidal + palito
  const head = new THREE.ConeGeometry(1.9, 2.6, 4).rotateX(Math.PI).rotateY(Math.PI / 4), stick = new THREE.BoxGeometry(1, 2.4, 1).translate(0, 2.4, 0);
  arrowGeo = mergeGeos(head, stick); arrowMat = new THREE.MeshBasicMaterial({ color: SEMA.green });
  for (const k in HIDE_KINDS) { disguises[k] = propMesh(hideProp(k), M.voxel); disguises[k].visible = false; scene.add(disguises[k]); }
}

// dibuja las zonas del nivel
export function drawHides() {
  for (const z of zones) { z.ring.material.dispose(); z.bar.remove(); }
  group.clear(); zones = []; current = -1;
  for (const h of G.level.hides || []) {
    const ring = new THREE.Mesh(ringGeo, flatMat(SEMA.green)); ring.position.set(h.x, Z + .3, -h.y); ring.renderOrder = 2; group.add(ring);
    const arrow = new THREE.Mesh(arrowGeo, arrowMat); arrow.position.set(h.x, Z + 17, -h.y); group.add(arrow);
    const bar = document.createElement('div'); bar.className = 'hidebar'; bar.innerHTML = '<i></i>'; document.body.append(bar);
    const hint = propMesh(hideProp(h.k), M.hint); hint.position.set(h.x, Z, -h.y); hint.children[0].castShadow = false; group.add(hint);
    zones.push({ ring, arrow, bar, cd: 0 });
  }
}

// al empezar un intento: todos disponibles
export function resetHideSpots() { current = -1; for (const z of zones) z.cd = 0; }

export const hideAt = (x, y) => (G.level.hides || []).findIndex(h => Math.hypot(x - h.x, y - h.y) < HIDE_R);

function setHidden(k, p) { puffSound(!!k); kick(.035); G.hiddenKind = k; G.popT = 0; puff(p.x, p.y); } // ¡puf! al esconderse y al salir

// lógica (solo jugando): entrar, durar, salir y recargar
export function updateCamouflage(p, dt) {
  for (const z of zones) z.cd = Math.max(0, z.cd - dt);
  const i = hideAt(p.x, p.y);
  if (current >= 0) {
    G.hideT -= dt;
    if (i !== current || G.hideT <= 0) {      // saliste o se acabó el tiempo: vuelves a la normalidad
      zones[current].cd = HIDE_COOLDOWN; current = -1; setHidden(null, p);
    }
  } else if (i >= 0 && zones[i] && zones[i].cd <= 0) {
    current = i; G.hideT = HIDE_TIME; setHidden(G.level.hides[i].k, p);
  }
}

// disfraz con rebote (parpadea al final), jugador oculto y círculos con su estado (visual, cada frame)
export function animateHideSpots(dt, p) {
  G.popT += dt;
  const pop = popScale(G.popT, .25, .35), disguised = G.mode !== 'edit' && G.hiddenKind;
  const ending = disguised && G.hideT < 1.5 && Math.floor(G.t * 8) % 2;     // aviso: está por terminar
  if (!(G.entOk && G.intro >= 0 && G.mode === 'play')) { p.ch.root.visible = !disguised || ending; p.ch.root.scale.setScalar(disguised ? 1 : pop); } // al salir del ascensor lo maneja animatePlayer
  for (const k in disguises) { const g = disguises[k]; g.visible = disguised === k && !ending; if (g.visible) { g.position.set(p.x, Z, -p.y); g.scale.setScalar(pop); } }
  const pulse = .4 + .2 * Math.sin(G.t * 4), play = G.mode !== 'edit';
  zones.forEach((z, i) => {
    const inUse = play && i === current, cooling = play && z.cd > 0;
    z.ring.material.color.setHex(inUse ? SEMA.yellow : cooling ? SEMA.red : SEMA.green);
    z.ring.material.opacity = cooling ? .35 : pulse + (inUse ? .2 : 0);
    // flecha: solo en los disponibles, sube y baja y gira despacio
    const h = G.level.hides[i];
    z.arrow.visible = play && !inUse && !cooling;
    if (z.arrow.visible) { z.arrow.position.y = Z + 16 + Math.sin(G.t * 4 + i) * 1.3; z.arrow.rotation.y = G.t * 1.5; }
    // barra: tiempo que le queda al disfraz (amarillo, se vacía) o recarga (rojo, se llena)
    const frac = inUse ? G.hideT / HIDE_TIME : cooling ? 1 - z.cd / HIDE_COOLDOWN : 0;
    const showBar = (G.mode === 'play' || G.mode === 'over') && (inUse || cooling);
    z.bar.style.display = showBar ? 'block' : 'none';
    if (showBar) {
      v.set(h.x, Z + 19, -h.y).project(cam);
      z.bar.style.left = ((v.x + 1) / 2 * stage.clientWidth) + 'px'; z.bar.style.top = ((1 - v.y) / 2 * stage.clientHeight) + 'px';
      z.bar.className = 'hidebar ' + (inUse ? 'use' : 'cool'); z.bar.firstChild.style.width = (frac * 100) + '%';
    }
  });
}
