// dungeon/dungeon_tabs_v13.js — 1v3 分頁（票券雙軌 + 進度 + 挑戰/重試/掃蕩）
// ★ 與飾品試煉一致：頂部票券條（免費/背包/總計）、每副本獨立進度、挑戰下一關、挑戰上次通關、掃蕩×0.75
(function () {
  if (!window.DungeonHub) return;

  var TM   = window.TicketManager || null;
  var LV   = window.V13LevelConfig;
  var DUNS = window.V13Defs || [];
  var U    = window.V13Utils;
  var GATE = window.DungeonGate || null;

  // ========= 票券（雙軌：免費票 + 背包票） =========
  var TKEY = "ChallengeTicket";

  function getTicketCfg(){
    if (TM && TM.getConfig(TKEY)) return TM.getConfig(TKEY);
    return {
      NAME: "挑戰券（免費）",
      ITEM_NAME: "挑戰券",
      PERIOD_MS: 30 * 60 * 1000,
      EXPAND_COST_GEM: 100,
      EXPAND_DELTA: 5,
      GIFT_ON_EXPAND: 1,
      DEFAULT_CAP: 10
    };
  }
  function refill(){ if (TM) TM.refill(TKEY); }
  function getTicket(){
    if (!TM) return { free:{count:0,cap:0,lastTs:Date.now()}, bag:{count:0}, total:0 };
    return TM.get(TKEY);
  }
  function timeToNext(){ return TM ? TM.timeToNext(TKEY) : 0; }
  function fmtClock(ms){ var s=Math.floor(ms/1000), m=Math.floor(s/60), ss=s%60; return m+":"+String(ss).padStart(2,"0"); }
  function tryExpandCap(){
    if (!TM) { alert("尚未安裝 TicketManager"); return; }
    var cfg=getTicketCfg(), need=cfg.EXPAND_COST_GEM, have=Number(window.player?.gem||0);
    if (have < need) { alert("需要 "+need+" 鑽石"); return; }
    if (!confirm(`花費 ${need} 鑽石將上限 +${cfg.EXPAND_DELTA}，並贈送 ${cfg.GIFT_ON_EXPAND} 張「${cfg.ITEM_NAME||cfg.NAME}」\n是否確認？`)) return;
    player.gem=Math.max(0,have-need);
    TM.expand(TKEY,1);
    window.updateResourceUI?.();
    var nowT = TM.get(TKEY);
    window.logPrepend?.(`🧾 已擴充${cfg.NAME}上限至 ${nowT.free.cap}，並獲得 ${cfg.GIFT_ON_EXPAND} 張`);
    DungeonHub.requestRerender();
  }

  // ========= 進度存檔（每個副本各自記錄最高通關 Lv）=========
  var PROG_KEY = "v13_progress_v1";
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

  // ========= 小工具 =========
  function jitterMul(){ var p=Number(window.DAMAGE_JITTER_PCT); p=(p>=0&&p<=1)?p:0.12; return (1-p)+Math.random()*(2*p); }
  function effectiveMsOfEnemy(e){
    if (isFinite(e.ms) && e.ms>0) return Math.max(10, Math.floor(e.ms));
    if (isFinite(e.aps) && e.aps>0) return Math.max(10, Math.floor(1000/e.aps));
    if (isFinite(e.speedPct) && e.speedPct>0) return Math.max(10, Math.floor(2000/e.speedPct));
    return 2000;
  }
  function calcEnemyHitToPlayer(atk){
    var def=Number(window.player?.totalStats?.def||0);
    var base=Math.max(1, Math.floor(atk-def));
    return Math.max(1, Math.floor(base*jitterMul()));
  }
  function firstAliveIndex(arr){ for (var i=0;i<arr.length;i++){ if (arr[i].hpCur>0) return i; } return -1; }

  // ====== 勝利後：把「獎勵：」區塊改成本次實拿 ======
  function renderGotRewards(got){
    var rw = document.getElementById("dun-rewards");
    if (!rw) return;
    var lines = [];
    Object.keys(got || {}).forEach(function(k){
      var qty = Number(got[k] || 0);
      if (qty > 0) lines.push(`<li>${k} × ${qty.toLocaleString()}</li>`);
    });
    if (lines.length){
      rw.style.display = "block";
      rw.innerHTML = `獎勵：<ul>${lines.join("")}</ul>`;
    }
  }

  // 掃蕩（1v3）：用當關獎勵的 0.75 倍；至少下取整
  function sweepGrant(dDef, level){
    var rView = U.scaledRewardsForLevel(dDef.finalRewards, level); // 區間
    var got   = U.grantRewards(rView); // 實抽
    var out = {};
    Object.keys(got).forEach(function(k){
      out[k] = Math.max(0, Math.floor(got[k] * 0.75));
    });
    // 入庫
    Object.keys(out).forEach(function(k){ var n=out[k]; if (n>0){ window.addItem?.(k, n); } });
    return out;
  }

  // ========= 真 1v3 進場 =========
  function startV13Dungeon(dDef, level, onFinishAll){
    var enemies = U.buildEnemiesForLevel(dDef.enemiesBase, level).map(function(e){
      var ee={ name:e.name, atk:e.atk, def:e.def, hpMax:e.hp, hpCur:e.hp, ms:e.ms, aps:e.aps, speedPct:e.speedPct, acc:0 };
      ee.msEff = effectiveMsOfEnemy(ee);
      return ee;
    });
    var focus = firstAliveIndex(enemies);

    var rView = U.scaledRewardsForLevel(dDef.finalRewards, level); // 區間
    var rewardsForUI = [];
    Object.keys(rView || {}).forEach(function(k){
      var rng = rView[k];
      if (!Array.isArray(rng) || rng.length < 2) return;
      rewardsForUI.push({ type:"text", key: k + " " + U.formatRange(rng), qty:"" });
    });

    var listInited=false, apsPanelInited=false;
    var rewarded = false;

    var hooks = {
      onRender: function(){
        // 清單
        if (!listInited){
          var bd=document.querySelector("#dun-card .dun-bd");
          if (bd){
            var box=document.createElement("div");
            box.id="v13-hud";
            box.style.cssText="border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px;font-size:12px;line-height:1.8";
            box.innerHTML=`<div style="font-weight:700;margin-bottom:6px">1v3 同場敵人</div><div id="v13-list"></div>`;
            bd.appendChild(box);
            listInited=true;
          }
        }
        var list=document.getElementById("v13-list");
        if (list){
          list.innerHTML=enemies.map(function(e,i){
            var pct=Math.max(0, Math.min(100, Math.floor((e.hpCur/e.hpMax)*100)));
            var mark=(i===focus)?"（當前目標）":"";
            return `
              <div style="margin:4px 0">
                <div><b>${e.name}</b> ${mark} — ATK ${e.atk.toLocaleString()} / DEF ${e.def.toLocaleString()} / HP ${e.hpCur.toLocaleString()} / ${e.hpMax.toLocaleString()}</div>
                <div class="dun-bar"><i style="display:block;height:8px;width:${pct}%;background:linear-gradient(90deg,#f59e0b,#ef4444)"></i></div>
              </div>`;
          }).join("");
        }

        // 行動速度面板
        if (!apsPanelInited){
          var rightBox=document.querySelector("#dun-card .dun-row .dun-box:nth-child(2)");
          if (rightBox){
            var panel=document.createElement("div");
            panel.id="v13-aps-panel";
            panel.style.cssText="margin-top:10px";
            panel.innerHTML=[
              `<div><b>三敵行動速度</b></div>`,
              enemies.map(function(e,i){
                var aps=(1000/e.msEff).toFixed(2);
                return `
                  <div style="margin:6px 0">
                    <div>${e.name}：<span id="v13-aps-${i}">${aps}</span> /s</div>
                    <div class="dun-bar"><i id="v13-cast-${i}" style="display:block;height:8px;width:0;background:linear-gradient(90deg,#22d3ee,#2563eb)"></i></div>
                  </div>`;
              }).join("")
            ].join("");
            rightBox.appendChild(panel);
            apsPanelInited=true;
          }
        }
        if (apsPanelInited){
          for (var i=0;i<enemies.length;i++){
            var e=enemies[i];
            var apsEl=document.getElementById("v13-aps-"+i);
            if (apsEl) apsEl.textContent=(1000/e.msEff).toFixed(2);
            var bar=document.getElementById("v13-cast-"+i);
            if (bar) bar.style.width=(Math.max(0,Math.min(1,e.acc/e.msEff))*100)+"%";
          }
        }

        // 焦點同步名稱
        if (enemies[focus] && window.currentMonster) {
          window.currentMonster.name = enemies[focus].name;
        }
      },

      // 玩家傷害扣在焦點；死亡換下一隻
      afterDamage: function({ctx, source, target, dmg}){
        if (source==="player" && target==="monster" && dmg>0){
          if (focus===-1) return;
          var e=enemies[focus];
          e.hpCur=Math.max(0, e.hpCur-dmg);
          window.monsterHP=e.hpCur;
          if (e.hpCur<=0){
            focus=firstAliveIndex(enemies);
            if (focus===-1){ ctx.finish("win"); return; }
            var n=enemies[focus];
            ctx.api.setMonster({ name:n.name, atk:0, def:n.def, hp:n.hpCur, ms: 99999999 });
          }
        }
      },

      // 三敵各自依 msEff 出手
      onTick: function({ctx, dt}){
        if (window.player && window.player.currentHP<=0) return;
        for (var i=0;i<enemies.length;i++){
          var e=enemies[i];
          if (e.hpCur<=0) continue;
          e.acc += dt;
          while (e.acc >= e.msEff){
            e.acc -= e.msEff;
            var hit=calcEnemyHitToPlayer(e.atk);
            ctx.api.dealDamageToPlayer(hit, { name:e.name });
            if (window.player && window.player.currentHP<=0) return;
          }
        }
      },

      // 勝利當下抽獎 + 入庫 + 顯示實拿 + 進度提升
      onResult: function({ ctx, state }){
        if (state === "win" && !rewarded){
          rewarded = true;
          var got = U.grantRewards(rView); // 入庫
          renderGotRewards(got);
          // 進度（本副本 id= dDef.id）
          setMaxCleared(dDef.id, level);
        }
      }
    };

    var first=enemies[focus];
    window.DungeonBattle?.start({
      title: `${dDef.name}（Lv.${level}）`,
      monster: { name:first.name, atk:first.atk, def:first.def, hp:first.hpCur, ms: 99999999 },
      timeLimitSec: dDef.timeLimitSec || 0,
      rewards: rewardsForUI,   // 顯示區間；實拿在 onResult
      hooks: hooks,
      onFinish: function(res){ if (typeof onFinishAll==="function") onFinishAll(res.state); }
    });
  }

  // ========= 票券資訊條（免費/背包/總計） =========
  function headerHTML(){
    refill();
    var cfg = getTicketCfg();
    var t   = getTicket();
    var left = timeToNext();
    var leftTxt = (t.free.count >= t.free.cap) ? "已滿" : ("+"+fmtClock(left));
    var itemLabel = cfg.ITEM_NAME || cfg.NAME;

    return `
      <div style="border:1px solid #243247;background:#0b1220;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div style="font-size:12px;line-height:1.6">
          <div>
            <b>${cfg.NAME}</b>（免費）：<span style="font-weight:800">${t.free.count}</span> / ${t.free.cap}
            <span style="font-size:12px;opacity:.8;margin-left:6px;">（每 30 分復原 1）</span>
            <span style="margin-left:8px;opacity:.9;">下次回復：${leftTxt}</span>
          </div>
          <div>背包：<b>${t.bag.count}</b>　總計：<b>${t.total}</b></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button id="v13Expand" style="padding:6px 10px;border:0;border-radius:8px;background:#6b21a8;color:#fff;cursor:pointer">
            擴充上限（-${cfg.EXPAND_COST_GEM}💎 / +${cfg.EXPAND_DELTA}）+ 贈${cfg.GIFT_ON_EXPAND}張${itemLabel}
          </button>
        </div>
      </div>
    `;
  }

  // ========= 卡片（與飾品試煉一致：下一關/重試/掃蕩）=========
  function cardHTML(d){
    var maxCleared = getMaxCleared(d.id);
    var nextLv = Math.min((maxCleared + 1), LV.MAX_LEVEL);

    var enemies=U.buildEnemiesForLevel(d.enemiesBase, nextLv);
    var enemyList=enemies.map(function(e){
      return `・${e.name} — ATK ${e.atk.toLocaleString()} / DEF ${e.def.toLocaleString()} / HP ${e.hp.toLocaleString()}`;
    }).join("<br>");

    var rView = U.scaledRewardsForLevel(d.finalRewards, nextLv);
    var rewardLines = Object.keys(rView || {}).length
      ? Object.keys(rView).map(function(k){ return `・${k}：` + U.formatRange(rView[k]); }).join("<br>")
      : "・—";

    var cfg=getTicketCfg();
    var consumeLabel = cfg.ITEM_NAME || cfg.NAME;

    var retryBtn = (maxCleared>0)
      ? `<button class="btn-v13-retry" data-id="${d.id}" data-level="${maxCleared}" style="padding:8px 12px;border:0;border-radius:8px;background:#4b5563;color:#fff;cursor:pointer">挑戰上次通關（Lv.${maxCleared}）</button>`
      : '';

    var sweepBtn = (maxCleared>0)
      ? `<button class="btn-v13-sweep" data-id="${d.id}" data-level="${maxCleared}" style="padding:8px 12px;border:0;border-radius:8px;background:#1f2937;color:#fff;cursor:pointer">掃蕩（以 Lv.${maxCleared} 計 / ×0.75）</button>`
      : '';

    return `
      <div class="v13-card" data-id="${d.id}" style="border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="font-weight:800">${d.name}</div>
          <div class="v13-level" style="font-size:12px;">最高通關：<b>${maxCleared}</b> / ${LV.MAX_LEVEL}　下一關：<b>Lv.${nextLv}</b></div>
        </div>

        <div style="opacity:.9;font-size:12px;margin:6px 0 8px">${d.desc || ""}</div>

        <div style="font-size:12px;opacity:.95;line-height:1.8">
          <div>同場敵人（以下一關預覽）：</div>
          ${enemyList}
        </div>

        <div style="font-size:12px;opacity:.95;line-height:1.8;margin-top:6px">
          <div>挑戰獎勵（以下一關預覽）</div>
          ${rewardLines}
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button class="btn-v13-start" data-id="${d.id}" data-level="${nextLv}" style="padding:8px 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer">
            挑戰下一關（消耗：${consumeLabel} ×1）
          </button>
          ${retryBtn}
          ${sweepBtn}
        </div>
      </div>
    `;
  }

  // ========= 分頁註冊 =========
  DungeonHub.registerTab({
    id: "v13",
    title: "1v3",
    render: function(container){
      container.innerHTML = `
        ${headerHTML()}
        <div style="display:grid;gap:10px">
          ${DUNS.map(function(d){ return cardHTML(d); }).join("")}
        </div>
      `;

      var ex=container.querySelector("#v13Expand"); if (ex) ex.onclick=tryExpandCap;
      function rerender(){ DungeonHub.requestRerender(); }

      function ensureGateStopped(){
        if (GATE && typeof GATE.ensureStopped==="function"){ return !!GATE.ensureStopped(); }
        if (window.autoEnabled){ alert("請先停止外部戰鬥再進入副本"); return false; }
        return true;
      }

      // 挑戰下一關
      container.querySelectorAll('.btn-v13-start').forEach(function(btn){
        btn.onclick = function(){
          if (!ensureGateStopped()) return;
          var dId = this.getAttribute('data-id');
          var level = Number(this.getAttribute('data-level'));
          var d=DUNS.find(function(x){ return x.id===dId; });
          if (!d) return;

          if (!TM || !TM.canSpend(TKEY,1)){
            var need = getTicketCfg().ITEM_NAME || getTicketCfg().NAME;
            alert(`需要 ${need} ×1`); return;
          }

          DungeonHub.close();
          startV13Dungeon(d, level, function(state){
            if (state==="win" && TM){ TM.spend(TKEY,1); window.saveGame?.(); }
          });
        };
      });

      // 挑戰上次通關
      container.querySelectorAll('.btn-v13-retry').forEach(function(btn){
        btn.onclick = function(){
          if (!ensureGateStopped()) return;
          var dId = this.getAttribute('data-id');
          var level = Number(this.getAttribute('data-level'));
          var d=DUNS.find(function(x){ return x.id===dId; });
          if (!d) return;

          if (!TM || !TM.canSpend(TKEY,1)){
            var need = getTicketCfg().ITEM_NAME || getTicketCfg().NAME;
            alert(`需要 ${need} ×1`); return;
          }

          DungeonHub.close();
          startV13Dungeon(d, level, function(state){
            if (state==="win" && TM){ TM.spend(TKEY,1); window.saveGame?.(); }
          });
        };
      });

      // 掃蕩（以最高通關計 ×0.75）
      container.querySelectorAll('.btn-v13-sweep').forEach(function(btn){
        btn.onclick = function(){
          var dId = this.getAttribute('data-id');
          var level = Number(this.getAttribute('data-level'));
          var d=DUNS.find(function(x){ return x.id===dId; });
          if (!d) return;

          if (!TM || !TM.canSpend(TKEY,1)){
            var need = getTicketCfg().ITEM_NAME || getTicketCfg().NAME;
            alert(`需要 ${need} ×1`); return;
          }

          var got = sweepGrant(d, level);
          TM.spend(TKEY,1);
          window.saveGame?.();

          var parts = Object.keys(got||{}).map(function(k){ return k+"×"+got[k].toLocaleString(); });
          window.logPrepend?.("⏩ 掃蕩成功（1v3 "+d.name+" Lv."+level+"）：獲得 "+ (parts.join("、")||"—"));
          alert("掃蕩獲得：\n" + (parts.join("\n") || "—"));

          rerender();
        };
      });
    }
  });
})();