import * as THREE from 'three';
import { Z, W, D } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { MAINFRAME as B, LASER, SEMA } from '../Settings.js';
import { PROPS, rot } from '../Data/PropLibrary.js';
import { listGeo } from '../Core/VoxelMesh.js';
import { M } from '../Materials/Materials.js';
import { hAt, free } from '../World/Grid.js';
import { zapSound, towerRiseSound } from '../Core/Audio.js';
import { shake, kick, hitstop, flash, popText } from '../FX/Juice.js';
import { puff } from '../FX/Particles.js';
import { spawnBomb, tempBombsActive } from './Bomb.js';
import { player } from './Player.js';
import { crystalSound } from '../Core/Audio.js';

// Main Frame: el jefe (prop "MainFrame", modelo assets/vox/props/MainFrame.vox con partes "cuerpo" y "patas").
// El cuerpo va pegado al escenario; la cruz de patas del piso GIRA alrededor del centro y, cuando el jugador entra
// en su radio, dispara un láser rojo desde la punta de cada pata hacia afuera: cuatro haces que barren el piso
// como las aspas de un ventilador (se cortan en paredes y muebles altos). Tocar un haz mata.
// Ciclo: carga (las puntas parpadean y el haz se ve tenue = aviso) → dispara → descansa → carga…
// Al disparar gira más rápido. El glitch lo congela. Círculo: verde dormido · amarillo cargando · rojo disparando.
let group, beamMat, warnMat, ringGeo, cableMat, clampMat, segGeo, bosses = [];
// cables que cuelgan del techo: salen de los enchufes de la tapa (coordenadas del modelo sin rotar), suben muy alto
// (se pierden arriba, como si vinieran del techo) y se mecen lento. [x, y, grosor, hacia dónde se abren]
const CABLES = [[13.5, 13.5, 1.8, [-1, -1]], [18.5, 18.5, 1.8, [1, 1]], [18.5, 13.5, 1.2, [1, -1]], [13.5, 18.5, 1.2, [-1, 1]], [15.5, 16.5, 1.5, [0, 1]]];
const va = new THREE.Vector3(), vb = new THREE.Vector3(), dir = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const CABLE_Z = 20, CABLE_TOP = 150, SEG = 4;          // desde la tapa del núcleo hasta bien arriba, en tramos de 4
function tp(P, r, [x, y]) { const { w, d } = P; return r === 1 ? [d - y, x] : r === 2 ? [w - x, d - y] : r === 3 ? [y, w - x] : [x, y]; }

export function initMainFrames(scene) {
  group = new THREE.Group(); scene.add(group);
  beamMat = new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: .95, depthWrite: false });
  warnMat = new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: .22, depthWrite: false });
  ringGeo = new THREE.RingGeometry(B.wake - .8, B.wake, 64).rotateX(-Math.PI / 2);
  cableMat = new THREE.MeshLambertMaterial({ color: 0x16191c }); clampMat = new THREE.MeshBasicMaterial({ color: 0x3be07c });
  segGeo = new THREE.BoxGeometry(1, 1, 1);
}

export function syncMainFrames() {
  group.clear(); bosses = []; G.bossCrystal = null;
  for (const p of G.level.props) {
    if (!p.t.startsWith('MainFrame')) continue;
    const R = rot(p.t, p.r), legs = R.part('patas');
    if (!legs.length) continue;
    const xs = legs.map(v => v[0]), ys = legs.map(v => v[1]);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    const tipR = Math.max(...legs.map(v => Math.hypot(v[0] + .5 - cx, v[1] + .5 - cy)));          // largo de una pata
    const mat = M.voxel.clone(); mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -1;
    const mesh = new THREE.Mesh(listGeo(legs).translate(-cx, -cy, 0), mat); mesh.rotation.x = -Math.PI / 2; mesh.castShadow = true;
    const pivot = new THREE.Group(); pivot.position.set(p.x + cx, Z, -(p.y + cy)); pivot.add(mesh); group.add(pivot);
    // un haz por pata (en el mismo grupo que gira, saliendo de la punta) y una luz en cada punta
    const beams = [0, 1, 2, 3].map(k => {
      const g = new THREE.Group(); g.rotation.y = k * Math.PI / 2; pivot.add(g);
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, .5, .5).translate(.5, 0, 0), beamMat); m.position.set(tipR, B.beamY, 0); m.visible = false; g.add(m);
      const led = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ color: 0xff2030 })); led.position.set(tipR - .3, 1.6, 0); g.add(led);
      return { m, led, len: 0 };
    });
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: SEMA.green, transparent: true, opacity: .3, depthWrite: false }));
    ring.position.set(p.x + cx, Z + .3, -(p.y + cy)); ring.renderOrder = 2; group.add(ring);
    const cables = CABLES.map(([mx, my, th, dir], i) => {
      const [x, y] = tp(PROPS[p.t], p.r, [mx, my]), [dx, dy] = tp(PROPS[p.t], p.r, [mx + dir[0], my + dir[1]]).map((v, k) => v - [x, y][k]);
      const segs = []; for (let z = CABLE_Z; z < CABLE_TOP; z += SEG) {
        const m = new THREE.Mesh(segGeo, (z / SEG) % 6 === 0 ? clampMat : cableMat); m.scale.set(th, SEG + .4, th); group.add(m); segs.push(m);
      }
      return { x: p.x + x, y: p.y + y, dx, dy, segs, ph: i * 1.7, phase: 0, amp: 2.5, sp: 1.1 };
    });
    bosses.push({ x: p.x + cx, y: p.y + cy, tipR, pivot, beams, ring, mat, cables, ang: 0, state: 'idle', t: 0 });
  }
  if (bosses.length) G.bossCrystal = { open: false, t: 0, inX: bosses[0].x, inY: bosses[0].y, outX: bosses[0].x, outY: bosses[0].y };   // el primero guarda el cristal
  resetMainFrames();
}
export function resetMainFrames() {   // el ángulo sigue donde estaba (sin salto al reintentar)
  G.bossDown = false; if (G.bossCrystal) Object.assign(G.bossCrystal, { open: false, t: 0 });
  for (const b of bosses) Object.assign(b, { state: 'idle', t: 0, spinV: B.spinIdle, hp: B.hp, dead: false, stunT: 0, bombT: B.bombFirst, sparkT: 0 });
}

// ---------- pelea con bombas ----------
export const bossTargets = () => bosses.filter(b => !b.dead);       // a quién le puede lanzar una bomba el jugador
export function hitBoss(b) {                                         // le explotó una bomba encima
  if (b.dead) return;
  b.hp--; hitstop(.1); shake(1.3); kick(.14); puff(b.x, b.y); puff(b.x + 3, b.y - 2);
  if (b.hp <= 0) {                                                   // ¡derrotado!
    b.dead = true; b.state = 'down'; b.t = 0; G.bossDown = true;
    flash('255,255,255', .6); popText(b.x, b.y, 'MAIN FRAME DOWN!', 'cyan');
    const c = G.bossCrystal;
    if (c && c.inX === b.x && c.inY === b.y) {                         // suelta el cristal hacia donde está el jugador
      const s = crystalSpot(b); Object.assign(c, { open: true, t: -B.crystalDelay, outX: s[0], outY: s[1] });
    }
  } else {
    b.state = 'stun'; b.t = 0; b.stunT = B.stunTime; flash('255,80,60', .3);
    popText(b.x, b.y, `HIT! ${b.hp} LEFT`, 'red');
  }
}
// dónde cae el cristal: hacia el jugador, a B.crystalDist del centro (si ahí no hay lugar, prueba girando)
function crystalSpot(b) {
  const a0 = Math.atan2(player.y - b.y, player.x - b.x);
  for (let i = 0; i < 16; i++) {
    const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * .4, x = b.x + Math.cos(a) * B.crystalDist, y = b.y + Math.sin(a) * B.crystalDist;
    if (free(x, y, 3)) return [x, y];
  }
  return [player.x, player.y];
}
// el cristal del jefe: null mientras pelea; sale de su cabeza, vuela en arco y cae (ready = ya se puede recoger)
export function bossCrystalPos() {
  const c = G.bossCrystal; if (!c || !c.open || c.t < 0) return null;
  const k = Math.min(1, c.t / B.crystalTime), e = 1 - (1 - k) ** 2;
  return { x: c.inX + (c.outX - c.inX) * e, y: c.inY + (c.outY - c.inY) * e, hop: (1 - k) * 8 + Math.sin(k * Math.PI) * 10, ready: k >= 1 };
}
// busca un lugar libre en el piso, a cierta distancia del jefe, para que caiga una bomba
function bombSpot(b) {
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, d = B.bombMin + Math.random() * (B.bombMax - B.bombMin);
    const x = b.x + Math.cos(a) * d, y = b.y + Math.sin(a) * d;
    if (free(x, y, 4)) return [x, y];
  }
  return null;
}

// hasta dónde llega un haz que sale del centro en el ángulo a (se corta en paredes y muebles altos)
function reach(b, a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  for (let d = b.tipR; d < B.beamLen; d += .5) {
    const x = b.x + dx * d, y = b.y + dy * d;
    if (x < 0 || y < 0 || x >= W || y >= D || hAt(x, y) > LASER.blockH) return d;
  }
  return B.beamLen;
}
const segDist = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay, k = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1))); return Math.hypot(px - (ax + vx * k), py - (ay + vy * k)); };

// lógica (jugando): gira, cambia de estado y devuelve true si un haz alcanzó al jugador
export function updateMainFrames(dt, p) {
  let hit = false;
  for (const b of bosses) {
    if (b.dead) { b.spinV += (0 - b.spinV) * Math.min(1, dt * 1.5); b.ang += dt * b.spinV; continue; }   // derrotado: se apaga y deja de girar
    if (G.frozen > 0) continue;                                       // el glitch lo congela
    const near = Math.hypot(p.x - b.x, p.y - b.y) < B.wake;
    b.t += dt;
    if (b.state !== 'idle' && (b.bombT -= dt) <= 0) {                 // durante la pelea le caen bombas cerca
      b.bombT = B.bombEvery;
      if (!tempBombsActive()) { const s = bombSpot(b); if (s) spawnBomb(s[0], s[1]); }
    }
    if (b.state === 'stun') { if ((b.stunT -= dt) <= 0) { b.state = 'rest'; b.t = 0; } }
    else if (b.state === 'idle' && near) { b.state = 'charge'; b.t = 0; towerRiseSound(); }
    else if (b.state === 'charge' && b.t >= B.chargeTime) { b.state = 'fire'; b.t = 0; zapSound(.8); shake(.5); }
    else if (b.state === 'fire' && b.t >= B.fireTime) { b.state = 'rest'; b.t = 0; }
    else if (b.state === 'rest' && b.t >= B.restTime) { b.state = near ? 'charge' : 'idle'; b.t = 0; }
    const goal = b.state === 'fire' ? B.spinFire : b.state === 'idle' ? B.spinIdle : b.state === 'stun' ? .08 : B.spin;
    b.spinV += (goal - b.spinV) * Math.min(1, dt * 2.5);              // acelera y frena suave (sin tirones al cambiar de fase)
    b.ang += dt * b.spinV;
    for (let k = 0; k < 4; k++) {                                     // largo de cada haz y si te toca
      const a = b.ang + k * Math.PI / 2, len = reach(b, a); b.beams[k].len = len - b.tipR;
      if (b.state === 'fire' && segDist(p.x, p.y, b.x + Math.cos(a) * B.hubR, b.y + Math.sin(a) * B.hubR, b.x + Math.cos(a) * len, b.y + Math.sin(a) * len) < B.hitR) hit = true;   // las patas también queman mientras dispara
    }
  }
  return hit;
}

// visual (cada frame)
export function animateMainFrames(dt) {
  const play = G.mode === 'play' || G.mode === 'over' || G.mode === 'caught';
  const bc = G.bossCrystal;
  if (bc && bc.open && play) {
    const was = bc.t; bc.t = Math.min(B.crystalTime, bc.t + dt);
    if (was < 0 && bc.t >= 0) { crystalSound(); puff(bc.inX, bc.inY); kick(.06); }   // ¡sale el cristal!
  }
  for (const b of bosses) {
    if (!play) { b.state = 'idle'; b.dead = false; b.spinV = B.spinIdle; b.ang += dt * B.spinIdle; }
    const stun = b.state === 'stun', down = b.state === 'down';
    if (stun && (b.sparkT -= dt) <= 0) { b.sparkT = .25 + Math.random() * .3; puff(b.x + (Math.random() - .5) * 12, b.y + (Math.random() - .5) * 12); }   // chispas
    b.pivot.rotation.y = b.ang;                                       // (en el juego el ángulo crece hacia +y, que en Three es -z: mismo sentido)
    if (b.mat.emissive) b.mat.emissive.setRGB(b.state === 'fire' ? .55 + .25 * Math.sin(G.t * 30) : b.state === 'charge' ? .25 * (Math.floor(G.t * 14) % 2) : 0, 0, 0);   // patas al rojo vivo
    const fire = b.state === 'fire', warn = b.state === 'charge', blink = Math.floor(G.t * 14) % 2;
    for (const be of b.beams) {
      be.m.visible = play && (fire || (warn && blink)) && be.len > .5;
      be.m.material = fire ? beamMat : warnMat;
      be.m.scale.set(Math.max(.01, be.len), fire ? 1 + Math.sin(G.t * 45) * .2 : .6, fire ? 1 + Math.sin(G.t * 45) * .2 : .6);
      be.led.visible = !down && (stun ? Math.random() > .5 : !warn || blink); be.led.scale.setScalar(fire ? 1.3 : 1);   // aturdido: parpadeo de falla · derrotado: apagado
    }
    b.ring.material.color.setHex(fire ? SEMA.red : stun ? 0x4db8ff : warn || b.state === 'rest' ? SEMA.yellow : SEMA.green);
    b.ring.material.opacity = down ? 0 : fire ? .45 : .22 + .08 * Math.sin(G.t * 4);
    for (const c of b.cables) {                                       // cables: se abren hacia el techo y se mecen (más en el medio)
      // la fase avanza a la velocidad del momento (no G.t × velocidad: eso hacía saltar los cables al cambiar de ritmo)
      c.amp += ((fire ? 4 : stun ? 5 : down ? .5 : 2.5) - c.amp) * Math.min(1, dt * 2); c.sp += ((fire ? 3 : stun ? 5 : down ? .4 : 1.1) - c.sp) * Math.min(1, dt * 2);
      c.phase = (c.phase + dt * c.sp) % (Math.PI * 2);
      const n = c.segs.length, amp = c.amp;
      const pt = (j, out) => { const k = j / n, sw = Math.sin(k * Math.PI) * amp * Math.sin(c.phase + c.ph + k * 2.5);
        return out.set(c.x + c.dx * 18 * k * k + sw, Z + CABLE_Z + j * SEG, -(c.y + c.dy * 18 * k * k + sw * .6)); };
      c.segs.forEach((m, j) => {
        pt(j, va); pt(j + 1, vb); dir.subVectors(vb, va); const len = dir.length();
        m.position.addVectors(va, vb).multiplyScalar(.5); m.quaternion.setFromUnitVectors(UP, dir.normalize()); m.scale.y = len + .3;
      });
    }
  }
}
