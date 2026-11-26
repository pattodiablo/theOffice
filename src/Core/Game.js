// Estado compartido de la partida (hace de GameManager): los scripts leen y escriben aquí.
export const G = {
  DATA: null,          // public/data/office.json: paleta y props
  level: null,         // el nivel abierto (public/levels/*.json)
  levelName: '',       // su nombre (piso1, piso2…)
  mode: 'edit',        // 'edit' editor · 'play' jugando · 'exit' saliendo en el ascensor · 'over' pantalla de inicio o final
  t: 0,                // reloj global (animaciones)
  time: 0,             // tiempo del intento actual
  frozen: 0, cool: 0, usedGlitch: false,  // glitch: tiempo congelado restante · recarga
  alerts: 0, maxSeen: 0,
  intro: -1,           // segundos de la intro; -1 = terminada
  asm: -1,             // segundos del ensamblado del nivel (antes de la intro); -1 = armado
  asmMax: 0, asmEnd: 0, // último retraso de una pieza del mundo · fin del ensamblado
  hiddenKind: null,    // camuflaje actual: 'plant', 'trash' o null
  hideT: 0,            // segundos que le quedan al disfraz
  popT: 1,             // tiempo desde el último cambio de camuflaje (para el rebote)
  doorOpen: 0, doorWant: false,                       // puerta EXIT: 0 cerrada · 1 abierta
  elev: 'idle', elevT: 0,                             // ascensor: 'idle' sin llamar · 'calling' bajando (elevT = segundos que faltan) · 'arrived' llegó
  exitOk: false, EXIT: null,        // puerta de salida (ShellBuilder la describe con doorGeom)
  seat: { x: 0, y: 0, ox: 0, oy: 0 },                 // asiento del escritorio inicial
  chairSlide: 0,
  snapCam: true,
  shake: 0,            // fuerza del sacudón de cámara (se apaga sola)
};
