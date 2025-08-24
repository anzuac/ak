// bosses.js (整合了冷卻機制的最終版)

const mapBossPool = {
  all: [
   {
  name: "測試用",
  isMapBoss: true,
  level: 1,            
  hp: 500000000,
  atk: 9990,
  def: 0,
  baseExp: 999990,
  baseGold: 20,
  encounterRate: 0,

  dropRates: {
    gold: { min: 10, max: 20 },
    stone: { chance: 1, min: 0, max: 0 },
  
  },

  // 異常狀態（玩家用，走 status_manager_player.js）
  

  // 內部狀態（面板/顯示相容欄位）
  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  // 單階段王：controller 只處理優先序
  controller(monster, currentHP) {
    const needDef = BossCore.getBuffTurns(monster, "def") <= 0
                 && BossCore.getSkillCooldown(monster, "def-buff") <= 0;

    
    if (needDef) {
      monster.nextSkill = this.skills.find(s => s.key === "def-buff");
      return;
    }

    // 攻擊優先：重擊 > 快打 > 普攻
    if (BossCore.getSkillCooldown(monster, "magma-hammer") <= 0) {
    
      monster.nextSkill = this.skills.find(s => s.key === "Abasic");
    }
  },

  // 技能：單計時器（持續 + 額外冷卻），普攻保底
  skills: [
    // 普攻
    {
      key: "Abasic",
      name: "衝撞",
      description: "造成 100% 傷害（無冷卻）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
        logPrepend(` ${m.name} 衝撞！`);
        return dmg;
      }
    },


    // DEF Buff（例：×1.8，持續5+冷卻7 → 一次設 12）
    {
      key: "Adef-buff",
      name: "防禦硬化",
      description: "防禦力×1.8，持續5回合（冷卻7回合）",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { def: { mul: 1.8, duration: 5 } });
        BossCore.setSkillCooldown(m, "def-buff", 5 + 7);
        logPrepend(`🛡️ ${m.name} 岩殼硬化！DEF 提升至 ${m.def}！`);
        return 0;
      }
    },


    
  ],

  // 回合結束：BossCore 統一遞減
  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  // 初始化：先 BossCore.init
  init(monster) {
    BossCore.init(monster);               // 🔑 必須
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}
  ],
  
  
  forest: [
  // 森林王.js
// 簡潔版 Boss 物件，所有核心狀態由 boss_core.js 管理。

{
  name: "森林王",
  isMapBoss: true,
  level: 8,
  hp: 8000,
  atk: 120,
  def: 80,
  baseExp: 350,
  baseGold: 500,
  baseGed: 500,
  encounterRate: 8,
  dropRates: {
    gold: { min: 150, max: 280 },
    
    stone: { chance: 1, min: 20, max: 45 },
    "鑽石抽獎券": { chance: 1 ,min: 1, max: 1 },
    "低階潛能解放鑰匙": { chance: 0.20 , min: 1, max: 5 },
    "森林精華": { chance: 0.30, min: 1, max: 2 },
    "粗糙樹皮": { chance: 0.20 },
    "藤蔓": { chance: 0.20 }
  },





  extra: {
    buff: { atkBuff: true, defBuff: true },
    poison: true,
    poisonChance: 5
    
  },

  baseAtk: null,
  naturalDef: null,
  _enragedTurns: 0,
  _rootShieldTurns: 0,

  _tickEndTurn(m) { BossCore.endTurn(m); },

controller(monster, currentHP) {
  const atkActive = BossCore.getBuffTurns(monster, 'atk') > 0;
  const defActive = BossCore.getBuffTurns(monster, 'def') > 0;

  if (!atkActive && BossCore.getSkillCooldown(monster, 'atk-buff') <= 0) {
    monster.nextSkill = this.skills.find(s => s.key === "atk-buff");
    return;
  }
  if (!defActive && BossCore.getSkillCooldown(monster, 'def-buff') <= 0) {
    monster.nextSkill = this.skills.find(s => s.key === "def-buff");
    return;
  }

  if (BossCore.getSkillCooldown(monster, 'heavy') <= 0) {
    monster.nextSkill = this.skills.find(s => s.key === "heavy");
  } else if (BossCore.getSkillCooldown(monster, 'quick') <= 0) {
    monster.nextSkill = this.skills.find(s => s.key === "quick");
  } else {
    // 🆕 全部攻擊技在冷卻 → 用普通攻擊
    monster.nextSkill = this.skills.find(s => s.key === "basic");
  }
},

  skills: [
  {
    key: "basic",
    name: "普通攻擊",
    description: "造成 100% 傷害（無冷卻）",
    use: (p, m) => {
      const dmg = Math.round(m.atk * 1.0);
      logPrepend(`🪵 ${m.name} 發動普通攻擊！`);
      return dmg;
    }
  },
  {
    key: "atk-buff",
    name: "樹心狂怒",
    description: "提升攻擊力2倍，持續6回合（冷卻5回合）",
    use: (p, m) => {
      BossCore.applyFromSkill(m, { atk: { mul: 2.0, duration: 6 } });
      BossCore.setSkillCooldown(m, "atk-buff", 6 + 5);
      logPrepend(`💚 ${m.name} 進入樹心狂怒！攻擊力提升至 ${m.atk}！`);
      return 0;
    }
  },
  {
    key: "def-buff",
    name: "樹皮鐵壁",
    description: "提升防禦力2倍，持續5回合（冷卻7回合）",
    use: (p, m) => {
      BossCore.applyFromSkill(m, { def: { mul: 2.0, duration: 5 } });
      BossCore.setSkillCooldown(m, "def-buff", 5 + 7);
      logPrepend(`🛡️ ${m.name} 的樹皮硬化！防禦力提升至 ${m.def}！`);
      return 0;
    }
  },
  {
    key: "quick",
    name: "藤鞭抽打",
    description: "造成 230% 傷害（冷卻 4 回合）",
    use: (p, m) => {
      const dmg = Math.round(m.atk * 2.3);
      BossCore.setSkillCooldown(m, "quick", 4);
      logPrepend(`🌿 ${m.name} 揮出藤鞭猛擊！`);
      return dmg;
    }
  },
  {
    key: "heavy",
    name: "森王崩擊",
    description: "造成 400% 傷害（冷卻 10 回合）",
    use: (p, m) => {
      const dmg = Math.round(m.atk * 4.0);
      BossCore.setSkillCooldown(m, "heavy", 10);
      logPrepend(`🌳 ${m.name} 集力猛撞！`);
      return dmg;
    }
  }
],

  init(monster) {
    BossCore.init(monster);
    monster.skills = this.skills;
  }
}

// ... (mapBossPool 的結尾)
],



// ==============================
// swampKing.js － 沼澤地區 Boss（第一階段）
// 介面相容：BossCore（buff/冷卻）、monster_skills（選技）、status_manager_player（異常）
// ==============================
 swamp : [
   {
  name: "沼澤王",
  isMapBoss: true,
  level: 14,
  hp: 10800,
  atk: 105,
  def: 75,
  baseExp: 280,
  baseGold: 420,
  encounterRate: 8,

  dropRates: {
    gold: { min: 140, max: 260 },
    stone: { chance: 1, min: 18, max: 40 },
    "低階潛能解放鑰匙": { chance: 0.25 , min: 1, max: 5},
    "鑽石抽獎券": { chance: 1 ,min: 1, max: 2 },
    "沼澤精華": { chance: 0.28, min: 1, max: 2 },
    "腐泥塊": { chance: 0.2 },
    "黏稠苔蘚": { chance: 0.2 }
  },

  // 異常狀態（玩家用：走 status_manager_player.js）
  // 若你的主迴圈在怪物攻擊後會呼叫 applyStatusFromMonster(monster)，這裡就能生效
  extra: {
    poison: true,
    poisonChance: 15, // %
  //  buff: { atkBuff: true, defBuff: true }
  },

  // 內部狀態（面板/顯示相容欄位）
  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  // 單階段王：controller 只處理選技優先序
  controller(monster, currentHP) {
    const needAtk = BossCore.getBuffTurns(monster, "atk") <= 0
                 && BossCore.getSkillCooldown(monster, "atk-buff") <= 0;
    const needDef = BossCore.getBuffTurns(monster, "def") <= 0
                 && BossCore.getSkillCooldown(monster, "def-buff") <= 0;

    if (needAtk) {
      monster.nextSkill = this.skills.find(s => s.key === "atk-buff");
      return;
    }
    if (needDef) {
      monster.nextSkill = this.skills.find(s => s.key === "def-buff");
      return;
    }

    // 攻擊優先序：重擊 > 快打 > 普攻
    if (BossCore.getSkillCooldown(monster, "bog-crush") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "bog-crush");
    } else if (BossCore.getSkillCooldown(monster, "mud-shot") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "mud-shot");
    } else {
      monster.nextSkill = this.skills.find(s => s.key === "basic");
    }
  },

  // 技能：單計時器（持續 + 額外冷卻），普攻保底
  skills: [
    // 普攻：保底每回合都有動作
    {
      key: "basic",
      name: "泥拳",
      description: "造成 100% 傷害（無冷卻）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
        logPrepend(`👊 ${m.name} 挥動泥濘的拳頭！`);
        return dmg;
      }
    },

    // ATK Buff：持續5 + 額外冷卻6 → 冷卻一次設成 5+6
    {
      key: "atk-buff",
      name: "腐沼狂怒",
      description: "攻擊力×2.0，持續5回合（冷卻6回合）",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { atk: { mul: 2.0, duration: 5 } });
        BossCore.setSkillCooldown(m, "atk-buff", 5 + 6);
        logPrepend(`💢 ${m.name} 狂怒咆哮，力量暴增！ATK 提升至 ${m.atk}！`);
        return 0;
      }
    },

    // DEF Buff：持續5 + 額外冷卻7 → 冷卻一次設成 5+7
    {
      key: "def-buff",
      name: "泥殼加厚",
      description: "防禦力×1.8，持續5回合（冷卻7回合）",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { def: { mul: 1.8, duration: 5 } });
        BossCore.setSkillCooldown(m, "def-buff", 5 + 7);
        logPrepend(`🛡️ ${m.name} 的泥殼迅速硬化！DEF 提升至 ${m.def}！`);
        return 0;
      }
    },

    // 快打：CD 3
    {
      key: "mud-shot",
      name: "泥沼彈射",
      description: "造成 180% 傷害（冷卻 3 回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.8);
        BossCore.setSkillCooldown(m, "mud-shot", 3);
        logPrepend(`🪨 ${m.name} 彈射厚重泥團砸向你！`);
        return dmg;
      }
    },

    // 重擊：CD 9
    {
      key: "bog-crush",
      name: "沼爆重擊",
      description: "造成 360% 傷害（冷卻 9 回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 3.6);
        BossCore.setSkillCooldown(m, "bog-crush", 9);
        logPrepend(`💥 ${m.name} 匯聚沼力，猛然轟擊！`);
        return dmg;
      }
    }
  ],

  // 回合結束：交給 BossCore 倒數（buff/技能冷卻）與面板套用
  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  // 初始化：必須先 BossCore.init
  init(monster) {
    BossCore.init(monster);               // 🔑 必須
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}
  ],
  
  lava: [
{
  name: "熔岩之王",
  isMapBoss: true,
  level: 20,            
  hp: 13000,
  atk: 140,
  def: 90,
  baseExp: 360,
  baseGold: 620,
  encounterRate: 8,

  dropRates: {
    gold: { min: 180, max: 320 },
    stone: { chance: 1, min: 24, max: 48 },
    "低階潛能解放鑰匙": { chance: 0.25 , min: 1, max: 5},  // 低階鑰匙
    "鑽石抽獎券": { chance: 1 ,min: 1, max: 3 },
    "熔岩精華": { chance: 0.30, min: 1, max: 2 },
    "火成岩碎片": { chance: 0.20 },
    "熔岩精華": { chance: 0.18 }
  },

  // 異常狀態（玩家用，走 status_manager_player.js）
  extra: {
    burn: true,         // 燃燒 DoT
    burnChance: 12,     // %
    buff: { 
      atkBuff: true, 
    defBuff: true }
  },

  // 內部狀態（面板/顯示相容欄位）
  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  // 單階段王：controller 只處理優先序
  controller(monster, currentHP) {
    const needAtk = BossCore.getBuffTurns(monster, "atk") <= 0
                 && BossCore.getSkillCooldown(monster, "atk-buff") <= 0;
    const needDef = BossCore.getBuffTurns(monster, "def") <= 0
                 && BossCore.getSkillCooldown(monster, "def-buff") <= 0;

    if (needAtk) {
      monster.nextSkill = this.skills.find(s => s.key === "atk-buff");
      return;
    }
    if (needDef) {
      monster.nextSkill = this.skills.find(s => s.key === "def-buff");
      return;
    }

    // 攻擊優先：重擊 > 快打 > 普攻
    if (BossCore.getSkillCooldown(monster, "magma-hammer") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "magma-hammer");
    } else if (BossCore.getSkillCooldown(monster, "lava-splash") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "lava-splash");
    } else {
      monster.nextSkill = this.skills.find(s => s.key === "basic");
    }
  },

  // 技能：單計時器（持續 + 額外冷卻），普攻保底
  skills: [
    // 普攻
    {
      key: "basic",
      name: "炎拳",
      description: "造成 100% 傷害（無冷卻）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
        logPrepend(`👊 ${m.name} 揮出炙熱炎拳！`);
        return dmg;
      }
    },

    // ATK Buff（例：×2，持續5+冷卻6 → 一次設 11）
    {
      key: "atk-buff",
      name: "熔心狂怒",
      description: "攻擊力×2.0，持續5回合（冷卻6回合）",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { atk: { mul: 2.0, duration: 5 } });
        BossCore.setSkillCooldown(m, "atk-buff", 5 + 6);
        logPrepend(`💢 ${m.name} 熔心沸騰！ATK 提升至 ${m.atk}！`);
        return 0;
      }
    },

    // DEF Buff（例：×1.8，持續5+冷卻7 → 一次設 12）
    {
      key: "def-buff",
      name: "岩殼硬化",
      description: "防禦力×1.8，持續5回合（冷卻7回合）",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { def: { mul: 1.8, duration: 5 } });
        BossCore.setSkillCooldown(m, "def-buff", 5 + 7);
        logPrepend(`🛡️ ${m.name} 岩殼硬化！DEF 提升至 ${m.def}！`);
        return 0;
      }
    },

    // 快打：CD 3
    {
      key: "lava-splash",
      name: "熔岩噴濺",
      description: "造成 190% 傷害（冷卻 3 回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.9);
        BossCore.setSkillCooldown(m, "lava-splash", 3);
        logPrepend(`🌋 ${m.name} 噴濺滾燙岩漿！`);
        return dmg;
      }
    },

    // 重擊：CD 9
    {
      key: "magma-hammer",
      name: "熔鎚重擊",
      description: "造成 380% 傷害（冷卻 9 回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 3.8);
        BossCore.setSkillCooldown(m, "magma-hammer", 9);
        logPrepend(`🔨 ${m.name} 揮下熔鎚，地面震顫！`);
        return dmg;
      }
    }
  ],

  // 回合結束：BossCore 統一遞減
  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  // 初始化：先 BossCore.init
  init(monster) {
    BossCore.init(monster);               // 🔑 必須
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}

// ... (mapBossPool 的結尾)

],



  aqua: [
  // 森林王.js
// 簡潔版 Boss 物件，所有核心狀態由 boss_core.js 管理。

{
  name: "海淵之皇",
  isMapBoss: true,
  level: 30,
  hp: 16000,
  atk: 260,
  def: 180,
  baseExp: 300,
  baseGold: 980,
  encounterRate: 8,

  dropRates: {
    gold:  { min: 300, max: 480 },
    stone: { chance: 1, min: 30, max: 60 },
    "低階潛能解放鑰匙": { chance: 0.25 , min: 1, max: 5},
    "鑽石抽獎券": { chance: 1 ,min: 1, max: 4 },
    "天水精華": { chance: 0.30, min: 1, max: 2 },
    "寒冰碎片": { chance: 0.22 },
    "潮汐之心": { chance: 0.18 }
  },

  extra: { freeze: true, freezeChance: 14 },

  // 顯示相容欄位
  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  // AI 順序：血低先補血（且就緒）→ 沒在狂潮且就緒 → 攻擊技就緒 → 普攻
  controller(monster, currentHP) {
    const hpNow = currentHP ?? monster.hp ?? monster.maxHp;
    const hpPct = (hpNow / (monster.maxHp || 1));

    const canHeal   = BossCore.getSkillCooldown(monster, "abyss-heal")   <= 0;
    const frenzyOn  = BossCore.getBuffTurns(monster, "atk") > 0 || BossCore.getBuffTurns(monster, "def") > 0;
    const canFrenzy = BossCore.getSkillCooldown(monster, "abyss-frenzy") <= 0;
    const canCleave = BossCore.getSkillCooldown(monster, "abyss-cleave") <= 0;

    if (hpPct <= 0.6 && canHeal) {
      monster.nextSkill = this.skills.find(s => s.key === "abyss-heal");
      return;
    }
    if (!frenzyOn && canFrenzy) {
      monster.nextSkill = this.skills.find(s => s.key === "abyss-frenzy");
      return;
    }
    if (canCleave) {
      monster.nextSkill = this.skills.find(s => s.key === "abyss-cleave");
      return;
    }
    monster.nextSkill = this.skills.find(s => s.key === "basic");
  },

  skills: [
    // 普攻（保底）
    {
  key: "basic",
  name: "潮刃平斬",
  description: "造成 100% 傷害（無冷卻）",
  castChance: 100,
  use: (p, m) => {
    const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
    logPrepend(`🌊 ${m.name} 揮出潮刃！`);
    return dmg; // 直接回傳數字，讓外層拿到正確傷害
  }
},

    // 唯一攻擊技：CD 4（以 baseAtk 計，避免吃到 ATK buff 再加成一次）
    {
      key: "abyss-cleave",
      name: "渦淵斬潮",
      description: "造成 240% 傷害（冷卻 4 回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 2.4);
        BossCore.setSkillCooldown(m, "abyss-cleave", 4);
        logPrepend(`💦 ${m.name} 以渦潮重斬席捲！`);
        return dmg;
      }
    },

    // 狂潮覺醒：ATK×3、DEF×0.3 持續 4 回合，CD 12
    {
      key: "abyss-frenzy",
      name: "狂潮覺醒",
      description: "攻擊×3、防禦×0.3（持續 4 回合，冷卻 12 回合）",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, {
          atk: { mul: 3.0, duration: 4 },
          def: { mul: 0.3, duration: 4 }
        });
        BossCore.setSkillCooldown(m, "abyss-frenzy", 12);
        logPrepend(`🌊 ${m.name} 狂潮覺醒！ATK 提升至 ${m.atk}，DEF 降至 ${m.def}！`);
        return { name: "狂潮覺醒", handled: true, rawDamage: 0 };
      }
    },

    // 回復：回復 20% 最大 HP，CD 15
    {
      key: "abyss-heal",
      name: "深淵回潮",
      description: "回復 20% 最大 HP（冷卻 15 回合）",
      castChance: 100,
      use: (p, m) => {
        const max = m.maxHp || m.hp || 1;
        const heal = Math.max(1, Math.floor(max * 0.20));

        // 嘗試直接回復面板 HP（供 UI 即時看到）
        m.hp = Math.min(max, (m.hp || max) + heal);

        // 若外層使用獨立的 monsterHP（rpg.js），這段讓自動戰鬥也能立刻看到血回上去
        try {
          if (typeof window !== "undefined" && "monsterHP" in window) {
            // @ts-ignore
            window.monsterHP = Math.min(max, (window.monsterHP || m.hp) + heal);
          }
        } catch(_) {}

        BossCore.setSkillCooldown(m, "abyss-heal", 15);
        logPrepend(`💧 ${m.name} 引動潮汐治癒，自身回復 ${heal} HP！`);
        return { name: "深淵回潮", handled: true, rawDamage: 0, healed: heal };
      }
    }
  ],

  // 回合結束：交給 BossCore 遞減（buff 回合、技能 CD）
  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  // 初始化
  init(monster) {
    BossCore.init(monster);
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}

// ... (mapBossPool 的結尾)
],

 wind : [
   {
  name: "風之守衛者",
  isMapBoss: true,
  level: 35,
  hp: 4800,         // 血量低
  atk: 95,          // 攻擊低
  def: 220,         // 防禦高
  baseExp: 400,
  baseGold: 900,
  encounterRate: 8,

  dropRates: {
    gold: { min: 200, max: 380 },
    stone: { chance: 1, min: 28, max: 55 },
    "中階潛能解放鑰匙": { chance: 0.25, min: 1, max: 3 },
    "鑽石抽獎券": { chance: 1 ,min: 2, max: 5 },
    "風之羽": { chance: 0.30, min: 1, max: 2 },
    "蒼翠碎片": { chance: 0.22 },
    "風靈精華": { chance: 0.18 }
  },

  extra: {
    weaken: true,   // 可施加虛弱
    buff: { defBuff: true }
  },

  // 內部狀態
  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  controller(monster, currentHP) {
    // 先判斷 Buff 類技能
    const needDef = BossCore.getBuffTurns(monster, "def") <= 0
                 && BossCore.getSkillCooldown(monster, "def-buff") <= 0;
    if (needDef) {
      monster.nextSkill = this.skills.find(s => s.key === "def-buff");
      return;
    }

    // 再判斷攻擊技能
    if (BossCore.getSkillCooldown(monster, "wind-slash") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "wind-slash");
      return;
    }

    // 最後普攻
    monster.nextSkill = this.skills.find(s => s.key === "basic");
  },

  skills: [
    // 普攻
    {
      key: "basic",
      name: "風刃斬擊",
      description: "造成 100% 傷害（無冷卻）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
        logPrepend(`💨 ${m.name} 揮出疾風斬擊！`);
        return dmg;
      }
    },

    // 防禦 Buff
    {
      key: "def-buff",
      name: "颶風壁障",
      description: "防禦力×10，持續 5 回合（冷卻 13 回合）",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { def: { mul: 10.0, duration: 5 } });
        BossCore.setSkillCooldown(m, "def-buff", 5 + 13);
        logPrepend(`🛡️ ${m.name} 聚攏風牆！DEF 突增至 ${m.def}！`);
        return 0;
      }
    },

    // 攻擊技能（附帶虛弱）
    {
      key: "wind-slash",
      name: "颶風裂斬",
      description: "造成 120% 傷害，20% 機率附加【虛弱】（冷卻 6 回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.2);
        BossCore.setSkillCooldown(m, "wind-slash", 6);
        logPrepend(`🌪️ ${m.name} 釋放颶風裂斬！`);
        // 20% 機率施加虛弱
        if (Math.random() < 0.2) {
          if (typeof applyPlayerStatus === "function") {
            applyPlayerStatus("weaken", 2); // 假設虛弱持續 2 回合
            logPrepend("⚠️ 你被【虛弱】影響，攻擊力下降！");
          }
        }
        return dmg;
      }
    }
  ],

  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  init(monster) {
    BossCore.init(monster);
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}
  ],
 lightning : [
   {
  name: "雷霆之王",
  isMapBoss: true,
  level: 0,
  hp: 16000,
  atk: 180,
  def: 110,
  baseExp: 520,      // 用固定值，避免 EXP 爆衝（已配合你剛剛的夾制邏輯）
  baseGold: 700,
  encounterRate: 8,

  dropRates: {
    gold:  { min: 260, max: 420 },
    stone: { chance: 1, min: 32, max: 64 },
    // ★ 中階素材
    
    "中階潛能解放鑰匙": { chance: 0.25 , min: 1, max: 3 },
    "鑽石抽獎券": { chance: 1 ,min: 2, max: 6 },
    "雷光精華": { chance: 0.30, min: 1, max: 2 },
    "雷電碎片": { chance: 0.22 },
    "天雷之心": { chance: 0.18 }
  },

  // 讓異常由全域 applyStatusFromMonster 處理（20% 麻痺）
  extra: {
    paralyze: true,
    paralyzeChance: 20,
    buff: { atkBuff: true, defBuff: true }
  },

  // 面板相容欄位
  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  // AI：優先維持攻擊增幅 > 特技落雷 > 防禦增幅 > 普攻
  controller(monster, currentHP) {
    const needAtk = BossCore.getBuffTurns(monster, "atk") <= 0
                 && BossCore.getSkillCooldown(monster, "atk-buff") <= 0;
    const needDef = BossCore.getBuffTurns(monster, "def") <= 0
                 && BossCore.getSkillCooldown(monster, "def-buff") <= 0;

    if (needAtk) {
      monster.nextSkill = this.skills.find(s => s.key === "atk-buff"); return;
    }
    if (BossCore.getSkillCooldown(monster, "thunder-crash") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "thunder-crash"); return;
    }
    if (needDef) {
      monster.nextSkill = this.skills.find(s => s.key === "def-buff"); return;
    }
    monster.nextSkill = this.skills.find(s => s.key === "basic");
  },

  skills: [
    // 普攻
    {
      key: "basic",
      name: "雷擊斬",
      description: "造成 100% 傷害（無冷卻）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
        logPrepend(`⚡ ${m.name} 釋放雷擊斬！`);
        return dmg;
      }
    },

    // 攻擊增幅：×2.2 持續 4 回合，冷卻 10（4+6）
    {
      key: "atk-buff",
      name: "雷霆增幅",
      description: "攻擊力×2.2，持續4回合（冷卻6回合）",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { atk: { mul: 2.2, duration: 4 } });
        BossCore.setSkillCooldown(m, "atk-buff", 10);
        logPrepend(`💥 ${m.name} 雷能暴漲！ATK 提升至 ${m.atk}！`);
        return 0;
      }
    },

    // 防禦增幅：×1.6 持續 3 回合，冷卻 9
    {
      key: "def-buff",
      name: "導電護盾",
      description: "防禦力×1.6，持續3回合（冷卻9回合）",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { def: { mul: 1.6, duration: 3 } });
        BossCore.setSkillCooldown(m, "def-buff", 9);
        logPrepend(`🛡️ ${m.name} 釋放導電護盾！DEF 提升至 ${m.def}！`);
        return 0;
      }
    },

    // 特技：雷霆落擊 200%（CD 4），異常由 extra.paralyzeChance 交由外層處理
    {
      key: "thunder-crash",
      name: "雷霆落擊",
      description: "造成 200% 傷害（冷卻4回合），有機率造成麻痺",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 2.0);
        BossCore.setSkillCooldown(m, "thunder-crash", 4);
        logPrepend(`🌩️ ${m.name} 召喚雷霆落擊！`);
        return dmg;
      }
    },
  ],

  // 回合收尾
  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  // 初始化
  init(monster) {
    BossCore.init(monster);
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}
  ],

 ice : [
   {
  name: "冰霜之王",
  isMapBoss: true,
  level: 60,
  hp: 20000,     // ❄️ 血量你自己掌控，這裡先放個參考值
  atk: 280,      // 攻擊：隨等級提高
  def: 350,      // 防禦：隨等級提高（冰屬 Boss 偏高防）
  baseExp: 800, // 基礎 EXP，會再被等級倍率放大
  baseGold: 2400,
  encounterRate: 8,

  dropRates: {
    gold: { min: 400, max: 600 },
    stone: { chance: 1, min: 40, max: 80 },
    "中階潛能解放鑰匙": { chance: 0.20 , min: 1, max: 3}, 
    "鑽石抽獎券": { chance: 1 ,min: 3, max: 7 },
    "冰霜精華": { chance: 0.35, min: 1, max: 3 },
    "寒鐵碎片": { chance: 0.25 },
    "永凍之心": { chance: 0.15 }
  },

  extra: {
    freeze: true,       // 有機率冰凍玩家
    freezeChance: 18,   // %
    buff: { defBuff: true }
  },

  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  controller(monster, currentHP) {
    const needDef = BossCore.getBuffTurns(monster, "def") <= 0
                 && BossCore.getSkillCooldown(monster, "def-buff") <= 0;

    if (needDef) {
      monster.nextSkill = this.skills.find(s => s.key === "def-buff");
      return;
    }

    if (BossCore.getSkillCooldown(monster, "ice-storm") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "ice-storm");
    } else {
      monster.nextSkill = this.skills.find(s => s.key === "basic");
    }
  },

  skills: [
    {
      key: "basic",
      name: "冰刃斬擊",
      description: "造成 100% 傷害（無冷卻）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
        logPrepend(`🪓 ${m.name} 揮出覆冰的巨斧！`);
        return dmg;
      }
    },
    {
      key: "def-buff",
      name: "寒霜護甲",
      description: "防禦力 ×3.5，持續5回合（冷卻7回合）",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { def: { mul: 3.5, duration: 5 } });
        BossCore.setSkillCooldown(m, "def-buff", 12); // 5 + 7
        logPrepend(`🛡️ ${m.name} 被厚重冰霜包裹，防禦大幅提升！`);
        return 0;
      }
    },
    {
      key: "ice-storm",
      name: "冰霜風暴",
      description: "造成 240% 傷害，有25%機率冰凍目標2回合（冷卻6回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 2.4);
        if (Math.random() < 0.25) {
          applyAbnormalStatus(p, "freeze", 2);
          logPrepend(`❄️ ${m.name} 釋放暴風雪，${p.name} 被凍結住了！`);
        } else {
          logPrepend(`❄️ ${m.name} 釋放暴風雪！`);
        }
        BossCore.setSkillCooldown(m, "ice-storm", 6);
        return dmg;
      }
    }
  ],

  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  init(monster) {
    BossCore.init(monster);
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}
  ],

 shadow : [
   {
  name: "黯影之王",
  isMapBoss: true,
  level: 80,
  hp: 25000,       // 🖤 由你自行掌控，這裡放個參考值
  atk: 360,
  def: 320,
  baseExp: 2600,
  baseGold: 3200,
  encounterRate: 100,

  dropRates: {
    gold: { min: 600, max: 900 },
    stone: { chance: 1, min: 60, max: 100 },
    "高階潛能解放鑰匙": { chance: 0.20 , min: 1, max: 3},
    "鑽石抽獎券": { chance: 1 ,min: 4, max: 8 },
    "暗影精華": { chance: 0.30, min: 1, max: 3 },
    "虛空碎片": { chance: 0.25 },
    "暗黑之核": { chance: 0.12 }
  },

  extra: {
    blind: true,        // 有機率致盲玩家
    blindChance: 15,    // %
    buff: { evasion: true } // 額外支援閃避 Buff
  },

  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  controller(monster, currentHP) {
    const needEvasion = BossCore.getBuffTurns(monster, "evasion") <= 0
                     && BossCore.getSkillCooldown(monster, "shadow-veil") <= 0;

    if (needEvasion) {
      monster.nextSkill = this.skills.find(s => s.key === "shadow-veil");
      return;
    }

    if (BossCore.getSkillCooldown(monster, "dark-slash") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "dark-slash");
    } else {
      monster.nextSkill = this.skills.find(s => s.key === "basic");
    }
  },

  skills: [
    {
      key: "basic",
      name: "暗影斬擊",
      description: "造成 100% 傷害（無冷卻）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
        logPrepend(`⚔️ ${m.name} 揮出暗影斬擊！`);
        return dmg;
      }
    },
    {
  key: "shadow-veil",
  name: "影幕",
  description: "自身迴避率提升至 100%，持續 3 回合（冷卻 15 回合）",
  castChance: 100,
  use: (p, m) => {
    // 疊的是「evasion」這個 key，BossCore 會聚合給 getStat 用
    BossCore.applyFromSkill(m, {
      buffs: { key: "evasion", mode: "add", value: 100, duration: 3 }
    });
    BossCore.setSkillCooldown(m, "shadow-veil", 15);
    logPrepend(`🌫️ ${m.name} 展開影幕，化為殘影！`);
    return 0; // 這招是 Buff，不做傷害
  }
},
    {
      key: "dark-slash",
      name: "黯影連斬",
      description: "造成 220% 傷害，有 20% 機率使目標致盲（冷卻 5 回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 2.2);
        if (Math.random() < 0.20) {
          applyAbnormalStatus(p, "blind", 2);
          logPrepend(`💥 ${m.name} 斬擊帶出黑霧，使 ${p.name} 視線模糊！`);
        } else {
          logPrepend(`💥 ${m.name} 釋放黯影連斬！`);
        }
        BossCore.setSkillCooldown(m, "dark-slash", 5);
        return dmg;
      }
    }
  ],

  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  init(monster) {
    BossCore.init(monster);
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}
  ],

hell : [
  {
  name: "煉獄之主",
  isMapBoss: true,
  level: 85,              // 80+ 地圖王
  hp: 27000,             
  atk: 420,
  def: 160,
  baseExp: 1200,          
  baseGold: 980,
  encounterRate: 8,

  dropRates: {
    gold:  { min: 480, max: 820 },
    stone: { chance: 1, min: 60, max: 96 },
    "高階潛能解放鑰匙": { chance: 0.18, min: 1, max: 2 },          // 高階鑰匙（此地圖開始掉）
    "鑽石抽獎券": { chance: 1 ,min: 5, max: 10 },
    "煉獄精華": { chance: 0.36, min: 1, max: 2 },
    "焦灼碎片": { chance: 0.24 },
    "暗黑之核": { chance: 0.20 }
  },

  // 內建異常（給玩家）：燃燒
  extra: {
    burn: true,
    burnChance: 18,
    buff: { atkBuff: true, defBuff: true }
  },

  // 面板/顯示相容欄位（不用改）
  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  // 出招優先：先檢查攻擊姿態→血量掉到 60% 以下嘗試回血→重擊→普攻
  controller(monster, currentHP) {
    const needAtkStance = BossCore.getBuffTurns(monster, "atk") <= 0
                       && BossCore.getSkillCooldown(monster, "purgatory-stance") <= 0;

    const canHeal = (currentHP <= (monster.maxHp || monster.hp) * 0.6)
                 && BossCore.getSkillCooldown(monster, "hell-rebirth") <= 0;

    if (needAtkStance) {
      monster.nextSkill = this.skills.find(s => s.key === "purgatory-stance");
      return;
    }
    if (canHeal) {
      monster.nextSkill = this.skills.find(s => s.key === "hell-rebirth");
      return;
    }
    if (BossCore.getSkillCooldown(monster, "meteor-of-hell") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "meteor-of-hell");
      return;
    }
    monster.nextSkill = this.skills.find(s => s.key === "basic");
  },

  // 技能（照模板：use 返回實際傷害；Buff 用 BossCore.applyFromSkill）
  skills: [
    // 普攻
    {
      key: "basic",
      name: "獄炎斬",
      description: "造成 100% 傷害（無冷卻）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
        logPrepend(`🔥 ${m.name} 揮出獄炎斬！`);
        return dmg;
      }
    },

    // 攻擊姿態：ATK ×3、DEF -70%，持續 4 回合，冷卻 15 回合
    {
      key: "purgatory-stance",
      name: "煉獄狂焰",
      description: "攻擊×3、降低 70% 防禦（4 回合）；冷卻 15 回合",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, {
          atk: { mul: 3.0, duration: 4 },
          def: { mul: 0.30, duration: 4 } // 只留 30% 原防禦 = -70%
        });
        BossCore.setSkillCooldown(m, "purgatory-stance", 15);
        logPrepend(`💥 ${m.name} 進入煉獄狂焰！ATK 提升至 ${m.atk}，DEF 降至 ${m.def}！`);
        return 0;
      }
    },

    // 回復：恢復 20% 最大生命，冷卻 15 回合
    {
      key: "hell-rebirth",
      name: "獄炎新生",
      description: "恢復 20% 最大 HP；冷卻 15 回合",
      castChance: 100,
      use: (p, m) => {
        const maxHp = m.maxHp || m.hp;
        const heal = Math.max(1, Math.floor(maxHp * 0.20));
        m.hp = Math.min(maxHp, (m.hp || 0) + heal);
        BossCore.setSkillCooldown(m, "hell-rebirth", 15);
        logPrepend(`🩸 ${m.name} 借獄炎重生，回復 ${heal} HP！`);
        return 0;
      }
    },

    // 重擊：320% 傷害，冷卻 6 回合
    {
      key: "meteor-of-hell",
      name: "炎獄隕石",
      description: "造成 320% 傷害（冷卻 6 回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 3.2);
        BossCore.setSkillCooldown(m, "meteor-of-hell", 6);
        logPrepend(`☄️ ${m.name} 召喚炎獄隕石轟擊！`);
        return dmg;
      }
    }
  ],

  // 回合結束：交給 BossCore 遞減 buff/CD
  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  // 初始化（必須先 init，並補齊顯示欄位）
  init(monster) {
    BossCore.init(monster);
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}
],
holy:[{
  name: "聖輝大天使",
  isMapBoss: true,
  level: 95,              // Holy 地圖王
  hp: 30000,             // 血量你可再調；只吃難度倍率
  atk: 460,
  def: 220,
  baseExp: 1400,          // 基礎值（實際結算在 getDrop() 乘難度/玩家加成）
  baseGold: 1100,
  encounterRate: 8,

  dropRates: {
    gold:  { min: 620, max: 980 },
    stone: { chance: 1, min: 68, max: 108 },
    "高階潛能解放鑰匙": { chance: 0.18, min: 1, max: 2 },
    "鑽石抽獎券": { chance: 1 ,min: 6, max: 11 },
    "聖光精華": { chance: 0.36, min: 1, max: 2 },
    "聖徽碎片": { chance: 0.24 },
    "純白之核": { chance: 0.20 }
  },

  // 內建異常給玩家（選配）：神聖灼燒 = 輕微 DoT
  extra: {
    burn: true,
    burnChance: 10,
    buff: { atkBuff: true, defBuff: true }
  },

  // 顯示相容欄位
  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  // 出招邏輯：先補強(聖域壁) → 低血量補血 → 重擊 → 普攻
  controller(monster, currentHP) {
    const needDef = BossCore.getBuffTurns(monster, "def") <= 0
                 && BossCore.getSkillCooldown(monster, "holy-aegis") <= 0;

    const needAtk = BossCore.getBuffTurns(monster, "atk") <= 0
                 && BossCore.getSkillCooldown(monster, "divine-might") <= 0;

    const canHeal = (currentHP <= (monster.maxHp || monster.hp) * 0.55)
                 && BossCore.getSkillCooldown(monster, "sanctuary-heal") <= 0;

    if (needDef) { monster.nextSkill = this.skills.find(s => s.key === "holy-aegis"); return; }
    if (needAtk) { monster.nextSkill = this.skills.find(s => s.key === "divine-might"); return; }
    if (canHeal) { monster.nextSkill = this.skills.find(s => s.key === "sanctuary-heal"); return; }

    if (BossCore.getSkillCooldown(monster, "judgement-spear") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "judgement-spear"); return;
    }
    monster.nextSkill = this.skills.find(s => s.key === "basic");
  },

  // 技能（照你的模板：Buff 用 BossCore.applyFromSkill；攻擊/回血要 return 數值）
  skills: [
    // 普攻
    {
      key: "basic",
      name: "聖刃斬",
      description: "造成 100% 傷害（無冷卻）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
        logPrepend(`⚔️ ${m.name} 揮出聖刃斬！`);
        return dmg;
      }
    },

    // 防禦姿態：DEF ×2.5（含護甲加倍感），持續 5 回合，冷卻 13 回合
    {
      key: "holy-aegis",
      name: "聖域壁",
      description: "防禦×2.5（5 回合）；冷卻 13 回合",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { def: { mul: 2.5, duration: 5 } });
        BossCore.setSkillCooldown(m, "holy-aegis", 13);
        logPrepend(`🛡️ ${m.name} 展開聖域壁！DEF 提升至 ${m.def}！`);
        return 0;
      }
    },

    // 攻擊姿態：ATK ×2（較穩定），持續 4 回合，冷卻 10 回合
    {
      key: "divine-might",
      name: "神威降臨",
      description: "攻擊×2（4 回合）；冷卻 10 回合",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { atk: { mul: 2.0, duration: 4 } });
        BossCore.setSkillCooldown(m, "divine-might", 10);
        logPrepend(`✨ ${m.name} 神威加身！ATK 提升至 ${m.atk}！`);
        return 0;
      }
    },

    // 重擊：360% 傷害，冷卻 7 回合
    {
      key: "judgement-spear",
      name: "審判之槍",
      description: "造成 360% 傷害（冷卻 7 回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 3.6);
        BossCore.setSkillCooldown(m, "judgement-spear", 7);
        logPrepend(`🔱 ${m.name} 投擲審判之槍！`);
        return dmg;
      }
    },

    // 回復：30% 最大 HP，冷卻 16 回合
    {
      key: "sanctuary-heal",
      name: "聖所恩澤",
      description: "恢復 30% 最大 HP（冷卻 16 回合）",
      castChance: 100,
      use: (p, m) => {
        const maxHp = m.maxHp || m.hp;
        const heal = Math.max(1, Math.floor(maxHp * 0.30));
        m.hp = Math.min(maxHp, (m.hp || 0) + heal);
        BossCore.setSkillCooldown(m, "sanctuary-heal", 16);
        logPrepend(`💖 ${m.name} 受聖所恩澤回復 ${heal} HP！`);
        return 0;
      }
    }
  ],

  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  init(monster) {
    BossCore.init(monster);
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}],

core:[
  {
  name: "虛空支配者",
  isMapBoss: true,
  level: 100,              // Core 最終王
  hp: 35000,              // 血量建議高一點，你也可自行調
  atk: 520,
  def: 250,
  baseExp: 2000,
  baseGold: 1500,
  encounterRate: 8,

  dropRates: {
    gold:  { min: 800, max: 1200 },
    stone: { chance: 1, min: 80, max: 120 },
    "高潛能解放鑰匙": { chance: 0.30, min: 1, max: 3 },
    "鑽石抽獎券": { chance: 1 ,min: 7, max: 12 },
    "核心精華": { chance: 0.30, min: 1, max: 2 },
    "暗黑之核": { chance: 0.25 },
    "元素碎片": { chance: 0.20 }
  },

  extra: {
    buff: { atkBuff: true, defBuff: true },
    special: "虛空共鳴"
  },

  baseAtk: null,
  baseDef: null,
  naturalDef: null,
  _enragedTurns: 0,
  _enrageMul: 1,
  _rootShieldTurns: 0,
  _shieldMul: 1,

  controller(monster, currentHP) {
    const needDef = BossCore.getBuffTurns(monster, "def") <= 0
                 && BossCore.getSkillCooldown(monster, "void-barrier") <= 0;

    const needAtk = BossCore.getBuffTurns(monster, "atk") <= 0
                 && BossCore.getSkillCooldown(monster, "chaos-power") <= 0;

    const canHeal = (currentHP <= (monster.maxHp || monster.hp) * 0.50)
                 && BossCore.getSkillCooldown(monster, "void-heal") <= 0;

    if (needDef) { monster.nextSkill = this.skills.find(s => s.key === "void-barrier"); return; }
    if (needAtk) { monster.nextSkill = this.skills.find(s => s.key === "chaos-power"); return; }
    if (canHeal) { monster.nextSkill = this.skills.find(s => s.key === "void-heal"); return; }

    if (BossCore.getSkillCooldown(monster, "annihilation") <= 0) {
      monster.nextSkill = this.skills.find(s => s.key === "annihilation"); return;
    }
    monster.nextSkill = this.skills.find(s => s.key === "basic");
  },

  skills: [
    {
      key: "basic",
      name: "虛空斬擊",
      description: "造成 100% 傷害（無冷卻）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 1.0);
        logPrepend(`⚔️ ${m.name} 釋放虛空斬擊！`);
        return dmg;
      }
    },

    // 防禦技能：提升 DEF ×3，持續 5 回合，CD 12
    {
      key: "void-barrier",
      name: "虛空壁壘",
      description: "防禦×3（5 回合）；冷卻 12 回合",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { def: { mul: 3.0, duration: 5 } });
        BossCore.setSkillCooldown(m, "void-barrier", 12);
        logPrepend(`🛡️ ${m.name} 展開虛空壁壘！DEF 提升至 ${m.def}！`);
        return 0;
      }
    },

    // 攻擊技能：ATK ×2.5，持續 4 回合，CD 10
    {
      key: "chaos-power",
      name: "混沌增幅",
      description: "攻擊×2.5（4 回合）；冷卻 10 回合",
      castChance: 100,
      use: (p, m) => {
        BossCore.applyFromSkill(m, { atk: { mul: 2.5, duration: 4 } });
        BossCore.setSkillCooldown(m, "chaos-power", 10);
        logPrepend(`💥 ${m.name} 力量爆發！ATK 提升至 ${m.atk}！`);
        return 0;
      }
    },

    // 終極技能：450% 傷害，CD 8
    {
      key: "annihilation",
      name: "湮滅一擊",
      description: "造成 450% 傷害（冷卻 8 回合）",
      castChance: 100,
      use: (p, m) => {
        const dmg = Math.round((m.baseAtk ?? m.atk) * 4.5);
        BossCore.setSkillCooldown(m, "annihilation", 8);
        logPrepend(`☄️ ${m.name} 釋放湮滅一擊！`);
        return dmg;
      }
    },

    // 回復技能：回復 25% 最大 HP，CD 15
    {
      key: "void-heal",
      name: "虛空回溯",
      description: "恢復 25% 最大 HP（冷卻 15 回合）",
      castChance: 100,
      use: (p, m) => {
        const maxHp = m.maxHp || m.hp;
        const heal = Math.max(1, Math.floor(maxHp * 0.25));
        m.hp = Math.min(maxHp, (m.hp || 0) + heal);
        BossCore.setSkillCooldown(m, "void-heal", 15);
        logPrepend(`💖 ${m.name} 回溯虛空能量，恢復 ${heal} HP！`);
        return 0;
      }
    }
  ],

  _tickEndTurn(mon) { BossCore.endTurn(mon); },

  init(monster) {
    BossCore.init(monster);
    if (monster.baseAtk == null) monster.baseAtk = monster.atk;
    if (monster.baseDef == null) monster.baseDef = monster.def;
    if (monster.naturalDef == null) monster.naturalDef = monster.def;
    monster._enragedTurns = 0;
    monster._rootShieldTurns = 0;
    monster.skills = this.skills;
  }
}
],

};
