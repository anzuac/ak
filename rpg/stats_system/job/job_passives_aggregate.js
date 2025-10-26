// =======================================================
// job_passives_aggregate.js
// 目的：將「職業被動等級」轉為加成，統一寫入 player.coreBonus.bonusData.jobPassives
// 設計：全部走裝備核心（coreBonus）
// 盜賊：只輸出 doubleHitChance（不寫 comboRate）
// 法師：輸出 magicShieldPercent（給魔力護盾集合器）
// 戰士：輸出 damageReduce
// 弓箭手：輸出 preemptiveChance 與 preemptivePerAttackMax（10等 +1）
// =======================================================
(function (w) {
  "use strict";

  // 若已存在，先移除舊版（避免不同版本衝突）
  try { delete w.JobPassiveAggregate; } catch(_) {}

  // 每級係數（依需求可調整）
  var PER_LV = {
    warrior: { damageReduce: 0.03 },        // 戰士：每級 +3% 減傷
    mage:    { magicShieldPercent: 0.07 },  // 法師：每級 +7% 魔力護盾
    thief:   { doubleHitChance: 0.04 },     // 盜賊：每級 +4% 連擊（只輸出 doubleHitChance）
    archer:  { preemptiveChance: 0.04 }     // 弓箭手：每級 +4% 先手再動
  };
  // 弓箭手：10等時 +1 上限（數值改為符合註解）
var ARCHER_CAP_BONUS = 2; // 10等時，再動次數上限 +1

  // 等待 player/coreBonus 可用（載入順序保險）
  function ensurePlayerReady(cb){
    var tries = 0;
    (function wait(){
      var ok = !!(w.player && w.player.coreBonus && w.player.coreBonus.bonusData);
      if (ok) return cb();
      if (tries++ > 100) return; // 最多等 ~5s
      setTimeout(wait, 50);
    })();
  }

  // 從 Store 讀等級 → 計算加成
  function getComputed(){
    if (!w.JobPassiveStore) return { warrior:{}, mage:{}, thief:{}, archer:{} };
    var lv = w.JobPassiveStore.getLevels && w.JobPassiveStore.getLevels();

    // 兼容：若鍵名不同，盡量容錯
    var wLv = (lv && lv.warrior) ? (lv.warrior.fortitude | 0) : 0;
    var mLv = (lv && lv.mage)    ? (lv.mage.manaGuard   | 0) : 0;
    var tLv = (lv && lv.thief)   ? (lv.thief.flurry     | 0) : 0;
    var aLv = (lv && lv.archer)  ? (lv.archer.quickdraw | 0) : 0;

    return {
      warrior: { damageReduce: wLv * PER_LV.warrior.damageReduce },
      mage:    { magicShieldPercent: mLv * PER_LV.mage.magicShieldPercent },
      thief:   { doubleHitChance: tLv * PER_LV.thief.doubleHitChance },
      archer:  {
        preemptiveChance: aLv * PER_LV.archer.preemptiveChance,
        preemptivePerAttackMax: (aLv >= 10 ? ARCHER_CAP_BONUS : 0)
      }
    };
  }

  // 把計算結果寫入 coreBonus（同一個桶：jobPassives）
  function apply(){
    ensurePlayerReady(function(){
      var comp = getComputed();
      var c = w.player.coreBonus.bonusData;
      var bucket = c.jobPassives || {};

      // 覆寫我們管理的鍵（不動其它來源）
      bucket.damageReduce             = Number(comp.warrior.damageReduce || 0);
      bucket.magicShieldPercent       = Number(comp.mage.magicShieldPercent || 0);
      bucket.doubleHitChance          = Number(comp.thief.doubleHitChance || 0);
      // 弓箭手
      bucket.preemptiveChance         = Number(comp.archer.preemptiveChance || 0);
      bucket.preemptivePerAttackMax   = Number(comp.archer.preemptivePerAttackMax || 0);

      // 🔧 清掉可能殘留的 comboRate，避免 UI 出現第二條（盜賊）
      if (bucket.comboRate !== undefined) delete bucket.comboRate;

      c.jobPassives = bucket;

      // 通知 UI
      try { w.updateResourceUI && w.updateResourceUI(); } catch(_){}
      try { w.refreshMageOnlyUI && w.refreshMageOnlyUI(); } catch(_){}
    });
  }

  // 訂閱資料變更（等級一改就套）
  function autoWire(){
    try { w.JobPassiveStore && w.JobPassiveStore.subscribe && w.JobPassiveStore.subscribe(apply); } catch(_){}
  }

  // 導出 API
  w.JobPassiveAggregate = {
    apply: apply,
    getComputed: getComputed
  };

  // 啟動：頁面就緒後套用一次並掛訂閱
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){ apply(); autoWire(); });
  } else {
    apply(); autoWire();
  }
})(window);