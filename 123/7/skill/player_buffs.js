
function applyPlayerStatusEffects() {
  if (!player.statusEffects) return;

  let effectsLog = "";

  // 處理：護盾倒數與失效
  if (player.statusEffects.shield && player.statusEffects.shield.turns > 0) {
    player.statusEffects.shield.turns--;
    if (player.statusEffects.shield.turns === 0) {
      effectsLog += "🛡️ 護盾效果已結束<br>";
      delete player.statusEffects.shield;
    }
  }

  // 處理：閃避 Buff
  if (player.statusEffects.evasion && player.statusEffects.evasion.turns > 0) {
    player.statusEffects.evasion.turns--;
    if (player.statusEffects.evasion.turns === 0) {
      effectsLog += "💨 閃避強化已結束<br>";
      delete player.statusEffects.evasion;
    }
  }

  // 處理：強化回復 Buff
  if (player.statusEffects.healBoost && player.statusEffects.healBoost.turns > 0) {
    player.statusEffects.healBoost.turns--;
    if (player.statusEffects.healBoost.turns === 0) {
      effectsLog += "💖 回復增益已結束<br>";
      delete player.statusEffects.healBoost;
    }
  }

  // 其他狀態：可未來擴充
  // ...

  // 若有紀錄產生，插入記錄
  if (effectsLog) logPrepend(effectsLog);
}

function autoUseSkills(monster) {
  for (const skill of skills) {
    if (skill.currentCooldown > 0) {
      skill.currentCooldown--;
      continue;
    }
skills.forEach(skill => {
  if (skill.activeUntil && Date.now() > skill.activeUntil && typeof skill.expire === "function") {
    skill.expire();
  }
});
    if (skill.mpCost > player.currentMP) continue;
    if (skill.type === "buff" && skill.active) continue;
    if (skill.type === "passive") continue; // ⛔ 被動技能不需要施放

    const dmg = skill.use(monster);
    if (skill.type === "attack" && typeof dmg === "number" && dmg > 0) {
      monsterHP -= dmg;
      showFloatingText(`-${dmg}`, "damage");
    }

    break; // 一回合只施放一個技能
  }
}
// ✅ 技能加成效果過期檢查
function checkExpiredSkillBuffs() {
  const now = Date.now();

  // 檢查所有技能
  skills.forEach(skill => {
    if (skill.type === "buff" && skill.activeUntil && now > skill.activeUntil) {
      // 時間到，移除效果
      player.skillBonus.atkPercent = 0;
      player.skillBonus.defPercent = 0;

      delete player.statusEffects.atkBoost;
      delete player.statusEffects.defBoost;

      skill.activeUntil = 0; // 重設狀態
      logPrepend(`⏳ ${skill.name} 效果結束。`);
    }
  });
}