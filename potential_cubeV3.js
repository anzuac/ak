

const tierUpgradeChance = {
  "特殊": { next: "稀有", rate: 0.05 },
  "稀有": { next: "罕見", rate: 0.01 },
  "罕見": { next: "傳說", rate: 0.004 },
  "傳說": { next: null, rate: 0 }
};

const potentialPools = {
  "特殊": potentialData_special,
  "稀有": potentialData_rare,
  "罕見": potentialData_epic,
  "傳說": potentialData_legendary
};

let totalDraws = 0;
const tierJumpStats = {
  "特殊>稀有": 0,
  "稀有>罕見": 0,
  "罕見>傳說": 0
};

const tierAttemptCount = {
  "特殊": 0,
  "稀有": 0,
  "罕見": 0
};

let legendaryDrawCount = 0; // ✅ 傳說階級洗出的次數統計
const potentialStatsCount = {};

const atkValues = [20, 15, 13, 10];
const targetStats = ["攻擊力", "魔法攻擊力"];

for (let row = 1; row <= 3; row++) {
  for (const stat of targetStats) {
    for (const val of atkValues) {
      const key = `${stat}${row}_${val}`;
      potentialStatsCount[key] = 0;
    }
  }
}
let forceStopFlag = false;

function weightedRandom(potentialList, index) {
  const weights = potentialList.map(p => p.weights[index] || 0);
  const total = weights.reduce((a, b) => a + b, 0);
  
  if (total === 0) return "(無效潛能)";
  
  let r = Math.random() * total;
  for (let i = 0; i < potentialList.length; i++) {
    r -= weights[i];
    if (r <= 0) return potentialList[i].name;
  }
  
  return potentialList.find(p => (p.weights[index] || 0) > 0)?.name || "(無效潛能)";
}

function getFinalTier(baseTier) {
  const info = tierUpgradeChance[baseTier];
  if (!info || !info.next) return baseTier;
  
  if (tierAttemptCount[baseTier] !== undefined) {
    tierAttemptCount[baseTier]++;
  }
  
  const upgraded = Math.random() < info.rate;
  if (upgraded) {
    const key = `${baseTier}>${info.next}`;
    if (tierJumpStats[key] !== undefined) tierJumpStats[key]++;
    return info.next;
  }
  
  return baseTier;
}

function rollPotential(baseTier) {
  const tier = getFinalTier(baseTier);
  const pool = potentialPools[tier];

  // ✅ 統計傳說階級出現時累加（無論哪種抽法都會統一經過這裡）
  if (tier === "傳說") legendaryDrawCount++;

  return {
    results: [
      weightedRandom(pool, 0),
      weightedRandom(pool, 1),
      weightedRandom(pool, 2)
    ],
    tier
  };
}

let currentTier = null; // 🔁 建議放在檔案全域最上面，只需定義一次

function updatePotentialUI({ results, tier }) {
  document.getElementById("potential1").textContent = results[0];
  document.getElementById("potential2").textContent = results[1];
  document.getElementById("potential3").textContent = results[2];
  document.getElementById("actualTier").textContent = `潛能階級：${tier}`;
  document.getElementById("startTierSelect").value = tier;
  
  // ✅ 僅當階級改變時才更新下拉選單與取消選擇
  if (tier !== currentTier) {
    updateTargetOptionsByTier();
    ["target1", "target2", "target3"].forEach(id => {
      const select = document.getElementById(id);
      if (select) select.selectedIndex = -1; // 強制清除使用者選擇
    });
    currentTier = tier;
  }
}


function calculateCost(draws) {
  const setsOfTen = Math.floor(draws / 10);
  const remaining = draws % 10;
  return setsOfTen * 450 + remaining * 50;
}
function updateStats() {
  document.getElementById("totalDraw").textContent = totalDraws;

  const t1 = tierJumpStats["特殊>稀有"];
  const t2 = tierJumpStats["稀有>罕見"];
  const t3 = tierJumpStats["罕見>傳說"];

  const a1 = tierAttemptCount["特殊"];
  const a2 = tierAttemptCount["稀有"];
  const a3 = tierAttemptCount["罕見"];

  const p = (n, d) => d > 0 ? ((n / d) * 100).toFixed(1) : "0";

  document.getElementById("rate-special").textContent = `特殊 → 稀有：${t1} 次（${p(t1, a1)}%）`;
  document.getElementById("rate-rare").textContent = `稀有 → 罕見：${t2} 次（${p(t2, a2)}%）`;
  document.getElementById("rate-epic").textContent = `罕見 → 傳說：${t3} 次（${p(t3, a3)}%）`;
document.getElementById("legendaryDrawCount").textContent = `傳說階級總洗出方塊數量：${legendaryDrawCount}`;

  for (let row = 1; row <= 3; row++) {
  for (const stat of targetStats) {
    for (const val of atkValues) {
      const key = `${stat}${row}_${val}`;
      const count = potentialStatsCount[key];
      const pct = totalDraws > 0 ? ((count / totalDraws) * 100).toFixed(2) : "0.00";

      let idPrefix = "";
      if (stat === "攻擊力") {
        idPrefix = "atk" + row + "_" + val;
      } else if (stat === "魔法攻擊力") {
        idPrefix = "matk" + row + "_" + val;
      } else {
        console.warn(`⚠️ 未知的 stat 類型：${stat}`);
        continue;
      }

      document.getElementById(idPrefix).textContent = count;
      document.getElementById(idPrefix + "_pct").textContent = pct + "%";
    }
  }
}
// ✅ 加入洗潛能金額計算與顯示
const cost = calculateCost(totalDraws);
document.getElementById("totalCost").textContent = `總花費金額：${cost} 元`;
}


function drawOnce() {
  if (forceStopFlag) return;
  const baseTier = document.getElementById("startTierSelect").value;
  const result = rollPotential(baseTier);
  updatePotentialUI(result);
  analyzeStats(result.results, result.tier);
  totalDraws++;
  updateStats();
}

function drawUntilUpgrade() {
  forceStopFlag = false;
  const originalTier = document.getElementById("startTierSelect").value;
  
  if (originalTier === "傳說") {
    alert("🛑 已達最高階級（傳說），無法再跳框！");
    return;
  }
  
  let result;
  while (!forceStopFlag) {
    result = rollPotential(originalTier);
    totalDraws++;
    if (result.tier !== originalTier) break;
  }
  updatePotentialUI(result);
  analyzeStats(result.results, result.tier);
  updateStats();
}

function drawUntilLegendary() {
  forceStopFlag = false;
  let baseTier = document.getElementById("startTierSelect").value;
  let result;
  while (!forceStopFlag) {
    result = rollPotential(baseTier);
    totalDraws++;
    if (result.tier === "傳說") break;
    baseTier = result.tier;
  }
  updatePotentialUI(result);
  analyzeStats(result.results, result.tier);
  updateStats();
}
function analyzeStats(results, tier) {
  if (tier !== "傳說") return;

  for (let i = 0; i < results.length; i++) {
    const line = results[i].trim(); // 去除空白

    for (const stat of targetStats) {
      for (const val of atkValues) {
        const exactText = `${stat} +${val}`;
        if (line === exactText) { // ✅只比對完全相同字串
          const key = `${stat}${i + 1}_${val}`;
          potentialStatsCount[key]++;
        }
      }
    }
  }
}
function skipToLegendary() {
  
  const result = {
    results: [
      weightedRandom(pool, 0),
      weightedRandom(pool, 1),
      weightedRandom(pool, 2)
    ],
    tier: "傳說"
  };
  updatePotentialUI(result);
  analyzeStats(result.results, result.tier); // ✅ 加這一行才會累加統計數據
  totalDraws++;
  updateStats();
}

// ✅ 防呆檢查：第一條目標不能選擇無法抽出的潛能
function getInvalidFirstOptions() {
  const baseTier = document.getElementById("startTierSelect").value;
  const pool = potentialPools[baseTier];
  return pool
    .filter(opt => !opt.weights || opt.weights[0] === 0)
    .map(opt => opt.name);
}

function drawUntilTarget() {
  forceStopFlag = false;
  const baseTier = document.getElementById("startTierSelect").value;
  
  function getSelectedValues(selectId) {
    const select = document.getElementById(selectId);
    return Array.from(select.selectedOptions).map(opt => opt.value);
  }
  
  const targets1 = getSelectedValues("target1");
  const targets2 = getSelectedValues("target2");
  const targets3 = getSelectedValues("target3");
  
  const invalidFirstOptions = getInvalidFirstOptions();
  if (targets1.some(opt => invalidFirstOptions.includes(opt))) {
    alert("⚠️ 選擇的第一條目標潛能在任何階段都無法出現，請重新選擇！");
    return;
  }
  
  let currentTier = baseTier;
  const batchSize = 1000;
  const maxAttempts = 5000000000;
  let attempts = 0;
  let found = false;
  
  function simulateBatch() {
    if (forceStopFlag || found || attempts >= maxAttempts) {
      if (attempts >= maxAttempts) {
        alert("⚠️ 模擬已達 50 萬次仍未達成，請檢查條件！");
      }
      return;
    }
    
    let result;
    for (let i = 0; i < batchSize; i++) {
      result = rollPotential(currentTier);
      totalDraws++;
      attempts++;
      
      analyzeStats(result.results, result.tier);
      
      const [r1, r2, r3] = result.results;
      const match1 = (targets1.length === 0 || targets1.includes(r1));
      const match2 = (targets2.length === 0 || targets2.includes(r2));
      const match3 = (targets3.length === 0 || targets3.includes(r3));
      
      if (result.tier !== currentTier) {
        updatePotentialUI(result);
        updateStats();
        return; // 停止模擬（跳框）
      }
      
      if (match1 && match2 && match3) {
        found = true;
        break;
      }
    }
    
    // 批次模擬後更新畫面與統計
    updatePotentialUI(result);
    updateStats();
    
    if (found) return;
    
    // 非同步執行下一批
    setTimeout(simulateBatch, 0);
  }
  
  simulateBatch();
}

function clearStats() {
  
  totalDraws = 0;

  for (let row = 1; row <= 3; row++) {
  for (const stat of targetStats) {
    for (const val of atkValues) {
      const key = `${stat}${row}_${val}`;
      potentialStatsCount[key] = 0;
    }
  }
}
  tierJumpStats["特殊>稀有"] = 0;
tierJumpStats["稀有>罕見"] = 0;
tierJumpStats["罕見>傳說"] = 0;

tierAttemptCount["特殊"] = 0;
tierAttemptCount["稀有"] = 0;
tierAttemptCount["罕見"] = 0;
document.getElementById("totalCost").textContent = "總花費金額：0 元";
legendaryDrawCount = 0;
document.getElementById("legendaryDrawCount").textContent = "傳說階級總洗出方塊數量：0";
["target1", "target2", "target3"].forEach(id => {
  const select = document.getElementById(id);
  if (select) select.selectedIndex = -1;
});
  updateStats();
  forceStopFlag = false;
  document.getElementById("resultArea").innerHTML = `
    <div id="actualTier">潛能階級：-</div>
    <div id="potential1">---</div>
    <div id="potential2">---</div>
    <div id="potential3">---</div>
  `;
  document.getElementById("startTierSelect").value = "特殊";
  updateUpgradeButtonStatus();
}

function forceStop() {
  forceStopFlag = true;
}

function updateUpgradeButtonStatus() {
  const tier = document.getElementById("startTierSelect").value;
  const upgradeBtn = document.querySelector('button[onclick="drawUntilUpgrade()"]');
  if (tier === "傳說") {
    upgradeBtn.disabled = true;
    upgradeBtn.style.opacity = "0.5";
    upgradeBtn.style.cursor = "not-allowed";
  } else {
    upgradeBtn.disabled = false;
    upgradeBtn.style.opacity = "";
    upgradeBtn.style.cursor = "";
  }
}

if (true) {
  
}

// ✅ 初始化選單 + 防呆設定
// ✅ 將函式定義放在外面（全域）
function updateTargetOptionsByTier() {
  const baseTier = document.getElementById("startTierSelect").value;
  const pool = potentialPools[baseTier];
  const validNames = new Set(pool.map(p => p.name));

  const selects = [
    document.getElementById("target1"),
    document.getElementById("target2"),
    document.getElementById("target3")
  ];

  for (let i = 0; i < selects.length; i++) {
    const select = selects[i];
    const prevSelected = Array.from(select.selectedOptions).map(opt => opt.value);
    
    // 清除選項
    select.innerHTML = '';

    for (let opt of pool) {
      if (!opt.weights || !opt.weights.some(w => w > 0)) continue;

      const option = document.createElement("option");
      option.value = opt.name;
      option.textContent = opt.name;

      // ✅ 第一條禁用無法抽出的潛能
      if (i === 0 && (!opt.weights[0] || opt.weights[0] === 0)) {
        option.disabled = true;
        option.textContent += "（無法作為第一條）";
      }

      // ✅ 若使用者原先選過、而此潛能仍合法，則保留勾選
      if (prevSelected.includes(opt.name)) {
        option.selected = true;
      }

      select.appendChild(option);
    }
  }
}

// ✅ DOMContentLoaded 區塊只負責啟動用，不定義函式
document.addEventListener("DOMContentLoaded", () => {
  updateUpgradeButtonStatus();
  updateTargetOptionsByTier(); // 初始呼叫一次
  document.getElementById("startTierSelect").addEventListener("change", () => {
    updateUpgradeButtonStatus();
    updateTargetOptionsByTier(); // 切換時更新
  });
});