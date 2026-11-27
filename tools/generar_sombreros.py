"""Genera los sombreros (skins) en public/hats/<id>.vox. Cada archivo trae un solo modelo llamado "hat".
El sombrero mira hacia +x (el frente: la calavera del pirata, la visera de la gorra), centrado en x = 0, y = 0,
y su base en z = 0: el juego lo apoya arriba de la cabeza (HATS.sink en Settings.js lo hunde un poco).
Puedes retocarlos en MagicaVoxel; este script solo crea los que falten (usa --forzar para rehacerlos todos).
Uso: python3 tools/generar_sombreros.py [--forzar]"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generar_personajes as gp
from generar_personajes import Part, write

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/hats')
HATS = {}
def hat(f): HATS[f.__name__] = f; return f
def disc(d, r, z, c, ry=None, cx=0, cy=0):          # disco (elipse) relleno en la capa z
    if r < .5: return
    ry = ry or r
    for x in range(-int(r) - 1, int(r) + 2):
        for y in range(-int(ry) - 1, int(ry) + 2):
            if ((x + .5 - cx) / r) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1: d[(x, y, z)] = c(x, y) if callable(c) else c

@hat
def pirata(d):
    BLK, BLK2, WHT, GLD = 0x17181b, 0x2a2c31, 0xeeeae0, 0xd9a53a
    for z in range(0, 2): disc(d, 10, z, lambda x, y: BLK2 if abs(y) > 8 else BLK, ry=12)     # ala
    for z in range(2, 8): disc(d, 7 - max(0, z - 5), z, BLK, ry=9 - max(0, z - 5) * 1.5)     # copa
    for y in range(-12, 13):                                                                   # ala levantada a los lados
        for z in range(2, 6 - abs(y) // 5 if abs(y) > 8 else 2): d[(0, y, z)] = BLK
    for y in (-12, -11, 11, 12):
        for z in range(1, 5):
            for x in range(-4, 5): d[(x, y, z)] = BLK
    for y in range(-11, 12): d[(9, y, 1)] = GLD if abs(y) % 3 == 0 else d.get((9, y, 1), BLK)  # borde dorado
    skull = ['.###.', '#####', '#.#.#', '#####', '.#.#.']                                       # calavera al frente
    for r, row in enumerate(skull):
        for c, ch in enumerate(row):
            if ch == '#': d[(8, c - 2, 6 - r)] = WHT
    for x in range(7, 9):
        for y in range(-3, 4):
            for z in range(2, 7): d.setdefault((x, y, z), BLK)

@hat
def sombrero(d):
    YEL, ORG, RED, BRN = 0xf2c230, 0xe8892a, 0xc2381f, 0x8a3a24
    for z in range(0, 2):
        disc(d, 13, z, lambda x, y: RED if (x + .5) ** 2 + (y + .5) ** 2 > 11.6 ** 2 else (ORG if ((x + y) // 2) % 2 else YEL))
    for y in range(-13, 14):                                                    # borde del ala un poco levantado
        for x in range(-13, 14):
            if 12 ** 2 < (x + .5) ** 2 + (y + .5) ** 2 <= 13 ** 2: d[(x, y, 2)] = RED
    for z in range(2, 10):
        r = 5.5 if z < 7 else 5.5 - (z - 6) * 1.1
        disc(d, r, z, BRN if z >= 4 else (YEL if z == 2 else RED))
    for a in range(0, 360, 30):                                                 # adornos en la cinta
        x, y = round(5.6 * math.cos(math.radians(a))), round(5.6 * math.sin(math.radians(a)))
        d[(x, y, 3)] = YEL

@hat
def cono(d):
    ORG, WHT, BASE, TIP = 0xe8452a, 0xf2f2ee, 0xb8321f, 0xf2c230
    for z in range(0, 2):
        for x in range(-7, 7):
            for y in range(-7, 7): d[(x, y, z)] = BASE
    for z in range(2, 16):
        r = 5.6 - (z - 2) * .36
        disc(d, max(r, .8), z, WHT if z in (5, 6, 10, 11) else ORG)
    d[(0, 0, 16)] = TIP; d[(-1, -1, 16)] = TIP; d[(0, -1, 16)] = TIP; d[(-1, 0, 16)] = TIP
    gp.GLOW[TIP] = .6

@hat
def copa(d):
    BLK, BAND, BUCK = 0x15161a, 0x3be07c, 0xd9d9d9
    for z in range(0, 2): disc(d, 10, z, BLK, ry=11)
    for z in range(2, 14): disc(d, 6.5, z, BAND if z in (3, 4) else BLK, ry=7)
    for z in (3, 4):
        for y in (-1, 0): d[(6, y, z)] = BUCK
    gp.GLOW[BAND] = .4

@hat
def casco(d):
    YEL, YEL2, LAMP = 0xf4c419, 0xd6a812, 0xfff4b0
    for z in range(0, 2): disc(d, 10, z, YEL2, ry=10.5, cx=1.5)                   # ala más larga al frente
    for z in range(2, 9):
        r = math.sqrt(max(0, 8.2 ** 2 - (z - 1.5) ** 2 * 1.6))
        disc(d, r, z, YEL)
    for x in range(-7, 8): d[(x, 0, 8)] = YEL2                                     # cresta
    for y in (-1, 0):
        for z in (4, 5): d[(8, y, z)] = LAMP
    gp.GLOW[LAMP] = .8

@hat
def corona(d):
    GLD, GLD2, RUBY, EMER = 0xf2c230, 0xc8901a, 0xe0202c, 0x3be07c
    for z in range(0, 4):
        for x in range(-7, 8):
            for y in range(-7, 8):
                if 5.5 ** 2 < (x + .5) ** 2 + (y + .5) ** 2 <= 7.2 ** 2: d[(x, y, z)] = GLD2 if z == 0 else GLD
    for a in range(0, 360, 45):                                                   # puntas
        x, y = round(6.3 * math.cos(math.radians(a)) - .5), round(6.3 * math.sin(math.radians(a)) - .5)
        for z in range(4, 7): d[(x, y, z)] = GLD
        d[(x, y, 7)] = GLD2
    for a, c in ((0, RUBY), (90, EMER), (180, RUBY), (270, EMER)):
        x, y = round(7 * math.cos(math.radians(a)) - .5), round(7 * math.sin(math.radians(a)) - .5)
        d[(x, y, 2)] = c
    gp.GLOW.update({RUBY: .5, EMER: .5})

@hat
def fiesta(d):
    CYA, PNK, POM = 0x4fd2ff, 0xff5fa8, 0xfff27a
    for z in range(0, 14):
        r = 4.6 - z * .32
        disc(d, max(r, .7), z, lambda x, y, z=z: PNK if ((z + (x + y) // 3) % 4) < 2 else CYA)
    for x in (-1, 0):
        for y in (-1, 0):
            for z in (14, 15): d[(x, y, z)] = POM
    gp.GLOW[POM] = .5

@hat
def gorra(d):
    GRN, GRN2, VIS, LOGO = 0x2e8b4a, 0x1f6b36, 0x16181b, 0xeeeae0
    for z in range(0, 6):
        r = math.sqrt(max(0, 7.6 ** 2 - z ** 2 * 1.4))
        disc(d, r, z, GRN if z < 5 else GRN2, ry=r * 1.05)
    for x in range(6, 13):                                                          # visera al frente
        for y in range(-5, 5): d[(x, y, 0)] = VIS
    d[(0, 0, 6)] = GRN2; d[(-1, -1, 6)] = GRN2
    for y, z in ((-1, 3), (0, 3), (-1, 2), (0, 2)): d[(7, y, z)] = LOGO

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    force = '--forzar' in sys.argv
    for name, f in HATS.items():
        path = os.path.join(OUT, name + '.vox')
        if os.path.exists(path) and not force: print('ya existe', path); continue
        p = Part('hat'); f(p.v); n, v = write([p], path); print(name, v, 'vóxeles')
