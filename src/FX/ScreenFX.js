import { $ } from '../Core/Constants.js';
import { GREEN_TINT } from '../Settings.js';

// Efectos de pantalla (capas HTML sobre el 3D): tinte verde, viñeta, borde de alarma y efecto del glitch.
export function initScreenFX() {
  const tint = document.createElement('div'); tint.id = 'tint'; tint.style.opacity = GREEN_TINT; document.body.append(tint);
  const vignette = document.createElement('div'); vignette.id = 'vignette'; document.body.append(vignette);
}
// borde de pantalla del color del semáforo; level 0..1
export function setAlarm(level, rgb) { $('#alarm').style.boxShadow = level ? `inset 0 0 ${level * 80}px ${level * 14}px rgba(${rgb},${level * .55})` : ''; }
export function setGlitchFX(on) { $('#fx').style.opacity = on ? 1 : 0; }
