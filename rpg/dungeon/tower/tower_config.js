// dungeon/tower_config.js — 試煉塔設定
(function (w) {
  "use strict";

  const TOWER_LEVEL = {
    MAX_STAGE: 50,        // 總關卡數
    statBase: 1.0,        // Lv1 基礎倍率
    statStep: 0.20,       // 每層強度 +20%
    rewardStepMul: 1.08,  // 每層獎勵倍率 +8%
    tune: 1.00
  };

  function statMul(stage){
    const L = Math.max(1, Math.min(stage|0, TOWER_LEVEL.MAX_STAGE));
    return (TOWER_LEVEL.statBase + TOWER_LEVEL.statStep * (L - 1)) * (TOWER_LEVEL.tune || 1);
  }
  function rewardMul(stage){
    const L = Math.max(1, Math.min(stage|0, TOWER_LEVEL.MAX_STAGE));
    return Math.pow(TOWER_LEVEL.rewardStepMul, L - 1) * (TOWER_LEVEL.tune || 1);
  }

  // 關卡定義（可自行增加）
  const TOWER_BASE = {
    name: "試煉塔",
    desc: "不斷挑戰更強的敵人，看看你能走多遠！",
    baseEnemy: { name: "塔守者", atk: 80, def: 30, hp: 500, aps: 1.0 },
    baseReward: { gold: [200, 400], shard: [1, 3] }
  };

  function buildStage(stage){
    const mulS = statMul(stage), mulR = rewardMul(stage);
    const e = TOWER_BASE.baseEnemy;
    const r = TOWER_BASE.baseReward;
    return {
      stage,
      name: `${TOWER_BASE.name} 第 ${stage} 層`,
      desc: TOWER_BASE.desc,
      enemy: {
        name: e.name,
        atk: Math.floor(e.atk * mulS),
        def: Math.floor(e.def * mulS),
        hp:  Math.floor(e.hp  * mulS),
        aps: e.aps
      },
      rewards: {
        gold: [Math.floor(r.gold[0] * mulR), Math.floor(r.gold[1] * mulR)],
        shard:[Math.floor(r.shard[0]*mulR),  Math.floor(r.shard[1]*mulR)]
      }
    };
  }

  w.TowerConfig = {
    LEVEL: TOWER_LEVEL,
    BASE: TOWER_BASE,
    buildStage,
    statMul,
    rewardMul
  };
})(window);