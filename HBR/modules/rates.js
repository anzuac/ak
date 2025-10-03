// rates.js
export const ratesConfig = {
  drawCost: 300, // 石英/抽
  rarities: ["A", "S", "SS"],

  // 機率表
  tables: {
    // 單抽 & 十連前9抽
    general: { A: 79.0, S: 18.0, SS: 3.0 },

    // 十連第 10 抽（保底至少 S）
    tenGuarantee: { S: 97.0, SS: 3.0 }
  },

  // PU 設定：在 SS 3% 中切出 2 個各 0.75%
  pu: {
    enabled: true,
    sharePercent: 25, // 每隻 PU 的百分比
    units: ["PU001"] // PU 角色 id
  }

};
