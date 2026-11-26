"""Genera assets/vox/props/MainFrame.vox: el jefe "Main Frame", la IA central de la oficina.
Diseño basado en el boceto original (guardado en assets/vox/respaldo/MainFrame_original.vox):
cruz de patas en el piso, columna, núcleo con un ojo rojo y enchufes de los cables que suben al techo
(los cables largos los dibuja el juego en MainFrame.js, para que lleguen arriba y se mezan).
Dos partes con nombre:
  · "cuerpo": base, columna, núcleo, ojo, luces y cables (va pegado al escenario)
  · "patas":  la cruz del piso con emisores rojos en las puntas (el juego la hace girar y dispara láseres)
Uso: python3 tools/preparar_mainframe.py   (sobrescribe el .vox; después se edita en MagicaVoxel manteniendo los nombres)"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generar_personajes as gp
from generar_personajes import Part, write

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/vox/props/MainFrame.vox')
S = 32; C = 15.5                       # tamaño de la huella y centro (la cruz pasa por x/y = 15 y 16)

# paleta: acero oscuro, ribetes claros, negro de cables y lente, rojo del ojo y emisores, verde Matrix
STEEL, STEEL_D, TRIM, SEAM = 0x424850, 0x30353b, 0x7c868e, 0x1c2024
BASE, BASE_RIM = 0x2a2e33, 0x5d666e
LEG, LEG_TOP, BOLT = 0x363c42, 0x58626a, 0x8a949b
RED, RED_HI, LENS = 0xe0202c, 0xff3b30, 0x0c0e10
GREEN = 0x3be07c
CABLE, CABLE_2, CLAMP = 0x16181b, 0x23272b, 0x2f6b46
gp.GLOW.update({GREEN: .6, RED_HI: .8})   # en MagicaVoxel también brillan (material Emit)

body, legs = Part('cuerpo'), Part('patas')
B, L = body.v, legs.v
def put(d, x, y, z, c):
    if 0 <= x < S and 0 <= y < S and 0 <= z < 31: d[(x, y, z)] = c

# ---------- patas: cruz de 2 de ancho, con lomo claro, pernos y emisor rojo en cada punta ----------
for i in range(S):
    far = abs(i + .5 - (C + .5))                                   # distancia al centro a lo largo de la pata
    if far < 6: continue                                           # el centro es la base (no gira)
    for w in (15, 16):
        for (x, y) in ((i, w), (w, i)):
            tip = far >= 13.5
            put(L, x, y, 0, RED if tip else LEG)
            put(L, x, y, 1, RED if tip else (BOLT if abs(far - 10) < .6 else LEG_TOP))
            if tip and far >= 14.5: put(L, x, y, 2, RED_HI)          # emisor: de ahí sale el láser

# ---------- base octogonal en el piso ----------
for x in range(S):
    for y in range(S):
        dx, dy = abs(x + .5 - (C + .5)), abs(y + .5 - (C + .5))
        if max(dx, dy) <= 6 and dx + dy <= 8.5:
            rim = max(dx, dy) > 5 or dx + dy > 7.5
            put(B, x, y, 0, BASE_RIM if rim else BASE)
            put(B, x, y, 1, BASE_RIM if rim else BASE)
            if rim and abs(dx - dy) < 1 and dx > 3: put(B, x, y, 2, GREEN)   # luces en las diagonales

# ---------- columna 6x6 con anillo verde ----------
for z in range(2, 8):
    for x in range(13, 19):
        for y in range(13, 19):
            if (x in (13, 18)) and (y in (13, 18)): continue               # esquinas biseladas
            edge = x in (13, 18) or y in (13, 18)
            put(B, x, y, z, GREEN if (edge and z == 4) else STEEL_D if edge else STEEL)

# ---------- núcleo: caja redondeada 14x14x10 ----------
Z0, Z1, X0, X1 = 8, 17, 9, 22
for z in range(Z0, Z1 + 1):
    inset = 1 if z in (Z0, Z1) else 0                               # bisel arriba y abajo
    for x in range(X0 + inset, X1 + 1 - inset):
        for y in range(X0 + inset, X1 + 1 - inset):
            cxd, cyd = min(x - X0, X1 - x) - inset, min(y - X0, X1 - y) - inset
            if cxd + cyd < 3: continue                              # esquinas redondeadas
            outer = cxd == 0 or cyd == 0 or cxd + cyd == 3 or z in (Z0, Z1)
            col = TRIM if (z in (Z0, Z1) or cxd + cyd == 3) else STEEL
            if outer and z == 13: col = SEAM                       # junta horizontal
            put(B, x, y, z, col)
# luces verdes tipo circuito en los costados (x = 9 y x = 22) y rejilla atrás (y = 22)
for x in (X0, X1):
    for y in range(12, 20):
        put(B, x, y, 11, GREEN if y % 3 else SEAM)
        put(B, x, y, 15, GREEN if (y + 1) % 4 else SEAM)
    for z in (11, 12, 14, 15): put(B, x, 12, z, GREEN)
for x in range(12, 20, 2):
    for z in range(10, 16): put(B, x, X1, z, SEAM)
# ojo al frente (y = 9, mira a la cámara): anillo negro, iris rojo y brillo; la lente sobresale un vóxel
ex, ez = 15.5, 12.5
for x in range(11, 21):
    for z in range(8, 18):
        r = math.hypot(x + .5 - (ex + .5), z + .5 - (ez + .5))
        if r <= 3.4: put(B, x, X0, z, LENS if r > 2.3 else RED)
        if r <= 2.3: put(B, x, X0 - 1, z, RED_HI if r < 1 else RED)
put(B, 14, X0 - 1, 14, 0xffffff)                                   # destello

# ---------- tapa con enchufes y cables que suben hacia el techo ----------
for x in range(12, 20):
    for y in range(12, 20):
        put(B, x, y, Z1 + 1, TRIM if x in (12, 19) or y in (12, 19) else STEEL_D)
for sx, sy in ((13, 13), (18, 18), (18, 13), (13, 18), (15, 16)):
    put(B, sx, sy, Z1 + 1, SEAM)                                    # enchufes: de acá salen los cables al techo
    put(B, sx, sy, Z1 + 2, CLAMP)                                   # (los cables largos que suben y se mecen los dibuja el juego)
# cables sueltos que cuelgan de los costados hasta la columna
for side in (-1, 1):
    x0 = X0 if side < 0 else X1
    for t in range(0, 9):
        k = t / 8
        x = round(x0 + side * (1.2 * math.sin(k * math.pi)) - side * k * 4)
        z = round(11 - 6 * math.sin(k * math.pi / 2))
        put(B, x, 15, z, CABLE); put(B, x, 16, z, CABLE_2)

n, v = write([body, legs], OUT)
print(f'MainFrame.vox: {n} partes (cuerpo {len(B)}, patas {len(L)} vóxeles)')
