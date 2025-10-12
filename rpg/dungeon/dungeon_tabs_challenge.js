// dungeon_tabs_challenge.js (TicketManager + DungeonGate 版，勝利顯示實拿獎勵)
(function () {
  if (!window.DungeonHub) return;

  // ==== 外部依賴（安全版）====
  var TM   = window.TicketManager;    // 統一票券（需先載入 dungeon/common/tickets.js）
  var TKEY = "ResourceTicket";

  if (!TM || typeof TM.getConfig !== 'function') {
    console.error("[dungeon_tabs_challenge] TicketManager 未就緒（請確認載入順序：tickets.js → tickets_ui.js → dungeon_gate.js → hub/core → 本檔）");
    return;
  }

  var CFG  = TM.getConfig(TKEY);
  if (!CFG) {
    console.error("[dungeon_tabs_challenge] 取不到票券設定：" + TKEY);
    return;
  }

  var LV   = window.LevelConfig;
  var DUNS = window.WaveDungeonDefs || [];
  var U    = window.WaveDungeonUtils;

  // ==== 便捷函式（都走 TicketManager）====
  function refillTicket(){ TM.refill(TKEY); }
  function getTicket(){ return TM.get(TKEY); }
  function timeToNext(){ return TM.timeToNext(TKEY); }
  function fmtClock(ms){ var s=Math.floor(ms/1000), m=Math.floor(s/60), ss=s%60; return m+":"+String(ss).padStart(2,"0"); }

  function tryExpandCap(){
    var need = CFG.EXPAND_COST_GEM;
    var have = Number(window.player?.gem || 0);
    if (have < need) { alert(`需要 ${need} 鑽石`); return; }
    if (!confirm(`花費 ${need} 鑽石將上限 +${CFG.EXPAND_DELTA}，並贈送 ${CFG.GIFT_ON_EXPAND} 張「${CFG.NAME}」\n是否確認？`)) return;
    player.gem = Math.max(0, have - need);
    TM.expand(TKEY, 1);
    window.updateResourceUI?.();
    window.logPrepend?.(`🧾 已擴充${CFG.NAME}上限至 ${TM.get(TKEY).cap}，並獲得 ${CFG.GIFT_ON_EXPAND} 張`);
    DungeonHub.requestRerender();
  }

  // ===== 每副本等級狀態 =====
  var levelById = {}; // { [dungeonId]: currentLevel }
  function getLv(id){ var L = levelById[id] ?? 1; return Math.max(1, Math.min(L, LV.MAX_LEVEL)); }
  function setLv(id, L){ levelById[id] = Math.max(1, Math.min(L|0, LV.MAX_LEVEL)); }

  // ====== 勝利後把「獎勵：」面板改成本次實際拿到 ======
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

  // ===== 啟動波次（單一視窗一路打完）=====
  function runGauntlet(dunDef, level, onAllFinish){
    var waves = U.buildWavesForLevel(dunDef.wavesTemplate, level);
    var total = waves.length;
    var idx = 0;

    // 顯示用：最終獎勵「區間」——只用在入場前說明；真正發獎在勝利 onResult
    var scaledView = U.scaledFinalRewardsForLevel(dunDef.finalRewards, level);
    var dispRewards = []; // 交給核心顯示區間（若你已把核心的預設渲染關掉，這個陣列可留空亦可）
    if (scaledView.gold)     dispRewards.push({ type:"text", key:"金幣 "     + U.formatRange(scaledView.gold),           qty:"" });
    if (scaledView.stone)    dispRewards.push({ type:"text", key:"強化石 "   + U.formatRange(scaledView.stone),          qty:"" });
    if (scaledView.shard)    dispRewards.push({ type:"text", key:"元素碎片 " + U.formatRange(scaledView.shard,"個"),     qty:"" });
    if (scaledView.advStone) dispRewards.push({ type:"text", key:"進階石 "   + U.formatRange(scaledView.advStone,"個"),  qty:"" });

    // —— UI 與流程 hooks ——
    var rewarded = false; // 防重複
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
      // ★ 勝利當下就抽獎 + 入庫 + 改面板顯示成「本次實拿」
      onResult: function({ ctx, state }){
        if (state === "win" && !rewarded){
          rewarded = true;
          var got = U.grantFinalRewards(scaledView, `${dunDef.name}（Lv.${level}）`);
          renderGotRewards(got);
        }
      }
    };

    // finishUI 保留按鈕，但再次點擊不會重複發獎
    var finishUI = {
      isFinal: true,
      claimLabel: "領取獎勵",
      onClaim: function(){
        if (rewarded) return; // 已經發過就略過
        rewarded = true;
        var got = U.grantFinalRewards(scaledView, `${dunDef.name}（Lv.${level}）`);
        renderGotRewards(got);
      }
    };

    var first = waves[0];
    window.DungeonBattle?.start({
      title: `${dunDef.name} — ${first.label}（Lv.${level}）`,
      monster: first.monster,
      timeLimitSec: dunDef.timeLimitSec || 0,
      rewards: dispRewards,     // 只是顯示區間；真正數字在 onResult
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
    var leftTxt = (t.count >= t.cap) ? "已滿" : ("+"+fmtClock(left));
    return `
      <div style="border:1px solid #243247;background:#0b1220;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div style="font-size:14px">
          <b>${CFG.NAME}</b>：<span style="font-weight:800">${t.count}</span> / ${t.cap}
          <span style="font-size:12px;opacity:.8;margin-left:6px;">（每 30 分復原 1）</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:12px;opacity:.9">下次回復：${leftTxt}</div>
          <button id="btnExpandTicket" style="padding:6px 10px;border:0;border-radius:8px;background:#6b21a8;color:#fff;cursor:pointer">
            擴充上限（-${CFG.EXPAND_COST_GEM}💎 / +${CFG.EXPAND_DELTA}）+ 贈${CFG.GIFT_ON_EXPAND}
          </button>
        </div>
      </div>
    `;
  }

  function cardHTML(d, L){
    var scaled = U.scaledFinalRewardsForLevel(d.finalRewards, L);
    var goldTxt  = U.formatRange(scaled.gold);
    var stoneTxt = U.formatRange(scaled.stone);
    var shardTxt = U.formatRange(scaled.shard,"個");
    var advTxt   = U.formatRange(scaled.advStone,"個");

    var waves = U.buildWavesForLevel(d.wavesTemplate, L);
    var boss  = waves[waves.length-1].monster;
    var atk   = (boss.atk||1).toLocaleString();
    var def   = (boss.def||0).toLocaleString();
    var hp    = (boss.hp||1).toLocaleString();

    var rewardLines = [];
    if (scaled.gold)     rewardLines.push(`・金幣：${goldTxt}`);
    if (scaled.stone)    rewardLines.push(`・強化石：${stoneTxt}`);
    if (scaled.shard)    rewardLines.push(`・元素碎片：${shardTxt}`);
    if (scaled.advStone) rewardLines.push(`・進階石：${advTxt}`);
    if (rewardLines.length === 0) rewardLines.push(`・—`);

    return `
      <div style="border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="font-weight:800">${d.name}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="btn-lv-dec" data-id="${d.id}" style="padding:4px 8px;border-radius:8px;border:0;background:#1f2937;color:#fff;cursor:pointer">◀</button>
            <div class="lv-label" data-id="${d.id}" style="min-width:64px;text-align:center;font-size:12px;">Lv.${L}</div>
            <button class="btn-lv-inc" data-id="${d.id}" style="padding:4px 8px;border-radius:8px;border:0;background:#1f2937;color:#fff;cursor:pointer">▶</button>
          </div>
        </div>

        <div style="opacity:.9;font-size:12px;margin:6px 0 8px">${d.desc || ""}</div>

        <div style="font-size:12px;opacity:.95;line-height:1.8">
          <div>最終波敵人能力：</div>
          <div>・攻擊力：${atk}</div>
          <div>・防禦力：${def}</div>
          <div>・生命值：${hp}</div>
        </div>

        <div style="font-size:12px;opacity:.95;line-height:1.8;margin-top:6px">
          <div>最終獎勵（按 Lv 放大）</div>
          ${rewardLines.join("<br>")}
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button class="btn-start" data-id="${d.id}" style="padding:8px 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer">
            開始挑戰（消耗：${CFG.NAME} ×1）
          </button>
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

      // 初始化各副本等級（預設 Lv.1）
      for (var i=0;i<DUNS.length;i++){
        if (levelById[DUNS[i].id] == null) levelById[DUNS[i].id] = 1;
      }

      container.innerHTML = `
        ${headerHTML()}
        <div style="display:grid;gap:10px;margin-top:10px">
          ${DUNS.map(function(d){ return cardHTML(d, getLv(d.id)); }).join("")}
        </div>
      `;

      // 擴充按鈕
      var exBtn = container.querySelector('#btnExpandTicket');
      if (exBtn) exBtn.onclick = tryExpandCap;

      function refreshAll(){ DungeonHub.requestRerender(); }

      // 等級調整
      var decs = container.querySelectorAll('.btn-lv-dec');
      var incs = container.querySelectorAll('.btn-lv-inc');
      for (var i=0;i<decs.length;i++){
        decs[i].onclick = function(){
          var id = this.getAttribute('data-id');
          setLv(id, getLv(id)-1);
          refreshAll();
        };
      }
      for (var j=0;j<incs.length;j++){
        incs[j].onclick = function(){
          var id = this.getAttribute('data-id');
          setLv(id, getLv(id)+1);
          refreshAll();
        };
      }

      // 開始挑戰：透過 DungeonGate 統一檢查主戰鬥是否已停止
      DungeonGate.bindButtons('.btn-start', function(btn){
        return function(){
          var id = btn.getAttribute('data-id');
          var d  = DUNS.find(function(x){ return x.id===id; });
          if (!d) return;

          refillTicket();
          if (!TM.canSpend(TKEY, 1)) { alert(`需要 ${CFG.NAME} ×1`); return; }

          var L = getLv(id);
          DungeonHub.close();

          runGauntlet(d, L, function(state){
            if (state === "win") {
              TM.spend(TKEY, 1);
              window.saveGame?.();
            }
          });
        };
      });
    }
  });
})();