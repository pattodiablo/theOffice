"""Regenera los .vox originales (base de la oficina y props) desde código.
Solo hace falta si quieres volver a los modelos de partida: sobrescribe assets/vox/.
Uso: python3 tools/generar_vox_originales.py"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
import struct, random, sys
random.seed(7)

# ---------- palette ----------
PAL = {}
COLORS = []
def col(name, rgb):
    COLORS.append(rgb); PAL[name] = len(COLORS)  # index 1..255
for n, c in [
    ("tile_a", (214, 218, 222)), ("tile_b", (196, 201, 206)), ("slab", (120, 124, 130)),
    ("wall", (226, 228, 230)), ("wall_shade", (200, 203, 207)), ("wall_cap", (110, 115, 122)),
    ("glass", (170, 205, 235)), ("glass_hi", (215, 235, 250)), ("frame", (90, 96, 104)),
    ("lamp", (245, 250, 255)), ("lamp_frame", (150, 155, 160)),
    ("desk_top", (205, 198, 185)), ("desk_body", (165, 168, 172)), ("handle", (70, 72, 76)),
    ("panel", (170, 190, 205)), ("panel_frame", (130, 135, 140)),
    ("monitor", (40, 44, 50)), ("screen", (60, 80, 110)), ("keyboard", (55, 58, 62)),
    ("paper", (245, 245, 240)), ("chair", (40, 70, 170)), ("chair_dark", (28, 50, 125)),
    ("metal", (60, 62, 66)), ("pot", (150, 95, 55)), ("pot_dark", (120, 75, 45)),
    ("leaf_a", (70, 150, 60)), ("leaf_b", (45, 115, 45)), ("leaf_c", (110, 180, 80)), ("soil", (70, 50, 35)),
    ("copier", (235, 235, 232)), ("copier_dark", (80, 82, 88)), ("cabinet", (200, 175, 130)),
    ("cabinet_dark", (165, 140, 100)), ("cooler", (240, 242, 245)), ("water", (90, 160, 230)),
    ("exit_green", (40, 200, 70)), ("exit_text", (250, 255, 250)), ("door_frame", (110, 115, 122)),
    ("wood", (190, 145, 95)), ("wood_dark", (160, 118, 75)), ("stone", (175, 178, 182)), ("stone_dark", (140, 143, 148)),
    ("rail", (205, 208, 210)), ("vent", (150, 153, 158)),
]:
    col(n, c)

class Grid:
    def __init__(s): s.v = {}
    def put(s, x, y, z, c):
        s.v[(x, y, z)] = PAL[c]
    def box(s, x0, y0, z0, x1, y1, z1, c):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                for z in range(z0, z1 + 1):
                    s.put(x, y, z, c)
    def clear(s, x0, y0, z0, x1, y1, z1):
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                for z in range(z0, z1 + 1):
                    s.v.pop((x, y, z), None)

# ---------- props (origin = min corner, z = ground level) ----------
def desk(g, ox, oy, oz):
    B = lambda *a: g.box(a[0]+ox, a[1]+oy, a[2]+oz, a[3]+ox, a[4]+oy, a[5]+oz, a[6])
    # partitions: back + left side
    B(0, 13, 0, 18, 13, 13, "panel"); B(0, 13, 14, 18, 13, 14, "panel_frame")
    B(0, 4, 0, 0, 12, 13, "panel"); B(0, 4, 14, 0, 13, 14, "panel_frame")
    for x in (0, 18): B(x, 13, 0, x, 13, 14, "panel_frame")
    B(0, 4, 0, 0, 4, 14, "panel_frame")
    # L desk top
    B(1, 7, 6, 17, 12, 6, "desk_top"); B(12, 2, 6, 17, 6, 6, "desk_top")
    # pedestal
    B(13, 3, 0, 17, 9, 5, "desk_body")
    for z in (1, 3, 5): B(15, 2, z, 15, 2, z, "handle")
    B(13, 2, 0, 17, 2, 5, "desk_body")
    for z in (1, 3, 5): B(15, 2, z, 15, 2, z, "handle")
    # legs
    B(1, 7, 0, 1, 7, 5, "metal"); B(1, 12, 0, 1, 12, 5, "metal")
    # monitor
    B(4, 11, 7, 10, 11, 12, "monitor"); B(5, 10, 8, 9, 10, 11, "screen")
    B(7, 12, 7, 7, 12, 8, "metal")
    B(4, 8, 7, 10, 8, 7, "keyboard")
    B(14, 4, 7, 16, 6, 7, "paper"); B(15, 9, 7, 16, 10, 9, "monitor")  # papers + small tower
    # chair
    cx, cy = 7, 3
    B(cx-2, cy-1, 0, cx+2, cy-1, 0, "metal"); B(cx, cy-3, 0, cx, cy+1, 0, "metal")
    B(cx, cy-1, 1, cx, cy-1, 2, "metal")
    B(cx-2, cy-3, 3, cx+2, cy+1, 3, "chair"); B(cx-2, cy-4, 4, cx+2, cy-4, 9, "chair_dark")
    B(cx-2, cy-4, 4, cx+2, cy-4, 4, "chair")

def plant(g, ox, oy, oz, size=1.0):
    r = int(3 * size)
    g.box(ox, oy, oz, ox + 2*r, oy + 2*r, oz + 2*r, "pot")
    g.box(ox, oy, oz + 2*r, ox + 2*r, oy + 2*r, oz + 2*r, "pot_dark")
    g.box(ox+1, oy+1, oz + 2*r, ox + 2*r-1, oy + 2*r-1, oz + 2*r, "soil")
    cx, cy, cz = ox + r, oy + r, oz + 2*r + int(4*size)
    R = 3.6 * size
    for x in range(int(cx-R)-1, int(cx+R)+2):
        for y in range(int(cy-R)-1, int(cy+R)+2):
            for z in range(int(cz-R), int(cz+R)+2):
                d = ((x-cx)**2 + (y-cy)**2 + ((z-cz)*1.2)**2) ** .5
                if d <= R and random.random() < 0.85:
                    g.put(x, y, z, random.choice(["leaf_a", "leaf_a", "leaf_b", "leaf_c"]))
    g.box(cx, cy, oz + 2*r + 1, cx, cy, cz - 2, "leaf_b")

def copier(g, ox, oy, oz):
    g.box(ox, oy, oz, ox+11, oy+8, oz+9, "copier")
    g.box(ox, oy, oz, ox+11, oy+8, oz, "copier_dark")
    for z in (3, 6): g.box(ox+1, oy, oz+z, ox+10, oy, oz+z, "copier_dark")
    g.box(ox+1, oy+1, oz+10, ox+10, oy+7, oz+10, "copier_dark")
    g.box(ox+2, oy+2, oz+11, ox+9, oy+6, oz+11, "copier")
    g.box(ox+7, oy+1, oz+10, ox+9, oy+2, oz+10, "screen")

def cabinet(g, ox, oy, oz, h=10):
    g.box(ox, oy, oz, ox+6, oy+6, oz+h, "cabinet")
    for z in range(3, h, 4):
        g.box(ox, oy, oz+z, ox+6, oy, oz+z, "cabinet_dark")
        g.put(ox+3, oy, oz+z+2, "handle")

def cooler(g, ox, oy, oz):
    g.box(ox, oy, oz, ox+5, oy+5, oz+10, "cooler")
    g.box(ox+2, oy, oz+6, ox+3, oy, oz+6, "metal")
    for x in range(ox+1, ox+5):
        for y in range(oy+1, oy+5):
            for z in range(oz+11, oz+17):
                g.put(x, y, z, "water")
    g.box(ox+2, oy+2, oz+17, ox+3, oy+3, oz+17, "water")

FONT = {"E": ["111", "100", "110", "100", "111"], "X": ["101", "101", "010", "101", "101"],
        "I": ["111", "010", "010", "010", "111"], "T": ["111", "010", "010", "010", "010"]}

def exit_door(g, ox, yface, oz, wall_y):
    # door opening in wall along x, viewer at -y; yface = front face y of wall
    w = 12; h = 22
    g.clear(ox, yface, oz, ox+w, wall_y, oz+h)
    g.box(ox, yface, oz, ox, yface+1, oz+h, "door_frame"); g.box(ox+w, yface, oz, ox+w, yface+1, oz+h, "door_frame")
    g.box(ox, yface, oz+h, ox+w, yface+1, oz+h, "door_frame")
    g.box(ox+1, yface+1, oz, ox+w-1, yface+1, oz+h-1, "glass")
    g.box(ox+6, yface+1, oz, ox+6, yface+1, oz+h-1, "door_frame")
    g.box(ox+4, yface, oz+10, ox+5, yface, oz+10, "metal"); g.box(ox+7, yface, oz+10, ox+8, yface, oz+10, "metal")
    # sign
    sx, sz = ox - 2, oz + h + 2
    g.box(sx, yface-1, sz, sx+16, yface-1, sz+6, "exit_green")
    for i, ch in enumerate("EXIT"):
        for r, row in enumerate(FONT[ch]):
            for c, bit in enumerate(row):
                if bit == "1":
                    g.put(sx + 1 + i*4 + c, yface-2, sz + 5 - r, "exit_text")

def railing(g, x0, y0, x1, y1, oz, base=4, top=11):
    # straight line along x or y
    pts = [(x, y) for x in range(x0, x1+1) for y in range(y0, y1+1)]
    for i, (x, y) in enumerate(pts):
        for z in range(oz, oz+base): g.put(x, y, z, "stone" if z < oz+base-1 else "stone_dark")
        if i % 10 == 0 or i == len(pts)-1:
            for z in range(oz+base, oz+top+1): g.put(x, y, z, "stone")
        elif i % 3 == 0:
            for z in range(oz+base, oz+top): g.put(x, y, z, "rail")
        g.put(x, y, oz+top, "rail")

# ---------- scene ----------
def scene():
    g = Grid()
    W, D, H = 128, 104, 30
    Z = 3
    # floor
    g.box(0, 0, 0, W-1, D-1, 1, "slab")
    for x in range(W):
        for y in range(D):
            g.put(x, y, 2, "tile_a" if ((x//8)+(y//8)) % 2 == 0 else "tile_b")
    # left wall x=0..1 (with windows), back wall y=D-2..D-1
    g.box(0, 0, Z, 1, D-1, H, "wall"); g.box(0, 0, H, 1, D-1, H+1, "wall_cap")
    g.box(0, D-2, Z, W-1, D-1, H, "wall"); g.box(0, D-2, H, W-1, D-1, H+1, "wall_cap")
    g.box(2, 0, Z, 2, D-3, Z+1, "wall_shade"); g.box(2, D-3, Z, W-1, D-3, Z+1, "wall_shade")  # skirting
    # windows on left wall
    for wy0 in range(40, 92, 10):
        g.box(0, wy0, Z+10, 1, wy0+9, Z+21, "frame")
        g.box(0, wy0+1, Z+11, 1, wy0+8, Z+20, "glass")
        g.box(1, wy0+2, Z+17, 1, wy0+4, Z+19, "glass_hi")
    # vents on left wall front part
    for vy in (10, 22): g.box(2, vy, Z+12, 2, vy+2, Z+14, "vent")
    # wall lamps
    for ly in (20, 50, 80): g.box(2, ly, Z+23, 2, ly+8, Z+24, "lamp"); g.box(2, ly-1, Z+22, 2, ly+9, Z+22, "lamp_frame")
    for lx in (20, 50, 78): g.box(lx, D-3, Z+23, lx+8, D-3, Z+24, "lamp"); g.box(lx-1, D-3, Z+22, lx+9, D-3, Z+22, "lamp_frame")
    # back-wall furniture
    cabinet(g, 30, D-9, Z, 9)
    g.box(31, D-8, Z+10, 35, D-4, Z+13, "copier")   # microwave-ish box on cabinet
    g.box(32, D-8, Z+11, 34, D-8, Z+12, "screen")
    copier(g, 42, D-12, Z)
    cabinet(g, 58, D-9, Z, 9)
    cooler(g, 68, D-9, Z)
    plant(g, 76, D-10, Z, 1.0)
    exit_door(g, 88, D-2, Z, D-1)
    plant(g, 4, D-10, Z, 1.0)
    plant(g, 3, 40, Z, 0.9)
    # front low wall (y=0) left part + railing rest; right railing x=W-1
    g.box(2, 0, Z, 30, 1, Z+12, "wall"); g.box(2, 0, Z+12, 30, 1, Z+12, "wall_cap")
    railing(g, 31, 0, W-1, 0, Z)
    railing(g, W-1, 1, W-1, D-3, Z)
    for px in (36, 66, 96):
        plant(g, px, 2, Z, 0.8)
    plant(g, W-9, 30, Z, 0.8)
    # raised wooden deck at back-right corner, with its own railing
    dx0, dy0 = 104, 66
    g.box(dx0, dy0, Z, W-2, D-3, Z+1, "wood_dark")
    for x in range(dx0, W-1):
        g.box(x, dy0, Z+2, x, D-3, Z+2, "wood" if (x - dx0) % 4 else "wood_dark")
    railing(g, dx0, dy0, dx0, D-14, Z+3, base=1, top=8)
    railing(g, dx0, dy0, W-2, dy0, Z+3, base=1, top=8)
    plant(g, W-10, D-11, Z+3, 0.8)
    # cubicles
    for (x, y) in [(10, 66), (42, 64), (8, 36), (40, 38), (74, 40), (24, 10), (66, 12)]:
        desk(g, x, y, Z)
        if random.random() < 0.6:
            plant(g, x+15, y+9, Z+7, 0.35)
    return g

# ---------- VOX writer ----------
def write_vox(g, path):
    xs = [p[0] for p in g.v]; ys = [p[1] for p in g.v]; zs = [p[2] for p in g.v]
    mx, my, mz = min(xs), min(ys), min(zs)
    sx, sy, sz = max(xs)-mx+1, max(ys)-my+1, max(zs)-mz+1
    assert max(sx, sy, sz) <= 256, (sx, sy, sz)
    def chunk(tag, content, children=b""):
        return tag + struct.pack("<ii", len(content), len(children)) + content + children
    size = chunk(b"SIZE", struct.pack("<iii", sx, sy, sz))
    data = b"".join(struct.pack("<BBBB", x-mx, y-my, z-mz, c) for (x, y, z), c in g.v.items())
    xyzi = chunk(b"XYZI", struct.pack("<i", len(g.v)) + data)
    rgba = b""
    for i in range(256):
        r, gg, b = COLORS[i] if i < len(COLORS) else (0, 0, 0)
        rgba += struct.pack("<BBBB", r, gg, b, 255)
    pal = chunk(b"RGBA", rgba)
    children = size + xyzi + pal
    with open(path, "wb") as f:
        f.write(b"VOX " + struct.pack("<i", 150) + chunk(b"MAIN", b"", children))
    return (sx, sy, sz), len(g.v)

# ---------- preview (iso from +x,-y) ----------
def preview(g, path, s=4):
    from PIL import Image, ImageDraw
    occ = g.v
    vis = [(p, c) for p, c in occ.items()
           if (p[0]+1, p[1], p[2]) not in occ or (p[0], p[1]-1, p[2]) not in occ or (p[0], p[1], p[2]+1) not in occ]
    cw, ch = s * 0.866, s * 0.5
    def proj(x, y, z): return ((x + y) * cw, -(y - x) * ch - z * s)
    pts = [proj(*p) for p, _ in vis]
    minx = min(p[0] for p in pts) - 20; miny = min(p[1] for p in pts) - 20
    maxx = max(p[0] for p in pts) + 20; maxy = max(p[1] for p in pts) + 20
    img = Image.new("RGB", (int(maxx-minx), int(maxy-miny)), (245, 245, 245))
    d = ImageDraw.Draw(img)
    vis.sort(key=lambda pc: (-(pc[0][1]-pc[0][0]), pc[0][2]))
    for (x, y, z), c in vis:
        r, gg, b = COLORS[c-1]
        def P(a, bb, cc):
            X, Y = proj(a, bb, cc); return (X-minx, Y-miny)
        top = [P(x, y, z+1), P(x+1, y, z+1), P(x+1, y+1, z+1), P(x, y+1, z+1)]
        front = [P(x, y, z), P(x+1, y, z), P(x+1, y, z+1), P(x, y, z+1)]
        right = [P(x+1, y, z), P(x+1, y+1, z), P(x+1, y+1, z+1), P(x+1, y, z+1)]
        sh = lambda k: (int(r*k), int(gg*k), int(b*k))
        d.polygon(front, fill=sh(0.82)); d.polygon(right, fill=sh(0.68)); d.polygon(top, fill=sh(1.0))
    img.save(path)


W,D,H,Z=128,104,34,3
def shell():
    g=Grid()
    g.box(0,0,0,W-1,D-1,1,"slab")
    for x in range(W):
        for y in range(D):
            g.put(x,y,2,"tile_a" if ((x//8)+(y//8))%2==0 else "tile_b")
    g.box(0,0,Z,1,D-1,30,"wall"); g.box(0,0,30,1,D-1,31,"wall_cap")
    g.box(0,D-2,Z,W-1,D-1,30,"wall"); g.box(0,D-2,30,W-1,D-1,31,"wall_cap")
    g.box(2,0,Z,2,D-3,Z+1,"wall_shade"); g.box(2,D-3,Z,W-1,D-3,Z+1,"wall_shade")
    for wy0 in range(40,92,10):
        g.box(0,wy0,Z+10,1,wy0+9,Z+21,"frame"); g.box(0,wy0+1,Z+11,1,wy0+8,Z+20,"glass"); g.box(1,wy0+2,Z+17,1,wy0+4,Z+19,"glass_hi")
    for vy in (10,22): g.box(2,vy,Z+12,2,vy+2,Z+14,"vent")
    for ly in (20,50,80): g.box(2,ly,Z+23,2,ly+8,Z+24,"lamp"); g.box(2,ly-1,Z+22,2,ly+9,Z+22,"lamp_frame")
    for lx in (20,50,78): g.box(lx,D-3,Z+23,lx+8,D-3,Z+24,"lamp"); g.box(lx-1,D-3,Z+22,lx+9,D-3,Z+22,"lamp_frame")
    exit_door(g,88,D-2,Z,D-1)
    g.box(2,0,Z,30,1,Z+12,"wall"); g.box(2,0,Z+12,30,1,Z+12,"wall_cap")
    railing(g,31,0,W-1,0,Z); railing(g,W-1,1,W-1,D-3,Z)
    return g
def muro(g,ox,oy,oz):
    g.box(ox,oy,oz,ox+1,oy+11,oz+26,"wall"); g.box(ox,oy,oz+26,ox+1,oy+11,oz+27,"wall_cap"); g.box(ox,oy,oz,ox+1,oy+11,oz+1,"wall_shade")
def panel(g,ox,oy,oz):
    g.box(ox,oy,oz,ox,oy+13,oz+13,"panel"); g.box(ox,oy,oz+14,ox,oy+13,oz+14,"panel_frame")
    g.box(ox,oy,oz,ox,oy,oz+14,"panel_frame"); g.box(ox,oy+13,oz,ox,oy+13,oz+14,"panel_frame")
def micro(g,ox,oy,oz):
    cabinet(g,ox,oy,oz,9); g.box(ox+1,oy+1,oz+10,ox+5,oy+5,oz+13,"copier"); g.box(ox+2,oy+1,oz+11,ox+4,oy+1,oz+12,"screen")
PROPS={"desk":("Cubículo",lambda g:desk(g,0,0,0)),"plant":("Planta",lambda g:plant(g,0,0,0,1.0)),
 "plant_s":("Planta chica",lambda g:plant(g,0,0,0,0.8)),"copier":("Fotocopiadora",lambda g:copier(g,0,0,0)),
 "cabinet":("Archivador",lambda g:cabinet(g,0,0,0,9)),"micro":("Archivador + micro",lambda g:micro(g,0,0,0)),
 "cooler":("Dispensador",lambda g:cooler(g,0,0,0)),"panel":("Panel",lambda g:panel(g,0,0,0)),"muro":("Muro",lambda g:muro(g,0,0,0))}

if __name__ == "__main__":
    write_vox(shell(), os.path.join(ROOT, "assets/vox/oficina_base.vox"))
    for k, (name, fn) in PROPS.items():
        random.seed(11); g = Grid(); fn(g)
        write_vox(g, os.path.join(ROOT, "assets/vox/props", k + ".vox"))
    write_vox(scene(), os.path.join(ROOT, "assets/vox/oficina_concept.vox"))
    print("listo: assets/vox/")
