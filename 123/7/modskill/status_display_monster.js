function getMonsterBuiltInEffects(monster) {
  const builtInEffects = [];

  if (monster.poison) builtInEffects.push(`☠️ 中毒（${monster.poisonChance}%）`);
  if (monster.burn) builtInEffects.push(`🔥 燃燒（${monster.burnChance}%）`);
  if (monster.paralyze) builtInEffects.push(`⚡ 麻痺（${monster.paralyzeChance}%）`);
  if (monster.weaken) builtInEffects.push(`🌀 虛弱（${monster.weakenChance}%）`);
  if (monster.freeze) builtInEffects.push(`❄️ 凍傷（${monster.freezeChance}%）`);
  if (monster.bleed) builtInEffects.push(`🩸 流血（${monster.bleedChance}%）`);
  if (monster.curse) builtInEffects.push(`🧿 詛咒（${monster.curseChance}%）`);
  if (monster.blind) builtInEffects.push(`🌫️ 致盲（${monster.blindChance}%）`);
  if (monster.dodgePercent > 0) builtInEffects.push(`💨 閃避率 ${monster.dodgePercent.toFixed(1)}%`);

  return builtInEffects.length > 0 ? builtInEffects.join("、") : "無";
}

function getMonsterAbnormalEffects(monster) {
  const se = monster.statusEffects || {};
  const abnormalEffects = [];
  
  if (se.poison > 0) abnormalEffects.push(`☠️ 中毒(${se.poison})`);
  if (se.burn > 0) abnormalEffects.push(`🔥 燃燒(${se.burn})`);
  if (se.paralyze > 0) abnormalEffects.push(`⚡ 麻痺(${se.paralyze})`);
  if (se.weaken > 0) abnormalEffects.push(`🌀 虛弱(${se.weaken})`);
  if (se.freeze > 0) abnormalEffects.push(`❄️ 凍傷(${se.freeze})`);
  if (se.bleed > 0) abnormalEffects.push(`🩸 流血(${se.bleed})`);
  if (se.curse > 0) abnormalEffects.push(`🧿 詛咒(${se.curse})`);
  if (se.blind > 0) abnormalEffects.push(`🌫️ 致盲(${se.blind})`);
  
  return abnormalEffects.length > 0 ? abnormalEffects.join("、") : "無";
}
function getMonsterBuffEffects(monster) {
  if (!monster.buffState) return "";

  const effects = [];
  
  const originalAtk = monster.originalAtk || monster.atk;
  const originalDef = monster.originalDef || monster.def;

  if (monster.buffState.atkUpTurns && monster.buffState.atkUpTurns > 0) {
    const atkIncrease = Math.floor(originalAtk * 1.3) - originalAtk;
    effects.push(`攻擊力↑ (+${atkIncrease})`);
  }
  
  if (monster.buffState.defUpTurns && monster.buffState.defUpTurns > 0) {
    const defIncrease = Math.floor(originalDef * 1.4) - originalDef;
    effects.push(`防禦力↑ (+${defIncrease})`);
  }
  
  if (monster.shield && monster.shield > 0) {
    effects.push(`護盾 (${monster.shield})`);
  }

  if (monster.buffState.healTurns && monster.buffState.healTurns > 0) {
    effects.push("🩹 回復");
  }

  return effects.join(" ");
}

function getMonsterBuiltInBuffSkills(monster) {
  const ext = monster.extra || {};
  const buff = ext.buff || {};
  const skills = [];

  if (buff.healBuff) skills.push("🩹 回復（6回合）");
  if (buff.atkBuff) skills.push("💪 攻擊↑（冷卻8回合/持續3回合）");
  if (buff.defBuff) skills.push("🛡️ 防禦↑（冷卻8回合/持續3回合）");
// 📦 monster_buffs.js

// 每回合處理怪物的自我 buff 效果
function processMonsterBuffs(monster) {
  if (!monster.extra?.buff) return;
  if (!monster.buffState) monster.buffState = {};
  if (!monster.buffCooldown) monster.buffCooldown = {};

  const buffs = monster.extra.buff;

  // 🩹 回復 buff：每 6 回合回復 20% 最大 HP
  if (buffs.healBuff) {
    const cd = monster.buffCooldown.healBuff || 0;
    if (cd <= 0) {
      const healAmount = Math.floor(monster.maxHp * 0.2);
      monster.hp = Math.min(monster.hp + healAmount, monster.maxHp);
      monster.buffCooldown.healBuff = 6;
      monster.buffState.healTurns = 1; // 當回合顯示
      logPrepend(`🩹 ${monster.name} 回復了 ${healAmount} HP！`);
    } else {
      monster.buffCooldown.healBuff--;
    }
  }

  // 💪 攻擊提升：持續 3 回合，冷卻 8 回合
  if (buffs.atkBuff) {
    const cd = monster.buffCooldown.atkBuff || 0;
    const turns = monster.buffState.atkUpTurns || 0;
    if (cd <= 0 && turns <= 0) {
      monster.buffState.atkUpTurns = 3;
      monster.buffCooldown.atkBuff = 8;
      logPrepend(`💪 ${monster.name} 攻擊力提升！`);
    } else {
      if (monster.buffState.atkUpTurns > 0) monster.buffState.atkUpTurns--;
      else monster.buffCooldown.atkBuff--;
    }
  }

  // 🛡️ 防禦提升：持續 3 回合，冷卻 8 回合
  if (buffs.defBuff) {
    const cd = monster.buffCooldown.defBuff || 0;
    const turns = monster.buffState.defUpTurns || 0;
    if (cd <= 0 && turns <= 0) {
      monster.buffState.defUpTurns = 3;
      monster.buffCooldown.defBuff = 8;
      logPrepend(`🛡️ ${monster.name} 防禦力提升！`);
    } else {
      if (monster.buffState.defUpTurns > 0) monster.buffState.defUpTurns--;
      else monster.buffCooldown.defBuff--;
    }
  }

  // 🔰 護盾 buff：每 8 回合獲得 40% maxHp 護盾
  if (buffs.shieldBuff) {
    const cd = monster.buffCooldown.shieldBuff || 0;
    if (cd <= 0 && (!monster.shield || monster.shield <= 0)) {
      monster.shield = Math.floor(monster.maxHp * 0.4);
      monster.buffCooldown.shieldBuff = 8;
      logPrepend(`🔰 ${monster.name} 產生護盾 ${monster.shield}！`);
    } else {
      monster.buffCooldown.shieldBuff--;
    }
  }
}

// 攻擊前應用 buff 狀態（例如：加攻擊力、加防禦力）
function applyMonsterBuffEffects(monster) {
  let atk = monster.atk;
  let def = monster.def;
  if (monster.buffState?.atkUpTurns > 0) atk = Math.floor(atk * 1.3);
  if (monster.buffState?.defUpTurns > 0) def = Math.floor(def * 1.4);
  return { atk, def };
}


  if (buff.shieldBuff) skills.push("🔰 護盾（冷卻8回合）");

  return skills.length > 0 ? skills.join("、") : "無";
}