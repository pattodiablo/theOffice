import { $ } from './Constants.js';
import { G } from './Game.js';
import { stage } from './Engine.js';

// Entrada: teclas apretadas y joystick táctil (aparece donde tocas la pantalla).
export const keys = {};
export const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };

export function initInput() {
  addEventListener('keydown', e => { if (e.target.tagName !== 'TEXTAREA') keys[e.code] = true; });
  addEventListener('keyup', e => keys[e.code] = false);
  const el = $('#joy'), knob = $('#joy b');
  stage.addEventListener('pointerdown', e => {
    if (G.mode !== 'play' || G.intro >= 0 || joy.id !== null) return;
    Object.assign(joy, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
    el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px'; el.style.display = 'block'; stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), m = 46;
    if (l > m) { dx *= m / l; dy *= m / l; }
    joy.x = dx / m; joy.y = -dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const end = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; el.style.display = 'none'; knob.style.transform = ''; };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
}
