// ==========================
// Recovery Items Tab — 藥水分頁（V5，獨立存檔版）
// - 存檔：localStorage（不依賴 player.settings / player.cooldowns）
// - 功能：自動補貨、冷卻動畫條、聰明用藥、按鈕去抖、手動優先 1s、記憶百分比
// - 依賴：player.totalStats.{hp,mp}, player.currentHP/MP, inventory.js 的 addItem/getItemQuantity/removeItem
// - 可選：GrowthHub, saveGame（只影響金錢/背包更新，不影響本模組存檔）
/* ===========================================================
   Recovery Items Tab — V5 （💊 藥水系統・正式結案版）
   -----------------------------------------------------------
   ✅ 功能完成，禁止後續修改（除非明確指定“重新開發藥水系統”）
   ✅ 功能範圍：
       - 六款藥水（HP/MP）
       - 自動用藥 + 聰明用藥
       - 自動補貨 + 目標庫存設定
       - 冷卻進度條動畫
       - 手動優先（停自動 1 秒）
       - 按鈕防連點
       - 門檻百分比與設定獨立存檔（localStorage）
       - 完全獨立於主系統存檔與職業
       - 允許 GrowthHub 分頁載入
   ✅ 穩定運作條件：
       - 已初始化 player 與 inventory 系統
       - 外部戰鬥自動停止時，不影響本模組
   ✅ 若要新增新藥水：
       - 僅需在 ITEMS 中照格式新增一條
       - 其他邏輯、自動功能、UI 將自動適配
   -----------------------------------------------------------
   ⚠️ 本檔案為最終穩定版本，請勿修改。
   修改請建立副本（recovery_items_tab_v6+）
   =========================================================== */
// ==========================
(function(){
  if (window.RecoveryItemsTab && window.RecoveryItemsTab.__v5__) return;

  // ===== 狀態存檔（獨立）=====
  var SAVE_KEY = "potions_tab_state_v1";
  var STATE = {
    auto: {},            // { itemId: { enabled, threshold01, autoBuy:{enabled,target} } }
    cooldowns: {},       // { itemId: readyAtTs }
    manualTs: 0          // 手動用藥時間戳（手動優先 1s）
  };
  function loadState(){
    try {
      var o = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (o && typeof o === 'object') {
        STATE.auto = o.auto || {};
        STATE.cooldowns = o.cooldowns || {};
        STATE.manualTs = Number(o.manualTs||0);
      }
    } catch(_) {}
  }
  function saveState(){
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(STATE)); } catch(_){}
  }
  loadState();

  // ---- 單一恢復力（小數，例 0.38 = +38%）----
  // 可調：藥水吃回復力的權重（1.0 = 100%；若要跟被動恢復一致吃 30%，改成 0.30）
var POTION_EAT_RATIO = 1.0;

function getRecoveryPower(){
  var p = 0;

  // 1) 首選：統一總合（base+skill+core，已做上限）
  if (player && player.totalStats && typeof player.totalStats.recoverPercent === 'number') {
    p = player.totalStats.recoverPercent;
  }
  // 2) 相容回退：舊欄位（基礎）
  else if (player && typeof player.recoverPercentBaseDecimal === 'number') {
    p = player.recoverPercentBaseDecimal;
  }
  // 3) 最後回退：舊的 recoverPercent（可能是百分比或小數）
  else if (player && typeof player.recoverPercent === 'number') {
    p = player.recoverPercent;
    if (p > 1 && p <= 100) p /= 100; // 舊檔百分比
  }

  if (!isFinite(p) || p < 0) p = 0;
  // 夾斷 0~1，並套用藥水的吃入權重

 p = Math.max(0, p);
return p * POTION_EAT_RATIO;
}

  // ---- 藥水清單（新增藥水就加一條）----
  var ITEMS = {
    hp_basic:  { id:'hp_basic',  name:'生命藥水',     invName:'生命藥水',     stat:'hp', base:100,  cdMs: 50*1000, price: 300,  order:1 },
    hp_adv:    { id:'hp_adv',    name:'高級生命藥水', invName:'高級生命藥水', stat:'hp', base:1000, cdMs: 30*1000, price: 1000, order:2 },
    hp_super:  { id:'hp_super',  name:'超級生命藥水', invName:'超級生命藥水', stat:'hp', base:5000, cdMs: 18*1000, price: null, order:3 },
    mp_basic:  { id:'mp_basic',  name:'法力藥水',     invName:'法力藥水',     stat:'mp', base:20,   cdMs: 60*1000, price: 500,  order:1 },
    mp_adv:    { id:'mp_adv',    name:'高級法力藥水', invName:'高級法力藥水', stat:'mp', base:100,  cdMs: 40*1000, price: 2000, order:2 },
    mp_super:  { id:'mp_super',  name:'超級法力藥水', invName:'超級法力藥水', stat:'mp', base:700,  cdMs: 22*1000, price: null, order:3 }
  };
  var LIST = [ITEMS.hp_basic, ITEMS.hp_adv, ITEMS.hp_super, ITEMS.mp_basic, ITEMS.mp_adv, ITEMS.mp_super];

  // ---- 工具 ----
  function now(){ return Date.now(); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function fmtCountdown(ms){
    ms = Math.max(0, ms|0);
    var s = Math.ceil(ms/1000), m = Math.floor(s/60); s%=60;
    return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
  }
  function isDead(){ return window.player ? (Number(player.currentHP||0) <= 0) : false; }

  function ensurePlayerReady(){ return !!window.player; }

  // 背包數量（讀你的 inventory）
  function getStock(def){
    if (typeof getItemQuantity === 'function') return getItemQuantity(def.invName);
    if (window.inventory) return window.inventory[def.invName] || 0;
    return 0;
  }
  function addStock(def, n){
    if (typeof addItem === 'function') addItem(def.invName, n);
    else {
      window.inventory = window.inventory || {};
      window.inventory[def.invName] = (window.inventory[def.invName]||0) + n;
    }
    try { if (typeof saveGame === 'function') saveGame(); } catch(_){}
  }
  function takeStock(def, n){
    if (typeof removeItem === 'function') removeItem(def.invName, n);
    else {
      window.inventory = window.inventory || {};
      window.inventory[def.invName] = Math.max((window.inventory[def.invName]||0)-n, 0);
    }
    try { if (typeof saveGame === 'function') saveGame(); } catch(_){}
  }

  // 金錢（預設 gold，找不到再 coin/money/gem）
  function moneyRef(){
    if (!player) return {key:null,value:0};
    if (typeof player.gold === 'number')  return {key:'gold',  value:player.gold};
    if (typeof player.coin === 'number')  return {key:'coin',  value:player.coin};
    if (typeof player.money === 'number') return {key:'money', value:player.money};
    if (typeof player.gem === 'number')   return {key:'gem',   value:player.gem};
    return {key:null,value:0};
  }
  function getMoney(){ return moneyRef().value; }
  function spendMoney(n){
    var r = moneyRef(); if (!r.key) return false;
    if (r.value < n) return false;
    player[r.key] = r.value - n;
    try { if (typeof saveGame === 'function') saveGame(); } catch(_){}
    return true;
  }

  // 角色資源
  function getMax(stat){
    if (!player) return 0;
    if (stat==='hp') return Math.max(1, (player.totalStats && player.totalStats.hp) ? player.totalStats.hp : 1);
    if (stat==='mp') return Math.max(0, (player.totalStats && player.totalStats.mp) ? player.totalStats.mp : 0);
    return 0;
  }
  function getCur(stat){
    if (!player) return 0;
    if (stat==='hp') return Number(player.currentHP||0);
    if (stat==='mp') return Number(player.currentMP||0);
    return 0;
  }
  function setCur(stat,v){
    if (!player) return;
    if (stat==='hp') player.currentHP = v;
    if (stat==='mp') player.currentMP = v;
  }

  // 冷卻（走獨立存檔 STATE.cooldowns）
  function getCdRemain(def){
    var t = Number(STATE.cooldowns[def.id] || 0);
    var ms = t - now();
    return ms>0?ms:0;
  }

  // 自動設定（從 STATE.auto）
  function autoConf(def){
    var c = STATE.auto[def.id];
    if (!c) c = (STATE.auto[def.id] = {enabled:false, threshold01:0.5, autoBuy:{enabled:false, target:10}});
    if (typeof c.enabled !== 'boolean') c.enabled = false;
    if (typeof c.threshold01 !== 'number') c.threshold01 = 0.5;
    c.threshold01 = clamp(c.threshold01, 0.01, 1);
    if (!c.autoBuy) c.autoBuy = {enabled:false, target:10};
    if (typeof c.autoBuy.enabled !== 'boolean') c.autoBuy.enabled = false;
    var tg = Number(c.autoBuy.target); if (!isFinite(tg)) tg = 10;
    c.autoBuy.target = Math.max(0, Math.floor(tg));
    return c;
  }
  function setAuto(itemId, flag){
    var def = ITEMS[itemId]; if (!def) return false;
    autoConf(def).enabled = !!flag;
    saveState();
    return true;
  }
  function setThreshold(itemId, pct01){
    var def = ITEMS[itemId]; if (!def) return false;
    var v = Number(pct01); if (!isFinite(v)) v = 0.5;
    autoConf(def).threshold01 = clamp(v, 0.01, 1);
    saveState();
    return true;
  }
  function setAutoBuy(itemId, enabled, target){
    var def = ITEMS[itemId]; if (!def) return false;
    var c = autoConf(def);
    if (enabled !== undefined) c.autoBuy.enabled = !!enabled;
    if (target !== undefined) {
      var tg = Number(target); if (!isFinite(tg)) tg = c.autoBuy.target||10;
      c.autoBuy.target = Math.max(0, Math.floor(tg));
    }
    saveState();
    return true;
  }

  // 去抖工具
  function withDebounce(btn, fn){
    if (!btn) return fn;
    var locked = false;
    return function(){
      if (locked) return;
      locked = true;
      try { fn.apply(this, arguments); } finally {
        setTimeout(function(){ locked = false; }, 200);
      }
    };
  }

  // 總回復量 = ceil(base * (1 + RecoveryPower))
  function totalHeal(def){
    var mult = 1 + getRecoveryPower();
    return Math.ceil(def.base * mult);
  }

  // 能否使用/使用/購買
  function canUse(itemId){
    if (!ensurePlayerReady()) return {ok:false, reason:'no_player'};
    var def = ITEMS[itemId]; if (!def) return {ok:false, reason:'no_item'};
    if (isDead()) return {ok:false, reason:'dead'};
    if (getStock(def) <= 0) return {ok:false, reason:'no_stock'};
    var cd = getCdRemain(def); if (cd>0) return {ok:false, reason:'cooldown', remainingMs:cd};
    var max = getMax(def.stat), cur = getCur(def.stat);
    if (cur >= max) return {ok:false, reason:'not_needed'};
    return {ok:true, def:def, cur:cur, max:max};
  }

  function use(itemId, isManual){
    var chk = canUse(itemId); if (!chk.ok) return chk;
    var def = chk.def;
    var heal = totalHeal(def);
    var after = clamp(chk.cur + heal, 0, chk.max);
    setCur(def.stat, after);
    takeStock(def, 1);
    STATE.cooldowns[def.id] = now() + def.cdMs;
    if (isManual) STATE.manualTs = now(); // 手動優先：1秒內暫停自動
    saveState();

    try { if (typeof updateResourceUI === 'function') updateResourceUI(); } catch(_){}
    try { if (typeof saveGame === 'function') saveGame(); } catch(_){}
    return {ok:true, healed:heal, after:after, max:chk.max, readyAt:STATE.cooldowns[def.id]};
  }

  function buy(itemId){
    if (!ensurePlayerReady()) return {ok:false, reason:'no_player'};
    var def = ITEMS[itemId]; if (!def) return {ok:false, reason:'no_item'};
    if (def.price == null) return {ok:false, reason:'not_for_sale'};
    if (!spendMoney(def.price)) return {ok:false, reason:'no_money', need:def.price, have:getMoney()};
    addStock(def, 1);
    return {ok:true, price:def.price};
  }

  // 自動補貨
  function autoBuyTick(){
    if (!ensurePlayerReady()) return;
    LIST.forEach(function(def){
      var c = autoConf(def);
      if (!c.autoBuy.enabled) return;
      if (def.price == null) return;
      var cur = getStock(def);
      var lack = Math.max(0, (c.autoBuy.target||0) - cur);
      if (lack <= 0) return;
      for (var i=0;i<lack;i++){
        if (!spendMoney(def.price)) break;
        addStock(def, 1);
      }
    });
  }

  // 聰明用藥（剛好到門檻的最低級；否則最低級可用）
  function smartAutoUse(lineItems, statKey){
    var max = getMax(statKey);
    if (max <= 0) return;
    var cur = getCur(statKey);
    var sorted = lineItems.slice().sort(function(a,b){ return a.order - b.order; });

    var elig = [];
    var thr01 = 0.5;
    for (var i=0;i<sorted.length;i++){
      var d = sorted[i], conf = autoConf(d);
      if (!conf.enabled) continue;
      elig.push({def:d, conf:conf});
      thr01 = conf.threshold01; // 取同線第一個的門檻
    }
    if (!elig.length) return;

    var target = Math.min(max, Math.floor(max * thr01));
    if (cur >= target) return;

    for (var j=0;j<elig.length;j++){
      var def = elig[j].def;
      if (!canUse(def.id).ok) continue;
      if (cur + totalHeal(def) >= target){ use(def.id, false); return; }
    }
    for (var k=0;k<elig.length;k++){
      var def2 = elig[k].def;
      if (!canUse(def2.id).ok) continue;
      use(def2.id, false); return;
    }
  }

  // 自動：手動優先 1s + 自動補貨 + 聰明用藥
  setInterval(function(){
    if (!ensurePlayerReady() || isDead()) return;
    if (now() - (STATE.manualTs || 0) < 1000) return; // 手動後 1 秒暫停自動
    autoBuyTick();
    if (getMax('hp') > 0) smartAutoUse([ITEMS.hp_basic, ITEMS.hp_adv, ITEMS.hp_super], 'hp');
    if (getMax('mp') > 0) smartAutoUse([ITEMS.mp_basic, ITEMS.mp_adv, ITEMS.mp_super], 'mp');
  }, 1000);

  // ---- 分頁 UI ----
  function render(container){
    if (!ensurePlayerReady()){ container.innerHTML = '<div style="opacity:.7">（玩家尚未就緒）</div>'; return; }
    var powPct = Math.round(getRecoveryPower()*100);

    function row(def){
      var cd  = getCdRemain(def);
      var st  = getStock(def);
      var conf= autoConf(def);
      var thr = Math.round(conf.threshold01*100);
      var heal= totalHeal(def);
      var cdRatio = 0;
      if (cd > 0 && def.cdMs > 0) cdRatio = clamp((def.cdMs - cd) / def.cdMs, 0, 1);

      return ''+
      '<div style="border:1px solid #253041;border-radius:10px;padding:10px;display:grid;gap:8px;background:#0e172a">'+
        '<div style="display:flex;gap:8px;align-items:center">'+
          '<div style="font-weight:700">'+def.name+'</div>'+
          '<div style="margin-left:auto;opacity:.85">庫存：<b id="inv-'+def.id+'">'+fmt(st)+'</b></div>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">'+
          '<div>效果：<b>基礎 '+fmt(def.base)+'</b> × (1 + 恢復力 <b>'+powPct+'%</b>) = <b>'+fmt(heal)+'</b></div>'+
          '<div style="display:flex;gap:8px">'+
            '<button id="use-'+def.id+'" style="padding:6px 10px;border-radius:8px;border:none;background:#10b981;color:#0b1220;cursor:pointer">使用</button>'+
            (def.price!=null ? '<button id="buy-'+def.id+'" style="padding:6px 10px;border-radius:8px;border:1px solid #374151;background:#0b1220;color:#e5e7eb;cursor:pointer">購買（'+fmt(def.price)+'）</button>' : '')+
          '</div>'+
        '</div>'+
        '<div class="dun-bar" style="height:6px;opacity:.9"><i id="cdbar-'+def.id+'" style="display:block;height:6px;width:'+Math.round(cdRatio*100)+'%;background:linear-gradient(90deg,#22d3ee,#2563eb)"></i></div>'+
        '<div style="display:flex;gap:12px;align-items:center;opacity:.95;flex-wrap:wrap">'+
          '<label style="display:flex;gap:6px;align-items:center;cursor:pointer">'+
            '<input id="auto-'+def.id+'" type="checkbox" '+(conf.enabled?'checked':'')+'> 自動使用'+
          '</label>'+
          '<div style="margin-left:auto;display:flex;gap:8px;align-items:center">'+
            '<label style="opacity:.85">條件：'+(def.stat==='hp'?'HP':'MP')+' ≤ </label>'+
            '<input id="thr-'+def.id+'" type="range" min="1" max="100" value="'+thr+'" style="width:140px">'+
            '<span id="thrval-'+def.id+'" style="width:40px;text-align:right">'+thr+'%</span>'+
          '</div>'+
        '</div>'+
        (def.price!=null ? (
          '<div style="display:flex;gap:10px;align-items:center;opacity:.95">'+
            '<label style="display:flex;gap:6px;align-items:center;cursor:pointer">'+
              '<input id="ab-on-'+def.id+'" type="checkbox" '+(conf.autoBuy.enabled?'checked':'')+'> 自動補貨'+
            '</label>'+
            '<div style="display:flex;gap:6px;align-items:center;opacity:.9">'+
              '<span>目標庫存</span>'+
              '<input id="ab-tg-'+def.id+'" type="number" min="0" step="1" value="'+conf.autoBuy.target+'" style="width:72px;padding:2px 6px;border-radius:6px;border:1px solid #374151;background:#0b1220;color:#e5e7eb">'+
            '</div>'+
            '<div style="margin-left:auto;opacity:.85">資金：<b id="gold-'+def.id+'">'+fmt(getMoney())+'</b></div>'+
          '</div>'
        ) : (
          '<div style="display:flex;gap:10px;align-items:center;opacity:.75">'+
            '<span>不可購買的道具，無自動補貨</span>'+
            '<div style="margin-left:auto;opacity:.85">資金：<b id="gold-'+def.id+'">'+fmt(getMoney())+'</b></div>'+
          '</div>'
        ))+
      '</div>';
    }

    container.innerHTML =
      '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:12px;display:grid;gap:12px">'+
        '<div style="display:flex;gap:12px;align-items:center">'+
          '<div style="font-weight:700">🧪 藥水</div>'+
          '<div style="margin-left:auto;opacity:.85">恢復力：<b>'+powPct+'%</b></div>'+
        '</div>'+
        LIST.map(row).join('')+
      '</div>';

    // 綁定事件（帶去抖）
    LIST.forEach(function(def){
      var $ = function(sel){ return container.querySelector(sel); };

      var btnUse = $('#use-'+def.id);
      if (btnUse) btnUse.onclick = withDebounce(btnUse, function(){
        var r = use(def.id, true);
        if (!r.ok){
          if (r.reason === 'dead') alert('你已死亡，無法使用道具');
          else if (r.reason === 'cooldown') alert('冷卻中：'+fmtCountdown(r.remainingMs));
          else if (r.reason === 'no_stock') alert('庫存不足');
          else if (r.reason === 'not_needed') alert('目前已滿，無需使用');
          else alert('無法使用（'+r.reason+'）');
        }
        rerender();
      });

      var btnBuy = $('#buy-'+def.id);
      if (btnBuy) btnBuy.onclick = withDebounce(btnBuy, function(e){
        var qty = 1;
        if (e && e.shiftKey) qty = 10;
        else if (e && (e.ctrlKey || e.metaKey)) qty = 50;
        else if (e && e.altKey) qty = 999999;

        var conf = autoConf(def);
        var target = conf.autoBuy && conf.autoBuy.target || Infinity;
        var startStock = getStock(def);
        var maxNeed = (def.price!=null) ? Math.max(0, target - startStock) : 0;
        if (e && e.altKey) qty = Math.min(qty, maxNeed>0?maxNeed:qty);

        var bought = 0;
        for (var i=0;i<qty;i++){
          var r = buy(def.id);
          if (!r.ok) break;
          bought++;
          if (def.price!=null && (getStock(def) >= target)) break;
        }
        if (!bought) alert('購買失敗（資金或販售限制）');
        rerender();
      });

      var chk = $('#auto-'+def.id);
      if (chk) chk.onchange = function(){ setAuto(def.id, this.checked); };

      var thr = $('#thr-'+def.id), tv = $('#thrval-'+def.id);
      if (thr && tv){
        thr.oninput  = function(){ tv.textContent = this.value + '%'; };
        thr.onchange = function(){ setThreshold(def.id, Math.max(1,Math.min(100, Number(this.value)||50))/100); };
      }

      var abOn = $('#ab-on-'+def.id);
      if (abOn) abOn.onchange = function(){
        var tg = container.querySelector('#ab-tg-'+def.id);
        setAutoBuy(def.id, this.checked, tg ? tg.value : undefined);
      };
      var abTg = $('#ab-tg-'+def.id);
      if (abTg) abTg.onchange = function(){
        setAutoBuy(def.id, undefined, this.value);
      };
    });

    // 每秒刷新（冷卻/庫存/金錢/冷卻條）
    (function loop(){
      try{
        LIST.forEach(function(def){
          var invEl = container.querySelector('#inv-'+def.id);
          if (invEl) invEl.textContent = fmt(getStock(def));

          var bar = container.querySelector('#cdbar-'+def.id);
          if (bar){
            var remain = getCdRemain(def);
            var ratio = 0;
            if (remain>0 && def.cdMs>0) ratio = clamp((def.cdMs - remain)/def.cdMs, 0, 1);
            bar.style.width = Math.round(ratio*100) + '%';
          }

          var moneyEl = container.querySelector('#gold-'+def.id);
          if (moneyEl) moneyEl.textContent = fmt(getMoney());
        });
      }catch(_){}
      setTimeout(loop, 1000);
    })();

    function rerender(){ render(container); }
  }

  if (window.GrowthHub && typeof window.GrowthHub.registerTab === 'function'){
    window.GrowthHub.registerTab({
      id: 'potions',
      title: '藥水',
      render: render,
      tick: function(){}
    });
  }

  // 對外
  window.RecoveryItemsTab = {
    __v5__: true,
    use: function(id){ return use(id, true); },
    buy: buy,
    canUse: canUse,
    setAuto: setAuto,
    setThreshold: setThreshold,
    setAutoBuy: setAutoBuy,
    totalHeal: totalHeal
  };
})();