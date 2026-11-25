import * as THREE from 'three';
import { COLORS } from '../Materials/Palette.js';
import { M } from '../Materials/Materials.js';

// Convierte vóxeles en una malla: solo dibuja las caras que dan al aire.
// Las mallas se construyen con z hacia arriba y luego se rotan -90° en x (z del vóxel → y de Three.js).
const FACES = [
  [[1, 0, 0], [[1,0,0],[1,1,0],[1,1,1],[1,0,1]]], [[-1, 0, 0], [[0,1,0],[0,0,0],[0,0,1],[0,1,1]]],
  [[0, 1, 0], [[1,1,0],[0,1,0],[0,1,1],[1,1,1]]], [[0, -1, 0], [[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
  [[0, 0, 1], [[0,0,1],[1,0,1],[1,1,1],[0,1,1]]], [[0, 0, -1], [[1,0,0],[0,0,0],[0,1,0],[1,1,0]]]];
const tmpC = new THREE.Color();

// extra(x, y, z) opcional: 4 números por vóxel que van al atributo aAsm (ensamblado del nivel)
export function buildGeo(get, w, d, h, extra) {
  const pos = [], nor = [], col = [], ex = [];
  for (let z = 0; z < h; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
    const v = get(x, y, z); if (!v) continue;
    const [r, g, b] = COLORS[v - 1]; const j = 1 + (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) & 7) / 230; // leve variación por vóxel
    tmpC.setRGB(Math.min(1, r / 255 * j), Math.min(1, g / 255 * j), Math.min(1, b / 255 * j), THREE.SRGBColorSpace);
    const e = extra && extra(x, y, z);
    for (const [n, q] of FACES) {
      if (get(x + n[0], y + n[1], z + n[2])) continue;
      for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(x + q[i][0], y + q[i][1], z + q[i][2]); nor.push(...n); col.push(tmpC.r, tmpC.g, tmpC.b); if (e) ex.push(...e); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (extra) geo.setAttribute('aAsm', new THREE.Float32BufferAttribute(ex, 4));
  return geo;
}

// geometría a partir de una lista de vóxeles [x, y, z, color]
export function listGeo(list) {
  let w = 1, d = 1, h = 1; for (const [x, y, z] of list) { w = Math.max(w, x + 1); d = Math.max(d, y + 1); h = Math.max(h, z + 1); }
  const a = new Uint8Array(w * d * h); for (const [x, y, z, c] of list) a[x + y * w + z * w * d] = c;
  return buildGeo((x, y, z) => (x < 0 || y < 0 || z < 0 || x >= w || y >= d || z >= h) ? 0 : a[x + y * w + z * w * d], w, d, h);
}

// malla lista para la escena, ya rotada
export function voxMesh(list, material = M.voxel) {
  const m = new THREE.Mesh(listGeo(list), material);
  m.rotation.x = -Math.PI / 2; m.castShadow = m.receiveShadow = true; return m;
}
