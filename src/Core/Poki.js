import { EDITOR } from './Constants.js';
import { setMuted } from './Audio.js';
import { keys } from './Input.js';

// SDK de Poki (https://developers.poki.com/guide/sdk-html5). El script se carga en index.html.
// Si no está (editor, bloqueador de anuncios, sin red) todo esto no hace nada y el juego sigue igual.
//   pokiInit()          al arrancar, antes de cargar el juego
//   pokiLoaded()        cuando terminó de cargar (gameLoadingFinished)
//   pokiPlay()          el jugador empezó a jugar (su primer input en un nivel) → gameplayStart
//   pokiStop()          dejó de jugar: lo atraparon, salió por el ascensor, abrió el menú, final → gameplayStop
//   pokiBreak()         pausa para un anuncio antes de volver a jugar (Retry, siguiente piso, elegir piso).
//                       Silencia el audio y bloquea las teclas mientras dura; Poki decide si de verdad muestra uno.
//   pokiReward()        video con recompensa (revivir). Devuelve true si lo vio entero.
//   pokiCanReward()     si hay SDK para ofrecer el video (en desarrollo sin SDK: sí, y se regala, para probar)
const sdk = () => (!EDITOR && window.PokiSDK) || null;
let playing = false, inBreak = false;
export const pokiBusy = () => inBreak;
const DEV_FREE = true;   // Pages: sin SDK, revivir se regala para probar                                  // npm run dev sin SDK: la recompensa se da sola
export const pokiCanReward = () => !!sdk() || DEV_FREE;

export async function pokiInit() {
  const s = sdk(); if (!s) return;
  try { await s.init(); } catch (e) {}                                  // si falla, el juego carga igual
  // que el juego no haga scroll en la página de Poki (flechas, espacio, rueda)
  addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp', ' '].includes(e.key) && e.target.tagName !== 'TEXTAREA') e.preventDefault(); });
  addEventListener('wheel', e => e.preventDefault(), { passive: false });
}
export function pokiLoaded() { try { sdk()?.gameLoadingFinished(); } catch (e) {} }

export function pokiPlay() {
  if (playing || inBreak) return; const s = sdk(); playing = true;
  try { s?.gameplayStart(); } catch (e) {}
}
export function pokiStop() {
  if (!playing) return; const s = sdk(); playing = false;
  try { s?.gameplayStop(); } catch (e) {}
}

export async function pokiBreak() {
  const s = sdk(); if (!s || inBreak) return;
  pokiStop(); inBreak = true;
  const pause = () => { setMuted(true); for (const k in keys) keys[k] = false; };
  pause();                                                              // por si Poki no llama al callback de inicio
  try { await s.commercialBreak(pause); } catch (e) {}
  inBreak = false; setMuted(false);
}

export async function pokiReward() {
  const s = sdk(); if (inBreak) return false;
  if (!s) return DEV_FREE;
  pokiStop(); inBreak = true;
  const pause = () => { setMuted(true); for (const k in keys) keys[k] = false; };
  pause();
  let ok = false;
  try { ok = !!(await s.rewardedBreak({ size: 'medium', onStart: pause })); } catch (e) {}
  inBreak = false; setMuted(false);
  return ok;
}

// ---------- métricas para Poki (PokiSDK.measure: categoría, qué, acción) ----------
// Puntos de control del progreso de los jugadores (se ven en el panel de Poki). Lista completa en el README.
// Reglas de Poki: sin "/" ni "^" en los textos; por cada "start" de un nivel va un "complete" o un "fail", nunca los dos.
// En `npm run dev` también se escriben en la consola (console.debug) para revisarlos.
export function pokiMeasure(category, what, action) {
  const clean = s => String(s).replace(/[/^]/g, '-');
  const args = [clean(category), clean(what), clean(action)];
  if ((import.meta.env || {}).DEV && !EDITOR) console.debug('[poki measure]', ...args);
  try { sdk()?.measure?.(...args); } catch (e) {}
}
const once = new Set();                                                 // eventos que se mandan una sola vez por partida
export function pokiMeasureOnce(category, what, action) {
  const k = category + '|' + what + '|' + action; if (once.has(k)) return; once.add(k); pokiMeasure(category, what, action);
}
// intentos de nivel: start → complete o fail. Si empieza otro intento sin terminar el anterior (reintentar tras ser
// atrapado, elegir otro piso), el anterior cuenta como fail.
let attempt = null;
export function pokiLevelStart(n) { if (attempt != null) pokiMeasure('level', attempt, 'fail'); attempt = n; pokiMeasure('level', n, 'start'); }
export function pokiLevelEnd(n, ok) { if (attempt == null) return; pokiMeasure('level', attempt, ok ? 'complete' : 'fail'); attempt = null; }
