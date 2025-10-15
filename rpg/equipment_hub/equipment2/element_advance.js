// ===============================
// element_liberation.js  (取代原先 element_advance.js 的進階系統)
// 解放系統：R → SR → SSR → UR → LR
// - 使用「進階石」×1
// - 成功率固定 30%（失敗不降階）
// - 每升 1 階 +5% 能力（請將 element_equipment 中的 LIBERATION_PER_LVL 調為 0.05 以完全對齊）
// - 需先達成「神聖件數 ≥ 9」方可進行解放
// - 導出 liberateElementEquipment；並提供 advanceElementEquipment 的相容別名（呼叫同一函式）
// ===============================

(function(w) {
  "use strict";
  
  const LIB_RANKS = ["R", "SR", "SSR", "UR", "LR"]; // 共 5 階
  const SUCCESS_RATE = 30; // 固定 30%
  const COST_ITEM = "進階石";
  const COST_AMOUNT = 1;
  
  // 對外提供：每階 +5%（給其他模組取用）
  w.getLiberationPerLevelBonus = function() { return 0.05; };
  // 若你希望其他檔案直接讀常數，也一併掛個旗標（不強制使用）
  w.LIBERATION_PER_LVL_OVERRIDE = 0.05;
  
  function n(v, d) { v = Number(v); return Number.isFinite(v) ? v : (d || 0); }
  
  function getDivineCount() {
    let c = 0;
    const gear = w.elementGearData || {};
    for (const k in gear) {
      const e = gear[k];
      if (n(e?.break, 0) >= 10) c++;
    }
    return c;
  }
  
  function getRankIndexFromLevel(level) {
    // 我們將 eq.liberation 當作「階數」：1~5 對應 R~LR；0或未定義 = 尚未解放
    const L = Math.max(0, Math.floor(n(level, 0)));
    return Math.min(Math.max(L - 1, 0), LIB_RANKS.length - 1); // 轉為 0-based index
  }
  
  function getRankText(level) {
    if (!level || level <= 0) return "—";
    return LIB_RANKS[getRankIndexFromLevel(level)] || "—";
  }
  
  function canLiberateNow() {
    // 雙重保護：需 9 件神聖裝（Break ≥ 10）
    return getDivineCount() >= 9;
  }
  
  function liberateElementEquipment(key) {
    const eq = w.elementGearData?.[key];
    if (!eq) return;
    
    if (!canLiberateNow()) {
      alert("❌ 尚未達成條件：需要神聖件數 ≥ 9 才能進行解放。");
      return;
    }
    
    const currentLevel = n(eq.liberation, 0); // 0~5（0 表未解放；5=LR）
    if (currentLevel >= LIB_RANKS.length) {
      alert(`⚠️ ${eq.name} 已達解放上限（${LIB_RANKS[LIB_RANKS.length-1]}）`);
      // 照樣刷新一次顯示
      w.applyElementEquipmentBonusToPlayer?.();
      w.updateElementEquipmentPanelContent?.();
      if (typeof w.updateAllUI === "function") w.updateAllUI();
      return;
    }
    
    if (typeof w.getItemQuantity !== 'function' || typeof w.removeItem !== 'function') {
      alert("❌ 遊戲初始化不完整，缺少 getItemQuantity 或 removeItem。");
      return;
    }
    
    const owned = w.getItemQuantity(COST_ITEM);
    if (owned < COST_AMOUNT) {
      alert(`❌ 解放失敗：需要 ${COST_ITEM} ×${COST_AMOUNT}`);
      return;
    }
    
    // 扣成本
    w.removeItem(COST_ITEM, COST_AMOUNT);
    
    // 擲骰
    const roll = Math.random() * 100;
    let message = "";
    
    if (roll < SUCCESS_RATE) {
      eq.liberation = currentLevel + 1;
      const rankText = getRankText(eq.liberation);
      message = `🌀 ${eq.name} 解放成功！已提升至 ${rankText}`;
      w.saveGame?.();
    } else {
      const rankText = getRankText(currentLevel);
      message = `💥 ${eq.name} 解放失敗，保持在 ${rankText}`;
      // 失敗不降階
    }
    
    alert(message);
    
    // 更新加成 & UI
    w.applyElementEquipmentBonusToPlayer?.();
    w.updateElementEquipmentPanelContent?.();
    if (typeof w.updateAllUI === "function") w.updateAllUI();
    w.EquipHub?.requestRerender?.();
  }
  
  // 相容舊名稱（若仍有地方呼叫 advanceElementEquipment，讓它指向解放）
  w.liberateElementEquipment = liberateElementEquipment;
  w.advanceElementEquipment = liberateElementEquipment;
  
})(window);