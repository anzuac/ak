// stats.js
import { drawOne, drawTen } from "./gacha_core.js";
import { ratesConfig } from "./rates.js";

// 統計資料
const stats = {
  totalDraws: 0,
  quartzSpent: 0,
  countA: 0,
  countS: 0,
  countSS: 0,
  puHits: 0,
  obtained: new Set() // 用來判斷 NEW
};

// 綁定按鈕
const btnSingle = document.getElementById("btnSingle");
const btnTen = document.getElementById("btnTen");
const btnReset = document.getElementById("btnReset");
const grid = document.getElementById("resultsGrid");

// UI 統計欄位
const totalDrawsEl = document.getElementById("totalDraws");
const quartzSpentEl = document.getElementById("quartzSpent");
const countAEl = document.getElementById("countA");
const countSEl = document.getElementById("countS");
const countSSEl = document.getElementById("countSS");
const rateAEl = document.getElementById("rateA");
const rateSEl = document.getElementById("rateS");
const rateSSEl = document.getElementById("rateSS");
const puHitsEl = document.getElementById("puHits");

// ===== 功能 =====

// 建立卡片 HTML
function createCard(unit, isNew, isPU) {
  const card = document.createElement("article");
  card.className = `card rarity-${unit.rarity}`;

  const imgBox = document.createElement("div");
  imgBox.className = "card-img";

  const img = document.createElement("img");
  img.src = `assets/images/units/${unit.img}`;
  img.alt = unit.name;
  img.loading = "lazy";
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

// 更新統計
function updateStats(rarity, isPU) {
  stats.totalDraws++;
  stats.quartzSpent += ratesConfig.drawCost;

  if (rarity === "A") stats.countA++;
  if (rarity === "S") stats.countS++;
  if (rarity === "SS") stats.countSS++;
  if (isPU) stats.puHits++;

  // 計算比例
  const rateA = (stats.countA / stats.totalDraws * 100).toFixed(2);
  const rateS = (stats.countS / stats.totalDraws * 100).toFixed(2);
  const rateSS = (stats.countSS / stats.totalDraws * 100).toFixed(2);

  // 更新 UI
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

// 重置統計
function resetStats() {
  stats.totalDraws = 0;
  stats.quartzSpent = 0;
  stats.countA = 0;
  stats.countS = 0;
  stats.countSS = 0;
  stats.puHits = 0;
  stats.obtained.clear();

  grid.innerHTML = "";
  updateStatsDisplayOnly();
}

// 更新顯示（只清數字）
function updateStatsDisplayOnly() {
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

// ===== 綁定事件 =====
btnSingle.addEventListener("click", () => {
  const unit = drawOne("general");
  const isNew = !stats.obtained.has(unit.id);
  const isPU = ratesConfig.pu.units.includes(unit.id);
  stats.obtained.add(unit.id);

  // 🔄 清空舊結果，只保留這一次的
  grid.innerHTML = "";
  grid.appendChild(createCard(unit, isNew, isPU));

  updateStats(unit.rarity, isPU);
});

btnTen.addEventListener("click", () => {
  const results = drawTen();

  // 🔄 清空舊結果，只顯示這次的十連
  grid.innerHTML = "";

  results.forEach(unit => {
    const isNew = !stats.obtained.has(unit.id);
    const isPU = ratesConfig.pu.units.includes(unit.id);
    stats.obtained.add(unit.id);

    grid.appendChild(createCard(unit, isNew, isPU));
    updateStats(unit.rarity, isPU);
  });
});

btnReset.addEventListener("click", resetStats);