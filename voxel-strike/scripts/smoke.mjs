import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import buildVoxelMap from "../src/map.js";
import {
  CATEGORY_DEFINITIONS,
  GRENADE_LIST,
  WEAPON_LIST,
  calculateShotDamage,
  canPurchase,
  getWeapon,
} from "../src/weapons.js";
import { FRAME_LIST, getFrame, weaponCompatible, addWeaponXp, abilityReady } from "../src/classes.js";

await RAPIER.init();

assert.equal(WEAPON_LIST.length, 14, "weapon catalog must contain 14 firearms");
assert.equal(GRENADE_LIST.length, 4, "grenade catalog must contain four grenade types");
assert.equal(CATEGORY_DEFINITIONS.length, 8, "shop must expose eight categories");
assert.equal(FRAME_LIST.length, 4, "combat mode must expose four original frames");
assert.equal(weaponCompatible(getFrame("bulwark"), "heavy"), true);
assert.equal(weaponCompatible(getFrame("bulwark"), "sniper"), false);
assert.equal(addWeaponXp({ xp: 920 }, 120).level, 2);
assert.equal(abilityReady(10, 9), true);

const v47 = getWeapon("v47");
assert.ok(calculateShotDamage(v47, { hitZone: "head" }) > calculateShotDamage(v47, { hitZone: "body" }));
assert.equal(canPurchase(v47, 5000, { buyPhase: true, inBuyZone: true }), true);
assert.equal(canPurchase(v47, 5000, { buyPhase: false, inBuyZone: true }), false);
assert.equal(canPurchase(v47, 5000, { buyPhase: true, inBuyZone: false }), false);

const scene = new THREE.Scene();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const map = buildVoxelMap(scene, world);

assert.ok(map.colliders.length >= 30, "voxel map must create Rapier colliders");
assert.equal(map.spawns.attack.length, 5);
assert.equal(map.spawns.defense.length, 5);
assert.ok(map.buyZones.attack.contains(map.spawns.attack[4]));
assert.ok(map.nav.findPath(map.spawns.attack[4], map.sites.A.position).length > 2, "A route must be navigable");
assert.ok(map.nav.findPath(map.spawns.attack[4], map.sites.B.position).length > 2, "B route must be navigable");

map.dispose();
world.free();

console.log("Voxel Strike smoke tests: OK");

