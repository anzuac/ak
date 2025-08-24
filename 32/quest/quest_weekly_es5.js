(function(){
  if (!window.QuestCore) return;

  var STORAGE_KEY='WEEKLY_STATE_V1';
  var weeklyState={ weekKey:'', doneCount:0, claimed:{'5':false,'10':false,'20':false,'30':false} };

  function pad2(n){ return (n<10?'0':'')+n; }
  function weekKey(){ // 以該週「週一」為 key
    var d=new Date(), day=d.getDay(), diff=(day===0?-6:(1-day)), m=new Date(d.getFullYear(),d.getMonth(),d.getDate()+diff);
    return m.getFullYear()+'-'+pad2(m.getMonth()+1)+'-'+pad2(m.getDate());
  }
  function load(){
    try{ var raw=localStorage.getItem(STORAGE_KEY); if(raw){ var o=JSON.parse(raw); if(o) weeklyState=o; } }catch(e){}
    var k=weekKey();
    if(weeklyState.weekKey!==k){ weeklyState.weekKey=k; weeklyState.doneCount=0; weeklyState.claimed={'5':false,'10':false,'20':false,'30':false}; }
    save();
  }
  function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(weeklyState)); }catch(e){} }

  // 提供給每日任務呼叫：完成一項每日 → 週+1
  window.Weekly_onDailyCompleted=function(){ load(); weeklyState.doneCount+=1; save(); if(QuestCore.getActiveTab()==='weekly') render(); };

  function grantReward(rew){
    var t=rew.type;
    if(t==='gold'&&rew.amount>0){ if(typeof player!=='undefined') player.gold=(player.gold||0)+rew.amount; }
    else if(t==='stone'&&rew.amount>0){ if(typeof player!=='undefined') player.stone=(player.stone||0)+rew.amount; }
    else if(t==='diamond'&&rew.amount>0){ if(typeof player!=='undefined') player.gem=(player.gem||0)+rew.amount; }
    else if(t==='diamond_box'){ var v=(rew.min||0)+Math.floor(Math.random()*((rew.max||0)-(rew.min||0)+1)); if(typeof player!=='undefined') player.gem=(player.gem||0)+v; logPrepend&&logPrepend('🎁 週寶箱開出 '+v+' 鑽石！'); }
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
  function claim(target){
    load();
    if(weeklyState.doneCount<target) return false;
    var k=String(target); if(weeklyState.claimed[k]) return false;
    var packs=(missionRewards&&missionRewards.weekly)?missionRewards.weekly:[];
    var i, pack=null; for(i=0;i<packs.length;i++) if(packs[i].target===target){ pack=packs[i]; break; }
    if(!pack) return false;
    for(i=0;i<(pack.rewards||[]).length;i++) grantReward(pack.rewards[i]);
    weeklyState.claimed[k]=true; save(); updateResourceUI&&updateResourceUI(); logPrepend&&logPrepend('✅ 已領取每週里程碑獎勵（'+target+' 次）'); return true;
  }

  function nodeHTML(target){
    var done=weeklyState.doneCount, can=(done>=target), took=!!weeklyState.claimed[String(target)];
    var state=took?'已領':(can?'可領':'未達');
    var btnStyle='padding:6px 10px;border:none;border-radius:6px;'+(took?'background:#555;color:#aaa':'background:'+(can?'#2d7':'#444')+';color:#fff');
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin:6px 0;gap:8px;">' +
             '<div>'+target+' 次</div>' +
             '<button data-week-claim="'+target+'" style="'+btnStyle+'">'+state+'</button>' +
           '</div>';
  }

  function render(){
    var box=document.getElementById('questContent'); if(!box) return;
    load();
    var done=weeklyState.doneCount, pct=Math.floor(Math.min(100,(done/30)*100));
    var html='';
    html+='<div style="margin-bottom:8px;color:#ddd;">本週完成每日任務：<b>'+done+'</b> / 30</div>';
    html+='<div style="height:10px;background:#333;border-radius:8px;overflow:hidden;margin-bottom:10px;"><div style="height:10px;width:'+pct+'%;background:#48c;"></div></div>';
    html+=nodeHTML(5)+nodeHTML(10)+nodeHTML(20)+nodeHTML(30);
    box.innerHTML=html;

    var btns=box.querySelectorAll?box.querySelectorAll('[data-week-claim]'):[];
    var i; for(i=0;i<btns.length;i++){
      (function(b){ b.onclick=function(){ var t=parseInt(b.getAttribute('data-week-claim'),10)||0; if(claim(t)) render(); }; })(btns[i]);
    }
  }

  function onTabChange(){ if(QuestCore.getActiveTab()==='weekly') render(); }
  function init(){
    var btn=document.getElementById('tabWeekly'); if(btn) btn.onclick=function(){ QuestCore.setTab('weekly'); };
    document.addEventListener('quest:tabchange', onTabChange);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
// === Weekly Export / Import (for unified save) ===
window.Weekly_exportState = function () {
  return JSON.parse(JSON.stringify(weeklyState));
};
window.Weekly_applyState = function (s) {
  if (!s || typeof s !== 'object') return;
  // 先合併，再跑 load() 讓它自動週期校正（跨週會重置）
  weeklyState = Object.assign({}, weeklyState, s);
  load();
  save();
};