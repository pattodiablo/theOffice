"""Genera public/characters/player.vox con el estilo del personaje principal (cabeza grande, pelo negro con
flequillo, lentes oscuros, gabardina negra abierta con camisa blanca y corbata). Sobrescribe el archivo.
    python3 tools/generar_jugador.py
Coordenadas en vóxeles: x hacia adelante, y a los costados, z hacia arriba (pies en z = 0).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_personajes import Part, write, OUT

SKIN, HAIR, COAT, LAPEL, PANTS, SHOE = 0xf1c9a5, 0x111215, 0x17191d, 0x0f1013, 0x141518, 0x0a0a0b
SHIRT, TIE, LENS, MOUTH = 0xe6ebee, 0x0b0c0e, 0x070708, 0xd2867a


class P(Part):
    def b(s, x0, x1, y0, y1, z0, z1, c):          # caja por vóxeles (límites incluidos)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                for z in range(z0, z1 + 1):
                    s.v[(x, y, z)] = c


def player():
    body, head = P("body"), P("head")
    legL, legR, armL, armR = P("legL"), P("legR"), P("armL"), P("armR")
    # piernas y zapatos
    for leg, y0 in ((legL, -4), (legR, 1)):
        leg.b(-1, 1, y0, y0 + 2, 1, 8, PANTS); leg.b(-1, 2, y0, y0 + 2, 0, 1, SHOE)
    # cuerpo: gabardina abierta, camisa blanca y corbata
    body.b(-3, 2, -5, 4, 9, 19, COAT)
    body.b(-3, -2, -5, 4, 5, 8, COAT); body.b(-3, 1, -5, -5, 5, 8, COAT); body.b(-3, 1, 4, 4, 5, 8, COAT)  # faldones (atrás y costados)
    body.b(2, 2, -2, 1, 11, 19, SHIRT)
    body.b(2, 2, -3, -3, 13, 19, LAPEL); body.b(2, 2, 2, 2, 13, 19, LAPEL)          # solapas
    body.b(3, 3, -1, 0, 18, 19, TIE); body.b(3, 3, -1, 0, 13, 17, TIE); body.b(3, 3, -1, -1, 12, 12, TIE)  # nudo y corbata
    # brazos: manga, puño y mano
    for arm, y0 in ((armL, -8), (armR, 5)):
        arm.b(-1, 1, y0, y0 + 2, 12, 19, COAT); arm.b(-1, 1, y0, y0 + 2, 11, 11, LAPEL); arm.b(-1, 1, y0, y0 + 2, 9, 10, SKIN)
    # cabeza grande
    head.b(-6, 6, -7, 6, 20, 33, SKIN)
    head.b(-6, 6, -7, 6, 31, 33, HAIR)                                              # arriba
    head.b(-6, -3, -7, 6, 21, 33, HAIR)                                             # nuca
    head.b(-6, 2, -7, -7, 26, 33, HAIR); head.b(-6, 2, 6, 6, 26, 33, HAIR)           # costados
    head.b(-1, 0, -7, -7, 23, 25, HAIR); head.b(-1, 0, 6, 6, 23, 25, HAIR)           # patillas
    head.b(-3, -2, -8, -8, 23, 25, SKIN); head.b(-3, -2, 7, 7, 23, 25, SKIN)         # orejas
    head.b(3, 6, -7, 6, 30, 33, HAIR)                                               # flequillo
    for k, y in enumerate(range(-7, 7)):                                            # puntas del flequillo
        if k % 3 != 2: head.b(5, 6, y, y, 29, 29, HAIR)
    head.b(7, 7, -6, -2, 25, 27, LENS); head.b(7, 7, 1, 5, 25, 27, LENS); head.b(7, 7, -1, 0, 27, 27, LENS)  # lentes
    head.b(1, 6, -7, -7, 27, 27, LENS); head.b(1, 6, 6, 6, 27, 27, LENS)             # patillas de los lentes
    head.b(6, 6, -1, 0, 22, 22, MOUTH)
    return [body, head, legL, legR, armL, armR]


if __name__ == "__main__":
    n, v = write(player(), os.path.join(OUT, "player.vox"))
    print(f"player.vox: {n} partes, {v} vóxeles")
