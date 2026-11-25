import * as THREE from 'three';
import { Z, W, D } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { AGENT_TYPES, VISION_RAYS as NR, SEMA, CATCH_DIST, STEP_VOLUME, AGENT_STEP_RANGE, ANIM_SPEED } from '../Settings.js';
import { makeCharacter, box } from './Character.js';
import { PROPS, rot, propGeo } from '../Data/PropLibrary.js';
import { M } from '../Materials/Materials.js';
import { pose } from '../Animations/CharacterPoses.js';
import { sampleClip, clips, overlayClip } from '../Animations/Clips.js';
import { rayDist } from '../World/Grid.js';
import { flowFrom, stepFlow } from '../World/Navigation.js';
import { turnTo } from '../Core/MathUtils.js';
import { alertSound, footstep } from '../Core/Audio.js';
import { shake, kick, hitstop, slowmo, flash, popText } from '../FX/Juice.js';
import { fireBullet } from './Bullet.js';
import { player } from './Player.js';

// Agente: modelo + cono de visión + radio de acción + IA. Hay tres tipos (ver AGENT_TYPES en Settings.js):
//   normal — el de gafas y gabardina negra
//   red    — gabardina roja: más rápido, ve más lejos, se alarma antes, te busca más tiempo y DISPARA
//   vigia  — dron que flota (modelo assets/vox/props/vigia*.vox): ve por encima de los escritorios y dispara
//            por sus DOS cañones a la vez. Los cañones son las puntas de adelante del modelo (lo más cercano a y = 0).
// Estados: patrol → (te detecta) → alert (salto) → chase (te persigue; el rojo apunta con láser y dispara)
//          → search (te perdió, busca) → return (vuelve a su ruta) → patrol
// Corazonadas (como los fantasmas de Pac-Man): cada tanto un agente deja su ruta (investigate) y va a revisar un punto
// calculado a partir de dónde estás, cada uno con su estilo según su número:
//   1º, 4º… va más o menos a donde estás · 2º, 5º… se adelanta hacia donde vas · 3º, 6º… merodea entre él y tú
// El rojo además, al perseguirte o perderte de vista, va al punto adonde predice que te diriges.
// Refuerzos: cuando un agente te descubre, los que están cerca (helpRadius) vienen a ayudar: el normal corre
// a donde te vieron (assist) y el rojo se pone a perseguirte directamente. El que te descubrió vuelve a pedir ayuda cada 3 s.
export const agents = [];
let scene, chaseField = null, chaseFieldT = 0;
const ringGeos = {};

export function initAgents(s) { scene = s; }
export const agentType = i => { const t = (G.level.agentTypes || [])[i]; return AGENT_TYPES[t] ? t : 'normal'; };

function makeFan() { // cono de visión: abanico de triángulos que se recorta contra los muebles
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NR * 9), 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SEMA.green, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }));
  m.frustumCulled = false; m.renderOrder = 2; scene.add(m); return m;
}
function makeRing(r) { // radio de acción
  const geo = ringGeos[r] ||= new THREE.RingGeometry(r - .5, r, 48).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: SEMA.green, transparent: true, opacity: .55, depthWrite: false })); m.renderOrder = 2; scene.add(m); return m;
}
const laserGeo = new THREE.BoxGeometry(1, .35, .35).translate(.5, 0, 0);   // largo 1 desde el origen; se estira hasta el jugador
function makeLaser() { // mira láser del agente rojo antes de disparar
  const l = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, depthWrite: false })); l.visible = false; l.renderOrder = 3; scene.add(l); return l;
}
// dron vigía: el modelo de MagicaVoxel mira hacia -y (sus cañones apuntan ahí); se gira para que mire hacia +X como los agentes
function makeDrone(P) {
  const root = new THREE.Group(), model = new THREE.Group(); root.add(model); model.rotation.y = Math.PI / 2; model.scale.setScalar(P.scale);
  const key = Object.keys(PROPS).find(k => k.startsWith('vigia')); let tips = [[3, -3, 1], [3, 3, 1]];
  if (key) {
    const R = rot(key, 0), m = new THREE.Mesh(propGeo(key, 0), M.voxel);
    m.rotation.x = -Math.PI / 2; m.position.set(-R.w / 2, 0, R.d / 2); m.castShadow = true; model.add(m);
    // cañones: la punta de adelante de cada lado (izquierda y derecha del modelo)
    tips = [0, 1].map(side => {
      const vs = R.vox.filter(v => side ? v[0] >= R.w / 2 : v[0] < R.w / 2); if (!vs.length) return [3, 0, 1];
      const y0 = Math.min(...vs.map(v => v[1])), f = vs.filter(v => v[1] === y0), avg = i => f.reduce((s, v) => s + v[i] + .5, 0) / f.length;
      return [(R.d / 2 - y0) * P.scale, (avg(0) - R.w / 2) * P.scale, avg(2) * P.scale];   // adelante · costado · altura
    });
  } else box(model, 10, 4, 10, 0x6e737a, 0, 2, 0);                                        // sin modelo: una caja
  root.userData.character = true; scene.add(root);
  return { root, model, drone: true, tips };
}
// dispara: el vigía por sus dos cañones a la vez, los demás desde el pecho
function shoot(a) { if (a.ch.drone) { fireBullet(a, player, tipPos(a, 0)); fireBullet(a, player, tipPos(a, 1)); } else fireBullet(a, player); }
// posición (en el piso, vóxeles) del cañón k de un dron
const tipPos = (a, k) => { const [f, s] = a.ch.tips[k], c = Math.cos(a.ang), si = Math.sin(a.ang); return { x: a.x + c * f - si * s, y: a.y + si * f + c * s }; };
function makeAgent(type) {
  const P = AGENT_TYPES[type];
  const ch = P.drone ? makeDrone(P) : makeCharacter(scene, true, type === 'red');
  return { type, P, ch, fan: makeFan(), ring: makeRing(P.actionR), lasers: P.shoots ? (P.drone ? [makeLaser(), makeLaser()] : [makeLaser()]) : [] };
}
function removeAgent(a) { scene.remove(a.ch.root, a.fan, a.ring, ...a.lasers); }

// crea, cambia o quita agentes para que coincidan con las rutas y tipos del nivel
export function syncAgents() {
  const routes = G.level.agents;
  while (agents.length > routes.length) removeAgent(agents.pop());
  routes.forEach((path, i) => {
    const type = agentType(i);
    if (!agents[i] || agents[i].type !== type) { if (agents[i]) removeAgent(agents[i]); agents[i] = makeAgent(type); }
    const a = agents[i]; a.path = path; a.ch.root.visible = a.fan.visible = a.ring.visible = path.length > 0;
  });
}

export function resetAgents() {
  chaseFieldT = 0;
  for (const a of agents) {
    const p = a.path; if (!p.length) continue;
    const ang = p.length > 1 ? Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]) : 0;
    Object.assign(a, { x: p[0][0], y: p[0][1], wp: Math.min(1, p.length - 1), dir: 1, wait: 0, meter: 0, ang, lost: 0, base: ang, moving: false,
      state: 'patrol', timer: 0, lose: 0, hopT: 9, lastField: null, retField: null, aim: 0, shotCD: 0,
      burstLeft: 0, burstT: 0, hunchT: nextHunch(a) + 4, invField: null, predField: null, predT: 0, lastVX: 0, lastVY: 0, assistField: null, caller: false, callT: 0 });
    for (const l of a.lasers) l.visible = false;
  }
}

const clampX = x => Math.min(W - 4, Math.max(3, x)), clampY = y => Math.min(D - 4, Math.max(3, y));
const nextHunch = a => a.P.hunchMin + Math.random() * (a.P.hunchMax - a.P.hunchMin);
// punto adonde predice que irás en t segundos (agente rojo)
const predictFrom = (x, y, vx, vy, t) => [clampX(x + vx * t), clampY(y + vy * t)];

// corazonada: elige un punto según el estilo del agente; null si queda muy lejos o no hay camino
function hunchTarget(a, i, p) {
  const n = a.P.hunchNoise, r = () => (Math.random() * 2 - 1) * n;
  let tx, ty;
  if (i % 3 === 1) { tx = p.x + Math.cos(p.ang) * 16 + r() * .5; ty = p.y + Math.sin(p.ang) * 16 + r() * .5; } // se adelanta
  else if (i % 3 === 2) { tx = (p.x + a.x) / 2 + r() * 1.3; ty = (p.y + a.y) / 2 + r() * 1.3; }               // merodea entre los dos
  else { tx = p.x + r(); ty = p.y + r(); }                                                                     // más o menos donde estás
  tx = clampX(tx); ty = clampY(ty);
  if (Math.hypot(tx - a.x, ty - a.y) > a.P.hunchReach) return null;
  const field = flowFrom(tx, ty);
  return field[Math.floor(a.x) + Math.floor(a.y) * W] > 0 ? field : null;
}

function startAlert(a) { a.state = 'alert'; a.timer = a.P.alertFreeze; a.hopT = 0; a.meter = 1; G.alerts++; alertSound(); shake(.8); kick(.06); flash('255,42,42', .14); a.caller = true; a.callT = 3; callForHelp(a); }

// refuerzos: los agentes cercanos que no te están persiguiendo vienen a ayudar
function callForHelp(caller) {
  for (const b of agents) {
    if (b === caller || Math.hypot(b.x - caller.x, b.y - caller.y) > b.P.helpRadius) continue;
    summon(b, player.x, player.y);
  }
}
const available = b => b.path.length && ['patrol', 'investigate', 'return', 'search'].includes(b.state);
function summon(b, x, y) {
  if (!available(b)) return;
  b.hopT = 0; b.lastX = x; b.lastY = y; b.lastVX = player.vx; b.lastVY = player.vy; b.lastField = null; b.aim = 0;
  if (b.P.shoots) { b.state = 'chase'; b.lose = 0; b.meter = 1; chaseFieldT = 0; }                     // el rojo: directo a perseguirte
  else { b.state = 'assist'; b.assistField = flowFrom(x, y); b.meter = Math.max(b.meter, .6); }       // el normal: corre a donde te vieron
}
// cámaras de seguridad: llaman a todos los agentes disponibles (sin límite de distancia) hacia (x, y)
export function alertAgents(x, y) { for (const b of agents) summon(b, x, y); }
const hopY = a => clips.alert_hop && a.hopT < clips.alert_hop.duration ? (sampleClip(clips.alert_hop, a.hopT)['body.y'] || 0) : 0; // clip "alert_hop"

// semáforo: verde tranquilo · amarillo sospecha o búsqueda · rojo alerta o persecución · celeste congelado
export function stateColor(a) {
  if (G.frozen > 0) return SEMA.frozen;
  if (a.state === 'alert' || a.state === 'chase' || a.state === 'assist') return SEMA.red;
  if (a.state === 'search' || a.state === 'return' || a.state === 'investigate' || a.meter > .05) return SEMA.yellow;
  return SEMA.green;
}

// IA de todos los agentes. Devuelve el resumen para el HUD y si alguno atrapó al jugador.
export function updateAgentsAI(dt, player) {
  let top = 0, alertOn = false, cautionOn = false, caughtBy = null;
  const hidden = G.hiddenKind;
  if ((chaseFieldT -= dt) <= 0 && agents.some(a => a.state === 'chase')) { chaseField = flowFrom(player.x, player.y); chaseFieldT = .2; }
  agents.forEach((a, idx) => {
    if (!a.path.length) return; a.moving = false; a.hopT += dt;
    const P = a.P;
    if (G.frozen <= 0) {
      const dx = player.x - a.x, dy = player.y - a.y, dist = Math.hypot(dx, dy), toP = Math.atan2(dy, dx);
      let rel = toP - a.ang; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const los = !hidden && rayDist(a.x, a.y, toP, dist, P.seeOver || 12) >= dist - 1.5;   // línea de vista (el vigía ve por encima de más cosas)
      const seen = los && ((dist < P.range && Math.abs(rel) < P.half) || (a.state === 'chase' && dist < 12));
      const heard = !hidden && dist < P.actionR;                                               // radio de acción, aunque esté de espaldas
      a.shotCD = Math.max(0, a.shotCD - dt);
      if (a.burstLeft > 0 && (a.burstT -= dt) <= 0) { turnTo(a, toP, 1); shoot(a); a.burstLeft--; a.burstT = P.burstGap; } // ráfaga (vigía)
      if (a.state === 'alert') {                     // salto de sorpresa, mira al jugador
        a.timer -= dt; turnTo(a, toP, dt * 10);
        if (a.timer <= 0) { a.state = 'chase'; a.lose = 0; a.lastX = player.x; a.lastY = player.y; a.lastField = null; chaseFieldT = 0; }
      } else if (a.state === 'chase') {
        if (seen || heard) {
          a.lose = 0; a.lastX = player.x; a.lastY = player.y; a.lastVX = player.vx; a.lastVY = player.vy; a.lastField = null;
          if (P.shoots && los && dist < P.shootRange && dist > CATCH_DIST + 1) {   // el rojo se detiene, apunta con el láser y dispara
            if (a.aim > 0) { a.aim -= dt; turnTo(a, toP, dt * 12); if (a.aim <= 0) { shoot(a); a.burstLeft = (P.burst || 1) - 1; a.burstT = P.burstGap || 0; a.shotCD = P.shootCooldown; } }
            else if (a.shotCD <= 0) a.aim = P.aimTime;
          } else a.aim = 0;
          if (a.aim <= 0) {
            let moved = false;
            if (P.predict && dist > 8) {                // el rojo corta camino: va adonde vas a estar
              if ((a.predT -= dt) <= 0) { a.predField = flowFrom(...predictFrom(player.x, player.y, player.vx, player.vy, P.predict)); a.predT = .25; }
              moved = stepFlow(a, a.predField, P.chase, dt);
            }
            if (!moved && chaseField) stepFlow(a, chaseField, P.chase, dt);
          }
        } else {                                     // te perdió: corre a donde te vio por última vez
          a.aim = 0;
          a.lose += dt * (hidden ? 2 : 1);
          if (!a.lastField) {                         // el rojo busca donde predice que fuiste, no donde te vio
            if (P.predict) [a.lastX, a.lastY] = predictFrom(a.lastX, a.lastY, a.lastVX, a.lastVY, P.predict * 1.5);
            a.lastField = flowFrom(a.lastX, a.lastY);
          }
          if (!stepFlow(a, a.lastField, P.chase * .85, dt)) a.ang += dt * 2.5;
        }
        a.meter = 1;
        if (a.caller && (a.callT -= dt) <= 0) { a.callT = 3; callForHelp(a); }   // sigue pidiendo refuerzos
        if (dist < CATCH_DIST && !hidden) caughtBy = a;
        if (a.lose >= P.loseTime) { a.state = 'search'; a.timer = P.searchTime; a.meter = .5; a.aim = 0; a.caller = false; }
      } else {
        a.aim = 0;
        if (seen) { a.meter += dt * (1.1 + (1 - dist / P.range) * 2.6) * (a.state === 'patrol' ? 1 : 2) * P.detect; a.lost = 1.6; }
        else if (heard) { a.meter += dt * 1.4 * (a.state === 'patrol' ? 1 : 2) * P.detect; a.lost = 1.6; }
        else a.meter = Math.max(a.state === 'search' ? .3 : 0, a.meter - dt * .5);
        if (dist < 4 && !hidden) a.meter = 1;
        if (a.meter >= 1) startAlert(a);
        else if (a.state === 'patrol' && (a.hunchT -= dt) <= 0) {   // corazonada: deja la ruta y va a revisar
          a.hunchT = nextHunch(a);
          const f = hunchTarget(a, idx, player);
          if (f) { a.state = 'investigate'; a.invField = f; a.timer = 2.2; }
        }
        else if (a.state === 'assist') {             // refuerzo: corre a donde te vieron; al llegar te busca
          if (!stepFlow(a, a.assistField, P.chase * .9, dt)) { a.state = 'search'; a.timer = P.searchTime; a.lastField = null; }
        }
        else if (a.state === 'investigate') {        // camina al punto, mira alrededor y vuelve a su ruta
          if (!stepFlow(a, a.invField, P.patrol * 1.15, dt)) { a.ang += dt * 2; a.timer -= dt; }
          if (a.timer <= 0) { a.state = 'return'; a.retField = flowFrom(...a.path[a.wp]); }
        }
        else if (a.state === 'search') {             // revisa el último lugar donde te vio
          a.lastField ||= flowFrom(a.lastX, a.lastY);
          if (!stepFlow(a, a.lastField, P.search, dt)) { a.ang += dt * 2.2; a.timer -= dt; }
          if (a.timer <= 0) { a.state = 'return'; a.retField = flowFrom(...a.path[a.wp]); }
        } else if (a.state === 'return') {           // vuelve a su ruta
          const [tx, ty] = a.path[a.wp];
          if (Math.hypot(tx - a.x, ty - a.y) < 1.5 || !stepFlow(a, a.retField, P.patrol, dt)) { a.state = 'patrol'; a.meter = 0; a.wait = .6; a.base = a.ang; }
        } else if (a.lost > 0) { a.lost -= dt; if (seen || heard) turnTo(a, toP, dt * 3); }   // algo vio u oyó: se detiene y mira
        else if (a.path.length < 2) a.ang += dt * .9;                                          // guardia fijo: gira en su lugar
        else if (a.wait > 0) { a.wait -= dt; a.ang = a.base + Math.sin((1.2 - a.wait) * 2.6) * .8; } // en cada punto mira a los lados
        else {                                                                                 // patrulla de ida y vuelta
          const [tx, ty] = a.path[a.wp], ddx = tx - a.x, ddy = ty - a.y, l = Math.hypot(ddx, ddy), sp = P.patrol * dt;
          if (l < sp) { a.x = tx; a.y = ty; a.wait = 1.2; a.base = a.ang; if (a.wp + a.dir >= a.path.length || a.wp + a.dir < 0) a.dir *= -1; a.wp += a.dir; }
          else { a.x += ddx / l * sp; a.y += ddy / l * sp; a.moving = true; turnTo(a, Math.atan2(ddy, ddx), dt * 6); }
        }
      }
    }
    if (a.state === 'alert' || a.state === 'chase' || a.state === 'assist') alertOn = true; else if (a.state === 'search' || a.state === 'return') cautionOn = true;
    // pasos del agente: más fuertes cuanto más cerca, a la izquierda o derecha según dónde esté en pantalla
    if (a.moving && STEP_VOLUME && !P.drone) {   // el vigía flota: no hace pasos
      const d = Math.hypot(a.x - player.x, a.y - player.y);
      if ((a.stepT = (a.stepT || 0) - dt) <= 0 && d < AGENT_STEP_RANGE) {
        a.stepT = a.state === 'chase' ? .2 : .32;
        const k = 1 - d / AGENT_STEP_RANGE;
        footstep(.09 * k * k * STEP_VOLUME, ((a.x - player.x) + (a.y - player.y)) / 40, .75);   // más graves que los del jugador
      }
    }
    top = Math.max(top, a.meter);
  });
  return { top, alertOn, cautionOn, caughtBy };
}

// pose, saltito de alerta, brazo apuntando, láser, cono y anillo con el color del semáforo (visual, cada frame)
export function animateAgents() {
  for (const a of agents) {
    if (!a.path.length) continue;
    const P = a.P;
    if (a.ch.drone) {                                                    // vigía: flota, se mece y se inclina al avanzar
      const t = G.frozen > 0 ? 0 : G.t, i = agents.indexOf(a);
      a.ch.root.position.set(a.x, Z + P.hover + Math.sin(t * 2.6 + i) * .9 + hopY(a), -a.y); a.ch.root.rotation.y = a.ang;
      a.ch.model.rotation.z += ((a.moving ? -.18 : 0) - a.ch.model.rotation.z) * .1; a.ch.model.rotation.x = Math.sin(t * 1.7 + i) * .06;
    } else {
      pose(a.ch, a.x, a.y, a.ang, G.frozen > 0 ? 0 : G.t * ANIM_SPEED * (a.state === 'chase' || a.state === 'assist' ? 1.6 : 1), a.moving && G.frozen <= 0, false);
      a.ch.root.position.y += hopY(a);                                   // saltito al alarmarse o al recibir el llamado
      if (a.state === 'chase' && P.shoots) overlayClip(a.ch, 'aim', G.t);          // apunta con el arma mientras persigue (clip "aim")
    }
    a.lasers.forEach((l, k) => {                                         // mira láser antes de disparar (el vigía: una por cañón)
      l.visible = a.aim > 0 && G.mode === 'play';
      if (!l.visible) return;
      const o = a.ch.drone ? tipPos(a, k) : { x: a.x + Math.cos(a.ang) * 3, y: a.y + Math.sin(a.ang) * 3 }, len = Math.hypot(player.x - o.x, player.y - o.y);
      l.position.set(o.x, a.ch.drone ? a.ch.root.position.y + a.ch.tips[k][2] : Z + 9.5, -o.y); l.rotation.y = Math.atan2(player.y - o.y, player.x - o.x); l.scale.x = len;
      l.material.opacity = .5 + .5 * Math.sin(G.t * 40);                           // parpadea: "¡va a disparar!"
    });
    const arr = a.fan.geometry.attributes.position.array, pts = [];
    for (let i = 0; i <= NR; i++) { const an = a.ang - P.half + 2 * P.half * i / NR, d = rayDist(a.x, a.y, an, P.range, P.seeOver || 12); pts.push([a.x + Math.cos(an) * d, a.y + Math.sin(an) * d]); }
    let k = 0; const put = (x, y) => { arr[k++] = x; arr[k++] = Z + .25; arr[k++] = -y; };
    for (let i = 0; i < NR; i++) { put(a.x, a.y); put(...pts[i]); put(...pts[i + 1]); }
    a.fan.geometry.attributes.position.needsUpdate = true;
    const c = stateColor(a);
    a.fan.material.color.setHex(c); a.fan.material.opacity = G.frozen > 0 ? .22 : .32 + a.meter * .25;
    a.ring.position.set(a.x, Z + .35, -a.y); a.ring.material.color.setHex(c); a.ring.material.opacity = G.frozen > 0 ? .25 : .55;
  }
}
