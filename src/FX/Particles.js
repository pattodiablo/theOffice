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

// polvito al caminar: 3 cubitos chicos que quedan atrás y se apagan
let dustGeo;
export function dust(x, y) {
  dustGeo ||= new THREE.BoxGeometry(.7, .7, .7);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({ color: 0xbfe8cf, transparent: true, opacity: .6, depthWrite: false }));
    const a = Math.random() * Math.PI * 2;
    m.position.set(x + Math.cos(a), Z + .6, -y + Math.sin(a)); m.userData = { vx: Math.cos(a) * 3, vy: 3 + Math.random() * 3, vz: Math.sin(a) * 3, life: .35, a: .6 };
    scene.add(m); puffs.push(m);
  }
}

export function updateParticles(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const m = puffs[i], u = m.userData; u.life -= dt;
    if (u.life <= 0) { scene.remove(m); m.material.dispose(); puffs.splice(i, 1); continue; }
    m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt; u.vy -= 30 * dt; m.material.opacity = u.life * (u.a ? u.a / .35 : 2);
  }
}
