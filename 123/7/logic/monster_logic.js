
function applyMonsterStatusEffects() {
  if (!currentMonster.statusEffects) return;

  const effects = currentMonster.statusEffects;

  if (effects.poison && effects.poison > 0) {
    const poisonDmg = Math.floor(currentMonster.maxHp * 0.01);
    monsterHP -= poisonDmg;
    
    effects.poison--;
    logPrepend(`☠️ ${currentMonster.name} 中毒！！！！損失 ${poisonDmg} HP`);
  }

  if (effects.burn && effects.burn > 0) {
    const burnDmg = Math.floor(player.totalStats.atk * 0.1);
    monsterHP -= burnDmg;
    
    logPrepend(`🔥 ${currentMonster.name} 燒傷！損失 ${burnDmg} HP`);
  }

  if (effects.paralyze && effects.paralyze > 0) {
    currentMonster.paralyzed = true;
    effects.paralyze--;
  }

  if (effects.weaken && effects.weaken > 0) {
    currentMonster.def = Math.floor(currentMonster.originalDef * 0.6);
    currentMonster.atk = Math.floor(currentMonster.originalAtk * 0.6);
    effects.weaken--;
  } else {
    currentMonster.def = currentMonster.originalDef;
    currentMonster.atk = currentMonster.originalAtk;
  }
}

function spawnNewMonster() {
  currentMonster = getMonster(selectedMap, selectedRange);
  monsterHP = currentMonster.hp;
  currentMonster.maxHp = currentMonster.hp;
  currentMonster.originalAtk = currentMonster.atk;
  currentMonster.originalDef = currentMonster.def;
  currentMonster.statusEffects = {};
  updateMonsterInfo(currentMonster, monsterHP);
  logPrepend(`⚔️ 遭遇 ${currentMonster.name}（HP：${monsterHP}）`);
}
