(function (w) {
  "use strict";
  if (!w.TownHub || typeof w.TownHub.registerTab !== 'function') return;

  // ===== 工具 =====
  function nowSec(){ return Math.floor(Date.now()/1000); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function toInt(n){ n=Number(n); return (isFinite(n)? Math.floor(n) : 0); }
  function byId(id){ return document.getElementById(id); }
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function upd(){ try{ w.updateResourceUI && w.updateResourceUI(); }catch(_){} }
  function saveGame(){ try{ w.saveGame && w.saveGame(); }catch(_){} }
  function addItem(name, qty){ qty=toInt(qty||1); if(qty<=0) return; try{ w.addItem && w.addItem(name, qty); }catch(_){} }
  function getItemQuantity(name){ try{ return toInt(w.getItemQuantity? w.getItemQuantity(name):0);}catch(_){return 0;} }
  function removeItem(name, qty){ qty=toInt(qty||1); if(qty<=0) return; try{ w.removeItem && w.removeItem(name, qty); }catch(_){} }

  // ★ 吐司提示
  function showToast(msg, isError){
    var id = 'toast-mini';
    var el = document.getElementById(id);
    if (!el){
      el = document.createElement('div');
      el.id = id;
      Object.assign(el.style, {
        position: 'fixed', top: '16px', right: '16px', zIndex: '9999',
        background: '#10b981', color: '#0b1220', padding: '8px 12px',
        borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        fontWeight: '700', transition: 'transform .2s ease, opacity .2s ease',
        opacity: '0', transform: 'translateY(-6px)'
      });
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateY(0)'; });
    }
    el.textContent = msg;
    el.style.background = isError ? '#ef4444' : '#10b981';
    clearTimeout(el._timer);
    el._timer = setTimeout(()=>{
      el.style.opacity='0'; el.style.transform='translateY(-6px)';
      setTimeout(()=>el.remove(), 220);
    }, 1600);
  }

  function fmtHMS(sec){
    sec = Math.max(0, toInt(sec));
    var h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
    function p(v){return(v<10?'0':'')+v;}
    return p(h)+':'+p(m)+':'+p(s);
  }
  function secUntilReset(){
    var now=new Date(); var next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,0,0);
    return Math.max(0, Math.floor((next-now)/1000));
  }

  // ★ 排序鍵與方向
  var SORT_KEYS = ['name','rate','qty','cap']; // 名稱 / 機率 / 獲得數量 / 最大數量
  var SORT_LABEL = { name:'名稱', rate:'機率', qty:'獲得數量', cap:'最大數量' };

  // ===== 參數 =====
  var LS_KEY='EXPLORE_SPLIT_V3_MULTI';
  var EXPLORE_TICK_SEC=60;          // 每隊每分鐘檢查一次
  var EXPLORE_CAP_PER_LV=0.10;      // 每級 +10% 每日上限
  var EXPLORE_MAX=20;               // 探索等級上限
  var EXPLORE_UP_COST_BASE=500;     // 升級費用：500 × (lv+1)
  var EXPLORE_UP_HOURS=2*3600;      // 升級耗時：2 小時（秒）
  var SQUADS_BASE=1;
  var SQUADS_MAX=3;
  var SQUAD_UNLOCK_COST=3000;

  // === 重置券機制 ===
  var RESET_TICKET_NAME='探索重置券';   // 背包中的票券道具名
  var RESET_TICKET_DAILY_FREE=1;        // 每天免費補發 1 張
  var RESET_TICKET_BASE_CAP=2;          // 免費票券基礎上限（與背包分離）
  var RESET_TICKET_UPGRADE_COST=10000;  // 擴充免費券上限費用
  var ALLOW_EXPAND_RESET_CAP=false;     // 預設不開放

  // ===== 探索掉落表 =====
  var EXPLORE_TABLE=[
    {name:'鑽石',type:'gem',cap:20,rate:0.01},
    {name:'SP點數券',type:'item',key:'sp點數券',cap:3,rate:0.002},
    {name:'精華',type:'ess_any',cap:30,rate:0.05},
    {name:'技能強化券',type:'item',key:'技能強化券',cap:2,rate:0.0001},
    {name:'元素碎片',type:'item',key:'元素碎片',cap:70,rate:0.03},
    {name:'進階石',type:'item',key:'進階石',cap:10,rate:0.005},
    {name:'元素精華',type:'item',key:'元素精華',cap:3,rate:0.003},
    {name:'衝星石',type:'item',key:'衝星石',cap:20,rate:0.05},
    {name:'星之碎片',type:'item',key:'星之碎片',cap:5,rate:0.003},
    {name:'怪物獎牌',type:'item',key:'怪物獎牌',cap:50,rate:0.05},
    {name:'挑戰券',type:'item',key:'挑戰券',cap:5,rate:0.009},
    {name:'資源票',type:'item',key:'資源票',cap:5,rate:0.009},
    {name:'高級探索券',type:'item',key:'高級探索券',cap:5,rate:0.005}
  ];

  // ===== 狀態 =====
  var state=(function load(){
    try{
      var raw=localStorage.getItem(LS_KEY);
      if(!raw) return fresh();
      var o=JSON.parse(raw);
      o.exploreLv=toInt(o.exploreLv||0);
      o.exploreUpStart=toInt(o.exploreUpStart||0);
      o.exploreLog=o.exploreLog||[];
      o.dropsCount=o.dropsCount||{};
      o.squads=o.squads||[];
      // 重置券
      o.resetTicketCapBonus=toInt(o.resetTicketCapBonus||0);
      o.ticketDay=o.ticketDay||dailyKey();
      o.freeTickets=toInt(o.freeTickets||0);
      // 排序
      o.dropSortKey = o.dropSortKey || 'qty'; // name/rate/qty/cap
      o.dropSortAsc = (o.dropSortAsc===true); // 預設降冪，只有 name 比較適合升冪
      migrateSquads(o);
      return o;
    }catch(_){return fresh();}

    function fresh(){
      var s={
        exploreLv:0,
        exploreUpStart:0,
        exploreLog:[],
        dropsCount:{},
        squads:[],
        // 重置券
        resetTicketCapBonus:0,
        ticketDay:dailyKey(),
        freeTickets:0,
        // 排序預設（數量，降冪）
        dropSortKey:'qty',
        dropSortAsc:false
      };
      for(var i=0;i<SQUADS_BASE;i++) s.squads.push(newSquad(i));
      return s;
    }
    function migrateSquads(s){
      if(!s.squads.length){
        for(var i=0;i<SQUADS_BASE;i++) s.squads.push(newSquad(i));
      }
      s.squads.forEach((q,j)=>{
        q.id=toInt(q.id||j);
        q.enabled=(q.enabled!==false);
        q.lastTick=toInt(q.lastTick||nowSec());
        q._carry=toInt(q._carry||0);
      });
    }
  })();

  function newSquad(i){return{id:i,name:'隊伍 '+(i+1),enabled:true,lastTick:nowSec(),_carry:0};}
  function saveLocal(){try{localStorage.setItem(LS_KEY,JSON.stringify(state));}catch(_){}}
  function dailyKey(){var d=new Date();return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();}

  // ===== 探索等級 & 掉落上限 =====
  function todayCapBase(){
    var out=[];var lv=clamp(state.exploreLv,0,EXPLORE_MAX);
    for(var i=0;i<EXPLORE_TABLE.length;i++){
      var base=EXPLORE_TABLE[i].cap;
      out.push(Math.floor(base*(1+lv*EXPLORE_CAP_PER_LV)));
    }return out;
  }

  function nextExploreCost(){ if(state.exploreLv>=EXPLORE_MAX) return 0; return EXPLORE_UP_COST_BASE*(state.exploreLv+1); }
  function remainUpgradeSec(){
    if(!state.exploreUpStart) return 0;
    var end=state.exploreUpStart+EXPLORE_UP_HOURS;
    return Math.max(0, end-nowSec());
  }
  function tryUpgrade(){
    if(state.exploreLv>=EXPLORE_MAX) return;
    if(remainUpgradeSec()>0) return;
    var cost=nextExploreCost();
    var gem=toInt(w.player && (w.player.gem||0));
    if(gem<cost) return;
    w.player.gem=gem-cost;
    state.exploreUpStart=nowSec();
    saveLocal();upd();saveGame();
    showToast('探索等級升級開始（約 2 小時）');
  }
  function finishUpgrade(){
    var r=remainUpgradeSec();
    if(r>0 || !state.exploreUpStart) return;
    state.exploreUpStart=0;
    state.exploreLv=clamp(state.exploreLv+1,0,EXPLORE_MAX);
    saveLocal();
    showToast('探索等級升級完成！');
  }

  // ===== 掉落 =====
  function pickOwnedEssence(){
    var prob=['森林精華','沼澤精華','熔岩精華','天水精華','風靈精華','雷光精華','冰霜精華','黯影精華','煉獄精華','聖光精華','核心精華','精華'];
    var c=[],i,key,qty; for(i=0;i<prob.length;i++){ key=prob[i]; qty=getItemQuantity(key); if(qty>0) c.push(key); }
    return c.length? c[(Math.random()*c.length)|0] : null;
  }

  function doExploreOnce(){
    var caps=todayCapBase();
    var gotAny=false;var drops=[];
    for(var i=0;i<EXPLORE_TABLE.length;i++){
      var rec=EXPLORE_TABLE[i];var used=toInt(state.dropsCount[i]||0);var cap=caps[i]; if(used>=cap) continue;
      var rate=Number(rec.rate)||0;
      if(Math.random()<rate){
        if(rec.type==='gem'){
          w.player && (w.player.gem=toInt(w.player.gem||0)+1); drops.push('💎 '+rec.name+' ×1'); gotAny=true;
        }else if(rec.type==='item'){
          addItem(rec.key||rec.name,1); drops.push('📦 '+rec.name+' ×1'); gotAny=true;
        }else if(rec.type==='ess_any'){
          var chosen=pickOwnedEssence() || '精華';
          addItem(chosen,1); drops.push('✨ '+chosen+' ×1'); gotAny=true;
        }
        state.dropsCount[i]=used+1;
      }
    }
    var d=new Date();var hh=d.getHours().toString().padStart(2,'0');var mm=d.getMinutes().toString().padStart(2,'0');
    var line=gotAny?(hh+':'+mm+' 取得：'+drops.join('、')):(hh+':'+mm+' 未獲得任何物品');
    state.exploreLog.unshift(line); if(state.exploreLog.length>30) state.exploreLog.length=30;
    return gotAny;
  }

  // ===== 重置券處理 =====
  function resetTicketCap(){ return RESET_TICKET_BASE_CAP + toInt(state.resetTicketCapBonus||0); }

  function grantDailyTicketIfNeeded(){
    var k=dailyKey();
    if(state.ticketDay!==k){
      state.ticketDay=k;
      var cap=resetTicketCap();
      var before=toInt(state.freeTickets||0);
      var add=Math.min(RESET_TICKET_DAILY_FREE, Math.max(0, cap-before));
      if(add>0){
        state.freeTickets=before+add;
        state.exploreLog.unshift('00:00 補發：🎫 免費重置券 ×'+add);
        if(state.exploreLog.length>30) state.exploreLog.length=30;
      }
      saveLocal(); saveGame();
    }
  }

  function useResetTicket(){
    var usedType=null; // 'free' | 'inv'
    if(toInt(state.freeTickets||0)>0){ state.freeTickets--; usedType='free'; }
    else if(getItemQuantity(RESET_TICKET_NAME)>0){ removeItem(RESET_TICKET_NAME,1); usedType='inv'; }
    if(!usedType) return false;

    // 清空當日進度
    state.dropsCount={};

    // 紀錄
    var d=new Date(); var hh=d.getHours().toString().padStart(2,'0'); var mm=d.getMinutes().toString().padStart(2,'0');
    var label=(usedType==='free'?'免費重置券':RESET_TICKET_NAME);
    state.exploreLog.unshift(hh+':'+mm+' 使用：🎫 '+label+' ×1（已重置掉落上限）');
    if(state.exploreLog.length>30) state.exploreLog.length=30;

    saveLocal(); saveGame();
    return true;
  }

  function tryExpandResetCap(){
    if(!ALLOW_EXPAND_RESET_CAP) return false;
    var gem=toInt(w.player && (w.player.gem||0));
    if(gem<RESET_TICKET_UPGRADE_COST) return false;
    w.player.gem=gem-RESET_TICKET_UPGRADE_COST;
    state.resetTicketCapBonus=toInt(state.resetTicketCapBonus||0)+1;
    saveLocal(); upd(); saveGame();
    showToast('免費重置券上限 +1');
    return true;
  }

  // ===== Tick =====
  function tickSquad(q){
    var t=nowSec(); var last=toInt(q.lastTick||t); var realDt=Math.max(0,t-last); q.lastTick=t;
    q._carry=toInt(q._carry||0)+realDt;
    var changed=false;
    while(q.enabled && q._carry>=EXPLORE_TICK_SEC){
      q._carry-=EXPLORE_TICK_SEC;
      doExploreOnce(); changed=true;
    }
    return changed;
  }

  var _gate=0;
  function tick(sec){
    _gate+=Number(sec)||0; if(_gate<1) return; _gate=0;

    var changed=false;

    // 升級完成檢查
    var beforeLv=state.exploreLv;
    finishUpgrade();
    if(state.exploreLv!==beforeLv) changed=true;

    // 每日免費券
    var beforeDay=state.ticketDay;
    grantDailyTicketIfNeeded();
    if(state.ticketDay!==beforeDay) changed=true;

    // 小隊探索
    if(state.squads && state.squads.length){
      for(var i=0;i<state.squads.length;i++){
        if(tickSquad(state.squads[i])) changed=true;
      }
    }

    if(changed){ saveLocal(); upd(); saveGame(); }

    try{ w.TownHub.requestRerender && w.TownHub.requestRerender(); }catch(_){}
  }

  // ===== 排序 =====
  function sortDrops(view){
    var key = state.dropSortKey || 'qty';
    var asc = !!state.dropSortAsc;
    view.sort(function(a,b){
      if(key==='name'){
        var r = String(a.rec.name).localeCompare(String(b.rec.name),'zh-Hant');
        return asc? r : -r;
      }
      if(key==='rate'){
        var ra = Number(a.rec.rate)||0, rb = Number(b.rec.rate)||0;
        if(ra===rb) return String(a.rec.name).localeCompare(String(b.rec.name),'zh-Hant');
        return asc? (ra-rb) : (rb-ra);
      }
      if(key==='cap'){
        var ca = Number(a.cap)||0, cb = Number(b.cap)||0;
        if(ca===cb) return String(a.rec.name).localeCompare(String(b.rec.name),'zh-Hant');
        return asc? (ca-cb) : (cb-ca);
      }
      // qty
      var qa = Number(a.used)||0, qb = Number(b.used)||0;
      if(qa===qb) return String(a.rec.name).localeCompare(String(b.rec.name),'zh-Hant');
      return asc? (qa-qb) : (qb-qa);
    });
  }

  // ===== UI =====
  function bar(p){ p=clamp(p,0,100); return '<div style="height:8px;background:#0b1220;border-radius:999px;overflow:hidden;margin-top:6px"><span style="display:block;height:100%;width:'+p+'%;background:linear-gradient(90deg,#60a5fa,#34d399)"></span></div>'; }
  function card(title,inner){ return '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:10px;margin-bottom:12px"><div style="font-weight:700;margin-bottom:6px">'+title+'</div>'+inner+'</div>'; }
  function remainPct(){ var rem=remainUpgradeSec(); if(rem<=0) return 0; return Math.floor(((EXPLORE_UP_HOURS-rem)/EXPLORE_UP_HOURS)*100); }
  function squadTickPct(q){ return Math.floor(((toInt(q._carry||0)%EXPLORE_TICK_SEC)/EXPLORE_TICK_SEC)*100); }

  function render(container){
    var caps=todayCapBase();

    // 建立 view（含已獲得與上限）
    var view=[];
    for(var i=0;i<EXPLORE_TABLE.length;i++){
      var rec=EXPLORE_TABLE[i];
      var used=toInt(state.dropsCount[i]||0);
      var cap=caps[i];
      view.push({rec, idx:i, used, cap});
    }
    sortDrops(view);

    // 掉落行
    var rows='';
    for(var j=0;j<view.length;j++){
      var it=view[j]; var rec=it.rec;
      rows+='\n<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px dashed #1f2937">'+
        '<div>'+rec.name+' <span style="opacity:.7">（機率 '+(((Number(rec.rate)||0)*100).toFixed(2))+'%）</span></div>'+
        '<div><b>'+it.used+'</b> / '+it.cap+'</div></div>';
    }

    // —— 排序控制（兩顆按鈕） ——
    var sortKey = state.dropSortKey || 'qty';
    var sortAsc = !!state.dropSortAsc;
    var sortCtrl =
      '<div style="display:flex;align-items:center;gap:8px;margin:2px 0 8px 0;opacity:.95;flex-wrap:wrap">'+
        '<div style="opacity:.85">排序：</div>'+
        '<button id="dropSortKeyBtn" style="border:1px solid #1f2937;background:#0b1220;color:#fff;border-radius:999px;padding:6px 12px;cursor:pointer;font-weight:700">'+
          SORT_LABEL[sortKey] +
        '</button>'+
        '<button id="dropSortOrderBtn" style="border:1px solid #1f2937;background:#0b1220;color:#fff;border-radius:999px;padding:6px 12px;cursor:pointer;font-weight:700">'+
          (sortAsc?'低到高':'高到低') +
        '</button>'+
        '<div style="opacity:.6;margin-left:4px">（每秒重繪，按鈕點擊立即生效）</div>'+
      '</div>';

    // 等級升級區
    var rem=remainUpgradeSec();
    var upHtml=(rem>0
      ? '<div style="color:#93c5fd;margin-top:8px">升級中（剩 '+fmt(Math.ceil(rem/60))+' 分）</div>'+bar(remainPct())
      : '<div style="margin-top:8px"><button id="exploreUp" style="background:#4f46e5;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer" '+(state.exploreLv>=EXPLORE_MAX?'disabled':'')+'>提升探索等級（花費 '+fmt(nextExploreCost())+' 鑽石｜需 2 小時）</button></div>'
    );

    // 小隊卡
    var squadsHtml='';
    for(var i=0;i<state.squads.length;i++){
      var q=state.squads[i];
      var remainS=Math.ceil(EXPLORE_TICK_SEC-(toInt(q._carry||0)%EXPLORE_TICK_SEC));
      squadsHtml += card('👥 '+q.name+(q.enabled?'（運作中）':'（已暫停）'),
        '<div class="mini" style="opacity:.85">下次探索倒數：<b>'+remainS+'s</b></div>'+
        bar(squadTickPct(q))+
        '<div style="margin-top:8px"><button data-sid="'+q.id+'" class="btn-toggle" style="background:#10b981;border:none;color:#0b1220;border-radius:8px;padding:6px 10px;cursor:pointer">'+(q.enabled?'暫停':'啟動')+'</button></div>'
      );
    }

    // 解鎖隊伍
    var canUnlock=state.squads.length<SQUADS_MAX;
    var unlockHtml=canUnlock
      ? '<button id="unlockSquad" style="background:#fbbf24;border:none;color:#0b1220;border-radius:8px;padding:6px 10px;cursor:pointer">解鎖新隊伍（花費 '+fmt(SQUAD_UNLOCK_COST)+' 鑽石）</button>'
      : '<div style="opacity:.7">已達隊伍上限（'+SQUADS_MAX+'）</div>';

    // 紀錄
    var logHtml=(state.exploreLog && state.exploreLog.length
      ? state.exploreLog.map(function(s){ return '<div style="padding:2px 0;border-bottom:1px dashed #1f2937">'+s+'</div>'; }).join('')
      : '<div style="opacity:.6">（目前沒有紀錄）</div>'
    );

    // 重置券資訊（按鈕永遠可點；沒券會吐司）
    var freeCur=toInt(state.freeTickets||0);
    var freeCap=resetTicketCap();
    var invCur=getItemQuantity(RESET_TICKET_NAME);

    var ticketHtml =
      '<div style="display:grid;gap:6px">'+
        '<div>免費重置券：<b>'+fmt(freeCur)+'</b> / '+fmt(freeCap)+'</div>'+
        '<div>背包持有　：<b>'+fmt(invCur)+'</b>（道具：'+RESET_TICKET_NAME+'）</div>'+
        '<div><button id="useResetTicket" '+
          'style="background:#1d4ed8;border:none;color:#fff;border-radius:8px;padding:6px 10px;cursor:pointer">'+
        '使用重置券（立即重置掉落上限）</button></div>'+
        '<div style="opacity:.9">免費重置券補發倒數：<b>'+ fmtHMS(secUntilReset()) +'</b></div>'+
      '</div>';

    var expandHtml =
      '<div style="margin-top:8px">'+
      '<button id="expandResetCap" style="background:'+(ALLOW_EXPAND_RESET_CAP?'#22c55e':'#374151')+';border:none;color:#0b1220;border-radius:8px;padding:6px 10px;cursor:'+(ALLOW_EXPAND_RESET_CAP?'pointer':'not-allowed')+'" '+(ALLOW_EXPAND_RESET_CAP?'':'disabled')+'>'+
      '擴充免費重置券上限（花費 '+fmt(RESET_TICKET_UPGRADE_COST)+' 鑽石，上限 +1）</button>'+
      (ALLOW_EXPAND_RESET_CAP?'':'<div style="opacity:.65;margin-top:4px">（目前未開放）</div>')+
      '</div>';

    // 版面：重置放最上 + 掉落排序控制（兩顆按鈕）
    container.innerHTML =
      card('🎫 探索重置', ticketHtml + expandHtml) +
      card('🔍 探索（多隊）',
        '<div>探索等級：<b>Lv.'+state.exploreLv+' / '+EXPLORE_MAX+'</b>（每級每日上限 +10%）</div>'+
        upHtml+
        '<div style="margin-top:10px;padding-top:6px;border-top:1px solid #1f2937"><b>掉落進度（全隊共享）</b>'+
        sortCtrl + rows + '</div>'
      )+
      card('👥 隊伍管理',
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">'+squadsHtml+'</div>'+
        '<div style="margin-top:10px">'+unlockHtml+'</div>'
      )+
      card('📝 探索紀錄',
        '<div style="max-height:180px;overflow:auto;border:1px solid #1f2937;border-radius:6px;padding:6px 8px;background:#0b1220">'+logHtml+'</div>'
      );

    // === 事件 ===
    var be = byId('exploreUp');
    if (be){
      be.onclick = function(){
        var before = remainUpgradeSec();
        tryUpgrade();
        if (remainUpgradeSec() > 0 && before === 0) showToast('開始升級探索等級');
        w.TownHub.requestRerender && w.TownHub.requestRerender();
      };
    }

    // 小隊啟停
    var buttons = container.querySelectorAll('.btn-toggle');
    for (var i=0;i<buttons.length;i++){
      buttons[i].onclick = function(){
        var sid = toInt(this.getAttribute('data-sid'));
        for (var j=0;j<state.squads.length;j++){
          if (state.squads[j].id===sid){
            state.squads[j].enabled = !state.squads[j].enabled;
            break;
          }
        }
        saveLocal(); w.TownHub.requestRerender && w.TownHub.requestRerender();
      };
    }

    // 解鎖隊伍
    var bu = byId('unlockSquad');
    if (bu){
      bu.onclick = function(){
        if (state.squads.length>=SQUADS_MAX) return;
        var gem = toInt(w.player && (w.player.gem||0));
        if (gem < SQUAD_UNLOCK_COST) { showToast('鑽石不足', true); return; }
        w.player.gem = gem - SQUAD_UNLOCK_COST;
        var ns = newSquad(state.squads.length);
        state.squads.push(ns);
        saveLocal(); upd(); saveGame();
        showToast('已解鎖新隊伍');
        w.TownHub.requestRerender && w.TownHub.requestRerender();
      };
    }

    // 使用重置券（永遠可點；沒券會吐司）
    var br = byId('useResetTicket');
    if (br){
      br.onclick = function(){
        var ok = useResetTicket();
        if (ok){
          var prevText = br.textContent;
          br.textContent = '✓ 重置完成';
          showToast('重置完成，當日掉落上限已清空');
          setTimeout(function(){
            br.textContent = prevText;
            w.TownHub.requestRerender && w.TownHub.requestRerender();
          }, 1000);
          upd(); saveGame();
        } else {
          showToast('沒有可用的重置券', true);
        }
      };
    }

    // 擴充免費上限
    var bx = byId('expandResetCap');
    if (bx){
      bx.onclick = function(){
        if (tryExpandResetCap()){
          w.TownHub.requestRerender && w.TownHub.requestRerender();
        }else{
          if(!ALLOW_EXPAND_RESET_CAP) showToast('此功能尚未開放', true);
          else showToast('鑽石不足', true);
        }
      };
    }

    // —— 排序控制（兩顆按鈕） ——
    var keyBtn = byId('dropSortKeyBtn');
    var orderBtn = byId('dropSortOrderBtn');
    if (keyBtn){
      keyBtn.onclick = function(){
        var idx = SORT_KEYS.indexOf(state.dropSortKey||'qty');
        idx = (idx+1) % SORT_KEYS.length;
        state.dropSortKey = SORT_KEYS[idx];
        saveLocal();
        w.TownHub.requestRerender && w.TownHub.requestRerender();
      };
    }
    if (orderBtn){
      orderBtn.onclick = function(){
        state.dropSortAsc = !state.dropSortAsc;
        saveLocal();
        w.TownHub.requestRerender && w.TownHub.requestRerender();
      };
    }
  }

  w.TownHub.registerTab({ id:'explore', title:'探索', render:render, tick:tick });
})(window);
