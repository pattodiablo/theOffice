import { CODE_RAIN } from '../Settings.js';

// Lluvia de código de fondo (canvas 2D detrás del 3D), a ~20 fps.
const RF = 16, GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789Z:.=*+<>';
let rain, ctx, drops = [], acc = 0;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

function resize() { rain.width = innerWidth; rain.height = innerHeight; drops = Array.from({ length: Math.ceil(innerWidth / RF) }, () => Math.random() * -60); }
export function initCodeRain() {
  rain = document.createElement('canvas'); rain.id = 'rain'; document.body.prepend(rain);
  ctx = rain.getContext('2d'); addEventListener('resize', resize); resize();
}

export function updateCodeRain(dt) {
  if (!CODE_RAIN || (still && acc < 0)) return;
  acc += dt; if (acc < .05) return; acc = still ? -1 : 0;   // con movimiento reducido se dibuja una sola vez
  ctx.fillStyle = 'rgba(2,10,5,.14)'; ctx.fillRect(0, 0, rain.width, rain.height);
  ctx.font = RF + 'px monospace';
  for (let i = 0; i < drops.length; i++) {
    ctx.fillStyle = Math.random() < .06 ? '#d8ffe4' : '#22c35e';
    ctx.fillText(GLYPHS[Math.random() * GLYPHS.length | 0], i * RF, drops[i] * RF);
    drops[i] = drops[i] * RF > rain.height && Math.random() > .97 ? 0 : drops[i] + 1;
  }
}
