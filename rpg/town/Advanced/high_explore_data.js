// ===============================
// high_explore_drops.js（只貼出需要改/新增的部分）
// ===============================
(function (w) {
  "use strict";
  function randInt(min, max){ min=Math.floor(min); max=Math.floor(max); return Math.floor(Math.random()*(max-min+1))+min; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function nz(x,d){ x=Number(x); return isFinite(x)? x : (d||0); }

  // ① 難度表：新增 expMult（預設=1），不影響既有欄位
  var DIFFICULTIES = [
    { id:"A", name:"祕境・初階",   reqCP:0,      chanceMult:1.00, qtyMult:1.00, expMult:1.00 },
    { id:"B", name:"祕境・中階",   reqCP:1000,   chanceMult:1.10, qtyMult:1.10, expMult:1.2 },
    { id:"C", name:"祕境・高階",   reqCP:5000,   chanceMult:1.15, qtyMult:1.15, expMult:1.7 },
    { id:"D", name:"洞窟・初級",   reqCP:10000,  chanceMult:1.20, qtyMult:1.20, expMult:2.4 }, 
    { id:"E", name:"洞窟・中級",   reqCP:30000,  chanceMult:1.25, qtyMult:1.25, expMult:3.75 }, 
    { id:"F", name:"洞窟・高級",   reqCP:65000,  chanceMult:1.40, qtyMult:1.40, expMult:4.32 }, 
    { id:"G", name:"深淵・初級",   reqCP:100000, chanceMult:1.60, qtyMult:1.60, expMult:5.64 }, 
    { id:"H", name:"深淵・中級",   reqCP:150000, chanceMult:1.80, qtyMult:1.80, expMult:7.31 }, 
    { id:"I", name:"深淵・高級",   reqCP:250000, chanceMult:2.00, qtyMult:2.00, expMult:8.97 }, 
    { id:"J", name:"深淵・傳奇",   reqCP:400000, chanceMult:2.50, qtyMult:2.50, expMult:10.37 }, 
    { id:"K", name:"深淵・噩夢",   reqCP:600000, chanceMult:3.80, qtyMult:3.80, expMult:17.78 }
  ];
  function getDiff(id){ for (var i=0;i<DIFFICULTIES.length;i++) if (DIFFICULTIES[i].id===id) return DIFFICULTIES[i]; return DIFFICULTIES[0]; }

  // ② 固定掉落：加入 EXP；強化石改成 stone（你之前已改）
  var GUARANTEED = [
    { type:"gold",  key:"金錢",   name:"金錢",   baseQty:[600, 3000] },
    { type:"stone", key:"強化石", name:"強化石", baseQty:[220, 1000] },
    { type:"exp",   key:"經驗",   name:"經驗",   baseQty:[30, 180] } // ★ 新增：EXP 固定掉落
  ];

  var REWARDS = [ 
    { type:"gem",  key:"💎",        name:"鑽石",       rate:0.01, qty:[5,15] },
    { type:"item", key:"元素碎片",   name:"元素碎片",   rate:0.2, qty:[3,10] },
    { type:"item", key:"進階石",     name:"進階石",     rate:0.15, qty:[2,8] },
    { type:"item", key:"星之碎片",   name:"星之碎片",   rate:0.13, qty:[1,6] },
    { type:"item", key:"衝星石",     name:"衝星石",     rate:0.22, qty:[2,7] },
    { type:"item", key:"SP點數券",   name:"SP點數券",   rate:0.05, qty:[1,3] },
    { type:"item", key:"技能強化券", name:"技能強化券", rate:0.015, qty:[1,2] },
    { type:"ess",  key:"元素精華",   name:"元素精華",   rate:0.12, qty:[1,5] }
   ];

  function scaleQty(qtyArr, mult){
    var q = randInt(nz(qtyArr[0],1), nz(qtyArr[1],1));
    return Math.max(1, Math.round(q * nz(mult,1)));
  }

  // ③ 固定掉落計算：EXP 使用 expMult，其它使用 qtyMult
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

  // ④ 給獎勵視圖（你有用 getViewForTier 的話）：EXP 顯示用 expMult
  w.HighExploreData = {
    difficulties: DIFFICULTIES,
    rewards: REWARDS,
    guaranteed: GUARANTEED,
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

  // 舊 API 兼容（可選把 expMult 暴露）
  w.HighExploreDrops = {
    TIERS: (function(){
      var map = {};
      for (var i=0;i<DIFFICULTIES.length;i++){
        var t = DIFFICULTIES[i];
        map[t.id] = { id:t.id, name:t.name, reqCP:t.reqCP, dropMult:t.chanceMult, qtyMult:t.qtyMult, expMult:t.expMult };
      }
      return map;
    })(),
    rollOnceByTier: function(tierId){
      var diff = getDiff(tierId), bag = [];
      var fixed = grantGuaranteed(diff); for (var i=0;i<fixed.length;i++) bag.push(fixed[i]);
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
      for (var i=0;i<times;i++){ var r=this.rollOnceByTier(tierId); for (var j=0;j<r.length;j++) bag.push(r[j]); }
      return bag;
    }
  };
})(window);