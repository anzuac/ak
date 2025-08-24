// =========================
// skills_archer.js
// 弓箭手技能（1~4轉）
// =========================

// === 一轉：二連箭（不進化 / CD 3s / 60%×3；目標≥70%血量 +20%）===
registerJobSkill('archer', {
  job: "archer",
  id: "archer_double_arrow",
  name: "二連箭(一轉)",
  type: "attack",
  role: "attack",
  isBasic: true,        // 保留為基礎技（自動輪替用）

  level: 1,
  maxLevel: 20,

  currentTier: 0,

  // 不進化 → 只留單一 tier
  tiers: [
    { 
      name: "二連箭", 
      mpCost: 6, 
      cooldown: 3, 
      logic: {
        damageMultiplier: 0.60,  // 每段 60%
        levelMultiplier: 0.00,   // 不隨等級成長（你要成長再改）
        hits: 3,                 // 三段
        agiScale: 0.001,         // 仍保留敏捷加成
        ignoreDef: 0.20,         // 仍保留無視防
        critRate: 0.15,          // 內建爆擊（可調）
        critMult: 0.20,          // 爆傷（+50%）
        highHpBonusPct: 0.20,    // 新增：高血量加成 +20%
        highHpThreshold: 0.70    // 觸發門檻：≥70%
      } 
    }
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

    const L = Math.max(1, this.level|0);
    // 不進化版：如果你仍想要「等級加成」，把 levelMultiplier 改 > 0 即可
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);

    // 高血量加成：怪物當前 HP 比例
    const mMax = (monster.maxHp || monster.baseStats?.hp || 1);
    const hpRatio = Math.max(0, Math.min(1, (monster.hp || 0) / mMax));
    const highHpAmp = (hpRatio >= (t.logic.highHpThreshold || 0.70)) ? (1 + (t.logic.highHpBonusPct || 0.20)) : 1;

    const agi = (player.baseStats?.agi ?? 0);
    const agiAmp = 1 + agi * (t.logic.agiScale || 0);
    const effDef = Math.floor((monster.def || 0) * (1 - (t.logic.ignoreDef || 0)));
    const base = Math.max((player.totalStats?.atk || 1) - effDef, 1);

    let total = 0;
    for (let i = 0; i < (t.logic.hits||1); i++) {
      let dmg = Math.floor(base * perHitMul * agiAmp * highHpAmp);
      // 內建暴擊（獨立於全域）
      if (Math.random() < (t.logic.critRate || 0)) {
        dmg = Math.floor(dmg * (1 + (t.logic.critMult || 0)));
      }
      monster.hp -= dmg;
      total += dmg;
      if (monster.hp <= 0) break;
    }

    const pierce = Math.round((t.logic.ignoreDef || 0) * 100);
    const hpBonusTxt = highHpAmp > 1 ? `（高血量加成 +${Math.round((t.logic.highHpBonusPct||0)*100)}%）` : "";
    logPrepend?.(`🏹 ${t.name}（無視防禦${pierce}%）造成 ${total} 傷害！${hpBonusTxt}`);
    spendAndCooldown(this, cost);
    return total;
  },

  getUpgradeCost() { return 1; },

  getDescription() {
    const t = getActiveTier(this);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * Math.max(0, (this.level|0) - 1)) * 100;
    const agiScalePct = ((t.logic.agiScale || 0) * 100).toFixed(1);
    const hpTh = Math.round((t.logic.highHpThreshold || 0.70) * 100);
    const hpAmp = Math.round((t.logic.highHpBonusPct || 0.20) * 100);
    return `${t.logic.hits} 連擊｜每段約 ${Math.round(per)}%｜無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜` +
           `敏捷加成：每點AGI +${agiScalePct}% 總傷｜內建暴擊：${Math.round((t.logic.critRate||0)*100)}% / +${Math.round((t.logic.critMult||0)*100)}%｜` +
           `對 HP ≥ ${hpTh}% 目標另 +${hpAmp}% 傷害`;
  }
});


registerJobSkill('archer', {
  job: "archer",
  id: "archer_holy_dragon",
  name: "聖龍箭(一轉)",
  type: "attack",
  role: "attack",
  isBasic: false,

  level: 1,
  maxLevel: 20,
  currentTier: 0,

  // 🚫 不進化 → 只保留一個 tier
  tiers: [
    { 
      name: "聖龍箭",   
      mpCost: 40, 
      cooldown: 30, 
      logic: { 
        damageMultiplier: 4.0,    // 高倍率，爆發用
        levelMultiplier: 0.15,    // 每級增加傷害
        hits: 1,                  // 單發必中
        agiScale: 0.001,          // AGI 影響
        ignoreDef: 0.30,          // 固定無視 30% 防禦
        executeHpPct: 0.25,       // 處決門檻：敵人 ≤25% HP
        executeBonus: 0.50,       // 處決額外 +50% 傷害
        critRate: 0.20,           // 內建 20% 爆擊率
        critMult: 0.75            // 爆傷 +75%
      } 
    }
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);

    this.name = t.name;
    this.logic = t.logic;
    this.cooldown = t.cooldown;
    this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);

    const agi = (player.baseStats?.agi ?? 0);
    const agiAmp = 1 + agi * (t.logic.agiScale || 0);
    const effDef = Math.floor((monster.def || 0) * (1 - (t.logic.ignoreDef || 0)));

    // 處決判定
    const maxHp = monster.maxHp || monster.baseStats?.hp || 1;
    const execAmp = (monster.hp / maxHp <= (t.logic.executeHpPct || 0.25))
      ? (1 + (t.logic.executeBonus || 0.5)) : 1;

    // 基礎傷害
    let dmg = Math.floor(Math.max((player.totalStats?.atk || 1) - effDef, 1) * perHitMul * agiAmp * execAmp);

    // 內建爆擊
    if (Math.random() < (t.logic.critRate || 0)) {
      dmg = Math.floor(dmg * (1 + (t.logic.critMult || 0)));
    }

    monster.hp -= dmg;

    const execTxt = execAmp > 1 ? "（處決觸發！）" : "";
    logPrepend?.(`🐉 ${t.name} 命中造成 ${dmg} 傷害 ${execTxt}`);
    spendAndCooldown(this, this.mpCost);
    return dmg;
  },

  getUpgradeCost() { return 1; },

  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    return `單體處決技能｜約 ${Math.round(per)}% 傷害｜敏捷加成：每點AGI +${((t.logic.agiScale||0)*100).toFixed(1)}% 總傷｜` +
           `無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜處決：HP ≤ ${Math.round((t.logic.executeHpPct||0)*100)}% 額外 +${Math.round((t.logic.executeBonus||0)*100)}%｜` +
           `內建暴擊：${Math.round((t.logic.critRate||0)*100)}% / +${Math.round((t.logic.critMult||0)*100)}%`;
  }
});

// ===== 二轉（劍聖對應：狙擊手）Skill 1：穿雲破甲（不進化）=====
registerJobSkill('archer2', {
  job: "archer2",
  id: "archer2_armor_pierce",
  name: "穿雲破甲（二轉）",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 2,

  level: 1,
  maxLevel: 20,
  currentTier: 0,

  tiers: [
    { name: "穿雲破甲", mpCost: 16, cooldown: 14, logic: { damageMultiplier: 1.3, levelMultiplier: 0.06, hits: 2, agiScale: 0.0012, ignoreDef: 0.40, critRate: 0.10, critMult: 0.60 } }
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const perHit = (t.logic.damageMultiplier||0) + (t.logic.levelMultiplier||0)*(L-1);
    const agiAmp = 1 + (player.baseStats?.agi||0) * (t.logic.agiScale||0);
    const effDef = Math.floor((monster.def||0) * (1 - (t.logic.ignoreDef||0)));
    const base = Math.max((player.totalStats?.atk||1) - effDef, 1);

    let total = 0;
    for (let i=0;i<(t.logic.hits||1);i++){
      let d = Math.floor(base * perHit * agiAmp);
      if (Math.random() < (t.logic.critRate||0)) d = Math.floor(d * (1 + (t.logic.critMult||0)));
      monster.hp -= d; total += d; if (monster.hp <= 0) break;
    }

    logPrepend?.(`🎯 ${t.name} 穿透防禦造成 ${total} 傷害！`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier*(L-1))*100;
    return `${t.logic.hits} 連擊｜每段約 ${Math.round(per)}%｜無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜` +
           `敏捷加成：每AGI +${((t.logic.agiScale||0)*100).toFixed(1)}% 總傷｜暴擊 ${Math.round((t.logic.critRate||0)*100)}% / +${Math.round((t.logic.critMult||0)*100)}%｜`;
  }
});

// ===== 二轉 Skill 2：鷹眼狙擊（70等進化一次）=====
registerJobSkill('archer2', {
  job: "archer2",
  id: "archer2_eagle_sniper",
  name: "鷹眼狙擊(二轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 2,

  level: 1,
  maxLevel: 20,
  currentTier: 0,
  evolveLevels: [70],

  tiers: [
    { name: "鷹眼狙擊", mpCost: 22, cooldown: 24, logic: { damageMultiplier: 2.2, levelMultiplier: 0.10, hits: 1, agiScale: 0.0012, ignoreDef: 0.30, critRate: 0.20, critMult: 0.80 } },
    { name: "鷹皇審判", mpCost: 26, cooldown: 24, logic: { damageMultiplier: 2.8, levelMultiplier: 0.12, hits: 1, agiScale: 0.0012, ignoreDef: 0.35, critRate: 0.25, critMult: 1.00 } }
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier||0) + (t.logic.levelMultiplier||0)*(L-1);
    const effDef = Math.floor((monster.def||0) * (1 - (t.logic.ignoreDef||0)));
    const base = Math.max((player.totalStats?.atk||1) - effDef, 1);
    let dmg = Math.floor(base * per * (1 + (player.baseStats?.agi||0) * (t.logic.agiScale||0)));

    if (Math.random() < (t.logic.critRate||0)) {
      dmg = Math.floor(dmg * (1 + (t.logic.critMult||0)));
    }

    monster.hp -= dmg;
    logPrepend?.(`🦅 ${t.name} 造成 ${dmg} 傷害！`);
    spendAndCooldown(this, this.mpCost);
    return dmg;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier*(L-1))*100;
    return `【${t.name}】單段約 ${Math.round(per)}%｜無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜` +
           `敏捷加成每AGI +${((t.logic.agiScale||0)*100).toFixed(1)}%｜暴擊 ${Math.round((t.logic.critRate||0)*100)}% / +${Math.round((t.logic.critMult||0)*100)}%進化等級：${(this.evolveLevels||[]).join("/")}`;
  }
});

// ===== 三轉（遊俠）Skill：風暴箭陣（不進化 / CD 20）=====
registerJobSkill('archer3', {
  job: "archer3",
  id: "archer3_storm_barrage",
  name: "風暴箭陣(三轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 3,

  level: 1,
  maxLevel: 20,
  currentTier: 0,

  tiers: [
    { name: "風暴箭陣", mpCost: 24, cooldown: 20, logic: { damageMultiplier: 0.90, levelMultiplier: 0.07, hits: 5, agiScale: 0.0014, ignoreDef: 0.30, critRate: 0.15, critMult: 0.70 } },
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier||0) + (t.logic.levelMultiplier||0)*(L-1);
    const agiAmp = 1 + (player.baseStats?.agi||0) * (t.logic.agiScale||0);
    const effDef = Math.floor((monster.def||0) * (1 - (t.logic.ignoreDef||0)));
    const base = Math.max((player.totalStats?.atk||1) - effDef, 1);

    let total = 0;
    for (let i=0;i<(t.logic.hits||1);i++){
      let d = Math.floor(base * per * agiAmp);
      if (Math.random() < (t.logic.critRate||0)) d = Math.floor(d * (1 + (t.logic.critMult||0)));
      monster.hp -= d; total += d; if (monster.hp <= 0) break;
    }

    logPrepend?.(`🌪️ ${t.name} 造成 ${total} 傷害！`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier*(L-1))*100;
    return `${t.logic.hits} 連擊｜每段約 ${Math.round(per)}%｜無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜` +
           `敏捷加成每AGI +${((t.logic.agiScale||0)*100).toFixed(1)}%｜暴擊 ${Math.round((t.logic.critRate||0)*100)}% / +${Math.round((t.logic.critMult||0)*100)}%｜`;
  }
});

// ===== 四轉（神射手）Skill 1：追風箭（短CD / 不進化）=====
registerJobSkill('archer4', {
  job: "archer4",
  id: "archer4_gale_shot",
  name: "追風箭(四轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 4,

  level: 1,
  maxLevel: 20,
  currentTier: 0,

  tiers: [
    { name: "追風箭", mpCost: 10, cooldown: 6, logic: { damageMultiplier: 0.95, levelMultiplier: 0.07, hits: 2, agiScale: 0.0015, ignoreDef: 0.25, critRate: 0.18, critMult: 0.70 } },
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier||0) + (t.logic.levelMultiplier||0)*(L-1);
    const agiAmp = 1 + (player.baseStats?.agi||0) * (t.logic.agiScale||0);
    const effDef = Math.floor((monster.def||0) * (1 - (t.logic.ignoreDef||0)));
    const base = Math.max((player.totalStats?.atk||1) - effDef, 1);

    let total = 0;
    for (let i=0;i<(t.logic.hits||1);i++){
      let d = Math.floor(base * per * agiAmp);
      if (Math.random() < (t.logic.critRate||0)) d = Math.floor(d * (1 + (t.logic.critMult||0)));
      monster.hp -= d; total += d; if (monster.hp <= 0) break;
    }

    logPrepend?.(`🍃 ${t.name} 造成 ${total} 傷害！`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier*(L-1))*100;
    return `${t.logic.hits} 連擊｜每段約 ${Math.round(per)}%｜無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜` +
           `敏捷加成每AGI +${((t.logic.agiScale||0)*100).toFixed(1)}%｜暴擊 ${Math.round((t.logic.critRate||0)*100)}% / +${Math.round((t.logic.critMult||0)*100)}%`;
  }
});

// ===== 四轉 Skill 2：神速隕矢（短CD / 可進化：120,150,200；高 AGI 伸縮上限概念）=====
registerJobSkill('archer4', {
  job: "archer4",
  id: "archer4_meteoric_rapid",
  name: "神速隕矢(四轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 4,

  level: 1,
  maxLevel: 20,
  currentTier: 0,
  evolveLevels: [120, 150, 200],

  tiers: [
    { name: "神速隕矢",   mpCost: 18, cooldown: 10, logic: { damageMultiplier: 1.20, levelMultiplier: 0.08, hits: 2, agiScale: 0.0020, agiCapMul: 3.0, ignoreDef: 0.35, critRate: 0.20, critMult: 0.80 } },
    { name: "神速流隕",   mpCost: 20, cooldown: 10, logic: { damageMultiplier: 1.35, levelMultiplier: 0.09, hits: 2, agiScale: 0.0022, agiCapMul: 3.0, ignoreDef: 0.38, critRate: 0.22, critMult: 0.85 } },
    { name: "神速墜星",   mpCost: 22, cooldown: 10, logic: { damageMultiplier: 1.50, levelMultiplier: 0.10, hits: 3, agiScale: 0.0024, agiCapMul: 3.0, ignoreDef: 0.40, critRate: 0.24, critMult: 0.90 } },
    { name: "神速辰落",   mpCost: 24, cooldown: 10, logic: { damageMultiplier: 1.70, levelMultiplier: 0.11, hits: 3, agiScale: 0.0026, agiCapMul: 3.0, ignoreDef: 0.42, critRate: 0.26, critMult: 1.00 } },
  ],

  currentCooldown: 0,

  use(monster) {
    const t = getActiveTier(this);
    this.name = t.name; this.logic = t.logic; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier||0) + (t.logic.levelMultiplier||0)*(L-1);

    // AGI 伸縮 + 上限（例如最多 +300%）
    const agi = (player.baseStats?.agi||0);
    const agiAmpRaw = 1 + agi * (t.logic.agiScale||0);
    const agiAmp = Math.min(agiAmpRaw, (t.logic.agiCapMul || 3.0));

    const effDef = Math.floor((monster.def||0) * (1 - (t.logic.ignoreDef||0)));
    const base = Math.max((player.totalStats?.atk||1) - effDef, 1);

    let total = 0;
    for (let i=0;i<(t.logic.hits||1);i++){
      let d = Math.floor(base * per * agiAmp);
      if (Math.random() < (t.logic.critRate||0)) d = Math.floor(d * (1 + (t.logic.critMult||0)));
      monster.hp -= d; total += d; if (monster.hp <= 0) break;
    }

    logPrepend?.(`🌠 ${t.name}（AGI放大×${agiAmp.toFixed(2)}，無視${Math.round((t.logic.ignoreDef||0)*100)}%）總傷害 ${total}`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = getActiveTier(this);
    const L = Math.max(1, this.level|0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier*(L-1))*100;
    return `${t.logic.hits} 連擊｜每段約 ${Math.round(per)}%｜無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜` +
           `敏捷加成每AGI +${((t.logic.agiScale||0)*100).toFixed(2)}%（上限×${(t.logic.agiCapMul||3.0).toFixed(1)}）｜` +
           `暴擊 ${Math.round((t.logic.critRate||0)*100)}% / +${Math.round((t.logic.critMult||0)*100)}%｜進化 ${this.evolveLevels.join("/")}`;
  }
});