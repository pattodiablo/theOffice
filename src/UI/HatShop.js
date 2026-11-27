import { pokiMeasure } from '../Core/Poki.js';
import { HATS } from '../Settings.js';
import { coins, ownsHat, equippedHat, equipHat, buyHat } from '../Data/Progress.js';
import { hatPreview, hatReady, refreshHats } from '../Prefabs/Hats.js';
import { crystalSound, tickSound, beeBonkSound } from '../Core/Audio.js';
import { haptic } from '../FX/Juice.js';

// Tienda de sombreros: una fila de cartas inclinadas debajo de la franja del dial de pisos (ascensor y menú ☰).
// Arriba de cada carta: el precio en monedas, o OWNED / ON si ya es tuyo / lo llevas puesto.
// Tocar una carta: si es tuya, te la pones (o te la quitas); si no, la compras (si te alcanza) y te la pones.

export const COIN = `<svg class="coin" viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="18.5" rx="14" ry="11" fill="#1f6b36"/><ellipse cx="16" cy="15" rx="14" ry="11" fill="#3be07c"/><ellipse cx="16" cy="15" rx="10.5" ry="8" fill="#2aa85a"/><path d="M20.2 11.4a6 5 0 1 0 0 7.2" fill="none" stroke="#c9ffd9" stroke-width="2.6" stroke-linecap="round"/></svg>`;

let el, row, msg, start = 0, onChange = null, msgT = 0;
const list = () => HATS.list.filter(h => hatReady(h.id));
const perPage = () => {
  const w = el?.clientWidth || 600, vw = innerWidth, small = vw <= 600;
  const card = small ? Math.max(84, Math.min(120, vw * .27)) : Math.max(110, Math.min(190, vw * .16)), gap = small ? 10 : Math.max(10, Math.min(26, vw * .022));
  return Math.max(1, Math.min(5, Math.floor((w - (small ? 60 : 100) + gap) / (card + gap))));
};

export function makeShop(changed) {
  onChange = changed;
  el = document.createElement('div'); el.className = 'dshop';
  el.innerHTML = `<button class="sarrow sprev" aria-label="Previous hats">◀</button><div class="srow"></div><button class="sarrow snext" aria-label="More hats">▶</button><p class="smsg"></p>`;
  row = el.querySelector('.srow'); msg = el.querySelector('.smsg');
  el.querySelector('.sprev').addEventListener('click', () => page(-1));
  el.querySelector('.snext').addEventListener('click', () => page(1));
  row.addEventListener('click', e => { const c = e.target.closest('[data-hat]'); if (c) pick(c.dataset.hat, c); });
  addEventListener('resize', () => el.isConnected && render());
  return el;
}

function page(d) { render.moved = true; const n = perPage(), L = list().length; start = Math.max(0, Math.min(Math.max(0, L - n), start + d * n)); tickSound(); render(); }

function say(t, bad) { msg.textContent = t; msg.classList.toggle('bad', !!bad); msg.classList.add('show'); clearTimeout(msgT); msgT = setTimeout(() => msg.classList.remove('show'), 1600); }

function pick(id, card) {
  const h = HATS.list.find(h => h.id === id);
  if (ownsHat(id)) { const on = equippedHat() === id; equipHat(on ? null : id); tickSound(); say(on ? 'HAT OFF' : h.name.toUpperCase() + ' ON'); }
  else if (buyHat(id)) { pokiMeasure('shop', id, 'purchased'); crystalSound(); haptic(30); say('BOUGHT ' + h.name.toUpperCase() + '!'); card.classList.add('bought'); }
  else { beeBonkSound(); haptic([15, 40, 15]); card.classList.remove('nope'); void card.offsetWidth; card.classList.add('nope'); say(`NEED ${h.price - coins()} MORE`, true); }
  refreshHats(); render(); onChange?.();
}

export function resetShop() { render.moved = false; render(); }
// vuelve a dibujar
export function render() {
  if (!el) return;
  const L = list(), n = perPage(), eq = equippedHat(), c = coins();
  if (!L.length) { el.hidden = true; return; } el.hidden = false;
  const i = L.findIndex(h => h.id === eq); if (i >= 0 && (i < start || i >= start + n) && !render.moved) start = Math.floor(i / n) * n;
  start = Math.max(0, Math.min(start, Math.max(0, L.length - n)));
  row.innerHTML = L.slice(start, start + n).map(h => {
    const own = ownsHat(h.id), on = eq === h.id;
    const tag = on ? `<b class="sown on">ON ✓</b>` : own ? `<b class="sown">OWNED</b>` : `<b class="sprice${c < h.price ? ' poor' : ''}">${h.price}${COIN}</b>`;
    return `<div class="scard-wrap">${tag}<button class="scard${on ? ' on' : ''}${own ? ' own' : ''}" data-hat="${h.id}" title="${h.name}"><img src="${hatPreview(h.id)}" alt="${h.name}"></button></div>`;
  }).join('');
  el.querySelector('.sprev').disabled = start <= 0; el.querySelector('.snext').disabled = start + n >= L.length;
}
