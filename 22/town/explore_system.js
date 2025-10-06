// =======================
// explore_system.js — 獨立「探索」分頁（每日）ES5
// 依賴：TownHub（來自 town_hub.js）
// =======================
(function (w) {
  "use strict";
  if (!w.TownHub || typeof w.TownHub.registerTab !== 'function') return;

  // ====== 工具 ======
  function nowSec(){ return Math.floor(Date.now()/1000); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function toInt(n){ n=Number(n); return (isFinite(n)? Math.floor(n) : 0); }
  function byId(id){ return document.getElementById(id); }
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function upd(){ try{ w.updateResourceUI && w.updateResourceUI(); }catch(_){} }
  function save(){ try{ w.saveGame && w.saveGame(); }catch(_){} }
  function addItem(name, qty){ qty=toInt(qty||1); if(qty<=0) return; try{ w.addItem && w.addItem(name, qty); }catch(_){} }
  function getItemQuantity(name){ try{ return toInt(w.getItemQuantity? w.getItemQuantity(name):0);}catch(_){return 0;} }

  // ====== 參數（沿用你原本設定）======
  var LS_KEY = 'EXPLORE_SPLIT_V1';
  var EXPLORE_TICK_SEC = 60;
  var EXPLORE_CAP_PER_LV = 0.10;
  var EXPLORE_MAX = 20;
  var EXPLORE_UP_COST_BASE = 500; // 花費：500 × (lv+1)
  var EXPLORE_UP_HOURS = 2 * 3600; // 秒

  // 探索掉落表（原樣搬移）
  var EXPLORE_TABLE = [
    { name: '鑽石',           type: 'gem',    cap: 20,  rate: 0.01 },
    { name: 'SP點數券',       type: 'item',   key: 'sp點數券', cap: 2,   rate: 0.002 },
    { name: '精華',           type: 'ess_any',cap: 30,  rate: 0.05 },
    { name: '技能強化券',     type: 'item',   key: '技能強化券', cap: 2,   rate: 0.001 },
    { name: '元素碎片',       type: 'item',   key: '元素碎片',   cap: 70, rate: 0.03 },
    { name: '進階石',         type: 'item',   key: '進階石',     cap: 50, rate: 0.03 },
    { name: '元素精華',       type: 'item',   key: '元素精華',   cap: 3,  rate: 0.003 },
    { name: '衝星石',         type: 'item',   key: '衝星石',     cap: 30, rate: 0.05 },
    { name: '星之碎片',       type: 'item',   key: '星之碎片',   cap: 30, rate: 0.03 },
    { name: '低階潛能解放鑰匙', type: 'item', key: '低階潛能解放鑰匙', cap: 15, rate: 0.05 },
    { name: '中階潛能解放鑰匙', type: 'item', key: '中階潛能解放鑰匙', cap: 10, rate: 0.03 },
    { name: '高階潛能解放鑰匙', type: 'item', key: '高階潛能解放鑰匙', cap: 5,  rate: 0.01 },
    { name: '怪物獎牌',       type: 'item',   key: '怪物獎牌',   cap: 50, rate: 0.05 }
  ];

  // ====== 狀態 ======
  var state = (function load(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return {
        exploreLv: 0,
        exploreUpStart: 0,
        exploreToday: dailyKey(),
        lastTick: nowSec(),
        _carry: 0,
        dropsCount: {},
        exploreLog: []
      };
      var o = JSON.parse(raw);
      o.dropsCount = o.dropsCount || {};
      o.exploreLog = o.exploreLog || [];
      o._carry = o._carry || 0;
      o.exploreToday = o.exploreToday || dailyKey();
      return o;
    }catch(_){
      return { exploreLv:0, exploreUpStart:0, exploreToday:dailyKey(), lastTick:nowSec(), _carry:0, dropsCount:{}, exploreLog:[] };
    }
  })();

  function saveLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(_){ } }
  function dailyKey(){ var d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
  function ensureToday(){ var k=dailyKey(); if(state.exploreToday!==k){ state.exploreToday=k; state.dropsCount={}; saveLocal(); }}

  // ====== 計算 ======
  function todayCapBase(){
    var out = []; var lv = clamp(state.exploreLv,0,EXPLORE_MAX);
    for (var i=0;i<EXPLORE_TABLE.length;i++){
      var base = EXPLORE_TABLE[i].cap;
      out.push(Math.floor(base * (1 + lv * EXPLORE_CAP_PER_LV)));
    }
    return out;
  }
  function nextExploreCost(){ if (state.exploreLv >= EXPLORE_MAX) return 0; return EXPLORE_UP_COST_BASE * (state.exploreLv + 1); }
  function remainUpgradeSec(){ if (!state.exploreUpStart) return 0; var end=state.exploreUpStart + EXPLORE_UP_HOURS; return Math.max(0, end - nowSec()); }

  // ====== 動作 ======
  function tryUpgrade(){
    if (state.exploreLv >= EXPLORE_MAX) return;
    if (remainUpgradeSec() > 0) return;
    var cost = nextExploreCost();
    var gem = toInt(w.player && (w.player.gem||0));
    if (gem < cost) return;
    w.player.gem = gem - cost; state.exploreUpStart = nowSec(); saveLocal(); upd(); save();
  }
  function finishUpgrade(){ var r=remainUpgradeSec(); if (r>0||!state.exploreUpStart) return; state.exploreUpStart=0; state.exploreLv=clamp(state.exploreLv+1,0,EXPLORE_MAX); saveLocal(); }

  function pickOwnedEssence(){
    var prob = ['森林精華','沼澤精華','熔岩精華','天水精華','風靈精華','雷光精華','冰霜精華','黯影精華','煉獄精華','聖光精華','核心精華','精華'];
    var c=[], i, key, qty; for(i=0;i<prob.length;i++){ key=prob[i]; qty=getItemQuantity(key); if(qty>0) c.push(key); }
    return c.length? c[(Math.random()*c.length)|0] : null;
  }

  function doExploreOnce(){
    ensureToday();
    var caps = todayCapBase();
    var gotAny=false, drops=[], i, rec, used, cap, rate;
    for (i=0;i<EXPLORE_TABLE.length;i++){
      rec = EXPLORE_TABLE[i]; used = toInt(state.dropsCount[i]||0); cap = caps[i]; if (used>=cap) continue;
      rate = Number(rec.rate)||0;
      if (Math.random() < rate){
        if (rec.type==='gem'){
          if (w.player){ w.player.gem = toInt(w.player.gem||0) + 1; drops.push('💎 鑽石 ×1'); gotAny=true; }
        } else if (rec.type==='item'){
          addItem(rec.key||rec.name, 1); drops.push('📦 '+rec.name+' ×1'); gotAny=true;
        } else if (rec.type==='ess_any'){
          var chosen = pickOwnedEssence() || '精華'; addItem(chosen, 1); drops.push('✨ '+chosen+' ×1'); gotAny=true;
        }
        state.dropsCount[i] = used + 1;
      }
    }
    var d=new Date(); var hh=d.getHours().toString().padStart(2,'0'); var mm=d.getMinutes().toString().padStart(2,'0');
    var line = gotAny? (hh+':'+mm+' 取得：'+drops.join('、')) : (hh+':'+mm+' 未獲得任何物品');
    state.exploreLog.unshift(line); if (state.exploreLog.length>30) state.exploreLog.length=30;
    saveLocal(); upd(); save();
  }

  // ====== tick ======
  function tick(dt){
    // 升級完成
    finishUpgrade();

    // 時間補算
    var t=nowSec(); var last=state.lastTick||t; var realDt=Math.max(0,t-last); state.lastTick=t;
    state._carry = (state._carry||0) + realDt;
    while (state._carry >= EXPLORE_TICK_SEC){ state._carry -= EXPLORE_TICK_SEC; doExploreOnce(); }
  }

  // ====== render ======
  function render(container){
    function bar(pct){ pct=clamp(pct,0,100); return '<div style="height:8px;background:#0b1220;border-radius:999px;overflow:hidden;margin-top:6px"><span style="display:block;height:100%;width:'+pct+'%;background:linear-gradient(90deg,#60a5fa,#34d399)"></span></div>'; }

    var caps = todayCapBase();
    // 顯示排序：機率高→低（不影響內部抽取順序）
    var view = []; var i; for(i=0;i<EXPLORE_TABLE.length;i++) view.push({ rec:EXPLORE_TABLE[i], idx:i });
    view.sort(function(a,b){ return (b.rec.rate||0)-(a.rec.rate||0); });
    var rows=''; var used, cap, rec;
    for (i=0;i<view.length;i++){ rec=view[i].rec; used=toInt(state.dropsCount[view[i].idx]||0); cap=caps[view[i].idx]; rows += '\n      <div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px dashed #1f2937">'+
      '<div>'+rec.name+' <span style="opacity:.7">（機率 '+(((Number(rec.rate)||0)*100).toFixed(2))+'%）</span></div>'+
      '<div><b>'+used+'</b> / '+cap+'</div></div>'; }

    var rem = remainUpgradeSec();
    var pct = rem>0? Math.floor(((EXPLORE_UP_HOURS - rem) / EXPLORE_UP_HOURS) * 100) : 0;

    var tickPct = Math.floor((((state._carry||0) % EXPLORE_TICK_SEC) / EXPLORE_TICK_SEC) * 100);

    container.innerHTML = card('🔍 探索（每日）', ''+
      '<div>探索等級：<b>Lv.'+state.exploreLv+' / '+EXPLORE_MAX+'</b>（每級每日上限 +10%）</div>'+
      '<div class="mini" style="opacity:.85;margin-top:2px">下次探索倒數：<b>'+ Math.ceil(EXPLORE_TICK_SEC - (state._carry||0)%EXPLORE_TICK_SEC) +'s</b></div>'+
      bar(tickPct) +
      '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #1f2937">'+rows+'</div>'+
      (rem>0? '<div style="color:#93c5fd;margin-top:8px">升級中（剩 '+fmt(Math.ceil(rem/60))+' 分）</div>'+bar(pct)
             : '<div style="margin-top:8px"><button id="exploreUp" style="background:#4f46e5;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer" '+(state.exploreLv>=EXPLORE_MAX?'disabled':'')+'>提升探索等級（花費 '+fmt(nextExploreCost())+' 鑽石｜需 2 小時）</button></div>')+
      // 紀錄
      '<div style="margin-top:12px;border-top:1px solid #1f2937;padding-top:6px">'+
      '<div style="opacity:.9;font-weight:700;margin-bottom:6px">探索紀錄</div>'+
      '<div style="max-height:160px;overflow:auto;border:1px solid #1f2937;border-radius:6px;padding:6px 8px;background:#0b1220">'+
      (state.exploreLog && state.exploreLog.length? state.exploreLog.map(function(s){ return '<div style="padding:2px 0;border-bottom:1px dashed #1f2937">'+s+'</div>'; }).join('') : '<div style="opacity:.6">（目前沒有紀錄）</div>')+
      '</div></div>'
    );

    var be = byId('exploreUp'); if (be) be.onclick = tryUpgrade;
  }

  function card(title, inner){ return '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:10px;margin-bottom:12px"><div style="font-weight:700;margin-bottom:6px">'+title+'</div>'+inner+'</div>'; }

  // 註冊分頁
  w.TownHub.registerTab({ id:'explore', title:'探索', render:render, tick:tick });
})(window);