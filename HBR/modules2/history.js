// history.js － 抽卡歷史紀錄（上限2000＋亮光特效＋PU過濾＋第幾抽＋保底標記）

const STORAGE_KEY = "gachaHistory_v1";
const MAX_HISTORY = 2000;

let history = [];
let showOnlyPU = false; // ← 控制是否只顯示 PU

/* ---------- 載入 ---------- */
export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    history = raw ? JSON.parse(raw) : [];
  } catch {
    history = [];
  }
  
  if (history.length > MAX_HISTORY) {
    history = history.slice(history.length - MAX_HISTORY);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch {}
  }
  
  renderHistory();
}

/* ---------- 新增 ---------- */
export function addHistory(poolName, unit, isPU, drawNumber, isGuarantee = false) {
  const record = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    pool: poolName || "一般池",
    unitId: unit?.id ?? "",
    name: unit?.name ?? "(未知)",
    rarity: unit?.rarity ?? "A",
    isPU: !!isPU,
    timestamp: Date.now(),
    drawNumber: drawNumber || 0,
    isGuarantee
  };
  
  history.push(record);
  
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {}
  
  renderHistory();
}

/* ---------- 清空 ---------- */
export function clearHistory() {
  history = [];
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  renderHistory();
}

/* ---------- 渲染 ---------- */
export function renderHistory() {
  const list = document.getElementById("historyList");
  if (!list) return;
  
  const data = showOnlyPU ? history.filter(h => h.isPU) : history;
  
  const items = [...data].reverse().map(h => {
    const time = new Date(h.timestamp).toLocaleString();
    let cls = (h.rarity === "SS") ? "hist-SS" :
      (h.rarity === "S") ? "hist-S" : "hist-A";
    if (h.isPU) cls += " hist-PU";
    if (h.isGuarantee) cls += " hist-Guarantee";
    
    const puTag = h.isPU ? "｜PU" : "";
    const gTag = h.isGuarantee ? "｜保底" : "";
    
    return `<li class="${cls}">[第 ${h.drawNumber} 抽${gTag}] [${time}] 池：${escapeHTML(h.pool)} ｜ ${h.rarity}${puTag} ｜ ${escapeHTML(h.name)}</li>`;
  });
  
  list.innerHTML = items.join("");
}

/* ---------- PU 過濾切換 ---------- */
export function togglePUFilter() {
  showOnlyPU = !showOnlyPU;
  renderHistory();
  return showOnlyPU;
}

/* ---------- 工具 ---------- */
function escapeHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}