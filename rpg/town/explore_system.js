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
  function saveGame(){ try{ w.saveGame && w.saveGame(); }catch(_){} }
  function addItem(name, qty){ qty=toInt(qty||1); if(qty<=0) return; try{ w.addItem && w.addItem(name, qty); }catch(_){} }
  function getItemQuantity(name){ try{ return toInt(w.getItemQuantity? w.getItemQuantity(name):0);}catch(_){return 0;} }

  // ★ 新增：格式化 HH:MM:SS
  function fmtHMS(sec){
    sec = Math.max(0, toInt(sec));
    var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
    function p(v){ return (v<10?'0':'')+v; }
    return p(h)+':'+p(m)+':'+p(s);
  }
  // ★ 新增：距離當地「明日 00:00:00」的秒數
  function secUntilReset(){
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,0,0);
    return Math.max(0, Math.floor((next - now)/1000));
  }

  // ====== 參數 ======
  var LS_KEY = 'EXPLORE_SPLIT_V2_MULTI';
  var EXPLORE_TICK_SEC = 60;      // 每隊每分鐘嘗試一次
  var EXPLORE_CAP_PER_LV = 0.10;  // 每級 +10% 每日上限
  var EXPLORE_MAX = 20;
  var EXPLORE_UP_COST_BASE = 500; // 花費：500 × (lv+1)
  var EXPLORE_UP_HOURS = 2 * 3600; // 秒

  var SQUADS_BASE = 1;
  var SQUADS_MAX  = 3;
  var SQUAD_UNLOCK_COST = 3000;

  var EXPLORE_TABLE = [
    { name: '鑽石',           type: 'gem',    cap: 20,  rate: 0.01 },
    { name: 'SP點數券',       type: 'item',   key: 'sp點數券', cap: 2,   rate: 0.002 },
    { name: '精華',           type: 'ess_any',cap: 30,  rate: 0.05 },
    { name: '技能強化券',     type: 'item',   key: '技能強化券', cap: 2,   rate: 0.0001 },
    { name: '元素碎片',       type: 'item',   key: '元素碎片',   cap: 70, rate: 0.03 },
    { name: '進階石',         type: 'item',   key: '進階石',     cap: 50, rate: 0.03 },
    { name: '元素精華',       type: 'item',   key: '元素精華',   cap: 3,  rate: 0.003 },
    { name: '衝星石',         type: 'item',   key: '衝星石',     cap: 30, rate: 0.05 },
    { name: '星之碎片',       type: 'item',   key: '星之碎片',   cap: 30, rate: 0.03 },
    { name: '低階潛能解放鑰匙', type: 'item', key: '低階潛能解放鑰匙', cap: 15, rate: 0.05 },
    { name: '中階潛能解放鑰匙', type: 'item', key: '中階潛能解放鑰匙', cap: 10, rate: 0.03 },
    { name: '高階潛能解放鑰匙', type: 'item', key: '高階潛能解放鑰匙', cap: 5,  rate: 0.01 },
    { name: '怪物獎牌',       type: 'item',   key: '怪物獎牌',   cap: 50, rate: 0.05 },
    { name: '轉職寶珠',       type: 'item',   key: '轉職寶珠',   cap: 100, rate: 0.25 }
  ];

  // ====== 狀態 ======
  var state = (function load(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return fresh();
      var o = JSON.parse(raw);
      o.exploreLv = toInt(o.exploreLv||0);
      o.exploreUpStart = toInt(o.exploreUpStart||0);
      o.exploreToday = o.exploreToday || dailyKey();
      o.dropsCount = o.dropsCount || {};
      o.exploreLog = o.exploreLog || [];
      o.squads = o.squads || [];
      migrateSquads(o);
      return o;
    }catch(_){ return fresh(); }

    function fresh(){
      var s = {
        exploreLv: 0,
        exploreUpStart: 0,
        exploreToday: dailyKey(),
        dropsCount: {},
        exploreLog: [],
        squads: []
      };
      for (var i=0;i<SQUADS_BASE;i++) s.squads.push(newSquad(i));
      return s;
    }
    function migrateSquads(s){
      if (!s.squads || !s.squads.length){
        s.squads = [];
        for (var i=0;i<SQUADS_BASE;i++) s.squads.push(newSquad(i));
      }
      for (var j=0;j<s.squads.length;j++){
        var q = s.squads[j];
        q.id = toInt(q.id||j);
        q.enabled = (q.enabled!==false);
        q.lastTick = toInt(q.lastTick||nowSec());
        q._carry = toInt(q._carry||0);
      }
    }
  })();

  function newSquad(idx){ return { id: idx, name: '隊伍 '+(idx+1), enabled: true, lastTick: nowSec(), _carry: 0 }; }

  function saveLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(_){ } }
  function dailyKey(){ var d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
  function ensureToday(){
    var k=dailyKey();
    if(state.exploreToday!==k){ state.exploreToday=k; state.dropsCount={}; saveLocal(); }
  }

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

  function tryUpgrade(){
    if (state.exploreLv >= EXPLORE_MAX) return;
    if (remainUpgradeSec() > 0) return;
    var cost = nextExploreCost();
    var gem = toInt(w.player && (w.player.gem||0));
    if (gem < cost) return;
    w.player.gem = gem - cost;
    state.exploreUpStart = nowSec();
    saveLocal(); upd(); saveGame();
  }
  function finishUpgrade(){
    var r=remainUpgradeSec(); if (r>0||!state.exploreUpStart) return;
    state.exploreUpStart=0; state.exploreLv=clamp(state.exploreLv+1,0,EXPLORE_MAX);
    saveLocal();
  }

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
    return gotAny;
  }

  function tickSquad(q){
    var t=nowSec(); var last=toInt(q.lastTick||t); var realDt=Math.max(0,t-last); q.lastTick=t;
    q._carry = toInt(q._carry||0) + realDt;
    var changed = false;
    while (q.enabled && q._carry >= EXPLORE_TICK_SEC){
      q._carry -= EXPLORE_TICK_SEC;
      if (doExploreOnce()) changed = true;
      else changed = true; // 即使未掉落，log/計數可能改變
    }
    return changed;
  }

  // ★ 每秒一次的總 tick；最後一定請求重繪，讓倒數會更新
  var _exploreTickGate = 0;
  function tick(sec){
    _exploreTickGate += Number(sec)||0;
    if (_exploreTickGate < 1) return;
    _exploreTickGate = 0;

    var changed = false;

    var beforeLv = state.exploreLv;
    finishUpgrade();
    if (state.exploreLv !== beforeLv) changed = true;

    if (state.squads && state.squads.length){
      for (var i=0;i<state.squads.length;i++){
        if (tickSquad(state.squads[i])) changed = true;
      }
    }

    if (changed){
      saveLocal();
      upd();
      saveGame();
    }

    // ★ 新增：確保倒數每秒刷新
    try { w.TownHub.requestRerender && w.TownHub.requestRerender(); } catch(_) {}
  }

  function bar(pct){ pct=clamp(pct,0,100); return '<div style="height:8px;background:#0b1220;border-radius:999px;overflow:hidden;margin-top:6px"><span style="display:block;height:100%;width:'+pct+'%;background:linear-gradient(90deg,#60a5fa,#34d399)"></span></div>'; }
  function card(title, inner){ return '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:10px;margin-bottom:12px"><div style="font-weight:700;margin-bottom:6px">'+title+'</div>'+inner+'</div>'; }

  function remainPct(){ var rem = remainUpgradeSec(); if (rem<=0) return 0; return Math.floor(((EXPLORE_UP_HOURS - rem) / EXPLORE_UP_HOURS) * 100); }
  function squadTickPct(q){ return Math.floor(((toInt(q._carry||0) % EXPLORE_TICK_SEC) / EXPLORE_TICK_SEC) * 100); }

  function render(container){
    var caps = todayCapBase();

    var view = []; var i;
    for(i=0;i<EXPLORE_TABLE.length;i++) view.push({ rec:EXPLORE_TABLE[i], idx:i });
    view.sort(function(a,b){ return (b.rec.rate||0)-(a.rec.rate||0); });
    var rows=''; var used, cap, rec;
    for (i=0;i<view.length;i++){
      rec=view[i].rec; used=toInt(state.dropsCount[view[i].idx]||0); cap=caps[view[i].idx];
      rows += '\n<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px dashed #1f2937">'+
        '<div>'+rec.name+' <span style="opacity:.7">（機率 '+(((Number(rec.rate)||0)*100).toFixed(2))+'%）</span></div>'+
        '<div><b>'+used+'</b> / '+cap+'</div></div>';
    }

    var rem = remainUpgradeSec();
    var upHtml = (rem>0
      ? '<div style="color:#93c5fd;margin-top:8px">升級中（剩 '+fmt(Math.ceil(rem/60))+' 分）</div>'+bar(remainPct())
      : '<div style="margin-top:8px"><button id="exploreUp" style="background:#4f46e5;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer" '+(state.exploreLv>=EXPLORE_MAX?'disabled':'')+'>提升探索等級（花費 '+fmt(nextExploreCost())+' 鑽石｜需 2 小時）</button></div>'
    );

    var squadsHtml = '';
    for (i=0;i<state.squads.length;i++){
      var q = state.squads[i];
      var remainS = Math.ceil(EXPLORE_TICK_SEC - (toInt(q._carry||0)%EXPLORE_TICK_SEC));
      squadsHtml += card('👥 '+q.name+(q.enabled?'（運作中）':'（已暫停）'),
        '<div class="mini" style="opacity:.85">下次探索倒數：<b>'+ remainS +'s</b></div>'+
        bar(squadTickPct(q))+
        '<div style="margin-top:8px"><button data-sid="'+q.id+'" class="btn-toggle" style="background:#10b981;border:none;color:#0b1220;border-radius:8px;padding:6px 10px;cursor:pointer">'+(q.enabled?'暫停':'啟動')+'</button></div>'
      );
    }

    var canUnlock = state.squads.length < SQUADS_MAX;
    var unlockHtml = canUnlock
      ? '<button id="unlockSquad" style="background:#fbbf24;border:none;color:#0b1220;border-radius:8px;padding:6px 10px;cursor:pointer">解鎖新隊伍（花費 '+fmt(SQUAD_UNLOCK_COST)+' 鑽石）</button>'
      : '<div style="opacity:.7">已達隊伍上限（'+SQUADS_MAX+'）</div>';

    var logHtml = (state.exploreLog && state.exploreLog.length
      ? state.exploreLog.map(function(s){ return '<div style="padding:2px 0;border-bottom:1px dashed #1f2937">'+s+'</div>'; }).join('')
      : '<div style="opacity:.6">（目前沒有紀錄）</div>'
    );

    // ★ 新增：每日重置倒數顯示（到當地時間 00:00）
    var resetHtml =
      '<div style="margin:6px 0 0;opacity:.9">掉落上限重置倒數：<b>'+ fmtHMS(secUntilReset()) +'</b></div>';

    container.innerHTML =
      card('🔍 探索（每日 / 多隊）',
        '<div>探索等級：<b>Lv.'+state.exploreLv+' / '+EXPLORE_MAX+'</b>（每級每日上限 +10%）</div>'+
        resetHtml + // ★ 放在等級行下方
        upHtml+
        '<div style="margin-top:10px;padding-top:6px;border-top:1px solid #1f2937"><b>掉落進度（全隊共享）</b>'+rows+'</div>'
      )+
      card('📦 隊伍管理',
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">'+squadsHtml+'</div>'+
        '<div style="margin-top:10px">'+unlockHtml+'</div>'
      )+
      card('📝 探索紀錄',
        '<div style="max-height:180px;overflow:auto;border:1px solid #1f2937;border-radius:6px;padding:6px 8px;background:#0b1220">'+logHtml+'</div>'
      );

    var be = byId('exploreUp'); if (be) be.onclick = function(){ tryUpgrade(); w.TownHub.requestRerender(); };

    var buttons = container.querySelectorAll('.btn-toggle');
    for (i=0;i<buttons.length;i++){
      buttons[i].onclick = function(){
        var sid = toInt(this.getAttribute('data-sid'));
        for (var j=0;j<state.squads.length;j++){
          if (state.squads[j].id===sid){
            state.squads[j].enabled = !state.squads[j].enabled;
            break;
          }
        }
        saveLocal(); w.TownHub.requestRerender();
      };
    }

    var bu = byId('unlockSquad');
    if (bu){
      bu.onclick = function(){
        if (state.squads.length>=SQUADS_MAX) return;
        var gem = toInt(w.player && (w.player.gem||0));
        if (gem < SQUAD_UNLOCK_COST) return;
        w.player.gem = gem - SQUAD_UNLOCK_COST;
        var ns = newSquad(state.squads.length);
        state.squads.push(ns);
        saveLocal(); upd(); saveGame(); w.TownHub.requestRerender();
      };
    }
  }

  w.TownHub.registerTab({ id:'explore', title:'探索', render:render, tick:tick });
})(window);
