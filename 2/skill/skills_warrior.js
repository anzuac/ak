// skills_warrior.js

// === 攻擊：無雙斬擊（四階進化 / 10,30,50,100）===
registerJobSkill('warrior', {
  job: "warrior",
  id: "bladeFury",
  name: "無雙斬擊",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [10, 30, 50, 100],

  tiers: [
    { name: "無雙斬擊", mpCost: 10, cooldown: 30,
      logic: { damageMultiplier: 1.2, hits: 2, levelMultiplier: 0.05 } },
    { name: "無雙連斬", mpCost: 14, cooldown: 28,
      logic: { damageMultiplier: 2.2, hits: 3, levelMultiplier: 0.055 } },
    { name: "霸皇斬舞", mpCost: 18, cooldown: 26,
      logic: { damageMultiplier: 2.8, hits: 4, levelMultiplier: 0.06 } },
    { name: "修羅旋斬", mpCost: 22, cooldown: 24,
      logic: { damageMultiplier: 3.4, hits: 5, levelMultiplier: 0.065 } },
    { name: "天破無雙", mpCost: 26, cooldown: 22,
      logic: { damageMultiplier: 4.2, hits: 6, levelMultiplier: 0.07 } },
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);
    // 同步 tier → 頂層（保證花費與冷卻正確）
    this.name = t.name;
    this.logic = t.logic;
    this.cooldown = typeof t.cooldown === "number" ? t.cooldown : (this.cooldown ?? 0);
    const mpGrow = (t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    const cost = (t.mpCost || 0) + mpGrow;
    this.mpCost = cost;

    // 傷害計算
    const perHit = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const base = Math.max(player.totalStats.atk - monster.def, 1);
    const dmg = Math.floor(base * perHit) * t.logic.hits;

    monster.hp -= dmg;
    logPrepend?.(`💥 ${t.name} 造成 ${dmg} 傷害！`);

    spendAndCooldown(this, cost);
    return dmg;
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const t = getActiveTier(this);
    const total = (t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1)) * t.logic.hits;
    return `【${t.name}】攻擊 ${t.logic.hits} 次，總計約 ${Math.round(total * 100)}% 傷害（MP ${t.mpCost}｜CD ${t.cooldown}s）`;
  }
});


// === 攻擊：怒氣爆發（五段進化 10/30/50/70/100，CD 180s 固定）===
registerJobSkill('warrior', {
  job: "warrior",
  id: "rageBurst",
  name: "怒氣爆發",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [10, 30, 50, 70, 100],

  tiers: [
    { name: "怒氣爆發", mpCost: 40, cooldown: 180,
      logic: { damageMultiplier: 4.0, hits: 2, levelMultiplier: 0.10 } },
    { name: "狂戰之吼", mpCost: 46, cooldown: 180,
      logic: { damageMultiplier: 4.2, hits: 3, levelMultiplier: 0.10 } },
    { name: "血怒破軍", mpCost: 52, cooldown: 180,
      logic: { damageMultiplier: 4.4, hits: 4, levelMultiplier: 0.10 } },
    { name: "修羅怒潮", mpCost: 58, cooldown: 180,
      logic: { damageMultiplier: 4.6, hits: 5, levelMultiplier: 0.10 } },
    { name: "天崩地裂", mpCost: 64, cooldown: 180,
      logic: { damageMultiplier: 4.8, hits: 6, levelMultiplier: 0.10 } },
  ],

  // 爆發特性（技能內判斷，不做全域）
  logic: {
    rageMaxBonus: 0.50,   // 失血滿值 +50%
    executeHpPct: 0.20,   // 目標 ≤20% 觸發處決
    executeBonus: 0.30    // 處決 +30%
  },

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);

    // 同步顯示資料到頂層
    this.name = t.name;
    this.logic = { ...t.logic, ...this.logic };
    this.cooldown = typeof t.cooldown === "number" ? t.cooldown : (this.cooldown ?? 0);
    const mpGrow = (t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    const cost = (t.mpCost || 0) + mpGrow;
    this.mpCost = cost;

    const perBase = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);

    // 失血增傷
    const hp = (typeof player.currentHP === "number") ? player.currentHP : player.baseStats.hp;
    const maxHp = player.baseStats.hp || 1;
    const missingRatio = Math.max(0, Math.min(1, 1 - hp / maxHp));
    const rageAmp = 1 + missingRatio * (this.logic.rageMaxBonus || 0);

    // 處決加成
    const mMax = monster.maxHp || monster.baseStats?.hp || 1;
    const execAmp = (monster.hp / mMax <= (this.logic.executeHpPct || 0)) ? (1 + (this.logic.executeBonus || 0)) : 1;

    const perHit = perBase * rageAmp * execAmp;
    const base = Math.max(player.totalStats.atk - monster.def, 1);

    let total = 0;
    for (let i = 0; i < t.logic.hits; i++) {
      const dmg = Math.floor(base * perHit);
      monster.hp -= dmg;
      total += dmg;
      if (monster.hp <= 0) break;
    }

    logPrepend?.(`🔥 ${t.name}（${t.logic.hits} 連擊）總傷害 ${total}`);
    spendAndCooldown(this, cost);
    return total;
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const t = getActiveTier(this);
    const basePer = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const total = basePer * t.logic.hits;
    return `【${t.name}】${t.logic.hits} 連擊，總計約 ${Math.round(total * 100)}% 傷害｜` +
           `失血最高 +${Math.round((this.logic.rageMaxBonus||0)*100)}%，處決 ${Math.round((this.logic.executeHpPct||0)*100)}% ` +
           `+${Math.round((this.logic.executeBonus||0)*100)}%｜MP ${t.mpCost}｜CD ${t.cooldown}s｜進化等級 ${this.evolveLevels.join("/")}`;
  }
});


// === 補助：攻守一體 ===
registerJobSkill('warrior', {
  job: "warrior",
  id: "offenseDefense",
  name: "攻守一體",
  type: "buff",
  level: 1,
  maxLevel: 20,
  mpCost: 15,
  cooldown: 180,
  currentCooldown: 0,
  logic: {
    duration: 60,
    buffs: [
      { stat: 'atk', value: 0.12, levelGrowth: 0.02 },
      { stat: 'def', value: 0.12, levelGrowth: 0.02 }
    ],
    durationLevelGrowth: 1
  },
  activeUntil: 0,
  use() {
    const duration = (this.logic.duration + this.logic.durationLevelGrowth * (this.level - 1)) * 1000;
    const atkBonus = this.logic.buffs[0].value + this.logic.buffs[0].levelGrowth * (this.level - 1);
    const defBonus = this.logic.buffs[1].value + this.logic.buffs[1].levelGrowth * (this.level - 1);

    player.skillBonus.bonusData[this.id] = { atk: atkBonus, def: defBonus };
    this.activeUntil = Date.now() + duration;
    spendAndCooldown(this, this.mpCost);
    logPrepend?.(`⚔️🛡️ ${this.name} 發動，攻防 +${Math.round(atkBonus * 100)}%，持續 ${Math.round(duration/1000)} 秒`);

    this._timer = startTimedBuff(duration, () => {
      delete player.skillBonus.bonusData[this.id];
      this.activeUntil = 0;
      logPrepend?.(`⏳ ${this.name} 效果結束`);
      updateResourceUI?.();
    });

    updateResourceUI?.();
  },
  getUpgradeCost() { return 20 + (this.level - 1) * 10; },
  getDescription() {
    const atk = this.logic.buffs[0].value + this.logic.buffs[0].levelGrowth * (this.level - 1);
    const def = this.logic.buffs[1].value + this.logic.buffs[1].levelGrowth * (this.level - 1);
    const dur = this.logic.duration + this.logic.durationLevelGrowth * (this.level - 1);
    return `攻擊力/防禦力 +${(atk*100).toFixed(0)}%，持續 ${dur} 秒`;
  }
});


// === 補助：護盾護體 ===
  
  // === 補助：護盾護體（小數制減傷版） ===
registerJobSkill('warrior', {
  job: "warrior",
  id: "shieldAegis",
  name: "護盾護體",
  type: "buff",
  level: 1,
  maxLevel: 20,
  mpCost: 30,
  cooldown: 240,
  currentCooldown: 0,
  logic: {
    duration: 30,                    // 初始持續秒數
    durationLevelGrowth: 2,          // 每級 +秒數
    shieldValue: 500,                // 初始護盾
    shieldLevelGrowth: 300,          // 每級 +護盾
    damageReduction: 0.05,           // 初始減傷（小數：0.05 = 5%）
    damageReductionLevelGrowth: 0.01 // 每級 +減傷（小數）
  },
  active: false,

  use() {
    if (this.active) return;

    // 計算本級數值
    const lvl = Math.max(1, this.level || 1);
    const durSec = (this.logic.duration + this.logic.durationLevelGrowth * (lvl - 1));
    const durationMs = durSec * 1000;
    const shieldValue = this.logic.shieldValue + this.logic.shieldLevelGrowth * (lvl - 1);
    const dr = this.logic.damageReduction + this.logic.damageReductionLevelGrowth * (lvl - 1); // 小數

    // 施放花費 / 冷卻
    spendAndCooldown(this, this.mpCost);

    // 套用護盾（直接加到 player.shield，UI 用的就是這個值）
    player.shield = Math.max(0, (player.shield || 0)) + shieldValue;
    this._shieldValue = shieldValue;

    // 減傷放到 skillBonus（小數制），讓 player.totalStats.damageReduce 正確計算
    // 注意：player.totalStats.damageReduce 會自動把各來源相加（且你已在 rpg.js 以百分比語意處理）
    player.skillBonus.bonusData[this.id] = {
      damageReduce: dr  // 小數，例：0.17 = 17%
    };

    this.active = true;

    // 訊息
    logPrepend?.(
      `🛡️ ${this.name} 啟動：護盾 +${shieldValue}、減傷 +${Math.round(dr * 100)}%，持續 ${durSec} 秒`
    );
    updateResourceUI?.();

    // 到時移除
    this._timer = startTimedBuff(durationMs, () => {
      // 還原護盾（不低於0）
      player.shield = Math.max(0, (player.shield || 0) - (this._shieldValue || 0));
      // 移除減傷
      delete player.skillBonus.bonusData[this.id];

      this.active = false;
      logPrepend?.(`🛑 ${this.name} 結束`);
      updateResourceUI?.();
    });
  },

  getUpgradeCost() {
    return 20 + (this.level - 1) * 10;
  },

  getDescription() {
    const lvl = Math.max(1, this.level || 1);
    const shieldValue = this.logic.shieldValue + this.logic.shieldLevelGrowth * (lvl - 1);
    const dr = this.logic.damageReduction + this.logic.damageReductionLevelGrowth * (lvl - 1); // 小數
    const dur = this.logic.duration + this.logic.durationLevelGrowth * (lvl - 1);
    return `護盾 ${shieldValue}、減傷 ${(dr * 100).toFixed(0)}%，持續 ${dur} 秒（消耗 MP ${this.mpCost}，CD ${this.cooldown}s）`;
  }
}

);


// === 補助：生命爆發 ===
registerJobSkill('warrior', {
  job: "warrior",
  id: "lifeBurst",
  name: "生命爆發",
  type: "buff",
  level: 1,
  maxLevel: 20,
  mpCost: 0,
  hpCost: 0.3,
  cooldown: 600,
  currentCooldown: 0,
  logic: {
    duration: 40,
    buffs: [
      { stat: 'recoverPercent', value: 0.20, levelGrowth: 0 },
      { stat: 'atk', value: 0.30, levelGrowth: 0 },
      { stat: 'def', value: 0.70, levelGrowth: 0 },
      { stat: 'damageReduce', value: 0.30, levelGrowth: 0 }
    ],
    cooldownLevelGrowth: -3
  },
  activeUntil: 0,
use() {
  const duration = this.logic.duration * 1000;
  const hpToSpend = Math.floor(player.totalStats.hp * this.hpCost);
  if (player.currentHP <= hpToSpend) {
    logPrepend?.("❌ 生命不足，無法施放");
    return;
  }
  
  // 扣血
  player.currentHP -= hpToSpend;
  
  const atkB = this.logic.buffs[1].value;
  const defB = this.logic.buffs[2].value;
  const recB = this.logic.buffs[0].value; // 0.20
  const drB = this.logic.buffs[3].value;
  
  // 用小數加成
  player.skillBonus.bonusData[this.id] = {
    atk: atkB,
    def: defB,
    recoverPercent: recB,
    damageReduce: drB
  };
  
  this.activeUntil = Date.now() + duration;
  spendAndCooldown(this, this.mpCost);
  
  logPrepend?.(`💖 ${this.name}：扣除 ${hpToSpend} HP，攻+${Math.round(atkB*100)}%，防+${Math.round(defB*100)}%，恢復+${Math.round(recB*100)}%，減傷+${Math.round(drB*1)}%，持續 ${Math.round(duration/1000)} 秒`);
  updateResourceUI?.();
  
  this._timer = startTimedBuff(duration, () => {
    delete player.skillBonus.bonusData[this.id];
    this.activeUntil = 0;
    logPrepend?.(`⏳ ${this.name} 效果結束`);
    updateResourceUI?.();
  });
},
  getUpgradeCost() { return 20 + (this.level - 1) * 10; },
  getDescription() {
    return `消耗30%生命，攻+30%、防+70%、恢復+20%、減傷+30%，持續 ${this.logic.duration} 秒`;
  }
});