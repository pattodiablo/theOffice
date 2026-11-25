import { W, D, H, Z, TILE, TW, TD } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { ci } from '../Materials/Palette.js';
import { DEFAULT_EXIT } from '../Data/LevelIO.js';

// Construye el piso y las paredes a partir de la forma del nivel (level.floor: grilla de baldosas de 8×8).
// Paredes altas en los bordes del fondo (norte y oeste) y barandas en los del frente (sur y este),
// así la cámara siempre ve el interior. La puerta EXIT y la entrada van en una pared del fondo o lateral.
let C;
const colors = () => C ||= {
  slab: ci(120, 124, 130), ta: ci(214, 218, 222), tb: ci(196, 201, 206), wall: ci(226, 228, 230), shade: ci(200, 203, 207),
  cap: ci(110, 115, 122), glass: ci(170, 205, 235), glassHi: ci(215, 235, 250), frame: ci(90, 96, 104), lamp: ci(245, 250, 255),
  lampF: ci(150, 155, 160), stone: ci(175, 178, 182), stoneD: ci(140, 143, 148), rail: ci(205, 208, 210), green: ci(40, 200, 70), text: ci(250, 255, 250) };
const FONT = { E: ['111', '100', '110', '100', '111'], X: ['101', '101', '010', '101', '101'], I: ['111', '010', '010', '010', '111'], T: ['111', '010', '010', '010', '010'] };

// cada baldosa: '0' sin piso · '1' piso con paredes/barandas en el borde · '2' piso abierto (sin paredes ni barandas)
export const tileOn = (i, j) => i >= 0 && j >= 0 && i < TW && j < TD && G.level.floor[j][i] !== '0';
const walled = (i, j) => tileOn(i, j) && G.level.floor[j][i] === '1';

// Entrada: puede ir en una pared del fondo (side 'back': x = inicio de la puerta, y = pared) o en una
// lateral (side 'left': x = columna de la pared, y = inicio de la puerta). Para no repetir todo dos veces, la
// puerta se describe con u (a lo largo de la pared, 0..11) y d (profundidad: 0 = cara de la pared hacia la
// sala, positivo hacia afuera, negativo hacia adentro de la sala). entPoint pasa (u, d) a coordenadas del mundo.
export function entranceGeom(en) {
  if (!en) return null;
  const left = en.side === 'left', a = Math.round(en.x), b = Math.round(en.y);
  const point = left ? (u, d) => [a + 2 - d, b + u] : (u, d) => [a + u, b + d];
  const voxel = left ? (u, dv) => [a + 1 - dv, b + u] : (u, dv) => [a + u, b + dv];   // dv: 0 capa interior de la pared, 1 exterior, -1 sala
  const local = left ? (x, y) => [y - b, a + 2 - x] : (x, y) => [x - a, y - b];        // al revés: (x, y) → (u, d)
  const [cx, cy] = point(5.5, 0);
  return { side: left ? 'left' : 'back', a, b, point, voxel, local, cx, cy, h: 22, inX: left ? 1 : 0, inY: left ? 0 : -1, ang: left ? 0 : -Math.PI / 2 };
}
export const doorGeom = entranceGeom;                  // la salida usa la misma descripción
// dos puertas en la misma pared demasiado cerca
export const doorsClash = (p, q) => !!p && !!q && (p.side === 'left') === (q.side === 'left') && (p.side === 'left' ? p.x === q.x && Math.abs(p.y - q.y) < 15 : p.y === q.y && Math.abs(p.x - q.x) < 15);
// ¿hay pared lateral (oeste) continua en x = wx para una puerta que empieza en y0?
export function sideDoorValid(wx, y0) {
  if (wx % TILE !== 0) return false;
  const i = wx / TILE;
  for (let y = y0 - 1; y <= y0 + 11; y++) { const j = Math.floor(y / TILE); if (!walled(i, j) || tileOn(i - 1, j)) return false; }
  return true;
}
export const entranceValid = en => !!en && (en.side === 'left' ? sideDoorValid(Math.round(en.x), Math.round(en.y)) : exitValid(Math.round(en.x), en.y));
export const doorValid = entranceValid;

// la puerta necesita pared del fondo continua en todo su ancho
export function exitValid(x0, wy) {
  if (wy % TILE !== TILE - 2) return false;
  const j = Math.floor(wy / TILE);
  for (let x = x0 - 1; x <= x0 + 11; x++) { const i = Math.floor(x / TILE); if (!walled(i, j) || tileOn(i, j + 1)) return false; }
  return true;
}

export function buildShell() {
  const C = colors(), a = new Uint8Array(W * D * H);
  const put = (x, y, z, c) => { if (x >= 0 && y >= 0 && z >= 0 && x < W && y < D && z < H) a[x + y * W + z * W * D] = c; };
  const bx = (x0, y0, z0, x1, y1, z1, c) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, c); };
  const railAt = (x, y, k) => { // baranda baja: base de piedra, postes cada 10 y barrotes cada 3
    bx(x, y, Z, x, y, Z + 2, C.stone); put(x, y, Z + 3, C.stoneD);
    if (k % 10 === 0) bx(x, y, Z + 4, x, y, Z + 11, C.stone); else if (k % 3 === 0) bx(x, y, Z + 4, x, y, Z + 10, C.rail);
    put(x, y, Z + 11, C.rail);
  };
  const TOP = 30;
  for (let j = 0; j < TD; j++) for (let i = 0; i < TW; i++) {
    if (!tileOn(i, j)) continue;
    const x0 = i * TILE, y0 = j * TILE, x1 = x0 + TILE - 1, y1 = y0 + TILE - 1;
    bx(x0, y0, 0, x1, y1, 1, C.slab); bx(x0, y0, 2, x1, y1, 2, (i + j) % 2 ? C.tb : C.ta);
    const w = walled(i, j);                     // el piso abierto no levanta paredes ni barandas
    if (w && !tileOn(i, j + 1)) { // pared del fondo con lámparas
      bx(x0, y1 - 1, Z, x1, y1, TOP, C.wall); bx(x0, y1 - 1, TOP, x1, y1, TOP + 1, C.cap); bx(x0, y1 - 2, Z, x1, y1 - 2, Z + 1, C.shade);
      if (i % 2 === 0) { bx(x0 + 1, y1 - 2, Z + 22, x1 - 1, y1 - 2, Z + 22, C.lampF); bx(x0 + 1, y1 - 2, Z + 23, x1 - 1, y1 - 2, Z + 24, C.lamp); }
    }
    if (w && !tileOn(i - 1, j)) { // pared lateral con ventanas
      bx(x0, y0, Z, x0 + 1, y1, TOP, C.wall); bx(x0, y0, TOP, x0 + 1, y1, TOP + 1, C.cap); bx(x0 + 2, y0, Z, x0 + 2, y1, Z + 1, C.shade);
      if (tileOn(i, j + 1)) { bx(x0, y0, Z + 10, x0 + 1, y1, Z + 21, C.frame); bx(x0, y0 + 1, Z + 11, x0 + 1, y1 - 1, Z + 20, C.glass); bx(x0 + 1, y0 + 2, Z + 17, x0 + 1, y0 + 4, Z + 19, C.glassHi); }
    }
    if (w && !tileOn(i, j - 1)) for (let x = x0; x <= x1; x++) railAt(x, y0, x);
    if (w && !tileOn(i + 1, j)) for (let y = y0; y <= y1; y++) railAt(x1, y, y);
  }
  // entrada (opcional): puerta de ascensor por donde aparece el jugador; mismas reglas que la salida
  const en = G.level.entrance, ex0 = G.level.exit || DEFAULT_EXIT;
  G.entOk = entranceValid(en) && !doorsClash(en, ex0);
  G.ENT = entranceGeom(en);
  if (G.entOk) {
    const N = G.ENT, bu = (u0, v0, z0, u1, v1, z1, c) => { for (let u = u0; u <= u1; u++) for (let dv = v0; dv <= v1; dv++) { const [x, y] = N.voxel(u, dv); bx(x, y, z0, x, y, z1, c); } };
    bu(0, -1, Z, 10, 1, Z + 21, 0);                                                    // hueco (y el zócalo)
    bu(-1, 0, Z, -1, 1, Z + 22, C.cap); bu(11, 0, Z, 11, 1, Z + 22, C.cap); bu(-1, 0, Z + 22, 11, 1, Z + 22, C.cap); // marco
    bu(1, -2, Z + 21, 9, -1, Z + 27, 0);                                                // sin lámparas ni ventana sobre el indicador
    bu(-1, 0, Z + 23, 11, 1, Z + 27, C.wall);                                           // pared arriba de la puerta (tapa ventanas laterales)
    bu(3, -1, Z + 23, 7, -1, Z + 27, C.cap);                                            // indicador ▼ del ascensor
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [1, 1], [2, 1], [3, 1], [2, 2]].forEach(([c, r]) => { const [x, y] = N.voxel(3 + c, -2); put(x, y, Z + 26 - r, C.green); });
    for (const u of [-2, 12]) bu(u, 0, Z + 10, u, 1, Z + 22, C.wall);                    // corta las ventanas laterales junto al marco
  }
  // salida: igual que la entrada, en una pared del fondo o lateral (exit.side), con letrero EXIT y botón para llamar al ascensor
  G.exitOk = entranceValid(ex0);
  G.EXIT = doorGeom(ex0);
  if (G.exitOk) {
    const N = G.EXIT, bu = (u0, v0, z0, u1, v1, z1, c) => { for (let u = u0; u <= u1; u++) for (let dv = v0; dv <= v1; dv++) { const [x, y] = N.voxel(u, dv); bx(x, y, z0, x, y, z1, c); } };
    bu(0, -1, Z, 10, 1, Z + 21, 0);                                                    // hueco de la puerta (y el zócalo)
    bu(-1, 0, Z, -1, 1, Z + 22, C.cap); bu(11, 0, Z, 11, 1, Z + 22, C.cap); bu(-1, 0, Z + 22, 11, 1, Z + 22, C.cap); // marco
    const su = -3, sz = Z + 24;
    bu(su - 1, -2, Z + 21, su + 17, -1, Z + 26, 0);                                    // sin lámparas detrás del letrero
    if (N.side === 'left') { bu(-2, 0, Z + 10, -2, 1, Z + 30, C.wall); bu(su - 1, 0, Z + 23, su + 17, 1, Z + 30, C.wall); bu(12, 0, Z + 10, 12, 1, Z + 22, C.wall); } // tapa las ventanas laterales
    bu(su, -1, sz, su + 16, -1, sz + 6, C.green);
    [...'EXIT'].forEach((ch, k) => FONT[ch].forEach((row, r) => [...row].forEach((bit, c) => { if (bit === '1') { const [x, y] = N.voxel(su + 1 + k * 4 + c, -2); put(x, y, sz + 5 - r, C.text); } })));
  }
  return a;
}
