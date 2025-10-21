// ==========================
// save_core.js — 單槽穩定版（取消 A/B，含自救與舊制轉寫）
// ==========================
(() => {
  const NS = "GAME_SAVE_C16";
  const KEY_DATA    = `${NS}:data`;    // 主存檔
  const KEY_META    = `${NS}:meta`;    // 校驗/長度/時間
  const KEY_TMP     = `${NS}:tmp`;     // 寫入時的臨時檔
  const KEY_BACKUP  = `${NS}:backup`;  // 上一次成功保存的備份

  // 舊制（自動轉寫 & 讀取用；不再寫入）
  const OLD_NS = "GAME_SAVE_V2"; // 你的舊 A/B 制
  const OLD_MANIFEST = `${OLD_NS}:manifest`;
  const OLD_SLOT_A   = `${OLD_NS}:slotA`;
  const OLD_SLOT_B   = `${OLD_NS}:slotB`;
  const OLD_SINGLE   = `${OLD_NS}`;    // 舊單鍵（若曾存在）

  const SCHEMA_VERSION = 2;
  const SAVE_MIN_INTERVAL_MS = 1500;
  const FLUSH_TIMEOUT_MS = 3000;

  let savePending = false;
  let lastSaveAt = 0;
  let flushTimer = null;

  function now() { return Date.now(); }
  function checksum(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }
  function safeParse(raw) { try { return JSON.parse(raw); } catch { return null; } }
  function readMeta() { return safeParse(localStorage.getItem(KEY_META)); }

  // ====== 構建存檔 ======
  function buildSaveState() {
    if (typeof player === 'undefined' || !player) return null;
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAt: now(),
      nickname: player.nickname ?? "",
      job: player.job ?? "",
      level: Number(player.level) || 1,
      exp: Number(player.exp) || 0,
      statPoints: Number(player.statPoints) || 0,
      gold: Number(player.gold) || 0,
      gem: Number(player.gem) || 0,
      stone: Number(player.stone) || 0,
      baseStats: {
        hp: Number(player.baseStats?.hp) || 100,
        atk: Number(player.baseStats?.atk) || 10,
        def: Number(player.baseStats?.def) || 5,
        mp: Number(player.baseStats?.mp) || 0,
        str: Number(player.baseStats?.str) || 0,
        agi: Number(player.baseStats?.agi) || 0,
        int: Number(player.baseStats?.int) || 0,
        luk: Number(player.baseStats?.luk) || 0,
      },
      magicShieldEnabled: !!player.magicShieldEnabled,
      baseSkillDamage: Number(player.baseSkillDamage ?? 0.10),
      coreBonusData: player.coreBonus?.bonusData ?? null,
      elementEquipmentData: (typeof window.getElementGearData === 'function') ? window.getElementGearData() : (window.elementGearData ?? null),
      inventoryData: window.inventory || {},
      skillsState: (typeof window.Skills_exportState === 'function') ? window.Skills_exportState() : null,
      jobChangeDoneLevels: Array.from(window.__jobChangeDoneLevels || new Set()),
      recoveryLevel: (player?.recoverySystem?.level ?? 1),
    };
  }

  // ====== 資料遷移 ======
  function migrate(data) {
    if (!data || typeof data !== 'object') return null;
    const v = Number(data.schemaVersion) || 1;
    if (v < 2) {
      if (typeof data.recoveryLevel !== 'number') data.recoveryLevel = 1;
      if (typeof data.baseSkillDamage !== 'number') data.baseSkillDamage = 0.10;
      data.schemaVersion = 2;
    }
    return data;
  }

  // ====== 載入套用 ======
  function applyLoadedState(loadedData) {
    player.nickname = loadedData.nickname ?? player.nickname ?? "";
    player.job      = loadedData.job ?? player.job ?? "";
    player.level    = Number(loadedData.level) || 1;
    player.exp      = Number(loadedData.exp) || 0;
    player.statPoints = Number(loadedData.statPoints) || 0;
    player.gold     = Number(loadedData.gold) || 0;
    player.gem      = Number(loadedData.gem) || 0;
    player.stone    = Number(loadedData.stone) || 0;
    player.magicShieldEnabled = !!loadedData.magicShieldEnabled;
    player.baseSkillDamage = Number(loadedData.baseSkillDamage ?? 0.10);

    if (loadedData.baseStats) Object.assign(player.baseStats, loadedData.baseStats);
    if (loadedData.coreBonusData && player.coreBonus?.bonusData) Object.assign(player.coreBonus.bonusData, loadedData.coreBonusData);
    if (loadedData.inventoryData && window.inventory) Object.assign(window.inventory, loadedData.inventoryData);
    if (loadedData.skillsState && typeof window.Skills_applyState === 'function') window.Skills_applyState(loadedData.skillsState);
    window.__jobChangeDoneLevels = new Set(loadedData.jobChangeDoneLevels || []);
    player.recoverySystem = player.recoverySystem || {};
    player.recoverySystem.level = Number(loadedData.recoveryLevel) || 1;

    if (loadedData.elementEquipmentData) {
      if (window.elementGearData) Object.assign(window.elementGearData, loadedData.elementEquipmentData);
      if (typeof window.applyElementEquipmentBonusToPlayer === 'function') window.applyElementEquipmentBonusToPlayer();
    }

    if (typeof window.recomputeTotalStats === 'function') window.recomputeTotalStats();
    player.currentHP = player.totalStats?.hp ?? 100;
    player.currentMP = player.totalStats?.mp ?? 0;
    player.shield = 0;
    player.statusEffects = {};
    player.expToNext = (typeof window.getExpToNext === 'function') ? window.getExpToNext(player.level) : 100;

    if (typeof window.rebuildActiveSkills === 'function') window.rebuildActiveSkills();
    if (typeof window.updateAllUI === 'function') window.updateAllUI();

    if (typeof window.GameSave__notifyApplied === 'function') {
      window.GameSave__notifyApplied();
    }
  }

  // ====== 單槽安全寫入 ======
  function writeSingle(json) {
    // 1) 寫入 tmp
    localStorage.setItem(KEY_TMP, json);

    // 2) 將現有主檔覆寫到 backup（若有）
    const prev = localStorage.getItem(KEY_DATA);
    if (prev) localStorage.setItem(KEY_BACKUP, prev);

    // 3) 寫主檔
    localStorage.setItem(KEY_DATA, json);

    // 4) 寫 meta（最後寫，代表一次成功的完整寫入）
    const sum = checksum(json);
    localStorage.setItem(KEY_META, JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      savedAt: now(),
      size: json.length,
      checksum: sum
    }));

    // 5) 移除 tmp
    localStorage.removeItem(KEY_TMP);
  }

  function verifyAgainstMeta(raw) {
    const meta = readMeta();
    if (!raw || !meta) return false;
    if (meta.size !== raw.length) return false;
    if (checksum(raw) !== meta.checksum) return false;
    return true;
  }

  // ====== 舊制讀取（僅用於轉寫或救檔） ======
  function readOldFormatRaw() {
    // 優先讀 manifest 指向的 A/B
    const mRaw = localStorage.getItem(OLD_MANIFEST);
    if (mRaw) {
      try {
        const m = JSON.parse(mRaw);
        const activeKey = (m?.active === "slotB") ? OLD_SLOT_B : OLD_SLOT_A;
        const r = localStorage.getItem(activeKey);
        if (r) return r;
        const backupKey = (activeKey === OLD_SLOT_A) ? OLD_SLOT_B : OLD_SLOT_A;
        const r2 = localStorage.getItem(backupKey);
        if (r2) return r2;
      } catch {}
    }
    // 舊單鍵
    const oldSingle = localStorage.getItem(OLD_SINGLE);
    if (oldSingle) return oldSingle;
    return null;
  }

  function loadSingleRaw() {
    // 先讀主檔並驗證
    const raw = localStorage.getItem(KEY_DATA);
    if (verifyAgainstMeta(raw)) return raw;

    // 主檔壞了 → 試 backup
    const bak = localStorage.getItem(KEY_BACKUP);
    if (bak) return bak;

    // 再試 tmp（可能中斷時留下）
    const tmp = localStorage.getItem(KEY_TMP);
    if (tmp) return tmp;

    // 最後試舊制
    const old = readOldFormatRaw();
    if (old) return old;

    return null;
  }

  function saveGameNow() {
    try {
      const state = buildSaveState(); if (!state) return;
      const json = JSON.stringify(state);
      writeSingle(json);
      lastSaveAt = now(); savePending = false;
    } catch (e) {
      console.error("❌ Save failed:", e);
    }
  }

  function scheduleSave() {
    savePending = true;
    const elapsed = now() - lastSaveAt;
    if (elapsed >= SAVE_MIN_INTERVAL_MS) {
      clearTimeout(flushTimer); flushTimer = null;
      saveGameNow();
    } else if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        if (savePending) saveGameNow();
      }, Math.min(SAVE_MIN_INTERVAL_MS - elapsed, FLUSH_TIMEOUT_MS));
    }
  }

  function migrateAndApply(raw) {
    let data = safeParse(raw);
    if (!data) return false;
    data = migrate(data);
    // 若來源不是本制主檔，成功載入後回寫成單槽格式，讓之後更穩定
    try {
      writeSingle(JSON.stringify(data));
    } catch(e) {
      // 回寫失敗也不影響遊戲繼續跑
      console.warn("回寫單槽失敗（不影響遊戲進行）：", e);
    }
    applyLoadedState(data);
    return true;
  }

  // ====== 對外 API ======
  function saveGame(){ scheduleSave(); }
let __loadingOnce__ = false;

function loadGame() {
  if (__loadingOnce__) return true;     // 第二次直接當成功，避免重跑
  __loadingOnce__ = true;

  const raw = loadSingleRaw();
  if (!raw) { __loadingOnce__ = false; return false; } // 沒存檔，允許日後再試

  try {
    const ok = migrateAndApply(raw);
    return ok; // 成功就保持 true，不再重載
  } catch (e) {
    __loadingOnce__ = false;
    console.error("❌ Load failed:", e);
    return false;
  }
}
  function hasGameSave() {
    // 只要主檔/備份/舊制其一存在，就視為「有機會載入」
    return !!(localStorage.getItem(KEY_DATA) ||
              localStorage.getItem(KEY_BACKUP) ||
              localStorage.getItem(KEY_TMP) ||
              localStorage.getItem(OLD_MANIFEST) ||
              localStorage.getItem(OLD_SLOT_A) ||
              localStorage.getItem(OLD_SLOT_B) ||
              localStorage.getItem(OLD_SINGLE));
  }

  window.saveGame = saveGame;
  window.loadGame = loadGame;
  window.hasGameSave = hasGameSave;

  window.addEventListener("beforeunload", () => { if (savePending) saveGameNow(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && savePending) saveGameNow();
  });
})();