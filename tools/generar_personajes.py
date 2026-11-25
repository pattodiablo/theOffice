"""Genera los personajes actuales como archivos .vox de MagicaVoxel, separados en partes.

Salida: public/characters/player.vox, agent.vox y agent_red.vox
Cada archivo trae un modelo por parte con su nombre: body, head, armL, armR, legL, legR
(el agente rojo trae además armR_gun, que va pegado al brazo derecho).

Solo hace falta correrlo una vez (o para volver a los modelos originales):
    python3 tools/generar_personajes.py
Después los editas directamente en MagicaVoxel; el juego los lee tal cual al recargar.
"""
import math, os, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public/characters")
S = 0.5  # tamaño de un vóxel en unidades del juego (el personaje mide ~32 vóxeles)

SKIN, SHOE = 0xf1c9a5, 0x111111
GLOW = {0xe0202c: 0.5}  # colores que brillan (material Emit de MagicaVoxel)


def rgb(h): return ((h >> 16) & 255, (h >> 8) & 255, h & 255)


class Part:
    """Vóxeles de una parte en coordenadas del personaje (x adelante, y = -z de Three.js, z arriba)."""
    def __init__(s, name, ox=0, oy=0, oz=0):
        s.name, s.o, s.v = name, (ox, oy, oz), {}

    def box(s, w, h, d, color, x, y, z):
        # misma firma que box() de Character.js: tamaño y centro en Three.js, relativos al hueso
        ox, oy, oz = s.o
        cx, cy, cz = ox + x, oy + y, oz + z
        rx = rng((cx - w / 2) / S, (cx + w / 2) / S)
        ry = rng(-(cz + d / 2) / S, -(cz - d / 2) / S)
        rz = rng((cy - h / 2) / S, (cy + h / 2) / S)
        for i in rx:
            for j in ry:
                for k in rz:
                    s.v[(i, j, k)] = color


def rng(lo, hi):
    a, b = round(lo), round(hi)
    if b <= a:  # más fino que un vóxel: queda incrustado en la superficie
        a = math.floor(lo); b = a + 1
    return range(a, b)


def character(agent, red=False):
    pants = 0x2a0a0d if red else 0x1b1d22 if agent else 0x34394a
    top = 0xe0202c if red else 0x17191d if agent else 0xf2f3f5
    hair = 0x101114 if agent else 0x3a2a1e
    parts = []
    body = Part("body"); parts.append(body)
    for n, z in (("legL", -1), ("legR", 1)):
        l = Part(n, 0, 5, z); l.box(1.6, 5, 1.6, pants, 0, -2.5, 0); l.box(2.4, 1, 1.8, SHOE, .4, -4.6, 0); parts.append(l)
    arms = {}
    for n, z in (("armL", -1), ("armR", 1)):
        a = Part(n, 0, 9.8, z * (3.1 if agent else 2.8)); a.box(1.5, 4.8, 1.5, top, 0, -2.4, 0); a.box(1.3, 1.3, 1.3, SKIN, 0, -5.2, 0)
        parts.append(a); arms[n] = a
    if agent:
        body.box(3.8, 7.5, 5, top, 0, 7.2, 0); body.box(4.2, 2.6, 5.6, top, 0, 4.6, 0)
        body.box(3.9, .7, 5.1, 0x2c2f35, 0, 8.4, 0); body.box(.3, .9, 1, 0xb8bcc4, 2, 8.4, 0)
        h = Part("head", 0, 10.8, 0)
        h.box(5.6, 5.6, 5.6, SKIN, 0, 2.8, 0); h.box(6, 2, 6, hair, -.2, 5.8, 0); h.box(1.2, 4, 6, hair, -2.6, 3.8, 0)
        h.box(.7, 1.9, 6.2, 0xff2a2a if red else 0x050506, 2.9, 3.4, 0); h.box(.2, .5, 1.8, 0x9ab0c8, 3.25, 3.8, -1.6)
        h.box(.3, .25, 1.6, 0x6b4a3a, 2.85, 1, 0)
    else:
        body.box(3, 5, 4.4, top, 0, 7.5, 0); body.box(.3, 4, .9, 0x1d2b4a, 1.55, 7.6, 0)
        h = Part("head", 0, 10, 0)
        h.box(6, 6, 6, SKIN, 0, 3, 0); h.box(6.4, 1.6, 6.4, hair, 0, 6.4, 0); h.box(2, 2, 1.6, hair, -1, 7.6, .6)
        for s in (-1.4, 1.4):
            h.box(.3, 1.8, 1.6, 0xffffff, 3.05, 3.4, s); h.box(.35, .9, .8, SHOE, 3.15, 3.2, s)
        h.box(.3, .3, 1.2, 0x5a3a2a, 3.05, 1.2, 0)
    parts.append(h)
    if red:
        g = Part("armR_gun", *arms["armR"].o); g.box(3, .9, .9, 0x15171a, 1.1, -5.2, 0); parts.append(g)
    return parts


# ---------- escritura .vox con escena (varios modelos con nombre) ----------
def chunk(tag, content, children=b""):
    return tag + struct.pack("<ii", len(content), len(children)) + content + children


def vstr(s):
    b = s.encode(); return struct.pack("<i", len(b)) + b


def vdict(d):
    return struct.pack("<i", len(d)) + b"".join(vstr(k) + vstr(v) for k, v in d.items())


def write(parts, path):
    colors = []
    for p in parts:
        for c in p.v.values():
            if c not in colors: colors.append(c)
    assert len(colors) <= 255
    idx = {c: i + 1 for i, c in enumerate(colors)}
    body = b""; models = []
    for p in parts:
        xs, ys, zs = zip(*p.v)
        mn = (min(xs), min(ys), min(zs)); size = tuple(max(a) - m + 1 for a, m in zip((xs, ys, zs), mn))
        body += chunk(b"SIZE", struct.pack("<iii", *size))
        body += chunk(b"XYZI", struct.pack("<i", len(p.v)) + b"".join(
            struct.pack("<BBBB", x - mn[0], y - mn[1], z - mn[2], idx[c]) for (x, y, z), c in p.v.items()))
        # MagicaVoxel ubica el centro del modelo (tamaño // 2) en la traslación del nodo
        models.append((p.name, tuple(m + s // 2 for m, s in zip(mn, size))))
    # escena: nTRN raíz (0) → nGRP (1) → por cada modelo nTRN (2+2i) → nSHP (3+2i)
    n = len(models)
    body += chunk(b"nTRN", struct.pack("<i", 0) + vdict({}) + struct.pack("<iiii", 1, -1, -1, 1) + vdict({}))
    body += chunk(b"nGRP", struct.pack("<i", 1) + vdict({}) + struct.pack("<i", n) + b"".join(struct.pack("<i", 2 + 2 * i) for i in range(n)))
    for i, (name, t) in enumerate(models):
        body += chunk(b"nTRN", struct.pack("<i", 2 + 2 * i) + vdict({"_name": name}) + struct.pack("<iiii", 3 + 2 * i, -1, 0, 1)
                      + vdict({"_t": "%d %d %d" % t}))
        body += chunk(b"nSHP", struct.pack("<i", 3 + 2 * i) + vdict({}) + struct.pack("<i", 1) + struct.pack("<i", i) + vdict({}))
    pal = b"".join(struct.pack("<BBBB", *rgb(colors[i]), 255) if i < len(colors) else struct.pack("<BBBB", 0, 0, 0, 255) for i in range(256))
    body += chunk(b"RGBA", pal)
    body += chunk(b"LAYR", struct.pack("<i", 0) + vdict({"_name": "personaje"}) + struct.pack("<i", -1))
    for c, e in GLOW.items():
        if c in idx:
            body += chunk(b"MATL", struct.pack("<i", idx[c]) + vdict({"_type": "_emit", "_emit": str(e), "_flux": "0"}))
    with open(path, "wb") as f:
        f.write(b"VOX " + struct.pack("<i", 150) + chunk(b"MAIN", b"", body))
    return n, sum(len(p.v) for p in parts)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, args in (("player", (False,)), ("agent", (True,)), ("agent_red", (True, True))):
        n, v = write(character(*args), os.path.join(OUT, name + ".vox"))
        print(f"{name}.vox: {n} partes, {v} vóxeles")
