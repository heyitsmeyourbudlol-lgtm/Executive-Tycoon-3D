// === WINDOW FRAME ===
import { addMesh, boxBF, enableShadows } from '../geom.js';

/**
 * Wood window frame with glass pane for back wall.
 */
export function createWindowFrame(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'windowFrame';

  // Outer frame
  boxBF(group, THREE, 2.3, 2.1, 0.16, mats.woodDark, 0, 0, -0.06);

  // Glass pane
  const glass = boxBF(group, THREE, 1.95, 1.75, 0.06, mats.glass, 0, 0.2, 0);
  glass.renderOrder = 3;

  // Cross mullions
  boxBF(group, THREE, 1.95, 0.08, 0.05, mats.woodDark, 0, 1.08, 0.02);
  boxBF(group, THREE, 0.08, 1.75, 0.05, mats.woodDark, 0.95, 0.2, 0.02);

  enableShadows(group);
  return group;
}
