// dungeon_tabs_challenge_scoped.js — 挑戰分頁（每分頁自管票券：資源票）
(function () {
  if (!window.DungeonHub) return;

  var LV   = window.LevelConfig;
  var DUNS = window.WaveDungeonDefs || [];
  var U    = window.WaveDungeonUtils;

  // ===== 票券（本分頁自管：資源票）=====
  var ticket = window.createScopedTickets({
    NAME: "資源票（免費）",
    ITEM_NAME: "資源票",
    PERIOD_MS: 300 * 60 * 1000,
    DEFAULT_CAP: 20,
    EXPAND_COST_GEM: 100,
    EXPAND_DELTA: 5,
    GIFT_ON_EXPAND: 1
  }, "challenge");

  function fmtClock(ms){ var s=Math.floor(ms/1000), m=Math.floor(s/60), ss=s%60; return m+":"+String(ss).padStart(2,"0"); }

  function tryExpandCap(){
    var cfg = ticket.getConfig(), need = cfg.EXPAND_COST_GEM;
    var have = Number(window.player?.gem || 0);
    if (have < need) { alert(`需要 ${need} 鑽石`); return; }
    var label = (cfg.ITEM_NAME || cfg.NAME);
    if (!confirm(`花費 ${need} 鑽石將上限 +${cfg.EXPAND_DELTA}，並贈送 ${cfg.GIFT_ON_EXPAND} 張「${label}」\n是否確認？`)) return;
    player.gem = Math.max(0, have - need);
    ticket.expand(1);
    window.updateResourceUI?.();
    var nowT = ticket.get();
    window.logPrepend?.(`🧾 已擴充${cfg.NAME}上限至 ${nowT.free.cap}，並獲得 ${cfg.GIFT_ON_EXPAND} 張`);
    DungeonHub.requestRerender();
  }

  // ========= 進度存檔（各副本最高通關 Lv）=========
  var PROG_KEY = "challenge_progress_v1";
  function loadProg(){ try { return JSON.parse(localStorage.getItem(PROG_KEY)) || {}; } catch(_) { return {}; } }
  function saveProg(p){ try { localStorage.setItem(PROG_KEY, JSON.stringify(p||{})); } catch(_){} }
  function getMaxCleared(dId){ var p = loadProg(); return Math.max(0, Number(p[dId]?.maxCleared || 0)); }
  function setMaxCleared(dId, lv){
    var p = loadProg(); p[dId] = p[dId] || { maxCleared:0 };
    if (lv > (p[dId].maxCleared||0)) { p[dId].maxCleared = lv; saveProg(p); }
  }

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

  function runGauntlet(dunDef, level, onAllFinish){
    var waves = U.buildWavesForLevel(dunDef.wavesTemplate, level);
    var total = waves.length;
    var idx = 0;

    var scaledView = U.scaledFinalRewardsForLevel(dunDef.finalRewards, level);
    var dispRewards = [];
    Object.keys(scaledView || {}).forEach(function(k){
      var r = scaledView[k]; if (!r) return;
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

  function headerHTML(){
    ticket.refill();
    var t = ticket.get();
    var cfg = ticket.getConfig();
    var left = ticket.timeToNext();
    var leftTxt = (t.free.count >= t.free.cap) ? "已滿" : ("+"+fmtClock(left));
    var label = (cfg.ITEM_NAME || cfg.NAME);

    return `
      <div style="border:1px solid #243247;background:#0b1220;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div style="font-size:12px;line-height:1.6">
          <div>
            <b>${cfg.NAME}</b>（免費）：<span style="font-weight:800">${t.free.count}</span> / ${t.free.cap}
            <span style="font-size:12px;opacity:.8;margin-left:6px;">（每 300 分復原 1）</span>
            <span style="margin-left:8px;opacity:.9;">下次回復：${leftTxt}</span>
          </div>
          <div>背包：<b>${t.bag.count}</b>　總計：<b>${t.total}</b></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button id="btnExpandTicket" style="padding:6px 10px;border:0;border-radius:8px;background:#6b21a8;color:#fff;cursor:pointer">
            擴充上限（-${cfg.EXPAND_COST_GEM}💎 / +${cfg.EXPAND_DELTA}）+ 贈${cfg.GIFT_ON_EXPAND}張${label}
          </button>
        </div>
      </div>
    `;
  }

  DungeonHub.registerTab({
    id: "challenge",
    title: "挑戰",
    render: function(container){
      ticket.refill();

      container.innerHTML = `
        ${headerHTML()}
        <div style="display:grid;gap:10px;margin-top:10px">
          ${DUNS.map(function(d){ 
            var maxCleared = (function(){ try{ return Math.max(0, Number(JSON.parse(localStorage.getItem("challenge_progress_v1")||"{}")[d.id]?.maxCleared||0)); }catch(_){return 0;} })();
            var nextLv = Math.min((maxCleared + 1), LV.MAX_LEVEL);
            var scaled = U.scaledFinalRewardsForLevel(d.finalRewards, nextLv);
            var rewardLines = [];
            Object.keys(scaled || {}).forEach(function(k){
              var r = scaled[k]; if (!r) return;
              var unit = /碎片|石|券|票|符|令/.test(k) ? "個" : "";
              rewardLines.push(`・${k}：${U.formatRange(r, unit)}`);
            });
            if (rewardLines.length === 0) rewardLines.push("・—");

            var waves = U.buildWavesForLevel(d.wavesTemplate, nextLv);
            var boss  = waves[waves.length-1].monster;
            var consumeLabel = (ticket.getConfig().ITEM_NAME || ticket.getConfig().NAME);

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
                  <div>・攻擊力：${(boss.atk||1).toLocaleString()}</div>
                  <div>・防禦力：${(boss.def||0).toLocaleString()}</div>
                  <div>・生命值：${(boss.hp||1).toLocaleString()}</div>
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
              </div>`;
          }).join("")}
        </div>
      `;

      var exBtn = container.querySelector('#btnExpandTicket');
      if (exBtn) exBtn.onclick = tryExpandCap;

      function rerender(){ DungeonHub.requestRerender(); }

      container.querySelectorAll('.btn-ch-start').forEach(function(btn){
        btn.onclick = function(){
          var id = this.getAttribute('data-id');
          var level = Number(this.getAttribute('data-level'));
          var d  = DUNS.find(function(x){ return x.id===id; });
          if (!d) return;

          ticket.refill();
          if (!ticket.canSpend(1)) {
            var needLabel = (ticket.getConfig().ITEM_NAME || ticket.getConfig().NAME);
            alert(`需要 ${needLabel} ×1`); return;
          }

          DungeonHub.close();
          runGauntlet(d, level, function(state){
            if (state === "win") {
              ticket.spend(1);
              setMaxCleared(d.id, level);
              window.saveGame?.();
            }
          });
        };
      });

      container.querySelectorAll('.btn-ch-retry').forEach(function(btn){
        btn.onclick = function(){
          var id = this.getAttribute('data-id');
          var level = Number(this.getAttribute('data-level'));
          var d  = DUNS.find(function(x){ return x.id===id; });
          if (!d) return;

          if (!ticket.canSpend(1)) {
            var needLabel = (ticket.getConfig().ITEM_NAME || ticket.getConfig().NAME);
            alert(`需要 ${needLabel} ×1`); return;
          }

          DungeonHub.close();
          runGauntlet(d, level, function(state){
            if (state === "win") {
              ticket.spend(1);
              window.saveGame?.();
            }
          });
        };
      });

      container.querySelectorAll('.btn-ch-sweep').forEach(function(btn){
        btn.onclick = function(){
          var id = this.getAttribute('data-id');
          var level = Number(this.getAttribute('data-level'));
          var d  = DUNS.find(function(x){ return x.id===id; });
          if (!d) return;

          if (!ticket.canSpend(1)) {
            var needLabel = (ticket.getConfig().ITEM_NAME || ticket.getConfig().NAME);
            alert(`需要 ${needLabel} ×1`); return;
          }

          var got = sweepGrant(d, level);
          ticket.spend(1);
          window.saveGame?.();

          var parts = Object.keys(got||{}).map(function(k){ return k+"×"+got[k].toLocaleString(); });
          window.logPrepend?.("⏩ 掃蕩成功（挑戰 "+d.name+" Lv."+level+"）：獲得 "+ (parts.join("、")||"—"));
          alert("掃蕩獲得：\n" + (parts.join("\n") || "—"));

          rerender();
        };
      });
    }
  });

  // （可選）對 SaveHub 暴露
  window.ChallengeTicket = ticket;
})();