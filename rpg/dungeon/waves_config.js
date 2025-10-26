// waves_config.js — 只定義「波次副本」與「等級倍率」，不含任何票券邏輯
(function (w) {
  "use strict";

  // ====== 本系統使用的票券型別（交給 tickets.js 統一管理）======
  // 在 tickets.js 中，請已註冊 type:"resource" 的票券。
  // 其他系統（如副本分頁）可透過 window.ResourceTicketType 取得這個型別。
  const TICKET_TYPE = "resource";
  w.ResourceTicketType = TICKET_TYPE;

  // ====== 等級式難度總開關（集中調整）======
  const LEVEL_CFG = {
    MAX_LEVEL: 30,      // ★ 全副本等級上限（改這裡就全改）
    statBase: 1.0,      // ★ 戰鬥數值 Lv1 基礎倍率
    statStep: 0.20,     // ★ 每等級 +0.20（Lv2=1.20, Lv3=1.40...）
    rewardStepMul: 1.10,// ★ 獎勵每等級 ×1.10（Lv2=×1.1, Lv3≈×1.21...）
    tune: 1.00          // 全域微調（兩邊都會乘上）
  };

  // ====== 等級倍率（戰鬥用 / 獎勵用）======
  function statMultiplier(level) {
    const L = Math.max(1, Math.min(level | 0, LEVEL_CFG.MAX_LEVEL));
    return (LEVEL_CFG.statBase + LEVEL_CFG.statStep * (L - 1)) * (LEVEL_CFG.tune || 1); // Lv1=1.00, Lv2=1.20, Lv3=1.40...
  }
  function rewardMultiplier(level) {
    const L = Math.max(1, Math.min(level | 0, LEVEL_CFG.MAX_LEVEL));
    return Math.pow(LEVEL_CFG.rewardStepMul || 1, L - 1) * (LEVEL_CFG.tune || 1);        // Lv1=1.00, Lv2=1.10, Lv3≈1.21...
  }

  // ====== 副本定義（只描述玩法，不含票券）======
  // 可直接在 finalRewards 內寫中文鍵名（如「金幣」「元素碎片」「進階石」「稀有結晶」…）
  const WAVE_DUNGEONS = [
    {
      id: "gold_rush",
      name: "💰 金幣副本",
      desc: "擊敗守財怪，收集大量金幣",
      timeLimitSec: 0,
      wavesTemplate: [
        { label: "Wave 1", monster: { name: "守財小妖", atk: 100, def: 60,  hp: 4000, aps: 0.8 } },
        { label: "Wave 2", monster: { name: "金甲兵",   atk: 180, def: 90,  hp: 6000, aps: 0.9 } },
        { label: "Wave 3", monster: { name: "金庫守衛", atk: 300, def: 140, hp: 10000, aps: 1.0 } }
      ],
      // 任意鍵皆可；金幣會自動加到 player.gold
      finalRewards: { "金幣": [3000, 5000] }
    },
    {
      id: "stone_rush",
      name: "🪨 強化石副本",
      desc: "粉碎岩晶，獲得大量強化石",
      timeLimitSec: 0,
      wavesTemplate: [
        { label: "Wave 1", monster: { name: "碎岩蟲",   atk: 120, def: 50,  hp: 3500, aps: 0.8 } },
        { label: "Wave 2", monster: { name: "晶岩兵",   atk: 180, def: 100, hp: 6472, aps: 0.9 } },
        { label: "Wave 3", monster: { name: "晶皇巨像", atk: 220, def: 140, hp: 13555, aps: 1.0 } }
      ],
      // 支援舊鍵 stone 或中文鍵「強化石」
      finalRewards: { "強化石": [190, 440] }
    },
    {
      id: "shard_rush",
      name: "🧩 強化道具兌換券副本",
      desc: "打碎元素靈核，收集元素碎片",
      timeLimitSec: 0,
      wavesTemplate: [
        { label: "Wave 1", monster: { name: "微光靈核", atk: 108, def: 50,   hp: 4500,  aps: 0.9 } },
        { label: "Wave 2", monster: { name: "流影靈核", atk: 168, def: 100,  hp: 6900,  aps: 1.0 } },
        { label: "Wave 3", monster: { name: "耀晶靈核", atk: 262, def: 146,  hp: 10300, aps: 1.5 } }
      ],
      // 舊鍵 shard 亦相容，會映射顯示為「元素碎片」
      finalRewards: { "強化道具兌換券": [1, 5] }
    },
    {
      id: "adv_stone_rush",
      name: " 強化道具兌換券（困難）",
      desc: "稀有晶核，機率獲得進階石",
      timeLimitSec: 0,
      wavesTemplate: [
        { label: "Wave 1", monster: { name: "初階晶核", atk: 255,  def: 400, hp: 48000,  aps: 1.8 } },
        { label: "Wave 2", monster: { name: "高壓晶核", atk: 277,  def: 660, hp: 62000, aps: 2.9 } },
        { label: "Wave 3", monster: { name: "究極晶核", atk: 420, def: 520, hp: 118000, aps: 4.0 } },
        { label: "Wave 4", monster: { name: "堅韌晶王", atk: 777,  def: 860, hp: 262000, aps: 5.9 } },
      ],
      // 舊鍵 advStone 亦相容，會映射顯示為「進階石」
      finalRewards: { "強化道具兌換券": [25, 55] }
    }
  ];

  // ====== 小工具 ======
  function formatRange(r, unit) {
    if (!r) return "—";
    const u = unit || "";
    return r[0].toLocaleString() + u + " ~ " + r[1].toLocaleString() + u;
  }

  function buildWavesForLevel(wavesTemplate, level) {
    const mul = statMultiplier(level);
    const out = [];
    for (let i = 0; i < wavesTemplate.length; i++) {
      const src = wavesTemplate[i], m = src.monster || {};
      out.push({
        label: src.label || ("Wave " + (i + 1)),
        monster: {
          name: m.name || ("Enemy " + (i + 1)),
          atk:  Math.max(1, Math.floor((m.atk || 1) * mul)),
          def:  Math.max(0, Math.floor((m.def || 0) * mul)),
          hp:   Math.max(1, Math.floor((m.hp  || 1) * mul)),
          // 攻速：若模板有給，原樣帶出（不做倍率）
          ms:       isFinite(m.ms) ? m.ms : undefined,
          aps:      isFinite(m.aps) ? m.aps : undefined,
          speedPct: isFinite(m.speedPct) ? m.speedPct : undefined
        }
      });
    }
    return out;
  }

  // ✅ 改為「泛用版」：任何鍵都會依等級放大（舊鍵也相容）
  function scaledFinalRewardsForLevel(view, level){
    const mul = rewardMultiplier(level);
    const out = {};
    Object.keys(view || {}).forEach(k => {
      const r = view[k];
      if (!Array.isArray(r) || r.length < 2) return;
      out[k] = [
        Math.max(0, Math.floor(r[0]*mul)),
        Math.max(0, Math.floor(r[1]*mul))
      ];
    });
    return out;
  }

  // ✅ 改為「泛用版」：支援任意中文鍵；並同時支援舊鍵 gold/stone/shard/advStone
  // 規則：
  // - "金幣" 或 "gold"   → 加到 player.gold
  // - "強化石" 或 "stone" → 加到 player.stone
  // - "shard" 映射顯示為「元素碎片」，"advStone" 映射顯示為「進階石」
  // - 其他鍵（含中文） → 直接 addItem(鍵名, 數量) 進背包
  function grantFinalRewards(r, dungeonName){
    const got = {};
    const roll = ([a,b]) => Math.floor(Math.random() * (b - a + 1)) + a;

    Object.keys(r || {}).forEach(key => {
      const range = r[key];
      if (!Array.isArray(range) || range.length < 2) return;
      const n = roll(range);
      if (n <= 0) return;

      // 特例：資源型（不進背包）
      if (key === "金幣" || key === "gold") {
        w.player.gold = (w.player.gold || 0) + n;
        got["金幣"] = (got["金幣"] || 0) + n;
        return;
      }
      if (key === "強化石" || key === "stone") {
        w.player.stone = (w.player.stone || 0) + n;
        got["強化石"] = (got["強化石"] || 0) + n;
        return;
      }

      // 舊鍵名 → 中文顯示名
      const displayName =
        key === "shard"    ? "元素碎片" :
        key === "advStone" ? "進階石"   :
        key; // 其他鍵：用原鍵名（可為中文）

      if (typeof w.addItem === "function") {
        w.addItem(displayName, n);
      } else {
        w.player._bag = w.player._bag || {};
        w.player._bag[displayName] = (w.player._bag[displayName] || 0) + n;
      }
      got[displayName] = (got[displayName] || 0) + n;
    });

    const parts = Object.keys(got).map(name => `${name}×${got[name].toLocaleString()}`);
    w.updateResourceUI?.();
    w.logPrepend?.(parts.length
      ? `🏆 通關 ${dungeonName}：獲得 ${parts.join("、")}`
      : `🏆 通關 ${dungeonName}`);
    return got;
  }

  // ====== 對外 ======
  w.LevelConfig = LEVEL_CFG;
  w.WaveDungeonDefs = WAVE_DUNGEONS;
  w.WaveDungeonUtils = {
    statMultiplier,
    rewardMultiplier,
    buildWavesForLevel,
    scaledFinalRewardsForLevel,
    formatRange,
    grantFinalRewards
  };
})(window);