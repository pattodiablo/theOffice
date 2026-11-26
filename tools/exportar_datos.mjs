// Convierte los .vox de assets/vox en public/data/office.json, que es lo que carga el juego.
//
// Con `npm run dev` corre SOLO: Vite vigila assets/vox y, cada vez que guardas un .vox en MagicaVoxel,
// regenera office.json y recarga la página. También se puede correr a mano:
//     node tools/exportar_datos.mjs
// El nombre del archivo es el id del prop que se guarda en los niveles (desk.vox → "desk").
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseVox } from '../src/Core/VoxLoader.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VOX_DIR = path.join(ROOT, 'assets/vox');
const BASE = path.join(VOX_DIR, 'oficina_base.vox'), PROPS_DIR = path.join(VOX_DIR, 'props');
export const OUT = path.join(ROOT, 'public/data/office.json');
const W = 128, D = 104, H = 34; // tamaño de la base que espera el juego

// Nombres que se muestran en el editor; un prop nuevo sin entrada usa su nombre de archivo.
const LABELS = { desk: 'Cubículo', plant: 'Planta', plant_s: 'Planta chica', copier: 'Fotocopiadora',
  cabinet: 'Archivador', micro: 'Archivador + micro', cooler: 'Dispensador', panel: 'Panel', muro: 'Muro', trash: 'Basurero',
  rack: 'Rack de servidores (apaga las cámaras)', tower: 'Torre sensor (dispara láseres)', safe: 'Caja fuerte (guarda el cristal)', MainFrame: 'Main Frame (jefe: patas que giran y disparan láseres)', realityportal: 'Portal de realidad (se echan los cristales; final del juego)', bee: 'Abeja robot (te detecta y te embiste)', vigia: 'Vigía (modelo del dron)', vigia1: 'Vigía (modelo del dron)' };

// primer modelo de un .vox: { size: [w, d, h], vox: [[x, y, z, 'r,g,b']] }
function readVox(file) {
  const b = fs.readFileSync(file), name = path.basename(file);
  if (b.toString('latin1', 0, 4) !== 'VOX ') throw new Error(`${name}: no es un archivo .vox`);
  let size = null, xyzi = null, rgba = null, i = 20; // 'VOX ' + versión + cabecera de MAIN
  while (i + 12 <= b.length) {
    const id = b.toString('latin1', i, i + 4), n = b.readInt32LE(i + 4), m = b.readInt32LE(i + 8), c = i + 12;
    if (id === 'SIZE' && !size) size = [b.readInt32LE(c), b.readInt32LE(c + 4), b.readInt32LE(c + 8)];
    else if (id === 'XYZI' && !xyzi) { const k = b.readInt32LE(c); xyzi = []; for (let j = 0; j < k; j++) { const o = c + 4 + j * 4; xyzi.push([b[o], b[o + 1], b[o + 2], b[o + 3]]); } }
    else if (id === 'RGBA') { rgba = []; for (let j = 0; j < 256; j++) rgba.push(`${b[c + j * 4]},${b[c + j * 4 + 1]},${b[c + j * 4 + 2]}`); }
    i = c + n + m;
  }
  if (!size || !xyzi) throw new Error(`${name}: no encontré ningún modelo`);
  if (!rgba) throw new Error(`${name}: no tiene paleta propia (RGBA). Ábrelo en MagicaVoxel, cambia cualquier color y guarda.`);
  if (b.toString('latin1').split('XYZI').length > 2) return readParts(b, name);  // varios modelos: se juntan, cada uno como una parte con nombre
  return { size, vox: xyzi.map(([x, y, z, k]) => [x, y, z, rgba[k - 1]]) }; // el índice k usa la entrada k-1 de la paleta
}

// .vox con varios modelos (p. ej. tower.vox: "base" y "torre"): se arma el prop completo y se anota a qué parte va
// cada vóxel, para que el juego pueda animar una parte por separado. El nombre de cada modelo se pone en MagicaVoxel.
function readParts(b, name) {
  const parts = parseVox(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const all = parts.flatMap((p, k) => p.vox.map(v => [...v, k]));
  if (!all.length) throw new Error(`${name}: está vacío`);
  const mn = i => Math.min(...all.map(v => v[i])), mx = i => Math.max(...all.map(v => v[i]));
  const [x0, y0, z0] = [mn(0), mn(1), mn(2)];
  return { size: [mx(0) - x0 + 1, mx(1) - y0 + 1, mx(2) - z0 + 1], names: parts.map(p => p.name),
    vox: all.map(v => [v[0] - x0, v[1] - y0, v[2] - z0, `${v[3]},${v[4]},${v[5]}`, v[7]]) };
}

export function exportarDatos() {
  const palette = [];
  const colorIndex = rgb => {
    let k = palette.indexOf(rgb);
    if (k < 0) { if (palette.length >= 255) throw new Error('Hay más de 255 colores distintos entre todos los .vox; reduce la paleta.'); palette.push(rgb); k = palette.length - 1; }
    return k + 1;
  };
  const base = readVox(BASE), [sx, sy, sz] = base.size;
  if (sx !== W || sy !== D || sz > H) throw new Error(`oficina_base.vox mide ${sx}x${sy}x${sz}; el juego espera ${W}x${D} y hasta ${H} de alto.`);
  const shell = new Uint8Array(W * D * H);
  for (const [x, y, z, rgb] of base.vox) shell[x + y * W + z * W * D] = colorIndex(rgb);

  const props = {}, warnings = [];
  for (const f of fs.readdirSync(PROPS_DIR).filter(f => f.endsWith('.vox')).sort()) {
    const key = f.slice(0, -4), { size: [w, d, h], vox, names } = readVox(path.join(PROPS_DIR, f));
    if (Math.max(w, d) > 64 || h > 31) warnings.push(`Aviso: ${f} mide ${w}x${d}x${h}; los props grandes pueden no caber en la oficina.`);
    const v = Buffer.alloc(vox.length * 4);
    vox.forEach(([x, y, z, rgb], j) => { v[j * 4] = x; v[j * 4 + 1] = y; v[j * 4 + 2] = z; v[j * 4 + 3] = colorIndex(rgb); });
    props[key] = { n: LABELS[key] || key, w, d, v: v.toString('base64') };
    if (names) { props[key].parts = names; props[key].pv = Buffer.from(vox.map(x => x[4])).toString('base64'); } // parte de cada vóxel
  }
  const json = JSON.stringify({ shell: zlib.deflateSync(shell, { level: 9 }).toString('base64'), props, colors: palette.map(c => c.split(',').map(Number)) });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, json);
  return { props: Object.keys(props).length, colors: palette.length, warnings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const r = exportarDatos(); r.warnings.forEach(w => console.log(w)); console.log(`office.json listo: ${r.props} props, ${r.colors} colores`); }
  catch (e) { console.error(e.message); process.exit(1); }
}
