// skills_common.js
registerCommonSkill({
  job: "all",
  id: "unisonBurst",
  name: "共鳴爆發",
  type: "attack",
  role: "attack",
  isBasic: false,
  
  level: 1,
  maxLevel: 20,
  
  currentTier: 0,
  evolveLevels: [10, 30, 50, 70, 100],
  
  // 固定冷卻 90 秒（各階同CD）
  tiers: [
    { name: "共鳴爆發", mpCost: 40, cooldown: 90, logic: { damageMultiplier: 1.4, hits: 3, levelMultiplier: 0.06 } },
    { name: "共鳴連擊", mpCost: 46, cooldown: 90, logic: { damageMultiplier: 1.7, minHits: 3, maxHits: 5, levelMultiplier: 0.07, mpCostLevelGrowth: 2 } },
    { name: "共鳴震盪", mpCost: 52, cooldown: 90, logic: { damageMultiplier: 2.0, hits: 4, levelMultiplier: 0.08 } },
    { name: "共鳴狂潮", mpCost: 58, cooldown: 90, logic: { damageMultiplier: 2.4, minHits: 4, maxHits: 6, levelMultiplier: 0.09 } },
    { name: "萬象共鳴", mpCost: 64, cooldown: 90, logic: { damageMultiplier: 2.8, hits: 5, levelMultiplier: 0.10 } },
  ],
  
  currentCooldown: 0,
  
  // 依職業吃主屬性：STR/INT/AGI/LUK → 每點 +0.2% 傷害，上限 +200%
  _getMainStatBonus() {
    const job = String((player?.job || "")).toLowerCase();
    const mainKey =
      job === "warrior" ? "str" :
      job === "mage" ? "int" :
      job === "archer" ? "agi" :
      job === "thief" ? "luk" : "str";
    
    const base = Number(player?.baseStats?.[mainKey] || 0);
    const fromCore = Number(player?.coreBonus?.[mainKey] || 0);
    const total = base + fromCore;
    
    const RATE = 0.002; // 0.2% / 每點
    const CAP = 2.0; // +200%
    return Math.min(CAP, total * RATE); // 回傳小數 0 ~ 2.0
  },
  
  use(monster) {
    const t = getActiveTier(this);
    
    // 同步顯示資料
    this.name = t.name;
    this.cooldown = typeof t.cooldown === "number" ? t.cooldown : (this.cooldown ?? 0);
    const mpGrow = (t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    const cost = (t.mpCost || 0) + mpGrow;
    this.mpCost = cost;
    
    // 主屬性加成
    const mainStatBonus = this._getMainStatBonus(); // 0 ~ 2.0
    
    // 傷害計算
    const perHitBase = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const perHit = perHitBase * (1 + mainStatBonus);
    const base = Math.max(player.totalStats.atk - monster.def, 1);
    
    const hasRange = (typeof t.logic.minHits === "number" && typeof t.logic.maxHits === "number");
    const hits = hasRange ? getRandomInt(t.logic.minHits, t.logic.maxHits) : (t.logic.hits || 1);
    
    const dmg = Math.floor(base * perHit) * hits;
    
    monster.hp -= dmg;
    const hitText = hasRange ? `${hits} 次` : `${t.logic.hits} 次`;
    logPrepend?.(`✨ ${t.name} 連擊 ${hitText}，共 ${dmg} 傷害！（主屬加成 ${Math.round(mainStatBonus*100)}%）`);
    
    spendAndCooldown(this, cost);
    return dmg;
  },
  
  getUpgradeCost() {
    return 20 + (this.level - 1) * 10;
  },
  
  getDescription() {
    const t = getActiveTier(this);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1)) * 100;
    const hitText = (typeof t.logic.minHits === "number" && typeof t.logic.maxHits === "number") ?
      `${t.logic.minHits}-${t.logic.maxHits} 段` :
      `${t.logic.hits} 段`;
    return `【${t.name}】${hitText}，每段約 ${Math.round(per)}%（MP ${t.mpCost}｜CD ${t.cooldown}s｜主屬性加成上限+200%）｜進化等級：${this.evolveLevels.join("/")}`;
  }
});
// skills_common.js —— 全職業通用：輪迴異常術（依序輪迴施加異常）
// 依賴：applyStatusToMonster(monster, type, durationSec, multiplier, currentTimeSec)、logPrepend、getActiveTier、spendAndCooldown、getRandomInt、window.round

/**registerCommonSkill({
  job: "all",
  id: "abnormalCycle",
  name: "輪迴異常術",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [10, 30, 50, 70, 100],

  // 固定冷卻（各階同 CD），依等級略增 MP
  tiers: [
    // T1：基礎倍率與持續
    { name: "輪迴異常術", mpCost: 0, cooldown: 8,  logic: { levelMpGrowth: 1, levelDurGrowth: 0.2, levelMulGrowth: 0.002 } },
    // T2：縮短 CD、提升持續
    { name: "輪迴異常陣", mpCost: 22, cooldown: 7,  logic: { levelMpGrowth: 1, levelDurGrowth: 0.25, levelMulGrowth: 0.0025 } },
    // T3：再縮 CD
    { name: "輪迴徵兆",   mpCost: 26, cooldown: 6,  logic: { levelMpGrowth: 2, levelDurGrowth: 0.3, levelMulGrowth: 0.003 } },
    // T4：強化持續與倍率
    { name: "輪迴刻印",   mpCost: 30, cooldown: 6,  logic: { levelMpGrowth: 2, levelDurGrowth: 0.35, levelMulGrowth: 0.0035 } },
    // T5：終階
    { name: "萬象輪迴",   mpCost: 34, cooldown: 5,  logic: { levelMpGrowth: 3, levelDurGrowth: 0.4, levelMulGrowth: 0.004 } },
  ],

  currentCooldown: 0,

  // 狀態輪替順序
  _order: ["burn", "poison", "bleed", "frostbite", "weaken", "paralyze", "chaos", "deadly_poison"],
  _idx: 0, // 輪替索引（在物件上保存，不用全域）

  // 各狀態的「基礎持續秒」與「基礎倍率」
  _baseDur: {
    burn: 10, poison: 10, bleed: 10, frostbite: 10,
    weaken: 10, paralyze: 10, chaos: 10, deadly_poison: 10,
  },
  _baseMul: {
    burn: 0.10,          // 10% ATK/秒
    poison: 0.08,        // 8%  ATK/秒
    bleed: 0.12,         // 12% ATK/秒
    frostbite: 0.06,     // 6%  ATK/秒
    weaken: 0,           // debuff（降攻防），倍率無用
    paralyze: 0,         // 控制
    chaos: 0,            // 亂打
    deadly_poison: 0.02, // 2% MaxHP/秒
  },

  use(monster) {
    if (!monster) return 0;

    // 讀取階與同步顯示
    const t = getActiveTier(this);
    this.name = t.name;
    this.cooldown = typeof t.cooldown === "number" ? t.cooldown : (this.cooldown ?? 0);

    // 依等級增加 MP 消耗、持續秒、倍率微增（每階邏輯略不同）
    const mpCost = (t.mpCost || 0) + (t.logic?.levelMpGrowth || 0) * Math.max(0, this.level - 1);
    this.mpCost = mpCost;

    // 決定這次要施加的狀態
    const type = this._order[this._idx % this._order.length];
    this._idx++;

    // 等級成長帶來的額外持續與倍率
    const addDur = (t.logic?.levelDurGrowth || 0) * Math.max(0, this.level - 1);
    const addMul = (t.logic?.levelMulGrowth || 0) * Math.max(0, this.level - 1);

    // 計算最終參數
    const durationSec = Math.max(1, Math.floor((this._baseDur[type] || 5) + addDur));
    const multiplier  = Math.max(0, (this._baseMul[type] || 0) + addMul);

    // 施加狀態（以秒為單位；第五個參數是「目前秒」，你的 rpg.js 用 window.round 作為當前秒）
    if (typeof window.applyStatusToMonster === "function") {
      window.applyStatusToMonster(monster, type, durationSec, multiplier, window.round);
    }

    // 紀錄
    logPrepend?.(`🧪 施放【${t.name}】：套用 ${type}（${durationSec}s${multiplier ? `，倍率 ${multiplier}` : ""}）`);

    // 消耗與冷卻
    spendAndCooldown(this, mpCost);
    // 本技能不直接造成立即傷害，由狀態每秒處理 → 回傳 0
    return 0;
  },

  getUpgradeCost() {
    return 20 + (this.level - 1) * 10;
  },

  getDescription() {
    const t = getActiveTier(this);
    const durNote = `基礎持續(秒)會隨等級 +${t.logic?.levelDurGrowth || 0}/Lv`;
    const mulNote = `倍率每等 +${(t.logic?.levelMulGrowth || 0)}`;
    return `【${t.name}】依序輪替施加 ${this._order.join("→")}；${durNote}，${mulNote}（MP ${t.mpCost}｜CD ${t.cooldown}s）｜進化等級：${this.evolveLevels.join("/")}`;
  }
});*/