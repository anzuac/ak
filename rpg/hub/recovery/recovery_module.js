// ===============================
// recovery_system.js
// 自然恢復（讀秒，不受回合影響）— 統一「小數制」：0.2 = 20%
// ✅ 取消職業區分版本 + GrowthHub 分頁 UI + 獨立存檔
// ✅ 模組內獨立上限：不使用全域常數、不污染 window
// ===============================

let recoverySystem;

// === 參數設定（不分職業） ===
const BASE_HP_PER5S = 30; // 1等 基礎 HP/5s
const BASE_MP_PER5S = 3;  // 1等 基礎 MP/5s
const HP_INC_PER_LVL = 20; // 每升1級 +20 HP/5s
const MP_INC_PER_LVL = 1;  // 每升1級 +1  MP/5s

const PCT_PER_LEVEL_30S = 0.02; // 每升1級 +2%
const PCT_CAP_30S = 0.60;       // 上限 60%

// ✅ 模組內部專屬等級上限（不使用全域）
let RECOVERY_MAX_LEVEL = 50;

// === 獨立存檔（與主存檔分離） ===
const RECOVERY_STORE_KEY = "recovery_system_store_v1";
function loadRecoveryStore() {
  try { return JSON.parse(localStorage.getItem(RECOVERY_STORE_KEY)) || {}; } catch(_) { return {}; }
}
function saveRecoveryStore(obj) {
  try { localStorage.setItem(RECOVERY_STORE_KEY, JSON.stringify(obj || {})); } catch(_) {}
}
function persistRecoveryToStore() {
  const obj = loadRecoveryStore();
  obj.level = Math.min(RECOVERY_MAX_LEVEL, Math.max(1, recoverySystem?.level || 1));
  // 存「系統提供的基礎百分比」
  obj.basePercentDecimal = toFraction(player?.recoverPercentBaseDecimal || 0);
  saveRecoveryStore(obj);
}

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

  if (player.recoverPercentBaseDecimal === undefined) {
    player.recoverPercentBaseDecimal = toFraction(player.recoverPercent || 0);
  } else {
    player.recoverPercentBaseDecimal = toFraction(player.recoverPercentBaseDecimal);
  }

  const lvl = Math.max(1, recoverySystem?.level || 1);
  const upgrades = Math.max(0, lvl - 1);
  const systemPct = Math.max(0, upgrades * PCT_PER_LEVEL_30S); // 每級 +2%

  player.recoverPercent = Math.min(
    player.recoverPercentBaseDecimal + systemPct,
    PCT_CAP_30S
  );
}

// 目前 30 秒內的總回復百分比（小數，含技能）
function currentTotalPercent30s() {
  const baseDecimal  = toFraction(player?.recoverPercent || 0);
  const skillDecimal = toFraction(player?.skillBonus?.recoverPercent || 0);
  return Math.min(baseDecimal + skillDecimal, PCT_CAP_30S);
}

// 換算成每 5 秒的百分比
function per5sPercent() {
  return currentTotalPercent30s() / 6; // 30s -> 5s
}

// === 初始化 ===
function initRecoverySystem() {
  const store = loadRecoveryStore();
  const prevLevelFromStore  = store.level;
  const prevLevelFromPlayer = player?.recoverySystem?.level;

  // 取玩家與存檔的最大值，避免舊檔壓低
  const prevLevelRaw = Math.max(
    1,
    Number(prevLevelFromStore || 0),
    Number(prevLevelFromPlayer || 0)
  );
  const prevLevel = Math.min(RECOVERY_MAX_LEVEL, prevLevelRaw);

  recoverySystem = {
    level: prevLevel,
    maxLevel: RECOVERY_MAX_LEVEL,

    // 每 5 秒固定恢復
    get hpFlatPer5s() {
      const upgrades = Math.max(0, this.level - 1);
      return Math.round(BASE_HP_PER5S + (HP_INC_PER_LVL * upgrades));
    },
    get mpFlatPer5s() {
      const upgrades = Math.max(0, this.level - 1);
      return Math.round(BASE_MP_PER5S + (MP_INC_PER_LVL * upgrades));
    },

    // 百分比
    get percent30s() { return currentTotalPercent30s(); },

    // 各種加總
    get hpTotal30sPctOnly() {
      const maxHp = Math.max(1, player?.totalStats?.hp || 1);
      return Math.ceil(maxHp * this.percent30s);
    },
    get mpTotal30sPctOnly() {
      const maxMp = Math.max(1, player?.totalStats?.mp || 1);
      return Math.ceil(maxMp * this.percent30s);
    },
    get hpTotal30sFlatOnly() { return this.hpFlatPer5s * 6; },
    get mpTotal30sFlatOnly() { return this.mpFlatPer5s * 6; },
    get hpTotal30sAll() { return this.hpTotal30sPctOnly + this.hpTotal30sFlatOnly; },
    get mpTotal30sAll() { return this.mpTotal30sPctOnly + this.mpTotal30sFlatOnly; },

    get upgradeCost() { return 200 * this.level; }
  };

  if (store.basePercentDecimal != null) {
    player.recoverPercentBaseDecimal = toFraction(store.basePercentDecimal);
  }

  applySystemPercentToPlayer();
  persistRecoveryToStore();

  window.recoverySystem = recoverySystem;
}

// ✅ 載入存檔後同步（供 save_core.js 呼叫）
function syncRecoveryFromPlayer() {
  if (!player) return;

  const store = loadRecoveryStore();

  // 取最大值，確保不會被壓低
  const lvlRaw = Math.max(
    1,
    Number(store.level || 0),
    Number(player?.recoverySystem?.level || 0)
  );
  const lvl = Math.min(RECOVERY_MAX_LEVEL, lvlRaw);

  if (recoverySystem) recoverySystem.level = lvl;

  if (store.basePercentDecimal != null) {
    player.recoverPercentBaseDecimal = toFraction(store.basePercentDecimal);
  }

  applySystemPercentToPlayer();

  player.recoverySystem = player.recoverySystem || {};
  player.recoverySystem.level = recoverySystem.level;

  persistRecoveryToStore();
  window.recoverySystem = recoverySystem;
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

// === 舊版彈窗 UI（保留） ===
function openModulePanel() {
  const old = document.getElementById("recoveryModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "recoveryModal";
  modal.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    background:#222;padding:20px;border:3px solid #f44336;border-radius:12px;
    z-index:9999;width:260px;box-shadow:0 0 15px rgba(0,0,0,0.5);
    color:#fff;font-size:14px;line-height:1.6;
  `;

  const cost = Math.floor(recoverySystem.upgradeCost);
  const pct = Math.round(recoverySystem.percent30s * 10000) / 100; // 20.00%

  modal.innerHTML = `
    <h2 style="margin:0 0 8px;">💖 恢復系統</h2>
    <p>（無職業限制）</p>
    <p>等級：<b>${recoverySystem.level}</b> / ${recoverySystem.maxLevel}</p>
    <hr style="border-color:#444;">
    <p>每 5 秒固定回復（HP/MP）：<b>${recoverySystem.hpFlatPer5s} / ${recoverySystem.mpFlatPer5s}</b></p>
    <p>恢復力加成：<b>+${pct}%</b></p>
    <p style="opacity:.85;">最終每 5 秒實際回復（HP/MP）：<b>${
      Math.ceil(recoverySystem.hpFlatPer5s * (1 + recoverySystem.percent30s))
    } / ${
      Math.ceil(recoverySystem.mpFlatPer5s * (1 + recoverySystem.percent30s))
    }</b></p>
    <hr style="border-color:#444;">
    <p>升級花費：<b>${cost}</b> 鑽石</p>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button id="rcv-upgrade" style="flex:1;">升級</button>
      <button id="rcv-close"   style="flex:1;">關閉</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('rcv-upgrade').onclick = upgradeRecovery;
  document.getElementById('rcv-close').onclick   = closeRecoveryModal;
}
function closeRecoveryModal(){ const m = document.getElementById("recoveryModal"); if (m) m.remove(); }

// === 升級 ===
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
  recoverySystem.level = Math.min(recoverySystem.maxLevel, recoverySystem.level + 1);

  player.recoverySystem = player.recoverySystem || {};
  player.recoverySystem.level = recoverySystem.level;

  applySystemPercentToPlayer();
  persistRecoveryToStore();

  if (typeof updateResourceUI === "function") updateResourceUI?.();
  if (typeof saveGame === 'function') saveGame();

  try { window.GrowthHub && window.GrowthHub.requestRerender(); } catch (_) {}
}

// 對外舊接口（可選）
window.openModulePanel   = openModulePanel;
window.closeRecoveryModal = closeRecoveryModal;
window.upgradeRecovery    = upgradeRecovery;

// ✅ 存檔套用後自動同步
if (window.GameSave?.onApply) {
  GameSave.onApply(function () {
    try { syncRecoveryFromPlayer(); } catch (e) {
      console.warn("[recovery_module] sync on apply failed", e);
    }
  });
}

/* ------------------------------------------------------------------
   GrowthHub 分頁 UI（不彈窗）
-------------------------------------------------------------------*/
(function registerGrowthTab(){
  function fmt(n){ return Number(n||0).toLocaleString(); }
  function pct(n){ return (Number(n||0)*100).toFixed(2) + "%"; }

  function render(container){
    if (!recoverySystem) {
      container.innerHTML = '<div style="opacity:.7">（載入中…）</div>'; return;
    }

    var pct30 = pct(recoverySystem.percent30s);
    var nextCost = Math.floor(recoverySystem.upgradeCost);

    container.innerHTML =
      '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:12px">'+
        '<div style="font-weight:700;margin-bottom:6px">💖 恢復系統（不分職業）</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;line-height:1.8">'+
          '<div>等級：<b>'+recoverySystem.level+'</b> / '+recoverySystem.maxLevel+'</div>'+
          '<div>恢復力加成（30s）：<b>'+pct30+'</b></div>'+
          '<div>每 5 秒固定回復：HP <b>'+fmt(recoverySystem.hpFlatPer5s)+'</b></div>'+
          '<div>每 5 秒固定回復：MP <b>'+fmt(recoverySystem.mpFlatPer5s)+'</b></div>'+
          '<div>實際每 5 秒（HP）：<b>'+fmt(Math.ceil(recoverySystem.hpFlatPer5s*(1+recoverySystem.percent30s)))+'</b></div>'+
          '<div>實際每 5 秒（MP）：<b>'+fmt(Math.ceil(recoverySystem.mpFlatPer5s*(1+recoverySystem.percent30s)))+'</b></div>'+
        '</div>'+
        '<div style="margin-top:10px;display:flex;gap:8px;align-items:center">'+
          '<div>升級花費：<b>'+fmt(nextCost)+'</b> 鑽石</div>'+
          '<button id="rcvUpgradeBtn" style="margin-left:auto;background:#10b981;border:none;color:#0b1220;border-radius:8px;padding:6px 10px;cursor:pointer">升級</button>'+
        '</div>'+
      '</div>';

    var b = container.querySelector('#rcvUpgradeBtn');
    if (b) b.onclick = function(){ upgradeRecovery(); };
  }

  if (window.GrowthHub && typeof window.GrowthHub.registerTab === 'function'){
    window.GrowthHub.registerTab({
      id: 'recovery',
      title: '恢復系統',
      render: render,
      tick: function(){} // 不需要每秒邏輯
    });
  }
})();

// （可選）提供重置方便測試
window.resetRecoveryStore = function() {
  saveRecoveryStore({});
  if (recoverySystem) recoverySystem.level = 1;
  if (player) {
    player.recoverPercentBaseDecimal = 0;
    applySystemPercentToPlayer();
  }
};