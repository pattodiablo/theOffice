import * as THREE from 'three';

// Materiales compartidos por todo el juego.
export const M = {};
export function initMaterials() {
  M.voxel = new THREE.MeshLambertMaterial({ vertexColors: true });                                                   // mundo y props
  M.ghost = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: .6, depthWrite: false }); // vista previa del editor
  M.hint = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: .3, depthWrite: false });  // silueta de los escondites
  M.glass = new THREE.MeshLambertMaterial({ color: 0x9cf0c4, transparent: true, opacity: .5, depthWrite: false });   // vidrio de la puerta
  M.hideRing = new THREE.MeshBasicMaterial({ color: 0x3be07c, transparent: true, opacity: .55, depthWrite: false }); // círculo de los escondites
}

// Material de color liso (personajes, marcos). Se reutiliza por color.
const flatCache = {};
export const flat = hex => flatCache[hex] ||= new THREE.MeshLambertMaterial({ color: hex });
