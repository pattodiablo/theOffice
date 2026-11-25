import './Styles/main.css';
import './Styles/animator.css';
import * as THREE from 'three';
import { makeCharacter, loadCharacterModels } from './Prefabs/Character.js';
import { CHANNELS, CLIP_INFO, FACTORY, clips, loadClips, sampleTrack, sampleClip, applyPose, defaultValue } from './Animations/Clips.js';

// Editor de animaciones (como la ventana Animation de Unity): elige un clip, mueve los controles para poner
// keyframes en el tiempo actual, reprodúcelo y guárdalo en public/animations/<clip>.json.
const $ = s => document.querySelector(s);
const isRot = c => !c.endsWith('.y') && !c.endsWith('.sy');          // rotaciones: se muestran en grados
const show = (c, v) => isRot(c) ? Math.round(v * 180 / Math.PI) + '°' : v.toFixed(2);

let name = 'walk', clip, t = 0, playing = true, dirty = false, charKind = 'player', ch;
const unsaved = new Set();
let renderer, scene, cam, refGroup, az = .7, dist = 44;

// ---------- vista 3D ----------
function initView() {
  const view = $('#anView');
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  view.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(35, 1, 1, 500);
  scene.add(new THREE.HemisphereLight(0xc4ffd6, 0x0d2a18, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(30, 50, 40); scene.add(sun);
  const grid = new THREE.GridHelper(40, 20, 0x3be07c, 0x1d4a33); scene.add(grid);
  refGroup = new THREE.Group(); scene.add(refGroup);                  // silla y escritorio de referencia para la intro
  const m = c => new THREE.MeshLambertMaterial({ color: c });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 5), m(0x2846aa)); seat.position.set(0, 3.5, 0); refGroup.add(seat);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 16), m(0xcdc6b9)); desk.position.set(7.5, 6.5, 0); refGroup.add(desk);
  let drag = null;
  view.addEventListener('pointerdown', e => { drag = e.clientX; view.setPointerCapture(e.pointerId); });
  view.addEventListener('pointermove', e => { if (drag === null) return; az -= (e.clientX - drag) * .01; drag = e.clientX; });
  view.addEventListener('pointerup', () => drag = null);
  view.addEventListener('wheel', e => { e.preventDefault(); dist = Math.min(90, Math.max(20, dist + e.deltaY * .03)); }, { passive: false });
  new ResizeObserver(() => { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }).observe(view);
}
function setCharacter(kind) {
  if (ch) scene.remove(ch.root);
  charKind = kind; ch = makeCharacter(scene, kind !== 'player', kind === 'red'); ch.root.position.set(0, 0, 0);
}

// ---------- clip ----------
function loadClip(n) {
  name = n; clip = JSON.parse(JSON.stringify(clips[n] || FACTORY[n])); clip.tracks ||= {}; t = 0; dirty = unsaved.has(n);
  $('#saveBtn').textContent = dirty ? 'Guardar •' : 'Guardar';
  $('#loopChk').checked = !!clip.loop; $('#durInp').value = clip.duration;
  $('#anInfo').textContent = CLIP_INFO[n] || '';
  refGroup.visible = n === 'wake_up';
  buildChannels(); refresh();
}
const keyIndexAt = (keys, time) => keys.findIndex(k => Math.abs(k[0] - time) < .006);
function setKey(c, value) {
  const time = Math.round(t * 100) / 100, keys = clip.tracks[c] ||= [];
  const i = keyIndexAt(keys, time);
  if (i >= 0) keys[i][1] = value; else { keys.push([time, value]); keys.sort((a, b) => a[0] - b[0]); }
  markDirty(); refresh();
}
function delKey(c) {
  const keys = clip.tracks[c]; if (!keys) return; const i = keyIndexAt(keys, Math.round(t * 100) / 100);
  if (i >= 0) { keys.splice(i, 1); if (!keys.length) delete clip.tracks[c]; markDirty(); refresh(); }
}
function markDirty() { dirty = true; $('#saveBtn').textContent = 'Guardar •'; }
const valueAt = c => sampleTrack(clip.tracks[c], t) ?? defaultValue(c);

// ---------- panel de canales ----------
function buildChannels() {
  $('#channels').innerHTML = CHANNELS.map(([c, label, min, max]) => `
    <div class="ch" data-c="${c}">
      <span class="lbl">${label}</span>
      <input type="range" min="${min}" max="${max}" step="0.01">
      <span class="val"></span>
      <button class="k" title="Marcar keyframe">◆</button><button class="x" title="Borrar keyframe">✕</button>
      <div class="track"></div>
    </div>`).join('');
  for (const row of document.querySelectorAll('.ch')) {
    const c = row.dataset.c;
    row.querySelector('input').addEventListener('input', e => { pause(); setKey(c, +e.target.value); });
    row.querySelector('.k').addEventListener('click', () => { pause(); setKey(c, valueAt(c)); });
    row.querySelector('.x').addEventListener('click', () => { pause(); delKey(c); });
    row.querySelector('.track').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); pause(); t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * clip.duration; refresh(); });
  }
}
function refresh() {
  const D = clip.duration, now = Math.round(t * 100) / 100;
  $('#timeRange').max = D; $('#timeRange').value = t; $('#timeTxt').textContent = `${t.toFixed(2)} / ${D.toFixed(2)} s`;
  for (const row of document.querySelectorAll('.ch')) {
    const c = row.dataset.c, keys = clip.tracks[c] || [], v = valueAt(c);
    row.querySelector('input').value = v; row.querySelector('.val').textContent = show(c, v);
    row.classList.toggle('animated', keys.length > 0);
    row.querySelector('.track').innerHTML = `<i class="now" style="left:${t / D * 100}%"></i>` +
      keys.map(k => `<b class="${Math.abs(k[0] - now) < .006 ? 'cur' : ''}" style="left:${k[0] / D * 100}%"></b>`).join('');
  }
}
function pause() { playing = false; $('#playBtn').textContent = '▶ Play'; $('#playBtn').classList.remove('on'); }

// ---------- guardar ----------
let flashT;
const flash = msg => { $('#anInfo').textContent = msg; clearTimeout(flashT); flashT = setTimeout(() => $('#anInfo').textContent = CLIP_INFO[name] || '', 3500); };
async function save() {
  const body = JSON.stringify({ ...clip, name }, null, 1);
  try {
    const r = await fetch(`api/animation?name=${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!r.ok) throw new Error(r.status);
    clips[name] = JSON.parse(body); dirty = false; unsaved.delete(name); $('#saveBtn').textContent = 'Guardar'; flash(`Guardado en public/animations/${name}.json`);
  } catch (e) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' })); a.download = name + '.json'; a.click();
    flash('Sin servidor de desarrollo: se descargó el JSON');
  }
}

// ---------- arranque ----------
async function main() {
  await loadClips(); await loadCharacterModels();
  initView(); setCharacter('player');
  $('#clipSel').innerHTML = Object.entries(CLIP_INFO).map(([k, d]) => `<option value="${k}">${k} — ${d}</option>`).join('');
  $('#clipSel').value = name;
  $('#clipSel').addEventListener('change', e => { if (dirty) { clips[name] = clip; unsaved.add(name); } loadClip(e.target.value); }); // los cambios sin guardar se conservan al cambiar de clip
  $('#charSel').addEventListener('change', e => { setCharacter(e.target.value); refresh(); });
  $('#playBtn').addEventListener('click', () => { playing = !playing; $('#playBtn').textContent = playing ? '⏸ Pausa' : '▶ Play'; $('#playBtn').classList.toggle('on', playing); });
  $('#loopChk').addEventListener('change', e => { clip.loop = e.target.checked; markDirty(); });
  $('#durInp').addEventListener('change', e => {
    const d = Math.max(.1, +e.target.value || clip.duration); clip.duration = d;
    for (const c in clip.tracks) { clip.tracks[c] = clip.tracks[c].filter(k => k[0] <= d + 1e-6); if (!clip.tracks[c].length) delete clip.tracks[c]; }
    t = Math.min(t, d); markDirty(); refresh();
  });
  $('#timeRange').addEventListener('input', e => { pause(); t = +e.target.value; refresh(); });
  $('#toStart').addEventListener('click', () => { t = 0; refresh(); });
  $('#saveBtn').addEventListener('click', save);
  $('#revertBtn').addEventListener('click', async () => { unsaved.delete(name); await loadClips(); loadClip(name); flash('Recargado del archivo'); });
  $('#factoryBtn').addEventListener('click', () => { clips[name] = JSON.parse(JSON.stringify(FACTORY[name])); loadClip(name); markDirty(); flash('Versión de fábrica cargada: toca Guardar para conservarla'); });
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (e.code === 'Space') { e.preventDefault(); $('#playBtn').click(); } });
  loadClip(name); $('#playBtn').textContent = '⏸ Pausa';

  let last = performance.now(), uiT = 0;
  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (playing) {
      t += dt;
      if (t > clip.duration) t = clip.loop ? t % clip.duration : 0;
      if ((uiT += dt) > .05) { uiT = 0; refresh(); }
    }
    applyPose(ch, sampleClip(clip, t));
    cam.position.set(Math.cos(az) * dist, 14 + dist * .12, Math.sin(az) * dist); cam.lookAt(0, 8, 0);
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
main();
