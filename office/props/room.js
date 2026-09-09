// === ROOM ===
import { addMesh, boxBF, enableShadows } from '../geom.js';

export const WALL_Z = -5.72;
export const WALL_X = -5.72;
export const DECOR_Z = -5.28;

/**
 * Floor, two walls, baseboards. Flush structural shell.
 * @returns {{ group: THREE.Group, anchors: object }}
 */
export function createRoom(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'room';

  // Floor
  boxBF(group, THREE, 11, 0.15, 11, mats.floor, 0, -0.15, 0);

  // Wood inlay accent
  const inlay = boxBF(group, THREE, 5.5, 0.04, 4.0, mats.woodDark, 1.0, 0.02, 0.8);
  inlay.renderOrder = 1;

  // Back wall
  addMesh(
    group,
    new THREE.BoxGeometry(11, 8, 0.28),
    mats.wall,
    0,
    4,
    WALL_Z
  );

  // Back baseboard
  boxBF(group, THREE, 11, 0.22, 0.18, mats.wall.clone(), 0, 0, WALL_Z + 0.18);

  // Left wall
  addMesh(
    group,
    new THREE.BoxGeometry(0.28, 8, 11),
    mats.wall,
    WALL_X,
    4,
    0
  );

  // Left baseboard
  boxBF(group, THREE, 0.18, 0.22, 11, mats.wall.clone(), WALL_X + 0.18, 0, 0);

  enableShadows(group);

  return {
    group,
    anchors: {
      floorY: 0,
      wallBackZ: WALL_Z,
      wallLeftX: WALL_X,
      decorZ: DECOR_Z,
    },
  };
}
