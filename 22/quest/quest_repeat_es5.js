// quest_repeat_es5.js －－ 重複任務（可無限循環，超額繼承，達成即發獎）
(function(){
  if (!window.QuestCore) return;

  var STORAGE_KEY = 'REPEAT_STATE_V1';

  // 門檻設定
  var THRESH = {
    goldGain:     2000000,  // 楓幣每獲得 10 萬 → 鑽石×2
    stoneGain:    40000,   // 強化石每獲得 1 萬 → 鑽石×1
    diamondSpend: 10000,   // 鑽石每消費 1 萬 → 鑽石×100
    kills:        100,     // 擊殺 100 隻 → 強化石100 + 鑽石×1
    loginDays:    7,       // 登入 7 天 → 鑽石×15 + 任務獎牌×2
    daily50:      50       // 每日任務完成 50 次（只算前四項）→ 鑽石×20
  };

  // 狀態
  var state = {
    date: '',
    goldGain: 0,
    stoneGain: 0,
    diamondSpend: 0,
    kills: 0,
    loginDaysAccum: 0,
    dailyCompletedAccum: 0,
    done: { goldGain:0, stoneGain:0, diamondSpend:0, kills:0, login7:0, daily50:0 }
  };

  function pad2(n){ return (n<10?'0':'')+n; }
  function todayStr(){ var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
  function load(){
    try{ var raw=localStorage.getItem(STORAGE_KEY); if(raw){ var o=JSON.parse(raw); if(o) state=o; } }catch(e){}
    if (!state || typeof state!=='object') state = { date:'', goldGain:0, stoneGain:0, diamondSpend:0, kills:0, loginDaysAccum:0, dailyCompletedAccum:0, done:{goldGain:0,stoneGain:0,diamondSpend:0,kills:0,login7:0,daily50:0} };
    save();
  }
  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }

  // 發獎
  function grant(rew){
    var t=rew.type;
    if(t==='gold'&&rew.amount>0){ if(typeof player!=='undefined') player.gold=(player.gold||0)+rew.amount; }
    else if(t==='stone'&&rew.amount>0){ if(typeof player!=='undefined') player.stone=(player.stone||0)+rew.amount; }
    else if(t==='diamond'&&rew.amount>0){ if(typeof player!=='undefined') player.gem=(player.gem||0)+rew.amount; }
    else if(t==='diamond_box'){ var v=(rew.min||0)+Math.floor(Math.random()*((rew.max||0)-(rew.min||0)+1)); if(typeof player!=='undefined') player.gem=(player.gem||0)+v; logPrepend&&logPrepend('🎁 寶箱開出 '+v+' 鑽石！'); }
    else if (t === 'medal' && rew.amount > 0) {
  if (typeof addItem === "function") {
    addItem("任務獎牌", rew.amount); // ✅ 發到背包
  } else {
    window.missionMedal = (window.missionMedal || 0) + rew.amount; // 備援
  }
  if (typeof logPrepend === "function") {
    logPrepend('🏅 獲得任務獎牌 ×' + rew.amount);
  }
}
  }
  function grantPack(list){
    for(var i=0;i<(list||[]).length;i++) grant(list[i]);
    updateResourceUI&&updateResourceUI();
  }

  // 超額繼承：可一次觸發多次
  function payoutLoop(counterKey, threshold, rewardPack, doneKey){
    var loops=0;
    while(state[counterKey] >= threshold){
      state[counterKey] -= threshold;
      loops++;
    }
    if(loops>0){
      for(var i=0;i<loops;i++) grantPack(rewardPack);
      state.done[doneKey]=(state.done[doneKey]||0)+loops;
      logPrepend&&logPrepend('✅ 重複任務達成（'+doneKey+'）×'+loops);
    }
  }

  // 規則實作
  function onGoldGained(a){ if(a>0){ state.goldGain+=a; payoutLoop('goldGain',THRESH.goldGain,[{type:'diamond',amount:2}],'goldGain'); } }
  function onStoneGained(a){ if(a>0){ state.stoneGain+=a; payoutLoop('stoneGain',THRESH.stoneGain,[{type:'diamond',amount:1}],'stoneGain'); } }
  function onDiamondSpent(a){ if(a>0){ state.diamondSpend+=a; payoutLoop('diamondSpend',THRESH.diamondSpend,[{type:'diamond',amount:100}],'diamondSpend'); } }
  function onKills(k){ if(k>0){ state.kills+=k; payoutLoop('kills',THRESH.kills,[{type:'stone',amount:100},{type:'diamond',amount:1}],'kills'); } }
  function onLoginUniqueDay(){
    var t=todayStr();
    if(state.date!==t){
      state.date=t;
      state.loginDaysAccum+=1;
      payoutLoop('loginDaysAccum',THRESH.loginDays,[{type:'diamond',amount:15},{type:'medal',amount:2}],'login7');
    }
  }
  function onDailyCompletedOnce(){
    state.dailyCompletedAccum+=1;
    payoutLoop('dailyCompletedAccum',THRESH.daily50,[{type:'diamond',amount:20}],'daily50');
  }

  // 包裝既有全域事件（你不用改原本程式）
  function wrapGlobal(fnName, wrapper){
    var old=window[fnName];
    window[fnName]=function(){
      if(typeof old==='function'){ try{ old.apply(this, arguments); }catch(e){} }
      try{ wrapper.apply(this, arguments); }catch(e){}
      save();
    };
  }

  load();
  wrapGlobal('DM_onLogin', function(){ onLoginUniqueDay(); });
  wrapGlobal('DM_onGoldGained', function(a){ onGoldGained(a); });
  wrapGlobal('DM_onStoneGained', function(a){ onStoneGained(a); });
  wrapGlobal('DM_onMonsterKilled', function(k){ onKills(k); });
  wrapGlobal('Weekly_onDailyCompleted', function(){ onDailyCompletedOnce(); });

  // 你需要在真正「扣鑽石」的地方呼叫這個（傳此次消費量，正數）
  window.RM_onDiamondSpent = function(spentAmount){
    load();
    onDiamondSpent(spentAmount||0);
    save();
  };

  // 分頁 UI：repeatables
  function row(title, desc, cur, max, doneTimes, color){
    if(cur>max) cur=max;
    var pct=max>0?Math.floor((cur/max)*100):0;
    return ''+
      '<div style="padding:8px 0;border-bottom:1px solid #444;">'+
        '<div style="font-weight:700;">'+title+'</div>'+
        '<div style="font-size:12px;color:#999;">'+desc+'</div>'+
        '<div style="height:8px;background:#333;border-radius:8px;overflow:hidden;margin-top:6px;"><div style="height:8px;width:'+pct+'%;background:'+color+';"></div></div>'+
        '<div style="font-size:12px;color:#aaa;margin-top:4px;">進度：'+cur+' / '+max+'　|　累計完成：'+doneTimes+' 次</div>'+
      '</div>';
  }

  function render(){
    var box=document.getElementById('questContent'); if(!box) return;
    load();
    var html='';
    html+=row('金幣達人','每獲得 2,000,000 金幣：鑽石 ×2', state.goldGain, THRESH.goldGain, state.done.goldGain, '#2d7');
    html+=row('礦藏大師','每獲得 40,000 強化石：鑽石 ×1', state.stoneGain, THRESH.stoneGain, state.done.stoneGain, '#2d7');
    html+=row('豪擲千金','每消費 10,000 鑽石：鑽石 ×100', state.diamondSpend, THRESH.diamondSpend, state.done.diamondSpend, '#c85');
    html+=row('狩獵連環','每擊殺 100 隻怪：強化石 ×100、鑽石 ×1', state.kills, THRESH.kills, state.done.kills, '#48c');
    html+=row('持之以恆','每登入 7 天：鑽石 ×15、任務獎牌 ×2（每天最多 +1）', state.loginDaysAccum % THRESH.loginDays, THRESH.loginDays, state.done.login7, '#7a5');
    html+=row('日常專家','每日任務累積 50 次（只計前四項）：鑽石 ×20', state.dailyCompletedAccum % THRESH.daily50, THRESH.daily50, state.done.daily50, '#a5a');
    box.innerHTML=html;
  }

  function onTabChange(){ if(QuestCore.getActiveTab()==='repeatables') render(); }
  function init(){
    var btn=document.getElementById('tabRepeatables');
    if(btn) btn.onclick=function(){ QuestCore.setTab('repeatables'); };
    document.addEventListener('quest:tabchange', onTabChange);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
// === Repeat Export / Import (for unified save) ===
window.Repeat_exportState = function () {
  return JSON.parse(JSON.stringify(state));
};
window.Repeat_applyState = function (s) {
  if (!s || typeof s !== 'object') return;
  state = Object.assign({}, state, s);
  save();
};