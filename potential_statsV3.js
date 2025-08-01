const legendaryLineStats = {
  1: {},
  2: {},
  3: {}
};

function analyzeStats(results, tier) {
  if (tier !== "傳說") return;
  
  for (let i = 0; i < results.length; i++) {
    const line = results[i].trim();
    
    // 全部詳細統計
    if (!legendaryLineStats[i + 1][line]) {
      legendaryLineStats[i + 1][line] = 1;
    } else {
      legendaryLineStats[i + 1][line]++;
    }
    
    // 攻擊/魔攻統計
    for (const stat of targetStats) {
      for (const val of atkValues) {
        const exactText = `${stat} +${val}`;
        if (line === exactText) {
          const key = `${stat}${i + 1}_${val}`;
          if (!potentialStatsCount[key]) potentialStatsCount[key] = 0;
          potentialStatsCount[key]++;
        }
      }
    }
  }
}

// ✅ 能力排序（先分類，再數值大到小）
function getStatSortKey(name) {
  const order = ["攻擊力", "魔法攻擊力", "全屬性", "STR", "DEX", "INT", "LUK", "MaxHP"];
  const match = name.match(/^([^\+]+)\s*\+(\d+)/); // 例：攻擊力 +20
  if (!match) return [999, -1];
  
  const stat = match[1].trim();
  const value = parseInt(match[2], 10);
  
  const statIndex = order.indexOf(stat);
  return [statIndex === -1 ? 999 : statIndex, -value]; // 數值大排前面
}

function renderLegendaryStats() {
  const total = legendaryDrawCount;
  const containerIds = {
    1: "legendaryStat1",
    2: "legendaryStat2",
    3: "legendaryStat3"
  };
  
  for (let line = 1; line <= 3; line++) {
    const container = document.getElementById(containerIds[line]);
    const stats = legendaryLineStats[line];
    const entries = Object.entries(stats);
    
    if (entries.length === 0) {
      container.textContent = "（尚未出現任何潛能）";
      continue;
    }
    
    // ✅ 排序：能力類型 + 數值由大到小
    entries.sort((a, b) => {
      const keyA = getStatSortKey(a[0]);
      const keyB = getStatSortKey(b[0]);
      return keyA[0] - keyB[0] || keyA[1] - keyB[1];
    });
    
    const lines = entries.map(([name, count]) => {
      const pct = ((count / total) * 100).toFixed(2);
      return `${name}：${count} 次　(${pct}%)`;
    });
    
    container.textContent = lines.join("\n");
  }
}

function toggleLegendaryDetail() {
  const detail = document.getElementById("legendaryStatDetail");
  if (!detail) return;
  
  if (detail.style.display === "none") {
    renderLegendaryStats();
    detail.style.display = "block";
  } else {
    detail.style.display = "none";
  }
}