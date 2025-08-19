// skills_thief.js

// === 攻擊：影刃連擊（五階 / 10,30,50,70,100）===
// 盜賊—影刃連擊（五階進化）
// 盜賊 — 影刃連擊（五階進化，含MP與冷卻顯示、幸運加成上限200%）
registerJobSkill('thief', {
  job: "thief",
  id: "shadowFlurry",
  name: "影刃連擊",
  type: "attack",
  level: 1,
  maxLevel: 20,
  currentTier: 0,
  evolveLevels: [10, 30, 50, 70, 100],
  mpCost: 20,           // 只是頂層預設，不會用來顯示
  cooldown: 10,         // 只是頂層預設，不會用來顯示
  currentCooldown: 0,

  // 說明：
  // damageMultiplier：每段基礎倍率
  // levelMultiplier ：每級提高的每段倍率
  // hits            ：段數
  // ignoreDef       ：無視防禦(小數) 例 0.18 = 18%
  // critChance      ：技能額外爆率(小數)
  // critDamage      ：技能額外爆傷(小數) → 1 + critDamage 作為乘算
  // lukScale        ：每點LUK帶來的總傷加成(小數)；最終總和封頂 +200%（×3.0）
  tiers: [
    { name: "影刃連擊", mpCost: 20, cooldown: 10, logic: { damageMultiplier: 0.60, hits: 2, levelMultiplier: 0.05, ignoreDef: 0.18, critChance: 0.15, critDamage: 0.50, lukScale: 0.0012 } },
    { name: "雙影穿刺", mpCost: 26, cooldown: 8,  logic: { damageMultiplier: 0.66, hits: 3, levelMultiplier: 0.05, ignoreDef: 0.20, critChance: 0.18, critDamage: 0.55, lukScale: 0.0012 } },
    { name: "三殘影斬", mpCost: 32, cooldown: 6,  logic: { damageMultiplier: 0.72, hits: 4, levelMultiplier: 0.05, ignoreDef: 0.22, critChance: 0.21, critDamage: 0.60, lukScale: 0.0012 } },
    { name: "瞬連影殺", mpCost: 38, cooldown: 4,  logic: { damageMultiplier: 0.78, hits: 5, levelMultiplier: 0.05, ignoreDef: 0.24, critChance: 0.24, critDamage: 0.65, lukScale: 0.0012 } },
    { name: "六影亂舞", mpCost: 44, cooldown: 0,  logic: { damageMultiplier: 0.84, hits: 6, levelMultiplier: 0.05, ignoreDef: 0.26, critChance: 0.27, critDamage: 0.70, lukScale: 0.0012 } }
  ],

  use(monster) {
    const t = getActiveTier(this);

    // 同步到頂層欄位（讓其它地方讀到正確名稱/CD）
    this.name = t.name;
    this.cooldown = (typeof t.cooldown === "number") ? t.cooldown : (this.cooldown ?? 0);

    // 成本（這招沒有等級成長消耗，保留寫法一致）
    const mpGrow = (t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    const cost = (t.mpCost || 0) + mpGrow;
    this.mpCost = cost;

    // === 傷害計算 ===
    // 每段倍率（會隨等級提高）
    const perHit = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);

    // 幸運總傷加成：每點LUK +0.12%，總和上限+200%（= ×3.0）
    const luk = (player.baseStats?.luk ?? 0);
    const lukBonus = Math.min(2.0, luk * (t.logic.lukScale || 0)); // 0 ~ 2.0
    const lukAmp = 1 + lukBonus; // ×1.00 ~ ×3.00

    // 無視防禦
    const effDef = Math.floor((monster.def || 0) * (1 - (t.logic.ignoreDef || 0)));
    const base = Math.max(player.totalStats.atk - effDef, 1);

    let total = 0;
    for (let i = 0; i < (t.logic.hits || 1); i++) {
      // 每段針對爆擊再各自抽一次
      const extraCritRate = (t.logic.critChance || 0);
      const finalCrit = Math.min(1, Math.max(0, (player.totalStats?.critRate || 0) + extraCritRate));
      const isCrit = Math.random() < finalCrit;
      const critAmp = isCrit ? (1 + (t.logic.critDamage || 0) + (player.totalStats?.critMultiplier || 0)) : 1;

      const dmg = Math.floor(base * perHit * lukAmp * critAmp);
      monster.hp -= dmg;
      total += dmg;
      if (monster.hp <= 0) break;
    }

    logPrepend?.(
      `🗡️ ${t.name}（${t.logic.hits} 段｜無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜` +
      `技能爆率 +${Math.round((t.logic.critChance||0)*100)}%｜技能爆傷 +${Math.round((t.logic.critDamage||0)*100)}%｜` +
      `LUK加成 ×${lukAmp.toFixed(2)}）共 ${total} 傷害！`
    );

    spendAndCooldown(this, cost);
    return total;
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const t = getActiveTier(this);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1)) * 100;

    // 顯示時也要正確計算 MP / CD（不要依賴 use）
    const mpGrow = (t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    const cost = (t.mpCost || 0) + mpGrow;
    const cd = (typeof t.cooldown === "number") ? t.cooldown : 0;

    const lukPer = ((t.logic.lukScale || 0) * 100).toFixed(2); // 每點 LUK 增幅 %
    return `【${t.name}】${t.logic.hits} 段，每段約 ${Math.round(per)}%（MP ${cost}｜CD ${cd}s）
無視防禦 ${Math.round((t.logic.ignoreDef||0)*100)}%｜技能爆率 +${Math.round((t.logic.critChance||0)*100)}%｜技能爆傷 +${Math.round((t.logic.critDamage||0)*100)}%
幸運加成：每點LUK +${lukPer}% 總傷（上限 +200%）｜進化等級：${this.evolveLevels.join("/")}`;
  }
});


// === 攻擊：影襲·絕殺（五階爆發 / 10,30,50,70,100；CD 180）===
registerJobSkill('thief', {
  job: "thief",
  id: "shadowExecute",
  name: "影襲·絕殺",
  type: "attack",
  role: "attack",
  isBasic: false,
  
  level: 1,
  maxLevel: 20,
  
  currentTier: 0,
  evolveLevels: [10, 30, 50, 70, 100],
  
  tiers: [
    { name: "影襲·絕殺", mpCost: 40, cooldown: 180, logic: { damageMultiplier: 3.4, levelMultiplier: 0.12, minHits: 3, maxHits: 6, agiScale: 0.0012, critChanceBase: 0.20, critChancePerHit: 0.06, critDamage: 0.70, ignoreDefBase: 0.12, ignoreDefPerHit: 0.05, ignoreDefMax: 0.60, executeHpPct: 0.25, executeBonus: 0.35 } },
    { name: "暗殺連鎖", mpCost: 48, cooldown: 180, logic: { damageMultiplier: 3.7, levelMultiplier: 0.13, minHits: 4, maxHits: 7, agiScale: 0.0012, critChanceBase: 0.22, critChancePerHit: 0.06, critDamage: 0.75, ignoreDefBase: 0.14, ignoreDefPerHit: 0.05, ignoreDefMax: 0.62, executeHpPct: 0.25, executeBonus: 0.35 } },
    { name: "絕影亂刺", mpCost: 56, cooldown: 180, logic: { damageMultiplier: 4.0, levelMultiplier: 0.14, minHits: 5, maxHits: 8, agiScale: 0.0012, critChanceBase: 0.24, critChancePerHit: 0.06, critDamage: 0.80, ignoreDefBase: 0.16, ignoreDefPerHit: 0.05, ignoreDefMax: 0.64, executeHpPct: 0.25, executeBonus: 0.35 } },
    { name: "無聲處決", mpCost: 64, cooldown: 180, logic: { damageMultiplier: 4.3, levelMultiplier: 0.15, minHits: 6, maxHits: 9, agiScale: 0.0012, critChanceBase: 0.26, critChancePerHit: 0.06, critDamage: 0.85, ignoreDefBase: 0.18, ignoreDefPerHit: 0.05, ignoreDefMax: 0.66, executeHpPct: 0.25, executeBonus: 0.35 } },
    { name: "影滅終曲", mpCost: 72, cooldown: 180, logic: { damageMultiplier: 4.6, levelMultiplier: 0.16, minHits: 7, maxHits: 10, agiScale: 0.0012, critChanceBase: 0.28, critChancePerHit: 0.06, critDamage: 0.90, ignoreDefBase: 0.20, ignoreDefPerHit: 0.05, ignoreDefMax: 0.68, executeHpPct: 0.25, executeBonus: 0.35 } }
  ],
  
  currentCooldown: 0,
  
  use(monster) {
    const t = getActiveTier(this);
    
    // 同步階段屬性到頂層
    this.name = t.name;
    this.logic = t.logic;
    this.cooldown = (typeof t.cooldown === "number") ? t.cooldown : (this.cooldown ?? 0);
    const mpGrow = (t.logic?.mpCostLevelGrowth || 0) * Math.max(0, this.level - 1);
    const cost = (t.mpCost || 0) + mpGrow;
    this.mpCost = cost;
    
    // ====== 處決條件：Boss 不觸發 ======
    const mMax = (monster?.maxHp || monster?.baseStats?.hp || monster?.hp || 1);
    const isBoss = !!(monster?.isBoss || monster?.type === "boss" || monster?.tier === "boss");
    const canExecute = !isBoss && (monster.hp / mMax <= (t.logic.executeHpPct || 0));
    
    const perBase = t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1);
    const agi = (player.baseStats?.agi ?? 0);
    const agiAmp = 1 + agi * (t.logic.agiScale || 0);
    const execAmp = canExecute ? (1 + (t.logic.executeBonus || 0)) : 1;
    
    const hits = getRandomInt(t.logic.minHits, t.logic.maxHits);
    let total = 0;
    
    for (let i = 0; i < hits; i++) {
      const ignorePct = Math.min((t.logic.ignoreDefBase || 0) + i * (t.logic.ignoreDefPerHit || 0), (t.logic.ignoreDefMax || 0.68));
      const effDef = Math.floor((monster.def || 0) * (1 - ignorePct));
      const base = Math.max(player.totalStats.atk - effDef, 1);
      
      const cBase = (t.logic.critChanceBase || 0);
      const cStep = (t.logic.critChancePerHit || 0);
      const critChance = Math.min(cBase + i * cStep, 0.95);
      const isCrit = Math.random() < critChance;
      const critAmp = isCrit ? (1 + (t.logic.critDamage || 0)) : 1;
      
      const dmg = Math.floor(base * perBase * agiAmp * execAmp * critAmp);
      monster.hp -= dmg;
      total += dmg;
      if (monster.hp <= 0) break;
    }
    
    // 主要戰鬥日誌
    logPrepend?.(`🗡️ ${t.name}：${hits} 連擊，總傷害 ${total}${canExecute ? "（處決加成）" : ""}`);
    
    // 處決觸發的獨立紀錄（樓層訊息）
    if (canExecute) {
      const pct = Math.round((t.logic.executeBonus || 0) * 100);
      const th = Math.round((t.logic.executeHpPct || 0) * 100);
      logPrepend?.(`🔪 處決觸發：目標 HP ≤ ${th}% ，本次傷害 +${pct}%`);
    }
    
    spendAndCooldown(this, cost);
    return total;
  },
  
  getUpgradeCost() { return 20 + (this.level - 1) * 10; },
  
  getDescription() {
    const t = getActiveTier(this);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (this.level - 1)) * 100;
    return `【${t.name}】隨機 ${t.logic.minHits}-${t.logic.maxHits} 段｜每段約 ${Math.round(per)}%｜` +
      `爆擊：首段 ${Math.round((t.logic.critChanceBase||0)*100)}% 每段+${Math.round((t.logic.critChancePerHit||0)*100)}%，爆傷 +${Math.round((t.logic.critDamage||0)*100)}%｜` +
      `穿透：首段 ${Math.round((t.logic.ignoreDefBase||0)*100)}% 每段+${Math.round((t.logic.ignoreDefPerHit||0)*100)}%（上限 ${Math.round((t.logic.ignoreDefMax||0)*100)}%）｜` +
      `處決（不對Boss生效）：HP ≤ ${Math.round((t.logic.executeHpPct||0)*100)}% +${Math.round((t.logic.executeBonus||0)*100)}%｜` +
      `敏捷加成：每點AGI +${((t.logic.agiScale||0)*100).toFixed(2)}% 總傷｜MP ${t.mpCost}｜CD ${t.cooldown}s｜進化 ${this.evolveLevels.join("/")}`;
  }
});

// === 輔助：影藥（即時回復）===
// 盜賊 — 補助技能：影襲專注（單階段，不進化）
registerJobSkill('thief', {
  job: "thief",
  id: "shadowFocus",
  name: "影襲專注",
  type: "support",
  role: "support",
  isBasic: false,
  
  level: 1,
  maxLevel: 20,
  
  // 單階段就好（不需要 tiers / evolveLevels）
  mpCost: 25,
  cooldown: 120,
  currentCooldown: 0,
  
  // 小數＝加成百分比；會吃 LUK 作些微加成
  logic: {
    duration: 20, // 秒
    durationLevelGrowth: 1, // 每級 +1 秒
    baseCritRate: 0.12, // 爆率 +12%
    baseCritDmg: 0.25, // 爆傷 +25%
    baseDodge: 0.10, // 閃避 +10%
    lukToCrit: 0.0005, // 每點 LUK 額外 +0.05% 爆率
    extraCritCap: 0.20 // 來自 LUK 的額外爆率上限 +20%
  },
  
  use() {
    // ✦ 設定持續時間（會隨等級變長）
    const durMs = (this.logic.duration + (this.logic.durationLevelGrowth || 0) * (this.level - 1)) * 1000;
    
    // ✦ 計算屬性
    const totalLuk = (player.baseStats?.luk || 0) + (player.coreBonus?.luk || 0);
    const extraCrit = Math.min(this.logic.extraCritCap || 0.20, totalLuk * (this.logic.lukToCrit || 0));
    const addCrit = (this.logic.baseCritRate || 0) + extraCrit;
    const addCritD = (this.logic.baseCritDmg || 0);
    const addDodge = (this.logic.baseDodge || 0); // 以小數存放（0.10 = 10%）
    
    // ✦ 套用暫時加成到 skillBonus（顯示面板會自動讀到）
    player.skillBonus.bonusData[this.id] = {
      critRate: addCrit, // 小數
      critMultiplier: addCritD, // 小數
      dodgePercent: addDodge // 小數
    };
    
    // 扣 MP + 進入冷卻
    spendAndCooldown(this, this.mpCost);
    
    logPrepend?.(
      `🗡️ ${this.name}：爆擊率 +${Math.round(addCrit*100)}%、爆傷 +${Math.round(addCritD*100)}%、閃避 +${Math.round(addDodge*100)}%，持續 ${Math.round(durMs/1000)} 秒`
    );
    updateResourceUI?.();
    
    // 倒數結束自動移除
    this._timer = startTimedBuff(durMs, () => {
      delete player.skillBonus.bonusData[this.id];
      logPrepend?.(`⏳ ${this.name} 效果結束`);
      updateResourceUI?.();
    });
    
    return 0; // 支援技不直接造成傷害
  },
  
  getUpgradeCost() { return 20 + (this.level - 1) * 10; },
  
  getDescription() {
    const dur = this.logic.duration + (this.logic.durationLevelGrowth || 0) * (this.level - 1);
    const lukLine = `每點LUK +${((this.logic.lukToCrit||0)*100).toFixed(2)}% 爆率（額外上限 +${Math.round((this.logic.extraCritCap||0.2)*100)}%）`;
    return `爆擊率 +${Math.round((this.logic.baseCritRate||0)*100)}%（${lukLine}）、爆傷 +${Math.round((this.logic.baseCritDmg||0)*100)}%、閃避 +${Math.round((this.logic.baseDodge||0)*100)}%｜持續 ${dur}s（MP ${this.mpCost}｜CD ${this.cooldown}s）`;
  }
});

// 盜賊・補助：幸運面紗（只寫入 skillBonus，小數制；不再動 player.dodgePercent）
registerJobSkill('thief', {
  job: "thief",
  id: "luckyVeil",
  name: "幸運面紗",
  type: "support",
  role: "support",
  isBasic: false,

  // 🔁 讓 autoUseSkills 能自動維持：加上 effectKey / refreshAt
  effectKey: "luckyVeil",
  refreshAt: 2, // 剩餘 ≤2s 會自動刷新

  level: 1,
  maxLevel: 20,

  mpCost: 25,
  cooldown: 90,
  currentCooldown: 0,

  logic: {
    duration: 30,          // 秒
    // 小數加成（例：0.10 = 10%）
    base: {
      critRate: 0.10,
      critMultiplier: 0.20,
      dodgePercent: 0.12,
      comboRate: 0.08
    },
    // 每級成長
    perLevel: {
      critRate: 0.005,         // +0.5%/Lv
      critMultiplier: 0.01,    // +1%/Lv（爆傷）
      dodgePercent: 0.01,      // +1%/Lv（迴避）
      comboRate: 0.005         // +0.5%/Lv（連擊）
    }
  },

  use() {
    // 計算本級數加成（全用小數）
    const L = Math.max(0, (this.level || 1) - 1);
    const addCrit  = (this.logic.base.critRate       || 0) + L * (this.logic.perLevel.critRate       || 0);
    const addCdm   = (this.logic.base.critMultiplier || 0) + L * (this.logic.perLevel.critMultiplier || 0);
    const addDodge = (this.logic.base.dodgePercent   || 0) + L * (this.logic.perLevel.dodgePercent   || 0);
    const addCombo = (this.logic.base.comboRate      || 0) + L * (this.logic.perLevel.comboRate      || 0);

    const durMs = (this.logic.duration || 30) * 1000;

    // ✅ 只寫 skillBonus（小數），不碰 player.dodgePercent
    player.skillBonus.bonusData[this.id] = {
      critRate: addCrit,
      critMultiplier: addCdm,
      dodgePercent: addDodge,
      comboRate: addCombo,
      doubleHitChance: addCombo // 舊欄位相容（如果 UI/戰鬥讀這個）
    };

    // 供 autoUseSkills 支援型技能續杯判定（可選）
    player.buffs = player.buffs || {};
    player.buffs[this.effectKey] = {
      remaining: this.logic.duration, // 秒
      _tick: setInterval(() => {
        if (!player.buffs[this.effectKey]) return;
        player.buffs[this.effectKey].remaining -= 1;
        if (player.buffs[this.effectKey].remaining <= 0) {
          clearInterval(player.buffs[this.effectKey]._tick);
          delete player.buffs[this.effectKey];
        }
      }, 1000)
    };

    spendAndCooldown(this, this.mpCost);
    logPrepend?.(`🍀 ${this.name}：爆率+${Math.round(addCrit*100)}%、爆傷+${Math.round(addCdm*100)}%、迴避+${Math.round(addDodge*100)}%、連擊+${Math.round(addCombo*100)}%，持續 ${this.logic.duration}s`);
    updateResourceUI?.();

    // 計時結束移除加成
    if (this._timer) clearTimeout(this._timer);
    this._timer = startTimedBuff(durMs, () => {
      delete player.skillBonus.bonusData[this.id];
      if (player.buffs?.[this.effectKey]) {
        clearInterval(player.buffs[this.effectKey]._tick);
        delete player.buffs[this.effectKey];
      }
      logPrepend?.(`⏳ ${this.name} 結束`);
      updateResourceUI?.();
    });

    return 0; // 補助技不直接造成傷害
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const L = Math.max(0, (this.level || 1) - 1);
    const addCrit  = (this.logic.base.critRate       || 0) + L * (this.logic.perLevel.critRate       || 0);
    const addCdm   = (this.logic.base.critMultiplier || 0) + L * (this.logic.perLevel.critMultiplier || 0);
    const addDodge = (this.logic.base.dodgePercent   || 0) + L * (this.logic.perLevel.dodgePercent   || 0);
    const addCombo = (this.logic.base.comboRate      || 0) + L * (this.logic.perLevel.comboRate      || 0);
    return `爆率 +${Math.round(addCrit*100)}%、爆傷 +${Math.round(addCdm*100)}%、迴避 +${Math.round(addDodge*100)}%、連擊 +${Math.round(addCombo*100)}%（MP ${this.mpCost}｜CD ${this.cooldown}s｜持續 ${this.logic.duration}s）`;
  }
});
registerJobSkill('thief', {
  job: "thief",
  id: "lifeForMana",
  name: "血魔轉換",
  type: "support",
  role: "support",
  isBasic: false,

  level: 1,
  maxLevel: 20,

  mpCost: 0,        // 本身不耗魔
  cooldown: 60,
  currentCooldown: 0,

  logic: {
    hpCostPct: 0.20,        // 扣除最大HP 20%
    mpRestorePct: 0.50,     // 回復最大MP 50%
    levelRestoreBonus: 0.02 // 每級多 +2% MP 回復
  },

  use() {
    const maxHp = player.totalStats?.hp ?? 1;
    const maxMp = player.totalStats?.mp ?? 0;

    // ✅ 限制條件：MP 必須 ≤ 30%，且 HP 必須 > 35%
    if (player.currentMP / maxMp > 0.30) {
      return 0; // MP 不足條件，不施放
    }
    if (player.currentHP / maxHp <= 0.35) {
      logPrepend?.(`❌ 生命過低，無法施放 ${this.name}`);
      return 0;
    }

    const hpToLose = Math.floor(maxHp * this.logic.hpCostPct);
    const mpGain   = Math.floor(maxMp * (this.logic.mpRestorePct + (this.level-1) * this.logic.levelRestoreBonus));

    // 確認施放後 HP 不會變成負值
    if (player.currentHP <= hpToLose) {
      logPrepend?.(`❌ HP不足，無法施放 ${this.name}`);
      return 0;
    }

    // 扣血 & 回魔
    player.currentHP -= hpToLose;
    const newMp = Math.min(maxMp, player.currentMP + mpGain);
    const gained = newMp - player.currentMP;
    player.currentMP = newMp;

    spendAndCooldown(this, this.mpCost);
    logPrepend?.(`💉 ${this.name}：犧牲 ${hpToLose} HP，恢復 ${gained} MP`);
    updateResourceUI?.();
    return 0;
  },

  getUpgradeCost() { return 20 + (this.level - 1) * 10; },

  getDescription() {
    const mpPct = Math.round((this.logic.mpRestorePct + (this.level-1)*this.logic.levelRestoreBonus)*100);
    return `僅在MP ≤30%且HP >35%時可施放｜犧牲最大HP的 ${Math.round(this.logic.hpCostPct*100)}%，轉換為最大MP的 ${mpPct}%（CD ${this.cooldown}s）`;
  }
});