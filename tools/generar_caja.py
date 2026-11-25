"""Genera assets/vox/props/safe.vox: la caja fuerte que guarda el fragmento de realidad.
Dos partes: "base" (el cuerpo, va pegado al escenario) y "puerta" (se abre girando sobre las bisagras de la derecha).
El frente (puerta, dial y lector de huella) mira a y = 0, hacia la cámara.
Solo hace falta para volver al modelo original (sobrescribe el archivo). Uso: python3 tools/generar_caja.py
Después se edita en MagicaVoxel como cualquier prop (con npm run dev se exporta solo); mantén los nombres de las partes."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_personajes import Part, write

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets/vox/props/safe.vox")

W, D, H = 13, 12, 12            # cuerpo: x 0..12, y 1..11, z 0..11 (la puerta y sus detalles van en y = 0..1)
BODY, TOP, EDGE, BRACKET = 0x96988f, 0xa9aba3, 0x74766f, 0x83857e
SEAM, INSIDE = 0x2d2f2e, 0x1d1f1e
DOOR, DIAL, KNOB, HANDLE = 0xa3a59d, 0x6f716b, 0xc4c6bf, 0xd2d4cd
SCAN, SCREEN, HINGE = 0xe6e8e2, 0x4fd2ff, 0x5f615b

base, door = Part("base"), Part("puerta")
b, d = base.v, door.v

# cuerpo macizo con aristas más oscuras y tapa más clara
for x in range(W):
    for y in range(2, D):
        for z in range(H):
            edges = (x in (0, W - 1)) + (y in (2, D - 1)) + (z in (0, H - 1))
            b[(x, y, z)] = EDGE if edges >= 2 else TOP if z == H - 1 else BODY
# marco del frente (y = 1) con la ranura oscura alrededor de la puerta; el hueco de adentro es negro
for x in range(W):
    for z in range(H):
        if 2 <= x <= W - 3 and 2 <= z <= H - 3: continue                    # ahí va la puerta (hueco)
        seam = x in (1, W - 2) and 1 <= z <= H - 2 or z in (1, H - 2) and 1 <= x <= W - 2
        b[(x, 1, z)] = SEAM if seam else BODY
for x in range(2, W - 2):
    for z in range(2, H - 2):
        b[(x, 4, z)] = INSIDE                                                # fondo del hueco (se ve al abrir)
        for y in (2, 3): b.pop((x, y, z), None)
for y in (2, 3):                                                             # paredes del hueco oscuras
    for z in range(2, H - 2): b[(1, y, z)] = b[(W - 2, y, z)] = INSIDE
    for x in range(1, W - 1): b[(x, y, 1)] = b[(x, y, H - 2)] = INSIDE
# esquineros en L que sobresalen al frente y tapitas arriba
for cx, cz in ((0, 0), (W - 2, 0), (0, H - 2), (W - 2, H - 2)):
    for i in range(2):
        for k in range(2):
            if i == (0 if cx == 0 else 1) or k == (0 if cz == 0 else 1): b[(cx + i, 0, cz + k)] = BRACKET
for cx in (0, W - 2):
    for cy in (2, D - 2):
        for i in range(2):
            for j in range(2): b[(cx + i, cy + j, H)] = BRACKET
# bisagras a la derecha (lado de x alto)
for z in (3, 4, H - 5, H - 4): b[(W - 1, 0, z)] = b[(W - 1, 1, z)] = HINGE

# puerta: placa en y = 1 y detalles en y = 0
for x in range(2, W - 2):
    for z in range(2, H - 2): d[(x, 1, z)] = DOOR
for x in range(2, 8):                                                        # dial redondo
    for z in range(4, 10):
        r = ((x - 4.5) ** 2 + (z - 6.5) ** 2) ** .5
        if r <= 2.6: d[(x, 0, z)] = KNOB if r < 1.2 else DIAL
for z in range(5, 9): d[(8, 0, z)] = d[(9, 0, z)] = SCAN                     # lector de huella
d[(8, 0, 7)] = d[(9, 0, 7)] = d[(8, 0, 6)] = d[(9, 0, 6)] = SCREEN
for x in range(4, 9): d[(x, 0, 3)] = HANDLE                                  # manija
d[(4, 0, 2)] = d[(8, 0, 2)] = HANDLE

n, v = write([base, door], OUT)
print(f"safe.vox listo: {n} partes, {v} vóxeles")
