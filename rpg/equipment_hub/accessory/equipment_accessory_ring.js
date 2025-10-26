// =======================
// equipment_accessory_ring.js — 多戒指（獨立強化/星力/突破）＋混合強化規則
// 對 player.js 鍵名：atk/def/hp/mp（整數），attackSpeedPct/expBonus/dropBonus/goldBonus（小數）
// 星力倍率封頂 50%（每戒指獨立）
// =======================
(function(w){
  "use strict";
  if (!w.EquipHub || typeof w.EquipHub.registerTab !== "function") return;

  /* =========================
     先宣告「戒指定義與清單」
     （避免存檔初始化時找不到 ACCESSORY_LIST）
  ========================= */
  var ACCESSORIES = {
    ringSpeed: {
      id: "ringSpeed",
      name: "速度戒指",
      base: { attackSpeedPct: 0.10 } // +10% 攻速
    },
    ringLife: {
      id: "ringLife",
      name: "生命戒指",
      base: { hp: 50, mp: 5 } // +HP50 +MP5
    },
    ringBrute: {
      id: "ringBrute",
      name: "暴力戒指",
      base: { atk: 5, def: 2 } // +ATK5 +DEF2
    },
    ringTreasure: {
      id: "ringTreasure",
      name: "財寶戒指",
      base: { goldBonus: 0.10, dropBonus: 0.05, expBonus: 0.03 } // 金幣10% 掉寶5% 經驗3%
    }
  };
  var ACCESSORY_LIST = [
    ACCESSORIES.ringSpeed,
    ACCESSORIES.ringLife,
    ACCESSORIES.ringBrute,
    ACCESSORIES.ringTreasure
  ];

  // 上限常數
  var DEFAULT_CAP = { enh: 15, star: 15 };

  /* =========================
     強化/星力/突破與規則（原樣）
  ========================= */
  var ENH = {
    baseSuccess: 0.20,       // 20%
    failBonus:   0.03,       // 失敗 +3%
    maxSuccess:  0.50,       // 上限 50%
    baseCost:    5,
    costFn: function(lv){ return ENH.baseCost + Math.max(0, lv); },
    itemName: "飾品強化石"
  };

  // ★混合強化規則：flat 走平坦、percent 走百分比
  var ENH_RULES = {
    // 每級 + 固定數字
    flatPerLv: { hp: 30, mp: 1, atk: 6, def: 2 },
    // 每級 + 百分比（0.01 = 1%）
    pctPerLv:  { attackSpeedPct: 0.005, expBonus: 0.02, dropBonus: 0.03, goldBonus: 0.04 }
  };

  var STAR = {
    baseSuccess: 0.20,       // 20%
    failBonus:   0.02,       // 失敗 +2%（無上限）
    capTotal:    0.50,       // 星力倍率封頂 50%
    perStarStepFn: function(starLv){
      var total = 0;
      for (var i=1;i<=starLv;i++){
        total += 0.02 * (2 + Math.floor((i-1)/5)); // 1~5:1% / 6~10:2% / 11~15:3% …
      }
      return total > STAR.capTotal ? STAR.capTotal : total;
    },
    baseCost: 5,
    costFn: function(starLv){ return STAR.baseCost + Math.floor(starLv * 1.5); },
    itemName: "飾品星力強化石"
  };

  var BREAK = {
    success: 0.10,               // 固定 10%
    baseCost: 5,
    costFn: function(bCount){ return BREAK.baseCost + bCount * 2; },
    capStep: 5,                  // 成功一次，上限 +5
    itemName: "飾品突破石"
  };

  /* =========================
     存檔：SaveHub 優先；無則 localStorage
     （舊鍵：ACC_MULTI_RING_INDEPENDENT_V1）
  ========================= */
  var SAVEHUB = w.SaveHub || null;
  var NS = "accessory_ring_v1";
  var OLD_LS_KEY = "ACC_MULTI_RING_INDEPENDENT_V1";

  function toInt(n){ n = Number(n); return isFinite(n)? Math.floor(n) : 0; }
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function fmtPct(n){ return (Number(n||0)*100).toFixed(2) + "%"; }

  function freshRingState(){
    return {
      enhLv: 0, starLv: 0, enhPity: 0, starPity: 0, breakCount: 0,
      capEnh: DEFAULT_CAP.enh, capStar: DEFAULT_CAP.star
    };
  }
  function freshState(){
    var obj = { rings:{} };
    for (var i=0;i<ACCESSORY_LIST.length;i++){
      obj.rings[ACCESSORY_LIST[i].id] = freshRingState();
    }
    return obj;
  }
  function normalizeState(s){
    s = (s && typeof s==="object") ? s : freshState();
    s.rings = s.rings || {};
    for (var i=0;i<ACCESSORY_LIST.length;i++){
      var id = ACCESSORY_LIST[i].id;
      var r = s.rings[id] || {};
      r.enhLv      = toInt(r.enhLv||0);
      r.starLv     = toInt(r.starLv||0);
      r.enhPity    = toInt(r.enhPity||0);
      r.starPity   = toInt(r.starPity||0);
      r.breakCount = toInt(r.breakCount||0);
      r.capEnh     = Math.max(DEFAULT_CAP.enh, toInt(r.capEnh||DEFAULT_CAP.enh));
      r.capStar    = Math.max(DEFAULT_CAP.star, toInt(r.capStar||DEFAULT_CAP.star));
      s.rings[id]  = r;
    }
    return s;
  }

  (function registerSaveHubNS(){
    if (!SAVEHUB) return;
    try{
      var schema = { version:1, migrate:function(old){ return normalizeState(old||{}); } };
      if (typeof SAVEHUB.registerNamespaces === "function"){
        var pack = {}; pack[NS] = schema; SAVEHUB.registerNamespaces(pack);
      } else if (typeof SAVEHUB.registerNamespace === "function"){
        SAVEHUB.registerNamespace(NS, schema);
      }
    }catch(e){ console && console.warn && console.warn("[accessory] SaveHub register failed", e); }
  })();

  function shGet(def){
    if (!SAVEHUB) return def;
    try{
      if (typeof SAVEHUB.get === "function")   return SAVEHUB.get(NS, def);
      if (typeof SAVEHUB.read === "function")  return SAVEHUB.read(NS, def);
    }catch(e){ console && console.warn && console.warn("[accessory] SaveHub read failed", e); }
    return def;
  }
  function shSet(val){
    if (!SAVEHUB) return;
    try{
      if (typeof SAVEHUB.set === "function")   { SAVEHUB.set(NS, val); return; }
      if (typeof SAVEHUB.write === "function") { SAVEHUB.write(NS, val); return; }
    }catch(e){ console && console.warn && console.warn("[accessory] SaveHub write failed", e); }
  }
  function lsRead(){ try{ var raw = localStorage.getItem(OLD_LS_KEY); return raw ? JSON.parse(raw) : null; }catch(_){ return null; } }
  function lsWrite(s){ try{ localStorage.setItem(OLD_LS_KEY, JSON.stringify(s)); }catch(_){} }
  function lsRemove(){ try{ localStorage.removeItem(OLD_LS_KEY); }catch(_){} }

  // 載入：SaveHub 優先；若無 → 遷移 localStorage 舊檔 → fresh
  var state = (function load(){
    var s = shGet(null);
    if (!s){
      var old = lsRead();
      if (old){
        s = normalizeState(old);
        shSet(s);
        lsRemove();
      }
    }
    return normalizeState(s || freshState());
  })();

  // 統一 save()
  function save(){ if (SAVEHUB) shSet(state); else lsWrite(state); }

  // 對 save_core 友善
  w.Accessory_exportState = function(){ return JSON.parse(JSON.stringify(state)); };
  w.Accessory_applyState = function(s){
    if (!s || typeof s!=="object") return;
    state = normalizeState(s);
    save();
    applyBonusToPlayer(); w.EquipHub?.requestRerender?.();
  };

  /* =========================
     背包互動
  ========================= */
  function getItemQty(name){
    try{
      if (typeof w.getItemQuantity==="function") return toInt(w.getItemQuantity(name));
      if (w.inventory) return toInt(w.inventory[name]||0);
    }catch(_){}
    return 0;
  }
  function removeItem(name, qty){
    qty = toInt(qty||0); if (qty<=0) return true;
    try{
      if (typeof w.removeItem==="function"){ w.removeItem(name, qty); return true; }
      w.inventory = w.inventory || {};
      if ((w.inventory[name]||0) < qty) return false;
      w.inventory[name] -= qty; if (w.inventory[name] < 0) w.inventory[name] = 0;
      try{ w.saveGame?.(); }catch(_){}
      return true;
    }catch(_){ return false; }
  }
  function tryPay(itemName, need){
    var have = getItemQty(itemName);
    return (have >= need) && removeItem(itemName, need);
  }
  function roll(p){ p=Number(p)||0; if(p<0)p=0; if(p>1)p=1; return Math.random()<p; }

  /* =========================
     計算（每顆戒指各自）
  ========================= */
  function starRateFor(rState){ return STAR.perStarStepFn(rState.starLv); }

  function scaleByRules(base, rState){
    var lv   = rState.enhLv;
    var sMul = 1 + starRateFor(rState);

    var out = {};
    // flat：基礎 + 每級平坦，再乘星力倍率
    if (base.atk != null){
      var v = base.atk + (ENH_RULES.flatPerLv.atk||0) * lv;
      out.atk = Math.round(v * sMul);
    }
    if (base.def != null){
      var v = base.def + (ENH_RULES.flatPerLv.def||0) * lv;
      out.def = Math.round(v * sMul);
    }
    if (base.hp != null){
      var v = base.hp + (ENH_RULES.flatPerLv.hp||0) * lv;
      out.hp = Math.round(v * sMul);
    }
    if (base.mp != null){
      var v = base.mp + (ENH_RULES.flatPerLv.mp||0) * lv;
      out.mp = Math.round(v * sMul);
    }

    // percent：基礎 × (1 + 每級百分比) 再乘星力倍率
    if (base.attackSpeedPct != null){
      var v = base.attackSpeedPct * (1 + (ENH_RULES.pctPerLv.attackSpeedPct||0) * lv);
      out.attackSpeedPct = v * sMul;
    }
    if (base.expBonus != null){
      var v = base.expBonus * (1 + (ENH_RULES.pctPerLv.expBonus||0) * lv);
      out.expBonus = v * sMul;
    }
    if (base.dropBonus != null){
      var v = base.dropBonus * (1 + (ENH_RULES.pctPerLv.dropBonus||0) * lv);
      out.dropBonus = v * sMul;
    }
    if (base.goldBonus != null){
      var v = base.goldBonus * (1 + (ENH_RULES.pctPerLv.goldBonus||0) * lv);
      out.goldBonus = v * sMul;
    }
    return out;
  }

  function combineAllBonuses(){
    var sum = { atk:0, def:0, hp:0, mp:0, attackSpeedPct:0, expBonus:0, dropBonus:0, goldBonus:0 };
    for (var i=0;i<ACCESSORY_LIST.length;i++){
      var cfg = ACCESSORY_LIST[i];
      var r   = state.rings[cfg.id];
      var b   = scaleByRules(cfg.base, r);
      if (b.atk != null)            sum.atk += b.atk;
      if (b.def != null)            sum.def += b.def;
      if (b.hp  != null)            sum.hp  += b.hp;
      if (b.mp  != null)            sum.mp  += b.mp;
      if (b.attackSpeedPct != null) sum.attackSpeedPct += b.attackSpeedPct;
      if (b.expBonus != null)       sum.expBonus += b.expBonus;
      if (b.dropBonus != null)      sum.dropBonus += b.dropBonus;
      if (b.goldBonus != null)      sum.goldBonus += b.goldBonus;
    }
    return sum;
  }

  /* =========================
     寫入 player（鍵名對齊 coreBonus）
  ========================= */
  function applyBonusToPlayer(){
    if (!w.player || !w.player.coreBonus || !w.player.coreBonus.bonusData) return;
    var final = combineAllBonuses();
    w.player.coreBonus.bonusData.accessory = {
      atk: Number(final.atk||0),
      def: Number(final.def||0),
      hp: Number(final.hp||0),
      mp: Number(final.mp||0),
      attackSpeedPct: Number(final.attackSpeedPct||0),
      expBonus: Number(final.expBonus||0),
      dropBonus: Number(final.dropBonus||0),
      goldBonus: Number(final.goldBonus||0)
    };
    try{ w.recomputeTotalStats?.(); w.updateAllUI?.(); }catch(_){}
  }

  /* =========================
     操作（每顆戒指獨立）
  ========================= */
  function doEnhance(id){
    var r = state.rings[id];
    if (r.enhLv >= r.capEnh) return { ok:false, reason:"cap" };
    var cost = ENH.costFn(r.enhLv);
    if (!tryPay(ENH.itemName, cost)) return { ok:false, reason:"cost", need:cost, item:ENH.itemName };

    var suc = clamp(ENH.baseSuccess + r.enhPity*ENH.failBonus, 0, ENH.maxSuccess);
    if (roll(suc)){ r.enhLv+=1; r.enhPity=0; save(); applyBonusToPlayer(); return { ok:true, success:true, lv:r.enhLv, chance:suc }; }
    r.enhPity+=1; save(); return { ok:true, success:false, lv:r.enhLv, chance:suc };
  }
  function doStar(id){
    var r = state.rings[id];
    if (r.starLv >= r.capStar) return { ok:false, reason:"cap" };
    var cost = STAR.costFn(r.starLv);
    if (!tryPay(STAR.itemName, cost)) return { ok:false, reason:"cost", need:cost, item:STAR.itemName };

    var suc = STAR.baseSuccess + r.starPity*STAR.failBonus; // 無上限
    if (roll(suc)){ r.starLv+=1; r.starPity=0; save(); applyBonusToPlayer(); return { ok:true, success:true, lv:r.starLv, chance:suc }; }
    r.starPity+=1; save(); return { ok:true, success:false, lv:r.starLv, chance:suc };
  }
  function doBreak(id){
    var r = state.rings[id];
    var cost = BREAK.costFn(r.breakCount);
    if (!tryPay(BREAK.itemName, cost)) return { ok:false, reason:"cost", need:cost, item:BREAK.itemName };
    if (roll(BREAK.success)){
      r.breakCount+=1; r.capEnh+=BREAK.capStep; r.capStar+=BREAK.capStep;
      save(); return { ok:true, success:true, breakCount:r.breakCount, capEnh:r.capEnh, capStar:r.capStar };
    }
    save(); return { ok:true, success:false };
  }

  /* =========================
     UI
  ========================= */
  function cardHtml(cfg){
    var r   = state.rings[cfg.id];
    var fin = scaleByRules(cfg.base, r);

    var enhChance  = clamp(ENH.baseSuccess + r.enhPity*ENH.failBonus, 0, ENH.maxSuccess);
    var starChance = STAR.baseSuccess + r.starPity*STAR.failBonus;

    var enhCost = ENH.costFn(r.enhLv);
    var starCost= STAR.costFn(r.starLv);
    var brkCost = BREAK.costFn(r.breakCount);

    function lines(){
      var arr=[];
      if (cfg.base.attackSpeedPct != null) arr.push('攻擊速度：<b>'+fmtPct(fin.attackSpeedPct)+'</b>（基礎 '+fmtPct(cfg.base.attackSpeedPct)+'）');
      if (cfg.base.hp  != null)            arr.push('生命：<b>'+fmt(fin.hp)+'</b>（基礎 '+fmt(cfg.base.hp)+'）');
      if (cfg.base.mp  != null)            arr.push('魔力：<b>'+fmt(fin.mp)+'</b>（基礎 '+fmt(cfg.base.mp)+'）');
      if (cfg.base.atk != null)            arr.push('攻擊力：<b>'+fmt(fin.atk)+'</b>（基礎 '+fmt(cfg.base.atk)+'）');
      if (cfg.base.def != null)            arr.push('防禦力：<b>'+fmt(fin.def)+'</b>（基礎 '+fmt(cfg.base.def)+'）');
      if (cfg.base.expBonus != null)       arr.push('經驗值：<b>'+fmtPct(fin.expBonus)+'</b>（基礎 '+fmtPct(cfg.base.expBonus)+'）');
      if (cfg.base.dropBonus != null)      arr.push('掉寶率：<b>'+fmtPct(fin.dropBonus)+'</b>（基礎 '+fmtPct(cfg.base.dropBonus)+'）');
      if (cfg.base.goldBonus != null)      arr.push('金幣加成：<b>'+fmtPct(fin.goldBonus)+'</b>（基礎 '+fmtPct(cfg.base.goldBonus)+'）');
      return arr.join('<br>');
    }

    return ''+
    '<div style="border:1px solid #253041;border-radius:12px;padding:12px;display:grid;gap:8px">'+
      '<div style="font-weight:800">'+cfg.name+'</div>'+
      '<div style="opacity:.9">'+lines()+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px">'+
        // 強化
        '<div style="border:1px solid #2b3647;border-radius:10px;padding:8px">'+
          '<div style="font-weight:700">🔨 強化</div>'+
          '<div>等級：<b>+'+r.enhLv+'</b> / '+r.capEnh+'</div>'+
          '<div>成功率：<b>'+fmtPct(enhChance)+'</b>（失敗 +'+fmtPct(ENH.failBonus)+'，上限 '+fmtPct(ENH.maxSuccess)+'）</div>'+
          '<div>消耗：<b>'+ENH.itemName+' ×'+fmt(enhCost)+'</b></div>'+
          '<div style="margin-top:6px"><button data-act="enh" data-id="'+cfg.id+'" style="padding:6px 10px;border-radius:8px;border:none;background:#10b981;color:#0b1220;cursor:pointer" '+(r.enhLv>=r.capEnh?'disabled':'')+'>強化</button></div>'+
        '</div>'+
        // 星力
        '<div style="border:1px solid #2b3647;border-radius:10px;padding:8px">'+
          '<div style="font-weight:700">🌟 星力</div>'+
          '<div>等級：<b>★'+r.starLv+'</b> / '+r.capStar+'</div>'+
          '<div>成功率：<b>'+fmtPct(starChance)+'</b>（失敗 +'+fmtPct(STAR.failBonus)+'）</div>'+
          '<div>消耗：<b>'+STAR.itemName+' ×'+fmt(starCost)+'</b></div>'+
          '<div style="margin-top:6px"><button data-act="star" data-id="'+cfg.id+'" style="padding:6px 10px;border-radius:8px;border:none;background:#60a5fa;color:#0b1220;cursor:pointer" '+(r.starLv>=r.capStar?'disabled':'')+'>升星</button></div>'+
        '</div>'+
        // 突破
        '<div style="border:1px solid #2b3647;border-radius:10px;padding:8px">'+
          '<div style="font-weight:700">💥 突破</div>'+
          '<div>成功率：<b>'+fmtPct(BREAK.success)+'</b>（成功上限 +'+BREAK.capStep+'）</div>'+
          '<div>消耗：<b>'+BREAK.itemName+' ×'+fmt(brkCost)+'</b></div>'+
          '<div style="margin-top:6px"><button data-act="break" data-id="'+cfg.id+'" style="padding:6px 10px;border-radius:8px;border:none;background:#fbbf24;color:#0b1220;cursor:pointer">突破</button></div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }

  function render(container){
    var total = combineAllBonuses();
    var cards = [];
    for (var i=0;i<ACCESSORY_LIST.length;i++) cards.push(cardHtml(ACCESSORY_LIST[i]));

    container.innerHTML =
      '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:12px;display:grid;gap:12px">'+
        '<div style="font-weight:800">💍 飾品（獨立強化 / 獨立星力 / 突破）</div>'+
        '<div style="padding:8px;border:1px dashed #1f2937;border-radius:10px">'+
          '<div style="font-weight:700">🧮 全部戒指加總效果</div>'+
          '<div style="margin-top:6px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">'+
            '<div>攻擊力：<b>'+fmt(total.atk)+'</b></div>'+
            '<div>防禦力：<b>'+fmt(total.def)+'</b></div>'+
            '<div>生命：<b>'+fmt(total.hp)+'</b></div>'+
            '<div>魔力：<b>'+fmt(total.mp)+'</b></div>'+
            '<div>攻擊速度：<b>'+fmtPct(total.attackSpeedPct)+'</b></div>'+
            '<div>經驗加成：<b>'+fmtPct(total.expBonus)+'</b></div>'+
            '<div>掉寶加成：<b>'+fmtPct(total.dropBonus)+'</b></div>'+
            '<div>金幣加成：<b>'+fmtPct(total.goldBonus)+'</b></div>'+
          '</div>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:1fr;gap:12px">'+
          cards.join('')+
        '</div>'+
      '</div>';

    // 事件委派
    container.querySelectorAll('button[data-act]').forEach(function(btn){
      btn.onclick = function(){
        var act = btn.getAttribute('data-act');
        var id  = btn.getAttribute('data-id');
        var r;
        if (act==='enh'){
          r = doEnhance(id);
          alert(!r.ok? (r.reason==='cap'?'已達強化上限': r.reason==='cost'?'材料不足：需要 '+r.need+' × '+r.item:'操作失敗')
                     : (r.success?'強化成功！（等級 +'+r.lv+'）':'強化失敗（成功率 '+(r.chance*100).toFixed(2)+'%）'));
        }else if (act==='star'){
          r = doStar(id);
          alert(!r.ok? (r.reason==='cap'?'已達星力上限': r.reason==='cost'?'材料不足：需要 '+r.need+' × '+r.item:'操作失敗')
                     : (r.success?'升星成功！（★'+r.lv+'）':'升星失敗（成功率 '+(r.chance*100).toFixed(2)+'%）'));
        }else if (act==='break'){
          r = doBreak(id);
          alert(!r.ok? (r.reason==='cost'?'材料不足：需要 '+r.need+' × '+r.item:'操作失敗')
                     : (r.success?'突破成功！上限提升（強化 '+state.rings[id].capEnh+'，星力 '+state.rings[id].capStar+'）':'突破失敗'));
        }
        w.EquipHub.requestRerender();
        applyBonusToPlayer();
      };
    });
  }

  // 註冊分頁
  w.EquipHub.registerTab({
    id: "accessory",
    title: "飾品",
    render: render,
    tick: function(){},
    onOpen: function(){ applyBonusToPlayer(); }
  });

  // 初次套用（避免載入順序踩空）
  (function ensurePlayerReady(){
    var tries = 0, t = setInterval(function(){
      if (w.player && w.player.coreBonus && w.player.coreBonus.bonusData){
        clearInterval(t);
        applyBonusToPlayer();
      } else if (++tries > 200){ clearInterval(t); }
    }, 50);
  })();

})(window);