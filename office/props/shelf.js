// === SHELF ===
import { roundedBox, addMesh, boxBF, enableShadows } from '../geom.js';

/**
 * Wall shelf with rounded front edge and bracket supports.
 */
export function createShelf(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'shelf';

  const shelfGeo = roundedBox(THREE, 4.4, 0.12, 0.48, 0.04, 4);
  addMesh(group, shelfGeo, mats.woodDark, 0, 0, 0.22);

  // Back panel
  boxBF(group, THREE, 4.4, 1.6, 0.12, mats.wall, 0, 0.8, 0);

  // Brackets
  boxBF(group, THREE, 0.09, 0.36, 0.42, mats.wood, -2.2, -0.12, 0.22);
  boxBF(group, THREE, 0.09, 0.36, 0.42, mats.wood, 2.2, -0.12, 0.22);

  enableShadows(group);
  return group;
}
