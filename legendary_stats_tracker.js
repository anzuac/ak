// 📊 統計資料結構（3條獨立）


// ✅ 初始化統計資料
function initLegendaryAllStats() {
  // 不重建物件，直接清空內容（確保引用一致）
  ["line1", "line2", "line3"].forEach(line => {
    legendaryAllStatsCount[line] = {};
    potentialData_legendary.forEach(entry => {
      legendaryAllStatsCount[line][entry.name] = 0;
    });
  });
  
  updateLegendaryDetailStats(); // 初始化顯示
  updateTotalCost(); // ✅ 同步金額歸零
}

// ✅ 記錄抽卡結果
function recordLegendaryRoll(result) {
  if (!Array.isArray(result) || result.length < 3) return;
  const [r1, r2, r3] = result;
  
  if (legendaryAllStatsCount.line1.hasOwnProperty(r1)) legendaryAllStatsCount.line1[r1]++;
  if (legendaryAllStatsCount.line2.hasOwnProperty(r2)) legendaryAllStatsCount.line2[r2]++;
  if (legendaryAllStatsCount.line3.hasOwnProperty(r3)) legendaryAllStatsCount.line3[r3]++;
  
  updateLegendaryDetailStats(); // 更新顯示
  updateTotalCost(); // ✅ 更新金額
}

// ✅ 顯示統計資訊
function updateLegendaryDetailStats() {
  const displayDiv = document.getElementById("legendaryAllStats");
  if (!displayDiv) return;
  
  function generateSection(title, lineData, hideZero = false) {
    const total = Object.values(lineData).reduce((a, b) => a + b, 0);
    if (total === 0) return ""; // ✅ 沒有資料就不顯示整段
    
    let sectionText = `📒 ${title}\n`;
    potentialData_legendary.forEach(entry => {
      const count = lineData[entry.name] || 0;
      if (hideZero && count === 0) return;
      const percent = ((count / total) * 100).toFixed(2);
      sectionText += `${entry.name.padEnd(16)}： ${count} 次 (${percent}%)\n`;
    });
    return sectionText + "\n";
  }
  
  const text =
    generateSection("第一條潛能出現統計", legendaryAllStatsCount.line1, true) +
    generateSection("第二條潛能出現統計", legendaryAllStatsCount.line2, true) +
    generateSection("第三條潛能出現統計", legendaryAllStatsCount.line3, true);
  
  displayDiv.textContent = text || "";
}

// ✅ 新增：金額統計邏輯
function updateTotalCost() {
  const costElement = document.getElementById("totalCost");
  if (!costElement) return;
  
  // 👉 若 totalDrawCount 來自外部 legendary_simulation.js，這裡會直接引用
  const groupOfTen = Math.floor(totalDrawCount / 10);
  const remaining = totalDrawCount % 10;
  const cost = groupOfTen * 450 + remaining * 50;
  
  costElement.textContent = `${cost} 元`;
}