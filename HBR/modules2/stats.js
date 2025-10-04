// stats.js － 抽卡結果統計 + PU 統計 + 歐非值 (SS/PU) + 歷史紀錄
import { drawOne, drawTen } from "./gacha_core.js";
import { ratesConfig } from "./rates.js";
import { units } from "./units.js";
import { addHistory, loadHistory, clearHistory } from "./history.js";

/* ---------- 工具：讀取理論機率 ---------- */
function getSSRate() {
  const v =
    (ratesConfig.pool && ratesConfig.pool.SS) ??
    (ratesConfig.tables && ratesConfig.tables.general && ratesConfig.tables.general.SS) ??
    (ratesConfig.tables && ratesConfig.tables.single && ratesConfig.tables.single.SS) ??
    ratesConfig.SS;
  const n = Number(v);
  return Number.isFinite(n) ? n / 100 : 0.03; // 預設 3%
}
function getPuTotalRate() {
  const pu = ratesConfig.pu || {};
  if (pu.rateTotal != null) {
    const n = Number(pu.rateTotal);
    return Number.isFinite(n) ? n / 100 : 0;
  }
  if (pu.rateEach != null && Array.isArray(pu.units)) {
    const each = Number(pu.rateEach);
    if (Number.isFinite(each)) return (each * pu.units.length) / 100;
  }
  return 0;
}

/* ---------- 統計資料 ---------- */
const stats = {
  totalDraws: 0,
  quartzSpent: 0,
  countA: 0,
  countS: 0,
  countSS: 0,
  puHits: 0,
  puCounts: {},
  obtained: new Set()
};

/* ---------- DOM ---------- */
const btnSingle = document.getElementById("btnSingle");
const btnTen = document.getElementById("btnTen");
const btnReset = document.getElementById("btnReset");
const grid = document.getElementById("resultsGrid");

const totalDrawsEl = document.getElementById("totalDraws");
const quartzSpentEl = document.getElementById("quartzSpent");
const countAEl = document.getElementById("countA");
const countSEl = document.getElementById("countS");
const countSSEl = document.getElementById("countSS");
const rateAEl = document.getElementById("rateA");
const rateSEl = document.getElementById("rateS");
const rateSSEl = document.getElementById("rateSS");
const batchInfo = document.getElementById("batchInfo");
const puStatsBlock = document.getElementById("puStatsBlock");
const luckEl = document.getElementById("luckStatus");
const puLuckEl = document.getElementById("puLuckStatus");

const CURRENT_POOL_NAME = "限定";

/* ---------- 初始化 PU 區塊 ---------- */
const puIds = ratesConfig.pu?.units || [];
stats.puCounts = Object.fromEntries(puIds.map(id => [id, 0]));

if (puStatsBlock) {
  puStatsBlock.innerHTML = `
    <span class="pill" id="puTotalRate">PU 總命中率：0%</span>
    ${puIds.map(id => {
      const unit = units.find(u => u.id === id);
      const name = unit ? unit.name : id;
      return `<span class="pill" data-pu="${id}">
        [${name}]：<b id="hit-${id}">0</b> 次 (<b id="rate-${id}">0%</b>)
      </span>`;
    }).join("")}
  `;
}

/* ---------- 排隊 + 冷卻 ---------- */
let queue = [];
let running = false;
const COOLDOWN_MS = 180;

function setBusy(b) {
  if (btnSingle) btnSingle.disabled = b;
  if (btnTen) btnTen.disabled = b;
  document.querySelector(".results")?.setAttribute("aria-busy", b ? "true" : "false");
}
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function enqueue(type){ queue.push({ type }); if (!running) processQueue(); }

async function processQueue() {
  running = true; setBusy(true);
  try {
    while (queue.length) {
      const job = queue.shift();
      try {
        if (job.type === "single") await doSingleTx();
        else if (job.type === "ten") await doTenTx();
      } catch (e) {
        console.error("[draw error]", e);
        renderErrorCard(String(e?.message || e || "抽卡失敗"));
      }
      await sleep(COOLDOWN_MS);
    }
  } finally {
    setBusy(false); running = false;
  }
}

/* ---------- 圖片 fallback ---------- */
const FALLBACK_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMBCF3w9uEAAAAASUVORK5CYII=";

function createCard(unit, isNew, isPU) {
  const card = document.createElement("article");
  card.className = `card rarity-${unit?.rarity || "A"}`;

  const imgBox = document.createElement("div");
  imgBox.className = "card-img";

  const img = document.createElement("img");
  img.src = `assets/images/units/${unit?.img || ""}`;
  img.alt = unit?.name || "unknown";
  img.loading = "lazy";
  img.onerror = function onErrOnce() {
    this.onerror = null;
    this.src = FALLBACK_DATA_URL;
  };
  imgBox.appendChild(img);

  const tags = document.createElement("div"); tags.className = "tags";
  if (isNew) { const t=document.createElement("span"); t.className="tag new"; t.textContent="NEW"; tags.appendChild(t); }
  if (isPU)  { const t=document.createElement("span"); t.className="tag pu";  t.textContent="PU";  tags.appendChild(t); }
  imgBox.appendChild(tags);

  const info = document.createElement("div"); info.className = "card-info";
  const name = document.createElement("p"); name.className = "name"; name.textContent = unit?.name || "(未知)";
  info.appendChild(name);

  card.appendChild(imgBox); card.appendChild(info);
  return card;
}
function renderErrorCard(msg){
  grid.innerHTML = "";
  const card = document.createElement("article");
  card.className = "card rarity-A";
  card.innerHTML = `<div class="card-info"><p class="name">⚠ 抽卡顯示失敗</p><p class="subtitle">${msg}</p></div>`;
  grid.appendChild(card);
}

/* ---------- 歐非值計算 ---------- */
function getLuckStatus() {
  const total = stats.totalDraws;
  if (total < 50) return "樣本不足";
  const actualSS = stats.countSS;
  const expected = total * getSSRate();
  if (expected <= 0) return "樣本不足";
  const deviation = ((actualSS - expected) / expected) * 100;

  if (deviation <= -50) return `非洲酋長 💀 (${deviation.toFixed(1)}%)`;
  if (deviation <= -25) return `偏非 (${deviation.toFixed(1)}%)`;
  if (deviation < 25)   return `正常 (${deviation.toFixed(1)}%)`;
  if (deviation < 50)   return `偏歐 (${deviation.toFixed(1)}%)`;
  return `歐皇 🌟 (${deviation.toFixed(1)}%)`;
}
function getPuLuckStatus() {
  const total = stats.totalDraws;
  if (total < 50) return "樣本不足";
  const actualPU = stats.puHits || Object.values(stats.puCounts).reduce((a,b)=>a+(b||0),0);
  const expected = total * getPuTotalRate();
  if (expected <= 0) return "樣本不足";
  const deviation = ((actualPU - expected) / expected) * 100;

  if (deviation <= -50) return `非洲酋長 💀 (${deviation.toFixed(1)}%)`;
  if (deviation <= -25) return `偏非 (${deviation.toFixed(1)}%)`;
  if (deviation < 25)   return `正常 (${deviation.toFixed(1)}%)`;
  if (deviation < 50)   return `偏歐 (${deviation.toFixed(1)}%)`;
  return `歐皇 🌟 (${deviation.toFixed(1)}%)`;
}

/* ---------- 更新統計 ---------- */
function applyStats(unit) {
  stats.totalDraws++;
  stats.quartzSpent += ratesConfig.drawCost;

  if (unit.rarity === "A") stats.countA++;
  else if (unit.rarity === "S") stats.countS++;
  else if (unit.rarity === "SS") stats.countSS++;

  const isPU = !!(ratesConfig.pu?.enabled && ratesConfig.pu.units.includes(unit.id));
  if (isPU) {
    stats.puHits++;
    stats.puCounts[unit.id] = (stats.puCounts[unit.id] || 0) + 1;
  }

  if (totalDrawsEl) totalDrawsEl.textContent = stats.totalDraws;
  if (quartzSpentEl) quartzSpentEl.textContent = stats.quartzSpent;
  if (countAEl) countAEl.textContent = stats.countA;
  if (countSEl) countSEl.textContent = stats.countS;
  if (countSSEl) countSSEl.textContent = stats.countSS;

  const ra = stats.totalDraws ? (stats.countA / stats.totalDraws * 100).toFixed(2) : "0.00";
  const rs = stats.totalDraws ? (stats.countS / stats.totalDraws * 100).toFixed(2) : "0.00";
  const rss= stats.totalDraws ? (stats.countSS/ stats.totalDraws * 100).toFixed(2) : "0.00";
  if (rateAEl) rateAEl.textContent = `${ra}%`;
  if (rateSEl) rateSEl.textContent = `${rs}%`;
  if (rateSSEl) rateSSEl.textContent = `${rss}%`;

  let totalPuHits = 0;
  for (const id of puIds) {
    totalPuHits += stats.puCounts[id] || 0;
    const hitEl = document.getElementById(`hit-${id}`);
    if (hitEl) hitEl.textContent = stats.puCounts[id] || 0;
    const rateEl = document.getElementById(`rate-${id}`);
    if (rateEl) {
      const rate = stats.totalDraws ? (stats.puCounts[id] / stats.totalDraws * 100).toFixed(2) : "0.00";
      rateEl.textContent = `${rate}%`;
    }
  }
  const totalRateEl = document.getElementById("puTotalRate");
  if (totalRateEl) {
    const totalRate = stats.totalDraws ? (totalPuHits / stats.totalDraws * 100).toFixed(2) : "0.00";
    totalRateEl.textContent = `PU 總命中率：${totalRate}%`;
  }

  if (luckEl)   luckEl.textContent   = getLuckStatus();
  if (puLuckEl) puLuckEl.textContent = getPuLuckStatus();
}

/* ---------- Reset ---------- */
function resetStats() {
  stats.totalDraws = 0; stats.quartzSpent = 0;
  stats.countA = stats.countS = stats.countSS = 0;
  stats.puHits = 0;
  stats.puCounts = Object.fromEntries(puIds.map(id => [id, 0]));
  stats.obtained.clear();

  grid.innerHTML = "";
  if (totalDrawsEl) totalDrawsEl.textContent = 0;
  if (quartzSpentEl) quartzSpentEl.textContent = 0;
  if (countAEl) countAEl.textContent = 0;
  if (countSEl) countSEl.textContent = 0;
  if (countSSEl) countSSEl.textContent = 0;
  if (rateAEl) rateAEl.textContent = "0%";
  if (rateSEl) rateSEl.textContent = "0%";
  if (rateSSEl) rateSSEl.textContent = "0%";
  if (batchInfo) batchInfo.textContent = "—";

  if (luckEl)   luckEl.textContent   = "樣本不足";
  if (puLuckEl) puLuckEl.textContent = "樣本不足";

  if (puStatsBlock) {
    puIds.forEach(id => {
      const hitEl = document.getElementById(`hit-${id}`);
      const rateEl = document.getElementById(`rate-${id}`);
      if (hitEl) hitEl.textContent = "0";
      if (rateEl) rateEl.textContent = "0%";
    });
    const totalRateEl = document.getElementById("puTotalRate");
    if (totalRateEl) totalRateEl.textContent = "PU 總命中率：0%";
  }

  // 清空歷史紀錄
  clearHistory();
}

/* ---------- 單抽 / 十連 ---------- */
async function doSingleTx() {
  const unit = drawOne("general");
  if (!unit) throw new Error("單抽回傳空結果");
  const isNew = !stats.obtained.has(unit.id);
  const isPU  = !!(ratesConfig.pu?.enabled && ratesConfig.pu.units.includes(unit.id));
  stats.obtained.add(unit.id);

  grid.innerHTML = "";
  grid.appendChild(createCard(unit, isNew, isPU));
  applyStats(unit);

  // 抽數 = 當前總抽數 + 1
  addHistory(CURRENT_POOL_NAME, unit, isPU, stats.totalDraws, false);

  if (batchInfo) batchInfo.textContent = "本次：1 抽";
}

async function doTenTx() {
  let results = drawTen() || [];
  results = results.filter(Boolean);
  while (results.length < 10) results.push(drawOne("general"));
  if (results.length > 10) results = results.slice(0, 10);

  const frag = document.createDocumentFragment();
  const baseDraw = stats.totalDraws; // 記錄十連開始前的抽數

  results.forEach((unit, idx) => {
    const isNew = !stats.obtained.has(unit.id);
    const isPU  = !!(ratesConfig.pu?.enabled && ratesConfig.pu.units.includes(unit.id));
    const isGuarantee = (idx === 9);
    stats.obtained.add(unit.id);
    frag.appendChild(createCard(unit, isNew, isPU));

    // 抽數 = 抽卡前總數 + 第幾張
    addHistory(CURRENT_POOL_NAME, unit, isPU, baseDraw + idx + 1, isGuarantee);
  });

  grid.innerHTML = "";
  grid.appendChild(frag);

  for (const unit of results) {
    try { applyStats(unit); }
    catch (err) { console.error("applyStats failed", unit, err); }
  }
  if (batchInfo) batchInfo.textContent = "本次：10 連";
}

/* ---------- 事件 ---------- */
btnSingle?.addEventListener("click", () => enqueue("single"));
btnTen?.addEventListener("click", () => enqueue("ten"));
btnReset?.addEventListener("click", () => { queue = []; resetStats(); });





// 初始化歷史紀錄
loadHistory();