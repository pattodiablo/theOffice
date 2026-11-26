import { PORTAL } from '../Settings.js';
// Progreso del jugador (se guarda en el navegador): pisos terminados, mejor tiempo y cristales recogidos.
// Un cristal cuenta solo cuando terminas el piso con él (si te atrapan, vuelve a estar en su lugar).
const KEY = 'escape-oficina-progreso';
let P = { levels: {} };
try { P = JSON.parse(localStorage.getItem(KEY)) || P; P.levels ||= {}; } catch (e) {}
// cuántos cristales pide el portal: PORTAL.need, o si es 0, uno por cada piso que exista (main.js los cuenta al cargar)
let floors = 0;
export const setFloorCount = n => { floors = n; };
export const crystalsNeeded = () => PORTAL.need || floors || 1;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };

export const levelInfo = name => P.levels[name] || null;
export const hasCrystal = name => !!(P.levels[name] && P.levels[name].crystal);
export const crystalCount = () => Object.values(P.levels).filter(l => l.crystal).length;
export const hasProgress = () => Object.keys(P.levels).length > 0;

// terminaste un piso
export function markDone(name, crystal, time) {
  const l = P.levels[name] ||= { done: false, crystal: false, best: null };
  l.done = true; l.crystal ||= crystal; l.best = l.best == null ? time : Math.min(l.best, time); save();
}
// el piso n (1, 2, 3…) está abierto si es el primero o si terminaste el anterior
export const unlocked = (prefix, n) => n <= 1 || !!(P.levels[prefix + (n - 1)] && P.levels[prefix + (n - 1)].done);
// el primer piso sin terminar (para retomar donde quedaste)
export function nextToPlay(prefix, count) { for (let n = 1; n <= count; n++) if (!(P.levels[prefix + n] && P.levels[prefix + n].done)) return prefix + n; return prefix + count; }
// cristales que ya echaste al contenedor del portal de realidad (nunca más que los que juntaste)
export const depositedCount = () => Math.min(P.deposited || 0, crystalCount() + 1);   // +1: el cristal del piso que estás jugando se puede echar antes de terminarlo
export function depositOne(max = crystalCount()) { P.deposited = Math.min((P.deposited || 0) + 1, max); save(); }
export function resetProgress() { P = { levels: {} }; save(); }
