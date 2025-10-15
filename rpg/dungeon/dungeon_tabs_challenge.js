// dungeon_tabs_challenge.js — 挑戰分頁（票券雙軌 + 進度 + 挑戰/重試/掃蕩；勝利顯示實拿）
(function () {
  if (!window.DungeonHub) return;

  var TM   = window.TicketManager;    // 需先載入 dungeon/common/tickets.js
  var TKEY = "ResourceTicket";

  if (!TM || typeof TM.getConfig !== 'function') {
    console.error("[dungeon_tabs_challenge] TicketManager 未就緒（請確認載入順序）");
    return;
  }
  var CFG  = TM.getConfig(TKEY);
  if (!CFG) { console.error("[dungeon_tabs_challenge] 取不到票券設定：" + TKEY); return; }

  var LV   = window.LevelConfig;
  var DUNS = window.WaveDungeonDefs || [];
  var U    = window.WaveDungeonUtils;

  // 票券雙軌
  function refillTicket(){ TM.refill(TKEY); }
  function getTicket(){ return TM.get(TKEY); } // { free:{count,cap,lastTs}, bag:{count}, total }
  function timeToNext(){ return TM.timeToNext(TKEY); }
  function fmtClock(ms){ var s=Math.floor(ms/1000), m=Math.floor(s/60), ss=s%60; return m+":"+String(ss).padStart(2,"0"); }

  function tryExpandCap(){
    var need = CFG.EXPAND_COST_GEM;
    var have = Number(window.player?.gem || 0);
    if (have < need) { alert(`需要 ${need} 鑽石`); return; }
    var label = (CFG.ITEM_NAME || CFG.NAME);
    if (!confirm(`花費 ${need} 鑽石將上限 +${CFG.EXPAND_DELTA}，並贈送 ${CFG.GIFT_ON_EXPAND} 張「${label}」\n是否確認？`)) return;
    player.gem = Math.max(0, have - need);
    TM.expand(TKEY, 1);
    window.updateResourceUI?.();
    var nowT = TM.get(TKEY);
    window.logPrepend?.(`🧾 已擴充${CFG.NAME}上限至 ${nowT.free.cap}，並獲得 ${CFG.GIFT_ON_EXPAND} 張`);
    DungeonHub.requestRerender();
  }

  // ========= 進度存檔（每個副本各自記錄最高通關 Lv）=========
  var PROG_KEY = "challenge_progress_v1";
  function loadProg(){
    try { return JSON.parse(localStorage.getItem(PROG_KEY)) || {}; }
    catch(_) { return {}; }
  }
  function saveProg(p){ try { localStorage.setItem(PROG_KEY, JSON.stringify(p||{})); } catch(_){} }
  function getMaxCleared(dId){
    var p = loadProg(); return Math.max(0, Number(p[dId]?.maxCleared || 0));
  }
  function setMaxCleared(dId, lv){
    var p = loadProg(); p[dId] = p[dId] || { maxCleared:0 };
    if (lv > (p[dId].maxCleared||0)) { p[dId].maxCleared = lv; saveProg(p); }
  }

  // 勝利面板顯示「本次實拿」
  function renderGotRewards(got){
    var rw = document.getElementById("dun-rewards");
    if (!rw) return;
    var lines = [];
    Object.keys(got || {}).forEach(function(k){
      var n = Number(got[k] || 0);
      if (n > 0) lines.push(`<li>${k} × ${n.toLocaleString()}</li>`);
    });
    if (lines.length){
      rw.style.display = "block";
      rw.innerHTML = `獎勵：<ul>${lines.join("")}</ul>`;
    }
  }

  // =====（可選更穩版）掃蕩：直接抽 75%，分流入庫，避免「先加後扣」不同步 =====
  function sweepGrant(dDef, level){
    var scaledView = U.scaledFinalRewardsForLevel(dDef.finalRewards, level);
    var got = {};
    Object.keys(scaledView || {}).forEach(function(k){
      var r = scaledView[k]; if (!r) return;
      var a = r[0], b = r[1];
      var roll = Math.floor(Math.random() * (b - a + 1)) + a;
      var qty  = Math.max(0, Math.floor(roll * 0.75));
      if (qty <= 0) return;
      got[k] = qty;

      // 入庫（資源 / 背包）
      if (k === "金幣" || k === "gold") {
        window.player.gold = (window.player.gold || 0) + qty;
      } else if (k === "強化石" || k === "stone") {
        window.player.stone = (window.player.stone || 0) + qty;
      } else {
        window.addItem?.(k, qty);
      }
    });
    window.updateResourceUI?.();
    return got;
  }

  // 跑波次（與原版相同，但勝利時升進度）
  function runGauntlet(dunDef, level, onAllFinish){
    var waves = U.buildWavesForLevel(dunDef.wavesTemplate, level);
    var total = waves.length;
    var idx = 0;

    var scaledView = U.scaledFinalRewardsForLevel(dunDef.finalRewards, level);

    // ✅ 改成泛用：把所有鍵都列出來（含中文鍵）
    var dispRewards = [];
    Object.keys(scaledView || {}).forEach(function(k){
      var r = scaledView[k];
      if (!r) return;
      var unit = /碎片|石|券|票|符|令/.test(k) ? "個" : "";
      dispRewards.push({ type:"text", key: k + " " + U.formatRange(r, unit), qty: "" });
    });

    var rewarded = false;
    var hooks = {
      onRender: function(){
        var el = document.getElementById("dun-result");
        if (el) el.textContent = `波次：${idx+1} / ${total}`;
      },
      onSwitchMonster: function(){
        var hd = document.querySelector("#dun-card .dun-hd > div:first-child");
        if (hd) hd.textContent = `${dunDef.name} — ${waves[idx].label}（Lv.${level}）`;
      },
      afterPlayerAct: function({ctx}){
        if (window.monsterHP <= 0 && idx < total - 1) {
          idx++;
          var next = waves[idx];
          ctx.api.setMonster(next.monster);
          ctx.api.log(`➡️ 進入第 ${idx+1}/${total} 波（${next.label}）`);
        }
      },
      afterMonsterAct: function({ctx}){
        if (window.monsterHP <= 0 && idx < total - 1) {
          idx++;
          var next = waves[idx];
          ctx.api.setMonster(next.monster);
          ctx.api.log(`➡️ 進入第 ${idx+1}/${total} 波（${next.label}）`);
        }
      },
      onResult: function({ ctx, state }){
        if (state === "win" && !rewarded){
          rewarded = true;
          var got = U.grantFinalRewards(scaledView, `${dunDef.name}（Lv.${level}）`);
          renderGotRewards(got);
          setMaxCleared(dunDef.id, level);
        }
      }
    };

    var finishUI = {
      isFinal: true,
      claimLabel: "領取獎勵",
      onClaim: function(){
        if (rewarded) return;
        rewarded = true;
        var got = U.grantFinalRewards(scaledView, `${dunDef.name}（Lv.${level}）`);
        renderGotRewards(got);
        setMaxCleared(dunDef.id, level);
      }
    };

    var first = waves[0];
    window.DungeonBattle?.start({
      title: `${dunDef.name} — ${first.label}（Lv.${level}）`,
      monster: first.monster,
      timeLimitSec: dunDef.timeLimitSec || 0,
      rewards: dispRewards,
      hooks: hooks,
      finishUI: finishUI,
      onFinish: function(res){
        if (typeof onAllFinish === "function") onAllFinish(res.state);
      }
    });
  }

  // ===== UI =====
  function headerHTML(){
    refillTicket();
    var t = getTicket();
    var left = timeToNext();
    var leftTxt = (t.free.count >= t.free.cap) ? "已滿" : ("+"+fmtClock(left));
    var label = (CFG.ITEM_NAME || CFG.NAME);

    return `
      <div style="border:1px solid #243247;background:#0b1220;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div style="font-size:12px;line-height:1.6">
          <div>
            <b>${CFG.NAME}</b>（免費）：<span style="font-weight:800">${t.free.count}</span> / ${t.free.cap}
            <span style="font-size:12px;opacity:.8;margin-left:6px;">（每 30 分復原 1）</span>
            <span style="margin-left:8px;opacity:.9;">下次回復：${leftTxt}</span>
          </div>
          <div>背包：<b>${t.bag.count}</b>　總計：<b>${t.total}</b></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button id="btnExpandTicket" style="padding:6px 10px;border:0;border-radius:8px;background:#6b21a8;color:#fff;cursor:pointer">
            擴充上限（-${CFG.EXPAND_COST_GEM}💎 / +${CFG.EXPAND_DELTA}）+ 贈${CFG.GIFT_ON_EXPAND}張${label}
          </button>
        </div>
      </div>
    `;
  }

  function cardHTML(d){
    var maxCleared = getMaxCleared(d.id);
    var nextLv = Math.min((maxCleared + 1), LV.MAX_LEVEL);

    var scaled = U.scaledFinalRewardsForLevel(d.finalRewards, nextLv);

    // ✅ 改成泛用列法（含中文鍵）
    var rewardLines = [];
    Object.keys(scaled || {}).forEach(function(k){
      var r = scaled[k];
      if (!r) return;
      var unit = /碎片|石|券|票|符|令/.test(k) ? "個" : "";
      rewardLines.push(`・${k}：${U.formatRange(r, unit)}`);
    });
    if (rewardLines.length === 0) rewardLines.push("・—");

    var waves = U.buildWavesForLevel(d.wavesTemplate, nextLv);
    var boss  = waves[waves.length-1].monster;
    var atk   = (boss.atk||1).toLocaleString();
    var def   = (boss.def||0).toLocaleString();
    var hp    = (boss.hp||1).toLocaleString();

    var consumeLabel = (CFG.ITEM_NAME || CFG.NAME);

    var retryBtn = (maxCleared>0)
      ? `<button class="btn-ch-retry" data-id="${d.id}" data-level="${maxCleared}" style="padding:8px 12px;border:0;border-radius:8px;background:#4b5563;color:#fff;cursor:pointer">挑戰上次通關（Lv.${maxCleared}）</button>`
      : '';

    var sweepBtn = (maxCleared>0)
      ? `<button class="btn-ch-sweep" data-id="${d.id}" data-level="${maxCleared}" style="padding:8px 12px;border:0;border-radius:8px;background:#1f2937;color:#fff;cursor:pointer">掃蕩（以 Lv.${maxCleared} 計 / ×0.75）</button>`
      : '';

    return `
      <div class="ch-card" data-id="${d.id}" style="border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="font-weight:800">${d.name}</div>
          <div class="ch-level" style="font-size:12px;">最高通關：<b>${maxCleared}</b> / ${LV.MAX_LEVEL}　下一關：<b>Lv.${nextLv}</b></div>
        </div>

        <div style="opacity:.9;font-size:12px;margin:6px 0 8px">${d.desc || ""}</div>

        <div style="font-size:12px;opacity:.95;line-height:1.8">
          <div>最終波敵人能力（以下一關預覽）：</div>
          <div>・攻擊力：${atk}</div>
          <div>・防禦力：${def}</div>
          <div>・生命值：${hp}</div>
        </div>

        <div style="font-size:12px;opacity:.95;line-height:1.8;margin-top:6px">
          <div>最終獎勵（以下一關預覽）</div>
          ${rewardLines.join("<br>")}
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button class="btn-ch-start" data-id="${d.id}" data-level="${nextLv}" style="padding:8px 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer">
            挑戰下一關（消耗：${consumeLabel} ×1）
          </button>
          ${retryBtn}
          ${sweepBtn}
        </div>
      </div>
    `;
  }

  // ===== 註冊分頁 =====
  DungeonHub.registerTab({
    id: "challenge",
    title: "挑戰",
    render: function(container){
      refillTicket();

      container.innerHTML = `
        ${headerHTML()}
        <div style="display:grid;gap:10px;margin-top:10px">
          ${DUNS.map(function(d){ return cardHTML(d); }).join("")}
        </div>
      `;

      var exBtn = container.querySelector('#btnExpandTicket');
      if (exBtn) exBtn.onclick = tryExpandCap;

      function rerender(){ DungeonHub.requestRerender(); }

      // 開始（下一關）
      container.querySelectorAll('.btn-ch-start').forEach(function(btn){
        btn.onclick = function(){
          var id = this.getAttribute('data-id');
          var level = Number(this.getAttribute('data-level'));
          var d  = DUNS.find(function(x){ return x.id===id; });
          if (!d) return;

          refillTicket();
          if (!TM.canSpend(TKEY, 1)) {
            var needLabel = (CFG.ITEM_NAME || CFG.NAME);
            alert(`需要 ${needLabel} ×1`); return;
          }

          DungeonHub.close();
          runGauntlet(d, level, function(state){
            if (state === "win") {
              TM.spend(TKEY, 1);
              setMaxCleared(d.id, level);
              window.saveGame?.();
            }
          });
        };
      });

      // 重試（最高通關）
      container.querySelectorAll('.btn-ch-retry').forEach(function(btn){
        btn.onclick = function(){
          var id = this.getAttribute('data-id');
          var level = Number(this.getAttribute('data-level'));
          var d  = DUNS.find(function(x){ return x.id===id; });
          if (!d) return;

          if (!TM.canSpend(TKEY, 1)) {
            var needLabel = (CFG.ITEM_NAME || CFG.NAME);
            alert(`需要 ${needLabel} ×1`); return;
          }

          DungeonHub.close();
          runGauntlet(d, level, function(state){
            if (state === "win") {
              TM.spend(TKEY, 1);
              window.saveGame?.();
            }
          });
        };
      });

      // 掃蕩（最高通關 ×0.75）
      container.querySelectorAll('.btn-ch-sweep').forEach(function(btn){
        btn.onclick = function(){
          var id = this.getAttribute('data-id');
          var level = Number(this.getAttribute('data-level'));
          var d  = DUNS.find(function(x){ return x.id===id; });
          if (!d) return;

          if (!TM.canSpend(TKEY, 1)) {
            var needLabel = (CFG.ITEM_NAME || CFG.NAME);
            alert(`需要 ${needLabel} ×1`); return;
          }

          var got = sweepGrant(d, level);
          TM.spend(TKEY, 1);
          window.saveGame?.();

          var parts = Object.keys(got||{}).map(function(k){ return k+"×"+got[k].toLocaleString(); });
          window.logPrepend?.("⏩ 掃蕩成功（挑戰 "+d.name+" Lv."+level+"）：獲得 "+ (parts.join("、")||"—"));
          alert("掃蕩獲得：\n" + (parts.join("\n") || "—"));

          rerender();
        };
      });
    }
  });
})();