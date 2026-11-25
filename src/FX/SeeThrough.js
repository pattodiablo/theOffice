import * as THREE from 'three';
import { Z } from '../Core/Constants.js';
import { G } from '../Core/Game.js';
import { at } from '../World/Grid.js';
import { CAM_OFF } from '../Core/Engine.js';
import { patchAssembly } from './Assemble.js';
import { SEE_THROUGH, SEE_THROUGH_R, SEE_THROUGH_ALPHA } from '../Settings.js';

// Ver a través: si una pared o un prop tapa al jugador frente a la cámara, esa zona se vuelve
// semitransparente (un círculo alrededor del jugador). Solo afecta lo que está ENTRE la cámara y el jugador;
// el piso y lo que está detrás no cambian. La transparencia es un tramado (dither) para no tener
// problemas de orden con una sola malla grande.
const U = {
  uSeePos: { value: new THREE.Vector3() },   // centro del jugador (mundo Three.js)
  uSeeDir: { value: new THREE.Vector3() },   // dirección hacia la cámara
  uSeeR: { value: SEE_THROUGH_R },           // radio del círculo
  uSeeStr: { value: 0 },                     // 0 = nada, 1 = todo lo transparente que se permite
  uSeeMax: { value: 1 - SEE_THROUGH_ALPHA },
  uSeeFloor: { value: Z + .5 },              // por debajo de esta altura (el piso) nunca se transparenta
};

export function seeThroughMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U); patchAssembly(sh);   // también se ensambla al empezar (FX/Assemble.js)
    sh.vertexShader = 'varying vec3 vSeeW;\n' + sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  vSeeW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vSeeW;
uniform vec3 uSeePos, uSeeDir; uniform float uSeeR, uSeeStr, uSeeMax, uSeeFloor;
float seeBayer(vec2 p) { // tramado 4×4
  int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)), i = x + y * 4;
  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  for (int k = 0; k < 16; k++) if (k == i) return (float(b[k]) + .5) / 16.0;
  return .5;
}
` + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  if (uSeeStr > 0.0 && vSeeW.y > uSeeFloor) {
    vec3 d = vSeeW - uSeePos; float along = dot(d, uSeeDir);
    if (along > 2.0) {
      float perp = length(d - along * uSeeDir);
      float f = uSeeStr * uSeeMax * (1.0 - smoothstep(uSeeR * .55, uSeeR, perp));
      if (f > seeBayer(gl_FragCoord.xy)) discard;
    }
  }`);
  };
  m.customProgramCacheKey = () => 'seeThrough';
  return m;
}

// ¿Algo del mundo tapa al jugador? Lanza rayos desde varios puntos de su cuerpo hacia la cámara.
// Coordenadas de vóxel: x, y (profundidad) y z hacia arriba; Three.js (x, z, -y).
const dir = new THREE.Vector3();
function occluded(px, py) {
  const vx = dir.x, vy = -dir.z, vz = dir.y;
  for (const [ox, oy, h] of [[0, 0, 4], [0, 0, 8], [0, 0, 12], [-1.5, 1.5, 8], [1.5, -1.5, 8]]) {
    let x = px + ox, y = py + oy, z = Z + h;
    for (let s = 0; s < 70; s++) {
      x += vx * .7; y += vy * .7; z += vz * .7;
      if (z >= Z + 34) break;
      if (at(Math.floor(x), Math.floor(y), Math.floor(z))) return true;
    }
  }
  return false;
}

export function updateSeeThrough(dt, player) {
  dir.copy(CAM_OFF).normalize(); U.uSeeDir.value.copy(dir);
  U.uSeePos.value.set(player.x, Z + 7, -player.y);
  const want = SEE_THROUGH && G.mode === 'play' && occluded(player.x, player.y) ? 1 : 0;
  U.uSeeStr.value += (want - U.uSeeStr.value) * Math.min(1, dt * 8);
  if (U.uSeeStr.value < .01) U.uSeeStr.value = 0;
}
