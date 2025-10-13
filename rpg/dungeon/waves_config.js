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
  // 規則：每個副本只掉它配置到的獎勵鍵（金幣/強化石/元素碎片/進階石）
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
      finalRewards: { gold: [3000, 5000] } // 只掉金幣
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
      finalRewards: { stone: [190, 440] }  // 只掉強化石
    },
    {
      id: "shard_rush",
      name: "🧩 元素碎片副本",
      desc: "打碎元素靈核，收集元素碎片",
      timeLimitSec: 0,
      wavesTemplate: [
        { label: "Wave 1", monster: { name: "微光靈核", atk: 108, def: 50,   hp: 4500,  aps: 0.9 } },
        { label: "Wave 2", monster: { name: "流影靈核", atk: 168, def: 100,  hp: 6900,  aps: 1.0 } },
        { label: "Wave 3", monster: { name: "耀晶靈核", atk: 262, def: 146,  hp: 10300, aps: 1.5 } }
      ],
      finalRewards: { shard: [1, 5] }     // 只掉元素碎片
    },
    {
      id: "adv_stone_rush",
      name: "💎 進階石副本",
      desc: "稀有晶核，機率獲得進階石",
      timeLimitSec: 0,
      wavesTemplate: [
        { label: "Wave 1", monster: { name: "初階晶核", atk: 55,  def: 100, hp: 8000,  aps: 0.8 } },
        { label: "Wave 2", monster: { name: "高壓晶核", atk: 77,  def: 160, hp: 12000, aps: 0.9 } },
        { label: "Wave 3", monster: { name: "究極晶核", atk: 220, def: 220, hp: 18000, aps: 2.0 } }
      ],
      finalRewards: { advStone: [1, 5] }  // 只掉進階石（需要 addItem("進階石", n) 支援）
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

  function scaledFinalRewardsForLevel(view, level){
    const mul = rewardMultiplier(level);
    const scale = (r) => (!r ? null : [ Math.max(0, Math.floor(r[0]*mul)), Math.max(0, Math.floor(r[1]*mul)) ]);
    return {
      gold:     view.gold     ? scale(view.gold)     : null,
      stone:    view.stone    ? scale(view.stone)    : null,
      shard:    view.shard    ? scale(view.shard)    : null,
      advStone: view.advStone ? scale(view.advStone) : null
    };
  }

  function grantFinalRewards(r, dungeonName){
    const got = { gold:0, stone:0, shard:0, advStone:0 };
    const roll = ([a,b]) => Math.floor(Math.random() * (b - a + 1)) + a;

    if (r.gold)  { got.gold  = roll(r.gold);  w.player.gold  = (w.player.gold || 0) + got.gold; }
    if (r.stone) { got.stone = roll(r.stone); w.player.stone = (w.player.stone || 0) + got.stone; }
    if (r.shard) {
      got.shard = roll(r.shard);
      if (typeof w.addItem === "function") w.addItem("元素碎片", got.shard);
      else {
        w.player._bag = w.player._bag || {};
        w.player._bag["元素碎片"] = (w.player._bag["元素碎片"] || 0) + got.shard;
      }
    }
    if (r.advStone) {
      got.advStone = roll(r.advStone);
      if (typeof w.addItem === "function") w.addItem("進階石", got.advStone);
      else {
        w.player._bag = w.player._bag || {};
        w.player._bag["進階石"] = (w.player._bag["進階石"] || 0) + got.advStone;
      }
    }

    const parts = [];
    if (r.gold)     parts.push(`金幣×${(got.gold||0).toLocaleString()}`);
    if (r.stone)    parts.push(`強化石×${(got.stone||0).toLocaleString()}`);
    if (r.shard)    parts.push(`元素碎片×${got.shard||0}`);
    if (r.advStone) parts.push(`進階石×${got.advStone||0}`);
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