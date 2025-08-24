// === playerSkills.js ===
// 玩家技能自動施放中控（尊重「自動」勾選），只在回合尾遞減 CD。

// ====== 工具 ======
function _tier(s) {
  if (!s) return s;
  if (typeof getActiveTier === "function" && s.tiers) {
    return getActiveTier(s) || s;
  }
  return s;
}
function _mpCost(s) {
  const t = _tier(s);
  const base = Number(t.mpCost ?? s.mpCost ?? 0);
  const grow = Number(t.logic?.mpCostLevelGrowth ?? 0) * Math.max(0, (s.level ?? 1) - 1);
  return base + grow;
}
function _isBasic(s) {
  if (typeof s.isBasic === "boolean") return s.isBasic;
  const t = _tier(s);
  const cd = Number(t.cooldown ?? s.cooldown ?? 0);
  const role = s.role ?? "attack";
  return role === "attack" && cd === 0;
}
function _minIntervalOk(s, roundNo) {
  const gap = (_isBasic(s) ? (s.minInterval ?? 1) : (s.minInterval ?? 0));
  if (!gap) return true;
  const last = s.lastUsedRound ?? -9999;
  return (roundNo - last) >= gap;
}
function _needSupport(s) {
  if ((s.role ?? "attack") !== "support") return false;
  const key = s.effectKey;
  if (!key) return false;
  const remain = player?.buffs?.[key]?.remaining ?? 0;
  const refreshAt = s.refreshAt ?? 2;
  return remain <= refreshAt;
}
function _getGlobalSkillDamageMul() {
  const bonus = (player?.totalStats?.skillDamage || 0);
  return 1 + Math.max(0, bonus);
}

// === 勾選偏好 ===
function ensureSkillAutoFlag(skill) {
  if (!skill || !skill.id) return;
  if (typeof skill.autoEnabled === "undefined") {
    const saved = localStorage.getItem(`skillAuto_${skill.id}`);
    const def = (typeof skill.autoDefault === "boolean") ? skill.autoDefault : false; // 預設不自動
    skill.autoEnabled = (saved === null) ? def : (saved === "1");
  }
  if (skill.allowAuto === false) skill.autoEnabled = false;
}

// ====== 施放入口（最終保險：沒勾選就不放） ======
function _cast(s, monster) {
  if (s.autoEnabled !== true) {
    return { used: false, name: s?.name || "技能", damage: 0 };
  }

  const t = _tier(s);
  s.name     = t.name ?? s.name;
  s.logic    = t.logic ?? s.logic;
  s.cooldown = (typeof t.cooldown === "number") ? t.cooldown : (s.cooldown ?? 0);
  s.mpCost   = _mpCost(s);

  const hpBefore = (typeof monsterHP === "number") ? monsterHP : (monster?.hp ?? 0);

  let ret = 0;
  if (typeof t.use === "function") {
    ret = t.use(monster, s);
  } else if (typeof s.use === "function") {
    ret = s.use(monster);
  } else {
    return { used: false, name: s.name || "技能", damage: 0 };
  }

  if (typeof round !== "undefined") s.lastUsedRound = round;

  const skillMul = _getGlobalSkillDamageMul();
  let dealt = 0;
  if (typeof ret === "number") {
    dealt = Math.max(0, Math.floor(ret * skillMul));
    if (monster === currentMonster && typeof monsterHP === "number") {
      monsterHP = Math.max(0, monsterHP - dealt);
    }
  } else {
    const hpAfter = (typeof monsterHP === "number") ? monsterHP : (monster?.hp ?? hpBefore);
    dealt = Math.max(0, hpBefore - hpAfter);
  }

  if (s.mpCost > 0 && typeof player?.currentMP === "number") {
    player.currentMP = Math.max(0, player.currentMP - s.mpCost);
  }
  if ((s.cooldown ?? 0) > 0 && (s.currentCooldown ?? 0) <= 0) {
    s.currentCooldown = s.cooldown;
  }

  return { used: true, name: t.name || s.name || "技能", damage: dealt };
}

// ====== 自動施放（只挑 autoEnabled === true） ======
function autoUseSkills(monster) {
  if (typeof ensureSkillEvolution === "function") ensureSkillEvolution();

  const list = Array.isArray(skills) ? skills : [];

  // 補旗標（新學會的技能也會被初始化）
  for (const s of list) ensureSkillAutoFlag(s);

  const available = list.filter(s => {
    if (!s) return false;
    if (s.autoEnabled !== true) return false;            // ★ 只有打勾的才會自動施放
    if ((s.currentCooldown ?? 0) > 0) return false;
    if (!_minIntervalOk(s, round)) return false;
    return (player.currentMP ?? 0) >= _mpCost(s);
  });

  if (available.length === 0) return { used: false };

  const support = available.find(_needSupport);
  if (support) return _cast(support, monster);

  const atkNonBasic = available.filter(s => (s.role ?? "attack") === "attack" && !_isBasic(s));
  if (atkNonBasic.length) return _cast(atkNonBasic[0], monster);

  const basic = available.find(_isBasic);
  if (basic) return _cast(basic, monster);

  return { used: false };
}

// 回合尾遞減玩家技能冷卻
function reduceSkillCooldowns() {
  const list = Array.isArray(skills) ? skills : [];
  for (const s of list) {
    if (!s) continue;
    if (Number.isFinite(s.currentCooldown) && s.currentCooldown > 0) {
      s.currentCooldown -= 1;
      if (s.currentCooldown < 0) s.currentCooldown = 0;
    }
  }
}

// === 導出（避免被覆蓋，方便偵錯） ===
autoUseSkills.__SRC = "playerSkills.js";
window.autoUseSkills = autoUseSkills;
window.reduceSkillCooldowns = reduceSkillCooldowns;