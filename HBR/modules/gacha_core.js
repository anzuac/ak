// gacha_core.js
import { units } from "./units.js";
import { ratesConfig } from "./rates.js";

// 工具：隨機取整數
function randInt(max) {
  return Math.floor(Math.random() * max);
}

// 工具：依表決定稀有度
function rollRarity(table) {
  const r = Math.random() * 100;
  let sum = 0;
  for (const key of Object.keys(table)) {
    sum += table[key];
    if (r < sum) return key;
  }
  return "A"; // fallback
}

// 單抽
export function drawOne(mode = "general") {
  const table = ratesConfig.tables[mode] || ratesConfig.tables.general;
  const rarity = rollRarity(table);

  // PU 特殊處理 (僅在 SS 時)
  if (rarity === "SS" && ratesConfig.pu.enabled) {
    const roll = Math.random() * 100;
    const totalPU = ratesConfig.pu.units.length * ratesConfig.pu.sharePercent;

    if (roll < ratesConfig.pu.sharePercent) {
      return units.find(u => u.id === ratesConfig.pu.units[0]);
    } else if (roll < ratesConfig.pu.sharePercent * 2) {
      return units.find(u => u.id === ratesConfig.pu.units[1]);
    } else {
      const nonPU = units.filter(
        u => u.rarity === "SS" && !ratesConfig.pu.units.includes(u.id)
      );
      return nonPU[randInt(nonPU.length)];
    }
  }

  // 非 PU 或其他稀有度 → 等分
  const pool = units.filter(u => u.rarity === rarity);
  return pool[randInt(pool.length)];
}

// 十連抽
export function drawTen() {
  const results = [];
  for (let i = 0; i < 9; i++) results.push(drawOne("general"));
  results.push(drawOne("tenGuarantee"));
  return results;
}
