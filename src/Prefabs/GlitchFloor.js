import * as THREE from 'three';
import { Z, TILE } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { GLITCH_FLOOR as GF } from '../Settings.js';
import { popText } from '../FX/Juice.js';

// Piso glitch (level.glitch = { tiles: [[i, j], …], pattern, speed }, se pinta en el editor › Nivel › Piso glitch).
// Las baldosas inestables tienen un ciclo: sólida (borde verde tenue) → parpadea (aviso) → desaparece (hueco negro
// con código verde cayendo) → vuelve. Si estás parado encima cuando desaparece, caes en la Matrix: te atrapan.
// Patrones: 'all' todas a la vez · 'wave' una ola que avanza en diagonal · 'checker' se alternan como un tablero.
// Los agentes caminan encima sin problema (son parte del sistema). El glitch del jugador (Espacio) las deja sólidas.
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `
uniform float uMode, uK, uT, uSeed; varying vec2 vUv;
float h(float n){ return fract(sin(n * 91.7 + uSeed * 13.1) * 43758.5); }
void main(){
  vec2 uv = vUv; float edge = min(min(uv.x, 1. - uv.x), min(uv.y, 1. - uv.y));
  vec3 g = vec3(.23, .88, .49); vec3 col; float a;
  if (uMode < .5) {                                    // sólida: solo el borde brilla un poco
    a = smoothstep(.11, 0., edge) * (.35 + .15 * sin(uT * 3. + uSeed));
    col = g;
  } else if (uMode < 1.5) {                            // aviso: parpadea cada vez más rápido, con líneas
    float fl = step(.5, fract(uT * (8. + 14. * uK)));
    a = (.25 + .4 * fl) * (.7 + .3 * step(.5, fract(uv.y * 10. + uT * 4.))) + smoothstep(.12, 0., edge) * .6;
    col = mix(g, vec3(1.), .25 * fl);
  } else {                                             // hueco: negro con código verde cayendo
    float c = floor(uv.x * 6.), s = fract(uv.y * 1.6 + uT * (1.2 + h(c) * 1.8) + h(c + 7.));
    float glyph = step(.5, fract(uv.y * 14.)) * step(.25, fract(uv.x * 6.)) * step(fract(uv.x * 6.), .75);
    col = g * smoothstep(.55, 1., s) * (.5 + .5 * glyph) + vec3(.8, 1., .9) * step(.985, s) * glyph;
    col *= smoothstep(0., .18, edge) * .8 + .2;        // bordes más oscuros: se siente hondo
    a = 1.;
  }
  gl_FragColor = vec4(col, a);
}`;
let group, geo, tiles = [], t = 0;

export function initGlitchFloor(scene) {
  group = new THREE.Group(); scene.add(group);
  geo = new THREE.PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2);
}

const period = () => GF.period / Math.max(.2, G.level.glitch?.speed || 1);
function phaseOf(i, j, P) {
  const pat = G.level.glitch?.pattern || 'all';
  return pat === 'wave' ? (i + j) * GF.waveStep : pat === 'checker' ? ((i + j) % 2) * P / 2 : 0;
}

export function syncGlitchFloor() {
  for (const g of tiles) g.mesh.material.dispose();
  group.clear(); tiles = [];
  for (const [i, j] of G.level.glitch?.tiles || []) {
    if (G.level.floor[j]?.[i] === undefined || G.level.floor[j][i] === '0') continue;   // ahí ya no hay piso
    const uni = { uMode: { value: 0 }, uK: { value: 0 }, uT: { value: 0 }, uSeed: { value: Math.random() * 10 } };
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false }));
    mesh.position.set(i * TILE + TILE / 2, Z + .08, -(j * TILE + TILE / 2)); mesh.renderOrder = 1; group.add(mesh);
    tiles.push({ i, j, mesh, uni, st: 0 });
  }
  resetGlitchFloor();
}
export function resetGlitchFloor() { t = 0; }

// estado de una baldosa: 0 sólida · 1 aviso · 2 hueco; k = avance dentro de ese estado (0..1)
function stateOf(g) {
  const P = period(), u = (((t + phaseOf(g.i, g.j, P)) % P) + P) % P / P;
  if (u < GF.solid) return [0, u / GF.solid];
  if (u < GF.solid + GF.warn) return [1, (u - GF.solid) / GF.warn];
  return [2, (u - GF.solid - GF.warn) / (1 - GF.solid - GF.warn)];
}

// lógica (jugando): devuelve true si el jugador cayó por un hueco
export function updateGlitchFloor(dt, p) {
  if (!tiles.length) return false;
  if (G.frozen <= 0) t += dt;                          // el glitch del jugador congela el ciclo (y las deja sólidas)
  const pi = Math.floor(p.x / TILE), pj = Math.floor(p.y / TILE);
  let fell = false;
  for (const g of tiles) {
    const [st] = G.frozen > 0 ? [0] : stateOf(g);
    g.st = st;
    if (st === 2 && g.i === pi && g.j === pj) fell = true;
  }
  if (fell) popText(p.x, p.y, 'FELL INTO THE CODE', 'red');   // sin sonido propio (a pedido)
  return fell;
}

// visual (cada frame)
export function animateGlitchFloor(dt) {
  const edit = G.mode === 'edit';
  group.visible = !(G.asm >= 0);
  for (const g of tiles) {
    let st, k;
    if (edit) { st = 1; k = 0; }                       // en el editor: se ven marcadas
    else if (G.frozen > 0 || (G.mode !== 'play' && G.mode !== 'caught' && G.mode !== 'over')) [st, k] = [0, 0];
    else [st, k] = stateOf(g);
    g.uni.uMode.value = st; g.uni.uK.value = k; g.uni.uT.value = G.t;
  }
}
