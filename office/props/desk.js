// === DESK ===
import { roundedBox, addMesh, boxBF, enableShadows } from '../geom.js';

const DESK_W = 3.3;
const DESK_D = 1.65;
const DESK_TOP_Y = 0.9;
const DESK_TOP_T = 0.12;
const LEG_INSET = 0.12;

/**
 * Rounded desktop with tapered legs and modesty panel.
 * Local origin at desk center; top surface at deskTopY.
 */
export function createDesk(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'desk';

  const topGeo = roundedBox(THREE, DESK_W, DESK_TOP_T, DESK_D, 0.05, 4);
  addMesh(group, topGeo, mats.wood, 0, DESK_TOP_Y - DESK_TOP_T / 2, 0);

  const legH = DESK_TOP_Y - DESK_TOP_T;
  const legGeo = new THREE.CylinderGeometry(0.05, 0.07, legH, 8);
  const legX = DESK_W / 2 - LEG_INSET;
  const legZ = DESK_D / 2 - LEG_INSET;
  [[-legX, -legZ], [legX, -legZ], [-legX, legZ], [legX, legZ]].forEach(([lx, lz]) => {
    addMesh(group, legGeo, mats.woodDark, lx, legH / 2, lz);
  });

  // Modesty panel (front)
  boxBF(group, THREE, DESK_W - 0.2, 0.4, 0.1, mats.wood, 0, 0.2, DESK_D / 2 - 0.05);

  enableShadows(group);
  group.userData.deskTopY = DESK_TOP_Y;
  group.userData.size = { w: DESK_W, d: DESK_D, h: DESK_TOP_Y };
  return group;
}
