// dungeon/life_core_config.js — 生命 / 核心（含地獄）副本：數據 + 掉落 + 放大工具
(function (w) {
  "use strict";

  var LC_LEVEL = {
    MAX_LEVEL: 40,
    statBase: 1.00,
    statStep: 0.15,
    rewardStepMul: 1.10,
    tune: 1.00
  };
  function statMul(level){
    var L = Math.max(1, Math.min(level|0, LC_LEVEL.MAX_LEVEL));
    return (LC_LEVEL.statBase + LC_LEVEL.statStep * (L - 1)) * (LC_LEVEL.tune || 1);
  }
  function rewardMul(level){
    var L = Math.max(1, Math.min(level|0, LC_LEVEL.MAX_LEVEL));
    return Math.pow(LC_LEVEL.rewardStepMul || 1, L - 1) * (LC_LEVEL.tune || 1);
  }

  // 生命
  var LIFE_NORMAL_WAVES = [
    { label:"波 1", monster:{ name:"生命微靈",   atk:120, def:60,  hp:1600, aps:1.0 } },
    { label:"波 2", monster:{ name:"翠息守衛",   atk:150, def:90,  hp:2200, aps:1.1 } },
    { label:"波 3", monster:{ name:"大地心芽",   atk:200, def:120, hp:3200, aps:1.2 } },
  ];
  var LIFE_HARD_WAVES = [
    { label:"波 1", enemies:[
      { name:"綠脈行者", atk:160, def:70,  hp:1800, aps:1.6 },
      { name:"樹蔓侍者", atk:140, def:80,  hp:1600, aps:1.7 },
      { name:"治癒碎靈", atk:120, def:90,  hp:1400, aps:1.8 },
    ]},
    { label:"波 2", enemies:[
      { name:"林海斥候", atk:200, def:100, hp:2400, aps:1.7 },
      { name:"棘刺巡者", atk:180, def:110, hp:2200, aps:1.6 },
      { name:"泥根守望", atk:140, def:140, hp:2600, aps:1.5 },
    ]},
    { label:"波 3", enemies:[
      { name:"花冠衛士", atk:240, def:140, hp:3200, aps:1.7 },
      { name:"藤蔓編織", atk:210, def:160, hp:3400, aps:1.6 },
      { name:"林光祈禱", atk:180, def:200, hp:3800, aps:1.5 },
    ]},
    { label:"波 4", enemies:[
      { name:"古樹之核", atk:280, def:180, hp:4200, aps:1.8 },
      { name:"荊棘束縛", atk:260, def:200, hp:4400, aps:1.6 },
      { name:"森羅庇佑", atk:220, def:240, hp:5000, aps:1.5 },
    ]},
  ];
  var LIFE_DUNGEON = {
    id: "life_trial",
    name: "💚 生命副本",
    timeLimitSec: 90,
    wavesTemplate: LIFE_NORMAL_WAVES,
    hardWavesTemplate: LIFE_HARD_WAVES,
    rewardsNormal: { "生命強化石": [1, 3] },
    rewardsHard:   { "生命突破石": [2, 5] },
  };

  // 核心
  var CORE_NORMAL_WAVES = [
    { label:"波 1", monster:{ name:"核心微塵",   atk:150, def:70,  hp:2000, aps:1.0 } },
    { label:"波 2", monster:{ name:"核輝守衛",   atk:200, def:110, hp:3000, aps:1.1 } },
    { label:"波 3", monster:{ name:"晶核寄生",   atk:260, def:140, hp:3800, aps:1.2 } },
  ];
  var CORE_HARD_WAVES = [
    { label:"波 1", enemies:[
      { name:"晶刺行者", atk:200, def:100, hp:2600, aps:1.7 },
      { name:"裂核遊魂", atk:180, def:120, hp:2400, aps:1.8 },
      { name:"共振者",   atk:160, def:140, hp:2600, aps:1.6 },
    ]},
    { label:"波 2", enemies:[
      { name:"核爆先鋒", atk:260, def:140, hp:3400, aps:1.8 },
      { name:"折光者",   atk:240, def:160, hp:3200, aps:1.7 },
      { name:"聚能者",   atk:200, def:200, hp:3800, aps:1.5 },
    ]},
    { label:"波 3", enemies:[
      { name:"共振裂影", atk:300, def:180, hp:4200, aps:1.9 },
      { name:"裂晶射手", atk:260, def:200, hp:4400, aps:1.7 },
      { name:"核心守望", atk:220, def:240, hp:4800, aps:1.5 },
    ]},
  ];
  var CORE_HELL_WAVES = [
    { label:"波 1", enemies:[
      { name:"殘響獵手", atk:260, def:140, hp:3600, aps:2.0 },
      { name:"破界逸靈", atk:240, def:160, hp:3800, aps:1.8 },
      { name:"凝能引路", atk:220, def:200, hp:4200, aps:1.7 },
      { name:"聚核寄蟲", atk:200, def:220, hp:4600, aps:1.6 },
    ]},
    { label:"波 2", enemies:[
      { name:"裂序巨兵", atk:300, def:180, hp:4800, aps:2.0 },
      { name:"弧光術士", atk:280, def:200, hp:5200, aps:1.8 },
      { name:"晶傀操偶", atk:240, def:240, hp:5600, aps:1.6 },
      { name:"相位撕裂", atk:260, def:220, hp:5200, aps:1.7 },
    ]},
    { label:"波 3", enemies:[
      { name:"核灼收割", atk:340, def:220, hp:6200, aps:2.1 },
      { name:"異常聚能", atk:300, def:240, hp:6400, aps:1.8 },
      { name:"裂隙喚醒", atk:260, def:260, hp:7000, aps:1.6 },
      { name:"晶幕衛士", atk:280, def:220, hp:6600, aps:1.7 },
    ]},
    { label:"波 4", enemies:[
      { name:"⚠️ 核心覺醒體（Boss）", atk:420, def:300, hp:12000, aps:1.9 },
      { name:"共鳴投影",           atk:300, def:240, hp:7200,  aps:1.8 },
      { name:"護核裂影",           atk:280, def:260, hp:7600,  aps:1.7 },
      { name:"聚能徵兆",           atk:260, def:280, hp:8000,  aps:1.6 },
    ]},
  ];

  var CORE_DUNGEON = {
    id: "core_trial",
    name: "⚙️ 核心副本",
    timeLimitSec: 90,
    wavesTemplate: CORE_NORMAL_WAVES,
    hardWavesTemplate: CORE_HARD_WAVES,
    rewardsNormal: { "核心強化石": [1, 5] },
    rewardsHard:   { "核心突破石": [2, 5] },
  };
  var CORE_HELL_DUNGEON = {
    id: "core_trial_hell",
    name: "⚙️ 核心副本（地獄）",
    timeLimitSec: 90,
    hardWavesTemplate: CORE_HELL_WAVES,
    rewardsHard: { "核心覺醒石": [3, 8] }
  };

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
  function buildNormalWavesForLevel(tpl, level){
    var mul = statMul(level), out=[];
    for (var i=0;i<tpl.length;i++){
      var wv=tpl[i], m=wv.monster||{};
      out.push({ label: wv.label || ("Wave "+(i+1)), monster: _scaleEnemy(m, mul) });
    }
    return out;
  }
  function buildHardEnemiesForWave(arr, level){
    var mul = statMul(level), out=[];
    arr = arr || [];
    for (var i=0;i<arr.length;i++) out.push(_scaleEnemy(arr[i], mul));
    return out;
  }
  function scaledRewardsForLevel(view, level){
    var mul = rewardMul(level), out={};
    Object.keys(view||{}).forEach(function(k){
      var r=view[k]; if(!Array.isArray(r)||r.length<2) return;
      out[k] = [ Math.max(0, Math.floor(r[0]*mul)), Math.max(0, Math.floor(r[1]*mul)) ];
    });
    return out;
  }
  function formatRange(r, unit){
    if (!r) return "—";
    var u=unit||""; return r[0].toLocaleString()+u+" ~ "+r[1].toLocaleString()+u;
  }

  w.LC_LevelConfig  = LC_LEVEL;
  w.LIFE_DungeonDef = LIFE_DUNGEON;
  w.CORE_DungeonDef = CORE_DUNGEON;
  w.CORE_HellDungeonDef = CORE_HELL_DUNGEON;

  w.LC_ConfigUtils = {
    statMul: statMul,
    rewardMul: rewardMul,
    buildNormalWavesForLevel: buildNormalWavesForLevel,
    buildHardEnemiesForWave: buildHardEnemiesForWave,
    scaledRewardsForLevel: scaledRewardsForLevel,
    formatRange: formatRange
  };
})(window);