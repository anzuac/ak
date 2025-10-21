// =======================================================
// job_passives_tab.js — GrowthHub 分頁（改為顯示「被動能力券」）ES5
// - 不改結構，只改文案/可用判定來源（由 Store 控）
// =======================================================
(function (w, d) {
  "use strict";
  if (w.JobPassiveTab) return;

  function byId(id){ return d.getElementById(id); }
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function getBaseJobSafe(job){ var j=String(job||"").toLowerCase(); if (typeof w.getBaseJob === 'function') return w.getBaseJob(j); return j.replace(/\d+$/, ""); }
  function getTickets(){ try{ if (typeof w.getItemQuantity==='function') return (w.getItemQuantity('被動能力券')|0); }catch(_){} return 0; }
  function card(title, inner){ return '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:10px;margin-bottom:10px">'+ '<div style="font-weight:700;margin-bottom:6px">'+title+'</div>'+ inner +'</div>'; }

  function renderInto(container){
    if (!w.JobPassiveStore || !w.JobPassiveAggregate) { container.innerHTML = card('⚠️ 職業被動', '缺少模組：job_passives_store/aggregate'); return; }

    var cfg = JobPassiveStore.getConfig();
    var lv  = JobPassiveStore.getLevels();
    var base = getBaseJobSafe(w.player && w.player.job);
    var ticketStr = fmt(getTickets());
    var btnDis = 'disabled style="opacity:.5;cursor:not-allowed"';

    var warriorHtml =
      '<div style="opacity:.85;margin-bottom:4px"><b>堅韌護體</b> — 每級 +3% 減傷（上限 '+cfg.MAX_LV+'）</div>'+
      '<div>等級：<b>'+lv.warrior.fortitude+'</b> / '+cfg.MAX_LV+'</div>'+
      '<div style="margin-top:6px"><button id="btnJPWarrior" '+(base==='warrior'?'':' '+btnDis)+' style="background:#10b981;border:0;border-radius:8px;padding:6px 10px;color:#031318;cursor:pointer">升級（-1 張）</button></div>';

    var mageHtml =
      '<div style="opacity:.85;margin-bottom:4px"><b>魔力護體</b> — 每級 +7% 魔力護盾（上限 '+cfg.MAX_LV+'）</div>'+
      '<div>等級：<b>'+lv.mage.manaGuard+'</b> / '+cfg.MAX_LV+'</div>'+
      '<div style="margin-top:6px"><button id="btnJPMage" '+(base==='mage'?'':' '+btnDis)+' style="background:#3b82f6;border:0;border-radius:8px;padding:6px 10px;color:#031318;cursor:pointer">升級（-1 張）</button></div>';

    var thiefHtml =
      '<div style="opacity:.85;margin-bottom:4px"><b>連續攻擊</b> — 每級 +4% 連擊率（上限 '+cfg.MAX_LV+'）</div>'+
      '<div>等級：<b>'+lv.thief.flurry+'</b> / '+cfg.MAX_LV+'</div>'+
      '<div style="margin-top:6px"><button id="btnJPThief" '+(base==='thief'?'':' '+btnDis)+' style="background:#f59e0b;border:0;border-radius:8px;padding:6px 10px;color:#031318;cursor:pointer">升級（-1 張）</button></div>';

    var archerHtml =
      '<div style="opacity:.85;margin-bottom:4px"><b>先手再動</b> — 每級 +4% 先手再發動機率；<u>10等</u> 時每次攻擊再動次數上限 <b>+1</b>（上限 '+cfg.MAX_LV+'）</div>'+
      '<div>等級：<b>'+lv.archer.quickdraw+'</b> / '+cfg.MAX_LV+'</div>'+
      '<div style="margin-top:6px"><button id="btnJPArcher" '+(base==='archer'?'':' '+btnDis)+' style="background:#06b6d4;border:0;border-radius:8px;padding:6px 10px;color:#031318;cursor:pointer">升級（-1 張）</button></div>';

    container.innerHTML =
      card('🎟 可用憑證', '被動能力券：<b>'+ticketStr+'</b>') +
      card('🛡 劍士專屬', warriorHtml) +
      card('🔮 法師專屬', mageHtml) +
      card('🗡 盜賊專屬', thiefHtml) +
      card('🏹 弓箭手專屬', archerHtml);

    var b1 = byId('btnJPWarrior');
    var b2 = byId('btnJPMage');
    var b3 = byId('btnJPThief');
    var b4 = byId('btnJPArcher');

    if (b1) b1.onclick = function(){ if (JobPassiveStore.tryLevelUp('warrior')) { JobPassiveAggregate.apply(); requestRerender(); } else alert('需要被動能力券或已達上限'); };
    if (b2) b2.onclick = function(){ if (JobPassiveStore.tryLevelUp('mage'))    { JobPassiveAggregate.apply(); requestRerender(); } else alert('需要被動能力券或已達上限'); };
    if (b3) b3.onclick = function(){ if (JobPassiveStore.tryLevelUp('thief'))   { JobPassiveAggregate.apply(); requestRerender(); } else alert('需要被動能力券或已達上限'); };
    if (b4) b4.onclick = function(){ if (JobPassiveStore.tryLevelUp('archer'))  { JobPassiveAggregate.apply(); requestRerender(); } else alert('需要被動能力券或已達上限'); };
  }

  function requestRerender(){ if (w.GrowthHub && typeof w.GrowthHub.requestRerender === 'function') { w.GrowthHub.requestRerender(); } else { var root = byId('job-passives-fallback'); if (root) renderInto(root); } }
  function mountFallback(){ var root = byId('job-passives-fallback'); if (!root){ root = d.createElement('div'); root.id = 'job-passives-fallback'; root.style.cssText = 'padding:10px;border:1px solid #334155;border-radius:10px;margin:8px 0;background:#0b1220;color:#cbd5e1'; d.body.appendChild(root); } renderInto(root); }

  if (w.SkillsHub && typeof w.SkillsHub.registerTab === 'function') {
    w.SkillsHub.registerTab({ id:'job-passives', title:'職業被動', render:function(c){ renderInto(c); }, tick:function(){}, onOpen:function(){ try{ w.JobPassiveAggregate && w.JobPassiveAggregate.apply(); }catch(_){} }, onClose:function(){ try{ w.JobPassiveAggregate && w.JobPassiveAggregate.apply(); }catch(_){} } });
  } else {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountFallback); else mountFallback();
  }

  try { w.JobPassiveStore && w.JobPassiveStore.subscribe(requestRerender); } catch(_){ }
  w.JobPassiveTab = { rerender: requestRerender };
})(window, document);