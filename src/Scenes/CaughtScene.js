import { EDITOR, $ } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { DREAM_MESSAGES, REVIVE } from '../Settings.js';
import { turnTo } from '../Core/MathUtils.js';
import { caughtSound } from '../Core/Audio.js';
import { shake, kick, hitstop, slowmo, flash, popText, haptic } from '../FX/Juice.js';
import { setAlarm, setGlitchFX } from '../FX/ScreenFX.js';
import { player } from '../Prefabs/Player.js';
import { pokiBreak, pokiBusy, pokiReward, pokiCanReward, pokiMeasure } from '../Core/Poki.js';
import { levelNumber } from '../Data/LevelIO.js';
import { agents, stunAgent } from '../Prefabs/Agent.js';
import { beeTargets, stunBee } from '../Prefabs/Bee.js';
import { giveBomb } from '../Prefabs/Bomb.js';
import { clearBullets } from '../Prefabs/Bullet.js';
import { puff } from '../FX/Particles.js';
import { setMode } from './GameScene.js';

// Te atraparon: sacudón de cámara, destello rojo, fundido a negro y un mensaje "existencial"
// que se escribe letra por letra; después aparece Retry.
// Revivir (una vez por intento, si hay SDK de Poki): ver un video → vuelves donde caíste, los guardias cercanos quedan
// noqueados, tienes REVIVE.grace segundos de invulnerabilidad (parpadeas) y una bomba de regalo en las manos.
//
// Línea de tiempo (segundos desde que te atrapan):
//   0.0  sacudón + destello rojo + sonido
//   0.5  todo se funde a negro (hasta 1.4)
//   1.5  se escribe el mensaje
//   +0.4 después del mensaje aparece Retry
const T_FADE = .5, T_BLACK = 1.4, T_TEXT = 1.5, CHAR_TIME = .045;

let ct = -1, cfade = 0, msg = '', shownChars = -1, retryShown = false, catcher = null, lastMsg = -1;
let el, textEl;

export function initCaught() {
  el = document.createElement('div'); el.id = 'dream';
  el.innerHTML = `<p class="dtext"></p><div class="dbtns"><button id="reviveBtn" class="playbtn revive">▶ Revive + 💣</button><button id="retryBtn" class="playbtn">Retry ↻</button>${EDITOR ? '<button id="dreamEdit">Volver al editor</button>' : ''}</div>`;
  document.body.append(el); textEl = el.querySelector('.dtext');
  const retry = async () => { if (pokiBusy()) return; await pokiBreak(); setMode('play'); };   // Poki: anuncio antes de volver a jugar
  $('#retryBtn').addEventListener('click', retry);
  $('#reviveBtn').addEventListener('click', async () => {
    if (pokiBusy() || G.mode !== 'caught' || G.revived) return;
    const btn = $('#reviveBtn'); btn.disabled = true; pokiMeasure('rewarded', 'revive', 'interact');
    const ok = await pokiReward();
    btn.disabled = false;
    if (ok && G.mode === 'caught') { revive(); pokiMeasure('rewarded', 'revive', 'rewarded'); } else btn.hidden = true;     // sin video: queda solo Retry
  });
  $('#dreamEdit')?.addEventListener('click', () => setMode('edit'));
  addEventListener('keydown', e => { if (G.mode === 'caught' && retryShown && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); (document.activeElement?.id === 'reviveBtn' ? $('#reviveBtn') : $('#retryBtn')).click(); } });
}

// volver a jugar en el mismo lugar, con ventaja
function revive() {
  resetCaught(); G.mode = 'play'; G.revived = true; G.grace = REVIVE.grace;
  G.frozen = 0; G.hiddenKind = null; clearBullets();
  for (const a of agents) if (a.path.length && Math.hypot(a.x - player.x, a.y - player.y) < REVIVE.stunR) stunAgent(a, REVIVE.stunTime, player.x, player.y);
  for (const e of beeTargets()) if (Math.hypot(e.x - player.x, e.y - player.y) < REVIVE.stunR) stunBee(e, REVIVE.stunTime);
  giveBomb(player);
  puff(player.x, player.y); kick(.1); flash('59,224,124', .35); haptic([30, 30, 60]);
  popText(player.x, player.y, 'REVIVED!', 'cyan');
}

export function startCaught(agent) {
  G.mode = 'caught'; ct = 0; catcher = agent; retryShown = false; shownChars = -1;
  let i; do { i = Math.random() * DREAM_MESSAGES.length | 0; } while (DREAM_MESSAGES.length > 1 && i === lastMsg); // no repetir el anterior
  lastMsg = i; msg = DREAM_MESSAGES[i];
  const rb = $('#reviveBtn'); rb.hidden = G.revived || !pokiCanReward() || EDITOR; rb.disabled = false;
  if (!EDITOR) pokiMeasure('caught', levelNumber(G.levelName), agent ? 'agent' : 'hazard');   // Poki: dónde y por qué pierden
  G.shake = 3.5;                                   // Engine sacude la cámara y lo va apagando
  kick(.14); flash('255,40,40', .45); haptic([90, 50, 160]);   // te atraparon
  document.body.classList.add('caught'); setGlitchFX(false); caughtSound();
}

// lo llama setMode
export function resetCaught() {
  if (ct >= 0) cfade = 1;                          // venimos de la pantalla negra: aclarar al volver
  ct = -1; G.shake = 0; document.body.classList.remove('caught');
  el?.classList.remove('show-text', 'show-btn'); if (textEl) textEl.textContent = '';
}

export function updateCaught(dt) {
  const fadeEl = $('#fade');
  if (G.mode !== 'caught') { if (cfade > 0) { cfade = Math.max(0, cfade - dt * 2); fadeEl.style.opacity = cfade; } return; }
  ct += dt;
  if (catcher) turnTo(catcher, Math.atan2(player.y - catcher.y, player.x - catcher.x), dt * 10); // el agente te mira
  setAlarm(ct < T_FADE ? 1 - ct / T_FADE * .3 : 0, '255,42,42');                               // destello rojo
  cfade = Math.min(1, Math.max(0, (ct - T_FADE) / (T_BLACK - T_FADE))); fadeEl.style.opacity = cfade;
  if (ct >= T_TEXT) {                              // máquina de escribir
    el.classList.add('show-text');
    const n = Math.min(msg.length, Math.floor((ct - T_TEXT) / CHAR_TIME));
    if (n !== shownChars) { shownChars = n; textEl.textContent = msg.slice(0, n); }
    if (n >= msg.length && ct >= T_TEXT + msg.length * CHAR_TIME + .4 && !retryShown) { retryShown = true; el.classList.add('show-btn'); if (!$('#reviveBtn').hidden) pokiMeasure('rewarded', 'revive', 'visible'); ($('#reviveBtn').hidden ? $('#retryBtn') : $('#reviveBtn')).focus(); }
  }
}
