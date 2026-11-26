import { Z } from '../Core/Constants.js';
import { playClip } from './Clips.js';

// Animaciones de los personajes: eligen el clip según lo que hacen y lo reproducen (los clips se editan en animator.html).

// caminar / quieto. t = reloj de la animación (los agentes lo aceleran al correr)
export function pose(ch, x, y, ang, t, moving) {
  ch.root.position.set(x, Z, -y); ch.root.rotation.y = ang;
  playClip(ch, moving ? 'walk' : 'idle', t, .3); // .3 = transición suave entre clips
}

// un clip exacto en el tiempo t (intro, celebración)
export function poseClip(ch, x, y, ang, name, t) {
  ch.root.position.set(x, Z, -y); ch.root.rotation.y = ang;
  playClip(ch, name, t, 1);
}
