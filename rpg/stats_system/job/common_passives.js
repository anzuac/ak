// =======================
// common_passives.js — 共同被動（以「被動能力券」取代被動點）— SaveHub 版
// - 優先使用 SaveHub（save_hub_es5.js）存檔，無則回退 localStorage
// - canLevelUp/levelUp 檢查/扣除道具「被動能力券」
// - UI 顯示「被動能力券：N」；按鈕「升級（消耗 1 張）」
// =======================
(function (w, d) {
  "use strict";
  if (w.CommonPassives) return;

  // ---- 券工具 ----
  function getPassiveTicketCount(){
    try { if (typeof w.getItemQuantity === 'function') return (w.getItemQuantity('被動能力券')|0); } catch(_){}
    return 0;
  }
  function consumePassiveTicket(n){
    n = (n|0)||1;
    try{
      if (typeof w.getItemQuantity === 'function' && typeof w.removeItem === 'function'){
        if ((w.getItemQuantity('被動能力券')|0) >= n){ w.removeItem('被動能力券', n); return true; }
      }
    }catch(_){}
    return false;
  }
  function toast(msg, isError){
    // 若有全域 showToast 就用；否則回退 alert
    if (typeof w.showToast === 'function') { try{ w.showToast(msg, !!isError); return; }catch(_){ } }
    try{ alert(msg); }catch(_){}
  }

  // ---------- 一次性樣式 ----------
  (function injectStyle(){
    if (d.getElementById('cp-style')) return;
    var css =
      ':root{--cp-bg:#0f172a;--cp-card:#111827;--cp-border:#233047;--cp-text:#e5e7eb;--cp-muted:#9ca3af;--cp-accent:#3b82f6;--cp-accent2:#2563eb;--cp-badge:#0b1220}'+
      '.cp-wrap{display:flex;flex-direction:column;gap:12px}'+
      '.cp-header{display:flex;align-items:center;justify-content:space-between;background:#0b1220;border:1px solid var(--cp-border);border-radius:12px;padding:10px 12px;color:var(--cp-text)}'+
      '.cp-header .title{font-weight:800;letter-spacing:.3px}'+
      '.cp-header .points{font-size:13px;color:#bfdbfe;border:1px solid #1d4ed8;background:#0b1530;padding:4px 8px;border-radius:9999px}'+
      '.cp-card{background:var(--cp-card);border:1px solid var(--cp-border);border-radius:12px;padding:12px;color:var(--cp-text);box-shadow:0 10px 24px rgba(0,0,0,.25)}'+
      '.cp-row{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}'+
      '.cp-main{flex:1 1 auto}'+
      '.cp-name{font-weight:700;font-size:15px;margin-bottom:4px}'+
      '.cp-desc{font-size:13px;color:var(--cp-muted);line-height:1.45}'+
      '.cp-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}'+
      '.cp-pill{font-size:12px;border:1px solid var(--cp-border);border-radius:9999px;padding:2px 8px;color:#cbd5e1;background:var(--cp-badge)}'+
      '.cp-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0}'+
      '.cp-level{font-size:12px;color:var(--cp-muted)}'+
      '.btn{background:#1f2937;border:1px solid var(--cp-border);color:#f8fafc;padding:6px 10px;border-radius:8px;cursor:pointer}'+
      '.btn.primary{background:var(--cp-accent);border-color:var(--cp-accent2)}'+
      '.btn.primary:disabled{opacity:.5;cursor:not-allowed}';
    var el = d.createElement('style');
    el.id = 'cp-style'; el.textContent = css; d.head.appendChild(el);
  })();

  // ---------- 定義 ----------
  var DEF = [
    { id:"cp_crit_mastery", name:"致命洞察",  maxLevel:20, perLevel:function(lv){ return { critRate:0.02*lv, critMultiplier:0.01*lv }; }, lines:function(){ return ["每等：爆擊率 +2%，爆擊傷害 +1%"]; } },
    { id:"cp_haste",        name:"迅捷律動",  maxLevel:20, perLevel:function(lv){ return { attackSpeedPct:0.015*lv }; },           lines:function(){ return ["每等：攻擊速度 +1.5%"]; } },
    { id:"cp_fortitude",    name:"堅韌意志",  maxLevel:20, perLevel:function(lv){ return { def:3*lv, hp:50*lv }; },               lines:function(){ return ["每等：防禦 +3，HP +50"]; } },
    { id:"cp_armor_pierce", name:"破甲專精",  maxLevel:30, perLevel:function(lv){ return { ignoreDefPct:0.01*lv }; },            lines:function(){ return ["每等：穿透（無視防禦）+1%"]; } },
    { id:"cp_wealth",       name:"財富祝福",  maxLevel:50, perLevel:function(lv){ return { expBonus:0.01*lv, dropBonus:0.01*lv, goldBonus:0.01*lv }; }, lines:function(){ return ["每等：經驗值 / 掉寶 / 金幣 各 +1%"]; } },
  ];

  // ---------- 存檔：SaveHub 優先 ----------
  var NS = "common_passives_v1";
  var LS_KEY = "退回被動能力";
  var useSaveHub = !!w.SaveHub;

  function fresh(){
    var o={}; for (var i=0;i<DEF.length;i++) o[DEF[i].id]=0; return o;
  }
  function normalize(levels){
    var o = levels || {}; for (var i=0;i<DEF.length;i++) if (!(DEF[i].id in o)) o[DEF[i].id]=0;
    for (var k in o){ var def = DEF.find(function(x){return x.id===k;}); if (def){ o[k] = Math.max(0, Math.min(def.maxLevel, Number(o[k]||0))); } }
    return o;
  }
  if (useSaveHub){
    try{
      var spec={}; spec[NS] = { version:1, migrate:function(old){ return normalize(old||fresh()); } };
      w.SaveHub.registerNamespaces(spec);
    }catch(_){}
  }
  function load(){
    try{
      if (useSaveHub) return normalize(w.SaveHub.get(NS, fresh()));
      var raw = w.localStorage && w.localStorage.getItem(LS_KEY);
      return normalize(raw ? JSON.parse(raw)||fresh() : fresh());
    }catch(_){ return fresh(); }
  }
  function save(){
    try{
      if (useSaveHub) w.SaveHub.set(NS, levels);
      else w.localStorage && w.localStorage.setItem(LS_KEY, JSON.stringify(levels));
    }catch(_){}
  }

  var levels = load();

  // ---------- 聚合到 player.coreBonus ----------
  function sumBonuses(){
    var out = { critRate:0, critMultiplier:0, attackSpeedPct:0, ignoreDefPct:0, expBonus:0, dropBonus:0, goldBonus:0, def:0, hp:0 };
    DEF.forEach(function(p){ var lv=Math.max(0, Math.min(p.maxLevel, Number(levels[p.id]||0))); var add=p.perLevel(lv); for(var k in add) out[k]=(out[k]||0)+(add[k]||0); });
    return out;
  }
  function applyToPlayer(){
    if(!w.player || !w.player.coreBonus || !w.player.coreBonus.bonusData) return;
    w.player.coreBonus.bonusData.common_passives = sumBonuses();
  }
  (function hookAggregate(){
    var ag=w.JobPassiveAggregate;
    if(!ag || typeof ag.apply!=="function") return;
    var old=ag.apply.bind(ag);
    ag.apply=function(){ var r=old(); try{applyToPlayer();}catch(_){ } return r; };
  })();
  function ensureApplySoon(){ setTimeout(function(){ try{ applyToPlayer(); }catch(_){ } }, 0); }

  // ---------- 升級（吃券） ----------
  function canLevelUp(id){
    var def = DEF.find(function(x){return x.id===id;});
    if(!def) return {ok:false, reason:'not_found'};
    var cur = levels[id]||0;
    if (cur >= def.maxLevel) return {ok:false, reason:'max'};
    if (getPassiveTicketCount() <= 0) return {ok:false, reason:'no_ticket'};
    return {ok:true};
  }
  function levelUp(id){
    var res = canLevelUp(id);
    if(!res.ok) return res;
    if (!consumePassiveTicket(1)) return {ok:false, reason:'no_ticket'};
    levels[id] = (levels[id]||0) + 1;
    save(); applyToPlayer();
    try{ if (typeof w.updateResourceUI === 'function') w.updateResourceUI(); }catch(_){}
    return {ok:true, level:levels[id]};
  }

  // ---------- 對外 API ----------
  w.CommonPassives = {
    list: function(){
      return DEF.map(function(p){
        var lv=levels[p.id]||0; return { id:p.id, name:p.name, level:lv, maxLevel:p.maxLevel, lines:p.lines(), bonuses:p.perLevel(lv) };
      });
    },
    getLevel: function(id){ return Number(levels[id]||0); },
    setLevel: function(id, lv){
      var def=DEF.find(function(x){return x.id===id;}); if(!def) return;
      levels[id]=Math.max(0, Math.min(def.maxLevel, Number(lv)||0));
      save(); applyToPlayer();
    },
    levelUp: levelUp,
    apply: applyToPlayer
  };

  // 初次套用
  (function waitPlayer(){
    if (w.player && w.player.coreBonus && w.player.coreBonus.bonusData){ applyToPlayer(); }
    else setTimeout(waitPlayer, 50);
  })();

  // ---------- UI 渲染（顯示券數量） ----------
  function renderInto(container){
    container.innerHTML = "";
    var wrap = d.createElement('div'); wrap.className = 'cp-wrap';

    var header = d.createElement('div'); header.className = 'cp-header';
    var title = d.createElement('div'); title.className = 'title'; title.textContent = '🧩 共同被動';
    var tickets = getPassiveTicketCount();
    var points = d.createElement('div'); points.className = 'points'; points.textContent = '被動能力券：' + tickets;
    header.appendChild(title); header.appendChild(points); wrap.appendChild(header);

    var list = w.CommonPassives.list();
    list.forEach(function(p){
      var card = d.createElement('div'); card.className = 'cp-card';
      var row = d.createElement('div'); row.className = 'cp-row';
      var main = d.createElement('div'); main.className = 'cp-main';
      var right = d.createElement('div'); right.className = 'cp-right';

      var name = d.createElement('div'); name.className = 'cp-name'; name.textContent = p.name;
      var desc = d.createElement('div'); desc.className = 'cp-desc';
      desc.innerHTML = p.lines.map(function(s){return '• '+s;}).join('<br>');
      var badges = d.createElement('div'); badges.className = 'cp-badges';

      var preview = []; var b=p.bonuses;
      if (b.critRate)       preview.push('爆擊率 +'+Math.round(b.critRate*100)+'%');
      if (b.critMultiplier) preview.push('爆擊傷害 +'+Math.round(b.critMultiplier*100)+'%');
      if (b.attackSpeedPct) preview.push('攻速 +'+Math.round(b.attackSpeedPct*100)+'%');
      if (b.ignoreDefPct)   preview.push('穿防 +'+Math.round(b.ignoreDefPct*100)+'%');
      if (b.expBonus)       preview.push('經驗 +'+Math.round(b.expBonus*100)+'%');
      if (b.dropBonus)      preview.push('掉寶 +'+Math.round(b.dropBonus*100)+'%');
      if (b.goldBonus)      preview.push('金幣 +'+Math.round(b.goldBonus*100)+'%');
      if (b.def)            preview.push('防禦 +'+b.def);
      if (b.hp)             preview.push('HP +'+b.hp);
      if (!preview.length)  preview.push('尚無加成');
      var pill = d.createElement('span'); pill.className='cp-pill'; pill.textContent = preview.join('｜'); badges.appendChild(pill);
      main.appendChild(name); main.appendChild(desc); main.appendChild(badges);

      var lv = d.createElement('div'); lv.className = 'cp-level'; lv.textContent = 'Lv. ' + p.level + ' / ' + p.maxLevel;
      var btn = d.createElement('button'); btn.className='btn primary'; btn.textContent='升級（消耗 1 張）';
      var can = canLevelUp(p.id).ok; btn.disabled = !can;
      btn.onclick = function(){
        var res = w.CommonPassives.levelUp(p.id);
        if (!res.ok) {
          if (res.reason==='max') toast('已達上限', true);
          else if (res.reason==='no_ticket') toast('需要「被動能力券」', true);
          else toast('無法升級', true);
          return;
        }
        toast('升級成功！');
        renderInto(container);
      };

      right.appendChild(lv); right.appendChild(btn);
      row.appendChild(main); row.appendChild(right); card.appendChild(row); wrap.appendChild(card);
    });

    container.appendChild(wrap);
  }

  // 掛到 SkillsHub
  var hub = (w.SkillsHub && typeof w.SkillsHub.registerTab === 'function' && w.SkillsHub) || (w.skills_hub && typeof w.skills_hub.registerTab === 'function' && w.skills_hub) || null;
  if (hub) {
    hub.registerTab({
      id:'common-passives',
      title:'共同被動',
      render:renderInto,
      onOpen:function(){ try{ applyToPlayer(); }catch(_){} },
      onClose:function(){},
      tick:function(){}
    });
  }
})(window, document);