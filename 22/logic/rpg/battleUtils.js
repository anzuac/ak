// 📦 battleUtils.js —— 遇敵/復活倒數 + UI + Gate（統一閘門）

// ===== 戰鬥日誌（保底）=====
if (typeof window.logPrepend !== "function") {
  window.logPrepend = function (text) {
    var log = document.getElementById("battleLog");
    if (!log) return;
    var entry = document.createElement("div");
    entry.textContent = text;
    log.insertBefore(entry, log.firstChild);
  };
}

// ===== UI：怪物面板倒數 =====
if (typeof window.showRespawnCountdownUI !== "function") {
  window.showRespawnCountdownUI = function (sec) {
    var box = document.getElementById("monsterInfo");
    if (!box) return;
    box.innerHTML =
      '<div style="padding:10px 8px; border:1px dashed #666; border-radius:8px; text-align:center;">' +
      '<div style="font-size:14px; margin-bottom:6px;">🧭 即將遭遇新怪</div>' +
      '<div style="font-size:24px; font-weight:bold;">' + sec + '</div>' +
      '<div style="font-size:12px; opacity:.8; margin-top:6px;">請稍候…</div>' +
      '</div>';
  };
}
if (typeof window.clearMonsterInfo !== "function") {
  window.clearMonsterInfo = function () {
    var box = document.getElementById("monsterInfo");
    if (box) box.textContent = "尚未遭遇怪物";
  };
}

// ===== UI：HP 列倒數 =====
if (typeof window.showDeathCountdownUI !== "function") {
  window.showDeathCountdownUI = function (sec) {
    var hpEl = document.getElementById("hp");
    if (!hpEl) return;
    var maxHp = (window.player && window.player.totalStats && window.player.totalStats.hp) ? window.player.totalStats.hp : 0;
    hpEl.textContent = '0 / ' + maxHp + '（復活倒數 ' + sec + 's）';
    var abilitySection = hpEl.closest && hpEl.closest(".section");
    if (abilitySection) abilitySection.style.opacity = 0.6;
  };
}
if (typeof window.restoreAbilityUI !== "function") {
  window.restoreAbilityUI = function () {
    var hpEl = document.getElementById("hp");
    if (!hpEl) return;
    var maxHp = (window.player && window.player.totalStats && window.player.totalStats.hp) ? window.player.totalStats.hp : 0;
    var curHp = (window.player && typeof window.player.currentHP === "number") ? window.player.currentHP : 0;
    hpEl.textContent = curHp + ' / ' + maxHp;
    var abilitySection = hpEl.closest && hpEl.closest(".section");
    if (abilitySection) abilitySection.style.opacity = "";
  };
}

// ===== 全域 timer（單例）=====
if (typeof window.respawnTimer === "undefined") window.respawnTimer = null;
if (typeof window.deathTimer   === "undefined") window.deathTimer   = null;

// ===== Gate（統一閘門）=====
(function () {
  if (window.BattleGate) return;
  window.BattleGate = {
    _manualLock: false,
    lock:   function() { this._manualLock = true;  },
    unlock: function() { this._manualLock = false; },

    isLocked: function () {
      return !!this._manualLock || !!window.respawnTimer || !!window.deathTimer;
    },
    canAutoSpawn: function () {
      return !this.isLocked() && !!window.autoEnabled && !window.isDead && !window.currentMonster;
    },
    requestAutoSpawn: function () {
      if (this.canAutoSpawn() && typeof window.spawnNewMonster === "function") {
        window.spawnNewMonster();
        return true;
      }
      return false;
    }
  };
})();

// ===== 遇敵倒數（唯一中控）=====
window.RESPAWN_DELAY_SEC = window.RESPAWN_DELAY_SEC || 2; // 全域預設可改

window.startRespawnCountdown = function (delaySec) {
  if (window.respawnTimer) return;     // 單例：已在倒數中就不重啟
  BattleGate.lock();                    // 倒數期間鎖住戰鬥

  var t = Number(delaySec);
  if (!isFinite(t)) t = Number(window.RESPAWN_DELAY_SEC);
  if (!isFinite(t)) t = 3;
  t = Math.max(0, Math.floor(t));

  if (typeof window.showRespawnCountdownUI === "function") window.showRespawnCountdownUI(t);

  window.respawnTimer = setInterval(function () {
    t--;
    if (t <= 0) {
      clearInterval(window.respawnTimer);
      window.respawnTimer = null;
      if (typeof window.spawnNewMonster === "function") window.spawnNewMonster();
      BattleGate.unlock();             // 遇敵後解鎖
    } else {
      if (typeof window.showRespawnCountdownUI === "function") window.showRespawnCountdownUI(t);
    }
  }, 1000);
};

window.cancelRespawnCountdown = function () {
  if (window.respawnTimer) { clearInterval(window.respawnTimer); window.respawnTimer = null; }
  BattleGate.unlock();
};

// ===== 玩家死亡 → 啟動倒數復活（30s）=====
function startDeathCountdown() {
  if (isDead) return;              // 避免重複觸發
  isDead = true;

  // 記住死亡前是否有啟動自動戰鬥
  const wasAuto = !!autoEnabled;
  autoEnabled = false;

  // 清掉遇敵倒數，清空當前怪，解鎖難度並更新怪物面板
  if (respawnTimer) { clearInterval(respawnTimer); respawnTimer = null; }
  currentMonster = null;
  monsterHP = 0;
  clearMonsterInfo?.();
  window.setDifficultySelectDisabled?.(false);

  // 顯示 30 秒復活倒數在 HP 行
  let countdown = 10; // 這裡要幾秒就改這個
  showDeathCountdownUI(countdown);

  // 關閉舊倒數，開新倒數
  if (deathTimer) { clearInterval(deathTimer); deathTimer = null; }
  deathTimer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(deathTimer);
      deathTimer = null;

      // 復活：回滿、恢復 UI 與旗標
      player.currentHP = player.totalStats.hp;
      player.currentMP = player.totalStats.mp;
      isDead = false;
      restoreAbilityUI();
      updateResourceUI?.();
      logPrepend?.("✨ 你已復活！");

      // 如果死亡前是自動戰鬥，復活後自動再開並安排遇敵
      if (wasAuto) {
        autoEnabled = true;
        // 直接生怪，或用倒數 1 秒再遇敵都行：
        // spawnNewMonster?.();
        startRespawnCountdown?.(1);
      }
    } else {
      showDeathCountdownUI(countdown);
    }
  }, 1000);
}