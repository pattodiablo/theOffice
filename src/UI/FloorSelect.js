import { EDITOR, $ } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { loadLevelNamed, nextLevelName, countLevels, prefetchLevel } from '../Data/LevelIO.js';
import { levelInfo, unlocked, crystalCount, hasCrystal, crystalsNeeded, coins } from '../Data/Progress.js';
import { PORTAL } from '../Settings.js';
import { tickSound } from '../Core/Audio.js';
import { rebuild } from '../Scenes/Level.js';
import { pokiBreak, pokiBusy } from '../Core/Poki.js';
import { setMode } from '../Scenes/GameScene.js';
import { makeShop, resetShop, COIN } from './HatShop.js';

// Selector de pisos tipo "dial": una columna de pisos a la izquierda que se mueve con ▲/▼, la rueda del mouse,
// las flechas / W-S del teclado o arrastrando con el dedo (se acomoda solo en el piso más cercano).
// El piso elegido queda en una franja verde con el botón PLAY FLOOR.
//   · verde = sin jugar · gris = ya jugado · candado = todavía cerrado
//   · ◆ celeste = tienes su fragmento de realidad · ◇ blanco = te falta
// Se usa en dos lugares: en el ascensor del final (sobre la animación) y en el menú ☰ del HUD (con el juego en pausa).

let dial, list, band, playB, items = [], floors = [], pos = 0, target = 0, active = false, onPlay = null, raf = 0, ROW = 64, lastTick = 0;
let drag = null;
let menuEl, prevMode = null;
const prefix = () => (G.levelName.match(/^(.*?)\d+$/) || [0, 'piso'])[1];
const clampI = i => Math.max(0, Math.min(floors.length - 1, i));

function buildDial() {
  dial = document.createElement('div'); dial.className = 'dial';
  dial.innerHTML = `<div class="dband"><button class="dplay">PLAY FLOOR ▶</button></div>
    <div class="dlist"></div>
    <button class="darrow dup" aria-label="Previous floor">▲</button><button class="darrow ddown" aria-label="Next floor">▼</button>`;
  dial.append(makeShop(() => document.querySelectorAll('.scoins').forEach(e => { e.innerHTML = coins() + COIN; e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); })));
  list = dial.querySelector('.dlist'); band = dial.querySelector('.dband'); playB = dial.querySelector('.dplay');
  dial.querySelector('.dup').addEventListener('click', () => step(-1));
  dial.querySelector('.ddown').addEventListener('click', () => step(1));
  playB.addEventListener('click', play);
  dial.addEventListener('wheel', e => { e.preventDefault(); if (Math.abs(e.deltaY) > 4) step(Math.sign(e.deltaY)); }, { passive: false });

  // arrastre tipo dial (dedo o mouse) sobre la columna
  list.addEventListener('pointerdown', e => {
    drag = { y: e.clientY, p: pos, t: performance.now(), v: 0, moved: false, id: e.pointerId, ly: e.clientY, lt: performance.now() };
    list.setPointerCapture(e.pointerId);
  });
  list.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y; if (Math.abs(dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    const now = performance.now(), dt = Math.max(1, now - drag.lt);
    drag.v = drag.v * .6 + (-(e.clientY - drag.ly) / ROW / dt * 1000) * .4; drag.ly = e.clientY; drag.lt = now;
    pos = Math.max(-.4, Math.min(floors.length - .6, drag.p - dy / ROW)); target = clampI(Math.round(pos));
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) target = clampI(Math.round(pos + drag.v * .12));          // inercia corta y se acomoda
    else {                                                                    // toque: elegir ese piso (o jugarlo si ya era el elegido)
      const it = document.elementFromPoint(e.clientX, e.clientY)?.closest('.dial [data-i]');   // con pointer capture e.target es la lista
      if (it) { const i = +it.dataset.i; if (i === target) play(); else target = i; }
    }
    drag = null;
  };
  list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end);

  addEventListener('keydown', e => {
    if (!active) return;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); step(-1); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); step(1); }
    else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); play(); }
  });
  addEventListener('resize', () => { if (active) measure(); });
}

function step(d) { target = clampI(target + d); }
function measure() { ROW = innerHeight < 560 ? 46 : innerHeight < 760 ? 56 : 66; dial.style.setProperty('--row', ROW + 'px'); }

function play() {
  const f = floors[target]; if (!f || !f.open || !onPlay) return;
  const cb = onPlay; hideDial(); cb(f.name);
}

function frame() {
  if (!active) return;
  raf = requestAnimationFrame(frame);
  if (!drag) pos += (target - pos) * .22;
  if (Math.abs(target - pos) < .002) pos = target;
  const r = Math.round(pos); if (r !== lastTick) { lastTick = r; tickSound(); updateBand(); }
  for (let i = 0; i < items.length; i++) {
    const d = i - pos, ad = Math.abs(d);
    const s = items[i].style;
    if (ad > 4.5) { s.visibility = 'hidden'; continue; }
    s.visibility = '';
    s.transform = `translateY(${(d * ROW).toFixed(1)}px) scale(${(1 - Math.min(ad, 3) * .07).toFixed(3)})`;
    s.opacity = Math.max(0, 1 - ad / 4).toFixed(2);
    items[i].classList.toggle('sel', ad < .5);
  }
}

function updateBand() {
  const f = floors[clampI(Math.round(pos))]; if (!f) return;
  band.classList.toggle('done', f.done); band.classList.toggle('locked', !f.open);
  playB.disabled = !f.open; playB.textContent = f.open ? (f.done ? 'REPLAY FLOOR ▶' : 'PLAY FLOOR ▶') : 'LOCKED';
}

// muestra el dial dentro de `host`, con `sel` elegido; al jugar llama cb(nombreDelNivel)
export async function showDial(host, sel, cb) {
  if (!dial) buildDial();
  const pre = prefix(), count = await countLevels(pre + '1');
  floors = Array.from({ length: count }, (_, i) => {
    const n = i + 1, name = pre + n, info = levelInfo(name);
    return { n, name, open: unlocked(pre, n), done: !!(info && info.done), crystal: hasCrystal(name), best: info && info.best };
  });
  list.innerHTML = floors.map((f, i) => `<button class="ditem${f.done ? ' done' : ''}${f.open ? '' : ' locked'}" data-i="${i}" tabindex="-1">
      <i class="${f.crystal ? 'got' : ''}">${f.crystal ? '◆' : '◇'}</i><b>${f.open ? f.n : '🔒'}</b></button>`).join('');
  items = [...list.children];
  let i = floors.findIndex(f => f.name === sel); if (i < 0) i = floors.findIndex(f => f.name === G.levelName);
  target = clampI(i < 0 ? 0 : i); if (!floors[target].open) target = clampI(floors.filter(f => f.open).length - 1);
  pos = target; lastTick = target;
  onPlay = cb; host.append(dial); measure(); updateBand(); resetShop();
  active = true; cancelAnimationFrame(raf); frame();
}
export function hideDial() { active = false; onPlay = null; cancelAnimationFrame(raf); dial?.remove(); }

// ---------- menú ☰ (pausa) ----------
export function initFloorSelect() {
  menuEl = document.createElement('div'); menuEl.id = 'floors'; menuEl.hidden = true;
  menuEl.innerHTML = `<div class="ftop"><h2 class="dtitle">ELEVATOR</h2><p class="fsub"></p></div><div class="dslot"></div>
    <button id="floorsClose" aria-label="Close">✕</button>`;
  document.body.append(menuEl);
  $('#floorsClose').addEventListener('click', closeFloors);
  addEventListener('keydown', e => { if (!menuEl.hidden && e.code === 'Escape') closeFloors(); });
}

// subtítulo del ascensor (va con innerHTML): fragmentos y monedas
export const fragmentsText = () => `◆ ${crystalCount()} / ${crystalsNeeded()} reality fragments<span class="scoins">${coins()}${COIN}</span>`;

export async function openFloors() {
  if (EDITOR || !menuEl.hidden || G.mode === 'exit') return;
  prevMode = G.mode; if (G.mode === 'play') G.mode = 'menu';            // pausa mientras está abierto
  menuEl.querySelector('.fsub').innerHTML = fragmentsText();
  menuEl.hidden = false;
  await showDial(menuEl.querySelector('.dslot'), G.levelName, name => { menuEl.hidden = true; goToLevel(name); });
}
export function closeFloors() {
  if (menuEl.hidden) return; menuEl.hidden = true; hideDial();
  if (G.mode === 'menu') G.mode = prevMode === 'menu' ? 'play' : prevMode;
}

// carga un piso y empieza a jugarlo
export async function goToLevel(name) {
  if (pokiBusy()) return; await pokiBreak();          // Poki: anuncio antes de volver a jugar
  const lvl = await loadLevelNamed(name); if (!lvl) return;
  G.level = lvl; G.levelName = name;
  try { history.replaceState(null, '', `?nivel=${name}`); } catch (e) {}
  rebuild(); setMode('play'); prefetchLevel(nextLevelName(name));
}
