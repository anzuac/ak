// =======================
// town_city.js — 主城/銀行/礦洞/訓練營（ES5）
// 依賴：TownHub（來自 town_hub.js）、SaveHub（save_hub_es5.js）
// =======================
(function (w) {
  "use strict";
  if (!w.TownHub || typeof w.TownHub.registerTab !== 'function') return;

  // ====== 參數 ======
  var NS = 'town_city'; // SaveHub 命名空間

  var MAIN_CITY_YIELD_PER_LV = 0.20;
  var MAIN_CITY_MAX = 10;

  var BANK_BASE_PER_MIN = 20;
  var BANK_PER_LV = 5;
  var BANK_COST_LV1 = 20000;
  var BANK_COST_GROWTH = 1.5;
  var BANK_MAX = 10;
  var BANK_UP_HOURS = 8;

  var MINE_BASE_PER_MIN = 20;
  var MINE_PER_LV = 10;
  var MINE_COST_LV1 = 20000;
  var MINE_COST_GROWTH = 2.0;
  var MINE_MAX = 10;
  var MINE_UP_HOURS = 8;

  var CAMP_BASE_PER_HR = 350;
  var CAMP_PER_LV = 100;
  var CAMP_GEM_COST_BASE = 100;
  var CAMP_UPGRADE_WAIT_HOURS = 8;
  var CAMP_MAX = 10;

  // 主城升級機率（動態/保底）
  var MC_PROGRESS_BONUS_MAX = 5;    // 滿進度時 = 基礎機率的 5 倍
  var MC_PER_HIT_CAP        = 0.30; // 單顆最大 30%

  // ====== 內建簡易 Toast（城鎮專用）======
  function ensureTownToast(){
    if (document.getElementById('town-toast-style')) return;
    var css = '' +
      '#town-toast-wrap{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none}' +
      '.town-toast{min-width:240px;max-width:88vw;background:#10131d;color:#fff;border:1px solid #2c3557;border-radius:10px;padding:10px 14px;box-shadow:0 8px 24px rgba(0,0,0,.35);opacity:0;transform:translateY(-6px);transition:opacity .2s ease, transform .2s ease;font-size:14px;line-height:1.35}' +
      '.town-toast.show{opacity:1;transform:translateY(0)}' +
      '.town-toast .em{color:#ffd98a;font-weight:700}';
    var st = document.createElement('style'); st.id='town-toast-style'; st.textContent = css; document.head.appendChild(st);
    var wrap = document.createElement('div'); wrap.id='town-toast-wrap'; document.body.appendChild(wrap);
  }
  function townToast(msg, ms){
    ensureTownToast();
    var wrap = document.getElementById('town-toast-wrap');
    var el = document.createElement('div');
    el.className = 'town-toast';
    el.innerHTML = msg;
    wrap.appendChild(el);
    requestAnimationFrame(function(){ el.classList.add('show'); });
    setTimeout(function(){
      el.classList.remove('show');
      setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, Math.max(1500, ms||2200));
  }

  // ====== 工具 ======
  function nowSec(){ return Math.floor(Date.now()/1000); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function toInt(n){ n=Number(n); return (isFinite(n)? Math.floor(n) : 0); }
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function upd(){ try{ w.updateResourceUI && w.updateResourceUI(); }catch(_){} }
  function save(){ try{ w.saveGame && w.saveGame(); }catch(_){} }
  function notify(msg){
    try{
      if (w.logPrepend) w.logPrepend(msg); // 有全域訊息欄就寫入
      townToast(msg);                       // 一定顯示 Toast
    }catch(_){
      alert(msg);                           // 萬一 DOM 建不出來
    }
    console.log(msg);
  }

  function addItem(name, qty){ try{ w.addItem && w.addItem(name, toInt(qty||1)); }catch(_){} }
  function getItemQuantity(name){ try{ return toInt(w.getItemQuantity ? w.getItemQuantity(name) : 0); }catch(_){ return 0; } }
  function removeItem(name, qty){
    qty = toInt(qty||1); if (qty<=0) return false;
    try { if (w.removeItem){ w.removeItem(name, qty); return true; } } catch(_) {}
    return false;
  }
  function dailyKey(){ var d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }

  function pickOwnedEssence(){
    var names = ["森林精華","沼澤精華","熔岩精華","天水精華","風靈精華","雷光精華","冰霜精華","黯影精華","煉獄精華","聖光精華","核心精華","精華"];
    var candidates = [];
    for (var i=0;i<names.length;i++){
      var q = getItemQuantity(names[i]);
      if (q>0) candidates.push(names[i]);
    }
    if (!candidates.length) return null;
    return candidates[(Math.random()*candidates.length)|0];
  }

  // ====== SaveHub 初始化 ======
  if (w.SaveHub){
    var spec = {}; spec[NS] = { version: 1, migrate: function(old){ return old || {}; } };
    w.SaveHub.registerNamespaces(spec);
  }

  // 預設狀態
  var DEFAULT_STATE = {
    mainCityLv: 0, mainCityFeed: 0,
    bankLv: 1, bankUpStart: 0, bankProducedToday: 0,
    mineLv: 1, mineUpStart: 0, mineProducedToday: 0,
    campLv: 1, campUpStart: 0, campProducedToday: 0,
    lastTick: nowSec(),
    _accGold: 0, _accStone: 0, _accExp: 0,
    _prodCarrySec: 0, _campCarrySec: 0,
    _lastDaily: dailyKey()
  };

  // ====== 狀態（SaveHub 管理） ======
  var state = (w.SaveHub ? w.SaveHub.get(NS, DEFAULT_STATE) : DEFAULT_STATE);
  function persist(){ if (w.SaveHub) w.SaveHub.set(NS, state); }

  // ====== 計算 ======
  function mainCityYieldMult(){ var lv = clamp(state.mainCityLv,0,MAIN_CITY_MAX); return 1 + lv*MAIN_CITY_YIELD_PER_LV; }

  function bankPerMin(){ var lv=clamp(state.bankLv,1,BANK_MAX); return (BANK_BASE_PER_MIN + (lv-1)*BANK_PER_LV) * mainCityYieldMult(); }
  function bankNextCost(){ var lv=clamp(state.bankLv,1,BANK_MAX), c=BANK_COST_LV1; for(var i=1;i<lv;i++) c=Math.ceil(c*BANK_COST_GROWTH); return c; }
  function bankRemainSec(){ if(!state.bankUpStart) return 0; var end=state.bankUpStart + BANK_UP_HOURS*3600; return Math.max(0, end - nowSec()); }

  function minePerMin(){ var lv=clamp(state.mineLv,1,MINE_MAX); return (MINE_BASE_PER_MIN + (lv-1)*MINE_PER_LV) * mainCityYieldMult(); }
  function mineNextCost(){ var lv=clamp(state.mineLv,1,MINE_MAX), c=MINE_COST_LV1; for(var i=1;i<lv;i++) c=Math.ceil(c*MINE_COST_GROWTH); return c; }
  function mineRemainSec(){ if(!state.mineUpStart) return 0; var end=state.mineUpStart + MINE_UP_HOURS*3600; return Math.max(0, end - nowSec()); }

  function campPerHour(){ var lv=clamp(state.campLv,1,CAMP_MAX); return (CAMP_BASE_PER_HR + (lv-1)*CAMP_PER_LV); }
  function campStatus(){ if(!state.campUpStart) return null; var dur=CAMP_UPGRADE_WAIT_HOURS*3600; var end=state.campUpStart+dur; return {remainSec:Math.max(0,end-nowSec())}; }
  function campNextGemCost(){ return CAMP_GEM_COST_BASE * Math.max(1, state.campLv||1); }

  // ====== 動作 ======
  function tryUpgradeBank(){
    if (state.bankLv >= BANK_MAX){ notify("🏦 銀行已滿級"); return; }
    if (bankRemainSec()>0){ notify("⏳ 銀行升級進行中…"); return; }
    var cost=bankNextCost(), g=toInt(w.player && w.player.gold || 0);
    if (g<cost){ notify("⚠️ 您的資源不足：金幣不足，需要 "+fmt(cost)); return; }
    w.player.gold = g - cost;
    state.bankUpStart = nowSec();
    persist(); upd(); save(); notify("🏦 銀行開始升級（8 小時）");
  }
  function finishBank(){ var r=bankRemainSec(); if(r>0||!state.bankUpStart) return; state.bankUpStart=0; state.bankLv=clamp(state.bankLv+1,1,BANK_MAX); persist(); notify("🏦 銀行升級完成 → Lv."+state.bankLv); }

  function tryUpgradeMine(){
    if (state.mineLv >= MINE_MAX){ notify("⛏ 礦洞已滿級"); return; }
    if (mineRemainSec()>0){ notify("⏳ 礦洞升級進行中…"); return; }
    var cost=mineNextCost(), g=toInt(w.player && w.player.gold || 0);
    if (g<cost){ notify("⚠️ 您的資源不足：金幣不足，需要 "+fmt(cost)); return; }
    w.player.gold = g - cost;
    state.mineUpStart = nowSec();
    persist(); upd(); save(); notify("⛏ 礦洞開始升級（8 小時）");
  }
  function finishMine(){ var r=mineRemainSec(); if(r>0||!state.mineUpStart) return; state.mineUpStart=0; state.mineLv=clamp(state.mineLv+1,1,MINE_MAX); persist(); notify("⛏ 蟲洞升級完成 → Lv."+state.mineLv); }

  function beginCampUpgrade(){
    var st=campStatus(); if(st&&st.remainSec>0){ notify("⏳ 訓練營升級進行中…"); return; }
    var cost=campNextGemCost(), gem=toInt(w.player && w.player.gem || 0);
    if (gem<cost){ notify("⚠️ 您的資源不足：鑽石不足，需要 "+fmt(cost)); return; }
    w.player.gem = gem - cost;
    state.campUpStart = nowSec();
    persist(); upd(); save(); notify("🏋️ 訓練營開始升級（"+CAMP_UPGRADE_WAIT_HOURS+" 小時）");
  }
  function finishCamp(){ var st=campStatus(); if(!st||st.remainSec>0) return; state.campUpStart=0; state.campLv=clamp(state.campLv+1,1,CAMP_MAX); persist(); notify("🏋️ 訓練營升級完成 → Lv."+state.campLv); }

  function feedEssence(n){
    n = toInt(n||1); if (n<=0) return 0;
    var fed=0;
    for (var i=0;i<n;i++){
      if (state.mainCityLv >= MAIN_CITY_MAX) break;
      var key = pickOwnedEssence(); if (!key) break;
      if (!removeItem(key,1)) break;
      fed++; state.mainCityFeed += 1;

      var lv = Math.max(1, state.mainCityLv||0);
      var p0 = 0.01 / lv;                 // 基礎 1%/Lv
      var pityNeed = 100 * lv;            // 保底
      var prog = Math.min(1, state.mainCityFeed / pityNeed);
      var p = p0 * (1 + (MC_PROGRESS_BONUS_MAX - 1) * prog);
      if (p > MC_PER_HIT_CAP) p = MC_PER_HIT_CAP;

      var pity = (state.mainCityFeed >= pityNeed);
      var hit = pity || (Math.random() < p);
      if (hit){
        state.mainCityLv = clamp(state.mainCityLv+1, 0, MAIN_CITY_MAX);
        state.mainCityFeed = 0;
        notify("🏰 主城升級成功 → Lv."+state.mainCityLv+"（銀行/礦洞 +20%）");
      }
    }
    if (fed===0) notify("⚠️ 您的資源不足：沒有可用的『精華』");
    persist(); upd(); save();
    return fed;
  }

  // ====== tick ======
  function tick(dt){
    // 每日重置
    var day = dailyKey();
    if (state._lastDaily !== day){
      state._lastDaily = day;
      state.bankProducedToday = 0;
      state.mineProducedToday = 0;
      state.campProducedToday = 0;
      persist();
    }

    // 完成升級
    finishBank(); finishMine(); finishCamp();

    // 產出
    var perMinGold = bankPerMin();
    var perMinStone = minePerMin();
    var perHrExp = campPerHour();

    state._accGold  += (dt/60)   * perMinGold;
    state._accStone += (dt/60)   * perMinStone;
    state._accExp   += (dt/3600) * perHrExp;

    var gWhole = Math.floor(state._accGold);
    var sWhole = Math.floor(state._accStone);
    var eWhole = Math.floor(state._accExp);

    var changed=false;
    if (gWhole>0 && w.player){ w.player.gold = toInt(w.player.gold||0) + gWhole; state.bankProducedToday += gWhole; state._accGold -= gWhole; changed=true; }
    if (sWhole>0 && w.player){ w.player.stone = toInt(w.player.stone||0) + sWhole; state.mineProducedToday += sWhole; state._accStone -= sWhole; changed=true; }
    if (eWhole>0){
      if (typeof w.gainExp === "function") w.gainExp(eWhole); else if (w.player) w.player.exp = toInt((w.player.exp||0) + eWhole);
      state.campProducedToday += eWhole; state._accExp -= eWhole; changed=true;
    }

    // 視覺用 progress（不影響計算）
    state._prodCarrySec = ((state._prodCarrySec||0) + dt) % 60;
    state._campCarrySec = ((state._campCarrySec||0) + dt) % 3600;
    if (changed){ upd(); save(); }
    persist();
  }

  // ====== UI ======
  function bar(pct){ pct=Math.max(0,Math.min(100,Math.round(pct||0))); return '<div style="height:8px;background:#1c2144;border-radius:999px;overflow:hidden;margin-top:6px"><span style="display:block;height:100%;width:'+pct+'%;background:linear-gradient(90deg,#6aa9ff,#79ffc8)"></span></div>'; }

  function render(container){
    var goldPerMin = bankPerMin();
    var stonePerMin = minePerMin();
    var expPerHr = campPerHour();

    var prodCarry = state._prodCarrySec || 0;
    var nextProdSec = Math.max(0, Math.ceil(60 - prodCarry));
    var prodPct = Math.floor((prodCarry / 60) * 100);

    var campCarry = state._campCarrySec || 0;
    var nextCampMin = Math.max(0, Math.ceil((3600 - campCarry) / 60));
    var campPct = Math.floor((campCarry / 3600) * 100);

    var lvNow = Math.max(0, state.mainCityLv || 0);
    var pityNeed = 100 * Math.max(1, lvNow || 1);
    var fed = Math.max(0, state.mainCityFeed || 0);
    var progPct = Math.round(Math.min(1, fed / pityNeed) * 100);
    var p0 = (0.01 / Math.max(1, lvNow||1)) * 100;

    var mainCityHtml =
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
        '<div>等級：<b data-mc="lv">Lv.'+ lvNow +'</b></div>'+
        '<div>產量加成：<b data-mc="bonus">'+ (MAIN_CITY_YIELD_PER_LV*100*lvNow).toFixed(0) +'%</b>（銀行/礦洞）</div>'+
        '<div>本級已餵：<b data-mc="fed">'+ fed +'</b> / 保底 <b data-mc="pity">'+ pityNeed +'</b></div>'+
      '</div>'+
      '<div style="margin-top:8px;border:1px solid #2f3555;border-radius:8px;height:10px;overflow:hidden;background:#111b2a;"><span data-mc="bar" style="display:block;height:100%;width:'+progPct+'%;background:#3b82f6"></span></div>'+
      '<div style="display:flex;justify-content:space-between;opacity:.85;margin-top:4px;font-size:12px"><div>升級進度（保底）</div><div>'+progPct+'%</div></div>'+
      '<div style="margin-top:6px;opacity:.9">單顆（基礎）成功率：約 <b>'+ p0.toFixed(2) +'%</b>；餵 10 顆基礎機率 ≈ <b>'+ (100*(1-Math.pow(1-(p0/100),10))).toFixed(1) +'%</b></div>'+
      '<div style="margin-top:4px;opacity:.8;font-size:12px">升級後產量預估：銀行 <b>'+ (bankPerMin()*1.2).toFixed(1) +'</b>/分、礦洞 <b>'+ (minePerMin()*1.2).toFixed(1) +'</b>/分</div>'+
      '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">'+
        '<button id="btnFeed1"  style="background:#3a6;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer">餵 1 顆精華</button>'+
        '<button id="btnFeed10" style="background:#284;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer">餵 10 顆精華</button>'+
      '</div>';

    var bankRemain = bankRemainSec();
    var bankPct = bankRemain>0 ? Math.floor(((BANK_UP_HOURS*3600 - bankRemain)/(BANK_UP_HOURS*3600))*100) : 0;
    var bankHtml =
      '<div>等級：<b>Lv.'+state.bankLv+' / '+BANK_MAX+'</b></div>'+
      '<div>當前產量：<b>'+fmt(goldPerMin.toFixed(1))+'</b> 金幣 / 分鐘</div>'+
      '<div class="mini" style="opacity:.85;margin-top:2px">今日總獲得：<b>'+fmt(state.bankProducedToday)+'</b>　下次入帳倒數：<b>'+nextProdSec+'s</b></div>'+
      bar(prodPct) +
      (bankRemain>0
        ? '<div style="color:#9cf;margin-top:8px">升級中（剩餘 '+fmt(Math.ceil(bankRemain/60))+' 分）</div>'+ bar(bankPct)
        : '<div style="opacity:.85;margin-top:6px">下一級費用：<b>'+fmt(bankNextCost())+'</b> 金幣</div>'+
          '<div style="margin-top:8px"><button id="btnBankUp" style="background:#6a6ad0;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer" '+(state.bankLv>=BANK_MAX?'disabled':'')+'>開始升級（8 小時）</button></div>'
      );

    var mineRemain = mineRemainSec();
    var minePct = mineRemain>0 ? Math.floor(((MINE_UP_HOURS*3600 - mineRemain)/(MINE_UP_HOURS*3600))*100) : 0;
    var mineHtml =
      '<div>等級：<b>Lv.'+state.mineLv+' / '+MINE_MAX+'</b></div>'+
      '<div>當前產量：<b>'+fmt(stonePerMin.toFixed(1))+'</b> 強化石 / 分鐘</div>'+
      '<div class="mini" style="opacity:.85;margin-top:2px">今日總獲得：<b>'+fmt(state.mineProducedToday)+'</b>　下次入帳倒數：<b>'+nextProdSec+'s</b></div>'+
      bar(prodPct) +
      (mineRemain>0
        ? '<div style="color:#9cf;margin-top:8px">升級中（剩餘 '+fmt(Math.ceil(mineRemain/60))+' 分）</div>'+ bar(minePct)
        : '<div style="opacity:.85;margin-top:6px">下一級費用：<b>'+fmt(mineNextCost())+'</b> 金幣</div>'+
          '<div style="margin-top:8px"><button id="btnMineUp" style="background:#6ab06a;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer" '+(state.mineLv>=MINE_MAX?'disabled':'')+'>開始升級（8 小時）</button></div>'
      );

    var camp = campStatus();
    var campRemain = camp ? camp.remainSec : 0;
    var campHtml =
      '<div>等級：<b>Lv.' + state.campLv + ' / ' + CAMP_MAX + '</b>（不受主城影響）</div>' +
      '<div>當前產量：<b>' + fmt(expPerHr) + '</b> EXP / 小時</div>' +
      '<div class="mini" style="opacity:.85;margin-top:2px">今日總獲得：<b>' + fmt(state.campProducedToday || 0) + '</b>　下一次入帳：約 <b>' + nextCampMin + ' 分</b></div>' +
      bar(Math.floor((state._campCarrySec||0)/36)) + // 0~100
      (campRemain > 0 ?
        '<div style="color:#9cf;margin-top:6px">升級中（剩餘 ' + fmt(Math.ceil(campRemain / 60)) + ' 分）</div>' +
        bar(Math.floor(((CAMP_UPGRADE_WAIT_HOURS*3600 - campRemain)/(CAMP_UPGRADE_WAIT_HOURS*3600))*100))
        :
        '<div style="margin-top:6px;opacity:.85">升級成本：<b>' + fmt(campNextGemCost()) + '</b> 💎</div>' +
        '<div style="margin-top:8px"><button id="btnCampUp" style="background:#d06a6a;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer" ' + (state.campLv >= CAMP_MAX ? 'disabled' : '') + '>開始升級（需等待 ' + CAMP_UPGRADE_WAIT_HOURS + ' 小時）</button></div>'
      );

    container.innerHTML =
      '<div style="background:#191b25;border:1px solid #2f3555;border-radius:10px;padding:10px;margin-bottom:12px"><div style="font-weight:700;margin-bottom:6px">🏰 主城</div>'+mainCityHtml+'</div>'+
      '<div style="background:#191b25;border:1px solid #2f3555;border-radius:10px;padding:10px;margin-bottom:12px"><div style="font-weight:700;margin-bottom:6px">🏦 銀行</div>'+bankHtml+'</div>'+
      '<div style="background:#191b25;border:1px solid #2f3555;border-radius:10px;padding:10px;margin-bottom:12px"><div style="font-weight:700;margin-bottom:6px">⛏ 礦洞</div>'+mineHtml+'</div>'+
      '<div style="background:#191b25;border:1px solid #2f3555;border-radius:10px;padding:10px;margin-bottom:12px"><div style="font-weight:700;margin-bottom:6px">🏋️ 訓練營</div>'+campHtml+'</div>';

    // 綁定
    var b1 = container.querySelector('#btnFeed1');  if (b1)  b1.onclick  = function(){ feedEssence(1);  w.TownHub.requestRerender(); };
    var b10= container.querySelector('#btnFeed10'); if (b10) b10.onclick = function(){
      var lv = Math.max(1, state.mainCityLv || 1);
      var p0 = 0.01 / lv;
      var chance = 100 * (1 - Math.pow(1 - p0, 10));
      if (confirm("確定餵 10 顆精華？\n\n基礎單顆約 "+(p0*100).toFixed(2)+"%\n10 顆估算約 "+chance.toFixed(1)+"%")){
        feedEssence(10); w.TownHub.requestRerender();
      }
    };

    var bb = container.querySelector('#btnBankUp'); if (bb) bb.onclick = function(){ tryUpgradeBank(); w.TownHub.requestRerender(); };
    var bm = container.querySelector('#btnMineUp'); if (bm) bm.onclick = function(){ tryUpgradeMine(); w.TownHub.requestRerender(); };
    var bc = container.querySelector('#btnCampUp'); if (bc) bc.onclick = function(){ beginCampUpgrade(); w.TownHub.requestRerender(); };
  }

  w.TownHub.registerTab({
    id: 'town',
    title: '城鎮',
    render: render,
    tick: tick,
    onOpen: function(){}, onClose: function(){}
  });
})(window);