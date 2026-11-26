// Sonidos sintetizados con Web Audio (sin archivos).
let actx;
// los navegadores arrancan el audio en pausa hasta que el jugador toca o aprieta algo
const unlock = () => { try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) {} };
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, unlock, { passive: true });
function tone(fn) { try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); fn(actx, actx.currentTime); } catch (e) {} }

export const ring = () => tone((a, t0) => { // timbre de teléfono (intro)
  for (let i = 0; i < 2; i++) for (const f of [440, 480]) {
    const o = a.createOscillator(), g = a.createGain(), s0 = t0 + i * .5; o.frequency.value = f;
    g.gain.setValueAtTime(0, s0); g.gain.linearRampToValueAtTime(.06, s0 + .02); g.gain.setValueAtTime(.06, s0 + .35); g.gain.linearRampToValueAtTime(0, s0 + .4);
    o.connect(g).connect(a.destination); o.start(s0); o.stop(s0 + .45);
  }
});

// ensamblado del nivel: acordes suaves que suben, como un sueño
export const dreamSound = () => tone((a, t0) => {
  [392, 494, 587, 740, 880, 988, 1175].forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain(), s0 = t0 + i * .22; o.type = 'sine'; o.frequency.value = f;
    o.detune.setValueAtTime(-8, s0); o.detune.linearRampToValueAtTime(8, s0 + 1.2);
    g.gain.setValueAtTime(.0001, s0); g.gain.exponentialRampToValueAtTime(.035, s0 + .15); g.gain.exponentialRampToValueAtTime(.0001, s0 + 1.4);
    o.connect(g).connect(a.destination); o.start(s0); o.stop(s0 + 1.5);
  });
});

export const alertSound = () => tone((a, t0) => { // "¡bip!" cuando un agente te descubre
  const o = a.createOscillator(), g = a.createGain(); o.type = 'square';
  o.frequency.setValueAtTime(660, t0); o.frequency.exponentialRampToValueAtTime(1500, t0 + .09);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.07, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .4);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .45);
});

export const doorSound = () => tone((a, t0) => { // "whoosh" de la puerta
  const o = a.createOscillator(), g = a.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(240, t0); o.frequency.exponentialRampToValueAtTime(560, t0 + .3);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.05, t0 + .05); g.gain.exponentialRampToValueAtTime(.0001, t0 + .4);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .45);
});

export const winJingle = () => tone((a, t0) => { // fanfarria al subir al ascensor
  [523, 659, 784, 1046, 784, 1046].forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain(), s0 = t0 + i * .11 + (i > 3 ? .08 : 0); o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, s0); g.gain.exponentialRampToValueAtTime(.07, s0 + .02); g.gain.exponentialRampToValueAtTime(.0001, s0 + (i === 5 ? .6 : .2));
    o.connect(g).connect(a.destination); o.start(s0); o.stop(s0 + .65);
  });
});

export const fireworkPop = () => tone((a, t0) => { // "pum" de cada fuego artificial
  const len = .25, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + Math.random() * 900;
  src.buffer = buf; g.gain.value = .12; src.connect(f).connect(g).connect(a.destination); src.start(t0);
});

// paso: golpe corto de ruido filtrado (zapato sobre baldosa). vol 0..1 · pan -1 izquierda .. 1 derecha · pitch grave < 1 < agudo
let noise;
export const footstep = (vol, pan = 0, pitch = 1) => tone((a, t0) => {
  if (!noise) { noise = a.createBuffer(1, a.sampleRate * .12, a.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noise; src.playbackRate.value = pitch * (.9 + Math.random() * .2);
  f.type = 'bandpass'; f.frequency.value = (380 + Math.random() * 220) * pitch; f.Q.value = 1.4;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + .09);
  let out = src.connect(f).connect(g);
  if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); out = out.connect(p); }
  out.connect(a.destination); src.start(t0); src.stop(t0 + .12);
});

// "¡puf!" del camuflaje: soplido de aire que baja de tono + un "plop" corto. hide = true al esconderse, false al salir (más agudo)
export const puffSound = hide => tone((a, t0) => {
  const len = .32, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); src.buffer = buf;
  f.type = 'lowpass'; f.Q.value = 3;
  f.frequency.setValueAtTime(hide ? 2600 : 1400, t0); f.frequency.exponentialRampToValueAtTime(hide ? 250 : 2400, t0 + .25);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.22, t0 + .015); g.gain.exponentialRampToValueAtTime(.0001, t0 + len);
  src.connect(f).connect(g).connect(a.destination); src.start(t0);
  const o = a.createOscillator(), og = a.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(hide ? 520 : 300, t0); o.frequency.exponentialRampToValueAtTime(hide ? 160 : 700, t0 + .12);
  og.gain.setValueAtTime(.0001, t0); og.gain.exponentialRampToValueAtTime(.12, t0 + .01); og.gain.exponentialRampToValueAtTime(.0001, t0 + .15);
  o.connect(og).connect(a.destination); o.start(t0); o.stop(t0 + .18);
});

// atrapado: golpe grave + "glitch" que cae de tono
export const caughtSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + .35);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.35, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .5);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .55);
  const q = a.createOscillator(), qg = a.createGain(); q.type = 'square';
  q.frequency.setValueAtTime(880, t0 + .05); q.frequency.exponentialRampToValueAtTime(55, t0 + 1.1);
  qg.gain.setValueAtTime(.0001, t0 + .05); qg.gain.exponentialRampToValueAtTime(.05, t0 + .08); qg.gain.exponentialRampToValueAtTime(.0001, t0 + 1.2);
  q.connect(qg).connect(a.destination); q.start(t0 + .05); q.stop(t0 + 1.25);
});

// disparo del agente rojo: chasquido + "pew" que cae
export const shotSound = () => tone((a, t0) => {
  const len = .08, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'highpass'; f.frequency.value = 1800;
  src.buffer = buf; g.gain.value = .14; src.connect(f).connect(g).connect(a.destination); src.start(t0);
  const o = a.createOscillator(), og = a.createGain(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(1300, t0); o.frequency.exponentialRampToValueAtTime(180, t0 + .16);
  og.gain.setValueAtTime(.0001, t0); og.gain.exponentialRampToValueAtTime(.06, t0 + .01); og.gain.exponentialRampToValueAtTime(.0001, t0 + .18);
  o.connect(og).connect(a.destination); o.start(t0); o.stop(t0 + .2);
});

// botón del ascensor
export const callBeep = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = 1180;
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.05, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .12);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .14);
});
// "¡ding-dong!" cuando llega el ascensor
export const arrivalChime = () => tone((a, t0) => {
  [[880, 0], [660, .32]].forEach(([f, d]) => {
    const o = a.createOscillator(), g = a.createGain(), s0 = t0 + d; o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, s0); g.gain.exponentialRampToValueAtTime(.12, s0 + .01); g.gain.exponentialRampToValueAtTime(.0001, s0 + .9);
    o.connect(g).connect(a.destination); o.start(s0); o.stop(s0 + .95);
  });
});

// rack de servidores: pitidos que suben mientras hackeas, apagón y reinicio
export const hackBeep = k => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = 600 + k * 900;
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.035, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .08);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .1);
});
export const powerDownSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter(); o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 1800;
  o.frequency.setValueAtTime(520, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + .9);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.09, t0 + .03); g.gain.exponentialRampToValueAtTime(.0001, t0 + 1);
  o.connect(f).connect(g).connect(a.destination); o.start(t0); o.stop(t0 + 1.05);
});
export const bootSound = () => tone((a, t0) => {
  [300, 450, 900].forEach((fr, i) => { const o = a.createOscillator(), g = a.createGain(), s0 = t0 + i * .1; o.type = 'square'; o.frequency.value = fr;
    g.gain.setValueAtTime(.0001, s0); g.gain.exponentialRampToValueAtTime(.04, s0 + .01); g.gain.exponentialRampToValueAtTime(.0001, s0 + .09);
    o.connect(g).connect(a.destination); o.start(s0); o.stop(s0 + .1); });
});

// láser: chasquido eléctrico (vol 0..1)
export const zapSound = (v = 1) => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(1400, t0); o.frequency.exponentialRampToValueAtTime(180, t0 + .12);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.07 * v, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .15);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .16);
});

// torre sensor: zumbido de motor al levantarse
export const towerRiseSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'square';
  o.frequency.setValueAtTime(90, t0); o.frequency.exponentialRampToValueAtTime(320, t0 + .35);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.05, t0 + .03); g.gain.exponentialRampToValueAtTime(.0001, t0 + .4);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .42);
});

// cristal: campanitas que suben · portal: acorde grande
export const crystalSound = () => tone((a, t0) => {
  [1047, 1319, 1568, 2093].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(), s0 = t0 + i * .07; o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, s0); g.gain.exponentialRampToValueAtTime(.07, s0 + .01); g.gain.exponentialRampToValueAtTime(.0001, s0 + .5);
    o.connect(g).connect(a.destination); o.start(s0); o.stop(s0 + .55); });
});
export const portalSound = () => tone((a, t0) => {
  [262, 330, 392, 523, 659, 784].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(), s0 = t0 + i * .12; o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, s0); g.gain.exponentialRampToValueAtTime(.06, s0 + .2); g.gain.exponentialRampToValueAtTime(.0001, s0 + 3);
    o.connect(g).connect(a.destination); o.start(s0); o.stop(s0 + 3.1); });
});
// "tic" del selector de pisos (cada piso que pasa)
export const tickSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = 1500;
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.05, t0 + .004); g.gain.exponentialRampToValueAtTime(.0001, t0 + .05);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .06);
});
// caja fuerte: "clic" del dial mientras la abres (k = avance 0..1) y "clonk" + chirrido al abrirse
export const dialClick = k => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = 2200 + k * 900;
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.035, t0 + .002); g.gain.exponentialRampToValueAtTime(.0001, t0 + .03);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .04);
});
export const safeOpenSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(160, t0); o.frequency.exponentialRampToValueAtTime(60, t0 + .18);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.3, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .25);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .3);
  const c = a.createOscillator(), h = a.createGain(); c.type = 'sawtooth'; c.frequency.setValueAtTime(420, t0 + .12); c.frequency.linearRampToValueAtTime(300, t0 + .7);
  h.gain.setValueAtTime(.0001, t0 + .12); h.gain.exponentialRampToValueAtTime(.03, t0 + .2); h.gain.exponentialRampToValueAtTime(.0001, t0 + .75);
  c.connect(h).connect(a.destination); c.start(t0 + .12); c.stop(t0 + .8);
});

// bomba: silbido al caer · golpe al tocar el piso · "fum" al levantarla · explosión aturdidora (zumbido eléctrico + golpe grave)
export const bombFallSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(1800, t0); o.frequency.exponentialRampToValueAtTime(500, t0 + .5);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.04, t0 + .05); g.gain.exponentialRampToValueAtTime(.0001, t0 + .55);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .56);
});
export const bombLandSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + .2);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.35, t0 + .008); g.gain.exponentialRampToValueAtTime(.0001, t0 + .28);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .3);
});
export const bombLiftSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.setValueAtTime(300, t0); o.frequency.exponentialRampToValueAtTime(700, t0 + .15);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.05, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + .18);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .2);
});
export const bombBoomSound = () => tone((a, t0) => {
  const len = a.sampleRate * .6, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const n = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); n.buffer = buf; f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t0); f.frequency.exponentialRampToValueAtTime(200, t0 + .5);
  g.gain.setValueAtTime(.5, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + .6); n.connect(f).connect(g).connect(a.destination); n.start(t0);
  const o = a.createOscillator(), h = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(35, t0 + .45);
  h.gain.setValueAtTime(.0001, t0); h.gain.exponentialRampToValueAtTime(.5, t0 + .01); h.gain.exponentialRampToValueAtTime(.0001, t0 + .5); o.connect(h).connect(a.destination); o.start(t0); o.stop(t0 + .52);
  const z = a.createOscillator(), k = a.createGain(); z.type = 'sawtooth'; z.frequency.setValueAtTime(900, t0 + .02); z.frequency.exponentialRampToValueAtTime(120, t0 + .7);
  k.gain.setValueAtTime(.0001, t0 + .02); k.gain.exponentialRampToValueAtTime(.06, t0 + .05); k.gain.exponentialRampToValueAtTime(.0001, t0 + .75); z.connect(k).connect(a.destination); z.start(t0 + .02); z.stop(t0 + .76);
});

// noqueo: golpe seco y grave + "tump" del guardia al caer
export const koSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.setValueAtTime(220, t0); o.frequency.exponentialRampToValueAtTime(55, t0 + .12);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.25, t0 + .005); g.gain.exponentialRampToValueAtTime(.0001, t0 + .16);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .18);
  const f = a.createOscillator(), h = a.createGain(); f.type = 'sine'; f.frequency.setValueAtTime(90, t0 + .28); f.frequency.exponentialRampToValueAtTime(40, t0 + .45);
  h.gain.setValueAtTime(.0001, t0 + .28); h.gain.exponentialRampToValueAtTime(.3, t0 + .29); h.gain.exponentialRampToValueAtTime(.0001, t0 + .5);
  f.connect(h).connect(a.destination); f.start(t0 + .28); f.stop(t0 + .52);

});
// abeja: zumbido que sube (te vio y se prepara), "fiuuu" de la embestida y golpe contra la pared
export const beeBuzzSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(), l = a.createOscillator(), lg = a.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(170, t0); o.frequency.linearRampToValueAtTime(320, t0 + .65);
  l.frequency.value = 38; lg.gain.value = 25; l.connect(lg).connect(o.frequency);                 // vibrato de alas
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.07, t0 + .08); g.gain.setValueAtTime(.07, t0 + .55); g.gain.exponentialRampToValueAtTime(.0001, t0 + .7);
  o.connect(g).connect(a.destination); o.start(t0); l.start(t0); o.stop(t0 + .72); l.stop(t0 + .72);
});
export const beeDashSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle';
  o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(250, t0 + .35);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.12, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + .38);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .4);
});
export const beeBonkSound = () => tone((a, t0) => {
  const o = a.createOscillator(), g = a.createGain(); o.type = 'square';
  o.frequency.setValueAtTime(180, t0); o.frequency.exponentialRampToValueAtTime(70, t0 + .12);
  g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.18, t0 + .005); g.gain.exponentialRampToValueAtTime(.0001, t0 + .15);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + .17);
});
