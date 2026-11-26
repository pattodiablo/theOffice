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
const sdk = () => (!EDITOR && window.PokiSDK) || null;
let playing = false, inBreak = false;
export const pokiBusy = () => inBreak;

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
