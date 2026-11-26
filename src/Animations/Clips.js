// Clips de animación (como los .anim de Unity): keyframes por canal, guardados en public/animations/<nombre>.json.
// Se editan en animator.html. Si falta un archivo, se usa la versión de fábrica de abajo.
//
// Formato: { name, duration (s), loop (true/false), tracks: { "canal": [[tiempo, valor], ...] } }
// Canales: rotaciones en radianes, alturas en vóxeles.
export const CHANNELS = [
  ['body.y', 'Cuerpo · altura', -4, 6], ['body.rz', 'Cuerpo · inclinar adelante/atrás', -1.6, 1.6], ['body.rx', 'Cuerpo · ladear', -.8, .8],
  ['body.sy', 'Cuerpo · aplastar', .4, 1.4], ['head.rz', 'Cabeza · mirar arriba/abajo', -.8, .8], ['head.ry', 'Cabeza · girar', -1.2, 1.2],
  ['armL.rz', 'Brazo izq. · adelante/atrás', -3.2, 3.2], ['armR.rz', 'Brazo der. · adelante/atrás', -3.2, 3.2],
  ['armL.rx', 'Brazo izq. · al costado', -.5, 2.6], ['armR.rx', 'Brazo der. · al costado', -.5, 2.6],
  ['legL.rz', 'Pierna izq. · adelante/atrás', -1.6, 1.9], ['legR.rz', 'Pierna der. · adelante/atrás', -1.6, 1.9],
];
const DEFAULT_VALUE = { 'body.sy': 1 };
export const defaultValue = c => DEFAULT_VALUE[c] ?? 0;

// Qué clip usa cada momento del juego (el nombre del archivo)
export const CLIP_INFO = {
  idle: 'Quieto (jugador y agentes)', walk: 'Caminar (jugador y agentes; los agentes corren al doble)',
  crouch_idle: 'Agachado quieto', crouch_walk: 'Agachado caminando', wake_up: 'Intro: dormido → despierta → se levanta',
  celebrate: 'Celebración (sin usar por ahora)', elevator_wait: 'Ascensor: atento a lo que viene', alert_hop: 'Saltito de alerta del agente', aim: 'Agente rojo apuntando (solo el brazo)', carry: 'Cargando la bomba sobre la cabeza (solo los brazos)', throw: 'Lanzando la bomba (solo los brazos)',
};

// versiones de fábrica (las mismas que había en código)
export const FACTORY = {"elevator_wait":{"duration":4,"loop":true,"tracks":{"body.rz":[[0,-0.08],[4,-0.08]],"body.y":[[0,0],[1,-0.15],[2,0],[3,-0.15],[4,0]],"head.ry":[[0,0],[0.5,0],[0.8,0.55],[1.6,0.55],[1.9,-0.5],[2.8,-0.5],[3.1,0],[4,0]],"head.rz":[[0,0.05],[3.1,0.05],[3.4,0.28],[3.85,0.28],[4,0.05]],"armL.rz":[[0,0.18],[4,0.18]],"armR.rz":[[0,0.18],[4,0.18]],"armL.rx":[[0,0.15],[4,0.15]],"armR.rx":[[0,0.15],[4,0.15]]},"name":"elevator_wait"},"wake_up":{"duration":3.4,"loop":false,"tracks":{"body.rz":[[0,-0.95],[0.35,-0.9847],[0.7,-0.9845],[1.05,-0.9497],[1.4,-0.9151],[1.8,-0.9191],[1.9,-0.51],[2.0,0.17],[2.05,0.3],[2.12,0.3],[2.2,0.3],[2.3,0.2531],[2.4,0.15],[2.5,0.0469],[2.6,-0.0],[2.7,-0.0],[2.8,-0.0],[2.95,-0.0],[3.1,-0.0],[3.2,-0.0],[3.4,0]],"body.y":[[0,-1],[0.35,-1],[0.7,-1],[1.05,-1],[1.4,-1],[1.8,-1],[1.9,0.1314],[2.0,0.6],[2.05,0.4782],[2.12,-0.0595],[2.2,-1.0],[2.3,-1.0],[2.4,-1.0],[2.5,-1.0],[2.6,-1.0],[2.7,-1.0],[2.8,-0.896],[2.95,-0.5],[3.1,-0.104],[3.2,0.0],[3.4,0]],"legL.rz":[[0,2.5208],[0.35,2.5555],[0.7,2.5553],[1.05,2.5205],[1.4,2.4859],[1.8,2.4899],[1.9,2.0808],[2.0,1.4008],[2.05,1.2708],[2.12,1.2708],[2.2,1.2708],[2.3,1.3177],[2.4,1.4208],[2.5,1.5239],[2.6,1.5708],[2.7,1.5708],[2.8,1.4074],[2.95,0.7854],[3.1,0.1634],[3.2,0.0],[3.4,0.0]],"legR.rz":[[0,2.5208],[0.35,2.5555],[0.7,2.5553],[1.05,2.5205],[1.4,2.4859],[1.8,2.4899],[1.9,2.0808],[2.0,1.4008],[2.05,1.2708],[2.12,1.2708],[2.2,1.2708],[2.3,1.3177],[2.4,1.4208],[2.5,1.5239],[2.6,1.5708],[2.7,1.5708],[2.8,1.4074],[2.95,0.7854],[3.1,0.1634],[3.2,0.0],[3.4,0.0]],"armL.rz":[[0,2.4],[0.35,2.4347],[0.7,2.4345],[1.05,2.3997],[1.4,2.3651],[1.8,2.3691],[1.9,2.4352],[2.0,2.4896],[2.05,2.5],[2.12,2.5],[2.2,2.5],[2.3,2.1094],[2.4,1.25],[2.5,0.3906],[2.6,0.0],[2.7,0.0],[2.8,0.0],[2.95,0.0],[3.1,0.0],[3.2,0.0],[3.4,0]],"armR.rz":[[0,2.4],[0.35,2.4347],[0.7,2.4345],[1.05,2.3997],[1.4,2.3651],[1.8,2.3691],[1.9,2.4352],[2.0,2.4896],[2.05,2.5],[2.12,2.5],[2.2,2.5],[2.3,2.1094],[2.4,1.25],[2.5,0.3906],[2.6,0.0],[2.7,0.0],[2.8,0.0],[2.95,0.0],[3.1,0.0],[3.2,0.0],[3.4,0]]},"name":"wake_up"},"walk":{"duration":0.5236,"loop":true,"tracks":{"legL.rz":[[0,0.0],[0.1309,0.7],[0.2618,0.0],[0.3927,-0.7],[0.5236,-0.0]],"legR.rz":[[0,-0.0],[0.1309,-0.7],[0.2618,-0.0],[0.3927,0.7],[0.5236,0.0]],"armL.rz":[[0,-0.0],[0.1309,-0.56],[0.2618,-0.0],[0.3927,0.56],[0.5236,0.0]],"armR.rz":[[0,0.0],[0.1309,0.56],[0.2618,0.0],[0.3927,-0.56],[0.5236,-0.0]]},"name":"walk"},"idle":{"duration":2,"loop":true,"tracks":{"body.y":[[0,0],[1,0.15],[2,0]],"armL.rz":[[0,0],[1,0.04],[2,0]],"armR.rz":[[0,0],[1,-0.04],[2,0]]},"name":"idle"},"crouch_idle":{"duration":2,"loop":true,"tracks":{"body.sy":[[0,0.62],[2,0.62]],"body.y":[[0,0],[1,0.1],[2,0]]},"name":"crouch_idle"},"crouch_walk":{"duration":0.5236,"loop":true,"tracks":{"legL.rz":[[0,0.0],[0.1309,0.7],[0.2618,0.0],[0.3927,-0.7],[0.5236,-0.0]],"legR.rz":[[0,-0.0],[0.1309,-0.7],[0.2618,-0.0],[0.3927,0.7],[0.5236,0.0]],"armL.rz":[[0,-0.0],[0.1309,-0.56],[0.2618,-0.0],[0.3927,0.56],[0.5236,0.0]],"armR.rz":[[0,0.0],[0.1309,0.56],[0.2618,0.0],[0.3927,-0.56],[0.5236,-0.0]],"body.sy":[[0,0.62],[0.5236,0.62]]},"name":"crouch_walk"},"celebrate":{"duration":2.0944,"loop":true,"tracks":{"armL.rz":[[0.0,2.6],[0.0873,2.8475],[0.1745,2.95],[0.2618,2.8475],[0.3491,2.6],[0.4363,2.3525],[0.5236,2.25],[0.6109,2.3525],[0.6981,2.6],[0.7854,2.8475],[0.8727,2.95],[0.9599,2.8475],[1.0472,2.6],[1.1345,2.3525],[1.2217,2.25],[1.309,2.3525],[1.3963,2.6],[1.4835,2.8475],[1.5708,2.95],[1.6581,2.8475],[1.7453,2.6],[1.8326,2.3525],[1.9199,2.25],[2.0071,2.3525],[2.0944,2.6]],"armR.rz":[[0.0,2.6],[0.0873,2.8475],[0.1745,2.95],[0.2618,2.8475],[0.3491,2.6],[0.4363,2.3525],[0.5236,2.25],[0.6109,2.3525],[0.6981,2.6],[0.7854,2.8475],[0.8727,2.95],[0.9599,2.8475],[1.0472,2.6],[1.1345,2.3525],[1.2217,2.25],[1.309,2.3525],[1.3963,2.6],[1.4835,2.8475],[1.5708,2.95],[1.6581,2.8475],[1.7453,2.6],[1.8326,2.3525],[1.9199,2.25],[2.0071,2.3525],[2.0944,2.6]],"body.y":[[0.0,0.0],[0.0873,0.4],[0.1745,0.6928],[0.2618,0.8],[0.3491,0.6928],[0.4363,0.4],[0.5236,0.0],[0.6109,0.0],[0.6981,0.0],[0.7854,0.0],[0.8727,0.0],[0.9599,0.0],[1.0472,0.0],[1.1345,0.4],[1.2217,0.6928],[1.309,0.8],[1.3963,0.6928],[1.4835,0.4],[1.5708,0.0],[1.6581,0.0],[1.7453,0.0],[1.8326,0.0],[1.9199,0.0],[2.0071,0.0],[2.0944,0.0]]},"name":"celebrate"},"alert_hop":{"duration":0.35,"loop":false,"tracks":{"body.y":[[0,0],[0.175,3],[0.35,0]]},"name":"alert_hop"},"aim":{"duration":1,"loop":true,"tracks":{"armR.rz":[[0,1.5708],[1,1.5708]]},"name":"aim"},"carry":{"duration":1,"loop":true,"tracks":{"armL.rz":[[0,2.85],[1,2.85]],"armR.rz":[[0,2.85],[1,2.85]],"armL.rx":[[0,0.12],[1,0.12]],"armR.rx":[[0,0.12],[1,0.12]]},"name":"carry"},"throw":{"duration":0.45,"loop":false,"tracks":{"armL.rz":[[0,2.85],[0.1,3.1],[0.22,1.1],[0.45,0]],"armR.rz":[[0,2.85],[0.1,3.1],[0.22,1.1],[0.45,0]],"body.rz":[[0,0],[0.1,-0.15],[0.22,0.25],[0.45,0]]},"name":"throw"}};

export const clips = JSON.parse(JSON.stringify(FACTORY));

// carga public/animations/*.json (los que existan reemplazan a los de fábrica)
export async function loadClips() {
  await Promise.all(Object.keys(CLIP_INFO).map(async n => {
    try { const r = await fetch(`animations/${n}.json`, { cache: 'no-store' }); if (!r.ok) return; const c = JSON.parse(await r.text()); if (c && c.tracks) clips[n] = c; } catch (e) {}
  }));
}

// con npm run dev: al guardar un clip en el editor de animaciones, el juego abierto (también en el teléfono) lo usa al instante
if (import.meta.hot) import.meta.hot.on('anim:saved', ({ name, clip }) => { if (clip && clip.tracks) clips[name] = clip; });

const smooth = k => k * k * (3 - 2 * k);
// valor de un canal en el tiempo t (interpola suave entre keyframes)
export function sampleTrack(keys, t) {
  if (!keys || !keys.length) return undefined;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return v0 + (v1 - v0) * smooth((t - t0) / Math.max(1e-6, t1 - t0)); }
  return keys[keys.length - 1][1];
}
export const clipTime = (clip, t) => clip.loop ? ((t % clip.duration) + clip.duration) % clip.duration : Math.min(Math.max(t, 0), clip.duration);
// pose de un clip en t: { canal: valor } (solo los canales que el clip anima)
export function sampleClip(clip, t) {
  const tt = clipTime(clip, t), out = {};
  for (const c in clip.tracks) { const v = sampleTrack(clip.tracks[c], tt); if (v !== undefined) out[c] = v; }
  return out;
}

// aplica valores a un personaje (makeCharacter). El cuerpo gira alrededor de la cadera (altura 5).
export function applyPose(ch, p) {
  const v = c => p[c] ?? defaultValue(c), rz = v('body.rz'), rx = v('body.rx');
  ch.body.rotation.set(rx, 0, rz); ch.body.scale.y = v('body.sy');
  ch.body.position.set(5 * Math.sin(rz), 5 * (1 - Math.cos(rz)) + 5 * (1 - Math.cos(rx)) + v('body.y'), -5 * Math.sin(rx));
  ch.head.rotation.set(0, v('head.ry'), v('head.rz'));
  ch.armL.rotation.set(v('armL.rx'), 0, v('armL.rz')); ch.armR.rotation.set(-v('armR.rx'), 0, v('armR.rz'));
  ch.legL.rotation.z = v('legL.rz'); ch.legR.rotation.z = v('legR.rz');
}

// reproduce un clip en un personaje. blend < 1 mezcla suave con la pose anterior (transiciones entre clips)
export function playClip(ch, name, t, blend = 1) {
  const clip = clips[name]; if (!clip) return;
  const target = sampleClip(clip, t), cur = ch.pose ||= {};
  for (const [c] of CHANNELS) { const goal = target[c] ?? defaultValue(c); cur[c] = blend >= 1 || cur[c] === undefined ? goal : cur[c] + (goal - cur[c]) * blend; }
  applyPose(ch, cur);
}

// suma solo los canales de un clip encima de la pose actual (p. ej. el brazo apuntando)
export function overlayClip(ch, name, t) {
  const clip = clips[name]; if (!clip) return;
  const vals = sampleClip(clip, t); ch.pose = { ...(ch.pose || {}), ...vals }; applyPose(ch, ch.pose);
}

export const clipDuration = name => clips[name]?.duration || 0;
