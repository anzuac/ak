// =======================
// player.js (整合修正版 - 無職業回退/轉換)
// =======================

const MAX_LEVEL = 100;

function normalizeJob(job) { return (job ?? "").toLowerCase(); }

function roundToTwoDecimals(value) {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return parseFloat(value.toFixed(2));
}

// 玩家物件
const player = {
  nickname: "冒險者",
  job: "新手",
  level: 1,
  exp: 0,
  expToNext: 0,
  baseStats: { hp: 500, atk: 50, def: 20, mp: 100, str: 0, agi: 0, int: 0, luk: 0 },
  statPoints: 10,
  magicShieldEnabled: false,
  baseSkillDamage: 0.10,





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
    
    // 掉落類
    get expBonus() { return calc("expBonus"); },
    get dropBonus() { return calc("dropBonus"); },
    get goldBonus() { return calc("goldBonus"); },
    
    // 🆕 戰鬥類（技能樹會寫到 coreBonus，這裡要能讀）
    get critRate() { return calc("critRate"); },
    get critMultiplier() { return calc("critMultiplier"); },
    get dodgePercent() { return calc("dodgePercent"); }, // 注意：這是「百分點」數值（例：1 = 1%）
    get recoverPercent() { return calc("recoverPercent"); }, // 小數（例：0.02 = 2%）
    get damageReduce() { return calc("damageReduce"); },
    get spellDamage() { return calc("spellDamage"); },
  };
})(),
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

      // 🆕 新增：在 skillBonus 中加入 exp/drop/gold 加成
      get expBonus() { return calc("expBonus"); },
      get dropBonus() { return calc("dropBonus"); },
      get goldBonus() { return calc("goldBonus"); },
    };
  })(),


  recoverPercent: 0,
  dodgePercent: 0,
  critRate: 0,
  critMultiplier: 0,
  comboRate: 0,
  shield: 0,
  maxShield: 0,
  damageReduce: 0,
  lifestealPercent: 0,
  doubleHitChance: 0,
  abnormalInflict: { poison: 0, burn: 0, paralyze: 0, weaken: 0 },
  statusEffects: {},
  currentHP: 0,
  currentMP: 0,
  gold: 0,
  gem: 0,
  stone: 0,
  spellDamageBonus: 0,



  // 修正：總加成來自核心(clover)和技能(aura)的總和
  get expRateBonus() { return this.coreBonus.expBonus + this.skillBonus.expBonus; },
  get dropRateBonus() { return this.coreBonus.dropBonus + this.skillBonus.dropBonus; },
  get goldRateBonus() { return this.coreBonus.goldBonus + this.skillBonus.goldBonus; },



get totalStats() {
  const eqStr = this.coreBonus.str;
  const eqAgi = this.coreBonus.agi;
  const eqInt = this.coreBonus.int;
  const eqLuk = this.coreBonus.luk;
  
  const totalStr = this.baseStats.str + eqStr;
  const totalAgi = this.baseStats.agi + eqAgi;
  const totalInt = this.baseStats.int + eqInt;
  const totalLuk = this.baseStats.luk + eqLuk;
  
  const jobKey = (this.job ?? "").toLowerCase();
  const jm = (typeof jobs !== "undefined" && jobs[jobKey]?.statMultipliers) ?
    jobs[jobKey].statMultipliers :
    { str: 1, agi: 1, int: 1, luck: 1 };
  
  const strAtk = totalStr * (4 * (jm.str ?? 1));
  const strDef = totalStr * (2 * (jm.str ?? 1));
  const strHp  = totalStr * (30 * (jm.str ?? 1));
  
  const agiAtk = totalAgi * (4 * (jm.agi ?? 1));
  const agiDef = totalAgi * (0.5 * (jm.agi ?? 1));
  const agiHp  = totalAgi * (10 * (jm.agi ?? 1));
  
  const intAtk = totalInt * (4 * (jm.int ?? 1));
  const intDef = totalInt * (0.5 * (jm.int ?? 1));
  const intHp  = totalInt * (3 * (jm.int ?? 1));
  const intMp  = totalInt * (30 * (jm.int ?? 1));
  
  const lukAtk = totalLuk * (4 * (jm.luck ?? 1));
  const lukDef = totalLuk * (0.5 * (jm.luck ?? 1));
  const lukHp  = totalLuk * (10 * (jm.luck ?? 1));
  
  // 敏捷帶來的爆率加成
  const agiCritRateBonus = totalAgi * (0.001 * (jm.agi ?? 1));
  
  // ⬇️ 爆擊率 = 基礎 + skillBonus + coreBonus + 敏捷
  let finalCritRate =
    this.critRate +
    this.skillBonus.critRate +
    this.coreBonus.critRate +
    agiCritRateBonus;
  
  // 超過 100% 的部分換成爆傷加成
  let critMulBonus = 0;
  if (finalCritRate > 1) {
    critMulBonus = (finalCritRate - 1) * 0.1;
    finalCritRate = 1;
  }
  
  this.spellDamageBonus = Math.floor(totalInt / 10) * 0.01;
  
  const atkBase = this.baseStats.atk + this.coreBonus.atk + strAtk + agiAtk + intAtk + lukAtk;
  const defBase = this.baseStats.def + this.coreBonus.def + strDef + agiDef + intDef + lukDef;
  const hpBase  = this.baseStats.hp + this.coreBonus.hp + strHp + agiHp + intHp + lukHp;
  const mpBase  = this.baseStats.mp + this.coreBonus.mp + intMp;
  
  const totalSkillDamage =
    (this.baseSkillDamage || 0) +
    (this.coreBonus.skillDamage || 0) +
    (this.skillBonus.skillDamage || 0);
  
  // 盜賊連擊率（每 100 LUK = +1%，最多 40%）
  const thiefDoubleHit = (jobKey === "thief")
    ? Math.min(0.40, totalLuk * 0.0001)
    : 0;

  // 劍士特性：力量轉換減傷率（每 100 STR = +1%，最多 30%）
  let warriorDR = 0;
  if (jobKey === "warrior" || jobKey === "swordsman") {
    warriorDR = Math.min(0.30, totalStr * 0.0001);
  }

  // 最終減傷率（全職業上限 60%）
  let finalDamageReduce =
    (Number(this.damageReduce) || 0) +
    (Number(this.skillBonus.damageReduce) || 0) +
    warriorDR;

  finalDamageReduce = Math.min(finalDamageReduce, 0.70);

  return {
    atk: Math.floor(atkBase * (1 + this.skillBonus.atkPercent)),
    def: Math.floor(defBase * (1 + this.skillBonus.defPercent)),
    hp:  Math.floor(hpBase  * (1 + this.skillBonus.hpPercent)),
    mp:  Math.floor(mpBase  * (1 + this.skillBonus.mpPercent)),
    shield: this.skillBonus.shield,

    recoverPercent: (Number(this.recoverPercent) || 0) + (Number(this.skillBonus.recoverPercent) || 0),
    dodgePercent:   (Number(this.dodgePercent)   || 0) + (Number(this.skillBonus.dodgePercent)   || 0),

    critRate:       Math.max(0, Math.min(1, finalCritRate)),
    critMultiplier: (Number(this.critMultiplier) || 0) + (Number(this.skillBonus.critMultiplier) || 0) + critMulBonus,

    // ✅ 減傷率套用特性 + 上限
    damageReduce:   finalDamageReduce,

    spellDamage:    (Number(this.spellDamageBonus)||0) + (Number(this.skillBonus.spellDamage)     || 0),
    skillDamage:     totalSkillDamage,

    // 盜賊連擊
    comboRate:        (Number(this.comboRate)        || 0) + thiefDoubleHit,
    doubleHitChance:  (Number(this.doubleHitChance)  || 0) + thiefDoubleHit,
  };
}
};

function getMagicShieldPercent() {
  const isMage = ((player.job ?? "").toLowerCase() === "mage");
  if (!isMage || !player.magicShieldEnabled) return 0;

  const maxPct = 0.7;
  const capInt = 6000;
  const alpha  = 0.6;

  const totalInt = (player.baseStats.int || 0) + (player.coreBonus.int || 0);
  const x = Math.max(0, Math.min(totalInt, capInt));
  const ratio = Math.pow(x / capInt, alpha);
  return maxPct * ratio;
}
window.getMagicShieldPercent = getMagicShieldPercent;

function getExpToNext(level) {
  if (level >= MAX_LEVEL) return 1;
  let exp = 100;
  for (let i = 1; i < level; i++) {
    if (i <= 10) exp *= 1.5;
    else if (i <= 30) exp *= 1.25;
    else if (i <= 50) exp *= 1.20;
    else if (i <= 70) exp *= 1.15;
    else exp *= 1.1;
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
  // 總倍率後的經驗值，入庫前四捨五入避免浮點尾數
  const mult = 1 + (player.expRateBonus || 0);
  const delta = Math.round((amount * mult) + Number.EPSILON);
  
  // 寫回玩家經驗值也做一次整數化保險
  player.exp = Math.round((player.exp + delta) + Number.EPSILON);
  
  // 升級檢查：每次扣除後把剩餘 EXP 也矯正成整數，避免殘小數卡住 while 條件
  while (player.exp >= player.expToNext && player.level < MAX_LEVEL) {
    player.exp -= player.expToNext;
    player.exp = Math.max(0, Math.round(player.exp + Number.EPSILON));
    levelUp();
  }
  
  if (typeof updateResourceUI === "function") updateResourceUI?.();
}

function allocateStat(attribute) {
  if (player.statPoints <= 0) { alert("沒有可用的屬性點數！"); return; }
  const jobKey = (player.job ?? "").toLowerCase();
  const currentJob = (typeof jobs !== "undefined") ? jobs[jobKey] : null;
  if (!currentJob) { console.error("找不到對應的職業！"); return; }

  const m = currentJob.statMultipliers || {};
  const multiplier =
    attribute === "luk" ? (m.luck ?? 0) :
    attribute === "str" ? (m.str ?? 0) :
    attribute === "agi" ? (m.agi ?? 0) :
    attribute === "int" ? (m.int ?? 0) : 0;

  if (multiplier === 0) {
    const ok = confirm(`這是 ${currentJob.name} 的非主要屬性，分配點數將不會有任何效果。你確定要分配嗎？`);
    if (!ok) return;
  }

  if (["str","agi","int","luk"].includes(attribute)) {
    player.baseStats[attribute]++;
    player.statPoints--;
    if (typeof updateResourceUI === "function") updateResourceUI?.();
    if (typeof logPrepend === "function") logPrepend?.(`✨ 成功分配 1 點到 ${attribute.toUpperCase()}！`);
  }
}

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

function createStatModal() {
  if (document.getElementById("statModal")) return;
  const modal = document.createElement("div");
  modal.id = "statModal";
  modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); display: none; z-index: 9999; justify-content: center; align-items: center;`;
  const content = document.createElement("div");
  content.id = "statModalContent";
  content.style.cssText = `background: #fff; padding: 20px; border-radius: 10px; max-width: 90%; max-height: 80%; overflow-y: auto; color: #000; font-size: 15px;`;
  const close = document.createElement("button");
  close.textContent = "✖";
  close.style.cssText = `position: absolute; top: 15px; right: 20px; font-size: 20px; border: none; background: transparent; color: #fff; cursor: pointer;`;
  close.onclick = () => { modal.style.display = "none"; };
  modal.appendChild(content);
  modal.appendChild(close);
  document.body.appendChild(modal);
}

function openStatModal() {
  const content = document.getElementById("statModalContent");
  if (!content) return;
  const { baseStats, coreBonus, skillBonus } = player;
  const total = player.totalStats;

  const jobKey = (player.job ?? "").toLowerCase();
  const jm = (typeof jobs !== "undefined" && jobs[jobKey]?.statMultipliers)
    ? jobs[jobKey].statMultipliers
    : { str:1, agi:1, int:1, luck:1 };

  const elementEquipBonus = coreBonus.bonusData.elementEquip || {};
  const coreAtk = coreBonus.atk - (elementEquipBonus.atk || 0);
  const coreDef = coreBonus.def - (elementEquipBonus.def || 0);
  const coreHp  = coreBonus.hp  - (elementEquipBonus.hp  || 0);
  const coreMp  = coreBonus.mp  - (elementEquipBonus.mp  || 0);
  const coreStr = coreBonus.str - (elementEquipBonus.str || 0);
  const coreAgi = coreBonus.agi - (elementEquipBonus.agi || 0);
  const coreInt = coreBonus.int - (elementEquipBonus.int || 0);
  const coreLuk = coreBonus.luk - (elementEquipBonus.luk || 0);

  const totalStr = baseStats.str + coreStr + (elementEquipBonus.str || 0);
  const totalAgi = baseStats.agi + coreAgi + (elementEquipBonus.agi || 0);
  const totalInt = baseStats.int + coreInt + (elementEquipBonus.int || 0);
  const totalLuk = baseStats.luk + coreLuk + (elementEquipBonus.luk || 0);

  const strBonusAtk = roundToTwoDecimals(totalStr * (4 * (jm.str ?? 1)));
  const strBonusDef = roundToTwoDecimals(totalStr * (2 * (jm.str ?? 1)));
  const strBonusHp  = roundToTwoDecimals(totalStr * (30 * (jm.str ?? 1)));

  const agiBonusAtk = roundToTwoDecimals(totalAgi * (4 * (jm.agi ?? 1)));
  const agiBonusDef = roundToTwoDecimals(totalAgi * (0.5 * (jm.agi ?? 1)));
  const agiBonusHp  = roundToTwoDecimals(totalAgi * (10 * (jm.agi ?? 1)));

  const intBonusAtk = roundToTwoDecimals(totalInt * (4 * (jm.int ?? 1)));
  const intBonusDef = roundToTwoDecimals(totalInt * (0.5 * (jm.int ?? 1)));
  const intBonusHp  = roundToTwoDecimals(totalInt * (3 * (jm.int ?? 1)));
  const intBonusMp  = roundToTwoDecimals(totalInt * (30 * (jm.int ?? 1)));

  const lukBonusAtk = roundToTwoDecimals(totalLuk * (4 * (jm.luck ?? 1)));
  const lukBonusDef = roundToTwoDecimals(totalLuk * (0.5 * (jm.luck ?? 1)));
  const lukBonusHp  = roundToTwoDecimals(totalLuk * (10 * (jm.luck ?? 1)));

  content.innerHTML = `
    <strong>能力加成明細</strong><br><br>
    攻擊力：${total.atk}（基礎${baseStats.atk} + 核心${coreAtk} + 元素${roundToTwoDecimals(elementEquipBonus.atk || 0)}
      + 力量${strBonusAtk} + 敏捷${agiBonusAtk} + 智力${intBonusAtk} + 幸運${lukBonusAtk}，技能加成 ${Math.round((skillBonus.atkPercent||0)*100)}%）<br>
    防禦力：${total.def}（基礎${baseStats.def} + 核心${coreDef} + 元素${roundToTwoDecimals(elementEquipBonus.def || 0)}
      + 力量${strBonusDef} + 敏捷${agiBonusDef} + 智力${intBonusDef} + 幸運${lukBonusDef}，技能加成 ${Math.round((skillBonus.defPercent||0)*100)}%）<br>
    HP：${total.hp}（基礎${baseStats.hp} + 核心${coreHp} + 元素${roundToTwoDecimals(elementEquipBonus.hp || 0)}
      + 力量${strBonusHp} + 敏捷${agiBonusHp} + 智力${intBonusHp} + 幸運${lukBonusHp}，技能加成 ${Math.round((skillBonus.hpPercent||0)*100)}%）<br>
    MP：${total.mp}（基礎${baseStats.mp} + 核心${coreMp} + 元素${roundToTwoDecimals(elementEquipBonus.mp || 0)} + 智力${intBonusMp}
      ，技能加成 ${Math.round((skillBonus.mpPercent||0)*100)}%）<br><br>

    <strong>屬性點數</strong>（剩餘：${player.statPoints}）<br>
    力量（STR）：${baseStats.str} <button onclick="allocateStat('str')">＋</button>（核心${coreStr} + 元素${roundToTwoDecimals(elementEquipBonus.str || 0)}）<br>
    敏捷（AGI）：${baseStats.agi} <button onclick="allocateStat('agi')">＋</button>（核心${coreAgi} + 元素${roundToTwoDecimals(elementEquipBonus.agi || 0)}）<br>
    智力（INT）：${baseStats.int} <button onclick="allocateStat('int')">＋</button>（核心${coreInt} + 元素${roundToTwoDecimals(elementEquipBonus.int || 0)}）<br>
    幸運（LUK）：${baseStats.luk} <button onclick="allocateStat('luk')">＋</button>（核心${coreLuk} + 元素${roundToTwoDecimals(elementEquipBonus.luk || 0)}）<br>
  `;
  document.getElementById("statModal").style.display = "flex";
}

function initPlayer() {
  if (typeof player === "undefined") return setTimeout(initPlayer, 50);
  player.expToNext = getExpToNext(player.level);
  player.currentHP = player.totalStats.hp;
  player.currentMP = player.totalStats.mp;
//  startAutoRecover();
  createStatModal();
  if (typeof updateResourceUI === "function") updateResourceUI?.();
  if (typeof ensureSkillEvolution === "function") ensureSkillEvolution?.();
}

// === Player Export / Import (for unified save) ===
window.Player_exportState = function () {
  return {
    nickname: player.nickname,
    job: (player.job || '').toLowerCase(),
    level: player.level,
    exp: player.exp,
    statPoints: player.statPoints,
    baseStats: player.baseStats,
    gold: player.gold,
    gem: player.gem,
    stone: player.stone,
    magicShieldEnabled: !!player.magicShieldEnabled,
    currentHP: player.currentHP,
    currentMP: player.currentMP,
  };
};
window.Player_applyState = function (s) {
  if (!s || typeof s !== 'object') return;
  player.nickname = s.nickname ?? player.nickname;
  player.job      = s.job      ?? player.job;
  player.level    = s.level    ?? player.level;
  player.exp      = s.exp      ?? player.exp;
  player.statPoints = s.statPoints ?? player.statPoints;
  if (s.baseStats) Object.assign(player.baseStats, s.baseStats);
  player.gold     = s.gold  ?? player.gold;
  player.gem      = s.gem   ?? player.gem;
  player.stone    = s.stone ?? player.stone;
  player.magicShieldEnabled = !!s.magicShieldEnabled;
  player.currentHP = s.currentHP ?? player.totalStats.hp;
  player.currentMP = s.currentMP ?? player.totalStats.mp;

  player.expToNext = getExpToNext(player.level);
  if (typeof applyElementEquipmentBonusToPlayer === 'function') applyElementEquipmentBonusToPlayer();
  if (typeof ensureSkillEvolution === 'function') ensureSkillEvolution();
  if (typeof updateResourceUI === 'function') updateResourceUI();
};
