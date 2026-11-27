import * as THREE from 'three';
import { W, D, Z, TILE, TW, TD, LEVEL_NAME, MIN_TILES, MAX_TILES, $ } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { HIDE_R, HIDE_KINDS, BOMB } from '../Settings.js';
import { renderer, scene, cam, stage, shiftView, rotateView, resetView } from '../Core/Engine.js';
import { M } from '../Materials/Materials.js';
import { PROPS, rot, propGeo } from '../Data/PropLibrary.js';
import { loadLevel, saveLevelFile, LS } from '../Data/LevelIO.js';
import { colH, free } from '../World/Grid.js';
import { tileOn, exitValid, entranceValid, entranceGeom, doorsClash } from '../World/ShellBuilder.js';
import { exitReachable } from '../World/Navigation.js';
import { deskOrigin, deskFits, SEAT, ENTRANCE_STEP } from '../Prefabs/StartDesk.js';
import { hideAt } from '../Prefabs/HideSpot.js';
import { agentType } from '../Prefabs/Agent.js';
import { camSpot, camAt } from '../Prefabs/SecurityCam.js';
import { laserEnds, laserAt } from '../Prefabs/LaserGate.js';
import { gateAt } from '../Prefabs/SecurityGate.js';
import { rebuild } from './Level.js';
import { setMode } from './GameScene.js';

// Editor de niveles: herramientas, vista previa bajo el cursor, rutas de agentes, deshacer y guardar.
let tool = 'place', sel = 'desk', rotN = 0, selAgent = 0, hideKind = 'plant';
let laserDir = 'x', lastP = null, painting = false, ghost, hoverBox, routeGroup, edgeGuide, badRoutes = [];
const hist = [];
const ROUTE_COLORS = [0xff4d4d, 0xffb020, 0x4db8ff, 0xc77dff, 0xff7ac6, 0x9cff57];
const hex = c => '#' + c.toString(16).padStart(6, '0');
const TIPS = {
  place: 'Clic en el piso para colocar · R rota · botón derecho: girar la vista (V la endereza)', erase: 'Clic sobre un prop o una baldosa glitch para borrarlo', player: 'Clic donde empieza el jugador (con su escritorio)',
  route: 'Clic para agregar puntos a la ruta del agente seleccionado', gate: 'Clic en el piso para poner barrotes de pared a pared · R cambia la dirección · Borrar los quita', laser: 'Clic en el piso para tender un láser de pared a pared · R cambia la dirección · Borrar lo quita', cam: 'Clic junto a una pared (del fondo o del costado) para colgar una cámara · Borrar la quita', bomb: 'Clic en el piso para poner un punto donde cae una bomba · clic sobre una para quitarla', hide: 'Clic para poner una zona de camuflaje · Borrar la quita',
  floorAdd: 'Clic o arrastra para agregar piso con paredes · pinta fuera del borde (línea punteada) para agrandar el nivel', floorOpen: 'Clic o arrastra para poner piso abierto, sin paredes ni barandas · fuera del borde agranda el nivel', floorDel: 'Clic o arrastra para quitar piso · las orillas vacías se recortan solas', glitch: 'Clic o arrastra sobre el piso para marcar baldosas glitch (parpadean y desaparecen; si el jugador está encima, cae) · clic en una marcada la quita (también Borrar, o pintar piso encima)', exit: 'Clic junto a una pared (del fondo o del costado) para poner la salida; el botón del ascensor queda a su derecha',
  crystal: 'Clic en el piso para poner el cristal (fragmento de realidad) de este piso',
  portal: 'Clic en el piso para poner el portal de salida de la Matrix (se abre con todos los cristales)',
  callBtn: 'Clic junto a una pared para poner el botón que llama al ascensor (reemplaza al de la puerta)',
  entrance: 'Clic junto a una pared (del fondo o del costado) para poner la entrada: el jugador sale de ahí en vez de despertar en su escritorio' };

// ---------- historial ----------
const pushHist = () => { hist.push(JSON.stringify(G.level)); if (hist.length > 60) hist.shift(); };
function change(fn) { pushHist(); fn(); rebuild(); }
function undo() { if (!hist.length) return; G.level = JSON.parse(hist.pop()); selAgent = Math.min(selAgent, Math.max(0, G.level.agents.length - 1)); rebuild(); renderToolbar(); }

// ---------- rutas y estado (se rehacen con cada cambio del nivel) ----------
const segOk = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let d = 0; d <= l; d += .5) { const t = l ? d / l : 0; if (!free(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1.2)) return false; } return true; };
function drawRoutes() {
  routeGroup.clear(); badRoutes = [];
  G.level.agents.forEach((p, i) => {
    const c = ROUTE_COLORS[i % ROUTE_COLORS.length]; let ok = true;
    p.forEach((w, j) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(j ? 2 : 3, 1, j ? 2 : 3), new THREE.MeshBasicMaterial({ color: c })); m.position.set(w[0], Z + .6, -w[1]); routeGroup.add(m);
      if (j) {
        const bad = !segOk(p[j - 1], w); if (bad) ok = false;
        const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p[j - 1][0], Z + .6, -p[j - 1][1]), new THREE.Vector3(w[0], Z + .6, -w[1])]);
        routeGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: bad ? 0xff2222 : c })));
      }
    });
    if (!ok) badRoutes.push(i + 1);
  });
}
function refreshStatus() {
  const ok = exitReachable(), L = G.level;
  $('#status').innerHTML = `Camino al EXIT: <b class="${ok ? '' : 'bad'}">${!G.exitOk ? 'falta la salida' : ok ? 'libre' : 'bloqueado'}</b>` +
    ` · ${L.props.some(p => p.t.startsWith('MainFrame')) ? '◆ cristal: lo suelta el jefe' : L.props.some(p => p.t === 'safe') ? '◆ cristal en la caja fuerte' : L.crystal ? '◆ cristal' : '<b class="bad">sin cristal</b>'}${L.portal ? ' · portal' : ''}` +
    (L.entrance ? ` · inicio: <b class="${G.entOk ? '' : 'bad'}">${G.entOk ? 'entrada' : 'entrada inválida'}</b>` : '') +
    (badRoutes.length ? ` · <b class="bad">ruta ${badRoutes.join(', ')} choca</b>` : '') + ` · ${TW} × ${TD} baldosas · ${L.props.length} props · ${L.agents.filter(a => a.length).length} agentes · ${(L.cams || []).length} cámaras · ${(L.lasers || []).length} láseres · ${(L.gates || []).length} barrotes · ${(L.bombs || []).length} bombas · ${(L.hides || []).length} escondites`;
}
export function onLevelRebuilt() { drawRoutes(); refreshStatus(); drawEdge(); }
export function onModeChange(m) { routeGroup.visible = edgeGuide.visible = m === 'edit'; if (m === 'edit' && pendingDraft) adoptDraft(); updateHover(); }

// varias pestañas del mismo nivel: si otra pestaña cambia el borrador, esta lo adopta (así una pestaña vieja
// no pisa tu trabajo cuando la página se recarga). Si estás probando, se aplica al volver al editor.
let pendingDraft = null;
function adoptDraft() {
  try { G.level = JSON.parse(pendingDraft); } catch (e) { pendingDraft = null; return; }
  pendingDraft = null; selAgent = Math.min(selAgent, Math.max(0, G.level.agents.length - 1));
  rebuild(); renderToolbar(); flash('Se actualizó con los cambios hechos en otra pestaña');
}

// franja punteada alrededor del nivel: pintar piso ahí lo agranda (hasta MAX_TILES × MAX_TILES baldosas)
let edgeKey = '';
function drawEdge() {
  if (edgeKey === W + 'x' + D) return; edgeKey = W + 'x' + D;
  const m = TILE, y = Z + .2, pts = [[-m, -m], [W + m, -m], [W + m, D + m], [-m, D + m], [-m, -m]].map(([x, z]) => new THREE.Vector3(x, y, -z));
  edgeGuide.geometry.dispose(); edgeGuide.geometry = new THREE.BufferGeometry().setFromPoints(pts); edgeGuide.computeLineDistances();
}

// ---------- barra de herramientas: pestañas por tema y, debajo, las herramientas de esa pestaña ----------
// Nivel: forma del piso, salida e inicio · Props: selector de objetos · Agentes: rutas · Escondites · Borrar (aparte, en rojo)
const TABS = { level: 'Nivel', props: 'Props', agents: 'Agentes', cams: 'Seguridad', hides: 'Escondites' };
const TAB_OF = { glitch: 'level', floorAdd: 'level', floorOpen: 'level', floorDel: 'level', exit: 'level', callBtn: 'level', crystal: 'level', portal: 'level', entrance: 'level', player: 'level', place: 'props', route: 'agents', hide: 'hides', cam: 'cams', laser: 'cams', gate: 'cams', bomb: 'cams', erase: 'erase' };
const TAB_TOOL = { level: 'floorAdd', props: 'place', agents: 'route', hides: 'hide', cams: 'cam', erase: 'erase' }; // herramienta al abrir la pestaña
// grupos del selector de props (los que no estén aquí aparecen en "Otros")
const PROP_GROUPS = { Muebles: ['desk', 'cabinet', 'micro', 'copier', 'cooler'], 'Decoración': ['plant', 'plant_s', 'trash'], Paredes: ['panel', 'muro'], Seguridad: ['rack', 'tower', 'safe'], Enemigos: ['bee'], Jefes: ['MainFrame'], Final: ['realityportal'] };

function propSelect() {
  const used = new Set(Object.values(PROP_GROUPS).flat());
  const groups = { ...PROP_GROUPS, Otros: Object.keys(PROPS).filter(k => !used.has(k) && !k.startsWith('vigia')) }; // vigia*: es el modelo del dron, no un mueble
  const opts = Object.entries(groups).map(([g, ks]) => {
    const o = ks.filter(k => PROPS[k]).map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${PROPS[k].n}</option>`).join('');
    return o ? `<optgroup label="${g}">${o}</optgroup>` : '';
  }).join('');
  return `<label class="field">Prop <select id="propSel">${opts}</select></label>`;
}

function renderToolbar() {
  const tab = TAB_OF[tool], on = t => tool === t ? 'on' : '';
  const tabs = Object.entries(TABS).map(([k, n]) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')
    + `<span class="grow"></span><button class="tab danger ${tab === 'erase' ? 'on' : ''}" data-tab="erase">Borrar</button>`;
  let tools = '';
  if (tab === 'level') tools = `
    <button data-tool="floorAdd" class="${on('floorAdd')}">Piso +</button>
    <button data-tool="floorOpen" class="${on('floorOpen')}">Piso abierto</button>
    <button data-tool="floorDel" class="${on('floorDel')}">Piso −</button>
    <button data-tool="glitch" class="${on('glitch')}">Piso glitch</button>${tool === 'glitch' ? glitchTools() : ''}
    <span class="sep"></span>
    <button data-tool="exit" class="${on('exit')}">Salida</button>
    <button data-tool="callBtn" class="${on('callBtn')}">Botón ascensor</button>${G.level.callBtn ? '<button data-act="delBtn">Quitar botón</button>' : ''}
    <button data-tool="entrance" class="${on('entrance')}">Entrada</button>
    <button data-tool="crystal" class="${on('crystal')}">Cristal</button>${G.level.crystal ? '<button data-act="delCrystal">Quitar cristal</button>' : ''}
    <button data-tool="portal" class="${on('portal')}">Portal</button>${G.level.portal ? '<button data-act="delPortal">Quitar portal</button>' : ''}${G.level.entrance ? '<button data-act="delEnt">Quitar entrada</button>' : ''}
    <button data-tool="player" class="${on('player')}">Inicio del jugador</button>`;
  else if (tab === 'props') tools = propSelect() + `<button data-act="rot">Rotar ⟳ <small>${rotN * 90}°</small></button>`;
  else if (tab === 'agents') tools = G.level.agents.map((_, i) =>
      `<button class="${selAgent === i ? 'on' : ''} ${agentType(i) === 'red' ? 'redagent' : agentType(i) === 'vigia' ? 'vigiaagent' : ''}" data-agent="${i}"><span class="dot" style="background:${hex(ROUTE_COLORS[i % ROUTE_COLORS.length])}"></span>${{ red: 'R', vigia: 'V' }[agentType(i)] || 'A'}${i + 1}</button>`).join('')
    + `<span class="sep"></span><button data-act="newA">+ Agente</button><button data-act="newR" class="redagent">+ Agente rojo</button><button data-act="newV" class="vigiaagent">+ Vigía</button>`
    + (G.level.agents[selAgent] ? `<button data-act="typeA">Hacer ${{ normal: 'rojo', red: 'vigía', vigia: 'normal' }[agentType(selAgent)]}</button>` : '')
    + `<button data-act="popW">Quitar punto</button><button data-act="delA">Borrar agente</button>`;
  else if (tab === 'hides') tools = Object.entries(HIDE_KINDS).map(([k, h]) => `<button data-hide="${k}" class="${hideKind === k ? 'on' : ''}">${h.label.replace('Escondite ', '')}</button>`).join('');
  else if (tab === 'cams') tools = `<button data-tool="cam" class="${on('cam')}">Cámara</button><button data-tool="laser" class="${on('laser')}">Láser</button><button data-tool="gate" class="${on('gate')}">Barrotes</button><button data-tool="bomb" class="${on('bomb')}">Bomba</button>`
    + (tool === 'gate' ? `<button data-act="laserDir">Dirección: ${laserDir === 'x' ? '↘ ↖' : '↗ ↙'} (R)</button><span class="note">Puerta de seguridad: se cierra unos segundos cuando suena una alarma; solo frena al jugador (GATE en Settings.js).</span>`
      : tool === 'laser' ? `<button data-act="laserDir">Dirección: ${laserDir === 'x' ? '↘ ↖' : '↗ ↙'} (R)</button><span class="note">Va de pared a pared por donde hagas clic. Se prende y apaga (LASER en Settings.js).</span>`
      : tool === 'bomb' ? `<span class="note">Cae del techo al empezar; el jugador la recoge y se la lanza al primer agente cercano (BOMB en Settings.js).</span>`
      : `<span class="note">Las cámaras barren de lado a lado; si te ven, llaman a todos los agentes (CAMERA en Settings.js).</span>`);
  else tools = `<span class="note">Clic sobre un prop, una cámara o un escondite para quitarlo · el piso se quita con Nivel › Piso −</span>`;
  $('#toolbar').innerHTML = `<div class="tabs">${tabs}</div><div class="tools">${tools}</div>`;
  $('#tip').textContent = TIPS[tool];
}

// ---------- ayudas de colocación ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Z), hit = new THREE.Vector3();
function pick(e) { // punto del piso bajo el cursor (en coordenadas de vóxel)
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, cam); return ray.ray.intersectPlane(floorPlane, hit) ? { x: hit.x, y: -hit.z } : null;
}
function fits(t, r, px, py) {
  for (const k of rot(t, r).foot) { const [x, y] = k.split(',').map(Number), X = px + x, Y = py + y; if (X < 2 || Y < 2 || X > W - 3 || Y > D - 3 || colH[X + Y * W]) return false; }
  return true;
}
const snapPos = (t, r, p) => { const Rr = rot(t, r); return [Math.round((p.x - Rr.w / 2) / 2) * 2, Math.round((p.y - Rr.d / 2) / 2) * 2]; };
const bombAt = (x, y) => (G.level.bombs || []).findIndex(b => Math.hypot(b.x - x, b.y - y) < 5);
function propAt(x, y) { const L = G.level.props; for (let i = L.length - 1; i >= 0; i--) { const p = L[i], Rr = rot(p.t, p.r); if (x >= p.x && x < p.x + Rr.w && y >= p.y && y < p.y + Rr.d) return i; } return -1; }
const tileOf = p => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
const FLOOR_TOOLS = { floorAdd: '1', floorOpen: '2', floorDel: '0' };   // valor que pinta cada herramienta
// ---------- tamaño del nivel: crece al pintar fuera del borde y se recorta al quitar piso de una orilla ----------
// piso glitch: botones de patrón y velocidad, y pintar/quitar baldosas
const GL_PAT = { all: 'Todas juntas', wave: 'Ola', checker: 'Ajedrez' }, GL_SPD = [.6, 1, 1.5];
const GL_SPD_N = { .6: 'lento', 1: 'normal', 1.5: 'rápido' };
function glitchTools() {
  const g = G.level.glitch || {};
  return `<button data-act="glPat">Patrón: ${GL_PAT[g.pattern || 'all']}</button><button data-act="glSpd">Velocidad: ${GL_SPD_N[g.speed || 1] || g.speed}</button>`
    + ((g.tiles || []).length ? `<button data-act="glClear">Quitar todas</button>` : '');
}
let glitchPaint = null;                                // al arrastrar: true = marcar, false = quitar
function glitchAt(p, start) {
  const [i, j] = tileOf(p), L = G.level;
  if (i < 0 || j < 0 || j >= L.floor.length || i >= L.floor[0].length || L.floor[j][i] === '0') return;
  const g = (L.glitch ||= { tiles: [], pattern: 'all', speed: 1 }), k = g.tiles.findIndex(([a, b]) => a === i && b === j);
  if (start) glitchPaint = k < 0;
  if (glitchPaint && k < 0) g.tiles.push([i, j]); else if (!glitchPaint && k >= 0) g.tiles.splice(k, 1); else return;
  rebuild();
}

// quita la marca glitch de una baldosa (queda el piso normal debajo). Devuelve true si había una.
function unglitch(i, j) {
  const g = G.level.glitch, k = g ? g.tiles.findIndex(([a, b]) => a === i && b === j) : -1;
  if (k < 0) return false;
  g.tiles.splice(k, 1); if (!g.tiles.length) delete G.level.glitch; return true;
}
const glitchTileAt = p => { const [i, j] = tileOf(p); return (G.level.glitch?.tiles || []).some(([a, b]) => a === i && b === j) ? [i, j] : null; };

function shiftLevel(dx, dy) {          // mueve todo el contenido del nivel (en vóxeles)
  const L = G.level;
  for (const t of L.glitch?.tiles || []) { t[0] += dx / TILE; t[1] += dy / TILE; }
  for (const p of L.props) { p.x += dx; p.y += dy; }
  for (const r of L.agents) for (const w of r) { w[0] += dx; w[1] += dy; }
  for (const h of L.hides) { h.x += dx; h.y += dy; }
  for (const c of L.cams) { c.x += dx; c.y += dy; }
  for (const l of L.lasers) { l.x += dx; l.y += dy; }
  for (const g of L.gates || []) { g.x += dx; g.y += dy; }
  for (const b of L.bombs || []) { b.x += dx; b.y += dy; }
  L.exit.x += dx; L.exit.y += dy; L.player[0] += dx; L.player[1] += dy; if (L.entrance) { L.entrance.x += dx; L.entrance.y += dy; } if (L.callBtn) { L.callBtn.x += dx; L.callBtn.y += dy; } for (const o of [L.crystal, L.portal]) if (o) { o.x += dx; o.y += dy; }
  shiftView(dx, dy);                   // la cámara se mueve igual, así no salta la vista
}
function trimFloor() {                 // quita filas y columnas vacías de las orillas
  const L = G.level, empty = s => !/[12]/.test(s);
  while (L.floor[0].length > MIN_TILES && L.floor.every(r => r[0] === '0')) { L.floor = L.floor.map(r => r.slice(1)); shiftLevel(-TILE, 0); }
  while (L.floor[0].length > MIN_TILES && L.floor.every(r => r.at(-1) === '0')) L.floor = L.floor.map(r => r.slice(0, -1));
  while (L.floor.length > MIN_TILES && empty(L.floor[0])) { L.floor.shift(); shiftLevel(0, -TILE); }
  while (L.floor.length > MIN_TILES && empty(L.floor.at(-1))) L.floor.pop();
}
function setTile(i, j, v) {
  const L = G.level; let fw = L.floor[0].length, fd = L.floor.length;
  if (i < -1 || j < -1 || i > fw || j > fd) return false;                          // solo la franja de una baldosa alrededor
  if (i < 0 || j < 0 || i >= fw || j >= fd) {                                    // fuera del borde: agranda el nivel
    if (v === '0') return false;
    if ((i < 0 || i >= fw) && fw >= MAX_TILES || (j < 0 || j >= fd) && fd >= MAX_TILES) { flash(`El nivel ya tiene el tamaño máximo (${MAX_TILES} × ${MAX_TILES} baldosas)`); return false; }
    if (i < 0) { L.floor = L.floor.map(r => '0' + r); shiftLevel(TILE, 0); i = 0; } else if (i >= fw) L.floor = L.floor.map(r => r + '0');
    if (j < 0) { L.floor.unshift('0'.repeat(L.floor[0].length)); shiftLevel(0, TILE); j = 0; } else if (j >= fd) L.floor.push('0'.repeat(L.floor[0].length));
  }
  const F = L.floor, row = F[j]; if (row[i] === v) return false;
  F[j] = row.slice(0, i) + v + row.slice(i + 1);
  if (v === '0') trimFloor();
  return true;
}
const paintAt = p => { if (tool === 'glitch') return glitchAt(p, false); const [i, j] = tileOf(p), ug = unglitch(i, j); if (setTile(i, j, FLOOR_TOOLS[tool]) || ug) rebuild(); };   // pintar piso encima de un glitch lo reemplaza
// la entrada: mismas reglas que la salida y sin pisarla
const entranceOk = en => {   // pared válida, sin pisar la salida y con espacio delante para salir caminando
  if (!en || !entranceValid(en) || doorsClash(en, G.level.exit)) return false;
  const N = entranceGeom(en);
  for (let d = -3; d >= -ENTRANCE_STEP; d--) { const [x, y] = N.point(5.5, d); if (!free(x, y, 1.5)) return false; }
  return true;
};
// pared más cercana al cursor para la entrada: la del fondo de esa columna o la lateral de esa fila
const exitOkAt = ex => !!ex && entranceValid(ex) && !doorsClash(ex, G.level.entrance);   // salida: pared válida y sin pisar la entrada
const doorSpot = (p, ok) => {   // pared más cercana al cursor (del fondo de esa columna o lateral de esa fila); ok: si sirve
  const [x0, wy] = exitSpot(p), back = { x: x0, y: wy };
  let j = Math.max(0, Math.min(TD - 1, Math.floor(p.y / TILE))), i = Math.max(0, Math.min(TW - 1, Math.floor(p.x / TILE)));
  if (tileOn(i, j)) while (tileOn(i - 1, j)) i--; else while (i < TW - 1 && !tileOn(i, j)) i++;
  const left = { x: i * TILE, y: Math.round(p.y - 5.5), side: 'left' };
  const dist = en => { const N = entranceGeom(en); return Math.hypot(N.cx - p.x, N.cy - p.y) + (ok(en) ? 0 : 1000); };
  return dist(left) < dist(back) ? left : back;
};
const entranceSpot = p => doorSpot(p, entranceOk), exitSpotAny = p => doorSpot(p, exitOkAt);
// vista previa de una puerta (salida o entrada) en su pared
function showDoor(en, ok, color) {
  const N = entranceGeom(en), [x, y] = N.point(5.5, 1);
  if (N.side === 'left') showBox(2, 23, 13, x, Z + 11.5, -y, ok); else showBox(13, 23, 2, x, Z + 11.5, -y, ok);
  if (ok && color) hoverBox.material.color.setHex(color);
}
const exitSpot = p => { // pared del fondo más cercana en esa columna (clic en el piso o sobre la pared)
  const i = Math.floor(p.x / TILE); let j = Math.max(0, Math.min(TD - 1, Math.floor(p.y / TILE)));
  if (tileOn(i, j)) while (tileOn(i, j + 1)) j++; else while (j > 0 && !tileOn(i, j)) j--;
  return [Math.round(p.x - 5.5), (j + 1) * TILE - 2];
};

// ---------- vista previa bajo el cursor ----------
function showBox(sx, sy, sz, x, y, z, ok) { hoverBox.scale.set(sx, sy, sz); hoverBox.position.set(x, y, z); hoverBox.material.color.setHex(ok ? 0x3be07c : 0xff4d4d); hoverBox.visible = true; }
function showGhost(t, r, x, y, ok) { ghost.geometry = propGeo(t, r); ghost.position.set(x, Z, -y); M.ghost.color.setHex(ok ? 0xb8ffd0 : 0xff6a6a); ghost.visible = true; }
function updateHover() {
  ghost.visible = hoverBox.visible = false; if (G.mode !== 'edit' || !lastP) return;
  const p = lastP;
  if (tool === 'place') { const [px, py] = snapPos(sel, rotN, p); showGhost(sel, rotN, px, py, fits(sel, rotN, px, py)); }
  else if (tool === 'player') { const [ox, oy] = deskOrigin([p.x, p.y]); showGhost('desk', 0, ox, oy, deskFits(ox, oy)); }
  else if (tool === 'glitch') { const [i, j] = tileOf(p); showBox(TILE, .6, TILE, i * TILE + TILE / 2, Z + .3, -(j * TILE + TILE / 2), true); hoverBox.material.color.setHex(0x3be07c); }
  else if (tool in FLOOR_TOOLS) { const [i, j] = tileOf(p), m = tool === 'floorDel' ? 0 : 1; if (i >= -m && j >= -m && i < TW + m && j < TD + m) { showBox(TILE, .6, TILE, i * TILE + TILE / 2, Z + .3, -(j * TILE + TILE / 2), tool !== 'floorDel'); if (tool === 'floorOpen') hoverBox.material.color.setHex(0x4db8ff); } }
  else if (tool === 'exit') { const ex = exitSpotAny(p); showDoor(ex, exitOkAt(ex)); }
  else if (tool === 'entrance') { const en = entranceSpot(p); showDoor(en, entranceOk(en), 0x4db8ff); }
  else if (tool === 'crystal') showBox(3, 6, 3, p.x, Z + 6, -p.y, free(p.x, p.y, 2));
  else if (tool === 'portal') showBox(14, 17, 14, p.x, Z + 8.5, -p.y, free(p.x, p.y, 6));
  else if (tool === 'callBtn') { const s = camSpot(p.x, p.y); if (s) showBox(3, 5, 3, s.x - Math.cos(s.a) * 2, Z + 10, -(s.y - Math.sin(s.a) * 2), true); else showBox(3, .6, 3, p.x, Z + .3, -p.y, false); }
  else if (tool === 'hide') showBox(HIDE_R * 2, .6, HIDE_R * 2, p.x, Z + .3, -p.y, free(p.x, p.y, 3));
  else if (tool === 'cam') { const s = camSpot(p.x, p.y); if (s) showBox(4, 21, 4, s.x, Z + 10.5, -s.y, true); else showBox(4, .6, 4, p.x, Z + .3, -p.y, false); }
  else if (tool === 'laser') { const [a, b] = laserEnds(Math.floor(p.x), Math.floor(p.y), laserDir), len = Math.hypot(b[0] - a[0], b[1] - a[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (laserDir === 'x') showBox(len, 14, 1, mx, Z + 8, -my, len >= 2); else showBox(1, 14, len, mx, Z + 8, -my, len >= 2); }
  else if (tool === 'bomb') { const bi = bombAt(p.x, p.y); if (bi >= 0) { const b = G.level.bombs[bi]; showBox(9, 9, 9, b.x, Z + 4.5, -b.y, false); } else showBox(BOMB.pickR * 2, .6, BOMB.pickR * 2, p.x, Z + .3, -p.y, free(p.x, p.y, 4)); }
  else if (tool === 'gate') { const [a, b] = laserEnds(Math.floor(p.x), Math.floor(p.y), laserDir), len = Math.hypot(b[0] - a[0], b[1] - a[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (laserDir === 'x') showBox(len, 20, 1.5, mx, Z + 10, -my, len >= 2); else showBox(1.5, 20, len, mx, Z + 10, -my, len >= 2); }
  else if (tool === 'erase') {
    const bi = bombAt(p.x, p.y);
    if (bi >= 0) { const b = G.level.bombs[bi]; showBox(9, 9, 9, b.x, Z + 4.5, -b.y, false); return; }
    const gi = gateAt(p.x, p.y);
    if (gi >= 0) { const d = G.level.gates[gi], [a, b] = laserEnds(Math.floor(d.x), Math.floor(d.y), d.dir), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d.dir === 'x') showBox(len, 21, 2, (a[0] + b[0]) / 2, Z + 10, -(a[1] + b[1]) / 2, false); else showBox(2, 21, len, (a[0] + b[0]) / 2, Z + 10, -(a[1] + b[1]) / 2, false); return; }
    const li = laserAt(p.x, p.y);
    if (li >= 0) { const d = G.level.lasers[li], [a, b] = laserEnds(Math.floor(d.x), Math.floor(d.y), d.dir), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d.dir === 'x') showBox(len, 15, 2, (a[0] + b[0]) / 2, Z + 8, -(a[1] + b[1]) / 2, false); else showBox(2, 15, len, (a[0] + b[0]) / 2, Z + 8, -(a[1] + b[1]) / 2, false); return; }
    const ci = camAt(p.x, p.y);
    if (ci >= 0) { const c = G.level.cams[ci]; showBox(5, 22, 5, c.x, Z + 11, -c.y, false); return; }
    const hi = hideAt(p.x, p.y);
    if (hi >= 0) { const h = G.level.hides[hi]; showBox(HIDE_R * 2, 10, HIDE_R * 2, h.x, Z + 5, -h.y, false); return; }
    const i = propAt(p.x, p.y);
    if (i < 0) { const gt = glitchTileAt(p); if (gt) showBox(TILE, .6, TILE, gt[0] * TILE + TILE / 2, Z + .3, -(gt[1] * TILE + TILE / 2), false); return; }   // baldosa glitch
    const q = G.level.props[i], Rr = rot(q.t, q.r);
    showBox(Rr.w + .4, Rr.h + .4, Rr.d + .4, q.x + Rr.w / 2, Z + Rr.h / 2, -(q.y + Rr.d / 2), false);
  }
}

// ---------- clic con cada herramienta ----------
function editClick(p) {
  const L = G.level;
  if (tool in FLOOR_TOOLS) { const [i, j] = tileOf(p); pushHist(); const ug = unglitch(i, j); if (setTile(i, j, FLOOR_TOOLS[tool]) || ug) { rebuild(); renderToolbar(); } else hist.pop(); painting = true; }
  else if (tool === 'glitch') { pushHist(); glitchAt(p, true); painting = true; renderToolbar(); }
  else if (tool === 'exit') { const ex = exitSpotAny(p); if (exitOkAt(ex)) change(() => L.exit = ex); }
  else if (tool === 'entrance') { const en = entranceSpot(p); if (entranceOk(en)) { change(() => L.entrance = en); renderToolbar(); } }
  else if (tool === 'crystal') { if (free(p.x, p.y, 2)) { change(() => L.crystal = { x: Math.round(p.x), y: Math.round(p.y) }); renderToolbar(); } }
  else if (tool === 'portal') { if (free(p.x, p.y, 6)) { change(() => L.portal = { x: Math.round(p.x), y: Math.round(p.y) }); renderToolbar(); } }
  else if (tool === 'callBtn') { const s = camSpot(p.x, p.y); if (s) { change(() => L.callBtn = { x: s.x, y: s.y, a: +s.a.toFixed(4) }); renderToolbar(); } }
  else if (tool === 'place') { const [px, py] = snapPos(sel, rotN, p); if (fits(sel, rotN, px, py)) change(() => L.props.push({ t: sel, x: px, y: py, r: rotN })); }
  else if (tool === 'cam') { const s = camSpot(p.x, p.y); if (s) change(() => L.cams.push({ x: s.x, y: s.y, a: +s.a.toFixed(4) })); }
  else if (tool === 'laser') { const [a, b] = laserEnds(Math.floor(p.x), Math.floor(p.y), laserDir); if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= 2) change(() => L.lasers.push({ x: Math.floor(p.x), y: Math.floor(p.y), dir: laserDir })); }
  else if (tool === 'gate') { const [a, b] = laserEnds(Math.floor(p.x), Math.floor(p.y), laserDir); if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= 2) change(() => (L.gates ||= []).push({ x: Math.floor(p.x), y: Math.floor(p.y), dir: laserDir })); }
  else if (tool === 'bomb') { const bi = bombAt(p.x, p.y); if (bi >= 0) change(() => L.bombs.splice(bi, 1)); else if (free(p.x, p.y, 4)) change(() => (L.bombs ||= []).push({ x: Math.round(p.x), y: Math.round(p.y) })); }
  else if (tool === 'erase') {
    const li = laserAt(p.x, p.y), ci = camAt(p.x, p.y), hi = hideAt(p.x, p.y), bi = bombAt(p.x, p.y);
    const gi = gateAt(p.x, p.y);
    if (bi >= 0) change(() => L.bombs.splice(bi, 1));
    else if (gi >= 0) change(() => L.gates.splice(gi, 1));
    else if (li >= 0) change(() => L.lasers.splice(li, 1));
    else if (ci >= 0) change(() => L.cams.splice(ci, 1));
    else if (hi >= 0) change(() => L.hides.splice(hi, 1));
    else { const i = propAt(p.x, p.y), gt = glitchTileAt(p);
      if (i >= 0) change(() => L.props.splice(i, 1));
      else if (gt) change(() => unglitch(gt[0], gt[1]));                    // baldosa glitch → piso normal
    }
  }
  else if (tool === 'hide') { if (free(p.x, p.y, 3)) change(() => L.hides.push({ x: Math.round(p.x), y: Math.round(p.y), k: hideKind })); }
  else if (tool === 'player') { const [ox, oy] = deskOrigin([p.x, p.y]); if (deskFits(ox, oy)) change(() => L.player = [ox + SEAT[0], oy + SEAT[1]]); }
  else if (tool === 'route') {
    if (!L.agents.length) { change(() => L.agents.push([])); selAgent = 0; renderToolbar(); }
    if (free(p.x, p.y, 1.2)) change(() => G.level.agents[selAgent].push([Math.round(p.x), Math.round(p.y)]));
  }
  updateHover();
}

// ---------- JSON y guardar ----------
let flashT;
const flash = msg => { $('#tip').textContent = msg; clearTimeout(flashT); flashT = setTimeout(() => $('#tip').textContent = TIPS[tool], 3500); };
function initJsonPanel() {
  const jm = $('#jsonModal'), jmsg = $('#jsonMsg');
  $('#jsonBtn').addEventListener('click', () => { $('#jsonTxt').value = JSON.stringify(G.level); jmsg.textContent = ''; jm.hidden = false; });
  $('#closeBtn').addEventListener('click', () => jm.hidden = true);
  $('#copyBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#jsonTxt').value); jmsg.textContent = 'Copiado.'; } catch (e) { $('#jsonTxt').select(); jmsg.textContent = 'Selecciona el texto y cópialo a mano.'; } });
  $('#loadBtn').addEventListener('click', () => {
    try {
      const l = JSON.parse($('#jsonTxt').value);
      if (!Array.isArray(l.props) || !Array.isArray(l.agents) || !Array.isArray(l.player)) throw 0;
      l.props = l.props.filter(p => PROPS[p.t]); change(() => G.level = l); selAgent = 0; renderToolbar(); jm.hidden = true;
    } catch (e) { jmsg.textContent = 'Ese JSON no es un nivel válido.'; }
  });
  $('#resetBtn').addEventListener('click', async () => { const l = await loadLevel(); change(() => G.level = l); selAgent = 0; renderToolbar(); jm.hidden = true; });
  $('#saveBtn').addEventListener('click', async () => flash(await saveLevelFile(G.level)));
}

export function initEditor() {
  ghost = new THREE.Mesh(new THREE.BufferGeometry(), M.ghost); ghost.rotation.x = -Math.PI / 2; ghost.visible = false; ghost.renderOrder = 3; scene.add(ghost);
  hoverBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: .3, depthWrite: false }));
  hoverBox.visible = false; scene.add(hoverBox);
  routeGroup = new THREE.Group(); scene.add(routeGroup);
  edgeGuide = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x3be07c, dashSize: 2, gapSize: 2, transparent: true, opacity: .7 })); scene.add(edgeGuide);

  $('#toolbar').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const L = G.level;
    if (b.dataset.tab) tool = TAB_TOOL[b.dataset.tab];
    else if (b.dataset.tool) tool = b.dataset.tool;
    else if (b.dataset.hide) { tool = 'hide'; hideKind = b.dataset.hide; }
    else if (b.dataset.agent) { tool = 'route'; selAgent = +b.dataset.agent; }
    else if (b.dataset.act === 'rot') rotN = (rotN + 1) % 4;
    else if (b.dataset.act === 'laserDir') laserDir = laserDir === 'x' ? 'y' : 'x';
    else if (b.dataset.act === 'delEnt') change(() => delete L.entrance);
    else if (b.dataset.act === 'delBtn') change(() => delete L.callBtn);
    else if (b.dataset.act === 'delCrystal') change(() => delete L.crystal);
    else if (b.dataset.act === 'glPat') { const ks = Object.keys(GL_PAT), g = (L.glitch ||= { tiles: [], pattern: 'all', speed: 1 }); change(() => g.pattern = ks[(ks.indexOf(g.pattern || 'all') + 1) % ks.length]); renderToolbar(); }
    else if (b.dataset.act === 'glSpd') { const g = (L.glitch ||= { tiles: [], pattern: 'all', speed: 1 }); change(() => g.speed = GL_SPD[(GL_SPD.indexOf(g.speed || 1) + 1) % GL_SPD.length]); renderToolbar(); }
    else if (b.dataset.act === 'glClear') { change(() => delete L.glitch); renderToolbar(); }
    else if (b.dataset.act === 'delPortal') change(() => delete L.portal);
    else if (['newA', 'newR', 'newV'].includes(b.dataset.act)) { tool = 'route'; change(() => { L.agents.push([]); L.agentTypes.push({ newR: 'red', newV: 'vigia' }[b.dataset.act] || 'normal'); }); selAgent = G.level.agents.length - 1; }
    else if (b.dataset.act === 'typeA' && L.agents[selAgent]) change(() => { L.agentTypes[selAgent] = { normal: 'red', red: 'vigia', vigia: 'normal' }[agentType(selAgent)]; });
    else if (b.dataset.act === 'popW' && L.agents[selAgent]?.length) change(() => L.agents[selAgent].pop());
    else if (b.dataset.act === 'delA' && L.agents[selAgent]) { change(() => { L.agents.splice(selAgent, 1); L.agentTypes.splice(selAgent, 1); }); selAgent = Math.max(0, selAgent - 1); }
    renderToolbar(); updateHover();
  });
  $('#toolbar').addEventListener('change', e => { if (e.target.id === 'propSel') { sel = e.target.value; tool = 'place'; renderToolbar(); updateHover(); } });
  $('#undoBtn').addEventListener('click', undo);
  initJsonPanel();
  addEventListener('storage', e => { if (e.key !== LS || !e.newValue || e.newValue === JSON.stringify(G.level)) return; pendingDraft = e.newValue; if (G.mode === 'edit') adoptDraft(); });

  addEventListener('keydown', e => {
    if (G.mode !== 'edit' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'KeyR') { if (tool === 'laser' || tool === 'gate') laserDir = laserDir === 'x' ? 'y' : 'x'; else rotN = (rotN + 1) % 4; renderToolbar(); updateHover(); }
    if (e.code === 'KeyV') resetView();                                       // vista normal
    if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
    if (e.code === 'Delete' || e.code === 'Backspace') { tool = 'erase'; renderToolbar(); updateHover(); }
  });
  // botón derecho (o rueda apretada): girar la vista arrastrando · doble clic derecho o tecla V: vista normal
  let orbit = null, lastRight = 0;
  stage.addEventListener('contextmenu', e => { if (G.mode === 'edit') e.preventDefault(); });
  stage.addEventListener('pointermove', e => {
    if (G.mode !== 'edit') return;
    if (orbit) { rotateView(e.clientX - orbit[0], e.clientY - orbit[1]); orbit = [e.clientX, e.clientY]; return; }
    lastP = pick(e); if (painting && lastP && (e.buttons & 1)) paintAt(lastP); updateHover();
  });
  stage.addEventListener('pointerdown', e => {
    if (G.mode !== 'edit') return;
    if (e.button === 2 || e.button === 1) {
      e.preventDefault(); const t = performance.now(); if (e.button === 2 && t - lastRight < 300) resetView(); lastRight = t;
      orbit = [e.clientX, e.clientY]; ghost.visible = hoverBox.visible = false; return;
    }
    if (e.button !== 0) return;
    const p = pick(e); if (p) { lastP = p; editClick(p); }
  });
  stage.addEventListener('pointerleave', () => { if (G.mode === 'edit') { lastP = null; updateHover(); } });
  addEventListener('pointerup', () => { painting = false; orbit = null; });

  const tt = $('.title'); if (tt) tt.textContent = 'Editor · ' + LEVEL_NAME;
}

export function startEditor() { renderToolbar(); setMode('edit'); }
