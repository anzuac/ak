// ============================
// skills_thief.js（盜賊/影舞者/刺客/暗影領主）
// 規則：全為攻擊技能，無補助。升級成本 getUpgradeCost() 一律回傳 1。
// 主屬加成：LUK -> 每點 +0.2% 傷害，上限 +200%（特殊註明的技能為 +300%）。
// ============================

/** 共同：取當前 tier、LUK 加成工具 */
function _getActiveTier(s) {
  return (typeof getActiveTier === "function" && s.tiers) ? getActiveTier(s) : s;
}
function _getLukBonus(cap = 2.0) {
  const per = 0.002; // 0.2% / LUK
  const total = (player?.baseStats?.luck || 0) + (player?.coreBonus?.luck || 0);
  return Math.min(cap, total * per); // 0 ~ cap（2.0=200% / 3.0=300%）
}

/* ===================== 一轉（thief） ===================== */

// 1) 影襲（無進化，短 CD，基礎 80% × 2，每級 +10%）——對齊你的一轉斬擊概念
registerJobSkill('thief', {
  job: "thief",
  id: "thief_shadow_strike",
  name: "影襲(一轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 1,

  level: 1,
  maxLevel: 20,

  // 無進化
  tiers: [{ name: "影襲", mpCost: 10, cooldown: 10, logic: { basePerHit: 0.8, perLevel: 0.10, hits: 2 } }],
  currentTier: 0,
  currentCooldown: 0,

  use(monster) {
    const t = _getActiveTier(this);
    this.name = t.name; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level | 0);
    const perHitMul = (t.logic.basePerHit || 0) + (t.logic.perLevel || 0) * (L - 1); // 0.8 + 0.1*(Lv-1)
    const hits = Number(t.logic.hits || 1);

    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    const lukBonus = _getLukBonus(2.0);
    const dmg = Math.floor(base * perHitMul * (1 + lukBonus)) * hits;

    monster.hp -= dmg;
    logPrepend?.(`⚔️ ${t.name}（${hits} 連擊）造成 ${dmg} 傷害！（LUK加成 ${Math.round(lukBonus*100)}%）`);
    spendAndCooldown(this, this.mpCost);
    return dmg;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = _getActiveTier(this);
    const L = Math.max(1, this.level | 0);
    const per = (t.logic.basePerHit + t.logic.perLevel * (L - 1)) * 100;
    return `${t.logic.hits} 連擊，每擊約 ${Math.round(per)}%｜LUK加成上限+200%`;
  }
});

// 2) 毒刃（可進化 30/70/120/200；附加「中毒」DoT）
registerJobSkill('thief', {
  job: "thief",
  id: "thief_venom_blade",
  name: "毒刃(一轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 1,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [30, 70, 120, 200],
  tiers: [
    { name: "毒刃(一轉)",     mpCost: 12, cooldown: 18, logic: { damageMultiplier: 1.1, levelMultiplier: 0.06, hits: 1, dotType: "poison", dotTurns: 3, dotMul: 0.06 } },
    { name: "濁毒刃(一轉)",   mpCost: 14, cooldown: 18, logic: { damageMultiplier: 1.3, levelMultiplier: 0.07, hits: 1, dotType: "poison", dotTurns: 3, dotMul: 0.07 } },
    { name: "蠱毒刃(一轉)",   mpCost: 16, cooldown: 18, logic: { damageMultiplier: 1.6, levelMultiplier: 0.08, hits: 1, dotType: "poison", dotTurns: 4, dotMul: 0.08 } },
    { name: "劇毒刃(一轉)",   mpCost: 18, cooldown: 18, logic: { damageMultiplier: 1.9, levelMultiplier: 0.09, hits: 1, dotType: "poison", dotTurns: 4, dotMul: 0.09 } },
    { name: "闇影劇毒(一轉)", mpCost: 20, cooldown: 18, logic: { damageMultiplier: 2.2, levelMultiplier: 0.10, hits: 1, dotType: "poison", dotTurns: 5, dotMul: 0.10 } },
  ],

  currentCooldown: 0,

  use(monster) {
    const t = _getActiveTier(this);
    this.name = t.name; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level | 0);
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const hits      = Number(t.logic.hits || 1);

    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    const lukBonus = _getLukBonus(2.0);
    const total = Math.floor(base * perHitMul * (1 + lukBonus)) * hits;
    monster.hp -= total;

    // 附加中毒（走你的通用異常系統）
    window.applyStatusToMonster?.(monster, t.logic.dotType, t.logic.dotTurns, t.logic.dotMul, (window.round || 0));

    logPrepend?.(`🗡️ ${t.name} 造成 ${total} 傷害並施加中毒（${t.logic.dotTurns} 回合）！`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = _getActiveTier(this);
    const L = Math.max(1, this.level | 0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    return `${t.logic.hits} 段，約 ${Math.round(per)}%｜附帶中毒：每回合依玩家攻擊 × ${Math.round(t.logic.dotMul*100)}% 持續 ${t.logic.dotTurns} 回合｜`;
  }
});

/* ===================== 二轉（thief2 / 影舞者） ===================== */

// 1) 影牙連突（不進化，連刺短 CD）
registerJobSkill('thief2', {
  job: "thief2",
  id: "shadow_fangs",
  name: "影牙連突(二轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 2,

  level: 1,
  maxLevel: 20,

  tiers: [{ name: "影牙連突", mpCost: 14, cooldown: 14, logic: { damageMultiplier: 0.9, levelMultiplier: 0.06, hits: 4 } }],
  currentTier: 0,
  currentCooldown: 0,

  use(monster) {
    const t = _getActiveTier(this);
    this.name = t.name; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level | 0);
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const hits = Number(t.logic.hits || 1);

    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    const lukBonus = _getLukBonus(2.0);
    const total = Math.floor(base * perHitMul * (1 + lukBonus)) * hits;
    monster.hp -= total;

    logPrepend?.(`🌀 ${t.name}（${hits} 連刺）共造成 ${total} 傷害！`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = _getActiveTier(this);
    const L = Math.max(1, this.level | 0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    return `${t.logic.hits} 連刺，每擊約 ${Math.round(per)}%（LUK加成上限+200%）`;
  }
});

registerJobSkill('thief2', {
  job: "thief2",
  id: "toxic_garrote",
  name: "劇毒鎖喉(二轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 2,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [70],
  tiers: [
    { name: "劇毒鎖喉", mpCost: 18, cooldown: 22,
      logic: { damageMultiplier: 1.2, levelMultiplier: 0.07, hits: 1, dotType: "deadly_poison", dotTurns: 3, dotPercent: 0.20 } },
    { name: "絕命鎖喉", mpCost: 20, cooldown: 22,
      logic: { damageMultiplier: 1.4, levelMultiplier: 0.08, hits: 1, dotType: "deadly_poison", dotTurns: 4, dotPercent: 0.20 } },
  ],

  currentCooldown: 0,

  use(monster) {
    const t = _getActiveTier(this);
    this.name = t.name; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level | 0);
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    const lukBonus = _getLukBonus(2.0);

    const total = Math.floor(base * perHitMul * (1 + lukBonus));
    monster.hp -= total;

    // 劇毒依照造成的傷害 × 20%
    const dotDmg = Math.floor(total * (t.logic.dotPercent || 0));
    if (dotDmg > 0) {
      window.applyStatusToMonster?.(monster, t.logic.dotType, t.logic.dotTurns, dotDmg, (window.round || 0));
      logPrepend?.(`☠️ ${t.name} 造成 ${total} 傷害，並施加劇毒（每回合 ${dotDmg}，持續 ${t.logic.dotTurns} 回合）！`);
    } else {
      logPrepend?.(`☠️ ${t.name} 造成 ${total} 傷害！`);
    }

    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },

  getDescription() {
    const t = _getActiveTier(this);
    const L = Math.max(1, this.level | 0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    return `打擊約 ${Math.round(per)}%，並附帶劇毒（每回合造成當前傷害的 20%，持續 ${t.logic.dotTurns} 回合）進化等級：${(this.evolveLevels||[]).join("/") || "—"}`;
  }
});

/* ===================== 三轉（thief3 / 刺客） ===================== */

// 1) 刺客幻影（不進化，CD 20s，多段爆擊風格；可附帶流血）
registerJobSkill('thief3', {
  job: "thief3",
  id: "assassin_phantoms",
  name: "刺客幻影(三轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 3,

  level: 1,
  maxLevel: 20,

  tiers: [{ name: "刺客幻影", mpCost: 20, cooldown: 20, logic: { damageMultiplier: 1.1, levelMultiplier: 0.07, hits: 5, bleedChance: 0.35, bleedTurns: 3, bleedMul: 0.05 } }],
  currentTier: 0,
  currentCooldown: 0,

  use(monster) {
    const t = _getActiveTier(this);
    this.name = t.name; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level | 0);
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const hits = Number(t.logic.hits || 1);

    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    const lukBonus = _getLukBonus(2.0);
    const total = Math.floor(base * perHitMul * (1 + lukBonus)) * hits;
    monster.hp -= total;

    // 觸發「流血」(依玩家 ATK 的 DoT)
    if (Math.random() < (t.logic.bleedChance || 0)) {
      window.applyStatusToMonster?.(monster, "bleed", t.logic.bleedTurns, t.logic.bleedMul, (window.round || 0));
      logPrepend?.(`🩸 ${t.name} 使目標流血（${t.logic.bleedTurns} 回合）！`);
    }

    logPrepend?.(`🗡️ ${t.name}（${hits} 段）總傷害 ${total}`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = _getActiveTier(this);
    const L = Math.max(1, this.level | 0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const total = per * t.logic.hits;
    return `${t.logic.hits} 段，總計約 ${Math.round(total)}%（每擊約 ${Math.round(per)}%）｜` +
           `有 ${Math.round((t.logic.bleedChance||0)*100)}% 使目標流血（每回合依玩家攻擊 × ${Math.round(t.logic.bleedMul*100)}%，持續 ${t.logic.bleedTurns} 回合）｜`;
  }
});

/* ===================== 四轉（thief4 / 暗影領主） ===================== */

// 1) 影瞬裂斬（短 CD 常規輸出，無進化）
registerJobSkill('thief4', {
  job: "thief4",
  id: "shadow_split",
  name: "影瞬裂斬(四轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 4,

  level: 1,
  maxLevel: 20,

  tiers: [{ name: "影瞬裂斬", mpCost: 16, cooldown: 10, logic: { damageMultiplier: 1.5, levelMultiplier: 0.07, hits: 2 } }],
  currentTier: 0,
  currentCooldown: 0,

  use(monster) {
    const t = _getActiveTier(this);
    this.name = t.name; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level | 0);
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const hits = Number(t.logic.hits || 1);

    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);
    const lukBonus = _getLukBonus(2.0);
    const total = Math.floor(base * perHitMul * (1 + lukBonus)) * hits;
    monster.hp -= total;

    logPrepend?.(`⚡ ${t.name}（${hits} 連擊）造成 ${total} 傷害！`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = _getActiveTier(this);
    const L = Math.max(1, this.level | 0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const total = per * t.logic.hits;
    return `${t.logic.hits} 連擊，總約 ${Math.round(total)}%LUK加成上限+200%`;
  }
});

// 2) 暗影神速（短 CD、高上限；LUK 加成封頂 +300%，進化 120/150/200）
registerJobSkill('thief4', {
  job: "thief4",
  id: "shadow_godspeed",
  name: "暗影神速(四轉)",
  type: "attack",
  role: "attack",
  isBasic: false,
  requiredJobTier: 4,

  level: 1,
  maxLevel: 20,

  currentTier: 0,
  evolveLevels: [120, 150, 200],
  tiers: [
    { name: "暗影神速", mpCost: 18, cooldown: 10, logic: { damageMultiplier: 1.6, levelMultiplier: 0.08, hits: 2 } },
    { name: "暗影極速", mpCost: 20, cooldown: 10, logic: { damageMultiplier: 1.9, levelMultiplier: 0.08, hits: 2 } },
    { name: "暗影閃滅", mpCost: 22, cooldown: 10, logic: { damageMultiplier: 2.2, levelMultiplier: 0.09, hits: 3 } },
    { name: "暗影瞬滅", mpCost: 24, cooldown: 10, logic: { damageMultiplier: 2.6, levelMultiplier: 0.09, hits: 3 } },
  ],

  currentCooldown: 0,

  use(monster) {
    const t = _getActiveTier(this);
    this.name = t.name; this.cooldown = t.cooldown; this.mpCost = t.mpCost;

    const L = Math.max(1, this.level | 0);
    const perHitMul = (t.logic.damageMultiplier || 0) + (t.logic.levelMultiplier || 0) * (L - 1);
    const hits = Number(t.logic.hits || 1);

    const base = Math.max((player.totalStats?.atk || 1) - (monster?.def || 0), 1);

    // ★ LUK 加成上限改到 +300%
    const lukBonus = _getLukBonus(3.0);

    const total = Math.floor(base * perHitMul * (1 + lukBonus)) * hits;
    monster.hp -= total;

    logPrepend?.(`🌑 ${t.name}（${hits} 連擊）造成 ${total} 傷害！（LUK加成 ${Math.round(lukBonus*100)}%）`);
    spendAndCooldown(this, this.mpCost);
    return total;
  },

  getUpgradeCost() { return 1; },
  getDescription() {
    const t = _getActiveTier(this);
    const L = Math.max(1, this.level | 0);
    const per = (t.logic.damageMultiplier + t.logic.levelMultiplier * (L - 1)) * 100;
    const total = per * t.logic.hits;
    return `${t.logic.hits} 連擊，總約 ${Math.round(total)}% LUK加成上限+300%｜進化等級：${this.evolveLevels.join("/")}`;
  }
});