"""Genera assets/vox/props/rack.vox: el rack de servidores que apaga las cámaras.
Solo hace falta para volver al modelo original (sobrescribe el archivo). Uso: python3 tools/generar_rack.py
Después se edita en MagicaVoxel como cualquier prop (con npm run dev se exporta solo)."""
import os, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets/vox/props/rack.vox")
W, D, H = 8, 7, 20
FRAME, PANEL, VENT, TOP = (34, 38, 43), (52, 58, 66), (22, 25, 29), (74, 80, 88)
LEDS = [(59, 224, 124), (255, 176, 32), (77, 184, 255)]

vox = {}
for x in range(W):
    for y in range(D):
        for z in range(H):
            vox[(x, y, z)] = FRAME
for x in range(W):
    for y in range(D):
        vox[(x, y, H - 1)] = TOP
# unidades de servidor en las cuatro caras: panel, rejilla y luces
for z in range(2, H - 2):
    unit = (z - 2) % 3
    for x in range(1, W - 1):
        for y in (0, D - 1):
            vox[(x, y, z)] = VENT if unit == 2 else PANEL
    for y in range(1, D - 1):
        for x in (0, W - 1):
            vox[(x, y, z)] = VENT if unit == 2 else PANEL
    if unit == 0:
        k = (z // 3) % 3
        for y in (0, D - 1):
            vox[(W - 2, y, z)] = LEDS[k]; vox[(W - 3, y, z)] = LEDS[(k + 1) % 3]
        for x in (0, W - 1):
            vox[(x, 1, z)] = LEDS[k]; vox[(x, 2, z)] = LEDS[(k + 2) % 3]

cols = []
for c in vox.values():
    if c not in cols: cols.append(c)
idx = {c: i + 1 for i, c in enumerate(cols)}


def chunk(tag, content):
    return tag + struct.pack("<ii", len(content), 0) + content


body = chunk(b"SIZE", struct.pack("<iii", W, D, H))
body += chunk(b"XYZI", struct.pack("<i", len(vox)) + b"".join(struct.pack("<BBBB", x, y, z, idx[c]) for (x, y, z), c in vox.items()))
body += chunk(b"RGBA", b"".join(struct.pack("<BBBB", *(cols[i] if i < len(cols) else (0, 0, 0)), 255) for i in range(256)))
with open(OUT, "wb") as f:
    f.write(b"VOX " + struct.pack("<i", 150) + b"MAIN" + struct.pack("<ii", 0, len(body)) + body)
print("rack.vox listo:", len(vox), "vóxeles")
