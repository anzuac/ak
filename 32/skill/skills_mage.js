// skills_mage.js

// === 攻擊：元素連擊（五階進化 / 10,30,50,70,100）===
registerJobSkill('mage', {
  job: "mage",
  id: "elementSkill",
  name: "元素連擊",
  type: "attack",
  level: 1,
  maxLevel: 20,
  currentTier: 0,
  evolveLevels: [10, 30, 50, 70, 100],
  mpCost: 30,
  cooldown: 10,
  currentCooldown: 0,

  tiers: [
    {
      name: "元素攻擊",
      mpCost: 30,
      cooldown: 10,
      logic: { damageMultiplier: 0.60, hits: 2, levelMultiplier: 0.05 }
    },
    {
      name: "元素地獄",
      mpCost: 50,
      cooldown: 8,
      logic: { damageMultiplier: 0.70, minHits: 3, maxHits: 5, levelMultiplier: 0.20, mpCostLevelGrowth: 5 }
    },
    {
      name: "元素風暴",
      mpCost: 60,
      cooldown: 6,
      logic: { damageMultiplier: 0.85, hits: 4, levelMultiplier: 0.12 }
    },
    {
      name: "元素隕落",
      mpCost: 75,
      cooldown: 4,
      logic: { damageMultiplier: 0.95, minHits: 4, maxHits: 6, levelMultiplier: 0.15 }
    },
    {
      name: "元素審判",
      mpCost: 90,
      cooldown: 0,
      logic: { damageMultiplier: 1.10, hits: 6, levelMultiplier: 0.18 }
    }
  ],

  use(monster) {
    const t = getActiveTier(this);

    // 同步到頂層欄位
    this.name = t.name;
    this.cooldown = t.cooldown;
    const mpGrow = (t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    const cost = (t.mpCost || 0) + mpGrow;
    this.mpCost = cost;

    // 傷害
    const perHit = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const base = Math.max(player.totalStats.atk - monster.def, 1);
    const hasRange = (typeof t.logic.minHits === "number" && typeof t.logic.maxHits === "number");
    const hits = hasRange ? getRandomInt(t.logic.minHits, t.logic.maxHits) : (t.logic.hits || 1);
    const dmg = Math.floor(base * perHit) * hits;

    monster.hp -= dmg;
    const hitText = hasRange ? `${hits} 次` : `${t.logic.hits} 次`;
    logPrepend(`✨ ${t.name} 連擊 ${hitText}，共 ${dmg} 傷害！${mpGrow ? `（MP ${cost}）` : ''}`);

    spendAndCooldown(this, cost);
    return dmg;
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const t = getActiveTier(this);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1)) * 100;
    const hitText = (typeof t.logic.minHits === "number" && typeof t.logic.maxHits === "number")
      ? `${t.logic.minHits}-${t.logic.maxHits} 段`
      : `${t.logic.hits} 段`;
    return `【${t.name}】${hitText}，每段約 ${Math.round(per)}%（MP ${t.mpCost}｜CD ${t.cooldown}s）｜進化等級：${this.evolveLevels.join("/")}`;
  }
});

// === 攻擊：天雷（五段進化 / 10,30,50,70,100；CD 180 固定）===
registerJobSkill('mage', {
  job: "mage",
  id: "celestialThunder",
  name: "天雷",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [10, 30, 50, 70, 100],

  tiers: [
    { name: "天雷",     mpCost: 50, cooldown: 180, logic: { damageMultiplier: 2.0, minHits: 2, maxHits: 6, levelMultiplier: 0.10 } },
    { name: "雷霆咆哮", mpCost: 58, cooldown: 180, logic: { damageMultiplier: 2.3, minHits: 3, maxHits: 6, levelMultiplier: 0.11 } },
    { name: "雷獄審判", mpCost: 66, cooldown: 180, logic: { damageMultiplier: 2.6, minHits: 4, maxHits: 7, levelMultiplier: 0.12 } },
    { name: "星落天罰", mpCost: 74, cooldown: 180, logic: { damageMultiplier: 2.9, minHits: 5, maxHits: 8, levelMultiplier: 0.13 } },
    { name: "天穹滅雷", mpCost: 82, cooldown: 180, logic: { damageMultiplier: 3.2, minHits: 6, maxHits: 9, levelMultiplier: 0.14 } }
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);

    // 同步顯示資料
    this.name = t.name;
    this.logic = t.logic;
    this.cooldown = (typeof t.cooldown === "number") ? t.cooldown : (this.cooldown ?? 0);
    const mpGrow = (t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    const cost = (t.mpCost || 0) + mpGrow;
    this.mpCost = cost;

    // 傷害
    const perHit = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const base = Math.max(player.totalStats.atk - monster.def, 1);
    const hasRange = (typeof t.logic.minHits === "number" && typeof t.logic.maxHits === "number");
    const hits = hasRange ? getRandomInt(t.logic.minHits, t.logic.maxHits) : (t.logic.hits || 1);
    const dmg = Math.floor(base * perHit) * hits;

    monster.hp -= dmg;
    logPrepend(`⚡ ${t.name} 連擊 ${hits} 次，共 ${dmg} 傷害！`);

    spendAndCooldown(this, cost);
    return dmg;
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const t = getActiveTier(this);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1)) * 100;
    const hitText = (typeof t.logic.minHits === "number" && typeof t.logic.maxHits === "number")
      ? `${t.logic.minHits}-${t.logic.maxHits} 次`
      : `${t.logic.hits} 次`;
    return `【${t.name}】攻擊 ${hitText}，每段約 ${Math.round(per)}%（MP ${t.mpCost}｜CD ${t.cooldown}s）｜進化：${this.evolveLevels.join("/")}`;
  }
});

// === 補助：魔法提升 ===
registerJobSkill('mage', {
  job: "mage",
  id: "magicBoost",
  name: "魔法提升",
  type: "buff",
  level: 1,
  maxLevel: 20,
  mpCost: 0,
  cooldown: 200,
  currentCooldown: 0,
  logic: {
    duration: 60,
    buffs: [
      { stat: 'atk', value: 0.3, levelGrowth: 0 },
      { stat: 'def', value: 0.2, levelGrowth: 0 },
      { stat: 'spellDamage', value: 0.15, levelGrowth: 0 }
    ],
    durationLevelGrowth: 2
  },
  activeUntil: 0,
  use() {
    const duration = (this.logic.duration + this.logic.durationLevelGrowth * (this.level - 1)) * 1000;
    const atk = this.logic.buffs[0].value;
    const def = this.logic.buffs[1].value;
    const spd = this.logic.buffs[2].value;

    player.skillBonus.bonusData[this.id] = { atk, def, spellDamage: spd };
    this.activeUntil = Date.now() + duration;
    spendAndCooldown(this, this.mpCost);
    logPrepend(`✨ ${this.name}：攻+${Math.round(atk*100)}%、防+${Math.round(def*100)}%、法傷+${Math.round(spd*100)}%，${Math.round(duration/1000)} 秒`);

    this._timer = startTimedBuff(duration, () => {
      delete player.skillBonus.bonusData[this.id];
      this.activeUntil = 0;
      logPrepend(`🛑 ${this.name} 結束`);
    });
  },
  getUpgradeCost() { return 20 + (this.level - 1) * 10; },
  getDescription() {
    const dur = this.logic.duration + this.logic.durationLevelGrowth * (this.level - 1);
    return `攻+30%、防+20%、特性傷害+15%，持續 ${dur} 秒`;
  }
});

// === 補助：魔力恢復加強 ===
registerJobSkill('mage', {
  job: "mage",
  id: "manaRecoveryBoost",
  name: "魔力恢復加強",
  type: "buff",
  level: 1,
  maxLevel: 20,
  mpCost: 0,
  cooldown: 300,
  currentCooldown: 0,
  logic: {
    duration: 60,
    buffs: [{ stat: 'manaRecoveryPerSecond', value: 5, levelGrowth: 0 }],
    cooldownLevelGrowth: -2
  },
  activeUntil: 0,
  use() {
    const duration = this.logic.duration * 1000;
    const perSec = this.logic.buffs[0].value;

    this.activeUntil = Date.now() + duration;
    spendAndCooldown(this, 0);
    logPrepend(`🔷 ${this.name}：每秒 +${perSec} MP，持續 ${this.logic.duration} 秒`);

    this._interval = setInterval(() => {
      if (Date.now() >= this.activeUntil) return;
      player.currentMP = Math.min(player.totalStats.mp, player.currentMP + perSec);
      updateResourceUI?.();
    }, 1000);
    this._timer = startTimedBuff(duration, () => {
      clearInterval(this._interval);
      this._interval = null;
      this.activeUntil = 0;
      logPrepend(`🛑 ${this.name} 結束`);
    });
  },
  getUpgradeCost() { return 20 + (this.level - 1) * 10; },
  getDescription() {
    const cd = this.cooldown + (this.logic.cooldownLevelGrowth || 0) * (this.level - 1);
    return `每秒回復 +5 MP，持續 ${this.logic.duration} 秒（冷卻 ${cd} 秒）`;
  }
});

// === 補助：魔力犧牲 ===
registerJobSkill('mage', {
  job: "mage",
  id: "manaSacrifice",
  name: "魔力犧牲",
  type: "buff",
  level: 1,
  maxLevel: 20,
  mpCost: 0,
  mpCostPercent: 0.4,
  cooldown: 600,
  currentCooldown: 0,
  logic: { duration: 30, buffs: [{ stat: 'spellDamage', value: 0.3, levelGrowth: 0.02 }] },
  activeUntil: 0,
  use() {
    const duration = this.logic.duration * 1000;
    const mpSpend = Math.floor(player.totalStats.mp * this.mpCostPercent);
    if (player.currentMP < mpSpend) { logPrepend("❌ MP 不足，無法施放"); return; }
    player.currentMP -= mpSpend;

    const spd = this.logic.buffs[0].value + this.logic.buffs[0].levelGrowth * (this.level - 1);
    player.skillBonus.bonusData[this.id] = { spellDamage: spd };

    this.activeUntil = Date.now() + duration;
    spendAndCooldown(this, 0);
    logPrepend(`💠 ${this.name}：消耗 ${mpSpend} MP，法傷+${Math.round(spd*100)}%，${this.logic.duration} 秒`);
    this._timer = startTimedBuff(duration, () => {
      delete player.skillBonus.bonusData[this.id];
      this.activeUntil = 0;
      logPrepend(`🛑 ${this.name} 結束`);
    });
    updateResourceUI?.();
  },
  getUpgradeCost() { return 20 + (this.level - 1) * 10; },
  getDescription() {
    const spd = this.logic.buffs[0].value + this.logic.buffs[0].levelGrowth * (this.level - 1);
    return `消耗 40% MP，特性傷害 +${(spd*100).toFixed(0)}%，持續 ${this.logic.duration} 秒`;
  }
});