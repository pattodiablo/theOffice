import { GREEN_LOOK } from '../Settings.js';

// Paleta de los vóxeles (sale de los .vox vía office.json). Es la "textura" del juego:
// cada vóxel guarda un índice (1..255) a esta lista de colores.
export let COLORS = [];
let ORIGINAL = [];

export function initPalette(colors) {
  ORIGINAL = colors.map(c => c.join(','));
  COLORS = colors.map(c => GREEN_LOOK[c.join(',')] || c); // ambientación verde: algunos colores cambian al cargar
}

// índice de un color por su RGB original (para el piso y las paredes generadas)
export const ci = (r, g, b) => { const i = ORIGINAL.indexOf(`${r},${g},${b}`); return i >= 0 ? i + 1 : 1; };
