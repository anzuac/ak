// element_advance.js
// 這是獨立的進階系統 (D)，已根據你的新規則修正

function advanceElementEquipment(key) {
  const eq = elementGearData[key];
  if (!eq) return;

  const costItem = "進階石";
  const costAmount = 1;
  const advanceSuccessRate = 30; // 進階成功率 20%
  const advanceFailPenaltyRate = 30; // 進階失敗時，降級的機率 30%
  const advanceLevelCap = 20; // 進階等級上限

  if (typeof getItemQuantity !== 'function' || typeof removeItem !== 'function') {
    alert("❌ 遊戲初始化不完整，缺少getItemQuantity或removeItem函式。");
    return;
  }

  const owned = getItemQuantity(costItem);
  if (owned < costAmount) {
    alert(`❌ 進階失敗：需要 ${costItem} ×${costAmount}`);
    return;
  }

  if (eq.advance >= advanceLevelCap) {
    alert(`⚠️ ${eq.name} 已達進階上限（LV${advanceLevelCap}）`);
    return;
  }
  
  removeItem(costItem, costAmount);

  const roll = Math.random() * 100;
  let message = '';

  if (roll < advanceSuccessRate) {
    eq.advance++;
    message = `✅ ${eq.name} 進階成功！已提升至 LV${eq.advance}`;

  } else {
    const failRoll = Math.random() * 100;
    const isSafeLevel = eq.advance % 5 === 0 && eq.advance > 0;

    if (failRoll < advanceFailPenaltyRate && !isSafeLevel) {
      eq.advance = Math.max(0, eq.advance - 1);
      message = `💥 ${eq.name} 進階失敗，等級下降至 LV${eq.advance}`;

    } else {
      message = `💥 ${eq.name} 進階失敗，但等級維持不變。`;
    }
  }

  alert(message);
  
  applyElementEquipmentBonusToPlayer();
  updateElementEquipmentPanelContent();
  if (typeof updateAllUI === "function") updateAllUI();
}
