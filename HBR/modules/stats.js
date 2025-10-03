// stats.js － 交易式渲染 + 排隊 + 冷卻 + 圖片安全 fallback
import { drawOne, drawTen } from "./gacha_core.js";
import { ratesConfig } from "./rates.js";

// ====== 統計 ======
const stats = {
  totalDraws: 0,
  quartzSpent: 0,
  countA: 0,
  countS: 0,
  countSS: 0,
  puHits: 0,
  obtained: new Set()
};

// ====== DOM ======
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
const puHitsEl = document.getElementById("puHits");
const batchInfo = document.getElementById("batchInfo");

// ====== 排隊 + 冷卻（不丟單） ======
let queue = [];
let running = false;
const COOLDOWN_MS = 180;

function setBusy(b) {
  btnSingle.disabled = b;
  btnTen.disabled = b;
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

// ====== 圖片 fallback（1x1 透明 PNG，onerror 只跑一次） ======
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

// ====== 統計 ======
function applyStats(unit) {
  stats.totalDraws++;
  stats.quartzSpent += ratesConfig.drawCost;

  if (unit.rarity === "A") stats.countA++;
  else if (unit.rarity === "S") stats.countS++;
  else if (unit.rarity === "SS") stats.countSS++;

  const isPU = (ratesConfig.pu?.enabled && ratesConfig.pu.units.includes(unit.id)) || false;
  if (isPU) stats.puHits++;

  totalDrawsEl.textContent = stats.totalDraws;
  quartzSpentEl.textContent = stats.quartzSpent;
  countAEl.textContent = stats.countA;
  countSEl.textContent = stats.countS;
  countSSEl.textContent = stats.countSS;

  const ra = stats.totalDraws ? (stats.countA / stats.totalDraws * 100).toFixed(2) : "0.00";
  const rs = stats.totalDraws ? (stats.countS / stats.totalDraws * 100).toFixed(2) : "0.00";
  const rss= stats.totalDraws ? (stats.countSS/ stats.totalDraws * 100).toFixed(2) : "0.00";
  rateAEl.textContent = `${ra}%`; rateSEl.textContent = `${rs}%`; rateSSEl.textContent = `${rss}%`;
  puHitsEl.textContent = stats.puHits;
}

function resetStats() {
  stats.totalDraws = 0; stats.quartzSpent = 0;
  stats.countA = stats.countS = stats.countSS = 0;
  stats.puHits = 0; stats.obtained.clear();
  grid.innerHTML = "";
  totalDrawsEl.textContent = 0; quartzSpentEl.textContent = 0;
  countAEl.textContent = 0; countSEl.textContent = 0; countSSEl.textContent = 0;
  rateAEl.textContent = "0%"; rateSEl.textContent = "0%"; rateSSEl.textContent = "0%";
  puHitsEl.textContent = 0;
  if (batchInfo) batchInfo.textContent = "—";
}

// ====== 交易式抽卡 ======
async function doSingleTx() {
  const unit = drawOne("general");
  if (!unit) throw new Error("單抽回傳空結果");
  const isNew = !stats.obtained.has(unit.id);
  const isPU  = (ratesConfig.pu?.enabled && ratesConfig.pu.units.includes(unit.id)) || false;
  stats.obtained.add(unit.id);

  grid.innerHTML = "";
  grid.appendChild(createCard(unit, isNew, isPU));
  applyStats(unit);
  if (batchInfo) batchInfo.textContent = "本次：1 抽";
}

async function doTenTx() {
  let results = drawTen() || [];
  results = results.filter(Boolean);
  while (results.length < 10) results.push(drawOne("general"));
  if (results.length > 10) results = results.slice(0, 10);

  const frag = document.createDocumentFragment();
  for (const unit of results) {
    const isNew = !stats.obtained.has(unit.id);
    const isPU  = (ratesConfig.pu?.enabled && ratesConfig.pu.units.includes(unit.id)) || false;
    stats.obtained.add(unit.id);
    frag.appendChild(createCard(unit, isNew, isPU));
  }
  grid.innerHTML = "";
  grid.appendChild(frag);

  for (const unit of results) applyStats(unit);
  if (batchInfo) batchInfo.textContent = "本次：10 連";
}

// ====== 事件 ======
btnSingle.addEventListener("click", () => enqueue("single"));
btnTen.addEventListener("click", () => enqueue("ten"));
btnReset.addEventListener("click", () => { queue = []; resetStats(); });
