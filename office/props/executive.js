// === EXECUTIVE ===
import { addMesh, boxBF, enableShadows } from '../geom.js';

/**
 * Simple seated executive figure (sphere head, box torso) at chair scale.
 */
export function createExecutive(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'executive';

  // Origin at floor; hips sit on chair seatY (~0.52). Torso bottom ≈ seat.
  const torsoGeo = new THREE.BoxGeometry(0.48, 0.52, 0.3);
  addMesh(group, torsoGeo, mats.fabricLight, 0, 0.78, 0.05);

  const headGeo = new THREE.SphereGeometry(0.19, 12, 10);
  addMesh(group, headGeo, mats.skin, 0, 1.54, 0.05);

  const hairGeo = new THREE.SphereGeometry(0.196, 12, 8);
  const hair = addMesh(group, hairGeo, mats.hair, 0, 1.6, 0.05);
  hair.scale.y = 0.5;

  boxBF(group, THREE, 0.17, 0.14, 0.58, mats.fabricLight, -0.38, 1.22, -0.28);
  boxBF(group, THREE, 0.17, 0.14, 0.58, mats.fabricLight, 0.38, 1.22, -0.28);

  enableShadows(group);
  return group;
}
