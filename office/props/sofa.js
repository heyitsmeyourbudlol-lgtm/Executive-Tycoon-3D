// === SOFA ===
import { roundedBox, addMesh, boxBF, enableShadows } from '../geom.js';

/**
 * Rounded lounge sofa with cushions.
 */
export function createSofa(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'sofa';

  const baseGeo = roundedBox(THREE, 3.9, 0.52, 1.45, 0.08, 4);
  addMesh(group, baseGeo, mats.fabricLight, 0, 0.14, 0);

  const backGeo = roundedBox(THREE, 3.9, 0.65, 0.19, 0.06, 3);
  addMesh(group, backGeo, mats.fabricLight, 0, 0.97, -0.64);

  // Arm rests
  boxBF(group, THREE, 0.24, 0.72, 1.45, mats.fabricLight, -1.82, 0.68, 0);
  boxBF(group, THREE, 0.24, 0.72, 1.45, mats.fabricLight, 1.82, 0.68, 0);

  // Cushions
  boxBF(group, THREE, 1.15, 0.18, 1.15, mats.fabric, -1.1, 0.73, 0.05);
  boxBF(group, THREE, 1.15, 0.18, 1.15, mats.fabric, 0.05, 0.73, 0.05);
  boxBF(group, THREE, 1.1, 0.18, 1.1, mats.fabric, 1.2, 0.73, 0.05);

  enableShadows(group);
  return group;
}
