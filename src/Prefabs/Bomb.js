import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { cam, stage } from '../Core/Engine.js';
import { G } from '../Core/Game.js';
import { BOMB } from '../Settings.js';
import { rayDist } from '../World/Grid.js';
import { clips, sampleClip, applyPose, overlayClip } from '../Animations/Clips.js';
import { bombFallSound, bombLandSound, bombLiftSound, bombBoomSound } from '../Core/Audio.js';
import { shake, kick, hitstop, flash, popText } from '../FX/Juice.js';
import { puff } from '../FX/Particles.js';
import { glowTex } from '../FX/GlowTex.js';
import { player } from './Player.js';
import { agents, stunAgent } from './Agent.js';
import { bossTargets, hitBoss } from './MainFrame.js';
import { beeTargets, stunBee } from './Bee.js';

// Bomba aturdidora (level.bombs = [{ x, y }], se pone en el editor › Seguridad › Bomba). Ajustes en BOMB (Settings.js).
// Ciclo de cada punto:  wait → warn (marca roja en el piso) → fall (cae del techo) → ground (se puede recoger)
//                       → lift (el jugador la levanta) → held (la carga sobre la cabeza) → flying (lanzada) → boom → gone
//                       → (BOMB.respawn segundos) → warn otra vez.
// Recoger: quedarse BOMB.pickTime segundos dentro de su círculo. Mientras la cargas, si un agente que no esté aturdido
// entra en BOMB.throwR y lo ves, se la lanzas sola; la explosión aturde a todos los agentes en BOMB.blastR.
// Brazos: clips "carry" (cargándola) y "throw" (lanzándola), editables en animator.html.
const HOLD_Y = 21.5, FALL_H = 70, FACE = Math.PI / 4;   // altura sobre la cabeza · desde dónde cae · el lente mira a la cámara
let group, bombs = [], held = null, throwT = -1, TEX;
const v = new THREE.Vector3();
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
const easeOut = t => 1 - (1 - t) ** 3, easeIn = t => t * t;

// modelo: cuerpo octogonal gris, banda clara arriba, lente grande con ojo rojo y cuatro abrazaderas
function makeModel() {
  const g = new THREE.Group(), lam = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(3, 3, 3.2, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8), lam(0x3b4048));     // cuerpo octogonal
  add(new THREE.BoxGeometry(3.4, 1.1, 3), lam(0x9aa1a9), 0, 2.85, 0);                                       // banda de arriba
  add(new THREE.CylinderGeometry(2, 2, .5, 20).rotateX(Math.PI / 2), lam(0x101216), 0, -.1, 1.75);          // lente
  const eye = add(new THREE.CylinderGeometry(1.25, 1.25, .2, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3a2a }), .2, -.1, 2.05);
  add(new THREE.CylinderGeometry(.75, .75, .22, 16).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x220806 }), .3, -.1, 2.12);
  add(new THREE.CylinderGeometry(.32, .32, .24, 10).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), .85, .55, 2.2); // brillo del lente
  const clamp = lam(0x767d86), tip = lam(0x2a2e34);
  for (const [a, s] of [[Math.PI * .78, 1], [Math.PI * .22, 1], [-Math.PI * .2, 1.1], [-Math.PI * .8, .9]]) {
    const c = add(new THREE.BoxGeometry(1.5 * s, 1.3, 2.2), clamp, Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0); c.rotation.z = a;
    add(new THREE.BoxGeometry(.6, .7, 1.4), tip, Math.cos(a) * 4.1, Math.sin(a) * 4.1, 0).rotation.z = a;
  }
  g.position.y = 3.6;                                   // el modelo se apoya en el piso
  const root = new THREE.Group(); root.add(g); root.rotation.y = FACE;
  return { root, eye };
}

export function initBombs(scene) {
  group = new THREE.Group(); scene.add(group);
  TEX = { glow: glowTex([[0, 'rgba(255,255,255,1)'], [.25, 'rgba(150,230,255,.8)'], [1, 'rgba(60,170,255,0)']]),
          shadow: glowTex([[0, 'rgba(0,0,0,.55)'], [.7, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']]) };
}

// un punto de bomba por cada level.bombs (se rehace con el nivel)
export function syncBombs() {
  for (const b of bombs) b.bar.remove();
  group.clear(); bombs = []; held = null; G.carrying = false;
  for (const p of G.level.bombs || []) makeBomb(p);
  resetBombs();
}
function makeBomb(p) {
  {
    const { root, eye } = makeModel();
    const ring = new THREE.Mesh(new THREE.RingGeometry(BOMB.pickR - .7, BOMB.pickR, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, depthWrite: false }));
    const warn = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.2, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, depthWrite: false }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(4.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false }));
    const wave = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9feaff, ...ADD }));
    const blast = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, ...ADD }));
    for (const m of [ring, warn, shadow, wave]) m.renderOrder = 2;
    const bar = document.createElement('div'); bar.className = 'hidebar use'; bar.innerHTML = '<i></i>'; document.body.append(bar);
    group.add(root, ring, warn, shadow, wave, blast);
    const b = { sx: p.x, sy: p.y, x: p.x, y: p.y, root, eye, ring, warn, shadow, wave, blast, bar };
    bombs.push(b); return b;
  }
}

// bomba "de una vez" (la usa el jefe Main Frame: le caen bombas durante la pelea). Cae en (x, y) y no vuelve.
export function spawnBomb(x, y) {
  const b = makeBomb({ x, y });
  Object.assign(b, { temp: true, st: 'warn', t: 0, prog: 0, bx: x, by: y, boomT: -1 }); bombFallSound();
  return b;
}
// cuántas bombas "de una vez" siguen en juego (cayendo, en el piso, cargada o volando)
export const allBombs = () => bombs;                     // (para pruebas y para el HUD)
export const tempBombsActive = () => bombs.filter(b => b.temp && b.st !== 'gone').length;
function dropTemp() {                                     // al reintentar: las bombas del jefe desaparecen
  for (const b of bombs.filter(b => b.temp)) { group.remove(b.root, b.ring, b.warn, b.shadow, b.wave, b.blast); b.bar.remove(); }
  bombs = bombs.filter(b => !b.temp);
}

export function resetBombs() {
  dropTemp(); held = null; throwT = -1; G.carrying = false;
  bombs.forEach((b, i) => Object.assign(b, { st: 'wait', t: BOMB.dropDelay + i * .35, prog: 0, x: b.sx, y: b.sy, bx: b.sx, by: b.sy, boomT: -1 }));
}

// el agente más cercano que se puede aturdir y que el jugador ve dentro del radio de lanzamiento
function throwTarget() {
  let best = null, bd = BOMB.throwR;
  for (const m of bossTargets()) {                        // el jefe: su cuerpo tapa el rayo, por eso se mira hasta su borde
    const d = Math.hypot(m.x - player.x, m.y - player.y);
    if (d < bd && rayDist(player.x, player.y, Math.atan2(m.y - player.y, m.x - player.x), d, 12) >= d - 10) { bd = d; best = m; }
  }
  for (const e of beeTargets()) {                         // abejas robot
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < bd && rayDist(player.x, player.y, Math.atan2(e.y - player.y, e.x - player.x), d, 12) >= d - 2) { bd = d; best = e; }
  }
  for (const a of agents) {
    if (!a.path.length || a.state === 'ko') continue;
    const d = Math.hypot(a.x - player.x, a.y - player.y);
    if (d < bd && rayDist(player.x, player.y, Math.atan2(a.y - player.y, a.x - player.x), d, 12) >= d - 2) { bd = d; best = a; }
  }
  return best;
}

function explode(b) {
  const x = b.bx, y = b.by; b.st = 'gone'; b.t = BOMB.respawn; b.boomT = 0; b.boomX = x; b.boomY = y;
  bombBoomSound(); puff(x, y); puff(x + 2, y - 1); puff(x - 2, y + 1);
  shake(1.1); kick(.12); hitstop(.07); flash('170,230,255', .35);
  let n = 0, boss = false;
  for (const a of agents) if (a.path.length && Math.hypot(a.x - x, a.y - y) < BOMB.blastR) { stunAgent(a, BOMB.stunTime, x, y); n++; }
  for (const e of beeTargets()) if (Math.hypot(e.x - x, e.y - y) < BOMB.blastR) { stunBee(e, BOMB.stunTime); n++; }
  for (const m of bossTargets()) if (Math.hypot(m.x - x, m.y - y) < BOMB.blastR + 6) { hitBoss(m); boss = true; }   // +6: el cuerpo del jefe es grande
  if (!boss) popText(x, y, n ? (n > 1 ? `${n} STUNNED!` : 'STUNNED!') : 'MISSED!', n ? 'cyan' : 'red');
}

// lógica (solo jugando)
export function updateBombs(dt, p) {
  for (const b of bombs) {
    if (b.st === 'wait' || b.st === 'gone') { if ((b.st === 'wait' || (BOMB.respawn > 0 && !b.temp)) && (b.t -= dt) <= 0) { b.st = 'warn'; b.t = 0; b.x = b.sx; b.y = b.sy; bombFallSound(); } }
    else if (b.st === 'warn') { if ((b.t += dt) >= BOMB.warnTime) { b.st = 'fall'; b.t = 0; } }
    else if (b.st === 'fall') {
      if ((b.t += dt) >= BOMB.dropTime) { b.st = 'ground'; b.t = 0; b.prog = 0; bombLandSound(); puff(b.x, b.y); shake(.35); }
    }
    else if (b.st === 'ground') {
      const near = !held && !G.hiddenKind && G.frozen <= 0 && Math.hypot(p.x - b.x, p.y - b.y) < BOMB.pickR;
      if (near) { if ((b.prog += dt / BOMB.pickTime) >= 1) { b.st = 'lift'; b.t = 0; b.lx = b.x; b.ly = b.y; held = b; G.carrying = true; bombLiftSound(); } }
      else b.prog = Math.max(0, b.prog - dt * 2);
      b.t += dt;
    }
    else if (b.st === 'lift') { if ((b.t += dt) >= BOMB.liftTime) { b.st = 'held'; b.t = 0; } }
    else if (b.st === 'held') {
      const a = !G.hiddenKind && throwTarget();
      if (a) {                                                       // ¡lanzar!
        b.st = 'flying'; b.t = 0; b.target = a; b.fx = p.x; b.fy = p.y; held = null; G.carrying = false; throwT = 0;
        player.ang = Math.atan2(a.y - p.y, a.x - p.x); kick(.05);
      }
    }
    else if (b.st === 'flying') {
      const k = Math.min(1, (b.t += dt) / BOMB.throwTime);
      b.bx = b.fx + (b.target.x - b.fx) * k; b.by = b.fy + (b.target.y - b.fy) * k;   // sigue al agente: siempre le cae encima
      if (k >= 1) explode(b);
    }
  }
}

// brazos del jugador: levantándola (mezcla hacia "carry"), cargándola ("carry") o lanzándola ("throw")
function armsPose(dt) {
  const ch = player.ch; if (!ch || !ch.pose) return;
  if (throwT >= 0) { throwT += dt; if (clips.throw && throwT < clips.throw.duration) overlayClip(ch, 'throw', throwT); else throwT = -1; return; }
  if (!held || !clips.carry) return;
  const k = held.st === 'lift' ? easeOut(Math.min(1, held.t / BOMB.liftTime)) : 1, goal = sampleClip(clips.carry, G.t);
  for (const c in goal) ch.pose[c] = (ch.pose[c] ?? 0) + (goal[c] - (ch.pose[c] ?? 0)) * k;
  applyPose(ch, ch.pose);
}

// visual (cada frame, después de animatePlayer)
export function animateBombs(dt) {
  const edit = G.mode === 'edit', play = G.mode === 'play' || G.mode === 'caught' || G.mode === 'over';
  if (play && G.intro < 0 && G.asm < 0) armsPose(dt);
  for (const b of bombs) {
    let st = edit ? 'ground' : b.st; if (!edit && !play && st !== 'ground') st = 'hidden';
    b.root.visible = ['fall', 'ground', 'lift', 'held', 'flying'].includes(st) && !(G.asm >= 0);
    b.warn.visible = b.shadow.visible = st === 'warn' || st === 'fall';
    b.ring.visible = st === 'ground' && !held;
    const bob = Math.sin(G.t * 3 + b.x) * .25;
    if (st === 'warn' || st === 'fall') {                            // marca roja que se cierra + sombra que crece
      const k = st === 'warn' ? b.t / BOMB.warnTime : 1, f = st === 'fall' ? easeIn(Math.min(1, b.t / BOMB.dropTime)) : 0;
      b.warn.position.set(b.x, Z + .3, -b.y); b.warn.scale.setScalar(2.2 - 1.2 * k); b.warn.material.opacity = .5 + .5 * Math.abs(Math.sin(G.t * 12));
      b.shadow.position.set(b.x, Z + .26, -b.y); b.shadow.scale.setScalar(.3 + .7 * Math.max(k * .6, f)); b.shadow.material.opacity = .4 + .6 * f;
      if (st === 'fall') { b.root.position.set(b.x, Z + FALL_H * (1 - f), -b.y); b.root.rotation.set(0, FACE + (1 - f) * 4, 0); b.root.scale.setScalar(1); }
    }
    if (st === 'ground') {
      const land = edit ? 1 : Math.min(1, b.t / .25), sq = 1 - Math.sin(land * Math.PI) * .25;   // aplastón al caer
      b.root.position.set(b.x, Z + (edit ? 0 : bob + .25), -b.y); b.root.rotation.set(0, FACE, 0); b.root.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      b.ring.position.set(b.x, Z + .32, -b.y); b.ring.material.opacity = .35 + .2 * Math.sin(G.t * 4) + b.prog * .4;
      b.ring.scale.setScalar(1 + .04 * Math.sin(G.t * 4));
    }
    if (st === 'lift' || st === 'held') {                            // del piso a las manos, sobre la cabeza
      const k = st === 'lift' ? easeOut(Math.min(1, b.t / BOMB.liftTime)) : 1, walk = player.moving ? Math.abs(Math.sin(G.t * 12)) * .5 : 0;
      b.root.position.set(b.lx + (player.x - b.lx) * k, Z + (HOLD_Y + walk) * k, -(b.ly + (player.y - b.ly) * k));
      b.root.rotation.set(0, player.ang + Math.PI / 2, 0); b.root.scale.setScalar(1);
      b.root.visible = !G.hiddenKind;
    }
    if (st === 'flying') {
      const k = Math.min(1, b.t / BOMB.throwTime);
      b.root.position.set(b.bx, Z + HOLD_Y * (1 - k) + Math.sin(k * Math.PI) * BOMB.throwArc, -b.by); b.root.rotation.set(k * 9, FACE, k * 5);
    }
    b.eye.material.color.setHex(st === 'held' || st === 'flying' ? (Math.sin(G.t * 24) > 0 ? 0xff3a2a : 0xffe0a0) : Math.sin(G.t * 5) > 0 ? 0xff3a2a : 0x7a1410);
    // barra de recogida
    const show = play && st === 'ground' && b.prog > 0;
    b.bar.style.display = show ? 'block' : 'none';
    if (show) {
      v.set(b.x, Z + 12, -b.y).project(cam);
      b.bar.style.left = ((v.x + 1) / 2 * stage.clientWidth) + 'px'; b.bar.style.top = ((1 - v.y) / 2 * stage.clientHeight) + 'px';
      b.bar.firstChild.style.width = (b.prog * 100) + '%';
    }
    // explosión: destello y onda que se expande
    if (b.boomT >= 0 && !edit) {
      b.boomT += dt; const k = b.boomT / .6;
      b.wave.visible = b.blast.visible = k < 1;
      if (k < 1) {
        b.wave.position.set(b.boomX, Z + .4, -b.boomY); b.wave.scale.setScalar(BOMB.blastR * easeOut(k)); b.wave.material.opacity = 1 - k;
        b.blast.position.set(b.boomX, Z + 6, -b.boomY); b.blast.scale.setScalar(10 + 26 * easeOut(Math.min(1, k * 2))); b.blast.material.opacity = (1 - k) * 1.2;
      } else b.boomT = -1;
    } else b.wave.visible = b.blast.visible = false;
  }
}
