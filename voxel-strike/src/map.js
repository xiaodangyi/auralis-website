import * as THREE from 'three';
import * as RapierModule from '@dimforge/rapier3d-compat';
import PathFindingModule from 'pathfinding';

/**
 * Original voxel-industrial map used by the game prototype.
 *
 * The builder deliberately owns no game state. It creates a render group,
 * fixed Rapier colliders (when Rapier has already been initialised), and a
 * small grid navigation facade that is convenient for both players and bots.
 */

const RAPIER = RapierModule.default ?? RapierModule;
const PF = PathFindingModule?.default ?? PathFindingModule;

const WORLD = Object.freeze({
  width: 58,
  depth: 46,
  minX: -29,
  maxX: 29,
  minZ: -23,
  maxZ: 23,
  floorTop: 0,
  wallHeight: 4.5,
});

const COLORS = Object.freeze({
  floor: 0x27333a,
  floorInset: 0x34434a,
  road: 0x1c252b,
  roadStripe: 0xd69f3b,
  wall: 0x4c5b60,
  wallEdge: 0x718287,
  warehouse: 0x8f5f45,
  warehouseDark: 0x533c36,
  warehouseTrim: 0xd3944d,
  containerBlue: 0x315b77,
  containerRed: 0x943e42,
  containerGreen: 0x466c58,
  crate: 0xb07b43,
  crateDark: 0x78502f,
  metal: 0x74828a,
  metalDark: 0x3d4b53,
  hazard: 0xd8a52d,
  siteA: 0xf08a54,
  siteB: 0x56c3cf,
  cyan: 0x5fe0d0,
  white: 0xe8f0ec,
});

const UP = new THREE.Vector3(0, 1, 0);

function v3(x = 0, y = 0, z = 0) {
  return new THREE.Vector3(x, y, z);
}

function boxKey(size) {
  return `${size.x}|${size.y}|${size.z}`;
}

function createMaterial(cache, color, options = {}) {
  const key = `${color}|${options.transparent ? 1 : 0}|${options.opacity ?? 1}|${options.emissive ?? 0}`;
  if (cache.has(key)) return cache.get(key);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.78,
    metalness: options.metalness ?? 0.05,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    depthWrite: options.depthWrite ?? true,
  });
  cache.set(key, material);
  return material;
}

function createBoxMesh(size, material, x, y, z, parent, userData = {}) {
  const key = boxKey(size);
  let geometry = parent.userData.__geometryCache?.get(key);
  if (!geometry) {
    if (!parent.userData.__geometryCache) parent.userData.__geometryCache = new Map();
    geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    parent.userData.__geometryCache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  Object.assign(mesh.userData, userData);
  parent.add(mesh);
  return mesh;
}

function addLine(parent, material, start, end, thickness = 0.05) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  const mesh = createBoxMesh(v3(thickness, thickness, length), material, 0, 0, 0, parent, {
    mapKind: 'trim',
  });
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
  return mesh;
}

function addRapierBox(world, position, size, meta = {}) {
  if (!world || typeof world.createCollider !== 'function') return null;
  try {
    if (!RAPIER?.ColliderDesc?.cuboid) return null;
    const desc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setTranslation(position.x, position.y, position.z);
    if (typeof desc.setFriction === 'function') desc.setFriction(meta.friction ?? 0.82);
    if (typeof desc.setRestitution === 'function') desc.setRestitution(meta.restitution ?? 0.05);
    const collider = world.createCollider(desc);
    if (collider && typeof collider.setEnabled === 'function') collider.setEnabled(true);
    return collider;
  } catch {
    // Rapier's WASM must be initialised before descriptors can be constructed.
    // The render map and pure-JS navigation remain useful during a loading frame.
    return null;
  }
}

function toBounds(position, size) {
  return {
    minX: position.x - size.x / 2,
    maxX: position.x + size.x / 2,
    minZ: position.z - size.z / 2,
    maxZ: position.z + size.z / 2,
  };
}

function pointInBounds(point, bounds, padding = 0) {
  return point.x >= bounds.minX - padding && point.x <= bounds.maxX + padding
    && point.z >= bounds.minZ - padding && point.z <= bounds.maxZ + padding;
}

function makeZone(id, position, size, label) {
  const bounds = toBounds(position, size);
  return {
    id,
    label,
    position: position.clone(),
    size: size.clone(),
    bounds,
    contains(point, padding = 0) {
      const p = point?.isVector3 ? point : v3(point?.x ?? 0, 0, point?.z ?? 0);
      return pointInBounds(p, bounds, padding);
    },
  };
}

function makeObstacle(id, position, size, mesh, collider, options = {}) {
  const bounds = toBounds(position, size);
  return {
    id,
    position: position.clone(),
    size: size.clone(),
    bounds,
    mesh,
    collider,
    height: size.y,
    walkable: options.walkable ?? false,
    navBlock: options.navBlock ?? true,
    kind: options.kind ?? 'cover',
  };
}

function nearestWalkable(grid, x, z, maxRadius = 8) {
  const clampX = Math.max(0, Math.min(grid.width - 1, Math.round(x)));
  const clampZ = Math.max(0, Math.min(grid.height - 1, Math.round(z)));
  if (grid.isWalkableAt(clampX, clampZ)) return [clampX, clampZ];
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const gx = clampX + dx;
        const gz = clampZ + dz;
        if (gx >= 0 && gx < grid.width && gz >= 0 && gz < grid.height && grid.isWalkableAt(gx, gz)) {
          return [gx, gz];
        }
      }
    }
  }
  return [clampX, clampZ];
}

function makeNavigation(obstacles) {
  const cellSize = 1;
  const width = Math.round((WORLD.maxX - WORLD.minX) / cellSize) + 1;
  const height = Math.round((WORLD.maxZ - WORLD.minZ) / cellSize) + 1;
  const matrix = Array.from({ length: height }, () => Array(width).fill(0));
  const toGrid = (point) => {
    const p = point?.isVector3 ? point : v3(point?.x ?? 0, 0, point?.z ?? 0);
    return [
      Math.round((p.x - WORLD.minX) / cellSize),
      Math.round((p.z - WORLD.minZ) / cellSize),
    ];
  };
  const toWorld = (gx, gz, y = WORLD.floorTop + 0.05) => v3(
    WORLD.minX + gx * cellSize,
    y,
    WORLD.minZ + gz * cellSize,
  );

  for (const obstacle of obstacles) {
    if (!obstacle.navBlock) continue;
    const min = toGrid(v3(obstacle.bounds.minX, 0, obstacle.bounds.minZ));
    const max = toGrid(v3(obstacle.bounds.maxX, 0, obstacle.bounds.maxZ));
    const minX = Math.max(0, Math.min(min[0], max[0]));
    const maxX = Math.min(width - 1, Math.max(min[0], max[0]));
    const minZ = Math.max(0, Math.min(min[1], max[1]));
    const maxZ = Math.min(height - 1, Math.max(min[1], max[1]));
    for (let gz = minZ; gz <= maxZ; gz += 1) {
      for (let gx = minX; gx <= maxX; gx += 1) matrix[gz][gx] = 1;
    }
  }

  // A few route cells are intentionally open even beside visual trim. This
  // keeps the three lanes useful to bots while retaining cover in the scene.
  const grid = new PF.Grid(width, height, matrix);
  const finder = new PF.AStarFinder({
    allowDiagonal: true,
    dontCrossCorners: true,
  });

  const findPath = (start, end, options = {}) => {
    const source = toGrid(start);
    const target = toGrid(end);
    const working = grid.clone();
    const safeStart = nearestWalkable(working, source[0], source[1]);
    const safeTarget = nearestWalkable(working, target[0], target[1]);
    const raw = finder.findPath(safeStart[0], safeStart[1], safeTarget[0], safeTarget[1], working);
    const y = options.y ?? WORLD.floorTop + 0.05;
    return raw.map(([gx, gz]) => toWorld(gx, gz, y));
  };

  const isWalkable = (point) => {
    const [gx, gz] = toGrid(point);
    return gx >= 0 && gx < width && gz >= 0 && gz < height && grid.isWalkableAt(gx, gz);
  };

  return {
    grid,
    finder,
    width,
    height,
    cellSize,
    origin: v3(WORLD.minX, WORLD.floorTop, WORLD.minZ),
    worldToGrid: toGrid,
    gridToWorld: toWorld,
    isWalkable,
    findPath,
  };
}

function makeSiteVisual(group, site, materialCache, siteColor) {
  const markerMaterial = createMaterial(materialCache, siteColor, {
    emissive: siteColor,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.82,
  });
  const ringGeometry = new THREE.RingGeometry(site.radius * 0.64, site.radius, 32);
  const ring = new THREE.Mesh(ringGeometry, markerMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(site.position.x, 0.06, site.position.z);
  ring.userData = { mapKind: 'site-marker', site: site.id, raycastable: true };
  group.add(ring);
  site.marker = ring;

  const post = createBoxMesh(v3(0.12, 2.3, 0.12), markerMaterial, site.position.x, 1.15, site.position.z, group, {
    mapKind: 'site-beacon',
    site: site.id,
    raycastable: true,
  });
  const cap = createBoxMesh(v3(0.65, 0.12, 0.65), markerMaterial, site.position.x, 2.3, site.position.z, group, {
    mapKind: 'site-beacon-cap',
    site: site.id,
    raycastable: true,
  });
  site.beacon = post;
  site.beaconCap = cap;
}

function addWarehouse(group, materialCache, addObstacle, raycastables) {
  const wallMaterial = createMaterial(materialCache, COLORS.warehouse);
  const darkMaterial = createMaterial(materialCache, COLORS.warehouseDark);
  const trimMaterial = createMaterial(materialCache, COLORS.warehouseTrim, { metalness: 0.15 });
  const center = v3(-13.5, 0, -12.5);
  const size = v3(18, 7, 10);

  const pieces = [
    { p: v3(center.x, 3.5, center.z - 5), s: v3(18, 7, 0.5), id: 'warehouse-north' },
    { p: v3(center.x - 8.75, 3.5, center.z), s: v3(0.5, 7, 10), id: 'warehouse-west' },
    { p: v3(center.x + 8.75, 3.5, center.z), s: v3(0.5, 7, 10), id: 'warehouse-east' },
    { p: v3(center.x - 6.4, 3.5, center.z + 5), s: v3(4.2, 7, 0.5), id: 'warehouse-south-left' },
    { p: v3(center.x + 6.4, 3.5, center.z + 5), s: v3(4.2, 7, 0.5), id: 'warehouse-south-right' },
    { p: v3(center.x, 7.1, center.z), s: v3(18.5, 0.35, 10.5), id: 'warehouse-roof', navBlock: false },
  ];
  for (const piece of pieces) {
    const mesh = createBoxMesh(piece.s, piece.id === 'warehouse-roof' ? darkMaterial : wallMaterial, piece.p.x, piece.p.y, piece.p.z, group, {
      mapKind: 'warehouse',
      raycastable: true,
    });
    if (piece.navBlock !== false) {
      const obstacle = addObstacle(piece.id, piece.p, piece.s, mesh, { kind: 'building' });
      if (obstacle) raycastables.push(mesh);
    }
  }
  // Vertical doorway beams and roof trusses make the warehouse read as a
  // playable building without requiring a texture atlas.
  for (const x of [-19.5, -16.2, -12.8, -9.4, -6.1]) {
    createBoxMesh(v3(0.22, 7.4, 0.22), trimMaterial, x, 3.7, -7.35, group, { mapKind: 'warehouse-truss', raycastable: true });
  }
  for (const x of [-20.5, -6.5]) {
    createBoxMesh(v3(0.4, 0.45, 10), trimMaterial, x, 7.25, center.z, group, { mapKind: 'warehouse-truss', raycastable: true });
  }
  createBoxMesh(v3(6.5, 0.22, 0.35), trimMaterial, center.x, 1.35, center.z + 5.2, group, { mapKind: 'site-threshold', raycastable: true });
  return { center, size };
}

function addLoadingYard(group, materialCache, addObstacle, raycastables) {
  const materials = [
    createMaterial(materialCache, COLORS.containerBlue, { metalness: 0.2 }),
    createMaterial(materialCache, COLORS.containerRed, { metalness: 0.2 }),
    createMaterial(materialCache, COLORS.containerGreen, { metalness: 0.2 }),
  ];
  const center = v3(13.5, 0, 12.5);
  const defs = [
    { id: 'yard-container-blue', p: v3(8.6, 1.45, 15.2), s: v3(8, 2.9, 3.1), m: materials[0] },
    { id: 'yard-container-red', p: v3(18.3, 1.45, 15.2), s: v3(8, 2.9, 3.1), m: materials[1] },
    { id: 'yard-container-green', p: v3(22.8, 1.45, 6.2), s: v3(3.1, 2.9, 11), m: materials[2] },
    { id: 'yard-shed', p: v3(8.6, 2.1, 7.1), s: v3(7.5, 4.2, 3.2), m: materials[1] },
  ];
  for (const def of defs) {
    const mesh = createBoxMesh(def.s, def.m, def.p.x, def.p.y, def.p.z, group, {
      mapKind: 'loading-yard',
      raycastable: true,
    });
    const obstacle = addObstacle(def.id, def.p, def.s, mesh, { kind: 'container' });
    if (obstacle) raycastables.push(mesh);
    // Container ribs are visual only; they remain raycastable for bullet hits.
    const ribMaterial = createMaterial(materialCache, COLORS.metal, { metalness: 0.45 });
    const ribCount = Math.max(2, Math.floor(def.s.x / 2.2));
    for (let i = 1; i < ribCount; i += 1) {
      const x = def.p.x - def.s.x / 2 + (def.s.x * i) / ribCount;
      createBoxMesh(v3(0.08, def.s.y + 0.04, def.s.z + 0.06), ribMaterial, x, def.p.y, def.p.z, group, {
        mapKind: 'container-rib',
        raycastable: true,
      });
    }
  }
  return { center };
}

function addCrate(group, materialCache, addObstacle, raycastables, id, position, size = v3(1.8, 1.8, 1.8), stacked = false) {
  const material = createMaterial(materialCache, stacked ? COLORS.crateDark : COLORS.crate);
  const mesh = createBoxMesh(size, material, position.x, position.y, position.z, group, {
    mapKind: 'crate',
    raycastable: true,
    cover: true,
  });
  const obstacle = addObstacle(id, position, size, mesh, { kind: 'crate' });
  if (obstacle) raycastables.push(mesh);
  // A thin dark cross adds readable voxel detail with no extra texture asset.
  const cross = createMaterial(materialCache, COLORS.crateDark);
  createBoxMesh(v3(size.x + 0.02, 0.08, 0.08), cross, position.x, position.y, position.z - size.z / 2 - 0.01, group, { mapKind: 'crate-marking' });
  createBoxMesh(v3(0.08, 0.08, size.z + 0.02), cross, position.x, position.y, position.z, group, { mapKind: 'crate-marking' });
  return obstacle;
}

function addCatwalk(group, materialCache, addObstacle, raycastables) {
  const steel = createMaterial(materialCache, COLORS.metal, { metalness: 0.5, roughness: 0.55 });
  const dark = createMaterial(materialCache, COLORS.metalDark, { metalness: 0.45 });
  const deckPosition = v3(1.5, 4.4, -2.3);
  const deckSize = v3(18, 0.35, 2.2);
  const deck = createBoxMesh(deckSize, steel, deckPosition.x, deckPosition.y, deckPosition.z, group, {
    mapKind: 'catwalk',
    raycastable: true,
  });
  // The deck is intentionally not a navigation blocker at ground level; its
  // supports are blockers and the game can later add a second-floor nav layer.
  const supportPositions = [-6, -1, 4, 9];
  for (const x of supportPositions) {
    const supportSize = v3(0.36, 4.4, 0.36);
    const supportPos = v3(x, 2.2, deckPosition.z);
    const support = createBoxMesh(supportSize, dark, supportPos.x, supportPos.y, supportPos.z, group, {
      mapKind: 'catwalk-support',
      raycastable: true,
    });
    const obstacle = addObstacle(`catwalk-support-${x}`, supportPos, supportSize, support, { kind: 'support' });
    if (obstacle) raycastables.push(support);
  }
  const railY = deckPosition.y + 1.0;
  createBoxMesh(v3(deckSize.x, 0.16, 0.16), steel, deckPosition.x, railY, deckPosition.z - deckSize.z / 2, group, { mapKind: 'catwalk-rail', raycastable: true });
  createBoxMesh(v3(deckSize.x, 0.16, 0.16), steel, deckPosition.x, railY, deckPosition.z + deckSize.z / 2, group, { mapKind: 'catwalk-rail', raycastable: true });
  for (const x of [-7.2, -2.4, 2.4, 7.2, 10.2]) {
    createBoxMesh(v3(0.14, 1.0, 0.14), steel, x, railY - 0.5, deckPosition.z - deckSize.z / 2, group, { mapKind: 'catwalk-rail', raycastable: true });
    createBoxMesh(v3(0.14, 1.0, 0.14), steel, x, railY - 0.5, deckPosition.z + deckSize.z / 2, group, { mapKind: 'catwalk-rail', raycastable: true });
  }
  // A block stair is a visual route up to the platform.
  for (let i = 0; i < 5; i += 1) {
    const stepSize = v3(2.5, 0.35 * (i + 1), 1.1);
    const stepPos = v3(11.5 + i * 0.72, stepSize.y / 2, deckPosition.z + 1.6 - i * 0.25);
    const step = createBoxMesh(stepSize, dark, stepPos.x, stepPos.y, stepPos.z, group, { mapKind: 'catwalk-stair', raycastable: true });
    const obstacle = addObstacle(`catwalk-step-${i}`, stepPos, stepSize, step, { kind: 'stair' });
    if (obstacle) raycastables.push(step);
  }
  return { deck, position: deckPosition, size: deckSize };
}

function addHazardStripe(group, materialCache, x, z, length, horizontal = true) {
  const stripe = createMaterial(materialCache, COLORS.hazard, { roughness: 0.65 });
  const size = horizontal ? v3(length, 0.035, 0.16) : v3(0.16, 0.035, length);
  return createBoxMesh(size, stripe, x, 0.035, z, group, { mapKind: 'hazard-stripe' });
}

/**
 * Build the voxel industrial town and return all gameplay-facing map data.
 * @param {THREE.Scene} scene
 * @param {import('@dimforge/rapier3d-compat').World|null} world
 */
export function buildVoxelMap(scene, world = null) {
  if (!scene || typeof scene.add !== 'function') {
    throw new TypeError('buildVoxelMap requires a THREE.Scene-like object');
  }

  const group = new THREE.Group();
  group.name = 'VoxelIndustrialTown';
  group.userData.mapKind = 'voxel-industrial-town';
  group.userData.__geometryCache = new Map();
  scene.add(group);

  const materialCache = new Map();
  const obstacles = [];
  const colliders = [];
  const raycastables = [];
  const addObstacle = (id, position, size, mesh, options = {}) => {
    const collider = addRapierBox(world, position, size, options);
    if (collider) colliders.push(collider);
    const obstacle = makeObstacle(id, position, size, mesh, collider, options);
    obstacles.push(obstacle);
    return obstacle;
  };

  const floorMaterial = createMaterial(materialCache, COLORS.floor, { roughness: 0.92 });
  const insetMaterial = createMaterial(materialCache, COLORS.floorInset, { roughness: 0.9 });
  const roadMaterial = createMaterial(materialCache, COLORS.road, { roughness: 0.95 });
  const wallMaterial = createMaterial(materialCache, COLORS.wall);
  const wallEdgeMaterial = createMaterial(materialCache, COLORS.wallEdge, { metalness: 0.2 });

  const floorSize = v3(WORLD.width, 0.5, WORLD.depth);
  const floorPosition = v3(0, -0.25, 0);
  const floor = createBoxMesh(floorSize, floorMaterial, floorPosition.x, floorPosition.y, floorPosition.z, group, {
    mapKind: 'floor',
    raycastable: true,
  });
  addObstacle('floor', floorPosition, floorSize, floor, { kind: 'floor', navBlock: false, friction: 0.95 });
  raycastables.push(floor);

  // A slightly raised inset keeps the perimeter readable and gives the map a
  // modular voxel foundation.
  createBoxMesh(v3(WORLD.width - 2, 0.08, WORLD.depth - 2), insetMaterial, 0, 0.04, 0, group, { mapKind: 'floor-inset', raycastable: true });
  createBoxMesh(v3(42, 0.09, 6.4), roadMaterial, 0, 0.085, 0, group, { mapKind: 'central-lane', raycastable: true });
  createBoxMesh(v3(3.6, 0.09, 34), roadMaterial, 0, 0.09, 0, group, { mapKind: 'cross-lane', raycastable: true });

  const wallDefs = [
    ['boundary-west', v3(WORLD.minX, WORLD.wallHeight / 2, 0), v3(1, WORLD.wallHeight, WORLD.depth)],
    ['boundary-east', v3(WORLD.maxX, WORLD.wallHeight / 2, 0), v3(1, WORLD.wallHeight, WORLD.depth)],
    ['boundary-north', v3(0, WORLD.wallHeight / 2, WORLD.minZ), v3(WORLD.width, WORLD.wallHeight, 1)],
    ['boundary-south', v3(0, WORLD.wallHeight / 2, WORLD.maxZ), v3(WORLD.width, WORLD.wallHeight, 1)],
  ];
  for (const [id, position, size] of wallDefs) {
    const mesh = createBoxMesh(size, wallMaterial, position.x, position.y, position.z, group, { mapKind: 'boundary-wall', raycastable: true });
    addObstacle(id, position, size, mesh, { kind: 'boundary' });
    raycastables.push(mesh);
    const capSize = size.x > size.z ? v3(size.x, 0.18, size.z + 0.08) : v3(size.x + 0.08, 0.18, size.z);
    createBoxMesh(capSize, wallEdgeMaterial, position.x, WORLD.wallHeight + 0.08, position.z, group, { mapKind: 'boundary-cap', raycastable: true });
  }

  // Hazard stripes establish the three main lanes: north warehouse route,
  // central boulevard, and south loading-yard route.
  for (const x of [-23, -17, -11, -5, 1, 7, 13, 19, 25]) addHazardStripe(group, materialCache, x, -3.45, 1.25, false);
  for (const x of [-23, -17, -11, -5, 1, 7, 13, 19, 25]) addHazardStripe(group, materialCache, x, 3.45, 1.25, false);
  addHazardStripe(group, materialCache, 0, -12, 18, true);
  addHazardStripe(group, materialCache, 0, 12, 18, true);

  const warehouse = addWarehouse(group, materialCache, addObstacle, raycastables);
  const loadingYard = addLoadingYard(group, materialCache, addObstacle, raycastables);
  addCatwalk(group, materialCache, addObstacle, raycastables);

  // Cover is distributed so every approach has a choice of low and tall cover.
  const crateDefs = [
    ['crate-mid-a', v3(-5.5, 0.9, -7.2), v3(2.1, 1.8, 2.1), false],
    ['crate-mid-b', v3(1.5, 0.9, -7.2), v3(2.1, 1.8, 2.1), true],
    ['crate-mid-c', v3(5.8, 0.9, -7.2), v3(2.1, 1.8, 2.1), false],
    ['crate-center-a', v3(-6.5, 0.7, 1.6), v3(2.8, 1.4, 1.6), false],
    ['crate-center-b', v3(7.2, 0.7, 1.6), v3(2.8, 1.4, 1.6), true],
    ['crate-center-c', v3(1.2, 0.7, -4.1), v3(1.6, 1.4, 2.5), false],
    ['crate-yard-a', v3(-5.2, 0.9, 9.2), v3(2.1, 1.8, 2.1), true],
    ['crate-yard-b', v3(0.3, 0.9, 14.8), v3(2.1, 1.8, 2.1), false],
    ['crate-yard-c', v3(4.4, 0.9, 10.8), v3(2.1, 1.8, 2.1), true],
    ['crate-defense-a', v3(20.5, 0.9, -7), v3(2.1, 1.8, 2.1), false],
    ['crate-defense-b', v3(24.5, 0.9, -2.5), v3(2.1, 1.8, 2.1), true],
  ];
  for (const [id, position, size, stacked] of crateDefs) addCrate(group, materialCache, addObstacle, raycastables, id, position, size, stacked);

  // Site data is intentionally independent from the marker meshes, allowing
  // the objective system to hide or recolour markers during a round.
  const siteA = {
    id: 'A',
    name: 'Warehouse Relay',
    position: v3(-13.5, 0.08, -12.5),
    radius: 4.2,
    bounds: { minX: -17.7, maxX: -9.3, minZ: -16.7, maxZ: -8.3 },
    installPosition: v3(-13.5, 0.75, -12.5),
    color: COLORS.siteA,
  };
  const siteB = {
    id: 'B',
    name: 'Loading Relay',
    position: v3(13.5, 0.08, 12.5),
    radius: 4.2,
    bounds: { minX: 9.3, maxX: 17.7, minZ: 8.3, maxZ: 16.7 },
    installPosition: v3(13.5, 0.75, 12.5),
    color: COLORS.siteB,
  };
  siteA.contains = (point, padding = 0) => pointInBounds(point?.isVector3 ? point : v3(point?.x ?? 0, 0, point?.z ?? 0), siteA.bounds, padding);
  siteB.contains = (point, padding = 0) => pointInBounds(point?.isVector3 ? point : v3(point?.x ?? 0, 0, point?.z ?? 0), siteB.bounds, padding);
  makeSiteVisual(group, siteA, materialCache, siteA.color);
  makeSiteVisual(group, siteB, materialCache, siteB.color);

  const buyZones = {
    attack: makeZone('attack-buy', v3(-24, 0, 0), v3(7, 1.8, 17), 'ATTACK BUY'),
    defense: makeZone('defense-buy', v3(24, 0, 0), v3(7, 1.8, 17), 'DEFENSE BUY'),
  };
  for (const zone of Object.values(buyZones)) {
    const markerMaterial = createMaterial(materialCache, COLORS.cyan, { emissive: COLORS.cyan, emissiveIntensity: 0.25, transparent: true, opacity: 0.28 });
    const marker = createBoxMesh(v3(zone.size.x, 0.025, zone.size.z), markerMaterial, zone.position.x, 0.12, zone.position.z, group, {
      mapKind: 'buy-zone',
      zone: zone.id,
      raycastable: false,
    });
    zone.marker = marker;
  }

  const spawns = {
    attack: [v3(-25, 0.05, -8), v3(-25, 0.05, -3), v3(-25, 0.05, 3), v3(-25, 0.05, 8), v3(-21, 0.05, 0)],
    defense: [v3(25, 0.05, -8), v3(25, 0.05, -3), v3(25, 0.05, 3), v3(25, 0.05, 8), v3(21, 0.05, 0)],
  };
  const spawnPoints = spawns;
  const nav = makeNavigation(obstacles);

  // Keep metadata reachable from meshes for raycast and hit feedback systems.
  group.userData.obstacles = obstacles;
  group.userData.sites = { A: siteA, B: siteB };

  const dispose = () => {
    scene.remove(group);
    for (const geometry of group.userData.__geometryCache?.values?.() ?? []) geometry.dispose();
    for (const material of materialCache.values()) material.dispose();
    for (const obstacle of obstacles) {
      if (obstacle.collider && world && typeof world.removeCollider === 'function') {
        try { world.removeCollider(obstacle.collider, true); } catch { /* already removed */ }
      }
    }
  };

  return {
    group,
    worldBounds: { ...WORLD },
    floor,
    warehouse,
    loadingYard,
    sites: { A: siteA, B: siteB },
    spawns,
    spawnPoints,
    buyZones,
    obstacles,
    staticObstacleMeshes: raycastables,
    raycastables,
    colliders,
    nav,
    dispose,
  };
}

export { WORLD as VOXEL_MAP_BOUNDS };

export default buildVoxelMap;

