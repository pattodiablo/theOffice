import * as THREE from 'three';
import { Z, W, D } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { BEE } from '../Settings.js';
import { rot } from '../Data/PropLibrary.js';
import { listGeo } from '../Core/VoxelMesh.js';
import { M } from '../Materials/Materials.js';
import { hAt, rayDist } from '../World/Grid.js';
import { beeBuzzSound, beeDashSound, beeBonkSound } from '../Core/Audio.js';
import { shake, kick, popText } from '../FX/Juice.js';
import { puff } from '../FX/Particles.js';

// Abeja robot (prop "bee", modelo assets/vox/props/bee.vox con partes "abeja", "alaL" y "alaR"; mira hacia +x).
// Revolotea alrededor del lugar donde la pusiste. Si te ve dentro de BEE.range:
//   aviso → zumba, se echa un poco para atrás y marca en el piso una línea roja por donde va a pasar
//   embestida → sale disparada en línea recta; si te toca, te atrapa
//   mareada → después de embestir (o de chocar contra una pared) queda tambaleando unos segundos
//   vuelve → regresa a su lugar y se calma un momento antes de poder embestir otra vez
// No bloquea el paso. El glitch la congela. Escondido no te ve, y si te escondes a tiempo, pasa de largo.
let group, lineMat, shadowMat, bees = [];
const HIT_WALL = 10;                     // altura de pared/mueble que la frena (vuela a BEE.flyH)

export function initBees(scene) {
  group = new THREE.Group(); scene.add(group);
  lineMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: .5, depthWrite: false });
  shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .25, depthWrite: false });
}

// mesh de una parte, centrada en (cx, cy, cz) del modelo
function partMesh(vox, cx, cy, cz) {
  const m = new THREE.Mesh(listGeo(vox).translate(-cx, -cy, -cz), M.voxel); m.castShadow = true; return m;
}

export function syncBees() {
  group.clear(); bees = [];
  for (const p of G.level.props) {
    if (!p.t.startsWith('bee')) continue;
    const R = rot(p.t, 0), body = R.part('abeja'); if (!body.length) continue;
    const xs = body.map(v => v[0]), ys = body.map(v => v[1]), zs = body.map(v => v[2]);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2, cz = (Math.min(...zs) + Math.max(...zs) + 1) / 2;
    const root = new THREE.Group(), inner = new THREE.Group(); inner.rotation.x = -Math.PI / 2; root.add(inner);   // vóxeles (x, y, z) → Three (x, z, -y)
    inner.add(partMesh(body, cx, cy, cz));
    const wings = ['alaL', 'alaR'].map((n, i) => {                     // bisagra de cada ala: su borde de abajo
      const v = R.part(n); if (!v.length) return null;
      const hz = Math.min(...v.map(q => q[2])), hy = v[0][1] + .5;
      const piv = new THREE.Group(); piv.position.set(0, hy - cy, hz - cz); piv.add(partMesh(v, cx, hy, hz)); inner.add(piv);
      piv.userData.side = i ? 1 : -1; return piv;
    }).filter(Boolean);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.2).translate(.5, 0, 0).rotateX(-Math.PI / 2), lineMat); line.renderOrder = 2;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(4.5, 20).rotateX(-Math.PI / 2), shadowMat); shadow.renderOrder = 2;
    group.add(root, line, shadow);
    const hx = p.x + R.w / 2, hy = p.y + R.d / 2;
    bees.push({ hx, hy, root, wings, line, shadow, ang: p.r * Math.PI / 2 });
  }
  resetBees();
}
export function resetBees() {
  for (const b of bees) Object.assign(b, { x: b.hx, y: b.hy, h: BEE.flyH, state: 'idle', t: 0, cool: 1, wx: b.hx, wy: b.hy, dx: 0, dy: 0, dist: 0, len: 0 });
}

// hasta dónde puede embestir en línea recta antes de chocar con algo alto
function dashLen(b, a) {
  const cx = Math.cos(a), cy = Math.sin(a);
  for (let d = 1; d < BEE.dashDist; d += .5) {
    const x = b.x + cx * d, y = b.y + cy * d;
    if (x < 1 || y < 1 || x >= W - 1 || y >= D - 1 || hAt(x, y) > HIT_WALL) return d - 1;
  }
  return BEE.dashDist;
}
const turn = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;

// lógica (jugando): devuelve true si una abeja te picó
export function updateBees(dt, p) {
  let hit = false;
  for (const b of bees) {
    if (G.frozen > 0) continue;                                        // el glitch la congela
    b.t += dt; b.cool -= dt;
    const dxp = p.x - b.x, dyp = p.y - b.y, dp = Math.hypot(dxp, dyp), toP = Math.atan2(dyp, dxp);
    if (b.state === 'idle' || b.state === 'back') {
      const sees = !G.hiddenKind && b.cool <= 0 && dp < BEE.range && rayDist(b.x, b.y, toP, dp, HIT_WALL) >= dp - 1;
      if (sees && b.state === 'idle') {                                // ¡te vio!
        b.state = 'windup'; b.t = 0; b.ang = toP; b.len = dashLen(b, toP); beeBuzzSound(); popText(b.x, b.y, 'BZZ!', 'red');
      } else {                                                         // revolotea o vuelve a su lugar
        const home = b.state === 'back', tx = home ? b.hx : b.wx, ty = home ? b.hy : b.wy, d = Math.hypot(tx - b.x, ty - b.y);
        if (d < 1) {
          if (home) { b.state = 'idle'; b.cool = BEE.cooldown; }
          const a = Math.random() * Math.PI * 2, r = Math.random() * BEE.wander; b.wx = b.hx + Math.cos(a) * r; b.wy = b.hy + Math.sin(a) * r;
        } else {
          const s = Math.min(d, dt * BEE.speed * (home ? 1 : .45)); b.x += (tx - b.x) / d * s; b.y += (ty - b.y) / d * s;
          b.ang = turn(b.ang, Math.atan2(ty - b.y, tx - b.x), Math.min(1, dt * 5));
        }
      }
    } else if (b.state === 'windup') {                                 // apunta y se echa para atrás
      b.ang = toP; if (!G.hiddenKind) b.len = dashLen(b, toP);
      b.x -= Math.cos(b.ang) * dt * 3; b.y -= Math.sin(b.ang) * dt * 3;
      if (b.t >= BEE.windup) { b.state = 'dash'; b.t = 0; b.dx = Math.cos(b.ang); b.dy = Math.sin(b.ang); b.dist = 0; b.len = dashLen(b, b.ang); beeDashSound(); }
    } else if (b.state === 'dash') {                                   // ¡embestida!
      const s = Math.min(dt * BEE.dashSpeed, b.len - b.dist), ox = b.x, oy = b.y; b.x += b.dx * s; b.y += b.dy * s; b.dist += s;
      // ¿te tocó en este tramo? (se mira todo el tramo recorrido, no solo el punto final: a poca velocidad de cuadros no se salta al jugador)
      const k = Math.max(0, Math.min(1, ((p.x - ox) * b.dx + (p.y - oy) * b.dy) / (s || 1)));
      if (!G.hiddenKind && Math.hypot(p.x - (ox + b.dx * s * k), p.y - (oy + b.dy * s * k)) < BEE.hitR) { hit = true; b.len = b.dist; }
      if (b.dist >= b.len - .01) {
        const wall = b.len < BEE.dashDist - .5;
        if (wall) { beeBonkSound(); puff(b.x + b.dx * 2, b.y + b.dy * 2); if (dp < 40) shake(.35); popText(b.x, b.y, 'BONK!', 'cyan'); }
        b.state = 'dazed'; b.t = 0; b.dazedLong = wall;
      }
    } else if (b.state === 'dazed') {
      if (b.t >= BEE.dazedTime * (b.dazedLong ? 1.4 : 1)) { b.state = 'back'; b.t = 0; }
    }
  }
  return hit;
}

// visual (cada frame)
export function animateBees(dt) {
  const play = G.mode === 'play' || G.mode === 'over' || G.mode === 'caught';
  for (const b of bees) {
    if (!play && G.mode !== 'menu') { b.x = b.hx; b.y = b.hy; b.state = 'idle'; }
    const st = b.state, dash = st === 'dash', dazed = st === 'dazed', wind = st === 'windup';
    const bob = Math.sin(G.t * 3 + b.hx) * .8, h = BEE.flyH + (dazed ? -2.5 + Math.sin(G.t * 9) * .6 : bob);
    const shakeX = wind ? (Math.random() - .5) * .6 : 0;
    b.root.position.set(b.x + shakeX, Z + h, -b.y); b.root.scale.setScalar(BEE.scale);
    b.root.rotation.set(0, b.ang, 0);
    b.root.rotateZ(dash ? -.35 : wind ? .2 : 0);                       // se inclina hacia adelante al embestir · hacia atrás al apuntar
    if (dazed) b.root.rotateX(Math.sin(G.t * 7) * .35);                // mareada: se bambolea
    const flap = Math.sin(G.t * (dash || wind ? 90 : 55)) * (dazed ? .25 : .55);
    for (const w of b.wings) w.rotation.x = w.userData.side * (.25 + flap);
    b.shadow.position.set(b.x, Z + .25, -b.y); b.shadow.scale.setScalar(1 - (h - BEE.flyH) * .03);
    // línea roja del aviso: por dónde va a pasar
    b.line.visible = play && (wind || dash);
    if (b.line.visible) {
      b.line.position.set(b.x, Z + .3, -b.y); b.line.rotation.y = b.ang; b.line.scale.x = Math.max(.1, dash ? b.len - b.dist : b.len);
      lineMat.opacity = dash ? .35 : .3 + .3 * Math.abs(Math.sin(G.t * 16));
    }
  }
}
