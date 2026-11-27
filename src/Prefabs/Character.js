import * as THREE from 'three';
import { flat } from '../Materials/Materials.js';
import { parseVox } from '../Core/VoxLoader.js';

// Modelos de personaje. Si existe public/characters/<nombre>.vox se usa ese modelo de MagicaVoxel;
// si no, el modelo de cajas de abajo. Ver loadCharacterModels() al final.
// Modelo de personaje hecho de cajas (mira hacia +X). Huesos: root › body › cabeza, brazos y piernas.
// Las animaciones (src/Animations/Clips.js) mueven body, head, armL/armR y legL/legR.
// agent = true → agente de gafas y gabardina; false → oficinista (jugador). red = agente rojo (con arma).
export function box(parent, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(color)); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}
function limb(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// agente rojo: material que brilla un poco para que se lea rojo aun con la ambientación verde
const redCoat = new THREE.MeshLambertMaterial({ color: 0xe0202c, emissive: 0x6a0010 });

export function makeCharacter(scene, agent, red = false) {
  const vox = MODELS[red ? 'agent_red' : agent ? 'agent' : 'player'];
  if (vox) { const ch = fromVox(vox); ch.root.userData.character = true; scene.add(ch.root); return ch; }
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  let head;
  const pants = red ? 0x2a0a0d : agent ? 0x1b1d22 : 0x34394a, top = red ? 0x8a121c : agent ? 0x17191d : 0xf2f3f5, skin = 0xf1c9a5, hair = agent ? 0x101114 : 0x3a2a1e;
  const legL = limb(body, 0, 5, -1), legR = limb(body, 0, 5, 1);
  for (const l of [legL, legR]) { box(l, 1.6, 5, 1.6, pants, 0, -2.5, 0); box(l, 2.4, 1, 1.8, 0x111111, .4, -4.6, 0); }
  const armL = limb(body, 0, 9.8, agent ? -3.1 : -2.8), armR = limb(body, 0, 9.8, agent ? 3.1 : 2.8);
  for (const a of [armL, armR]) { box(a, 1.5, 4.8, 1.5, top, 0, -2.4, 0); box(a, 1.3, 1.3, 1.3, skin, 0, -5.2, 0); }
  if (agent) {
    box(body, 3.8, 7.5, 5, top, 0, 7.2, 0); box(body, 4.2, 2.6, 5.6, top, 0, 4.6, 0);           // gabardina
    box(body, 3.9, .7, 5.1, 0x2c2f35, 0, 8.4, 0); box(body, .3, .9, 1, 0xb8bcc4, 2, 8.4, 0);      // cinturón
    head = limb(body, 0, 10.8, 0);                                                                // cuello
    box(head, 5.6, 5.6, 5.6, skin, 0, 2.8, 0); box(head, 6, 2, 6, hair, -.2, 5.8, 0); box(head, 1.2, 4, 6, hair, -2.6, 3.8, 0);
    box(head, .7, 1.9, 6.2, red ? 0xff2a2a : 0x050506, 2.9, 3.4, 0); box(head, .2, .5, 1.8, 0x9ab0c8, 3.25, 3.8, -1.6); // gafas
    box(head, .3, .25, 1.6, 0x6b4a3a, 2.85, 1, 0);
  } else {
    box(body, 3, 5, 4.4, top, 0, 7.5, 0); box(body, .3, 4, .9, 0x1d2b4a, 1.55, 7.6, 0);           // camisa y corbata
    head = limb(body, 0, 10, 0);                                                                  // cuello
    box(head, 6, 6, 6, skin, 0, 3, 0); box(head, 6.4, 1.6, 6.4, hair, 0, 6.4, 0); box(head, 2, 2, 1.6, hair, -1, 7.6, .6);
    for (const s of [-1.4, 1.4]) { box(head, .3, 1.8, 1.6, 0xffffff, 3.05, 3.4, s); box(head, .35, .9, .8, 0x111111, 3.15, 3.2, s); } // ojos
    box(head, .3, .3, 1.2, 0x5a3a2a, 3.05, 1.2, 0);
  }
  if (red) { root.traverse(o => { if (o.material?.color?.getHex() === 0x8a121c) o.material = redCoat; }); box(armR, 3, .9, .9, 0x15171a, 1.1, -5.2, 0); } // gabardina roja y arma
  root.userData.character = true; scene.add(root); return { root, body, head, legL, legR, armL, armR, headTop: [0, agent ? 6.8 : 7.2, 0] };
}

// ---------- personajes desde .vox ----------
// Cada archivo trae un modelo por parte, con el nombre del hueso: body, head, armL, armR, legL, legR.
// Un modelo cuyo nombre empieza con un hueso y "_" (p. ej. armR_gun) se pega a ese hueso.
// El personaje mira hacia +X de MagicaVoxel y los pies están en z = 0, centrado en x = 0, y = 0.
// Articulaciones: brazos y piernas giran en el centro de su capa de arriba; la cabeza en el de su capa de abajo.
export const VOX_SCALE = .5;                 // un vóxel = media unidad del juego
const BONES = ['body', 'head', 'armL', 'armR', 'legL', 'legR'];
const MODELS = {};

export async function loadCharacterModels() {
  await Promise.all(['player', 'agent', 'agent_red'].map(async k => {
    try {
      const r = await fetch(`characters/${k}.vox?v=${Date.now()}`); if (!r.ok) return;
      const parts = parseVox(await r.arrayBuffer()), names = parts.map(p => p.name);
      if (!BONES.every(b => names.includes(b))) { console.warn(`characters/${k}.vox: faltan partes (${BONES.filter(b => !names.includes(b)).join(', ')}); uso el modelo de cajas`); return; }
      MODELS[k] = parts;
    } catch (e) { /* sin archivo o archivo inválido: queda el modelo de cajas */ }
  }));
}

const glowMats = {};
const voxMat = new THREE.MeshLambertMaterial({ vertexColors: true });
function glowMat(k) {          // material Emit de MagicaVoxel: el vóxel brilla con su propio color
  if (!k) return voxMat;
  return glowMats[k] ||= Object.assign(new THREE.MeshLambertMaterial({ vertexColors: true }), {
    onBeforeCompile: sh => { sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', `vec3 totalEmissiveRadiance = emissive + vColor.rgb * ${(k * .4).toFixed(3)};`); },
    customProgramCacheKey: () => 'glow' + k });
}

const FACES = [[[1,0,0],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]], [[-1,0,0],[[0,1,0],[0,0,0],[0,0,1],[0,1,1]]],
  [[0,1,0],[[1,1,0],[0,1,0],[0,1,1],[1,1,1]]], [[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
  [[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]], [[0,0,-1],[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]]];
const tmpC = new THREE.Color();

// mallas de una lista de vóxeles [x,y,z,r,g,b,emit] (una por cada intensidad de brillo)
function partMeshes(vox) {
  const solid = new Set(vox.map(v => v[0] + ',' + v[1] + ',' + v[2])), groups = {};
  for (const [x, y, z, r, g, b, e] of vox) {
    const G = groups[e] ||= { pos: [], nor: [], col: [] };
    tmpC.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    for (const [n, q] of FACES) {
      if (solid.has((x + n[0]) + ',' + (y + n[1]) + ',' + (z + n[2]))) continue;
      for (const i of [0, 1, 2, 0, 2, 3]) { G.pos.push(x + q[i][0], y + q[i][1], z + q[i][2]); G.nor.push(...n); G.col.push(tmpC.r, tmpC.g, tmpC.b); }
    }
  }
  return Object.entries(groups).map(([e, G]) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(G.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(G.col, 3));
    const m = new THREE.Mesh(geo, glowMat(+e)); m.rotation.x = -Math.PI / 2; m.scale.setScalar(VOX_SCALE); m.castShadow = true; return m;
  });
}

// centro de la capa de arriba (dir = 1) o de abajo (dir = -1) de una parte, en vóxeles
function joint(vox, dir) {
  const z = dir > 0 ? Math.max(...vox.map(v => v[2])) : Math.min(...vox.map(v => v[2])), layer = vox.filter(v => v[2] === z);
  const avg = i => layer.reduce((s, v) => s + v[i] + .5, 0) / layer.length;
  return [avg(0), avg(1), dir > 0 ? z + 1 : z];
}

const geoCache = new WeakMap();
function fromVox(parts) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const ch = { root, body };
  const pivots = { body: [0, 0, 0] };
  for (const b of BONES.slice(1)) {
    const main = parts.find(p => p.name === b);
    pivots[b] = joint(main.vox, b === 'head' ? -1 : 1);
    if (b === 'head') { const [tx, ty, tz] = joint(main.vox, 1); ch.headTop = [(tx - pivots.head[0]) * VOX_SCALE, (tz - pivots.head[2]) * VOX_SCALE, -(ty - pivots.head[1]) * VOX_SCALE]; }   // donde se apoya el sombrero
    const g = new THREE.Group(), [px, py, pz] = pivots[b];
    g.position.set(px * VOX_SCALE, pz * VOX_SCALE, -py * VOX_SCALE); body.add(g); ch[b] = g;
  }
  if (!geoCache.has(parts)) geoCache.set(parts, parts.map(p => partMeshes(p.vox)));
  parts.forEach((p, i) => {
    const bone = BONES.find(b => p.name === b || p.name.startsWith(b + '_')) || 'body', [px, py, pz] = pivots[bone];
    for (const src of geoCache.get(parts)[i]) {
      const m = src.clone(); m.position.set(-px * VOX_SCALE, -pz * VOX_SCALE, py * VOX_SCALE); ch[bone].add(m);
    }
  });
  return ch;
}
