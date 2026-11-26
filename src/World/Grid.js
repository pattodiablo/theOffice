import * as THREE from 'three';
import { W, D, H, Z, TW, setLevelSize } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { buildShell, tileOn } from './ShellBuilder.js';
import { rot } from '../Data/PropLibrary.js';
import { normalizeLevel } from '../Data/LevelIO.js';
import { stampStartDesk } from '../Prefabs/StartDesk.js';
import { buildGeo } from '../Core/VoxelMesh.js';
import { seeThroughMaterial } from '../FX/SeeThrough.js';
import { pieceDelay, assemblyDepthMaterial } from '../FX/Assemble.js';

// El mundo en vóxeles: piso + paredes + props + escritorio inicial, y su mapa de alturas para chocar y ver.
export let grid = new Uint8Array(W * D * H);
export let colH = new Uint8Array(W * D); // altura ocupada en cada columna (0 = libre, 99 = fuera del piso)

export const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= W || y >= D || z >= H) ? 0 : grid[x + y * W + z * W * D];
// altura en (x, y); la puerta EXIT cerrada también bloquea
export const hAt = (x, y) => {
  x = Math.floor(x); y = Math.floor(y); const E = G.EXIT;
  if (x < 0 || y < 0 || x >= W || y >= D) return 99;
  if (G.doorOpen < .8 && G.exitOk) { const [u, d] = E.local(x + .5, y + .5); if (u >= 0 && u < 11 && d >= 0 && d < 2) return 99; } // puerta cerrada
  return colH[x + y * W];
};
// ¿cabe un cuerpo de radio r en (x, y)?
export const free = (x, y, r = 1.5) => hAt(x - r, y - r) === 0 && hAt(x + r, y - r) === 0 && hAt(x - r, y + r) === 0 && hAt(x + r, y + r) === 0;
// distancia hasta el primer obstáculo de altura ≥ th en esa dirección (visión)
export function rayDist(x, y, ang, max, th) { const cx = Math.cos(ang), cy = Math.sin(ang); for (let d = 1; d < max; d += .5) if (hAt(x + cx * d, y + cy * d) >= th) return d; return max; }

export let worldMesh;
export function initWorldMesh(scene) {
  worldMesh = new THREE.Mesh(new THREE.BufferGeometry(), seeThroughMaterial()); // el mundo se transparenta si tapa al jugador
  worldMesh.customDepthMaterial = assemblyDepthMaterial();   // la sombra también se ensambla
  worldMesh.rotation.x = -Math.PI / 2; worldMesh.castShadow = worldMesh.receiveShadow = true; scene.add(worldMesh);
}

// arma el mundo a partir del nivel
export function compose() {
  normalizeLevel(G.level);
  if (setLevelSize(G.level.floor[0].length, G.level.floor.length)) colH = new Uint8Array(W * D); // el tamaño sale de la grilla del piso
  grid = buildShell();
  // pieza de cada vóxel para el ensamblado: baldosa de piso, paredes de esa baldosa, cada prop y el escritorio inicial
  const piece = new Int32Array(W * D * H), kinds = [];
  for (let i = 0; i < piece.length; i++) if (grid[i]) { const x = i % W, y = ((i / W) | 0) % D, z = (i / (W * D)) | 0; piece[i] = 1 + ((y >> 3) * TW + (x >> 3)) * 2 + (z > Z - 1 ? 1 : 0); }
  for (let t = 0; t < TW * (D >> 3) * 2; t++) kinds[1 + t] = t % 2 ? 'wall' : 'floor';
  const P0 = 1 + TW * (D >> 3) * 2;
  G.level.props.forEach((p, k) => {
    const R = rot(p.t, p.r); kinds[P0 + k] = 'prop';
    for (const [x, y, z, c] of R.stat) { const X = p.x + x, Y = p.y + y, ZZ = z + Z; if (X >= 0 && Y >= 0 && X < W && Y < D && ZZ < H && tileOn(X >> 3, Y >> 3)) { grid[X + Y * W + ZZ * W * D] = c; piece[X + Y * W + ZZ * W * D] = P0 + k; } } // lo que quede fuera del piso no se dibuja
  });
  const before = grid.slice(); stampStartDesk(grid);
  const DESK = P0 + G.level.props.length; kinds[DESK] = 'desk';
  for (let i = 0; i < grid.length; i++) if (grid[i] !== before[i]) piece[i] = DESK;
  // centro (base) y retraso de cada pieza
  const bb = {};
  for (let i = 0; i < piece.length; i++) { const k = piece[i]; if (!k || !grid[i]) continue; const x = i % W, y = ((i / W) | 0) % D, z = (i / (W * D)) | 0, b = bb[k] ||= [x, y, z, x, y];
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (z < b[2]) b[2] = z; if (x > b[3]) b[3] = x; if (y > b[4]) b[4] = y; }
  const info = {}; G.asmMax = 0;
  for (const k in bb) { const b = bb[k], cx = (b[0] + b[3] + 1) / 2, cy = (b[1] + b[4] + 1) / 2;
    const t = pieceDelay(kinds[k], Math.hypot(cx - G.seat.x, cy - G.seat.y), (k * .618) % 1); info[k] = [cx, cy, b[2], t]; G.asmMax = Math.max(G.asmMax, t); }
  for (let x = 0; x < W; x++) for (let y = 0; y < D; y++) { let h = 0; for (let z = Z; z <= Z + 20; z++) if (at(x, y, z)) h = z - Z + 1; colH[x + y * W] = tileOn(x >> 3, y >> 3) ? h : 99; } // fuera del piso no se camina
  if (G.entOk) for (let u = -1; u <= 11; u++) for (let dv = -1; dv <= 1; dv++) { const [x, y] = G.ENT.voxel(u, dv); if (x >= 0 && y >= 0 && x < W && y < D) colH[x + y * W] = 99; } // la puerta de entrada se cierra detrás del jugador
  worldMesh.geometry.dispose(); worldMesh.geometry = buildGeo(at, W, D, H, (x, y, z) => info[piece[x + y * W + z * W * D]]);
}
