// rates.js
export const ratesConfig = {
  drawCost: 300, // 石英/抽
  rarities: ["A", "S", "SS"],

  // 機率表
  tables: {
    // 單抽 & 十連前9抽
    general: { A: 79.0, S: 18.0, SS: 3.0 },

    // 十連第10抽（保底至少 S）
    tenGuarantee: { S: 97.0, SS: 3.0 }
  },

  // PU 設定：在 SS 3% 裡切分 2 隻 PU，各佔 0.75%
  pu: {
    enabled: true,

    // 抽卡邏輯用：在 SS pool (3%) 中，2 隻 PU 各佔 25%
    sharePercent: 25,

    // PU 角色 id
    units: ["ss999"],

    // 統計用：每隻 PU 的實際掉率 (百分比)
    rateEach: 0.75
    // => 兩隻 PU 合計 1.5%
    // => 剩下 1.5% 留給非 PU 的 SS
  }
};
