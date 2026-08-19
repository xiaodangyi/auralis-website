const freeze = (value) => Object.freeze(value);

export const CATEGORY_DEFINITIONS = freeze([
  freeze({ id: "pistol", label: "手枪", shortcut: 1, slot: "secondary" }),
  freeze({ id: "smg", label: "冲锋枪", shortcut: 2, slot: "primary" }),
  freeze({ id: "shotgun", label: "霰弹枪", shortcut: 3, slot: "primary" }),
  freeze({ id: "rifle", label: "步枪", shortcut: 4, slot: "primary" }),
  freeze({ id: "sniper", label: "狙击枪", shortcut: 5, slot: "primary" }),
  freeze({ id: "heavy", label: "重型武器", shortcut: 6, slot: "primary" }),
  freeze({ id: "armor", label: "护甲与工具", shortcut: 7, slot: "equipment" }),
  freeze({ id: "grenade", label: "投掷物", shortcut: 8, slot: "grenade" }),
]);

export const CATEGORY_ORDER = freeze(CATEGORY_DEFINITIONS.map(({ id }) => id));
export const CATEGORIES = freeze(
  Object.fromEntries(CATEGORY_DEFINITIONS.map((category) => [category.id, category])),
);

const firearm = (config) =>
  freeze({
    kind: "firearm",
    pellets: 1,
    automatic: false,
    burst: false,
    burstSize: 1,
    burstDelay: 0,
    scoped: false,
    zoomFov: null,
    armorPenetration: 0.65,
    damageFalloff: 0.72,
    equipTime: 0.45,
    moveSpeed: 1,
    recoilRecovery: 7,
    ...config,
  });

/**
 * Timing values are seconds, distances are world units, and spread values are
 * radians. Recoil is a camera kick scalar consumed by the player controller.
 */
export const WEAPONS = freeze({
  p9: firearm({
    id: "p9",
    name: "P9",
    category: "pistol",
    slot: "secondary",
    price: 0,
    damage: 25,
    headMultiplier: 3.5,
    fireInterval: 0.22,
    magazine: 15,
    reserve: 60,
    reload: 1.75,
    spread: 0.008,
    movementSpread: 0.023,
    recoil: 0.72,
    range: 58,
    killReward: 300,
    armorPenetration: 0.58,
    damageFalloff: 0.7,
    description: "均衡可靠的默认半自动手枪",
    accent: "#a9b3ba",
  }),
  hammer: firearm({
    id: "hammer",
    name: "铁锤",
    category: "pistol",
    slot: "secondary",
    price: 700,
    damage: 48,
    headMultiplier: 3.15,
    fireInterval: 0.42,
    magazine: 7,
    reserve: 35,
    reload: 2.15,
    spread: 0.011,
    movementSpread: 0.038,
    recoil: 1.75,
    range: 72,
    killReward: 300,
    armorPenetration: 0.82,
    damageFalloff: 0.76,
    equipTime: 0.55,
    description: "低射速、高爆头收益的大威力手枪",
    accent: "#d88a39",
  }),
  b18: firearm({
    id: "b18",
    name: "B18",
    category: "pistol",
    slot: "secondary",
    price: 950,
    damage: 18,
    headMultiplier: 3.1,
    fireInterval: 0.075,
    magazine: 24,
    reserve: 96,
    reload: 2.25,
    spread: 0.014,
    movementSpread: 0.034,
    recoil: 0.48,
    range: 42,
    automatic: true,
    killReward: 300,
    armorPenetration: 0.54,
    damageFalloff: 0.6,
    description: "大弹匣自动手枪，擅长贴身压制",
    accent: "#d4c458",
  }),
  stinger9: firearm({
    id: "stinger9",
    name: "蜂刺-9",
    category: "smg",
    slot: "primary",
    price: 1250,
    damage: 22,
    headMultiplier: 3.2,
    fireInterval: 0.064,
    magazine: 32,
    reserve: 128,
    reload: 2.05,
    spread: 0.013,
    movementSpread: 0.021,
    recoil: 0.52,
    range: 48,
    automatic: true,
    killReward: 600,
    armorPenetration: 0.57,
    damageFalloff: 0.62,
    equipTime: 0.38,
    moveSpeed: 1.04,
    description: "高射速、低后坐力的灵活冲锋枪",
    accent: "#f2c14e",
  }),
  tempest45: firearm({
    id: "tempest45",
    name: "暴风-45",
    category: "smg",
    slot: "primary",
    price: 1650,
    damage: 30,
    headMultiplier: 3.05,
    fireInterval: 0.085,
    magazine: 22,
    reserve: 88,
    reload: 2.3,
    spread: 0.012,
    movementSpread: 0.027,
    recoil: 0.73,
    range: 54,
    automatic: true,
    killReward: 600,
    armorPenetration: 0.68,
    damageFalloff: 0.68,
    moveSpeed: 1.02,
    description: "弹匣较小，但单发威力更强",
    accent: "#4fb6a4",
  }),
  breacher: firearm({
    id: "breacher",
    name: "破门者",
    category: "shotgun",
    slot: "primary",
    price: 1500,
    damage: 14,
    headMultiplier: 1.35,
    fireInterval: 0.88,
    magazine: 6,
    reserve: 30,
    reload: 0.58,
    spread: 0.062,
    movementSpread: 0.035,
    recoil: 2.25,
    range: 24,
    pellets: 9,
    killReward: 900,
    armorPenetration: 0.48,
    damageFalloff: 0.42,
    equipTime: 0.65,
    description: "泵动霰弹枪，近距离可造成毁灭性伤害",
    accent: "#cf6b44",
  }),
  ironRain: firearm({
    id: "ironRain",
    name: "铁雨",
    category: "shotgun",
    slot: "primary",
    price: 2200,
    damage: 10,
    headMultiplier: 1.3,
    fireInterval: 0.28,
    magazine: 10,
    reserve: 40,
    reload: 2.85,
    spread: 0.068,
    movementSpread: 0.04,
    recoil: 1.32,
    range: 22,
    pellets: 8,
    automatic: true,
    killReward: 900,
    armorPenetration: 0.45,
    damageFalloff: 0.4,
    moveSpeed: 0.96,
    description: "连续火力出色的半自动霰弹枪",
    accent: "#8a9b87",
  }),
  v47: firearm({
    id: "v47",
    name: "V47",
    category: "rifle",
    slot: "primary",
    price: 2750,
    damage: 36,
    headMultiplier: 3.05,
    fireInterval: 0.1,
    magazine: 30,
    reserve: 90,
    reload: 2.55,
    spread: 0.009,
    movementSpread: 0.033,
    recoil: 1.18,
    range: 92,
    automatic: true,
    killReward: 300,
    armorPenetration: 0.78,
    damageFalloff: 0.8,
    moveSpeed: 0.95,
    description: "高伤害步枪，连续射击需要主动压枪",
    accent: "#bf7046",
  }),
  r4: firearm({
    id: "r4",
    name: "R4",
    category: "rifle",
    slot: "primary",
    price: 3000,
    damage: 31,
    headMultiplier: 3.15,
    fireInterval: 0.086,
    magazine: 30,
    reserve: 90,
    reload: 2.35,
    spread: 0.007,
    movementSpread: 0.029,
    recoil: 0.86,
    range: 98,
    automatic: true,
    killReward: 300,
    armorPenetration: 0.74,
    damageFalloff: 0.84,
    description: "射速快、弹道稳定的中距离步枪",
    accent: "#547792",
  }),
  fam3: firearm({
    id: "fam3",
    name: "FAM-3",
    category: "rifle",
    slot: "primary",
    price: 2050,
    damage: 29,
    headMultiplier: 3.1,
    fireInterval: 0.075,
    magazine: 27,
    reserve: 81,
    reload: 2.45,
    spread: 0.008,
    movementSpread: 0.031,
    recoil: 0.78,
    range: 86,
    burst: true,
    burstSize: 3,
    burstDelay: 0.24,
    killReward: 300,
    armorPenetration: 0.69,
    damageFalloff: 0.78,
    description: "价格亲民、精准的三连发步枪",
    accent: "#6d8b52",
  }),
  cavalier: firearm({
    id: "cavalier",
    name: "轻骑兵",
    category: "sniper",
    slot: "primary",
    price: 1900,
    damage: 68,
    headMultiplier: 2,
    fireInterval: 0.72,
    magazine: 10,
    reserve: 30,
    reload: 2.7,
    spread: 0.004,
    movementSpread: 0.055,
    recoil: 1.65,
    range: 140,
    scoped: true,
    zoomFov: 38,
    killReward: 300,
    armorPenetration: 0.78,
    damageFalloff: 0.9,
    moveSpeed: 0.98,
    description: "轻便的侦察狙击枪，适合快速转点",
    accent: "#55a5a0",
  }),
  thunder: firearm({
    id: "thunder",
    name: "雷鸣",
    category: "sniper",
    slot: "primary",
    price: 4750,
    damage: 112,
    headMultiplier: 2.25,
    fireInterval: 1.38,
    magazine: 5,
    reserve: 20,
    reload: 3.45,
    spread: 0.002,
    movementSpread: 0.075,
    recoil: 3.1,
    range: 175,
    scoped: true,
    zoomFov: 24,
    killReward: 100,
    armorPenetration: 0.96,
    damageFalloff: 0.94,
    equipTime: 0.8,
    moveSpeed: 0.82,
    description: "昂贵而沉重，命中躯干即可造成致命威胁",
    accent: "#d7d6cf",
  }),
  bastion: firearm({
    id: "bastion",
    name: "堡垒",
    category: "heavy",
    slot: "primary",
    price: 3600,
    damage: 32,
    headMultiplier: 2.75,
    fireInterval: 0.095,
    magazine: 75,
    reserve: 150,
    reload: 5.25,
    spread: 0.016,
    movementSpread: 0.05,
    recoil: 0.98,
    range: 84,
    automatic: true,
    killReward: 300,
    armorPenetration: 0.7,
    damageFalloff: 0.76,
    equipTime: 0.9,
    moveSpeed: 0.78,
    description: "大容量弹匣，适合持续封锁通道",
    accent: "#7e846d",
  }),
  volcano: firearm({
    id: "volcano",
    name: "火山",
    category: "heavy",
    slot: "primary",
    price: 4200,
    damage: 25,
    headMultiplier: 2.8,
    fireInterval: 0.052,
    magazine: 100,
    reserve: 200,
    reload: 6.4,
    spread: 0.019,
    movementSpread: 0.058,
    recoil: 0.72,
    range: 76,
    automatic: true,
    killReward: 300,
    armorPenetration: 0.64,
    damageFalloff: 0.7,
    equipTime: 1,
    moveSpeed: 0.74,
    description: "极高射速，以漫长换弹换取压倒性火力",
    accent: "#e1553d",
  }),
});

const grenade = (config) =>
  freeze({
    kind: "grenade",
    category: "grenade",
    slot: "grenade",
    maxCarry: 1,
    fuse: 2.4,
    throwSpeed: 17,
    radius: 7,
    duration: 0,
    damage: 0,
    ...config,
  });

export const GRENADES = freeze({
  fragCube: grenade({
    id: "fragCube",
    name: "破片方块",
    price: 300,
    fuse: 2.25,
    radius: 7.5,
    damage: 86,
    effect: "explosion",
    description: "爆炸并向周围迸射体素碎片",
    accent: "#df6a42",
  }),
  flashCube: grenade({
    id: "flashCube",
    name: "闪光方块",
    price: 200,
    fuse: 1.65,
    radius: 12,
    duration: 3.4,
    effect: "flash",
    description: "短暂遮蔽视野并压低环境声音",
    accent: "#f0e9c9",
  }),
  smokeCube: grenade({
    id: "smokeCube",
    name: "烟雾方块",
    price: 300,
    fuse: 1.8,
    radius: 6.5,
    duration: 15,
    effect: "smoke",
    description: "生成可遮挡视线的体素烟幕",
    accent: "#82909b",
  }),
  incendiaryCube: grenade({
    id: "incendiaryCube",
    name: "燃烧方块",
    price: 450,
    fuse: 1.2,
    radius: 5.5,
    duration: 7,
    damage: 12,
    tickInterval: 0.5,
    effect: "fire",
    description: "在地面形成短时间持续伤害区域",
    accent: "#f09a3e",
  }),
});

const equipment = (config) =>
  freeze({
    kind: "equipment",
    category: "armor",
    slot: "equipment",
    ...config,
  });

export const EQUIPMENT = freeze({
  fiberArmor: equipment({
    id: "fiberArmor",
    name: "纤维护甲",
    price: 650,
    armor: 100,
    helmet: false,
    description: "吸收躯干部位受到的部分伤害",
    accent: "#5aa37a",
  }),
  compositeArmor: equipment({
    id: "compositeArmor",
    name: "复合护甲",
    price: 1000,
    armor: 100,
    helmet: true,
    description: "完整护甲与头部防护",
    accent: "#4f7f9d",
  }),
  disarmKit: equipment({
    id: "disarmKit",
    name: "应急护板",
    price: 400,
    armor: 45,
    helmet: false,
    description: "低价补充护甲，适合复活后快速重新投入战斗",
    accent: "#e2bd55",
  }),
});

export const WEAPON_LIST = freeze(Object.values(WEAPONS));
export const GRENADE_LIST = freeze(Object.values(GRENADES));
export const EQUIPMENT_LIST = freeze(Object.values(EQUIPMENT));
export const SHOP_ITEMS = freeze([
  ...WEAPON_LIST,
  ...EQUIPMENT_LIST,
  ...GRENADE_LIST,
]);

export const SHOP_ITEM_BY_ID = freeze(
  Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, item])),
);

export const DEFAULT_LOADOUT = freeze({
  primary: null,
  secondary: "p9",
  melee: "fieldKnife",
  grenades: freeze([]),
  armor: 0,
  helmet: false,
});

export function getCategory(categoryId) {
  return CATEGORIES[categoryId] ?? null;
}

export function getShopItem(itemId) {
  return SHOP_ITEM_BY_ID[itemId] ?? null;
}

export function getWeapon(weaponId) {
  return WEAPONS[weaponId] ?? null;
}

export function getItemsByCategory(categoryId) {
  return SHOP_ITEMS.filter((item) => item.category === categoryId);
}

export function isFirearm(itemOrId) {
  const item = typeof itemOrId === "string" ? getShopItem(itemOrId) : itemOrId;
  return item?.kind === "firearm";
}

export function isGrenade(itemOrId) {
  const item = typeof itemOrId === "string" ? getShopItem(itemOrId) : itemOrId;
  return item?.kind === "grenade";
}

export function createWeaponState(weaponId) {
  const weapon = getWeapon(weaponId);
  if (!weapon) {
    throw new RangeError(`Unknown weapon: ${weaponId}`);
  }

  return {
    id: weapon.id,
    ammo: weapon.magazine,
    reserve: weapon.reserve,
    reloading: false,
    reloadEndsAt: 0,
    lastShotAt: -Infinity,
    burstRemaining: 0,
    recoilIndex: 0,
  };
}

export function calculateShotDamage(
  weaponOrId,
  { distance = 0, hitZone = "body", armored = false } = {},
) {
  const weapon =
    typeof weaponOrId === "string" ? getWeapon(weaponOrId) : weaponOrId;

  if (!isFirearm(weapon) || distance > weapon.range) {
    return 0;
  }

  const zoneMultiplier =
    hitZone === "head" ? weapon.headMultiplier : hitZone === "legs" ? 0.75 : 1;
  const normalizedDistance = Math.max(0, distance) / Math.max(1, weapon.range);
  const falloff = 1 - normalizedDistance * (1 - weapon.damageFalloff);
  const armorMultiplier = armored ? weapon.armorPenetration : 1;

  return Math.max(0, weapon.damage * zoneMultiplier * falloff * armorMultiplier);
}

export function canPurchase(itemOrId, funds, context = {}) {
  const item = typeof itemOrId === "string" ? getShopItem(itemOrId) : itemOrId;
  const {
    buyPhase = true,
    inBuyZone = true,
    team = null,
    grenadeCount = 0,
  } = context;

  if (!item || !buyPhase || !inBuyZone || funds < item.price) {
    return false;
  }
  if (item.team && team && item.team !== team) {
    return false;
  }
  if (item.kind === "grenade" && grenadeCount >= item.maxCarry) {
    return false;
  }
  return true;
}

