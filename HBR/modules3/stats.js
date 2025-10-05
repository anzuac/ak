// stats.js — 精簡整合版：三池獨立統計 + Tab切換 + 歷史紀錄 + 票券抽卡 + 資源消耗
import { drawPreset } from "./gacha_core.js";
import { ratesConfig } from "./rates_ticket.js"; // 可換回 ./rates.js 用於一般池
import { units } from "./units.js";
import { addHistory, loadHistory, clearHistory } from "./history.js";
import { mountSSStatsButton } from "./ss_stats_modal.js";

mountSSStatsButton?.("btnSSStats");

/* ---------- 常數 & 小工具 ---------- */
const POOLS = ["normal", "ticketS", "ticketTenS"];
const POOL_LABELS = {
  single: "一般",
  ten: "一般（十連）",
  ticketSS: "SS 券",     // 不進統計
  ticketS: "S 以上券",
  ticketTenS: "十連必得 S 券",
};
const PRESET_TO_POOL = {
  single: "normal",
  ten: "normal",
  ticketSS: "ticketSS",       // 特例：不進統計
  ticketS: "ticketS",
  ticketTenS: "ticketTenS",
};
const FALLBACK_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBCF3w9uEAAAAASUVORK5CYII=";

const getSSRate = () => {
  const v = ratesConfig?.tables?.general?.SS ?? ratesConfig?.SS;
  const n = Number(v);
  return Number.isFinite(n) ? n / 100 : 0.03;
};
const getPuTotalRate = () => {
  const pu = ratesConfig?.pu || {};
  if (pu.rateTotal != null) {
    const n = Number(pu.rateTotal);
    return Number.isFinite(n) ? n / 100 : 0;
  }
  if (pu.rateEach != null && Array.isArray(pu.units)) {
    const each = Number(pu.rateEach);
    if (Number.isFinite(each)) return (each * pu.units.length) / 100;
  }
  return 0;
};

/* ---------- 狀態 ---------- */
const stats = {
  pools: Object.fromEntries(POOLS.map(p => [p, { total: 0, A: 0, S: 0, SS: 0 }])),
  quartzSpent: 0,
  ticketSpent: { ss: 0, s: 0, tenS: 0 },
  obtained: new Set(),
  puCounts: {},
  puHits: 0,
};
let currentTab = "normal";

/* ---------- DOM ---------- */
const grid = document.getElementById("resultsGrid");
const batchInfo = document.getElementById("batchInfo");

const totalDrawsEl = document.getElementById("totalDraws");
const countAEl = document.getElementById("countA");
const countSEl = document.getElementById("countS");
const countSSEl = document.getElementById("countSS");
const rateAEl = document.getElementById("rateA");
const rateSEl = document.getElementById("rateS");
const rateSSEl = document.getElementById("rateSS");

const luckEl = document.getElementById("luckStatus");
const puLuckEl = document.getElementById("puLuckStatus");

const quartzSpentEl = document.getElementById("quartzSpent");
const ticketSSpentEl = document.getElementById("ticketSSpent");
const ticketSSimpleSpentEl = document.getElementById("ticketSSimpleSpent");
const ticketTenSSpentEl = document.getElementById("ticketTenSSpent");

const puStatsBlock = document.getElementById("puStatsBlock");
const tabBtns = document.querySelectorAll(".tabBtn");

/* ---------- PU 區塊初始化 ---------- */
const puIds = ratesConfig?.pu?.units || [];
stats.puCounts = Object.fromEntries(puIds.map(id => [id, 0]));
if (puStatsBlock) {
  puStatsBlock.innerHTML = `
    <span class="pill" id="puTotalRate">PU 總命中率：0%</span>
    ${puIds.map(id => {
      const u = units.find(x => x.id === id);
      const name = u ? u.name : id;
      return `<span class="pill" data-pu="${id}">
        [${name}]：<b id="hit-${id}">0</b> 次 (<b id="rate-${id}">0%</b>)
      </span>`;
    }).join("")}
  `;
}

/* ---------- UI 更新 ---------- */
function updateResourceUI() {
  if (quartzSpentEl) quartzSpentEl.textContent = stats.quartzSpent;
  if (ticketSSpentEl) ticketSSpentEl.textContent = stats.ticketSpent.ss;
  if (ticketSSimpleSpentEl) ticketSSimpleSpentEl.textContent = stats.ticketSpent.s;
  if (ticketTenSSpentEl) ticketTenSSpentEl.textContent = stats.ticketSpent.tenS;
}

function renderStats() {
  const pool = stats.pools[currentTab];
  if (!pool) return;

  totalDrawsEl && (totalDrawsEl.textContent = pool.total);
  countAEl && (countAEl.textContent = pool.A);
  countSEl && (countSEl.textContent = pool.S);
  countSSEl && (countSSEl.textContent = pool.SS);

  const pct = (n, d) => (d ? (n / d * 100).toFixed(2) : "0.00");
  rateAEl && (rateAEl.textContent = `${pct(pool.A, pool.total)}%`);
  rateSEl && (rateSEl.textContent = `${pct(pool.S, pool.total)}%`);
  rateSSEl && (rateSSEl.textContent = `${pct(pool.SS, pool.total)}%`);

  // 歐非值只對一般池顯示；其他池提示
  if (luckEl) {
    if (currentTab !== "normal") {
      luckEl.textContent = "僅一般池";
    } else {
      const total = stats.pools.normal.total;
      if (total < 50) luckEl.textContent = "樣本不足";
      else {
        const expected = total * getSSRate();
        const actual = stats.pools.normal.SS;
        const dev = expected > 0 ? ((actual - expected) / expected) * 100 : 0;
        let label =
          dev <= -50 ? "非洲酋長 💀" :
          dev <= -25 ? "偏非" :
          dev <  25 ? "正常" :
          dev <  50 ? "偏歐" : "歐皇 🌟";
        luckEl.textContent = `${label} (${dev.toFixed(1)}%)`;
      }
    }
  }

  // PU Luck（若需要，沿用一般池）
  if (puLuckEl) {
    if (currentTab !== "normal") {
      puLuckEl.textContent = "僅一般池";
    } else {
      const total = stats.pools.normal.total;
      const puTotalRate = getPuTotalRate();
      if (total < 50 || puTotalRate <= 0) puLuckEl.textContent = "樣本不足";
      else {
        const actualPU = Object.values(stats.puCounts).reduce((a, b) => a + (b || 0), 0);
        const expectedPU = total * puTotalRate;
        const dev = expectedPU > 0 ? ((actualPU - expectedPU) / expectedPU) * 100 : 0;
        let label =
          dev <= -50 ? "非洲酋長 💀" :
          dev <= -25 ? "偏非" :
          dev <  25 ? "正常" :
          dev <  50 ? "偏歐" : "歐皇 🌟";
        puLuckEl.textContent = `${label} (${dev.toFixed(1)}%)`;
      }
    }
  }
}

function switchTab(tab) {
  currentTab = POOLS.includes(tab) ? tab : "normal";
  tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === currentTab));
  renderStats();
}

/* ---------- 統計 & 卡片 ---------- */
function applyStats(unit, poolType) {
  if (poolType === "ticketSS") return; // 保底SS券不統計
  const pool = stats.pools[poolType];
  if (!pool) return;
  pool.total++;
  pool[unit.rarity] = (pool[unit.rarity] || 0) + 1;

  // PU 統計（只要 ratesConfig.pu 有啟用）
  const isPU = !!(ratesConfig?.pu?.enabled && ratesConfig.pu.units.includes(unit.id));
  if (isPU) {
    stats.puHits++;
    stats.puCounts[unit.id] = (stats.puCounts[unit.id] || 0) + 1;
  }
}

function updatePUChips(totalDrawsForRate) {
  if (!puStatsBlock) return;
  let totalPuHits = 0;
  for (const id of puIds) {
    totalPuHits += stats.puCounts[id] || 0;
    const hitEl = document.getElementById(`hit-${id}`);
    const rateEl = document.getElementById(`rate-${id}`);
    if (hitEl) hitEl.textContent = stats.puCounts[id] || 0;
    if (rateEl) {
      const r = totalDrawsForRate ? ((stats.puCounts[id] / totalDrawsForRate) * 100).toFixed(2) : "0.00";
      rateEl.textContent = `${r}%`;
    }
  }
  const totalRateEl = document.getElementById("puTotalRate");
  if (totalRateEl) {
    const r = totalDrawsForRate ? ((totalPuHits / totalDrawsForRate) * 100).toFixed(2) : "0.00";
    totalRateEl.textContent = `PU 總命中率：${r}%`;
  }
}

function createCard({ unit, isNew, isPU }) {
  const card = document.createElement("article");
  card.className = `card rarity-${unit?.rarity || "A"}`;

  const imgBox = document.createElement("div");
  imgBox.className = "card-img";

  const img = document.createElement("img");
  img.src = `assets/images/units/${unit?.img || ""}`;
  img.alt = unit?.name || "unknown";
  img.loading = "lazy";
  img.onerror = function () { this.onerror = null; this.src = FALLBACK_DATA_URL; };
  imgBox.appendChild(img);

  const tags = document.createElement("div");
  tags.className = "tags";
  if (isNew) { const t = document.createElement("span"); t.className = "tag new"; t.textContent = "NEW"; tags.appendChild(t); }
  if (isPU)  { const t = document.createElement("span"); t.className = "tag pu";  t.textContent = "PU";  tags.appendChild(t); }
  imgBox.appendChild(tags);

  const info = document.createElement("div");
  info.className = "card-info";
  const name = document.createElement("p");
  name.className = "name"; name.textContent = unit?.name || "(未知)";
  info.appendChild(name);

  card.appendChild(imgBox);
  card.appendChild(info);
  return card;
}

/* ---------- 抽卡主流程 ---------- */
async function runPreset(presetKey, batchLabel) {
  const { units: list, cost } = drawPreset(presetKey);
  const poolType = PRESET_TO_POOL[presetKey] ?? "normal";
  const frag = document.createDocumentFragment();

  // 供歷史紀錄顯示用
  const poolLabel = POOL_LABELS[presetKey] ?? "一般";

  // 當前池的抽數（不含 ticketSS，因其不入統計）
  const base = stats.pools[poolType]?.total ?? 0;

  list.forEach((unit, idx) => {
    const isPU = !!(ratesConfig?.pu?.enabled && ratesConfig.pu.units.includes(unit.id));
    const isNew = !stats.obtained.has(unit.id);
    const isGuarantee =
      (presetKey === "ten" || presetKey === "ticketTenS") ? (idx === list.length - 1) :
      (presetKey === "ticketS" || presetKey === "ticketSS");

    stats.obtained.add(unit.id);
    frag.appendChild(createCard({ unit, isNew, isPU }));

    applyStats(unit, poolType);
    // drawNumber 以各自池的統計為基準（ticketSS 雖不入統計，仍用 base + idx + 1 顯示）
    addHistory(poolLabel, unit, isPU, base + idx + 1, isGuarantee);
  });

  // 成本
  stats.quartzSpent += Number(cost?.quartz) || 0;
  if (cost?.tickets?.s)    stats.ticketSpent.s    += cost.tickets.s;
  if (cost?.tickets?.tenS) stats.ticketSpent.tenS += cost.tickets.tenS;
  if (cost?.tickets?.ss)   stats.ticketSpent.ss   += cost.tickets.ss;

  // 更新 UI
  updateResourceUI();
  grid.innerHTML = "";
  grid.appendChild(frag);
  renderStats();
  updatePUChips(stats.pools.normal.total); // PU 命中率用一般池抽數作分母較合理

  if (batchInfo) {
    const parts = [];
    if (cost?.quartz) parts.push(`石英 ${cost.quartz}`);
    if (cost?.tickets?.s)    parts.push(`S券 x${cost.tickets.s}`);
    if (cost?.tickets?.tenS) parts.push(`十連S券 x${cost.tickets.tenS}`);
    if (cost?.tickets?.ss)   parts.push(`SS券 x${cost.tickets.ss}`);
    batchInfo.textContent = `${batchLabel}｜消耗：${parts.join("、") || "—"}`;
  }
}

/* ---------- Reset ---------- */
function resetStats() {
  POOLS.forEach(p => Object.assign(stats.pools[p], { total: 0, A: 0, S: 0, SS: 0 }));
  stats.quartzSpent = 0;
  stats.ticketSpent = { ss: 0, s: 0, tenS: 0 };
  stats.puHits = 0;
  stats.puCounts = Object.fromEntries(puIds.map(id => [id, 0]));
  stats.obtained.clear();

  updateResourceUI();
  grid.innerHTML = "";
  batchInfo && (batchInfo.textContent = "—");
  clearHistory();
  renderStats();
  updatePUChips(stats.pools.normal.total);
}

/* ---------- 事件綁定（精簡） ---------- */
[
  ["btnSingle",      () => runPreset("single",     "本次：1 抽")],
  ["btnTen",         () => runPreset("ten",        "本次：10 連")],
  ["btnTicketSS",    () => runPreset("ticketSS",   "🎟️ 保底 SS 抽卡")],
  ["btnTicketS",     () => runPreset("ticketS",    "🎟️ S 以上抽卡")],
  ["btnTicketTenS",  () => runPreset("ticketTenS", "🎟️ 十連必得 S 以上")],
  ["btnReset",       () => resetStats()],
].forEach(([id, fn]) => document.getElementById(id)?.addEventListener("click", fn));

// Tab 切換
tabBtns.forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));

/* ---------- 初始化 ---------- */
loadHistory();
renderStats();
updateResourceUI();
updatePUChips(stats.pools.normal.total);