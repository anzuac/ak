// dungeon/challenge_accessory_core.js — 多體副本核心引擎（含倒數秒數 + 多體 UI；不依賴全域 DEF）
(function (w) {
  "use strict";

  // ===== 輔助工具 =====
  function effectiveMsOfEnemy(e){
    if (isFinite(e.ms) && e.ms > 0) return Math.max(10, Math.floor(e.ms));
    if (isFinite(e.aps) && e.aps > 0) return Math.max(10, Math.floor(1000 / e.aps));
    if (isFinite(e.speedPct) && e.speedPct > 0) return Math.max(10, Math.floor(2000 / e.speedPct));
    return 2000;
  }
  function jitterMul(){ var p=Number(w.DAMAGE_JITTER_PCT); p=(p>=0&&p<=1)?p:0.12; return (1-p)+Math.random()*(2*p); }
  function calcEnemyHitToPlayer(atk){
    var def=Number(w.player?.totalStats?.def||0);
    var base=Math.max(1, Math.floor(atk-def));
    return Math.max(1, Math.floor(base*jitterMul()));
  }
  function firstAliveIndex(arr){ for (var i=0;i<arr.length;i++){ if (arr[i].hpCur>0) return i; } return -1; }

  // 倒數：顯示在 #dun-card .dun-hd .muted
  function attachCountdownHooks(def){
    var remainMs = (Number(def.timeLimitSec)||0) * 1000;
    var lastShown = -1;
    return {
      onRender: function(){
        if (!remainMs) return;
        var hdMuted = document.querySelector("#dun-card .dun-hd .muted");
        if (hdMuted) {
          var s = Math.ceil(remainMs/1000);
          hdMuted.textContent = "剩餘：" + s + "s";
          lastShown = s;
        }
      },
      onTick: function({dt, ctx}){
        if (!remainMs) return;
        remainMs = Math.max(0, remainMs - dt);
        var s = Math.ceil(remainMs/1000);
        if (s !== lastShown){
          var hdMuted = document.querySelector("#dun-card .dun-hd .muted");
          if (hdMuted) hdMuted.textContent = "剩餘：" + s + "s";
          lastShown = s;
        }
        if (remainMs <= 0){
          ctx.finish?.("timeout");
        }
      }
    };
  }

  // 入庫（任何鍵進背包；金幣/強化石走資源）
  function grantRewardsAuto(resultR){
    var got = {};
    function roll(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
    Object.keys(resultR || {}).forEach(function(key){
      var r = resultR[key]; if (!Array.isArray(r) || r.length < 2) return;
      var n = roll(r[0], r[1]); if (n <= 0) return;

      if (key === "金幣" || key === "gold"){ w.player.gold=(w.player.gold||0)+n; got["金幣"]=(got["金幣"]||0)+n; return; }
      if (key === "強化石" || key === "stone"){ w.player.stone=(w.player.stone||0)+n; got["強化石"]=(got["強化石"]||0)+n; return; }

      if (typeof w.addItem === "function") w.addItem(key, n);
      else { w.player._bag=w.player._bag||{}; w.player._bag[key]=(w.player._bag[key]||0)+n; }
      got[key]=(got[key]||0)+n;
    });
    w.updateResourceUI?.();
    return got;
  }

  // 顯示「本次實拿」
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

  // ===== 普通模式：單體多波 =====
  function startNormal(def, utils, level, onFinish){
    var waves = utils.buildNormalWavesForLevel(def.wavesTemplate, level);
    var total = waves.length, idx = 0;

    var scaledView = utils.scaledRewardsForLevel(def.rewardsNormal, level);
    var dispRewards = Object.keys(scaledView||{}).map(function(k){
      return { type:"text", key: k + " " + utils.formatRange(scaledView[k]), qty: "" };
    });

    var cd = attachCountdownHooks(def);

    var hooks = {
      onRender: function(){
        var el = document.getElementById("dun-result");
        if (el) el.textContent = "波次：" + (idx+1) + " / " + total + "（Lv."+level+"）";
        cd.onRender();
      },
      afterPlayerAct: function(o){ if (w.monsterHP <= 0 && idx < total-1){ idx++; o.ctx.api.setMonster(waves[idx].monster); } },
      afterMonsterAct:function(o){ if (w.monsterHP <= 0 && idx < total-1){ idx++; o.ctx.api.setMonster(waves[idx].monster); } },
      onTick: function(payload){ cd.onTick(payload); },
      onResult: function(o){
        if (o.state === "win"){
          var got = grantRewardsAuto(scaledView);
          renderGotRewards(got);
        }
      }
    };

    var first = waves[0];
    w.DungeonBattle?.start({
      title: def.name + "（普通）— " + first.label + "（Lv."+level+"）",
      monster: first.monster,
      timeLimitSec: def.timeLimitSec || 0,
      rewards: dispRewards,
      hooks: hooks,
      onFinish: function(res){ onFinish && onFinish(res.state); }
    });
  }

  // ===== 困難 / 地獄：多體無上限（逐波）=====
  function startMulti(def, utils, level, rewardView, titleSuffix, onFinish){
    var wavesTpl = def.hardWavesTemplate || [];
    var waves = (wavesTpl.length ? wavesTpl : [{ enemies: (def.enemiesBase||[]) }]).map(function(w){
      var list = (utils.buildHardEnemiesForWave ? utils.buildHardEnemiesForWave(w.enemies, level)
                                                : (w.enemies||[]));
      return list.map(function(e){
        var ee={ name:e.name, atk:e.atk, def:e.def, hpMax:e.hp, hpCur:e.hp, ms:e.ms, aps:e.aps, speedPct:e.speedPct, acc:0 };
        ee.msEff = effectiveMsOfEnemy(ee);
        return ee;
      });
    });

    var total = waves.length;
    var wIdx  = 0;
    var enemies = waves[wIdx];
    var focus = firstAliveIndex(enemies);
    var cd = attachCountdownHooks(def);

    var dispRewards = Object.keys(rewardView||{}).map(function(k){
      return { type:"text", key: k + " " + utils.formatRange(rewardView[k]), qty: "" };
    });

    var speedPanelInited=false, listInited=false;
    function renderSpeedPanel(){
      if (speedPanelInited) return;
      var rightBox=document.querySelector("#dun-card .dun-row .dun-box:nth-child(2)");
      if (!rightBox) return;
      var html=[
        '<div id="acc-hard-aps" style="margin-top:10px">',
        '<div><b>敵人行動速度</b></div>',
        enemies.map(function(e,i){
          var aps=(1000/e.msEff).toFixed(2);
          return [
            '<div style="margin:6px 0">',
            e.name,'：<span id="acc-aps-',i,'">',aps,'</span> /s',
            '<div class="dun-bar"><i id="acc-cast-',i,'" style="display:block;height:8px;width:0;background:linear-gradient(90deg,#22d3ee,#2563eb)"></i></div>',
            '</div>'
          ].join('');
        }).join(''),
        '</div>'
      ].join('');
      var box=document.createElement('div'); box.innerHTML=html;
      rightBox.appendChild(box.firstChild);
      speedPanelInited=true;
    }
    function renderList(){
      if (listInited) return;
      var bd=document.querySelector("#dun-card .dun-bd");
      if(!bd) return;
      var wrap=document.createElement('div');
      wrap.id="acc-hard-list-wrap";
      wrap.style.cssText="border:1px solid #2b344a;background:#0b1220;border-radius:10px;padding:10px;font-size:12px;line-height:1.8";
      wrap.innerHTML='<div id="acc-hard-title" style="font-weight:700;margin-bottom:6px">同場敵人（第 '+(wIdx+1)+' / '+total+' 波）</div><div id="acc-hard-list"></div>';
      bd.appendChild(wrap);
      listInited=true;
    }
    function updateUIBars(){
      if (speedPanelInited){
        for (var i=0;i<enemies.length;i++){
          var e=enemies[i];
          var apsEl=document.getElementById("acc-aps-"+i);
          if (apsEl) apsEl.textContent=(1000/e.msEff).toFixed(2);
          var castEl=document.getElementById("acc-cast-"+i);
          if (castEl) castEl.style.width=(Math.max(0,Math.min(1,e.acc/e.msEff))*100)+"%";
        }
      }
      var list=document.getElementById("acc-hard-list");
      if (list){
        list.innerHTML=enemies.map(function(e,i){
          var pct=Math.max(0, Math.min(100, Math.floor((e.hpCur/e.hpMax)*100)));
          var mark=(i===focus)?"（目標）":"";
          return [
            '<div style="margin:4px 0">',
            '<div><b>',e.name||"敵人",'</b> ',mark,' — ATK ',(e.atk||0).toLocaleString(),' / DEF ',(e.def||0).toLocaleString(),
            ' / HP ',(e.hpCur||0).toLocaleString(),' / ',(e.hpMax||0).toLocaleString(),'</div>',
            '<div class="dun-bar"><i style="display:block;height:8px;width:',pct,'%;background:linear-gradient(90deg,#f59e0b,#ef4444)"></i></div>',
            '</div>'
          ].join('');
        }).join('');
      }
      var tEl=document.getElementById("acc-hard-title"); if (tEl) tEl.textContent='同場敵人（第 '+(wIdx+1)+' / '+total+' 波）';
    }
    function toNextWave(ctx){
      wIdx++;
      if (wIdx >= total){ ctx.finish("win"); return; }
      enemies = waves[wIdx];
      focus = firstAliveIndex(enemies);
      var p=document.getElementById("acc-hard-aps"); if (p) p.remove(); speedPanelInited=false;
      renderSpeedPanel();
      if (enemies[focus]){
        ctx.api.setMonster({ name: enemies[focus].name, atk: enemies[focus].atk, def: enemies[focus].def, hp: enemies[focus].hpCur, ms: 99999999 });
      }
      updateUIBars();
    }

    var hooks = {
      onRender: function(){
        var el = document.getElementById("dun-result");
        if (el) el.textContent = "波次：" + (wIdx+1) + " / " + total + "（Lv."+level+"）";
        renderSpeedPanel();
        renderList();
        updateUIBars();
        cd.onRender();
        if (enemies[focus] && w.currentMonster) w.currentMonster.name = enemies[focus].name;
      },
      afterDamage: function({ctx, source, target, dmg}){
        if (source === "player" && target === "monster" && dmg > 0){
          if (focus === -1) return;
          var e = enemies[focus];
          e.hpCur = Math.max(0, e.hpCur - dmg);
          w.monsterHP = e.hpCur;
          if (e.hpCur <= 0){
            focus = firstAliveIndex(enemies);
            if (focus === -1){ toNextWave(ctx); return; }
            var n = enemies[focus];
            ctx.api.setMonster({ name:n.name, atk:0, def:n.def, hp:n.hpCur, ms:99999999 });
          }
          updateUIBars();
        }
      },
      onTick: function(payload){
        cd.onTick(payload);
        var ctx = payload.ctx, dt = payload.dt;
        if (w.player && w.player.currentHP<=0) return;
        for (var i=0;i<enemies.length;i++){
          var e=enemies[i]; if (e.hpCur<=0) continue;
          e.acc += dt;
          while (e.acc >= e.msEff){
            e.acc -= e.msEff;
            var hit=calcEnemyHitToPlayer(e.atk);
            ctx.api.dealDamageToPlayer(hit, { name:e.name });
            if (w.player && w.player.currentHP<=0) return;
          }
        }
        updateUIBars();
      },
      onResult: function(o){
        if (o.state === "win"){
          var got = grantRewardsAuto(rewardView);
          renderGotRewards(got);
        }
      }
    };

    var first=enemies[focus] || { name:"敵人", atk:0, def:0, hpCur:1 };
    w.DungeonBattle?.start({
      title: def.name + titleSuffix + "（Lv."+level+"）",
      monster: { name:first.name, atk:first.atk, def:first.def||0, hp:first.hpCur||1, ms: 99999999 },
      timeLimitSec: def.timeLimitSec || 0,
      rewards: dispRewards,
      hooks: hooks,
      onFinish: function(res){ onFinish && onFinish(res.state); }
    });
  }

  function startHard(def, utils, level, onFinish){
    var rewardView = utils.scaledRewardsForLevel(def.rewardsHard, level);
    startMulti(def, utils, level, rewardView, "（困難）— 第 1 波", onFinish);
  }
  function startHell(def, utils, level, onFinish){
    var rewardView = utils.scaledRewardsForLevel((def.rewardsHell||def.rewardsHard||{}), level);
    startMulti(def, utils, level, rewardView, "（地獄）— 第 1 波", onFinish);
  }

  // 掃蕩（×0.75）
  function sweep(def, utils, mode, level){
    var baseRewards = (mode==="hard"||mode==="hell") ? (def.rewardsHard || def.rewardsHell) : def.rewardsNormal;
    var scaled = utils.scaledRewardsForLevel(baseRewards||{}, level);
    var got = {};
    Object.keys(scaled || {}).forEach(function(k){
      var r = scaled[k]; if (!r) return;
      var a = r[0], b = r[1];
      var roll = Math.floor(Math.random()*(b-a+1))+a;
      var qty = Math.max(1, Math.floor(roll * 0.75));
      if (k==="金幣"||k==="gold"){ w.player.gold=(w.player.gold||0)+qty; got["金幣"]=(got["金幣"]||0)+qty; return; }
      if (k==="強化石"||k==="stone"){ w.player.stone=(w.player.stone||0)+qty; got["強化石"]=(got["強化石"]||0)+qty; return; }
      if (typeof w.addItem==="function") w.addItem(k, qty);
      else { w.player._bag = w.player._bag||{}; w.player._bag[k]=(w.player._bag[k]||0)+qty; }
      got[k]=(got[k]||0)+qty;
    });
    w.updateResourceUI?.();
    return got;
  }

  // ===== 對外 =====
  w.ACC_Core = {
    startNormal,
    startHard,
    startHell,
    sweep,
    grantRewardsAuto
  };
})(window);