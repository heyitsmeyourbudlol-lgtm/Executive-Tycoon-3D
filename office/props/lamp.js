// === LAMP ===
import { roundedBox, addMesh, boxBF, enableShadows } from '../geom.js';

/**
 * Desk lamp: metal stem + rounded shade. Base sits on desk surface (y=0 local).
 */
export function createLamp(THREE, mats) {
  const group = new THREE.Group();
  group.name = 'lamp';

  boxBF(group, THREE, 0.2, 0.2, 0.2, mats.metalDark, 0, 0, 0);

  const stemGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.72, 6);
  addMesh(group, stemGeo, mats.metalDark, 0, 0.56, 0);

  const armGeo = new THREE.BoxGeometry(0.56, 0.07, 0.07);
  const arm = addMesh(group, armGeo, mats.metalDark, 0.28, 1.0, 0);
  arm.rotation.z = -0.15;

  const shadeGeo = roundedBox(THREE, 0.44, 0.22, 0.44, 0.06, 4);
  const shade = addMesh(group, shadeGeo, mats.gold, 0.56, 1.08, 0);
  shade.userData.isLampShade = true;

  enableShadows(group);
  group.userData.lampLightOffset = { x: 0.56, y: 1.15, z: 0 };
  return group;
}
