// recovery_system.js
// 自然恢復（讀秒，不受回合影響）— 統一「小數制」：0.2 = 20%
// 規則：
// - 劍士：每升級 +30 HP、+2 MP（每 5 秒）
// - 法師：每升級 +3  HP、+30 MP（每 5 秒）
// - 弓手/盜賊：每升級 +15 HP、+4 MP（每 5 秒）
// - 每升級額外 +0.02（= 2% / 30秒）的恢復率，加到「player 基礎恢復（小數）」
// - 等級上限 20
//
// 實際每 5 秒回復 = 「百分比回復（小數；30秒總率/6）」 + 「固定值回復（每5秒）」

let recoverySystem;

const JOB_MAP = {
  '戰士':'warrior','法師':'mage','弓箭手':'archer','盜賊':'thief',
  'warrior':'warrior','mage':'mage','archer':'archer','thief':'thief'
};
const JOB_DISPLAY = { warrior:'戰士', mage:'法師', archer:'弓箭手', thief:'盜賊' };

function normalizeJob(v){ return JOB_MAP[String(v||'').trim()] || 'warrior'; }
function jobKey(){ return normalizeJob(player?.job); }

// 每升級的固定回復增量（每 5 秒）
const FLAT_INC_PER_LEVEL = {
  warrior: { hp: 30, mp: 2 },
  mage:    { hp: 3,  mp: 30 },
  archer:  { hp: 15, mp: 4 },
  thief:   { hp: 15, mp: 4 },
};

// 每升級 +0.02（=2%/30秒，使用小數制）
const PCT_PER_LEVEL_30S = 0.02;
// 安全上限（避免爆量；可調整或拿掉）
const PCT_CAP_30S = 60;

// 若有舊資料（寫成 20 或 50），盡量轉成小數；新制請直接給小數（0.2、0.5）
function toFraction(x) {
  const v = Number(x) || 0;
  if (v <= 0) return 0;
  if (v > 1 && v <= 100) return v / 100;
  return Math.min(v, 1);
}

// 把「系統等級％（小數）」寫回 player 的基礎恢復（同為小數制）
function applySystemPercentToPlayer() {
  if (typeof player === "undefined") return;

  // 建立/保留一個「玩家基礎恢復（小數）」的底稿
  if (player.recoverPercentBaseDecimal === undefined) {
    // 若你之前在別處已設定 player.recoverPercent（可能是小數或整數），轉成小數存底
    player.recoverPercentBaseDecimal = toFraction(player.recoverPercent || 0);
  } else {
    player.recoverPercentBaseDecimal = toFraction(player.recoverPercentBaseDecimal);
  }

  const lvl = Math.max(1, recoverySystem?.level || 1);
  const upgrades = Math.max(0, lvl - 1); // LV1 視為 0 次升級
  const systemPct = Math.max(0, upgrades * PCT_PER_LEVEL_30S); // 線性加總：每級 +0.02

  // 基礎（小數）= 原始基礎小數 + 系統小數（夾上限）
  player.recoverPercent = Math.min(
    player.recoverPercentBaseDecimal + systemPct,
    PCT_CAP_30S
  );
}

// 目前「等效 30 秒總回復率（小數）」= 基礎小數 + 技能小數（不含固定值）
function currentTotalPercent30s() {
  const baseDecimal  = toFraction(player?.recoverPercent || 0);             // 小數（基礎）
  const skillDecimal = toFraction(player?.skillBonus?.recoverPercent || 0); // 小數（技能）
  return Math.min(baseDecimal + skillDecimal, PCT_CAP_30S);
}

// 把 30 秒率分攤成 5 秒份額（小數）
function per5sPercent(){
  return currentTotalPercent30s() / 6; // 30s / 5s = 6
}

function initRecoverySystem(){
  const prevLevel = recoverySystem?.level ?? 1;
  recoverySystem = {
    level: Math.min(20, Math.max(1, prevLevel)),
    maxLevel: 20,

    get job(){ return jobKey(); },

    // 固定回復（每 5 秒）：按升級次數線性增加
    get hpFlatPer5s(){
      const inc = FLAT_INC_PER_LEVEL[this.job]?.hp ?? FLAT_INC_PER_LEVEL.warrior.hp;
      const upgrades = Math.max(0, this.level - 1);
      return Math.max(0, Math.round(inc * upgrades));
    },
    get mpFlatPer5s(){
      const inc = FLAT_INC_PER_LEVEL[this.job]?.mp ?? FLAT_INC_PER_LEVEL.warrior.mp;
      const upgrades = Math.max(0, this.level - 1);
      return Math.max(0, Math.round(inc * upgrades));
    },

    // 顯示用（僅百分比部分，依小數制）
    get percent30s(){ return currentTotalPercent30s(); },

    // 顯示用：30 秒（僅百分比部分）換算的數值
    get hpTotal30sPctOnly(){
      const maxHp = Math.max(1, player?.totalStats?.hp || 1);
      return Math.ceil(maxHp * this.percent30s);
    },
    get mpTotal30sPctOnly(){
      const maxMp = Math.max(1, player?.totalStats?.mp || 1);
      return Math.ceil(maxMp * this.percent30s);
    },

    // 顯示用：30 秒固定值總和（每 5 秒固定值 × 6）
    get hpTotal30sFlatOnly(){ return this.hpFlatPer5s * 6; },
    get mpTotal30sFlatOnly(){ return this.mpFlatPer5s * 6; },

    // 顯示用：30 秒「總回復」（百分比 + 固定值）
    get hpTotal30sAll(){ return this.hpTotal30sPctOnly + this.hpTotal30sFlatOnly; },
    get mpTotal30sAll(){ return this.mpTotal30sPctOnly + this.mpTotal30sFlatOnly; },

    get upgradeCost(){ return 200 * this.level; }
  };

  // 把系統等級％（小數）寫入 player 基礎恢復（小數）
  applySystemPercentToPlayer();
}

// 等 player 存在後初始化
(function waitPlayer(){
  if (typeof player === "undefined") return setTimeout(waitPlayer, 50);
  initRecoverySystem();
})();

// 讀秒自然恢復：每 5 秒
setInterval(() => {
  if (!player) return;
  if (player.currentHP <= 0) return; // 死亡不回

  // 1) 基礎固定值（每 5 秒）
  const hpFlat = recoverySystem.hpFlatPer5s;
  const mpFlat = recoverySystem.mpFlatPer5s;

  // 2) 恢復力加成（小數）— 直接拿你原本「30 秒總比例」當成加成百分比即可
  //    例如 0.2 表示 +20% 恢復力
  const recoverBonus = Math.max(0, currentTotalPercent30s()); // 小數，像 0.2 / 0.5 / ...

  // 3) 最終每 5 秒恢復 = 固定值 × (1 + 加成)
  const hpRecover = Math.ceil(hpFlat * (1 + recoverBonus));
  const mpRecover = Math.ceil(mpFlat * (1 + recoverBonus));

  // 4) 套用
  const maxHp = player.totalStats.hp;
  const maxMp = player.totalStats.mp;
  player.currentHP = Math.min(player.currentHP + hpRecover, maxHp);
  player.currentMP = Math.min(player.currentMP + mpRecover, maxMp);

  if (typeof updateResourceUI === "function") updateResourceUI?.();
}, 5000);
// 面板
function openModulePanel(){
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
  modal.style.width = "250px";
  modal.style.boxShadow = "0 0 15px rgba(0,0,0,0.5)";
  modal.style.color = "#fff";
  modal.style.fontSize = "14px";
  modal.style.lineHeight = "1.6";

  const jobName = JOB_DISPLAY[recoverySystem.job] || "戰士";
  const cost = Math.floor(recoverySystem.upgradeCost);
  const pct = Math.round(recoverySystem.percent30s * 10000) / 100; // 0.2 -> 20.00%

modal.innerHTML = `
  <h2 style="margin:0 0 8px;">💖 恢復系統</h2>
  <p style="margin:4px 0;">職業：<b>${jobName}</b></p>
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

function closeRecoveryModal(){
  const modal = document.getElementById("recoveryModal");
  if (modal) modal.remove();
}

function upgradeRecovery(){
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

  // 升級後重算：把等級小數加回 player 基礎恢復（小數）
  applySystemPercentToPlayer();

  if (typeof updateResourceUI === "function") updateResourceUI?.();
  closeRecoveryModal();
  openModulePanel();
}