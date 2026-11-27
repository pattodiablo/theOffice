import * as THREE from 'three';
import { Z, $ } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { EXIT_R, ELEVATOR_WAIT, CALL_R, SEMA } from '../Settings.js';
import { cam, stage } from '../Core/Engine.js';
import { ease } from '../Core/MathUtils.js';
import { doorSound, callBeep, arrivalChime } from '../Core/Audio.js';
import { M } from '../Materials/Materials.js';
import { box } from './Character.js';
import { bossTargets } from './MainFrame.js';
import { crystalsToDrop } from './RealityPortal.js';
import { popText, shake, haptic } from '../FX/Juice.js';

// Puerta EXIT: dos hojas de vidrio corredizas. El nivel termina solo al cruzarla.
// Antes hay que llamar al ascensor: pisar el círculo frente al botón (a la derecha de la puerta) y esperar
// a que baje (ELEVATOR_WAIT segundos). Botón y círculo usan el semáforo: rojo sin llamar · amarillo bajando · verde llegó.
// El hueco y el letrero los dibuja ShellBuilder; aquí van las piezas que se mueven, el botón y la luz de atrás.
let leafL, leafR, glow, glowMat, light, panel, buttonMat, callRing, numEl;
let entL, entR, entGlow, entGlowMat, entLight;   // puerta de entrada (opcional): G.entOpen la abre en la intro
const v = new THREE.Vector3();
// Botón para llamar al ascensor: por defecto a la derecha de la puerta. Si el nivel tiene level.callBtn ({ x, y, a }:
// punto del piso junto a la pared y hacia dónde mira, se coloca en el editor), el botón va ahí y el de la puerta no existe.
const customBtn = () => G.level && G.level.callBtn;
// ascensor bloqueado: en un piso con jefe (Main Frame) hasta derrotarlo; en el piso del portal de realidad
// hasta echar al contenedor todos los cristales que traes
const lockReason = () => bossTargets().length > 0 ? 'LOCKED: DEFEAT THE MAIN FRAME' : crystalsToDrop() > 0 ? 'LOCKED: DROP YOUR CRYSTALS IN THE PORTAL' : '';
export const exitLocked = () => !!lockReason();
let lockMsgT = 0, wasLocked = false;
const callSpot = () => { const b = customBtn(); if (b) return { x: b.x + Math.cos(b.a) * 1.5, y: b.y + Math.sin(b.a) * 1.5 };
  const [x, y] = G.EXIT.point(14.5, -4); return { x, y }; };                      // dónde pararse para llamar
function placePanel(E, rE) {                                                       // la placa en la pared
  const b = customBtn();
  if (b) {   // pegada a la cara de la pared (el punto del botón queda a 1,5 vóxeles de una pared del fondo y a 0,5 de una lateral)
    const back = Math.abs(Math.cos(b.a)) < .5 ? 1.3 : .3;
    panel.position.set(b.x - Math.cos(b.a) * back, Z + 10, -(b.y - Math.sin(b.a) * back)); panel.rotation.y = Math.atan2(Math.cos(b.a), -Math.sin(b.a));
  }
  else { const [px, py] = E.point(14.5, -.2); panel.position.set(px, Z + 10, -py); panel.rotation.y = rE; }
}
const glowDark = new THREE.Color(0x06140c), glowOn = new THREE.Color(0x8dffbf);
const LEAF_W = 5.5, LEAF_H = 22;

function makeLeaf() {
  const g = new THREE.Group(), w = LEAF_W, h = LEAF_H;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - .8, h - .8, .3), M.glass); glass.position.y = h / 2; g.add(glass);
  box(g, .5, h, .8, 0x4d555c, -w / 2 + .25, h / 2, 0); box(g, .5, h, .8, 0x4d555c, w / 2 - .25, h / 2, 0);
  box(g, w, .5, .8, 0x4d555c, 0, h - .25, 0); box(g, w, .8, .8, 0x4d555c, 0, .4, 0);
  return g;
}

export function initExitDoor(scene) {
  leafL = makeLeaf(); leafR = makeLeaf(); scene.add(leafL, leafR);
  glowMat = new THREE.MeshBasicMaterial({ color: 0x06140c });                      // lo que se ve detrás de la puerta
  glow = new THREE.Mesh(new THREE.PlaneGeometry(LEAF_W * 2, LEAF_H), glowMat); scene.add(glow);
  light = new THREE.PointLight(0x5dffa0, 0, 45, 2); scene.add(light);
  // botón para llamar al ascensor (placa en la pared) y círculo en el piso
  panel = new THREE.Group(); box(panel, 3, 5, .4, 0x2a3036, 0, 0, 0);
  buttonMat = new THREE.MeshBasicMaterial({ color: SEMA.red });
  const btn = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, .6), buttonMat); btn.position.set(0, .4, .3); panel.add(btn);
  scene.add(panel);
  callRing = new THREE.Mesh(new THREE.RingGeometry(CALL_R - .6, CALL_R, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: SEMA.red, transparent: true, opacity: .6, depthWrite: false }));
  callRing.renderOrder = 2; scene.add(callRing);
  numEl = document.createElement('div'); numEl.id = 'elevNum'; document.body.append(numEl);   // cuenta regresiva sobre el botón
  entL = makeLeaf(); entR = makeLeaf(); entGlowMat = new THREE.MeshBasicMaterial({ color: 0x06140c });
  entGlow = new THREE.Mesh(new THREE.PlaneGeometry(LEAF_W * 2, LEAF_H), entGlowMat); entLight = new THREE.PointLight(0x5dffa0, 0, 45, 2);
  scene.add(entL, entR, entGlow, entLight);
}

// lógica del botón (solo jugando): pisar el círculo llama al ascensor; luego cuenta hasta que llega
export function updateElevatorCall(dt, p) {
  if (!G.exitOk) return;
  const s = callSpot();
  lockMsgT -= dt;
  const locked = exitLocked();
  if (wasLocked && !locked) { popText(s.x, s.y, 'ELEVATOR UNLOCKED', 'cyan'); arrivalChime(); }   // derrotaste al jefe o echaste los cristales
  wasLocked = locked;
  if (locked) {                                    // bloqueado: avisa si intentas llamarlo
    if (Math.hypot(p.x - s.x, p.y - s.y) < CALL_R && lockMsgT <= 0) {
      lockMsgT = 2.5; popText(s.x, s.y, lockReason(), 'red'); shake(.3); haptic(30); callBeep();
    }
    return;
  }
  if (G.elev === 'idle' && Math.hypot(p.x - s.x, p.y - s.y) < CALL_R) { G.elev = 'calling'; G.elevT = ELEVATOR_WAIT; callBeep(); }
  else if (G.elev === 'calling' && (G.elevT -= dt) <= 0) { G.elev = 'arrived'; G.elevT = 0; arrivalChime(); }
}

// apenas llega el ascensor, la puerta se abre y queda abierta (lo llama el juego cada frame)
export function checkExitProximity(p) {
  const open = G.exitOk && G.elev === 'arrived';
  if (open && !G.doorWant) doorSound();
  G.doorWant = open;
}
export const crossedExit = p => { if (!G.exitOk || G.doorOpen <= .8) return false; const [u, d] = G.EXIT.local(p.x, p.y); return d >= -.5 && u > 0 && u < 11; };

export function updateExitDoor(dt) {
  // entrada: misma puerta; se abre durante la intro para que salga el jugador
  entL.visible = entR.visible = entGlow.visible = !!G.entOk; entLight.visible = !!G.entOk;
  if (G.entOk) {
    const N = G.ENT, ke = ease(G.mode === 'edit' ? 0 : G.entOpen || 0), r = N.side === 'left' ? Math.PI / 2 : 0;
    const at = (o, u, d, y) => { const [px, py] = N.point(u, d); o.position.set(px, y, -py); o.rotation.y = r; };
    at(entGlow, 5.5, 2.05, Z + N.h / 2); at(entLight, 5.5, -3, Z + 12);
    at(entL, LEAF_W / 2 - ke * LEAF_W, 1.5, Z); at(entR, LEAF_W * 1.5 + ke * LEAF_W, 1.5, Z);
    entGlowMat.color.copy(glowDark).lerp(glowOn, ke); entLight.intensity = 900 * ke;
  }
  // salida
  const E = G.EXIT;
  if (G.mode === 'edit') G.doorWant = false;
  G.doorOpen = Math.min(1, Math.max(0, G.doorOpen + (G.doorWant ? 1 : -1) * dt * 2.4));
  const k = ease(G.doorOpen);
  leafL.visible = leafR.visible = glow.visible = panel.visible = callRing.visible = light.visible = !!G.exitOk;
  if (!G.exitOk) { numEl.style.display = 'none'; return; }
  const rE = E.side === 'left' ? Math.PI / 2 : 0, atE = (o, u, d, y) => { const [px, py] = E.point(u, d); o.position.set(px, y, -py); o.rotation.y = rE; };
  atE(glow, 5.5, 2.05, Z + E.h / 2); atE(light, 5.5, -3, Z + 12);
  atE(leafL, LEAF_W / 2 - k * LEAF_W, 1.5, Z); atE(leafR, LEAF_W * 1.5 + k * LEAF_W, 1.5, Z);   // las hojas se esconden dentro de la pared
  // botón, círculo y cuenta regresiva
  glowMat.color.copy(glowDark).lerp(glowOn, k); light.intensity = 900 * k;
  const locked = G.mode !== 'edit' && exitLocked();
  const s = callSpot(), c = locked ? 0x555a5e : G.elev === 'arrived' ? SEMA.green : G.elev === 'calling' ? SEMA.yellow : SEMA.red;   // gris = bloqueado
  placePanel(E, rE);
  callRing.position.set(s.x, Z + .3, -s.y);
  const blink = G.elev === 'calling' ? .55 + .45 * Math.sin(G.t * 10) : 1;
  buttonMat.color.setHex(c).multiplyScalar(blink); callRing.material.color.setHex(c);
  callRing.material.opacity = G.elev === 'idle' ? .4 + .25 * Math.sin(G.t * 4) : .6;
  const showNum = G.exitOk && (G.mode === 'play' || G.mode === 'exit') && G.intro < 0 && (G.elev !== 'idle' || locked);
  numEl.style.display = showNum ? 'block' : 'none';
  if (showNum) {
    numEl.textContent = locked ? '🔒' : G.elev === 'calling' ? Math.ceil(G.elevT) : '▲';
    numEl.className = locked ? 'locked' : G.elev;
    v.set(panel.position.x, Z + 15, panel.position.z).project(cam);
    numEl.style.left = ((v.x + 1) / 2 * stage.clientWidth) + 'px'; numEl.style.top = ((1 - v.y) / 2 * stage.clientHeight) + 'px';
  }
}
