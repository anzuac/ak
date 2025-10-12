// dungeon_battle_core.js (RT/即時制最終版 + 通用 Hooks/Plugins)
// 依賴：player、Rpg_玩家.actOnce()、updateResourceUI?、DungeonBattleLog.append?
// 可讀：window.DAMAGE_JITTER_PCT；玩家攻速沿用主系統；怪物可由副本配置 ms/aps/speedPct 覆寫
// 目標：零行為變更；提供未來多怪/召喚/車輪戰等擴充接口

(function (w) {
  "use strict";

  // ====== 公用（全域插件註冊）======
  // 外部可：window.DungeonBattlePlugins.push({ onTick(ctx){...}, afterMonsterAct({ctx,dmg}){...} })
  w.DungeonBattlePlugins = Array.isArray(w.DungeonBattlePlugins) ? w.DungeonBattlePlugins : [];

  // ===== 小工具 =====
  function $(id){ return document.getElementById(id); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function log(msg){
    if (!msg) return;
    if (w.DungeonBattleLog && typeof w.DungeonBattleLog.append === "function") {
      try { w.DungeonBattleLog.append(msg); } catch(_){}
    } else {
      var box = $("dun-log");
      if (!box) return;
      var row = document.createElement("div");
      row.className = "row";
      row.textContent = msg;
      box.appendChild(row);
      box.scrollTop = box.scrollHeight;
    }
  }
  function safeCall(fn, arg){ try { return fn && fn(arg); } catch(_){ /*吞錯*/ } }

  // 同步主戰鬥的末端傷害浮動
  function getJitterPct(){
    var p = Number(w.DAMAGE_JITTER_PCT);
    return (p >= 0 && p <= 1) ? p : 0.12;
  }
  function applyVariance(dmg){
    if (!(dmg>0)) return 0;
    var mul = (1 - getJitterPct()) + Math.random() * (2 * getJitterPct());
    return Math.max(0, Math.floor(dmg * mul));
  }

  // ===== 世界快照（入場/還原）=====
  function snapshotWorld(){
    return {
      hp: w.player?.currentHP,
      mp: w.player?.currentMP,
      curMon: w.currentMonster,
      monHP: w.monsterHP,
      gameMode: w.GAME_MODE
    };
  }
  function restoreWorld(snap){
    if (!snap) return;
    if (w.player){
      w.player.currentHP = snap.hp;
      w.player.currentMP = snap.mp;
    }
    w.currentMonster = snap.curMon;
    w.monsterHP = snap.monHP;
    w.GAME_MODE = snap.gameMode || "world";
    w.updateResourceUI?.();
  }

  // ===== UI =====
  function ensureStyle(){
    if ($("dun-style")) return;
    var s = document.createElement("style");
    s.id = "dun-style";
    s.textContent = `
      .dun-wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:99999}
      .dun-card{width:min(560px,96vw);background:#111827;color:#e5e7eb;border:1px solid #334155;border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.5);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;display:flex;flex-direction:column;max-height:92vh}
      .dun-hd{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#0f172a;border-bottom:1px solid #334155;border-radius:12px 12px 0 0;font-weight:800}
      .dun-bd{padding:12px;display:grid;gap:10px;overflow:auto}
      .dun-row{display:flex;justify-content:space-between;gap:8px}
      .dun-box{border:1px solid #304256;background:#0b1220;border-radius:10px;padding:10px;flex:1}
      .dun-stat{font-size:13px;line-height:1.6}
      .dun-bar{height:8px;background:#1f2937;border-radius:999px;overflow:hidden;margin-top:6px}
      .dun-bar > i{display:block;height:100%;width:0;background:linear-gradient(90deg,#22d3ee,#2563eb)}
      .dun-aps{font-size:12px;opacity:.8;margin-left:.5em}
      .dun-log{border:1px solid #283245;background:#0a1220;border-radius:8px;padding:8px;font-size:12px;height:110px;overflow:auto}
      .dun-ft{padding:10px 12px;border-top:1px solid #334155;display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
      .dun-btn{background:#374151;color:#fff;border:0;padding:8px 10px;border-radius:8px;cursor:pointer}
      .dun-btn.primary{background:#2563eb}
      .dun-result{font-weight:700;min-height:24px}
      .dun-rewards{font-size:12px;opacity:.95;margin-top:4px}
      .dun-rewards ul{margin:4px 0 0 1em;padding:0}
      .muted{opacity:.8;font-size:12px}
    `;
    document.head.appendChild(s);
  }

  function openUI(ctx){
    ensureStyle();
    closeUI();

    var wrap = document.createElement("div");
    wrap.id = "dun-wrap"; wrap.className = "dun-wrap";
    wrap.innerHTML = `
      <div class="dun-card" id="dun-card">
        <div class="dun-hd">
          <div>${ctx.title || "副本戰鬥"}</div>
          <div class="muted">${ctx.timeLimitSec>0?("限時 "+ctx.timeLimitSec+"s"):"即時自動戰鬥"}</div>
        </div>
        <div class="dun-bd">
          <div class="dun-row">
            <div class="dun-box">
              <div><b>玩家</b><span id="dun-p-aps" class="dun-aps">0/s</span></div>
              <div class="dun-stat">ATK：<span id="dun-atk">-</span></div>
              <div class="dun-stat">DEF：<span id="dun-def">-</span></div>
              <div class="dun-stat">HP：<span id="dun-php">-</span> / <span id="dun-phpmax">-</span></div>
              <div class="dun-bar"><i id="dun-phpbar"></i></div>
              <div class="dun-stat" style="margin-top:6px;">MP：<span id="dun-pmp">-</span> / <span id="dun-pmpmax">-</span></div>
              <div class="dun-bar"><i id="dun-pmpbar"></i></div>
              <div class="dun-stat" style="margin-top:8px;">出手進度</div>
              <div class="dun-bar"><i id="dun-pcast"></i></div>
            </div>
            <div class="dun-box">
              <div><b id="dun-mname">敵人</b><span id="dun-m-aps" class="dun-aps">0/s</span></div>
              <div class="dun-stat">ATK：<span id="dun-matk">-</span></div>
              <div class="dun-stat">DEF：<span id="dun-mdef">-</span></div>
              <div class="dun-stat">HP：<span id="dun-mhp">-</span> / <span id="dun-mhpmax">-</span></div>
              <div class="dun-bar"><i id="dun-mhpbar"></i></div>
              <div class="dun-stat" style="margin-top:8px;">出手進度</div>
              <div class="dun-bar"><i id="dun-mcast"></i></div>
            </div>
          </div>
          <div class="dun-log" id="dun-log"></div>
        </div>
        <div class="dun-ft">
          <div>
            <div id="dun-result" class="dun-result"></div>
            <div id="dun-rewards" class="dun-rewards" style="display:none"></div>
          </div>
          <div>
            <button class="dun-btn" id="dun-btn-escape">逃離</button>
            <button class="dun-btn primary" id="dun-btn-close" style="display:none">返回</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    $("dun-btn-escape").onclick = function(){ ctx.finish("escape"); };
    $("dun-btn-close").onclick  = function(){ ctx.finish(ctx.__finishState || "escape"); };
    renderUI(ctx, 0, 0); // 初次
  }

  function closeUI(){ $("dun-wrap")?.remove(); }

  function renderUI(ctx, pProg, mProg){
    var t = w.player?.totalStats || {};
    // player
    $("dun-atk").textContent = fmt(t.atk);
    $("dun-def").textContent = fmt(t.def);
    $("dun-php").textContent = fmt(w.player?.currentHP||0);
    $("dun-phpmax").textContent = fmt(t.hp||1);
    $("dun-pmp").textContent = fmt(w.player?.currentMP||0);
    $("dun-pmpmax").textContent = fmt(t.mp||1);
    var phpPct = clamp(((w.player?.currentHP||0)/(t.hp||1))*100,0,100);
    var pmpPct = clamp(((w.player?.currentMP||0)/(t.mp||1))*100,0,100);
    $("dun-phpbar").style.width = phpPct + "%";
    $("dun-pmpbar").style.width = pmpPct + "%";
    $("dun-pcast").style.width = clamp(pProg*100,0,100) + "%";

// monster
var m = w.currentMonster || {};
$("dun-mname").textContent = m.name || "敵人";
$("dun-matk").textContent = fmt(m.atk || 0);
$("dun-mdef").textContent = fmt(m.def || 0);

// ★ 目前血量：至少 0
const mHP = Math.max(0, Number(w.monsterHP) || 0);

// ★ 最大血量：優先用本場快照的 ctx.monster.hp，並強制 ≥ 1
const mHpMax = Math.max(1, Number((ctx && ctx.monster && ctx.monster.hp) ?? m.hp) || 1);

$("dun-mhp").textContent = fmt(mHP);
$("dun-mhpmax").textContent = fmt(mHpMax);

const mhpPct = clamp((mHP / mHpMax) * 100, 0, 100);
$("dun-mhpbar").style.width = mhpPct + "%";
$("dun-mcast").style.width = clamp(mProg * 100, 0, 100) + "%";

// 自訂 HUD 機會
broadcast(ctx, "onRender", { ctx, pProg, mProg });
  }

  function setAPS(pAPS, mAPS){
    var p = $("dun-p-aps"), m = $("dun-m-aps");
    if (p) p.textContent = (pAPS>0 ? pAPS.toFixed(2) : 0) + "/s";
    if (m) m.textContent = (mAPS>0 ? mAPS.toFixed(2) : 0) + "/s";
  }

  // ===== Plugin / Hook 呼叫器 =====
  function broadcast(ctx, hook, payload){
    // 先 per-instance hooks，再全域 plugins（兩者都可共存）
    safeCall(ctx._hooks && ctx._hooks[hook], payload);
    for (var i=0;i<ctx._plugins.length;i++){
      var p = ctx._plugins[i];
      safeCall(p && p[hook], payload);
    }
  }

  // ===== 核心 Context（即時制）=====
  function DungeonCtx(cfg){
    this.title = cfg.title || "副本戰鬥";
    this.monster = {
      name: cfg.monster?.name || "BOSS",
      atk:  Math.max(1, Math.floor(cfg.monster?.atk || 1)),
      def:  Math.max(0, Math.floor(cfg.monster?.def || 0)),
      hp:   Math.max(1, Math.floor(cfg.monster?.hp  || 1)),
      shield: 0,
      // 副本可指定速度（任一種）
      ms:       Number(cfg.monster?.ms),
      aps:      Number(cfg.monster?.aps),
      speedPct: Number(cfg.monster?.speedPct)
    };
    this.rewards = Array.isArray(cfg.rewards) ? cfg.rewards.slice() : [];
    this.timeLimitSec = Math.max(0, Math.floor(cfg.timeLimitSec || 0));
    this.onFinish = typeof cfg.onFinish === "function" ? cfg.onFinish : function(){};

    // ★ 擴充介面：單次 hooks、全域 plugins、副本自訂暫存、通用 state
    this._hooks    = cfg.hooks || {};                 // ex: {afterMonsterAct(){...}}
    this._plugins  = w.DungeonBattlePlugins.slice();  // 快照目前所有全域插件
    this.extra     = cfg.extra || {};                 // 你要塞啥都行
    this.state     = { allies: [], enemies: [] };     // 多戰鬥/召喚可用（預設不動既有）

    // rAF 狀態
    this.snap = null;
    this._on = false;
    this._last = 0;
    this._accP = 0; this._accM = 0; this._accUI = 0;
    this.playerMs = 1000;
    this.monsterMs = 1200;
    this.startTs = 0;
    this.dead = false;
    this.__finishState = null;
    this._printedFinish = false;

    // 對外小工具（給 hooks/plugins 用）
    var self = this;
    this.api = {
      log,
      end: function(s){ self.finish(s); },
      setMonster: function(mcfg){
        // 切到新怪（波次/車輪戰用），保留同一場戰鬥 UI 與 loop
        mcfg = mcfg || {};
        self.monster = {
          name: mcfg.name || "BOSS",
          atk:  Math.max(1, Math.floor(mcfg.atk || 1)),
          def:  Math.max(0, Math.floor(mcfg.def || 0)),
          hp:   Math.max(1, Math.floor(mcfg.hp  || 1)),
          shield: 0,
          ms: Number(mcfg.ms), aps: Number(mcfg.aps), speedPct: Number(mcfg.speedPct)
        };
        w.currentMonster = { name:self.monster.name, atk:self.monster.atk, def:self.monster.def, hp:self.monster.hp, shield:0 };
        w.monsterHP = self.monster.hp;
        self._accM = 0; // 重置出手累積
        broadcast(self, "onSwitchMonster", { ctx:self });
      },
      dealDamageToPlayer: function(amount, meta){
        amount = Math.max(0, Math.floor(amount||0));
        if (!w.player) return 0;
        var dmg = amount;
        var msPct = (typeof w.getMagicShieldPercent === "function") ? w.getMagicShieldPercent() : 0;
        var absorb = 0;
        if (msPct > 0) { absorb = Math.floor(dmg * msPct); dmg -= absorb; }
        w.player.currentHP = Math.max(0, w.player.currentHP - dmg);
        if (meta && meta.silent !== true) {
          log(absorb>0
            ? `${meta.name||"敵人"} 造成 ${dmg} 傷害（魔力盾吸收 ${absorb}）`
            : `${meta.name||"敵人"} 造成 ${dmg} 傷害`);
        }
        broadcast(self, "afterDamage", { ctx:self, source:meta?.source||"plugin", target:"player", dmg, absorb, meta });
        return dmg;
      },
      dealDamageToMonster: function(amount, meta){
        amount = Math.max(0, Math.floor(amount||0));
        if (!(w.monsterHP > 0)) return 0;
        var before = w.monsterHP;
        w.monsterHP = Math.max(0, w.monsterHP - amount);
        var dealt = Math.max(0, before - w.monsterHP);
        if (meta && meta.silent !== true) {
          log(`${meta.name||"你"} 對 ${self.monster.name} 造成 ${dealt} 傷害`);
        }
        broadcast(self, "afterDamage", { ctx:self, source:meta?.source||"plugin", target:"monster", dmg:dealt, meta });
        return dealt;
      },
      healPlayer: function(amount){
        if (!w.player) return 0;
        var max = (w.player.totalStats?.hp || 1);
        var before = w.player.currentHP||0;
        w.player.currentHP = Math.min(max, Math.max(0, before + Math.floor(amount||0)));
        return w.player.currentHP - before;
      },
      healMonster: function(amount){
        var max = self.monster.hp||1;
        var before = w.monsterHP||0;
        w.monsterHP = Math.min(max, Math.max(0, before + Math.floor(amount||0)));
        return w.monsterHP - before;
      },
      getAPS: function(){ return { player: 1000/self.playerMs, monster: 1000/self.monsterMs }; }
    };
  }

  // 取得玩家攻速（原樣，不動）
  function getPlayerMsRT(){
    if (w.RT && Number(w.RT.playerActMs) > 0) return Math.max(10, Math.floor(w.RT.playerActMs));
    var BASE = 2000; // 與主系統一致
    var aspd = 1;
    if (w.player && player.totalStats) {
      var raw = Number(player.totalStats.attackSpeedPct);
      aspd = (isFinite(raw) && raw > 0) ? raw : 1;
    }
    return Math.max(10, Math.round(BASE / aspd));
  }

  // 怪物攻速：優先副本設定，其次 RT，最後 BASE
  var BASE_MS = 2000;
  function getMonsterMsRT_ctx(ctx){
    if (isFinite(ctx.monster.ms) && ctx.monster.ms > 0)   return Math.max(10, Math.floor(ctx.monster.ms));
    if (isFinite(ctx.monster.aps) && ctx.monster.aps > 0) return Math.max(10, Math.floor(1000 / ctx.monster.aps));
    if (isFinite(ctx.monster.speedPct) && ctx.monster.speedPct > 0)
      return Math.max(10, Math.floor(BASE_MS / ctx.monster.speedPct));
    if (w.RT && Number(w.RT.monsterActMs) > 0) return Math.max(10, Math.floor(w.RT.monsterActMs));
    return BASE_MS;
  }

  DungeonCtx.prototype._recalcMs = function(){
    var pOld = this.playerMs, mOld = this.monsterMs;
    this.playerMs  = getPlayerMsRT();
    this.monsterMs = getMonsterMsRT_ctx(this);
    if (this.playerMs !== pOld || this.monsterMs !== mOld) {
      broadcast(this, "onSpeedRecalc", { ctx:this, playerMs:this.playerMs, monsterMs:this.monsterMs });
    }
  };

  DungeonCtx.prototype.begin = function(){
    this.snap = snapshotWorld();

    // 建立本地怪到全域（沿用 actOnce IO）
    w.currentMonster = { name:this.monster.name, atk:this.monster.atk, def:this.monster.def, hp:this.monster.hp, shield:0 };
    w.monsterHP = this.monster.hp;

    // 切模式
    w.GAME_MODE = "dungeon";

    // Hook：開始前
    broadcast(this, "beforeBegin", { ctx:this });

    // 開窗
    openUI(this);
    this.startTs = Date.now();
    this._on = true; this._last = 0;
    this._accP = this._accM = this._accUI = 0;

    // 初始顯示
    this._recalcMs();
    setAPS(1000/this.playerMs, 1000/this.monsterMs);

    // Hook：開始後
    broadcast(this, "afterBegin", { ctx:this });

    // 起跑
    var self = this;
    function _raf(ts){
      if (!self._on) return;
      if (self._last === 0) self._last = ts;
      var dt = ts - self._last; self._last = ts;

      // 每幀重算攻速 + UI 顯示
      self._recalcMs();
      self._accUI += dt;
      if (self._accUI >= 100) {
        setAPS(1000/self.playerMs, 1000/self.monsterMs);
        self._accUI = 0;
      }

      // 出手累積
      self._accP += dt;
      self._accM += dt;

      // 進度條
      renderUI(self, self._accP / self.playerMs, self._accM / self.monsterMs);

      // 限時
      if (self.timeLimitSec > 0) {
        var elp = Math.floor((Date.now() - self.startTs) / 1000);
        if (elp >= self.timeLimitSec) return self.finish("escape");
      }

      // 每拍 Hook
      broadcast(self, "onTick", { ctx:self, dt });

      // —— 玩家出手（沿用 actOnce，不改你主系統）——
      while (self._accP >= self.playerMs) {
        self._accP -= self.playerMs;

        broadcast(self, "beforePlayerAct", { ctx:self });

        var beforeHP = w.monsterHP;
        if (w.Rpg_玩家 && typeof w.Rpg_玩家.actOnce === "function") {
          try {
            var r = w.Rpg_玩家.actOnce();
            // 讓外部知道主系統如何描述這一拍（爆擊/閃避/技能）
            if (r && r.text) log("你 " + r.text);
            broadcast(self, "afterPlayerAct", { ctx:self, result:r });
          } catch(_) {}
        }

        // 推導玩家造成的實際傷害（方便外掛做特效/連鎖等）
        var dealt = Math.max(0, (beforeHP||0) - Math.max(0, w.monsterHP||0));
        if (dealt > 0) {
          broadcast(self, "afterDamage", { ctx:self, source:"player", target:"monster", dmg:dealt, meta:{ from:"actOnce" } });
        }

        if (w.monsterHP <= 0 || w.player?.currentHP <= 0) break;
      }

      // —— 怪物出手（DEF 抵減 + 末端浮動 + 魔力盾吸收）——
      while (self._accM >= self.monsterMs) {
        self._accM -= self.monsterMs;
        if (w.player && w.currentMonster && w.monsterHP > 0 && w.player.currentHP > 0) {
          broadcast(self, "beforeMonsterAct", { ctx:self });

          var base = Math.max(self.monster.atk - (w.player.totalStats?.def || 0), 1);
          var dmg0 = applyVariance(base);
          var msPct = (typeof w.getMagicShieldPercent === "function") ? w.getMagicShieldPercent() : 0;
          var absorb = 0, dmg = dmg0;
          if (msPct > 0) { absorb = Math.floor(dmg * msPct); dmg -= absorb; }
          w.player.currentHP = Math.max(0, w.player.currentHP - dmg);

          log(absorb>0
              ? `${self.monster.name} 造成 ${dmg} 傷害（魔力盾吸收 ${absorb}）`
              : `${self.monster.name} 造成 ${dmg} 傷害`);

          broadcast(self, "afterMonsterAct", { ctx:self, dmg, absorb });
          broadcast(self, "afterDamage", { ctx:self, source:"monster", target:"player", dmg, absorb, meta:{ from:"monsterBasic" } });
        }
        if (w.monsterHP <= 0 || w.player?.currentHP <= 0) break;
      }

     // 勝負檢查（先把過殺拉回 0）
w.monsterHP = Math.max(0, w.monsterHP || 0);
if (w.monsterHP <= 0) return self.finish("win");
if (w.player?.currentHP <= 0) return self.finish("lose");

      // 更新資源UI
      w.updateResourceUI?.();

      requestAnimationFrame(_raf);
    }
    requestAnimationFrame(_raf);
  };

  DungeonCtx.prototype.finish = function(state){
    if (this.dead) return;
    this.dead = true;
    this._on = false;
    this.__finishState = state;
// 保險：把負血拉回 0，並刷新一次 UI（畫面會是 0 / Max）
w.monsterHP = Math.max(0, w.monsterHP || 0);
try { renderUI(this, this._accP / this.playerMs, this._accM / this.monsterMs); } catch(_) {}
    broadcast(this, "onResult", { ctx:this, state });
// 強制最終刷新，讓怪物血量顯示為 0 / 最大值
try {
  renderUI(this, this._accP / this.playerMs, this._accM / this.monsterMs);
} catch(_) {}


    var res = $("dun-result");
    var rw  = $("dun-rewards");
    if (res && !this._printedFinish) {
      this._printedFinish = true;
      res.textContent = state === "win" ? "🏆 戰鬥勝利！" :
                        state === "lose" ? "💀 戰鬥失敗" : "↩️ 已退出副本";
      if (state === "win" && this.rewards.length && rw) {}
      $("dun-btn-escape").style.display = "none";
      $("dun-btn-close").style.display = "inline-block";
    }

    // 戰報補一句
    if (state === "win") log("🏆 戰鬥勝利！");
    else if (state === "lose") log("💀 你被擊敗了。");
    else log("↩️ 你已退出副本。");

    var self = this;
    $("dun-btn-close").onclick = function(){
      broadcast(self, "beforeRestore", { ctx:self, state });
      closeUI();
      restoreWorld(self.snap);
      w.updateResourceUI?.();
      try { self.onFinish({ state: state, rewards: (state==="win"?self.rewards:[]) }); } catch(_){}
      broadcast(self, "afterRestore", { ctx:self, state });
    };
  };

  // ===== 對外 API =====
  function start(cfg){
    var ctx = new DungeonCtx(cfg || {});
    ctx.begin();
    w.__DUNGEON_CTX__ = ctx;
    return ctx;
  }
  function escape(){
    var ctx = w.__DUNGEON_CTX__;
    if (ctx) ctx.finish("escape");
  }
  w.DungeonBattle = { start, escape };

})(window);