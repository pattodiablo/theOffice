import * as THREE from 'three';
import { Z, W, D, EDITOR } from '../Core/Constants.js';
import { cam, stage } from '../Core/Engine.js';
import { G } from '../Core/Game.js';
import { OBSERVER as O, OBSERVER_NOTES as NOTES } from '../Settings.js';
import { free } from '../World/Grid.js';
import { glowTex } from '../FX/GlowTex.js';
import { servoSound, scribbleSound } from '../Core/Audio.js';

// El Observador (la conciencia de la anti-realidad): en cualquier piso, a veces baja del techo colgado de un cable,
// gira su lente hacia el jugador y anota en su cuaderno lo que ve (OBSERVER_NOTES, según lo que estés haciendo).
// Después vuelve a subir. Ajustes en OBSERVER (Settings.js). Es solo presencia: no atrapa ni bloquea.
// Estados: off (no aparece en este intento) → wait → descend → write → ascend → gone
const v = new THREE.Vector3(), easeOut = t => 1 - (1 - t) ** 3, easeIn = t => t * t;
let root, head, lens, pupil, pen, halo, spot, light, noteEl, noteTxt, noteHead;
let st = 'off', t = 0, trig = 0, x = 0, y = 0, look = 0, note = '', shown = -1, scribT = 0, logN = 0;
let lastLevel = '', attempts = 0;

function makeModel(scene) {
  const lam = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const shell = lam(0xe9e6f2), dark = lam(0x2a2833), mid = lam(0x8d88a3);
  const add = (p, geo, mat, px = 0, py = 0, pz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; p.add(m); return m; };
  root = new THREE.Group(); root.scale.setScalar(1.35); scene.add(root);
  add(root, new THREE.CylinderGeometry(.35, .35, 90, 6).translate(0, 45, 0), dark);                 // cable al techo
  add(root, new THREE.CylinderGeometry(1.4, 1.4, 1.6, 8), mid, 0, 4.6, 0);                          // enganche
  head = new THREE.Group(); root.add(head);
  add(head, new THREE.CylinderGeometry(4.2, 3.4, 5.6, 8).rotateY(Math.PI / 8), shell);              // cápsula
  add(head, new THREE.CylinderGeometry(4.3, 4.3, .8, 8).rotateY(Math.PI / 8), dark, 0, 1.9, 0);     // franja
  add(head, new THREE.CylinderGeometry(3.4, 2.6, 1.2, 8).rotateY(Math.PI / 8), mid, 0, -3.3, 0);    // base
  add(head, new THREE.CylinderGeometry(2.5, 2.5, .8, 20).rotateX(Math.PI / 2), dark, 0, -.2, 3.5);  // marco del lente
  lens = add(head, new THREE.CylinderGeometry(1.9, 1.9, .3, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4fd8 }), 0, -.2, 3.95);
  pupil = add(head, new THREE.CylinderGeometry(.75, .75, .3, 16).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a0016 }), 0, -.2, 4.15);
  add(head, new THREE.CylinderGeometry(.3, .3, .3, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), .7, .5, 4.3);
  // brazos: el izquierdo sostiene el cuaderno, el derecho el lápiz
  const armL = add(head, new THREE.BoxGeometry(.9, .9, 5).translate(0, 0, 2.5), mid, -3.8, -2.4, 0); armL.rotation.set(.5, -.55, 0);
  const armR = add(head, new THREE.BoxGeometry(.9, .9, 5).translate(0, 0, 2.5), mid, 3.8, -2.4, 0); armR.rotation.set(.5, .55, 0);
  const pad = new THREE.Group(); pad.position.set(-1.6, -5.2, 5); pad.rotation.set(-1, .25, 0); head.add(pad);
  add(pad, new THREE.BoxGeometry(5, .35, 6.4), lam(0x7a5a3a));                                        // tabla
  add(pad, new THREE.BoxGeometry(4.4, .1, 5.6), lam(0xfbf8ee), 0, .22, .2);                           // hoja
  add(pad, new THREE.BoxGeometry(2, .5, .8), lam(0xb8bcc4), 0, .35, -2.9);                            // clip
  for (let i = 0; i < 5; i++) add(pad, new THREE.BoxGeometry(3.4 - (i % 2) * 1.1, .05, .14), dark, -(i % 2) * .5, .3, -1.6 + i * .9);   // renglones escritos
  pen = new THREE.Group(); pad.add(pen);
  add(pen, new THREE.CylinderGeometry(.18, .05, 3.4, 6).translate(0, 1.7, 0), lam(0xffcc00)); pen.rotation.set(.35, 0, -.4);
  halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex([[0, 'rgba(255,120,230,.9)'], [.3, 'rgba(255,80,220,.35)'], [1, 'rgba(255,60,200,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(10); halo.position.set(0, -.2, 4.4); head.add(halo);
  light = new THREE.PointLight(0xff5fe0, 0, 55, 2); light.position.set(0, -4, 3); head.add(light);
  // en el piso: círculo rosado donde está (para que se lea desde la vista isométrica)
  spot = new THREE.Mesh(new THREE.CircleGeometry(5, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0, depthWrite: false }));
  spot.renderOrder = 2; scene.add(spot);
}

export function initObserver(scene) {
  makeModel(scene); root.visible = false; spot.visible = false;
  noteEl = document.createElement('div'); noteEl.id = 'obsNote';
  noteEl.innerHTML = '<b></b><p></p>'; document.body.append(noteEl);
  noteHead = noteEl.querySelector('b'); noteTxt = noteEl.querySelector('p');
}

// cada intento (setMode): decide si en este aparece y cuándo
export function resetObserver(mode) {
  if (mode === 'play') { if (G.levelName === lastLevel) attempts++; else { lastLevel = G.levelName; attempts = 1; } }
  st = !EDITOR && mode === 'play' && Math.random() < O.chance ? 'wait' : 'off';
  trig = O.delay[0] + Math.random() * (O.delay[1] - O.delay[0]); t = 0;
  root.visible = spot.visible = false; noteEl.classList.remove('show');
}

// dónde bajar: un punto libre (lejos de las paredes) a cierta distancia del jugador. Primero prueba detrás de él
// (del lado opuesto a la cámara): así, al mirarlo, la lente queda de frente a la pantalla.
const BACK = Math.atan2(1, -1);
function pickSpot(p) {
  for (let k = 0; k < 60; k++) {
    const a = k < 40 ? BACK + (Math.random() - .5) * 2.4 : Math.random() * Math.PI * 2, d = O.dist[0] + Math.random() * (O.dist[1] - O.dist[0]), sx = p.x + Math.cos(a) * d, sy = p.y + Math.sin(a) * d;
    if (sx > 8 && sy > 8 && sx < W - 8 && sy < D - 8 && free(sx, sy, 3)) return [sx, sy];
  }
  return null;
}

// qué anota: lo más interesante de lo que estás haciendo (o algo general)
function pickNote(p) {
  const pick = k => { const l = NOTES[k] || NOTES.any; return l[Math.random() * l.length | 0]; };
  const opts = [];
  if (G.hiddenKind) opts.push(['hidden']);
  if (G.carrying) opts.push(['bomb']);
  if (G.gotCrystal) opts.push(['crystal']);
  if (G.alerts > 0) opts.push(['seen', G.alerts]);
  if (attempts > 1) opts.push(['retry', attempts]);
  if (G.usedGlitch) opts.push(['glitch']);
  if (G.time > 60) opts.push(['slow', Math.round(G.time)]);
  const [k, n] = opts.length && Math.random() < .8 ? opts[Math.random() * opts.length | 0] : ['any'];
  return pick(k).replace('{n}', n);
}

// lógica (solo jugando)
export function updateObserver(dt, p) {
  if (st === 'off' || st === 'gone') return;
  t += dt;
  if (st === 'wait') {
    if (G.time < trig) return;
    const s = pickSpot(p); if (!s) { trig += 3; return; }          // no hay lugar: prueba un poco después
    [x, y] = s; st = 'descend'; t = 0; look = Math.atan2(p.x - x, -(p.y - y)); servoSound(true);
  } else if (st === 'descend' && t >= O.descend) {
    st = 'write'; t = 0; note = pickNote(p); shown = -1; logN++;
    noteHead.textContent = `OBSERVATION LOG · SUBJECT ${O.subject} · #${logN}`; noteTxt.textContent = ''; noteEl.classList.add('show');
  } else if (st === 'write' && t >= O.stay) {
    st = 'ascend'; t = 0; noteEl.classList.remove('show'); servoSound(false);
  } else if (st === 'ascend' && t >= O.ascend) { st = 'gone'; }
  if (st === 'write' && (scribT -= dt) <= 0 && shown < note.length) { scribT = .12 + Math.random() * .1; scribbleSound(); }
}

// visual (cada frame)
export function animateObserver(dt, p) {
  const on = st === 'descend' || st === 'write' || st === 'ascend';
  root.visible = spot.visible = on && G.mode !== 'edit';
  if (!root.visible) { noteEl.classList.remove('show'); light.intensity = 0; return; }
  const top = O.hover + 70;
  const h = st === 'descend' ? top - (top - O.hover) * easeOut(Math.min(1, t / O.descend)) - Math.sin(Math.min(1, t / O.descend) * Math.PI) * 1.5
          : st === 'ascend' ? O.hover + (top - O.hover) * easeIn(Math.min(1, t / O.ascend)) : O.hover + Math.sin(G.t * 1.6) * .6;
  root.position.set(x, Z + h, -y);
  // la lente sigue al jugador (gira despacio) y se inclina hacia abajo
  const want = Math.atan2(p.x - x, -(p.y - y)), diff = Math.atan2(Math.sin(want - look), Math.cos(want - look));
  look += diff * Math.min(1, dt * (st === 'write' ? 2.5 : 1.2));
  const writing = st === 'write' && shown < note.length;
  head.rotation.set(writing ? .32 : .18 + Math.sin(G.t * .9) * .04, look, Math.sin(G.t * 1.3) * .05);
  pupil.position.x = Math.sin(G.t * 2.1) * .35; pupil.position.y = -.2 + (writing ? -.4 : Math.cos(G.t * 1.7) * .2);
  lens.material.color.setHex(Math.sin(G.t * 3) > .85 ? 0xffb3f0 : 0xff4fd8);
  pen.position.set(-1.2 + ((G.t * 3) % 2.6), .4 + (writing ? Math.abs(Math.sin(G.t * 22)) * .25 : .6), -1.6 + (shown / Math.max(1, note.length)) * 3.6);
  pen.visible = st !== 'descend' || t > O.descend * .6;
  const k = st === 'descend' ? Math.min(1, t / O.descend) : st === 'ascend' ? 1 - Math.min(1, t / O.ascend) : 1;
  light.intensity = 220 * k; halo.material.opacity = .5 + .3 * Math.sin(G.t * 3);
  spot.position.set(x, Z + .28, -y); spot.material.opacity = .4 * k + .1 * Math.sin(G.t * 3) * k; spot.scale.setScalar(.6 + .4 * k);
  // nota: se escribe letra por letra, pegada encima del Observador
  if (st === 'write') {
    const n = Math.min(note.length, Math.floor(Math.max(0, t - .35) / .045));
    if (n !== shown) { shown = n; noteTxt.textContent = note.slice(0, n); }
    v.set(x, Z + h + 7, -y).project(cam);
    noteEl.style.left = ((v.x + 1) / 2 * stage.clientWidth) + 'px'; noteEl.style.top = ((1 - v.y) / 2 * stage.clientHeight) + 'px';
  }
}
