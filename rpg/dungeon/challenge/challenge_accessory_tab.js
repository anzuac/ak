// dungeon/challenge_accessory_tabs_multi.js
// 飾品類副本（合併版）：同一分頁同時顯示「飾品強化試煉」與「飾品突破關卡」
// - 頂部票券條（免費/背包/總計）
// - 每副本獨立進度與存檔 key
// - 普通/困難切換、挑戰下一關、挑戰上次通關、掃蕩 ×0.75
(function () {
  "use strict";

  // === 等待依賴就緒 ===
  function ready() {
    return !!(
      window.DungeonHub &&
      window.TicketManager &&
      window.ACC_DungeonDef &&            // 強化
      window.ACC_DungeonDef_Break &&      // 突破
      window.ACC_ConfigUtils &&
      window.ACC_Core
    );
  }
  function waitAndInit(t){ t=t||0; if(ready()) { try{ init(); }catch(e){console.error(e);} return; }
    if(t>400){ console.error("[acc_tabs_multi] timeout waiting deps"); return; }
    setTimeout(function(){ waitAndInit(t+1); }, 50);
  }
  waitAndInit();

  function init(){
    var TM   = window.TicketManager;
    var GATE = window.DungeonGate || null;
    var U    = window.ACC_ConfigUtils;
    var CORE = window.ACC_Core;

    // 兩個副本定義
    var DEF_STR = window.ACC_DungeonDef;         // 💍 飾品強化試煉
    var DEF_BRK = window.ACC_DungeonDef_Break;   // 💍 飾品突破關卡

    var TKEY = "ChallengeTicket"; // 共用挑戰券（雙軌）

    // —— 票券工具（雙軌）——
    function getTicketCfg(){
      if (TM && TM.getConfig(TKEY)) return TM.getConfig(TKEY);
      return { NAME:"挑戰券（免費）", ITEM_NAME:"挑戰券", PERIOD_MS:30*60*1000, DEFAULT_CAP:10, EXPAND_COST_GEM:100, EXPAND_DELTA:5, GIFT_ON_EXPAND:1 };
    }
    function refill(){ TM && TM.refill(TKEY); }
    function getTicket(){ return TM ? TM.get(TKEY) : { free:{count:0,cap:0,lastTs:Date.now()}, bag:{count:0}, total:0 }; }
    function timeToNext(){ return TM ? TM.timeToNext(TKEY) : 0; }
    function fmtClock(ms){ var s=Math.floor(ms/1000), m=Math.floor(s/60), ss=s%60; return m+":"+String(ss).padStart(2,"0"); }

    function headerHTML(){
      refill();
      var cfg=getTicketCfg(), t=getTicket(), left=timeToNext();
      var leftTxt=(t.free.count>=t.free.cap)?"已滿":("+"+fmtClock(left));
      var itemLabel = cfg.ITEM_NAME || cfg.NAME;
      return [
        '<div style="border:1px solid #243247;background:#0b1220;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">',
          '<div style="font-size:12px;line-height:1.6">',
            '<div><b>',cfg.NAME,'</b>（免費）：<b>',t.free.count,'</b> / ',t.free.cap,
            '<span style="font-size:12px;opacity:.8;margin-left:6px;">（每 30 分復原 1）</span>',
            '<span style="margin-left:8px;opacity:.9;">下次回復：',leftTxt,'</span></div>',
            '<div>背包：<b>',t.bag.count,'</b>　總計：<b>',t.total,'</b></div>',
          '</div>',
          '<div style="font-size:12px;opacity:.85">消耗：',itemLabel,' ×1</div>',
        '</div>'
      ].join('');
    }

    // —— 各副本進度存檔 KEY ——（各自獨立）
    var PROG_KEY_STR = "acc_ch_progress_v1";     // 強化
    var PROG_KEY_BRK = "acc_break_progress_v1";  // 突破

    function loadProg(key){
      try { return JSON.parse(localStorage.getItem(key)) || { normal:{maxCleared:0}, hard:{unlocked:false, maxCleared:0} }; }
      catch(_){ return { normal:{maxCleared:0}, hard:{unlocked:false, maxCleared:0} }; }
    }
    function saveProg(key, p){ try{ localStorage.setItem(key, JSON.stringify(p||{})); }catch(_){} }

    // —— 通用：暫時切 DEF 給 CORE 用（突破要用）——
    function withDef(def, fn){
      var old = window.ACC_DungeonDef;
      window.ACC_DungeonDef = def;
      try { return fn(); }
      finally { window.ACC_DungeonDef = old; }
    }

    // —— 產生一張卡（強化 / 突破共用）——
    // opts: { idPrefix, def, progKey, modeRef }
    function cardHTML(opts){
      var idp = opts.idPrefix;      // "acc" 或 "accb"
      var def = opts.def;           // DEF_STR or DEF_BRK
      var progKey = opts.progKey;   // PROG_KEY_STR / PROG_KEY_BRK
      var mode = opts.modeRef.val;  // "normal" | "hard"

      var p = loadProg(progKey);
      var maxN = Number(p.normal?.maxCleared || 0);
      var hardUnlocked = !!p.hard?.unlocked || (maxN >= 30);
      if (!p.hard) p.hard = { unlocked: hardUnlocked, maxCleared: Number(p.hard?.maxCleared||0) };
      if (!p.hard.unlocked && hardUnlocked){ p.hard.unlocked = true; saveProg(progKey, p); }

      var maxH = Number(p.hard?.maxCleared || 0);
      var isHard = (mode === "hard");
      var maxCleared = isHard ? maxH : maxN;
      var nextLv = Math.min((maxCleared + 1), window.ACC_LevelConfig.MAX_LEVEL);

      var baseRewards = isHard ? def.rewardsHard : def.rewardsNormal;
      var scaled = U.scaledRewardsForLevel(baseRewards, nextLv);
      var rewardLines = Object.keys(scaled||{}).map(function(k){ return "・"+k+"："+U.formatRange(scaled[k]); });
      if (!rewardLines.length) rewardLines.push("・—");

      var modeTip = isHard ? "困難模式（1打多）" : "普通模式（單體波）";
      var hardNote = hardUnlocked ? "" : '<div style="color:#fca5a5;font-size:12px;margin-top:6px">通關普通模式 Lv.30 後解鎖困難模式</div>';

      var cfg = getTicketCfg();
      var consumeLabel = cfg.ITEM_NAME || cfg.NAME;

      var repeatBtn = (maxCleared>0)
        ? '<button class="btn-'+idp+'-retry" data-level="'+maxCleared+'" style="padding:8px 12px;border:0;border-radius:8px;background:#4b5563;color:#fff;cursor:pointer">挑戰上次通關（Lv.'+maxCleared+'）</button>'
        : '';

      var sweepBtn = (maxCleared>0)
        ? '<button class="btn-'+idp+'-sweep" data-level="'+maxCleared+'" style="padding:8px 12px;border:0;border-radius:8px;background:#1f2937;color:#fff;cursor:pointer">掃蕩（以 Lv.'+maxCleared+' 計 / ×0.75）</button>'
        : '';

      return [
        '<div class="acc-card" data-id="'+idp+'" style="border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px">',
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">',
            '<div style="font-weight:800">', def.name ,'</div>',
            '<div style="display:flex;gap:8px">',
              '<button class="btn-'+idp+'-mode" data-mode="normal" style="padding:4px 8px;border:0;border-radius:8px;', (isHard?'background:#1f2937;color:#fff;':'background:#2563eb;color:#fff;') ,'">普通</button>',
              '<button class="btn-'+idp+'-mode" data-mode="hard" style="padding:4px 8px;border:0;border-radius:8px;', (isHard?'background:#2563eb;color:#fff;':'background:#1f2937;color:#fff;') ,'">困難</button>',
            '</div>',
          '</div>',
          '<div style="opacity:.9;font-size:12px;margin:6px 0 8px">', modeTip ,'</div>',
          hardNote,
          '<div style="font-size:12px;opacity:.95;line-height:1.8">',
            '目前最高通關：', (isHard?maxH:maxN), ' 關 / ', window.ACC_LevelConfig.MAX_LEVEL, ' 關<br>',
            '下一關：Lv.', nextLv, '（限時 ', (def.timeLimitSec||0), ' 秒）',
          '</div>',
          '<div style="font-size:12px;opacity:.95;line-height:1.8;margin-top:6px">',
            '<div>挑戰獎勵（按 Lv 放大）</div>',
            rewardLines.join('<br>'),
          '</div>',
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">',
            '<button class="btn-'+idp+'-challenge" data-level="'+nextLv+'" style="padding:8px 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer">挑戰下一關（消耗：'+consumeLabel+' ×1）</button>',
            repeatBtn,
            sweepBtn,
          '</div>',
        '</div>'
      ].join('');
    }

    // —— 掛分頁 ——（同頁顯示兩張卡）
    var modeSTR = { val:"normal" }; // 強化
    var modeBRK = { val:"normal" }; // 突破

    DungeonHub.registerTab({
      id: "acc_all",
      title: "飾品試煉",
      render: function(container){
        container.innerHTML =
          headerHTML() +
          '<div style="display:grid;gap:10px">' +
            cardHTML({ idPrefix:"acc",  def:DEF_STR, progKey:PROG_KEY_STR, modeRef:modeSTR }) +
            cardHTML({ idPrefix:"accb", def:DEF_BRK, progKey:PROG_KEY_BRK, modeRef:modeBRK }) +
          '</div>';

        function rerender(){ DungeonHub.requestRerender(); }
        function ensureStopped(){
          if (GATE && typeof GATE.ensureStopped==="function") return !!GATE.ensureStopped();
          if (window.autoEnabled){ alert("請先停止外部戰鬥再進入副本"); return false; }
          return true;
        }

        // 綁定一張卡的邏輯（避免重複寫）
        function bindCard(prefix, def, progKey, modeRef){
          // 切模式
          container.querySelectorAll('.btn-'+prefix+'-mode').forEach(function(btn){
            btn.onclick = function(){
              var m = this.getAttribute('data-mode');
              if (m === "hard"){
                var p = loadProg(progKey);
                var unlocked = (p.hard && p.hard.unlocked) || (p.normal && p.normal.maxCleared >= 30);
                if (!unlocked){ alert("需通關普通模式 Lv.30 才能切換困難模式"); return; }
              }
              modeRef.val = (m==="hard") ? "hard" : "normal";
              rerender();
            };
          });

          // 共同流程
          function commonEntry(level, isRepeat){
            if (!ensureStopped()) return;
            if (!TM || !TM.canSpend(TKEY,1)){
              var need = getTicketCfg().ITEM_NAME || getTicketCfg().NAME;
              alert("需要 " + need + " ×1");
              return;
            }
            if (!isRepeat){
              var p = loadProg(progKey);
              var maxCleared = (modeRef.val==="hard") ? Number(p.hard?.maxCleared||0) : Number(p.normal?.maxCleared||0);
              if (level !== maxCleared + 1){
                alert("需先通關 Lv."+ (maxCleared||0) +" 才能挑戰 Lv."+level);
                return;
              }
            }

            DungeonHub.close();
            // 強化直接跑；突破要暫換 DEF
            var runner = function(after){
              if (modeRef.val==="normal") CORE.startNormal(level, after);
              else CORE.startHard(level, after);
            };
            var runWith = (def===DEF_BRK) ? function(fn){ return withDef(DEF_BRK, fn); } : function(fn){ return withDef(DEF_STR, fn); };

            runWith(function(){
              runner(function(state){
                if (state==="win"){
                  TM.spend(TKEY,1);
                  if (!isRepeat){
                    var prog = loadProg(progKey);
                    if (modeRef.val==="normal"){
                      prog.normal = prog.normal || { maxCleared:0 };
                      if (level > prog.normal.maxCleared) prog.normal.maxCleared = level;
                      if (prog.normal.maxCleared >= 30){
                        prog.hard = prog.hard || {}; prog.hard.unlocked = true;
                      }
                    } else {
                      prog.hard = prog.hard || { unlocked:true, maxCleared:0 };
                      if (level > prog.hard.maxCleared) prog.hard.maxCleared = level;
                    }
                    saveProg(progKey, prog);
                  }
                  window.saveGame?.();
                }
              });
            });
          }

          // 挑戰下一關
          var startBtn = container.querySelector('.btn-'+prefix+'-challenge');
          if (startBtn) startBtn.onclick = function(){
            var level = Number(this.getAttribute('data-level')||1);
            commonEntry(level, false);
          };

          // 挑戰上次通關
          var retryBtn = container.querySelector('.btn-'+prefix+'-retry');
          if (retryBtn) retryBtn.onclick = function(){
            var level = Number(this.getAttribute('data-level')||1);
            commonEntry(level, true);
          };

          // 掃蕩（最高通關 ×0.75）
          var sweepBtn = container.querySelector('.btn-'+prefix+'-sweep');
          if (sweepBtn) sweepBtn.onclick = function(){
            var level = Number(this.getAttribute('data-level')||1);
            if (!TM || !TM.canSpend(TKEY,1)){
              var need = getTicketCfg().ITEM_NAME || getTicketCfg().NAME;
              alert("需要 " + need + " ×1");
              return;
            }

            var gotActual = withDef(def, function(){ return CORE.sweep(modeRef.val, level); }) || {};
            var got = {};
            Object.keys(gotActual).forEach(function(k){ got[k] = Math.max(0, Math.floor(gotActual[k] * 0.75)); });
            Object.keys(got).forEach(function(k){ var n=got[k]; if (n>0) window.addItem?.(k, n); });

            TM.spend(TKEY,1);
            window.saveGame?.();

            var parts = Object.keys(got||{}).map(function(k){ return k+"×"+got[k].toLocaleString(); });
            window.logPrepend?.("⏩ 掃蕩成功（"+def.name+" "+(modeRef.val==="hard"?"困難":"普通")+" Lv."+level+"）：獲得 "+ (parts.join("、")||"—"));
            alert("掃蕩獲得：\n" + (parts.join("\n") || "—"));

            rerender();
          };
        }

        // 綁兩張卡
        bindCard("acc",  DEF_STR, PROG_KEY_STR, modeSTR);
        bindCard("accb", DEF_BRK, PROG_KEY_BRK, modeBRK);
      }
    });
  }
})();