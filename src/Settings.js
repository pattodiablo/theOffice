// ======================================================================
// Ajustes del juego: hace de "Inspector". Cambia los valores y recarga.
// ======================================================================

// ---- Jugador ----
export const ANIM_SPEED = 1.15;                          // velocidad de las animaciones de caminar (todos)
export const PLAYER_SPEED = 29;                            // vóxeles por segundo
export const GLITCH_TIME = 2.5, GLITCH_COOLDOWN = 8;       // segundos que congela a los agentes · recarga

// ---- Cámara ----
export const CAM_PLAY_HALF = 42;                           // mitad del alto visible al jugar (más chico = más cerca)
export const CAM_WALK_ZOOM = 0.86, CAM_ZOOM_SPEED = 2.5;   // al caminar se aleja un poco (1 = sin efecto)
// Ver a través: si algo tapa al jugador, se transparenta un círculo alrededor de él
export const SEE_THROUGH = true, SEE_THROUGH_R = 13;       // activado · radio del círculo (vóxeles)
export const SEE_THROUGH_ALPHA = .25;                      // cuánto se sigue viendo lo que tapa (0 = invisible, 1 = sólido)

// ---- Ambientación verde ----
export const GREEN_TINT = .22, CODE_RAIN = false;          // tinte verde sobre la imagen · lluvia de código de fondo
// Colores de la paleta que se vuelven verdes al cargar (los .vox no cambian): pantallas, lámparas y vidrios.
export const GREEN_LOOK = { '60,80,110': [30, 170, 80], '245,250,255': [205, 255, 220], '150,155,160': [120, 170, 135], '170,205,235': [110, 195, 145], '215,235,250': [185, 255, 210] };

// ---- Agentes ----
export const PATROL_SPEED = 10.5;
export const VISION_RANGE = 34, VISION_HALF_ANGLE = .58, VISION_RAYS = 26; // cono de visión
export const ACTION_R = 9;                                  // radio de acción: te detectan aunque estés fuera del cono
export const CHASE_SPEED = 19.5, SEARCH_SPEED = 12.5;           // persecución · búsqueda
export const ALERT_FREEZE = .7;                             // segundos que se queda sorprendido antes de perseguirte
export const LOSE_TIME = 2.5, SEARCH_TIME = 3.5;            // sin verte tanto tiempo te pierde · cuánto te busca
export const CATCH_DIST = 3.5;                              // distancia a la que te atrapa
export const SEMA = { green: 0x22ff77, yellow: 0xffcc00, red: 0xff2a2a, frozen: 0x6ad1ff }; // semáforo de los agentes

// Tipos de agente. "normal" usa los valores de arriba; "red" es más rápido y agresivo, y dispara.
//   patrol/chase/search: velocidades · range/half: cono (alcance y medio ángulo) · actionR: radio de acción
//   detect: qué tan rápido se llena su barra · alertFreeze: segundos sorprendido · loseTime/searchTime: cuánto tarda en perderte / te busca
//   shoots: dispara · shootRange: alcance del disparo · aimTime: segundos apuntando con el láser · shootCooldown: entre disparos
export const AGENT_TYPES = {
  normal: { patrol: PATROL_SPEED, chase: CHASE_SPEED, search: SEARCH_SPEED, range: VISION_RANGE, half: VISION_HALF_ANGLE, actionR: ACTION_R,
    detect: 1, alertFreeze: ALERT_FREEZE, loseTime: LOSE_TIME, searchTime: SEARCH_TIME, shoots: false,
    hunchMin: 9, hunchMax: 16, hunchNoise: 18, hunchReach: 60, predict: 0, helpRadius: 35 },
  red: { patrol: 14, chase: 23, search: 17, range: 40, half: .7, actionR: 11,
    detect: 1.6, alertFreeze: .35, loseTime: 4, searchTime: 5.5, shoots: true, shootRange: 34, aimTime: .5, shootCooldown: 1.4,
    hunchMin: 5, hunchMax: 9, hunchNoise: 10, hunchReach: 80, predict: .9, helpRadius: 60 },
  vigia: { patrol: 11.5, chase: 18.5, search: 14, range: 38, half: .55, actionR: 8,
    detect: 1.3, alertFreeze: .4, loseTime: 3.5, searchTime: 5, shoots: true, shootRange: 36, aimTime: .3, shootCooldown: .8,
    burst: 3, burstGap: .12, bulletSpeed: 100,
    hunchMin: 7, hunchMax: 12, hunchNoise: 14, hunchReach: 70, predict: .5, helpRadius: 50,
    drone: true, hover: 10, scale: 1.3, seeOver: 18 },
};
//   burst: disparos seguidos por ráfaga (cada uno por sus dos cañones) · burstGap: segundos entre ellos · bulletSpeed: velocidad de sus balas
//   vigia (dron): hover = altura a la que flota · scale = tamaño del modelo vigia*.vox · seeOver = ve por encima de lo más bajo
//   que esto (los agentes: 12, así los cubículos los tapan; el vigía flota y solo lo tapan paneles, muros y paredes)
//   hunchMin/hunchMax: cada cuántos segundos (al azar) deja su ruta para ir a revisar cerca de donde andas · hunchNoise: qué tan
//   impreciso es ese punto · hunchReach: no se aleja más que esto de su posición · predict: segundos que se adelanta a tu movimiento
//   al perseguirte o al perderte (0 = va a donde estás)
//   helpRadius: si otro agente te descubre a esta distancia o menos, viene a ayudarlo (el rojo desde más lejos y directo a perseguirte)
// Cámaras de seguridad (se ponen en las paredes desde el editor, pestaña Cámaras)
export const CAMERA = {
  range: 42, half: .3,        // alcance (vóxeles) y medio ángulo del cono
  sweep: .75, period: 6,      // cuánto gira a cada lado (radianes) · segundos que tarda una vuelta completa de barrido
  instant: true,              // true: dan la alarma apenas te ven · false: se llena un medidor primero (con la velocidad de detect)
  detect: 1.2,                // qué tan rápido se llena su medidor al verte, si instant es false (agentes = 1)
  recall: 3,                  // mientras te vea, vuelve a llamar a los agentes cada tantos segundos
  coolTime: 2.5,              // al perderte, segundos que se queda mirando ahí antes de volver a barrer
};
// Láseres intermitentes (Seguridad › Láser en el editor): si el jugador los cruza prendidos, muere
export const LASER = {
  on: 2, off: 2,              // segundos prendido · apagado (los láseres se alternan entre sí)
  warn: .5,                   // segundos que parpadea antes de prenderse
  hitR: 1.2,                  // qué tan cerca del haz hay que pasar para tocarlo
  blockH: 6,                  // el haz se corta en paredes y muebles más altos que esto
};
// Torre sensor (prop "tower"): si entras en su radio se levanta y dispara láseres en las cuatro direcciones
export const TOWER = {
  radius: 24,                 // radio de detección (círculo en el piso)
  riseTime: .35,              // segundos que tarda en levantarse (y en bajar)
  chargeTime: .5,             // aviso antes de disparar (tiembla, círculo amarillo)
  fireTime: 1,                // segundos disparando
  restTime: 1.2,              // descanso entre disparos (si sigues en el radio vuelve a cargar)
  hitR: 1.3,                  // qué tan cerca del haz hay que pasar para tocarlo
  baseLayers: 2,              // si tower.vox es un solo modelo: capas de abajo que son la base (lo de arriba se levanta)
};
// Cristales (fragmentos de realidad, uno por piso) y el portal del final
// "Jugosidad" (FX/Juice.js): sacudones, golpes de zoom, cámara lenta, destellos y textos flotantes
export const JUICE = {
  on: true,                   // false = sin ningún efecto
  shake: 1,                   // fuerza de los sacudones (0 = sin sacudón)
  zoom: 1,                    // fuerza de los golpes de zoom
  slowmo: true,               // cámara lenta en los "casi me dan"
  nearMiss: 4.5,              // a qué distancia una bala cuenta como "casi me dan" (vóxeles)
  dust: true,                 // polvito al caminar
};
// Main Frame (prop "MainFrame", el jefe): su cruz de patas gira y dispara un láser desde cada punta
export const MAINFRAME = {
  wake: 48,                   // radio en el que se despierta y empieza a disparar (vóxeles)
  spinIdle: .25,              // velocidad de giro dormido (radianes por segundo)
  spin: .6,                   // girando mientras carga o descansa
  spinFire: .9,               // girando mientras dispara (más rápido = más difícil)
  chargeTime: 1.2,            // segundos de aviso: las puntas parpadean y el haz se ve tenue
  fireTime: 4,                // segundos disparando
  restTime: 1.5,              // segundos de descanso entre ráfagas
  beamLen: 60,                // largo máximo de cada haz desde el centro (se corta antes en paredes y muebles altos)
  beamY: 1.6,                 // altura del haz sobre el piso
  hitR: 1.3,                  // qué tan cerca del haz hay que pasar para que te toque
  hubR: 4,                    // desde dónde queman las patas al disparar (radio del centro, que es seguro)
};
// Noquear por la espalda (automático): tocar a un guardia por detrás lo deja en el piso unos segundos.
// No funciona si ya te vio ("!") ni con el dron vigía (flota). Durante el glitch funciona aunque te mire.
export const TAKEDOWN = {
  on: true,
  reach: 5,                   // qué tan cerca hay que llegar (vóxeles)
  koTime: 10,                 // segundos noqueado; al despertar te busca ("?")
};
export const CRYSTAL = { pickR: 3.5 };
// Bomba aturdidora (level.bombs = [{ x, y }], editor › Seguridad › Bomba): cae del techo, la recoges quedándote en su círculo,
// la cargas sobre la cabeza y la lanzas sola al primer agente que entre en tu radio. Los agentes de la explosión quedan aturdidos.
export const BOMB = {
  pickR: 6,                   // radio del círculo para recogerla (vóxeles)
  pickTime: .6,               // segundos dentro del círculo para levantarla
  liftTime: .35,              // animación de levantarla sobre la cabeza
  carrySpeed: .85,            // velocidad del jugador mientras la carga (× PLAYER_SPEED)
  throwR: 30,                 // radio de lanzamiento: si un agente entra (y lo ves), se la lanzas
  throwTime: .55,             // segundos de vuelo
  throwArc: 14,               // altura del arco
  blastR: 13,                 // radio de la explosión
  stunTime: 6,                // segundos que quedan aturdidos los agentes
  dropDelay: 1,               // segundos desde que empieza el nivel hasta que caen
  warnTime: .9,               // aviso en el piso antes de caer
  dropTime: .55,              // segundos de caída
  respawn: 12,                // segundos para que caiga otra en el mismo lugar (0 = no vuelve)
};
// Caja fuerte (prop "safe"): si el nivel tiene una, el cristal está ADENTRO (se ignora el cristal suelto).
// Hay que quedarse pegado a ella (dentro del círculo) crackTime segundos; si te alejas se pierde el avance.
export const SAFE = {
  reach: 11,                  // radio del círculo alrededor de la caja (vóxeles, desde su centro)
  crackTime: 2.5,             // segundos pegado a la caja para abrirla
  openAngle: 1.9,             // cuánto gira la puerta al abrirse (radianes; 1.57 = 90°)
  popTime: .7,                // segundos que tarda el cristal en salir volando de la caja
  popDist: 7,                 // dónde cae el cristal: vóxeles delante de la puerta
};                     // qué tan cerca hay que pasar para recogerlo
export const PORTAL = { need: 20, enterR: 5, depositR: 12 };   // cristales para abrir el portal · radio para entrar · qué tan cerca del contenedor para echar los cristales
export const ENDING_MESSAGES = [
  'You found every piece of reality. Welcome to the real world.',
  'The code is gone. The sky is real. You are free.',
  'Twenty fragments. One door. A whole world waiting outside.',
];
// Rack de servidores (prop "rack"): quedarse junto a él apaga todas las cámaras
export const RACK = {
  reach: 9,                   // radio del círculo azul alrededor del rack (vóxeles)
  hackTime: 2,                // segundos que hay que quedarse dentro para apagarlas
  offTime: 0,                 // 0 = apagadas hasta el siguiente intento · más de 0 = se reinician solas después de esos segundos
};
export const BULLET_SPEED = 63, BULLET_RANGE = 50;          // vóxeles por segundo · distancia máxima

// ---- Escondites ----
export const HIDE_R = 4;                                    // radio de la zona de camuflaje
export const HIDE_TIME = 5;                                 // segundos que dura el disfraz
export const HIDE_COOLDOWN = 8;                             // segundos que tarda ese escondite en poder usarse otra vez
export const HIDE_KINDS = {
  plant: { prop: 'plant_s', n: 'planta', label: 'Escondite planta' },
  trash: { prop: 'trash', n: 'basurero', label: 'Escondite basurero' },
};

// ---- Salida ----
export const EXIT_R = 16;                                   // radio que abre la puerta (una vez que llegó el ascensor)
export const ELEVATOR_WAIT = 10;                            // segundos que tarda en bajar el ascensor después de llamarlo
export const CALL_R = 5;                                    // radio del círculo frente al botón que llama al ascensor

// ---- Intro ----
// Ensamblado del nivel antes de la intro (como un sueño). Se salta con tecla o toque.
export const ASSEMBLE = true;                                // activado
export const ASSEMBLE_SPREAD = .012;                         // segundos por vóxel de distancia al escritorio (más = onda más lenta)
export const ASSEMBLE_POP = .55;                             // lo que tarda cada pieza en crecer
export const ASSEMBLE_ZOOM = .72;                            // zoom de la cámara mientras se arma (menos = más lejos)
export const INTRO_TIME = 3.4;
export const ENTRANCE_INTRO = 3.5;                           // con entrada: segundos que dura salir del ascensor                              // duración del despertar (se salta con tecla o toque)

// ---- Estrellas ----
export const STAR_TIME = 40;                                // segundos para la estrella de tiempo

// ---- Sonido de pasos ----
export const STEP_VOLUME = 1;                               // volumen general de los pasos (0 = sin pasos)
export const STEP_TIME = .22;                              // segundos entre pasos del jugador
export const AGENT_STEP_RANGE = 45;                         // a esta distancia ya no se oyen los pasos de un agente

// ---- Mensajes al ser atrapado (sale uno al azar) ----
export const DREAM_MESSAGES = [
  'Was any of it real?',
  'You woke up. Or did you?',
  'The office is a dream that never ends.',
  'Every exit is just another door.',
  "They don't catch you. They wake you up.",
  'Nothing here is real. Not even the deadline.',
  'Monday again. Forever.',
  'You were never really at your desk.',
  'Reality is just another meeting.',
  'Wake up. Try again.',
];

// ---- Mensajes al escapar, en el ascensor (sale uno al azar) ----
export const WAKE_MESSAGES = [
  'There is a world beyond this office. You just found the door.',
  'This was never your whole life. The real world is up there.',
  'Every floor down, the code gets thinner.',
  'You are not your desk. You never were.',
  'Somewhere outside, the sky is real. Keep going.',
  'The deadline was a dream. The sunlight is not.',
  'You broke the loop. Now go see what is real.',
  'Out there, nobody is watching. Only living.',
  'Your life is bigger than this building.',
  'Wake up. There is so much more out there.',
];
