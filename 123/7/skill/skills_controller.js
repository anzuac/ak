// skills_controller.js
(function () {
  // === 技能池：共用 + 各職業 ===
  window.skillPool = window.skillPool || {
    warrior: [], mage: [], archer: [], thief: [], common: []
  };

  // === 對外註冊 API（給技能檔使用） ===
  window.registerCommonSkill = function (skill) {
    skill.isCommon = true;
    skill.job = skill.job || "common";
    skillPool.common.push(skill);
  };
  window.registerJobSkill = function (jobKey, skill) {
    (skillPool[jobKey] ||= []).push(skill);
  };

  // === 合併結果（共用 + 當前職業） ===
  window.activeSkills = window.activeSkills || [];
  function exposeActiveToLegacy() { window.skills = activeSkills; }

  // ===== 小工具 =====
  // 花費 MP 並設定冷卻起點，用「時間戳」推算剩餘秒數，避免跳秒
  window.spendAndCooldown = function (skill, mp) {
    const cost = Number(mp) || 0;
    if (cost > 0 && typeof player?.currentMP === "number") {
      player.currentMP = Math.max(0, player.currentMP - cost);
    }
    const cd = Math.max(0, Number(skill.cooldown) || 0);
    skill.currentCooldown = cd;
    skill.cooldownStart = Date.now(); // ★ 冷卻起算點
  };

  // 計時型 Buff 便利函式
  window.startTimedBuff = function (ms, onEnd) {
    return setTimeout(() => { try { onEnd?.(); } catch {} }, ms);
  };

  // 多階進化工具
  function getActiveTierLocal(skill) {
    const idx = Math.max(0, Math.min(Number(skill.currentTier || 0), (skill.tiers?.length || 1) - 1));
    return skill.tiers?.[idx] || skill;
  }
  window.getActiveTier = getActiveTierLocal;

  window.ensureSkillEvolution = function () {
    const lv = player.level || 1;
    for (const s of activeSkills) {
      if (!Array.isArray(s.tiers) || s.tiers.length === 0) continue;

      let target = 0;
      if (Array.isArray(s.evolveLevels) && s.evolveLevels.length) {
        for (let i = 0; i < s.evolveLevels.length; i++) if (lv >= s.evolveLevels[i]) target = i;
        target = Math.min(target, s.tiers.length - 1);
      } else if (typeof s.evolveLevel === "number") {
        target = lv >= s.evolveLevel ? 1 : 0;
      }
      if ((s.currentTier || 0) === target) continue;

      s.currentTier = target;
      const t = getActiveTierLocal(s);
      s.name = t.name;
      s.mpCost = t.mpCost;
      s.cooldown = t.cooldown;
      s.logic = t.logic;
      s.currentCooldown = 0;
      s.cooldownStart = 0;

      logPrepend?.(`✨ 技能進化：獲得【${t.name}】（MP:${t.mpCost}｜CD:${t.cooldown}）`);
    }
    
  };

  // ====== 技能狀態快取（避免 rebuild 洗掉等級/CD等）======
  const skillState = {}; // key: "job:id" -> {level, currentTier, currentCooldown, ...}
  const RUNTIME_KEYS = [
    "level", "currentTier", "currentCooldown", "cooldownStart",
    "activeUntil", "active", "_timer", "_interval"
  ];
  function keyOf(s) { return `${s.job || "common"}:${s.id || s.name}`; }

  function saveActiveState() {
    if (!Array.isArray(activeSkills)) return;
    for (const s of activeSkills) {
      const k = keyOf(s);
      const stash = (skillState[k] ||= {});
      for (const key of RUNTIME_KEYS) {
        if (s[key] !== undefined) stash[key] = s[key];
      }
      if (s.name) stash._name = s.name;
      if (s.mpCost !== undefined) stash._mpCost = s.mpCost;
      if (s.cooldown !== undefined) stash._cooldown = s.cooldown;
      if (s.logic) stash._logic = s.logic;
    }
  }

  function restoreState(instance) {
    const k = keyOf(instance);
    const stash = skillState[k];
    if (!stash) return instance;

    for (const key of RUNTIME_KEYS) {
      if (stash[key] !== undefined) instance[key] = stash[key];
    }
    if (stash._name) instance.name = stash._name;
    if (stash._mpCost !== undefined) instance.mpCost = stash._mpCost;
    if (stash._cooldown !== undefined) instance.cooldown = stash._cooldown;
    if (stash._logic) instance.logic = stash._logic;

    return instance;
  }

  // ===== 合併：職業在前、共用在後（共用顯示在最下） =====
  window.rebuildActiveSkills = function () {
    saveActiveState();

    const job = (player?.job || '').toLowerCase();
    const jobList = Array.isArray(skillPool[job]) ? skillPool[job] : [];

    window.activeSkills = [
      ...jobList.map(s => restoreState({ ...s })),          // 先職業
      ...skillPool.common.map(s => restoreState({ ...s })), // 後共用
    ];

    ensureSkillEvolution();
    exposeActiveToLegacy();
    
  };

  // 舊介面相容：提供 loadSkillsByJob()
  window.loadSkillsByJob = function () {
    rebuildActiveSkills();
  };

  // ===== 冷卻遞減 + UI 每秒刷新 =====
  setInterval(() => {
    if (!Array.isArray(activeSkills)) return;
    const now = Date.now();

    for (const s of activeSkills) {
      const cd = Math.max(0, Number(s.cooldown) || 0);
      if (cd <= 0) { s.currentCooldown = 0; continue; }

      // 若剛進入或狀態被復原但沒有 cooldownStart，依 currentCooldown 推回起點
      if ((s.currentCooldown || 0) > 0 && !s.cooldownStart) {
        s.cooldownStart = now - (cd - s.currentCooldown) * 1000;
      }

      if (s.cooldownStart) {
        const elapsed = Math.floor((now - s.cooldownStart) / 1000);
        s.currentCooldown = Math.max(0, cd - elapsed);
        if (s.currentCooldown <= 0) {
          s.currentCooldown = 0;
          s.cooldownStart = 0;
        }
      }
    }

     // 秒秒更新顯示
  }, 1000);

  // ===== 進遊戲後自動合併一次（等待 player 與技能載入） =====
  (function waitReady() {
    const hasPlayer = typeof player !== 'undefined';
    const poolFilled =
      (skillPool.common.length +
        skillPool.warrior.length +
        skillPool.mage.length +
        skillPool.archer.length +
        skillPool.thief.length) > 0;

    if (hasPlayer && poolFilled) { rebuildActiveSkills(); return; }
    setTimeout(waitReady, 50);
  })();

  // ===== 打開技能面板前自動重建（雙保險） =====
  (function hookOpen() {
    const hook = () => {
      if (typeof window.openSkillModal === 'function') {
        const _open = window.openSkillModal;
        window.openSkillModal = function (...a) {
          try { rebuildActiveSkills(); } catch {}
          return _open.apply(this, a);
        };
      }
    };
    hook(); setTimeout(hook, 200);
  })();

})();

// === Skills Export / Import (store only levels by skill id) ===
window.Skills_exportState = function () {
  const out = {};
  const take = (arr=[]) => arr.forEach(s => { if (s.id) out[s.id] = s.level || 1; });
  take(skillPool.warrior); take(skillPool.mage);
  take(skillPool.archer);  take(skillPool.thief);
  take(skillPool.common);
  return { levelsById: out };
};
window.Skills_applyState = function (snap) {
  if (!snap || !snap.levelsById) return;
  const apply = (arr=[]) => arr.forEach(s => {
    if (s.id && snap.levelsById[s.id]) s.level = Math.max(1, Math.min(20, snap.levelsById[s.id]));
  });
  apply(skillPool.warrior); apply(skillPool.mage);
  apply(skillPool.archer);  apply(skillPool.thief);
  apply(skillPool.common);
  if (typeof rebuildActiveSkills === 'function') rebuildActiveSkills();
};

