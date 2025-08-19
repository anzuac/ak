// 📦 battleUtils.js (戰鬥工具與 UI 顯示)

// === 安全墊片：避免未定義報錯（王技可直接呼叫）=''
if (typeof window.applyPlayerStatus === 'undefined') {
  window.applyPlayerStatus = function(type, turns) {
    if (!type || !Number.isFinite(turns)) return;
    player.statusEffects = player.statusEffects || {};
    const cur = player.statusEffects[type] || 0;
    player.statusEffects[type] = Math.max(cur, Math.max(0, Math.floor(turns)));
  };
}

// ===== 小工具：戰鬥日誌 =====
function logPrepend(text) {
  const log = document.getElementById("battleLog");
  if (!log) return;
  const entry = document.createElement("div");
  entry.textContent = text;
  log.insertBefore(entry, log.firstChild);
}

// ===== UI：遇敵倒數（不刷日誌）=====
function showRespawnCountdownUI(sec) {
  const box = document.getElementById("monsterInfo");
  if (!box) return;
  box.innerHTML = `
    <div style="padding:10px 8px; border:1px dashed #666; border-radius:8px; text-align:center;">
      <div style="font-size:14px; margin-bottom:6px;">🧭 即將遭遇新怪</div>
      <div style="font-size:24px; font-weight:bold;">${sec}</div>
      <div style="font-size:12px; opacity:.8; margin-top:6px;">請稍候…</div>
    </div>
  `;
}
function clearMonsterInfo() {
  const box = document.getElementById("monsterInfo");
  if (box) box.textContent = "尚未遭遇怪物";
}
function startRespawnCountdown(delaySec = 3) {
  if (respawnTimer) clearInterval(respawnTimer);
  let t = Math.max(0, Number(delaySec) || 0);
  showRespawnCountdownUI(t);
  respawnTimer = setInterval(() => {
    t--;
    if (t <= 0) {
      clearInterval(respawnTimer);
      respawnTimer = null;
      if (typeof spawnNewMonster === "function") spawnNewMonster();
    } else {
      showRespawnCountdownUI(t);
    }
  }, 1000);
}
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
  let countdown = 30; // 這裡要幾秒就改這個
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