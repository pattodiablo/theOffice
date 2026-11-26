import * as THREE from 'three';
import { Z, W, D } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { LASER as L } from '../Settings.js';
import { hAt } from '../World/Grid.js';
import { box } from './Character.js';
import { zapSound } from '../Core/Audio.js';

// Láseres intermitentes: cruzan de pared a pared (o hasta el primer mueble alto) en línea recta, a lo largo de x o de y.
// Se prenden L.on segundos y se apagan L.off segundos; antes de prenderse parpadean (aviso). Si el jugador los cruza
// prendidos, muere (ni el disfraz lo salva). El glitch los congela en el estado en que estén.
// En el nivel: lasers: [{ x, y, dir: 'x' | 'y', phase }] — un punto por donde pasa y la dirección; los extremos se calculan solos.
const BEAMS = [3, 8, 13];                     // alturas de los haces sobre el piso
let group, beamMat, warnMat, lasers = [];

// desde (x, y) avanza a cada lado hasta chocar con algo más alto que L.blockH (pared, mueble alto) o salir del piso
export function laserEnds(x, y, dir) {
  const dx = dir === 'x' ? 1 : 0, dy = dir === 'y' ? 1 : 0, ends = [];
  for (const s of [-1, 1]) {
    let k = 0;
    while (k < 400) { const nx = x + dx * s * (k + 1), ny = y + dy * s * (k + 1); if (nx < 0 || ny < 0 || nx >= W || ny >= D || hAt(nx, ny) > L.blockH) break; k++; }
    ends.push([x + dx * s * (k + .5), y + dy * s * (k + .5)]);
  }
  return ends;
}

export function initLasers(scene) {
  group = new THREE.Group(); scene.add(group);
  beamMat = new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: .95, depthWrite: false });
  warnMat = new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: .25, depthWrite: false });
}

export function syncLasers() {
  group.clear(); lasers = [];
  (G.level.lasers || []).forEach((d, i) => {
    const [a, b] = laserEnds(Math.floor(d.x), Math.floor(d.y), d.dir), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 2) return;
    const g = new THREE.Group(), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, along = d.dir === 'x';
    g.position.set(mx, Z, -my); g.rotation.y = along ? 0 : Math.PI / 2; group.add(g);
    const beams = BEAMS.map(h => { const m = new THREE.Mesh(new THREE.BoxGeometry(len, .35, .35), beamMat); m.position.y = h; g.add(m); return m; });
    const leds = [];
    for (const s of [-1, 1]) {                                                    // emisores en cada extremo
      box(g, 1.4, 16, 1.6, 0x2a2f35, s * (len / 2 - .2), 8, 0);
      for (const h of BEAMS) { const led = new THREE.Mesh(new THREE.BoxGeometry(.6, .7, .7), new THREE.MeshBasicMaterial({ color: 0xff2030 })); led.position.set(s * (len / 2 - .9), h, 0); g.add(led); leds.push(led); }
    }
    lasers.push({ d, a, b, beams, leds, phase: d.phase ?? (i % 2) * (L.on + L.off) / 2, t: 0, on: false });
  });
  resetLasers();
}
export function resetLasers() { for (const l of lasers) { l.t = l.phase; l.on = false; } }

// estado según el reloj de cada láser: 'on', 'warn' (parpadea antes de prenderse) u 'off'
const cycle = () => L.on + L.off;
function stateOf(l) { const t = l.t % cycle(); return t < L.on ? 'on' : t > cycle() - L.warn ? 'warn' : 'off'; }

// lógica: devuelve true si el jugador tocó un láser prendido
export function updateLasers(dt, p) {
  let hit = false;
  for (const l of lasers) {
    if (G.frozen <= 0) l.t += dt;
    const on = stateOf(l) === 'on';
    if (on && !l.on && l.near) zapSound(.5);                                    // se prende cerca del jugador: chasquido
    l.on = on;
    const [ax, ay] = l.a, [bx, by] = l.b, vx = bx - ax, vy = by - ay, k = Math.max(0, Math.min(1, ((p.x - ax) * vx + (p.y - ay) * vy) / (vx * vx + vy * vy)));
    const dist = Math.hypot(p.x - (ax + vx * k), p.y - (ay + vy * k)); l.near = dist < 40;
    if (on && dist < L.hitR) hit = true;
  }
  if (hit) zapSound(1);
  return hit;
}

// visual (cada frame): haces prendidos, aviso parpadeante o apagados; en el editor se ven siempre tenues
export function animateLasers() {
  const edit = G.mode === 'edit';
  for (const l of lasers) {
    const st = edit ? 'edit' : stateOf(l), blink = Math.floor(G.t * 14) % 2;
    for (const b of l.beams) {
      b.visible = st === 'on' || st === 'edit' || (st === 'warn' && blink);
      b.material = st === 'on' ? beamMat : warnMat;
      if (st === 'on') b.scale.set(1, 1 + Math.sin(G.t * 40) * .15, 1 + Math.sin(G.t * 40) * .15);
    }
    for (const led of l.leds) led.material.color.setHex(st === 'on' ? 0xff2030 : st === 'warn' ? (blink ? 0xff2030 : 0x401014) : 0x401014);
  }
}

// ---------- editor ----------
export const laserAt = (x, y) => (G.level.lasers || []).findIndex(d => {
  const [a, b] = laserEnds(Math.floor(d.x), Math.floor(d.y), d.dir), vx = b[0] - a[0], vy = b[1] - a[1];
  const k = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(x - (a[0] + vx * k), y - (a[1] + vy * k)) < 2.5;
});
