import * as THREE from 'three';
import { Z, W, D } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { SNAKE as S, SEMA } from '../Settings.js';
import { free, rayDist } from '../World/Grid.js';
import { hissSound } from '../Core/Audio.js';
import { popText, shake } from '../FX/Juice.js';
import { puff } from '../FX/Particles.js';

// Serpiente robot (level.snakes = [{ x, y }]; ajustes en SNAKE, Settings.js). Se mueve como en Snake: de casilla en casilla
// (S.cell vóxeles), solo gira en ángulo recto y nunca vuelve sobre sí misma; el cuerpo sigue el rastro de la cabeza.
//   patrol → sigue derecho y a veces gira; si se aleja mucho de su lugar, tiende a volver
//   hunt   → te vio: anillo rojo, más rápida, en cada casilla elige el giro que más la acerca a ti
//   ko     → una bomba la apaga unos segundos (el cuerpo se cae al piso)
// Si la cabeza te toca, te atrapa. El glitch la congela. Escondido no te ve.
let group, snakes = [];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const HIGH = 10;                                         // altura que le tapa la vista (paredes, muebles altos)
const lam = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
let MAT;

export function initSnakes(scene) {
  group = new THREE.Group(); scene.add(group);
  MAT = { shell: lam(0x3a3f47), plate: lam(0x8e96a0), dark: lam(0x1b1d21), band: new THREE.MeshBasicMaterial({ color: SEMA.green }),
          eye: new THREE.MeshBasicMaterial({ color: 0xff3a2a }) };
}

function makeHead() {
  const g = new THREE.Group(), add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(4.4, 3, 4), MAT.shell, 0, 1.9, 0);                    // cabeza (mira hacia +x)
  add(new THREE.BoxGeometry(1.6, 2.2, 3.4), MAT.plate, 2.6, 1.6, 0);             // hocico
  add(new THREE.BoxGeometry(3.6, .5, 4.2), MAT.dark, .2, 3.55, 0);               // placa de arriba
  const band = add(new THREE.BoxGeometry(4.6, .45, 4.2), MAT.band.clone(), -.2, .75, 0);
  for (const z of [-1.1, 1.1]) add(new THREE.BoxGeometry(.4, .7, .8), MAT.eye, 3.45, 2.3, z);   // ojos rojos
  add(new THREE.BoxGeometry(.25, 1.6, .25), MAT.dark, -.8, 4.5, 0);              // antena
  const tip = add(new THREE.BoxGeometry(.6, .6, .6), MAT.band.clone(), -.8, 5.4, 0);
  return { g, band, tip };
}
function makeSeg(i) {
  const g = new THREE.Group(), s = 1 - i / (S.len + 3) * .55;
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 3.4), MAT.shell); body.position.y = 1.5; body.castShadow = true;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(2.4, .4, 3.6), i % 2 ? MAT.dark : MAT.plate); plate.position.y = 2.85;
  const band = new THREE.Mesh(new THREE.BoxGeometry(3.6, .35, 3.6), MAT.band.clone()); band.position.y = .9;
  g.add(body, plate, band); g.scale.setScalar(s);
  return { g, band };
}

const cellOf = v => Math.floor(v / S.cell);
const center = i => (i + .5) * S.cell;
const key = (i, j) => i + ',' + j;
const okCell = (i, j) => { const x = center(i), y = center(j); return x > 2 && y > 2 && x < W - 2 && y < D - 2 && free(x, y, S.cell * .45); };

export function syncSnakes() {
  group.clear(); snakes = [];
  for (const p of G.level.snakes || []) {
    const head = makeHead(), segs = Array.from({ length: S.len }, (_, i) => makeSeg(i));
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: SEMA.green, transparent: true, opacity: .5, depthWrite: false }));
    ring.renderOrder = 2;
    group.add(head.g, ring, ...segs.map(s => s.g));
    snakes.push({ hi: cellOf(p.x), hj: cellOf(p.y), head, segs, ring });
  }
  resetSnakes();
}
export function resetSnakes() {
  for (const s of snakes) {
    s.cells = Array.from({ length: S.len + 2 }, () => [s.hi, s.hj]);   // todo el cuerpo enroscado en su lugar; se estira al andar
    s.dir = DIRS.findIndex(([a, b]) => okCell(s.hi + a, s.hj + b)); if (s.dir < 0) s.dir = 0;
    Object.assign(s, { state: 'patrol', k: 0, lost: 0, koT: 0, x: center(s.hi), y: center(s.hj), ang: 0 });
  }
}

// ---------- bombas ----------
export const snakeTargets = () => snakes.filter(s => s.state !== 'ko');
export function stunSnake(s, t) { s.state = 'ko'; s.koT = t; puff(s.x, s.y); }

// la siguiente casilla: derecho, izquierda o derecha (nunca para atrás ni sobre su cuerpo)
function nextDir(s, p) {
  const [hi, hj] = s.cells[0], body = new Set(s.cells.slice(0, -2).map(c => key(...c)));   // la punta de la cola se va a mover
  const opts = [s.dir, (s.dir + 1) % 4, (s.dir + 3) % 4].filter(d => { const i = hi + DIRS[d][0], j = hj + DIRS[d][1]; return okCell(i, j) && !body.has(key(i, j)); });
  if (!opts.length) return -1;
  const dist = (d, tx, ty) => Math.abs(center(hi + DIRS[d][0]) - tx) + Math.abs(center(hj + DIRS[d][1]) - ty);
  if (s.state === 'hunt') return opts.reduce((a, b) => dist(b, p.x, p.y) < dist(a, p.x, p.y) - .1 ? b : a);
  const far = Math.hypot(center(hi) - center(s.hi), center(hj) - center(s.hj)) > S.wander;
  if (far && Math.random() < .6) return opts.reduce((a, b) => dist(b, center(s.hi), center(s.hj)) < dist(a, center(s.hi), center(s.hj)) ? b : a);
  if (opts[0] === s.dir && Math.random() > S.turnChance) return s.dir;
  return opts[Math.random() * opts.length | 0];
}

// lógica (jugando): devuelve true si alguna te atrapó
export function updateSnakes(dt, p) {
  let hit = false;
  for (const s of snakes) {
    if (s.state === 'ko') { if ((s.koT -= dt) <= 0) { s.state = 'patrol'; } continue; }
    if (G.frozen > 0) continue;                                        // el glitch la congela
    // ¿te ve? (cualquier dirección: tiene sensores)
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
    const sees = !G.hiddenKind && d < S.range && rayDist(s.x, s.y, Math.atan2(dy, dx), d, HIGH) >= d - 1;
    if (sees) { if (s.state !== 'hunt') { s.state = 'hunt'; hissSound(); popText(s.x, s.y, 'HSSS!', 'red'); } s.lost = S.lostTime; }
    else if (s.state === 'hunt' && (s.lost -= dt) <= 0) s.state = 'patrol';
    // avanzar
    s.k += dt / (s.state === 'hunt' ? S.huntStep : S.step);
    while (s.k >= 1) {
      s.k -= 1;
      let d2 = nextDir(s, p);
      if (d2 < 0) { s.cells.reverse(); const [a, b] = s.cells[0], [c, e] = s.cells[1]; s.dir = DIRS.findIndex(([u, v]) => u === Math.sign(a - c) && v === Math.sign(b - e)); d2 = nextDir(s, p); }   // encerrada: se da vuelta
      if (d2 < 0) { s.k = 0; break; }
      s.dir = d2; const [hi, hj] = s.cells[0];
      s.cells.unshift([hi + DIRS[d2][0], hj + DIRS[d2][1]]); s.cells.pop();
    }
    // dónde está la cabeza ahora (entre su casilla anterior y la nueva)
    const [ai, aj] = s.cells[1], [bi, bj] = s.cells[0];
    s.x = center(ai) + (center(bi) - center(ai)) * s.k; s.y = center(aj) + (center(bj) - center(aj)) * s.k;
    if (!G.hiddenKind && Math.hypot(p.x - s.x, p.y - s.y) < S.hitR) hit = true;
  }
  return hit;
}

// visual (cada frame)
export function animateSnakes(dt) {
  if (G.mode === 'edit') resetSnakes();                                    // en el editor: enroscada en su lugar
  for (const s of snakes) {
    const ko = s.state === 'ko', hunt = s.state === 'hunt', k = ko ? 0 : s.k, c = ko ? 0x555a5e : hunt ? SEMA.red : SEMA.green;
    const pos = i => { const [ai, aj] = s.cells[i + 1], [bi, bj] = s.cells[i]; return [center(ai) + (center(bi) - center(ai)) * k, center(aj) + (center(bj) - center(aj)) * k]; };
    // cabeza
    const [hx, hy] = pos(0), [nx, ny] = s.cells[0], [px, py] = s.cells[1];
    const want = nx === px && ny === py ? s.ang : Math.atan2(ny - py, nx - px);         // mira hacia donde va
    s.ang += Math.atan2(Math.sin(want - s.ang), Math.cos(want - s.ang)) * Math.min(1, dt * 14);
    s.head.g.position.set(hx, Z + (ko ? -.6 : Math.abs(Math.sin(G.t * 9)) * .25), -hy); s.head.g.rotation.set(ko ? .5 : 0, s.ang, 0);
    s.head.band.material.color.setHex(c); s.head.tip.material.color.setHex(ko ? 0x333333 : Math.sin(G.t * (hunt ? 18 : 4)) > 0 ? c : 0x222222);
    s.ring.position.set(hx, Z + .3, -hy); s.ring.material.color.setHex(c); s.ring.material.opacity = ko ? .15 : hunt ? .45 + .25 * Math.sin(G.t * 14) : .35;
    // cuerpo: cada segmento en su casilla del rastro, con una ondita que recorre la serpiente
    let lx = hx, ly = hy;
    s.segs.forEach((seg, i) => {
      const [x, y] = pos(i + 1), wave = ko ? 0 : Math.sin(G.t * 8 - i * .9) * .35;
      seg.g.position.set(x, Z + (ko ? -.5 : Math.max(0, wave)), -y);
      const sep = Math.hypot(lx - x, ly - y); if (sep > .05) seg.g.rotation.y = Math.atan2(ly - y, lx - x);
      seg.g.visible = sep > .05;                                     // enroscada al empezar: no apila todo
      seg.band.material.color.setHex(i % 2 ? c : 0x2a2e34);
      lx = x; ly = y;
    });
  }
}
