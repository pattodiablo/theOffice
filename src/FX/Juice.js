import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { JUICE } from '../Settings.js';

// "Jugosidad": pequeños golpes de cámara, tiempo y pantalla que hacen que cada evento se sienta.
//   shake(n)        sacudón de cámara (se va apagando solo)
//   kick(n)         golpe de zoom: la cámara se acerca un instante y vuelve
//   hitstop(s)      congela el juego unos milisegundos (el impacto "pesa")
//   slowmo(k, s)    cámara lenta: el juego va a k de velocidad durante s segundos
//   flash(rgb, a)   destello de color en toda la pantalla
//   popText(x, y, texto, clase)   texto que salta desde un punto del nivel y se desvanece
// Todo se puede apagar o ajustar en Settings.js › JUICE.
let flashEl, pops = [], stopT = 0, slowT = 0, slowK = 1;
const v = new THREE.Vector3();
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;   // quien pidió menos movimiento: sin sacudones ni zoom

export function initJuice() {
  flashEl = document.createElement('div'); flashEl.id = 'flash'; document.body.append(flashEl);
}

export function shake(n) { if (JUICE.on && !calm()) G.shake = Math.max(G.shake || 0, n * JUICE.shake); }
export function kick(n) { if (JUICE.on && !calm()) G.zoomKick = Math.max(G.zoomKick || 0, n * JUICE.zoom); }
export function hitstop(s) { if (JUICE.on) stopT = Math.max(stopT, s); }
export function slowmo(k, s) { if (JUICE.on && JUICE.slowmo) { slowK = Math.min(slowK, k); slowT = Math.max(slowT, s); } }
export function flash(rgb, a = .35) {
  if (!JUICE.on || !flashEl) return;
  flashEl.style.transition = 'none'; flashEl.style.background = `rgba(${rgb},${a})`; flashEl.style.opacity = 1;
  void flashEl.offsetWidth; flashEl.style.transition = 'opacity .35s ease-out'; flashEl.style.opacity = 0;
}
// vibración corta en el celular (navigator.vibrate). ms = milisegundos o un patrón [vibra, pausa, vibra…].
// Android con Chrome la soporta; iPhone/iPad no la permiten desde una página web (ahí simplemente no pasa nada).
export function haptic(ms) {
  if (!JUICE.on || !JUICE.haptics || document.hidden) return;
  try { navigator.vibrate?.(ms); } catch (e) {}
}

export function popText(x, y, text, cls = '') {
  if (!JUICE.on) return;
  const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text; document.body.append(el);
  pops.push({ el, x, y, t: 0 });
}
export function resetJuice() { stopT = slowT = 0; slowK = 1; G.zoomKick = 0; for (const p of pops) p.el.remove(); pops = []; }

// tiempo del juego: el bucle lo pasa por acá (hitstop = 0, cámara lenta = más lento). Lo real sigue para la UI.
export function gameDt(dt) {
  if (stopT > 0) { stopT -= dt; return 0; }
  if (slowT > 0) { slowT -= dt; const k = slowK; if (slowT <= 0) slowK = 1; return dt * k; }
  return dt;
}

// textos flotantes (cada frame, con el tiempo real)
export function updateJuice(dt, cam, stage) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt;
    if (p.t > 1.1) { p.el.remove(); pops.splice(i, 1); continue; }
    v.set(p.x, Z + 14 + p.t * 8, -p.y).project(cam);
    const pop = p.t < .12 ? .6 + p.t / .12 * .6 : p.t < .25 ? 1.2 - (p.t - .12) / .13 * .2 : 1;      // salta grande y se acomoda
    p.el.style.transform = `translate(${(v.x + 1) / 2 * stage.clientWidth}px,${(1 - v.y) / 2 * stage.clientHeight}px) translate(-50%,-50%) scale(${pop})`;
    p.el.style.opacity = p.t > .75 ? 1 - (p.t - .75) / .35 : 1;
  }
}
