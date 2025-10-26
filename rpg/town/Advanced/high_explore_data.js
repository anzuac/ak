// ===============================
// high_explore_drops.js — 段位版（F- → SSS+）
// 依賴（可選）：window.computeCombatPower, window.getRankByCP
// 說明：
// - 用 reqRank 做關卡門檻（F- → SSS+）
// - chanceMult / qtyMult：掉率＆數量倍率
// - expMult：固定 EXP 掉落倍率
// ===============================
(function (w) {
  "use strict";

  // ---------- 小工具 ----------
  function randInt(min, max){ min=Math.floor(min); max=Math.floor(max); return Math.floor(Math.random()*(max-min+1))+min; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function nz(x,d){ x=Number(x); return isFinite(x)? x : (d||0); }

  // 段位順序（需與 combat_power.js 一致）
  var RANK_ORDER = ["F-","F","F+","E-","E","E+","D-","D","D+","C-","C","C+","B-","B","B+","A-","A","A+","S-","S","S+","SS-","SS","SS+","SSS-","SSS","SSS+"];

  function rankIndex(label){
    var i = RANK_ORDER.indexOf(String(label||""));
    return i < 0 ? 0 : i;
  }
  function getPlayerRankLabel(){
    try{
      if (typeof w.computeCombatPower === "function" && typeof w.getRankByCP === "function"){
        var cp = w.computeCombatPower(w.player || {});
        var rk = w.getRankByCP(cp);
        return rk && rk.label ? rk.label : "F-";
      }
    }catch(_){}
    return "F-";
  }
  function meetsRankRequirement(reqRank){
    // 若沒載 combat_power.js，預設放行（避免卡住）
    if (typeof w.computeCombatPower !== "function" || typeof w.getRankByCP !== "function") return true;
    var cur = getPlayerRankLabel();
    return rankIndex(cur) >= rankIndex(reqRank);
  }

  // ① 關卡表：用 reqRank（F- → SSS+）
  var DIFFICULTIES = [
    { id:"R01", name:"新手平原",     reqRank:"F-" , chanceMult:1.00, qtyMult:1.00, expMult:1.00 },
    { id:"R02", name:"嵐草丘陵",     reqRank:"F"  , chanceMult:1.04, qtyMult:1.04, expMult:1.10 },
    { id:"R03", name:"河畔營地",     reqRank:"F+" , chanceMult:1.08, qtyMult:1.08, expMult:1.21 },

    { id:"R04", name:"迷霧林道",     reqRank:"E-" , chanceMult:1.12, qtyMult:1.12, expMult:1.33 },
    { id:"R05", name:"古樹深徑",     reqRank:"E"  , chanceMult:1.16, qtyMult:1.16, expMult:1.46 },
    { id:"R06", name:"月影樹海",     reqRank:"E+" , chanceMult:1.20, qtyMult:1.20, expMult:1.61 },

    { id:"R07", name:"黎明洞窟",     reqRank:"D-" , chanceMult:1.26, qtyMult:1.26, expMult:1.77 },
    { id:"R08", name:"熔石洞窟",     reqRank:"D"  , chanceMult:1.32, qtyMult:1.32, expMult:1.95 },
    { id:"R09", name:"寒霜洞窟",     reqRank:"D+" , chanceMult:1.38, qtyMult:1.38, expMult:2.15 },

    { id:"R10", name:"紅砂荒漠",     reqRank:"C-" , chanceMult:1.45, qtyMult:1.45, expMult:2.37 },
    { id:"R11", name:"風痕峽谷",     reqRank:"C"  , chanceMult:1.52, qtyMult:1.52, expMult:2.61 },
    { id:"R12", name:"螺旋遺跡",     reqRank:"C+" , chanceMult:1.60, qtyMult:1.60, expMult:2.87 },

    { id:"R13", name:"沼澤王庭",     reqRank:"B-" , chanceMult:1.70, qtyMult:1.70, expMult:3.50 },
    { id:"R14", name:"雙月濕地",     reqRank:"B"  , chanceMult:1.80, qtyMult:1.80, expMult:4.00 },
    { id:"R15", name:"藍磷地窟",     reqRank:"B+" , chanceMult:1.92, qtyMult:1.92, expMult:4.60 },

    { id:"R16", name:"雲梯山脈",     reqRank:"A-" , chanceMult:2.05, qtyMult:2.05, expMult:5.30 },
    { id:"R17", name:"霜牙雪原",     reqRank:"A"  , chanceMult:2.20, qtyMult:2.20, expMult:6.10 },
    { id:"R18", name:"雷鳴高地",     reqRank:"A+" , chanceMult:2.36, qtyMult:2.36, expMult:7.00 },

    { id:"R19", name:"漂浮空城",     reqRank:"S-" , chanceMult:2.54, qtyMult:2.54, expMult:8.10 },
    { id:"R20", name:"星落城牆",     reqRank:"S"  , chanceMult:2.74, qtyMult:2.74, expMult:9.30 },
    { id:"R21", name:"空鯨之脊",     reqRank:"S+" , chanceMult:2.96, qtyMult:2.96, expMult:10.80 },

    { id:"R22", name:"邊緣深淵",     reqRank:"SS-", chanceMult:3.20, qtyMult:3.20, expMult:12.60 },
    { id:"R23", name:"無光深海",     reqRank:"SS" , chanceMult:3.46, qtyMult:3.46, expMult:14.70 },
    { id:"R24", name:"黑曜裂隙",     reqRank:"SS+", chanceMult:3.75, qtyMult:3.75, expMult:17.20 },

    { id:"R25", name:"虛空神殿",     reqRank:"SSS-",chanceMult:4.10, qtyMult:4.10, expMult:20.60 },
    { id:"R26", name:"天頂聖域",     reqRank:"SSS", chanceMult:4.30, qtyMult:4.30, expMult:22.50 },
    { id:"R27", name:"天星王座",     reqRank:"SSS+",chanceMult:4.50, qtyMult:4.50, expMult:24.70 }
  ];
  function getDiff(tierId){
    for (var i=0;i<DIFFICULTIES.length;i++){
      if (DIFFICULTIES[i].id===tierId) return DIFFICULTIES[i];
    }
    return DIFFICULTIES[0];
  }

  // ② 固定掉落：含 EXP；強化石 type "stone"
  var GUARANTEED = [
    { type:"gold",  key:"金錢",   name:"金錢",   baseQty:[600, 3000] },
    { type:"stone", key:"強化石", name:"強化石", baseQty:[220, 1000] },
    { type:"exp",   key:"經驗",   name:"經驗",   baseQty:[30, 180] }
  ];

  // ③ 隨機獎池（維持你先前的清單；修正藥水 key 的逗號）
  var REWARDS = [
    { type:"gem",  key:"💎",          name:"鑽石",           rate:0.01,  qty:[5,30] },
    { type:"item", key:"元素碎片",     name:"元素碎片",       rate:0.20,  qty:[4,10] },
    { type:"item", key:"進階石",       name:"進階石",         rate:0.15,  qty:[1,4] },
    { type:"item", key:"星之碎片",     name:"星之碎片",       rate:0.13,  qty:[1,2] },
    { type:"item", key:"衝星石",       name:"衝星石",         rate:0.22,  qty:[2,5] },
    { type:"item", key:"SP點數券",     name:"SP點數券",       rate:0.05,  qty:[1,3] },
    { type:"item", key:"技能強化券",   name:"技能強化券",     rate:0.005, qty:[1,2] },
    { type:"item", key:"核心強化石",   name:"核心強化石",     rate:0.015, qty:[1,2] },
    { type:"item", key:"核心覺醒石",   name:"核心覺醒石",     rate:0.015, qty:[1,2] },
    { type:"item", key:"核心星力石",   name:"核心星力石",     rate:0.015, qty:[1,2] },
    { type:"item", key:"飾品星力強化石", name:"飾品星力強化石", rate:0.02,  qty:[1,3] },
    { type:"item", key:"飾品強化石",   name:"飾品強化石",     rate:0.02,  qty:[1,3] },
    { type:"item", key:"飾品突破石",   name:"飾品突破石",     rate:0.02,  qty:[1,3] },
    { type:"item", key:"生命強化石",   name:"生命強化石",     rate:0.03,  qty:[1,4] },
    { type:"item", key:"生命突破石",   name:"生命突破石",     rate:0.03,  qty:[1,4] },
    { type:"item", key:"護盾補充器",   name:"護盾補充器",     rate:0.035, qty:[1,3] },
    { type:"item", key:"護盾免費升級券", name:"護盾免費升級券", rate:0.01,  qty:[1,1] },
    { type:"item", key:"擴充護盾上限石", name:"擴充護盾上限石", rate:0.012, qty:[1,1] },
    { type:"item", key:"生命藥水",     name:"生命藥水",       rate:0.072, qty:[1,8] },
    { type:"item", key:"高級生命藥水", name:"高級生命藥水",   rate:0.032, qty:[1,4] },
    { type:"item", key:"超級生命藥水", name:"超級生命藥水",   rate:0.012, qty:[1,2] },
    { type:"item", key:"法力藥水",     name:"法力藥水",       rate:0.072, qty:[1,8] },
    { type:"item", key:"高級法力藥水", name:"高級法力藥水",   rate:0.032, qty:[1,4] },
    { type:"item", key:"超級法力藥水", name:"超級法力藥水",   rate:0.012, qty:[1,2] },

    { type:"ess",  key:"元素精華",     name:"元素精華",       rate:0.12,  qty:[1,5] }
  ];

  function scaleQty(qtyArr, mult){
    var q = randInt(nz(qtyArr[0],1), nz(qtyArr[1],1));
    return Math.max(1, Math.round(q * nz(mult,1)));
  }

  // ④ 固定掉落計算：EXP 用 expMult，其它用 qtyMult
  function grantGuaranteed(diff){
    var out = [];
    var qMul = nz(diff.qtyMult, 1);
    var eMul = nz(diff.expMult, 1);
    for (var i=0;i<GUARANTEED.length;i++){
      var g = GUARANTEED[i];
      var mult = (g.type === "exp") ? eMul : qMul;
      out.push({
        type: g.type || "item",
        key:  g.key  || g.name || "?",
        qty:  scaleQty(g.baseQty || [1,1], mult)
      });
    }
    return out;
  }

  // ⑤ 暴露給 UI 的資料（含倍率換算）
  w.HighExploreData = {
    difficulties: DIFFICULTIES,
    rewards: REWARDS,
    guaranteed: GUARANTEED,

    // 檢查玩家是否能進入該關卡（段位）
    canEnterTier: function(tierId){
      var d = getDiff(tierId);
      return meetsRankRequirement(d.reqRank);
    },

    // 供 UI 預覽倍率後的數值
    getViewForTier: function(tierId){
      var d = getDiff(tierId);
      var cMul = nz(d.chanceMult,1), qMul = nz(d.qtyMult,1), eMul = nz(d.expMult,1);

      var randomRows = REWARDS.map(function(r){
        var min = nz((r.qty && r.qty[0]), 1);
        var max = nz((r.qty && r.qty[1]), 1);
        return {
          name: r.name || r.key || "?",
          type: r.type || "item",
          baseRate: nz(r.rate,0),
          effRate: clamp(nz(r.rate,0) * cMul, 0, 1),
          min: Math.max(1, Math.round(min * qMul)),
          max: Math.max(1, Math.round(max * qMul))
        };
      });

      var fixedRows = GUARANTEED.map(function(g){
        var min = nz((g.baseQty && g.baseQty[0]), 1);
        var max = nz((g.baseQty && g.baseQty[1]), 1);
        var mult = (g.type === "exp") ? eMul : qMul;
        return {
          name: g.name || g.key || "?",
          type: g.type || "item",
          baseRate: 1,
          effRate: 1,
          min: Math.max(1, Math.round(min * mult)),
          max: Math.max(1, Math.round(max * mult)),
          guaranteed: true
        };
      });

      return { difficulty: d, random: randomRows, guaranteed: fixedRows };
    }
  };

  // ⑥ 舊 API 兼容（roll）＋ 新增 canEnterTier
  w.HighExploreDrops = {
    TIERS: (function(){
      var map = {};
      for (var i=0;i<DIFFICULTIES.length;i++){
        var t = DIFFICULTIES[i];
        map[t.id] = {
          id:t.id, name:t.name,
          // 兼容舊結構（保留 qty/dropMult 欄位名）
          dropMult:t.chanceMult, qtyMult:t.qtyMult, expMult:t.expMult,
          reqRank:t.reqRank
        };
      }
      return map;
    })(),

    canEnterTier: function(tierId){
      var d = getDiff(tierId);
      return meetsRankRequirement(d.reqRank);
    },

    // 原 roll：不強制門檻（交給 UI 控）；要強制也可在此加判斷 return []
    rollOnceByTier: function(tierId){
      var diff = getDiff(tierId), bag = [];
      var fixed = grantGuaranteed(diff);
      for (var i=0;i<fixed.length;i++) bag.push(fixed[i]);

      var rnd = (function(diff){
        var out=[], cMul=nz(diff.chanceMult,1), qMul=nz(diff.qtyMult,1);
        for (var i=0;i<REWARDS.length;i++){
          var r=REWARDS[i], pEff=clamp(nz(r.rate,0)*cMul,0,1);
          if(Math.random()<pEff) out.push({ type:r.type||"item", key:r.key||r.name||"?", qty:scaleQty(r.qty||[1,1],qMul) });
        } return out;
      })(diff);
      for (var j=0;j<rnd.length;j++) bag.push(rnd[j]);
      return bag;
    },

    rollManyByTier: function(tierId,times){
      times=Math.max(0,Math.floor(times||0)); var bag=[];
      for (var i=0;i<times;i++){
        var r=this.rollOnceByTier(tierId);
        for (var j=0;j<r.length;j++) bag.push(r[j]);
      }
      return bag;
    }
  };
})(window);