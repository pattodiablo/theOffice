import { EDITOR } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { compose } from '../World/Grid.js';
import { computeWalk } from '../World/Navigation.js';
import { syncAgents, resetAgents } from '../Prefabs/Agent.js';
import { syncCams } from '../Prefabs/SecurityCam.js';
import { syncRacks } from '../Prefabs/ServerRack.js';
import { syncLasers } from '../Prefabs/LaserGate.js';
import { syncTowers } from '../Prefabs/SensorTower.js';
import { syncSafes } from '../Prefabs/Safe.js';
import { syncBombs } from '../Prefabs/Bomb.js';
import { syncMainFrames } from '../Prefabs/MainFrame.js';
import { syncCrystal } from '../Prefabs/Crystal.js';
import { syncPortal } from '../Prefabs/Portal.js';
import { syncRealityPortals } from '../Prefabs/RealityPortal.js';
import { drawHides } from '../Prefabs/HideSpot.js';
import { player } from '../Prefabs/Player.js';
import { saveDraft } from '../Data/LevelIO.js';
import { onLevelRebuilt } from './EditorScene.js';

// Arma en el mundo el nivel abierto (G.level), como abrir una escena en Unity.
// Se llama al cargar y cada vez que el editor cambia algo.
export function rebuild() {
  compose(); computeWalk(); syncAgents(); resetAgents(); syncCams(); syncRacks(); syncLasers(); syncTowers(); syncSafes(); syncBombs(); syncMainFrames(); syncCrystal(); syncPortal(); syncRealityPortals(); drawHides();
  Object.assign(player, { x: G.seat.x, y: G.seat.y });
  if (EDITOR) { onLevelRebuilt(); saveDraft(G.level); }
}
