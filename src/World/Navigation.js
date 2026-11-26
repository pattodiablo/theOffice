import { W, D } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { free } from './Grid.js';
import { turnTo } from '../Core/MathUtils.js';

// Navegación de los agentes: campos de distancia (BFS) para rodear muebles al perseguir, buscar o volver a su ruta.
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
let walk = new Uint8Array(W * D);
export function computeWalk() { if (walk.length !== W * D) walk = new Uint8Array(W * D); for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) walk[x + y * W] = free(x + .5, y + .5, 1.2) ? 1 : 0; }

// distancia en pasos hasta (tx, ty)
export function flowFrom(tx, ty) {
  const dist = new Int32Array(W * D).fill(-1), q = new Int32Array(W * D); let h = 0, n = 0;
  const sx = Math.min(W - 1, Math.max(0, Math.floor(tx))), sy = Math.min(D - 1, Math.max(0, Math.floor(ty)));
  dist[sx + sy * W] = 0; q[n++] = sx + sy * W;
  while (h < n) {
    const i = q[h++], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= D) continue;
      const j = nx + ny * W; if (dist[j] >= 0 || !walk[j]) continue;
      if (dx && dy && (!walk[nx + y * W] || !walk[x + ny * W])) continue; // sin cortar esquinas
      dist[j] = dist[i] + 1; q[n++] = j;
    }
  }
  return dist;
}

// avanza bajando por el campo; false si llegó o no hay camino
export function stepFlow(a, field, speed, dt) {
  const cx = Math.floor(a.x), cy = Math.floor(a.y); let bd = field[cx + cy * W], best = null;
  if (bd < 0) bd = 1e9;
  if (bd === 0) return false;
  for (const [dx, dy] of DIRS8) {
    const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= D) continue;
    const d = field[nx + ny * W]; if (d >= 0 && d < bd) { bd = d; best = [nx + .5, ny + .5]; }
  }
  if (!best) return false;
  const ddx = best[0] - a.x, ddy = best[1] - a.y, l = Math.hypot(ddx, ddy), k = Math.min(1, speed * dt / Math.max(l, 1e-3));
  a.x += ddx * k; a.y += ddy * k; a.moving = true; turnTo(a, Math.atan2(ddy, ddx), dt * 10);
  return true;
}

// ¿el jugador puede llegar caminando desde su escritorio hasta la salida? (lo usa el editor)
export function exitReachable() {
  const E = G.EXIT, s = [Math.floor(G.seat.x), Math.floor(G.seat.y)]; if (!free(s[0] + .5, s[1] + .5)) return false;
  const seen = new Uint8Array(W * D), q = [s]; seen[s[0] + s[1] * W] = 1;
  while (q.length) {
    const [x, y] = q.pop(); if (G.exitOk) { const [u, d] = E.local(x + .5, y + .5); if (d >= -6 && u > -1 && u < 12) return true; }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= D || seen[nx + ny * W]) continue; seen[nx + ny * W] = 1; if (free(nx + .5, ny + .5)) q.push([nx, ny]); }
  }
  return false;
}
