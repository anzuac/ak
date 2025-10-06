// ==========================
// save_core.js  (with facade hook)
// ==========================

(() => {
  const NS = "GAME_SAVE_V2";
  const MANIFEST_KEY = `${NS}:manifest`;
  const SLOT_A = `${NS}:slotA`;
  const SLOT_B = `${NS}:slotB`;
  const OLD_SINGLE_KEY = `${NS}`;
  const LOCK_KEY = `${NS}:lock`;

  const SCHEMA_VERSION = 2;
  const SAVE_MIN_INTERVAL_MS = 1500;
  const FLUSH_TIMEOUT_MS = 3000;
  const LOCK_TTL_MS = 3500;

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
  function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
  function writeText(key, text) { localStorage.setItem(key, text); }
  function readManifest() { return readJSON(MANIFEST_KEY) || null; }
  function writeManifest(m) { writeText(MANIFEST_KEY, JSON.stringify(m)); }

  function tryLock() {
    const nowTs = now();
    const prev = Number(localStorage.getItem(LOCK_KEY));
    if (Number.isFinite(prev) && (nowTs - prev) < LOCK_TTL_MS) return false;
    localStorage.setItem(LOCK_KEY, String(nowTs));
    return true;
  }
  function releaseLock() { localStorage.removeItem(LOCK_KEY); }

  // === 存檔資料 ===
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

    // ✅ 通知 facade：已套用存檔
    if (typeof window.GameSave__notifyApplied === 'function') {
      window.GameSave__notifyApplied();
    }
  }

  // === 原子寫入 / 載入 ===
  function writeAtomic(json) {
    const len = json.length, sum = checksum(json);
    const manifest = readManifest() || { active: "slotA" };
    const target = manifest.active === "slotA" ? SLOT_B : SLOT_A;
    writeText(target, json);
    writeManifest({ schemaVersion: SCHEMA_VERSION, active: (target===SLOT_A?"slotA":"slotB"), savedAt: now(), size: len, checksum: sum });
  }
  function loadFromSlots() {
    const manifest = readManifest();
    const activeKey = (manifest?.active==="slotB")?SLOT_B:SLOT_A;
    const raw = localStorage.getItem(activeKey);
    if (raw) { try { return migrate(JSON.parse(raw)); } catch {} }
    return null;
  }

  function saveGameNow() {
    const release = tryLock();
    try {
      const state = buildSaveState(); if (!state) return;
      writeAtomic(JSON.stringify(state));
      lastSaveAt = now(); savePending = false;
    } catch (e) { console.error("❌ Save failed:", e); }
    finally { if (release) releaseLock(); }
  }
  function scheduleSave() {
    savePending = true;
    const elapsed = now()-lastSaveAt;
    if (elapsed >= SAVE_MIN_INTERVAL_MS) { clearTimeout(flushTimer); flushTimer=null; saveGameNow(); }
    else if (!flushTimer) {
      flushTimer=setTimeout(()=>{ flushTimer=null; if(savePending) saveGameNow(); }, Math.min(SAVE_MIN_INTERVAL_MS-elapsed, FLUSH_TIMEOUT_MS));
    }
  }

  function saveGame(){ scheduleSave(); }
  function loadGame() {
    const data = loadFromSlots();
    if (data) { applyLoadedState(data); return true; }
    return false;
  }

  window.addEventListener("beforeunload", ()=>{ if (savePending) saveGameNow(); });
  document.addEventListener("visibilitychange", ()=>{ if (document.visibilityState==="hidden"&&savePending) saveGameNow(); });

  window.saveGame=saveGame;
  window.loadGame=loadGame;
})();