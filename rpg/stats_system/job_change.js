// ==========================
// job_change.js（二轉開始）
// ==========================

// 轉職等級與寶珠需求（從二轉開始）
const JOB_CHANGE_REQUIREMENTS = [
  { level: 30,  cost: 25 },  // 二轉
  { level: 70,  cost: 200 },  // 三轉
  { level: 120, cost: 400 },  // 四轉
  { level: 200, cost: 800 },  // 五轉
];

// 父系對應的子系路線
const JOB_PATH = {
  warrior: ["warrior2","warrior3","warrior4","warrior5"],
  mage:    ["mage2","mage3","mage4","mage5"],
  archer:  ["archer2","archer3","archer4","archer5"],
  thief:   ["thief2","thief3","thief4","thief5"]
};

// 已完成的轉職節點
window.__jobChangeDoneLevels = window.__jobChangeDoneLevels || new Set();
function isJobLevelConsumed(level) { return __jobChangeDoneLevels.has(level); }
function markJobLevelConsumed(level) { __jobChangeDoneLevels.add(level); }

// 取得下一個可轉職需求
function getNextJobChangeRequirement(currentLevel) {
  for (const req of JOB_CHANGE_REQUIREMENTS) {
    if (currentLevel >= req.level && !isJobLevelConsumed(req.level)) {
      return req;
    }
  }
  return null;
}

// 點擊轉職
function handleJobChangeClick() {
  const lv = Number.isFinite(player?.level) ? player.level : 0;
  const req = getNextJobChangeRequirement(lv);

  if (!req) {
    alert("目前沒有可進行的轉職節點（可能等級未達或已完成）。");
    return;
  }

  const ITEM_NAME = "轉職寶珠";
  const owned = getItemQuantity?.(ITEM_NAME) || 0;
  if (owned < req.cost) {
    alert(`轉職需要 ${ITEM_NAME} ×${req.cost}，目前只有 ${owned} 顆。`);
    return;
  }

  if (!confirm(`將消耗 ${req.cost} 顆「${ITEM_NAME}」進行轉職，是否確定？`)) return;

  removeItem(ITEM_NAME, req.cost);
  markJobLevelConsumed(req.level);

  openJobChangePanel({ levelNode: req.level });
}

// 開啟轉職面板（自動依當前職業往上升階）
function openJobChangePanel({ levelNode }) {
  let base = player.job;
  // 一直往 parent 找，直到找到父系（warrior/mage/archer/thief）
  while (jobs[base]?.parent) base = jobs[base].parent;

  const path = JOB_PATH[base];
  if (!path) { alert("找不到此職業的轉職路線。"); return; }

  // 計算這次應該升到第幾轉（30=二轉=path[0], 70=三轉=path[1], ...）
  const index = JOB_CHANGE_REQUIREMENTS.findIndex(r => r.level === levelNode);
  const targetJobKey = path[index];
  if (!targetJobKey || !jobs[targetJobKey]) {
    alert("尚未配置該轉職職業。");
    return;
  }

  if (!confirm(`確認轉職為「${jobs[targetJobKey].name}」？`)) return;

  applyJobChange(levelNode, targetJobKey);
}

// 真正套用
function applyJobChange(levelNode, jobKey) {
  player.job = jobKey;

  // 🎁 每次轉職額外給 20 點屬性點數
  player.statPoints = (player.statPoints || 0) + 20;

  if (typeof recomputeTotalStats === "function") recomputeTotalStats();
  if (typeof updateResourceUI === "function") updateResourceUI();

  alert(`✅ 轉職完成！目前職業：${jobs[jobKey].name}\n🎁 獲得額外 20 屬性點數！`);

  // 🏆 在轉職成功後，立即呼叫存檔函式
  if (typeof saveGame === "function") {
    saveGame();
  }
}

// 綁定按鈕
document.getElementById("job-change-btn")
  ?.addEventListener("click", handleJobChangeClick);
