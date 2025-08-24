// recovery_system.js
// 自然恢復（讀秒，不受回合影響）— 統一「小數制」：0.2 = 20%
// ✅ 取消職業區分版本

let recoverySystem;

// === 參數設定（不分職業） ===
const BASE_HP_PER5S = 30; // 1等 基礎 HP/5s
const BASE_MP_PER5S = 3; // 1等 基礎 MP/5s
const HP_INC_PER_LVL = 20; // 每升1級 +20 HP/5s
const MP_INC_PER_LVL = 1; // 每升1級 +1  MP/5s

const PCT_PER_LEVEL_30S = 0.02; // 每升1級 +2%（小數）
const PCT_CAP_30S = 0.60; // 上限 60%

// === 工具 ===
function toFraction(x) {
  const v = Number(x) || 0;
  if (v <= 0) return 0;
  if (v > 1 && v <= 100) return v / 100; // 相容舊資料若是百分比
  return Math.min(v, 1);
}

// 將系統提供的回復百分比加到 player（保持你原本「小數制」）
function applySystemPercentToPlayer() {
  if (typeof player === "undefined") return;
  
  // 保留舊有基礎（可能有被別的系統寫過的 recoverPercent 基礎值）
  if (player.recoverPercentBaseDecimal === undefined) {
    player.recoverPercentBaseDecimal = toFraction(player.recoverPercent || 0);
  } else {
    player.recoverPercentBaseDecimal = toFraction(player.recoverPercentBaseDecimal);
  }
  
  const lvl = Math.max(1, recoverySystem?.level || 1);
  const upgrades = Math.max(0, lvl - 1);
  const systemPct = Math.max(0, upgrades * PCT_PER_LEVEL_30S); // 每級 +2%
  
  // 存回 player.recoverPercent（小數制）
  player.recoverPercent = Math.min(
    player.recoverPercentBaseDecimal + systemPct,
    PCT_CAP_30S
  );
}

// 目前 30 秒內的總回復百分比（小數，含技能）
function currentTotalPercent30s() {
  const baseDecimal = toFraction(player?.recoverPercent || 0); // 系統+基礎
  const skillDecimal = toFraction(player?.skillBonus?.recoverPercent || 0); // 技能來源
  return Math.min(baseDecimal + skillDecimal, PCT_CAP_30S);
}

// 換算成每 5 秒的百分比
function per5sPercent() {
  return currentTotalPercent30s() / 6; // 30s -> 5s
}

// === 初始化 ===
function initRecoverySystem() {
  // ✅ 以存檔為主（loadGame 會把等級寫到 player.recoverySystem）
  const prevLevel = player?.recoverySystem?.level ?? 1;
  
  recoverySystem = {
    level: Math.min(20, Math.max(1, prevLevel)),
    maxLevel: 20,
    
    // 每 5 秒的固定恢復（不分職業）
    get hpFlatPer5s() {
      const upgrades = Math.max(0, this.level - 1);
      return Math.max(0, Math.round(BASE_HP_PER5S + (HP_INC_PER_LVL * upgrades)));
    },
    get mpFlatPer5s() {
      const upgrades = Math.max(0, this.level - 1);
      return Math.max(0, Math.round(BASE_MP_PER5S + (MP_INC_PER_LVL * upgrades)));
    },
    
    // 30 秒百分比（小數）
    get percent30s() { return currentTotalPercent30s(); },
    
    // 30 秒：僅百分比回復
    get hpTotal30sPctOnly() {
      const maxHp = Math.max(1, player?.totalStats?.hp || 1);
      return Math.ceil(maxHp * this.percent30s);
    },
    get mpTotal30sPctOnly() {
      const maxMp = Math.max(1, player?.totalStats?.mp || 1);
      return Math.ceil(maxMp * this.percent30s);
    },
    
    // 30 秒：僅固定值回復
    get hpTotal30sFlatOnly() { return this.hpFlatPer5s * 6; },
    get mpTotal30sFlatOnly() { return this.mpFlatPer5s * 6; },
    
    // 30 秒：總回復
    get hpTotal30sAll() { return this.hpTotal30sPctOnly + this.hpTotal30sFlatOnly; },
    get mpTotal30sAll() { return this.mpTotal30sPctOnly + this.mpTotal30sFlatOnly; },
    
    // 升級花費（沿用你原有的線性規則）
    get upgradeCost() { return 200 * this.level; }
  };
  
  applySystemPercentToPlayer();
  
  // ✅ 掛到 window 讓外部可用（存檔、UI 等）
  window.recoverySystem = recoverySystem;
}

// ✅ 載入存檔後的同步（供 save_core.js 呼叫）
function syncRecoveryFromPlayer() {
  if (!player) return;
  const lvl = Math.min(20, Math.max(1, player?.recoverySystem?.level ?? 1));
  if (recoverySystem) {
    recoverySystem.level = lvl;
    applySystemPercentToPlayer();
    window.recoverySystem = recoverySystem;
  }
}
window.syncRecoveryFromPlayer = syncRecoveryFromPlayer;

// 等 player 準備好後再初始化
(function waitPlayer() {
  if (typeof player === "undefined") return setTimeout(waitPlayer, 50);
  initRecoverySystem();
})();

// === Tick：每 5 秒恢復一次 ===
setInterval(() => {
  if (!player) return;
  if (player.currentHP <= 0) return;
  
  const hpFlat = recoverySystem.hpFlatPer5s;
  const mpFlat = recoverySystem.mpFlatPer5s;
  
  const recoverBonus = Math.max(0, currentTotalPercent30s()); // 小數制
  
  const hpRecover = Math.ceil(hpFlat * (1 + recoverBonus));
  const mpRecover = Math.ceil(mpFlat * (1 + recoverBonus));
  
  const maxHp = player.totalStats.hp;
  const maxMp = player.totalStats.mp;
  player.currentHP = Math.min(player.currentHP + hpRecover, maxHp);
  player.currentMP = Math.min(player.currentMP + mpRecover, maxMp);
  
  if (typeof updateResourceUI === "function") updateResourceUI?.();
}, 5000);

// === 模組 UI（不分職業） ===
function openModulePanel() {
  const old = document.getElementById("recoveryModal");
  if (old) old.remove();
  
  const modal = document.createElement("div");
  modal.id = "recoveryModal";
  modal.style.position = "fixed";
  modal.style.top = "50%";
  modal.style.left = "50%";
  modal.style.transform = "translate(-50%, -50%)";
  modal.style.background = "#222";
  modal.style.padding = "20px";
  modal.style.border = "3px solid #f44336";
  modal.style.borderRadius = "12px";
  modal.style.zIndex = "9999";
  modal.style.width = "260px";
  modal.style.boxShadow = "0 0 15px rgba(0,0,0,0.5)";
  modal.style.color = "#fff";
  modal.style.fontSize = "14px";
  modal.style.lineHeight = "1.6";
  
  const cost = Math.floor(recoverySystem.upgradeCost);
  const pct = Math.round(recoverySystem.percent30s * 10000) / 100; // 顯示成 20.00%
  
  modal.innerHTML = `
    <h2 style="margin:0 0 8px;">💖 恢復系統</h2>
    <p style="margin:4px 0;">（無職業限制）</p>
    <p style="margin:4px 0;">等級：<b>${recoverySystem.level}</b> / ${recoverySystem.maxLevel}</p>
    <hr style="border-color:#444;">
    <p style="margin:4px 0;">每 5 秒固定回復（HP/MP）：<b>${recoverySystem.hpFlatPer5s} / ${recoverySystem.mpFlatPer5s}</b></p>
    <p style="margin:4px 0;">恢復力加成：<b>+${pct}%</b></p>
    <p style="margin:4px 0;opacity:.85;">最終每 5 秒實際回復（HP/MP）：<b>${
      Math.ceil(recoverySystem.hpFlatPer5s * (1 + recoverySystem.percent30s))
    } / ${
      Math.ceil(recoverySystem.mpFlatPer5s * (1 + recoverySystem.percent30s))
    }</b></p>
    <hr style="border-color:#444;">
    <p style="margin:4px 0;">升級花費：<b>${cost}</b> 鑽石</p>
    <div style="display:flex; gap:8px; margin-top:8px;">
      <button onclick="upgradeRecovery()" style="flex:1; padding:6px 8px;">升級</button>
      <button onclick="closeRecoveryModal()" style="flex:1; padding:6px 8px;">關閉</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeRecoveryModal() {
  const modal = document.getElementById("recoveryModal");
  if (modal) modal.remove();
}

function upgradeRecovery() {
  if (recoverySystem.level >= recoverySystem.maxLevel) {
    alert("已達到最高等級！");
    return;
  }
  const cost = Math.floor(recoverySystem.upgradeCost);
  if ((player?.gem || 0) < cost) {
    alert("鑽石不足！");
    return;
  }
  player.gem -= cost;
  recoverySystem.level = Math.min(20, recoverySystem.level + 1);
  
  // ✅ 同步到存檔來源（player）
  player.recoverySystem = player.recoverySystem || {};
  player.recoverySystem.level = recoverySystem.level;
  
  applySystemPercentToPlayer();
  
  if (typeof updateResourceUI === "function") updateResourceUI?.();
  closeRecoveryModal();
  openModulePanel();
  
  if (typeof saveGame === 'function') {
    saveGame();
  }
}

// 需要時也可以掛到 window（可選）
window.openModulePanel = openModulePanel;
window.closeRecoveryModal = closeRecoveryModal;
window.upgradeRecovery = upgradeRecovery;

// 若你有專門的 game_init.js 可保留以下（選用）
window.addEventListener('load', () => {
  // 讀檔
  const ok = (typeof loadGame === 'function') ? loadGame() : false;
  
  // 雙保險：若 recovery_module 已載入，強制再同步一次等級
  if (typeof syncRecoveryFromPlayer === 'function') {
    syncRecoveryFromPlayer();
  }
  
  // UI 重繪（若有）
  if (typeof updateAllUI === 'function') {
    updateAllUI();
  }
});