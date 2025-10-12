// dungeon/dungeon_tabs_v13.js — 1v3 分頁 + 票券資訊條 + 三敵行動速度面板（不改核心 UI）
// ★ 修正：勝利時在 onResult 直接抽獎入庫，並把面板獎勵改成「本次實拿」

(function () {
  if (!window.DungeonHub) return;

  var TM   = window.TicketManager || null;
  var LV   = window.V13LevelConfig;
  var DUNS = window.V13Defs || [];
  var U    = window.V13Utils;
  var GATE = window.DungeonGate || null;

  // ========= 票券 =========
  var TKEY = "ChallengeTicket";
  function getTicketCfg(){
    if (TM && TM.getConfig(TKEY)) return TM.getConfig(TKEY);
    return { NAME: "挑戰券", PERIOD_MS: 30*60*1000, EXPAND_COST_GEM: 100, EXPAND_DELTA: 5, GIFT_ON_EXPAND: 1, DEFAULT_CAP: 10 };
  }
  function refill(){ if (TM) TM.refill(TKEY); }
  function getTicket(){ return TM ? TM.get(TKEY) : { count:0, cap:0, lastTs:Date.now() }; }
  function timeToNext(){ return TM ? TM.timeToNext(TKEY) : 0; }
  function fmtClock(ms){ var s=Math.floor(ms/1000), m=Math.floor(s/60), ss=s%60; return m+":"+String(ss).padStart(2,"0"); }
  function tryExpandCap(){
    if (!TM) { alert("尚未安裝 TicketManager"); return; }
    var cfg=getTicketCfg(), need=cfg.EXPAND_COST_GEM, have=Number(window.player?.gem||0);
    if (have < need) { alert(`需要 ${need} 鑽石`); return; }
    if (!confirm(`花費 ${need} 鑽石將上限 +${cfg.EXPAND_DELTA}，並贈送 ${cfg.GIFT_ON_EXPAND} 張「${cfg.NAME}」\n是否確認？`)) return;
    player.gem=Math.max(0,have-need);
    TM.expand(TKEY,1);
    window.updateResourceUI?.();
    window.logPrepend?.(`🧾 已擴充${cfg.NAME}上限至 ${TM.get(TKEY).cap}，並獲得 ${cfg.GIFT_ON_EXPAND} 張`);
    DungeonHub.requestRerender();
  }

  // ========= 等級狀態 =========
  var levelById={};
  function getLv(id){ var L=levelById[id]??1; return Math.max(1, Math.min(L, LV.MAX_LEVEL)); }
  function setLv(id,L){ levelById[id]=Math.max(1, Math.min(L|0, LV.MAX_LEVEL)); }

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

  // ========= 真 1v3 進場 =========
  function startV13Dungeon(dDef, level, onFinishAll){
    var enemies = U.buildEnemiesForLevel(dDef.enemiesBase, level).map(function(e){
      var ee={ name:e.name, atk:e.atk, def:e.def, hpMax:e.hp, hpCur:e.hp, ms:e.ms, aps:e.aps, speedPct:e.speedPct, acc:0 };
      ee.msEff = effectiveMsOfEnemy(ee);
      return ee;
    });
    var focus = firstAliveIndex(enemies);

    // ★ 獎勵：按等級放大後的「區間視圖」
    var rView = U.scaledRewardsForLevel(dDef.finalRewards, level);

    // ★ 入場顯示用（區間）——戰鬥勝利後會改成「本次實拿」
    var rewardsForUI = [];
    Object.keys(rView || {}).forEach(function(k){
      var rng = rView[k];
      if (!Array.isArray(rng) || rng.length < 2) return;
      rewardsForUI.push({ type:"text", key: k + " " + U.formatRange(rng), qty:"" });
    });

    var listInited=false, apsPanelInited=false;
    var rewarded = false; // 防止重複發獎

    var hooks = {
      onRender: function(){
        // 1) 下方清單
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

        // 2) 右側面板下方附加「三敵行動速度」區塊（不覆蓋核心元素）
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

        // 讓核心畫面名字跟焦點一致（不動其他數值/進度）
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
            // 把核心怪設成超慢，避免核心的怪物迴圈出手；真正攻擊由我們 onTick 處理
            ctx.api.setMonster({ name:n.name, atk:0, def:n.def, hp:n.hpCur, ms: 99999999 });
          }
        }
      },

      // 三敵各自依 msEff 出手，同時推進進度條
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

      // ★ 勝利當下就抽獎 + 入庫 + 改面板顯示成「本次實拿」
      onResult: function({ ctx, state }){
        if (state === "win" && !rewarded){
          rewarded = true;
          var got = U.grantRewards(rView); // rView 是區間；這裡抽實際數字並入庫
          renderGotRewards(got);           // 把面板獎勵從區間改成實際數字
        }
      }
    };

    var first=enemies[focus];
    window.DungeonBattle?.start({
      title: `${dDef.name}（Lv.${level}）`,
      // 進場時把核心怪設成超慢（我們自己處理怪攻擊）
      monster: { name:first.name, atk:first.atk, def:first.def, hp:first.hpCur, ms: 99999999 },
      timeLimitSec: dDef.timeLimitSec || 0,
      rewards: rewardsForUI,   // 這裡只放「顯示用」區間；真實數字在 onResult
      hooks: hooks,
      onFinish: function(res){ if (typeof onFinishAll==="function") onFinishAll(res.state); }
    });
  }

  // ========= 票券資訊條 =========
  function headerHTML(){
    refill();
    var cfg=getTicketCfg(), t=getTicket(), left=timeToNext();
    var leftTxt=(t.count>=t.cap)?"已滿":("+"+fmtClock(left));
    return `
      <div style="border:1px solid #243247;background:#0b1220;border-radius:10px;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div style="font-size:14px">
          <b>${cfg.NAME}</b>：<span style="font-weight:800">${t.count}</span> / ${t.cap}
          <span style="font-size:12px;opacity:.8;margin-left:6px;">（每 30 分復原 1）</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:12px;opacity:.9">下次回復：${leftTxt}</div>
          <button id="v13Expand" style="padding:6px 10px;border:0;border-radius:8px;background:#6b21a8;color:#fff;cursor:pointer">
            擴充上限（-${cfg.EXPAND_COST_GEM}💎 / +${cfg.EXPAND_DELTA}）+ 贈${cfg.GIFT_ON_EXPAND}
          </button>
        </div>
      </div>
    `;
  }

  // ========= 卡片 =========
  function cardHTML(d, L){
    var enemies=U.buildEnemiesForLevel(d.enemiesBase, L);

    // 最終獎勵（按 Lv 放大）動態列出所有鍵
    var rView = U.scaledRewardsForLevel(d.finalRewards, L);
    var rewardLines = Object.keys(rView || {}).length
      ? Object.keys(rView).map(function(k){ return `・${k}：` + U.formatRange(rView[k]); }).join("<br>")
      : "・—";

    var enemyList=enemies.map(function(e){
      return `・${e.name} — ATK ${e.atk.toLocaleString()} / DEF ${e.def.toLocaleString()} / HP ${e.hp.toLocaleString()}`;
    }).join("<br>");

    var cfg=getTicketCfg();
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
          <div>同場敵人（按 Lv 放大）：</div>
          ${enemyList}
        </div>

        <div style="font-size:12px;opacity:.95;line-height:1.8;margin-top:6px">
          <div>最終獎勵（按 Lv 放大）</div>
          ${rewardLines}
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button class="btn-v13-start" data-id="${d.id}" style="padding:8px 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer">
            開始挑戰（消耗：${cfg.NAME} ×1）
          </button>
        </div>
      </div>
    `;
  }

  // ========= 分頁註冊 =========
  DungeonHub.registerTab({
    id: "v13",
    title: "1v3",
    render: function(container){
      for (var i=0;i<DUNS.length;i++){ if (levelById[DUNS[i].id]==null) levelById[DUNS[i].id]=1; }

      container.innerHTML = `
        ${headerHTML()}
        <div style="display:grid;gap:10px">
          ${DUNS.map(function(d){ return cardHTML(d, getLv(d.id)); }).join("")}
        </div>
      `;

      var ex=container.querySelector("#v13Expand"); if (ex) ex.onclick=tryExpandCap;
      function refresh(){ DungeonHub.requestRerender(); }

      var decs=container.querySelectorAll('.btn-lv-dec');
      var incs=container.querySelectorAll('.btn-lv-inc');
      for (var i=0;i<decs.length;i++){
        decs[i].onclick=function(){ var id=this.getAttribute('data-id'); setLv(id, getLv(id)-1); refresh(); };
      }
      for (var j=0;j<incs.length;j++){
        incs[j].onclick=function(){ var id=this.getAttribute('data-id'); setLv(id, getLv(id)+1); refresh(); };
      }

      var starts=container.querySelectorAll('.btn-v13-start');
      for (var k=0;k<starts.length;k++){
        starts[k].onclick=function(){
          var id=this.getAttribute('data-id');
          var d=DUNS.find(function(x){ return x.id===id; });
          if (!d) return;

          if (GATE && typeof GATE.ensureStopped==="function"){ if (!GATE.ensureStopped()) return; }
          else if (window.autoEnabled){ alert("請先停止外部戰鬥再進入副本"); return; }

          if (TM && !TM.canSpend(TKEY,1)){ var name=getTicketCfg().NAME; alert(`需要 ${name} ×1`); return; }

          DungeonHub.close();
          startV13Dungeon(d, getLv(id), function(state){
            if (state==="win" && TM){ TM.spend(TKEY,1); window.saveGame?.(); }
          });
        };
      }
    }
  });
})();