import { $, EDITOR } from '../Core/Constants.js';

// HUD (tiempo y barra con color de semáforo) y pantallas de inicio / final.
export function setTime(s) { $('#info').textContent = s.toFixed(1); }
export function setMeter(pct, rgb) { const i = $('#meter i'); i.style.width = pct + '%'; if (rgb) i.style.background = `rgb(${rgb})`; }

export function showScreen(html, { retry, edit, label = 'Retry' }) {
  $('#endCard').innerHTML = html + `<div class="row"><button class="on" id="again">${label}</button>${EDITOR ? '<button id="toEdit">Volver al editor</button>' : ''}</div>`;
  $('#endModal').hidden = false; $('#again').onclick = retry; if (EDITOR) $('#toEdit').onclick = edit; $('#again').focus();
}
export function hideScreen() { $('#endModal').hidden = true; }
