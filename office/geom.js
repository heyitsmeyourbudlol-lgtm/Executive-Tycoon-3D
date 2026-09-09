/**
 * Geometry helpers for procedural office props.
 */

/**
 * Rounded rectangle shape for extrusion.
 */
function roundedRectShape(THREE, w, h, radius) {
  const shape = new THREE.Shape();
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(radius, hw, hh);

  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

/**
 * Rounded box via ExtrudeGeometry with bevel, or segmented BoxGeometry fallback.
 */
export function roundedBox(THREE, w, h, d, radius = 0.04, segments = 4) {
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  if (r <= 0.001) {
    return new THREE.BoxGeometry(w, h, d, segments, segments, segments);
  }

  const shape = roundedRectShape(THREE, w, d, r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: true,
    bevelThickness: r * 0.35,
    bevelSize: r * 0.35,
    bevelSegments: 2,
    curveSegments: segments,
    steps: 1,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -h / 2, 0);
  return geo;
}

/**
 * Extrude a 2D shape with bevel.
 */
export function bevelExtrude(THREE, shape, depth, bevelSize = 0.02) {
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelSize > 0,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 8,
    steps: 1,
  });
}

/**
 * Enable cast/receive shadows on an object and all descendants.
 */
export function enableShadows(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return obj;
}

/**
 * Create a mesh, add to parent group, enable shadows.
 */
export function addMesh(group, geo, material, x, y, z, ry = 0) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  if (ry) mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/**
 * Box with bottom-center origin (y=0 at bottom).
 */
export function boxBF(group, THREE, w, h, d, material, x, yBottom, z, ry = 0) {
  return addMesh(group, new THREE.BoxGeometry(w, h, d), material, x, yBottom + h / 2, z, ry);
}
