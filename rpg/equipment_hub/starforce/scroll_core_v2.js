/*!
 * scroll_core_v2.js — 卷軸強化（ES5/UMD）
 * - 純規則/純函式：不碰存檔、不接背包、不做 UI
 *
 * 本版重點：
 *  • 一般卷（除武器外）：60% 全屬+2、10% 全屬+6
 *  • 武器卷：60% ATK+7、10% ATK+11
 *  • 混沌卷軸60%（允許負數）：主屬/ATK 使用自訂分佈（-5..+15，+3 固定 8%，從 +0..+12 等比挪出）
 *  • 高級混沌卷軸60%（無負數）：主屬/ATK 使用自訂分佈（0..+12）
 *  • chaosPreview/chaosCommit：支援「混沌選擇券」的二段式操作
 *  • ★新增：卷軸上限提升（最多 +10 格），成功率階梯（百分比）：
 *        100, 70, 40, 25, 20, 15, 10, 8, 5, 1
 *
 * 對外 API：
 *   ScrollForgeV2.def
 *   ScrollForgeV2.canUse(node, name)
 *   ScrollForgeV2.apply(node, name, opt)
 *   ScrollForgeV2.chaosPreview(node, name)
 *   ScrollForgeV2.chaosCommit(node, name, effPreview, applyIt)
 *   ScrollForgeV2.recoverFailedOnce(node)
 *   ScrollForgeV2.perfectReset(node)
 *   ScrollForgeV2.chaosMainProb(allowNeg)
 *   // 卷軸上限提升
 *   ScrollForgeV2.canAugmentSlots(node)
 *   ScrollForgeV2.augmentSlots(node, opt)
 *   // 機率查詢／覆寫
 *   ScrollForgeV2.getAugmentChances()     -> [100,70,...,1]  (百分比)
 *   ScrollForgeV2.augmentSteps            -> [1.00,0.70,...] (0~1)
 *   ScrollForgeV2.setAugmentChances(arr)  // 覆寫 0~1 陣列
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.ScrollForgeV2 = factory(); }
})(this, function () {
  'use strict';

  function clone(o){ try{return JSON.parse(JSON.stringify(o||{}));}catch(_){return {}; } }
  function nz(n){ return (typeof n==='number' && isFinite(n)) ? n : 0; }

  // 可使用卷軸的部位清單
  var EQUIP_SCROLLABLE = ['hat','suit','glove','weapon','cape','shoes','shoulder','ornament'];

  // ===== 一般卷／武器卷 定義 =====
  var DEF = {
    '防具強化卷60%': { equip:['hat','suit','cape','shoes','shoulder','ornament','glove'], rate:60, eff:{ str:2, dex:2, int:2, luk:2 } },
    '防具強化卷10%': { equip:['hat','suit','cape','shoes','shoulder','ornament','glove'], rate:10, eff:{ str:6, dex:6, int:6, luk:6 } },
    '武器強化卷60%': { equip:'weapon', rate:60, eff:{ atk:7 } },
    '武器強化卷10%': { equip:'weapon', rate:10, eff:{ atk:11 } },

    // 混沌卷（成功率皆為 60%）
    '混沌卷軸60%': {
      equip: EQUIP_SCROLLABLE.slice(),
      rate: 60,
      effGen: function (node, rng) { return chaosRollBundle('std', rng); }
    },
    '高級混沌卷軸60%': {
      equip: EQUIP_SCROLLABLE.slice(),
      rate: 60,
      effGen: function (node, rng) { return chaosRollBundle('adv', rng); }
    }
  };

  // ===== 機率工具 =====
  function pickWeighted(weights, rng){
    var i, total=0; for(i=0;i<weights.length;i++) total += (weights[i].w||0);
    if (total<=0) return weights[0] ? weights[0].v : 0;
    var r=(rng() * total), acc=0;
    for(i=0;i<weights.length;i++){ acc += (weights[i].w||0); if (r <= acc) return weights[i].v; }
    return weights[weights.length-1].v;
  }
  function rollFromPctTable(objPct, rng){
    // objPct: { value -> percent(0..100 任意總和) }
    var arr=[], k; for(k in objPct) if (objPct.hasOwnProperty(k)){
      arr.push({ v: parseInt(k,10), w: Number(objPct[k])||0 });
    }
    arr.sort(function(a,b){ return a.v - b.v; });
    return pickWeighted(arr, rng);
  }

  // ===== 主屬/ATK 每點機率表 =====
  // 1) 標準混沌（允許負數，-5..+15）— +3 固定 8%，其餘 0..12(不含3) 等比縮
  var CHAOS_STD_MAIN_PCT = (function(){
    var base = {
      "-5":1.5, "-4":2, "-3":2.5, "-2":3, "-1":5,
       "0":7, "1":8, "2":8, /*"3":—*/ "4":9, "5":8, "6":8, "7":7,
       "8":6.5, "9":5.5, "10":5, "11":4, "12":3.5, "13":3, "14":2, "15":1
    };
    var poolKeys = ["0","1","2","4","5","6","7","8","9","10","11","12"];
    var i, poolSum = 0;
    for(i=0;i<poolKeys.length;i++) poolSum += (Number(base[poolKeys[i]])||0); // 79.5
    var need = 8.0;
    var f = (poolSum - need) / (poolSum || 1);
    for(i=0;i<poolKeys.length;i++){ var k = poolKeys[i]; base[k] = +(Number(base[k]) * f); }
    base["3"] = 8.0;
    return base; // 總和 ~99.5%
  })();

  // 2) 高級混沌（0..12）
  var CHAOS_ADV_MAIN_PCT = {
    "0":10,"1":12.5,"2":13,"3":12,"4":10,"5":9,"6":8.5,"7":7.5,"8":6.5,"9":5,"10":3,"11":2,"12":1
  };

  // HP/DEF：分段遞減分配
  var CHAOS_HP_RANGE = { negMin:-50, posMidMax:40, posHighMax:99, posTop:100 };
  var CHAOS_DEF_RANGE= { negMin:-30, posMidMax:15, posHighMax:29, posTop:30 };
  function decreasingWeights(from, to){
    var arr=[], i; for(i=from;i<=to;i++){ arr.push({ v:i, w:(to - i + 1) }); } return arr;
  }
  function towardZeroWeights(min, max){
    var arr=[], i; for(i=min;i<=max;i++){ var d=Math.abs(i); arr.push({ v:i, w:(d===0)? (max-min+2) : (1/(d+0.5)) }); } return arr;
  }
  function chaosHP(allowNegative, rng){
    var buckets=[], P_NEG=allowNegative?0.15:0, P_TOP=0.01, P_HIGH=allowNegative?0.14:0.19, P_MID=1-(P_NEG+P_HIGH+P_TOP);
    if (P_NEG>0) buckets.push({p:P_NEG, gen:function(){ return pickWeighted(towardZeroWeights(CHAOS_HP_RANGE.negMin,-1), rng); }});
    buckets.push({p:P_MID, gen:function(){ return pickWeighted(decreasingWeights(0, CHAOS_HP_RANGE.posMidMax), rng); }});
    buckets.push({p:P_HIGH,gen:function(){ return pickWeighted(decreasingWeights(CHAOS_HP_RANGE.posMidMax+1, CHAOS_HP_RANGE.posHighMax), rng); }});
    buckets.push({p:P_TOP, gen:function(){ return CHAOS_HP_RANGE.posTop; }});
    var ws=[], i; for(i=0;i<buckets.length;i++) ws.push({ v:i, w:buckets[i].p });
    return buckets[pickWeighted(ws, rng)].gen();
  }
  function chaosDEF(allowNegative, rng){
    var buckets=[], P_NEG=allowNegative?0.15:0, P_TOP=0.01, P_HIGH=allowNegative?0.14:0.19, P_MID=1-(P_NEG+P_HIGH+P_TOP);
    if (P_NEG>0) buckets.push({p:P_NEG, gen:function(){ return pickWeighted(towardZeroWeights(CHAOS_DEF_RANGE.negMin,-1), rng); }});
    buckets.push({p:P_MID, gen:function(){ return pickWeighted(decreasingWeights(0, CHAOS_DEF_RANGE.posMidMax), rng); }});
    buckets.push({p:P_HIGH,gen:function(){ return pickWeighted(decreasingWeights(CHAOS_DEF_RANGE.posMidMax+1, CHAOS_DEF_RANGE.posHighMax), rng); }});
    buckets.push({p:P_TOP, gen:function(){ return CHAOS_DEF_RANGE.posTop; }});
    var ws=[], i; for(i=0;i<buckets.length;i++) ws.push({ v:i, w:buckets[i].p });
    return buckets[pickWeighted(ws, rng)].gen();
  }

  // 分流：主屬/ATK 用表；HP/DEF 用階梯
  function chaosRollBundle(mode, rng){
    rng = rng || Math.random;
    var eff = {};
    var table = (mode==='std') ? CHAOS_STD_MAIN_PCT : CHAOS_ADV_MAIN_PCT;
    eff.str = rollFromPctTable(table, rng);
    eff.dex = rollFromPctTable(table, rng);
    eff.int = rollFromPctTable(table, rng);
    eff.luk = rollFromPctTable(table, rng);
    eff.atk = rollFromPctTable(table, rng);
    var allowNeg = (mode==='std');
    eff.hp  = chaosHP(allowNeg, rng);
    eff.def = chaosDEF(allowNeg, rng);
    return eff;
  }

  // 導出：主屬/ATK 每點機率表（供 UI 顯示；轉成 0..1）
  function chaosMainProb(allowNegative){
    var src = allowNegative ? CHAOS_STD_MAIN_PCT : CHAOS_ADV_MAIN_PCT;
    var keys = Object.keys(src).map(function(k){return parseInt(k,10);}).sort(function(a,b){return a-b;});
    var arr=[], i; for(i=0;i<keys.length;i++){ var v=keys[i]; arr.push({ v:v, p: (Number(src[String(v)])||0)/100 }); }
    return arr;
  }

  // ===== 判定/應用（一段式） =====
  function equipMatch(required, type){
    if (typeof required === 'string') return required === type;
    if (required && required.length){ var i; for (i=0;i<required.length;i++) if (required[i]===type) return true; }
    return false;
  }
  function canUse(node, name){
    var sd = DEF[name];
    if (!node || !sd) return { ok:false, reason:'not_found' };
    if (node.locked) return { ok:false, reason:'locked' };
    if (!equipMatch(sd.equip, node.type)) return { ok:false, reason:'wrong_type' };
    if ((node.slotsUsed|0) >= (node.slotsMax|0)) return { ok:false, reason:'no_slot' };
    return { ok:true, rate:sd.rate|0, eff:clone(sd.eff), isDynamic: !!sd.effGen };
  }

  // options: { rng:fn()->0~1 }
  function apply(node, name, options){
    var chk = canUse(node, name);
    if (!chk.ok) return { ok:false, usedSlot:false, success:false, reason:chk.reason };
    options = options||{};
    var rng = (typeof options.rng === 'function') ? options.rng : Math.random;

    var success = rng() < ((chk.rate|0)/100);
    var next = clone(node||{});
    next.slotsUsed = (next.slotsUsed|0) + 1; // 失敗也扣次
    var effApplied = null;

    if (success){
      var eff = chk.isDynamic ? (DEF[name].effGen(next, rng)||{}) : (chk.eff||{});
      effApplied = clone(eff);
      var k; next.enhance = next.enhance||{};
      for (k in eff) if (eff.hasOwnProperty(k)) next.enhance[k] = (nz(next.enhance[k]) + (eff[k]|0));
      next.enhanceSuccess = (next.enhanceSuccess|0) + 1;
    }
    return { ok:true, usedSlot:true, success:success, nextNode:next, rate:chk.rate, effApplied:effApplied };
  }

  // ===== 二段式（混沌選擇券用） =====
  function chaosPreview(node, name, options){
    var chk = canUse(node, name);
    if (!chk.ok) return { ok:false, can:false, reason:chk.reason, rate:0, success:false };
    if (!DEF[name] || !DEF[name].effGen) return { ok:false, can:false, reason:'not_chaos', rate:chk.rate, success:false };
    options = options||{};
    var rng = (typeof options.rng === 'function') ? options.rng : Math.random;
    var success = (rng() < ((chk.rate|0)/100));
    var effPreview = success ? (DEF[name].effGen(node, rng)||{}) : null;
    return { ok:true, can:true, rate:chk.rate, success:success, effPreview:effPreview };
  }
  function chaosCommit(node, name, effPreview, applyIt){
    var next = clone(node||{});
    if (applyIt){
      next.slotsUsed = (next.slotsUsed|0) + 1;
      var k; next.enhance = next.enhance||{};
      for (k in effPreview) if (effPreview.hasOwnProperty(k)) next.enhance[k] = (nz(next.enhance[k]) + (effPreview[k]|0));
      next.enhanceSuccess = (next.enhanceSuccess|0) + 1;
    }
    return { ok:true, nextNode:next };
  }

  // ===== 其他工具 =====
  function recoverFailedOnce(node, options){
    var n=clone(node||{}), slotsUsed=n.slotsUsed|0, succ=n.enhanceSuccess|0, failed=Math.max(0, slotsUsed - succ);
    if (n.locked) return { ok:false, success:false, reason:'locked' };
    if (failed<=0) return { ok:false, success:false, reason:'no_failed_slots' };
    options=options||{};
    var rng=(typeof options.rng==='function')?options.rng:Math.random;
    var success=(rng()<0.5);
    if (success){ n.slotsUsed=Math.max(succ, slotsUsed-1); return { ok:true, success:true, nextNode:n }; }
    return { ok:true, success:false, nextNode:n };
  }
  function perfectReset(node){
    var n=clone(node||{});
    n.enhance={str:0,dex:0,int:0,luk:0,atk:0,def:0,hp:0};
    n.slotsUsed=0; n.enhanceSuccess=0; n.star=0;
    if (n._pendingStar!=null) delete n._pendingStar;
    return { ok:true, success:true, nextNode:n };
  }

  // ===== ★卷軸上限提升（最多 +10 格）=====
  var SLOT_AUGMENT_MAX   = 10;
  // 0~1 機率：100%, 70%, 40%, 25%, 20%, 15%, 10%, 8%, 5%, 1%
  var SLOT_AUGMENT_STEPS = [1.00,0.70,0.40,0.25,0.10,0.05,0.04,0.02,0.01,0.005];

  function isScrollableType(t){
    for (var i=0;i<EQUIP_SCROLLABLE.length;i++){ if (EQUIP_SCROLLABLE[i]===t) return true; }
    return false;
  }

  function canAugmentSlots(node){
    if (!node) return { ok:false, reason:'no_node' };
    if (node.locked) return { ok:false, reason:'locked' };
    if (!isScrollableType(node.type)) return { ok:false, reason:'not_scrollable' };
    var succ = (node._slotAugSuccess|0);
    if (succ >= SLOT_AUGMENT_MAX) return { ok:false, reason:'cap' };
    var step = succ; // 0-based
    var chance = SLOT_AUGMENT_STEPS[step]||0;
    return { ok:true, chance: chance, step: step+1, left: (SLOT_AUGMENT_MAX - succ) };
  }

  // options: { rng:fn()->0~1 }
  function augmentSlots(node, options){
    var chk = canAugmentSlots(node);
    if (!chk.ok) return { ok:false, success:false, reason:chk.reason };
    options = options||{};
    var rng = (typeof options.rng === 'function') ? options.rng : Math.random;

    var pass = rng() < (chk.chance);
    var next = clone(node||{});
    if (pass){
      next.slotsMax = (next.slotsMax|0) + 1;                 // 上限 +1
      next._slotAugSuccess = (next._slotAugSuccess|0) + 1;   // 成功次數 +1
    }
    return { ok:true, success:pass, chance:chk.chance, step:chk.step, nextNode:next };
  }

  // ===== 對外 =====
  return {
    def: DEF,
    canUse: canUse,
    apply: apply,
    recoverFailedOnce: recoverFailedOnce,
    perfectReset: perfectReset,
    chaosMainProb: chaosMainProb,
    chaosPreview: chaosPreview,
    chaosCommit: chaosCommit,

    // ★卷軸上限提升
    canAugmentSlots: canAugmentSlots,
    augmentSlots: augmentSlots,

    // ★機率查詢／覆寫
    augmentMax: SLOT_AUGMENT_MAX,
    augmentSteps: SLOT_AUGMENT_STEPS.slice(), // 0~1
    getAugmentChances: function(){
      var out=[], i, x;
      for(i=0;i<SLOT_AUGMENT_STEPS.length;i++){
        x=SLOT_AUGMENT_STEPS[i];
        out.push(Math.round((x*100)*100)/100); // 轉百分比、保留兩位
      }
      return out;
    },
    setAugmentChances: function(arr){
      if (Array.isArray(arr) && arr.length){
        SLOT_AUGMENT_STEPS = arr.slice();
      }
    }
  };
});