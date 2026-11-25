import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { TOWER as T, SEMA } from '../Settings.js';
import { rot } from '../Data/PropLibrary.js';
import { listGeo } from '../Core/VoxelMesh.js';
import { M } from '../Materials/Materials.js';
import { laserEnds } from './LaserGate.js';
import { zapSound, towerRiseSound } from '../Core/Audio.js';

// Torre sensor (prop "tower", modelo assets/vox/props/tower.vox con dos partes: "base" y "torre").
// La base va pegada al escenario; la torre está escondida dentro de la base. Si el jugador entra en su radio
// (círculo en el piso), la torre se levanta, carga un instante y dispara un láser en las cuatro direcciones
// (de pared a pared, como los láseres). Tocar un haz mientras dispara mata. Luego descansa y, si sigues cerca, repite.
// Semáforo del círculo: verde vigilando · amarillo levantándose / cargando · rojo disparando. El glitch la congela.
const DOWN = -7;                                    // cuánto baja la torre escondida (vóxeles)
let group, towers = [], beamMat, ringGeo;

export function initTowers(scene) {
  group = new THREE.Group(); scene.add(group);
  beamMat = new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: .95, depthWrite: false });
  ringGeo = new THREE.RingGeometry(T.radius - .8, T.radius, 48).rotateX(-Math.PI / 2);
}

export function syncTowers() {
  group.clear(); towers = [];
  for (const p of G.level.props) {
    if (!p.t.startsWith('tower')) continue;
    const R = rot(p.t, p.r), part = R.part('torre');
    if (!part.length) continue;                                   // el modelo no tiene parte "torre"
    const xs = part.map(v => v[0]), ys = part.map(v => v[1]);
    const cx = p.x + (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = p.y + (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    const top = Math.max(...part.map(v => v[2]));
    const mat = M.voxel.clone(); mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -1; // sin parpadeo contra la base
    const mesh = new THREE.Mesh(listGeo(part), mat); mesh.rotation.x = -Math.PI / 2; mesh.castShadow = true; group.add(mesh);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: SEMA.green, transparent: true, opacity: .45, depthWrite: false }));
    ring.position.set(cx, Z + .32, -cy); ring.renderOrder = 2; group.add(ring);
    const beams = ['x', 'y'].map(dir => {                          // un haz por eje (va a los dos lados): las cuatro direcciones
      const [a, b] = laserEnds(Math.floor(cx), Math.floor(cy), dir), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, .45, .45), beamMat);
      m.position.set((a[0] + b[0]) / 2, Z + top - 1 + .5, -(a[1] + b[1]) / 2); m.rotation.y = dir === 'x' ? 0 : Math.PI / 2; m.visible = false; group.add(m);
      return { m, a, b };
    });
    towers.push({ px: p.x, py: p.y, cx, cy, mesh, ring, beams, state: 'idle', t: 0, lift: 0 });
  }
  resetTowers();
}
export function resetTowers() { for (const w of towers) Object.assign(w, { state: 'idle', t: 0, lift: 0 }); }

const segDist = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], k = Math.max(0, Math.min(1, ((p.x - a[0]) * vx + (p.y - a[1]) * vy) / (vx * vx + vy * vy || 1))); return Math.hypot(p.x - (a[0] + vx * k), p.y - (a[1] + vy * k)); };

// lógica (jugando): devuelve true si un haz alcanzó al jugador
export function updateTowers(dt, p) {
  let hit = false;
  for (const w of towers) {
    if (G.frozen > 0) continue;
    const near = !G.hiddenKind && Math.hypot(p.x - w.cx, p.y - w.cy) < T.radius;
    w.t += dt;
    if (w.state === 'idle' && near) { w.state = 'rise'; w.t = 0; towerRiseSound(); }
    else if (w.state === 'rise' && w.t >= T.riseTime) { w.state = 'charge'; w.t = 0; }
    else if (w.state === 'charge' && w.t >= T.chargeTime) { w.state = 'fire'; w.t = 0; zapSound(.8); }
    else if (w.state === 'fire' && w.t >= T.fireTime) { w.state = 'rest'; w.t = 0; }
    else if (w.state === 'rest' && w.t >= T.restTime) { w.state = near ? 'charge' : 'lower'; w.t = 0; }
    else if (w.state === 'lower' && w.t >= T.riseTime) { w.state = 'idle'; w.t = 0; }
    if (w.state === 'fire' && w.beams.some(b => segDist(p, b.a, b.b) < T.hitR)) hit = true;
  }
  return hit;
}

// visual (cada frame)
export function animateTowers(dt) {
  const play = G.mode === 'play' || G.mode === 'over' || G.mode === 'caught';
  for (const w of towers) {
    if (!play) Object.assign(w, { state: 'idle', lift: 0 });
    const want = ['rise', 'charge', 'fire', 'rest'].includes(w.state) ? 1 : 0;
    w.lift += (want - w.lift) * Math.min(1, dt * (want ? 9 : 5));
    const shake = w.state === 'charge' ? Math.sin(G.t * 60) * .15 : 0;
    w.mesh.position.set(w.px + shake, Z + DOWN * (1 - w.lift), -w.py);
    const fire = w.state === 'fire', charge = w.state === 'charge' || w.state === 'rise';
    for (const b of w.beams) { b.m.visible = fire; if (fire) b.m.scale.set(1, 1 + Math.sin(G.t * 45) * .2, 1 + Math.sin(G.t * 45) * .2); }
    w.ring.material.color.setHex(fire ? SEMA.red : charge || w.state === 'rest' ? SEMA.yellow : SEMA.green);
    w.ring.material.opacity = fire ? .7 : .35 + .12 * Math.sin(G.t * 4);
  }
}
