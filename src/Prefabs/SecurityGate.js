import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { GATE } from '../Settings.js';
import { laserEnds } from './LaserGate.js';
import { gateSound } from '../Core/Audio.js';
import { shake, popText } from '../FX/Juice.js';

// Puertas de seguridad (barrotes): level.gates = [{ x, y, dir: 'x' | 'y' }], se ponen en el editor › Seguridad › Barrotes.
// Igual que los láseres, van de pared a pared (o hasta el primer mueble alto) por donde hagas clic.
// Normalmente están abiertas (escondidas en una ranura del piso). Cuando suena una alarma (te ve un agente o una
// cámara), los barrotes suben y cierran el paso GATE.closeTime segundos; después bajan solos.
// Solo frenan al jugador: los guardias tienen la llave. El glitch congela la cuenta.
const BAR_GAP = 2.4, BAR_H = 20;
let group, barGeo, capGeo, railMat, hazMat, barMat, capMat, lampMat, gates = [], lastAlerts = 0;

export function initGates(scene) {
  group = new THREE.Group(); scene.add(group);
  barGeo = new THREE.BoxGeometry(.9, BAR_H, .9).translate(0, BAR_H / 2, 0); capGeo = new THREE.BoxGeometry(1.3, 1, 1.3);
  barMat = new THREE.MeshLambertMaterial({ color: 0x3c4249 }); capMat = new THREE.MeshLambertMaterial({ color: 0x8a939b });
  railMat = new THREE.MeshLambertMaterial({ color: 0x1d2024 }); hazMat = new THREE.MeshLambertMaterial({ color: 0xf2c230 });
  lampMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
}

export function syncGates() {
  group.clear(); gates = [];
  for (const d of G.level.gates || []) {
    const [a, b] = laserEnds(Math.floor(d.x), Math.floor(d.y), d.dir), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 2) continue;
    const g = new THREE.Group(), ang = d.dir === 'x' ? 0 : Math.PI / 2;    // a lo largo de x, o girado para y
    g.position.set(a[0], Z, -a[1]); g.rotation.y = ang;
    // ranura en el piso con franjas amarillas y negras (siempre visible: avisa que ahí hay una puerta)
    const n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i < n; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(len / n, .25, 2.2), i % 2 ? railMat : hazMat); s.position.set((i + .5) * len / n, .12, 0); g.add(s); }
    // barrotes (suben desde la ranura)
    const bars = new THREE.Group(); g.add(bars);
    for (let x = BAR_GAP / 2; x < len; x += BAR_GAP) {
      const bar = new THREE.Mesh(barGeo, barMat); bar.position.x = x; bar.castShadow = true; bars.add(bar);
      const cap = new THREE.Mesh(capGeo, capMat); cap.position.set(x, BAR_H, 0); bars.add(cap);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 1.2, 1.2), capMat); beam.position.set(len / 2, BAR_H * .55, 0); bars.add(beam);   // travesaño
    // lucecitas rojas en las puntas (parpadean cuando está cerrada)
    const lamps = [0, len].map(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), lampMat.clone()); l.position.set(x, 1, 0); g.add(l); return l; });
    group.add(g);
    gates.push({ a, b, len, dir: d.dir, bars, lamps, k: 0, closeT: 0 });
  }
  resetGates();
}
export function resetGates() { lastAlerts = G.alerts || 0; for (const g of gates) { g.k = 0; g.closeT = 0; } }

// distancia del punto al segmento del portón y de qué lado está (para empujar al jugador si lo agarra cerrando)
function rel(g, x, y) {
  const vx = g.b[0] - g.a[0], vy = g.b[1] - g.a[1], L2 = vx * vx + vy * vy;
  const k = ((x - g.a[0]) * vx + (y - g.a[1]) * vy) / L2, side = (x - g.a[0]) * vy - (y - g.a[1]) * vx;
  return { along: k, perp: side / Math.sqrt(L2) };
}

// ¿un barrote cerrado bloquea al jugador en (x, y)? (lo usa Player.js al moverse)
export function gateBlocks(x, y, r = 1.5) {
  for (const g of gates) {
    if (g.k < .35) continue;
    const q = rel(g, x, y); if (q.along > -.02 && q.along < 1.02 && Math.abs(q.perp) < r + .6) return true;
  }
  return false;
}

// lógica (jugando): una alarma nueva cierra todos los portones
export function updateGates(dt, p) {
  if (!gates.length) { lastAlerts = G.alerts || 0; return; }
  if ((G.alerts || 0) < lastAlerts) lastAlerts = G.alerts || 0;   // nivel reiniciado
  if ((G.alerts || 0) > lastAlerts) {
    lastAlerts = G.alerts;
    let closing = false;
    for (const g of gates) { if (g.closeT <= 0) closing = true; g.closeT = GATE.closeTime; }
    if (closing) { gateSound(); shake(.4); popText(p.x, p.y, 'LOCKDOWN!', 'red'); }
  }
  for (const g of gates) {
    if (G.frozen <= 0 && g.closeT > 0) g.closeT -= dt;
    const goal = g.closeT > 0 ? 1 : 0, was = g.k;
    g.k += (goal - g.k) * Math.min(1, dt * (goal ? 9 : 3));
    if (was < .35 && g.k >= .35) {                                     // justo al cerrarse: si te agarra encima, te empuja a tu lado
      const q = rel(g, p.x, p.y);
      if (q.along > -.02 && q.along < 1.02 && Math.abs(q.perp) < 2.2) {
        const vx = g.b[0] - g.a[0], vy = g.b[1] - g.a[1], L = Math.hypot(vx, vy), s = q.perp >= 0 ? 1 : -1;
        p.x += (vy / L) * s * (2.4 - Math.abs(q.perp)); p.y += (-vx / L) * s * (2.4 - Math.abs(q.perp));
      }
    }
  }
}

// visual (cada frame)
export function animateGates() {
  const play = G.mode === 'play' || G.mode === 'caught' || G.mode === 'over';
  for (const g of gates) {
    const k = play ? g.k : G.mode === 'edit' ? .25 : 0;                // en el editor se asoman un poco para que se vean
    g.bars.position.y = -BAR_H * (1 - k); g.bars.visible = k > .01 && !(G.asm >= 0);
    const on = play && g.closeT > 0 && Math.floor(G.t * 6) % 2 === 0;
    for (const l of g.lamps) l.material.color.setHex(on ? 0xff2a2a : play && g.closeT > 0 ? 0x5a0a0a : 0x2a0505);
  }
}

// para el editor: índice del portón que pasa cerca de (x, y)
export const gateAt = (x, y) => (G.level.gates || []).findIndex(d => {
  const [a, b] = laserEnds(Math.floor(d.x), Math.floor(d.y), d.dir);
  return d.dir === 'x' ? Math.abs(y - a[1]) < 2.5 && x >= a[0] && x <= b[0] : Math.abs(x - a[0]) < 2.5 && y >= a[1] && y <= b[1];
});
