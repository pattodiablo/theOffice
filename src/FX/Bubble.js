import * as THREE from 'three';
import { Z, $ } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { INTRO_TIME } from '../Settings.js';
import { popScale } from '../Core/MathUtils.js';

// Globo de cómic "WAKE UP!" (elemento HTML #bubble) que sigue la cabeza del jugador durante la intro.
const v = new THREE.Vector3();
export function updateBubble(cam, stage) {
  const bub = $('#bubble'); if (!bub) return;
  const bt = G.intro - 1;                       // aparece al segundo 1
  if (G.mode !== 'play' || G.intro < 0 || bt < 0 || G.entOk) { bub.style.opacity = 0; return; }   // con entrada no hay "WAKE UP!"
  v.set(G.seat.x, Z + 21, -G.seat.y).project(cam);
  bub.style.left = ((v.x + 1) / 2 * stage.clientWidth) + 'px'; bub.style.top = ((1 - v.y) / 2 * stage.clientHeight) + 'px';
  bub.style.transform = `translate(-26px, -100%) scale(${popScale(bt, .25, .4)})`;
  bub.style.opacity = G.intro > INTRO_TIME - .3 ? (INTRO_TIME - G.intro) / .3 : 1;
}
