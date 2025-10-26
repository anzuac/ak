// dungeon/v13_config.js — 1v3 設定（等級倍率 + 副本清單 + 全自動掉落支援）

(function (w) {
  "use strict";

  // ===== 等級倍率（與波次副本統一概念） =====
  var V13_LEVEL = {
    MAX_LEVEL: 10,
    statBase: 1.40,       // Lv1 基礎倍率
    statStep: 1.30,       // 每等數值加乘
    rewardStepMul: 1.4,  // 獎勵每等放大倍率
    tune: 1.00
  };

  function statMultiplier(level){
    var L = Math.max(1, Math.min(level|0, V13_LEVEL.MAX_LEVEL));
    return (V13_LEVEL.statBase + V13_LEVEL.statStep * (L - 1)) * (V13_LEVEL.tune || 1);
  }
  function rewardMultiplier(level){
    var L = Math.max(1, Math.min(level|0, V13_LEVEL.MAX_LEVEL));
    return Math.pow(V13_LEVEL.rewardStepMul || 1, L - 1) * (V13_LEVEL.tune || 1);
  }

  // ===== 副本定義（可新增多個）=====
  var V13_DUNGEONS = [
    {
      id: "arena_v13",
      name: "⚔️ 三對一試煉",
      desc: "同場三敵同時出手，考驗續戰與輸出",
      timeLimitSec: 0,
      enemiesBase: [
        { name: "狂戰士", atk: 220, def: 20, hp: 12400, aps: 2.2 },
        { name: "盾騎士", atk: 50, def: 380, hp: 14700, aps: 1.9 },
        { name: "處刑者", atk: 360, def: 120, hp: 32301, aps: 2.3 }
      ],
      // 你可自由增加新鍵，如 gold, shard, boss_coin ...
      finalRewards: {
        鑽石抽獎券: [1, 3],
        
      },
      ticketKind: "ChallengeTicket"
    }
  ];

  // ===== 工具 =====
  function scaleEnemy(e, mul){
    return {
      name: e.name || "Enemy",
      atk:  Math.max(1, Math.floor((e.atk||1) * mul)),
      def:  Math.max(0, Math.floor((e.def||0) * mul)),
      hp:   Math.max(1, Math.floor((e.hp||1) * mul)),
      ms:       isFinite(e.ms) ? e.ms : undefined,
      aps:      isFinite(e.aps) ? e.aps : undefined,
      speedPct: isFinite(e.speedPct) ? e.speedPct : undefined
    };
  }
  function buildEnemiesForLevel(enemiesBase, level){
    var mul = statMultiplier(level);
    return enemiesBase.map(e => scaleEnemy(e, mul));
  }

  // ✅ 改版：所有掉落鍵都自動處理（不用寫 if）
  function scaledRewardsForLevel(view, level){
    var mul = rewardMultiplier(level);
    var out = {};
    Object.keys(view || {}).forEach(k => {
      var r = view[k];
      if (!Array.isArray(r) || r.length < 2) return;
      out[k] = [
        Math.max(0, Math.floor(r[0] * mul)),
        Math.max(0, Math.floor(r[1] * mul))
      ];
    });
    return out;
  }

  function formatRange(r, unit){
    if (!r) return "—";
    var u = unit || "";
    return r[0].toLocaleString() + u + " ~ " + r[1].toLocaleString() + u;
  }

  // ✅ 改版：自動入庫（任何鍵）
  function grantRewards(resultR){
    var got = {};
    Object.keys(resultR || {}).forEach(key => {
      var range = resultR[key];
      if (!Array.isArray(range) || range.length < 2) return;
      var n = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
      if (n <= 0) return;
      got[key] = (got[key] || 0) + n;

      if (typeof w.addItem === "function") {
        w.addItem(key, n); // ★ 背包自動可接受任何鍵
      } else {
        // 備援：手動塞到 bag
        w.player._bag = w.player._bag || {};
        w.player._bag[key] = (w.player._bag[key] || 0) + n;
      }
    });

    w.updateResourceUI?.();

    var msg = Object.keys(got)
      .map(k => `${k}×${got[k].toLocaleString()}`)
      .join("、");
    w.logPrepend?.(`🏆 通關 1v3：獲得 ${msg}`);
    return got;
  }

  // ===== 對外 =====
  w.V13LevelConfig = V13_LEVEL;
  w.V13Defs = V13_DUNGEONS;
  w.V13Utils = {
    statMultiplier: statMultiplier,
    rewardMultiplier: rewardMultiplier,
    buildEnemiesForLevel: buildEnemiesForLevel,
    scaledRewardsForLevel: scaledRewardsForLevel,
    formatRange: formatRange,
    grantRewards: grantRewards
  };
})(window);