// Lector de archivos .vox de MagicaVoxel con escena: devuelve cada modelo con su nombre
// y sus vóxeles ya ubicados en coordenadas del mundo de MagicaVoxel (z hacia arriba).
// Soporta grupos, traslaciones, rotaciones, modelos ocultos y el material Emit.

export function parseVox(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  if (String.fromCharCode(...u8.subarray(0, 4)) !== 'VOX ') throw new Error('no es un archivo .vox');
  const models = [], nodes = {}, emit = {};
  let palette = null, size = null;
  const str = o => { const n = dv.getInt32(o, true); return [new TextDecoder().decode(u8.subarray(o + 4, o + 4 + n)), o + 4 + n]; };
  const dict = o => { const n = dv.getInt32(o, true), d = {}; o += 4; for (let i = 0; i < n; i++) { let k, v; [k, o] = str(o); [v, o] = str(o); d[k] = v; } return [d, o]; };
  let i = 20; // 'VOX ' + versión + cabecera de MAIN
  while (i < u8.length) {
    const id = String.fromCharCode(...u8.subarray(i, i + 4)), n = dv.getInt32(i + 4, true), c = i + 12;
    if (id === 'SIZE') size = [dv.getInt32(c, true), dv.getInt32(c + 4, true), dv.getInt32(c + 8, true)];
    else if (id === 'XYZI') { const k = dv.getInt32(c, true); models.push({ size, vox: u8.slice(c + 4, c + 4 + k * 4) }); }
    else if (id === 'RGBA') { palette = []; for (let j = 0; j < 256; j++) palette.push([u8[c + j * 4], u8[c + j * 4 + 1], u8[c + j * 4 + 2]]); }
    else if (id === 'nTRN') {
      let [attr, o] = dict(c + 4); const child = dv.getInt32(o, true), layer = dv.getInt32(o + 8, true), frames = dv.getInt32(o + 12, true);
      let f = {}; if (frames > 0) [f] = dict(o + 16);
      nodes[dv.getInt32(c, true)] = { type: 'T', name: attr._name, hidden: attr._hidden === '1', child, layer,
        t: f._t ? f._t.split(' ').map(Number) : [0, 0, 0], r: f._r !== undefined ? rotation(+f._r) : null };
    } else if (id === 'nGRP') {
      let [, o] = dict(c + 4); const k = dv.getInt32(o, true), kids = [];
      for (let j = 0; j < k; j++) kids.push(dv.getInt32(o + 4 + j * 4, true));
      nodes[dv.getInt32(c, true)] = { type: 'G', kids };
    } else if (id === 'nSHP') {
      let [, o] = dict(c + 4); nodes[dv.getInt32(c, true)] = { type: 'S', model: dv.getInt32(o + 4, true) };
    } else if (id === 'MATL') {
      const [d] = dict(c + 4); if (d._type === '_emit') emit[dv.getInt32(c, true)] = Math.min(1, parseFloat(d._emit ?? '1') || 0);
    }
    i = id === 'MAIN' ? c : c + n + dv.getInt32(i + 8, true);
  }
  palette ||= Array.from({ length: 256 }, () => [200, 200, 200]);

  const parts = [];
  const place = (m, name, T, R) => {
    const mod = models[m], [sx, sy, sz] = mod.size, h = [sx >> 1, sy >> 1, sz >> 1], vox = [];
    for (let j = 0; j < mod.vox.length; j += 4) {
      const l = [mod.vox[j] - h[0], mod.vox[j + 1] - h[1], mod.vox[j + 2] - h[2]], p = mul(R, l), c = mod.vox[j + 3];
      vox.push([p[0] + T[0], p[1] + T[1], p[2] + T[2], ...palette[c - 1], emit[c] || 0]);
    }
    parts.push({ name: name || 'model' + m, vox });
  };
  const walk = (id, T, R, name) => {
    const nd = nodes[id]; if (!nd) return;
    if (nd.type === 'T') {
      if (nd.hidden) return;
      const R2 = nd.r ? mmul(R, nd.r) : R, t = mul(R, nd.t);
      walk(nd.child, [T[0] + t[0], T[1] + t[1], T[2] + t[2]], R2, nd.name || name);
    } else if (nd.type === 'G') nd.kids.forEach(k => walk(k, T, R, name));
    else place(nd.model, name, T, R);
  };
  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (nodes[0]) walk(0, [0, 0, 0], I); else models.forEach((_, m) => place(m, null, [0, 0, 0], I));
  return parts;
}

// rotación de MagicaVoxel empaquetada en un byte
function rotation(b) {
  const i0 = b & 3, i1 = (b >> 2) & 3, i2 = 3 - i0 - i1, R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  R[0][i0] = b & 16 ? -1 : 1; R[1][i1] = b & 32 ? -1 : 1; R[2][i2] = b & 64 ? -1 : 1; return R;
}
const mul = (R, v) => R.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const mmul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
