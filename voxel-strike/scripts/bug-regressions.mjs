import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { canPurchase, createWeaponState, getShopItem } from "../src/weapons.js";

const source = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
const classStart = source.indexOf("class VoxelStrikeGame");
assert.notEqual(classStart, -1, "VoxelStrikeGame class must exist");

const openingBrace = source.indexOf("{", classStart);
let depth = 0;
let classEnd = -1;
for (let index = openingBrace; index < source.length; index += 1) {
  if (source[index] === "{") depth += 1;
  if (source[index] === "}") depth -= 1;
  if (depth === 0) {
    classEnd = index + 1;
    break;
  }
}
assert.notEqual(classEnd, -1, "VoxelStrikeGame class must be parseable");

const classSource = source.slice(classStart, classEnd);
const dom = {
  damageVignette: { classList: { add() {}, remove() {} } },
  pauseMenu: { hidden: true },
  buyMenu: { hidden: true },
  scoreboard: { hidden: true },
  sensitivityInput: { value: "1" },
  sensitivityValue: { value: "1.0x", textContent: "1.0x" },
  volumeInput: { value: "0.55" },
  difficultySelect: { value: "normal" },
};
const VoxelStrikeGame = new Function(
  "THREE",
  "dom",
  "clamp",
  "getWeapon",
  "CATEGORY_DEFINITIONS",
  "createWeaponState",
  "getShopItem",
  "canPurchase",
  "nowSeconds",
  "RESPAWN_DELAY",
  "KILL_TARGET",
  `return ${classSource}`,
)(THREE, dom, (value, min, max) => Math.min(max, Math.max(min, value)), () => null, [], createWeaponState, getShopItem, canPurchase, () => 10, 3, 100);

globalThis.document = {
  pointerLockElement: null,
  exitPointerLock() {},
  body: {
    classList: {
      toggle(_name, active) {
        this.active = active;
      },
    },
  },
};

const failures = [];
const check = (name, probe) => {
  try {
    probe();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
};

check("pointer-lock fallback follows mouse movement", () => {
  const lookGame = Object.create(VoxelStrikeGame.prototype);
  const canvas = {};
  lookGame.renderer = { domElement: canvas };
  lookGame.paused = false;
  lookGame.started = true;
  lookGame.shopOpen = false;
  lookGame.scoreboardOpen = false;
  lookGame.phase = "live";
  lookGame.player = { alive: true };
  lookGame.settings = { sensitivity: 1 };
  lookGame.mouse = { hasPointerPosition: true, lastClientX: 20, lastClientY: 20 };
  lookGame.pointerLockUnavailable = true;
  lookGame.yaw = 0;
  lookGame.pitch = 0;
  lookGame.onMouseMove({ target: {}, movementX: 0, movementY: 0, clientX: 1300, clientY: 0 });
  assert.ok(Math.abs(lookGame.yaw) >= Math.PI * 2, "one screen of fallback mouse movement must cover 360 degrees");
  assert.notEqual(lookGame.pitch, 0, "fallback mouse movement must rotate pitch without pointer lock");
});

check("gameplay hides the system cursor globally", () => {
  const cursorGame = Object.create(VoxelStrikeGame.prototype);
  Object.assign(cursorGame, { started: true, paused: false, shopOpen: false, scoreboardOpen: false, phase: "live" });
  cursorGame.syncCursorMode();
  assert.equal(document.body.classList.active, true, "gameplay must hide the cursor");
  cursorGame.shopOpen = true;
  cursorGame.syncCursorMode();
  assert.equal(document.body.classList.active, false, "menus must restore the cursor");
});

check("spectator mode hides the first-person weapon", () => {
  const spectatorGame = Object.create(VoxelStrikeGame.prototype);
  spectatorGame.player = {
    id: "player",
    name: "player",
    team: "attack",
    alive: true,
    health: 100,
    armor: 0,
    deaths: 0,
    kills: 0,
    position: new THREE.Vector3(),
    hasBomb: true,
  };
  spectatorGame.weaponRoot = { visible: true };
  spectatorGame.mouse = { firing: true, aiming: true, hasPointerPosition: true };
  spectatorGame.objective = { state: "carried", carrier: "player" };
  spectatorGame.bots = [{ id: "attack-0", team: "attack", alive: true }];
  spectatorGame.addKillFeed = () => {};
  spectatorGame.spawnBurst = () => {};
  spectatorGame.toast = () => {};
  spectatorGame.killActor(spectatorGame.player, null, { id: "p9" }, "body");
  assert.equal(spectatorGame.weaponRoot.visible, false, "first-person weapon must hide when spectator mode starts");
});

check("attacker bots choose independent routes", () => {
  const navigationGame = Object.create(VoxelStrikeGame.prototype);
  const playerPosition = new THREE.Vector3(7, 0, 7);
  const siteA = new THREE.Vector3(20, 0, -10);
  const siteB = new THREE.Vector3(20, 0, 10);
  navigationGame.player = { alive: true, position: playerPosition };
  navigationGame.objective = { state: "carried", carrier: "player", site: null };
  navigationGame.map = { sites: { A: { position: siteA }, B: { position: siteB } } };
  const attacker = { id: "attack-1", team: "attack", roleIndex: 1 };
  assert.equal(navigationGame.getBotDestination(attacker), siteB, "attacker must advance to its assigned site while player is alive");
});

check("round tactics create varied roles and non-site objectives", () => {
  const tacticsGame = Object.create(VoxelStrikeGame.prototype);
  const siteA = new THREE.Vector3(-13.5, 0, -12.5);
  const siteB = new THREE.Vector3(13.5, 0, 12.5);
  tacticsGame.round = 2;
  tacticsGame.map = { sites: { A: { position: siteA }, B: { position: siteB } } };
  tacticsGame.objective = { state: "carried", carrier: "player", site: null };
  tacticsGame.bots = [
    ...Array.from({ length: 4 }, (_, roleIndex) => ({ id: `attack-${roleIndex}`, team: "attack", roleIndex })),
    ...Array.from({ length: 5 }, (_, roleIndex) => ({ id: `defense-${roleIndex}`, team: "defense", roleIndex })),
  ];
  tacticsGame.assignRoundTactics();

  for (const team of ["attack", "defense"]) {
    const teamBots = tacticsGame.bots.filter((bot) => bot.team === team);
    assert.ok(new Set(teamBots.map((bot) => bot.tacticRole)).size >= 3, `${team} must field at least three tactical roles`);
  }
  const allDestinations = tacticsGame.bots.flatMap((bot) => bot.tacticalRoute ?? []);
  assert.ok(
    allDestinations.some((point) => !point.equals(siteA) && !point.equals(siteB)),
    "a tactical round must include control, flank, support, or hold objectives away from bomb sites",
  );
});

check("Escape opens the sensitivity pause menu", () => {
  const pauseGame = Object.create(VoxelStrikeGame.prototype);
  Object.assign(pauseGame, {
    keys: new Set(),
    started: true,
    phase: "live",
    paused: false,
    shopOpen: false,
    scoreboardOpen: false,
    settings: { sensitivity: 1, volume: 0.55, difficulty: "normal" },
    mouse: { firing: false, aiming: false, hasPointerPosition: true },
  });
  dom.pauseMenu.hidden = true;
  pauseGame.onKeyDown({ code: "Escape", preventDefault() {} });
  assert.equal(pauseGame.paused, true, "Escape must pause gameplay directly");
  assert.equal(dom.pauseMenu.hidden, false, "Escape must reveal the settings menu");
});

check("sensitivity control updates the live value", () => {
  const settingsGame = Object.create(VoxelStrikeGame.prototype);
  settingsGame.settings = { sensitivity: 1, volume: 0.55, difficulty: "normal" };
  settingsGame.setSensitivity(1.7);
  assert.equal(settingsGame.settings.sensitivity, 1.7);
  assert.equal(dom.sensitivityInput.value, "1.7");
  assert.equal(dom.sensitivityValue.textContent, "1.7x");
});

check("shop purchase equips a primary weapon and deducts funds", () => {
  const shopGame = Object.create(VoxelStrikeGame.prototype);
  shopGame.phase = "buy";
  shopGame.player = {
    money: 3400,
    position: new THREE.Vector3(-21, 0.05, 0),
    loadout: { primary: null, secondary: "p9", grenades: [] },
    weaponStates: {},
    activeSlot: "secondary",
  };
  shopGame.map = { buyZones: { attack: { contains: () => true } } };
  shopGame.rebuildWeaponModel = () => {};
  shopGame.updateHud = () => {};
  shopGame.renderShopItems = () => {};
  shopGame.toast = () => {};
  shopGame.playTone = () => {};
  shopGame.purchase("v47");
  assert.equal(shopGame.player.loadout.primary, "v47");
  assert.equal(shopGame.player.activeSlot, "primary");
  assert.equal(shopGame.player.money, 650);
  assert.equal(shopGame.player.weaponStates.v47.ammo, 30);
});

check("buying a second primary replaces and drops the old weapon", () => {
  const shopGame = Object.create(VoxelStrikeGame.prototype);
  shopGame.phase = "buy";
  shopGame.player = {
    money: 5000,
    position: new THREE.Vector3(-21, 0.05, 0),
    loadout: { primary: "v47", secondary: "p9", grenades: [] },
    weaponStates: { v47: createWeaponState("v47"), p9: createWeaponState("p9") },
    activeSlot: "primary",
  };
  shopGame.map = { buyZones: { attack: { contains: () => true } } };
  shopGame.pickups = [];
  shopGame.scene = { add() {} };
  shopGame.rebuildWeaponModel = () => {};
  shopGame.updateHud = () => {};
  shopGame.renderShopItems = () => {};
  shopGame.toast = () => {};
  shopGame.playTone = () => {};
  shopGame.spawnWeaponPickup = (weaponId, slot) => shopGame.pickups.push({ weaponId, slot });
  shopGame.purchase("r4");
  assert.equal(shopGame.player.loadout.primary, "r4");
  assert.equal(shopGame.player.money, 2000);
  assert.equal(shopGame.pickups.length, 1);
  assert.deepEqual(shopGame.pickups[0], { weaponId: "v47", slot: "primary" });
});

check("kill mode ends at the configured target score", () => {
  const scoreGame = Object.create(VoxelStrikeGame.prototype);
  scoreGame.score = { attack: 99, defense: 12 };
  scoreGame.killTarget = 100;
  scoreGame.phase = "live";
  scoreGame.player = { team: "attack", money: 0 };
  scoreGame.round = 1;
  scoreGame.killFeed = [];
  scoreGame.endMatch = (winner) => { scoreGame.matchWinner = winner; };
  scoreGame.registerKillScore({ team: "attack" });
  assert.equal(scoreGame.score.attack, 100);
  assert.equal(scoreGame.matchWinner, "attack");
});

check("shop context keeps a small spawn-zone buffer", () => {
  const shopGame = Object.create(VoxelStrikeGame.prototype);
  shopGame.phase = "buy";
  shopGame.player = { money: 3400, position: new THREE.Vector3(-18.8, 0.05, 0), loadout: { grenades: [] } };
  shopGame.map = { buyZones: { attack: { contains: (_position, padding) => padding >= 2 } } };
  assert.equal(shopGame.purchaseContext().inBuyZone, true, "players near the spawn edge should still be able to buy");
});

check("locked shop buttons explain the purchase blocker", () => {
  const shopGame = Object.create(VoxelStrikeGame.prototype);
  shopGame.player = { money: 3400, position: new THREE.Vector3() };
  const reason = shopGame.purchaseBlockReason(getShopItem("v47"), {
    buyPhase: true,
    inBuyZone: false,
    grenadeCount: 0,
  });
  assert.equal(reason, "请返回出生区");
  assert.ok(source.includes("is-locked"), "locked buttons must remain clickable for feedback");
});

check("shop countdown does not recreate buttons under the pointer", () => {
  const start = source.indexOf("renderShopItems(force = false)");
  const end = source.indexOf("\n  purchaseContext()", start);
  const renderer = source.slice(start, end);
  assert.ok(start >= 0 && end > start, "shop renderer must be present");
  assert.ok(!renderer.match(/renderKey\s*=\s*\[[\s\S]*buyTime[\s\S]*\]\.join/), "countdown text must not participate in the item render key");
  assert.ok(renderer.indexOf("renderKey === this.shopRenderKey") < renderer.indexOf("dom.shopItems.innerHTML"), "stable shop state must return before replacing item buttons");
});

if (failures.length) throw new Error(`\n${failures.join("\n")}`);
console.log("Voxel Strike bug regressions: OK");

