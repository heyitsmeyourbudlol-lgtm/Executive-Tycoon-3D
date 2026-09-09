/**
 * MeshStandardMaterial presets for the Executive Tycoon office scene.
 * @param {typeof THREE} THREE
 */
export function createMaterials(THREE) {
  const mat = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.65,
      metalness: opts.metalness ?? 0.05,
      ...opts,
    });

  return {
    wood: mat(0x3d1c08, { roughness: 0.72 }),
    woodDark: mat(0x2a1008, { roughness: 0.78 }),
    fabric: mat(0x160802, { roughness: 0.92 }),
    fabricLight: mat(0x370c04, { roughness: 0.88 }),
    metal: mat(0x8a8880, { metalness: 0.55, roughness: 0.35 }),
    metalDark: mat(0x333333, { metalness: 0.6, roughness: 0.4 }),
    glass: mat(0x3e85bd, {
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55,
    }),
    wall: mat(0xc4ba9c, { roughness: 0.85 }),
    floor: mat(0x4a1a06, { roughness: 0.8 }),
    screen: mat(0x1a3f5c, {
      roughness: 0.2,
      metalness: 0.15,
      emissive: 0x0a2840,
      emissiveIntensity: 0.35,
    }),
    plastic: mat(0x555550, { roughness: 0.55 }),
    gold: mat(0xb89a22, { metalness: 0.75, roughness: 0.28 }),
    paper: mat(0xeeebdf, { roughness: 0.95 }),
    skin: mat(0xc87840, { roughness: 0.82 }),
    hair: mat(0x180c02, { roughness: 0.9 }),
  };
}
