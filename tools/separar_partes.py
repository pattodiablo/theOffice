"""Separa un .vox de un solo modelo en varias partes con nombre, cortando por altura (z).
Cada parte queda como un modelo aparte en MagicaVoxel (se ven en el panel de escena) y en la misma posición.
Guarda una copia del original en assets/vox/respaldo/.

    python3 tools/separar_partes.py assets/vox/props/tower.vox base:0-1 torre:2-99

Después se puede seguir editando cada parte en MagicaVoxel; el juego usa los nombres (p. ej. "torre" se anima).
"""
import os, shutil, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_personajes import Part, write

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read_single(path):
    b = open(path, 'rb').read(); i = 20; vox = pal = None
    while i + 12 <= len(b):
        cid = b[i:i + 4].decode('latin1'); n, m = struct.unpack('<ii', b[i + 4:i + 12]); c = i + 12
        if cid == 'XYZI' and vox is None:
            k = struct.unpack('<i', b[c:c + 4])[0]; vox = [tuple(b[c + 4 + j * 4:c + 8 + j * 4]) for j in range(k)]
        if cid == 'RGBA': pal = [tuple(b[c + j * 4:c + j * 4 + 3]) for j in range(256)]
        i = c + n + m
    return vox, pal


if __name__ == '__main__':
    src, specs = sys.argv[1], sys.argv[2:]
    vox, pal = read_single(src)
    bk = os.path.join(ROOT, 'assets/vox/respaldo'); os.makedirs(bk, exist_ok=True)
    shutil.copy(src, os.path.join(bk, os.path.basename(src).replace('.vox', '_original.vox')))
    parts = []
    for s in specs:
        name, rng = s.split(':'); z0, z1 = map(int, rng.split('-')); p = Part(name)
        for x, y, z, c in vox:
            if z0 <= z <= z1: r, g, bl = pal[c - 1]; p.v[(x, y, z)] = (r << 16) | (g << 8) | bl
        if p.v: parts.append(p)
    n, v = write(parts, src)
    print(f'{os.path.basename(src)}: {n} partes ({", ".join(p.name for p in parts)}), {v} vóxeles')
