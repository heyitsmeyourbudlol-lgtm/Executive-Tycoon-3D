// === CHAIR ===
import { roundedBox, addMesh, boxBF, enableShadows } from '../geom.js';

const SEAT_W = 0.9;
const SEAT_D = 0.9;
const SEAT_T = 0.1;
const SEAT_Y = 0.52;

/**
 * Rounded seat, curved back, four legs. Origin at seat center.
 */
export function createChair(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'chair';

  const seatGeo = roundedBox(THREE, SEAT_W, SEAT_T, SEAT_D, 0.04, 4);
  addMesh(group, seatGeo, mats.fabric, 0, SEAT_Y, 0);

  // Curved-ish back (rounded box tilted)
  const backGeo = roundedBox(THREE, SEAT_W, 0.88, 0.1, 0.03, 3);
  const back = addMesh(group, backGeo, mats.fabric, 0, SEAT_Y + 0.52, -SEAT_D / 2 + 0.05);
  back.rotation.x = -0.08;

  // Arm rests
  boxBF(group, THREE, 0.11, 0.12, 0.82, mats.fabric, -SEAT_W / 2 + 0.06, SEAT_Y + 0.26, 0);
  boxBF(group, THREE, 0.11, 0.12, 0.82, mats.fabric, SEAT_W / 2 - 0.06, SEAT_Y + 0.26, 0);

  const legGeo = new THREE.CylinderGeometry(0.045, 0.045, SEAT_Y, 6);
  const lx = SEAT_W / 2 - 0.08;
  const lz = SEAT_D / 2 - 0.08;
  [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(([px, pz]) => {
    addMesh(group, legGeo, mats.metalDark, px, SEAT_Y / 2, pz);
  });

  enableShadows(group);
  group.userData.seatY = SEAT_Y;
  return group;
}
