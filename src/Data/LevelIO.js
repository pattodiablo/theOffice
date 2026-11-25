import { LEVEL_NAME, EDITOR, MIN_TILES, MAX_TILES } from '../Core/Constants.js';

// Lectura y guardado de niveles (public/levels/<nivel>.json).
export const DEFAULT_EXIT = { x: 89, y: 102 };
export const fullFloor = () => Array.from({ length: 13 }, () => '1'.repeat(16)); // nivel nuevo: 16 × 13 baldosas

// Si el nivel no existe todavía (p. ej. ?nivel=piso2) arranca uno vacío; "Guardar" lo crea.
export async function loadLevel() { return (await loadLevelNamed(LEVEL_NAME)) || { player: [20.5, 12.5], props: [], agents: [], hides: [] }; }

// carga un nivel por nombre; null si no existe (el servidor de Vite devuelve una página en vez de un 404, por eso se valida el JSON)
// Los niveles cargados (o precargados en segundo plano) quedan en caché; cada uso recibe una copia.
const cache = {};
export async function loadLevelNamed(name) {
  if (!(name in cache)) cache[name] = (async () => {
    try {
      const r = await fetch(`levels/${name}.json`, { cache: 'no-store' }); if (!r.ok) return null;
      const l = JSON.parse(await r.text()); return Array.isArray(l.props) ? l : null;
    } catch (e) { return null; }
  })();
  const l = await cache[name];
  if (!l) delete cache[name];                         // si no existía, se puede volver a probar (p. ej. recién creado)
  return l && JSON.parse(JSON.stringify(l));
}
// precarga los niveles siguientes sin bloquear el juego
export const prefetchLevel = name => name && loadLevelNamed(name);
// piso1 → piso2, nivel9 → nivel10
export const nextLevelName = n => { const m = n.match(/^(.*?)(\d+)$/); return m ? m[1] + (+m[2] + 1) : null; };
// número del nivel (piso3 → 3) y cuántos niveles hay en la serie (prueba piso1, piso2… hasta que falte uno)
export const levelNumber = n => +(n.match(/(\d+)$/) || [0, 1])[1];
export async function countLevels(n) {
  const m = n.match(/^(.*?)(\d+)$/); if (!m) return 1;
  let k = 1; while (k < 99 && await loadLevelNamed(m[1] + (k + 1))) k++;
  return k;
}

// completa los campos que los niveles viejos no tienen
export function normalizeLevel(l) {
  l.floor ||= fullFloor(); l.exit ||= { ...DEFAULT_EXIT }; l.hides ||= []; l.cams ||= []; l.lasers ||= [];
  const tw = Math.min(MAX_TILES, Math.max(MIN_TILES, ...l.floor.map(r => r.length))), td = Math.min(MAX_TILES, Math.max(MIN_TILES, l.floor.length)); // grilla rectangular
  l.floor = Array.from({ length: td }, (_, j) => (l.floor[j] || '').slice(0, tw).padEnd(tw, '0'));
  l.agentTypes ||= []; while (l.agentTypes.length < l.agents.length) l.agentTypes.push('normal'); l.agentTypes.length = l.agents.length; // tipo de cada agente: 'normal' o 'red'
  return l;
}

// El editor guarda un borrador en el navegador mientras trabajas.
export const LS = 'escape-oficina-borrador-' + LEVEL_NAME;
export function loadDraft() { try { const s = localStorage.getItem(LS); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function saveDraft(level) { if (EDITOR) try { localStorage.setItem(LS, JSON.stringify(level)); } catch (e) {} }

// "Guardar": con `npm run dev` lo escribe en public/levels/ (ver vite.config.js); si no, descarga el archivo.
export async function saveLevelFile(level) {
  const body = JSON.stringify(level, null, 1);
  try {
    const r = await fetch(`api/level?name=${LEVEL_NAME}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!r.ok) throw new Error(r.status);
    try { localStorage.removeItem(LS); } catch (e) {}
    return `Guardado en public/levels/${LEVEL_NAME}.json`;
  } catch (e) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    a.download = LEVEL_NAME + '.json'; a.click(); return 'Sin servidor de desarrollo: se descargó el JSON';
  }
}
