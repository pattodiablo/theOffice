# Escape de oficina

Prototipo de sigilo voxel con Three.js y su editor de niveles.

## Requisitos

- Node.js 18 o superior
- Python 3, solo si vas a convertir modelos de MagicaVoxel

## Correrlo

```bash
npm install
npm run dev
```

- Juego: http://localhost:5173/
- Editor: http://localhost:5173/editor.html
- Otro nivel: agrega `?nivel=piso2` a cualquiera de las dos URLs (lee `public/levels/piso2.json`).

## Editor

- La barra de abajo tiene pestañas: **Nivel** (forma del piso, salida, inicio), **Props** (selector y rotar), **Agentes** (rutas), **Escondites** y **Borrar**. **R** rota y **Ctrl+Z** deshace.
- **Agentes**: creas agentes y marcas sus puntos de patrulla. Un agente con un solo punto se queda girando.
- **Guardar** escribe el nivel en `public/levels/<nivel>.json`. Solo funciona con `npm run dev`; si no, descarga el archivo.
- Mientras no guardes, el borrador vive en el navegador. "Recargar del archivo" (en JSON) lo descarta.
- Para crear un nivel nuevo: copia `piso1.json` como `piso2.json` y abre `editor.html?nivel=piso2`.

## Forma del piso

Cada nivel guarda su piso como una grilla de baldosas de 8 × 8 vóxeles (`floor` en el JSON) y la posición de la salida (`exit`).
En el editor (pestaña **Nivel**): **Piso +** pone piso con paredes y barandas en el borde, **Piso abierto** pone piso sin paredes ni barandas,
**Piso −** lo quita y **Salida** se coloca junto a una pared del fondo. En el JSON cada baldosa es `0` (sin piso), `1` (con paredes) o `2` (abierta).
Las paredes altas se generan en los bordes del fondo y las barandas en los del frente.

**Tamaño del nivel:** cada nivel puede medir entre 4 × 4 y 32 × 32 baldosas (el de antes era 16 × 13).
Para agrandarlo, pinta con **Piso +** o **Piso abierto** en la franja de la línea punteada que rodea el nivel: se agrega
una fila o columna de baldosas por ese lado. Al quitar piso con **Piso −**, las orillas que quedan vacías se recortan solas.
El tamaño actual se ve arriba, en la barra de estado.

## Animaciones

Abre `http://localhost:5173/animator.html` (o el botón **Animaciones** del editor). Es como la ventana Animation de Unity:
elige el clip y el personaje, mueve la línea de tiempo y ajusta los sliders de cada canal (cuerpo, cabeza, brazos, piernas).
Mover un slider crea o cambia un keyframe en ese instante; ◆ agrega key, ✕ la borra. Espacio = Play/Pausa; arrastra la vista para orbitar.
**Guardar** escribe `public/animations/<clip>.json` (con `npm run dev`; si no, se descarga). **De fábrica** vuelve a la versión original.
Clips: `idle`, `walk`, `crouch_idle`, `crouch_walk`, `wake_up` (intro), `celebrate` (ascensor), `alert_hop` (salto de alerta), `aim` (agente rojo apuntando).

## Personajes (MagicaVoxel)

Los personajes se cargan de `public/characters/`: `player.vox` (oficinista), `agent.vox` y `agent_red.vox`.
Ábrelos en MagicaVoxel, edítalos, guarda y recarga el juego (no hay que correr ningún script).

- Cada archivo tiene un modelo por parte con su nombre (panel de escena / *Outline*): `body`, `head`, `armL`, `armR`, `legL`, `legR`.
  Las seis tienen que existir; si falta alguna, el juego usa el modelo de cajas de antes.
- Una pieza extra se pega a un hueso si su nombre empieza con el hueso y `_` (ej. `armR_gun`, `head_sombrero`). Sin prefijo va al cuerpo.
- El personaje mira hacia **+X**, con los pies en z = 0 y centrado en x = 0, y = 0. Un vóxel = media unidad del juego (mide ~32 vóxeles).
- Articulaciones automáticas: brazos y piernas giran en el centro de su capa de **arriba**; la cabeza en el centro de su capa de **abajo** (el cuello).
- Un color con material **Emit** brilla con su propio color (así se ve rojo el agente rojo con la luz verde).
- `python3 tools/generar_personajes.py` vuelve a generar los tres archivos originales (ojo: sobrescribe tus cambios).

## Arte (MagicaVoxel)

```
assets/vox/oficina_base.vox    referencia de la oficina original; el juego ya no la usa (piso y paredes se generan por nivel)
assets/vox/props/*.vox         un archivo por prop; el nombre del archivo es su id en los niveles
assets/vox/oficina_concept.vox la escena completa del concept, solo como referencia
```

Con `npm run dev` corriendo, solo guarda el .vox en MagicaVoxel: Vite regenera `public/data/office.json`
y recarga la página solo (en la terminal sale `[vox] office.json actualizado`). Si el .vox tiene un error, también lo dice ahí.
Sin el servidor de desarrollo puedes hacerlo a mano:

```bash
npm run datos        # = node tools/exportar_datos.mjs → public/data/office.json
```

Un prop nuevo aparece en la barra del editor. Para que tenga un nombre bonito, agrégalo a `LABELS` en `tools/exportar_datos.mjs`.

- Los props se apoyan en el piso desde la capa z = 0 del modelo.
- Entre todos los archivos puede haber hasta 255 colores distintos.
- Si cambias el tamaño de un prop que ya está en un nivel, revisa ese nivel en el editor.

`tools/generar_vox_originales.py` regenera los modelos de partida desde código y **sobrescribe** `assets/vox/`.

## Build para publicar

### Poki

```bash
npm run poki
```

Genera `dist/` y `escape-oficina-poki.zip` (sin los niveles `prueba_*` ni `player_anterior.vox`). Ese zip se sube en
Poki for Developers / Poki Inspector (https://inspector.poki.dev/). La integración del SDK está en `src/Core/Poki.js`:
`init` al arrancar, `gameLoadingFinished` al terminar de cargar, `gameplayStart` con el primer movimiento, `gameplayStop`
cuando te atrapan, sales por el ascensor o abres el menú, y `commercialBreak` antes de Retry, del siguiente piso o de elegir piso.
Las fuentes van incluidas (paquetes @fontsource) porque Poki bloquea las peticiones externas.

**Métricas (PokiSDK.measure)** — puntos de control para ver el progreso de los jugadores en el panel de Poki.
En `npm run dev` cada evento también sale en la consola como `[poki measure]`.

| Categoría | Qué | Acción | Cuándo |
|---|---|---|---|
| `tutorial` | `dream-intro` | `start` / `complete` / `skip` | intro "soñando" de la primera partida |
| `level` | número de piso | `start` | empieza un intento (también al reintentar) |
| `level` | número de piso | `complete` | sale por el ascensor |
| `level` | número de piso | `fail` | lo atraparon y reintenta, o cambia de piso sin terminar |
| `caught` | número de piso | `agent` / `hazard` | lo atrapó un agente, o un láser, torre, jefe o abeja |
| `stealth` | número de piso | `no-alerts` | terminó el piso sin que nadie lo viera |
| `crystal` | número de piso | `collected` | recogió el cristal del piso |
| `boss` | número de piso | `defeated` | derrotó al Main Frame |
| `rewarded` | `revive` | `visible` / `interact` / `rewarded` | botón de revivir: se ve · lo toca · vio el video y revivió |
| `button` | `floors` | `interact` | abrió el menú de pisos |
| `shop` | id del sombrero | `purchased` | compró un sombrero |
| `portal` | `online` | `reached` | echó todos los cristales (una vez por partida) |
| `game` | `ending` | `complete` | entró al portal: final del juego |



```bash
npm run build
```

Genera `dist/` con rutas relativas, sin el editor. Para itch.io, comprime el contenido de `dist/` en un zip y súbelo como juego HTML.

## Estructura (organizada como un proyecto de Unity)

| Unity | Aquí | Qué hay |
|---|---|---|
| Scenes | `public/levels/*.json` + `src/Scenes/` | los niveles (datos) y los scripts que los arman y juegan |
| Prefabs | `src/Prefabs/` | cada objeto del juego con su modelo y su comportamiento |
| Scripts del motor | `src/Core/` | render, cámara, bucle, entrada, sonido, utilidades |
| Animations | `src/Animations/` | clips de animación (keyframes en `public/animations/*.json`) y la intro |
| Materials / Textures | `src/Materials/` | paleta de colores de los vóxeles (hace de textura) y materiales |
| Models | `assets/vox/` | modelos de MagicaVoxel |
| VFX | `src/FX/` | lluvia de código, partículas, efectos de pantalla, globo de cómic |
| UI | `src/UI/` + `src/Styles/` | HUD y pantallas |
| Inspector | `src/Settings.js` | todos los valores para ajustar (velocidades, radios, colores, cámara) |

```
src/
  main.js                   entrada: carga datos, crea los objetos y arranca el bucle (frame)
  Settings.js               ajustes del juego
  Core/
    Constants.js            medidas del mundo, modo juego/editor, nivel a cargar
    Game.js                 estado compartido de la partida (G, hace de GameManager)
    Engine.js               renderer, escena, cámara isométrica, luces, bucle
    Input.js                teclado y joystick táctil
    Audio.js                sonidos sintetizados (teléfono, alerta, puerta)
    VoxelMesh.js            convierte vóxeles en mallas
    VoxLoader.js            lee .vox de MagicaVoxel con varios modelos (personajes)
    MathUtils.js            suavizados y ángulos
  Materials/
    Palette.js              paleta de colores (+ ambientación verde)
    Materials.js            materiales compartidos
  Data/
    PropLibrary.js          props cargados de office.json, rotaciones
    LevelIO.js              cargar / guardar niveles y borrador
  World/
    ShellBuilder.js         piso y paredes según la forma del nivel, hueco y letrero del EXIT
    Grid.js                 mundo en vóxeles, colisiones y visión (hAt, free, rayDist)
    Navigation.js           caminos de los agentes (BFS) y validación del nivel
  Prefabs/
    Character.js            personajes: carga public/characters/*.vox (o el modelo de cajas si falta)
    Player.js               jugador: movimiento y glitch
    Agent.js                agentes normal y rojo: cono, radio de acción, semáforo e IA (patrulla, alerta, persecución, búsqueda)
    Bullet.js               balas de los agentes rojos
    StartDesk.js            escritorio inicial, silla y teléfono
    ExitDoor.js             puerta corrediza del EXIT
    HideSpot.js             escondites y disfraces
    SecurityCam.js          cámaras de seguridad en las paredes: barren y llaman a los agentes
    ServerRack.js           rack de servidores (prop "rack"): quedarse junto a él apaga las cámaras
    LaserGate.js            láseres intermitentes de pared a pared: tocarlos prendidos mata
    SensorTower.js          torre sensor (prop "tower", partes base/torre): se levanta y dispara láseres en cruz
    Crystal.js              cristal (fragmento de realidad) de cada piso
    Safe.js                 caja fuerte (prop "safe", partes base/puerta): quedarse pegado la abre y suelta el cristal
    MainFrame.js            jefe (prop "MainFrame", partes cuerpo/patas): la cruz de patas gira y dispara láseres
    RealityPortal.js        portal de realidad (prop "realityportal"): se echan los cristales al contenedor y con todos se enciende (final)
    Bee.js                  abeja robot (prop "bee", partes abeja/alaL/alaR): te ve, avisa con una línea roja y te embiste
    Portal.js               portal del final: se abre con todos los cristales
  Animations/
    Clips.js                carga, interpola y mezcla los clips JSON
    CharacterPoses.js       elige qué clip toca (caminar o quieto)
    IntroAnimation.js       eventos de la intro (timbre, silla)
  FX/
    CodeRain.js  Particles.js  ScreenFX.js  Bubble.js
    Juice.js                jugosidad: sacudones, golpes de zoom, cámara lenta, destellos y textos flotantes
    SeeThrough.js           transparenta lo que tapa al jugador frente a la cámara
    Assemble.js             el nivel se arma pieza por pieza antes de la intro (como un sueño)
  UI/
    HUD.js                  tiempo, barra de semáforo, pantallas de inicio y final
  Scenes/
    Level.js                arma el nivel abierto en el mundo (rebuild)
    GameScene.js            reglas del juego: modos, un intento, ganar y perder
    EditorScene.js          herramientas del editor
    CaughtScene.js          te atraparon: sacudón, fundido, mensaje y Retry
    ElevatorScene.js        salida: fundido, ascensor que sube, fuegos, GREAT! y Play (carga piso2, piso3… si existen)
  Styles/
    main.css
public/data/office.json     vóxeles exportados (lo genera tools/exportar_datos.mjs)
public/levels/*.json        niveles: forma del piso, salida, props, jugador, agentes y escondites
vite.config.js              incluye el endpoint de guardado del editor
```

Cada frame (`main.js › frame`): primero la lógica (intro o `GameScene.updateGame`), después las animaciones
de cada prefab, los efectos, la cámara y el render.
