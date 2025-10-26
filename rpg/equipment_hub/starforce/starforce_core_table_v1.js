/*!
 * starforce_core_table_v1.js — 星力規則（表格版 ES5/UMD）
 * - 機率：沿用既有 STAR_TABLE（不變）
 * - 武器：維持百分比攻擊（1~5→1%，6~10→2%，…，26~30→6%）
 * - 非武器（帽/套/手套）：依下表給「全屬平值」與「攻擊平值」
 *   · 全屬/攻擊 per-star 來自你提供的表（見下方兩個陣列），可直接改
 * - 僅計算，完全不碰存檔/背包/UI
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.StarforceTableV1 = factory(); }
})(this, function () {
  'use strict';

  /* ===== 成功率／爆率（原樣） ===== */
  var STAR_TABLE = {
    1:{succ:95,  boom:0},   2:{succ:90,  boom:0},   3:{succ:85,  boom:0},
    4:{succ:85,  boom:0},   5:{succ:80,  boom:0},   6:{succ:75,  boom:0},
    7:{succ:70,  boom:0},   8:{succ:65,  boom:0},   9:{succ:60,  boom:0},
    10:{succ:55, boom:0},   11:{succ:50, boom:0},   12:{succ:45, boom:0},
    13:{succ:40, boom:0},   14:{succ:35, boom:0},   15:{succ:30, boom:0},
    16:{succ:30, boom:2.1}, 17:{succ:30, boom:2.1}, 18:{succ:15, boom:6.8},
    19:{succ:12, boom:8.2}, 20:{succ:10, boom:9.0}, 21:{succ:30, boom:10.5},
    22:{succ:20, boom:11.5},23:{succ:17.5,boom:12.25},24:{succ:8.5, boom:18.0},
    25:{succ:8.5, boom:18.0},26:{succ:8.0, boom:18.0},27:{succ:7.0, boom:18.6},
    28:{succ:5.0, boom:19.0},29:{succ:3.0, boom:19.4},30:{succ:1.0, boom:19.8}
  };
  function successRate(nextStar){ var t=STAR_TABLE[nextStar]; return t ? t.succ : 0; }
  function boomRate(nextStar){ var t=STAR_TABLE[nextStar]; return t ? (t.boom||0) : 0; }

  /* ===== 武器：百分比公式 ===== */
  function starAtkPctPerStar(i){ if(i<=5) return 1; if(i<=10) return 2; if(i<=15) return 3; if(i<=20) return 4; if(i<=25) return 5; return 6; }
  function starAtkPctSum(star){ var i, s=0; for(i=1;i<=star;i++) s += starAtkPctPerStar(i); return s; }

  /* ===== 非武器表格（依你的圖） =====
   * 索引 1..30；單位為「每顆新增值」
   * - ALLSTAT_PER_STAR：全屬（STR/DEX/INT/LUK）平值
   * - ATK_PER_STAR    ：攻擊平值
   */
  var ALLSTAT_PER_STAR = [
    0, // 0 unused
    2,2,2,2,2,  // 1~5
    3,3,3,3,3,3,3,3,3,3, // 6~15
    17,17,17,17,17,17,17, // 16~22
    0,0,0,0,0,0,0,0       // 23~30
  ];
  var ATK_PER_STAR = [
    0, // 0 unused
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, // 1~15
    14,15,16,17,18,19,21,23,25,27,28,29,30,31,32 // 16~30
  ];

  function sumFrom(arr, star){
    var i, s=0; if (star<=0) return 0; if (star>30) star=30;
    for(i=1;i<=star && i<arr.length;i++) s += (arr[i]|0);
    return s;
  }

  /* ===== 計算星力加成 =====
   * equipType: 'weapon' | 'hat' | 'suit' | 'glove' ...
   * baseAtkPlusScroll: 以便武器%計算（非武器忽略）
   * 回傳：
   *  - 對武器：{ allStat:0, atkPctSum:x, atkFromStar: floor(base*(x/100)), atkFlat:0 }
   *  - 對非武器：{ allStat:sumAll, atkFlat:sumAtk, atkPctSum:0, atkFromStar:0 }
   */
  function calcStarBonus(equipType, star, baseAtkPlusScroll){
    star = star|0;
    if (equipType === 'weapon'){
      var pct = starAtkPctSum(star);
      var fromPct = Math.floor((baseAtkPlusScroll|0) * (pct/100));
      return { allStat:0, atkPctSum:pct, atkFromStar:fromPct, atkFlat:0 };
    } else {
      var allStat = sumFrom(ALLSTAT_PER_STAR, star);
      var atkFlat = sumFrom(ATK_PER_STAR, star);
      return { allStat:allStat, atkPctSum:0, atkFromStar:0, atkFlat:atkFlat };
    }
  }

  /* ===== 升星模擬（沿用） ===== */
  // options: { rng:fn()->0~1, maxStar:30, boomReset:{locked:true,pendingStar:12} }
  function attempt(currentStar, options){
    options = options || {};
    var rng = typeof options.rng==='function' ? options.rng : Math.random;
    var maxStar = options.maxStar || 30;

    if (currentStar >= maxStar) {
      return { ok:false, success:false, boom:false, keep:true, next:currentStar, reason:'cap' };
    }
    var next = currentStar + 1;
    var succ = rng() < (successRate(next)/100);
    if (succ) return { ok:true, success:true, boom:false, keep:false, next:next };

    var boom = rng() < (boomRate(next)/100);
    if (boom){
      var br = options.boomReset || { locked:true, pendingStar:12 };
      return { ok:false, success:false, boom:true, keep:false, next:0, boomReset:br };
    }
    return { ok:true, success:false, boom:false, keep:true, next:currentStar };
  }

  return {
    table: STAR_TABLE,
    successRate: successRate,
    boomRate: boomRate,
    starAtkPctSum: starAtkPctSum,       // 方便查
    calcStarBonus: calcStarBonus,       // ★ 新規則出口
    attempt: attempt,
    // 也把表輸出，方便你之後改
    __ALLSTAT_PER_STAR: ALLSTAT_PER_STAR,
    __ATK_PER_STAR: ATK_PER_STAR
  };
});