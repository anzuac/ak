// save_clover.js
// 專管「幸運草系統」的存檔/載入（不改動 clover.js）
// 請在 clover.js 之後載入

// 匯出存檔資料（只存最小必要：等級）
function dumpClover() {
  const lv = (typeof cloverData === 'object' && cloverData) ? (cloverData.level || 0) : 0;
  return { __v: 1, level: lv };
}

// 匯入存檔資料（重設等級，再讓 clover.js 自己重算加成）
function loadClover(saved) {
  if (!saved || typeof saved !== 'object') return;
  if (typeof window.cloverData !== 'object' || !window.cloverData) return;

  const lv = Math.max(0, Math.floor(Number(saved.level) || 0));
  window.cloverData.level = lv;

  // 讓 clover.js 內部重新套入 player.coreBonus
  if (typeof window.initializeCloverSystem === 'function') {
    try { window.initializeCloverSystem(); } catch {}
  }

  // 若有 UI，刷新
  if (typeof window.updateResourceUI === 'function') {
    try { window.updateResourceUI(); } catch {}
  }
  if (typeof window.renderCloverModal === 'function') {
    try { window.renderCloverModal(); } catch {}
  }
}