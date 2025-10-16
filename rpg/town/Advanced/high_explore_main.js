// ==========================================
// high_explore_main.js — 高級探索 V4 (Auto-Diff) — 段位版
// 多槽 / 自動難度 / 段位門檻 / 免費次數 / 內建獎勵一覽
// ✨ 加入：掉落表更新提示（偵測 HighExploreData 變更，吐司 + 自動展開獎勵一覽）
// 依賴：TownHub；可選：HighExploreData、HighExploreDrops、HighExploreEvents、combat_power.js（computeCombatPower + getRankByCP）
// ==========================================
(function (w) {
  "use strict";
  if (!w.TownHub || typeof w.TownHub.registerTab !== "function") return;

  // ===== 工具 =====
  function nowSec(){ return Math.floor(Date.now()/1000); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function toInt(n){ n=Number(n); return (isFinite(n) ? Math.floor(n) : 0); }
  function byId(id){ return document.getElementById(id); }
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function upd(){ try{ w.updateResourceUI && w.updateResourceUI(); }catch(_){} }
  function saveGame(){ try{ w.saveGame && w.saveGame(); }catch(_){} }
  function addItem(name, qty){ qty=toInt(qty||1); if(qty<=0) return; try{ w.addItem && w.addItem(name, qty); }catch(_){} }
  function getItemQuantity(name){ try{ return toInt(w.getItemQuantity? w.getItemQuantity(name):0);}catch(_){return 0;} }
  function removeItem(name, qty){ try{ w.removeItem && w.removeItem(name, toInt(qty||1)); }catch(_){} }
  function nznum(x, d){ x=Number(x); return (isFinite(x)? x : (d||0)); }
  function randInt(min, max){ min=Math.floor(min); max=Math.floor(max); return Math.floor(Math.random()*(max-min+1))+min; }

  // ----- 段位工具（F- → SSS+）-----
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
    return "F-"; // 沒載 combat_power.js 時保底
  }
  function meetsRankRequirement(reqRank){
    // 若新資料：reqRank；若舊資料：reqCP（向下相容）
    if (reqRank == null) return true;
    var cur = getPlayerRankLabel();
    return rankIndex(cur) >= rankIndex(reqRank);
  }

  // --- 小吐司（可與既有 showToast 共存）---
  function showToast(msg, isError){
    var id='toast-mini', el=document.getElementById(id);
    if(!el){
      el=document.createElement('div');
      el.id=id;
      Object.assign(el.style,{
        position:'fixed',top:'16px',right:'16px',zIndex:'9999',
        background:'#10b981',color:'#0b1220',padding:'8px 12px',
        borderRadius:'10px',boxShadow:'0 8px 24px rgba(0,0,0,.35)',
        fontWeight:'700',transition:'transform .2s ease, opacity .2s ease',
        opacity:'0',transform:'translateY(-6px)'
      });
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateY(0)'; });
    }
    el.textContent=msg;
    el.style.background=isError?'#ef4444':'#10b981';
    clearTimeout(el._timer);
    el._timer=setTimeout(()=>{
      el.style.opacity='0'; el.style.transform='translateY(-6px)';
      setTimeout(()=>el.remove(),220);
    },1600);
  }

  // --- 掉落表簽章（偵測 HighExploreData 是否變更）---
  function _fnv1a(str){
    var h=0x811c9dc5|0;
    for(var i=0;i<str.length;i++){
      h^=str.charCodeAt(i);
      h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0;
    }
    return (h>>>0).toString(16);
  }
  function getData(){ return w.HighExploreData || {}; }
  function _dropsSignature(){
    var D=getData();
    var pack={
      difficulties:(Array.isArray(D.difficulties)? D.difficulties.map(function(d){return{
        id:d.id,name:d.name,
        // 兼容：舊資料用 reqCP，新資料用 reqRank
        reqCP:+(d.reqCP||0),
        reqRank:(d.reqRank||null),
        chanceMult:+(d.chanceMult!=null?d.chanceMult:d.dropMult||1),
        qtyMult:+(d.qtyMult||1),
        expMult:+(d.expMult||1)
      };}):[]),
      rewards:(Array.isArray(D.rewards)? D.rewards.map(function(r){return{
        type:r.type,key:r.key,name:r.name,rate:+(r.rate||0),qty:r.qty
      };}):[]),
      guaranteed:(Array.isArray(D.guaranteed||D.fixedRewards)? (D.guaranteed||D.fixedRewards).map(function(g){return{
        type:g.type,key:g.key,name:g.name,baseQty:g.baseQty,qty:g.qty
      };}):[])
    };
    // 排序避免順序差異誤判
    pack.rewards.sort(function(a,b){return String(a.name||a.key).localeCompare(String(b.name||b.key),'zh-Hant');});
    pack.guaranteed.sort(function(a,b){return String(a.name||a.key).localeCompare(String(b.name||b.key),'zh-Hant');});
    return _fnv1a(JSON.stringify(pack));
  }

  // ===== 常數 =====
  var LS_KEY = "HIGH_EXPLORE_V4";
  var DROPS_SIG_KEY = "HIGH_EXPLORE_DROPS_SIG";
  var SLOT_MAX = 4;
  var SLOT_BASE = 1;
  var SLOT_UNLOCK_COST = 5000; // 💎
  var RUN_SEC = 800;
  var TICKET_NAME = "高級探索券";

  // 免費次數規則
  var FREE_INIT = 5;
  var FREE_MAX = 20;
  var FREE_REFILL_SEC = 3600; // 每小時 +1

  // ===== 讀取難度/獎勵（兼容欄位）=====
  function getDiffs(){
    var D = getData();
    return Array.isArray(D.difficulties) ? D.difficulties : [];
  }
  function getDiffById(id){
    var L = getDiffs(); if (!L.length) return null;
    for (var i=0;i<L.length;i++){
      var did = L[i].id || ("D"+i);
      if (did === id) return L[i];
    }
    return L[0];
  }
  function getRewards(){
    var D = getData();
    return Array.isArray(D.rewards) ? D.rewards : [];
  }
  function getFixedRewards(){
    var D = getData();
    if (Array.isArray(D.fixedRewards)) return D.fixedRewards;
    if (Array.isArray(D.guaranteed))   return D.guaranteed;
    return [];
  }

  // ===== 自動選難度（優先用 reqRank；無段位 API 時回退 reqCP）=====
  function canEnterDiff(d){
    // 若 HighExploreData 已提供 canEnterTier，優先用它
    try {
      if (w.HighExploreData && typeof w.HighExploreData.canEnterTier === "function") {
        return w.HighExploreData.canEnterTier(d.id || "");
      }
    } catch(_){}
    // 自行檢查 reqRank 或 reqCP
    if (d && d.reqRank != null) {
      return meetsRankRequirement(d.reqRank);
    }
    // 舊版 reqCP 回退
    var cpReq = nznum(d && d.reqCP, 0);
    if (cpReq <= 0) return true;
    var cp = 0;
    try { cp = (typeof w.computeCombatPower==="function") ? w.computeCombatPower(w.player) : 0; } catch(_){}
    return cp >= cpReq;
  }
  function getAutoDiffIdByRank() {
    var diffs = getDiffs();
    if (!diffs.length) return "R01";
    var best = diffs[0].id || "R01";
    for (var i=0;i<diffs.length;i++){
      var d = diffs[i], id = d.id || ("R"+(i+1));
      if (canEnterDiff(d)) best = id;
    }
    return best;
  }
  function getNextDiffInfo() {
    var diffs = getDiffs();
    for (var i=0;i<diffs.length;i++){
      if (!canEnterDiff(diffs[i])) return diffs[i];
    }
    return null; // 已達最高
  }

  // ===== 狀態 =====
  var state = (function load(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return fresh();
      var o = JSON.parse(raw);

      o.slots = normalizeSlots(o.slots);
      o.log = o.log || [];

      o.freeCharges = clamp(toInt(o.freeCharges!=null?o.freeCharges:FREE_INIT), 0, FREE_MAX);
      o.lastRefillAt = toInt(o.lastRefillAt||nowSec());

      // 舊欄位保留（不再使用選單）
      o.globalDiffId = String(o.globalDiffId || getAutoDiffIdByRank());

      o.showRewards = !!o.showRewards;
      o._dropsSigChecked = !!o._dropsSigChecked;
      return o;
    }catch(_){ return fresh(); }

    function fresh(){
      var s = {
        slots: [],
        log: [],
        freeCharges: FREE_INIT,
        lastRefillAt: nowSec(),
        globalDiffId: getAutoDiffIdByRank(),
        showRewards: false,
        _dropsSigChecked: false
      };
      for (var i=0; i<SLOT_BASE; i++) s.slots.push(newSlot(i));
      return s;
    }
  })();

  function newSlot(idx){
    return {
      id: idx,
      enabled: true,
      running: false,
      startAt: 0,
      duration: RUN_SEC,
      lastResult: null,
      currentDiffId: null // ★ 每次開始探索時鎖定的段位難度
    };
  }

  function normalizeSlots(slots){
    var out = [];
    if (!Array.isArray(slots)) slots = [];
    for (var i=0;i<slots.length;i++){
      var s=slots[i]||{};
      out.push({
        id: toInt(s.id||i),
        enabled: (s.enabled!==false),
        running: !!s.running,
        startAt: toInt(s.startAt||0),
        duration: toInt(s.duration||RUN_SEC),
        lastResult: s.lastResult || null,
        currentDiffId: s.currentDiffId || null
      });
    }
    if (out.length < SLOT_BASE){
      for (var k=out.length; k<SLOT_BASE; k++) out.push(newSlot(k));
    }
    return out;
  }

  function saveLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(_){ } }

  // ===== 免費次數回補 =====
  function ensureRefill(){
    var now = nowSec();
    if (state.freeCharges >= FREE_MAX) { state.lastRefillAt = now; return; }
    var elapsed = Math.max(0, now - toInt(state.lastRefillAt||now));
    if (elapsed < FREE_REFILL_SEC) return;
    var add = Math.floor(elapsed / FREE_REFILL_SEC);
    if (add > 0){
      state.freeCharges = clamp(state.freeCharges + add, 0, FREE_MAX);
      state.lastRefillAt += add * FREE_REFILL_SEC; // 平移，保留殘餘
      saveLocal();
    }
  }

  // ===== 掉落計算 =====
  function computeDropsForDiff(diffId){
    // 1) 官方引擎（HighExploreDrops）
    try{
      if (w.HighExploreDrops && typeof w.HighExploreDrops.rollOnceByTier==="function"){
        return w.HighExploreDrops.rollOnceByTier(diffId) || [];
      }
    }catch(_){}
    // 2) 視圖函式（HighExploreData）
    try{
      if (w.HighExploreData && typeof w.HighExploreData.getViewForTier==="function"){
        var view = w.HighExploreData.getViewForTier(diffId);
        var bag = [], i, j;
        // 固定
        for (i=0;i<view.guaranteed.length;i++){
          var g = view.guaranteed[i];
          var q = (g.min===g.max)? g.min : randInt(g.min, g.max);
          if (q>0) bag.push({ type:g.type, key:(g.name||g.key), qty:q });
        }
        // 隨機（用 effRate）
        for (j=0;j<view.random.length;j++){
          var r = view.random[j];
          if (Math.random() < r.effRate){
            var rq = (r.min===r.max)? r.min : randInt(r.min, r.max);
            if (rq>0) bag.push({ type:r.type, key:(r.name||r.key), qty:rq });
          }
        }
        return bag;
      }
    }catch(_){}
    // 3) 備援（兼容舊 dropMult/qtyMult）
    var diff = getDiffById(diffId) || {};
    var chanceMult = nznum(diff.chanceMult!=null? diff.chanceMult : diff.dropMult, 1);
    var qtyMult    = nznum(diff.qtyMult, 1);

    var bag2 = [], fixed = getFixedRewards(), rewards = getRewards(), i2;
    for (i2=0;i2<fixed.length;i2++){
      var f = fixed[i2];
      var fq;
      if (Array.isArray(f.baseQty)) {
        var fmin = Math.max(1, toInt(f.baseQty[0]*qtyMult));
        var fmax = Math.max(fmin, toInt(f.baseQty[1]*qtyMult));
        fq = randInt(fmin, fmax);
      } else {
        var base = toInt(f.baseQty!=null ? f.baseQty : f.qty);
        fq = Math.max(1, toInt(base * qtyMult));
      }
      if (fq>0) bag2.push({ type:f.type||"item", key:(f.key||f.name||"?"), qty:fq });
    }
    for (i2=0;i2<rewards.length;i2++){
      var r2 = rewards[i2];
      var rate = clamp(nznum(r2.rate,0) * chanceMult, 0, 1);
      if (Math.random() < rate){
        var q2 = 1;
        if (Array.isArray(r2.qty)){
          var min = Math.max(1, toInt(r2.qty[0] * qtyMult));
          var max = Math.max(min, toInt(r2.qty[1] * qtyMult));
          q2 = randInt(min, max);
        } else if (r2.qty != null){
          q2 = Math.max(1, toInt(nznum(r2.qty,1) * qtyMult));
        }
        if (q2>0) bag2.push({ type:r2.type||"item", key:(r2.key||r2.name||"?"), qty:q2 });
      }
    }
    return bag2;
  }

  // ===== 隨機事件掛鉤 =====
  function tryRandomEvent(slot){
    try{
      if (w.HighExploreEvents && typeof w.HighExploreEvents.checkAndMaybeTrigger === "function"){
        w.HighExploreEvents.checkAndMaybeTrigger(slot);
      }
    }catch(_){}
  }

  // ===== 可否開始：用「目前段位對應的自動難度」判定 =====
  function canStartAny(){
    var autoId = getAutoDiffIdByRank();
    var diff = getDiffById(autoId);
    var ok = diff ? canEnterDiff(diff) : true;
    if (!ok) return false;
    return (state.freeCharges > 0 || getItemQuantity(TICKET_NAME) > 0);
  }

  // ===== 開始 / 結束 =====
  function getSlot(id){ for (var i=0;i<state.slots.length;i++) if (state.slots[i].id===id) return state.slots[i]; return null; }

  function startRun(slotId){
    ensureRefill();
    var slot = getSlot(slotId);
    if (!slot || slot.running) return false;
    if (!canStartAny()) return false;

    // 優先用免費次數
    if (state.freeCharges > 0){
      state.freeCharges = Math.max(0, state.freeCharges - 1);
      saveLocal();
    } else {
      removeItem(TICKET_NAME, 1);
    }

    // ★ 鎖定當前自動段位難度（這一趟固定用它）
    slot.currentDiffId = getAutoDiffIdByRank();

    slot.running = true;
    slot.startAt = nowSec();
    slot.duration = RUN_SEC;
    saveLocal(); upd(); saveGame();
    return true;
  }

  function finishRun(slot){
    var drops = [];
    var diffId = slot.currentDiffId || getAutoDiffIdByRank();

    try {
      drops = computeDropsForDiff(diffId) || [];
    } catch (e) {
      console.error("[HighExplore] drop error:", e);
    }

    // 發獎
    for (var k=0;k<drops.length;k++){
      var d = drops[k], q = Math.max(1, (d.qty|0)), key = d.key;
      if (d.type === "gem" && w.player) {
        w.player.gem  = (w.player.gem  || 0) + q;
      } else if (d.type === "gold" && w.player) {
        w.player.gold = (w.player.gold || 0) + q;
      } else if (d.type === "stone" && w.player) {
        w.player.stone = (w.player.stone || 0) + q;
      } else if (d.type === "exp" && w.player) {          // EXP 直接吃進經驗
        if (typeof w.addExp === "function") w.addExp(q);
        else if (typeof w.gainExp === "function") w.gainExp(q);
        else if (player.exp != null) player.exp = (player.exp || 0) + q;
      } else {
        addItem(key, q); // 其他進背包
      }
    }

    upd(); saveGame();

    // 紀錄
    var line = { at: nowSec(), diffId: diffId, drops: drops };
    slot.lastResult = line;
    state.log.unshift(renderLogLine(line));
    if (state.log.length > 50) state.log.length = 50;

    // 收尾
    slot.running = false;
    slot.startAt = 0;
    slot.currentDiffId = null;
    saveLocal();
    tryRandomEvent(slot);
  }

  // ===== tick =====
  function tick(sec){
    ensureRefill();
    var changed=false;
    for (var i=0;i<state.slots.length;i++){
      var s=state.slots[i];
      if(!s.running)continue;
      var t=nowSec();
      if(t>=s.startAt+s.duration){
        finishRun(s);
        changed=true;
      }
    }
    if(changed){saveLocal();upd();saveGame();}
  }

  // ===== UI =====
  function bar(pct){
    pct=clamp(pct,0,100);
    return '<div style="height:8px;background:#0b1220;border-radius:999px;overflow:hidden;margin-top:6px">'+
             '<span style="display:block;height:100%;width:'+pct+'%;background:linear-gradient(90deg,#60a5fa,#34d399)"></span>'+
           '</div>';
  }
  function card(title, inner){
    return '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:10px;margin-bottom:12px">'+
             '<div style="font-weight:700;margin-bottom:6px">'+title+'</div>'+ inner +'</div>';
  }
  function remainPct(slot){
    if(!slot.running)return 0;
    var t=nowSec();
    var used=clamp(t-slot.startAt,0,slot.duration);
    return Math.floor(used/slot.duration*100);
  }
  function remainSec(slot){
    if(!slot.running)return 0;
    var t=nowSec();
    return Math.max(0,(slot.startAt+slot.duration)-t);
  }
  function renderLogLine(line){
    var time=new Date(line.at*1000).toLocaleTimeString();
    if(!line.drops||!line.drops.length)return time+' … 未獲得任何物品';
    var s=line.drops.map(function(d){
      var icon = (d.type==='gem'?'💎' : (d.type==='gold'?'🪙':'📦'));
      return icon + d.key + '×' + d.qty;
    }).join('、');
    var diff=getDiffById(line.diffId);
    return time+' 取得：'+s+'（'+(diff?diff.name:line.diffId)+'）';
  }

  function renderRewardsTable(){
    var autoId = getAutoDiffIdByRank();
    var diff = getDiffById(autoId) || {};
    var dropMult = nznum((diff.dropMult!=null? diff.dropMult : diff.chanceMult), 1);
    var qtyMult  = nznum(diff.qtyMult, 1);

    var fixed = getFixedRewards();
    var rewards = getRewards();
    var rows = '', i, r;

    // 固定掉落
    for (i=0;i<fixed.length;i++){
      var f = fixed[i];
      var q;
      if (Array.isArray(f.baseQty)){
        var fmin = Math.max(1, toInt(f.baseQty[0] * qtyMult));
        var fmax = Math.max(fmin, toInt(f.baseQty[1] * qtyMult));
        q = fmin+'–'+fmax;
      } else {
        var base = toInt(f.baseQty!=null ? f.baseQty : f.qty);
        q = fmt(Math.max(1, toInt(base*qtyMult)));
      }
      rows += '<tr>'+
        '<td style="padding:6px 8px;border-bottom:1px dashed #1f2937;">'+(f.name||f.key||'?')+'</td>'+
        '<td style="padding:6px 8px;border-bottom:1px dashed #1f2937;opacity:.85;">'+(f.type||"")+'</td>'+
        '<td style="padding:6px 8px;border-bottom:1px dashed #1f2937;text-align:right;"><b>'+q+'</b>（固定）</td>'+
        '<td style="padding:6px 8px;border-bottom:1px dashed #1f2937;text-align:right;opacity:.6">—</td>'+
      '</tr>';
    }

    // 機率掉落
    for (i=0;i<rewards.length;i++){
      r = rewards[i];
      var baseRate = nznum(r.rate,0);
      var effRate  = Math.min(1, baseRate * dropMult);

      var qtyStr = 'x1';
      if (Array.isArray(r.qty)){
        var min = Math.max(1, toInt(r.qty[0] * qtyMult));
        var max = Math.max(min, toInt(r.qty[1] * qtyMult));
        qtyStr = 'x' + fmt(min) + '–' + fmt(max);
      } else if (r.qty != null){
        qtyStr = 'x' + fmt(Math.max(1, toInt(r.qty * qtyMult)));
      }

      rows += '<tr>'+
        '<td style="padding:6px 8px;border-bottom:1px dashed #1f2937;">'+(r.name||r.key||'?')+'</td>'+
        '<td style="padding:6px 8px;border-bottom:1px dashed #1f2937;opacity:.85;">'+(r.type||"")+'</td>'+
        '<td style="padding:6px 8px;border-bottom:1px dashed #1f2937;text-align:right;">'+qtyStr+'</td>'+
        '<td style="padding:6px 8px;border-bottom:1px dashed #1f2937;text-align:right;"><b>'+ (effRate*100).toFixed(2) +'%</b></td>'+
      '</tr>';
    }

    if (!rows) rows = '<tr><td colspan="4" style="padding:10px;opacity:.7">（尚未設定獎勵資料）</td></tr>';

    return ''+
    '<div style="border:1px solid #1f2937;border-radius:10px;overflow:hidden;background:#0b1220">'+
      '<table style="width:100%;border-collapse:collapse;font-size:14px;">'+
        '<thead style="background:#0f172a">'+
          '<tr>'+
            '<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #1f2937;">獎勵</th>'+
            '<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #1f2937;">類型</th>'+
            '<th style="text-align:right;padding:8px 10px;border-bottom:1px solid #1f2937;">數量（含倍率）</th>'+
            '<th style="text-align:right;padding:8px 10px;border-bottom:1px solid #1f2937;">加成後機率</th>'+
          
       ' </thead>'+
        '<tbody>'+rows+'</tbody>'+
      '</table>'+
    '</div>';
  }

  function renderSlot(slot){
    var pct=remainPct(slot);
    var remS=remainSec(slot);
    var ticket=getItemQuantity(TICKET_NAME);
    var last=slot.lastResult;

    var lastHtml = last
      ? ('<div style="font-size:12px;opacity:.85;margin-top:6px">上次：'+(last.drops&&last.drops.length
          ? last.drops.map(function(d){
              var icon = (d.type==='gem'?'💎' : (d.type==='gold'?'🪙':'📦'));
              return icon + d.key + '×' + d.qty;
            }).join('、')
          : '未獲得任何物品')+'</div>')
      : '<div style="font-size:12px;opacity:.6;margin-top:6px">（尚無紀錄）</div>';

    var canStartNow = (!!slot && !slot.running && canStartAny());
    var runningHtml=slot.running
      ? ('<div class="mini" style="opacity:.85">倒數：<b>'+remS+'s</b>（免費次數：'+state.freeCharges+'｜'+TICKET_NAME+'：'+ticket+'）</div>'+bar(pct))
      : ('<div class="mini" style="opacity:.85">狀態：<b>閒置</b>（免費次數：'+state.freeCharges+'｜'+TICKET_NAME+'：'+ticket+'）</div>');

    // 頂部顯示：需求段位 或（回退）需求CP
    var autoId = getAutoDiffIdByRank();
    var diff = getDiffById(autoId);
    var meetRank = diff ? canEnterDiff(diff) : true;

    var reqInfo = '';
    if (diff && diff.reqRank){
      reqInfo = '需求段位：<b style="color:'+(meetRank?'#34d399':'#fca5a5')+'">'+diff.reqRank+'</b>';
    } else {
      var reqCP = diff ? (diff.reqCP||0) : 0;
      var cp = 0; try{ cp = (typeof w.computeCombatPower==="function") ? w.computeCombatPower(w.player):0; }catch(_){}
      reqInfo = '需求CP：<b style="color:'+(cp>=reqCP?'#34d399':'#fca5a5')+'">'+fmt(reqCP)+'</b>｜你的戰力：<b>'+fmt(cp)+'</b>';
    }

    var controlHtml =
      '<div style="display:flex;gap:8px;align-items:center;margin-top:8px">'+
        '<button data-sid="'+slot.id+'" class="btn-start" '+
          'style="background:'+(meetRank?'#10b981':'#6b7280')+';border:none;color:#0b1220;border-radius:8px;padding:6px 10px;cursor:'+(canStartNow?'pointer':'not-allowed')+'" '+
          (canStartNow?'':'disabled')+'>開始探索（優先消耗免費次數）</button>'+
      '</div>'+
      '<div style="font-size:12px;opacity:.75;margin-top:4px">'+reqInfo+'</div>';

    return card('⚔️ 探索槽 #'+(slot.id+1)+(slot.enabled?'':'（停用）'),
      runningHtml + controlHtml + lastHtml
    );
  }

  function render(container){
    ensureRefill();

    // —— 掉落表變更偵測：只在本次載入後第一次進分頁時檢查 ——
    if (!state._dropsSigChecked) {
      var curSig = _dropsSignature();
      var prevSig = "";
      try { prevSig = localStorage.getItem(DROPS_SIG_KEY) || ""; } catch(_) {}
      if (curSig && curSig !== prevSig) {
        try { localStorage.setItem(DROPS_SIG_KEY, curSig); } catch(_) {}
        state.showRewards = true; // 自動展開
        saveLocal();
        showToast("🧩 掉落表已更新並套用");
      }
      state._dropsSigChecked = true;
    }

    // 頂部：顯示目前自動難度 + 下一檔段位門檻 + 免費規則
    var autoId = getAutoDiffIdByRank();
    var curDiff = getDiffById(autoId);
    var nextDiff = getNextDiffInfo();

    var nextInfo = '';
    if (nextDiff){
      if (nextDiff.reqRank){
        nextInfo = '下一檔：'+nextDiff.name+'｜需求段位：<b>'+nextDiff.reqRank+'</b>';
      }else{
        nextInfo = '下一檔：'+nextDiff.name+'｜需求CP：<b>'+fmt(nextDiff.reqCP||0)+'</b>';
      }
    }else{
      nextInfo = '已達最高難度';
    }

    var headerHtml =
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+
        '<div>難度：<b>'+ (curDiff?curDiff.name:autoId) +'</b>（依段位自動調整）</div>'+
        '<div style="opacity:.8;font-size:12px">'+nextInfo+'</div>'+
        '<button id="hexpToggleRewards" style="background:#4f46e5;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer">'+
          (state.showRewards?'隱藏獎勵一覽':'顯示獎勵一覽')+
        '</button>'+
      '</div>'+
      '<div style="opacity:.85;margin-top:6px">一次探索耗時：<b>'+RUN_SEC+' 秒</b>；使用道具：<b>'+TICKET_NAME+'</b></div>'+
      '<div style="margin-top:6px;font-size:12px;opacity:.85">免費次數：<b>'+state.freeCharges+' / '+FREE_MAX+'</b>｜每小時 +1（上限 '+FREE_MAX+'）</div>'+
      (state.showRewards ? ('<div style="margin-top:10px">'+renderRewardsTable()+'</div>') : '');

    // 槽位
    var slotsHtml='';
    for(var i=0;i<state.slots.length;i++) slotsHtml+=renderSlot(state.slots[i]);

    // 解鎖
    var canUnlock=state.slots.length<SLOT_MAX;
    var unlockHtml=canUnlock
      ? '<button id="hexpUnlock" style="background:#fbbf24;border:none;color:#0b1220;border-radius:8px;padding:6px 10px;cursor:pointer">解鎖新探索槽（花費 '+fmt(SLOT_UNLOCK_COST)+' 💎）</button>'
      : '<div style="opacity:.7">已達探索槽上限（'+SLOT_MAX+'）</div>';

    // 紀錄
    var logHtml=(state.log&&state.log.length
      ? state.log.map(function(s){return'<div style="padding:2px 0;border-bottom:1px dashed #1f2937">'+s+'</div>';}).join('')
      : '<div style="opacity:.6">（目前沒有紀錄）</div>');

    container.innerHTML =
      card('🏔 高級探索（使用票券 / 免費次數，無獎勵上限）', headerHtml) +
      card('🎛 探索槽管理',
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px">'+slotsHtml+'</div>'+
        '<div style="margin-top:10px">'+unlockHtml+'</div>'
      )+
      card('📝 探索紀錄',
        '<div style="max-height:220px;overflow:auto;border:1px solid #1f2937;border-radius:6px;padding:6px 8px;background:#0b1220">'+logHtml+'</div>'
      );

    // 綁定：開始
    var btns=container.querySelectorAll('.btn-start');
    for(var i=0;i<btns.length;i++){
      btns[i].onclick=function(){
        var sid=toInt(this.getAttribute('data-sid'));
        startRun(sid);
        w.TownHub.requestRerender();
      };
    }
    // 顯示/隱藏獎勵
    var tg = byId('hexpToggleRewards');
    if (tg){
      tg.onclick = function(){
        state.showRewards = !state.showRewards;
        saveLocal();
        w.TownHub.requestRerender();
      };
    }
    // 解鎖槽
    var bu=byId('hexpUnlock');
    if(bu){
      bu.onclick=function(){
        if(state.slots.length>=SLOT_MAX)return;
        var gem=toInt(w.player&&(w.player.gem||0));
        if(gem<SLOT_UNLOCK_COST)return;
        w.player.gem=Math.max(0,gem-SLOT_UNLOCK_COST);
        state.slots.push(newSlot(state.slots.length));
        saveLocal();upd();saveGame();w.TownHub.requestRerender();
      };
    }
  }

  // ===== 註冊分頁 =====
  w.TownHub.registerTab({
    id:'high_explore',
    title:'高級探索',
    render:render,
    tick:tick
  });
})(window);