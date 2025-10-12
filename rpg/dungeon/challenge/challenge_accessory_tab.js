// dungeon/challenge_accessory_tab.js — 飾品強化試煉 分頁（票券、挑戰、掃蕩、進度）
(function () {
  if (!window.DungeonHub) return;

  var TM   = window.TicketManager || null;
  var GATE = window.DungeonGate || null;

  var DEF = window.ACC_DungeonDef;
  var U   = window.ACC_ConfigUtils;
  var CORE= window.ACC_Core;

  var TKEY = "ChallengeTicket"; // 共用挑戰券

  // 進度儲存：normal/hard 分開
  var PROG_KEY = "acc_ch_progress_v1";
  function loadProg(){
    try { return JSON.parse(localStorage.getItem(PROG_KEY)) || { normal:{maxCleared:0}, hard:{unlocked:false, maxCleared:0} }; }
    catch(_){ return { normal:{maxCleared:0}, hard:{unlocked:false, maxCleared:0} }; }
  }
  function saveProg(p){ try { localStorage.setItem(PROG_KEY, JSON.stringify(p)); } catch(_){} }

  // 模式狀態（UI 切換）
  var mode = "normal"; // "normal" | "hard"

  function getTicket(){
    if (!TM) return { count:0, cap:0, lastTs:Date.now() };
    TM.refill(TKEY);
    return TM.get(TKEY);
  }
  function fmtClock(ms){ var s=Math.floor(ms/1000), m=Math.floor(s/60), ss=s%60; return m+":"+String(ss).padStart(2,"0"); }

  // ===== UI =====
  function headerHTML(){
    var t = getTicket();
    var name = (TM && TM.getConfig(TKEY)) ? TM.getConfig(TKEY).NAME : "挑戰券";
    var left = TM ? TM.timeToNext(TKEY) : 0;
    var leftTxt = (t.count>=t.cap) ? "已滿" : ("+"+fmtClock(left));
    return [
      '<div style="border:1px solid #243247;background:#0b1220;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">',
        '<div style="font-size:14px">',
          '<b>'+name+'</b>：<span style="font-weight:800">'+t.count+'</span> / '+t.cap,
          '<span style="font-size:12px;opacity:.8;margin-left:6px;">（每 30 分復原 1）</span>',
        '</div>',
        '<div style="font-size:12px;opacity:.9">下次回復：'+leftTxt+'</div>',
      '</div>'
    ].join('');
  }

  function panelHTML(){
    var p = loadProg();
    var maxN = Number(p.normal?.maxCleared || 0);
    var hardUnlocked = !!p.hard?.unlocked || (maxN >= 30);
    if (!p.hard) p.hard = { unlocked: hardUnlocked, maxCleared: Number(p.hard?.maxCleared||0) };
    if (!p.hard.unlocked && hardUnlocked){ p.hard.unlocked = true; saveProg(p); }

    var maxH = Number(p.hard?.maxCleared || 0);

    var isHard = (mode === "hard");
    var maxCleared = isHard ? maxH : maxN;
    var nextLv = Math.min((maxCleared + 1), window.ACC_LevelConfig.MAX_LEVEL);

    var baseRewards = isHard ? DEF.rewardsHard : DEF.rewardsNormal;
    var scaled = U.scaledRewardsForLevel(baseRewards, nextLv);
    var rewardLines = Object.keys(scaled||{}).map(function(k){
      return "・"+k+"："+U.formatRange(scaled[k]);
    });
    if (!rewardLines.length) rewardLines.push("・—");

    var modeTip = isHard ? "困難模式（1打多）" : "普通模式（單體波）";
    var hardNote = hardUnlocked ? "" : '<div style="color:#fca5a5;font-size:12px;margin-top:6px">通關普通模式 Lv.30 後解鎖困難模式</div>';

    // 額外：若有通關紀錄，顯示「挑戰上次通關（Lv.X）」以及「掃蕩（X）」兩顆鈕
    var repeatBtn = (maxCleared>0)
      ? '<button class="btn-acc-retry" data-level="'+maxCleared+'" style="padding:8px 12px;border:0;border-radius:8px;background:#4b5563;color:#fff;cursor:pointer">挑戰上次通關（Lv.'+maxCleared+'）</button>'
      : '';

    var sweepBtn = (maxCleared>0)
      ? '<button class="btn-acc-sweep" data-level="'+maxCleared+'" style="padding:8px 12px;border:0;border-radius:8px;background:#1f2937;color:#fff;cursor:pointer">掃蕩（以 Lv.'+maxCleared+' 計 / ×0.75）</button>'
      : '';

    return [
      '<div style="border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px">',
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">',
          '<div style="font-weight:800">', DEF.name,'</div>',
          '<div style="display:flex;gap:8px">',
            '<button class="btn-acc-mode" data-mode="normal" style="padding:4px 8px;border:0;border-radius:8px;'+(isHard?'background:#1f2937;color:#fff;':'background:#2563eb;color:#fff;')+'">普通</button>',
            '<button class="btn-acc-mode" data-mode="hard" style="padding:4px 8px;border:0;border-radius:8px;'+(isHard?'background:#2563eb;color:#fff;':'background:#1f2937;color:#fff;')+'">困難</button>',
          '</div>',
        '</div>',

        '<div style="opacity:.9;font-size:12px;margin:6px 0 8px">'+modeTip+'</div>',
        hardNote,

        '<div style="font-size:12px;opacity:.95;line-height:1.8">',
          '目前最高通關：', (isHard?maxH:maxN), ' 關 / ', window.ACC_LevelConfig.MAX_LEVEL, ' 關<br>',
          '下一關：Lv.', nextLv, '（限時 ', (DEF.timeLimitSec||0), ' 秒）',
        '</div>',

        '<div style="font-size:12px;opacity:.95;line-height:1.8;margin-top:6px">',
          '<div>挑戰獎勵（按 Lv 放大）</div>',
          rewardLines.join('<br>'),
        '</div>',

        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">',
          '<button class="btn-acc-challenge" data-level="'+nextLv+'" style="padding:8px 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer">挑戰下一關（消耗：挑戰券 ×1）</button>',
          repeatBtn,
          sweepBtn,
        '</div>',
      '</div>'
    ].join('');
  }

  // ===== 註冊分頁 =====
  DungeonHub.registerTab({
    id: "acc_challenge",
    title: "飾品試煉",
    render: function(container){
      // UI
      container.innerHTML = headerHTML() + panelHTML();

      function rerender(){ DungeonHub.requestRerender(); }

      // 切模式
      var modeBtns = container.querySelectorAll('.btn-acc-mode');
      for (var i=0;i<modeBtns.length;i++){
        modeBtns[i].onclick = function(){
          var m = this.getAttribute('data-mode');
          // 困難模式鎖定檢查
          if (m === "hard"){
            var p = loadProg();
            var unlocked = (p.hard && p.hard.unlocked) || (p.normal && p.normal.maxCleared >= 30);
            if (!unlocked){ alert("需通關普通模式 Lv.30 才能切換困難模式"); return; }
          }
          mode = (m==="hard") ? "hard" : "normal";
          rerender();
        };
      }

      function commonEntry(level, isRepeat){
        // 停止自動戰鬥
        if (GATE && typeof GATE.ensureStopped==="function"){ if (!GATE.ensureStopped()) return; }
        else if (window.autoEnabled){ alert("請先停止外部戰鬥再進入副本"); return; }

        // 檢查票券
        if (!TM || !TM.canSpend(TKEY,1)){ alert("需要 挑戰券 ×1"); return; }

        // 僅「挑戰下一關」需要逐關檢查；重複挑戰已通關不檢查
        if (!isRepeat){
          var p = loadProg();
          var maxCleared = (mode==="hard") ? Number(p.hard?.maxCleared||0) : Number(p.normal?.maxCleared||0);
          if (level !== maxCleared + 1){ alert("需先通關 Lv."+ (maxCleared||0) +" 才能挑戰 Lv."+level); return; }
        }

        // 進戰鬥
        DungeonHub.close();
        var after = function(state){
          if (state==="win"){
            // 扣券
            TM.spend(TKEY,1);
            // 重複挑戰不提升進度；挑戰下一關才提升
            if (!isRepeat){
              var prog = loadProg();
              if (mode==="normal"){
                prog.normal = prog.normal || { maxCleared:0 };
                if (level > prog.normal.maxCleared) prog.normal.maxCleared = level;
                if (prog.normal.maxCleared >= 30){ prog.hard = prog.hard || {}; prog.hard.unlocked = true; }
              } else {
                prog.hard = prog.hard || { unlocked:true, maxCleared:0 };
                if (level > prog.hard.maxCleared) prog.hard.maxCleared = level;
              }
              saveProg(prog);
            }
            window.saveGame?.();
          }
        };

        if (mode==="normal") CORE.startNormal(level, after);
        else CORE.startHard(level, after);
      }

      // 挑戰下一關
      var startBtn = container.querySelector('.btn-acc-challenge');
      if (startBtn) startBtn.onclick = function(){
        var level = Number(this.getAttribute('data-level')||1);
        commonEntry(level, /*isRepeat*/false);
      };

      // 挑戰上次通關（重複挑戰）
      var retryBtn = container.querySelector('.btn-acc-retry');
      if (retryBtn) retryBtn.onclick = function(){
        var level = Number(this.getAttribute('data-level')||1);
        commonEntry(level, /*isRepeat*/true);
      };

      // 掃蕩（最高通關關卡）
      var sweepBtn = container.querySelector('.btn-acc-sweep');
      if (sweepBtn) sweepBtn.onclick = function(){
        var level = Number(this.getAttribute('data-level')||1);

        if (!TM || !TM.canSpend(TKEY,1)){ alert("需要 挑戰券 ×1"); return; }

        // 直接掃蕩入庫
        var got = CORE.sweep(mode, level);
        TM.spend(TKEY,1);
        window.saveGame?.();

        // 提示
        var parts = Object.keys(got||{}).map(function(k){ return k+"×"+got[k].toLocaleString(); });
        window.logPrepend?.("⏩ 掃蕩成功（"+ (mode==="hard"?"困難":"普通") +" Lv."+level+"）：獲得 "+ (parts.join("、")||"—"));
        alert("掃蕩獲得：\n" + (parts.join("\n") || "—"));

        rerender();
      };
    }
  });
})();