import { INTRO_MESSAGES } from '../Settings.js';

// Intro de la primera partida: la pantalla se funde a blanco, aparecen unas "Z Z Z" grandes flotando (está soñando),
// se escribe un mensaje onírico (INTRO_MESSAGES) y el blanco se desvanece sobre el piso 1.
// Un clic o una tecla la salta. dreamIntro() se resuelve cuando empieza a desvanecerse (ahí arranca el nivel).
const T = { zzz: .9, msg: 4.6, char: .055, hold: 1.6, out: 1.4 };   // segundos: Z Z Z · mensaje · por letra · espera al final · desvanecer

export function dreamIntro() {
  return new Promise(resolve => {
    const el = document.createElement('div'); el.id = 'dreamIntro';
    el.innerHTML = '<div class="zzz"><b>Z</b><b>Z</b><b>Z</b><i>...</i></div><p class="imsg"></p><small>tap to skip</small>';
    document.body.append(el);
    const msgEl = el.querySelector('.imsg'), msg = INTRO_MESSAGES[Math.random() * INTRO_MESSAGES.length | 0];
    const timers = [], at = (s, fn) => timers.push(setTimeout(fn, s * 1000));
    let ended = false;
    const end = () => {                                           // desvanecer y empezar
      if (ended) return; ended = true; timers.forEach(clearTimeout);
      removeEventListener('keydown', skip); el.removeEventListener('pointerdown', skip);
      el.classList.add('out'); resolve();
      setTimeout(() => el.remove(), T.out * 1000);
    };
    const skip = e => { if (e.type === 'keydown') e.preventDefault(); end(); };
    addEventListener('keydown', skip); el.addEventListener('pointerdown', skip);
    at(T.zzz, () => el.classList.add('show-z'));
    at(T.msg, () => el.classList.add('show-msg'));
    for (let i = 1; i <= msg.length; i++) at(T.msg + .3 + i * T.char, () => { msgEl.textContent = msg.slice(0, i); });
    at(T.msg + .3 + msg.length * T.char + T.hold, end);
  });
}
