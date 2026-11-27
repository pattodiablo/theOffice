import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { cam, stage } from '../Core/Engine.js';
import { G } from '../Core/Game.js';
import { SAFE } from '../Settings.js';
import { PROPS, rot } from '../Data/PropLibrary.js';
import { listGeo } from '../Core/VoxelMesh.js';
import { M } from '../Materials/Materials.js';
import { ease } from '../Core/MathUtils.js';
import { dialClick, safeOpenSound } from '../Core/Audio.js';
import { shake, kick, hitstop, slowmo, flash, popText } from '../FX/Juice.js';
import { puff } from '../FX/Particles.js';
import { glowTex, starTex, beamTex } from '../FX/GlowTex.js';

// Caja fuerte (prop "safe", modelo assets/vox/props/safe.vox con dos partes: "base" y "puerta").
// Si el nivel tiene una caja fuerte, el fragmento de realidad está ADENTRO de la primera (el cristal suelto se ignora).
// Para abrirla hay que quedarse pegado a ella, dentro del círculo, SAFE.crackTime segundos (suena el dial).
// Si te alejas o te escondes se pierde el avance. Al abrirse, la puerta gira sobre sus bisagras y el cristal sale
// volando y cae delante de la puerta, listo para recogerlo.
// Círculo: azul cerrada · amarillo abriéndola · verde abierta.
const COL = { ready: 0x4db8ff, crack: 0xffcc00, open: 0x22ff77 };
const HINGE = [11, .5], FREE = [2, .5], INSIDE = [6.5, 3], FRONT = [6.5, 0];   // en el modelo sin rotar (frente hacia y = 0)
let group, ringGeo, safes = [], TEX;
// brillo de la caja que guarda el cristal: aura celeste que late, haz de luz, destellos y luz en el piso (se apaga al abrirla)
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
const v = new THREE.Vector3();

export function initSafes(scene) {
  group = new THREE.Group(); scene.add(group); ringGeo = new THREE.RingGeometry(SAFE.reach - .8, SAFE.reach, 40).rotateX(-Math.PI / 2);
  TEX = { glow: glowTex([[0, 'rgba(200,245,255,.9)'], [.35, 'rgba(60,180,255,.4)'], [1, 'rgba(40,150,255,0)']]), star: starTex(), beam: beamTex(),
          pad: glowTex([[0, 'rgba(140,225,255,.85)'], [.6, 'rgba(70,190,255,.3)'], [1, 'rgba(60,180,255,0)']]) };
}

// aura de la caja con cristal (centro cx, cy; tamaño w × d × h)
function makeAura(cx, cy, w, d, h) {
  const g = new THREE.Group(); g.position.set(cx, Z, -cy);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, h + 1.2, d + 1.6).translate(0, h / 2, 0), new THREE.MeshBasicMaterial({ color: 0x3fc8ff, side: THREE.BackSide, ...ADD }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + .8, h + .6, d + .8).translate(0, h / 2, 0)), new THREE.LineBasicMaterial({ color: 0xbff4ff, ...ADD }));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, ...ADD })); halo.position.y = h * .55;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 4, 50, 16, 1, true).translate(0, 25 + h, 0), new THREE.MeshBasicMaterial({ map: TEX.beam, side: THREE.DoubleSide, ...ADD }));
  const pad = new THREE.Mesh(new THREE.CircleGeometry(Math.max(w, d) * 1.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: TEX.pad, ...ADD })); pad.position.y = .28;
  const light = new THREE.PointLight(0x7fdcff, 500, 50, 2); light.position.y = h + 3;
  const sparks = [];
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.star, color: 0xe8fdff, ...ADD }));
    sp.userData = { a: i / 8 * Math.PI * 2, r: Math.max(w, d) * .62 + (i % 2) * 1.5, y: 2 + (i % 4) * (h / 4), sp: .6 + (i % 3) * .25, ph: i * 1.3 };
    sparks.push(sp); g.add(sp);
  }
  for (const m of [shell, edges, beam, pad]) m.renderOrder = 2;
  g.add(shell, edges, halo, beam, pad, light);
  return { g, shell, edges, halo, beam, pad, light, sparks, size: Math.max(w, d, h), fade: 1 };
}

function animateAura(a, on, dim, dt) {
  a.fade += ((on ? 1 : 0) - a.fade) * Math.min(1, dt * (on ? 6 : 3));
  a.g.visible = a.fade > .01; if (!a.g.visible) return;
  const k = a.fade * (dim ? .35 : 1), pulse = .5 + .5 * Math.sin(G.t * 3), glint = Math.max(0, Math.sin(G.t * 1.9)) ** 14;
  a.shell.material.opacity = (.18 + .22 * pulse + .35 * glint) * k;
  a.edges.material.opacity = (.45 + .4 * pulse + .4 * glint) * k;
  a.halo.material.opacity = (.55 + .25 * pulse + .4 * glint) * k; a.halo.scale.setScalar(a.size * (2.4 + .3 * pulse + .8 * glint));
  a.beam.material.opacity = (.5 + .2 * Math.sin(G.t * 2)) * k; a.beam.rotation.y = G.t * .5;
  a.pad.material.opacity = (.55 + .3 * pulse) * k; a.pad.scale.setScalar(1 + .08 * pulse);
  a.light.intensity = (380 + 220 * pulse + 600 * glint) * k;
  for (const sp of a.sparks) {
    const u = sp.userData, ang = u.a + G.t * u.sp, tw = Math.max(0, Math.sin(G.t * 2.6 + u.ph));
    sp.position.set(Math.cos(ang) * u.r, u.y + Math.sin(G.t * 1.4 + u.ph) * 1.2, Math.sin(ang) * u.r);
    sp.scale.setScalar(.8 + 2.4 * tw * tw); sp.material.opacity = tw * k;
  }
}

// un punto del modelo (coordenadas continuas) en el prop rotado r × 90° (igual que rot() rota los vóxeles)
function tp(P, r, [x, y]) { const { w, d } = P; return r === 1 ? [d - y, x] : r === 2 ? [w - x, d - y] : r === 3 ? [y, w - x] : [x, y]; }

export function syncSafes() {
  for (const s of safes) { s.bar.remove(); s.mesh.geometry.dispose(); }
  group.clear(); safes = []; G.safeCrystal = null;
  for (const p of G.level.props) {
    if (!p.t.startsWith('safe')) continue;
    const P = PROPS[p.t], R = rot(p.t, p.r), part = R.part('puerta');
    if (!part.length) continue;                                         // el modelo no tiene parte "puerta"
    const [hx, hy] = tp(P, p.r, HINGE), [ex, ey] = tp(P, p.r, FREE), [fx, fy] = tp(P, p.r, FRONT), [ix, iy] = tp(P, p.r, INSIDE);
    const n = [fx - tp(P, p.r, [6.5, 1])[0], fy - tp(P, p.r, [6.5, 1])[1]];   // hacia afuera del frente
    const sign = Math.sign(-(ey - hy) * n[0] + (ex - hx) * n[1]) || 1;   // sentido de giro para que la puerta abra hacia afuera
    const geo = listGeo(part).translate(-hx, -hy, 0);
    const mesh = new THREE.Mesh(geo, M.voxel.clone()); mesh.rotation.x = -Math.PI / 2; mesh.castShadow = true;
    const pivot = new THREE.Group(); pivot.position.set(p.x + hx, Z, -(p.y + hy)); pivot.add(mesh);
    const cx = p.x + R.w / 2, cy = p.y + R.d / 2;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COL.ready, transparent: true, opacity: .5, depthWrite: false }));
    ring.position.set(cx, Z + .32, -cy); ring.renderOrder = 2;
    const bar = document.createElement('div'); bar.className = 'hidebar'; bar.innerHTML = '<i></i>'; document.body.append(bar);
    group.add(pivot, ring);
    const s = { cx, cy, h: R.h, pivot, mesh, ring, bar, sign, prog: 0, open: false, ang: 0, clickT: 0 };
    if (!G.safeCrystal) {                                               // la primera caja guarda el cristal
      s.hasCrystal = true; s.aura = makeAura(cx, cy, R.w, R.d, R.h); group.add(s.aura.g);
      G.safeCrystal = { inX: p.x + ix, inY: p.y + iy, outX: p.x + fx + n[0] * SAFE.popDist, outY: p.y + fy + n[1] * SAFE.popDist, open: false, t: 0 };
    }
    safes.push(s);
  }
}

export function resetSafes() {
  for (const s of safes) Object.assign(s, { prog: 0, open: false, ang: 0 });
  if (G.safeCrystal) Object.assign(G.safeCrystal, { open: false, t: 0 });
}

// lógica (jugando): quedarse pegado abre la caja
export function updateSafes(dt, p) {
  for (const s of safes) {
    if (s.open) continue;
    const near = !G.hiddenKind && G.frozen <= 0 && Math.hypot(p.x - s.cx, p.y - s.cy) < SAFE.reach;
    if (near) {
      s.prog += dt / SAFE.crackTime;
      if ((s.clickT -= dt) <= 0) { s.clickT = .09 + Math.random() * .08; dialClick(s.prog); }
      if (s.prog >= 1) {                                                 // ¡abierta!
        s.open = true; s.prog = 1; safeOpenSound(); puff(s.cx, s.cy);
        shake(.7); kick(.08); popText(s.cx, s.cy, 'UNLOCKED!', 'cyan');
        if (s.hasCrystal) G.safeCrystal.open = true;
      }
    } else s.prog = Math.max(0, s.prog - dt * 1.5);                       // te alejaste: se pierde el avance
  }
}

// puerta, círculo, barra y vuelo del cristal (visual, cada frame)
export function animateSafes(dt) {
  const play = G.mode === 'play' || G.mode === 'over' || G.mode === 'caught' || G.mode === 'exit';
  for (const s of safes) {
    if (!play && G.mode !== 'menu') { s.open = false; s.prog = 0; }
    s.ang += ((s.open ? SAFE.openAngle : 0) - s.ang) * Math.min(1, dt * (s.open ? 4 : 10));
    s.pivot.rotation.y = s.sign * s.ang;
    s.pivot.visible = !(G.asm >= 0);                                     // mientras se ensambla el nivel, todavía no
    if (s.aura) animateAura(s.aura, !s.open && !(G.asm >= 0), G.hadCrystal && G.mode !== 'edit', dt);
    const st = s.open ? 'open' : s.prog > 0 ? 'crack' : 'ready';
    s.ring.material.color.setHex(COL[st]);
    s.ring.material.opacity = st === 'open' ? .18 : .35 + .15 * Math.sin(G.t * 4);
    const show = play && st === 'crack';
    s.bar.style.display = show ? 'block' : 'none';
    if (show) {
      v.set(s.cx, Z + s.h + 4, -s.cy).project(cam);
      s.bar.style.left = ((v.x + 1) / 2 * stage.clientWidth) + 'px'; s.bar.style.top = ((1 - v.y) / 2 * stage.clientHeight) + 'px';
      s.bar.className = 'hidebar use'; s.bar.firstChild.style.width = (s.prog * 100) + '%';
    }
  }
  const c = G.safeCrystal;
  if (c && c.open) c.t = Math.min(SAFE.popTime, c.t + dt);
}

// para las flechas guía: la caja que guarda el cristal mientras siga cerrada
export const guideSafe = () => { const s = safes.find(s => s.hasCrystal); return s && !s.open ? { x: s.cx, y: s.cy, h: s.h } : null; };
// dónde está el cristal de la caja: null si sigue cerrada; { x, y, hop, ready } mientras sale volando y cuando ya cayó
export function safeCrystalPos() {
  const c = G.safeCrystal; if (!c || !c.open) return null;
  const k = c.t / SAFE.popTime, e = ease(k);
  return { x: c.inX + (c.outX - c.inX) * e, y: c.inY + (c.outY - c.inY) * e, hop: Math.sin(k * Math.PI) * 6 - (1 - k) * 2, ready: k >= 1 };
}
