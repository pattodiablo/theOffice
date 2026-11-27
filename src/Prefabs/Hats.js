import * as THREE from 'three';
import { parseVox } from '../Core/VoxLoader.js';
import { HATS } from '../Settings.js';
import { equippedHat } from '../Data/Progress.js';
import { VOX_SCALE } from './Character.js';

// Sombreros: carga public/hats/<id>.vox (un modelo cada uno), los pone en la cabeza de los personajes que los
// "usan" (el jugador y el que viaja en el ascensor) y dibuja una miniatura de cada uno para la tienda.
const GEO = {}, previews = {}, wearers = new Set();
const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
const glowMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
glowMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + vColor.rgb * .3;'); };
glowMat.customProgramCacheKey = () => 'hatglow';

const FACES = [[[1,0,0],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]], [[-1,0,0],[[0,1,0],[0,0,0],[0,0,1],[0,1,1]]],
  [[0,1,0],[[1,1,0],[0,1,0],[0,1,1],[1,1,1]]], [[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
  [[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]], [[0,0,-1],[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]]];

// geometrías (normal y brillante) de una lista de vóxeles, centrada en x/y y con la base en 0 (coordenadas de Three)
function build(vox) {
  const mn = i => Math.min(...vox.map(v => v[i])), mx = i => Math.max(...vox.map(v => v[i]));
  const cx = (mn(0) + mx(0) + 1) / 2, cy = (mn(1) + mx(1) + 1) / 2, z0 = mn(2);
  const solid = new Set(vox.map(v => v[0] + ',' + v[1] + ',' + v[2])), out = [{ pos: [], nor: [], col: [] }, { pos: [], nor: [], col: [] }], c = new THREE.Color();
  for (const [x, y, z, r, g, b, e] of vox) {
    const O = out[e ? 1 : 0]; c.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    for (const [n, q] of FACES) {
      if (solid.has((x + n[0]) + ',' + (y + n[1]) + ',' + (z + n[2]))) continue;
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const vx = x + q[i][0] - cx, vy = y + q[i][1] - cy, vz = z + q[i][2] - z0;
        O.pos.push(vx * VOX_SCALE, vz * VOX_SCALE, -vy * VOX_SCALE); O.nor.push(n[0], n[2], -n[1]); O.col.push(c.r, c.g, c.b);
      }
    }
  }
  return out.map((O, k) => {
    if (!O.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(O.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(O.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(O.col, 3));
    return { geo: g, glow: k === 1 };
  }).filter(Boolean);
}

export async function loadHats() {
  await Promise.all(HATS.list.map(async h => {
    try {
      const r = await fetch(`hats/${h.id}.vox`); if (!r.ok) return;
      const parts = parseVox(await r.arrayBuffer()), vox = parts.flatMap(p => p.vox);
      if (vox.length) GEO[h.id] = build(vox);
    } catch (e) { console.warn('sombrero', h.id, e); }
  }));
}
export const hatReady = id => !!GEO[id];

export function hatMesh(id) {
  const g = new THREE.Group(); g.name = 'hat';
  for (const p of GEO[id] || []) { const m = new THREE.Mesh(p.geo, p.glow ? glowMat : mat); m.castShadow = true; g.add(m); }
  return g;
}

// pone (o cambia, o quita) el sombrero en la cabeza de un personaje
export function setHat(ch, id) {
  if (!ch?.head) return;
  if (ch.hat) { ch.head.remove(ch.hat); ch.hat = null; }
  ch.hatId = id || null;
  if (!id || !GEO[id]) return;
  const [x, y, z] = ch.headTop || [0, 7, 0];
  ch.hat = hatMesh(id); ch.hat.position.set(x, y - HATS.sink, z); ch.head.add(ch.hat);
}
// personajes que llevan el sombrero elegido (se actualizan solos al cambiarlo en la tienda)
export function wearHat(ch) { wearers.add(ch); setHat(ch, equippedHat()); }
export function refreshHats() { const id = equippedHat(); for (const ch of wearers) setHat(ch, id); }

// miniaturas para la tienda (dataURL), dibujadas una vez con un renderer chiquito aparte
export function hatPreview(id) {
  if (id in previews) return previews[id];
  if (!GEO[id]) return previews[id] = '';
  try {
    const W = 192, H = 128, r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(4, 8, 6); sc.add(sun);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100); cam.position.set(10, 8.2, 10); cam.lookAt(0, 0, 0);
    for (const h of HATS.list) {
      if (!GEO[h.id] || h.id in previews) continue;
      const m = hatMesh(h.id); m.rotation.y = -Math.PI / 4 + .35; sc.add(m);
      const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      m.position.sub(c); const a = W / H, half = Math.max(Math.max(s.x, s.z) * .5 / a * 1.25, s.y * .62);
      Object.assign(cam, { left: -half * a, right: half * a, top: half, bottom: -half }); cam.updateProjectionMatrix();
      r.render(sc, cam); previews[h.id] = r.domElement.toDataURL(); sc.remove(m);
    }
    r.dispose(); r.forceContextLoss();
  } catch (e) { previews[id] = ''; }
  return previews[id] || '';
}
