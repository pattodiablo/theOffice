"""Genera assets/vox/props/bee.vox: la abeja robot (enemigo), según el diseño de Pat (sin la base).
Mira hacia +x (la cabeza en x alto, el aguijón en x = 0). Partes con nombre:
  · "abeja": cabeza con ojos, antenas, tórax negro con circuitos, abdomen a rayas, patas y aguijón
  · "alaL" / "alaR": las alas (el juego las hace aletear)
Todo el modelo se mueve (vuela), así que no bloquea el paso. Uso: python3 tools/generar_abeja.py"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generar_personajes as gp
from generar_personajes import Part, write

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/vox/props/bee.vox')

YEL, BLK, TIP, STING = 0xf2c230, 0x1a1b1e, 0xffe65a, 0x4a4d52
THX, CIRC_Y, CIRC_G = 0x16181b, 0xffd23c, 0x3be07c
HEAD, HEAD_D, EYE, EYE_D = 0xd4d8da, 0x9aa0a4, 0x6effd0, 0x23b98f
LEG, LEG_D, ANT = 0x8a9096, 0x5c6268, 0x6a7076
WING, VEIN = 0xc4dbe4, 0x8fb0bf
gp.GLOW.update({TIP: .6, CIRC_Y: .5, CIRC_G: .5, EYE: .8})

body, wl, wr = Part('abeja'), Part('alaL'), Part('alaR')
B = body.v
CY = 6                                   # centro a lo ancho (y = 0..12)
def put(d, x, y, z, c): d[(x, y, z)] = c

# abdomen: elipsoide a rayas, punta brillante y aguijón
for x in range(1, 12):
    for y in range(0, 13):
        for z in range(3, 13):
            if ((x - 6.5) / 5.6) ** 2 + ((y - CY) / 4.6) ** 2 + ((z - 7.5) / 4.4) ** 2 <= 1:
                stripe = (x // 2) % 2
                put(B, x, y, z, TIP if x <= 2 else (YEL if stripe else BLK))
for x in (0, 1): put(B, x, CY, 7, STING)                                 # aguijón
put(B, 0, CY, 6, STING)
# tórax: cubo negro con circuitos amarillos y verdes
for x in range(11, 18):
    for y in range(2, 11):
        for z in range(4, 12):
            put(B, x, y, z, THX)
for x in range(12, 17): put(B, x, 4, 11, CIRC_Y); put(B, x, 8, 11, CIRC_G)          # pistas en la tapa
for y in range(4, 9): put(B, 14, y, 11, CIRC_Y)
for z in range(5, 11, 2): put(B, 12 + z % 4, 2, z, CIRC_Y); put(B, 13 + z % 3, 10, z, CIRC_G)   # en los costados
put(B, 17, 3, 9, CIRC_Y); put(B, 17, 9, 6, CIRC_Y)
# cabeza: cubo gris claro con aristas oscuras y dos ojos grandes al frente
for x in range(18, 24):
    for y in range(3, 10):
        for z in range(5, 12):
            edge = (x in (18, 23)) + (y in (3, 9)) + (z in (5, 11)) >= 2
            put(B, x, y, z, HEAD_D if edge else HEAD)
for (ey0, ey1) in ((3, 5), (7, 9)):                                      # ojos que sobresalen
    for y in range(ey0, ey1 + 1):
        for z in range(7, 10):
            put(B, 24, y, z, EYE_D if (y in (ey0, ey1) and z in (7, 9)) else EYE)
# antenas
for side in (4, 8):
    for i, (x, z) in enumerate(((20, 12), (21, 13), (21, 14), (22, 15), (23, 15))):
        put(B, x, side, z, ANT)
# patas: tres pares desde abajo del tórax, hacia afuera y abajo
for lx in (12, 14, 16):
    for s, y0 in ((-1, 3), (1, 9)):
        put(B, lx, y0 + s, 3, LEG); put(B, lx, y0 + 2 * s, 2, LEG_D); put(B, lx, y0 + 2 * s, 1, LEG); put(B, lx + (1 if lx == 16 else -1 if lx == 12 else 0), y0 + 2 * s, 0, LEG_D)
# alas: placas finas que salen de la tapa del tórax hacia arriba y atrás, con venas
for wing, y in ((wl, 4), (wr, 8)):
    for x in range(6, 17):
        for z in range(12, 20):
            u, v = (x - 6) / 10, (z - 12) / 7                             # forma de gota: ancha arriba atrás
            if (u - .45) ** 2 / .3 + (v - .55) ** 2 / .32 <= 1 and not (z == 12 and x < 13):
                vein = x in (9, 13) or z == 16 or (u - .45) ** 2 / .3 + (v - .55) ** 2 / .32 > .75
                put(wing.v, x, y, z, VEIN if vein else WING)

n, v = write([body, wl, wr], OUT)
print(f'bee.vox: {n} partes ({len(B)} + {len(wl.v)} + {len(wr.v)} vóxeles)')
