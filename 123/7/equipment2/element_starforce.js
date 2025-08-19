// element_starforce.js
// 處理裝備的星力強化系統

const STARFORCE_MAX_LEVEL = 30;

function roundToTwoDecimals(value) {
  const n = Number(value);
  return Number.isFinite(n) ? parseFloat(n.toFixed(2)) : 0;
}

// 依星數回傳該區間每★的加成倍率（不受上限阻擋）
function getStarforceBonusPercent(level) {
  if (level <= 10) return 0.05;
  if (level <= 20) return 0.12;
  // 21~30（含 30）：維持最高區間倍率
  return 0.20;
}

function getStarforceConfig(starforceLevel) {
  const bonusPercent = getStarforceBonusPercent(starforceLevel);
  
  // 已達上限：只封鎖強化動作，保留正確顯示用的 bonusPercent
  if (starforceLevel >= STARFORCE_MAX_LEVEL) {
    return {
      costItem: null,
      costAmount: 0,
      successRate: 0,
      failDropRate: 0,
      failDoubleDropRate: 0,
      bonusPercent
    };
  }
  
  if (starforceLevel <= 10) {
    return {
      costItem: "楓幣",
      costAmount: 1000 * Math.pow(2, starforceLevel),
      successRate: 100 - (starforceLevel * 5),
      failDropRate: 0,
      failDoubleDropRate: 0,
      bonusPercent
    };
  }
  
  if (starforceLevel <= 20) {
    const successRate = Math.max(20, 50 - (starforceLevel - 10) * 3);
    const failDropRate = starforceLevel >= 15 ? 10 : 0;
    return {
      costItem: "衝星石",
      costAmount: 1,
      successRate,
      failDropRate,
      failDoubleDropRate: 0,
      bonusPercent
    };
  }
  
  // 21~30 星
  return {
    costItem: "星之碎片",
    costAmount: 1,
    successRate: 30,
    failDropRate: 15,
    failDoubleDropRate: 5,
    bonusPercent
  };
}

function starforceElementEquipment(key) {
  const eq = elementGearData[key];
  if (!eq) return;
  
  const currentLevel = eq.starforce || 0;
  
  if (currentLevel >= STARFORCE_MAX_LEVEL) {
    alert(`⚠️ ${eq.name} 已達星力上限（${STARFORCE_MAX_LEVEL}★）`);
    // 仍然觸發更新，確保 UI 會用到正確的 bonusPercent 顯示
    applyElementEquipmentBonusToPlayer?.();
    updateElementEquipmentPanelContent?.();
    if (typeof updateAllUI === "function") updateAllUI();
    return;
  }
  
  const config = getStarforceConfig(currentLevel);
  
  if (typeof getItemQuantity !== 'function' || typeof removeItem !== 'function') {
    alert("❌ 遊戲初始化不完整，缺少 getItemQuantity 或 removeItem 函式。");
    return;
  }
  
  const costItem = config.costItem;
  const costAmount = config.costAmount;
  
  if (costItem === "楓幣") {
    if (player.gold < costAmount) {
      alert(`❌ 星力失敗：需要 ${costAmount} 楓幣`);
      return;
    }
    player.gold -= costAmount;
  } else if (costItem) {
    if (getItemQuantity(costItem) < costAmount) {
      alert(`❌ 星力失敗：需要 ${costItem} ×${costAmount}`);
      return;
    }
    removeItem(costItem, costAmount);
  } else {
    // 無成本道具（理論上只會在達上限時出現，但我們已在上方 return）
  }
  
  const roll = Math.random() * 100;
  let message = '';
  
  if (roll < config.successRate) {
    eq.starforce = currentLevel + 1;
    message = `🌟 ${eq.name} 星力成功！已提升至 ${eq.starforce}★`;
  } else {
    const failRoll = Math.random() * 100;
    const isSafeLevel = currentLevel === 20;
    
    if (!isSafeLevel && failRoll < config.failDoubleDropRate) {
      eq.starforce = Math.max(0, currentLevel - 2);
      message = `💥 ${eq.name} 星力失敗，等級下降至 ${eq.starforce}★（連降兩級）`;
    } else if (!isSafeLevel && failRoll < config.failDropRate) {
      eq.starforce = Math.max(0, currentLevel - 1);
      message = `💥 ${eq.name} 星力失敗，等級下降至 ${eq.starforce}★`;
    } else {
      message = `💥 ${eq.name} 星力失敗，等級維持不變。`;
    }
  }
  
  alert(message);
  
  // 更新加成＆UI
  applyElementEquipmentBonusToPlayer?.();
  updateElementEquipmentPanelContent?.();
  if (typeof updateAllUI === "function") updateAllUI();
}

// 需要在其他模組直接取得倍率時可用
window.getStarforceBonusPercent = getStarforceBonusPercent;
window.getStarforceConfig = getStarforceConfig;
window.starforceElementEquipment = starforceElementEquipment;