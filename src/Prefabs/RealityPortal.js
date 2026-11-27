import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { cam, stage } from '../Core/Engine.js';
import { G } from '../Core/Game.js';
import { PORTAL } from '../Settings.js';
import { PROPS, rot } from '../Data/PropLibrary.js';
import { listGeo } from '../Core/VoxelMesh.js';
import { M } from '../Materials/Materials.js';
import { crystalCount, depositedCount, depositOne, hasCrystal, crystalsNeeded } from '../Data/Progress.js';
import { crystalSound } from '../Core/Audio.js';
import { puff } from '../FX/Particles.js';
import { shake, kick, flash, popText } from '../FX/Juice.js';
import { startEnding } from './Portal.js';
import { player } from './Player.js';
import { pose, poseClip } from '../Animations/CharacterPoses.js';
import { clipDuration } from '../Animations/Clips.js';

// Portal de realidad (prop "realityportal", modelo assets/vox/props/realityportal.vox: partes "base" y "plataforma").
// Pensado para el piso 1. Al acercarte al contenedor (el cilindro de vidrio de la derecha), los cristales que juntaste
// salen volando de ti y caen adentro, uno por uno; el contenedor se va llenando de luz celeste.
// Con todos los cristales (crystalsNeeded) adentro, el portal se enciende: la espiral gira brillante. Entrar = final del juego.
// Lo que va guardado: cuántos cristales echaste (Progress: depositedCount), así no hay que volver a echarlos.
const HOLE = { x: 17, y: 10, z: 17.5, w: 14, h: 21 };          // abertura de la puerta (coordenadas del modelo sin rotar)
const TANK = { x: 36.5, y: 10.5, z0: 3, z1: 14, r: 4.4 };       // vidrio del contenedor
const FRONT = { x: 17, y: 5 };                                   // dónde hay que pararse para entrar
let group, portals = [], label, banner, bannerT, flyGeo, flyMat, flying = [], cool = 0, wasOnline = false, droppedHere = 0, told = false;

const SPIRAL_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SPIRAL_FS = `
uniform float uT, uOn, uW, uH; varying vec2 vUv;
void main(){
  vec2 p = (vUv - .5) * vec2(uW, uH);
  float r = length(p), a = atan(p.y, p.x);
  float s = fract(r * .23 - a / 6.2832 - uT);                              // espiral de Arquímedes que gira hacia adentro
  float line = smoothstep(.36, .5, s) * (1. - smoothstep(.5, .64, s));
  vec3 off = vec3(.05, .09, .11) + line * vec3(.12, .2, .24);              // apagado: gris azulado casi quieto
  vec3 on = mix(vec3(.02, .25, .4), vec3(.7, .97, 1.), line) + vec3(1.) * exp(-r * .35) * .9;   // encendido: celeste con centro blanco
  float edge = smoothstep(0., 1.2, min(min(vUv.x, 1. - vUv.x) * uW, min(vUv.y, 1. - vUv.y) * uH));
  gl_FragColor = vec4(mix(off, on, uOn) * (.55 + .45 * edge), 1.);
}`;

export function initRealityPortals(scene) {
  group = new THREE.Group(); scene.add(group);
  flyGeo = new THREE.OctahedronGeometry(1.1).scale(1, 1.6, 1);
  flyMat = new THREE.MeshBasicMaterial({ color: 0x8feaff });
  label = document.createElement('div'); label.id = 'rpNum'; document.body.append(label);
  banner = document.createElement('div'); banner.id = 'rpMsg'; document.body.append(banner);   // mensaje grande al echar cristales
}

// un punto del modelo en el prop rotado r × 90° (igual que rot() rota los vóxeles)
function tp(P, r, [x, y]) { const { w, d } = P; return r === 1 ? [d - y, x] : r === 2 ? [w - x, d - y] : r === 3 ? [y, w - x] : [x, y]; }

export function syncRealityPortals() {
  for (const f of flying) group.remove(f.m); flying = [];
  group.clear(); portals = [];
  for (const p of G.level.props) {
    if (!p.t.startsWith('realityportal')) continue;
    const P = PROPS[p.t], R = rot(p.t, p.r), at = q => { const [x, y] = tp(P, p.r, [q.x, q.y]); return { x: p.x + x, y: p.y + y }; };
    // plataforma: se ve pero se camina encima (no es parte del escenario sólido)
    const floor = R.part('plataforma');
    if (floor.length) { const m = new THREE.Mesh(listGeo(floor), M.voxel); m.rotation.x = -Math.PI / 2; m.position.set(p.x, Z, -p.y); m.receiveShadow = true; group.add(m); }
    // espiral en la abertura
    const hole = at(HOLE), uni = { uT: { value: 0 }, uOn: { value: 0 }, uW: { value: HOLE.w }, uH: { value: HOLE.h } };
    const spiral = new THREE.Mesh(new THREE.PlaneGeometry(HOLE.w, HOLE.h), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: SPIRAL_VS, fragmentShader: SPIRAL_FS, side: THREE.DoubleSide }));
    spiral.position.set(hole.x, Z + HOLE.z, -hole.y); spiral.rotation.y = p.r * Math.PI / 2; group.add(spiral);
    const light = new THREE.PointLight(0x7fdcff, 0, 70, 2); light.position.set(hole.x, Z + HOLE.z, -hole.y); group.add(light);
    // contenedor: vidrio, líquido de luz que sube y los cristales flotando adentro
    const tank = at(TANK), th = TANK.z1 - TANK.z0;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(TANK.r, TANK.r, th, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.set(tank.x, Z + TANK.z0 + th / 2, -tank.y); glass.renderOrder = 3;
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(TANK.r - .4, TANK.r - .4, 1, 24).translate(0, .5, 0), new THREE.MeshBasicMaterial({ color: 0x3fc8ff, transparent: true, opacity: .45, depthWrite: false }));
    liquid.position.set(tank.x, Z + TANK.z0, -tank.y); liquid.renderOrder = 2;
    const gems = new THREE.Group(); gems.position.set(tank.x, Z + TANK.z0, -tank.y);
    for (let i = 0; i < crystalsNeeded(); i++) { const g = new THREE.Mesh(flyGeo, flyMat); g.scale.setScalar(.55); g.userData = { a: i * 2.4, h: .8 + (i / crystalsNeeded()) * (th - 1.6), r: 1.2 + (i % 3) * .9 }; gems.add(g); }
    group.add(glass, liquid, gems);
    portals.push({ hole, tank, front: at(FRONT), spiral, uni, light, liquid, gems, fill: depositedCount() / crystalsNeeded(), th });
  }
  wasOnline = online(); droppedHere = 0; told = false; banner?.classList.remove('show');
}

export const online = () => depositedCount() >= crystalsNeeded();
// para las flechas guía: contenedor del portal y cuántos cristales te faltan echar
export const portalTank = () => portals[0] ? { x: portals[0].tank.x, y: portals[0].tank.y, h: TANK.z1 } : null;
export const pendingDeposit = () => carried() - depositedCount() - flying.length;

// en el piso del portal, el ascensor queda bloqueado mientras tengas cristales sin echar al contenedor (ExitDoor.js)
export const crystalsToDrop = () => portals.length && !online() ? Math.max(0, carried() - depositedCount()) : 0;
// cristales que tienes para echar: los de pisos terminados + el que recogiste en este piso (todavía no terminado)
const carried = () => crystalCount() + (G.gotCrystal && !G.hadCrystal && !hasCrystal(G.levelName) ? 1 : 0);

// lógica (jugando): echar cristales al contenedor y entrar al portal encendido
export function updateRealityPortals(dt, p) {
  cool = Math.max(0, cool - dt);
  for (const q of portals) {
    const pending = carried() - depositedCount() - flying.length;
    if (pending > 0 && cool <= 0 && Math.hypot(p.x - q.tank.x, p.y - q.tank.y) < PORTAL.depositR) {   // lanza el siguiente cristal
      const m = new THREE.Mesh(flyGeo, flyMat); group.add(m);
      flying.push({ m, q, t: 0, from: { x: p.x, y: p.y, z: Z + 22 } }); cool = .32;
    }
    if (online() && Math.hypot(p.x - q.front.x, p.y - q.front.y) < PORTAL.enterR) { startFarewell(q); return true; }
  }
  return false;
}

// despedida antes del final: se da vuelta hacia la cámara, saluda con la mano (clip "wave") y entra caminando al portal.
// G.mode = 'farewell' mientras dura (el juego queda quieto). Después, startEnding.
const CAM_ANG = -Math.PI / 4, FW = { turn: .45, walk: 1 };   // mirando a la cámara · segundos para girar y para entrar
let farewell = null;
const lerpAng = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
function startFarewell(q) {
  G.mode = 'farewell'; G.hiddenKind = null;
  farewell = { q, t: 0, x: player.x, y: player.y, ang: player.ang, done: false };
}
// cada frame, después de las animaciones del jugador (las reemplaza)
// para desvanecer solo al jugador: copias transparentes de sus materiales (los originales se comparten con los agentes)
function setAlpha(ch, a) {
  ch.root.traverse(o => {
    if (!o.isMesh) return;
    if (a >= 1) { if (o.userData.fwMat) { o.material.dispose(); o.material = o.userData.fwMat; delete o.userData.fwMat; o.castShadow = true; } return; }
    if (!o.userData.fwMat) { o.userData.fwMat = o.material; o.material = o.material.clone(); o.material.transparent = true; }
    o.material.opacity = a; o.castShadow = a > .5;
  });
}
export function updateFarewell(dt) {
  if (G.mode === 'ending' && farewell) { player.ch.root.visible = false; return; }          // ya entró: no reaparece detrás de la pantalla final
  if (G.mode !== 'farewell' || !farewell) { if (farewell) setAlpha(player.ch, 1); farewell = null; return; }
  const f = farewell, ch = player.ch, wave = clipDuration('wave') || 2, t = (f.t += dt);
  ch.root.visible = true; ch.root.scale.setScalar(1);
  if (t < FW.turn) {                                                      // girar hacia la cámara
    const k = t / FW.turn; player.ang = lerpAng(f.ang, CAM_ANG, k * k * (3 - 2 * k));
    pose(ch, f.x, f.y, player.ang, G.t, false);
  } else if (t < FW.turn + wave) {                                        // chau, chau
    player.ang = CAM_ANG; poseClip(ch, f.x, f.y, CAM_ANG, 'wave', t - FW.turn);
  } else {                                                                // se da vuelta, camina hacia el portal y se desvanece en la luz
    const k = Math.min(1, (t - FW.turn - wave) / FW.walk), h = f.q.hole, to = Math.atan2(h.y - f.y, h.x - f.x), w = k * .6;   // no llega a meterse en el marco
    player.ang = lerpAng(CAM_ANG, to, Math.min(1, k * 4));
    player.x = f.x + (h.x - f.x) * w; player.y = f.y + (h.y - f.y) * w;
    pose(ch, player.x, player.y, player.ang, G.t, true);
    const a = 1 - Math.min(1, Math.max(0, (k - .25) / .65)); setAlpha(ch, a); ch.root.visible = a > .01;
    if (k >= 1 && !f.done) { f.done = true; startEnding(); }
  }
}

export function animateRealityPortals(dt) {
  const on = online();
  if (on && !wasOnline && G.mode === 'play') {                   // ¡se encendió!
    const q = portals[0]; shake(1); kick(.12); flash('127,220,255', .45); if (q) popText(q.hole.x, q.hole.y, 'PORTAL ONLINE', 'cyan');
  }
  wasOnline = on;
  // terminaste de echar los cristales que traías y todavía faltan: el aviso (una vez por visita al piso)
  if (droppedHere && !flying.length && !on && !told && G.mode === 'play' && carried() - depositedCount() <= 0) {
    told = true;
    banner.innerHTML = `NOW COLLECT ALL CRYSTALS TO WAKE UP<small>◆ ${depositedCount()} / ${crystalsNeeded()}</small>`;
    banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
    clearTimeout(bannerT); bannerT = setTimeout(() => banner.classList.remove('show'), 4600);
  }
  for (let i = flying.length - 1; i >= 0; i--) {                 // cristales volando al contenedor
    const f = flying[i]; f.t += dt / .55; const k = Math.min(1, f.t), e = k * k * (3 - 2 * k), q = f.q;
    f.m.position.set(f.from.x + (q.tank.x - f.from.x) * e, f.from.z + (Z + TANK.z1 + 2 - f.from.z) * e + Math.sin(k * Math.PI) * 10, -(f.from.y + (q.tank.y - f.from.y) * e));
    f.m.rotation.y += dt * 12;
    if (k >= 1) {
      group.remove(f.m); flying.splice(i, 1); depositOne(carried()); droppedHere++; crystalSound(); puff(q.tank.x, q.tank.y); kick(.03);   // el contador de arriba sube solo
    }
  }
  const n = depositedCount();
  for (const q of portals) {
    q.uni.uT.value += dt * (on ? .55 : .04); q.uni.uOn.value += ((on ? 1 : 0) - q.uni.uOn.value) * Math.min(1, dt * 2);
    q.light.intensity = q.uni.uOn.value * (600 + 150 * Math.sin(G.t * 3));
    q.fill += (Math.min(1, n / crystalsNeeded()) - q.fill) * Math.min(1, dt * 3);
    q.liquid.scale.y = Math.max(.01, q.fill * q.th); q.liquid.material.opacity = .35 + .15 * Math.sin(G.t * 2.5) + (on ? .2 : 0);
    q.gems.children.forEach((g, i) => {
      g.visible = i < n; const u = g.userData, a = u.a + G.t * (on ? 1.6 : .5);
      g.position.set(Math.cos(a) * u.r, u.h + Math.sin(G.t * 2 + i) * .3, Math.sin(a) * u.r); g.rotation.y = a * 2;
    });
  }
  // contador sobre el contenedor (mientras falten cristales)
  const q = portals[0], show = q && !on && (G.mode === 'play' || G.mode === 'edit');
  label.style.display = show ? 'block' : 'none';
  if (show) {
    const v = new THREE.Vector3(q.tank.x, Z + TANK.z1 + 9, -q.tank.y).project(cam);
    label.style.left = ((v.x + 1) / 2 * stage.clientWidth) + 'px'; label.style.top = ((1 - v.y) / 2 * stage.clientHeight) + 'px';
    const pend = carried() - n;
    label.innerHTML = `◆ ${n}/${crystalsNeeded()}${pend > 0 ? `<small>+${pend} to drop in</small>` : ''}`;
  }
}
