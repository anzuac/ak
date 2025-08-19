// =======================
// save_skills.js
// 依賴：skills_controller.js 已載入（有 activeSkills / rebuildActiveSkills / ensureSkillEvolution）
// =======================

(function () {
  // 只存「狀態」：不存 tiers / logic
  const RUNTIME_KEYS = [
    "level",
    "currentTier",
    "currentCooldown",
    "cooldownStart",
    "activeUntil",
    "active",
    // 你若有自動施放/啟用開關等，也可以補充在這裡：
    "isEnabled",
    "autoCast"
  ];

  // 小工具：以 id 作為鍵（避免 name 變動）
  function idOf(s) { return s?.id || s?.name || ""; }

  // 取得剩餘冷卻秒，避免存活時間戳在跨裝置時不同步
  function getCdRemain(s) {
    const cd = Number(s?.cooldown || 0);
    if (!cd) return 0;
    // 以 cooldownStart 推回
    if (s?.cooldownStart) {
      const elapsed = (Date.now() - s.cooldownStart) / 1000;
      return Math.max(0, Math.ceil(cd - elapsed));
    }
    // 以 currentCooldown 為準
    return Math.max(0, Math.ceil(Number(s?.currentCooldown || 0)));
  }

  // 取得 Buff 剩餘秒
  function getBuffRemain(s) {
    const end = Number(s?.activeUntil || 0);
    if (!end) return 0;
    return Math.max(0, Math.ceil((end - Date.now()) / 1000));
  }

  // 導出：把目前所有技能狀態抓成乾淨的 JSON
  window.dumpSkills = function dumpSkills() {
    const list = Array.isArray(window.activeSkills) ? window.activeSkills : (Array.isArray(window.skills) ? window.skills : []);
    const out = [];
    for (const s of list) {
      const one = { id: idOf(s), job: (s?.job || "common") };
      for (const k of RUNTIME_KEYS) if (s[k] !== undefined) one[k] = s[k];

      // 存「剩餘秒數」，載入時再轉回 cooldownStart / activeUntil
      one._cdRemain = getCdRemain(s);
      one._buffRemain = getBuffRemain(s);

      out.push(one);
    }
    return out;
  };

  // 載入：把存檔狀態套回到現有技能實例
  window.loadSkills = function loadSkills(savedList) {
    if (!Array.isArray(savedList) || !savedList.length) return;

    // 確保技能先完成重建（職業 + 共用）
    if (typeof window.rebuildActiveSkills === "function") {
      try { window.rebuildActiveSkills(); } catch {}
    }
    const list = Array.isArray(window.activeSkills) ? window.activeSkills : (Array.isArray(window.skills) ? window.skills : []);
    if (!list.length) return;

    // 做一張 id -> 實例 的索引表
    const byId = new Map(list.map(s => [idOf(s), s]));

    // 逐筆套用
    const now = Date.now();
    for (const sv of savedList) {
      const inst = byId.get(sv.id);
      if (!inst) continue; // 可能這職業不再有這個技能（或你移除了），就跳過

      // 邏輯：先階段，再等級，其它 runtime
      if (typeof sv.currentTier === "number") inst.currentTier = sv.currentTier;
      if (typeof sv.level === "number")       inst.level = sv.level;

      // 冷卻與 Buff 以「剩餘秒」復原為時間戳，避免時鐘不同步
      const cd = Math.max(0, Number(inst.cooldown || 0));
      const cdRemain = Math.max(0, Number(sv._cdRemain || 0));
      if (cd > 0 && cdRemain > 0) {
        inst.currentCooldown = cdRemain;
        inst.cooldownStart = now - (cd - cdRemain) * 1000;
      } else {
        inst.currentCooldown = 0;
        inst.cooldownStart = 0;
      }

      const buffRemain = Math.max(0, Number(sv._buffRemain || 0));
      if (buffRemain > 0) inst.activeUntil = now + buffRemain * 1000;
      else inst.activeUntil = 0;

      // 其餘狀態字段（例如 isEnabled / autoCast）
      if (sv.active !== undefined)     inst.active = sv.active;
      if (sv.isEnabled !== undefined)  inst.isEnabled = sv.isEnabled;
      if (sv.autoCast !== undefined)   inst.autoCast = sv.autoCast;
    }

    // 根據等級再觸發一次進化（避免序列與職業條件不同步）
    if (typeof window.ensureSkillEvolution === "function") {
      try { window.ensureSkillEvolution(); } catch {}
    }
  };

  // （可選）提供本地存取幫手
  const LS_KEY = "rpg_save_skills";
  window.saveSkillsToLocal = () => localStorage.setItem(LS_KEY, JSON.stringify(dumpSkills()));
  window.loadSkillsFromLocal = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      loadSkills(JSON.parse(raw));
    } catch (e) { console.warn("loadSkillsFromLocal failed", e); }
  };
})();