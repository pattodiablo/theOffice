import * as THREE from 'three';
import { EDITOR, $ } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { WAKE_MESSAGES } from '../Settings.js';
import { markDone, allCollected } from '../Data/Progress.js';
import { showDial, hideDial, fragmentsText } from '../UI/FloorSelect.js';
import { COIN } from '../UI/HatShop.js';
import { renderer, stage, CAM_OFF } from '../Core/Engine.js';
import { makeCharacter, box } from '../Prefabs/Character.js';
import { wearHat } from '../Prefabs/Hats.js';
import { poseClip } from '../Animations/CharacterPoses.js';
import { player } from '../Prefabs/Player.js';
import { ease } from '../Core/MathUtils.js';
import { winJingle } from '../Core/Audio.js';
import { setAlarm, setGlitchFX } from '../FX/ScreenFX.js';
import { loadLevelNamed, nextLevelName, levelNumber, countLevels, prefetchLevel } from '../Data/LevelIO.js';
import { rebuild } from './Level.js';
import { setMode } from './GameScene.js';
import { pokiBreak } from '../Core/Poki.js';
import { haptic } from '../FX/Juice.js';

// Escena de salida: el jugador entra por la puerta, la oficina se funde a negro y aparece en un ascensor
// visto con la misma cámara isométrica del nivel. El ascensor BAJA UN PISO: cada nivel es un piso del edificio
// y el primero está arriba de todo. Con 20 niveles, el nivel 1 baja del 20 al 19… y el último llega a L (la calle).
// Arriba se escribe un mensaje positivo (hay un mundo real más allá) y luego aparece Play (siguiente nivel).
//
// Línea de tiempo (segundos desde que cruza la puerta):
//   0.9  cambia a la escena del ascensor y aclara
//   1.2  el ascensor arranca, baja un piso y frena con un pequeño rebote (RIDE_TIME)
//   1.4  suena la fanfarria
//   1.8  se escribe el mensaje (letra por letra)
//   +0.3 después del mensaje: botón Play
const T_SWITCH = .9, T_GO = 1.2, T_JINGLE = 1.4, T_MSG = 1.8, CHAR_TIME = .04;
const RIDE_TIME = 2.6;                 // segundos que tarda en bajar el piso
const FLOOR_H = 36, SEGS = 5;          // alto de cada piso del hueco · pisos que se reciclan
const SHAFT = 13;                      // medio ancho del hueco (las paredes están en x = -SHAFT y z = -SHAFT)
const Z0 = 3;                          // el personaje se para en y = 3 (como en el nivel)

let elevScene, elevCam, cabin, rider, floorTex, segs = [], streaks = [];
let shiftK = 0;                        // 0→1: corre la cabina a la derecha para dejarle lugar al dial
let ex = -1, shown = false, fade = 0, travel = 0, speed = 0, floorShown = null, fromFloor = 1, levelCount = 1, loading = false;
let rewardEl, msgEl, playBtn, msg = '', shownChars = -1, lastMsg = -1, done = false;

// ---------- texturas de texto (números de piso) ----------
function label(text, w = 128, h = 64, color = '#3be07c') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
  const draw = t => { const x = c.getContext('2d'); x.fillStyle = '#07130c'; x.fillRect(0, 0, w, h); x.fillStyle = color; x.font = `700 ${h * .7}px "Chakra Petch", monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, w / 2, h * .54); tex.needsUpdate = true; };
  draw(text); return { tex, draw };
}
const floorName = n => n < 0 ? 'B' + -n : n === 0 ? 'L' : String(n);  // 0 = planta baja (la calle)

// ---------- construcción ----------
function buildSegment(k) {
  // un piso del hueco: tramo de pared al fondo (z) y a la izquierda (x), cornisa, puertas del piso y su número
  const g = new THREE.Group(); g.position.y = (k - 2) * FLOOR_H; elevScene.add(g);
  const wallC = 0x26332c, wallD = 0x1b2620, ledge = 0x4b5a52;
  const WIDE = 70, mid = (WIDE - SHAFT) / 2;                                              // las paredes siguen hacia los lados (el edificio)
  box(g, WIDE + SHAFT + 1, FLOOR_H, 1, wallC, mid, FLOOR_H / 2, -SHAFT - .5);           // pared del fondo
  box(g, 1, FLOOR_H, WIDE + SHAFT + 1, wallD, -SHAFT - .5, FLOOR_H / 2, mid);           // pared izquierda
  box(g, WIDE + SHAFT + 1, 1.6, 2, ledge, mid, .8, -SHAFT + .5); box(g, 2, 1.6, WIDE + SHAFT + 1, ledge, -SHAFT + .5, .8, mid); // cornisa del piso
  for (let s = SHAFT + 6; s < WIDE; s += 12) {                                          // ventanas del edificio a los lados
    const wm = new THREE.MeshBasicMaterial({ color: (s / 12 + k) % 3 ? 0x1f6b3e : 0x3be07c });
    const a = new THREE.Mesh(new THREE.BoxGeometry(7, 12, .3), wm); a.position.set(s, 16, -SHAFT + .1); g.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(.3, 12, 7), wm); b.position.set(-SHAFT + .1, 16, s); g.add(b);
  }
  // puertas del piso (cerradas) en la pared del fondo, con marco y número arriba
  box(g, 15, 21, .6, 0x5d6a63, 0, 1.6 + 10.5, -SHAFT + .3);
  box(g, 6.8, 19.6, .6, 0x8d9993, -3.6, 1.6 + 9.8, -SHAFT + .55); box(g, 6.8, 19.6, .6, 0x8d9993, 3.6, 1.6 + 9.8, -SHAFT + .55);
  const L = label(floorName(k)), plate = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: L.tex }));
  plate.position.set(0, 26, -SHAFT + .1); g.add(plate);
  // tiras de luz verde en las paredes (se ven pasar al subir)
  const glow = new THREE.MeshBasicMaterial({ color: 0x2bd96b });
  for (const x of [-10, 10]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.5, FLOOR_H - 6, .3), glow); s.position.set(x, FLOOR_H / 2 + 2, -SHAFT + .2); g.add(s); }
  for (const z of [-6, 6]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.3, FLOOR_H - 6, .5), glow); s.position.set(-SHAFT + .2, FLOOR_H / 2 + 2, z); g.add(s); }
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(.4, .8, 10), new THREE.MeshBasicMaterial({ color: 0xd8ffe6 })); lamp.position.set(-SHAFT + .3, 30, 0); g.add(lamp);
  segs.push({ g, num: k, L });
}

function buildElevator() {
  elevScene = new THREE.Scene();
  elevCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
  elevScene.add(new THREE.HemisphereLight(0xc4ffd6, 0x0d2a18, 1.9));
  const sun = new THREE.DirectionalLight(0xe2ffe9, 1.8); sun.position.set(60, 90, 30); elevScene.add(sun);
  for (let k = 0; k < SEGS; k++) buildSegment(k);
  for (const x of [-SHAFT + 2, SHAFT - 2]) box(elevScene, .8, 400, .8, 0x6a7570, x, 100, -SHAFT + 1.2);   // rieles (no se mueven: se ven iguales)

  // cabina: piso, paredes al fondo y a la izquierda (como el nivel), barandas al frente, cables
  cabin = new THREE.Group(); elevScene.add(cabin);
  box(cabin, 20, 2, 20, 0x3a4048, 0, Z0 - 1, 0); box(cabin, 20, .3, 20, 0x56606a, 0, Z0 - .1, 0);
  box(cabin, 20, 24, 1, 0x16241d, 0, Z0 + 12, -9.5); box(cabin, 1, 24, 20, 0x1d2d25, -9.5, Z0 + 12, 0);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x3be07c });
  for (const x of [-5, 0, 5]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.4, 20, .2), glowMat); s.position.set(x, Z0 + 12, -8.9); cabin.add(s); }
  for (const z of [-4, 4]) { const s = new THREE.Mesh(new THREE.BoxGeometry(.2, 20, .4), glowMat); s.position.set(-8.9, Z0 + 12, z); cabin.add(s); }
  box(cabin, 20, 1, 1, 0xb8c2cc, 0, Z0 + 5, 9.5); box(cabin, 1, 1, 20, 0xb8c2cc, 9.5, Z0 + 5, 0);           // barandas del frente
  for (const p of [[9.5, 9.5], [-9.5, 9.5], [9.5, -9.5], [0, 9.5], [9.5, 0]]) box(cabin, .8, 5, .8, 0x8d979f, p[0], Z0 + 2.5, p[1]);
  for (const [x, z] of [[-9.5, -9.5], [9.5, -9.5], [-9.5, 9.5]]) box(cabin, .4, 300, .4, 0x2a2f34, x, Z0 + 160, z); // cables (el de adelante taparía al jugador)
  // indicador: flecha ▼ y número de piso, en la pared del fondo de la cabina
  box(cabin, 9, 4, .5, 0x0b0f0d, 0, Z0 + 21, -8.9);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x3be07c });
  [[-2.6, 20.4, .7, .7], [-3.3, 21.1, .7, .7], [-1.9, 21.1, .7, .7], [-2.6, 21.8, .7, 2]].forEach(([x, y, w, h]) => { const a = new THREE.Mesh(new THREE.BoxGeometry(w, h, .3), arrowMat); a.position.set(x, Z0 + y - 2, -8.6); cabin.add(a); });
  floorTex = label('1', 96, 64);
  const num = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.9), new THREE.MeshBasicMaterial({ map: floorTex.tex })); num.position.set(1.7, Z0 + 21, -8.6); cabin.add(num);
  const inner = new THREE.PointLight(0x9dffc4, 220, 40, 2); inner.position.set(2, Z0 + 18, 2); cabin.add(inner);
  rider = makeCharacter(cabin, false); wearHat(rider);

  // rayas de velocidad junto a las paredes (pasan hacia arriba mientras baja)
  const sm = new THREE.MeshBasicMaterial({ color: 0x9dffc4, transparent: true, opacity: .5, depthWrite: false });
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.25, 6 + Math.random() * 8, .25), sm);
    const along = -SHAFT + 2 + Math.random() * 60, gap = -SHAFT + 1 + Math.random() * 2;   // pegadas a las paredes: nunca delante de la cabina
    if (i % 2) s.position.set(along, 0, gap); else s.position.set(gap, 0, along);
    s.position.y = Math.random() * 100 - 30; s.visible = false; elevScene.add(s); streaks.push(s);
  }
}

// ---------- capa HTML: mensaje, estrellas y botón Play ----------
function buildUI() {
  const f = document.createElement('div'); f.id = 'fade'; document.body.append(f);
  rewardEl = document.createElement('div'); rewardEl.id = 'reward';
  // juego: título (mensaje) + selector de pisos tipo dial · editor: Play / Volver al editor
  rewardEl.innerHTML = EDITOR
    ? `<div class="top"><p class="rmsg"></p></div>
       <div class="bottom"><div class="rbtns"><button id="nextBtn" class="playbtn">Play ▶</button><button id="rewardEdit">Volver al editor</button></div></div>`
    : `<div class="top"><p class="rmsg dtitle"></p><p class="rsub"></p></div><div class="mid"></div>`;
  if (!EDITOR) rewardEl.classList.add('withdial');
  document.body.append(rewardEl); msgEl = rewardEl.querySelector('.rmsg');
  playBtn = $('#nextBtn'); playBtn?.addEventListener('click', () => playLevel(G.levelName));
  $('#rewardEdit')?.addEventListener('click', () => setMode('edit'));
  addEventListener('keydown', e => {
    if (G.mode !== 'exit' || !shown) return;
    if (!done && ex > T_MSG) { done = true; ex = T_MSG + msg.length * CHAR_TIME; }            // tecla: termina de escribir
    else if (EDITOR && done && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); playLevel(G.levelName); }   // en el juego las teclas las maneja el dial
  });
}

// monedas ganadas en este piso (se muestran debajo del subtítulo, una por una)
let earned = [];
const earnedHTML = () => earned.length ? `<span class="rcoins">${earned.map((g, i) => `<em style="animation-delay:${(.25 + i * .35).toFixed(2)}s">+${g.n}${COIN} ${g.why}</em>`).join('')}</span>` : '';

export function initElevator() { buildElevator(); buildUI(); }
// cuántos niveles hay (define en qué piso empieza el edificio); main lo llama al cargar
export async function initFloors() { levelCount = EDITOR ? 1 : await countLevels(G.levelName); }

// ---------- control ----------
export function startExit() {
  if (!elevScene) initElevator();                       // por si todavía no se preparó en segundo plano
  haptic([25, 60, 25]);                                  // "¡lo lograste!" al entrar al ascensor
  let i; do { i = Math.random() * WAKE_MESSAGES.length | 0; } while (WAKE_MESSAGES.length > 1 && i === lastMsg);
  lastMsg = i; msg = WAKE_MESSAGES[i]; shownChars = -1; msgEl.textContent = ''; done = false;
  earned = EDITOR ? [] : markDone(G.levelName, !!G.gotCrystal, G.time, !G.alerts);   // piso terminado (y su cristal, si lo llevas): monedas ganadas
  G.mode = 'exit'; ex = 0; shown = false; loading = false; travel = 0; speed = 0; floorShown = null;
  fromFloor = Math.max(1, levelCount - levelNumber(G.levelName) + 1);   // nivel 1 de 20 → piso 20 (baja al 19)
  segs.forEach((s, k) => { s.g.position.y = (k - 2) * FLOOR_H; const n = fromFloor + k - 2; if (s.num !== n) { s.num = n; s.L.draw(floorName(n)); } });
  document.body.classList.add('exiting'); setAlarm(0); setGlitchFX(false);
}

// lo llama setMode: vuelve todo a la normalidad
export function resetExit() {
  ex = -1; shown = false; document.body.classList.remove('exiting');
  rewardEl?.classList.remove('show-msg', 'show-play', 'typing'); shiftK = 0;
  if (rewardEl?.querySelector('.dial')) hideDial();
}

// juega el piso elegido en el dial (en el editor se repite el mismo nivel, ya cargado)
// piso que sigue: el siguiente; con todos los pisos y cristales, el 1 (ahí está el portal del final)
function nextAfter(name) {
  const pre = (name.match(/^(.*?)\d+$/) || [0, 'piso'])[1];
  return allCollected(pre, levelCount) ? pre + 1 : nextLevelName(name) || name;
}
async function playLevel(name) {
  if (loading) return; loading = true;
  await pokiBreak();                     // Poki: anuncio entre pisos (si toca)
  fade = 1; $('#fade').style.opacity = 1;
  const lvl = !EDITOR && name ? await loadLevelNamed(name) : null;
  if (lvl) { G.level = lvl; G.levelName = name; try { history.replaceState(null, '', `?nivel=${name}`); } catch (e) {} rebuild(); prefetchLevel(nextLevelName(name)); }
  setMode('play');                       // el nivel se ensambla y la pantalla se aclara sola
}

// ---------- cada frame ----------
export function updateElevator(dt) {
  const fadeEl = $('#fade');
  if (G.mode !== 'exit') {                // después de Play: aclarar la pantalla
    if (fade > 0) { fade = Math.max(0, fade - dt * 2); fadeEl.style.opacity = fade; }
    return;
  }
  ex += dt;
  if (ex < T_SWITCH) {                    // 1) entra por la puerta y se oscurece
    player.x -= G.EXIT.inX * 9 * dt; player.y -= G.EXIT.inY * 9 * dt; player.ang = G.EXIT.ang + Math.PI; player.moving = true; // camina hacia el ascensor
    fade = ease(Math.min(1, ex / T_SWITCH));
  } else {
    if (!shown) { shown = true; player.moving = false; }
    fade = Math.max(0, 1 - (ex - T_SWITCH) / .5);   // 2) aparece el ascensor

    // 3) baja un piso: arranca suave, frena suave y se pasa un poquito (rebote); el hueco sube
    const k = Math.min(1, Math.max(0, ex - T_GO) / RIDE_TIME), pos = FLOOR_H * ease(k) + Math.sin(Math.min(1, Math.max(0, ex - T_GO - RIDE_TIME) / .45) * Math.PI) * .8;
    const d = pos - travel; travel = pos; speed = Math.abs(d) / Math.max(dt, 1e-4);
    for (const s of segs) s.g.position.y += d;
    for (const s of streaks) { s.visible = speed > 6; s.position.y += d * 2.2; if (s.position.y > 70) s.position.y -= 100; }
    const f = travel > FLOOR_H / 2 ? fromFloor - 1 : fromFloor;
    if (f !== floorShown) { floorShown = f; floorTex.draw(floorName(f)); }
    cabin.position.y = Math.sin(ex * 11) * .1 * Math.min(1, speed / 20);    // leve vibración mientras se mueve
    poseClip(rider, 0, 0, -Math.PI / 4, 'elevator_wait', ex - T_SWITCH);   // atento: mira a los lados y al indicador (clip elevator_wait)
    if (ex >= T_JINGLE && ex - dt < T_JINGLE) winJingle();

    // 4) mensaje letra por letra; luego estrellas y Play
    if (ex >= T_MSG) {
      rewardEl.classList.add('show-msg');
      const n = Math.min(msg.length, Math.floor((ex - T_MSG) / CHAR_TIME));
      if (n !== shownChars) { shownChars = n; msgEl.textContent = msg.slice(0, n); }
      rewardEl.classList.toggle('typing', n < msg.length);
      if (n >= msg.length && ex >= T_MSG + msg.length * CHAR_TIME + .3 && !rewardEl.classList.contains('show-play')) {
        done = true; rewardEl.classList.add('show-play');
        if (EDITOR) playBtn.focus();
        else { rewardEl.querySelector('.rsub').innerHTML = fragmentsText() + earnedHTML(); showDial(rewardEl.querySelector('.mid'), nextAfter(G.levelName), playLevel); }
      }
    }
  }
  fadeEl.style.opacity = fade;
}

export const elevatorShown = () => G.mode === 'exit' && shown;

// misma cámara isométrica que el nivel, encuadrando la cabina (deja lugar arriba al mensaje y abajo a Play)
const target = new THREE.Vector3(0, 10, 0);
export function renderElevator() {
  const a = stage.clientWidth / stage.clientHeight, half = Math.max(36, 23 / a);
  shiftK += ((!EDITOR && rewardEl?.classList.contains('show-play') ? 1 : 0) - shiftK) * .08;
  const sx = shiftK * half * a * (a < 1 ? .2 : .26);
  Object.assign(elevCam, { left: -half * a - sx, right: half * a - sx, top: half, bottom: -half }); elevCam.updateProjectionMatrix();
  elevCam.position.copy(target).add(CAM_OFF); elevCam.lookAt(target);
  renderer.render(elevScene, elevCam);
}
