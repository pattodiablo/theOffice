import * as THREE from 'three';
import { Z, TILE } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { CAMERA as C, VISION_RAYS as NR, SEMA } from '../Settings.js';
import { box } from './Character.js';
import { rayDist } from '../World/Grid.js';
import { tileOn } from '../World/ShellBuilder.js';
import { alertSound } from '../Core/Audio.js';
import { alertAgents } from './Agent.js';

// Cámaras de seguridad: van colgadas en las paredes (fondo o laterales) y barren de izquierda a derecha.
// Si ven al jugador se llena su medidor; al llenarse dan la alarma: siguen al jugador con la mirada y llaman a
// TODOS los agentes que no te estén persiguiendo (el normal corre a donde te vio la cámara, el rojo te persigue).
// Mientras te vean vuelven a llamar cada C.recall segundos. Al perderte esperan un poco y vuelven a barrer.
// Semáforo como los agentes: verde barriendo · amarillo sospecha o recién te perdió · rojo alarma · celeste congelada.
// En el nivel: cams: [{ x, y, a }] — punto en el piso junto a la pared (vóxeles) y ángulo hacia donde mira (centro del barrido).
export const cams = [];
let scene, bodyMat, lensMat;
const MOUNT = 20;                          // altura de la cámara sobre el piso

function makeCam() {
  const root = new THREE.Group(), head = new THREE.Group();
  box(root, 1.2, 3, 3, 0x3a3f46, -.6, 0, 0);                         // base atornillada a la pared
  box(root, 2.6, .8, .8, 0x5a6068, .9, 0, 0);                         // brazo
  head.position.set(2.2, -.3, 0); root.add(head);
  box(head, 4.2, 2.2, 2.4, 0xd9dde2, 1.6, 0, 0); box(head, 4.6, .4, 2.8, 0xb0b6be, 1.5, 1.3, 0);   // cuerpo y visera
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, .5, 12).rotateZ(Math.PI / 2), lensMat); lens.position.set(3.85, 0, 0); head.add(lens);
  const led = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, .4), new THREE.MeshBasicMaterial({ color: SEMA.green })); led.position.set(3.2, .7, .9); head.add(led);
  head.rotation.z = -.5;                                               // mira hacia el piso
  const fan = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: SEMA.green, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false }));
  fan.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NR * 9), 3)); fan.frustumCulled = false; fan.renderOrder = 2;
  scene.add(root, fan);
  return { root, head, led, fan };
}

export function initCams(s) { scene = s; lensMat = new THREE.MeshBasicMaterial({ color: 0x101418 }); }

// crea o quita cámaras para que coincidan con el nivel
export function syncCams() {
  const L = G.level.cams || [];
  while (cams.length > L.length) { const c = cams.pop(); scene.remove(c.m.root, c.m.fan); }
  L.forEach((d, i) => { cams[i] ||= { m: makeCam() }; Object.assign(cams[i], { d }); });
  resetCams();
}
export function resetCams() {
  for (const c of cams) {
    const { x, y, a } = c.d, back = 2.2;                               // la cámara cuelga sobre ese punto, pegada a la pared
    Object.assign(c, { x, y, base: a, ang: a, phase: Math.random() * 6, meter: 0, state: 'scan', lostT: 0, callT: 0 });
    c.m.root.position.set(x - Math.cos(a) * back, Z + MOUNT, -(y - Math.sin(a) * back));
  }
}

// IA: devuelve lo mismo que los agentes para el HUD
export function updateCamsAI(dt, player) {
  let top = 0, alertOn = false, cautionOn = false;
  for (const c of cams) {
    if (G.camsOff) { c.state = 'off'; c.meter = 0; continue; }          // apagadas desde el rack de servidores
    if (G.frozen > 0) continue;
    const dx = player.x - c.x, dy = player.y - c.y, dist = Math.hypot(dx, dy), toP = Math.atan2(dy, dx);
    let rel = Math.atan2(Math.sin(toP - c.ang), Math.cos(toP - c.ang));
    const inLimits = Math.abs(Math.atan2(Math.sin(toP - c.base), Math.cos(toP - c.base))) < C.sweep + C.half; // no gira más allá de su barrido
    const seen = !G.hiddenKind && dist < C.range && Math.abs(rel) < C.half && rayDist(c.x, c.y, toP, dist, 12) >= dist - 1.5;
    if (c.state === 'track') {                                           // alarma: sigue al jugador con la mirada
      if (seen || (inLimits && c.lostT < .6 && !G.hiddenKind && dist < C.range)) {
        if (seen) c.lostT = 0; else c.lostT += dt;
        c.ang += Math.atan2(Math.sin(toP - c.ang), Math.cos(toP - c.ang)) * Math.min(1, dt * 5);
        if ((c.callT -= dt) <= 0) { c.callT = C.recall; alertAgents(player.x, player.y); }
      } else { c.state = 'cool'; c.lostT = C.coolTime; }
      c.meter = 1;
    } else {
      if (seen) c.meter = C.instant ? 1 : c.meter + dt * C.detect * (1 + (1 - dist / C.range) * 2); // instant: alarma apenas te ve
      else c.meter = Math.max(0, c.meter - dt * .4);
      if (c.meter >= 1) {                                               // ¡te vio!
        c.state = 'track'; c.lostT = 0; c.callT = C.recall; G.alerts++; alertSound(); alertAgents(player.x, player.y);
      } else if (c.state === 'cool') {                                  // te perdió: se queda mirando ahí y luego vuelve a barrer
        if ((c.lostT -= dt) <= 0) { c.state = 'scan'; c.phase = Math.asin(Math.max(-1, Math.min(1, Math.atan2(Math.sin(c.ang - c.base), Math.cos(c.ang - c.base)) / C.sweep))); }
      } else if (seen) c.ang += rel * Math.min(1, dt * 1.5);                // algo vio: se queda mirando
      else { c.phase += dt * Math.PI * 2 / C.period; c.ang += (c.base + Math.sin(c.phase) * C.sweep - c.ang) * Math.min(1, dt * 4); }
    }
    if (c.state === 'track') alertOn = true; else if (c.state === 'cool') cautionOn = true;
    top = Math.max(top, c.meter);
  }
  return { top, alertOn, cautionOn };
}

// cada frame: orientación, luz y cono de visión. En el editor barre sola para mostrar su alcance.
// el rack las reinicia: vuelven a barrer desde cero
export function rebootCams() { for (const c of cams) Object.assign(c, { state: 'scan', meter: 0, lostT: 0 }); }

export function animateCams() {
  for (const c of cams) {
    if (G.mode === 'edit') c.ang = c.base + Math.sin(G.t * Math.PI * 2 / C.period) * C.sweep;
    c.m.root.rotation.y = c.ang;
    const off = G.camsOff && G.mode !== 'edit';                       // apagada: cabeza caída, sin luz ni cono
    c.m.head.rotation.z += ((off ? -1.15 : -.5) - c.m.head.rotation.z) * .15;
    c.m.fan.visible = !off; if (off) { c.m.led.visible = false; continue; }
    const col = G.frozen > 0 ? SEMA.frozen : c.state === 'track' ? SEMA.red : (c.state === 'cool' || c.meter > .05) ? SEMA.yellow : SEMA.green;
    c.m.led.material.color.setHex(col); c.m.led.visible = c.state === 'track' || Math.sin(G.t * 6) > -.3;
    const arr = c.m.fan.geometry.attributes.position.array, pts = [];
    for (let i = 0; i <= NR; i++) { const an = c.ang - C.half + 2 * C.half * i / NR, d = rayDist(c.x, c.y, an, C.range, 12); pts.push([c.x + Math.cos(an) * d, c.y + Math.sin(an) * d]); }
    let k = 0; const put = (x, y) => { arr[k++] = x; arr[k++] = Z + .3; arr[k++] = -y; };
    for (let i = 0; i < NR; i++) { put(c.x, c.y); put(...pts[i]); put(...pts[i + 1]); }
    c.m.fan.geometry.attributes.position.needsUpdate = true;
    c.m.fan.material.color.setHex(col); c.m.fan.material.opacity = G.frozen > 0 ? .2 : .24 + c.meter * .25;
  }
}

// ---------- editor ----------
// punto de pared más cercano a (px, py): pared del fondo (mira hacia -y) o lateral izquierda (mira hacia +x)
const walled = (i, j) => tileOn(i, j) && G.level.floor[j][i] === '1';
export function camSpot(px, py, maxD = 10) {
  let best = null, bd = maxD;
  const i0 = Math.floor(px / TILE), j0 = Math.floor(py / TILE);
  for (let j = j0 - 2; j <= j0 + 2; j++) for (let i = i0 - 2; i <= i0 + 2; i++) {
    if (!walled(i, j)) continue;
    const x0 = i * TILE, y0 = j * TILE, x1 = x0 + TILE - 1, y1 = y0 + TILE - 1;
    if (!tileOn(i, j + 1)) { const x = Math.min(x1 - 1, Math.max(x0 + 1, Math.round(px))), y = y1 - 2.5, d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { x, y, a: -Math.PI / 2 }; } }
    if (!tileOn(i - 1, j)) { const y = Math.min(y1 - 1, Math.max(y0 + 1, Math.round(py))), x = x0 + 2.5, d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { x, y, a: 0 }; } }
  }
  if (best && G.exitOk) { const [u, d] = G.EXIT.local(best.x, best.y); if (u > -4 && u < 19 && d > -4) return null; } // no sobre la puerta ni el botón
  return best;
}
export const camAt = (x, y) => (G.level.cams || []).findIndex(c => Math.hypot(c.x - x, c.y - y) < 4);
