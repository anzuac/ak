// 📦 monster_buffs.js (統一數值設定)

/**
 * 產生一個在 min (包含) 和 max (包含) 之間的隨機整數。
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} - 隨機整數
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ⚙️ 統一設定所有 Buff 的持續時間和冷卻時間隨機範圍
// 格式為 [最小值, 最大值]
const buffRanges = {
  healBuff: {
    cooldown: [6, 8]
  },
  atkBuff: {
    duration: [6, 10],
    cooldown: [24, 32]
  },
  defBuff: {
    duration: [6, 10],
    cooldown: [20, 30]
  },
  shieldBuff: {
    cooldown: [18, 24]
  }
};

/**
 * 處理所有怪物的自我 Buff 效果。這個函式應在每個回合開始時被呼叫。
 * @param {Object} monster - 怪物物件
 */
function processMonsterBuffs(monster) {
  // 在處理前先確保所有相關物件都已存在
  if (!monster.extra) monster.extra = {};
  if (!monster.extra.buff) monster.extra.buff = {};
  if (!monster.buffState) monster.buffState = {};
  if (!monster.buffCooldown) monster.buffCooldown = {};

  const buffs = monster.extra.buff;

  // 1. 處理所有 Buff 的持續時間和冷卻時間遞減
  if (monster.buffState.atkTurns > 0) monster.buffState.atkTurns--;
  if (monster.buffState.defTurns > 0) monster.buffState.defTurns--;
  
  if (monster.buffState.healTurns > 0) monster.buffState.healTurns = 0;

  if (monster.buffCooldown.healBuff > 0) monster.buffCooldown.healBuff--;
  if (monster.buffCooldown.atkBuff > 0) monster.buffCooldown.atkBuff--;
  if (monster.buffCooldown.defBuff > 0) monster.buffCooldown.defBuff--;
  if ((!monster.shield || monster.shield <= 0) && monster.buffCooldown.shieldBuff > 0) monster.buffCooldown.shieldBuff--;
  
  // 2. 檢查並觸發符合條件的 Buff
  
  // 🩹 回復 Buff
  if (buffs.healBuff && (monster.buffCooldown.healBuff || 0) <= 0) {
    const healAmount = Math.floor(monster.maxHp * 0.2);
    monster.hp = Math.min(monster.hp + healAmount, monster.maxHp);
    monster.buffState.healTurns = 1;
    const [min, max] = buffRanges.healBuff.cooldown;
    monster.buffCooldown.healBuff = getRandomInt(min, max);
    logPrepend(`🩹 ${monster.name} 回復了 ${healAmount} HP！`);
  }

  // 💪 攻擊提升 Buff
  if (buffs.atkBuff && (monster.buffCooldown.atkBuff || 0) <= 0 && (monster.buffState.atkTurns || 0) <= 0) {
    const [minDuration, maxDuration] = buffRanges.atkBuff.duration;
    const [minCooldown, maxCooldown] = buffRanges.atkBuff.cooldown;
    
    monster.buffState.atkTurns = getRandomInt(minDuration, maxDuration);
    monster.buffCooldown.atkBuff = getRandomInt(minCooldown, maxCooldown);
    logPrepend(`💪 ${monster.name} 攻擊力提升！`);
  }

  // 🛡️ 防禦提升 Buff
  if (buffs.defBuff && (monster.buffCooldown.defBuff || 0) <= 0 && (monster.buffState.defTurns || 0) <= 0) {
    const [minDuration, maxDuration] = buffRanges.defBuff.duration;
    const [minCooldown, maxCooldown] = buffRanges.defBuff.cooldown;
    
    monster.buffState.defTurns = getRandomInt(minDuration, maxDuration);
    monster.buffCooldown.defBuff = getRandomInt(minCooldown, maxCooldown);
    logPrepend(`🛡️ ${monster.name} 防禦力提升！`);
  }

  // 🔰 護盾 Buff
  if (buffs.shieldBuff && (monster.buffCooldown.shieldBuff || 0) <= 0 && (!monster.shield || monster.shield <= 0)) {
    monster.shield = Math.floor(monster.maxHp * 0.4);
    const [min, max] = buffRanges.shieldBuff.cooldown;
    monster.buffCooldown.shieldBuff = getRandomInt(min, max);
    logPrepend(`🔰 ${monster.name} 產生護盾 ${monster.shield}！`);
  }
}

/**
 * 根據怪物的 Buff 狀態，計算攻擊力和防禦力。
 * @param {Object} monster - 怪物物件
 * @returns {{atk: number, def: number}} - 修正後的攻擊力和防禦力
 */
function applyMonsterBuffEffects(monster) {
  let atk = monster.atk;
  let def = monster.def;
  if (monster.buffState?.atkTurns > 0) atk = Math.floor(atk * 1.3);
  if (monster.buffState?.defTurns > 0) def = Math.floor(def * 1.4);
  return { atk, def };
}

/**
 * 顯示怪物目前正在生效的 Buff 效果。
 * @param {Object} monster - 怪物物件
 * @returns {string} - Buff 效果的文字描述
 */
function getMonsterBuffEffects(monster) {
  if (!monster.buffState) return "無";

  const effects = [];
  
  const originalAtk = monster.originalAtk || monster.atk;
  const originalDef = monster.originalDef || monster.def;

  if (monster.buffState.atkTurns > 0) {
    const atkIncrease = Math.floor(originalAtk * 1.3) - originalAtk;
    effects.push(`💪 攻擊力↑ (+${atkIncrease}) [${monster.buffState.atkTurns}回]`);
  }
  
  if (monster.buffState.defTurns > 0) {
    const defIncrease = Math.floor(originalDef * 1.4) - originalDef;
    effects.push(`🛡️ 防禦力↑ (+${defIncrease}) [${monster.buffState.defTurns}回]`);
  }
  
  if (monster.shield && monster.shield > 0) {
    effects.push(`🔰 護盾 (${monster.shield})`);
  }

  if (monster.buffState.healTurns > 0) {
    effects.push("🩹 回復");
  }

  return effects.length > 0 ? effects.join(" ") : "無";
}

/**
 * 顯示怪物內建的 Buff 技能清單。
 * @param {Object} monster - 怪物物件
 * @returns {string} - 內建 Buff 技能的文字描述
 */
function getMonsterBuiltInBuffSkills(monster) {
  const buff = monster.extra?.buff || {};
  const skills = [];

  const healCooldownText = (monster.buffCooldown?.healBuff || 0) > 0 ? `${monster.buffCooldown.healBuff}回` : '就緒';
  const atkCooldownText = (monster.buffCooldown?.atkBuff || 0) > 0 ? `${monster.buffCooldown.atkBuff}回` : '就緒';
  const defCooldownText = (monster.buffCooldown?.defBuff || 0) > 0 ? `${monster.buffCooldown.defBuff}回` : '就緒';
  const shieldCooldownText = (monster.buffCooldown?.shieldBuff || 0) > 0 ? `${monster.buffCooldown.shieldBuff}回` : '就緒';

  if (buff.healBuff) skills.push(`🩹 回復（冷卻${healCooldownText}）`);
  if (buff.atkBuff) skills.push(`💪 攻擊↑（冷卻${atkCooldownText}）`);
  if (buff.defBuff) skills.push(`🛡️ 防禦↑（冷卻${defCooldownText}）`);
  if (buff.shieldBuff) skills.push(`🔰 護盾（冷卻${shieldCooldownText}）`);

  return skills.length > 0 ? skills.join("、") : "無";
}
