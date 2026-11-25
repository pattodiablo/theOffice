import { Z } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { PLAYER_SPEED, GLITCH_TIME, GLITCH_COOLDOWN, STEP_VOLUME, STEP_TIME, ANIM_SPEED, JUICE } from '../Settings.js';
import { dust } from '../FX/Particles.js';
import { footstep } from '../Core/Audio.js';
import { makeCharacter } from './Character.js';
import { ENT_APPEAR } from '../Animations/IntroAnimation.js';
import { pose, poseClip } from '../Animations/CharacterPoses.js';
import { free } from '../World/Grid.js';
import { turnTo } from '../Core/MathUtils.js';
import { keys, joy } from '../Core/Input.js';

// Jugador (el oficinista): movimiento y glitch.
export const player = { ch: null, x: 0, y: 0, ang: Math.PI / 4, moving: false, stepT: 0, vx: 0, vy: 0 }; // vx, vy: velocidad (la usan los agentes rojos para adelantarse)
export function initPlayer(scene) { player.ch = makeCharacter(scene, false); }

export function doGlitch() { if (G.mode !== 'play' || G.cool > 0) return; G.frozen = GLITCH_TIME; G.cool = GLITCH_COOLDOWN; G.usedGlitch = true; }

// teclado o joystick → movimiento en diagonal isométrica (arriba en pantalla = hacia el fondo)
export function movePlayer(dt) {
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let iy = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y;
  const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
  const mx = (ix - iy) * Math.SQRT1_2, my = (ix + iy) * Math.SQRT1_2;
  player.moving = il > .15;
  const ox = player.x, oy = player.y;
  if (!player.moving) { player.stepT = 0; player.vx *= .8; player.vy *= .8; return; }
  if ((player.stepT -= dt) <= 0) {                               // pasos
    player.stepT = STEP_TIME;
    if (STEP_VOLUME) footstep(.11 * STEP_VOLUME, 0, 1);
    if (JUICE.on && JUICE.dust && !G.hiddenKind) dust(player.x, player.y);   // polvito en cada paso
  }
  const sp = PLAYER_SPEED * dt;
  if (free(player.x + mx * sp, player.y)) player.x += mx * sp;   // ejes por separado: se desliza por las paredes
  if (free(player.x, player.y + my * sp)) player.y += my * sp;
  turnTo(player, Math.atan2(my, mx), dt * 14);
  const k = Math.min(1, dt * 8); player.vx += ((player.x - ox) / dt - player.vx) * k; player.vy += ((player.y - oy) / dt - player.vy) * k;
}

// sentado (editor e intro) o caminando
export function animatePlayer() {
  const r = player.ch.root;
  if (G.entOk && G.mode === 'edit') { r.visible = true; r.scale.setScalar(1); pose(player.ch, G.seat.x, G.seat.y, G.ENT.ang, G.t, false); } // con entrada: de pie frente a la puerta
  else if (G.entOk && G.intro >= 0) {                                                                              // saliendo del ascensor
    const s = Math.min(1, Math.max(0, (G.intro - ENT_APPEAR) / .25));                                              // aparece cuando ya se abrieron las puertas
    r.visible = s > 0; pose(player.ch, player.x, player.y, player.ang, G.t, player.moving); r.scale.set(1 + (1 - s) * .6, s, 1 + (1 - s) * .6);
  }
  else if (G.intro >= 0 || G.mode === 'edit') poseClip(player.ch, G.seat.x, G.seat.y, Math.PI / 2, 'wake_up', Math.max(0, G.intro)); // en el editor: dormido
  else pose(player.ch, player.x, player.y, player.ang, G.t * ANIM_SPEED, (G.mode === 'play' || G.mode === 'exit') && player.moving);
}
