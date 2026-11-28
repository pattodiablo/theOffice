import { $, EDITOR } from '../Core/Constants.js';
import { G } from '../Core/Game.js';

// HUD (tiempo y barra con color de semáforo) y pantallas de inicio / final.
// tiempo del nivel: solo el número, abajo a la izquierda (segundos enteros; el tiempo exacto se guarda aparte)
export function setTime(s) { const t = Math.floor(s); if (setTime.t !== t) $('#timer').textContent = setTime.t = t; }
// arriba: el piso en el que estás y si ya tienes el fragmento de este piso (◆ lo tienes · ◇ todavía no)
let lastInfo = '';
export function updateHUDInfo() {
  const n = (G.levelName || '').match(/(\d+)$/), got = !!(G.gotCrystal || G.hadCrystal), key = G.levelName + got;
  if (key === lastInfo) return; lastInfo = key;
  $('#info').innerHTML = n ? `<small>FLOOR</small>${+n[1]}` : '<small>TEST</small>';
  const c = $('#crystals'); c.textContent = got ? '◆' : '◇'; c.classList.toggle('got', got);
}
export function setMeter(pct, rgb) { const i = $('#meter i'); i.style.width = pct + '%'; if (rgb) i.style.background = `rgb(${rgb})`; }

export function showScreen(html, { retry, edit, label = 'Retry' }) {
  $('#endCard').innerHTML = html + `<div class="row"><button class="on" id="again">${label}</button>${EDITOR ? '<button id="toEdit">Volver al editor</button>' : ''}</div>`;
  $('#endModal').hidden = false; $('#again').onclick = retry; if (EDITOR) $('#toEdit').onclick = edit; $('#again').focus();
}
export function hideScreen() { $('#endModal').hidden = true; }
