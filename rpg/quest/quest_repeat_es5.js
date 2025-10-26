// quest_repeat_es5.js — 重複任務（V4：回歸 SaveHub 主控存檔）
(function(){
  if (!window.QuestCore || !window.SaveHub) return;

  // ====== SaveHub（中央存檔）======
  var NS = 'repeat:v4';
  function defState(){
    return {
      goldGain:0, stoneGain:0, diamondSpend:0, kills:0,
      done:{ goldGain:0, stoneGain:0, diamondSpend:0, kills:0 }
    };
  }
  function normalize(s){
    if (!s || typeof s!=='object') s = defState();
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
  function load(){ return normalize(SaveHub.getOrInit(NS, defState())); }
  function save(s){ SaveHub.set(NS, normalize(s), {replace:true}); }

  // 任務定義
  var QUESTS = [
    {
      kind: 'goldGain', title: '金幣達人',
      desc: '擊殺怪物獲得金幣達標可得星痕代幣。',
      baseThresh: 200000,
      baseReward: [{type:'star', amount:2}],
      color: '#22c55e'
    },
    {
      kind: 'stoneGain', title: '礦藏大師',
      desc: '擊殺怪物獲得強化石。',
      baseThresh: 40000,
      baseReward: [{type:'star', amount:5}],
      color: '#10b981'
    },
    {
      kind: 'diamondSpend', title: '豪擲千金',
      desc: '鑽石消費達標，回饋大量鑽石（此任務維持發鑽石）。',
      baseThresh: 10000,
      baseReward: [{type:'diamond', amount:100}],
      color: '#f59e0b'
    },
    {
      kind: 'kills', title: '狩獵連環',
      desc: '擊殺怪物達標，獲得強化石與星痕代幣。',
      baseThresh: 20,
      baseReward: [{type:'stone', amount:20},{type:'star', amount:3}],
      color: '#3b82f6'
    }
  ];

  var THRESH_MUL = 1.4;
  var REWARD_MUL = 1.1;

  var state = load();

  // ====== 工具 ======
  function fmt(n){ return Math.floor(n||0).toLocaleString(); }
  function pct(cur,max){ return (max>0)? Math.max(0, Math.min(100, Math.floor((cur/max)*100))) : 0; }
  function round56(x){ var neg=x<0; x=Math.abs(x); var i=Math.floor(x),f=x-i; return neg?-(f>=0.6?i+1:i):(f>=0.6?i+1:i); }

  function currentThresh(q){
    var done = state.done[q.kind]||0;
    return Math.max(1, Math.floor(q.baseThresh * Math.pow(THRESH_MUL, done)));
  }
  function rewardPackFor(q){
    var done = state.done[q.kind]||0;
    var mul = Math.pow(REWARD_MUL, done);
    return q.baseReward.map(r => ({
      type:r.type,
      amount: Math.max(1, round56((r.amount||0)*mul))
    }));
  }

  function grant(r){
    var t=r.type, a=Math.max(0, Math.floor(r.amount||0));
    if(a<=0)return;
    if(t==='gold'){player.gold+=a;}
    else if(t==='stone'){player.stone+=a;}
    else if(t==='diamond'){player.gem+=a;}
    else if(t==='star'){ addItem && addItem('星痕代幣',a); }
  }
  function grantPack(list){ list.forEach(grant); updateResourceUI&&updateResourceUI(); }

  // ====== 任務處理 ======
  function settleQuest(q,key){
    var loops=0;
    while(state[key]>=currentThresh(q)){
      state[key]-=currentThresh(q);
      grantPack(rewardPackFor(q));
      state.done[q.kind]++;
      loops++;
    }
    if(loops>0){ logPrepend&&logPrepend('✅ 重複任務達成「'+q.title+'」×'+loops); save(state); }
  }

  // ====== 事件回調 ======
  function onGoldGained(a){ if(a>0){ state.goldGain+=a; settleQuest(QUESTS[0],'goldGain'); } }
  function onStoneGained(a){ if(a>0){ state.stoneGain+=a; settleQuest(QUESTS[1],'stoneGain'); } }
  function onDiamondSpent(a){ if(a>0){ state.diamondSpend+=a; settleQuest(QUESTS[2],'diamondSpend'); } }
  function onKills(k){ if(k>0){ state.kills+=k; settleQuest(QUESTS[3],'kills'); } }

  function wrapGlobal(fn,wrap){
    var old=window[fn];
    window[fn]=function(){
      old&&old.apply(this,arguments);
      try{wrap.apply(this,arguments);}catch(e){}
    };
  }
  wrapGlobal('DM_onGoldGained', onGoldGained);
  wrapGlobal('DM_onStoneGained', onStoneGained);
  wrapGlobal('DM_onMonsterKilled', onKills);

  window.RM_onDiamondSpent = function(spent){
    state = load(); onDiamondSpent(spent||0);
  };

  // ====== UI ======
  function cardHTML(q,cur,need,done){
    var rewards = rewardPackFor(q).map(r=>{
      var n=(r.type==='diamond'?'鑽石':r.type==='star'?'星痕代幣':r.type==='gold'?'金幣':r.type==='stone'?'強化石':r.type);
      return n+' ×'+fmt(r.amount);
    }).join('、');
    var bar=pct(cur,need);
    return `
      <div style="border:1px solid #1f2937;border-radius:12px;background:#0b1220;padding:12px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-weight:900">${q.title}</div>
          <div style="opacity:.85;font-size:12px">已完成：<b>${fmt(done)}</b> 次</div>
        </div>
        <div style="opacity:.9;font-size:12px;margin-bottom:8px">${q.desc}</div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-bottom:2px">
          <div>
            <div style="font-size:12px;opacity:.9;margin-bottom:4px">當前門檻：<b>${fmt(need)}</b>　|　進度：<b>${fmt(cur)}</b></div>
            <div style="height:10px;background:#111827;border:1px solid #233042;border-radius:999px;overflow:hidden">
              <div style="height:100%;width:${bar}%;background:${q.color}"></div>
            </div>
          </div>
          <div style="text-align:right;white-space:nowrap;font-size:12px;opacity:.95">下次獎勵：<b>${rewards}</b></div>
        </div>
      </div>`;
  }

  function render(){
    var box=document.getElementById('questContent'); if(!box) return;
    state = load();
    box.innerHTML = QUESTS.map(q=>{
      var need=currentThresh(q),cur=state[q.kind],done=state.done[q.kind]||0;
      return cardHTML(q,cur,need,done);
    }).join('');
  }

  function onTabChange(){ if(QuestCore.getActiveTab()==='repeatables') render(); }
  function init(){
    var btn=document.getElementById('tabRepeatables');
    if(btn) btn.onclick=function(){ QuestCore.setTab('repeatables'); };
    document.addEventListener('quest:tabchange', onTabChange);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.Repeat_exportState = function(){ return SaveHub.get(NS, defState()); };
  window.Repeat_applyState = function(s){ if(s&&typeof s==='object') SaveHub.set(NS, normalize(s), {replace:true}); };
})();