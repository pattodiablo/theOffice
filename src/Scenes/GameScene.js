import { $, EDITOR } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { STAR_TIME } from '../Settings.js';
import { resize } from '../Core/Engine.js';
import { player, movePlayer, doGlitch } from '../Prefabs/Player.js';
import { resetAgents, updateAgentsAI } from '../Prefabs/Agent.js';
import { resetCams, updateCamsAI } from '../Prefabs/SecurityCam.js';
import { resetRacks, updateRacks } from '../Prefabs/ServerRack.js';
import { resetLasers, updateLasers } from '../Prefabs/LaserGate.js';
import { resetTowers, updateTowers } from '../Prefabs/SensorTower.js';
import { resetCrystal, updateCrystal } from '../Prefabs/Crystal.js';
import { updatePortal } from '../Prefabs/Portal.js';
import { updateBullets, clearBullets } from '../Prefabs/Bullet.js';
import { updateCamouflage, resetHideSpots } from '../Prefabs/HideSpot.js';
import { checkExitProximity, crossedExit, updateElevatorCall } from '../Prefabs/ExitDoor.js';
import { resetIntro, finishIntro } from '../Animations/IntroAnimation.js';
import { skipAssembly } from '../FX/Assemble.js';
import { setAlarm, setGlitchFX } from '../FX/ScreenFX.js';
import { setTime, setMeter, showScreen, hideScreen } from '../UI/HUD.js';
import { onModeChange } from './EditorScene.js';
import { startExit, resetExit } from './ElevatorScene.js';
import { startCaught, resetCaught } from './CaughtScene.js';

// Reglas del juego: modos (editar / jugar / pantalla), un intento completo, ganar y perder.

export function setMode(m) {
  G.mode = m; resize(); G.snapCam = true; document.body.classList.toggle('play', m !== 'edit'); hideScreen(); resetExit(); resetCaught(); clearBullets();
  if (EDITOR) onModeChange(m);
  resetAgents(); resetCams(); resetRacks(); resetLasers(); resetTowers(); resetCrystal(); Object.assign(player, { x: G.seat.x, y: G.seat.y, ang: Math.PI / 2, vx: 0, vy: 0 });
  if (G.entOk && m === 'play') { const [x, y] = G.ENT.point(5.5, .5); Object.assign(player, { x, y, ang: G.ENT.ang }); } // con entrada: espera detrás de las puertas
  resetIntro(m === 'play');
  Object.assign(G, { time: 0, frozen: 0, cool: 0, maxSeen: 0, alerts: 0, doorOpen: 0, doorWant: false, elev: 'idle', elevT: 0, usedGlitch: false, hiddenKind: null, hideT: 0, popT: 1 }); resetHideSpots();
  setAlarm(0); setGlitchFX(false); setMeter(0);
}


export function showTitle() {
  setMode('play');
  G.mode = 'over';
  showScreen(`<h2>Escape the office</h2><p>Reach the EXIT without being seen. Step into the green circles to blend in.</p>`,
    { retry: () => setMode('play'), edit: () => setMode('edit'), label: 'Play' });
}

// un frame de juego (después de la intro)
export function updateGame(dt) {
  G.time += dt; G.frozen = Math.max(0, G.frozen - dt); G.cool = Math.max(0, G.cool - dt);
  movePlayer(dt);
  updateCamouflage(player, dt);
  updateRacks(dt, player);
  updateElevatorCall(dt, player);
  checkExitProximity(player);
  const ag = updateAgentsAI(dt, player), cm = updateCamsAI(dt, player), caughtBy = ag.caughtBy;
  const top = Math.max(ag.top, cm.top), alertOn = ag.alertOn || cm.alertOn, cautionOn = ag.cautionOn || cm.cautionOn;
  G.maxSeen = Math.max(G.maxSeen, top);

  // HUD: barra y borde de pantalla con el color del semáforo
  const rgb = alertOn ? '255,42,42' : (cautionOn || top > .05) ? '255,204,0' : '34,255,119';
  setMeter(alertOn || cautionOn ? 100 : Math.min(100, top * 100), rgb);
  setAlarm(alertOn ? .7 + .3 * Math.sin(G.time * 10) : cautionOn ? .35 : top * .8, rgb);   // en alerta el borde late
  setGlitchFX(G.frozen > 0);
  setTime(G.time);

  const shotBy = G.frozen > 0 ? null : updateBullets(dt, player);  // las balas también se congelan con el glitch
  const zapped = updateLasers(dt, player) | updateTowers(dt, player);  // láseres y torres disparando: tocarlos mata
  if (caughtBy || shotBy || zapped) startCaught(caughtBy || shotBy || null);          // sacudón, fundido y mensaje
  else if (crossedExit(player)) startExit();           // cruzó la puerta: escena del ascensor
  updateCrystal(dt, player); updatePortal(dt, player);  // fragmento de realidad · portal del final
}

export function initGameScene() {
  addEventListener('keydown', e => {
    if (e.target.tagName === 'TEXTAREA') return;
    if (G.mode === 'play' && G.asm >= 0) skipAssembly();                                    // salta el ensamblado
    else if (G.mode === 'play' && G.intro >= 0) { if (G.intro > .3) finishIntro(); }          // cualquier tecla salta la intro
    else if (G.mode === 'play') {
      if (e.code === 'Space') { e.preventDefault(); doGlitch(); }
      if (e.code === 'Escape' && EDITOR) setMode('edit');
    } else if (G.mode === 'over' && e.code === 'Enter') setMode('play');
  });
  $('#stage').addEventListener('pointerdown', () => { if (G.mode === 'play' && G.asm >= 0) skipAssembly(); else if (G.mode === 'play' && G.intro > .3) finishIntro(); }); // un toque también la salta
  $('#testBtn')?.addEventListener('click', () => setMode('play'));
  $('#backBtn')?.addEventListener('click', () => setMode('edit'));
}
