import * as THREE from 'three';

// Texturas de brillo dibujadas en canvas (las usan el cristal y la caja fuerte que lo guarda).
// textura de brillo radial (para el halo, los destellos y el haz)
export function glowTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
export function starTex() {   // destello de 4 puntas
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 10); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(160,240,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#fff'; for (const [w, h] of [[3, 60], [60, 3]]) { x.globalAlpha = .9; x.fillRect(32 - w / 2, 32 - h / 2, w, h); }
  return new THREE.CanvasTexture(c);
}
export function beamTex() {   // haz vertical: fuerte abajo, se desvanece hacia arriba y en los bordes
  const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d');
  const v = x.createLinearGradient(0, 128, 0, 0); v.addColorStop(0, 'rgba(190,245,255,1)'); v.addColorStop(.35, 'rgba(120,220,255,.5)'); v.addColorStop(1, 'rgba(120,220,255,0)');
  x.fillStyle = v; x.fillRect(0, 0, 32, 128);
  x.globalCompositeOperation = 'destination-in';
  const h = x.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(.5, '#000'); h.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = h; x.fillRect(0, 0, 32, 128); return new THREE.CanvasTexture(c);
}
