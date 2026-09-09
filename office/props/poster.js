// === POSTER ===
import { addMesh, boxBF, enableShadows } from '../geom.js';

/**
 * Framed poster with thin depth. Color param for poster art.
 */
export function createPoster(THREE, mats, color = 0x555550) {
  const group = new THREE.Group();
  group.name = 'poster';

  const posterMat = mats.plastic.clone();
  posterMat.color.setHex(color);

  boxBF(group, THREE, 1.12, 1.5, 0.1, mats.woodDark, 0, 0.75, -0.02);
  const art = boxBF(group, THREE, 0.9, 1.26, 0.05, posterMat, 0, 0.78, 0.06);
  art.renderOrder = 4;

  enableShadows(group);
  group.userData.posterMesh = art;
  return group;
}
