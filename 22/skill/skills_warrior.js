// 小工具：依照 cap 計算 STR 加成（每點 STR +0.2%）
function _getStrBonusWithCap(cap) {
  const RATE = 0.002; // 0.2%/點
  const totalSTR = (player?.baseStats?.str || 0) + (player?.coreBonus?.str || 0);
  return Math.min(Math.max(0, cap || 0), Math.max(0, totalSTR * RATE)); // 回傳小數 0 ~ cap
}
registerJobSkill('warrior', {
  job: "warrior",
  id: "warrior_slash",
  name: "斬擊（一轉）",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,
  cooldown: 10,
  mpCost: 8,
  currentCooldown: 0,

  use(monster) {
    const base = Math.max(player.totalStats.atk - monster.def, 1);
    const ratio = 0.8 + 0.10 * (this.level - 1); // 80% +10%/級
    const hits = 2;

    // 一轉：STR 上限 +100%
    const strBonus = _getStrBonusWithCap(1.0); // 0~1.0

    const dmg = Math.floor(base * ratio * (1 + strBonus)) * hits;
    monster.hp -= dmg;

    logPrepend?.(`⚔️ ${this.name} 造成 ${dmg} 傷害！（${hits} 連擊，STR加成 ${Math.round(strBonus*100)}%）`);
    spendAndCooldown(this, this.mpCost);
    return dmg;
  },

  getUpgradeCost() { return 15 + (this.level - 1) * 5; },

  getDescription() {
    const ratio = 0.8 + 0.10 * (this.level - 1);
    return `2 連擊，每擊約 ${Math.round(ratio * 100)}%｜STR加成上限+100%`;
  }
});
registerJobSkill('warrior', {
  job: "warrior",
  id: "power_strike",
  name: "奮力一擊（一轉）",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [30, 70, 120, 200],

  tiers: [
    { name: "奮力一擊（一轉）", mpCost: 12, cooldown: 18, logic: { damageMultiplier: 1.5, hits: 1, levelMultiplier: 0.08 } },
    { name: "奮力重擊（一轉）", mpCost: 16, cooldown: 18, logic: { damageMultiplier: 2.0, hits: 1, levelMultiplier: 0.09 } },
    { name: "奮力猛擊（一轉）", mpCost: 20, cooldown: 18, logic: { damageMultiplier: 2.5, hits: 1, levelMultiplier: 0.10 } },
    { name: "奮力霸擊（一轉）", mpCost: 24, cooldown: 18, logic: { damageMultiplier: 3.0, hits: 1, levelMultiplier: 0.12 } },
    { name: "奮力天崩（一轉）", mpCost: 28, cooldown: 18, logic: { damageMultiplier: 3.6, hits: 1, levelMultiplier: 0.15 } },
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic;
    this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const perHit = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const base = Math.max(player.totalStats.atk - monster.def, 1);

    // 一轉：STR 上限 +100%
    const strBonus = _getStrBonusWithCap(1.0);

    const dmg = Math.floor(base * perHit * (1 + strBonus)) * (t.logic.hits || 1);
    monster.hp -= dmg;
    logPrepend?.(`💥 ${t.name} 造成 ${dmg} 傷害！（STR加成 ${Math.round(strBonus*100)}%）`);
    spendAndCooldown(this, this.mpCost);
    return dmg;
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const t = getActiveTier(this);
    const hits = t.logic.hits || 1;
    const perHit = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const perPct = Math.round(perHit * 100);
    const totalPct = perPct * hits;
    return `${hits} 連擊，每擊約 ${perPct}%（總計約 ${totalPct}%）｜STR加成上限+100%｜進化 ${this.evolveLevels.join("/")}`;
  }
});
registerJobSkill('warrior2', {
  job: "warrior2",
  id: "sword_aura_combo",
  name: "劍氣連斬（二轉）",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  tiers: [
    { name: "劍氣連斬", mpCost: 14, cooldown: 12, logic: { damageMultiplier: 0.9, hits: 3, levelMultiplier: 0.06 } }
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic;
    this.cooldown = t.cooldown;
    const mpGrow = Number(t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    this.mpCost = (t.mpCost || 0) + mpGrow;

    const perHit = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const base   = Math.max((player.totalStats?.atk || 1) - (monster.def || 0), 1);

    // 二轉：STR 上限 +100%
    const strBonus = _getStrBonusWithCap(1.0);

    const dmg    = Math.floor(base * perHit * (1 + strBonus)) * (t.logic.hits || 1);
    monster.hp -= dmg;
    logPrepend?.(`💥 ${t.name} 造成 ${dmg} 傷害！（STR加成 ${Math.round(strBonus*100)}%）`);
    spendAndCooldown(this, this.mpCost);
    return dmg;
  },

  getDescription() {
    const t     = getActiveTier(this);
    const hits  = t.logic.hits || 1;
    const per   = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const perP  = Math.round(per * 100);
    const totP  = perP * hits;
    return `${hits} 連擊，每擊約 ${perP}%（總計約 ${totP}%）｜STR加成上限+100%`;
  }
});
registerJobSkill('warrior2', {
  job: "warrior2",
  id: "holy_blade_judgment",
  name: "聖劍審判（二轉）",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [70],

  tiers: [
    { name: "聖劍審判",   mpCost: 28, cooldown: 30, logic: { damageMultiplier: 3.0, hits: 1, levelMultiplier: 0.12 } },
    { name: "聖劍審判・極", mpCost: 32, cooldown: 30, logic: { damageMultiplier: 3.8, hits: 1, levelMultiplier: 0.14 } }
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic;
    this.cooldown = t.cooldown;
    const mpGrow = Number(t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    this.mpCost = (t.mpCost || 0) + mpGrow;

    const perHit = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const base   = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);

    // 二轉：STR 上限 +100%
    const strBonus = _getStrBonusWithCap(1.0);

    const dmg    = Math.floor(base * perHit * (1 + strBonus)) * (t.logic.hits || 1);
    monster.hp -= dmg;
    logPrepend?.(`⚡ ${t.name} 造成 ${dmg} 傷害！（STR加成 ${Math.round(strBonus*100)}%）`);
    spendAndCooldown(this, this.mpCost);
    return dmg;
  },

  getDescription() {
    const t     = getActiveTier(this);
    const hits  = t.logic.hits || 1;
    const per   = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const perP  = Math.round(per * 100);
    const totP  = perP * hits;
    return `${hits} 段重擊，每擊約 ${perP}%（總計約 ${totP}%）｜STR加成上限+100%｜進化等級：${this.evolveLevels.join("/")}`;
  }
});
registerJobSkill('warrior', {
  job: "warrior",
  id: "god_blade_rend",
  name: "鬥神裂空斬(三轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 3,

  level: 1,
  maxLevel: 20,

  cooldown: 20,
  mpCost: 24,

  logic: { damageMultiplier: 2.2, levelMultiplier: 0.10, hits: 3 },

  currentCooldown: 0,

  use(monster) {
    const L = Math.max(1, this.level|0);
    const perHitMul = (this.logic.damageMultiplier || 0) + (this.logic.levelMultiplier || 0) * (L - 1);
    const hits = Number(this.logic.hits || 1);
    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);

    // 三轉：STR 上限 +200%
    const strBonus = _getStrBonusWithCap(2.0);

    const total = Math.floor(base * perHitMul * (1 + strBonus)) * hits;
    monster.hp -= total;
    logPrepend?.(`⚔️ ${this.name}（${hits} 連擊）造成 ${total} 傷害！（STR加成 ${Math.round(strBonus*100)}%）`);

    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },

  getDescription() {
    const L = Math.max(1, this.level|0);
    const hits = Number(this.logic?.hits || 1);
    const perHitMul = (Number(this.logic?.damageMultiplier || 0) + (Number(this.logic?.levelMultiplier || 0) * (L - 1)));
    const per = Math.round(perHitMul * 100);
    const total = Math.round(perHitMul * hits * 100);
    return `${hits} 連擊，每擊約 ${per}%（總計約 ${total}%）｜STR加成上限+200%`;
  }
});
// === 四轉：瞬刃快斬（爆發技 / 無進化 / CD 120s / STR上限+200%）===
registerJobSkill('warrior', {
  job: "warrior",
  id: "blade_flash",
  name: "瞬刃快斬(四轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 4,

  // 無進化
  level: 1,
  maxLevel: 20,

  // 爆發定位：高倍率 + 長CD
  mpCost: 40,
  cooldown: 120,

  logic: {
    damageMultiplier: 6.0,  // 每段600%
    levelMultiplier: 0.20,  // 每級+20%
    hits: 5                 // 5段爆發
  },

  currentCooldown: 0,

  use(monster) {
    const L        = Math.max(1, this.level|0);
    const baseMul  = Number(this.logic?.damageMultiplier || 0);
    const lm       = Number(this.logic?.levelMultiplier || 0);
    const hits     = Number(this.logic?.hits || 1);

    // 每擊倍率（含等級成長）
    const perHitMul = baseMul + lm * (L - 1);

    // 基底傷害
    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);

    // STR 上限 +200%
    const strBonus = _getStrBonusWithCap(2.0);

    const total = Math.floor(base * perHitMul * (1 + strBonus)) * hits;

    monster.hp -= total;
    logPrepend?.(`💥 ${this.name} 爆發${hits}段，造成 ${total} 傷害！（STR加成 ${Math.round(strBonus*100)}%）`);

    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },

  getDescription() {
    const L = Math.max(1, this.level|0);
    const hits = Number(this.logic?.hits || 1);
    const perHitMul = (this.logic.damageMultiplier + this.logic.levelMultiplier * (L - 1));
    const per   = Math.round(perHitMul * 100);
    const total = Math.round(perHitMul * hits * 100);
    return `爆發技｜${hits} 連擊，每擊約 ${per}%（總計約 ${total}%）｜STR加成上限+200%｜CD ${this.cooldown}s`;
  }
});
registerJobSkill('warrior', {
  job: "warrior",
  id: "warlord_rapid_assault",
  name: "戰神迅襲(四轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 4,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [120, 150, 200],

  // 在 logic 放入每階的 strCap，最終到 4.0（= +400%）
  tiers: [
    { name: "戰神迅襲",  mpCost: 16, cooldown: 10, logic: { damageMultiplier: 1.6, hits: 2, levelMultiplier: 0.07, strCap: 2.5 } }, // +250%
    { name: "戰神速擊",  mpCost: 18, cooldown: 10, logic: { damageMultiplier: 1.9, hits: 2, levelMultiplier: 0.08, strCap: 3.0 } }, // +300%
    { name: "戰神爆斬",  mpCost: 20, cooldown: 10, logic: { damageMultiplier: 2.2, hits: 3, levelMultiplier: 0.08, strCap: 3.5 } }, // +350%
    { name: "戰神神速",  mpCost: 22, cooldown: 10, logic: { damageMultiplier: 2.6, hits: 3, levelMultiplier: 0.09, strCap: 4.0 } }, // +400%
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic;
    this.cooldown = Number(t.cooldown || 0);
    this.mpCost   = Number(t.mpCost || 0);

    const L = Math.max(1, this.level | 0);
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const hits      = Number(t.logic.hits || 1);

    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);

    // 四轉進化：STR 上限每階提升，最終 +400%
    const cap = Number(t.logic.strCap || 3.0);
    const strBonus = _getStrBonusWithCap(cap);

    const total = Math.floor(base * perHitMul * (1 + strBonus)) * hits;

    monster.hp -= total;
    logPrepend?.(`⚡ （${hits} 連擊）造成 ${total} 傷害！（STR加成 ${Math.round(strBonus * 100)}%，上限 ${Math.round(cap*100)}%）`);

    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },

  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level | 0);
    const hits = Number(t.logic.hits || 1);
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);

    const per   = Math.round(perHitMul * 100);
    const total = Math.round(perHitMul * hits * 100);
    const cap   = Math.round((t.logic.strCap || 0) * 100);

    return `${hits} 連擊，每擊約 ${per}%（總計約 ${total}%）｜STR加成上限+${cap}%｜進化 ${this.evolveLevels.join("/")}`;
  }
});