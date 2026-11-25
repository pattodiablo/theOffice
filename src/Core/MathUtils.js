export const ease = k => k * k * (3 - 2 * k);              // suavizado 0..1
export const mix = (a, b, k) => a + (b - a) * k;
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)); // ángulo a -π..π
export function turnTo(o, ang, k) { o.ang += wrap(ang - o.ang) * Math.min(1, k); }
// escala de "aparecer con rebote": 0 → 1 en `dur` segundos pasando un poco de 1
export const popScale = (t, dur, amt) => t < dur ? (t / dur) * (1 + amt * Math.sin(t / dur * Math.PI)) : 1;
