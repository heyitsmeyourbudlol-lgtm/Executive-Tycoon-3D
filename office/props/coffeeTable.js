// === COFFEE TABLE ===
import { roundedBox, addMesh, boxBF, enableShadows } from '../geom.js';

/**
 * Rounded coffee table with four legs.
 */
export function createCoffeeTable(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'coffeeTable';

  const topGeo = roundedBox(THREE, 2.3, 0.1, 1.05, 0.05, 4);
  addMesh(group, topGeo, mats.wall, 0, 0.4, 0);

  const legGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.4, 6);
  [[-0.9, 0.38], [0.9, 0.38], [-0.9, -0.38], [0.9, -0.38]].forEach(([lx, lz]) => {
    addMesh(group, legGeo, mats.woodDark, lx, 0.2, lz);
  });

  // Decor on top
  boxBF(group, THREE, 0.65, 0.04, 0.5, mats.paper, -0.4, 0.45, 0);
  boxBF(group, THREE, 0.15, 0.22, 0.15, mats.woodDark, 0.65, 0.45, -0.05);

  enableShadows(group);
  return group;
}
