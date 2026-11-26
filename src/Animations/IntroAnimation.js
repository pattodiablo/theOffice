import { G } from '../Core/Game.js';
import { INTRO_TIME } from '../Settings.js';
import { ease } from '../Core/MathUtils.js';
import { ring, arrivalChime, doorSound } from '../Core/Audio.js';
import { ENTRANCE_INTRO } from '../Settings.js';
import { player } from '../Prefabs/Player.js';
import { resetAssembly } from '../FX/Assemble.js';

// Intro del nivel: dormido en el escritorio → suena el teléfono → "WAKE UP!" → despierta de golpe → se levanta.
// El movimiento del personaje es el clip "wake_up" (animator.html); aquí van los sucesos: timbre, silla y final.
// Si el nivel tiene ENTRADA: no hay escritorio; suena el ascensor, se abren las puertas, el jugador sale caminando
// y las puertas se cierran detrás (como si llegara del piso de arriba).
let rang = false, step = 0;

export function resetIntro(play) { G.intro = play ? 0 : -1; rang = false; step = 0; G.chairSlide = 0; G.entOpen = 0; resetAssembly(play); } // antes de la intro, el nivel se ensambla

// salida del ascensor: 0.3 ding · 0.6–1.2 se abren las puertas (el ascensor está vacío) · 1.3 aparece el jugador
// adentro (se materializa) · 1.6–2.8 sale caminando · 2.9–3.4 se cierran detrás
export const ENT_APPEAR = 1.3;
function updateEntranceIntro(dt) {
  const T = G.intro, N = G.ENT, k = Math.min(1, Math.max(0, (T - 1.6) / 1.2)), [fx, fy] = N.point(5.5, .5);
  if (step === 0 && T > .3) { step = 1; arrivalChime(); }
  if (step === 1 && T > .6) { step = 2; doorSound(); }
  if (step === 2 && T > 2.9) { step = 3; doorSound(); }
  G.entOpen = T < .6 ? 0 : T < 2.9 ? Math.min(1, (T - .6) / .6) : Math.max(0, 1 - (T - 2.9) / .5);
  Object.assign(player, { x: fx + (G.seat.x - fx) * k, y: fy + (G.seat.y - fy) * k, ang: N.ang, moving: k > 0 && k < 1 });
  if (T >= ENTRANCE_INTRO) finishIntro();
}

export function updateIntro(dt) {
  G.intro += dt; const T = G.intro;
  if (G.entOk) return updateEntranceIntro(dt);
  Object.assign(player, { x: G.seat.x, y: G.seat.y, ang: Math.PI / 2, moving: false });
  G.chairSlide = T > 2.7 ? 3 * ease(Math.min(1, (T - 2.7) / .5)) : 0;   // 2.7 s se levanta y empuja la silla
  if (!rang && T > .6) { rang = true; ring(); }                         // 0.6 s suena el teléfono
  if (T >= INTRO_TIME) finishIntro();
}

export function finishIntro() { G.intro = -1; G.chairSlide = 3; G.entOpen = 0; Object.assign(player, { x: G.seat.x, y: G.seat.y, ang: G.entOk ? G.ENT.ang : player.ang, moving: false }); }
