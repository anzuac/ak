/* =========================
   save_bridge.js
   把各系統狀態統一成一份存檔，並支援套用
   ========================= */

(function () {
  const LS_KEY = 'rpg_save_v1';
  const SAVE_VERSION = 1;

  // ---------- 小工具 ----------
  const deepClone = (o) => JSON.parse(JSON.stringify(o || {}));
  const isObj = (x) => x && typeof x === 'object';

  // ---------- 匯出（收集） ----------
  function collect_player() {
    try {
      if (typeof window.Player_exportState === 'function') {
        return window.Player_exportState();
      }
    } catch {}
    // 後備：最小安全集
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
    try {
      if (typeof window.Skills_exportState === 'function') {
        return window.Skills_exportState();
      }
    } catch {}
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
    const inv = window.inventory || {};
    // 直接複製：{name: count}
    return deepClone(inv);
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
        stats: deepClone(eq.stats || {}),
        upgradeStats: deepClone(eq.upgradeStats || {}),
        jobStats: deepClone(eq.jobStats || {})
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

  // ---------- 還原（套用） ----------
  function apply_player(data) {
    if (!isObj(data)) return;
    try {
      if (typeof window.Player_applyState === 'function') {
        window.Player_applyState(data);
      } else if (window.player) {
        const p = window.player;
        const assignIf = (k) => { if (data[k] !== undefined) p[k] = data[k]; };
        assignIf('nickname'); assignIf('job');
        assignIf('level'); assignIf('exp'); assignIf('expToNext');
        if (isObj(data.baseStats)) p.baseStats = deepClone(data.baseStats);
        assignIf('statPoints');
        assignIf('magicShieldEnabled');
        assignIf('baseSkillDamage');
        assignIf('currentHP'); assignIf('currentMP');
        assignIf('gold'); assignIf('gem'); assignIf('stone');
      }
    } finally {
      // 重算與 UI
      try { window.initPlayer?.(); } catch {}
      try { window.refreshMageOnlyUI?.(); } catch {}
      try { window.updateResourceUI?.(); } catch {}
    }
  }

  function apply_skills(data) {
    if (!Array.isArray(data)) return;
    try {
      if (typeof window.Skills_applyState === 'function') {
        window.Skills_applyState(data);
        return;
      }
      // 後備：rebuild 後逐一套入 level / tier / cd
      window.rebuildActiveSkills?.();
      const list = Array.isArray(window.activeSkills) ? window.activeSkills : [];
      for (const s of data) {
        const found = list.find(x => (x.id || x.name) === s.id && (x.job || 'common') === (s.job || 'common'));
        if (!found) continue;
        if (typeof s.level === 'number') found.level = s.level;
        if (typeof s.currentTier === 'number') found.currentTier = s.currentTier;
        if (typeof s.currentCooldown === 'number') found.currentCooldown = s.currentCooldown;
        if (typeof s.cooldownStart === 'number') found.cooldownStart = s.cooldownStart;
      }
      // 讓階段/描述同步
      try { window.ensureSkillEvolution?.(); } catch {}
    } finally {
      try { window.updateResourceUI?.(); } catch {}
    }
  }

  function apply_inventory(data) {
    if (!isObj(data)) return;
    if (!window.inventory) window.inventory = {};
    // 直接覆蓋
    window.inventory = deepClone(data);
    // 如有 UI，就刷新
    try {
      const list = document.getElementById('inventoryList');
      if (list && typeof window.updateInventoryList === 'function') {
        window.updateInventoryList(list);
      }
    } catch {}
  }

  function apply_clover(data) {
    if (!isObj(data)) return;
    if (!window.cloverData) window.cloverData = { level: 0, expBonus: 0, dropBonus: 0, goldBonus: 0 };
    const cd = window.cloverData;
    cd.level = Number(data.level || 0);
    cd.expBonus = Number(data.expBonus || 0);
    cd.dropBonus = Number(data.dropBonus || 0);
    cd.goldBonus = Number(data.goldBonus || 0);
    // 重新掛回 coreBonus 並刷新
    try { window.initializeCloverSystem?.(); } catch {}
    try { window.updateResourceUI?.(); } catch {}
  }

  function apply_recovery(data) {
    if (!isObj(data)) return;
    function applyWhenReady() {
      if (!window.recoverySystem) {
        setTimeout(applyWhenReady, 50);
        return;
      }
      if (typeof data.level === 'number') {
        window.recoverySystem.level = Math.max(1, Math.min(window.recoverySystem.maxLevel || 20, data.level));
      }
      try { window.applySystemPercentToPlayer?.(); } catch {}
      try { window.updateResourceUI?.(); } catch {}
    }
    applyWhenReady();
  }

  function apply_elementGear(data) {
    if (!isObj(data) || !window.elementGearData) return;
    for (const k in data) {
      const src = data[k];
      const dst = window.elementGearData[k] || window.elementGearData[src?.slotKey];
      if (!dst || !src) continue;
      dst.name = src.name || dst.name;
      dst.level = Number(src.level || 0);
      dst.advance = Number(src.advance || 0);
      dst.starforce = Number(src.starforce || 0);
      dst.break = Number(src.break || 0);
      dst.isDivine = !!src.isDivine;
      if (isObj(src.stats)) dst.stats = deepClone(src.stats);
      if (isObj(src.upgradeStats)) dst.upgradeStats = deepClone(src.upgradeStats);
      if (isObj(src.jobStats)) dst.jobStats = deepClone(src.jobStats);
    }
    try { window.applyElementEquipmentBonusToPlayer?.(); } catch {}
    try { window.updateResourceUI?.(); } catch {}
  }

  function applyAll(saveObj) {
    if (!isObj(saveObj)) return;
    // 依照相依性順序套用：player -> inventory/clover/recovery/elementGear -> skills
    apply_player(saveObj.player);
    apply_inventory(saveObj.inventory);
    apply_clover(saveObj.clover);
    apply_recovery(saveObj.recovery);
    apply_elementGear(saveObj.elementGear);
    apply_skills(saveObj.skills);
  }

  // ---------- 本機存讀 ----------
  function saveLocal() {
    const payload = collectAll();
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.error('saveLocal failed:', e);
      return false;
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      if (!obj || obj.version !== SAVE_VERSION) {
        console.warn('存檔版本不符或資料無效，略過。');
        return false;
      }
      applyAll(obj);
      return true;
    } catch (e) {
      console.error('loadLocal failed:', e);
      return false;
    }
  }

  // ---------- 啟動與鉤子 ----------
  function waitReadyThen(fn) {
    // 等待必要全域載好（player / elementGear / skills controller）
    const ok =
      typeof window.player !== 'undefined' &&
      typeof window.elementGearData !== 'undefined' &&
      (typeof window.rebuildActiveSkills === 'function' || Array.isArray(window.activeSkills) || Array.isArray(window.skills));
    if (!ok) return setTimeout(() => waitReadyThen(fn), 50);
    try { fn(); } catch (e) { console.error(e); }
  }

  function initAutoLoad() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => waitReadyThen(loadLocal));
    } else {
      waitReadyThen(loadLocal);
    }
    // 自動存檔：離開頁面前
    window.addEventListener('beforeunload', () => {
      try { saveLocal(); } catch {}
    });
  }

  // ---------- 對外 API ----------
  window.SaveBridge = {
    collectAll,
    applyAll,
    saveLocal,
    loadLocal,
    initAutoLoad,

    // （選配）雲端預留：把 payload 送你 Apps Script / 從雲端取回後 applyAll
    async saveToCloud(url) {
      const payload = collectAll();
      await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },
    async loadFromCloud(url) {
      const res = await fetch(url);
      const obj = await res.json();
      applyAll(obj);
    }
  };
})();