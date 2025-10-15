// dungeon/core_dungeon_tab.js — 核心副本（普通 / 困難 / 地獄；傳 def/utils 進引擎）
(function () {
  "use strict";

  function ready(){
    return !!(window.DungeonHub && window.TicketManager && window.ACC_Core &&
              window.CORE_DungeonDef && window.CORE_HellDungeonDef && window.LC_ConfigUtils);
  }
  (function wait(i){ i=i||0; if(ready()){ try{init();}catch(e){console.error(e);} return; }
    if (i>400){ console.error("[core_tab] deps timeout"); return; }
    setTimeout(function(){ wait(i+1); }, 50);
  })();

  function init(){
    var TM   = window.TicketManager;
    var CORE = window.ACC_Core;
    var U    = window.LC_ConfigUtils;
    var DEFN = window.CORE_DungeonDef;      // 普/困
    var DEFH = window.CORE_HellDungeonDef;  // 地獄
    var GATE = window.DungeonGate || null;
    var TKEY = "ChallengeTicket";

    var PROG_KEY = "core_trial_progress_v1";
    function loadProg(){
      try { return JSON.parse(localStorage.getItem(PROG_KEY)) || { normal:{maxCleared:0}, hard:{maxCleared:0}, hell:{maxCleared:0} }; }
      catch(_){ return { normal:{maxCleared:0}, hard:{maxCleared:0}, hell:{maxCleared:0} }; }
    }
    function saveProg(p){ try{ localStorage.setItem(PROG_KEY, JSON.stringify(p||{})); }catch(_){} }

    var mode="normal";

    function getTicketCfg(){ return (TM && TM.getConfig && TM.getConfig(TKEY)) || { NAME:"挑戰券（免費）", ITEM_NAME:"挑戰券" }; }
    function refill(){ TM && TM.refill(TKEY); }
    function getTicket(){ return TM ? TM.get(TKEY) : { free:{count:0,cap:0,lastTs:Date.now()}, bag:{count:0}, total:0 }; }
    function timeToNext(){ return TM ? TM.timeToNext(TKEY) : 0; }
    function fmtClock(ms){ var s=Math.floor(ms/1000), m=Math.floor(s/60), ss=s%60; return m+":"+String(ss).padStart(2,"0"); }

    function headerHTML(){
      refill();
      var cfg=getTicketCfg(), t=getTicket(), left=timeToNext();
      var leftTxt=(t.free.count >= t.free.cap) ? "已滿" : ("+" + fmtClock(left));
      var label=cfg.ITEM_NAME||cfg.NAME;
      return [
        '<div style="border:1px solid #243247;background:#0b1220;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">',
          '<div style="font-size:12px;line-height:1.6">',
            '<div><b>', cfg.NAME, '</b>（免費）：<b>', t.free.count, '</b> / ', t.free.cap, '　<span style="opacity:.8">下次回復：', leftTxt, '</span></div>',
            '<div>背包：<b>', t.bag.count, '</b>　總計：<b>', t.total, '</b></div>',
          '</div>',
          '<div style="font-size:12px;opacity:.85">消耗：', label, ' ×1</div>',
        '</div>'
      ].join('');
    }

    function panelHTML(){
      var p = loadProg();
      var maxN = Number(p.normal?.maxCleared || 0);
      var maxH = Number(p.hard?.maxCleared   || 0);
      var maxX = Number(p.hell?.maxCleared   || 0);

      var nextLvN = Math.min(maxN + 1, window.LC_LevelConfig.MAX_LEVEL);
      var nextLvH = Math.min(maxH + 1, window.LC_LevelConfig.MAX_LEVEL);
      var nextLvX = Math.min(maxX + 1, window.LC_LevelConfig.MAX_LEVEL);

      var label, rewards, nextLv, maxCleared, color;
      if (mode === "normal"){
        label = "普通（1v1 / 3 波）";
        rewards = U.scaledRewardsForLevel(DEFN.rewardsNormal, nextLvN);
        nextLv = nextLvN; maxCleared = maxN; color="#2563eb";
      } else if (mode === "hard"){
        label = "困難（1v3 / 3 波）";
        rewards = U.scaledRewardsForLevel(DEFN.rewardsHard, nextLvH);
        nextLv = nextLvH; maxCleared = maxH; color="#2563eb";
      } else {
        label = "地獄（1v4 / 4 波，Boss）";
        rewards = U.scaledRewardsForLevel(DEFH.rewardsHard, nextLvX);
        nextLv = nextLvX; maxCleared = maxX; color="#ef4444";
      }

      var lines = Object.keys(rewards || {}).map(function(k){ return "・" + k + "：" + U.formatRange(rewards[k]); });
      if (!lines.length) lines.push("・—");

      return [
        '<div style="border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px">',
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">',
            '<div style="font-weight:800">⚙️ 核心副本</div>',
            '<div style="display:flex;gap:8px">',
              '<button class="btn-core-mode" data-mode="normal" style="padding:4px 8px;border:0;border-radius:8px;', (mode==="normal"?'background:#2563eb;color:#fff;':'background:#1f2937;color:#fff;') ,'">普通</button>',
              '<button class="btn-core-mode" data-mode="hard"   style="padding:4px 8px;border:0;border-radius:8px;', (mode==="hard"  ?'background:#2563eb;color:#fff;':'background:#1f2937;color:#fff;') ,'">困難</button>',
              '<button class="btn-core-mode" data-mode="hell"   style="padding:4px 8px;border:0;border-radius:8px;', (mode==="hell"  ?'background:#ef4444;color:#fff;':'background:#1f2937;color:#fff;') ,'">地獄</button>',
            '</div>',
          '</div>',
          '<div style="opacity:.9;font-size:12px;margin:6px 0 8px">', label ,'</div>',
          '<div style="font-size:12px;opacity:.95;line-height:1.8">',
            '目前最高通關：', maxCleared ,' / ', window.LC_LevelConfig.MAX_LEVEL ,'　｜　下一關：Lv.', nextLv ,'（限時 ', (DEFN.timeLimitSec||0) ,' 秒）',
          '</div>',
          '<div style="font-size:12px;opacity:.95;line-height:1.8;margin-top:6px">',
            '<div>挑戰獎勵（按 Lv 放大）</div>',
            lines.join('<br>'),
          '</div>',
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">',
            '<button class="btn-core-start" data-level="',nextLv,'" style="padding:8px 12px;border:0;border-radius:8px;background:', color ,';color:#fff;cursor:pointer">挑戰下一關（消耗：', (getTicketCfg().ITEM_NAME||getTicketCfg().NAME) ,' ×1）</button>',
            (maxCleared>0?'<button class="btn-core-retry" data-level="'+maxCleared+'" style="padding:8px 12px;border:0;border-radius:8px;background:#4b5563;color:#fff;cursor:pointer">挑戰上次通關（Lv.'+maxCleared+'）</button>':''),
            (maxCleared>0?'<button class="btn-core-sweep" data-level="'+maxCleared+'" style="padding:8px 12px;border:0;border-radius:8px;background:#1f2937;color:#fff;cursor:pointer">掃蕩（Lv.'+maxCleared+' / ×0.75）</button>':''),
          '</div>',
        '</div>'
      ].join('');
    }

    DungeonHub.registerTab({
      id: "core_trial_tab",
      title: "核心副本",
      render: function(container){
        container.innerHTML = headerHTML() + panelHTML();

        function rerender(){ DungeonHub.requestRerender(); }
        function ensureStopped(){
          if (GATE && typeof GATE.ensureStopped==="function") return !!GATE.ensureStopped();
          if (window.autoEnabled){ alert("請先停止外部戰鬥再進入副本"); return false; }
          return true;
        }

        container.querySelectorAll('.btn-core-mode').forEach(function(b){
          b.onclick = function(){ mode = this.getAttribute('data-mode'); rerender(); };
        });

        function commonEntry(level, isRepeat){
          if (!ensureStopped()) return;
          if (!TM || !TM.canSpend(TKEY,1)){ alert("需要 "+(getTicketCfg().ITEM_NAME||getTicketCfg().NAME)+" ×1"); return; }

          var p = loadProg();
          var maxMap = { normal:Number(p.normal?.maxCleared||0), hard:Number(p.hard?.maxCleared||0), hell:Number(p.hell?.maxCleared||0) };
          if (!isRepeat && level !== (maxMap[mode] + 1)){
            alert("需先通關 Lv."+ (maxMap[mode]||0) +" 才能挑戰 Lv."+level);
            return;
          }

          var def = (mode==="hell") ? DEFH : DEFN;
          var runner = (mode==="normal") ? CORE.startNormal : (mode==="hard") ? CORE.startHard : CORE.startHell;

          DungeonHub.close();
          runner(def, U, level, function(state){
            if (state === "win"){
              TM.spend(TKEY,1);
              if (!isRepeat){
                var pr = loadProg();
                var key = (mode==="normal")?"normal":(mode==="hard")?"hard":"hell";
                pr[key] = pr[key] || { maxCleared:0 };
                if (level > pr[key].maxCleared) pr[key].maxCleared = level;
                saveProg(pr);
              }
              window.saveGame?.();
            }
          });
        }

        var s = container.querySelector('.btn-core-start');
        if (s) s.onclick = function(){ commonEntry(Number(this.getAttribute('data-level')), false); };
        var r = container.querySelector('.btn-core-retry');
        if (r) r.onclick = function(){ commonEntry(Number(this.getAttribute('data-level')), true); };

        var wbtn = container.querySelector('.btn-core-sweep');
        if (wbtn) wbtn.onclick = function(){
          var level = Number(this.getAttribute('data-level'));
          if (!TM || !TM.canSpend(TKEY,1)){ alert("需要 "+(getTicketCfg().ITEM_NAME||getTicketCfg().NAME)+" ×1"); return; }
          var def = (mode==="hell") ? DEFH : DEFN;
          var got = CORE.sweep(def, U, (mode==="normal"?"normal":mode), level) || {};
          TM.spend(TKEY,1);
          window.saveGame?.();
          var parts = Object.keys(got).map(function(k){ return k + "×" + got[k].toLocaleString(); });
          window.logPrepend?.("⏩ 掃蕩成功（核心-" + mode + " Lv." + level + "）：獲得 " + (parts.join("、") || "—"));
          alert("掃蕩獲得：\n" + (parts.join("\n") || "—"));
          rerender();
        };
      }
    });
  }
})();