// stats_system/player_save.js
(function () {
  if (!window.GameSave) window.GameSave = {};
  if (!GameSave.adapters) GameSave.adapters = {};

  // 僅序列化純資料，不含 getter 計算值
  function dumpPlayer() {
    const p = window.player || {};
    return {
      __v: 1, // 版本，之後改欄位做兼容用
      nickname: p.nickname,
      job: p.job,
      level: p.level,
      exp: p.exp,
      statPoints: p.statPoints,

      baseStats: { ...p.baseStats },

      currentHP: p.currentHP,
      currentMP: p.currentMP,

      gold: p.gold,
      gem: p.gem,
      stone: p.stone,

      magicShieldEnabled: !!p.magicShieldEnabled,

      // 戰鬥面的小數/百分點設定（保留你現行設計）
      recoverPercent: p.recoverPercent || 0,
      dodgePercent: p.dodgePercent || 0,
      critRate: p.critRate || 0,
      critMultiplier: p.critMultiplier || 0,
      comboRate: p.comboRate || 0,
      shield: p.shield || 0,
      maxShield: p.maxShield || 0,
      damageReduce: p.damageReduce || 0,
      lifestealPercent: p.lifestealPercent || 0,
      doubleHitChance: p.doubleHitChance || 0,
      abnormalInflict: { ...(p.abnormalInflict || {}) },
      statusEffects: { ...(p.statusEffects || {}) },

      baseSkillDamage: p.baseSkillDamage || 0,

      // 這兩個是可擴充的加成來源（物件字典）
      coreBonus: { bonusData: { ...(p.coreBonus?.bonusData || {}) } },
      skillBonus: { bonusData: { ...(p.skillBonus?.bonusData || {}) } },
    };
  }

  function loadPlayer(data) {
    if (!data || typeof data !== 'object') return;

    // 簡易版本兼容（之後若改欄位，可在此做轉換）
    const v = data.__v || 1;

    // 寫回基本欄位
    const p = window.player;
    if (!p) return;

    // 不覆蓋 getter，只覆蓋可寫屬性
    p.nickname = data.nickname ?? p.nickname;
    p.job = data.job ?? p.job;
    p.level = Number.isFinite(data.level) ? data.level : p.level;
    p.exp = Number.isFinite(data.exp) ? data.exp : p.exp;
    p.statPoints = Number.isFinite(data.statPoints) ? data.statPoints : p.statPoints;

    p.baseStats = Object.assign({}, p.baseStats, data.baseStats || {});

    p.currentHP = Number.isFinite(data.currentHP) ? data.currentHP : p.currentHP;
    p.currentMP = Number.isFinite(data.currentMP) ? data.currentMP : p.currentMP;

    p.gold = Number.isFinite(data.gold) ? data.gold : p.gold;
    p.gem  = Number.isFinite(data.gem)  ? data.gem  : p.gem;
    p.stone= Number.isFinite(data.stone)? data.stone: p.stone;

    p.magicShieldEnabled = !!data.magicShieldEnabled;

    p.recoverPercent   = Number(data.recoverPercent   || 0);
    p.dodgePercent     = Number(data.dodgePercent     || 0);
    p.critRate         = Number(data.critRate         || 0);
    p.critMultiplier   = Number(data.critMultiplier   || 0);
    p.comboRate        = Number(data.comboRate        || 0);
    p.shield           = Number(data.shield           || 0);
    p.maxShield        = Number(data.maxShield        || 0);
    p.damageReduce     = Number(data.damageReduce     || 0);
    p.lifestealPercent = Number(data.lifestealPercent || 0);
    p.doubleHitChance  = Number(data.doubleHitChance  || 0);
    p.abnormalInflict  = Object.assign({}, data.abnormalInflict || {});
    p.statusEffects    = Object.assign({}, data.statusEffects   || {});

    p.baseSkillDamage  = Number(data.baseSkillDamage || p.baseSkillDamage || 0);

    // 回寫兩個 bonusData（維持你原本的 getter 設計）
    if (p.coreBonus && p.coreBonus.bonusData && data.coreBonus?.bonusData) {
      p.coreBonus.bonusData = Object.assign({}, data.coreBonus.bonusData);
    }
    if (p.skillBonus && p.skillBonus.bonusData && data.skillBonus?.bonusData) {
      p.skillBonus.bonusData = Object.assign({}, data.skillBonus.bonusData);
    }

    // 重新計算與 UI 刷新
    p.expToNext = (typeof window.getExpToNext === 'function') ? getExpToNext(p.level) : p.expToNext;

    // 修正當前 HP/MP 不超過最大值
    try {
      const maxHp = p.totalStats.hp;
      const maxMp = p.totalStats.mp;
      p.currentHP = Math.max(0, Math.min(p.currentHP || 0, maxHp));
      p.currentMP = Math.max(0, Math.min(p.currentMP || 0, maxMp));
    } catch {}

    // 同步技能進化與畫面
    try { window.ensureSkillEvolution?.(); } catch {}
    try { window.updateResourceUI?.(); } catch {}
  }

  GameSave.adapters.player = {
    key: 'player',
    version: 1,
    dump: dumpPlayer,
    load: loadPlayer
  };
})();