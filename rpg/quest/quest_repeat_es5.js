// quest_repeat_es5.js — 重複任務（V3：SaveHub 中央存檔、五捨六入、移除登入任務、只在本分頁重繪、達成後進度歸零）
(function(){
  if (!window.QuestCore) return;
  var SH = window.SaveHub;

  // ====== SaveHub（中央存檔；不做舊版遷移）======
  var NS = 'repeat:v3';
  function defState(){
    return {
      _ver: 1,
      goldGain:0, stoneGain:0, diamondSpend:0, kills:0,
      done:{ goldGain:0, stoneGain:0, diamondSpend:0, kills:0 }
    };
  }
  function normalize(s){
    if (!s || typeof s!=='object') s = defState();
    s._ver = 1;
    s.goldGain = Math.max(0, Number(s.goldGain||0));
    s.stoneGain = Math.max(0, Number(s.stoneGain||0));
    s.diamondSpend = Math.max(0, Number(s.diamondSpend||0));
    s.kills = Math.max(0, Number(s.kills||0));
    s.done = s.done || { goldGain:0, stoneGain:0, diamondSpend:0, kills:0 };
    ['goldGain','stoneGain','diamondSpend','kills'].forEach(function(k){
      s.done[k] = Math.max(0, Number(s.done[k]||0));
    });
    return s;
  }

  // 可選：在 SaveHub 註冊版本
  if (SH && typeof SH.registerNamespaces === 'function') {
    SH.registerNamespaces({
      [NS]: {
        version: 1,
        migrate: function(old){ return normalize(old||defState()); }
      }
    });
  }

  function load(){
    try{
      if (!SH) return defState(); // 沒 SaveHub 就先給預設，避免錯誤
      var s = SH.get(NS, defState());
      return normalize(s);
    }catch(e){ console.error('[repeat] load error', e); return defState(); }
  }
  function save(s){
    try{
      if (!SH) return;
      SH.set(NS, normalize(s), { replace:true });
    }catch(e){ console.error('[repeat] save error', e); }
  }

  // ====== 任務定義（基礎門檻 / 基礎獎勵）======
  // 完成一次：門檻 ×1.35；獎勵 ×1.10（五捨六入，至少 1）
  var QUESTS = [
    {
      kind: 'goldGain', title: '金幣達人',
      desc: '擊敗怪物獲得金幣達標可得星痕代幣。',
      baseThresh: 100000,
      baseReward: [{type:'star', amount:3}],
      color: '#22c55e'
    },
    {
      kind: 'stoneGain', title: '礦藏大師',
      desc: '擊敗怪物獲得強化石達標可得星痕代幣。',
      baseThresh: 40000,
      baseReward: [{type:'star', amount:5}],
      color: '#10b981'
    },
    {
      kind: 'diamondSpend', title: '豪擲千金',
      desc: '鑽石消費達標，回饋大量鑽石（此任務維持發鑽石）。',
      baseThresh: 10000,
      baseReward: [{type:'diamond', amount:400}],
      color: '#f59e0b'
    },
    {
      kind: 'kills', title: '狩獵連環',
      desc: '擊殺怪物達標，獲得強化石與星痕代幣。',
      baseThresh: 50,
      baseReward: [{type:'stone', amount:300},{type:'star', amount:4}],
      color: '#3b82f6'
    }
  ];

  var THRESH_MUL = 1.35;   // 難度提升
  var REWARD_MUL = 1.10;   // 獎勵提升（五捨六入）

  var state = load();

  // ====== 工具 ======
  function fmt(n){ return Math.floor(n||0).toLocaleString(); }
  function pct(cur,max){ return (max>0)? Math.max(0, Math.min(100, Math.floor((cur/max)*100))) : 0; }
  // 五捨六入：小數 <0.6 捨，≥0.6 入
  function round56(x){ var neg = x<0; x = Math.abs(x); var i = Math.floor(x), f = x - i; var r = (f>=0.6) ? (i+1) : i; return neg ? -r : r; }

  function currentThresh(q){
    var done = state.done[q.kind]||0;
    var base = q.baseThresh;
    var val = base * Math.pow(THRESH_MUL, done);
    return Math.max(1, Math.floor(val)); // 門檻整數向下取整，至少 1
  }
  function rewardPackFor(q){
    var done = state.done[q.kind]||0;
    var mul = Math.pow(REWARD_MUL, done);
    var out=[];
    for (var i=0;i<q.baseReward.length;i++){
      var r=q.baseReward[i];
      out.push({type:r.type, amount: Math.max(1, round56((r.amount||0)*mul))});
    }
    return out;
  }

  function grant(rew){
    var t=rew.type, a=Math.max(0, Math.floor(rew.amount||0));
    if (a<=0) return;
    if (t==='gold'){ if (window.player) player.gold=(player.gold||0)+a; }
    else if (t==='stone'){ if (window.player) player.stone=(player.stone||0)+a; }
    else if (t==='diamond'){ if (window.player) player.gem=(player.gem||0)+a; }
    else if (t==='star'){
      if (typeof addItem === 'function') addItem('星痕代幣', a);
      else window.starToken = (window.starToken||0)+a;
    }
  }
  function grantPack(list){ for(var i=0;i<(list||[]).length;i++) grant(list[i]); if (window.updateResourceUI) updateResourceUI(); }

  // ====== 只在本分頁重繪 ======
  function isActiveTab(){
    try{ return QuestCore.getActiveTab && QuestCore.getActiveTab()==='repeatables'; }
    catch(_){ return false; }
  }
  var __dirty = false;
  var __rerenderTimer = null;
  function scheduleRender(force){
    if (!force && !isActiveTab()) { __dirty = true; return; }
    if (__rerenderTimer) return;
    __rerenderTimer = setTimeout(function(){
      __rerenderTimer = null;
      if (!isActiveTab()) { __dirty = true; return; }
      try { render(); __dirty = false; } catch(e){ console.error('[repeat] render fail', e); }
    }, 0);
  }

  // ====== 結算：達成後進度直接歸零（不保留溢出），固定順序、加防重入 ======
  var __settling = false;
  function settleQuest(q, counterKey){
    if (__settling) return; // 防止同一拍重入
    __settling = true;
    try {
      var need = currentThresh(q);
      var cur  = Math.max(0, state[counterKey]||0);

      if (cur >= need){
        // ✅ 單次判定，進度歸零，不保留溢出
        state[counterKey] = 0;
        state.done[q.kind] = (state.done[q.kind]||0) + 1;

        // 先發獎、再存檔、最後重繪（在本分頁時）
        grantPack(rewardPackFor(q));
        save(state);

        if (window.logPrepend){
          logPrepend('✅ 重複任務達成「'+q.title+'」×1（進度已重置）');
        }
        scheduleRender(true);
      } else {
        // 進度更新也落盤（避免意外關閉丟資料），但不強制重繪其他分頁
        save(state);
        scheduleRender(false);
      }
    } finally {
      __settling = false;
    }
  }

  // ====== 事件回調 ======
  function onGoldGained(a){ if(a>0){ state.goldGain+=a; settleQuest(QUESTS[0],'goldGain'); } }
  function onStoneGained(a){ if(a>0){ state.stoneGain+=a; settleQuest(QUESTS[1],'stoneGain'); } }
  function onDiamondSpent(a){ if(a>0){ state.diamondSpend+=a; settleQuest(QUESTS[2],'diamondSpend'); } }
  function onKills(k){ if(k>0){ state.kills+=k; settleQuest(QUESTS[3],'kills'); } }

  // 包裝既有全域事件（先跑舊函式，再跑我們的；若舊函式內再觸發，__settling 會擋重入）
  function wrapGlobal(fnName, wrapper){
    var old=window[fnName];
    window[fnName]=function(){
      if(typeof old==='function'){ try{ old.apply(this, arguments); }catch(e){} }
      try{ wrapper.apply(this, arguments); }catch(e){}
    };
  }
  wrapGlobal('DM_onGoldGained', function(a){ onGoldGained(a); });
  wrapGlobal('DM_onStoneGained', function(a){ onStoneGained(a); });
  wrapGlobal('DM_onMonsterKilled', function(k){ onKills(k); });

  // 在真正扣鑽石的地方呼叫（正數）
  window.RM_onDiamondSpent = function(spentAmount){
    onDiamondSpent(spentAmount||0);
  };

  // ====== UI（卡片化）======
  function cardHTML(q, curVal, needVal, doneTimes){
    var rewards = rewardPackFor(q).map(function(r){
      var name = (r.type==='diamond'?'鑽石':(r.type==='star'?'星痕代幣':(r.type==='gold'?'金幣':(r.type==='stone'?'強化石':r.type))));
      return name+' ×'+fmt(r.amount);
    }).join('、');
    var bar = pct(curVal, needVal);
    return ''+
      '<div style="border:1px solid #1f2937;border-radius:12px;background:#0b1220;padding:12px;margin-bottom:10px;">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
          '<div style="font-weight:900;letter-spacing:.3px">'+q.title+'</div>'+
          '<div style="opacity:.85;font-size:12px">已完成：<b>'+fmt(doneTimes)+'</b> 次</div>'+
        '</div>'+
        '<div style="opacity:.9;font-size:12px;margin-bottom:8px">'+q.desc+'</div>'+
        '<div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-bottom:2px">'+
          '<div>'+
            '<div style="font-size:12px;opacity:.9;margin-bottom:4px">當前門檻：<b>'+fmt(needVal)+'</b>　|　進度：<b>'+fmt(curVal)+'</b></div>'+
            '<div style="height:10px;background:#111827;border:1px solid #233042;border-radius:999px;overflow:hidden">'+
              '<div style="height:100%;width:'+bar+'%;background:'+q.color+'"></div>'+
            '</div>'+
          '</div>'+
          '<div style="text-align:right;white-space:nowrap;font-size:12px;opacity:.95">下次獎勵：<b>'+rewards+'</b></div>'+
        '</div>'+
      '</div>';
  }

  function render(){
    var box=document.getElementById('questContent'); if(!box) return;
    var html='';
    (function(){ var q=QUESTS[0], need=currentThresh(q), cur=state.goldGain,    done=state.done[q.kind]||0; html+=cardHTML(q, cur, need, done); })();
    (function(){ var q=QUESTS[1], need=currentThresh(q), cur=state.stoneGain,   done=state.done[q.kind]||0; html+=cardHTML(q, cur, need, done); })();
    (function(){ var q=QUESTS[2], need=currentThresh(q), cur=state.diamondSpend,done=state.done[q.kind]||0; html+=cardHTML(q, cur, need, done); })();
    (function(){ var q=QUESTS[3], need=currentThresh(q), cur=state.kills,       done=state.done[q.kind]||0; html+=cardHTML(q, cur, need, done); })();
    box.innerHTML=html;
  }

  function onTabChange(){
    try{
      if (QuestCore.getActiveTab && QuestCore.getActiveTab()==='repeatables'){
        // 切進本分頁時，如有髒資料則立即重繪
        if (__dirty) { render(); __dirty=false; }
        else { render(); }
      }
    }catch(_){}
  }
  function init(){
    var btn=document.getElementById('tabRepeatables');
    if(btn) btn.onclick=function(){ QuestCore.setTab('repeatables'); };
    document.addEventListener('quest:tabchange', onTabChange);

    // 初次：如果已在本分頁，立即畫一次；否則等切入再畫
    scheduleRender(true);

    // 監聽 SaveHub：只在本 NS 變動時同步，不搶分頁
    if (SH && typeof SH.on === 'function') {
      SH.on('change', function(ev){
        if (!ev || (ev.type!=='set' && ev.type!=='flush')) return;
        if (ev.ns && ev.ns !== NS) return;
        try {
          var fresh = SH.get(NS, defState());
          state = normalize(fresh);
          // 不強制切分頁；若當前不是本分頁則標記 dirty
          scheduleRender(false);
        } catch(e){}
      });
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

  // ====== Export/Import（中央存檔）======
  window.Repeat_exportState = function () {
    return JSON.parse(JSON.stringify(state));
  };
  window.Repeat_applyState = function (s) {
    if (!s || typeof s !== 'object') return;
    state = normalize(s);
    save(state);
    scheduleRender(true);
  };
})();
