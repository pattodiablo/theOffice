"""Genera assets/vox/props/realityportal.vox: el portal de realidad (final del juego), según el boceto de Pat.
Una puerta grande con marco biselado sobre un pedestal, una tubería que sale del marco y baja a un contenedor
(ahí se echan los cristales), todo sobre una plataforma con anillos alrededor de la puerta.
El frente (la abertura) mira a y = 0, hacia la cámara.
Dos partes con nombre:
  · "base":       puerta, pedestal, tuberías y contenedor (va pegado al escenario: bloquea el paso)
  · "plataforma": el piso con los anillos (se dibuja pero se puede caminar encima)
La espiral de la abertura, el vidrio del contenedor y los cristales adentro los dibuja el juego (RealityPortal.js).
Uso: python3 tools/generar_portal.py   (sobrescribe el .vox; después se edita en MagicaVoxel manteniendo los nombres)"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generar_personajes as gp
from generar_personajes import Part, write

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/vox/props/realityportal.vox')
W, D = 44, 26
GATE_X0, GATE_X1, GATE_Y0, GATE_Y1, GATE_Z0, GATE_Z1 = 7, 26, 9, 11, 4, 30     # marco de la puerta
HOLE_X0, HOLE_X1, HOLE_Z0, HOLE_Z1 = 10, 23, 7, 27                                 # abertura (ahí va la espiral)
CX, CY, CR, CZ0, CZ1 = 36, 10, 4.6, 1, 14                                          # contenedor (cilindro)

FRAME, FRAME_D, TRIM, BOLT = 0x40464d, 0x2e3338, 0x7d878f, 0xb6bcc0
PLAT, PLAT_RIM, GROOVE = 0x474d54, 0x6a737b, 0x2a6a80
PIPE, RIB, CAP = 0x5c646c, 0x353b41, 0x6f7880
GLOW = 0x7fdcff
gp.GLOW.update({GLOW: .7, GROOVE: .3})

base, plat = Part('base'), Part('plataforma')
B, P = base.v, plat.v
def put(d, x, y, z, c):
    if 0 <= x < W and 0 <= y < D and 0 <= z < 32: d[(x, y, z)] = c

# ---------- plataforma: losa redondeada de 1 vóxel con anillos alrededor de la puerta ----------
gx, gy = (GATE_X0 + GATE_X1 + 1) / 2, GATE_Y0 + 1.5
for x in range(W):
    for y in range(D):
        cx, cy = min(x, W - 1 - x), min(y, D - 1 - y)
        if cx < 5 and cy < 5 and math.hypot(5 - cx, 5 - cy) > 5.2: continue          # esquinas redondeadas
        edge = cx == 0 or cy == 0 or (cx < 5 and cy < 5 and math.hypot(5 - cx, 5 - cy) > 4.2)
        r = math.hypot((x + .5 - gx) / 1.25, y + .5 - gy)                            # anillos (un poco ovalados)
        ring = any(abs(r - k) < .5 for k in (14, 17.5))
        put(P, x, y, 0, PLAT_RIM if edge else GROOVE if ring else PLAT)

# ---------- pedestal trapezoidal ----------
for z in range(1, GATE_Z0):
    grow = GATE_Z0 - z                                                               # más ancho abajo
    for x in range(GATE_X0 + 2 - grow, GATE_X1 - 1 + grow):
        for y in range(GATE_Y0 - grow, GATE_Y1 + 1 + grow):
            top = z == GATE_Z0 - 1
            put(B, x, y, z, TRIM if top else FRAME_D)

# ---------- marco de la puerta (biselado en las esquinas) ----------
for x in range(GATE_X0, GATE_X1 + 1):
    for z in range(GATE_Z0, GATE_Z1 + 1):
        cx, cz = min(x - GATE_X0, GATE_X1 - x), min(z - GATE_Z0, GATE_Z1 - z)
        if cx + cz < 3: continue                                                     # bisel
        inside = HOLE_X0 <= x <= HOLE_X1 and HOLE_Z0 <= z <= HOLE_Z1
        if inside: continue                                                          # abertura
        for y in range(GATE_Y0, GATE_Y1 + 1):
            hx, hz = min(abs(x - HOLE_X0 + 1), abs(x - HOLE_X1 - 1)), min(abs(z - HOLE_Z0 + 1), abs(z - HOLE_Z1 - 1))
            lip = (HOLE_X0 - 1 <= x <= HOLE_X1 + 1 and HOLE_Z0 - 1 <= z <= HOLE_Z1 + 1)    # borde de la abertura
            col = GLOW if (lip and y == GATE_Y0) else TRIM if (cx + cz == 3 or cx == 0 or cz == 0) else FRAME
            put(B, x, y, z, col)
# pernos en las cuatro esquinas del frente
for bx, bz in ((GATE_X0 + 2, GATE_Z1 - 3), (GATE_X1 - 2, GATE_Z1 - 3), (GATE_X0 + 2, GATE_Z0 + 2), (GATE_X1 - 2, GATE_Z0 + 2)):
    put(B, bx, GATE_Y0 - 1, bz, BOLT)

# ---------- tuberías: salen del costado del marco, cruzan y bajan al contenedor ----------
def pipe(z_top, y0, th, x_end):
    """tubo de grosor th: horizontal a la altura z_top desde el marco hasta x_end y luego baja al contenedor"""
    for x in range(GATE_X1 + 1, x_end + th):
        for dz in range(th):
            for dy in range(th): put(B, x, y0 + dy, z_top - dz, RIB if x % 2 == 0 else PIPE)
    for z in range(CZ1, z_top - th + 1):
        for dx in range(th):
            for dy in range(th): put(B, x_end + dx, y0 + dy, z, RIB if z % 2 == 0 else PIPE)
pipe(25, CY - 1, 3, CX - 1)                   # el grueso
pipe(19, CY - 3, 2, CX - 4)                   # el delgado, por delante

# ---------- contenedor: tapa abajo, tapa arriba y 4 columnas (el vidrio lo dibuja el juego) ----------
for x in range(CX - 6, CX + 7):
    for y in range(CY - 6, CY + 7):
        r = math.hypot(x + .5 - (CX + .5), y + .5 - (CY + .5))
        if r <= CR + .9:
            for z in (CZ0, CZ0 + 1): put(B, x, y, z, CAP if r > CR - .6 else FRAME_D)
            put(B, x, y, CZ1, CAP if r > CR - .6 else FRAME_D)
            if r > CR - .1: put(B, x, y, CZ0 + 2, GLOW)                                 # anillo de luz abajo
for a in range(4):
    ang = a * math.pi / 2 + math.pi / 4
    px, py = round(CX + .5 + math.cos(ang) * CR - .5), round(CY + .5 + math.sin(ang) * CR - .5)
    for z in range(CZ0 + 2, CZ1): put(B, px, py, z, TRIM)

n, v = write([base, plat], OUT)
print(f'realityportal.vox: {n} partes (base {len(B)}, plataforma {len(P)} vóxeles)')
