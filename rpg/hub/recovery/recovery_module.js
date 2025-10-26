// ===============================
// recovery_system.js (Simple Tick Variant) — SaveHub 統一存檔版
// 單純回復（每 10s 固定回復），回復量吃「總恢復力」的 30% 權重
// ✅ 不覆寫 player.recoverPercent、不寫入 coreBonus
// ✅ GrowthHub 分頁 + 統一存檔（SaveHub 優先；localStorage 後備；自動遷移）
// ===============================

let recoverySystem;

// === 參數設定 ===
const TICK_MS = 10000;          // 每 10 秒觸發一次
const BASE_HP_PER_TICK = 30;    // 1 等 HP 基礎回復（每 10s）
const BASE_MP_PER_TICK = 3;     // 1 等 MP 基礎回復（每 10s）
const HP_INC_PER_LEVEL   = 30;  // 每級 +30 HP / 10s
const MP_INC_PER_LEVEL   = 2;   // 每級 +2  MP / 10s

const RECOVERY_EAT_RATIO = 30;  // 吃總恢復力的 30%
let   RECOVERY_MAX_LEVEL = 20;  // 預設等級上限（可調整）

// === 花費規則（資源：強化石 stone）===
// 基礎 1000；1-10 每次 +1000；11-20 每次 +3000；21+ 每次 +7000（保留泛化）
const COST_BASE = 1000;
function costIncrementForLevel(prevLevel) {
  if (prevLevel <= 10) return 1000;
  if (prevLevel <= 20) return 3000;
  return 7000;
}
function upgradeCostForLevel(level) {
  // level = 當前等級（欲升級到 level+1 的成本）
  let cost = COST_BASE; // 1->2 的基礎成本
  for (let L = 1; L < level; L++) {
    cost += costIncrementForLevel(L);
  }
  return cost;
}

// === 統一存檔：SaveHub 優先；localStorage 後備（含自動遷移） ===
const SAVEHUB_NS = "recovery_system_simple_v1";     // SaveHub 命名空間
const RECOVERY_STORE_KEY = "恢復"; // 舊 localStorage key（遷移來源）
const SH = window.SaveHub || null;

function freshStore(){ return { level: 1 }; }
function normalizeStore(obj){
  const out = freshStore();
  const lv = Math.max(1, Number(obj && obj.level || 1));
  out.level = Math.min(RECOVERY_MAX_LEVEL, lv);
  return out;
}
(function registerSaveHub(){
  if (!SH) return;
  try{
    const schema = {
      version: 1,
      migrate: (old)=> normalizeStore(old || freshStore())
    };
    if (typeof SH.registerNamespaces === "function"){
      const pack = {}; pack[SAVEHUB_NS] = schema; SH.registerNamespaces(pack);
    } else if (typeof SH.registerNamespace === "function"){
      SH.registerNamespace(SAVEHUB_NS, schema);
    }
  }catch(e){ console && console.warn && console.warn("[recovery_system] SaveHub register failed:", e); }
})();

function shGet(defVal){
  if (!SH) return defVal;
  try{
    if (typeof SH.get === "function") return SH.get(SAVEHUB_NS, defVal);
    if (typeof SH.read === "function") return SH.read(SAVEHUB_NS, defVal);
  }catch(e){ console && console.warn && console.warn("[recovery_system] SaveHub get failed:", e); }
  return defVal;
}
function shSet(val){
  if (!SH) return;
  try{
    if (typeof SH.set === "function"){ SH.set(SAVEHUB_NS, val); return; }
    if (typeof SH.write === "function"){ SH.write(SAVEHUB_NS, val); return; }
  }catch(e){ console && console.warn && console.warn("[recovery_system] SaveHub set failed:", e); }
}

// === 獨立存檔（只存等級） ===
function loadRecoveryStore() {
  try{
    if (SH){
      // 先讀 SaveHub
      let data = shGet(null);
      // 若 SaveHub 無資料，但 localStorage 有舊檔 → 單向遷移
      if (!data){
        const raw = localStorage.getItem(RECOVERY_STORE_KEY);
        if (raw){
          try{
            const legacy = JSON.parse(raw);
            data = normalizeStore(legacy);
            shSet(data);
            localStorage.removeItem(RECOVERY_STORE_KEY); // 遷移後刪舊 key，避免雙寫
          }catch(_){ data = null; }
        }
      }
      return normalizeStore(data || freshStore());
    } else {
      // 無 SaveHub → 使用舊的 localStorage
      const raw = localStorage.getItem(RECOVERY_STORE_KEY);
      return normalizeStore(raw ? JSON.parse(raw) : freshStore());
    }
  }catch(_){ return freshStore(); }
}
function saveRecoveryStore(obj) {
  const safe = normalizeStore(obj || freshStore());
  try{
    if (SH){
      shSet(safe);
    } else {
      localStorage.setItem(RECOVERY_STORE_KEY, JSON.stringify(safe));
    }
  }catch(_){}
}
function persistRecoveryToStore() {
  const store = loadRecoveryStore();
  store.level = Math.min(RECOVERY_MAX_LEVEL, Math.max(1, recoverySystem?.level || 1));
  saveRecoveryStore(store);
}

// === 工具 ===
function toFraction(x) {
  const v = Number(x) || 0;
  if (v <= 0) return 0;
  if (v > 1 && v <= 100) return v / 100;
  return Math.min(v, 1);
}

// 讀取「總恢復力」並套 30% 權重（不動任何玩家欄位）
function getEffectiveRecoverBonus() {
  // 建議你的 player.totalStats.recoverPercent 已經走 base+skill+core
  const totalPct = toFraction(player?.totalStats?.recoverPercent || 0); // 小數 0~1
  return Math.max(0, totalPct * RECOVERY_EAT_RATIO);
}

// 計算每次 tick 的固定回復（含等級）
function getFlatPerTick(level) {
  const L = Math.max(1, level|0);
  const upgrades = Math.max(0, L - 1);
  const hp = BASE_HP_PER_TICK + HP_INC_PER_LEVEL * upgrades;
  const mp = BASE_MP_PER_TICK + MP_INC_PER_LEVEL * upgrades;
  return { hp, mp };
}

// === 初始化 ===
function initRecoverySystem() {
  const store = loadRecoveryStore();
  const lvl  = Math.min(RECOVERY_MAX_LEVEL, Math.max(1, Number(store.level || 1)));

  recoverySystem = {
    level: lvl,
    maxLevel: RECOVERY_MAX_LEVEL,

    // 當前每 10 秒固定回復（未吃恢復力）
    get hpFlatPerTick() {
      return getFlatPerTick(this.level).hp;
    },
    get mpFlatPerTick() {
      return getFlatPerTick(this.level).mp;
    },

    // 實際每 10 秒回復（吃總恢復力的 30%）
    get effectiveBonus() {
      return getEffectiveRecoverBonus(); // 小數 0~1
    },
    get hpPerTickActual() {
      return Math.ceil(this.hpFlatPerTick * (1 + this.effectiveBonus));
    },
    get mpPerTickActual() {
      return Math.ceil(this.mpFlatPerTick * (1 + this.effectiveBonus));
    },

    // 升級花費（以「當前等級 -> 下一級」計）
    get upgradeCost() {
      return upgradeCostForLevel(this.level);
    }
  };

  persistRecoveryToStore();
  window.recoverySystem = recoverySystem;
}

// ✅ 載入存檔後同步（供 save_core.js 呼叫）
function syncRecoveryFromPlayer() {
  if (!player) return;
  const store = loadRecoveryStore();
  const lvl = Math.min(RECOVERY_MAX_LEVEL, Math.max(1, Number(store.level || 1)));
  if (recoverySystem) recoverySystem.level = lvl;
  persistRecoveryToStore();
  window.recoverySystem = recoverySystem;
}
window.syncRecoveryFromPlayer = syncRecoveryFromPlayer;

// 等 player 準備好後再初始化
(function waitPlayer() {
  if (typeof player === "undefined") return setTimeout(waitPlayer, 50);
  initRecoverySystem();
})();

// === Tick：每 10 秒恢復一次（不覆寫任何「恢復力」來源，只讀 totalStats） ===
setInterval(() => {
  if (!player || !recoverySystem) return;
  if (player.currentHP <= 0) return;

  const hpGain = recoverySystem.hpPerTickActual;
  const mpGain = recoverySystem.mpPerTickActual;

  const maxHp = player.totalStats.hp;
  const maxMp = player.totalStats.mp;

  player.currentHP = Math.min(player.currentHP + hpGain, maxHp);
  player.currentMP = Math.min(player.currentMP + mpGain, maxMp);

  if (typeof updateResourceUI === "function") updateResourceUI?.();
}, TICK_MS);

// === 升級（消耗強化石 stone） ===
function upgradeRecovery() {
  if (!player || !recoverySystem) return;
  if (recoverySystem.level >= recoverySystem.maxLevel) {
    alert("已達到最高等級！");
    return;
  }
  const cost = Math.floor(recoverySystem.upgradeCost);
  if ((player.stone || 0) < cost) {
    alert("強化石不足！");
    return;
  }
  player.stone -= cost;
  recoverySystem.level = Math.min(recoverySystem.maxLevel, recoverySystem.level + 1);

  persistRecoveryToStore();

  if (typeof updateResourceUI === "function") updateResourceUI?.();
  if (typeof saveGame === "function") saveGame?.();

  try { window.GrowthHub && window.GrowthHub.requestRerender(); } catch (_) {}
}

// === 舊版彈窗 UI（可留可移除） ===
function openModulePanel() {
  const old = document.getElementById("recoveryModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "recoveryModal";
  modal.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    background:#222;padding:20px;border:3px solid #10b981;border-radius:12px;
    z-index:9999;width:280px;box-shadow:0 0 15px rgba(0,0,0,0.5);
    color:#fff;font-size:14px;line-height:1.6;
  `;

  const cost = Math.floor(recoverySystem.upgradeCost);
  const pct  = Math.round(recoverySystem.effectiveBonus * 10000) / 100; // 例如 15.00%

  modal.innerHTML = `
    <h2 style="margin:0 0 8px;">💖 恢復系統</h2>
    <p>（每 10 秒回復）</p>
    <p>等級：<b>${recoverySystem.level}</b> / ${recoverySystem.maxLevel}</p>
    <hr style="border-color:#444;">
    <p>基礎每 10 秒回復：<b>${recoverySystem.hpFlatPerTick} HP / ${recoverySystem.mpFlatPerTick} MP</b></p>
    <p>吃回復力（30% 權重）：<b>+${pct}%</b></p>
    <p style="opacity:.85;">實際每 10 秒回復：<b>${
      recoverySystem.hpPerTickActual
    } HP / ${
      recoverySystem.mpPerTickActual
    } MP</b></p>
    <hr style="border-color:#444;">
    <p>升級花費（強化石）：<b>${cost}</b></p>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button id="rcv-upgrade" style="flex:1;">升級</button>
      <button id="rcv-close"   style="flex:1;">關閉</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('rcv-upgrade').onclick = upgradeRecovery;
  document.getElementById('rcv-close').onclick   = () => modal.remove();
}
function closeRecoveryModal(){ const m = document.getElementById("recoveryModal"); if (m) m.remove(); }

// 對外舊接口（保留）
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

    var eBonus = pct(recoverySystem.effectiveBonus);
    var nextCost = Math.floor(recoverySystem.upgradeCost);

    container.innerHTML =
      '<div style="background:#0b1220;border:1px solid #1f2937;border-radius:10px;padding:12px">'+
        '<div style="font-weight:700;margin-bottom:6px">💖 恢復系統（每 10 秒）</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;line-height:1.8">'+
          '<div>等級：<b>'+recoverySystem.level+'</b> / '+recoverySystem.maxLevel+'</div>'+
          '<div>回復力吃入：<b>'+eBonus+'</b></div>'+
          '<div>基礎每 10 秒（HP）：<b>'+fmt(recoverySystem.hpFlatPerTick)+'</b></div>'+
          '<div>基礎每 10 秒（MP）：<b>'+fmt(recoverySystem.mpFlatPerTick)+'</b></div>'+
          '<div>實際每 10 秒（HP）：<b>'+fmt(recoverySystem.hpPerTickActual)+'</b></div>'+
          '<div>實際每 10 秒（MP）：<b>'+fmt(recoverySystem.mpPerTickActual)+'</b></div>'+
        '</div>'+
        '<div style="margin-top:10px;display:flex;gap:8px;align-items:center">'+
          '<div>升級花費（強化石）：<b>'+fmt(nextCost)+'</b></div>'+
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
  saveRecoveryStore(freshStore());
  if (recoverySystem) recoverySystem.level = 1;
};