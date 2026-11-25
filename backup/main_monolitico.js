import * as THREE from 'three';
import './style.css';

// Mismo código para el juego (index.html) y el editor (editor.html).
const EDITOR = document.body.dataset.mode === 'editor';
// Nivel a cargar: ?nivel=piso2 lee public/levels/piso2.json
const LEVEL_NAME = (new URLSearchParams(location.search).get('nivel') || 'piso1').replace(/[^a-z0-9_-]/gi, '');

main();

async function main() {
const DATA = await (await fetch('data/office.json')).json();
// Si el nivel no existe todavía (p. ej. ?nivel=piso2) el editor arranca uno vacío; "Guardar" lo crea.
const loadLevel = async () => { const r = await fetch(`levels/${LEVEL_NAME}.json`, { cache: 'no-store' }); return r.ok ? r.json() : { player: [20.5, 12.5], props: [], agents: [], hides: [] }; };
const W = 128, D = 104, H = 34, Z = 3;
// Velocidad del jugador en vóxeles por segundo (los agentes caminan a 9)
const PLAYER_SPEED = 24, PLAYER_SPEED_CROUCH = 11;
// Zoom de la cámara al jugar: mitad del alto visible en vóxeles (más chico = más cerca)
const CAM_PLAY_HALF = 42;
// Al caminar la cámara se aleja un poco: 1 = sin efecto, 0.85 = 15 % más lejos
const CAM_WALK_ZOOM = 0.86, CAM_ZOOM_SPEED = 2.5;
const $ = s => document.querySelector(s);
const COLORS = DATA.colors;
// ---------- ambientación verde (tipo código digital) ----------
// Intensidad del tinte verde sobre toda la imagen (0 = colores originales) y lluvia de código de fondo.
const GREEN_TINT = .22, CODE_RAIN = true;
// Algunos colores de la paleta se vuelven verdes al cargar (los .vox no cambian): pantallas, lámparas y vidrios.
const GREEN_LOOK = { '60,80,110': [30, 170, 80], '245,250,255': [205, 255, 220], '150,155,160': [120, 170, 135], '170,205,235': [110, 195, 145], '215,235,250': [185, 255, 210] };
const COLORS0 = COLORS.map(c => c.join(','));                       // paleta original, antes del verde
const ci = (r, g, b) => { const i = COLORS0.indexOf(`${r},${g},${b}`); return i >= 0 ? i + 1 : 1; };
COLORS.forEach((c, i) => { const r = GREEN_LOOK[c.join(',')]; if (r) COLORS[i] = r; });
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// ---------- forma del piso: cada nivel guarda una grilla de baldosas de 8×8 vóxeles ----------
// Las paredes se generan solas: altas en los bordes del fondo (norte y oeste) y barandas en los del frente (sur y este),
// así la cámara siempre ve el interior. La puerta EXIT va sobre una pared del fondo (norte).
const TILE = 8, TW = W / TILE, TD = D / TILE;                   // 16 × 13 baldosas
const fullFloor = () => Array.from({ length: TD }, () => '1'.repeat(TW));
const DEFAULT_EXIT = { x: 89, y: 102 };
const C = { slab: ci(120, 124, 130), ta: ci(214, 218, 222), tb: ci(196, 201, 206), wall: ci(226, 228, 230), shade: ci(200, 203, 207),
  cap: ci(110, 115, 122), glass: ci(170, 205, 235), glassHi: ci(215, 235, 250), frame: ci(90, 96, 104), lamp: ci(245, 250, 255),
  lampF: ci(150, 155, 160), stone: ci(175, 178, 182), stoneD: ci(140, 143, 148), rail: ci(205, 208, 210), green: ci(40, 200, 70), text: ci(250, 255, 250) };
const FONT = { E: ['111', '100', '110', '100', '111'], X: ['101', '101', '010', '101', '101'], I: ['111', '010', '010', '010', '111'], T: ['111', '010', '010', '010', '010'] };
let EXIT = { x0: 89, x1: 99, y: 102, h: 22, cx: 94.5, cy: 101 }, exitOk = true;
let doorOpen = 0; // 0 cerrada · 1 abierta
const tileOn = (i, j) => i >= 0 && j >= 0 && i < TW && j < TD && level.floor[j][i] === '1';
function exitValid(x0, wy) { // la puerta necesita pared del fondo continua en todo su ancho
  if (wy % TILE !== TILE - 2) return false;
  const j = Math.floor(wy / TILE);
  for (let x = x0 - 1; x <= x0 + 11; x++) { const i = Math.floor(x / TILE); if (!tileOn(i, j) || tileOn(i, j + 1)) return false; }
  return true;
}
function buildShell() {
  const a = new Uint8Array(W * D * H);
  const put = (x, y, z, c) => { if (x >= 0 && y >= 0 && z >= 0 && x < W && y < D && z < H) a[x + y * W + z * W * D] = c; };
  const bx = (x0, y0, z0, x1, y1, z1, c) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, c); };
  const railAt = (x, y, k) => { // baranda baja: base de piedra, postes cada 10 y barrotes cada 3
    bx(x, y, Z, x, y, Z + 2, C.stone); put(x, y, Z + 3, C.stoneD);
    if (k % 10 === 0) bx(x, y, Z + 4, x, y, Z + 11, C.stone); else if (k % 3 === 0) bx(x, y, Z + 4, x, y, Z + 10, C.rail);
    put(x, y, Z + 11, C.rail);
  };
  const TOP = 30;
  for (let j = 0; j < TD; j++) for (let i = 0; i < TW; i++) {
    if (!tileOn(i, j)) continue;
    const x0 = i * TILE, y0 = j * TILE, x1 = x0 + TILE - 1, y1 = y0 + TILE - 1;
    bx(x0, y0, 0, x1, y1, 1, C.slab); bx(x0, y0, 2, x1, y1, 2, (i + j) % 2 ? C.tb : C.ta);
    if (!tileOn(i, j + 1)) { // pared del fondo con lámparas
      bx(x0, y1 - 1, Z, x1, y1, TOP, C.wall); bx(x0, y1 - 1, TOP, x1, y1, TOP + 1, C.cap); bx(x0, y1 - 2, Z, x1, y1 - 2, Z + 1, C.shade);
      if (i % 2 === 0) { bx(x0 + 1, y1 - 2, Z + 22, x1 - 1, y1 - 2, Z + 22, C.lampF); bx(x0 + 1, y1 - 2, Z + 23, x1 - 1, y1 - 2, Z + 24, C.lamp); }
    }
    if (!tileOn(i - 1, j)) { // pared lateral con ventanas
      bx(x0, y0, Z, x0 + 1, y1, TOP, C.wall); bx(x0, y0, TOP, x0 + 1, y1, TOP + 1, C.cap); bx(x0 + 2, y0, Z, x0 + 2, y1, Z + 1, C.shade);
      if (tileOn(i, j + 1)) { bx(x0, y0, Z + 10, x0 + 1, y1, Z + 21, C.frame); bx(x0, y0 + 1, Z + 11, x0 + 1, y1 - 1, Z + 20, C.glass); bx(x0 + 1, y0 + 2, Z + 17, x0 + 1, y0 + 4, Z + 19, C.glassHi); }
    }
    if (!tileOn(i, j - 1)) for (let x = x0; x <= x1; x++) railAt(x, y0, x);
    if (!tileOn(i + 1, j)) for (let y = y0; y <= y1; y++) railAt(x1, y, y);
  }
  const ex = level.exit || DEFAULT_EXIT, x0 = Math.round(ex.x), wy = ex.y;
  exitOk = exitValid(x0, wy);
  EXIT = { x0, x1: x0 + 10, y: wy, h: 22, cx: x0 + 5.5, cy: wy - 1 };
  if (exitOk) {
    bx(x0, wy - 1, Z, x0 + 10, wy + 1, Z + 21, 0);                                   // hueco de la puerta (y el zócalo)
    bx(x0 - 1, wy, Z, x0 - 1, wy + 1, Z + 22, C.cap); bx(x0 + 11, wy, Z, x0 + 11, wy + 1, Z + 22, C.cap); bx(x0 - 1, wy, Z + 22, x0 + 11, wy + 1, Z + 22, C.cap);
    const sx = x0 - 3, sz = Z + 24;
    bx(sx - 1, wy - 2, Z + 21, sx + 17, wy - 1, Z + 26, 0);                           // sin lámparas detrás del letrero
    bx(sx, wy - 1, sz, sx + 16, wy - 1, sz + 6, C.green);
    [...'EXIT'].forEach((ch, k) => FONT[ch].forEach((row, r) => [...row].forEach((bit, c) => { if (bit === '1') put(sx + 1 + k * 4 + c, wy - 2, sz + 5 - r, C.text); })));
  }
  return a;
}

// ---------- props ----------
const PROPS = {};
for (const [k, p] of Object.entries(DATA.props)) {
  const b = b64(p.v), vox = [];
  for (let i = 0; i < b.length; i += 4) vox.push([b[i], b[i + 1], b[i + 2], b[i + 3]]);
  PROPS[k] = { n: p.n, w: p.w, d: p.d, vox, rots: [] };
}
function rot(t, r) {
  const P = PROPS[t]; if (P.rots[r]) return P.rots[r];
  const { w, d } = P;
  const vox = P.vox.map(([x, y, z, c]) => r === 1 ? [d - 1 - y, x, z, c] : r === 2 ? [w - 1 - x, d - 1 - y, z, c] : r === 3 ? [y, w - 1 - x, z, c] : [x, y, z, c]);
  let h = 0; for (const v of vox) h = Math.max(h, v[2] + 1);
  return P.rots[r] = { w: r % 2 ? d : w, d: r % 2 ? w : d, h, vox, foot: new Set(vox.map(v => v[0] + ',' + v[1])) };
}

// ---------- level ----------
let level = await loadLevel();
// El editor guarda un borrador en el navegador; "Guardar" lo escribe en public/levels/.
const LS = 'escape-oficina-borrador-' + LEVEL_NAME;
if (EDITOR) try { const s = localStorage.getItem(LS); if (s) level = JSON.parse(s); } catch (e) {}
const save = () => { if (EDITOR) try { localStorage.setItem(LS, JSON.stringify(level)); } catch (e) {} };
const hist = [];
const pushHist = () => { hist.push(JSON.stringify(level)); if (hist.length > 60) hist.shift(); };

// ---------- grid ----------
let grid = new Uint8Array(W * D * H);
const colH = new Uint8Array(W * D);
const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= W || y >= D || z >= H) ? 0 : grid[x + y * W + z * W * D];
const hAt = (x, y) => { x = Math.floor(x); y = Math.floor(y); return (x < 0 || y < 0 || x >= W || y >= D) ? 99 : (doorOpen < .8 && y >= EXIT.y && y <= EXIT.y + 1 && x >= EXIT.x0 && x <= EXIT.x1) ? 99 : colH[x + y * W]; };
const free = (x, y, r = 1.5) => hAt(x - r, y - r) === 0 && hAt(x + r, y - r) === 0 && hAt(x - r, y + r) === 0 && hAt(x + r, y + r) === 0;

// ---------- three ----------
const stage = $('#stage');
const tintEl = document.createElement('div'); tintEl.id = 'tint'; tintEl.style.opacity = GREEN_TINT; document.body.append(tintEl);
const vignette = document.createElement('div'); vignette.id = 'vignette'; document.body.append(vignette);
const rain = document.createElement('canvas'); rain.id = 'rain'; document.body.prepend(rain);
const rctx = rain.getContext('2d'), RF = 16, GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789Z:.=*+<>';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
let drops = [], rainT = 0;
function rainResize() { rain.width = innerWidth; rain.height = innerHeight; drops = Array.from({ length: Math.ceil(innerWidth / RF) }, () => Math.random() * -60); }
addEventListener('resize', rainResize); rainResize();
function drawRain(dt) { // columnas de caracteres que caen, a ~20 fps
  if (!CODE_RAIN || (still && rainT < 0)) return;
  rainT += dt; if (rainT < .05) return; rainT = still ? -1 : 0;
  rctx.fillStyle = 'rgba(2,10,5,.14)'; rctx.fillRect(0, 0, rain.width, rain.height);
  rctx.font = RF + 'px monospace';
  for (let i = 0; i < drops.length; i++) {
    rctx.fillStyle = Math.random() < .06 ? '#d8ffe4' : '#22c35e';
    rctx.fillText(GLYPHS[Math.random() * GLYPHS.length | 0], i * RF, drops[i] * RF);
    drops[i] = drops[i] * RF > rain.height && Math.random() > .97 ? 0 : drops[i] + 1;
  }
}
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0); // fondo transparente: se ve la lluvia de código detrás
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x03140a, 240, 420); // lo lejano se hunde en verde oscuro
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
const target = new THREE.Vector3(64, 6, -52);
const CAM_OFF = new THREE.Vector3(160, 135, 160), CENTER = target.clone(), camGoal = new THREE.Vector3();
let snapCam = true;
cam.position.copy(target).add(CAM_OFF); cam.lookAt(target);
scene.add(new THREE.HemisphereLight(0xc4ffd6, 0x0d2a18, 1.7));
const sun = new THREE.DirectionalLight(0xe2ffe9, 2.1);
sun.position.set(130, 140, 20); sun.target.position.set(64, 0, -52); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.4;

const FACES = [
  [[1, 0, 0], [[1,0,0],[1,1,0],[1,1,1],[1,0,1]]], [[-1, 0, 0], [[0,1,0],[0,0,0],[0,0,1],[0,1,1]]],
  [[0, 1, 0], [[1,1,0],[0,1,0],[0,1,1],[1,1,1]]], [[0, -1, 0], [[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
  [[0, 0, 1], [[0,0,1],[1,0,1],[1,1,1],[0,1,1]]], [[0, 0, -1], [[1,0,0],[0,0,0],[0,1,0],[1,1,0]]]];
const tmpC = new THREE.Color();
function buildGeo(get, w, d, h) {
  const pos = [], nor = [], col = [];
  for (let z = 0; z < h; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
    const v = get(x, y, z); if (!v) continue;
    const [r, g, b] = COLORS[v - 1]; const j = 1 + (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 7) / 230;
    tmpC.setRGB(Math.min(1, r / 255 * j), Math.min(1, g / 255 * j), Math.min(1, b / 255 * j), THREE.SRGBColorSpace);
    for (const [n, q] of FACES) {
      if (get(x + n[0], y + n[1], z + n[2])) continue;
      for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(x + q[i][0], y + q[i][1], z + q[i][2]); nor.push(...n); col.push(tmpC.r, tmpC.g, tmpC.b); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
const worldMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
worldMesh.rotation.x = -Math.PI / 2; worldMesh.castShadow = worldMesh.receiveShadow = true; scene.add(worldMesh);

// ---------- escritorio inicial: siempre está donde empieza el jugador ----------
const isChair = (x, y) => x >= 4 && x <= 10 && y <= 5;   // zona de la silla dentro de desk.vox
const deskVox = PROPS.desk ? rot('desk', 0).vox : [];
const startDeskVox = deskVox.filter(v => !isChair(v[0], v[1])); // el escritorio sin silla (la silla va aparte y no choca)
const chairVox = deskVox.filter(v => isChair(v[0], v[1]));
const startFoot = [...new Set(startDeskVox.map(v => v[0] + ',' + v[1]))].map(k => k.split(',').map(Number));
const SEAT = [7.5, 3.5];                                  // centro del asiento dentro del modelo
const seat = { x: 0, y: 0, ox: 0, oy: 0 };
let sdCells = new Set();
const deskOrigin = p => [Math.round(p[0] - SEAT[0]), Math.round(p[1] - SEAT[1])];
function compose() {
  level.floor ||= fullFloor(); level.exit ||= { ...DEFAULT_EXIT }; level.hides ||= [];
  grid = buildShell();
  for (const p of level.props) {
    const R = rot(p.t, p.r);
    for (const [x, y, z, c] of R.vox) { const X = p.x + x, Y = p.y + y, ZZ = z + Z; if (X >= 0 && Y >= 0 && X < W && Y < D && ZZ < H && tileOn(X >> 3, Y >> 3)) grid[X + Y * W + ZZ * W * D] = c; } // lo que quede fuera del piso no se dibuja
  }
  const [ox, oy] = deskOrigin(level.player); Object.assign(seat, { ox, oy, x: ox + SEAT[0], y: oy + SEAT[1] }); sdCells = new Set();
  for (const [x, y, z, c] of startDeskVox) { const X = ox + x, Y = oy + y, ZZ = z + Z; if (X >= 0 && Y >= 0 && X < W && Y < D && ZZ < H) { grid[X + Y * W + ZZ * W * D] = c; sdCells.add(X + Y * W); } }
  for (let x = 0; x < W; x++) for (let y = 0; y < D; y++) { let h = 0; for (let z = Z; z <= Z + 20; z++) if (at(x, y, z)) h = z - Z + 1; colH[x + y * W] = tileOn(x >> 3, y >> 3) ? h : 99; } // fuera del piso no se camina
  worldMesh.geometry.dispose(); worldMesh.geometry = buildGeo(at, W, D, H);
}

// ghost + hover box
const ghostCache = {};
const ghostMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: .6, depthWrite: false });
const ghost = new THREE.Mesh(new THREE.BufferGeometry(), ghostMat); ghost.rotation.x = -Math.PI / 2; ghost.visible = false; ghost.renderOrder = 3; scene.add(ghost);
function ghostGeo(t, r) {
  const k = t + r; if (ghostCache[k]) return ghostCache[k];
  const R = rot(t, r), a = new Uint8Array(R.w * R.d * R.h);
  for (const [x, y, z, c] of R.vox) a[x + y * R.w + z * R.w * R.d] = c;
  return ghostCache[k] = buildGeo((x, y, z) => (x < 0 || y < 0 || z < 0 || x >= R.w || y >= R.d || z >= R.h) ? 0 : a[x + y * R.w + z * R.w * R.d], R.w, R.d, R.h);
}
const hoverBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: .3, depthWrite: false }));
hoverBox.visible = false; scene.add(hoverBox);

// ---------- characters ----------
const mats = {}; const mat = h => mats[h] || (mats[h] = new THREE.MeshLambertMaterial({ color: h }));
function box(p, w, h, d, color, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; }
function limb(p, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; }
function makeChar(agent) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const pants = agent ? 0x1b1d22 : 0x34394a, top = agent ? 0x17191d : 0xf2f3f5, skin = 0xf1c9a5, hair = agent ? 0x101114 : 0x3a2a1e;
  const legL = limb(body, 0, 5, -1), legR = limb(body, 0, 5, 1);
  for (const l of [legL, legR]) { box(l, 1.6, 5, 1.6, pants, 0, -2.5, 0); box(l, 2.4, 1, 1.8, 0x111111, .4, -4.6, 0); }
  const armL = limb(body, 0, 9.8, agent ? -3.1 : -2.8), armR = limb(body, 0, 9.8, agent ? 3.1 : 2.8);
  for (const a of [armL, armR]) { box(a, 1.5, 4.8, 1.5, top, 0, -2.4, 0); box(a, 1.3, 1.3, 1.3, skin, 0, -5.2, 0); }
  if (agent) {
    box(body, 3.8, 7.5, 5, top, 0, 7.2, 0); box(body, 4.2, 2.6, 5.6, top, 0, 4.6, 0);
    box(body, 3.9, .7, 5.1, 0x2c2f35, 0, 8.4, 0); box(body, .3, .9, 1, 0xb8bcc4, 2, 8.4, 0);
    box(body, 5.6, 5.6, 5.6, skin, 0, 13.6, 0); box(body, 6, 2, 6, hair, -.2, 16.6, 0); box(body, 1.2, 4, 6, hair, -2.6, 14.6, 0);
    box(body, .7, 1.9, 6.2, 0x050506, 2.9, 14.2, 0); box(body, .2, .5, 1.8, 0x9ab0c8, 3.25, 14.6, -1.6); box(body, .3, .25, 1.6, 0x6b4a3a, 2.85, 11.8, 0);
  } else {
    box(body, 3, 5, 4.4, top, 0, 7.5, 0); box(body, .3, 4, .9, 0x1d2b4a, 1.55, 7.6, 0);
    box(body, 6, 6, 6, skin, 0, 13, 0); box(body, 6.4, 1.6, 6.4, hair, 0, 16.4, 0); box(body, 2, 2, 1.6, hair, -1, 17.6, .6);
    for (const s of [-1.4, 1.4]) { box(body, .3, 1.8, 1.6, 0xffffff, 3.05, 13.4, s); box(body, .35, .9, .8, 0x111111, 3.15, 13.2, s); }
    box(body, .3, .3, 1.2, 0x5a3a2a, 3.05, 11.2, 0);
  }
  scene.add(root); return { root, body, legL, legR, armL, armR };
}
function pose(ch, x, y, ang, t, moving, crouch) {
  ch.root.position.set(x, Z, -y); ch.root.rotation.y = ang; ch.body.rotation.z = 0; ch.body.position.set(0, 0, 0);
  const s = moving ? Math.sin(t * 12) * .7 : 0;
  ch.legL.rotation.z = s; ch.legR.rotation.z = -s; ch.armL.rotation.z = -s * .8; ch.armR.rotation.z = s * .8;
  ch.body.scale.y += ((crouch ? .62 : 1) - ch.body.scale.y) * .3;
}

// ---------- vision ----------
const R = 34, HALF = .58, NR = 26;
function rayDist(x, y, ang, max, th) { const cx = Math.cos(ang), cy = Math.sin(ang); for (let d = 1; d < max; d += .5) if (hAt(x + cx * d, y + cy * d) >= th) return d; return max; }
function makeFan() {
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NR * 9), 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }));
  m.frustumCulled = false; m.renderOrder = 2; scene.add(m); return m;
}
function updFan(a) {
  const arr = a.fan.geometry.attributes.position.array, pts = [];
  for (let i = 0; i <= NR; i++) { const an = a.ang - HALF + 2 * HALF * i / NR, d = rayDist(a.x, a.y, an, R, 12); pts.push([a.x + Math.cos(an) * d, a.y + Math.sin(an) * d]); }
  let k = 0; const put = (x, y) => { arr[k++] = x; arr[k++] = Z + .25; arr[k++] = -y; };
  for (let i = 0; i < NR; i++) { put(a.x, a.y); put(...pts[i]); put(...pts[i + 1]); }
  a.fan.geometry.attributes.position.needsUpdate = true;
  const c = stateColor(a);
  a.fan.material.color.setHex(c); a.fan.material.opacity = frozen > 0 ? .22 : .32 + a.meter * .25;
  a.ring.position.set(a.x, Z + .35, -a.y); a.ring.material.color.setHex(c); a.ring.material.opacity = frozen > 0 ? .25 : .55;
}
// ---------- semáforo de cada agente: verde tranquilo · amarillo sospecha/búsqueda · rojo alerta/persecución ----------
const SEMA = { green: 0x22ff77, yellow: 0xffcc00, red: 0xff2a2a, frozen: 0x6ad1ff };
function stateColor(a) {
  if (frozen > 0) return SEMA.frozen;
  if (a.state === 'alert' || a.state === 'chase') return SEMA.red;
  if (a.state === 'search' || a.state === 'return' || a.meter > .05) return SEMA.yellow;
  return SEMA.green;
}
// radio de acción: dentro de este círculo el agente te detecta aunque no estés en su cono (te escucha)
const ACTION_R = 9;
const actionRingGeo = new THREE.RingGeometry(ACTION_R - .5, ACTION_R, 48).rotateX(-Math.PI / 2);
function makeRing() { const m = new THREE.Mesh(actionRingGeo, new THREE.MeshBasicMaterial({ color: SEMA.green, transparent: true, opacity: .55, depthWrite: false })); m.renderOrder = 2; scene.add(m); return m; }

// ---------- agents & routes ----------
const ACOL = [0xff4d4d, 0xffb020, 0x4db8ff, 0xc77dff, 0xff7ac6, 0x9cff57];
const hex = c => '#' + c.toString(16).padStart(6, '0');
const agents = [];
function syncAgents() {
  while (agents.length < level.agents.length) agents.push({ ch: makeChar(true), fan: makeFan(), ring: makeRing() });
  while (agents.length > level.agents.length) { const a = agents.pop(); scene.remove(a.ch.root, a.fan, a.ring); }
  agents.forEach((a, i) => { a.path = level.agents[i]; const on = a.path.length > 0; a.ch.root.visible = a.fan.visible = a.ring.visible = on; });
}
function resetAgents() {
  for (const a of agents) {
    const p = a.path; if (!p.length) continue;
    const ang = p.length > 1 ? Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]) : 0;
    Object.assign(a, { x: p[0][0], y: p[0][1], wp: Math.min(1, p.length - 1), dir: 1, wait: 0, meter: 0, ang, lost: 0, base: ang, moving: false, state: 'patrol', timer: 0, lose: 0, hopT: 9, markT: 9, lastField: null, retField: null });
  }
}
const routeGroup = new THREE.Group(); scene.add(routeGroup);
const segOk = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = 0; d <= l; d += .5) { const t = l ? d / l : 0; if (!free(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1.2)) return false; } return true; };
let badRoutes = [];
function drawRoutes() {
  routeGroup.clear(); badRoutes = [];
  level.agents.forEach((p, i) => {
    const c = ACOL[i % ACOL.length]; let ok = true;
    p.forEach((w, j) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(j ? 2 : 3, 1, j ? 2 : 3), new THREE.MeshBasicMaterial({ color: c })); m.position.set(w[0], Z + .6, -w[1]); routeGroup.add(m);
      if (j) { const bad = !segOk(p[j - 1], w); if (bad) ok = false;
        const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p[j - 1][0], Z + .6, -p[j - 1][1]), new THREE.Vector3(w[0], Z + .6, -w[1])]);
        routeGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: bad ? 0xff2222 : c }))); }
    });
    if (!ok) badRoutes.push(i + 1);
  });
}

// ---------- validation ----------
function exitReachable() {
  const s = [Math.floor(seat.x), Math.floor(seat.y)]; if (!free(s[0] + .5, s[1] + .5)) return false;
  const seen = new Uint8Array(W * D), q = [s]; seen[s[0] + s[1] * W] = 1;
  while (q.length) {
    const [x, y] = q.pop(); if (exitOk && y >= EXIT.y - 6 && x > EXIT.x0 - 1 && x < EXIT.x1 + 1) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= D || seen[nx + ny * W]) continue; seen[nx + ny * W] = 1; if (free(nx + .5, ny + .5)) q.push([nx, ny]); }
  }
  return false;
}
function refreshStatus() {
  const ok = exitReachable();
  $('#status').innerHTML = `Camino al EXIT: <b class="${ok ? '' : 'bad'}">${!exitOk ? 'falta la salida' : ok ? 'libre' : 'bloqueado'}</b>` +
    (badRoutes.length ? ` · <b class="bad">ruta ${badRoutes.join(', ')} choca</b>` : '') + ` · ${level.props.length} props · ${level.agents.filter(a => a.length).length} agentes · ${(level.hides || []).length} escondites`;
}
const player = { ch: makeChar(false), x: 0, y: 0, ang: Math.PI / 4 };

// ---------- escondites: zonas donde el jugador se camufla ----------
const HIDE_R = 4; // radio de la zona en vóxeles
const HIDE_KINDS = { plant: { prop: 'plant_s', n: 'planta', label: 'Escondite planta' }, trash: { prop: 'trash', n: 'basurero', label: 'Escondite basurero' } };
const hideProp = k => PROPS[HIDE_KINDS[k]?.prop] ? HIDE_KINDS[k].prop : 'plant_s';
let hiddenKind = null, popT = 1, hideKind = 'plant';
const hideGroup = new THREE.Group(); scene.add(hideGroup);
const ringGeo = new THREE.RingGeometry(HIDE_R - .9, HIDE_R, 32).rotateX(-Math.PI / 2);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x3be07c, transparent: true, opacity: .55, depthWrite: false });
const hintMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: .3, depthWrite: false });
function propMesh(t, material) { // prop centrado en el origen del grupo
  const R0 = rot(t, 0), m = new THREE.Mesh(ghostGeo(t, 0), material), g = new THREE.Group();
  m.rotation.x = -Math.PI / 2; m.position.set(-R0.w / 2, 0, R0.d / 2); m.castShadow = true; g.add(m); return g;
}
const disg = {};
for (const k in HIDE_KINDS) { disg[k] = propMesh(hideProp(k), worldMesh.material); disg[k].visible = false; scene.add(disg[k]); }
function drawHides() {
  hideGroup.clear();
  for (const h of level.hides || []) {
    const r = new THREE.Mesh(ringGeo, ringMat); r.position.set(h.x, Z + .3, -h.y); r.renderOrder = 2; hideGroup.add(r);
    const hint = propMesh(hideProp(h.k), hintMat); hint.position.set(h.x, Z, -h.y); hint.children[0].castShadow = false; hideGroup.add(hint);
  }
}
const hideAt = (x, y) => (level.hides || []).findIndex(h => Math.hypot(x - h.x, y - h.y) < HIDE_R);
// partículas al transformarse
const puffs = [], puffGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
function puff(x, y) {
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: i % 3 ? 0x3be07c : 0xffffff, transparent: true, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, sp = 8 + Math.random() * 10;
    m.position.set(x, Z + 3 + Math.random() * 8, -y); m.userData = { vx: Math.cos(a) * sp, vy: 6 + Math.random() * 10, vz: Math.sin(a) * sp, life: .5 };
    scene.add(m); puffs.push(m);
  }
}
function updPuffs(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const m = puffs[i], u = m.userData; u.life -= dt;
    if (u.life <= 0) { scene.remove(m); m.material.dispose(); puffs.splice(i, 1); continue; }
    m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt; u.vy -= 30 * dt; m.material.opacity = u.life * 2;
  }
}

// ---------- intro: dormido en el escritorio, suena el teléfono, despierta ----------
const INTRO = 3.4;                       // duración en segundos (se salta con cualquier tecla o toque)
const SLEEP = { lean: .95, armW: 1.45, sit: 1, lift: 0 }, STAND = { lean: 0, armW: 0, sit: 0, lift: 0 }, ip = { ...SLEEP };
let intro = -1, rang = false, chairSlide = 0;
const ease = k => k * k * (3 - 2 * k), mix = (a, b, k) => a + (b - a) * k;
function poseSit(ch, x, y, ang, q) { // lean: inclinación hacia el escritorio · armW: brazos en el mundo · sit: 1 sentado, 0 de pie
  ch.root.position.set(x, Z, -y); ch.root.rotation.y = ang;
  const th = -q.lean; ch.body.rotation.z = th; ch.body.scale.y = 1;
  ch.body.position.set(5 * Math.sin(th), 5 * (1 - Math.cos(th)) - 1 * q.sit + q.lift, 0); // gira alrededor de la cadera
  ch.legL.rotation.z = ch.legR.rotation.z = q.sit * Math.PI / 2 + q.lean;
  ch.armL.rotation.z = ch.armR.rotation.z = q.armW + q.lean;
}
function voxMesh(list) {
  let w = 1, d = 1, h = 1; for (const [x, y, z] of list) { w = Math.max(w, x + 1); d = Math.max(d, y + 1); h = Math.max(h, z + 1); }
  const a = new Uint8Array(w * d * h); for (const [x, y, z, c] of list) a[x + y * w + z * w * d] = c;
  const m = new THREE.Mesh(buildGeo((x, y, z) => (x < 0 || y < 0 || z < 0 || x >= w || y >= d || z >= h) ? 0 : a[x + y * w + z * w * d], w, d, h), worldMesh.material);
  m.rotation.x = -Math.PI / 2; m.castShadow = m.receiveShadow = true; return m;
}
const chairMesh = voxMesh(chairVox); scene.add(chairMesh);
const phone = new THREE.Group(); box(phone, 1.4, .5, 2.4, 0x15171a, 0, .25, 0);
const phoneScreen = box(phone, 1, .12, 1.8, 0, 0, .52, 0); phoneScreen.material = new THREE.MeshBasicMaterial({ color: 0x1a2a22 }); scene.add(phone);
let actx;
function ring() { // timbre de teléfono con Web Audio, sin archivos
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)(); const t0 = actx.currentTime;
    for (let i = 0; i < 2; i++) for (const f of [440, 480]) {
      const o = actx.createOscillator(), g = actx.createGain(), s0 = t0 + i * .5; o.frequency.value = f;
      g.gain.setValueAtTime(0, s0); g.gain.linearRampToValueAtTime(.06, s0 + .02); g.gain.setValueAtTime(.06, s0 + .35); g.gain.linearRampToValueAtTime(0, s0 + .4);
      o.connect(g).connect(actx.destination); o.start(s0); o.stop(s0 + .45);
    }
  } catch (e) {}
}
function updIntro(dt) {
  intro += dt; const T = intro;
  Object.assign(player, { x: seat.x, y: seat.y, ang: Math.PI / 2, moving: false });
  Object.assign(ip, SLEEP); ip.lean += .04 * Math.sin(T * 3); chairSlide = 0;          // respira dormido
  if (!rang && T > .6) { rang = true; ring(); }
  if (T > 1.8) { const k = ease(Math.min(1, (T - 1.8) / .25)); ip.lean = mix(SLEEP.lean, -.3, k); ip.armW = mix(SLEEP.armW, 2.8, k); ip.lift = Math.sin(Math.min(1, (T - 1.8) / .4) * Math.PI) * 1.6; } // ¡se despierta de golpe!
  if (T > 2.2) { const k = ease(Math.min(1, (T - 2.2) / .4)); ip.lean = mix(-.3, 0, k); ip.armW = mix(2.8, 0, k); }
  if (T > 2.7) { const k = ease(Math.min(1, (T - 2.7) / .5)); ip.sit = 1 - k; chairSlide = 3 * k; }                         // se levanta y empuja la silla
  if (T >= INTRO) finishIntro();
}
function finishIntro() { intro = -1; Object.assign(ip, STAND); chairSlide = 3; Object.assign(player, { x: seat.x, y: seat.y }); }
const bub = $('#bubble'), bv = new THREE.Vector3();
function updStartDesk() {
  chairMesh.position.set(seat.ox, Z, -seat.oy + chairSlide);
  const ringing = mode === 'play' && intro > .6 && intro < 1.8, j = () => ringing ? (Math.random() - .5) * .5 : 0;
  phone.position.set(seat.ox + 2.5 + j(), Z + 7, -(seat.oy + 10.5) + j());
  phoneScreen.material.color.setHex(ringing && Math.floor(intro * 8) % 2 ? 0x3be07c : 0x1a2a22);
  const bt = intro - 1;
  if (!bub) return;
  if (mode !== 'play' || intro < 0 || bt < 0) { bub.style.opacity = 0; return; }
  const sc = bt < .25 ? (bt / .25) * (1 + .4 * Math.sin(bt / .25 * Math.PI)) : 1;
  bv.set(seat.x, Z + 21, -seat.y).project(cam);
  bub.style.left = ((bv.x + 1) / 2 * stage.clientWidth) + 'px'; bub.style.top = ((1 - bv.y) / 2 * stage.clientHeight) + 'px';
  bub.style.transform = `translate(-26px, -100%) scale(${sc})`; bub.style.opacity = intro > INTRO - .3 ? (INTRO - intro) / .3 : 1;
}

// ---------- puerta EXIT: se abre al acercarte; el nivel termina solo al cruzarla ----------
const EXIT_R = 16; // radio de acción de la puerta en vóxeles
let doorWant = false;
const glassMat = new THREE.MeshLambertMaterial({ color: 0x9cf0c4, transparent: true, opacity: .5, depthWrite: false });
function makeLeaf() {
  const g = new THREE.Group(), w = (EXIT.x1 + 1 - EXIT.x0) / 2, h = EXIT.h;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - .8, h - .8, .3), glassMat); glass.position.y = h / 2; g.add(glass);
  box(g, .5, h, .8, 0x4d555c, -w / 2 + .25, h / 2, 0); box(g, .5, h, .8, 0x4d555c, w / 2 - .25, h / 2, 0);
  box(g, w, .5, .8, 0x4d555c, 0, h - .25, 0); box(g, w, .8, .8, 0x4d555c, 0, .4, 0);
  return g;
}
const leafL = makeLeaf(), leafR = makeLeaf(); scene.add(leafL, leafR);
const exitGlowMat = new THREE.MeshBasicMaterial({ color: 0x06140c }); // lo que se ve detrás de la puerta
const exitGlow = new THREE.Mesh(new THREE.PlaneGeometry(EXIT.x1 + 1 - EXIT.x0, EXIT.h), exitGlowMat);
exitGlow.position.set(EXIT.cx, Z + EXIT.h / 2, -(EXIT.y + 2.05)); scene.add(exitGlow);
const exitLight = new THREE.PointLight(0x5dffa0, 0, 45, 2); exitLight.position.set(EXIT.cx, Z + 12, -(EXIT.y - 3)); scene.add(exitLight);
const glowDark = new THREE.Color(0x06140c), glowOn = new THREE.Color(0x8dffbf);
function doorSound() {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)(); const t0 = actx.currentTime;
    const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(240, t0); o.frequency.exponentialRampToValueAtTime(560, t0 + .3);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.05, t0 + .05); g.gain.exponentialRampToValueAtTime(.0001, t0 + .4);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + .45);
  } catch (e) {}
}
function updDoors(dt) {
  if (mode === 'edit') doorWant = false;
  doorOpen = Math.min(1, Math.max(0, doorOpen + (doorWant ? 1 : -1) * dt * 2.4));
  const k = ease(doorOpen), w = (EXIT.x1 + 1 - EXIT.x0) / 2;
  leafL.visible = leafR.visible = exitGlow.visible = exitOk;
  exitGlow.position.set(EXIT.cx, Z + EXIT.h / 2, -(EXIT.y + 2.05)); exitLight.position.set(EXIT.cx, Z + 12, -(EXIT.y - 3));
  leafL.position.set(EXIT.x0 + w / 2 - k * w, Z, -(EXIT.y + 1.5)); // las hojas se esconden dentro de la pared
  leafR.position.set(EXIT.x0 + w * 1.5 + k * w, Z, -(EXIT.y + 1.5));
  exitGlowMat.color.copy(glowDark).lerp(glowOn, k); exitLight.intensity = 900 * k;
}

// ---------- persecución (alerta tipo sigilo clásico) ----------
// patrol → (te ve, barra llena) → alert: salto + "!" → chase: te persigue → si te pierde de vista → search: "?" va a donde te vio
// → return: vuelve a su ruta. Si te alcanza durante la persecución, pierdes.
const CHASE_SPEED = 17, SEARCH_SPEED = 11, ALERT_FREEZE = .7, LOSE_TIME = 2.5, SEARCH_TIME = 3.5, CATCH_DIST = 3.5;
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
let walk = new Uint8Array(W * D), chaseField = null, chaseFieldT = 0, alerts = 0;
function computeWalk() { for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) walk[x + y * W] = free(x + .5, y + .5, 1.2) ? 1 : 0; }
function flowFrom(tx, ty) { // distancia en pasos hasta (tx, ty): los agentes bajan por este campo y rodean los muebles
  const dist = new Int32Array(W * D).fill(-1), q = new Int32Array(W * D); let h = 0, n = 0;
  const sx = Math.min(W - 1, Math.max(0, Math.floor(tx))), sy = Math.min(D - 1, Math.max(0, Math.floor(ty)));
  dist[sx + sy * W] = 0; q[n++] = sx + sy * W;
  while (h < n) {
    const i = q[h++], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= D) continue;
      const j = nx + ny * W; if (dist[j] >= 0 || !walk[j]) continue;
      if (dx && dy && (!walk[nx + y * W] || !walk[x + ny * W])) continue; // sin cortar esquinas
      dist[j] = dist[i] + 1; q[n++] = j;
    }
  }
  return dist;
}
function turnTo(a, ang, k) { let d = ang - a.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); a.ang += d * Math.min(1, k); }
function stepFlow(a, field, speed, dt) {
  const cx = Math.floor(a.x), cy = Math.floor(a.y); let bd = field[cx + cy * W], best = null;
  if (bd < 0) bd = 1e9;
  if (bd === 0) return false;                       // llegó
  for (const [dx, dy] of DIRS8) {
    const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= D) continue;
    const d = field[nx + ny * W]; if (d >= 0 && d < bd) { bd = d; best = [nx + .5, ny + .5]; }
  }
  if (!best) return false;
  const ddx = best[0] - a.x, ddy = best[1] - a.y, l = Math.hypot(ddx, ddy), k = Math.min(1, speed * dt / Math.max(l, 1e-3));
  a.x += ddx * k; a.y += ddy * k; a.moving = true; turnTo(a, Math.atan2(ddy, ddx), dt * 10);
  return true;
}
function alertSound() {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)(); const t0 = actx.currentTime;
    const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square';
    o.frequency.setValueAtTime(660, t0); o.frequency.exponentialRampToValueAtTime(1500, t0 + .09);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.07, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .4);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + .45);
  } catch (e) {}
}
function startAlert(a) { a.state = 'alert'; a.timer = ALERT_FREEZE; a.hopT = 0; a.meter = 1; alerts++; alertSound(); }
const hopY = a => a.hopT < .35 ? Math.sin(a.hopT / .35 * Math.PI) * 3 : 0;
function rebuild() { compose(); computeWalk(); syncAgents(); resetAgents(); drawRoutes(); drawHides(); refreshStatus(); Object.assign(player, { x: seat.x, y: seat.y }); save(); }
function change(fn) { pushHist(); fn(); rebuild(); }

// ---------- editor UI ----------
let mode = 'edit', tool = 'place', sel = 'desk', rotN = 0, selAgent = 0;
const tips = { place: 'Clic en el piso para colocar · R rota', erase: 'Clic sobre un prop para borrarlo', player: 'Clic donde empieza el jugador (con su escritorio)', route: 'Clic para agregar puntos a la ruta del agente seleccionado', hide: 'Clic para poner una zona de camuflaje · Borrar la quita', floorAdd: 'Clic o arrastra para agregar piso', floorDel: 'Clic o arrastra para quitar piso', exit: 'Clic junto a una pared del fondo para poner la salida' };
function renderToolbar() {
  const props = Object.entries(PROPS).map(([k, p]) => `<button data-prop="${k}" class="${tool === 'place' && sel === k ? 'on' : ''}">${p.n}</button>`).join('');
  const ags = level.agents.map((_, i) => `<button class="route-only ${selAgent === i ? 'on' : ''}" data-agent="${i}"><span class="dot" style="background:${hex(ACOL[i % ACOL.length])}"></span>A${i + 1}</button>`).join('');
  $('#toolbar').innerHTML = props + `<span class="sep"></span>
    <button data-act="rot">Rotar ⟳</button>
    <button data-tool="erase" class="${tool === 'erase' ? 'on' : ''}">Borrar</button>
    <button data-tool="player" class="${tool === 'player' ? 'on' : ''}">Jugador</button>
    <button data-tool="route" class="${tool === 'route' ? 'on' : ''}">Rutas</button>
    <button data-tool="floorAdd" class="${tool === 'floorAdd' ? 'on' : ''}">Piso +</button>
    <button data-tool="floorDel" class="${tool === 'floorDel' ? 'on' : ''}">Piso −</button>
    <button data-tool="exit" class="${tool === 'exit' ? 'on' : ''}">Salida</button>
    ${Object.entries(HIDE_KINDS).map(([k, h]) => `<button data-hide="${k}" class="${tool === 'hide' && hideKind === k ? 'on' : ''}">${h.label}</button>`).join('')}
    <span class="sep route-only"></span>${ags}
    <button class="route-only" data-act="newA">+ Agente</button>
    <button class="route-only" data-act="popW">Quitar punto</button>
    <button class="route-only" data-act="delA">Borrar agente</button>`;
  document.body.classList.toggle('route', tool === 'route');
  $('#tip').textContent = tips[tool];
}
$('#toolbar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.prop) { tool = 'place'; sel = b.dataset.prop; }
  else if (b.dataset.tool) tool = b.dataset.tool;
  else if (b.dataset.hide) { tool = 'hide'; hideKind = b.dataset.hide; }
  else if (b.dataset.agent) selAgent = +b.dataset.agent;
  else if (b.dataset.act === 'rot') rotN = (rotN + 1) % 4;
  else if (b.dataset.act === 'newA') { change(() => level.agents.push([])); selAgent = level.agents.length - 1; }
  else if (b.dataset.act === 'popW' && level.agents[selAgent]?.length) change(() => level.agents[selAgent].pop());
  else if (b.dataset.act === 'delA' && level.agents[selAgent]) { change(() => level.agents.splice(selAgent, 1)); selAgent = Math.max(0, selAgent - 1); }
  renderToolbar(); updateHover();
});
function undo() { if (!hist.length) return; level = JSON.parse(hist.pop()); selAgent = Math.min(selAgent, Math.max(0, level.agents.length - 1)); rebuild(); renderToolbar(); }
$('#undoBtn').addEventListener('click', undo);

// picking
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Z), hit = new THREE.Vector3();
function pick(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, cam); return ray.ray.intersectPlane(floorPlane, hit) ? { x: hit.x, y: -hit.z } : null;
}
function deskFits(ox, oy) { // el escritorio inicial puede pisar su propia posición anterior
  for (const [x, y] of startFoot) { const X = ox + x, Y = oy + y, i = X + Y * W; if (X < 2 || Y < 2 || X > W - 3 || Y > D - 3 || (colH[i] && !sdCells.has(i))) return false; }
  return true;
}
function fits(t, r, px, py) {
  const Rr = rot(t, r);
  for (const k of Rr.foot) { const [x, y] = k.split(',').map(Number), X = px + x, Y = py + y; if (X < 2 || Y < 2 || X > W - 3 || Y > D - 3 || colH[X + Y * W]) return false; }
  return true;
}
const snapPos = (t, r, p) => { const Rr = rot(t, r); return [Math.round((p.x - Rr.w / 2) / 2) * 2, Math.round((p.y - Rr.d / 2) / 2) * 2]; };
function propAt(x, y) { for (let i = level.props.length - 1; i >= 0; i--) { const p = level.props[i], Rr = rot(p.t, p.r); if (x >= p.x && x < p.x + Rr.w && y >= p.y && y < p.y + Rr.d) return i; } return -1; }
let lastP = null, painting = false;
const tileOf = p => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
function setTile(i, j, on) {
  if (i < 0 || j < 0 || i >= TW || j >= TD) return false;
  const row = level.floor[j], v = on ? '1' : '0'; if (row[i] === v) return false;
  level.floor[j] = row.slice(0, i) + v + row.slice(i + 1); return true;
}
function paintAt(p) { const [i, j] = tileOf(p); if (setTile(i, j, tool === 'floorAdd')) rebuild(); }
const exitSpot = p => { // busca la pared del fondo más cercana en esa columna (clic en el piso o sobre la pared)
  const i = Math.floor(p.x / TILE); let j = Math.max(0, Math.min(TD - 1, Math.floor(p.y / TILE)));
  if (tileOn(i, j)) while (tileOn(i, j + 1)) j++; else while (j > 0 && !tileOn(i, j)) j--;
  return [Math.round(p.x - 5.5), (j + 1) * TILE - 2];
};
function updateHover() {
  ghost.visible = hoverBox.visible = false; if (mode !== 'edit' || !lastP) return;
  if (tool === 'place') {
    const [px, py] = snapPos(sel, rotN, lastP); ghost.geometry = ghostGeo(sel, rotN); ghost.position.set(px, Z, -py);
    ghostMat.color.setHex(fits(sel, rotN, px, py) ? 0xb8ffd0 : 0xff6a6a); ghost.visible = true;
  } else if (tool === 'player') {
    const [ox, oy] = deskOrigin([lastP.x, lastP.y]); ghost.geometry = ghostGeo('desk', 0); ghost.position.set(ox, Z, -oy);
    ghostMat.color.setHex(deskFits(ox, oy) ? 0xb8ffd0 : 0xff6a6a); ghost.visible = true;
  } else if (tool === 'floorAdd' || tool === 'floorDel') {
    const [i, j] = tileOf(lastP); if (i < 0 || j < 0 || i >= TW || j >= TD) return;
    hoverBox.scale.set(TILE, .6, TILE); hoverBox.position.set(i * TILE + TILE / 2, Z + .3, -(j * TILE + TILE / 2));
    hoverBox.material.color.setHex(tool === 'floorAdd' ? 0x3be07c : 0xff4d4d); hoverBox.visible = true;
  } else if (tool === 'exit') {
    const [x0, wy] = exitSpot(lastP);
    hoverBox.scale.set(13, 23, 2); hoverBox.position.set(x0 + 5.5, Z + 11.5, -(wy + 1));
    hoverBox.material.color.setHex(exitValid(x0, wy) ? 0x3be07c : 0xff4d4d); hoverBox.visible = true;
  } else if (tool === 'hide') {
    const g = disg[hideKind]; // vista previa: el disfraz semitransparente en el cursor
    hoverBox.scale.set(HIDE_R * 2, .6, HIDE_R * 2); hoverBox.position.set(lastP.x, Z + .3, -lastP.y);
    hoverBox.material.color.setHex(free(lastP.x, lastP.y, 3) ? 0x3be07c : 0xff4d4d); hoverBox.visible = true;
  } else if (tool === 'erase') {
    const hi = hideAt(lastP.x, lastP.y);
    if (hi >= 0) { const h = level.hides[hi]; hoverBox.material.color.setHex(0xff4d4d); hoverBox.scale.set(HIDE_R * 2, 10, HIDE_R * 2); hoverBox.position.set(h.x, Z + 5, -h.y); hoverBox.visible = true; return; }
    hoverBox.material.color.setHex(0xff4d4d);
    const i = propAt(lastP.x, lastP.y); if (i < 0) return; const p = level.props[i], Rr = rot(p.t, p.r);
    hoverBox.scale.set(Rr.w + .4, Rr.h + .4, Rr.d + .4); hoverBox.position.set(p.x + Rr.w / 2, Z + Rr.h / 2, -(p.y + Rr.d / 2)); hoverBox.visible = true;
  }
}
function editClick(p) {
  if (tool === 'floorAdd' || tool === 'floorDel') { const [i, j] = tileOf(p); pushHist(); if (setTile(i, j, tool === 'floorAdd')) rebuild(); else hist.pop(); painting = true; updateHover(); return; }
  if (tool === 'exit') { const [x0, wy] = exitSpot(p); if (exitValid(x0, wy)) change(() => level.exit = { x: x0, y: wy }); updateHover(); return; }
  if (tool === 'place') { const [px, py] = snapPos(sel, rotN, p); if (fits(sel, rotN, px, py)) change(() => level.props.push({ t: sel, x: px, y: py, r: rotN })); }
  else if (tool === 'erase') {
    const hi = hideAt(p.x, p.y);
    if (hi >= 0) change(() => level.hides.splice(hi, 1));
    else { const i = propAt(p.x, p.y); if (i >= 0) change(() => level.props.splice(i, 1)); }
  }
  else if (tool === 'hide') { if (free(p.x, p.y, 3)) change(() => (level.hides ||= []).push({ x: Math.round(p.x), y: Math.round(p.y), k: hideKind })); }
  else if (tool === 'player') { const [ox, oy] = deskOrigin([p.x, p.y]); if (deskFits(ox, oy)) change(() => level.player = [ox + SEAT[0], oy + SEAT[1]]); }
  else if (tool === 'route') {
    if (!level.agents.length) { change(() => level.agents.push([])); selAgent = 0; renderToolbar(); }
    if (free(p.x, p.y, 1.2)) change(() => level.agents[selAgent].push([Math.round(p.x), Math.round(p.y)]));
  }
  updateHover();
}

// ---------- JSON modal ----------
const jm = $('#jsonModal'), jmsg = $('#jsonMsg');
$('#jsonBtn').addEventListener('click', () => { $('#jsonTxt').value = JSON.stringify(level); jmsg.textContent = ''; jm.hidden = false; });
$('#closeBtn').addEventListener('click', () => jm.hidden = true);
$('#copyBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#jsonTxt').value); jmsg.textContent = 'Copiado.'; } catch (e) { $('#jsonTxt').select(); jmsg.textContent = 'Selecciona el texto y cópialo a mano.'; } });
$('#loadBtn').addEventListener('click', () => {
  try {
    const l = JSON.parse($('#jsonTxt').value);
    if (!Array.isArray(l.props) || !Array.isArray(l.agents) || !Array.isArray(l.player)) throw 0;
    l.props = l.props.filter(p => PROPS[p.t]); change(() => level = l); selAgent = 0; renderToolbar(); jm.hidden = true;
  } catch (e) { jmsg.textContent = 'Ese JSON no es un nivel válido.'; }
});
$('#resetBtn').addEventListener('click', async () => { const l = await loadLevel(); change(() => level = l); selAgent = 0; renderToolbar(); jm.hidden = true; });
let flashT;
const flash = msg => { $('#tip').textContent = msg; clearTimeout(flashT); flashT = setTimeout(() => $('#tip').textContent = tips[tool], 3500); };
$('#saveBtn').addEventListener('click', async () => {
  const body = JSON.stringify(level, null, 1);
  try {
    const r = await fetch(`api/level?name=${LEVEL_NAME}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!r.ok) throw new Error(r.status);
    try { localStorage.removeItem(LS); } catch (e) {}
    flash(`Guardado en public/levels/${LEVEL_NAME}.json`);
  } catch (e) { // sin el servidor de Vite: descarga el archivo
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    a.download = LEVEL_NAME + '.json'; a.click(); flash('Sin servidor de desarrollo: se descargó el JSON');
  }
});

// ---------- play ----------
let t = 0, time = 0, crouch = false, frozen = 0, cool = 0, maxSeen = 0, usedGlitch = false;
const keys = {};
function setMode(m) {
  mode = m; resize(); snapCam = true; document.body.classList.toggle('play', m !== 'edit'); $('#endModal').hidden = true;
  routeGroup.visible = m === 'edit'; updateHover();
  resetAgents(); Object.assign(player, { x: seat.x, y: seat.y, ang: Math.PI / 2 });
  intro = m === 'play' ? 0 : -1; Object.assign(ip, SLEEP); rang = false; chairSlide = 0;
  time = frozen = cool = maxSeen = alerts = chaseFieldT = doorOpen = 0; doorWant = false; usedGlitch = false; setCrouch(false); hiddenKind = null; popT = 1;
  $('#alarm').style.boxShadow = ''; $('#fx').style.opacity = 0; $('#meter i').style.width = '0';
}
function setCrouch(v) { crouch = v; $('#crouch')?.classList.toggle('on', v); }
function doGlitch() { if (mode !== 'play' || cool > 0) return; frozen = 2.5; cool = 8; usedGlitch = true; }
$('#testBtn').addEventListener('click', () => setMode('play'));
$('#backBtn').addEventListener('click', () => setMode('edit'));
$('#crouch')?.addEventListener('pointerdown', e => { e.preventDefault(); setCrouch(!crouch); });
$('#glitch')?.addEventListener('pointerdown', e => { e.preventDefault(); doGlitch(); });
addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA') return;
  keys[e.code] = true;
  if (mode === 'edit') {
    if (e.code === 'KeyR') { rotN = (rotN + 1) % 4; updateHover(); }
    if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
    if (e.code === 'Delete' || e.code === 'Backspace') { tool = 'erase'; renderToolbar(); updateHover(); }
  } else if (mode === 'play' && intro >= 0) { if (intro > .3) finishIntro();
  } else if (mode === 'play') {
    if (e.code === 'KeyC' || e.code === 'ShiftLeft') setCrouch(!crouch);
    if (e.code === 'Space') { e.preventDefault(); doGlitch(); }
    if (e.code === 'Escape' && EDITOR) setMode('edit');
  } else if (mode === 'over' && e.code === 'Enter') setMode('play');
});
addEventListener('keyup', e => keys[e.code] = false);
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }, joyEl = $('#joy'), knob = $('#joy b');
stage.addEventListener('pointermove', e => {
  if (mode === 'edit') { lastP = pick(e); if (painting && lastP && (e.buttons & 1)) paintAt(lastP); updateHover(); return; }
  if (e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), m = 46;
  if (l > m) { dx *= m / l; dy *= m / l; }
  joy.x = dx / m; joy.y = -dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`;
});
stage.addEventListener('pointerdown', e => {
  if (mode === 'edit') { const p = pick(e); if (p) { lastP = p; editClick(p); } return; }
  if (mode === 'play' && intro >= 0) { if (intro > .3) finishIntro(); return; }
  if (mode !== 'play' || joy.id !== null) return;
  Object.assign(joy, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
  joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; joyEl.style.display = 'block'; stage.setPointerCapture(e.pointerId);
});
const endJoy = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; joyEl.style.display = 'none'; knob.style.transform = ''; };
stage.addEventListener('pointerup', endJoy); addEventListener('pointerup', () => { painting = false; }); stage.addEventListener('pointercancel', endJoy);
stage.addEventListener('pointerleave', () => { if (mode === 'edit') { lastP = null; updateHover(); } });

function end(html) {
  mode = 'over';
  $('#endCard').innerHTML = html + `<div class="row"><button class="on" id="again">Reintentar</button>${EDITOR ? '<button id="toEdit">Volver al editor</button>' : ''}</div>`;
  $('#endModal').hidden = false; $('#again').onclick = () => setMode('play'); if (EDITOR) $('#toEdit').onclick = () => setMode('edit'); $('#again').focus();
}
function update(dt) {
  time += dt; frozen = Math.max(0, frozen - dt); cool = Math.max(0, cool - dt);
  let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  let iy = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y;
  const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
  const mx = (ix - iy) * Math.SQRT1_2, my = (ix + iy) * Math.SQRT1_2;
  player.moving = il > .15;
  if (player.moving) {
    const sp = (crouch ? PLAYER_SPEED_CROUCH : PLAYER_SPEED) * dt;
    if (free(player.x + mx * sp, player.y)) player.x += mx * sp;
    if (free(player.x, player.y + my * sp)) player.y += my * sp;
    let d = Math.atan2(my, mx) - player.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); player.ang += d * Math.min(1, dt * 14);
  }
  // camuflaje: dentro de una zona el jugador se vuelve planta o basurero
  const hz = hideAt(player.x, player.y), nk = hz >= 0 ? level.hides[hz].k : null;
  if (nk !== hiddenKind) { hiddenKind = nk; popT = 0; puff(player.x, player.y); }
  const nearExit = exitOk && Math.hypot(player.x - EXIT.cx, player.y - EXIT.cy) < EXIT_R;
  if (nearExit && !doorWant) doorSound(); doorWant = nearExit;
  let top = 0, alertOn = false, cautionOn = false, caughtBy = null;
  if ((chaseFieldT -= dt) <= 0 && agents.some(a => a.state === 'chase')) { chaseField = flowFrom(player.x, player.y); chaseFieldT = .2; }
  for (const a of agents) {
    if (!a.path.length) continue; a.moving = false; a.hopT += dt;
    if (frozen <= 0) {
      const dx = player.x - a.x, dy = player.y - a.y, dist = Math.hypot(dx, dy), toP = Math.atan2(dy, dx);
      let rel = toP - a.ang; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const los = !hiddenKind && rayDist(a.x, a.y, toP, dist, crouch ? 6 : 12) >= dist - 1.5;
      const seen = los && ((dist < R && Math.abs(rel) < HALF) || (a.state === 'chase' && dist < 12));
      const heard = !hiddenKind && dist < ACTION_R;  // dentro del radio de acción, aunque esté de espaldas
      if (a.state === 'alert') {                     // salto de sorpresa, mira al jugador
        a.timer -= dt; turnTo(a, toP, dt * 10);
        if (a.timer <= 0) { a.state = 'chase'; a.lose = 0; a.lastX = player.x; a.lastY = player.y; a.lastField = null; chaseFieldT = 0; }
      } else if (a.state === 'chase') {
        if (seen || heard) { a.lose = 0; a.lastX = player.x; a.lastY = player.y; a.lastField = null; if (chaseField) stepFlow(a, chaseField, CHASE_SPEED, dt); }
        else {                                       // te perdió: corre a donde te vio por última vez
          a.lose += dt * (hiddenKind ? 2 : 1);
          a.lastField ||= flowFrom(a.lastX, a.lastY);
          if (!stepFlow(a, a.lastField, CHASE_SPEED * .85, dt)) a.ang += dt * 2.5;
        }
        a.meter = 1;
        if (dist < CATCH_DIST && !hiddenKind) caughtBy = a;
        if (a.lose >= LOSE_TIME) { a.state = 'search'; a.timer = SEARCH_TIME; a.meter = .5; }
      } else {
        if (seen) { a.meter += dt * (1.1 + (1 - dist / R) * 2.6) * (crouch ? .7 : 1) * (a.state === 'patrol' ? 1 : 2); a.lost = 1.6; }
        else if (heard) { a.meter += dt * (crouch ? .6 : 1.4) * (a.state === 'patrol' ? 1 : 2); a.lost = 1.6; } // agachado haces menos ruido
        else a.meter = Math.max(a.state === 'search' ? .3 : 0, a.meter - dt * .5);
        if (dist < 4 && !hiddenKind) a.meter = 1;
        if (a.meter >= 1) startAlert(a);
        else if (a.state === 'search') {             // revisa el último lugar donde te vio
          a.lastField ||= flowFrom(a.lastX, a.lastY);
          if (!stepFlow(a, a.lastField, SEARCH_SPEED, dt)) { a.ang += dt * 2.2; a.timer -= dt; }
          if (a.timer <= 0) { a.state = 'return'; a.retField = flowFrom(...a.path[a.wp]); }
        } else if (a.state === 'return') {           // vuelve a su ruta
          const [tx, ty] = a.path[a.wp];
          if (Math.hypot(tx - a.x, ty - a.y) < 1.5 || !stepFlow(a, a.retField, 9, dt)) { a.state = 'patrol'; a.meter = 0; a.wait = .6; a.base = a.ang; }
        } else if (a.lost > 0) { a.lost -= dt; if (seen || heard) turnTo(a, toP, dt * 3); }
        else if (a.path.length < 2) a.ang += dt * .9;
        else if (a.wait > 0) { a.wait -= dt; a.ang = a.base + Math.sin((1.2 - a.wait) * 2.6) * .8; }
        else {
          const [tx, ty] = a.path[a.wp], ddx = tx - a.x, ddy = ty - a.y, l = Math.hypot(ddx, ddy), sp = 9 * dt;
          if (l < sp) { a.x = tx; a.y = ty; a.wait = 1.2; a.base = a.ang; if (a.wp + a.dir >= a.path.length || a.wp + a.dir < 0) a.dir *= -1; a.wp += a.dir; }
          else { a.x += ddx / l * sp; a.y += ddy / l * sp; a.moving = true; turnTo(a, Math.atan2(ddy, ddx), dt * 6); }
        }
      }
    }
    if (a.state === 'alert' || a.state === 'chase') alertOn = true; else if (a.state === 'search' || a.state === 'return') cautionOn = true;
    top = Math.max(top, a.meter);
  }
  maxSeen = Math.max(maxSeen, top);
  $('#meter i').style.width = (alertOn || cautionOn ? 100 : Math.min(100, top * 100)) + '%';
  const semaRGB = alertOn ? '255,42,42' : (cautionOn || top > .05) ? '255,204,0' : '34,255,119';
  $('#meter i').style.background = `rgb(${semaRGB})`;
  const al = alertOn ? .7 + .3 * Math.sin(time * 10) : cautionOn ? .35 : top * .8; // en alerta el borde late
  $('#alarm').style.boxShadow = `inset 0 0 ${al * 80}px ${al * 14}px rgba(${semaRGB},${al * .55})`;
  $('#fx').style.opacity = frozen > 0 ? 1 : 0;
  $('#glitch')?.style.setProperty('--cd', ((1 - cool / 8) * 360) + 'deg');
  $('#info').textContent = time.toFixed(1) + ' s';
  if (caughtBy) { end(`<h2>Te atraparon</h2><p>Cuando suene la alerta, corre: de pie eres más rápido que ellos. Rompe su línea de vista o métete en un escondite verde.</p>`); }
  else if (exitOk && doorOpen > .8 && player.y >= EXIT.y - .5 && player.x > EXIT.x0 && player.x < EXIT.x1 + 1) { // ya cruzó la puerta
    const st = [true, time < 40, alerts === 0];
    end(`<h2>¡Escapaste!</h2><div class="stars">${st.map(s => `<span class="${s ? '' : 'off'}">★</span>`).join('')}</div><p>${time.toFixed(1)} s · ★ escapar · ★ menos de 40 s · ★ sin alertas${usedGlitch ? ' · usaste el glitch' : ''}</p>`);
  }
}

// ---------- loop ----------
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight, a = w / h; renderer.setSize(w, h, false);
  // editor: toda la oficina; jugando: cámara cerca que sigue al jugador
  const half = mode === 'edit' ? (a < 1.25 ? 94 / a : 76) : (a < 1 ? CAM_PLAY_HALF * .9 / a : CAM_PLAY_HALF);
  cam.left = -half * a; cam.right = half * a; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();
rebuild(); renderToolbar();
if (EDITOR) { setMode('edit'); const tt = document.querySelector('.title'); if (tt) tt.textContent = 'Editor · ' + LEVEL_NAME; }
else {
  setMode('play');
  end(`<h2>Escapa de la oficina</h2><p>Llega al EXIT sin que los agentes te vean. Agáchate detrás de los escritorios o párate en los círculos verdes para camuflarte.</p>`);
  $('#again').textContent = 'Jugar';
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
  if (mode === 'play') { if (intro >= 0) updIntro(dt); else update(dt); }
  if (intro >= 0 || mode === 'edit') poseSit(player.ch, seat.x, seat.y, Math.PI / 2, ip);
  else pose(player.ch, player.x, player.y, player.ang, t, mode === 'play' && player.moving, crouch);
  updStartDesk(); updDoors(dt); drawRain(dt);
  popT += dt; updPuffs(dt);
  const pop = popT < .25 ? (popT / .25) * (1 + .35 * Math.sin(popT / .25 * Math.PI)) : 1; // aparece con rebote
  const disguised = mode !== 'edit' && hiddenKind;
  player.ch.root.visible = !disguised; player.ch.root.scale.setScalar(disguised ? 1 : pop);
  for (const k in disg) { const g = disg[k]; g.visible = disguised === k; if (g.visible) { g.position.set(player.x, Z, -player.y); g.scale.setScalar(pop); } }
  hideGroup.visible = true; ringMat.opacity = .4 + .2 * Math.sin(t * 4);
  for (const a of agents) if (a.path.length) { pose(a.ch, a.x, a.y, a.ang, frozen > 0 ? 0 : t * (a.state === 'chase' ? 1.6 : 1), a.moving && frozen <= 0, false); if (a.state === 'alert') a.ch.root.position.y += hopY(a); updFan(a); }
  if (mode === 'edit') camGoal.copy(CENTER); else camGoal.set(player.x, Z + 6, -player.y);
  const zoomGoal = intro >= 0 ? (intro < 2.7 ? 1.4 : 1) : mode === 'play' && player.moving ? (crouch ? (1 + CAM_WALK_ZOOM) / 2 : CAM_WALK_ZOOM) : 1;
  cam.zoom = snapCam ? zoomGoal : cam.zoom + (zoomGoal - cam.zoom) * Math.min(1, dt * CAM_ZOOM_SPEED); cam.updateProjectionMatrix();
  target.lerp(camGoal, snapCam ? 1 : Math.min(1, dt * 6)); snapCam = false;
  cam.position.copy(target).add(CAM_OFF); cam.lookAt(target);
  renderer.render(scene, cam); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
}
