import * as THREE from 'three';
import { Z } from '../Core/Constants.js';

// Estallido de cubitos verdes y blancos (al camuflarse).
const puffs = [];
let scene, geo;
export function initParticles(s) { scene = s; geo = new THREE.BoxGeometry(1.2, 1.2, 1.2); }

export function puff(x, y) {
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i % 3 ? 0x3be07c : 0xffffff, transparent: true, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, sp = 8 + Math.random() * 10;
    m.position.set(x, Z + 3 + Math.random() * 8, -y); m.userData = { vx: Math.cos(a) * sp, vy: 6 + Math.random() * 10, vz: Math.sin(a) * sp, life: .5 };
    scene.add(m); puffs.push(m);
  }
}

export function updateParticles(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const m = puffs[i], u = m.userData; u.life -= dt;
    if (u.life <= 0) { scene.remove(m); m.material.dispose(); puffs.splice(i, 1); continue; }
    m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt; u.vy -= 30 * dt; m.material.opacity = u.life * 2;
  }
}
