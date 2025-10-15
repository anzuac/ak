// =======================
// player.js (整合修正版 — 拆出顯示 UI)
// - 總傷害 totalDamage 與 skillDamage/spellDamage 並列
// - 穿防 ignoreDefPct（百分比，遞減疊加：1 - Π(1 - p)）
// - 匯出 deriveFromPrimariesTotals / getIgnoreDefBreakdown（供 UI 使用）
// =======================

const MAX_LEVEL = 200;

function normalizeJob(job) { return (job ?? "").toLowerCase(); }

// 安全取得父系職業（utils_jobs.js 尚未載入時，退回去尾數字）
function getBaseJobSafe(job) {
  const j = String(job || "").toLowerCase();
  if (typeof window.getBaseJob === "function") return window.getBaseJob(j);
  return j.replace(/\d+$/, ""); // mage2/3/4/5 -> mage
}

function roundToTwoDecimals(value) {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return parseFloat(value.toFixed(2));
}

// =====（唯一來源）主屬→衍生係數 =====
// 若未來要調整一律改這裡，即可同步到 UI（player_stats_modal.js）
const STAT_COEFF = {
  atk:  { str: 5,   agi: 5,   int: 5,   luck: 5   },
  def:  { str: 3,   agi: 1.5, int: 1,   luck: 1.5 },
  hp:   { str: 50,  agi: 20,  int: 3,   luck: 20  },
  mp:   { str: 0,   agi: 0,   int: 50,  luck: 0   },
};

// 依主屬總量與職業倍率，推導四維（細到每一主屬的貢獻值）
function deriveFromPrimariesTotals(primaryTotals, jobMult) {
  const out = {
    atk: { str:0, agi:0, int:0, luck:0 },
    def: { str:0, agi:0, int:0, luck:0 },
    hp:  { str:0, agi:0, int:0, luck:0 },
    mp:  { str:0, agi:0, int:0, luck:0 },
  };
  const prims = ["str","agi","int","luck"];
  const slots = ["atk","def","hp","mp"];
  for (const s of slots) {
    for (const p of prims) {
      const coef = (STAT_COEFF[s][p] || 0) * (jobMult[p] ?? 1);
      out[s][p] = (primaryTotals[p] || 0) * coef;
    }
  }
  return out;
}

// 玩家物件
const player = {
  nickname: "",
  job: "",
  level: 1,
  exp: 0,
  expToNext: 0,
  baseStats: { hp: 500, atk: 10, def: 10, mp: 100, str: 0, agi: 0, int: 0, luk: 0 },
  statPoints: 10,

  magicShieldEnabled: false,

  // 強化向
  baseSkillDamage: 0.10,
  baseTotalDamage: 0.0,     // 小數，0.10 = +10%
  baseIgnoreDefPct: 0.05,   // 基礎穿防（百分比）：5%

  // 由各系統寫入的「核心/裝備/寵物…」加成池
  coreBonus: (() => {
    const bonusData = {};
    const calc = (key) =>
      Object.values(bonusData)
        .filter(v => typeof v === 'object' && v[key] !== undefined)
        .reduce((sum, b) => sum + b[key], 0);
    return {
      bonusData,
      get hp() { return calc("hp"); },
      get atk() { return calc("atk"); },
      get def() { return calc("def"); },
      get mp() { return calc("mp"); },
      get str() { return calc("str"); },
      get agi() { return calc("agi"); },
      get int() { return calc("int"); },
      get luk() { return calc("luk"); },
      get skillDamage() { return calc("skillDamage"); },
      get attackSpeedPct() { return calc("attackSpeedPct"); },
      get doubleHitChance() { return calc("doubleHitChance"); },
      get comboRate() { return calc("comboRate"); },
      get expBonus() { return calc("expBonus"); },
      get dropBonus() { return calc("dropBonus"); },
      get goldBonus() { return calc("goldBonus"); },
      get critRate() { return calc("critRate"); },
      get critMultiplier() { return calc("critMultiplier"); },
      get dodgePercent() { return calc("dodgePercent"); },
      get recoverPercent() { return calc("recoverPercent"); },
      get damageReduce() { return calc("damageReduce"); },
      get spellDamage() { return calc("spellDamage"); },
      get totalDamage() { return calc("totalDamage"); },
      get ignoreDefPct() { return calc("ignoreDefPct"); }, // 單純各來源相加；最後在 totalStats 遞減合成
    };
  })(),

  // 由技能群（光環/被動/主動暫態）寫入的加成池
  skillBonus: (() => {
    const bonusData = {};
    const calc = (key) =>
      Object.values(bonusData)
        .filter(v => typeof v === 'object' && v[key] !== undefined)
        .reduce((sum, b) => sum + b[key], 0);
    return {
      bonusData,
      get atkPercent()     { return calc("atk"); },
      get defPercent()     { return calc("def"); },
      get hpPercent()      { return calc("hp"); },
      get mpPercent()      { return calc("mp"); },
      get shield()         { return calc("shield"); },
      get recoverPercent() { return calc("recoverPercent"); },
      get dodgePercent()   { return calc("dodgePercent"); },
      get critRate()       { return calc("critRate"); },
      get critMultiplier() { return calc("critMultiplier"); },
      get damageReduce()   { return calc("damageReduce"); },
      get spellDamage()    { return calc("spellDamage"); },
      get skillDamage()    { return calc("skillDamage"); },
      get attackSpeedPct() { return calc("attackSpeedPct"); },
      get doubleHitChance(){ return calc("doubleHitChance"); },
      get comboRate()      { return calc("comboRate"); },
      get expBonus()       { return calc("expBonus"); },
      get dropBonus()      { return calc("dropBonus"); },
      get goldBonus()      { return calc("goldBonus"); },
      get totalDamage()    { return calc("totalDamage"); },
      get ignoreDefPct()   { return calc("ignoreDefPct"); },
    };
  })(),

  // —— 進階數值（基礎值） ——
  recoverPercent: 0,
  dodgePercent: 0,
  critRate: 0.1,
  critMultiplier: 0.1,
  comboRate: 0,
  shield: 0,
  maxShield: 0,
  damageReduce: 0,
  lifestealPercent: 0,
  doubleHitChance: 0,
  abnormalInflict: { poison: 0, burn: 0, paralyze: 0, weaken: 0 },
  statusEffects: {},

  // —— 即時資源 ——
  currentHP: 0,
  currentMP: 0,

  // —— 貨幣 ——
  gold: 300,
  gem: 300,
  stone: 300,

  // —— 衍生計算暫存 ——
  spellDamageBonus: 0,
  attackSpeedPctBase: 1,

  // 修正：總加成來自核心(clover)和技能(aura)的總和
  get expRateBonus() { return this.coreBonus.expBonus + this.skillBonus.expBonus; },
  get dropRateBonus() { return this.coreBonus.dropBonus + this.skillBonus.dropBonus; },
  get goldRateBonus() { return this.coreBonus.goldBonus + this.skillBonus.goldBonus; },

  get totalStats() {
    // 1) 累計主屬（含核心）與元素裝備
    const eqStr = this.coreBonus.str;
    const eqAgi = this.coreBonus.agi;
    const eqInt = this.coreBonus.int;
    const eqLuk = this.coreBonus.luk;

    const totalStr = this.baseStats.str + eqStr;
    const totalAgi = this.baseStats.agi + eqAgi;
    const totalInt = this.baseStats.int + eqInt;
    const totalLuk = this.baseStats.luk + eqLuk;

    // 2) 職業倍率
    const jobKey  = (this.job ?? "").toLowerCase();
    const baseJob = getBaseJobSafe(jobKey);
    const jm = (typeof jobs !== "undefined" && jobs[jobKey]?.statMultipliers)
      ? jobs[jobKey].statMultipliers
      : { str: 1, agi: 1, int: 1, luck: 1 };

    // 3) 共用推導（確保 UI 與戰鬥一致）
    const derived = deriveFromPrimariesTotals(
      { str: totalStr, agi: totalAgi, int: totalInt, luck: totalLuk },
      { str:(jm.str??1), agi:(jm.agi??1), int:(jm.int??1), luck:(jm.luck??1) }
    );

    // 爆擊率 = 基礎 + skillBonus + coreBonus + （敏捷換算）
    const agiCritRateBonus = totalAgi * (0.001 * (jm.agi ?? 1));
    const baseRateNoAgi =
      (this.critRate || 0) +
      (this.skillBonus.critRate || 0) +
      (this.coreBonus.critRate || 0);

    const finalCritRateRaw = baseRateNoAgi + agiCritRateBonus;

    // 超過 100% 的部分轉爆傷（非敏捷與敏捷兩段分開）
    let critMulBonus = 0;
    if (finalCritRateRaw > 1) {
      const overflowNonAgi = Math.max(0, baseRateNoAgi - 1);
      const overflowAgi = Math.max(0, (finalCritRateRaw - 1) - overflowNonAgi);
      const dmgFromNonAgi = overflowNonAgi * 0.1; // 每 100% 溢出 → +10% 爆傷
      let dmgFromAgi = overflowAgi * 0.1;
      if (getBaseJobSafe(this.job) === "archer") {
        dmgFromAgi = Math.min(dmgFromAgi, 1.5); // 弓箭手敏捷段上限 +150% 爆傷
      }
      critMulBonus = dmgFromNonAgi + dmgFromAgi;
    }
    let finalCritRate = Math.min(1, finalCritRateRaw);

    // INT 轉法傷
    this.spellDamageBonus = Math.floor(totalInt / 10) * 0.01;

    // 基礎四維疊加
    const atkBase =
      this.baseStats.atk + this.coreBonus.atk +
      derived.atk.str + derived.atk.agi + derived.atk.int + derived.atk.luck;

    const defBase =
      this.baseStats.def + this.coreBonus.def +
      derived.def.str + derived.def.agi + derived.def.int + derived.def.luck;

    const hpBase =
      this.baseStats.hp + this.coreBonus.hp +
      derived.hp.str + derived.hp.agi + derived.hp.int + derived.hp.luck;

    const mpBase =
      this.baseStats.mp + this.coreBonus.mp +
      derived.mp.int;

    // 技能傷害（基礎 + core + skill）
    const totalSkillDamage =
      (this.baseSkillDamage || 0) +
      (this.coreBonus.skillDamage || 0) +
      (this.skillBonus.skillDamage || 0);

    // 盜賊連擊率（每 100 LUK = +1%，最多 40%）
    const thiefDoubleHit = (baseJob === "thief")
      ? Math.min(0.4, totalLuk * 0.0001)
      : 0;

    // 劍士特性：力量轉換減傷率（每 100 STR = +1%，最多 30%）
    let warriorDR = 0;
    if (baseJob === "warrior") {
      warriorDR = Math.min(0.30, totalStr * 0.0001);
    }

    // 最終減傷率（全職業上限 70%）
    let finalDamageReduce =
      (Number(this.damageReduce) || 0) +
      (Number(this.skillBonus.damageReduce) || 0) +
      warriorDR;
    finalDamageReduce = Math.min(finalDamageReduce, 0.70);

    // --- 穿防百分比（遞減疊加：1 - Π(1 - p)）---
    const gatherPctFrom = (bonusData) =>
      Object.values(bonusData || {})
        .map(v => Number(v?.ignoreDefPct) || 0)
        .filter(x => x > 0);

    const pctSources = [
      Number(this.baseIgnoreDefPct) || 0,
      ...gatherPctFrom(this.coreBonus.bonusData),
      ...gatherPctFrom(this.skillBonus.bonusData),
    ].filter(x => x > 0);

    let combinedIgnoreDefPct = 0;
    if (pctSources.length > 0) {
      const product = pctSources.reduce((acc, p) => acc * (1 - Math.max(0, Math.min(p, 1))), 1);
      combinedIgnoreDefPct = 1 - product;
      combinedIgnoreDefPct = Math.min(Math.max(combinedIgnoreDefPct, 0), 0.9999); // 上限 99.99%
    }

    return {
      atk: Math.floor(atkBase * (1 + this.skillBonus.atkPercent)),
      def: Math.floor(defBase * (1 + this.skillBonus.defPercent)),
      hp:  Math.floor(hpBase  * (1 + this.skillBonus.hpPercent)),
      mp:  Math.floor(mpBase  * (1 + this.skillBonus.mpPercent)),
      shield: this.skillBonus.shield,

      recoverPercent:
        (Number(this.recoverPercentBaseDecimal ?? this.recoverPercent) || 0) +
        (Number(this.skillBonus.recoverPercent) || 0) +
        (Number(this.coreBonus.recoverPercent) || 0),

      dodgePercent: (Number(this.dodgePercent) || 0) +
                    (Number(this.skillBonus.dodgePercent) || 0) +
                    (Number(this.coreBonus.dodgePercent) || 0),

      critRate:       Math.max(0, Math.min(1, finalCritRate)),
      critMultiplier: (Number(this.critMultiplier) || 0) +
                      (Number(this.skillBonus.critMultiplier) || 0) +
                      (Number(this.coreBonus.critMultiplier) || 0) +
                      critMulBonus,

      attackSpeedPct: (
        (Number(this.attackSpeedPctBase) || 0) +
        (Number(this.coreBonus.attackSpeedPct) || 0) +
        (Number(this.skillBonus.attackSpeedPct) || 0)
      ),

      damageReduce: finalDamageReduce,

      spellDamage: (Number(this.spellDamageBonus)||0) + (Number(this.skillBonus.spellDamage) || 0),
      skillDamage: totalSkillDamage,

      // 總傷害（base + core + skill）
      totalDamage: (
        (Number(this.baseTotalDamage) || 0) +
        (Number(this.coreBonus.totalDamage) || 0) +
        (Number(this.skillBonus.totalDamage) || 0)
      ),

      // 穿防（遞減合成後百分比）
      ignoreDefPct:  combinedIgnoreDefPct,

      comboRate: (
        (Number(this.comboRate) || 0) +
        (Number(this.coreBonus.comboRate) || 0) +
        (Number(this.skillBonus.comboRate) || 0) +
        thiefDoubleHit
      ),

      doubleHitChance: (
        (Number(this.doubleHitChance) || 0) +
        (Number(this.coreBonus.doubleHitChance) || 0) +
        (Number(this.skillBonus.doubleHitChance) || 0) +
        thiefDoubleHit
      ),
    };
  }
};

// ===== 魔盾（法師專屬）=====
function getMagicShieldPercent() {
  const isMage = (getBaseJobSafe(player?.job) === "mage");
  if (!isMage || !player.magicShieldEnabled) return 0;

  const maxPct = 0.7;
  const capInt = 4000;
  const alpha  = 0.6;

  const totalInt = (player.baseStats.int || 0) + (player.coreBonus.int || 0);
  const x = Math.max(0, Math.min(totalInt, capInt));
  const ratio = Math.pow(x / capInt, alpha);
  return maxPct * ratio;
}
window.getMagicShieldPercent = getMagicShieldPercent;

// ===== 升級與經驗 =====
function getExpToNext(level) {
  if (level >= MAX_LEVEL) return 1;
  let exp = 30;
  for (let i = 1; i < level; i++) {
    if (i <= 10) exp *= 1.35;
    else if (i <= 30) exp *= 1.2;
    else if (i <= 50) exp *= 1.13;
    else if (i <= 70) exp *= 1.1;
    else exp *= 1.05;
  }
  return Math.round(exp);
}

function levelUp() {
  if (player.level >= MAX_LEVEL) return;
  player.level++;
  player.expToNext = getExpToNext(player.level);
  player.statPoints += 5;
  player.currentHP = player.totalStats.hp;
  player.currentMP = player.totalStats.mp;
  if (typeof logPrepend === "function") logPrepend?.(`📈 等級提升！目前等級：${player.level}`);
  if (typeof updateResourceUI === "function") updateResourceUI?.();
  if (typeof ensureSkillEvolution === "function") ensureSkillEvolution?.();
}

function gainExp(amount) {
  const mult = 1 + (player.expRateBonus || 0);
  const delta = Math.round((amount * mult) + Number.EPSILON);
  player.exp = Math.round((player.exp + delta) + Number.EPSILON);
  while (player.exp >= player.expToNext && player.level < MAX_LEVEL) {
    player.exp -= player.expToNext;
    player.exp = Math.max(0, Math.round(player.exp + Number.EPSILON));
    levelUp();
  }
  if (typeof updateResourceUI === "function") updateResourceUI?.();
}

// ===== 屬性分配 =====
// 支援一次加多點：amount 可為數字或 "all"
function allocateStat(attribute, amount = 1) {
  if (player.statPoints <= 0) { alert("沒有可用的屬性點數！"); return; }

  let toSpend = 1;
  if (amount === "all") toSpend = player.statPoints;
  else if (typeof amount === "number") toSpend = Math.max(1, Math.floor(amount));

  const jobKey = (player.job ?? "").toLowerCase();
  const currentJob = (typeof jobs !== "undefined") ? jobs[jobKey] : null;
  if (!currentJob) { console.error("找不到對應的職業！"); return; }

  const m = currentJob.statMultipliers || {};
  const multiplier =
    attribute === "luk" ? (m.luck ?? 0) :
    attribute === "str" ? (m.str ?? 0) :
    attribute === "agi" ? (m.agi ?? 0) :
    attribute === "int" ? (m.int ?? 0) : 0;

  if (!["str", "agi", "int", "luk"].includes(attribute)) return;

  if (multiplier === 0) {
    const ok = confirm(`這是 ${currentJob.name} 的非主要屬性，分配點數將不會有任何效果。你確定要分配 ${toSpend} 點嗎？`);
    if (!ok) return;
  }

  const spend = Math.min(player.statPoints, toSpend);
  if (spend <= 0) return;

  player.baseStats[attribute] += spend;
  player.statPoints -= spend;

  if (typeof updateResourceUI === "function") updateResourceUI?.();
  if (typeof logPrepend === "function") logPrepend?.(`✨ 成功分配 ${spend} 點到 ${attribute.toUpperCase()}！`);
  saveGame?.();
}

// ===== 自動回復（每 30 秒）=====
function startAutoRecover() {
  setInterval(() => {
    const maxHP = player.totalStats.hp;
    const maxMP = player.totalStats.mp;
    const hpRecover = Math.ceil(maxHP * 0.00);
    const mpRecover = Math.ceil(maxMP * 0.00);
    player.currentHP = Math.min(player.currentHP + hpRecover, maxHP);
    player.currentMP = Math.min(player.currentMP + mpRecover, maxMP);
    if (typeof updateResourceUI === "function") updateResourceUI?.();
  }, 30000);
}

// ===== 初始化 =====
function initPlayer() {
  if (typeof player === "undefined") return setTimeout(initPlayer, 50);
  if (typeof applyElementEquipmentBonusToPlayer === 'function') applyElementEquipmentBonusToPlayer();
  player.expToNext = getExpToNext(player.level);
  player.currentHP = player.totalStats.hp;
  player.currentMP = player.totalStats.mp;
  startAutoRecover();
  // 如果 UI 模組（player_stats_modal.js）已載入，這裡會建立面板骨架
  if (typeof createStatModal === "function") createStatModal();
  if (typeof updateResourceUI === "function") updateResourceUI?.();
  if (typeof refreshMageOnlyUI === "function") refreshMageOnlyUI?.();
  if (typeof ensureSkillEvolution === "function") ensureSkillEvolution?.();
}

// ===== 導出 =====
window.player = player;
window.allocateStat = allocateStat;

// 導出共用推導 / 穿防拆解（給 UI 用）
window.deriveFromPrimariesTotals = deriveFromPrimariesTotals;
window.getIgnoreDefBreakdown = function getIgnoreDefBreakdown() {
  const src = [];
  const pushIf = (label, p) => { p = Number(p)||0; if (p>0) src.push({label, p}); };
  // 基礎
  pushIf("基礎", player.baseIgnoreDefPct);
  // coreBonus
  Object.entries(player.coreBonus.bonusData || {}).forEach(([k, v]) => {
    if (v && typeof v.ignoreDefPct === "number" && v.ignoreDefPct > 0) {
      pushIf("核心："+k, v.ignoreDefPct);
    }
  });
  // skillBonus
  Object.entries(player.skillBonus.bonusData || {}).forEach(([k, v]) => {
    if (v && typeof v.ignoreDefPct === "number" && v.ignoreDefPct > 0) {
      pushIf("技能："+k, v.ignoreDefPct);
    }
  });
  const product = src.reduce((acc, s) => acc * (1 - Math.max(0, Math.min(s.p, 1))), 1);
  const combined = Math.min(Math.max(1 - product, 0), 0.9999);
  return { sources: src, product, combined };
};

// 啟動
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initPlayer);
else initPlayer();