// history.js － 抽卡歷史紀錄 (文字版 + PU 過濾 + 保底 + SS 統計 + 永續化)

const STORAGE_KEY = "gachaHistory_v1";
const MAX_HISTORY = 2000;

let historyList = [];          // 主要資料來源（會從 localStorage 載入）
let filterMode  = "all";       // "all" | "pu"

/* ------------------------- 對外 API ------------------------- */

/** 初始化：從 localStorage 載入並渲染 */
export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    historyList = raw ? JSON.parse(raw) : [];
  } catch {
    historyList = [];
  }
  if (!Array.isArray(historyList)) historyList = [];

  // 上限裁切
  if (historyList.length > MAX_HISTORY) {
    historyList = historyList.slice(historyList.length - MAX_HISTORY);
    persist();
  }

  renderHistory();
}

/** 新增一筆歷史紀錄 */
export function addHistory(poolName, unit, isPU, drawNumber, isGuarantee = false) {
  const rec = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    pool: poolName || "一般",
    unitId: unit?.id ?? "",
    name: unit?.name ?? "(未知)",
    rarity: unit?.rarity ?? "A",
    isPU: !!isPU,
    timestamp: Date.now(),
    drawNumber: drawNumber || 0,
    isGuarantee: !!isGuarantee,
  };

  historyList.push(rec);
  if (historyList.length > MAX_HISTORY) {
    historyList.splice(0, historyList.length - MAX_HISTORY);
  }
  persist();
  renderHistory();
}

/** 清空歷史紀錄 */
export function clearHistory() {
  historyList = [];
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  renderHistory();
}

/** 重新渲染（最新在最上面） */
export function renderHistory() {
  const el = document.getElementById("historyList");
  if (!el) return;

  const data = (filterMode === "pu")
    ? historyList.filter(h => h.isPU)
    : historyList;

  // 由新到舊（最新在最上面）
  const items = [...data].reverse().map(h => {
    const time = new Date(h.timestamp).toLocaleString();
    let cls = (h.rarity === "SS") ? "hist-SS" :
              (h.rarity === "S")  ? "hist-S"  : "hist-A";
    if (h.isPU) cls += " hist-PU";
    if (h.isGuarantee) cls += " hist-Guarantee";

    const puTag = h.isPU ? "｜PU" : "";
    const gTag  = h.isGuarantee ? "｜保底" : "";

    return `<li class="${cls}">
      [第 ${h.drawNumber} 抽${gTag}] [${time}] 池：${escapeHTML(h.pool)} ｜ ${h.rarity}${puTag} ｜ ${escapeHTML(h.name)}
    </li>`;
  });

  el.innerHTML = items.join("");

  // 每次重繪後固定停留在最上面（最新）
  el.scrollTop = 0;
}

/** 切換過濾模式："all" | "pu" */
export function setFilter(mode) {
  filterMode = (mode === "pu") ? "pu" : "all";
  renderHistory();
  return filterMode;
}

/**
 * 取得 SS 統計資料（供彈窗用）
 * 回傳 { rows:[{name,pool,count}], totalDraws:number, ssTotal:number }
 * rows 依「同名 + 同池」分組（不顯示內部 id）
 */
export function getSSStats() {
  let source = [];
  try {
    // 優先用記憶體；沒有再讀 localStorage
    if (Array.isArray(historyList) && historyList.length) {
      source = historyList;
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      source = raw ? JSON.parse(raw) : [];
    }
  } catch {
    source = [];
  }

  const totalDraws = source.length;

  // 只取 SS
  const ssOnly = source.filter(e => (e?.rarity ?? e?.unit?.rarity) === "SS");
  const ssTotal = ssOnly.length;

  // 以「名稱 + 池」分組（名稱優先，避免顯示內部 id）
  const map = new Map(); // key -> {name, pool, count}
  const collator = new Intl.Collator("zh-Hant");

  for (const e of ssOnly) {
    const name = (e && (e.name || e.unit?.name)) || "(未知)";
    const pool = e?.pool || "一般";
    const key  = `${name}||${pool}`;
    const rec  = map.get(key) || { name, pool, count: 0 };
    rec.count++;
    map.set(key, rec);
  }

  // 次數多→少；同次數按中文名；再按池名
  const rows = Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const byName = collator.compare(a.name, b.name);
    if (byName !== 0) return byName;
    return collator.compare(a.pool, b.pool);
  });

  return { rows, totalDraws, ssTotal };
}

/* ------------------------- 內部工具 ------------------------- */

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(historyList)); } catch {}
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
