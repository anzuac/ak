// === 一轉：奧術飛彈（基礎連擊；不進化，CD 4s，70% × 2，每級 +8%/段）===
registerJobSkill('mage', {
  job: "mage",
  id: "mage_arcane_missiles",
  name: "奧術飛彈(一轉)",
  type: "attack",
  role: "attack",
  isBasic: true,

  level: 1,
  maxLevel: 20,
  currentTier: 0,
  evolveLevels: [],

  tiers: [
    { name: "奧術飛彈", mpCost: 8, cooldown: 4, logic: { damageMultiplier: 0.70, levelMultiplier: 0.08, hits: 2, intBonusCap: 1.00 } }
  ],

  currentCooldown: 0,

  _getIntBonus() {
    const t = getActiveTier(this);
    const cap = Number(t?.logic?.intBonusCap ?? 1.0);
    const RATE = 0.002;
    const total = (player?.baseStats?.int || 0) + (player?.coreBonus?.int || 0);
    return Math.min(cap, total * RATE);
  },

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic;
    this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const intBonus = this._getIntBonus();
    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    const perHit = Math.floor(base * per * (1 + intBonus));
    const total = perHit * (t.logic.hits || 1);

    monster.hp -= total;
    logPrepend?.(`✨ ${t.name} 造成 ${total} 傷害（INT加成 ${Math.round(intBonus*100)}%）`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const cap = Math.round((t.logic.intBonusCap || 0)*100);
    return `${t.logic.hits} 連擊｜每段約 ${Math.round(per)}%｜INT加成上限 +${cap}%`;
  }
});
// === 一轉：寒霜爆（小範圍打擊 + 凍傷；不進化，CD 12s）===
registerJobSkill('mage', {
  job: "mage",
  id: "mage_frost_blast",
  name: "寒霜爆(一轉)",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,
  currentTier: 0,
  evolveLevels: [],

  tiers: [
    // frostbite 在你的系統：每回合扣血 + 行動受限（已在 rpg/statusEffects 中處理）
    { name: "寒霜爆", mpCost: 14, cooldown: 12, logic: { damageMultiplier: 1.10, levelMultiplier: 0.07, hits: 1, intBonusCap: 1.00, frostTurns: 1, frostMul: 0.10 } }
  ],

  currentCooldown: 0,

  _getIntBonus() {
    const t = getActiveTier(this);
    const cap = Number(t?.logic?.intBonusCap ?? 1.0);
    const RATE = 0.002;
    const total = (player?.baseStats?.int || 0) + (player?.coreBonus?.int || 0);
    return Math.min(cap, total * RATE);
  },

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic;
    this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const intBonus = this._getIntBonus();
    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    const dmg = Math.floor(base * per * (1 + intBonus)) * (t.logic.hits || 1);
    monster.hp -= dmg;

    // 施加凍傷
    const turns = Math.max(1, t.logic.frostTurns|0);
    const atkNow = Math.max(1, Number(player?.totalStats?.atk || 1));
    const wantPerTurn = Math.floor(dmg * (t.logic.frostMul || 0));
    const mul = Math.max(0, wantPerTurn / atkNow);
    window.applyStatusToMonster?.(monster, "frostbite", turns, mul, (window.round || 0));

    logPrepend?.(`❄️ ${t.name} 造成 ${dmg} 傷害並附加凍傷（${turns}回合）`);
    spendAndCooldown(this, this.mpCost);
    return dmg;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const cap = Math.round((t.logic.intBonusCap || 0)*100);
    return `單段約 ${Math.round(per)}%｜附加凍傷 ${t.logic.frostTurns} 回合｜`+
           `INT加成上限 +${cap}%`;
  }
});
// === 二轉：連鎖閃電（多段跳躍；不進化，CD 16s）===
registerJobSkill('mage2', {
  job: "mage2(二轉)",
  id: "mage2_chain_lightning",
  name: "連鎖閃電",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 2,

  level: 1,
  maxLevel: 20,
  currentTier: 0,
  evolveLevels: [],

  tiers: [
    { name: "連鎖閃電", mpCost: 18, cooldown: 16, logic: { damageMultiplier: 0.85, levelMultiplier: 0.07, hits: 4, intBonusCap: 1.50, paralyzeChance: 0.20, paralyzeTurns: 1 } }
  ],

  currentCooldown: 0,

  _getIntBonus() {
    const t = getActiveTier(this);
    const cap = Number(t?.logic?.intBonusCap ?? 1.5);
    const RATE = 0.002;
    const total = (player?.baseStats?.int || 0) + (player?.coreBonus?.int || 0);
    return Math.min(cap, total * RATE);
  },

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic;
    this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const intBonus = this._getIntBonus();
    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);

    let total = 0;
    for (let i = 0; i < (t.logic.hits || 1); i++) {
      let dmg = Math.floor(base * per * (1 + intBonus));
      monster.hp -= dmg;
      total += dmg;
      if (monster.hp <= 0) break;
    }

    // 20% 機率麻痺 1 回合
    if (Math.random() < (t.logic.paralyzeChance || 0)) {
      window.applyStatusToMonster?.(monster, "paralyze", t.logic.paralyzeTurns || 1, 0, (window.round || 0));
    }

    logPrepend?.(`⚡ ${t.name} 造成 ${total} 傷害（INT加成 ${Math.round(intBonus*100)}%）`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const cap = Math.round((t.logic.intBonusCap || 0)*100);
    return `${t.logic.hits} 連擊｜每段約 ${Math.round(per)}%｜`+
           `20% 麻痺 ${t.logic.paralyzeTurns} 回合｜INT加成上限 +${cap}%`;
  }
});
// === 二轉：劇毒雲（DoT 炸裂；不進化，CD 18s）===
registerJobSkill('mage2', {
  job: "mage2",
  id: "mage2_poison_cloud",
  name: "劇毒雲(二轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 2,

  level: 1,
  maxLevel: 20,
  currentTier: 0,
  evolveLevels: [],

  tiers: [
    // deadly_poison：依怪物 maxHp 比例傷害
    { name: "劇毒雲", mpCost: 20, cooldown: 18, logic: { damageMultiplier: 1.00, levelMultiplier: 0.08, hits: 1, intBonusCap: 1.50, dotType: "deadly_poison", dotTurns: 3, dotMul: 0.02 } }
  ],

  currentCooldown: 0,

  _getIntBonus() {
    const t = getActiveTier(this);
    const cap = Number(t?.logic?.intBonusCap ?? 1.5);
    const RATE = 0.002;
    const total = (player?.baseStats?.int || 0) + (player?.coreBonus?.int || 0);
    return Math.min(cap, total * RATE);
  },

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic;
    this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const intBonus = this._getIntBonus();
    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    const dmg = Math.floor(base * per * (1 + intBonus));
    monster.hp -= dmg;

    window.applyStatusToMonster?.(monster, t.logic.dotType, t.logic.dotTurns, t.logic.dotMul, (window.round || 0));
    logPrepend?.(`🧪 ${t.name} 造成 ${dmg} 傷害並施加劇毒（${t.logic.dotTurns}回合）`);
    spendAndCooldown(this, this.mpCost);
    return dmg;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const cap = Math.round((t.logic.intBonusCap || 0)*100);
    return `單段約 ${Math.round(per)}%｜附帶致命劇毒：最大HP×${Math.round((t.logic.dotMul||0)*100)}%（${t.logic.dotTurns}回合）｜`+
           `INT加成上限 +${cap}%`;
  }
});
// === 三轉：星隕彗落（高倍率、穿透；不進化，CD 20s）===
registerJobSkill('mage3', {
  job: "mage3",
  id: "mage3_arcane_comet",
  name: "星隕彗落(三轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 3,

  level: 1,
  maxLevel: 20,
  currentTier: 0,
  evolveLevels: [],

  tiers: [
    { name: "星隕彗落", mpCost: 24, cooldown: 20, logic: { damageMultiplier: 1.80, levelMultiplier: 0.12, hits: 2, intBonusCap: 2.00, ignoreDef: 0.35 } }
  ],

  currentCooldown: 0,

  _getIntBonus() {
    const t = getActiveTier(this);
    const cap = Number(t?.logic?.intBonusCap ?? 2.0);
    const RATE = 0.002;
    const total = (player?.baseStats?.int || 0) + (player?.coreBonus?.int || 0);
    return Math.min(cap, total * RATE);
  },

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic;
    this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const intBonus = this._getIntBonus();
    const effDef = Math.floor((monster?.def || 0) * (1 - (t.logic.ignoreDef || 0)));
    const base = Math.max((player.totalStats?.atk || 1) - effDef, 1);
    const perHit = Math.floor(base * per * (1 + intBonus));
    const total = perHit * (t.logic.hits || 1);

    monster.hp -= total;
    logPrepend?.(`☄️ ${t.name}（無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%）造成 ${total} 傷害`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const cap = Math.round((t.logic.intBonusCap || 0)*100);
    return `${t.logic.hits} 連擊｜每段約 ${Math.round(per)}%｜無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜`+
           `INT加成上限 +${cap}%`;
  }
});
// skills_mage3.js（或你的法師技能檔）
// 三轉：元素攻擊（可進化 100/120/150/200；依階段提高 INT 加成上限）
registerJobSkill('mage3', {
  job: "mage3",
  id: "mage3_elemental_strike",
  name: "元素攻擊(三轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 3,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  // 進化：100 / 120 / 150 / 200
  evolveLevels: [100, 120, 150, 200],

  // 說明：
  // - intBonusCap：該階段 INT 加成上限（0.5=+50%、1.0=+100%、2.0=+200%、3.0=+300%）
  // - 內部採 0.2%/INT（RATE=0.002），並封頂於 intBonusCap
  tiers: [
    { name: "元素攻擊(三轉)",   mpCost: 18, cooldown: 20, logic: { damageMultiplier: 1.00, levelMultiplier: 0.08, hits: 1, intBonusCap: 0.50 } }, // +50%
    { name: "高等元素攻擊(三轉)", mpCost: 20, cooldown: 20, logic: { damageMultiplier: 1.15, levelMultiplier: 0.09, hits: 1, intBonusCap: 1.00 } }, // +100%
    { name: "極效元素攻擊(三轉)", mpCost: 22, cooldown: 20, logic: { damageMultiplier: 1.35, levelMultiplier: 0.10, hits: 1, intBonusCap: 2.00 } }, // +200%
    { name: "深淵元素攻擊(三轉)", mpCost: 24, cooldown: 20, logic: { damageMultiplier: 1.60, levelMultiplier: 0.11, hits: 1, intBonusCap: 3.00 } }, // +300%
    { name: "神域元素攻擊(三轉)", mpCost: 26, cooldown: 20, logic: { damageMultiplier: 1.85, levelMultiplier: 0.12, hits: 1, intBonusCap: 3.00 } }, // 維持+300%
  ],

  currentCooldown: 0,

  // 內部：INT 加成（0.2% 每點，封頂依當前 tier 的 intBonusCap）
  _getIntBonus() {
    const RATE = 0.002; // 0.2% / INT
    const t = (typeof getActiveTier === "function") ? getActiveTier(this) : this;
    const cap = Number(t?.logic?.intBonusCap ?? 0.5); // 預設 +50%
    const base = Number(player?.baseStats?.int || 0);
    const fromCore = Number(player?.coreBonus?.int || 0);
    const totalInt = base + fromCore;
    return Math.min(cap, totalInt * RATE); // 回傳 0 ~ cap
  },

  use(monster) {
    const t = getActiveTier(this);

    // 同步顯示資料
    this.name = t.name;
    this.logic = t.logic;
    this.cooldown = (typeof t.cooldown === "number") ? t.cooldown : (this.cooldown ?? 0);
    const mpGrow = Number(t?.logic?.mpCostLevelGrowth || 0) * Math.max(0, (this.level ?? 1) - 1);
    this.mpCost = (t.mpCost || 0) + mpGrow;

    // ====== 基礎一擊傷害 × INT 加成 ======
    const L = Math.max(1, this.level|0);
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const intBonus = this._getIntBonus(); // 0 ~ cap（例如 0.5=+50%）
    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    let total = Math.floor(base * perHitMul * (1 + intBonus)) * (t.logic.hits || 1);
    monster.hp -= total;

    // ====== 元素隨機與各自效果 ======
    const pick = ["fire","poison","ice","lightning","earth"][Math.floor(Math.random()*5)];
    let extraLog = "";
    const nowRound = (typeof window.round === "number") ? window.round : 0;

    // 🔥 火：15% → 追加「攻擊傷害 25%」即時傷害
    if (pick === "fire" && Math.random() < 0.15) {
      const extra = Math.floor(total * 0.25);
      if (extra > 0) { monster.hp -= extra; total += extra; extraLog += `｜🔥 +${extra}`; }
    }

    // 🧪 毒：15% → 造成「攻擊傷害 40%」的持續毒（用 poison，每回合以 ATK×multiplier 結算）
    if (pick === "poison" && Math.random() < 0.15) {
      const atkNow = Math.max(1, Number(player?.totalStats?.atk || 1));
      const wantPerTurn = Math.floor(total * 0.40);
      const mul = Math.max(0, wantPerTurn / atkNow);
      const dotTurns = 3; // 想調整就改這
      window.applyStatusToMonster?.(monster, "poison", dotTurns, mul, nowRound);
      extraLog += `｜🧪 毒：每回合約 ${wantPerTurn}（${dotTurns}回合）`;
    }

    // ❄️ 冰：10% → 追加「攻擊傷害 20%」即時傷害
    if (pick === "ice" && Math.random() < 0.10) {
      const extra = Math.floor(total * 0.20);
      if (extra > 0) { monster.hp -= extra; total += extra; extraLog += `｜❄️ +${extra}`; }
    }

    // ⚡ 雷：15% → 麻痺 1 回合
    if (pick === "lightning" && Math.random() < 0.15) {
      window.applyStatusToMonster?.(monster, "paralyze", 1, 0, nowRound);
      extraLog += `｜⚡ 麻痺 1 回合`;
    }

    // 🌀 土：15% → 混亂 1 回合
    if (pick === "earth" && Math.random() < 0.15) {
      window.applyStatusToMonster?.(monster, "chaos", 1, 0, nowRound);
      extraLog += `｜🌀 混亂 1 回合`;
    }

    logPrepend?.(`✨ ${t.name} 造成 ${total} 傷害（元素：${pick}）${extraLog}｜INT加成 ${Math.round(intBonus*100)}%`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  // 升級消耗：技能強化券 1 張
  getUpgradeCost() { return 1; },

  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const capPct = Math.round((t.logic.intBonusCap || 0) * 100);
    return `單段約 ${Math.round(per)}%｜INT加成上限 +${capPct}%｜元素（擇一）：` +
           `火(15%→+25%即時)｜毒(15%→本次傷 40% 持續，3回合)｜冰(10%→+20%即時)｜雷(15%→麻痺1回合)｜土(15%→混亂1回合)｜進化 ${this.evolveLevels.join("/")}`;
  }
});
// === 四轉：重力井（短CD、多段；不進化，CD 10s）===
registerJobSkill('mage4', {
  job: "mage4",
  id: "mage4_gravity_well",
  name: "重力井(四轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 4,

  level: 1,
  maxLevel: 20,
  currentTier: 0,
  evolveLevels: [],

  tiers: [
    { name: "重力井", mpCost: 22, cooldown: 10, logic: { damageMultiplier: 0.75, levelMultiplier: 0.07, hits: 5, intBonusCap: 2.50, ignoreDef: 0.15 } }
  ],

  currentCooldown: 0,

  _getIntBonus() {
    const t = getActiveTier(this);
    const cap = Number(t?.logic?.intBonusCap ?? 2.5);
    const RATE = 0.002;
    const total = (player?.baseStats?.int || 0) + (player?.coreBonus?.int || 0);
    return Math.min(cap, total * RATE);
  },

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic;
    this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const intBonus = this._getIntBonus();
    const effDef = Math.floor((monster?.def || 0) * (1 - (t.logic.ignoreDef || 0)));
    const base = Math.max((player.totalStats?.atk || 1) - effDef, 1);

    let total = 0;
    for (let i = 0; i < (t.logic.hits || 1); i++) {
      let dmg = Math.floor(base * per * (1 + intBonus));
      monster.hp -= dmg;
      total += dmg;
      if (monster.hp <= 0) break;
    }

    logPrepend?.(`🌀 ${t.name}（無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%）總傷害 ${total}`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const cap = Math.round((t.logic.intBonusCap || 0)*100);
    return `${t.logic.hits} 連擊｜每段約 ${Math.round(per)}%｜無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜`+
           `INT加成上限 +${cap}%`;
  }
});
// === 四轉：禁陽審判（進化版 / 100,140,180,220）===
registerJobSkill('mage4', {
  job: "mage4",
  id: "mage4_solar_doom",
  name: "禁陽審判(四轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 4,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [100, 140, 180, 220],

  tiers: [
    { name: "禁陽審判", mpCost: 28, cooldown: 25, logic: { damageMultiplier: 2.20, levelMultiplier: 0.12, hits: 1, intBonusCap: 2.00 } },
    { name: "烈日審判", mpCost: 32, cooldown: 24, logic: { damageMultiplier: 2.60, levelMultiplier: 0.13, hits: 1, intBonusCap: 2.50 } },
    { name: "天炎審判", mpCost: 36, cooldown: 22, logic: { damageMultiplier: 3.00, levelMultiplier: 0.14, hits: 1, intBonusCap: 3.00 } },
    { name: "焚世審判", mpCost: 40, cooldown: 20, logic: { damageMultiplier: 3.50, levelMultiplier: 0.15, hits: 1, intBonusCap: 3.50 } },
    { name: "終焉審判", mpCost: 45, cooldown: 18, logic: { damageMultiplier: 4.00, levelMultiplier: 0.16, hits: 1, intBonusCap: 4.00 } },
  ],

  currentCooldown: 0,

  _getIntBonus() {
    const t = getActiveTier(this);
    const cap = Number(t?.logic?.intBonusCap ?? 2.0);
    const RATE = 0.002;
    const total = (player?.baseStats?.int || 0) + (player?.coreBonus?.int || 0);
    return Math.min(cap, total * RATE);
  },

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name;
    this.logic = t.logic;
    this.cooldown = t.cooldown;
    this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier) + (t.logic.levelMultiplier * (L - 1));
    const intBonus = this._getIntBonus();

    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    const dmg = Math.floor(base * per * (1 + intBonus));

    monster.hp -= dmg;
    logPrepend?.(`🌞 ${t.name} 造成 ${dmg} 傷害！（INT加成 ${Math.round(intBonus*100)}%）`);
    spendAndCooldown(this, this.mpCost);
    return dmg;
  },

  getUpgradeCost() { return 1; },

  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const cap = Math.round((t.logic.intBonusCap || 0)*100);
    return `單段約 ${Math.round(per)}% 傷害｜INT加成上限 +${cap}%｜進化 ${this.evolveLevels.join("/")}`;
  }
});