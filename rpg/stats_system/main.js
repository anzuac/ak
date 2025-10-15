// =======================
// main.js (整合修正版 - 無職業回退/轉換 / 暱稱限制版)
// 新增：在 UI 顯示 totalDamage（總傷害）
// =======================

// === 暱稱限制與工具 ===
const NICKNAME_MIN_LEN = 2;     // 最短 2
const NICKNAME_MAX_LEN = 12;    // 最長 12
function sanitizeNickname(input) {
  const s = String(input || "").trim();
  const noTags = s.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "");
  // 允許：字母/數字/空白/底線/連字號/一般 CJK
  const safe = noTags.replace(/[^\p{L}\p{N}\s_\-]/gu, "");
  return safe.replace(/\s+/g, " ").trim();
}

// --- 小工具：安全取得 baseJob（utils_jobs.js 未載入就退回原 job） ---
function getBaseJobSafe(job) {
  const j = (job || "").toLowerCase();
  return (typeof window.getBaseJob === "function") ? window.getBaseJob(j) : j;
}

function isMage() {
  return getBaseJobSafe(player.job) === "mage";
}

function toggleMagicShield() {
  if (!isMage()) { alert("只有法師可以使用魔力護盾"); return; }
  player.magicShieldEnabled = !player.magicShieldEnabled;
  player.manaShieldEnabled  = player.magicShieldEnabled; // 兼容舊欄位
  const btn = document.getElementById("manaShieldBtn");
  if (btn) btn.textContent = "🛡️ 魔力護盾：" + (player.magicShieldEnabled ? "開" : "關");
  updateResourceUI();
}

function refreshMageOnlyUI() {
  const row = document.getElementById("manaShieldRow");
  const btn = document.getElementById("manaShieldBtn");
  const mage = isMage();

  if (row) row.style.display = mage ? "" : "none";
  if (btn) {
    btn.style.display = mage ? "" : "none";
    btn.textContent = "🛡️ 魔力護盾：" + (player.magicShieldEnabled ? "開" : "關");
  }

  if (!mage) {
    player.magicShieldEnabled = false;
    player.manaShieldEnabled  = false; // 舊欄位同步
  }
}

// 統一顯示：保留兩位小數（含 .00）
function fmt2(x) {
  const n = Number(x);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

function updateResourceUI() {
  const maxHp = player.totalStats.hp;
  const maxMp = player.totalStats.mp;

  const eqStr = player.coreBonus.str;
  const eqAgi = player.coreBonus.agi;
  const eqInt = player.coreBonus.int;
  const eqLuk = player.coreBonus.luk || 0;

  const totalStr = player.baseStats.str + eqStr;
  const totalAgi = player.baseStats.agi + eqAgi;
  const totalInt = player.baseStats.int + eqInt;
  const totalLuk = player.baseStats.luk + eqLuk;

  player.currentHP = Math.min(player.currentHP, maxHp);
  player.currentMP = Math.min(player.currentMP, maxMp);

  // 暱稱 / 職業
  const nickEl = document.getElementById("player-nickname");
  if (nickEl) nickEl.textContent = player.nickname;

  const jobEl = document.getElementById("player-job");
  if (jobEl) {
    const jk = (player.job ?? "").toLowerCase();
    const displayName = (typeof jobs !== "undefined" && jobs[jk]?.name) ? jobs[jk].name : player.job;
    jobEl.textContent = displayName;
  }

  const G = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  // 資源
  G("gold", player.gold);
  G("gem", player.gem);
  G("stone", player.stone);
  G("stat-points-display", player.statPoints);

  // 四圍
  const strEl = document.getElementById("str-display");
  const agiEl = document.getElementById("agi-display");
  const intEl = document.getElementById("int-display");
  const lukEl = document.getElementById("luk-display");

  if (strEl) strEl.textContent = `${fmt2(totalStr)} (${fmt2(player.baseStats.str)} + ${fmt2(eqStr)})`;
  if (agiEl) agiEl.textContent = `${fmt2(totalAgi)} (${fmt2(player.baseStats.agi)} + ${fmt2(eqAgi)})`;
  if (intEl) intEl.textContent = `${fmt2(totalInt)} (${fmt2(player.baseStats.int)} + ${fmt2(eqInt)})`;
  if (lukEl) lukEl.textContent = `${fmt2(totalLuk)} (${fmt2(player.baseStats.luk)} + ${fmt2(eqLuk)})`;

  // 狀態圖示
  let statusText = "";
  if (player.statusEffects) {
    for (const key in player.statusEffects) {
      if (player.statusEffects[key] > 0) {
        const emoji = { poison:"☠️", burn:"🔥", paralyze:"⚡", weaken:"🌀", bleed:"🩸", blind:"🌫️", freeze:"❄️", curse:"🧿" }[key];
        statusText += `${emoji}${player.statusEffects[key]} `;
      }
    }
  }

  // HP/MP + 顏色
  const hpEl = document.getElementById("hp");
  const mpEl = document.getElementById("mp");
  const lowHp = player.currentHP / maxHp <= 0.25;
  const lowMp = player.currentMP / maxMp <= 0.25;

  if (hpEl) {
    hpEl.textContent = `${player.currentHP} / ${maxHp} ${statusText}`;
    hpEl.style.color = lowHp ? "#f44336" : "#fff";
    if (lowHp) hpEl.classList.add("danger-blink"); else hpEl.classList.remove("danger-blink");
  }
  if (mpEl) {
    mpEl.textContent = `${player.currentMP} / ${maxMp}`;
    mpEl.style.color = lowMp ? "#03a9f4" : "#fff";
  }

  // Atk/Def（受虛弱/BUFF 顏色）
  let atk = player.totalStats.atk;
  let def = player.totalStats.def;
  let atkColor = "", defColor = "";
  if (player.statusEffects?.weaken > 0) {
    atk = Math.floor(atk * 0.6);
    def = Math.floor(def * 0.6);
    atkColor = "#f44336";
    defColor = "#f44336";
  }
  if (player.statusEffects?.atkBoost) atkColor = "#4caf50";
  if (player.statusEffects?.defBoost) defColor = "#4caf50";

  const atkEl = document.getElementById("atk");
  const defEl = document.getElementById("def");
  if (atkEl) { atkEl.textContent = atk; atkEl.style.color = atkColor; }
  if (defEl) { defEl.textContent = def; defEl.style.color = defColor; }

  // 額外顯示
  const intValueEl = document.getElementById("int-value");
  if (intValueEl) intValueEl.textContent = totalInt;

  const sdEl = document.getElementById("skillDamage");
  if (sdEl) sdEl.textContent = ((player.totalStats.skillDamage || 0) * 100).toFixed(1) + "%";

  // 掉落加成
  G("expRate", ((player.expRateBonus || 0) * 100).toFixed(1) + "%");
  G("dropRate", ((player.dropRateBonus || 0) * 100).toFixed(1) + "%");
  G("goldRate", ((player.goldRateBonus || 0) * 100).toFixed(1) + "%");

  // 連擊率（僅盜賊顯示）
  const comboRow = document.getElementById("comboRateRow");
  const comboVal = document.getElementById("comboRate");
  if (comboRow && comboVal) {
    const baseJob = getBaseJobSafe(player.job);
    if (baseJob === "thief") {
      comboRow.style.display = "";
      comboVal.textContent = `${(player.totalStats.comboRate * 100).toFixed(1)}%`;
    } else {
      comboRow.style.display = "none";
    }
  }

  // 魔力護盾 UI
  const msRow = document.getElementById("manaShieldRow");
  const msBtn = document.getElementById("manaShieldBtn");
  const msPctEl = document.getElementById("manaShieldPct");

  const mage = isMage();
  if (msRow) msRow.style.display = mage ? "" : "none";
  if (msBtn) msBtn.style.display = mage ? "" : "none";

  if (typeof player.manaShieldEnabled === "boolean" && player.manaShieldEnabled !== player.magicShieldEnabled) {
    player.magicShieldEnabled = player.manaShieldEnabled;
  }

  const msPct = (typeof getMagicShieldPercent === "function") ? getMagicShieldPercent() : 0;
  if (msPctEl) msPctEl.textContent = (msPct * 100).toFixed(1) + "%";
  if (msBtn)   msBtn.textContent = "🛡️ 魔力護盾：" + (player.magicShieldEnabled ? "開" : "關");

  // 其他欄位
  G("recover", `${(player.totalStats.recoverPercent * 100).toFixed(1)}%`);
  G("attackSpeed", (player.totalStats.attackSpeedPct * 100).toFixed(2) + "%");
  G("dodge",   `${(player.totalStats.dodgePercent   * 100).toFixed(1)}%`);
  G("player-level", player.level);
  G("player-exp", `${player.exp} / ${player.expToNext}`);
  const expBar = document.getElementById("exp-bar");
  if (expBar) { expBar.value = player.exp; expBar.max = player.expToNext; }
  G("shield", player.shield || 0);
  G("critRate", (player.totalStats.critRate * 100).toFixed(1) + '%');
  G("critMultiplier", (player.totalStats.critMultiplier * 100).toFixed(1) + '%');
  G("damageReduce", (player.totalStats.damageReduce * 100).toFixed(1) + '%');

  // 🔰 新增：總傷害（百分比顯示）
// 總傷害 / 穿防
G("totalDamage", ((player.totalStats.totalDamage || 0) * 100).toFixed(1) + "%");
G("ignoreDefPct", ((player.totalStats.ignoreDefPct || 0) * 100).toFixed(1) + "%");
G("ignoreDefFlat", Math.floor(player.totalStats.ignoreDefFlat || 0));
}

function startGame() {
  const rawNickname = document.getElementById('nicknameInput').value;
  const job = document.getElementById('jobSelect').value;

  const nickname = sanitizeNickname(rawNickname);
  if (!nickname) { alert("暱稱不能為空！"); return; }
  if (nickname.length < NICKNAME_MIN_LEN) { alert(`暱稱至少需要 ${NICKNAME_MIN_LEN} 個字`); return; }
  if (nickname.length > NICKNAME_MAX_LEN) { alert(`暱稱最多 ${NICKNAME_MAX_LEN} 個字`); return; }

  player.nickname = nickname;
  player.job = job;

  initRecoverySystem?.();
  const modal = document.getElementById('gameSetupModal');
  if (modal) modal.style.display = 'none';

  initPlayer();
  updateResourceUI();
  refreshMageOnlyUI();
  rebuildActiveSkills?.();
  ensureSkillEvolution?.();
  renderSkillPanel?.();
  saveGame?.();
}

function toggleStatAlloc() {
  const area = document.getElementById('stat-alloc-area');
  const btn  = document.getElementById('toggleStatAllocBtn');
  if (!area || !btn) return;
  const hidden = getComputedStyle(area).display === 'none';
  area.style.display = hidden ? '' : 'none';
  btn.textContent = hidden ? '隱藏' : '顯示';
}

function toggleExtraStats() {
  const area = document.getElementById('extra-stats');
  const btn  = document.getElementById('toggleExtraStatsBtn');
  if (!area || !btn) return;
  const hidden = getComputedStyle(area).display === 'none';
  area.style.display = hidden ? '' : 'none';
  btn.textContent = hidden ? '隱藏' : '顯示';
}

// 🔑 確保 HTML 的 onclick 可呼叫
window.toggleStatAlloc = toggleStatAlloc;
window.toggleExtraStats = toggleExtraStats;
window.toggleMagicShield = toggleMagicShield;
window.startGame = startGame;

// Boot
document.addEventListener('DOMContentLoaded', () => {
  if (window.__BOOT_DONE__) return;     // 防止重複啟動
  window.__BOOT_DONE__ = true;

  // 先 init，再嘗試載入
  initPlayer();
  const hasSave = loadGame?.() || false;
  const setupModal = document.getElementById('gameSetupModal');

  if (hasSave) {
    if (setupModal) setupModal.style.display = 'none';
    updateResourceUI();
    refreshMageOnlyUI();
    rebuildActiveSkills?.();
    ensureSkillEvolution?.();
    renderSkillPanel?.();
    console.log("已載入存檔，跳過角色設定。");
  } else {
    if (setupModal) setupModal.style.display = 'flex';
    console.log("沒有找到存檔，顯示角色設定畫面。");
  }

  // 限制暱稱輸入長度 + 簡易提示
  const nickInput = document.getElementById('nicknameInput');
  if (nickInput) {
    nickInput.maxLength = NICKNAME_MAX_LEN;
    if (!nickInput.placeholder || /輸入你的暱稱/.test(nickInput.placeholder)) {
      nickInput.placeholder = `請輸入暱稱（${NICKNAME_MIN_LEN}-${NICKNAME_MAX_LEN} 字）`;
    }
  }

  // 每次載入都執行
  refreshMageOnlyUI();
});