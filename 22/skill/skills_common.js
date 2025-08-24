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