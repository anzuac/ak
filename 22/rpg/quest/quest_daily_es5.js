// quest_daily_es5.js — V4.1（不相容舊版）：6 小時輪換、任務堆疊上限 10、獎勵預先決定、領取即移除、顯示下次輪換
(function(){
  if (!window.QuestCore) return;

  // 使用你的主命名空間
  var STORAGE_KEY = "DAILY_STATE_V4";

  // 參數
  var SLOT_ADD_PER_ROTATION = 3;  // 每次輪換最多新增任務數
  var PENDING_CAP = 10;           // 未領取任務上限（未完成 + 完成未領）
  var SKEW_ALPHA_STONE = 2.0;     // 數值越大越偏小
  var SKEW_ALPHA_GOLD  = 2.2;

  // 6 小時輪換鍵
  function sixHourKey(){
    var d=new Date();
    var H=d.getHours();
    var slotStart = (H<6)?0 : (H<12)?6 : (H<18)?12 : 18;
    var y=d.getFullYear(), m=('0'+(d.getMonth()+1)).slice(-2), da=('0'+d.getDate()).slice(-2);
    return y+'-'+m+'-'+da+'-'+('0'+slotStart).slice(-2);
  }

  // 下次輪換時間
  function nextRotationDate(){
    var d = new Date();
    var h = d.getHours();
    if (h < 6)  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6, 0, 0, 0);
    if (h < 12) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
    if (h < 18) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0, 0, 0);
    // >= 18 → 次日 00:00
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  }

  function fmt2(n){ return (n<10?'0':'')+n; }
  function fmtDateTime(dt){
    return dt.getFullYear() + '-' + fmt2(dt.getMonth()+1) + '-' + fmt2(dt.getDate()) +
           ' ' + fmt2(dt.getHours()) + ':' + fmt2(dt.getMinutes());
  }
  function msToHMS(ms){
    if (ms < 0) ms = 0;
    var s = Math.floor(ms/1000);
    var h = Math.floor(s/3600); s -= h*3600;
    var m = Math.floor(s/60);   s -= m*60;
    return fmt2(h)+':'+fmt2(m)+':'+fmt2(s);
  }

  function getRandomInt(min, max){
    min = Math.ceil(min); max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  // 偏小數採樣：u^alpha（alpha>1 越偏小）
  function skewedInt(min, max, alpha){
    var u = Math.random();
    var val = min + Math.floor( Math.pow(u, alpha) * (max - min + 1) );
    if (val < min) val = min;
    if (val > max) val = max;
    return val;
  }
  function roundTo10(n){ return Math.round(n / 10) * 10; }

  // 狀態
  var state = {
    slotKey: "",                               // 當前輪換鍵
    progress: { kills:0, goldGain:0, stoneGain:0 },
    // 任務池：可 >3，堆疊到 10
    // 每項：{ uid, templateId, type, name, target, done, claimed, reward:{stone,gold} }
    tasks: [],
    finishedCountThisSlot: 0
  };

  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }

  function load(){
    try{
      var raw=localStorage.getItem(STORAGE_KEY);
      if(raw){
        var o=JSON.parse(raw);
        if(o && typeof o==='object') state=o;
      }
    }catch(e){}
    ensureSlot();
    ensureTaskRewards(); // 舊任務補獎勵欄位
  }

  function ensureSlot(){
    var curKey = sixHourKey();
    if (state.slotKey !== curKey){
      state.slotKey = curKey;

      // 清掉已領取任務（理論上領取即移除，這裡保潔）
      state.tasks = state.tasks.filter(function(t){ return !t.claimed; });

      // 只在輪換時：若未領任務 < 上限，補任務
      var pending = countPending();
      if (pending < PENDING_CAP){
        var add = Math.min(SLOT_ADD_PER_ROTATION, PENDING_CAP - pending);
        appendNewTasks(add);
      }
      // 重置本輪完成計數（僅顯示用途）
      state.finishedCountThisSlot = 0;
      // 重置 6 小時視窗內的進度（讓每輪都重新計）
      state.progress = { kills:0, goldGain:0, stoneGain:0 };
      save();
    } else {
      // ✅ 同一個 slot：不再因為「任務清空」就自動補
      // 保持空集合，等下一次輪換時再補
    }
  }

  function ensureTaskRewards(){
    var changed = false;
    for (var i=0;i<state.tasks.length;i++){
      var t = state.tasks[i];
      if (!t.reward || typeof t.reward.stone !== 'number' || typeof t.reward.gold !== 'number'){
        t.reward = {
          stone: skewedInt(20, 400, SKEW_ALPHA_STONE),
          gold:  roundTo10(skewedInt(100, 3000, SKEW_ALPHA_GOLD))
        };
        changed = true;
      }
    }
    if (changed) save();
  }

  function countPending(){
    var n=0;
    for (var i=0;i<state.tasks.length;i++){
      if (!state.tasks[i].claimed) n++;
    }
    return n;
  }

  // 依模板生成任務，追加到 tasks 尾端（建立時就決定獎勵）
  function appendNewTasks(n){
    var pool = (missionRewards && missionRewards.dailyTemplates) ? missionRewards.dailyTemplates.slice() : [
      { templateId:'kill',  type:'kills',     targetMin:5,  targetMax:20,  buildName:function(t){return '擊敗 '+t+' 隻怪';} },
      { templateId:'gold',  type:'goldGain',  targetMin:100,targetMax:300, buildName:function(t){return '獲得金幣 '+t;} },
      { templateId:'stone', type:'stoneGain', targetMin:10, targetMax:50,  buildName:function(t){return '獲得強化石 '+t;} }
    ];
    // 打散
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    // 循環抽到 n 個（池子小於 n 就循環使用）
    for (var k=0;k<n;k++){
      var t = pool[k % pool.length];
      var target = getRandomInt(t.targetMin, t.targetMax);
      if (t.type === 'goldGain') target = roundTo10(target);
      var name = (typeof t.buildName === 'function') ? t.buildName(target) : (t.templateId + ' ' + target);

      // 建立時就決定獎勵（之後不變）
      var stoneAmt = skewedInt(20, 400, SKEW_ALPHA_STONE);
      var goldAmt  = roundTo10(skewedInt(100, 3000, SKEW_ALPHA_GOLD));

      state.tasks.push({
        uid: t.templateId + "_" + Date.now() + "_" + Math.floor(Math.random()*10000),
        templateId: t.templateId,
        type: t.type,
        name: name,
        target: target,
        done: false,
        claimed: false,
        reward: { stone: stoneAmt, gold: goldAmt }
      });
    }
  }

  // —— 獎勵：使用任務上預先決定的數值 ——
  function grantTaskRewards(task){
    var stoneAmt = (task && task.reward && Number(task.reward.stone)) || skewedInt(20, 400, SKEW_ALPHA_STONE);
    var goldAmt  = (task && task.reward && Number(task.reward.gold))  || roundTo10(skewedInt(100, 3000, SKEW_ALPHA_GOLD));

    if (typeof player !== 'undefined'){
      player.stone = (player.stone || 0) + stoneAmt;
      player.gold  = (player.gold  || 0) + goldAmt;
    }
    if (typeof logPrepend === 'function'){
      logPrepend('🎁 任務獎勵 → 強化石 ×'+stoneAmt+'，金幣 ×'+goldAmt);
    }
    if (typeof window.saveGame === 'function') { saveGame(); } // 將資源變更保存到主存檔
  }

  function claim(uid){
    load();
    var i, idx=-1, task=null;
    for(i=0;i<state.tasks.length;i++){
      if(state.tasks[i].uid===uid){ idx=i; task=state.tasks[i]; break; }
    }
    if(!task || !task.done || task.claimed) return false;

    // 發獎（用已決定的 reward）
    grantTaskRewards(task);

    // 領取即移除，釋放上限空間
    state.tasks.splice(idx, 1);

    save();
    if (typeof updateResourceUI==="function") updateResourceUI();
    if (typeof logPrepend==="function") logPrepend("✅ 已領取任務獎勵：「"+(task.name||uid)+"」");
    if (typeof window.saveGame === 'function') { saveGame(); }
    return true;
  }

  // 完成判定
  function markDoneByType(type){
    var cur = (type==='kills') ? state.progress.kills :
              (type==='goldGain') ? state.progress.goldGain :
              (type==='stoneGain') ? state.progress.stoneGain : 0;

    var changed=false;
    for (var i=0;i<state.tasks.length;i++){
      var t=state.tasks[i];
      if (t.type!==type || t.done) continue;
      if (cur >= t.target){
        t.done = true;
        changed = true;
        state.finishedCountThisSlot += 1;
        // 推進 weekly（每完成一個任務就 +1）
        if (typeof window.Weekly_onDailyCompleted==="function"){ try{ window.Weekly_onDailyCompleted(); }catch(e){} }
      }
    }
    return changed;
  }

  function checkAll(){
    var changed=false;
    changed = markDoneByType('kills')     || changed;
    changed = markDoneByType('goldGain')  || changed;
    changed = markDoneByType('stoneGain') || changed;
    if (changed) save();
  }

  // —— 事件入口（穩健化 + 即時重繪）——
  var __renderTimer = null;
  function scheduleRender(){
    try{
      if (typeof QuestCore==='undefined' || !QuestCore.getActiveTab || QuestCore.getActiveTab()!=='daily') return;
      if (__renderTimer) return;
      __renderTimer = setTimeout(function(){ __renderTimer=null; try{ render(); }catch(e){} }, 150);
    }catch(e){}
  }

  window.DM_onLogin = function(){
    load();
    save();
    scheduleRender();
  };
  window.DM_onMonsterKilled = function(n){
    load();
    var add = Number.isFinite(n) ? Math.floor(n) : 1; // 未帶參數 → +1
    if (add < 0) add = 0;
    state.progress.kills += add;
    checkAll();
    save();
    scheduleRender();
  };
  window.DM_onGoldGained = function(a){
    load();
    var add = Number.isFinite(a) ? Math.floor(a) : 0;
    if (add < 0) add = 0;
    state.progress.goldGain += add;
    checkAll();
    save();
    scheduleRender();
  };
  window.DM_onStoneGained = function(a){
    load();
    var add = Number.isFinite(a) ? Math.floor(a) : 0;
    if (add < 0) add = 0;
    state.progress.stoneGain += add;
    checkAll();
    save();
    scheduleRender();
  };

  // —— UI —— 
  function bar(pct,color){
    return '<div style="height:8px;background:#333;border-radius:8px;overflow:hidden;margin-top:6px;">' +
             '<div style="height:8px;width:'+pct+'%;background:'+color+';"></div>' +
           '</div>';
  }

  function render(){
    var box=document.getElementById('questContent'); if(!box) return;
    load();
    var html='';

    var nextDt = nextRotationDate();
    var remain = nextDt - new Date();

    // 頁首資訊（新增：下一輪更換時間與倒數）
    html += '<div style="margin-bottom:6px;color:#aaa">未領任務：<b>'+countPending()+'</b> / '+PENDING_CAP+'</div>';
    html += '<div style="margin-bottom:6px;color:#888;font-size:12px">輪換鍵：'+state.slotKey+'（每 6 小時檢查補任務；滿 '+PENDING_CAP+' 不再新增）</div>';
    html += '<div style="margin-bottom:10px;color:#9aa;font-size:12px">下次輪換：<b>'+fmtDateTime(nextDt)+'</b>（倒數 '+msToHMS(remain)+'）</div>';

    // 列出所有任務（含已完成未領）
    for (var i=0;i<state.tasks.length;i++){
      var it = state.tasks[i];
      var cur = (it.type==='kills') ? state.progress.kills :
                (it.type==='goldGain') ? state.progress.goldGain :
                (it.type==='stoneGain') ? state.progress.stoneGain : 0;
      if (cur > it.target) cur = it.target;
      var pct = it.target>0 ? Math.floor((cur/it.target)*100) : 0;
      var col = (it.type==='kills') ? '#2d7' : (it.type==='goldGain') ? '#c85' : '#48c';

      // 顯示「完成獎勵」
      var rStone = (it.reward && it.reward.stone) ? it.reward.stone : '?';
      var rGold  = (it.reward && it.reward.gold)  ? it.reward.gold  : '?';

      html+='<div style="padding:8px 0;border-bottom:1px solid #444;">'+
              '<div style="font-weight:700">'+(it.name||it.uid)+'</div>'+
              bar(pct,col)+
              '<div style="font-size:12px;color:#aaa;margin-top:4px;">進度：'+cur+' / '+it.target+'</div>'+
              '<div style="font-size:12px;color:#bbb;margin-top:4px;">完成獎勵：強化石 ×'+rStone+'，金幣 ×'+rGold+'</div>';
      if (it.done && !it.claimed){
        html+='<div style="margin-top:6px;"><button data-claim="'+it.uid+'" style="padding:6px 10px;border:none;border-radius:6px;background:#2d7;color:#fff;">領取</button></div>';
      } else if (it.claimed){
        html+='<div style="margin-top:6px;color:#0a0">已領取</div>';
      } else {
        html+='<div style="margin-top:6px;color:#ccc">'+pct+'%</div>';
      }
      html+='</div>';
    }

    box.innerHTML = html;

    // 綁「領取」按鈕
    var btns = box.querySelectorAll ? box.querySelectorAll('[data-claim]') : [];
    for (var j=0;j<btns.length;j++){
      (function(b){ b.onclick=function(){ var uid=b.getAttribute('data-claim'); if (claim(uid)) render(); }; })(btns[j]);
    }
  }

  function onTabChange(){ if (QuestCore.getActiveTab()==='daily'){ load(); render(); } }
  function init(){
    load();
    var btn=document.getElementById('tabDaily'); if (btn) btn.onclick=function(){ QuestCore.setTab('daily'); };
    document.addEventListener('quest:tabchange', onTabChange);

    // 若一開始就停在 daily 頁，立刻渲染
    try { if (typeof QuestCore!=='undefined' && QuestCore.getActiveTab && QuestCore.getActiveTab()==='daily') render(); } catch(e){}
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

  // 登入後自動觸發一次（沿用習慣）
  ;(function autoLoginOnce(){
    function tryCall(){
      if (typeof window.DM_onLogin === 'function') DM_onLogin(); else setTimeout(tryCall, 200);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryCall); else tryCall();
  })();

  // 匯出 / 匯入
  window.Daily_exportState = function () { return JSON.parse(JSON.stringify(state)); };
  window.Daily_applyState = function (s) {
    if (!s || typeof s !== 'object') return;
    state = Object.assign({}, state, s);
    ensureSlot(); ensureTaskRewards(); save();
  };
})();
