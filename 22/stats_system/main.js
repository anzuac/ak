// =======================
// main.js (整合修正版 - 無職業回退/轉換 / 暱稱限制版)
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
function getBaseJobSafe(job) { // [CHANGED] 新增的小工具，不會影響其他功能
  const j = (job || "").toLowerCase();
  return (typeof window.getBaseJob === "function") ? window.getBaseJob(j) : j;
}

document.addEventListener('DOMContentLoaded', () => {
    // 先載入 core 和 player 數據
    initPlayer(); 

    // 嘗試從 Local Storage 載入遊戲存檔
    const hasSave = loadGame(); // loadGame() 會回傳 true/false
    const setupModal = document.getElementById('gameSetupModal');

    if (hasSave) {
        // 如果成功載入存檔，隱藏設定畫面
        if (setupModal) setupModal.style.display = 'none';
        // 並且直接更新 UI
        updateResourceUI();
        refreshMageOnlyUI();
        rebuildActiveSkills();
        ensureSkillEvolution?.();
        renderSkillPanel?.();
        console.log("已載入存檔，跳過角色設定。");
    } else {
        // 如果沒有存檔，顯示設定畫面
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


function startGame() {
  const rawNickname = document.getElementById('nicknameInput').value;
  const job = document.getElementById('jobSelect').value;

  // 淨化 + 嚴格檢查
  const nickname = sanitizeNickname(rawNickname);
  if (!nickname) { alert("暱稱不能為空！"); return; }
  if (nickname.length < NICKNAME_MIN_LEN) { alert(`暱稱至少需要 ${NICKNAME_MIN_LEN} 個字`); return; }
  if (nickname.length > NICKNAME_MAX_LEN) { alert(`暱稱最多 ${NICKNAME_MAX_LEN} 個字`); return; }

  player.nickname = nickname;
  player.job = job;

  // ====== 新增邏輯：只在第一次創建角色時歸零資源 ======
  // 我們不需要在每次呼叫 startGame 時都重置資源
  // 遊戲的資源應該由其他函式來管理
  
  initRecoverySystem?.();
  const modal = document.getElementById('gameSetupModal');
  if (modal) modal.style.display = 'none';

  initPlayer();
  updateResourceUI();
  refreshMageOnlyUI();
  rebuildActiveSkills();
  ensureSkillEvolution?.();
  renderSkillPanel?.();

  // 這一行是關鍵！請確認它已經存在！
  saveGame(); 
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

  if (strEl) strEl.textContent = `${totalStr} (${player.baseStats.str} + ${eqStr})`;
  if (agiEl) agiEl.textContent = `${totalAgi} (${player.baseStats.agi} + ${eqAgi})`;
  if (intEl) intEl.textContent = `${totalInt} (${player.baseStats.int} + ${eqInt})`;
  if (lukEl) lukEl.textContent = `${totalLuk} (${player.baseStats.luk} + ${eqLuk})`;

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
    // [CHANGED] 用 baseJob 判斷，讓 thief2/3/4/5 也顯示
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

  const mage = isMage(); // [CHANGED] isMage 內部改用 baseJob
  if (msRow) msRow.style.display = mage ? "" : "none";
  if (msBtn) msBtn.style.display = mage ? "" : "none";

  // 舊欄位相容（可留）
  if (typeof player.manaShieldEnabled === "boolean" && player.manaShieldEnabled !== player.magicShieldEnabled) {
    player.magicShieldEnabled = player.manaShieldEnabled;
  }

  const msPct = (typeof getMagicShieldPercent === "function") ? getMagicShieldPercent() : 0;
  if (msPctEl) msPctEl.textContent = (msPct * 100).toFixed(1) + "%";
  if (msBtn)   msBtn.textContent = "🛡️ 魔力護盾：" + (player.magicShieldEnabled ? "開" : "關");

  // 其他欄位
  G("recover", `${(player.totalStats.recoverPercent * 100).toFixed(1)}%`);
  G("dodge",   `${(player.totalStats.dodgePercent   * 100).toFixed(1)}%`);
  G("player-level", player.level);
  G("player-exp", `${player.exp} / ${player.expToNext}`);
  const expBar = document.getElementById("exp-bar");
  if (expBar) { expBar.value = player.exp; expBar.max = player.expToNext; }
  G("shield", player.shield || 0);
  G("critRate", (player.totalStats.critRate * 100).toFixed(1) + '%');
  G("critMultiplier", (player.totalStats.critMultiplier * 100).toFixed(1) + '%');
  // 注意：你的 totalStats.damageReduce 是小數(0~0.6)，顯示成百分比
  G("damageReduce", (player.totalStats.damageReduce * 100).toFixed(1) + '%');
}

function initPlayer() {
  if (typeof player === "undefined") return setTimeout(initPlayer, 50);
  if (typeof applyElementEquipmentBonusToPlayer === 'function') applyElementEquipmentBonusToPlayer();
  player.expToNext = getExpToNext(player.level);
  player.currentHP = player.totalStats.hp;
  player.currentMP = player.totalStats.mp;
  startAutoRecover();
  createStatModal();
  updateResourceUI();
  refreshMageOnlyUI();
}

// ====== 法師專用 UI/邏輯 ======
function isMage() {
  // [CHANGED] 用 baseJob 判斷（轉職後仍視為法師系）
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

// ====== 顯示/隱藏：屬性分配區 & 進階能力 ======
function toggleStatAlloc() {
  const area = document.getElementById('stat-alloc-area');
  const btn  = document.getElementById('toggleStatAllocBtn');
  if (!area || !btn) return;
  const hidden = getComputedStyle(area).display === 'none';
  area.style.display = hidden ? '' : 'none';
  btn.textContent = hidden ? '隱藏' : '顯示';
}
// document.addEventListener('DOMContentLoaded', () => { toggleStatAlloc(); });

function toggleExtraStats() {
  const area = document.getElementById('extra-stats');
  const btn  = document.getElementById('toggleExtraStatsBtn');
  if (!area || !btn) return;
  const hidden = getComputedStyle(area).display === 'none';
  area.style.display = hidden ? '' : 'none';
  btn.textContent = hidden ? '隱藏' : '顯示';
}

// 🔑 確保 HTML 的 onclick 可呼叫（只新增這兩行）
window.toggleStatAlloc = toggleStatAlloc;   // [EXPOSE]
window.toggleExtraStats = toggleExtraStats; // [EXPOSE]
window.toggleMagicShield = toggleMagicShield; // 原本就有，也保留