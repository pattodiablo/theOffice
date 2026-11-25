import * as THREE from 'three';
import { W, D, H, Z } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { PROPS, rot } from '../Data/PropLibrary.js';
import { voxMesh } from '../Core/VoxelMesh.js';
import { box } from './Character.js';
import { colH } from '../World/Grid.js';

// Escritorio inicial: siempre está donde empieza el jugador (level.player es el asiento).
// El escritorio va dentro del mundo; la silla y el teléfono son objetos aparte porque se animan.
const isChair = (x, y) => x >= 4 && x <= 10 && y <= 5;   // zona de la silla dentro de desk.vox
export const SEAT = [7.5, 3.5];                          // centro del asiento dentro del modelo
export const deskOrigin = p => [Math.round(p[0] - SEAT[0]), Math.round(p[1] - SEAT[1])];
let deskVox = [], startFoot = [], sdCells = new Set();
let chairMesh, phone, phoneScreen;

export function initStartDesk(scene) {
  const all = PROPS.desk ? rot('desk', 0).vox : [];
  deskVox = all.filter(v => !isChair(v[0], v[1]));        // el escritorio sin silla (la silla no choca)
  startFoot = [...new Set(deskVox.map(v => v[0] + ',' + v[1]))].map(k => k.split(',').map(Number));
  chairMesh = voxMesh(all.filter(v => isChair(v[0], v[1]))); scene.add(chairMesh);
  phone = new THREE.Group(); box(phone, 1.4, .5, 2.4, 0x15171a, 0, .25, 0);
  phoneScreen = box(phone, 1, .12, 1.8, 0, 0, .52, 0); phoneScreen.material = new THREE.MeshBasicMaterial({ color: 0x1a2a22 }); scene.add(phone);
}

// pone el escritorio en el mundo (lo llama compose)
// con entrada (G.entOk) no hay escritorio: el "asiento" es el punto frente a la puerta adonde camina al salir
export const ENTRANCE_STEP = 10;            // cuánto camina hacia adentro al salir del ascensor
export function stampStartDesk(grid) {
  if (G.entOk) { const [x, y] = G.ENT.point(5.5, -ENTRANCE_STEP); Object.assign(G.seat, { ox: -999, oy: -999, x, y }); sdCells = new Set(); return; }
  const [ox, oy] = deskOrigin(G.level.player); Object.assign(G.seat, { ox, oy, x: ox + SEAT[0], y: oy + SEAT[1] }); sdCells = new Set();
  for (const [x, y, z, c] of deskVox) { const X = ox + x, Y = oy + y, ZZ = z + Z; if (X >= 0 && Y >= 0 && X < W && Y < D && ZZ < H) { grid[X + Y * W + ZZ * W * D] = c; sdCells.add(X + Y * W); } }
}

// ¿cabe el escritorio en (ox, oy)? puede pisar su propia posición anterior (editor)
export function deskFits(ox, oy) {
  for (const [x, y] of startFoot) { const X = ox + x, Y = oy + y, i = X + Y * W; if (X < 2 || Y < 2 || X > W - 3 || Y > D - 3 || (colH[i] && !sdCells.has(i))) return false; }
  return true;
}

// silla (se corre al levantarse) y teléfono (vibra y parpadea mientras suena en la intro)
export function updateStartDesk() {
  const s = G.seat; chairMesh.visible = phone.visible = !G.entOk;
  chairMesh.position.set(s.ox, Z, -s.oy + G.chairSlide);
  const ringing = G.mode === 'play' && G.intro > .6 && G.intro < 1.8, j = () => ringing ? (Math.random() - .5) * .5 : 0;
  phone.position.set(s.ox + 2.5 + j(), Z + 7, -(s.oy + 10.5) + j());
  phoneScreen.material.color.setHex(ringing && Math.floor(G.intro * 8) % 2 ? 0x3be07c : 0x1a2a22);
}
