"""Borradores de los pisos 14 a 20 (para revisarlos y terminarlos en el editor).
Cada piso es una sala rectangular con una idea principal; la dificultad sube hasta el jefe del 20.
Escribe public/levels/pisoN.json SOLO si no existe (no pisa pisos ya hechos; usa --forzar para sobrescribir).
Uso: python3 tools/generar_borradores.py [--forzar]"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = 8                                       # vóxeles por baldosa
FRONT_CAM = -1.5708                         # cámara en la pared del fondo, mirando hacia la cámara del juego

def room(tw, td):
    return ['1' * tw for _ in range(td)]

def level(tw, td, exit_x, **kw):
    D = td * T
    L = {'player': [16.5, 13.5], 'props': [], 'agents': [], 'agentTypes': [], 'hides': [], 'floor': room(tw, td),
         'exit': {'x': exit_x, 'y': D - 2}, 'cams': [], 'lasers': [], 'bombs': []}
    L.update(kw)
    return L

def prop(t, x, y, r=0): return {'t': t, 'x': x, 'y': y, 'r': r}
def cam(x, td): return {'x': x, 'y': td * T - 3.5, 'a': FRONT_CAM}
def hide(x, y, k='plant'): return {'x': x, 'y': y, 'k': k}

PISOS = {}

# 14 · Granja de servidores: pasillos entre muros, cámaras que se apagan con el rack, 1 abeja de guardia
PISOS[14] = level(20, 14, 132,
    props=[prop('muro', 40, 24), prop('muro', 40, 40), prop('muro', 40, 56), prop('muro', 40, 72),
           prop('muro', 80, 16), prop('muro', 80, 32), prop('muro', 80, 64), prop('muro', 80, 80),
           prop('muro', 120, 24), prop('muro', 120, 40), prop('muro', 120, 56),
           prop('rack', 56, 102), prop('cooler', 4, 100), prop('copier', 96, 98),
           prop('safe', 140, 30), prop('bee', 92, 44, 2)],
    agents=[[[30, 30], [30, 92], [62, 92]], [[100, 20], [100, 80], [140, 80], [140, 60]]],
    agentTypes=['normal', 'normal'],
    cams=[cam(30, 14), cam(100, 14), cam(150, 14)],
    hides=[hide(62, 30), hide(108, 92, 'trash')])

# 15 · Jardín de abejas: tres abejas entre plantas, un guardia rojo de ronda corta y un láser
PISOS[15] = level(18, 16, 30,
    props=[prop('plant', 40, 40), prop('plant', 72, 64), prop('plant', 104, 40), prop('plant', 56, 96), prop('plant', 120, 96),
           prop('bee', 30, 70), prop('bee', 84, 30, 2), prop('bee', 100, 84, 1),
           prop('safe', 120, 108), prop('cooler', 4, 118), prop('desk', 60, 20, 0)],
    agents=[[[110, 60], [134, 60], [134, 20], [110, 20]]],
    agentTypes=['red'],
    lasers=[{'x': 90, 'y': 64, 'dir': 'y'}],
    bombs=[{'x': 40, 'y': 20}],
    hides=[hide(24, 100), hide(130, 80, 'trash')])

# 16 · Torres gemelas: dos torres sensor, un dron vigía y un guardia; cámara en el fondo
PISOS[16] = level(20, 16, 132,
    props=[prop('tower', 44, 60), prop('tower', 104, 60), prop('desk', 70, 20, 0), prop('desk', 20, 96, 1),
           prop('copier', 140, 100), prop('cabinet', 4, 60), prop('safe', 140, 40)],
    agents=[[[30, 40], [80, 40], [80, 100], [44, 100]], [[124, 20], [124, 100]]],
    agentTypes=['vigia', 'normal'],
    cams=[cam(80, 16)],
    bombs=[{'x': 60, 'y': 110}],
    hides=[hide(90, 84), hide(150, 20, 'trash')])

# 17 · Pasillo láser: cuatro láseres intermitentes en fila, dos abejas y un guardia rojo al final
PISOS[17] = level(22, 14, 160,
    props=[prop('desk', 140, 10, 3), prop('copier', 4, 98), prop('cabinet', 64, 100), prop('cabinet', 112, 100),
           prop('bee', 60, 30), prop('bee', 110, 70, 2), prop('safe', 160, 60), prop('rack', 90, 100)],
    agents=[[[150, 40], [150, 90], [128, 90]]],
    agentTypes=['red'],
    lasers=[{'x': 50, 'y': 56, 'dir': 'y'}, {'x': 76, 'y': 56, 'dir': 'y'}, {'x': 102, 'y': 56, 'dir': 'y'}, {'x': 128, 'y': 56, 'dir': 'y'}],
    cams=[cam(40, 14), cam(120, 14)],
    bombs=[{'x': 30, 'y': 60}],
    hides=[hide(40, 90), hide(90, 20, 'trash')])

# 18 · Oficina abierta: grande, islas de escritorios, tres agentes, dos abejas, torre y rack
PISOS[18] = level(22, 20, 150,
    props=[prop('desk', 40, 40), prop('desk', 40, 100), prop('desk', 110, 40), prop('desk', 110, 100),
           prop('tower', 82, 70), prop('rack', 4, 140), prop('copier', 160, 140), prop('cooler', 150, 4),
           prop('bee', 20, 70), prop('bee', 140, 70, 2), prop('safe', 82, 136)],
    agents=[[[30, 30], [150, 30], [150, 90], [30, 90]], [[70, 130], [140, 130]], [[100, 20], [100, 120]]],
    agentTypes=['red', 'normal', 'vigia'],
    cams=[cam(40, 20), cam(120, 20)],
    bombs=[{'x': 20, 'y': 20}, {'x': 160, 'y': 110}],
    hides=[hide(70, 90), hide(140, 120), hide(20, 120, 'trash')])

# 19 · La prueba final: sala larga en zigzag con muros, láseres, torre, abejas, rojo y vigía
PISOS[19] = level(24, 14, 176,
    props=[prop('muro', 44, 0), prop('muro', 44, 12), prop('muro', 44, 24), prop('muro', 44, 36), prop('muro', 44, 48),
           prop('muro', 96, 56), prop('muro', 96, 68), prop('muro', 96, 80), prop('muro', 96, 92), prop('muro', 96, 100),
           prop('muro', 146, 0), prop('muro', 146, 12), prop('muro', 146, 24), prop('muro', 146, 36), prop('muro', 146, 48),
           prop('tower', 64, 80), prop('rack', 4, 100), prop('bee', 110, 20), prop('bee', 160, 70, 2), prop('safe', 166, 20)],
    agents=[[[70, 30], [120, 30], [120, 46]], [[160, 90], [184, 90], [184, 60]]],
    agentTypes=['red', 'vigia'],
    lasers=[{'x': 30, 'y': 76, 'dir': 'y'}, {'x': 124, 'y': 76, 'dir': 'y'}, {'x': 170, 'y': 60, 'dir': 'x'}],
    cams=[cam(70, 14), cam(130, 14), cam(186, 14)],
    bombs=[{'x': 24, 'y': 30}],
    hides=[hide(30, 100), hide(122, 100, 'trash')])

# 20 · Jefe final: el Main Frame en el centro, muros para cubrirse de los láseres, dos abejas de escolta.
#      El cristal lo suelta el jefe al derrotarlo; el ascensor está bloqueado hasta entonces.
PISOS[20] = level(22, 18, 150,
    props=[prop('MainFrame', 72, 56), prop('muro', 40, 30), prop('muro', 130, 30), prop('muro', 40, 110), prop('muro', 130, 110),
           prop('bee', 10, 120), prop('bee', 150, 20, 2), prop('cooler', 4, 4), prop('plant', 168, 136)],
    hides=[hide(24, 70), hide(152, 76, 'trash')])

force = '--forzar' in sys.argv
for n, L in PISOS.items():
    path = os.path.join(ROOT, 'public/levels', f'piso{n}.json')
    if os.path.exists(path) and not force: print(f'piso{n}: ya existe, no lo toco'); continue
    with open(path, 'w') as f: f.write(json.dumps(L, indent=1, ensure_ascii=False))
    print(f'piso{n}: listo')
