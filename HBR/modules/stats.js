// stats.js
import { drawOne, drawTen } from "./gacha_core.js";
import { ratesConfig } from "./rates.js";

// ====== 現有統計 ======
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

// ====== 反吃卡：排隊 + 鎖 + 冷卻 ======
let queue = [];          // { type: 'single' | 'ten' }
let running = false;
let lastClickAt = 0;
const CLICK_COOLDOWN_MS = 200; // 最短冷卻（避免雙擊/誤觸）

function setBusy(isBusy) {
  btnSingle.disabled = isBusy;
  btnTen.disabled = isBusy;
  document.querySelector(".results")?.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function enqueue(type) {
  const now = Date.now();
  if (now - lastClickAt < CLICK_COOLDOWN_MS) return; // 冷卻期內忽略額外點擊
  lastClickAt = now;

  queue.push({ type });
  if (!running) processQueue();
}

async function processQueue() {
  running = true;
  setBusy(true);
  try {
    while (queue.length) {
      const job = queue.shift();
      if (job.type === "single") {
        await handleSingle();
      } else if (job.type === "ten") {
        await handleTen();
      }
      // 讓 UI 有喘息，避免阻塞（也讓快速連點依序完成）
      await microDelay(16);
    }
  } finally {
    setBusy(false);
    running = false;
  }
}

function microDelay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ====== 建卡片 ======
function createCard(unit, isNew, isPU) {
  const card = document.createElement("article");
  card.className = `card rarity-${unit.rarity}`;

  const imgBox = document.createElement("div");
  imgBox.className = "card-img";

  const img = document.createElement("img");
  img.src = `assets/images/units/${unit.img}`;
  img.alt = unit.name;
  img.loading = "lazy";
  // 圖片載入失敗 fallback（避免破圖）
  img.onerror = () => { img.src = "assets/images/units/_fallback.png"; };
  imgBox.appendChild(img);

  const tags = document.createElement("div");
  tags.className = "tags";
  if (isNew) {
    const newTag = document.createElement("span");
    newTag.className = "tag new";
    newTag.textContent = "NEW";
    tags.appendChild(newTag);
  }
  if (isPU) {
    const puTag = document.createElement("span");
    puTag.className = "tag pu";
    puTag.textContent = "PU";
    tags.appendChild(puTag);
  }
  imgBox.appendChild(tags);

  const info = document.createElement("div");
  info.className = "card-info";

  const name = document.createElement("p");
  name.className = "name";
  name.textContent = unit.name;
  info.appendChild(name);

  card.appendChild(imgBox);
  card.appendChild(info);

  return card;
}

// ====== 統計 ======
function updateStats(rarity, isPU) {
  stats.totalDraws++;
  stats.quartzSpent += ratesConfig.drawCost;

  if (rarity === "A") stats.countA++;
  else if (rarity === "S") stats.countS++;
  else if (rarity === "SS") stats.countSS++;

  if (isPU) stats.puHits++;

  const rateA = stats.totalDraws ? (stats.countA / stats.totalDraws * 100).toFixed(2) : "0.00";
  const rateS = stats.totalDraws ? (stats.countS / stats.totalDraws * 100).toFixed(2) : "0.00";
  const rateSS = stats.totalDraws ? (stats.countSS / stats.totalDraws * 100).toFixed(2) : "0.00";

  totalDrawsEl.textContent = stats.totalDraws;
  quartzSpentEl.textContent = stats.quartzSpent;
  countAEl.textContent = stats.countA;
  countSEl.textContent = stats.countS;
  countSSEl.textContent = stats.countSS;
  rateAEl.textContent = `${rateA}%`;
  rateSEl.textContent = `${rateS}%`;
  rateSSEl.textContent = `${rateSS}%`;
  puHitsEl.textContent = stats.puHits;
}

function resetStats() {
  stats.totalDraws = 0;
  stats.quartzSpent = 0;
  stats.countA = 0;
  stats.countS = 0;
  stats.countSS = 0;
  stats.puHits = 0;
  stats.obtained.clear();
  grid.innerHTML = "";

  // 清顯示
  totalDrawsEl.textContent = 0;
  quartzSpentEl.textContent = 0;
  countAEl.textContent = 0;
  countSEl.textContent = 0;
  countSSEl.textContent = 0;
  rateAEl.textContent = "0%";
  rateSEl.textContent = "0%";
  rateSSEl.textContent = "0%";
  puHitsEl.textContent = 0;
}

// ====== 抽卡處理（只顯示本次結果：單抽 1 張 / 十連 10 張） ======
async function handleSingle() {
  const unit = drawOne("general");
  const isNew = !stats.obtained.has(unit.id);
  const isPU = (ratesConfig.pu?.enabled && ratesConfig.pu.units.includes(unit.id)) || false;
  stats.obtained.add(unit.id);

  grid.innerHTML = "";
  grid.appendChild(createCard(unit, isNew, isPU));

  updateStats(unit.rarity, isPU);
}

async function handleTen() {
  const results = drawTen();

  grid.innerHTML = "";
  for (const unit of results) {
    const isNew = !stats.obtained.has(unit.id);
    const isPU = (ratesConfig.pu?.enabled && ratesConfig.pu.units.includes(unit.id)) || false;
    stats.obtained.add(unit.id);

    grid.appendChild(createCard(unit, isNew, isPU));
    updateStats(unit.rarity, isPU);

    // 逐張插入時微延遲（可視化連抽感；想更快可調小或移除）
    await microDelay(8);
  }
}

// ====== 綁定事件（改成入列） ======
btnSingle.addEventListener("click", () => enqueue("single"));
btnTen.addEventListener("click", () => enqueue("ten"));
btnReset.addEventListener("click", () => {
  // 清空排隊，避免重置後還處理舊任務
  queue = [];
  resetStats();
});
