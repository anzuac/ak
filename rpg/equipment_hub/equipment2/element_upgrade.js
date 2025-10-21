// ========== element_upgrade.js (最終版；20× + 動態上限 by 解放) ==========

(function(w) {
  "use strict";
  
  // 依「解放等級」計算本件裝備的強化上限：
  // 上限 = 20 + 5 × 解放等級（N=0, R=1, SR=2, SSR=3, UR=4, LR=5）
  function getUpgradeLevelCap(eq) {
    const lib = Math.max(0, Math.floor(Number(eq?.liberation || 0)));
    return 20 + 5 * Math.min(lib, 5);
  }
  w.getUpgradeLevelCap = getUpgradeLevelCap;
  
  function upgradeElementEquipment(key) {
    const eq = w.elementGearData?.[key];
    if (!eq) return;
    
    const costItem = "元素碎片";
    const costAmount = 1;
    
    if (typeof w.getItemQuantity !== 'function' || typeof w.removeItem !== 'function') {
      alert("❌ 遊戲初始化不完整，缺少 getItemQuantity / removeItem。");
      return;
    }
    
    const owned = w.getItemQuantity(costItem);
    if (owned < costAmount) {
      alert(`❌ 強化失敗：需要 ${costItem} ×${costAmount}`);
      return;
    }
    
    const cap = getUpgradeLevelCap(eq);
    const cur = Number(eq.level || 0);
    if (cur >= cap) {
      alert(`⚠️ ${eq.name} 已達強化上限（LV${cap}；依解放等級動態調整）`);
      return;
    }
    
    // 扣成本
    w.removeItem(costItem, costAmount);
    
    // 成功率：10% + 失敗次數×5%，上限 35%
    const baseRate = 10;
    const failBonus = (eq.upgradeFails || 0) * 5;
    const successRate = Math.min(baseRate + failBonus, 35);
    const roll = Math.random() * 100;
    
    // 小工具：依職業加「主屬」
    function addMainStat(stats, amount) {
      const job = (w.player?.job || "").toLowerCase();
      if (job === 'warrior') stats.str = (stats.str || 0) + amount;
      else if (job === 'mage') stats.int = (stats.int || 0) + amount;
      else if (job === 'archer') stats.agi = (stats.agi || 0) + amount;
      else if (job === 'thief') stats.luk = (stats.luk || 0) + amount;
    }
    
    if (roll < successRate) {
      const statsToAdd = {};
      
      // —— 20× 版本：每等增量（全部加到 upgradeStats；之後由星力/突破/解放做乘算）——
      switch (key) {
        case 'weapon':
          statsToAdd.atk = (statsToAdd.atk || 0) + 20;
          break;
        case 'shield':
          statsToAdd.hp = (statsToAdd.hp || 0) + 100;
          statsToAdd.def = (statsToAdd.def || 0) + 10;
          break;
        case 'hat':
          addMainStat(statsToAdd, 10);
          statsToAdd.def = (statsToAdd.def || 0) + 10;
          break;
        case 'suit':
          statsToAdd.hp = (statsToAdd.hp || 0) + 100;
          statsToAdd.mp = (statsToAdd.mp || 0) + 2;
          statsToAdd.def = (statsToAdd.def || 0) + 6;
          break;
        case 'shoes':
          addMainStat(statsToAdd, 10);
          statsToAdd.hp = (statsToAdd.hp || 0) + 50;
          break;
        case 'glove':
          statsToAdd.atk = (statsToAdd.atk || 0) + 10;
          break;
        case 'cape':
          addMainStat(statsToAdd, 4);
          statsToAdd.def = (statsToAdd.def || 0) + 10;
          break;
        case 'accessory':
          statsToAdd.hp = (statsToAdd.hp || 0) + 30;
          statsToAdd.mp = (statsToAdd.mp || 0) + 1;
          break;
        case 'badge':
          // 徽章：每級 +0.25% 技能傷害（小數 0.0025）→ LV20 ≈ +5%
          statsToAdd.skillDamage = (statsToAdd.skillDamage || 0) + 0.0025;
          break;
        default:
          // 其他未列裝備不加成
          break;
      }
      
      // 寫入升級
      eq.level = cur + 1;
      eq.upgradeFails = 0;
      if (!eq.upgradeStats) eq.upgradeStats = {};
      for (const stat in statsToAdd) {
        eq.upgradeStats[stat] = (Number(eq.upgradeStats[stat]) || 0) + Number(statsToAdd[stat]);
      }
      
      alert(`✅ ${eq.name} 強化成功！已提升至 LV${eq.level}（上限 LV${cap}）`);
      w.logPrepend?.(`✅ ${eq.name} 強化成功！已提升至 LV${eq.level}`);
      w.saveGame?.();
      
      w.applyElementEquipmentBonusToPlayer?.();
      w.updateElementEquipmentPanelContent?.();
      if (typeof w.updateAllUI === "function") w.updateAllUI();
      
    } else {
      eq.upgradeFails = (eq.upgradeFails || 0) + 1;
      alert(`💥 ${eq.name} 強化失敗（成功率 ${successRate.toFixed(2)}%）`);
      w.logPrepend?.(`💥 ${eq.name} 強化失敗（成功率 ${successRate.toFixed(2)}%）`);
      w.saveGame?.();
    }
  }
  
  // 導出
  w.upgradeElementEquipment = upgradeElementEquipment;
  
})(window);