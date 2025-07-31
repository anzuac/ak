let isSimulating = false;
let simulationInterval;
let totalDrawCount = 0;

// 統計資料初始化
let legendaryAllStatsCount = {
  line1: {},
  line2: {},
  line3: {}
};

// 初始化所有潛能統計資料
function initLegendaryAllStats() {
  legendaryAllStatsCount = { line1: {}, line2: {}, line3: {} };
  potentialData_legendary.forEach(entry => {
    legendaryAllStatsCount.line1[entry.name] = 0;
    legendaryAllStatsCount.line2[entry.name] = 0;
    legendaryAllStatsCount.line3[entry.name] = 0;
  });
  updateLegendaryDetailStats();
}

// 抽到三條結果後記錄
function recordLegendaryRoll(result) {
  if (result.length >= 3) {
    if (legendaryAllStatsCount.line1.hasOwnProperty(result[0])) legendaryAllStatsCount.line1[result[0]]++;
    if (legendaryAllStatsCount.line2.hasOwnProperty(result[1])) legendaryAllStatsCount.line2[result[1]]++;
    if (legendaryAllStatsCount.line3.hasOwnProperty(result[2])) legendaryAllStatsCount.line3[result[2]]++;
  }
  updateLegendaryDetailStats();
}

// 更新統計顯示
function updateLegendaryDetailStats() {
  const div = document.getElementById("legendaryAllStats");
  if (!div) return;
  
  function generateSection(title, lineData, hideZero = false) {
    const total = Object.values(lineData).reduce((sum, count) => sum + count, 0);
    let text = `📒 ${title}\n`;
    potentialData_legendary.forEach(entry => {
      const count = lineData[entry.name] || 0;
      if (hideZero && count === 0) return;
      const percent = total > 0 ? ((count / total) * 100).toFixed(2) : "0.00";
      text += `${entry.name.padEnd(16)}： ${count} 次 (${percent}%)\n`;
    });
    return text + "\n";
  }
  
  const resultText =
    generateSection("第一條潛能出現統計", legendaryAllStatsCount.line1, true) +
    generateSection("第二條潛能出現統計", legendaryAllStatsCount.line2) +
    generateSection("第三條潛能出現統計", legendaryAllStatsCount.line3);
  
  div.textContent = resultText;
}

// 勾選項目讀取
function getSelectedOptions(lineId) {
  const checkboxes = document.querySelectorAll(`#${lineId} input[type="checkbox"]:checked`);
  return Array.from(checkboxes).map(cb => cb.value);
}

// 單行抽卡邏輯
function rollLine(pool) {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  const rand = Math.random() * totalWeight;
  let acc = 0;
  for (const item of pool) {
    acc += item.weight;
    if (rand < acc) return item.name;
  }
  return pool[pool.length - 1].name;
}

// 抽一次並顯示結果
function simulateOnce() {
  const selected1 = getSelectedOptions("firstLineOptions");
  const selected2 = getSelectedOptions("secondLineOptions");
  const selected3 = getSelectedOptions("thirdLineOptions");
  
  const pool1 = potentialData_legendary.map(p => ({ name: p.name, weight: p.weights[0] }));
  const pool2 = potentialData_legendary.map(p => ({ name: p.name, weight: p.weights[1] }));
  const pool3 = potentialData_legendary.map(p => ({ name: p.name, weight: p.weights[2] }));
  
  const result1 = rollLine(pool1);
  const result2 = rollLine(pool2);
  const result3 = rollLine(pool3);
  
  totalDrawCount++;
  document.getElementById("totalDraw").textContent = totalDrawCount;
  
  document.getElementById("legendaryStat1").textContent = result1;
  document.getElementById("legendaryStat2").textContent = result2;
  document.getElementById("legendaryStat3").textContent = result3;
  
  recordLegendaryRoll([result1, result2, result3]);
  
  if (
    (selected1.length === 0 || selected1.includes(result1)) &&
    (selected2.length === 0 || selected2.includes(result2)) &&
    (selected3.length === 0 || selected3.includes(result3))
  ) {
    stopSimulation();
  }
}

// 開始模擬
function startSimulation() {
  if (isSimulating) return;
  isSimulating = true;
  simulationInterval = setInterval(simulateOnce, 10);
}

// 停止模擬
function stopSimulation() {
  isSimulating = false;
  stopRequested = true;
  clearInterval(simulationInterval);
}

// 跳過過程直接模擬
let skipRunning = false;

function skipSimulation() {
  if (isSimulating || skipRunning) return;
  skipRunning = true;
  stopRequested = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 50000000;
  
  const selected1 = getSelectedOptions("firstLineOptions");
  const selected2 = getSelectedOptions("secondLineOptions");
  const selected3 = getSelectedOptions("thirdLineOptions");
  
  function runStep() {
    if (stopRequested || attempts >= MAX_ATTEMPTS) {
      skipRunning = false;
      if (attempts >= MAX_ATTEMPTS) {
        alert("⚠️ 已達 5,000 萬次未匹配，請檢查條件是否正確");
      }
      return;
    }
    
    simulateOnce();
    attempts++;
    
    const r1 = document.getElementById("legendaryStat1").textContent;
    const r2 = document.getElementById("legendaryStat2").textContent;
    const r3 = document.getElementById("legendaryStat3").textContent;
    
    if (
      (selected1.length === 0 || selected1.includes(r1)) &&
      (selected2.length === 0 || selected2.includes(r2)) &&
      (selected3.length === 0 || selected3.includes(r3))
    ) {
      skipRunning = false;
      console.log(`✅ 成功！共模擬 ${attempts} 次`);
      return;
    }
    
    // 非同步呼叫下一次
    if (attempts % 1000 === 0) {
      setTimeout(runStep, 0); // 不鎖住畫面
    } else {
      runStep();
    }
  }
  
  runStep();
}

// 清除所有統計與結果
function clearStats() {
  stopSimulation();
  totalDrawCount = 0;
  document.getElementById("totalDraw").textContent = "0";
  document.getElementById("legendaryStat1").textContent = "";
  document.getElementById("legendaryStat2").textContent = "";
  document.getElementById("legendaryStat3").textContent = "";
  initLegendaryAllStats();
}

// ✅ DOM 載入後初始化統計，不會覆蓋其他 onload
document.addEventListener("DOMContentLoaded", () => {
  initLegendaryAllStats();
});