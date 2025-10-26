// ===============================
// element_breakthrough.js
// 裝備突破系統（最終版）
// - Break 上限 10
// - 需要星力 >= 30★ 才能進行突破
// - 成功到 10 時標記 isDivine = true（僅作標記；套裝判定以 break>=10 為準）
// - 不回寫任何舊版 setBonusData，加成由 element_equipment 模組動態計算
// - 導出 window.breakthroughData，供裝備計算讀取每階 bonusPercent
// ===============================

(() => {
  "use strict";
  
  // --- 常數與資料結構 ---
  const BREAKTHROUGH_MAX_LEVEL = 10;
  const BREAKTHROUGH_COST = "元素精華";
  
  // 各階成本、成功率、加成％（由 element_equipment 讀取 bonusPercent）
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
    { costAmount: 1000, successRate: 10, bonusPercent: 0.20, special: true }, // Stage 10 (神級)
  ];
  
  // 對外提供突破係數（供 element_equipment 讀取）
  window.breakthroughData = breakthroughData;
  
  // --- 內部工具 ---
  function n(v, d) { v = Number(v); return isFinite(v) ? v : (d || 0); }
  
  function ensureDeps() {
    if (typeof window.elementGearData !== 'object') {
      alert("❌ 突破失敗：元素裝備資料未初始化（elementGearData）。");
      return false;
    }
    if (typeof window.getItemQuantity !== 'function' || typeof window.removeItem !== 'function') {
      alert("❌ 遊戲初始化不完整：缺少 getItemQuantity/removeItem。");
      return false;
    }
    return true;
  }
  
  // --- 核心突破函式 ---
  function breakElementEquipment(key) {
    if (!ensureDeps()) return;
    
    const eq = window.elementGearData[key];
    if (!eq) { alert("❌ 找不到指定的裝備。"); return; }
    
    const currentLevel = n(eq.break, 0);
    const nextLevelIndex = currentLevel; // 0-based 對應下一階段資料
    
    if (nextLevelIndex >= BREAKTHROUGH_MAX_LEVEL) {
      alert("⚠️ 裝備已達到突破上限！");
      return;
    }
    
    // 星力門檻（需 >= 30★）
    if (n(eq.starforce, 0) < 30) {
      alert("❌ 突破失敗：需要裝備星力達到 30★ 才能進行突破！");
      return;
    }
    
    const stageData = breakthroughData[nextLevelIndex];
    if (!stageData) { alert("❌ 找不到對應的突破階段資料。"); return; }
    
    const costItem = BREAKTHROUGH_COST;
    const need = n(stageData.costAmount, 0);
    const owned = window.getItemQuantity(costItem);
    
    if (owned < need) {
      alert(`❌ 突破失敗：需要 ${costItem} ×${need}（持有 ${owned}）`);
      return;
    }
    
    // 扣除成本
    window.removeItem(costItem, need);
    
    // 擲骰成功率
    const roll = Math.random() * 100;
    let message = '';
    
    if (roll < n(stageData.successRate, 0)) {
      // 成功
      eq.break = currentLevel + 1;
      message = `✅ 突破成功！ ${eq.name} 已提升至 ${eq.break} 階段。`;
      
      // 到 10 樓做旗標（套裝判定以 break>=10 為主；此旗標純標記用）
      if (eq.break === BREAKTHROUGH_MAX_LEVEL) {
        eq.isDivine = true;
        message += `\n✨ ${eq.name} 達到神級！`;
      }
      
      // 存檔
      window.saveGame?.();
      
    } else {
      // 失敗不降階（維持不變）
      message = `💥 突破失敗，${eq.name} 等級維持不變。`;
    }
    
    alert(message);
    
    // 同步一切顯示與加成（不回寫任何舊版 setBonus）
    try { window.updateElementSetBonus?.(); } catch (e) {}
    try { window.applyElementEquipmentBonusToPlayer?.(); } catch (e) {}
    try { window.updateElementEquipmentPanelContent?.(); } catch (e) {}
    try { window.updateAllUI?.(); } catch (e) {}
    try { window.EquipHub?.requestRerender?.(); } catch (e) {}
  }
  
  // ---（可選）統計用：不回寫任何舊版套裝狀態 ---
  function updateElementSetBonus() {
    // 現版的套裝加成由 element_equipment 動態計算。
    // 這裡僅提供「神聖件數」計算的掛鉤點（如需觸發其他事件可在此加）。
    let divineCount = 0;
    const gear = window.elementGearData || {};
    for (const k in gear) {
      const e = gear[k];
      if (n(e?.break, 0) >= 10) divineCount++;
    }
    // 需要時可在此觸發事件（不寫任何加成資料）
    // e.g., window.onDivineCountChanged?.(divineCount);
  }
  
  // --- 導出 ---
  window.breakElementEquipment = breakElementEquipment;
  window.updateElementSetBonus = updateElementSetBonus;
  window.BREAKTHROUGH_MAX_LEVEL = BREAKTHROUGH_MAX_LEVEL;
  window.BREAKTHROUGH_COST = BREAKTHROUGH_COST;
  
})();