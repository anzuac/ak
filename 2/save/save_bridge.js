/* =========================
   save_bridge.js
   統一存檔系統
   ========================= */
(function () {
  console.log("✅ save_bridge.js 已載入");

  const LS_KEY = 'rpg_save_v1';
  const SAVE_VERSION = 1;

  const deepClone = (o) => JSON.parse(JSON.stringify(o || {}));
  const isObj = (x) => x && typeof x === 'object';

  // ---------- 收集 ----------
  function collect_player() {
    const p = window.player || {};
    return deepClone({
      nickname: p.nickname, job: p.job,
      level: p.level, exp: p.exp, expToNext: p.expToNext,
      baseStats: p.baseStats,
      statPoints: p.statPoints,
      magicShieldEnabled: !!p.magicShieldEnabled,
      baseSkillDamage: p.baseSkillDamage,
      currentHP: p.currentHP, currentMP: p.currentMP,
      gold: p.gold, gem: p.gem, stone: p.stone
    });
  }

  function collect_skills() {
    const list = Array.isArray(window.activeSkills) ? window.activeSkills : (window.skills || []);
    return list.map(s => ({
      id: s.id || s.name, job: s.job || 'common',
      level: s.level || 1,
      currentTier: s.currentTier || 0,
      currentCooldown: s.currentCooldown || 0,
      cooldownStart: s.cooldownStart || 0
    }));
  }

  function collect_inventory() {
    return deepClone(window.inventory || {});
  }

  function collect_clover() {
    const cd = window.cloverData || {};
    return deepClone({
      level: cd.level || 0,
      expBonus: cd.expBonus || 0,
      dropBonus: cd.dropBonus || 0,
      goldBonus: cd.goldBonus || 0
    });
  }

  function collect_recovery() {
    const r = window.recoverySystem || {};
    return { level: r.level || 1 };
  }

  function collect_elementGear() {
    const all = window.elementGearData || {};
    const out = {};
    for (const k in all) {
      const eq = all[k] || {};
      out[k] = {
        slotKey: eq.slotKey || k,
        name: eq.name || '',
        level: eq.level || 0,
        advance: eq.advance || 0,
        starforce: eq.starforce || 0,
        break: eq.break || 0,
        isDivine: !!eq.isDivine,
        stats: deepClone(eq.stats || {})
      };
    }
    return out;
  }

  function collectAll() {
    return {
      version: SAVE_VERSION,
      player: collect_player(),
      skills: collect_skills(),
      inventory: collect_inventory(),
      clover: collect_clover(),
      recovery: collect_recovery(),
      elementGear: collect_elementGear()
    };
  }

  // ---------- 套用 ----------
  function apply_player(data) {
    if (!isObj(data) || !window.player) return;
    Object.assign(window.player, data);
    try { window.updateResourceUI?.(); } catch {}
  }

  function apply_skills(data) {
    if (!Array.isArray(data)) return;
    window.rebuildActiveSkills?.();
    const list = Array.isArray(window.activeSkills) ? window.activeSkills : [];
    for (const s of data) {
      const found = list.find(x => (x.id || x.name) === s.id);
      if (found) {
        found.level = s.level;
        found.currentTier = s.currentTier;
        found.currentCooldown = s.currentCooldown;
        found.cooldownStart = s.cooldownStart;
      }
    }
    try { window.ensureSkillEvolution?.(); } catch {}
  }

  function apply_inventory(data) {
    if (isObj(data)) window.inventory = deepClone(data);
  }

  function apply_clover(data) {
    if (isObj(data)) window.cloverData = deepClone(data);
  }

  function apply_recovery(data) {
    if (isObj(data) && window.recoverySystem) {
      window.recoverySystem.level = data.level || 1;
    }
  }

  function apply_elementGear(data) {
    if (isObj(data) && window.elementGearData) {
      for (const k in data) {
        Object.assign(window.elementGearData[k] || {}, data[k]);
      }
    }
  }

  function applyAll(saveObj) {
    if (!isObj(saveObj)) return;
    apply_player(saveObj.player);
    apply_inventory(saveObj.inventory);
    apply_clover(saveObj.clover);
    apply_recovery(saveObj.recovery);
    apply_elementGear(saveObj.elementGear);
    apply_skills(saveObj.skills);
  }

  // ---------- 存讀 ----------
  function saveLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(collectAll()));
      console.log("💾 已存檔");
    } catch (e) {
      console.error("saveLocal failed:", e);
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj.version !== SAVE_VERSION) return;
      applyAll(obj);
      console.log("📂 存檔已載入");
    } catch (e) {
      console.error("loadLocal failed:", e);
    }
  }

  // ---------- 啟動 ----------
  function initAuto() {
    loadLocal();

    // 桌面 / 手機皆可
    window.addEventListener('beforeunload', saveLocal);
    window.addEventListener('pagehide', saveLocal);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveLocal();
    });

    // 保底：30 秒一次
    setInterval(saveLocal, 30000);
  }

  // 對外 API
  window.SaveBridge = { saveLocal, loadLocal, collectAll, applyAll };

  // 自動啟動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuto);
  } else {
    initAuto();
  }
})();