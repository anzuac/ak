// rates_ticket.js
export const ratesConfig = {
  // 預設單抽石英成本（若 preset.cost 指定會覆蓋）
  drawCost: 300,
  rarities: ["A", "S", "SS"],

  // 機率表
  tables: {
    general:      { A: 79.0, S: 18.0, SS: 3.0 },  // 單抽 / 前9抽
    tenGuarantee: { S: 97.0, SS: 3.0 }            // 十連第10抽用表（S+）
  },

  // 本池無 PU
  pu: {
    enabled: false,
    units: [],
    rateEach: 0
  },

  // 🧩 預設抽法（抽幾次/用哪個表/是否保底/消耗什麼）
  presets: {
    // 一般單抽（石英）
    single: {
      steps: [ { tableKey: "general", count: 1 } ],
      cost:  { quartz: 300 }
    },

    // 一般十連（石英）：前9抽 general，第10抽 tenGuarantee
    ten: {
      steps: [
        { tableKey: "general",      count: 9 },
        { tableKey: "tenGuarantee", count: 1 }
      ],
      cost: { quartz: 3000 }
    },

    // 🎟️ 單抽 S 以上券（不扣石英，保底 S）
    ticketS: {
      steps: [ { tableKey: "general", count: 1, minRarity: "S" } ],
      cost:  { tickets: { s: 1 } }
    },

    // 🎟️ 十連必得 S 以上券（不扣石英，前9抽 general，第10抽保底 S）
    ticketTenS: {
      steps: [
        { tableKey: "general", count: 9 },
        { tableKey: "general", count: 1, minRarity: "S" }
      ],
      cost: { tickets: { tenS: 1 } }
    },

    // 🎟️ 單抽 SS 券（不扣石英，保底 SS）
    ticketSS: {
      steps: [ { tableKey: "general", count: 1, minRarity: "SS" } ],
      cost:  { tickets: { ss: 1 } }
    }
  }
};
