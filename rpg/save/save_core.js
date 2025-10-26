// save_core.js — 單槽穩定版（ASCII NS + 載入初期寫入節流保護）
(() => {
  const NS = "udh333f_37";  // ← 純 ASCII，避免某些環境 key 正規化問題
  const KEY_DATA    = `${NS}:data`;
  const KEY_META    = `${NS}:meta`;
  const KEY_TMP     = `${NS}:tmp`;
  const KEY_BACKUP  = `${NS}:backup`;

  const OLD_NS = "GAME_SAVE_V2";
  const OLD_MANIFEST = `${OLD_NS}:manifest`;
  const OLD_SLOT_A   = `${OLD_NS}:slotA`;
  const OLD_SLOT_B   = `${OLD_NS}:slotB`;
  const OLD_SINGLE   = `${OLD_NS}`;

  const SCHEMA_VERSION = 2;
  const SAVE_MIN_INTERVAL_MS = 1500;
  const FLUSH_TIMEOUT_MS = 3000;

  let savePending = false;
  let lastSaveAt = 0;
  let flushTimer = null;

  // 🚧 載入初期保護：前 2000ms 不主動 flush（避免跟其他模組初始化寫衝）
  const BOOT_TS = Date.now();
  function bootBusy(){ return (Date.now() - BOOT_TS) < 2000; }

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
      elementEquipmentData: (typeof window.getElementGearData === 'function')
        ? window.getElementGearData()
        : (window.elementGearData ?? null),
      inventoryData: window.inventory || {},
      skillsState: (typeof window.Skills_exportState === 'function') ? window.Skills_exportState() : null,
      jobChangeDoneLevels: Array.from(window.__jobChangeDoneLevels || new Set()),
      recoveryLevel: (player?.recoverySystem?.level ?? 1),
      currentHP: Number.isFinite(player.currentHP) ? player.currentHP : undefined,
      currentMP: Number.isFinite(player.currentMP) ? player.currentMP : undefined,
    };
  }

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

  function applyLoadedState(loadedData) {
    player.nickname = (typeof loadedData.nickname === 'string') ? loadedData.nickname : (player.nickname ?? "");
    player.job      = (typeof loadedData.job === 'string') ? loadedData.job : (player.job ?? "");
    player.level    = Number(loadedData.level) || 1;
    player.exp      = Number(loadedData.exp) || 0;
    player.statPoints = Number(loadedData.statPoints) || 0;
    player.gold     = Number(loadedData.gold) || 0;
    player.gem      = Number(loadedData.gem) || 0;
    player.stone    = Number(loadedData.stone) || 0;
    player.magicShieldEnabled = !!loadedData.magicShieldEnabled;
    player.baseSkillDamage = Number(loadedData.baseSkillDamage ?? 0.10);

    if (loadedData.baseStats) Object.assign(player.baseStats, loadedData.baseStats);

    // coreBonusData：確保骨架存在
    if (loadedData.coreBonusData) {
      player.coreBonus = player.coreBonus || {};
      player.coreBonus.bonusData = player.coreBonus.bonusData || {};
      Object.assign(player.coreBonus.bonusData, loadedData.coreBonusData);
    }

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

    const maxHP = player.totalStats?.hp ?? 100;
    const maxMP = player.totalStats?.mp ?? 0;
    if (typeof loadedData.currentHP === 'number') player.currentHP = Math.max(0, Math.min(loadedData.currentHP, maxHP)); else player.currentHP = maxHP;
    if (typeof loadedData.currentMP === 'number') player.currentMP = Math.max(0, Math.min(loadedData.currentMP, maxMP)); else player.currentMP = maxMP;

    player.shield = 0;
    player.statusEffects = {};
    player.expToNext = (typeof window.getExpToNext === 'function') ? window.getExpToNext(player.level) : 100;

    if (typeof window.rebuildActiveSkills === 'function') window.rebuildActiveSkills();
    if (typeof window.updateAllUI === 'function') window.updateAllUI();
    if (typeof window.GameSave__notifyApplied === 'function') window.GameSave__notifyApplied();
  }

  function writeSingle(json) {
    // 1) tmp
    localStorage.setItem(KEY_TMP, json);
    // 2) 主檔 → 備份（若有舊主檔）
    const prev = localStorage.getItem(KEY_DATA);
    if (prev) localStorage.setItem(KEY_BACKUP, prev);
    // 3) 主檔
    localStorage.setItem(KEY_DATA, json);
    // 4) meta
    const sum = checksum(json);
    localStorage.setItem(KEY_META, JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: now(), size: json.length, checksum: sum }));
    // 5) 刪 tmp
    localStorage.removeItem(KEY_TMP);
  }

  function verifyAgainstMeta(raw) {
    const meta = readMeta();
    if (!raw || !meta) return false;
    if (meta.size !== raw.length) return false;
    if (checksum(raw) !== meta.checksum) return false;
    return true;
  }

  function readOldFormatRaw() {
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
    const oldSingle = localStorage.getItem(OLD_SINGLE);
    if (oldSingle) return oldSingle;
    return null;
  }

  function loadSingleRaw() {
    const raw = localStorage.getItem(KEY_DATA);
    if (verifyAgainstMeta(raw)) return raw;
    const bak = localStorage.getItem(KEY_BACKUP);
    if (bak) return bak;
    const tmp = localStorage.getItem(KEY_TMP);
    if (tmp) return tmp;
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
    if (bootBusy()) return; // ⛔ 開場 2 秒內：只標記待寫，先不 flush
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
    try { writeSingle(JSON.stringify(data)); } catch(e) { console.warn("回寫單槽失敗（不影響遊戲進行）：", e); }
    applyLoadedState(data);
    return true;
  }

  function saveGame(){ scheduleSave(); }
  let __loadingOnce__ = false;
  function loadGame() {
    if (__loadingOnce__) return true;
    __loadingOnce__ = true;
    const raw = loadSingleRaw();
    if (!raw) { __loadingOnce__ = false; return false; }
    try { return migrateAndApply(raw); }
    catch (e) { __loadingOnce__ = false; console.error("❌ Load failed:", e); return false; }
  }
  function hasGameSave() {
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