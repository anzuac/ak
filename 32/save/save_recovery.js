// save_recovery.js
// 專門負責「恢復系統」的存檔 / 載入

// 匯出存檔資料
function dumpRecovery() {
  return {
    __v: 1, // 版本號，未來調整演算法方便做轉換
    level: recoverySystem?.level || 1
  };
}

// 匯入存檔資料
function loadRecovery(data) {
  if (!data) return;
  // 確保 level 合法
  const lv = Math.max(1, Math.min(recoverySystem.maxLevel, data.level || 1));
  recoverySystem.level = lv;

  // 重新套用加成到 player
  applySystemPercentToPlayer();
}