// dungeon/life_dungeon_tab.js — 生命副本（普通 1v1×3 / 困難 1v3×4；傳 def/utils 進引擎）
(function () {
  "use strict";

  function ready() {
    return !!(window.DungeonHub && window.TicketManager && window.ACC_Core && window.LIFE_DungeonDef && window.LC_ConfigUtils);
  }
  (function wait(i){ i=i||0; if(ready()){ try{init();}catch(e){console.error(e);} return; }
    if (i>400){ console.error("[life_tab] deps timeout"); return; }
    setTimeout(function(){ wait(i+1); },50);
  })();

  function init(){
    var TM   = window.TicketManager;
    var CORE = window.ACC_Core;
    var U    = window.LC_ConfigUtils;
    var DEF  = window.LIFE_DungeonDef;
    var GATE = window.DungeonGate || null;
    var TKEY = "ChallengeTicket";

    var PROG_KEY = "life_trial_progress_v1";
    function loadProg(){ try{ return JSON.parse(localStorage.getItem(PROG_KEY)) || { normal:{maxCleared:0}, hard:{maxCleared:0} }; }catch(_){ return { normal:{maxCleared:0}, hard:{maxCleared:0} }; } }
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
      var isHard = (mode === "hard");
      var maxCleared = isHard ? maxH : maxN;
      var nextLv = Math.min((maxCleared + 1), window.LC_LevelConfig.MAX_LEVEL);

      var baseRewards = isHard ? DEF.rewardsHard : DEF.rewardsNormal;
      var scaled = U.scaledRewardsForLevel(baseRewards, nextLv);
      var rewardLines = Object.keys(scaled || {}).map(function (k) { return "・" + k + "：" + U.formatRange(scaled[k]); });
      if (!rewardLines.length) rewardLines.push("・—");

      return [
        '<div style="border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px">',
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">',
            '<div style="font-weight:800">💚 生命副本</div>',
            '<div style="display:flex;gap:8px">',
              '<button class="btn-life-mode" data-mode="normal" style="padding:4px 8px;border:0;border-radius:8px;', (isHard?'background:#1f2937;color:#fff;':'background:#2563eb;color:#fff;') ,'">普通</button>',
              '<button class="btn-life-mode" data-mode="hard"   style="padding:4px 8px;border:0;border-radius:8px;', (isHard?'background:#2563eb;color:#fff;':'background:#1f2937;color:#fff;') ,'">困難</button>',
            '</div>',
          '</div>',
          '<div style="opacity:.9;font-size:12px;margin:6px 0 8px">', (isHard ? '困難模式（1v3 / 4 波）' : '普通模式（1v1 / 3 波）') ,'</div>',
          '<div style="font-size:12px;opacity:.95;line-height:1.8">',
            '目前最高通關：', maxCleared, ' / ', window.LC_LevelConfig.MAX_LEVEL, '　｜　下一關：Lv.', nextLv, '（限時 ', (DEF.timeLimitSec || 0), ' 秒）',
          '</div>',
          '<div style="font-size:12px;opacity:.95;line-height:1.8;margin-top:6px">',
            '<div>挑戰獎勵（按 Lv 放大）</div>',
            rewardLines.join('<br>'),
          '</div>',
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">',
            '<button class="btn-life-start" data-level="', nextLv, '" style="padding:8px 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer">挑戰下一關（消耗：', (getTicketCfg().ITEM_NAME || getTicketCfg().NAME), ' ×1）</button>',
            (maxCleared > 0 ? '<button class="btn-life-retry" data-level="' + maxCleared + '" style="padding:8px 12px;border:0;border-radius:8px;background:#4b5563;color:#fff;cursor:pointer">挑戰上次通關（Lv.' + maxCleared + '）</button>' : ''),
            (maxCleared > 0 ? '<button class="btn-life-sweep" data-level="' + maxCleared + '" style="padding:8px 12px;border:0;border-radius:8px;background:#1f2937;color:#fff;cursor:pointer">掃蕩（Lv.' + maxCleared + ' / ×0.75）</button>' : ''),
          '</div>',
        '</div>'
      ].join('');
    }

    DungeonHub.registerTab({
      id: "life_trial_tab",
      title: "生命副本",
      render: function(container){
        container.innerHTML = headerHTML() + panelHTML();

        function rerender(){ DungeonHub.requestRerender(); }
        function ensureStopped(){
          if (GATE && typeof GATE.ensureStopped==="function") return !!GATE.ensureStopped();
          if (window.autoEnabled){ alert("請先停止外部戰鬥再進入副本"); return false; }
          return true;
        }

        container.querySelectorAll(".btn-life-mode").forEach(function(b){
          b.onclick = function(){ mode = (this.getAttribute("data-mode")==="hard") ? "hard" : "normal"; rerender(); };
        });

        function commonEntry(level, isRepeat){
          if (!ensureStopped()) return;
          if (!TM || !TM.canSpend(TKEY,1)){ alert("需要 "+(getTicketCfg().ITEM_NAME||getTicketCfg().NAME)+" ×1"); return; }

          if (!isRepeat){
            var p = loadProg();
            var max = (mode==="hard") ? Number(p.hard?.maxCleared||0) : Number(p.normal?.maxCleared||0);
            if (level !== max + 1){ alert("需先通關 Lv."+ (max||0) +" 才能挑戰 Lv."+level); return; }
          }

          DungeonHub.close();
          var after=function(state){
            if (state==="win"){
              TM.spend(TKEY,1);
              if (!isRepeat){
                var prog=loadProg();
                if (mode==="normal"){
                  prog.normal = prog.normal || { maxCleared:0 };
                  if (level > prog.normal.maxCleared) prog.normal.maxCleared = level;
                } else {
                  prog.hard = prog.hard || { maxCleared:0 };
                  if (level > prog.hard.maxCleared) prog.hard.maxCleared = level;
                }
                saveProg(prog);
              }
              window.saveGame?.();
            }
          };

          if (mode==="normal") CORE.startNormal(DEF, U, level, after);
          else CORE.startHard(DEF, U, level, after);
        }

        var startBtn = container.querySelector(".btn-life-start");
        if (startBtn) startBtn.onclick = function(){ commonEntry(Number(this.getAttribute("data-level")||1), false); };

        var retryBtn = container.querySelector(".btn-life-retry");
        if (retryBtn) retryBtn.onclick = function(){ commonEntry(Number(this.getAttribute("data-level")||1), true); };

        var sweepBtn = container.querySelector(".btn-life-sweep");
        if (sweepBtn) sweepBtn.onclick = function(){
          var level = Number(this.getAttribute("data-level")||1);
          if (!TM || !TM.canSpend(TKEY,1)){ alert("需要 "+(getTicketCfg().ITEM_NAME||getTicketCfg().NAME)+" ×1"); return; }
          var got = CORE.sweep(DEF, U, (mode==="normal"?"normal":"hard"), level) || {};
          TM.spend(TKEY,1);
          window.saveGame?.();
          var parts = Object.keys(got).map(function(k){ return k+"×"+got[k].toLocaleString(); });
          window.logPrepend?.("⏩ 掃蕩成功（生命 "+(mode==="hard"?"困難":"普通")+" Lv."+level+"）：獲得 "+ (parts.join("、")||"—"));
          alert("掃蕩獲得：\n" + (parts.join("\n") || "—"));
          rerender();
        };
      }
    });
  }
})();