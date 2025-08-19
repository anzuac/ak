// skills_archer.js

// === 攻擊：二連箭（五階進化 / 10,30,50,70,100）===
registerJobSkill('archer', {
  job: "archer",
  id: "doubleArrow",
  name: "二連箭",
  type: "attack",
  role: "attack",
  isBasic: true,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [10, 30, 50, 70, 100],

  tiers: [
    { name: "二連箭",   mpCost: 6,  cooldown: 10, logic: { damageMultiplier: 0.55, hits: 2, levelMultiplier: 0.05, agiScale: 0.001, ignoreDef: 0.20 } },
    { name: "三連箭",   mpCost: 8,  cooldown: 8,  logic: { damageMultiplier: 0.60, hits: 3, levelMultiplier: 0.05, agiScale: 0.001, ignoreDef: 0.22 } },
    { name: "連發箭雨", mpCost: 10, cooldown: 6,  logic: { damageMultiplier: 0.65, hits: 4, levelMultiplier: 0.05, agiScale: 0.001, ignoreDef: 0.24 } },
    { name: "疾風連射", mpCost: 12, cooldown: 4,  logic: { damageMultiplier: 0.70, hits: 5, levelMultiplier: 0.05, agiScale: 0.001, ignoreDef: 0.26 } },
    { name: "千羽疾雨", mpCost: 14, cooldown: 0,  logic: { damageMultiplier: 0.75, hits: 6, levelMultiplier: 0.05, agiScale: 0.001, ignoreDef: 0.28 } }
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);

    // 同步階段屬性到頂層（確保花費/CD 正確）
    this.name = t.name;
    this.logic = t.logic;
    this.cooldown = (typeof t.cooldown === "number") ? t.cooldown : (this.cooldown ?? 0);
    const mpGrow = (t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    const cost = (t.mpCost || 0) + mpGrow;
    this.mpCost = cost;

    // 計算
    const perHit = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const agi = (player.baseStats?.agi ?? 0);
    const agiAmp = 1 + agi * (t.logic.agiScale || 0);
    const effDef = Math.floor((monster.def || 0) * (1 - (t.logic.ignoreDef || 0)));
    const base = Math.max(player.totalStats.atk - effDef, 1);
    const total = Math.floor(base * perHit * agiAmp) * t.logic.hits;

    monster.hp -= total;
    logPrepend?.(`🏹 ${t.name}（無視防禦${Math.round((t.logic.ignoreDef||0)*100)}%）造成 ${total} 傷害！`);

    spendAndCooldown(this, cost);
    return total;
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const t = getActiveTier(this);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1)) * 100;
    const agiScalePct = ((t.logic.agiScale || 0) * 100).toFixed(1);
    return `【${t.name}】${t.logic.hits} 連擊｜每段約 ${Math.round(per)}%｜無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜` +
           `敏捷加成：每點AGI +${agiScalePct}% 總傷｜MP ${t.mpCost}｜CD ${t.cooldown}s｜進化 ${this.evolveLevels.join("/")}`;
  }
});


// === 攻擊：聖龍箭（五階爆發，CD 180 固定）===
registerJobSkill('archer', {
  job: "archer",
  id: "holyDragonArrow",
  name: "聖龍箭",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [10, 30, 50, 70, 100],

  tiers: [
    { name: "聖龍箭",   mpCost: 40, cooldown: 180, logic: { damageMultiplier: 3.6, levelMultiplier: 0.12, minHits: 3, maxHits: 6, agiScale: 0.001, ignoreDefBase: 0.10, ignoreDefPerHit: 0.05, ignoreDefMax: 0.50, executeHpPct: 0.25, executeBonus: 0.35 } },
    { name: "聖龍連矢", mpCost: 48, cooldown: 180, logic: { damageMultiplier: 3.9, levelMultiplier: 0.13, minHits: 4, maxHits: 7, agiScale: 0.001, ignoreDefBase: 0.12, ignoreDefPerHit: 0.05, ignoreDefMax: 0.55, executeHpPct: 0.25, executeBonus: 0.35 } },
    { name: "聖龍天矢", mpCost: 56, cooldown: 180, logic: { damageMultiplier: 4.2, levelMultiplier: 0.14, minHits: 5, maxHits: 8, agiScale: 0.001, ignoreDefBase: 0.14, ignoreDefPerHit: 0.05, ignoreDefMax: 0.58, executeHpPct: 0.25, executeBonus: 0.35 } },
    { name: "聖龍審決", mpCost: 64, cooldown: 180, logic: { damageMultiplier: 4.5, levelMultiplier: 0.15, minHits: 6, maxHits: 9, agiScale: 0.001, ignoreDefBase: 0.16, ignoreDefPerHit: 0.05, ignoreDefMax: 0.60, executeHpPct: 0.25, executeBonus: 0.35 } },
    { name: "聖龍滅界", mpCost: 72, cooldown: 180, logic: { damageMultiplier: 4.8, levelMultiplier: 0.16, minHits: 7, maxHits: 10,agiScale: 0.001, ignoreDefBase: 0.18, ignoreDefPerHit: 0.05, ignoreDefMax: 0.60, executeHpPct: 0.25, executeBonus: 0.35 } }
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);

    // 同步屬性
    this.name = t.name;
    this.logic = t.logic;
    this.cooldown = (typeof t.cooldown === "number") ? t.cooldown : (this.cooldown ?? 0);
    const mpGrow = (t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    const cost = (t.mpCost || 0) + mpGrow;
    this.mpCost = cost;

    // 參數
    const perBase = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const agi = (player.baseStats?.agi ?? 0);
    const agiAmp = 1 + agi * (t.logic.agiScale || 0);
    const execAmp = (monster.hp / (monster.maxHp || monster.baseStats?.hp || 1) <= (t.logic.executeHpPct || 0))
      ? (1 + (t.logic.executeBonus || 0)) : 1;

    const hits = getRandomInt(t.logic.minHits, t.logic.maxHits);
    let total = 0;

    for (let i = 0; i < hits; i++) {
      const ignorePct = Math.min(
        (t.logic.ignoreDefBase || 0) + i * (t.logic.ignoreDefPerHit || 0),
        (t.logic.ignoreDefMax || 0.6)
      );
      const effDef = Math.floor((monster.def || 0) * (1 - ignorePct));
      const base = Math.max(player.totalStats.atk - effDef, 1);
      const perHit = perBase * agiAmp * execAmp;

      const dmg = Math.floor(base * perHit);
      monster.hp -= dmg;
      total += dmg;
      if (monster.hp <= 0) break;
    }

    logPrepend?.(`🐉 ${t.name}：${hits} 發，穿透最高 ${Math.round(Math.min((t.logic.ignoreDefBase + (hits-1) * t.logic.ignoreDefPerHit), t.logic.ignoreDefMax)*100)}%，總傷害 ${total}`);
    spendAndCooldown(this, cost);
    return total;
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const t = getActiveTier(this);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1)) * 100;
    const range = `${t.logic.minHits}-${t.logic.maxHits}`;
    return `【${t.name}】隨機 ${range} 發｜每段約 ${Math.round(per)}%｜敏捷加成：每點AGI +${((t.logic.agiScale||0)*100).toFixed(1)}% 總傷｜` +
           `穿透：首發無視${Math.round((t.logic.ignoreDefBase||0)*100)}%，每發+${Math.round((t.logic.ignoreDefPerHit||0)*100)}%（上限${Math.round((t.logic.ignoreDefMax||0)*100)}%）｜` +
           `處決：HP ≤ ${Math.round((t.logic.executeHpPct||0)*100)}% 另 +${Math.round((t.logic.executeBonus||0)*100)}%｜MP ${t.mpCost}｜CD ${t.cooldown}s｜進化 ${this.evolveLevels.join("/")}`;
  }
});




// === 補助：彗星 ===
registerJobSkill('archer', {
  job: "archer",
  id: "comet",
  name: "彗星",
  type: "buff",
  level: 1,
  maxLevel: 20,
  mpCost: 30,
  cooldown: 180,
  currentCooldown: 0,
  logic: {
    duration: 60,
    buffs: [
      { stat: 'critRate', value: 0.20, levelGrowth: 0 },
      { stat: 'critMultiplier', value: 0.30, levelGrowth: 0.01 }
    ],
    durationLevelGrowth: 0
  },
  activeUntil: 0,

  use() {
    const duration = (this.logic.duration + this.logic.durationLevelGrowth * (this.level - 1)) * 1000;
    const rate = this.logic.buffs[0].value;
    const mult = this.logic.buffs[1].value + this.logic.buffs[1].levelGrowth * (this.level - 1);

    player.skillBonus.bonusData[this.id] = { critRate: rate, critMultiplier: mult };
    this.activeUntil = Date.now() + duration;
    spendAndCooldown(this, this.mpCost);
    logPrepend?.(`🌠 ${this.name}：爆率+${Math.round(rate*100)}%、爆傷+${Math.round(mult*100)}%，${Math.round(duration/1000)} 秒`);

    this._timer = startTimedBuff(duration, () => {
      delete player.skillBonus.bonusData[this.id];
      this.activeUntil = 0;
      logPrepend?.(`🛑 ${this.name} 結束`);
    });
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const mult = this.logic.buffs[1].value + this.logic.buffs[1].levelGrowth * (this.level - 1);
    return `爆擊率 +20%，爆擊傷害 +${(mult*100).toFixed(0)}%，持續 ${this.logic.duration} 秒`;
  }
});


// === 補助：迴避提升 ===
registerJobSkill('archer', {
  job: "archer",
  id: "evasionBoost",
  name: "迴避提升",
  type: "buff",
  level: 1,
  maxLevel: 20,
  mpCost: 30,
  cooldown: 240,
  currentCooldown: 0,
  logic: {
    duration: 60,
    buffs: [{ stat: 'dodgePercent', value: 0.35, levelGrowth: 0 }],
    cooldownLevelGrowth: -2,
    durationLevelGrowth: 1
  },
  active: false,

  use() {
    if (this.active) return;
    const duration = (this.logic.duration + this.logic.durationLevelGrowth * (this.level - 1)) * 1000;
    const dodge = Math.round((this.logic.buffs[0].value) * 100);

    player.dodgePercent = (player.dodgePercent || 0) + dodge;
    this._dodgeAdd = dodge;
    this.active = true;
    spendAndCooldown(this, this.mpCost);
    logPrepend?.(`💨 ${this.name}：閃避 +${dodge}% ，${Math.round(duration/1000)} 秒`);

    this._timer = startTimedBuff(duration, () => {
      player.dodgePercent = Math.max(0, (player.dodgePercent || 0) - (this._dodgeAdd || 0));
      this._dodgeAdd = 0; this.active = false;
      logPrepend?.(`🛑 ${this.name} 結束`);
    });
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const cd = this.cooldown + (this.logic.cooldownLevelGrowth || 0) * (this.level - 1);
    const dur = this.logic.duration + (this.logic.durationLevelGrowth || 0) * (this.level - 1);
    return `閃避 +35%，持續 ${dur} 秒（冷卻 ${cd} 秒）`;
  }
});


// === 補助：爆發 ===
registerJobSkill('archer', {
  job: "archer",
  id: "archerBurst",
  name: "爆發",
  type: "buff",
  level: 1,
  maxLevel: 20,
  mpCost: 0,
  hpCost: 0.5,
  cooldown: 600,
  currentCooldown: 0,
  logic: {
    duration: 40,
    buffs: [
      { stat: 'atk', value: 1.6, levelGrowth: 0 },
      { stat: 'def', value: -0.8, levelGrowth: 0 },
      { stat: 'dodgePercent', value: 0.30, levelGrowth: 0 }
    ]
  },
  activeUntil: 0,

  use() {
    const duration = this.logic.duration * 1000;
    const hpToSpend = Math.floor(player.totalStats.hp * this.hpCost);
    if (player.currentHP <= hpToSpend) { logPrepend?.("❌ 生命不足，無法施放"); return; }
    player.currentHP -= hpToSpend;

    const atkB = this.logic.buffs[0].value;
    const defB = this.logic.buffs[1].value;
    const dodge = Math.round(this.logic.buffs[2].value * 100);

    player.skillBonus.bonusData[this.id] = { atk: atkB, def: defB };
    player.dodgePercent = (player.dodgePercent || 0) + dodge;

    this._dodgeAdd = dodge;
    this.activeUntil = Date.now() + duration;
    spendAndCooldown(this, 0);
    logPrepend?.(`💢 ${this.name}：扣 ${hpToSpend} HP，攻+${Math.round(atkB*100)}%、防${Math.round(defB*100)}%、閃避+${dodge}% ，${this.logic.duration} 秒`);

    this._timer = startTimedBuff(duration, () => {
      delete player.skillBonus.bonusData[this.id];
      player.dodgePercent = Math.max(0, (player.dodgePercent || 0) - (this._dodgeAdd || 0));
      this._dodgeAdd = 0;
      this.activeUntil = 0;
      logPrepend?.(`🛑 ${this.name} 結束`);
    });
    updateResourceUI?.();
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    return `消耗50%生命，攻+160%、防-80%、閃避+30%，持續 ${this.logic.duration} 秒`;
  }
});