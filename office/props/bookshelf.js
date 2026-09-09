// === BOOKSHELF ===
import { addMesh, boxBF, enableShadows } from '../geom.js';

const BOOK_COLORS = [
  0x8b2020, 0x1a4a7a, 0x1a6a2a, 0x8a5a10, 0x4a2a7a,
  0x1a4a7a, 0x8b2020, 0x1a6a2a,
];

/**
 * Side bookshelf with shelves and colorful books.
 */
export function createBookshelf(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'bookshelf';

  // Carcass
  boxBF(group, THREE, 0.2, 3.6, 2.9, mats.wood, 0, 0, 0);

  // Shelves
  [1.4, 2.4, 3.4].forEach((sy) => {
    boxBF(group, THREE, 0.18, 0.08, 2.7, mats.woodDark, 0.08, sy, 0);
  });

  // Books on two rows
  for (let row = 0; row < 2; row++) {
    BOOK_COLORS.forEach((bc, bi) => {
      const bh = 0.28 + (bi % 3) * 0.04;
      const bookMat = mats.plastic.clone();
      bookMat.color.setHex(bc);
      boxBF(group, THREE, 0.09, bh, 0.28, bookMat, 0.14, row === 0 ? 1.48 : 2.48, -1.1 + bi * 0.38);
    });
  }

  enableShadows(group);
  return group;
}
