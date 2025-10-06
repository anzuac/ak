// element_breakthrough.js
// 處理裝備的突破系統

// --- 常數與資料結構 ---
const BREAKTHROUGH_MAX_LEVEL = 10;
const BREAKTHROUGH_COST = "元素精華";
const breakthroughData = [
  { costAmount: 10, successRate: 80, bonusPercent: 0.05, special: false }, // Stage 1
  { costAmount: 20, successRate: 50, bonusPercent: 0.05, special: false }, // Stage 2
  { costAmount: 40, successRate: 50, bonusPercent: 0.06, special: false }, // Stage 3
  { costAmount: 60, successRate: 40, bonusPercent: 0.07, special: false }, // Stage 4
  { costAmount: 80, successRate: 35, bonusPercent: 0.08, special: false }, // Stage 5
  { costAmount: 100, successRate: 30, bonusPercent: 0.09, special: false }, // Stage 6
  { costAmount: 150, successRate: 30, bonusPercent: 0.10, special: false }, // Stage 7
  { costAmount: 200, successRate: 20, bonusPercent: 0.15, special: false }, // Stage 8
  { costAmount: 250, successRate: 20, bonusPercent: 0.20, special: false }, // Stage 9
  { costAmount: 1000, successRate: 10, bonusPercent: 0.20, special: true } // Stage 10 (神級)
];

const setBonusData = [
  { count: 2, bonusPercent: 0.05 }, // 2件神級，所有裝備所有屬性增加 5%
  { count: 4, bonusPercent: 0.15 }, // 4件神級，所有裝備所有屬性增加 10%
  { count: 6, bonusPercent: 0.30 }, // 6件神級，所有裝備所有屬性增加 15%
  { count: 8, bonusPercent: 0.50 }, // 8件神級，所有裝備所有屬性增加 20%
  { count: 9, bonusPercent: 1.0 }, // 9件神級，所有裝備所有屬性增加 25%
];


// --- 核心突破函式 ---

function breakElementEquipment(key) {
  const eq = elementGearData[key];
  if (!eq) return;
  
  const currentLevel = eq.break || 0;
  const nextLevelIndex = currentLevel;
  
  if (nextLevelIndex >= BREAKTHROUGH_MAX_LEVEL) {
    alert("⚠️ 裝備已達到突破上限！");
    return;
  }
  
  if (eq.starforce < 0) {
    alert(`❌ 突破失敗：需要裝備星力達到30★才能進行突破！`);
    return;
  }
  
  const stageData = breakthroughData[nextLevelIndex];
  const costItem = BREAKTHROUGH_COST;
  
  if (typeof getItemQuantity !== 'function' || typeof removeItem !== 'function') {
    alert("❌ 遊戲初始化不完整，缺少getItemQuantity或removeItem函式。");
    return;
  }
  
  const owned = getItemQuantity(costItem);
  if (owned < stageData.costAmount) {
    alert(`❌ 突破失敗：需要 ${costItem} ×${stageData.costAmount}`);
    return;
  }
  
  removeItem(costItem, stageData.costAmount);
  
  const roll = Math.random() * 100;
  let message = '';
  
  if (roll < stageData.successRate) {
    eq.break = currentLevel + 1;
    message = `✅ 突破成功！ ${eq.name} 已提升至 ${eq.break} 階段。`;
    saveGame?.();
    if (eq.break === BREAKTHROUGH_MAX_LEVEL) {
      eq.isDivine = true;
      message += `\n✨ ${eq.name} 達到神級，已解鎖套裝系統！`;
      
    }
    
  } else {
    message = `💥 突破失敗，${eq.name} 等級維持不變。`;
    
  }
  
  alert(message);
  
  if (typeof updateElementSetBonus === 'function') updateElementSetBonus();
  if (typeof applyElementEquipmentBonusToPlayer === 'function') applyElementEquipmentBonusToPlayer();
  if (typeof updateElementEquipmentPanelContent === 'function') updateElementEquipmentPanelContent();
  if (typeof updateAllUI === "function") updateAllUI();
}

function updateElementSetBonus() {
  // 這個函式不再有實質作用，因為套裝加成會由統一計算函式動態計算。
  // 我們只確保 isDivine 狀態正確即可。
  let divineCount = 0;
  for (const key in elementGearData) {
    if (elementGearData[key].isDivine) {
      divineCount++;
    }
  }
  // 如果你需要基於 divineCount 做其他事情，可以在這裡寫。
}

window.breakElementEquipment = breakElementEquipment;
window.updateElementSetBonus = updateElementSetBonus;
