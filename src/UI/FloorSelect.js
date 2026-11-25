import { EDITOR, $ } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { loadLevelNamed, nextLevelName, countLevels, prefetchLevel } from '../Data/LevelIO.js';
import { levelInfo, unlocked, crystalCount, hasCrystal } from '../Data/Progress.js';
import { PORTAL } from '../Settings.js';
import { rebuild } from '../Scenes/Level.js';
import { setMode } from '../Scenes/GameScene.js';

// Panel del ascensor: elegir piso. Muestra los pisos (1 = el primero que juegas), cuáles están abiertos,
// si ya tienes su cristal y tu mejor tiempo. Se abre con el botón ☰ del HUD o desde el ascensor del final.
let el, prevMode = null;
const prefix = () => (G.levelName.match(/^(.*?)\d+$/) || [0, 'piso'])[1];

export function initFloorSelect() {
  el = document.createElement('div'); el.id = 'floors'; el.className = 'modal'; el.hidden = true;
  el.innerHTML = `<div class="card"><h2>ELEVATOR</h2><p class="fsub"></p><div class="fgrid"></div><div class="row"><button id="floorsClose">Back</button></div></div>`;
  document.body.append(el);
  $('#floorsClose').addEventListener('click', closeFloors);
  addEventListener('keydown', e => { if (!el.hidden && e.code === 'Escape') closeFloors(); });
}

export async function openFloors() {
  if (EDITOR || !el.hidden) return;
  prevMode = G.mode; if (G.mode === 'play') G.mode = 'menu';            // pausa mientras está abierto
  const pre = prefix(), count = await countLevels(pre + '1');
  el.querySelector('.fsub').textContent = `◆ ${crystalCount()} / ${PORTAL.need} reality fragments`;
  el.querySelector('.fgrid').innerHTML = Array.from({ length: count }, (_, i) => {
    const n = i + 1, name = pre + n, info = levelInfo(name), open = unlocked(pre, n), cur = name === G.levelName;
    return `<button data-lv="${name}" ${open ? '' : 'disabled'} class="${cur ? 'cur' : ''} ${info && info.done ? 'done' : ''}">
      <b>${open ? n : '🔒'}</b><i class="${hasCrystal(name) ? 'got' : ''}">◆</i><small>${info && info.best != null ? info.best.toFixed(1) + 's' : ''}</small></button>`;
  }).join('');
  el.querySelectorAll('[data-lv]').forEach(b => b.addEventListener('click', () => { el.hidden = true; goToLevel(b.dataset.lv); }));
  el.hidden = false;
}
export function closeFloors() { if (el.hidden) return; el.hidden = true; if (G.mode === 'menu') G.mode = prevMode === 'menu' ? 'play' : prevMode; }

// carga un piso y empieza a jugarlo
export async function goToLevel(name) {
  const lvl = await loadLevelNamed(name); if (!lvl) return;
  G.level = lvl; G.levelName = name;
  try { history.replaceState(null, '', `?nivel=${name}`); } catch (e) {}
  rebuild(); setMode('play'); prefetchLevel(nextLevelName(name));
}
