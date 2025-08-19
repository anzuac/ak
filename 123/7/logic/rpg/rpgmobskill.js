// 📦 monsterSkills.js（怪物技能與施放邏輯）

// ====== 怪物技能模組：挑選 / 施放 / 冷卻 ======

// 從怪物技能中挑「可用」的一招：冷卻結束 + 機率通過
function chooseMonsterSkill(monster) {
  // === 新增：如果 Boss 有自己的 controller 函式，則優先使用它的決策 ===
  if (typeof monster?.controller === "function") {
    // 呼叫 Boss 的 AI 來決定下一招技能
    monster.nextSkill = null; // 清空預設值
    monster.controller(monster, monster.hp);
    const chosenSkill = monster.nextSkill;
    
    // 如果 controller 有選出技能，並且該技能冷卻已結束
    if (chosenSkill && (BossCore.getSkillCooldown(monster, chosenSkill.key) || 0) <= 0) {
      return chosenSkill;
    }
    // 否則，表示 controller 可能是暫時沒有要施放技能，或該技能仍在冷卻，
    // 我們讓程式繼續往下，使用原本的隨機選技邏輯來選一個備用技能。
  }

  // === 原始的隨機選技邏輯 ===
  const list = Array.isArray(monster?.skills) ? monster.skills : [];
  
  // 篩選出冷卻完畢的技能
  const ready = list.filter(s => (BossCore.getSkillCooldown(monster, s.key) || 0) <= 0);
  if (ready.length === 0) {
    // 如果所有技能都在冷卻，就讓它普攻或跳過。
    // 這邊您可以自行定義一個基礎攻擊技能的 key，例如 'poke'。
    const poke = list.find(s => s.key === "poke");
    return poke || null;
  }
  
  const candidates = ready.filter(s => {
    const chance = Number.isFinite(s?.castChance) ? s.castChance : 100;
    return Math.random() * 100 < Math.max(0, Math.min(100, chance));
  });
  if (candidates.length === 0) {
    const poke = list.find(s => s.key === "poke");
    return poke || null;
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

// 施放技能（支援：回傳數字＝主流程處理；不回數字＝技能內自處理）；施放後設定冷卻
function executeMonsterSkill(monster, skill) {
  let rawDamage = 0;       
  const name = skill?.name || "技能";

  try {
    if (typeof skill?.use === "function") {
      const ret = skill.use(null, monster);
      if (typeof ret === "number") {
        // 檢查是否要走無視防禦公式
        const ig = window.IgnoreDef?.calcSkillDamageForMonster?.({ damage: ret, ...skill.logic }, monster);
        if (ig?.usedFormula) {
          rawDamage = ig.damage;
        } else {
          rawDamage = Math.max(0, Math.floor(ret));
        }
      }
    }
  } finally {
    // 冷卻已設定
  }
  return { name, rawDamage };
}

// 在回合尾遞減怪物技能冷卻
function reduceMonsterSkillCooldowns(monster) {
  // 我們已經在 monster._tickEndTurn 中統一呼叫 BossCore.endTurn 處理所有冷卻，
  // 所以這裡的邏輯可以清空，避免重複倒數。
}
