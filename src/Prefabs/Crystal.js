import { pokiMeasure } from '../Core/Poki.js';
import { levelNumber } from '../Data/LevelIO.js';
import * as THREE from 'three';
import { Z, EDITOR } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { CRYSTAL } from '../Settings.js';
import { hasCrystal } from '../Data/Progress.js';
import { crystalSound } from '../Core/Audio.js';
import { puff } from '../FX/Particles.js';
import { player } from './Player.js';
import { safeCrystalPos } from './Safe.js';
import { bossCrystalPos } from './MainFrame.js';
import { shake, kick, hitstop, flash, haptic } from '../FX/Juice.js';
import { glowTex, starTex, beamTex } from '../FX/GlowTex.js';

// Cristal: un "fragmento de realidad" por nivel (level.crystal = { x, y }, se pone en el editor › Nivel › Cristal).
// Flota y gira; al tocarlo se recoge. Cuenta para el progreso cuando terminas el piso con él.
// Si ya lo tenías de antes, se ve transparente (puedes volver a tomarlo, pero no suma otro).
// Es celeste a propósito: el color del mundo real, frente al verde de la Matrix.
// Si el nivel tiene una caja fuerte, el cristal está adentro: aparece cuando la abres (ver Safe.js).
let group, gem, core, edges, shell, glow, sparks = [], beam, light, ring, ring2, pad, toast, toastT;
// Al recogerlo: vuela a la cabeza del jugador, flota ahí unos segundos y baja encogiéndose hasta meterse en él.
const PICK = { fly: .35, hover: 1.6, sink: .55, headY: 22.5, bodyY: 9 };   // segundos de cada fase · alturas sobre el piso
let pickT0 = -1, from = null, absorbed = false;

export function initCrystal(scene) {
  group = new THREE.Group(); scene.add(group);
  gem = new THREE.Group(); group.add(gem);
  const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
  // núcleo facetado: caras de arriba casi blancas, las de abajo celeste intenso (se lee como gema)
  const geo = new THREE.OctahedronGeometry(2.4).scale(1, 1.75, 1).toNonIndexed(), pos = geo.attributes.position, col = [];
  for (let i = 0; i < pos.count; i += 3) {
    const up = pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2) > 0, side = (i / 3) % 2;
    const c = new THREE.Color(up ? (side ? 0xffffff : 0x8feaff) : (side ? 0x23a8ff : 0x0a5fd6));
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true }));
  edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true }));
  shell = new THREE.Mesh(new THREE.OctahedronGeometry(2.4).scale(1.45, 1.35 * 1.75, 1.45), new THREE.MeshBasicMaterial({ color: 0x3fc8ff, opacity: .35, ...add }));
  glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex([[0, 'rgba(200,245,255,.9)'], [.3, 'rgba(60,180,255,.45)'], [1, 'rgba(40,150,255,0)']]), ...add }));
  glow.scale.set(13, 13, 1);
  const star = starTex();
  for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, color: 0xe8fdff, ...add })); s.userData = { a: i / 7 * Math.PI * 2, r: 3.8 + (i % 3) * .9, h: (i % 4 - 1.5) * 1.7, sp: .8 + (i % 3) * .35, ph: i * 1.7 }; sparks.push(s); gem.add(s); }
  gem.add(glow, shell, core, edges);
  beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 46, 16, 1, true).translate(0, 23, 0), new THREE.MeshBasicMaterial({ map: beamTex(), side: THREE.DoubleSide, ...add }));
  light = new THREE.PointLight(0x8fe6ff, 420, 42, 2);
  ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fe6ff, opacity: .8, ...add }));
  ring2 = new THREE.Mesh(new THREE.RingGeometry(2.6, 3, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbff4ff, opacity: .6, ...add }));
  pad = new THREE.Mesh(new THREE.CircleGeometry(6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex([[0, 'rgba(160,235,255,.8)'], [1, 'rgba(80,200,255,0)']]), ...add }));
  for (const m of [ring, ring2, pad, beam]) m.renderOrder = 2;
  group.add(beam, light, ring, ring2, pad);
  toast = document.createElement('div'); toast.id = 'fragToast'; document.body.append(toast);   // aviso al recogerlo
}
function showToast(text) {
  toast.innerHTML = `<i>◆</i> ${text}`; toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2300);
}

// dónde está el cristal ahora: { x, y, hop (altura extra), ready (se puede recoger) } o null si no hay / sigue en la caja
function where() {
  if (G.bossCrystal) return bossCrystalPos();                          // nivel con jefe: lo suelta al ser derrotado
  if (G.safeCrystal) return safeCrystalPos();
  const c = G.level.crystal; return c ? { x: c.x, y: c.y, hop: 0, ready: true } : null;
}

export function syncCrystal() { group.visible = !!where(); resetCrystal(); }
export function resetCrystal() { G.gotCrystal = false; G.hadCrystal = !EDITOR && hasCrystal(G.levelName); pickT0 = -1; absorbed = false; }

// lógica (jugando): recogerlo al tocarlo
export function updateCrystal(dt, p) {
  const c = where(); if (!c || !c.ready || G.gotCrystal) return;
  if (Math.hypot(p.x - c.x, p.y - c.y) < CRYSTAL.pickR) {
    G.gotCrystal = true; crystalSound(); puff(c.x, c.y); pokiMeasure('crystal', levelNumber(G.levelName), 'collected');   // Poki
    hitstop(.09); kick(.12); shake(.4); flash('120,220,255', .4); haptic([20, 40, 20]);
    pickT0 = G.t; absorbed = false; from = { x: c.x, y: c.y, z: Z + 8 + c.hop + Math.sin(G.t * 2.4) * .9 };
    showToast(G.hadCrystal ? 'REALITY FRAGMENT <small>(already yours)</small>' : 'REALITY FRAGMENT ACQUIRED');
  }
}

// visual
const easeOut = t => 1 - (1 - t) ** 3, easeIn = t => t * t * t;
// brillo general: 1 normal · menos si ya lo tenías (se ve "fantasma") · k encoge todo al absorberse
function placeCrystal(x, y, z, k, spin, bright) {
  gem.position.set(x, z, -y); gem.scale.setScalar(k);
  core.rotation.y = edges.rotation.y = spin; shell.rotation.y = -spin * .6;
  const glint = Math.max(0, Math.sin(G.t * 2.2)) ** 12;               // destello fuerte cada ~3 s
  core.material.opacity = .45 + .55 * bright; edges.material.opacity = (.5 + .5 * glint) * bright;
  shell.material.opacity = (.25 + .15 * Math.sin(G.t * 5) + .3 * glint) * bright;
  glow.material.opacity = (.45 + .15 * Math.sin(G.t * 3.1) + .45 * glint) * bright; glow.scale.setScalar(11 + 1.5 * Math.sin(G.t * 3.1) + 6 * glint);
  for (const s of sparks) {
    const u = s.userData, a = u.a + G.t * u.sp, tw = Math.max(0, Math.sin(G.t * 3 + u.ph));
    s.position.set(Math.cos(a) * u.r, u.h + Math.sin(G.t * 1.3 + u.ph) * .6, Math.sin(a) * u.r);
    s.scale.setScalar(.6 + 1.8 * tw * tw); s.material.opacity = tw * bright;
  }
  light.position.set(x, z, -y); light.intensity = (300 + 120 * Math.sin(G.t * 3.1) + 400 * glint) * bright * k;
}

export function animateCrystal() {
  const c = where();
  if (c && pickT0 >= 0 && G.mode !== 'edit') return animatePickup();
  group.visible = !!c && !(G.gotCrystal && G.mode !== 'edit');
  if (!group.visible) return;
  const y = Z + 8 + c.hop + Math.sin(G.t * 2.4) * .9, faded = G.hadCrystal && G.mode !== 'edit', b = faded ? .3 : 1;
  placeCrystal(c.x, c.y, y, 1, G.t * 1.6, b);
  for (const m of [beam, ring, ring2, pad]) m.visible = c.ready;   // saliendo de la caja: solo la gema
  beam.position.set(c.x, Z, -c.y); beam.material.opacity = (.55 + .2 * Math.sin(G.t * 2)) * (faded ? .25 : 1); beam.rotation.y = G.t * .5;
  ring.position.set(c.x, Z + .3, -c.y); ring.scale.setScalar(1 + .1 * Math.sin(G.t * 3)); ring.material.opacity = .8 * b;
  const w = (G.t * .7) % 1;                                              // onda que se expande desde el pie
  ring2.position.set(c.x, Z + .32, -c.y); ring2.scale.setScalar(1 + w * 2.2); ring2.material.opacity = (1 - w) * .7 * b;
  pad.position.set(c.x, Z + .25, -c.y); pad.material.opacity = (.7 + .2 * Math.sin(G.t * 3.1)) * b;
}

// recogido: cabeza del jugador → flota → baja encogiéndose y se mete en él
function animatePickup() {
  const t = G.t - pickT0, { fly, hover, sink, headY, bodyY } = PICK, end = fly + hover + sink;
  if (t >= end) { group.visible = false; if (!absorbed) { absorbed = true; puff(player.x, player.y); } return; }
  group.visible = true; for (const m of [beam, ring, ring2, pad]) m.visible = false;
  const head = Z + headY + Math.sin(G.t * 4) * .5;
  let x = player.x, y = player.y, z = head, k = .95, spin = G.t * 4;
  if (t < fly) {                                   // vuela del suelo a la cabeza
    const e = easeOut(t / fly);
    x = from.x + (player.x - from.x) * e; y = from.y + (player.y - from.y) * e; z = from.z + (head - from.z) * e + Math.sin(e * Math.PI) * 4;
    k = 1 - .05 * e;
  } else if (t > fly + hover) {                    // baja y se encoge hasta desaparecer dentro del jugador
    const e = easeIn((t - fly - hover) / sink);
    z = head + (Z + bodyY - head) * e; k = .95 * (1 - e); spin = G.t * (4 + 10 * e);
  }
  placeCrystal(x, y, z, k, spin, G.hadCrystal ? .55 : 1.15);
}
