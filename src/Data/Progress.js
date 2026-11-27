import { PORTAL, HATS } from '../Settings.js';
// Progreso del jugador (se guarda en el navegador): pisos terminados, mejor tiempo y cristales recogidos.
// Un cristal cuenta solo cuando terminas el piso con él (si te atrapan, vuelve a estar en su lugar).
const KEY = 'escape-oficina-progreso';
let P = { levels: {} };
try { P = JSON.parse(localStorage.getItem(KEY)) || P; P.levels ||= {}; } catch (e) {}
// cuántos cristales pide el portal: PORTAL.need, o si es 0, uno por cada piso que exista (main.js los cuenta al cargar)
let floors = 0;
export const setFloorCount = n => { floors = n; };
export const crystalsNeeded = () => PORTAL.need || floors || 1;
let testing = null;                                   // probando el final desde el editor: el progreso real guardado aparte
const save = () => { if (testing) return; try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };

export const levelInfo = name => P.levels[name] || null;
export const hasCrystal = name => !!(P.levels[name] && P.levels[name].crystal);
export const crystalCount = () => Object.values(P.levels).filter(l => l.crystal).length;
export const hasProgress = () => Object.keys(P.levels).length > 0;

// terminaste un piso. Devuelve las monedas ganadas (cada premio se cobra una sola vez por piso): [{ why, n }]
export function markDone(name, crystal, time, clean = false) {
  const l = P.levels[name] ||= { done: false, crystal: false, best: null };
  const got = [], C = HATS.coins, pay = (k, why, ok) => { if (ok && !(l.paid ||= {})[k] && C[k]) { l.paid[k] = true; got.push({ why, n: C[k] }); } };
  pay('done', 'FLOOR CLEARED', true); pay('crystal', 'REALITY FRAGMENT', crystal || l.crystal); pay('clean', 'NO ALARMS', clean);
  l.done = true; l.crystal ||= crystal; l.best = l.best == null ? time : Math.min(l.best, time);
  P.coins = coins() + got.reduce((s, g) => s + g.n, 0); save();
  return got;
}

// ---------- monedas y sombreros ----------
export const coins = () => P.coins ?? HATS.startCoins;
export const ownsHat = id => !!HATS.list.find(h => h.id === id && h.price <= 0) || (P.hats || []).includes(id);
export const equippedHat = () => (P.hat && ownsHat(P.hat) ? P.hat : null);
export function equipHat(id) { P.hat = id; save(); }
// tutorial de movimiento (UI/Tutorial.js): se muestra hasta que caminas la primera vez
export const tutorialDone = () => !!P.tut;
export function markTutorial() { P.tut = true; save(); }
export function buyHat(id) {
  const h = HATS.list.find(h => h.id === id); if (!h || ownsHat(id) || coins() < h.price) return false;
  P.coins = coins() - h.price; (P.hats ||= []).push(id); P.hat = id; save(); return true;
}
// el piso n (1, 2, 3…) está abierto si es el primero o si terminaste el anterior
export const unlocked = (prefix, n) => n <= 1 || !!(P.levels[prefix + (n - 1)] && P.levels[prefix + (n - 1)].done);
// el primer piso sin terminar (para retomar donde quedaste)
// juego completo: todos los pisos terminados y todos los cristales → falta echarlos al portal del piso 1
export const allCollected = (prefix, count) => crystalCount() >= crystalsNeeded() && Array.from({ length: count }, (_, i) => P.levels[prefix + (i + 1)]).every(l => l && l.done);
// el primer piso sin terminar (para retomar donde quedaste). Con todo completo: el piso 1, para terminar el juego en el portal
export function nextToPlay(prefix, count) {
  if (allCollected(prefix, count)) return prefix + 1;
  for (let n = 1; n <= count; n++) if (!(P.levels[prefix + n] && P.levels[prefix + n].done)) return prefix + n;
  return prefix + count;
}
// cristales que ya echaste al contenedor del portal de realidad (nunca más que los que juntaste)
export const depositedCount = () => Math.min(P.deposited || 0, crystalCount() + 1);   // +1: el cristal del piso que estás jugando se puede echar antes de terminarlo
export function depositOne(max = crystalCount()) { P.deposited = Math.min((P.deposited || 0) + 1, max); save(); }
// la intro "soñando" se ve una sola vez (Borrar datos la vuelve a mostrar)
export const introSeen = () => !!P.intro;
export function markIntroSeen() { P.intro = true; save(); }
export function resetProgress() { stopEndingTest(); P = { levels: {} }; save(); }

// editor › "Probar final": progreso de mentira con todos los cristales (sin echar al contenedor). No se guarda;
// al volver al editor se recupera el progreso real.
export function startEndingTest(prefix = 'piso') {
  if (!testing) testing = P;
  P = { levels: {}, deposited: 0, coins: testing.coins, hats: testing.hats, hat: testing.hat };
  for (let n = 1; n <= crystalsNeeded(); n++) P.levels[prefix + n] = { done: true, crystal: true, best: null };
}
export function stopEndingTest() { if (testing) { P = testing; testing = null; } }
