const freeze = (value) => Object.freeze(value);

export const FRAME_DEFINITIONS = freeze({
  assault: freeze({
    id: "assault",
    name: "突击框架",
    tag: "前线压制",
    description: "适配步枪与冲锋枪，换弹更快，击杀后短暂获得移动加速。",
    weapons: freeze(["smg", "rifle", "pistol"]),
    passive: "reload",
    ability: "冲锋脉冲",
    abilityDescription: "短时间提高移动速度与腰射稳定性。",
    color: "#f49a53",
    health: 100,
    armor: 35,
  }),
  scout: freeze({
    id: "scout",
    name: "侦猎框架",
    tag: "快速转点",
    description: "适配冲锋枪与狙击枪，静步更快，战术脉冲会标记附近敌人。",
    weapons: freeze(["smg", "sniper", "pistol"]),
    passive: "quiet",
    ability: "侦测脉冲",
    abilityDescription: "短暂显示附近敌人的方向，并刷新一次跳跃。",
    color: "#72d6d1",
    health: 90,
    armor: 25,
  }),
  bulwark: freeze({
    id: "bulwark",
    name: "壁垒框架",
    tag: "重火力",
    description: "适配霰弹枪与重型武器，拥有更高护甲，但移动较慢。",
    weapons: freeze(["shotgun", "heavy", "pistol"]),
    passive: "armor",
    ability: "硬化场",
    abilityDescription: "短时间降低受到的伤害，并生成方块护盾粒子。",
    color: "#a9b3ba",
    health: 110,
    armor: 65,
  }),
  support: freeze({
    id: "support",
    name: "支援框架",
    tag: "团队续航",
    description: "适配步枪与手枪，击杀可获得治疗脉冲，战术能力可恢复附近队友。",
    weapons: freeze(["rifle", "pistol", "smg"]),
    passive: "medic",
    ability: "修复脉冲",
    abilityDescription: "恢复自身与附近队友的生命值。",
    color: "#9fd06b",
    health: 100,
    armor: 45,
  }),
});

export const FRAME_LIST = freeze(Object.values(FRAME_DEFINITIONS));

export const DEFAULT_FRAME = "assault";

export function getFrame(frameId) {
  return FRAME_DEFINITIONS[frameId] ?? FRAME_DEFINITIONS[DEFAULT_FRAME];
}

export function weaponCompatible(frameOrId, weaponOrCategory) {
  const frame = typeof frameOrId === "string" ? getFrame(frameOrId) : frameOrId;
  const category = typeof weaponOrCategory === "string" ? weaponOrCategory : weaponOrCategory?.category;
  return Boolean(frame?.weapons?.includes(category));
}

export function xpForLevel(level) {
  return Math.max(0, (Number(level) - 1) * 1000);
}

export function weaponLevel(progress = {}) {
  return Math.max(1, Math.floor(Math.max(0, Number(progress.xp) || 0) / 1000) + 1);
}

export function addWeaponXp(progress = {}, amount = 0) {
  const xp = Math.max(0, (Number(progress.xp) || 0) + Math.max(0, Number(amount) || 0));
  return { xp, level: weaponLevel({ xp }) };
}

export function abilityReady(now, cooldownEndsAt) {
  return Number(now) >= Number(cooldownEndsAt || 0);
}

