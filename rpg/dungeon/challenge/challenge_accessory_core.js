// dungeon/challenge_accessory_core.js — 飾品強化試煉：核心流程（戰鬥 / 掃蕩 / 入庫 / 倒數顯示）
(function (w) {
  "use strict";

  var DEF = w.ACC_DungeonDef;
  var U   = w.ACC_ConfigUtils;

  // ===== 入庫（自動）：任何鍵 addItem，金幣/強化石走資源 =====
  function grantRewardsAuto(resultR){
    var got = {};
    function roll(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

    Object.keys(resultR || {}).forEach(function(key){
      var range = resultR[key];
      if (!Array.isArray(range) || range.length < 2) return;
      var n = roll(range[0], range[1]);
      if (n <= 0) return;

      // 特殊資源（不進背包）
      if (key === "金幣" || key === "gold") {
        w.player.gold = (w.player.gold||0) + n;
        got["金幣"] = (got["金幣"]||0) + n;
        return;
      }
      if (key === "強化石" || key === "stone") {
        w.player.stone = (w.player.stone||0) + n;
        got["強化石"] = (got["強化石"]||0) + n;
        return;
      }

      // 其他鍵自動進背包
      if (typeof w.addItem === "function") {
        w.addItem(key, n);
      } else {
        w.player._bag = w.player._bag || {};
        w.player._bag[key] = (w.player._bag[key] || 0) + n;
      }
      got[key] = (got[key]||0) + n;
    });

    w.updateResourceUI?.();
    return got;
  }
// ---- Hard 模式輔助（計速/命中/挑目標）----
function effectiveMsOfEnemy(e){
  if (isFinite(e.ms) && e.ms > 0) return Math.max(10, Math.floor(e.ms));
  if (isFinite(e.aps) && e.aps > 0) return Math.max(10, Math.floor(1000 / e.aps));
  if (isFinite(e.speedPct) && e.speedPct > 0) return Math.max(10, Math.floor(2000 / e.speedPct));
  return 2000; // 預設 0.5/s
}
function jitterMul(){
  var p = Number(window.DAMAGE_JITTER_PCT);
  p = (p >= 0 && p <= 1) ? p : 0.12;
  return (1 - p) + Math.random() * (2 * p);
}
function calcEnemyHitToPlayer(atk){
  var def = Number(window.player?.totalStats?.def || 0);
  var base = Math.max(1, Math.floor(atk - def));
  return Math.max(1, Math.floor(base * jitterMul()));
}
function firstAliveIndex(arr){ for (var i=0;i<arr.length;i++){ if (arr[i].hpCur > 0) return i; } return -1; }


  // 把「獎勵：」面板改為「本次實拿」
  function renderGotRewards(got){
    var rw = document.getElementById("dun-rewards");
    if (!rw) return;
    var lines = [];
    Object.keys(got || {}).forEach(function(k){
      var q = Number(got[k] || 0);
      if (q > 0) lines.push("<li>"+k+" × "+q.toLocaleString()+"</li>");
    });
    if (lines.length){
      rw.style.display = "block";
      rw.innerHTML = "獎勵：<ul>"+lines.join("")+"</ul>";
    }
  }

  // ====== 倒數顯示（更新右上角 muted 區塊）======
  function attachCountdownHooks(level, scaledView){
    var remainMs = (Number(DEF.timeLimitSec)||0) * 1000;
    var lastShown = -1; // 避免每幀改字串
    return {
      onRender: function(){
        // 初次渲染時把頭上的字改成「剩餘：Ns」
        if (!remainMs) return;
        var hdMuted = document.querySelector("#dun-card .dun-hd .muted");
        if (hdMuted) {
          var s = Math.ceil(remainMs/1000);
          hdMuted.textContent = "剩餘：" + s + "s";
          lastShown = s;
        }
      },
      onTick: function({dt}){
        if (!remainMs) return;
        remainMs = Math.max(0, remainMs - dt);
        var s = Math.ceil(remainMs/1000);
        if (s !== lastShown){
          var hdMuted = document.querySelector("#dun-card .dun-hd .muted");
          if (hdMuted) hdMuted.textContent = "剩餘：" + s + "s";
          lastShown = s;
        }
      },
      // 勝利時立即抽獎入庫並改面板
      onResult: function(o){
        if (o.state==="win"){
          var got = grantRewardsAuto(scaledView);
          renderGotRewards(got);
        }
      }
    };
  }

  // ===== 普通模式：4 波單體（沿用核心，靠 hooks 切波）=====
  function startNormal(level, onFinish){
    var waves = U.buildNormalWavesForLevel(DEF.wavesTemplate, level);
    var total = waves.length, idx = 0;

    var scaledView = U.scaledRewardsForLevel(DEF.rewardsNormal, level);
    var dispRewards = Object.keys(scaledView).map(function(k){
      return { type:"text", key: k + " " + U.formatRange(scaledView[k]), qty: "" };
    });

    var countdownHooks = attachCountdownHooks(level, scaledView);

    var hooks = {
      onRender: function(){
        var el = document.getElementById("dun-result");
        if (el) el.textContent = "波次：" + (idx+1) + " / " + total + "（Lv."+level+"）";
        countdownHooks.onRender();
      },
      afterPlayerAct: function(o){ if (w.monsterHP <= 0 && idx < total-1){ idx++; o.ctx.api.setMonster(waves[idx].monster); } },
      afterMonsterAct:function(o){ if (w.monsterHP <= 0 && idx < total-1){ idx++; o.ctx.api.setMonster(waves[idx].monster); } },
      onTick: function(payload){ countdownHooks.onTick(payload); },
      onResult: countdownHooks.onResult
    };

    var first = waves[0];
    w.DungeonBattle?.start({
      title: DEF.name + "（普通）— " + first.label + "（Lv."+level+"）",
      monster: first.monster,
      timeLimitSec: DEF.timeLimitSec || 0,
      rewards: dispRewards,   // 只顯示範圍
      hooks: hooks,
      onFinish: function(res){ onFinish && onFinish(res.state); }
    });
  }

  // ===== 困難模式（暫以單體展示 + 倒數 + 入庫；你若已有 1v多核心，可在此替換）=====
  // ===== 困難模式：多波 1v多（同場多敵 + 逐波切換）=====
function startHard(level, onFinish){
  // 從設定檔把「每一波的敵人清單」取出並等級放大
  var wavesTpl = DEF.hardWavesTemplate || [];
  var waves = (wavesTpl.length ? wavesTpl : [{ enemies: (DEF.enemiesBase||[]) }]).map(function(w){
    var list = (U.buildHardEnemiesForWave ? U.buildHardEnemiesForWave(w.enemies, level)
                                          : (w.enemies||[]));
    // 包成可運行的實體
    return list.map(function(e){
      var ee = {
        name: e.name, atk: e.atk, def: e.def,
        hpMax: e.hp, hpCur: e.hp,
        ms: e.ms, aps: e.aps, speedPct: e.speedPct,
        acc: 0
      };
      ee.msEff = effectiveMsOfEnemy(ee);
      return ee;
    });
  });

  var total = waves.length;
  var wIdx  = 0;                   // 當前波
  var enemies = waves[wIdx];       // 目前這一波的敵人們
  var focus = firstAliveIndex(enemies);

  // 顯示用獎勵（區間）與倒數
  var scaledView = U.scaledRewardsForLevel(DEF.rewardsHard, level);
  var dispRewards = Object.keys(scaledView).map(function(k){
    return { type:"text", key: k + " " + U.formatRange(scaledView[k]), qty: "" };
  });
  var countdownHooks = attachCountdownHooks(level, scaledView);

  // --- UI：右側三條「行動速度」與下方血條清單 ---
  var speedPanelInited = false;
  var listInited = false;
  function renderSpeedPanel(){
    if (speedPanelInited) return;
    var rightBox = document.querySelector("#dun-card .dun-row .dun-box:nth-child(2)");
    if (!rightBox) return;
    var html = [
      '<div id="acc-hard-aps" style="margin-top:10px">',
      '<div><b>敵人行動速度</b></div>',
      enemies.map(function(e, i){
        var aps = (1000 / e.msEff).toFixed(2);
        return [
          '<div style="margin:6px 0">',
          e.name, '：<span id="acc-aps-',i,'">',aps,'</span> /s',
          '<div class="dun-bar"><i id="acc-cast-',i,'" style="display:block;height:8px;width:0;background:linear-gradient(90deg,#22d3ee,#2563eb)"></i></div>',
          '</div>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
    var box = document.createElement('div');
    box.innerHTML = html;
    rightBox.appendChild(box.firstChild);
    speedPanelInited = true;
  }
  function renderList(){
    if (listInited) return;
    var bd = document.querySelector("#dun-card .dun-bd");
    if (!bd) return;
    var wrap = document.createElement('div');
    wrap.id = "acc-hard-list-wrap";
    wrap.style.cssText = "border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px;font-size:12px;line-height:1.8";
    wrap.innerHTML = '<div style="font-weight:700;margin-bottom:6px">同場敵人（困難，第 '+(wIdx+1)+' / '+total+' 波）</div><div id="acc-hard-list"></div>';
    bd.appendChild(wrap);
    listInited = true;
  }
  function updateUIBars(){
    // 行動速度面板
    if (speedPanelInited){
      for (var i=0;i<enemies.length;i++){
        var e = enemies[i];
        var apsEl = document.getElementById("acc-aps-"+i);
        if (apsEl) apsEl.textContent = (1000 / e.msEff).toFixed(2);
        var castEl = document.getElementById("acc-cast-"+i);
        if (castEl) castEl.style.width = (Math.max(0, Math.min(1, e.acc / e.msEff)) * 100) + "%";
      }
    }
    // 下方 HP 清單
    var list = document.getElementById("acc-hard-list");
    if (list){
      list.innerHTML = enemies.map(function(e,i){
        var pct = Math.max(0, Math.min(100, Math.floor((e.hpCur/e.hpMax)*100)));
        var mark = (i===focus) ? "（目標）" : "";
        return [
          '<div style="margin:4px 0">',
          '<div><b>',e.name,'</b> ',mark,' — ATK ',e.atk.toLocaleString(),' / DEF ',e.def.toLocaleString(),
          ' / HP ',e.hpCur.toLocaleString(),' / ',e.hpMax.toLocaleString(),'</div>',
          '<div class="dun-bar"><i style="display:block;height:8px;width:',pct,'%;background:linear-gradient(90deg,#f59e0b,#ef4444)"></i></div>',
          '</div>'
        ].join('');
      }).join('');
    }
  }

  // --- 切下一波 ---
  function toNextWave(ctx){
    wIdx++;
    if (wIdx >= total){ ctx.finish("win"); return; }
    enemies = waves[wIdx];
    focus = firstAliveIndex(enemies);
    // 右側速度面板需要重建
    var p = document.getElementById("acc-hard-aps");
    if (p) p.remove();
    speedPanelInited = false;
    renderSpeedPanel(); // 會用新的 enemies 重建

    // 下方列表改標題
    var wrap = document.getElementById("acc-hard-list-wrap");
    if (wrap) wrap.querySelector("div").innerHTML = '同場敵人（困難，第 '+(wIdx+1)+' / '+total+' 波）';

    // 讓核心的怪永遠是超慢 dummy（避免核心出手），名稱同步當前 focus
    if (enemies[focus]){
      ctx.api.setMonster({ name: enemies[focus].name, atk: 0, def: enemies[focus].def, hp: enemies[focus].hpCur, ms: 99999999 });
    }
    updateUIBars();
  }

  var hooks = {
    onRender: function(){
      var el = document.getElementById("dun-result");
      if (el) el.textContent = "（困難）波次：" + (wIdx+1) + " / " + total + "（Lv."+level+"）";
      renderSpeedPanel();
      renderList();
      updateUIBars();
      countdownHooks.onRender();
      // 同步右上標題中的怪名
      if (enemies[focus] && window.currentMonster) window.currentMonster.name = enemies[focus].name;
    },

    // 玩家打到「當前目標」
    afterDamage: function({ctx, source, target, dmg}){
      if (source === "player" && target === "monster" && dmg > 0){
        if (focus === -1) return;
        var e = enemies[focus];
        e.hpCur = Math.max(0, e.hpCur - dmg);
        window.monsterHP = e.hpCur; // 讓核心面板 HP 跟著
        if (e.hpCur <= 0){
          focus = firstAliveIndex(enemies);
          if (focus === -1){ toNextWave(ctx); return; }
          var n = enemies[focus];
          ctx.api.setMonster({ name:n.name, atk:0, def:n.def, hp:n.hpCur, ms:99999999 });
        }
        updateUIBars();
      }
    },

    // 多敵各自行動
    onTick: function(payload){
      countdownHooks.onTick(payload);
      if (window.player && window.player.currentHP <= 0) return;
      var dt = payload.dt;
      for (var i=0;i<enemies.length;i++){
        var e = enemies[i]; if (e.hpCur <= 0) continue;
        e.acc += dt;
        while (e.acc >= e.msEff){
          e.acc -= e.msEff;
          var hit = calcEnemyHitToPlayer(e.atk);
          payload.ctx.api.dealDamageToPlayer(hit, { name: e.name });
          if (window.player && window.player.currentHP <= 0) return;
        }
      }
      updateUIBars();
    },

    onResult: countdownHooks.onResult
  };

  // 進戰鬥：核心怪用「超慢 Dummy」，真正攻擊由上面 onTick 執行
  var first = enemies[focus] || { name:"敵人", atk:1, def:0, hpCur:1 };
  w.DungeonBattle?.start({
    title: DEF.name + "（困難）— 第 1 波（Lv."+level+"）",
    monster: { name:first.name, atk:first.atk, def:first.def||0, hp:first.hpCur||1, ms:99999999 },
    timeLimitSec: DEF.timeLimitSec || 0,
    rewards: dispRewards,      // 顯示區間；實拿由 onResult 決定
    hooks: hooks,
    onFinish: function(res){ onFinish && onFinish(res.state); }
  });
}

  // ===== 掃蕩（75%）— 以「該模式的最高通關關卡」為準 =====
  function sweep(mode, level){
    var baseRewards = (mode==="hard") ? DEF.rewardsHard : DEF.rewardsNormal;
    var scaled = U.scaledRewardsForLevel(baseRewards, level);
    var got = {};
    Object.keys(scaled || {}).forEach(function(k){
      var r = scaled[k]; if (!r) return;
      var a = r[0], b = r[1];
      var roll = Math.floor(Math.random()*(b-a+1))+a;
      // 以玩家體感為主：75% 後至少給 1（只要原本有機會掉 >0）
var qty = Math.max(1, Math.floor(roll * 0.75));

      if (k==="金幣"||k==="gold"){ w.player.gold=(w.player.gold||0)+qty; got["金幣"]=(got["金幣"]||0)+qty; return; }
      if (k==="強化石"||k==="stone"){ w.player.stone=(w.player.stone||0)+qty; got["強化石"]=(got["強化石"]||0)+qty; return; }

      if (typeof w.addItem==="function") w.addItem(k, qty);
      else {
        w.player._bag = w.player._bag||{};
        w.player._bag[k]=(w.player._bag[k]||0)+qty;
      }
      got[k]=(got[k]||0)+qty;
    });
    w.updateResourceUI?.();
    return got;
  }

  // ===== 對外 =====
  w.ACC_Core = {
    startNormal: startNormal,
    startHard:   startHard,
    sweep:       sweep,
    grantRewardsAuto: grantRewardsAuto
  };
})(window);