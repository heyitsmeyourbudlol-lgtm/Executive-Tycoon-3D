// === MONITOR ===
import { roundedBox, addMesh, boxBF, enableShadows } from '../geom.js';

/**
 * Rounded bezel monitor with emissive screen plane slightly in front.
 */
export function createMonitor(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'monitor';

  const bezelGeo = roundedBox(THREE, 1.4, 0.88, 0.16, 0.04, 4);
  addMesh(group, bezelGeo, mats.plastic.clone(), 0, 0, 0);

  const screenGeo = roundedBox(THREE, 1.18, 0.68, 0.05, 0.02, 3);
  const screenMesh = addMesh(group, screenGeo, mats.screen, 0, 0.1, 0.12);
  screenMesh.userData.isScreen = true;

  // Stand neck + base
  boxBF(group, THREE, 0.14, 0.24, 0.28, mats.metalDark, 0, -0.56, 0.06);
  boxBF(group, THREE, 0.75, 0.03, 0.55, mats.plastic, -1.0, -0.68, 0);

  enableShadows(group);
  group.userData.screenMesh = screenMesh;
  return group;
}
