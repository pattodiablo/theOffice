import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { cam, stage } from '../Core/Engine.js';
import { G } from '../Core/Game.js';
import { RACK } from '../Settings.js';
import { rot } from '../Data/PropLibrary.js';
import { hackBeep, powerDownSound, bootSound } from '../Core/Audio.js';
import { shake, kick, hitstop, slowmo, flash, popText } from '../FX/Juice.js';
import { puff } from '../FX/Particles.js';
import { rebootCams } from './SecurityCam.js';

// Rack de servidores: es un prop más ("rack", se coloca en Props › Seguridad). Si el jugador se queda junto a él
// RACK.hackTime segundos (dentro del círculo azul), apaga TODAS las cámaras del nivel. Si se aleja, el hackeo se pierde.
// RACK.offTime = 0: quedan apagadas hasta el siguiente intento · > 0: se reinician solas después de esos segundos.
// Luz de arriba: azul disponible · amarilla hackeando · roja cámaras apagadas. La barra muestra el avance (o el apagón restante).
const COL = { ready: 0x4db8ff, hack: 0xffcc00, off: 0xff2a2a };
let group, ringGeo, racks = [];
const v = new THREE.Vector3();

export function initRacks(scene) { group = new THREE.Group(); scene.add(group); ringGeo = new THREE.RingGeometry(RACK.reach - .8, RACK.reach, 40).rotateX(-Math.PI / 2); }

// un rack por cada prop "rack" del nivel (se rehace con el nivel)
export function syncRacks() {
  for (const r of racks) { r.bar.remove(); r.ring.material.dispose(); }
  group.clear(); racks = [];
  for (const p of G.level.props) {
    if (p.t !== 'rack') continue;
    const R = rot(p.t, p.r), x = p.x + R.w / 2, y = p.y + R.d / 2;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: COL.ready, transparent: true, opacity: .5, depthWrite: false })); ring.position.set(x, Z + .32, -y); ring.renderOrder = 2;
    const light = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), new THREE.MeshBasicMaterial({ color: COL.ready })); light.position.set(x, Z + R.h + .6, -y);
    const bar = document.createElement('div'); bar.className = 'hidebar'; bar.innerHTML = '<i></i>'; document.body.append(bar);
    group.add(ring, light); racks.push({ x, y, h: R.h, ring, light, bar, prog: 0, beepT: 0 });
  }
}

export function resetRacks() { G.camsOff = false; G.camsOffT = 0; for (const r of racks) r.prog = 0; }

// lógica (solo jugando)
export function updateRacks(dt, p) {
  if (G.camsOff) {                                     // apagón temporal: cuenta atrás y se reinician
    if (RACK.offTime > 0 && (G.camsOffT -= dt) <= 0) { G.camsOff = false; rebootCams(); bootSound(); }
    return;
  }
  for (const r of racks) {
    const near = !G.hiddenKind && G.frozen <= 0 && Math.hypot(p.x - r.x, p.y - r.y) < RACK.reach;
    if (near) {
      r.prog += dt / RACK.hackTime;
      if ((r.beepT -= dt) <= 0) { r.beepT = .25; hackBeep(r.prog); }
      if (r.prog >= 1) {                               // ¡listo! se apagan las cámaras
        G.camsOff = true; G.camsOffT = RACK.offTime; r.prog = 0; powerDownSound(); puff(r.x, r.y);
        shake(.6); kick(.06); flash('77,184,255', .25); popText(r.x, r.y, 'CAMERAS OFFLINE', 'blue');
        for (const o of racks) o.prog = 0;
        return;
      }
    } else r.prog = Math.max(0, r.prog - dt * 2);       // te alejaste: se pierde el avance
  }
}

// luz, círculo y barra (visual, cada frame)
export function animateRacks() {
  const play = G.mode === 'play' || G.mode === 'over';
  for (const r of racks) {
    const st = play && G.camsOff ? 'off' : play && r.prog > 0 ? 'hack' : 'ready';
    r.light.material.color.setHex(COL[st]); r.light.visible = st !== 'ready' || Math.sin(G.t * 5) > -.4;
    r.ring.material.color.setHex(COL[st]); r.ring.material.opacity = st === 'off' ? .2 : .35 + .15 * Math.sin(G.t * 4);
    const timed = st === 'off' && RACK.offTime > 0, show = play && (st === 'hack' || timed);
    r.bar.style.display = show ? 'block' : 'none';
    if (show) {
      v.set(r.x, Z + r.h + 4, -r.y).project(cam);
      r.bar.style.left = ((v.x + 1) / 2 * stage.clientWidth) + 'px'; r.bar.style.top = ((1 - v.y) / 2 * stage.clientHeight) + 'px';
      r.bar.className = 'hidebar ' + (st === 'hack' ? 'hack' : 'cool');
      r.bar.firstChild.style.width = ((st === 'hack' ? r.prog : G.camsOffT / RACK.offTime) * 100) + '%';
    }
  }
}
