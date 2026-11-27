import { initJuice, gameDt, updateJuice } from './FX/Juice.js';
import './Styles/main.css';
import { EDITOR, LEVEL_NAME } from './Core/Constants.js';
import { G } from './Core/Game.js';
import { initEngine, scene, cam, stage, updateCamera, render, startLoop } from './Core/Engine.js';
import { initInput } from './Core/Input.js';
import { initPalette } from './Materials/Palette.js';
import { initMaterials } from './Materials/Materials.js';
import { initProps } from './Data/PropLibrary.js';
import { loadLevel, loadDraft, prefetchLevel, nextLevelName } from './Data/LevelIO.js';
import { initWorldMesh } from './World/Grid.js';
import { initStartDesk, updateStartDesk } from './Prefabs/StartDesk.js';
import { initPlayer, animatePlayer, player } from './Prefabs/Player.js';
import { initAgents, animateAgents } from './Prefabs/Agent.js';
import { initCams, animateCams } from './Prefabs/SecurityCam.js';
import { initRacks, animateRacks } from './Prefabs/ServerRack.js';
import { initLasers, animateLasers } from './Prefabs/LaserGate.js';
import { initTowers, animateTowers } from './Prefabs/SensorTower.js';
import { initSafes, animateSafes } from './Prefabs/Safe.js';
import { initGuideArrows, animateGuideArrows } from './Prefabs/GuideArrows.js';
import { initBombs, animateBombs } from './Prefabs/Bomb.js';
import { initMainFrames, animateMainFrames } from './Prefabs/MainFrame.js';
import { initBees, animateBees } from './Prefabs/Bee.js';
import { initSnakes, animateSnakes } from './Prefabs/Snake.js';
import { initGlitchFloor, animateGlitchFloor } from './Prefabs/GlitchFloor.js';
import { initGates, animateGates } from './Prefabs/SecurityGate.js';
import { initCrystal, animateCrystal } from './Prefabs/Crystal.js';
import { initPortal, animatePortal } from './Prefabs/Portal.js';
import { initObserver, animateObserver } from './Prefabs/Observer.js';
import { initRealityPortals, animateRealityPortals, updateFarewell } from './Prefabs/RealityPortal.js';
import { initFloorSelect, openFloors, goToLevel } from './UI/FloorSelect.js';
import { initTutorial } from './UI/Tutorial.js';
import { hasProgress, nextToPlay, crystalCount, setFloorCount, introSeen, markIntroSeen } from './Data/Progress.js';
import { dreamIntro } from './UI/DreamIntro.js';
import { countLevels, loadLevelNamed } from './Data/LevelIO.js';
import { initBullets } from './Prefabs/Bullet.js';
import { initHideSpots, animateHideSpots } from './Prefabs/HideSpot.js';
import { initExitDoor, updateExitDoor } from './Prefabs/ExitDoor.js';
import { updateIntro } from './Animations/IntroAnimation.js';
import { loadClips } from './Animations/Clips.js';
import { loadCharacterModels } from './Prefabs/Character.js';
import { loadHats } from './Prefabs/Hats.js';
import { updateSeeThrough } from './FX/SeeThrough.js';
import { updateAssembly, setAssemblyScene, preRender, postRender } from './FX/Assemble.js';
import { worldMesh } from './World/Grid.js';
import { initParticles, updateParticles } from './FX/Particles.js';
import { initCodeRain, updateCodeRain } from './FX/CodeRain.js';
import { initScreenFX } from './FX/ScreenFX.js';
import { updateBubble } from './FX/Bubble.js';
import { rebuild } from './Scenes/Level.js';
import { initGameScene, updateGame, setMode } from './Scenes/GameScene.js';
import { initEditor, startEditor } from './Scenes/EditorScene.js';
import { initElevator, initFloors, updateElevator, elevatorShown, renderElevator } from './Scenes/ElevatorScene.js';
import { initCaught, updateCaught } from './Scenes/CaughtScene.js';
import { pokiInit, pokiLoaded, pokiStop } from './Core/Poki.js';
// fuentes incluidas en el build (Poki bloquea las peticiones externas, como Google Fonts)
import '@fontsource/anton/400.css'; import '@fontsource/bangers/400.css';
import '@fontsource/chakra-petch/600.css'; import '@fontsource/chakra-petch/700.css';
import '@fontsource/inter/400.css'; import '@fontsource/inter/600.css';

// Punto de entrada: carga los datos, crea los objetos de la escena y arranca el bucle.
main();

// barra de la pantalla de carga (index.html / editor.html)
function loadStep(k, txt) { const b = document.getElementById('loadBar'), t = document.getElementById('loadTxt'); if (b) b.style.width = k * 100 + '%'; if (t) t.textContent = txt; }
function hideLoader() {
  document.body.classList.add('ready'); const l = document.getElementById('loader');
  if (l) { l.classList.add('out'); setTimeout(() => l.remove(), 500); }
}
// lo que no hace falta para el primer nivel se prepara después de empezar (escena del ascensor, cuenta de pisos, siguiente nivel)
function lazyLoad() {
  const idle = f => window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 300); // a más tardar en 1,5 s
  idle(() => { initElevator(); initFloors(); prefetchLevel(nextLevelName(G.levelName)); });
}

async function main() {
  loadStep(.05, 'LOADING OFFICE'); await pokiInit();
  G.DATA = await (await fetch('data/office.json')).json();
  initPalette(G.DATA.colors); initMaterials(); initProps(G.DATA);
  loadStep(.4, 'LOADING PEOPLE'); await Promise.all([loadClips(), loadCharacterModels(), loadHats()]);
  loadStep(.7, 'LOADING FLOOR');
  // si ya jugaste antes (y la dirección no pide un piso), retoma en el primer piso que no terminaste
  let start = LEVEL_NAME; const pre = (LEVEL_NAME.match(/^(.*?)\d+$/) || [0, 'piso'])[1];
  const nFloors = await countLevels(pre + '1'); setFloorCount(nFloors);    // el portal pide un cristal por piso
  if (!EDITOR && !new URLSearchParams(location.search).has('nivel') && hasProgress()) start = nextToPlay(pre, nFloors);
  G.level = start !== LEVEL_NAME ? await loadLevelNamed(start) : null;
  if (!G.level) { start = LEVEL_NAME; G.level = await loadLevel(); }
  G.levelName = start;
  if (EDITOR) G.level = loadDraft() || G.level;          // el editor retoma el borrador si hay uno

  initCodeRain(); initScreenFX(); initEngine();
  initWorldMesh(scene); initParticles(scene); initStartDesk(scene); initPlayer(scene);
  initAgents(scene); initCams(scene); initRacks(scene); initLasers(scene); initTowers(scene); initSafes(scene); initGuideArrows(scene); initBombs(scene); initObserver(scene); initMainFrames(scene); initBees(scene); initSnakes(scene); initGlitchFloor(scene); initGates(scene); initCrystal(scene); initJuice();
  initPortal(scene, { restart: () => goToLevel(pre + '1') }); initRealityPortals(scene); initBullets(scene); initHideSpots(scene); initExitDoor(scene);
  initInput(); initGameScene(); initCaught(); initFloorSelect(); initTutorial(); if (EDITOR) initEditor();
  document.getElementById('floorsBtn').addEventListener('click', openFloors);

  loadStep(.9, 'BUILDING'); setAssemblyScene(scene, worldMesh); rebuild();
  // primera partida: intro "soñando" (blanco, Z Z Z, mensaje) y después el piso 1. Si no, el nivel arranca directo.
  const dream = !EDITOR && !introSeen() && !hasProgress() && !new URLSearchParams(location.search).has('nivel');
  if (EDITOR) startEditor(); else if (dream) G.mode = 'dream'; else setMode('play');
  startLoop(frame); loadStep(1, 'READY'); pokiLoaded();
  requestAnimationFrame(() => requestAnimationFrame(hideLoader));
  lazyLoad();
  if (dream) { await dreamIntro(); markIntroSeen(); setMode('play'); }   // el nivel se arma mientras el blanco se desvanece
}

// un frame: lógica (intro o juego) y luego animaciones, efectos y cámara
function frame(dt) {
  const real = dt; dt = gameDt(dt);                         // hitstop / cámara lenta (Juice): solo el juego, la UI sigue normal
  G.t += dt;
  if (G.mode === 'play') { if (G.asm >= 0) updateAssembly(dt, scene, worldMesh, player.ch.root); else if (G.intro >= 0) updateIntro(dt); else updateGame(dt); }
  if (G.mode !== 'play') pokiStop();                       // atrapado, ascensor, menú, final: ya no está jugando
  animatePlayer(); animateBombs(dt);                       // bombas después del jugador: le levantan los brazos al cargarlas
  updateStartDesk(); updateBubble(cam, stage); updateExitDoor(dt); updateCodeRain(dt);
  updateParticles(dt); animateHideSpots(dt, player); updateFarewell(dt);   // la despedida del final reemplaza la pose del jugador
  animateAgents(); animateCams(); animateRacks(); animateLasers(); animateTowers(dt); animateSafes(dt); animateMainFrames(dt); animateBees(dt); animateSnakes(dt); animateGlitchFloor(dt); animateGates(); animateObserver(dt, player); animateCrystal(); animatePortal(dt); animateRealityPortals(dt); animateGuideArrows(dt);
  const cEl = document.getElementById('crystals'); cEl.textContent = `◆ ${crystalCount() + (G.gotCrystal && !G.hadCrystal ? 1 : 0)}`; cEl.classList.toggle('got', !!G.gotCrystal);
  updateElevator(real); updateCaught(real); updateJuice(real, cam, stage);
  updateCamera(real, player); updateSeeThrough(dt, player);
  if (elevatorShown()) renderElevator(); else { preRender(); render(); postRender(); }
}
