import * as THREE from 'three';
import { G } from '../Core/Game.js';
import { ASSEMBLE, ASSEMBLE_SPREAD, ASSEMBLE_POP } from '../Settings.js';
import { puff } from './Particles.js';
import { puffSound, dreamSound } from '../Core/Audio.js';

// Ensamblado del nivel (como un sueño): antes de la intro, el nivel aparece pieza por pieza
// creciendo desde escala 0 con un pequeño rebote, en una onda que sale del escritorio del jugador.
// Primero el piso, luego paredes y props, después los objetos y agentes, y al final el jugador (¡puf!).
//
// El mundo es una sola malla: cada vóxel lleva en el atributo aAsm el centro de su pieza y su retraso,
// y el shader escala la pieza. El resto de objetos de la escena se escala desde aquí (preRender/postRender).

const U = { uAsm: { value: 999 }, uAsmPop: { value: ASSEMBLE_POP } }; // tiempo del ensamblado (999 = todo armado)

// retraso de una pieza según su tipo y su distancia al escritorio inicial
export const KIND = { floor: 0, wall: .35, prop: .25, desk: -.1 };
export function pieceDelay(kind, dist, seed) { return Math.max(0, dist * ASSEMBLE_SPREAD + KIND[kind] + (kind === 'prop' ? seed * .25 : 0)); }

// inyecta la escala por pieza en un shader de Three.js (material del mundo y su sombra)
export function patchAssembly(sh) {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = 'attribute vec4 aAsm;\nuniform float uAsm, uAsmPop;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    float e = clamp((uAsm - aAsm.w) / uAsmPop, 0.0, 1.0);
    float c = 1.70158, s = e <= 0.0 ? 0.0 : 1.0 + (c + 1.0) * pow(e - 1.0, 3.0) + c * pow(e - 1.0, 2.0); // rebote (back out)
    transformed = aAsm.xyz + (transformed - aAsm.xyz) * s;
    transformed.z += (1.0 - e) * 7.0;                                                                   // baja flotando
  }`);
}

export function assemblyDepthMaterial() {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = patchAssembly; m.customProgramCacheKey = () => 'asmDepth'; return m;
}

// ---------- secuencia ----------
let items = [], saved = [], end = 0, playerT = 0, playerPopped = false;
const box = new THREE.Box3(), c = new THREE.Vector3();
const backOut = e => { const k = 1.70158; return 1 + (k + 1) * (e - 1) ** 3 + k * (e - 1) ** 2; };

// resetIntro lo llama al empezar a jugar: el mundo queda vacío hasta que se llame startAssembly
export function resetAssembly(play) { G.asm = play && ASSEMBLE ? 0 : -1; U.uAsm.value = G.asm >= 0 ? 0 : 999; items = []; }

// objetos de la escena que aparecen con el mundo (se toman al empezar: lo que se crea después, como partículas, no)
function collect(scene, worldMesh, playerRoot) {
  items = []; const dist = (x, y) => Math.hypot(x - G.seat.x, y - G.seat.y);
  end = (G.asmMax || 0) + ASSEMBLE_POP;
  for (const o of scene.children) {
    if (o === worldMesh || o.isLight || o === playerRoot) continue;
    box.setFromObject(o); if (box.isEmpty()) continue; box.getCenter(c);
    const far = c.distanceTo(o.position) > 20;          // geometría en coordenadas del mundo (conos, anillos): sin escala
    const d = dist(c.x, -c.z);
    const t = o.userData.character ? end - .2 + d * .004 : far ? end - .1 : pieceDelay('prop', d, (o.id * .618) % 1) + .2;
    items.push({ o, t, scale: !far });
  }
  playerT = end + .15; playerPopped = false;
  if (G.entOk) { items.push({ o: playerRoot, t: 999, scale: false }); G.asmEnd = playerT + .2; return; } // con entrada: sin "¡puf!", aparece detrás de las puertas al empezar la intro
  items.push({ o: playerRoot, t: playerT, scale: true });
  G.asmEnd = playerT + .7;
}

export function updateAssembly(dt, scene, worldMesh, playerRoot) {
  if (G.asm === 0) { collect(scene, worldMesh, playerRoot); dreamSound(); }
  G.asm += dt; U.uAsm.value = G.asm;
  if (!playerPopped && G.asm >= playerT && !G.entOk) { playerPopped = true; puff(G.seat.x, G.seat.y); puffSound(false); }
  if (G.asm >= G.asmEnd) { G.asm = -1; U.uAsm.value = 999; items = []; }
}

// cualquier tecla o toque: salta al final (el jugador aparece de inmediato)
export function skipAssembly() { if (G.asm > .3 && G.asm < playerT) G.asm = playerT; }

// justo antes de dibujar: oculta o escala lo que todavía no apareció; postRender lo deja como estaba
export function preRender() {
  saved = [];
  if (G.asm < 0) return;
  if (!items.length) { // aún no empezó (pantalla de título): solo el fondo
    for (const o of collectAll) { saved.push([o, o.visible, null]); o.visible = false; }
    return;
  }
  for (const it of items) {
    const k = (G.asm - it.t) / ASSEMBLE_POP;
    if (k >= 1) continue;
    if (k <= 0) { saved.push([it.o, it.o.visible, null]); it.o.visible = false; }
    else if (it.scale) { saved.push([it.o, it.o.visible, it.o.scale.clone()]); it.o.scale.multiplyScalar(Math.max(.001, backOut(k))); }
  }
}
export function postRender() {
  for (const [o, v, s] of saved) { o.visible = v; if (s) o.scale.copy(s); }
  saved = [];
}

// todo lo de la escena menos luces (para la pantalla de título antes de ensamblar)
let collectAll = [];
export function setAssemblyScene(scene, worldMesh) {
  collectAll = { [Symbol.iterator]: function* () { for (const o of scene.children) if (!o.isLight && o !== worldMesh) yield o; } };
}
