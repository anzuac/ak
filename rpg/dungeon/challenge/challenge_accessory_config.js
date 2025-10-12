// dungeon/challenge_accessory_config.js — 飾品強化試煉（數據/倍率/掉落工具）
(function (w) {
  "use strict";

  // ===== 等級倍率 =====
  var ACC_LEVEL = {
    MAX_LEVEL: 40,
    // 線性成長（與你既有系統一致概念）：Lv1=1.00, Lv2=1.15, Lv3=1.30...
    statBase: 1.00,
    statStep: 0.15,
    // 獎勵每等放大：1.1^(L-1)
    rewardStepMul: 1.10,
    tune: 1.00
  };

  function statMultiplier(level){
    var L = Math.max(1, Math.min(level|0, ACC_LEVEL.MAX_LEVEL));
    return (ACC_LEVEL.statBase + ACC_LEVEL.statStep * (L - 1)) * (ACC_LEVEL.tune || 1);
  }
  function rewardMultiplier(level){
    var L = Math.max(1, Math.min(level|0, ACC_LEVEL.MAX_LEVEL));
    return Math.pow(ACC_LEVEL.rewardStepMul || 1, L - 1) * (ACC_LEVEL.tune || 1);
  }

  // ===== 副本定義（普通 / 困難）=====
  // 普通模式：每波單體
  // 困難模式：每波 1 打多（3 隻同場）
  var ACC_DUNGEON = {
    id: "acc_trial",
    name: "💍 飾品強化試煉",
    timeLimitSec: 90,
    // 4 波（基礎值，會依等級放大）
    wavesTemplate: [
      { label:"波 1", monster:{ name:"飾品魔靈 I",  atk:120, def:60,  hp:1800, aps:1.0 } },
      { label:"波 2", monster:{ name:"飾品魔靈 II", atk:150, def:80,  hp:2300, aps:1.1 } },
      { label:"波 3", monster:{ name:"寶石護衛",    atk:180, def:110, hp:3000, aps:1.2 } },
      { label:"波 4", monster:{ name:"強化之核",    atk:240, def:140, hp:3800, aps:1.3 } }
    ],
    // 困難模式：每波同場三隻（給核心用）
    hardWavesTemplate: [
      {
        label: "波 1",
        enemies: [
          { name:"飾品幽靈", atk:120, def:50,  hp:1500, aps:1.6 },
          { name:"碎晶小鬼", atk:140, def:30,  hp:1200, aps:1.8 },
          { name:"補綁者",   atk:90,  def:80,  hp:1800, aps:1.4 }
        ]
      },
      {
        label: "波 2",
        enemies: [
          { name:"鋒碎妖",   atk:180, def:60,  hp:2400, aps:1.7 },
          { name:"晶裂行者", atk:160, def:60,  hp:2200, aps:1.7 },
          { name:"殘響者",   atk:120, def:120, hp:2600, aps:1.5 }
        ]
      },
      {
        label: "波 3",
        enemies: [
          { name:"寶石妖",   atk:220, def:90,  hp:2800, aps:1.8 },
          { name:"碎片衛士", atk:200, def:110, hp:3200, aps:1.6 },
          { name:"磨折者",   atk:150, def:160, hp:3600, aps:1.4 }
        ]
      },
      {
        label: "波 4",
        enemies: [
          { name:"晶核看守", atk:260, def:130, hp:3600, aps:1.8 },
          { name:"裂影",     atk:240, def:150, hp:4000, aps:1.6 },
          { name:"鍊光者",   atk:200, def:200, hp:4800, aps:1.5 },
          { name:"晶核破壞者",   atk:300, def:250, hp:8800, aps:2.5 }
        ]
      }
    ],
    // 掉落（普通 / 困難）
    // 掉落鍵將自動入庫 addItem(key,n)；金幣/強化石會走資源不進背包（在 core 補）
    rewardsNormal: { "飾品強化石": [1, 5] },
    rewardsHard:   { "飾品強化石": [3, 8] }
  };

  // ===== 工具：放大怪物 / 波次生成 =====
  function _scaleEnemy(e, mul){
    return {
      name: e.name || "Enemy",
      atk:  Math.max(1, Math.floor((e.atk||1) * mul)),
      def:  Math.max(0, Math.floor((e.def||0) * mul)),
      hp:   Math.max(1, Math.floor((e.hp ||1) * mul)),
      ms:       isFinite(e.ms) ? e.ms : undefined,
      aps:      isFinite(e.aps) ? e.aps : undefined,
      speedPct: isFinite(e.speedPct) ? e.speedPct : undefined
    };
  }

  function buildNormalWavesForLevel(wavesTemplate, level){
    var mul = statMultiplier(level);
    var out = [];
    for (var i=0;i<wavesTemplate.length;i++){
      var wv = wavesTemplate[i], m = wv.monster || {};
      out.push({
        label: wv.label || ("Wave "+(i+1)),
        monster: _scaleEnemy(m, mul)
      });
    }
    return out;
  }

  function buildHardEnemiesForWave(waveEnemies, level){
    var mul = statMultiplier(level);
    var arr = waveEnemies || [];
    var out = [];
    for (var i=0;i<arr.length;i++){
      out.push(_scaleEnemy(arr[i], mul));
    }
    return out;
  }

  // 獎勵放大（全鍵自動）
  function scaledRewardsForLevel(view, level){
    var mul = rewardMultiplier(level);
    var out = {};
    Object.keys(view || {}).forEach(function(k){
      var r = view[k]; if (!Array.isArray(r) || r.length < 2) return;
      out[k] = [
        Math.max(0, Math.floor(r[0] * mul)),
        Math.max(0, Math.floor(r[1] * mul))
      ];
    });
    return out;
  }

  // 給 UI 顯示
  function formatRange(r, unit){
    if (!r) return "—";
    var u = unit || ""; return r[0].toLocaleString()+u+" ~ "+r[1].toLocaleString()+u;
  }

  // ===== 對外 =====
  w.ACC_LevelConfig = ACC_LEVEL;
  w.ACC_DungeonDef  = ACC_DUNGEON;
  w.ACC_ConfigUtils = {
    statMultiplier: statMultiplier,
    rewardMultiplier: rewardMultiplier,
    buildNormalWavesForLevel: buildNormalWavesForLevel,
    buildHardEnemiesForWave: buildHardEnemiesForWave,
    scaledRewardsForLevel: scaledRewardsForLevel,
    formatRange: formatRange
  };
})(window);