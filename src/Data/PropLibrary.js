import { listGeo } from '../Core/VoxelMesh.js';
import { TOWER } from '../Settings.js';

// Biblioteca de props (los "prefabs" de MagicaVoxel): se cargan de office.json,
// que genera tools/exportar_datos.mjs (solo, con npm run dev) a partir de assets/vox/props/*.vox.
export const PROPS = {};
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// partes que el juego anima por su cuenta (no se pegan al escenario): p. ej. la "torre" de tower.vox
export const MOVING_PARTS = ['torre', 'puerta', 'patas', 'plataforma', 'abeja', 'alaL', 'alaR'];   // torre de tower.vox · puerta de safe.vox · patas de MainFrame.vox · plataforma de realityportal.vox (se camina encima)
export function initProps(data) {
  for (const [k, p] of Object.entries(data.props)) {
    const b = b64(p.v), pv = p.pv ? b64(p.pv) : null, vox = [];
    for (let i = 0; i < b.length; i += 4) vox.push([b[i], b[i + 1], b[i + 2], b[i + 3], pv ? pv[i / 4] : 0]);  // [x, y, z, color, parte]
    let parts = p.parts || null;
    // torre sensor guardada como un solo modelo (p. ej. si MagicaVoxel la volvió a guardar entera): se separa por altura,
    // las primeras TOWER.baseLayers capas son la base y lo de arriba es la torre que se levanta
    if (k.startsWith('tower') && !(parts && parts.includes('torre'))) { parts = ['base', 'torre']; for (const v of vox) v[4] = v[2] >= TOWER.baseLayers ? 1 : 0; }
    PROPS[k] = { n: p.n, w: p.w, d: p.d, vox, parts, rots: [] };
  }
}

// prop rotado r × 90°: vóxeles, tamaño y huella en el piso
export function rot(t, r) {
  const P = PROPS[t]; if (P.rots[r]) return P.rots[r];
  const { w, d } = P;
  const vox = P.vox.map(([x, y, z, c, k]) => r === 1 ? [d - 1 - y, x, z, c, k] : r === 2 ? [w - 1 - x, d - 1 - y, z, c, k] : r === 3 ? [y, w - 1 - x, z, c, k] : [x, y, z, c, k]);
  let h = 0; for (const v of vox) h = Math.max(h, v[2] + 1);
  const moving = k => P.parts && MOVING_PARTS.includes(P.parts[k]);
  return P.rots[r] = { w: r % 2 ? d : w, d: r % 2 ? w : d, h, vox, foot: new Set(vox.map(v => v[0] + ',' + v[1])),
    stat: vox.filter(v => !moving(v[4])),                                            // lo que va pegado al escenario
    part: name => vox.filter(v => P.parts && P.parts[v[4]] === name) };             // los vóxeles de una parte
}

// geometría del prop (para vistas previas, disfraces y siluetas)
const geoCache = {};
export const propGeo = (t, r) => geoCache[t + r] ||= listGeo(rot(t, r).vox);
