/*!
 * PotentialCoreV21.js — 潛能 2.1（含 SLR 擴充）
 * UMD / ES5
 *
 * 升階鏈（一般 / 高級）：
 * R  → SR   10%   / 20%
 * SR → SSR   5%   / 10%
 * SSR→ UR    2%   /  4%
 * UR → LR   0.5%  / 1.0%
 * LR → SLR  0.05% / 0.10%
 *
 * 一次抽三條：
 *  - 第1條：固定 = 本次 Session 等級
 *  - 第2/3條：依「依此類推分配」
 *      session=R   → 100% R
 *      session=SR  → 98% R   | 2%  SR
 *      session=SSR → 98% SR  | 2%  SSR
 *      session=UR  → 98% SSR | 2%  UR
 *      session=LR  → 98% UR  | 2%  LR
 *  - 特例 session=SLR：
 *      第1條 = SLR、 第2條 = SLR、 第3條：LR 97% | SLR 3%
 *
 * 詞條池以 R 為基準，依階級倍率套用：
 *   SR×2、SSR×3、UR×4、LR×6、SLR×9
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.PotentialCoreV21 = factory(); }
})(this, function () {
  'use strict';

  // ===== 小工具 =====
  function clone(o){ try{return JSON.parse(JSON.stringify(o||{}));}catch(_){return {}; } }
  function pickWeighted(items, rng){
    rng = (typeof rng==='function') ? rng : Math.random;
    var i, sum=0; for(i=0;i<items.length;i++) sum += (items[i].w||0);
    if (sum<=0) return items[0].v;
    var r = rng()*sum, acc=0;
    for(i=0;i<items.length;i++){ acc += (items[i].w||0); if (r <= acc) return items[i].v; }
    return items[items.length-1].v;
  }
  function clamp01(x){ return x<0?0:(x>1?1:x); }

  // ===== 組態 =====
  var config = {
    // 升階鏈（一般 / 高級）
    chain: {
      base: { r2sr:0.10, sr2ssr:0.05, ssr2ur:0.02,  ur2lr:0.005,  lr2slr:0.0005 },
      plus: { r2sr:clamp01(0.10*2), sr2ssr:clamp01(0.05*2), ssr2ur:clamp01(0.02*2),
              ur2lr:clamp01(0.005*2), lr2slr:clamp01(0.0005*2) }
    },
    // 階級倍率
    mult: { R:1, SR:2, SSR:3, UR:4, LR:6, SLR:9 },

    // R 階詞條池（比例總和 100）
    // type: 'flat'|'pct'|'allpct'
    effectsR: [
      // 平坦
      { id:'atk_flat_10', label:'攻擊力', type:'flat', unit:'flat', val:10,  prob:10 },
      { id:'def_flat_10', label:'防禦力', type:'flat', unit:'flat', val:10,  prob:11 },
      { id:'hp_flat_300', label:'HP',     type:'flat', unit:'flat', val:300, prob:13 },
      // 百分比 / 屬性
      { id:'hp_pct_5',   label:'HP%',  type:'pct',  unit:'pct',  val:5,   prob:9  },
      { id:'str_flat_5', label:'STR',  type:'flat', unit:'flat', val:5,   prob:9  },
      { id:'dex_flat_5', label:'DEX',  type:'flat', unit:'flat', val:5,   prob:9  },
      { id:'int_flat_5', label:'INT',  type:'flat', unit:'flat', val:5,   prob:9  },
      { id:'luk_flat_5', label:'LUK',  type:'flat', unit:'flat', val:5,   prob:9  },
      { id:'str_pct_2',  label:'STR%', type:'pct',  unit:'pct',  val:2,   prob:4  },
      { id:'dex_pct_2',  label:'DEX%', type:'pct',  unit:'pct',  val:2,   prob:4  },
      { id:'int_pct_2',  label:'INT%', type:'pct',  unit:'pct',  val:2,   prob:4  },
      { id:'luk_pct_2',  label:'LUK%', type:'pct',  unit:'pct',  val:2,   prob:4  },
      { id:'atk_pct_3',  label:'ATK%', type:'pct',  unit:'pct',  val:3,   prob:3  },
      { id:'all_pct_3',  label:'全屬%', type:'allpct',unit:'pct', val:3,   prob:2  }
    ]
  };

  // 第2/3條對應 session 的分配（依「依此類推」）
  function distForSessionTier(session){
    if (session==='R')    return [{v:'R',   w:100}];
    if (session==='SR')   return [{v:'R',   w:98}, {v:'SR',   w:2}];
    if (session==='SSR')  return [{v:'SR',  w:98}, {v:'SSR',  w:2}];
    if (session==='UR')   return [{v:'SSR', w:98}, {v:'UR',   w:2}];
    if (session==='LR')   return [{v:'UR',  w:98}, {v:'LR',   w:2}];
    // SLR 的一般規則不使用（因為有專屬特例在 rollThreeFixedSession）
    if (session==='SLR')  return [{v:'LR',  w:97}, {v:'SLR',  w:3}];
    return [{v:'R',w:100}];
  }

  // 單次升階檢定（只往上）
  function promoteOnce(currentTier, cubeType, rng){
    rng = (typeof rng==='function') ? rng : Math.random;
    var ch = (cubeType==='cube_plus') ? config.chain.plus : config.chain.base;
    if (currentTier==='R'    && rng()<ch.r2sr)   return 'SR';
    if (currentTier==='SR'   && rng()<ch.sr2ssr) return 'SSR';
    if (currentTier==='SSR'  && rng()<ch.ssr2ur) return 'UR';
    if (currentTier==='UR'   && rng()<ch.ur2lr)  return 'LR';
    if (currentTier==='LR'   && rng()<ch.lr2slr) return 'SLR';
    return currentTier;
  }

  // 從 R 池抽一條
  function pickEffectR(rng){
    rng = (typeof rng==='function') ? rng : Math.random;
    var arr=config.effectsR.map(function(e){ return {v:e, w:e.prob}; });
    return pickWeighted(arr, rng);
  }

  // 依固定的 sessionTier 一次產生三條
  function rollThreeFixedSession(sessionTier, rng){
    rng = (typeof rng==='function') ? rng : Math.random;

    // SLR 特例：1、2 保底 SLR；第 3 條 LR97% / SLR3%
    if (sessionTier === 'SLR'){
      var lines = [];
      for (var i=0; i<3; i++){
        var tier = (i<2) ? 'SLR' : pickWeighted([{v:'LR',w:97},{v:'SLR',w:3}], rng);
        var e = pickEffectR(rng);
        var m = config.mult[tier]||1;
        lines.push({ tier:tier, id:e.id, label:e.label, type:e.type, unit:e.unit, baseVal:e.val, mult:m, value:e.val*m });
      }
      return lines;
    }

    // 其它階級：第1條固定 session 等級；第2/3 條依「依此類推」
    var out=[], i;
    for(i=0;i<3;i++){
      var tier = (i===0) ? sessionTier : pickWeighted(distForSessionTier(sessionTier), rng);
      var e = pickEffectR(rng);
      var m = config.mult[tier]||1;
      out.push({ tier:tier, id:e.id, label:e.label, type:e.type, unit:e.unit, baseVal:e.val, mult:m, value:e.val*m });
    }
    return out;
  }

  // 從「目前等級」出發（只升不降），回傳本次等級+三條
  function rollThreeSessionFrom(currentTier, cubeType, rng){
    var next = promoteOnce(currentTier||'R', cubeType||'cube', rng);
    return { sessionTier: next, lines: rollThreeFixedSession(next, rng) };
  }

  // 合併三條到總加成
  function linesToBonus(lines){
    var sum = {
      str:0,dex:0,int:0,luk:0,atk:0,def:0,hp:0,
      strPct:0,dexPct:0,intPct:0,lukPct:0, atkPct:0, hpPct:0, allStatPct:0
    };
    var i, ln;
    for(i=0;i<(lines||[]).length;i++){
      ln = lines[i];
      if (ln.type==='flat'){
        if (ln.id.indexOf('str')===0) sum.str += ln.value;
        else if (ln.id.indexOf('dex')===0) sum.dex += ln.value;
        else if (ln.id.indexOf('int')===0) sum.int += ln.value;
        else if (ln.id.indexOf('luk')===0) sum.luk += ln.value;
        else if (ln.id.indexOf('atk')===0) sum.atk += ln.value;
        else if (ln.id.indexOf('def')===0) sum.def += ln.value;
        else if (ln.id.indexOf('hp')===0)  sum.hp  += ln.value;
      } else if (ln.type==='pct'){
        if (ln.id.indexOf('str')===0) sum.strPct += ln.value;
        else if (ln.id.indexOf('dex')===0) sum.dexPct += ln.value;
        else if (ln.id.indexOf('int')===0) sum.intPct += ln.value;
        else if (ln.id.indexOf('luk')===0) sum.lukPct += ln.value;
        else if (ln.id.indexOf('atk')===0) sum.atkPct += ln.value;
        else if (ln.id.indexOf('hp')===0)  sum.hpPct  += ln.value;
      } else if (ln.type==='allpct'){
        sum.allStatPct += ln.value;
      }
    }
    return sum;
  }

  // 行描述（UI用）
  function describeLine(ln){
    var unit = (ln.unit==='pct'||ln.unit==='allpct') ? '%' : '';
    return '['+ln.tier+'] '+ln.label+' +'+ln.value+unit;
  }

  // 參考（從 R 起算一次的 Session 機率）
  function sessionTierProbs(cubeType){
    var ch = (cubeType==='cube_plus') ? config.chain.plus : config.chain.base;
    return { SLR:0, LR:0, UR:0, SSR:0, SR:(ch.r2sr*100), R:((1-ch.r2sr)*100) };
  }

  // ===== UI 查詢工具 =====
  function upgradeChanceFrom(tier, cubeType){
    var ch = (cubeType==='cube_plus') ? config.chain.plus : config.chain.base;
    if (tier==='R')    return ch.r2sr;
    if (tier==='SR')   return ch.sr2ssr;
    if (tier==='SSR')  return ch.ssr2ur;
    if (tier==='UR')   return ch.ur2lr;
    if (tier==='LR')   return ch.lr2slr;
    // SLR 為天花板
    return 0;
  }

  function effectTableForSession(tier){
    var mult = config.mult[tier] || 1;
    return config.effectsR.map(function(e){
      return {
        id: e.id,
        label: e.label,
        value: e.val * mult,
        unit: (e.unit==='pct'||e.unit==='allpct') ? '%' : '',
        prob: e.prob
      };
    });
  }

  return {
    config: config,
    promoteOnce: promoteOnce,
    rollThreeFixedSession: rollThreeFixedSession,
    rollThreeSessionFrom: rollThreeSessionFrom,
    linesToBonus: linesToBonus,
    describeLine: describeLine,
    sessionTierProbs: sessionTierProbs,
    upgradeChanceFrom: upgradeChanceFrom,
    effectTableForSession: effectTableForSession
  };
});