// === CABINET ===
import { roundedBox, addMesh, boxBF, enableShadows } from '../geom.js';

/**
 * Filing cabinet with rounded edges and drawer pulls.
 */
export function createCabinet(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'cabinet';

  const bodyGeo = roundedBox(THREE, 1.35, 2.5, 0.95, 0.06, 4);
  addMesh(group, bodyGeo, mats.metal, 0, 1.25, 0);

  [0.4, 1.0, 1.6, 2.2].forEach((hy) => {
    boxBF(group, THREE, 1.1, 0.18, 0.07, mats.metalDark, 0, hy, 0.45);
    boxBF(group, THREE, 0.52, 0.05, 0.05, mats.plastic, 0, hy + 0.09, 0.48);
  });

  // Paper stack on top
  boxBF(group, THREE, 0.9, 0.05, 0.65, mats.paper, 0, 2.53, -0.1);

  enableShadows(group);
  return group;
}
