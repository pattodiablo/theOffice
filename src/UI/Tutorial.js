import { G } from '../Core/Game.js';
import { EDITOR } from '../Core/Constants.js';
import { tutorialDone, markTutorial } from '../Data/Progress.js';

// Tutorial de movimiento SIN palabras: solo dibujos animados, abajo al centro, al empezar a jugar.
//  · PC: teclas W A S D y flechas que se presionan en orden, y un puntito (el jugador) que se mueve igual.
//  · Celular: un dedo que toca la pantalla y arrastra el joystick virtual.
// Se elige solo (pantalla táctil o no) y cambia si el jugador usa la otra forma. Desaparece cuando ya caminaste un poco
// y no vuelve a salir (queda guardado en el progreso). Para verlo otra vez: ?tuto=1 en la dirección.
const FORCE = new URLSearchParams(location.search).has('tuto');
const MOVE_NEEDED = 10;                       // distancia que hay que caminar para darlo por aprendido
let el, on = false, walked = 0, last = null, touch = matchMedia('(pointer: coarse)').matches;

const key = (k, i) => `<span class="tk" style="--i:${i}">${k}</span>`;
const HAND = `<svg class="thand" viewBox="0 0 64 84" aria-hidden="true"><path d="M24 6a5.5 5.5 0 0 1 11 0v27h1.5a5 5 0 0 1 9.5 2v2a5 5 0 0 1 9 2v3a5 5 0 0 1 8.5 3v15c0 13-9 21-21 21h-5c-8 0-13-4-17-11L7 54a5.5 5.5 0 0 1 9-6l8 8z" fill="#fff" stroke="#06140c" stroke-width="3.5" stroke-linejoin="round"/></svg>`;

export function initTutorial() {
  el = document.createElement('div'); el.id = 'tut'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="tpc">
      <div class="tmini"><i class="tdot"></i></div>
      <div class="tkeys">
        <div class="tpad">${key('W', 0)}<br>${key('A', 3)}${key('S', 2)}${key('D', 1)}</div>
        <b class="tor">/</b>
        <div class="tpad">${key('▲', 0)}<br>${key('◀', 3)}${key('▼', 2)}${key('▶', 1)}</div>
      </div>
    </div>
    <div class="tmob">
      <div class="tmini"><i class="tdot"></i></div>
      <div class="tjoy"><i class="tring"></i><i class="tknob"></i><i class="tripple"></i>${HAND}</div>
    </div>`;
  document.body.append(el);
  addEventListener('keydown', e => { if (/^(Key[WASD]|Arrow)/.test(e.code)) setTouch(false); });
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch') setTouch(true); else if (e.pointerType === 'mouse') setTouch(false); });
  setTouch(touch);
}
function setTouch(t) { touch = t; el?.classList.toggle('touch', t); }

// cada frame jugando: aparece al terminar la intro y se va cuando caminaste MOVE_NEEDED
export function updateTutorial(p) {
  if (!el) return;
  const want = (FORCE || (!EDITOR && !tutorialDone())) && G.mode === 'play' && G.intro < 0 && !(G.asm >= 0);
  if (want) {
    if (last) walked += Math.hypot(p.x - last[0], p.y - last[1]);
    last = [p.x, p.y];
    if (walked >= MOVE_NEEDED) { if (!FORCE) markTutorial(); show(false); walked = -1e9; return; }
  } else last = null;
  show(want && walked >= 0);
}
function show(v) { if (v === on) return; on = v; el.classList.toggle('show', v); }
export function resetTutorialWalk() { walked = 0; last = null; }
