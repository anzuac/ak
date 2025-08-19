function upgradeElementEquipment(key) {
  const eq = elementGearData[key];
  if (!eq) return;

  const costItem = "元素碎片";
  const costAmount = 1;

  if (typeof getItemQuantity !== 'function' || typeof removeItem !== 'function') {
    alert("❌ 遊戲初始化不完整，缺少 getItemQuantity 或 removeItem 函式。");
    return;
  }

  const owned = getItemQuantity(costItem);
  if (owned < costAmount) {
    alert(`❌ 強化失敗：需要 ${costItem} ×${costAmount}`);
    return;
  }

  if (eq.level >= 20) {
    alert(`⚠️ ${eq.name} 已達強化上限（LV20）`);
    return;
  }

  removeItem(costItem, costAmount);

  const baseRate = 10;
  const failBonus = (eq.upgradeFails || 0) * 5;
  const successRate = Math.min(baseRate + failBonus, 35);
  const roll = Math.random() * 100;

  if (roll < successRate) {
    const job = player.job; // 英文 key: warrior/mage/archer/thief
    const statsToAdd = {};
    const mainStatBonus = 1 + Math.floor(eq.level) /3.5;

    if (key === 'weapon') {
      statsToAdd.atk = 2;
    } else if (key === 'shield') {
      statsToAdd.hp = 0;
      statsToAdd.def = 1;
    } else if (key === 'hat') {
      statsToAdd.def = 1;
      statsToAdd.hp = 2;
    } else if (key === 'suit') {
      statsToAdd.hp = 1;
    } else if (key === 'glove') {
      statsToAdd.atk = 2;
    } else if (key === 'cape') {
      statsToAdd.def = 1;
    } else if (key === 'accessory') {
      statsToAdd.hp = 1;
      statsToAdd.mp = 1;
    } else if (key === 'badge') {
      // 徽章專屬加成：+0.1% 技能傷害（小數表示）
      statsToAdd.skillDamage = (statsToAdd.skillDamage || 0) + 0.003;
    }

    // 主屬加成（徽章不吃）
    if (key !== 'badge') {
      if (job === 'warrior') {
        statsToAdd.str = (statsToAdd.str || 0) + mainStatBonus;
      } else if (job === 'archer') {
        statsToAdd.agi = (statsToAdd.agi || 0) + mainStatBonus;
      } else if (job === 'mage') {
        statsToAdd.int = (statsToAdd.int || 0) + mainStatBonus;
      } else if (job === 'thief') {
        statsToAdd.luk = (statsToAdd.luk || 0) + mainStatBonus;
      }
    }

    eq.level++;
    eq.upgradeFails = 0;
    if (!eq.upgradeStats) eq.upgradeStats = {};
    for (const stat in statsToAdd) {
      eq.upgradeStats[stat] = (Number(eq.upgradeStats[stat]) || 0) + Number(statsToAdd[stat]);
    }

    alert(`✅ ${eq.name} 強化成功！已提升至 LV${eq.level}`);
    logPrepend?.(`✅ ${eq.name} 強化成功！已提升至 LV${eq.level}`);

    if (typeof applyElementEquipmentBonusToPlayer === "function") {
      applyElementEquipmentBonusToPlayer();
    }
    if (typeof updateElementEquipmentPanelContent === "function") {
      updateElementEquipmentPanelContent();
    }
    if (typeof updateAllUI === "function") updateAllUI();

  } else {
    eq.upgradeFails = (eq.upgradeFails || 0) + 1;
    alert(`💥 ${eq.name} 強化失敗（成功率 ${successRate.toFixed(2)}%）`);
    logPrepend?.(`💥 ${eq.name} 強化失敗（成功率 ${successRate.toFixed(2)}%）`);
  }
}