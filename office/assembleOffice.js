/**
 * Assemble the full Executive Tycoon office scene from prop modules.
 */
import { createMaterials } from './materials.js';
import { createRoom, WALL_X, DECOR_Z } from './props/room.js';
import { createDesk } from './props/desk.js';
import { createChair } from './props/chair.js';
import { createLamp } from './props/lamp.js';
import { createMonitor } from './props/monitor.js';
import { createShelf } from './props/shelf.js';
import { createWindowFrame } from './props/windowFrame.js';
import { createPoster } from './props/poster.js';
import { createBookshelf } from './props/bookshelf.js';
import { createSofa } from './props/sofa.js';
import { createCoffeeTable } from './props/coffeeTable.js';
import { createCabinet } from './props/cabinet.js';
import { createExecutive } from './props/executive.js';

const SHELF_Y = 4.65;
const SHELF_Z = DECOR_Z + 0.08;

/** Layout: absolute anchors and relative offsets from parent prop. */
const LAYOUT = {
  desk: { abs: { x: -3.85, y: 0, z: -4.25 } },
  chair: { rel: 'desk', offset: { x: -0.15, y: 0, z: 0.9 } },
  executive: { rel: 'chair', offset: { x: 0, y: 0, z: 0.06 } },
  lamp: { rel: 'desk', offset: { x: -1.05, y: 'deskTopY', z: 0.13 } },
  monitor: { rel: 'desk', offset: { x: -0.05, y: 'deskTopY', z: -0.47 } },
  window: { abs: { x: -2.6, y: 2.85, z: DECOR_Z } },
  shelf: { abs: { x: 0.4, y: SHELF_Y, z: SHELF_Z } },
  bookshelf: { abs: { x: WALL_X + 0.22, y: 0, z: -1.7 } },
  cabinet: { abs: { x: 3.5, y: 0, z: -4.75 } },
  sofa: { abs: { x: 0.4, y: 0, z: 0.85 } },
  coffeeTable: { abs: { x: 0.4, y: 0, z: 2.85 } },
  posters: {
    abs: { y: 2.5, z: DECOR_Z },
    items: [
      { x: -4.4, color: 0x8b2020 },
      { x: -2.4, color: 0x1a4a7a },
      { x: -0.4, color: 0x1a6a2a },
    ],
  },
};

  const AWARD_CATS = ['Best Picture', 'Best Director', 'Best Actor', 'Best Screenplay', 'Best Score'];

function resolveOffset(val, ctx) {
  if (val === 'deskTopY') return ctx.deskTopY ?? 0.9;
  return val ?? 0;
}

function placeProp(prop, entry, registry, ctx) {
  if (entry.abs) {
    prop.position.set(entry.abs.x ?? 0, entry.abs.y ?? 0, entry.abs.z ?? 0);
  } else if (entry.rel) {
    const parent = registry[entry.rel];
    if (!parent) return;
    const off = entry.offset || {};
    prop.position.set(
      parent.position.x + resolveOffset(off.x, ctx),
      parent.position.y + resolveOffset(off.y, ctx),
      parent.position.z + resolveOffset(off.z, ctx)
    );
  }
  registry[prop.name || entry.key] = prop;
}

function createTrophies(THREE, mats, shelfGroup) {
  const trophyMeshes = [];
  const metal = mats.metal;
  const gold = mats.gold;

  [-1.6, -0.8, 0.0, 0.8, 1.6].forEach((tx, i) => {
    const trophy = new THREE.Group();
    trophy.name = `trophy_${i}`;

    const baseGeo = new THREE.BoxGeometry(0.3, 0.08, 0.3);
    const baseMesh = new THREE.Mesh(baseGeo, metal);
    baseMesh.position.set(tx, 0.06, 0.38);
    baseMesh.castShadow = baseMesh.receiveShadow = true;
    trophy.add(baseMesh);

    const stemGeo = new THREE.BoxGeometry(0.1, 0.26, 0.1);
    const stem = new THREE.Mesh(stemGeo, metal);
    stem.position.set(tx, 0.27, 0.38);
    stem.castShadow = stem.receiveShadow = true;
    trophy.add(stem);

    const cupGeo = new THREE.CylinderGeometry(0.14, 0.07, 0.28, 14);
    const cup = new THREE.Mesh(cupGeo, gold);
    cup.position.set(tx, 0.54, 0.38);
    cup.castShadow = cup.receiveShadow = true;
    cup.userData.awardIdx = i;
    cup.userData.isTrophy = true;
    trophy.add(cup);

    shelfGroup.add(trophy);
    trophyMeshes.push(cup);
  });

  return trophyMeshes;
}

function createExteriorLights(THREE, scene) {
  const spots = [];
  [[-7.2, 3.5], [4.2, 7.3], [7.2, -2.2]].forEach(([tx, tz]) => {
    const pole = new THREE.Group();
    [[-0.3, 0], [0.15, 0.26], [0.15, -0.26]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 1.6, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8 })
      );
      leg.position.set(tx + lx, 0.8, tz + lz);
      leg.castShadow = true;
      pole.add(leg);
    });
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.24, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 })
    );
    head.position.set(tx, 1.77, tz);
    pole.add(head);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.11, 0.44, 10),
      new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.5 })
    );
    lens.position.set(tx, 1.78, tz - 0.48);
    lens.rotation.x = Math.PI / 2;
    pole.add(lens);
    scene.add(pole);
    spots.push(pole);
  });
  return spots;
}

function createGroundRing(THREE, scene, mats) {
  for (let i = 0; i < 48; i++) {
    const ang = (i / 48) * Math.PI * 2;
    const rad = 8.8;
    const tx = Math.cos(ang) * rad;
    const tz = Math.sin(ang) * rad;
    if (tx < -6 || tx > 6 || tz < -6 || tz > 6) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.07, 0.2),
        mats.metalDark
      );
      tile.position.set(tx, -0.035, tz);
      tile.receiveShadow = true;
      scene.add(tile);
    }
  }
}

/**
 * @param {typeof THREE} THREE
 * @param {THREE.Scene} scene
 * @param {object} [opts]
 */
export function assembleOffice(THREE, scene, opts = {}) {
  const mats = opts.materials || createMaterials(THREE);
  const root = new THREE.Group();
  root.name = 'officeRoot';
  scene.add(root);

  const registry = {};
  const ctx = { deskTopY: 0.9 };
  const posterMeshes = [];
  const screenMeshes = [];
  const lampShades = [];

  // Room shell
  const { group: roomGroup, anchors } = createRoom(THREE, mats);
  root.add(roomGroup);

  // Props
  const desk = createDesk(THREE, mats);
  desk.name = 'desk';
  ctx.deskTopY = desk.userData.deskTopY;
  placeProp(desk, LAYOUT.desk, registry, ctx);
  root.add(desk);
  registry.desk = desk;

  const chair = createChair(THREE, mats);
  chair.name = 'chair';
  placeProp(chair, LAYOUT.chair, registry, ctx);
  root.add(chair);
  registry.chair = chair;

  const executive = createExecutive(THREE, mats);
  executive.name = 'executive';
  placeProp(executive, LAYOUT.executive, registry, ctx);
  root.add(executive);

  const lamp = createLamp(THREE, mats);
  lamp.name = 'lamp';
  placeProp(lamp, LAYOUT.lamp, registry, ctx);
  root.add(lamp);
  lamp.traverse((c) => { if (c.userData?.isLampShade) lampShades.push(c); });

  const monitor = createMonitor(THREE, mats);
  monitor.name = 'monitor';
  placeProp(monitor, LAYOUT.monitor, registry, ctx);
  root.add(monitor);
  if (monitor.userData.screenMesh) screenMeshes.push(monitor.userData.screenMesh);

  const windowFrame = createWindowFrame(THREE, mats);
  windowFrame.name = 'window';
  placeProp(windowFrame, LAYOUT.window, registry, ctx);
  root.add(windowFrame);

  const shelf = createShelf(THREE, mats);
  shelf.name = 'shelf';
  placeProp(shelf, LAYOUT.shelf, registry, ctx);
  root.add(shelf);

  const trophyMeshes = createTrophies(THREE, mats, shelf);

  LAYOUT.posters.items.forEach(({ x, color }) => {
    const poster = createPoster(THREE, mats, color);
    poster.position.set(x, LAYOUT.posters.abs.y, LAYOUT.posters.abs.z);
    root.add(poster);
    if (poster.userData.posterMesh) posterMeshes.push(poster.userData.posterMesh);
  });

  const bookshelf = createBookshelf(THREE, mats);
  bookshelf.name = 'bookshelf';
  placeProp(bookshelf, LAYOUT.bookshelf, registry, ctx);
  root.add(bookshelf);

  const cabinet = createCabinet(THREE, mats);
  cabinet.name = 'cabinet';
  placeProp(cabinet, LAYOUT.cabinet, registry, ctx);
  root.add(cabinet);

  const sofa = createSofa(THREE, mats);
  sofa.name = 'sofa';
  placeProp(sofa, LAYOUT.sofa, registry, ctx);
  root.add(sofa);

  const coffeeTable = createCoffeeTable(THREE, mats);
  coffeeTable.name = 'coffeeTable';
  placeProp(coffeeTable, LAYOUT.coffeeTable, registry, ctx);
  root.add(coffeeTable);

  createGroundRing(THREE, root, mats);
  createExteriorLights(THREE, root, mats);

  // ── Lighting ──
  const ambient = new THREE.AmbientLight(0xc0b8a0, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff8e8, 1.3);
  sun.position.set(12, 20, 12);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -12;
  sc.right = sc.top = 12;
  sc.near = 0.5;
  sc.far = 60;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x507090, 0.3);
  fill.position.set(-12, 6, -12);
  scene.add(fill);

  const windowLight = new THREE.DirectionalLight(0xa8d4f0, 0.45);
  windowLight.position.set(-2.6, 6, -8);
  windowLight.target.position.set(-2.6, 2, DECOR_Z);
  scene.add(windowLight);
  scene.add(windowLight.target);

  const lampOffset = lamp.userData.lampLightOffset || { x: 0.56, y: 1.15, z: 0 };
  const lampPL = new THREE.PointLight(0xffeeb0, 2.2, 5);
  lampPL.position.set(lampOffset.x, lampOffset.y, lampOffset.z);
  lamp.add(lampPL);

  const lights = { sun, fill, lamp: lampPL, ambient, windowLight };
  const clickables = [...trophyMeshes, ...posterMeshes];

  let qualityPreset = 'medium';
  let dayNightHour = 12;
  let baseSunIntensity = 1.3;

  function setDayNight(hour) {
    dayNightHour = hour;
    const h = ((hour % 24) + 24) % 24;

    if (h >= 5 && h < 9) {
      sun.color.setHex(0xffe8c8);
      baseSunIntensity = 1.0;
      ambient.color.setHex(0xc8b8a0);
      ambient.intensity = 0.55;
      windowLight.intensity = 0.35;
      lampPL.intensity = 0.8;
      scene.background?.setHex(0x2a3848);
      if (scene.fog) scene.fog.color.setHex(0x2a3848);
    } else if (h >= 9 && h < 17) {
      sun.color.setHex(0xfff8e8);
      baseSunIntensity = 1.35;
      ambient.color.setHex(0xc0b8a0);
      ambient.intensity = 0.6;
      windowLight.intensity = 0.5;
      lampPL.intensity = 0.4;
      scene.background?.setHex(0x1a2832);
      if (scene.fog) scene.fog.color.setHex(0x1a2832);
    } else if (h >= 17 && h < 21) {
      sun.color.setHex(0xffa860);
      baseSunIntensity = 0.85;
      ambient.color.setHex(0xb09070);
      ambient.intensity = 0.45;
      windowLight.intensity = 0.25;
      lampPL.intensity = 1.6;
      scene.background?.setHex(0x281e18);
      if (scene.fog) scene.fog.color.setHex(0x281e18);
    } else {
      sun.color.setHex(0x6080a8);
      baseSunIntensity = 0.25;
      ambient.color.setHex(0x405068);
      ambient.intensity = 0.35;
      windowLight.intensity = 0.08;
      lampPL.intensity = 2.8;
      scene.background?.setHex(0x0e1418);
      if (scene.fog) scene.fog.color.setHex(0x0e1418);
    }

    _applyQualityLights();
  }

  function _applyQualityLights() {
    const mult = qualityPreset === 'low' ? 0.7 : qualityPreset === 'high' ? 1.2 : 1.0;
    sun.intensity = baseSunIntensity * mult;

    const emissiveBase = qualityPreset === 'cinematic' ? 0.55 : 0.35;
    screenMeshes.forEach((m) => {
      if (m.material?.emissiveIntensity !== undefined) {
        m.material.emissiveIntensity = emissiveBase * mult;
      }
    });

    const nightGlow = dayNightHour >= 17 || dayNightHour < 5;
    lampShades.forEach((m) => {
      if (m.material?.emissive) {
        m.material.emissive.setHex(nightGlow ? 0x806010 : 0x000000);
        m.material.emissiveIntensity = nightGlow ? 0.3 : 0;
      }
    });
  }

  function applyQuality(preset) {
    qualityPreset = preset;
    const sizes = { low: 512, medium: 1024, high: 2048, cinematic: 2048 };
    const size = sizes[preset] ?? 1024;
    sun.shadow.mapSize.set(size, size);
    _applyQualityLights();
  }

  setDayNight(12);

  return {
    root,
    anchors,
    layout: LAYOUT,
    registry,
    lights,
    clickables,
    trophyMeshes,
    posterMeshes,
    screenMeshes,
    awardCats: AWARD_CATS,
    setDayNight,
    applyQuality,
  };
}
