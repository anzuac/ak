// =======================
// player.js (整合修正版 - 無職業回退/轉換)
// =======================

const MAX_LEVEL = 200;

function normalizeJob(job) { return (job ?? "").toLowerCase(); }
// 取安全的 baseJob（若 utils_jobs.js 尚未載入就退回原 job）
function getBaseJobSafe(job) {
  const j = (job ?? "").toLowerCase();
  return (typeof window.getBaseJob === "function") ? window.getBaseJob(j) : j;
}

function roundToTwoDecimals(value) {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return parseFloat(value.toFixed(2));
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
    // 在 player.coreBonus 的回傳物件中加：
    get attackSpeedPct() { return calc("attackSpeedPct"); },
    //連擊
get doubleHitChance() { return calc("doubleHitChance"); },
get comboRate()       { return calc("comboRate"); },
    // 掉落類
    get expBonus() { return calc("expBonus"); },
    get dropBonus() { return calc("dropBonus"); },
    get goldBonus() { return calc("goldBonus"); },
    
    // 🆕 戰鬥類（技能樹會寫到 coreBonus，這裡要能讀）
    get critRate() { return calc("critRate"); },
    get critMultiplier() { return calc("critMultiplier"); },
    get dodgePercent() { return calc("dodgePercent"); }, //
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
      // 在 player.skillBonus 的回傳物件中加：
      get attackSpeedPct() { return calc("attackSpeedPct"); },
      //連擊
      get doubleHitChance() { return calc("doubleHitChance"); },
get comboRate()      
{ return calc("comboRate"); },
      // 🆕 新增：在 skillBonus 中加入 exp/drop/gold 加成
      get expBonus() { return calc("expBonus"); },
      get dropBonus() { return calc("dropBonus"); },
      get goldBonus() { return calc("goldBonus"); },
    };
  })(),


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
  currentHP: 0,
  currentMP: 0,
  gold: 1000,
  gem: 300,
  stone: 300,
  spellDamageBonus: 0,
  attackSpeedPctBase: 1,


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

  const jobKey  = (this.job ?? "").toLowerCase();
  const baseJob = getBaseJobSafe(jobKey); // ★ 用父系判定特性
  
  const jm = (typeof jobs !== "undefined" && jobs[jobKey]?.statMultipliers)
    ? jobs[jobKey].statMultipliers
    : { str: 1, agi: 1, int: 1, luck: 1 };
  
  const strAtk = totalStr * (5 * (jm.str ?? 1));
  const strDef = totalStr * (3 * (jm.str ?? 1));
  const strHp  = totalStr * (50 * (jm.str ?? 1));
  
  const agiAtk = totalAgi * (5 * (jm.agi ?? 1));
  const agiDef = totalAgi * (1.5 * (jm.agi ?? 1));
  const agiHp  = totalAgi * (20 * (jm.agi ?? 1));
  
  const intAtk = totalInt * (5 * (jm.int ?? 1));
  const intDef = totalInt * (1 * (jm.int ?? 1));
  const intHp  = totalInt * (3 * (jm.int ?? 1));
  const intMp  = totalInt * (50 * (jm.int ?? 1));
  
  const lukAtk = totalLuk * (5 * (jm.luck ?? 1));
  const lukDef = totalLuk * (1.5 * (jm.luck ?? 1));
  const lukHp  = totalLuk * (20 * (jm.luck ?? 1));
  
// 敏捷帶來的爆率加成
const agiCritRateBonus = totalAgi * (0.001 * (jm.agi ?? 1));

// ⬇️ 爆擊率 = 基礎 + skillBonus + coreBonus + 敏捷（先拆成兩段）
const baseRateNoAgi =
(this.critRate || 0) +
(this.skillBonus.critRate || 0) +
(this.coreBonus.critRate || 0);

const finalCritRateRaw = baseRateNoAgi + agiCritRateBonus;

// 超過 100% 的部分換成爆傷加成（把「非敏捷」與「敏捷」兩段分開計）
let critMulBonus = 0;
if (finalCritRateRaw > 1) {
// 非敏捷造成的溢出
const overflowNonAgi = Math.max(0, baseRateNoAgi - 1);
// 敏捷造成的溢出 = 總溢出 - 非敏捷溢出
const overflowAgi = Math.max(0, (finalCritRateRaw - 1) - overflowNonAgi);

// 轉爆傷：每 100% 溢出 → +10% 爆傷
const dmgFromNonAgi = overflowNonAgi * 0.1;
let dmgFromAgi = overflowAgi * 0.1;

// 只限制「敏捷這段」的轉爆傷上限（弓箭手才限制，150% = 1.5）
if (getBaseJobSafe(this.job) === "archer") {
dmgFromAgi = Math.min(dmgFromAgi, 1.5);
}

critMulBonus = dmgFromNonAgi + dmgFromAgi;
}

// 顯示/計算時的爆率仍然上限 100%
let finalCritRate = Math.min(1, finalCritRateRaw);

  
  
  
  
  
  
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
  const thiefDoubleHit = (baseJob === "thief") // ★ 用 baseJob
    ? Math.min(0.4, totalLuk * 0.0001)
    : 0;

  // 劍士特性：力量轉換減傷率（每 100 STR = +1%，最多 30%）
  let warriorDR = 0;
  if (baseJob === "warrior") { // ★ 用 baseJob
    warriorDR = Math.min(0.30, totalStr * 0.0001);
  }

  // 最終減傷率（全職業上限 70%）
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
    dodgePercent:   (Number(this.dodgePercent)   || 0) + (Number(this.skillBonus.dodgePercent)   || 0) + (Number(this.coreBonus.dodgePercent)   || 0),

    critRate:       Math.max(0, Math.min(1, finalCritRate)),
    critMultiplier: (Number(this.critMultiplier) || 0) + (Number(this.skillBonus.critMultiplier) || 0) + (Number(this.coreBonus.critMultiplier) || 0) + critMulBonus,
     
     attackSpeedPct: (
  (Number(this.attackSpeedPctBase) || 0) +
  (Number(this.coreBonus.attackSpeedPct) || 0) +
  (Number(this.skillBonus.attackSpeedPct) || 0)
),


    damageReduce:   finalDamageReduce,
    spellDamage:    (Number(this.spellDamageBonus)||0) + (Number(this.skillBonus.spellDamage) || 0),
    skillDamage:     totalSkillDamage,



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
// 安全取得父系職業（utils_jobs.js 尚未載入時，退回去尾數字）
function getBaseJobSafe(job) {
  const j = String(job || "").toLowerCase();
  if (typeof window.getBaseJob === "function") return window.getBaseJob(j);
  return j.replace(/\d+$/, ""); // mage2/3/4/5 -> mage
}

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

// 支援一次加多點：amount 可為數字或 "all"
function allocateStat(attribute, amount = 1) {
  if (player.statPoints <= 0) { alert("沒有可用的屬性點數！"); return; }
  
  // 目標加點數量
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
  
  // 非主要屬性提示（一次提示即可）
  if (multiplier === 0) {
    const ok = confirm(`這是 ${currentJob.name} 的非主要屬性，分配點數將不會有任何效果。你確定要分配 ${toSpend} 點嗎？`);
    if (!ok) return;
  }
  
  // 一次性加點與寫回
  const spend = Math.min(player.statPoints, toSpend);
  if (spend <= 0) return;
  
  player.baseStats[attribute] += spend;
  player.statPoints -= spend;
  
  // 一次更新/一次紀錄/一次存檔
  if (typeof updateResourceUI === "function") updateResourceUI?.();
  if (typeof logPrepend === "function") logPrepend?.(`✨ 成功分配 ${spend} 點到 ${attribute.toUpperCase()}！`);
  saveGame?.();
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

  const strBonusAtk = roundToTwoDecimals(totalStr * (5 * (jm.str ?? 1)));
  const strBonusDef = roundToTwoDecimals(totalStr * (3 * (jm.str ?? 1)));
  const strBonusHp  = roundToTwoDecimals(totalStr * (50 * (jm.str ?? 1)));

  const agiBonusAtk = roundToTwoDecimals(totalAgi * (5 * (jm.agi ?? 1)));
  const agiBonusDef = roundToTwoDecimals(totalAgi * (1.5 * (jm.agi ?? 1)));
  const agiBonusHp  = roundToTwoDecimals(totalAgi * (20 * (jm.agi ?? 1)));

  const intBonusAtk = roundToTwoDecimals(totalInt * (5 * (jm.int ?? 1)));
  const intBonusDef = roundToTwoDecimals(totalInt * (1 * (jm.int ?? 1)));
  const intBonusHp  = roundToTwoDecimals(totalInt * (3 * (jm.int ?? 1)));
  const intBonusMp  = roundToTwoDecimals(totalInt * (50 * (jm.int ?? 1)));

  const lukBonusAtk = roundToTwoDecimals(totalLuk * (5 * (jm.luck ?? 1)));
  const lukBonusDef = roundToTwoDecimals(totalLuk * (1.5 * (jm.luck ?? 1)));
  const lukBonusHp  = roundToTwoDecimals(totalLuk * (20 * (jm.luck ?? 1)));

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

// 在 player.js 的最末尾加入這行
window.player = player;
