// ==============================
// monster_skills.js
// ==============================
function chooseMonsterSkill(monster) {
  const list = Array.isArray(monster?.skills) ? monster.skills : [];
  const ready = list.filter(s => (BossCore.getSkillCooldown(monster, s.key) || 0) <= 0);
  if (ready.length === 0) return null;

  const candidates = ready.filter(s => {
    if (s.key === 'atk-buff' && BossCore.getBuffTurns(monster, 'atk') > 0) return false;
    if (s.key === 'def-buff' && BossCore.getBuffTurns(monster, 'def') > 0) return false;

    const chance = Number.isFinite(s?.castChance) ? s.castChance : 100;
    return Math.random() * 100 < Math.max(0, Math.min(100, chance));
  });

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function monsterUseSkill(monster, player) {
  if (typeof monster?.controller === "function") {
    monster.controller(monster, monster.hp);
    if (monster.nextSkill && BossCore.getSkillCooldown(monster, monster.nextSkill.key) <= 0) {
      const skill = monster.nextSkill;
      const name = skill?.name || "技能";
      let ret = 0;
      if (typeof skill?.use === "function") {
        ret = skill.use(player, monster);
      }
      if (typeof ret === "number") {
        return { used: true, name, rawDamage: Math.max(0, Math.floor(ret)), handled: false };
      } else {
        return { used: true, name, rawDamage: 0, handled: true };
      }
    }
  }

  const skill = chooseMonsterSkill(monster);
  if (skill) {
    const name = skill?.name || "技能";
    let ret = 0;
    if (typeof skill?.use === "function") {
      ret = skill.use(player, monster);
    }
    if (typeof ret === "number") {
      return { used: true, name, rawDamage: Math.max(0, Math.floor(ret)), handled: false };
    } else {
      return { used: true, name, rawDamage: 0, handled: true };
    }
  }

  return { used: false, name: "", rawDamage: 0, handled: false };
}