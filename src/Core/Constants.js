// Medidas del mundo. El ancho y el fondo dependen de cada nivel (el tamaño de su grilla "floor");
// cambian con setLevelSize al armar el nivel. Los módulos que importan W, D, TW, TD ven siempre el valor actual.
export const H = 34;                                 // alto del mundo en vóxeles (z)
export const Z = 3;                                  // altura del piso: todo se apoya en z = 3
export const TILE = 8;                               // una baldosa del piso = 8 × 8 vóxeles
export const MIN_TILES = 4, MAX_TILES = 32;          // tamaño mínimo y máximo de un nivel, en baldosas por lado
export let TW = 16, TD = 13;                         // baldosas del nivel abierto: ancho (x) × fondo (y)
export let W = TW * TILE, D = TD * TILE;             // lo mismo en vóxeles
export function setLevelSize(tw, td) {               // devuelve true si cambió
  if (tw === TW && td === TD) return false;
  TW = tw; TD = td; W = tw * TILE; D = td * TILE; return true;
}

// Mismo código para el juego (index.html) y el editor (editor.html).
export const EDITOR = document.body.dataset.mode === 'editor';
// Nivel a cargar: ?nivel=piso2 lee public/levels/piso2.json
export const LEVEL_NAME = (new URLSearchParams(location.search).get('nivel') || 'piso1').replace(/[^a-z0-9_-]/gi, '');

export const $ = s => document.querySelector(s);
