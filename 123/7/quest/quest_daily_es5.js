// quest_daily_es5.js －－「每日任務」專用
(function(){
  if (!window.QuestCore) return;

  var STORAGE_KEY = "DAILY_STATE_V1";
  var state = {
    date: "",
    progress: { kills:0, goldGain:0, login:0, stoneGain:0 },
    tasks: {},              // id -> {done, claimed}
    finishedCount: 0        // 今日完成幾項（不含 finish_4_daily）
  };

  // 5 個每日的條件
  var defs = {
    "kill_10_monsters": { type:"kills",     target:10,   desc:"今日擊敗 10 隻怪物" },
    "get_3000_gold":    { type:"goldGain",  target:3000, desc:"今日累計獲得 3000 楓幣" },
    "daily_login":      { type:"login",     target:1,    desc:"今日登入一次" },
    "get_100_stone":    { type:"stoneGain", target:100,  desc:"今日累計獲得 100 強化石" },
    "finish_4_daily":   { type:"combo4",    target:4,    desc:"今日完成 4 個每日任務" }
  };

  function todayStr(){
    var d=new Date(), y=d.getFullYear(), m=('0'+(d.getMonth()+1)).slice(-2), da=('0'+d.getDate()).slice(-2);
    return y+'-'+m+'-'+da;
  }
  function load(){
    try{ var raw=localStorage.getItem(STORAGE_KEY); if(raw){ var o=JSON.parse(raw); if(o) state=o; } }catch(e){}
    // 跨日重置
    var t=todayStr();
    if (state.date!==t){
      state.date=t;
      state.progress={kills:0,goldGain:0,login:0,stoneGain:0};
      state.finishedCount=0;
      state.tasks={};
    }
    ensureTasks(); save();
  }
  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
  function ensureTasks(){
    var list = missionRewards && missionRewards.daily ? missionRewards.daily : [];
    for (var i=0;i<list.length;i++){
      var id=list[i].id;
      if (!state.tasks[id]) state.tasks[id] = { done:false, claimed:false };
    }
  }

  // 發獎
  function grant(rew){
    var t=rew.type;
    if (t==="gold"    && rew.amount>0){ if (typeof player!=="undefined") player.gold  = (player.gold||0)+rew.amount; }
    else if (t==="stone"   && rew.amount>0){ if (typeof player!=="undefined") player.stone = (player.stone||0)+rew.amount; }
    else if (t==="diamond" && rew.amount>0){ if (typeof player!=="undefined") player.gem   = (player.gem||0)+rew.amount; }
    else if (t==="diamond_box"){
      var v=(rew.min||0)+Math.floor(Math.random()*((rew.max||0)-(rew.min||0)+1));
      if (typeof player!=="undefined") player.gem=(player.gem||0)+v;
      if (typeof logPrepend==="function") logPrepend("🎁 鑽石寶箱開出 "+v+" 鑽石！");
    } else if (t === "medal" && rew.amount > 0) {
  if (typeof addItem === "function") {
    addItem("任務獎牌", rew.amount);          // ✅ 放進你的背包系統
  } else {
    window.missionMedal = (window.missionMedal || 0) + rew.amount; // 備援
  }
  if (typeof logPrepend === "function") logPrepend("🏅 獲得任務獎牌 ×" + rew.amount);
}
  }
  function claim(id){
    var task=state.tasks[id]; if(!task||!task.done||task.claimed) return false;
    var list=missionRewards&&missionRewards.daily?missionRewards.daily:[], pack=null;
    for (var i=0;i<list.length;i++) if (list[i].id===id){ pack=list[i]; break; }
    if (!pack) return false;
    for (i=0;i<(pack.rewards||[]).length;i++) grant(pack.rewards[i]);
    task.claimed=true; save();
    if (typeof updateResourceUI==="function") updateResourceUI();
    if (typeof logPrepend==="function") logPrepend("✅ 已領取每日任務獎勵：「"+(pack.name||id)+"」");
    return true;
  }

  // 完成處理（前四項完成會推進週里程碑）
  function markDone(id){
    var t=state.tasks[id]; if(!t||t.done) return false;
    t.done=true;
    if (id!=="finish_4_daily"){
      state.finishedCount += 1;
      if (typeof window.Weekly_onDailyCompleted==="function"){ try{ window.Weekly_onDailyCompleted(); }catch(e){} }
      var combo=state.tasks["finish_4_daily"];
      if (combo && !combo.done && state.finishedCount>=defs["finish_4_daily"].target) combo.done=true;
    }
    return true;
  }
  function checkAll(){
    if (state.progress.kills     >= defs["kill_10_monsters"].target) markDone("kill_10_monsters");
    if (state.progress.goldGain  >= defs["get_3000_gold"].target)    markDone("get_3000_gold");
    if (state.progress.login     >= defs["daily_login"].target)      markDone("daily_login");
    if (state.progress.stoneGain >= defs["get_100_stone"].target)    markDone("get_100_stone");
    if (state.finishedCount      >= defs["finish_4_daily"].target)   markDone("finish_4_daily");
    save();
  }

  // ===== 事件入口：在你的遊戲流程各呼叫一次 =====
  // ✅ 只改這個：新帳號或今天尚未記錄登入 → 直接算 1 次（同一天不重複）
  window.DM_onLogin = function(){
    load();
    if (state.progress.login < 1) {
      state.progress.login = 1;
      checkAll();
      save();
    }
  };
  window.DM_onMonsterKilled = function(n){ load(); if(n>0) state.progress.kills+=n; checkAll(); };
  window.DM_onGoldGained    = function(a){ load(); if(a>0) state.progress.goldGain+=a; checkAll(); };
  window.DM_onStoneGained   = function(a){ load(); if(a>0) state.progress.stoneGain+=a; checkAll(); };

  // ===== 渲染每日頁 =====
  function bar(pct,color){
    return '<div style="height:8px;background:#333;border-radius:8px;overflow:hidden;margin-top:6px;">' +
             '<div style="height:8px;width:'+pct+'%;background:'+color+';"></div>' +
           '</div>';
  }
  function render(){
    var box=document.getElementById('questContent'); if(!box) return;
    var list=missionRewards&&missionRewards.daily?missionRewards.daily:[], html='';
    html += '<div style="margin-bottom:6px;color:#aaa">今日已完成任務：<b>'+state.finishedCount+'</b> / 4</div>';
    for (var i=0;i<list.length;i++){
      var it=list[i], id=it.id, def=defs[id]||{target:1,desc:it.name}, t=state.tasks[id]||{done:false,claimed:false};
      var cur=0, max=def.target, col=(id==='finish_4_daily')?'#c85':'#2d7';
      if (id==='finish_4_daily') cur=state.finishedCount;
      else if (def.type==='kills') cur=state.progress.kills;
      else if (def.type==='goldGain') cur=state.progress.goldGain;
      else if (def.type==='login') cur=state.progress.login;
      else if (def.type==='stoneGain') cur=state.progress.stoneGain;
      if (cur>max) cur=max;
      var pct=max>0?Math.floor((cur/max)*100):0;

      html+='<div style="padding:8px 0;border-bottom:1px solid #444;">'+
              '<div style="font-weight:700">'+(it.name||id)+'</div>'+
              '<div style="font-size:12px;color:#999">'+(def.desc||'')+'</div>'+
              bar(pct,col)+
              '<div style="font-size:12px;color:#aaa;margin-top:4px;">進度：'+cur+' / '+max+'</div>';
      if (t.done && !t.claimed){
        html+='<div style="margin-top:6px;"><button data-claim="'+id+'" style="padding:6px 10px;border:none;border-radius:6px;background:#2d7;color:#fff;">領取</button></div>';
      } else if (t.claimed){
        html+='<div style="margin-top:6px;color:#0a0">已領取</div>';
      } else {
        html+='<div style="margin-top:6px;color:#ccc">'+pct+'%</div>';
      }
      html+='</div>';
    }
    box.innerHTML = html;

    // 綁「領取」按鈕
    var btns = box.querySelectorAll ? box.querySelectorAll('[data-claim]') : [];
    for (i=0;i<btns.length;i++){
      (function(b){ b.onclick=function(){ var id=b.getAttribute('data-claim'); if (claim(id)) render(); }; })(btns[i]);
    }
  }

  function onTabChange(){ if (QuestCore.getActiveTab()==='daily'){ load(); render(); } }
  function init(){
    load();
    var btn=document.getElementById('tabDaily'); if (btn) btn.onclick=function(){ QuestCore.setTab('daily'); };
    document.addEventListener('quest:tabchange', onTabChange);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

(function autoLoginOnce(){
  function tryCall(){
    if (typeof window.DM_onLogin === 'function') {
      DM_onLogin();
    } else {
      setTimeout(tryCall, 200);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryCall);
  } else {
    tryCall();
  }
})();
// === Daily Export / Import (for unified save) ===
window.Daily_exportState = function () {
  return JSON.parse(JSON.stringify(state));
};
window.Daily_applyState = function (s) {
  if (!s || typeof s !== 'object') return;
  // 先合併，再跑 load() 讓它自動跨日校正（跨日會重置）
  state = Object.assign({}, state, s);
  load();
  save();
};